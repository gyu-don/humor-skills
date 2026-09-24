/**
 * Jev port of this skill's SKILL.md: pairwise A/B comparison with a
 * relevance/empathy footcut, then a winner and confidence.
 *
 * Usage: doppler run -- node scripts/evaluate.ts [input.json] [output.json]
 * Input: [{ "id", "label", "topic", "answerA", "answerB" }, ...] — a single
 * { "topic", "answerA", "answerB" } object also works (wrapped as one sample).
 * Defaults to this skill's assets/samples.json / a results.json in the CWD.
 *
 * The original skill already does by hand what Jev's `choice` does natively:
 * it returns a probability distribution over the alternatives, which *is*
 * the confidence score, and it re-runs with A/B swapped to cancel position
 * bias (the same log-odds-averaging trick used for the MBTI polarity
 * experiment in jev-practice). So here that swap-and-average is the whole
 * comparison step, not a manual sanity check on top of it.
 *
 * The winner comes from two criterion-level comparisons, not one holistic
 * "which should be adopted" question. Validated against human preferences
 * (humor-skills reports/validation/2026-09-24), the holistic question was at
 * chance (it preferred the hit in 54% of in-set pairs, and only 38–47% of
 * its confident calls), and the skill's own first criterion, 回収可能性,
 * was worse than chance (36%). Asked separately, "which one puts a concrete
 * thing or happening on the table" and "which one says it straight and
 * short" each agreed with the human ~65% of the time; their average agreed
 * on 66% of in-set pairs and 10 of the 13 pairs the human compared
 * directly. These questions came from the same labels they were checked
 * on, so treat the numbers as optimistic until a fresh human session
 * confirms them. The holistic probability is still reported as
 * `holisticProbA`, for comparison only.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * `@typesafe-ai/sdk` is this skill's only dependency, and a freshly installed
 * copy of the skill doesn't have it yet — say so with the fix rather than
 * letting Node throw a bare ERR_MODULE_NOT_FOUND.
 */
const { choice, noul, TypeSafeClient } = await import('@typesafe-ai/sdk').catch((): never => {
  console.error('@typesafe-ai/sdk is not installed. Run `npm install` in this skill directory first.');
  process.exit(1);
});

const DEFAULT_SAMPLES_PATH = fileURLToPath(new URL('../assets/samples.json', import.meta.url));
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
  console.error('TYPESAFE_API_KEY is missing. Run through Doppler: doppler run -- node scripts/evaluate.ts');
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

/** Step 2 criteria that agree with human preferences, one `choice` each. */
const criteria = {
  concrete: '質感のある具体的な物、または実際に起きている現象・出来事がはっきり置かれているのはどちらか？',
  straight: '説明や前置きがなく、直球で短く言い切っているのはどちらか？',
  holistic: 'この2つの回答のうち、採用に近づけるべきなのはどちらか？',
} as const;

type CriterionKey = keyof typeof criteria;

/** One call asking every criterion about two labeled answers. */
async function pick(topic: string, first: string, second: string): Promise<Record<CriterionKey, number>> {
  const opts = { first: `回答: ${first}`, second: `回答: ${second}` };
  const result = await client.systemOne({
    model: 'jev-latest',
    state: { お題: topic },
    questions: {
      concrete: choice(criteria.concrete, opts),
      straight: choice(criteria.straight, opts),
      holistic: choice(criteria.holistic, opts),
    },
  });
  usage.requests++;
  usage.input_tokens += result.usage.input_tokens;
  usage.output_tokens += result.usage.output_tokens;
  return {
    concrete: result.answers.concrete.probabilities.first,
    straight: result.answers.straight.probabilities.first,
    holistic: result.answers.holistic.probabilities.first,
  };
}

interface Result {
  id: string;
  label: string;
  footcutA: { relevance: number; empathy: number };
  footcutB: { relevance: number; empathy: number };
  /** Per-criterion probability that A wins, averaged over both presentation orders. */
  criteria: Record<CriterionKey, number>;
  /** Mean of the validated criteria (concrete, straight): the probability that A is the better candidate. */
  probA: number;
  /** The single "which should be adopted" question — at chance against human labels; for comparison only. */
  holisticProbA: number;
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
  const byCriterion = Object.fromEntries(
    (Object.keys(criteria) as CriterionKey[]).map((k) => [k, (normal[k] + (1 - swapped[k])) / 2]),
  ) as Record<CriterionKey, number>;
  const probA = (byCriterion.concrete + byCriterion.straight) / 2;

  const confidence = Math.abs(probA - 0.5) * 2;
  const winner: Result['winner'] = confidence <= 0.1 ? 'draw' : probA > 0.5 ? 'A' : 'B';

  return {
    id: sample.id, label: sample.label, footcutA, footcutB,
    criteria: byCriterion, probA, holisticProbA: byCriterion.holistic, winner, confidence,
  };
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
    console.log(`  concrete ${r.criteria.concrete.toFixed(2)}  straight ${r.criteria.straight.toFixed(2)}  (holistic ${r.holisticProbA.toFixed(2)})`);
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
