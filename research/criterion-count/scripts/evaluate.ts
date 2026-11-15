/**
 * Loop instrument, not a funniness judge: counts how many answers in each
 * set satisfy one yes/no criterion that the experiment wrote for itself —
 * "did the kind of answer this change was aiming for appear?". It replaces
 * counting by hand in a generator's iteration log.
 *
 * Usage: doppler run -- node research/criterion-count/scripts/evaluate.ts <input.json> [output.json]
 * Input: { "criterion": { "question", "true", "false" }, "sets": <set or array of sets> }
 *   criterion  one descriptive question about a single answer, and what a
 *              yes and a no mean. Without the two definitions the judge says
 *              yes too often (humor-skills data/human-evals 2026-10-17).
 *   sets       { "topic", "answers": string[] } or an array of them, e.g. one
 *              per run of each version. "id" and "label" are optional, as in
 *              the other judge scripts.
 * Output: summaries[] (per set: `count` of answers at or above 0.5, `total`,
 * `mean` probability) and rows[] (per answer: `yes`, the probability).
 *
 * The count is only as good as the question. Before an experiment relies on
 * it, a human answers the same question on a sample of the judged answers
 * (`npm run inbox:spot-check`, see SKILL.md).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { answerSet, labelInputs, type Labeled } from './input.ts';

const { noul, TypeSafeClient } = await import('@typesafe-ai/sdk').catch((): never => {
  console.error('@typesafe-ai/sdk is not installed. Run `npm install` at the humor-skills repo root first.');
  process.exit(1);
});

const IN_PATH = process.argv[2];
const OUT_PATH = process.argv[3] ?? 'criterion-count-results.json';
if (!IN_PATH) {
  console.error('usage: node research/criterion-count/scripts/evaluate.ts <input.json> [output.json]');
  process.exit(1);
}
if (!process.env.TYPESAFE_API_KEY) {
  console.error('TYPESAFE_API_KEY is missing. Run through Doppler: doppler run -- node research/criterion-count/scripts/evaluate.ts');
  process.exit(1);
}

interface Criterion { question: string; true: string; false: string }
type Sample = Labeled<{ topic: string; answers: string[] }>;

/** An answer counts as a yes at or above this probability. */
const YES = 0.5;

function readInput(path: string): { criterion: Criterion; samples: Sample[] } {
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as { criterion?: Record<string, unknown>; sets?: unknown };
    const c = parsed.criterion;
    for (const key of ['question', 'true', 'false'] as const) {
      if (typeof c?.[key] !== 'string' || c[key] === '') throw new Error(`criterion.${key} must be a non-empty string`);
    }
    if (parsed.sets === undefined) throw new Error('sets is missing');
    return { criterion: c as unknown as Criterion, samples: labelInputs(parsed.sets, answerSet) };
  } catch (error) {
    console.error(`invalid input ${path}: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

const { criterion, samples } = readInput(IN_PATH);
const client = new TypeSafeClient({ timeout: 60_000 });
const question = { yes: noul(criterion.question, { true: criterion.true, false: criterion.false }) } as const;
const usage = { requests: 0, input_tokens: 0, output_tokens: 0 };

interface Row { sampleId: string; index: number; topic: string; answer: string; yes: number }

async function main(): Promise<void> {
  const rows: Row[] = [];
  for (const sample of samples) {
    rows.push(...await Promise.all(sample.answers.map(async (answer, i): Promise<Row> => {
      const result = await client.systemOne({ model: 'jev-latest', state: { お題: sample.topic, 回答: answer }, questions: question });
      usage.requests++;
      usage.input_tokens += result.usage.input_tokens;
      usage.output_tokens += result.usage.output_tokens;
      return { sampleId: sample.id, index: i + 1, topic: sample.topic, answer, yes: result.answers.yes.noul };
    })));
  }

  const summaries = samples.map((sample) => {
    const own = rows.filter((r) => r.sampleId === sample.id);
    return {
      id: sample.id,
      label: sample.label,
      count: own.filter((r) => r.yes >= YES).length,
      total: own.length,
      mean: own.reduce((a, r) => a + r.yes, 0) / own.length,
    };
  });

  writeFileSync(OUT_PATH, `${JSON.stringify({ usage, criterion, yesAt: YES, summaries, rows }, null, 2)}\n`);

  console.log(`criterion: ${criterion.question}`);
  for (const s of summaries) {
    console.log(`\n== ${s.id}: ${s.label} — ${s.count}/${s.total} (mean ${s.mean.toFixed(2)})`);
    for (const r of rows.filter((x) => x.sampleId === s.id && x.yes >= YES)) console.log(`  yes ${r.yes.toFixed(2)}  #${r.index} ${r.answer}`);
  }
  const usd = (usage.input_tokens * 42) / 1e9 + (usage.output_tokens * 42) / 1e9;
  console.log(`\n${usage.requests} requests / in ${usage.input_tokens} out ${usage.output_tokens} tokens (~$${usd.toFixed(5)})  -> ${OUT_PATH}`);
}

try {
  await main();
} catch (error) {
  console.error(`criterion-count failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
