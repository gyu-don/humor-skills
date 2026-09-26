/**
 * Pairwise version of evaluate.ts: for two answers to the same お題, which one
 * puts a concrete thing or happening on the table, and which one says it
 * straight and short. Their mean is the probability that A is the better
 * candidate.
 *
 * Usage: doppler run -- node scripts/compare.ts [input.json] [output.json]
 * Input: [{ "id", "label", "topic", "answerA", "answerB" }, ...] — a single
 * { "topic", "answerA", "answerB" } object also works (wrapped as one sample).
 * Defaults to this skill's assets/pairs.json / a results.json in the CWD.
 *
 * Each question is asked in both presentation orders and averaged, which
 * cancels position bias; Jev's `choice` probability is the confidence.
 *
 * Validated against human preferences (humor-skills
 * reports/validation/2026-09-24): the mean agreed on 66% of hit-vs-non-hit
 * pairs inside one set and 10 of the 13 pairs the human compared directly.
 * A single holistic "which should be adopted / which is funnier" question
 * was at chance or worse, so it is not asked here. The questions came from
 * the same labels they were checked on, so treat the numbers as optimistic
 * until a fresh human session confirms them.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * `@typesafe-ai/sdk` is this skill's only dependency, and a freshly installed
 * copy of the skill doesn't have it yet — say so with the fix rather than
 * letting Node throw a bare ERR_MODULE_NOT_FOUND.
 */
const { choice, TypeSafeClient } = await import('@typesafe-ai/sdk').catch((): never => {
  console.error('@typesafe-ai/sdk is not installed. Run `npm install` in this skill directory first.');
  process.exit(1);
});

const DEFAULT_PAIRS_PATH = fileURLToPath(new URL('../assets/pairs.json', import.meta.url));
const IN_PATH = process.argv[2] ?? DEFAULT_PAIRS_PATH;
const OUT_PATH = process.argv[3] ?? 'trait-compare-results.json';

interface Sample {
  id: string;
  label: string;
  topic: string;
  answerA: string;
  answerB: string;
}

if (!process.env.TYPESAFE_API_KEY) {
  console.error('TYPESAFE_API_KEY is missing. Run through Doppler: doppler run -- node scripts/compare.ts');
  process.exit(1);
}

const parsed = JSON.parse(readFileSync(IN_PATH, 'utf8')) as Sample[] | Omit<Sample, 'id' | 'label'>;
const samples: Sample[] = Array.isArray(parsed) ? parsed : [{ id: 'input', label: 'input', ...parsed }];
const client = new TypeSafeClient({ timeout: 60_000 });

const criteria = {
  concrete: '質感のある具体的な物、または実際に起きている現象・出来事がはっきり置かれているのはどちらか？',
  straight: '説明や前置きがなく、直球で短く言い切っているのはどちらか？',
} as const;

type CriterionKey = keyof typeof criteria;
const criterionKeys = Object.keys(criteria) as CriterionKey[];

const usage = { requests: 0, input_tokens: 0, output_tokens: 0 };

/** One call asking every criterion about two labeled answers; returns P(first wins) per criterion. */
async function pick(topic: string, first: string, second: string): Promise<Record<CriterionKey, number>> {
  const opts = { first: `回答: ${first}`, second: `回答: ${second}` };
  const result = await client.systemOne({
    model: 'jev-latest',
    state: { お題: topic },
    questions: Object.fromEntries(criterionKeys.map((k) => [k, choice(criteria[k], opts)])),
  });
  usage.requests++;
  usage.input_tokens += result.usage.input_tokens;
  usage.output_tokens += result.usage.output_tokens;
  return Object.fromEntries(
    criterionKeys.map((k) => [k, (result.answers[k] as { probabilities: Record<string, number> }).probabilities.first]),
  ) as Record<CriterionKey, number>;
}

interface Result {
  id: string;
  label: string;
  /** Per-criterion probability that A wins, averaged over both presentation orders. */
  criteria: Record<CriterionKey, number>;
  /** Mean of the criteria: the probability that A is the better candidate. */
  probA: number;
  winner: 'A' | 'B' | 'draw';
  confidence: number;
}

async function compare(sample: Sample): Promise<Result> {
  const [normal, swapped] = await Promise.all([
    pick(sample.topic, sample.answerA, sample.answerB),
    pick(sample.topic, sample.answerB, sample.answerA),
  ]);
  const byCriterion = Object.fromEntries(
    criterionKeys.map((k) => [k, (normal[k] + (1 - swapped[k])) / 2]),
  ) as Record<CriterionKey, number>;
  const probA = criterionKeys.reduce((sum, k) => sum + byCriterion[k], 0) / criterionKeys.length;
  const confidence = Math.abs(probA - 0.5) * 2;
  const winner: Result['winner'] = confidence <= 0.1 ? 'draw' : probA > 0.5 ? 'A' : 'B';
  return { id: sample.id, label: sample.label, criteria: byCriterion, probA, winner, confidence };
}

async function main(): Promise<void> {
  const results = await Promise.all(samples.map(compare));

  writeFileSync(OUT_PATH, `${JSON.stringify({ usage, results }, null, 2)}\n`);

  for (const r of results) {
    console.log(`\n== ${r.id}: ${r.label}`);
    console.log(`  concrete ${r.criteria.concrete.toFixed(2)}  straight ${r.criteria.straight.toFixed(2)}`);
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
  console.error(`trait-check compare failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
