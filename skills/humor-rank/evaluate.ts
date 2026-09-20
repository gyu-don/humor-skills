/**
 * Jev port of this skill's SKILL.md: pairwise A/B comparison with a
 * relevance/empathy footcut, then a winner and confidence.
 *
 * Usage: doppler run -- node evaluate.ts [input.json] [output.json]
 * Input: [{ "id", "label", "topic", "answerA", "answerB" }, ...] — a single
 * { "topic", "answerA", "answerB" } object also works (wrapped as one sample).
 * Defaults to this directory's samples.json / a results.json in the CWD.
 *
 * The original skill already does by hand what Jev's `choice` does natively:
 * it returns a probability distribution over the alternatives, which *is*
 * the confidence score, and it re-runs with A/B swapped to cancel position
 * bias (the same log-odds-averaging trick used for the MBTI polarity
 * experiment in jev-practice). So here that swap-and-average is the whole
 * comparison step, not a manual sanity check on top of it.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { choice, noul, TypeSafeClient } from '@typesafe-ai/sdk';

const DEFAULT_SAMPLES_PATH = fileURLToPath(new URL('./samples.json', import.meta.url));
const IN_PATH = process.argv[2] ?? DEFAULT_SAMPLES_PATH;
const OUT_PATH = process.argv[3] ?? 'humor-rank-results.json';

interface Sample {
  id: string;
  label: string;
  topic: string;
  answerA: string;
  answerB: string;
}

if (!process.env.TYPESAFE_API_KEY) {
  console.error('TYPESAFE_API_KEY is missing. Run through Doppler: doppler run -- node evaluate.ts');
  process.exit(1);
}

const parsed = JSON.parse(readFileSync(IN_PATH, 'utf8')) as Sample[] | Omit<Sample, 'id' | 'label'>;
const samples: Sample[] = Array.isArray(parsed) ? parsed : [{ id: 'input', label: 'input', ...parsed }];
const client = new TypeSafeClient({ timeout: 60_000 });

const footcut = {
  relevance: noul(
    'お題と1文で接続できるか？',
    { true: 'お題に直接答えている。', false: 'お題の言葉を言い換えただけ、または無関係に成立する。' },
  ),
  empathy: noul(
    '日本語話者が状況を「あるある/わかる」と感じられるか？',
    { true: '土台の場面に覚えがあり、動機に「わかってしまう」感がある。', false: '状況の納得感がない。' },
  ),
} as const;

const usage = { requests: 0, input_tokens: 0, output_tokens: 0 };

async function checkFootcut(topic: string, answer: string): Promise<{ relevance: number; empathy: number }> {
  const result = await client.systemOne({
    model: 'jev-latest',
    state: { お題: topic, 回答: answer },
    questions: footcut,
  });
  usage.requests++;
  usage.input_tokens += result.usage.input_tokens;
  usage.output_tokens += result.usage.output_tokens;
  return { relevance: result.answers.relevance.noul, empathy: result.answers.empathy.noul };
}

/** One `choice` call between two labeled answers. */
async function pick(topic: string, first: string, second: string): Promise<{ first: number; second: number }> {
  const result = await client.systemOne({
    model: 'jev-latest',
    state: { お題: topic },
    questions: {
      winner: choice('この2つの回答のうち、採用に近づけるべきなのはどちらか？', {
        first: `回答: ${first}`,
        second: `回答: ${second}`,
      }),
    },
  });
  usage.requests++;
  usage.input_tokens += result.usage.input_tokens;
  usage.output_tokens += result.usage.output_tokens;
  return { first: result.answers.winner.probabilities.first, second: result.answers.winner.probabilities.second };
}

interface Result {
  id: string;
  label: string;
  footcutA: { relevance: number; empathy: number };
  footcutB: { relevance: number; empathy: number };
  /** Probability that A is the better candidate, averaged over both presentation orders. */
  probA: number;
  winner: 'A' | 'B' | 'draw';
  confidence: number;
}

async function compare(sample: Sample): Promise<Result> {
  const [footcutA, footcutB] = await Promise.all([
    checkFootcut(sample.topic, sample.answerA),
    checkFootcut(sample.topic, sample.answerB),
  ]);

  // Run both presentation orders and average A's win probability, cancelling position bias.
  const [normal, swapped] = await Promise.all([
    pick(sample.topic, sample.answerA, sample.answerB),
    pick(sample.topic, sample.answerB, sample.answerA),
  ]);
  const probA = (normal.first + swapped.second) / 2;

  const confidence = Math.abs(probA - 0.5) * 2;
  const winner: Result['winner'] = confidence <= 0.1 ? 'draw' : probA > 0.5 ? 'A' : 'B';

  return { id: sample.id, label: sample.label, footcutA, footcutB, probA, winner, confidence };
}

async function main(): Promise<void> {
  const results: Result[] = [];
  for (const sample of samples) {
    results.push(await compare(sample));
  }

  writeFileSync(OUT_PATH, `${JSON.stringify({ usage, results }, null, 2)}\n`);

  for (const r of results) {
    console.log(`\n== ${r.id}: ${r.label}`);
    console.log(`  footcut A: relevance ${r.footcutA.relevance.toFixed(2)} empathy ${r.footcutA.empathy.toFixed(2)}`);
    console.log(`  footcut B: relevance ${r.footcutB.relevance.toFixed(2)} empathy ${r.footcutB.empathy.toFixed(2)}`);
    console.log(`  winner: ${r.winner}  (P(A wins)=${r.probA.toFixed(2)}, confidence ${r.confidence.toFixed(2)})`);
  }

  const usd = (usage.input_tokens * 42) / 1e9 + (usage.output_tokens * 42) / 1e9;
  console.log(
    `\n${usage.requests} requests / in ${usage.input_tokens} out ${usage.output_tokens} tokens ` +
      `(~$${usd.toFixed(5)})  -> ${OUT_PATH}`,
  );
}

try {
  await main();
} catch (error) {
  console.error(`humor-rank failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
