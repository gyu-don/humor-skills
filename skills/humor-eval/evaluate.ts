/**
 * Jev port of this skill's SKILL.md: 6-axis 0-4 scoring
 * (Novelty/Clarity/Relevance/Intelligence/Empathy/Overall), with the same
 * Relevance/Empathy floor rule applied in code.
 *
 * Usage: doppler run -- node evaluate.ts [input.json] [output.json]
 * Input: [{ "id", "label", "topic", "answers": string[] }, ...] — a single
 * { "topic", "answers": [...] } object also works (wrapped as one sample).
 * Defaults to this directory's samples.json / a results.json in the CWD.
 *
 * The original skill needs 2 independent LLM-judge passes per set because a
 * single prose score swings noticeably between identical reruns (ogiri-ai's
 * DEVELOPMENT.md measured Overall-average deltas below 0.4 as noise). Jev's
 * `score` returns a probability-weighted expected value from one call, which
 * is the thing worth checking here: does one Jev call already sit inside
 * that same noise band, making the second pass unnecessary?
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { score, TypeSafeClient } from '@typesafe-ai/sdk';

const DEFAULT_SAMPLES_PATH = fileURLToPath(new URL('./samples.json', import.meta.url));
const IN_PATH = process.argv[2] ?? DEFAULT_SAMPLES_PATH;
const OUT_PATH = process.argv[3] ?? 'humor-eval-results.json';

interface Sample {
  id: string;
  label: string;
  topic: string;
  answers: string[];
}

if (!process.env.TYPESAFE_API_KEY) {
  console.error('TYPESAFE_API_KEY is missing. Run through Doppler: doppler run -- node evaluate.ts');
  process.exit(1);
}

const parsed = JSON.parse(readFileSync(IN_PATH, 'utf8')) as Sample[] | Omit<Sample, 'id' | 'label'>;
const samples: Sample[] = Array.isArray(parsed) ? parsed : [{ id: 'input', label: 'input', ...parsed }];
const client = new TypeSafeClient({ timeout: 60_000 });

const rubric = [
  '成立していない',
  '弱い',
  '最低限成立',
  '良い',
  '強い',
] as const;

const axes = {
  novelty: score('発想の新しさ。ありきたり回避', rubric),
  clarity: score('1読で意味と絵が取れるか', rubric),
  relevance: score('お題との接続の強さ', rubric),
  intelligence: score('ひねり・回収のうまさ', rubric),
  empathy: score('人間が「わかる」と乗れる感覚', rubric),
  overall: score('総合的な刺さりやすさ', rubric),
} as const;

type AxisKey = keyof typeof axes;
const axisKeys = Object.keys(axes) as AxisKey[];

const usage = { requests: 0, input_tokens: 0, output_tokens: 0 };

interface Row {
  sampleId: string;
  index: number;
  answer: string;
  scores: Record<AxisKey, number>;
  /** Overall capped at 2 when relevance<=1 or empathy<=1, per the original skill's Step 2. */
  overallFloored: number;
}

async function evalAnswer(sample: Sample, answer: string, index: number): Promise<Row> {
  const result = await client.systemOne({
    model: 'jev-latest',
    state: { お題: sample.topic, 回答: answer },
    questions: axes,
  });

  usage.requests++;
  usage.input_tokens += result.usage.input_tokens;
  usage.output_tokens += result.usage.output_tokens;

  const scores = Object.fromEntries(
    axisKeys.map((key) => [key, result.answers[key].score]),
  ) as Record<AxisKey, number>;

  const floored = scores.relevance <= 1 || scores.empathy <= 1
    ? Math.min(2, scores.overall)
    : scores.overall;

  return { sampleId: sample.id, index, answer, scores, overallFloored: floored };
}

const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

async function main(): Promise<void> {
  const rows: Row[] = [];

  for (const sample of samples) {
    const batch = await Promise.all(
      sample.answers.map((answer, i) => evalAnswer(sample, answer, i + 1)),
    );
    rows.push(...batch);
  }

  const summaries = samples.map((sample) => {
    const own = rows.filter((r) => r.sampleId === sample.id);
    const axisMeans = Object.fromEntries(
      axisKeys.map((key) => [key, mean(own.map((r) => r.scores[key]))]),
    ) as Record<AxisKey, number>;
    const bottleneck = axisKeys
      .filter((k) => k !== 'overall')
      .reduce((worst, k) => (axisMeans[k] < axisMeans[worst] ? k : worst), 'novelty' as AxisKey);
    return {
      id: sample.id,
      label: sample.label,
      axisMeans,
      overallFlooredMean: mean(own.map((r) => r.overallFloored)),
      peakCount: own.filter((r) => r.overallFloored >= 3.5).length,
      bottleneck,
    };
  });

  writeFileSync(OUT_PATH, `${JSON.stringify({ usage, summaries, rows }, null, 2)}\n`);

  for (const s of summaries) {
    console.log(`\n== ${s.id}: ${s.label}`);
    for (const key of axisKeys) {
      console.log(`  ${key.padEnd(14)} ${s.axisMeans[key].toFixed(2)}`);
    }
    console.log(`  overall(floored)  ${s.overallFlooredMean.toFixed(2)}  peak(>=3.5) ${s.peakCount}`);
    console.log(`  bottleneck axis   ${s.bottleneck}`);
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
  console.error(`humor-eval failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
