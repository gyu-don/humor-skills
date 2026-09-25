/**
 * 被りチェック: flags answer pairs in one set that use the same material at
 * the core of the joke — "two of these, one would do".
 *
 * Usage: doppler run -- node scripts/evaluate.ts [input.json] [output.json]
 * Input: [{ "id", "label", "topic", "answers": string[] }, ...] — a single
 * { "topic", "answers": [...] } object also works (wrapped as one sample).
 * Defaults to this skill's assets/samples.json / a results.json in the CWD.
 *
 * One atomic question per answer pair, plus an exact-match check in code.
 * Each pair is judged on its own, so the judge is never asked to "find the
 * duplicates" in a set — asked that way, a prompt judge invents similarity
 * when there is none (validated against blind human similarity labels in
 * humor-skills data/human-evals, 2026-09-23). Not covered: set-wide
 * convergence on the same *direction* of reinterpretation with different
 * material — no per-pair question separated it from unrelated pairs.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * `@typesafe-ai/sdk` is this skill's only dependency, and a freshly installed
 * copy of the skill doesn't have it yet — say so with the fix rather than
 * letting Node throw a bare ERR_MODULE_NOT_FOUND.
 */
const { noul, TypeSafeClient } = await import('@typesafe-ai/sdk').catch((): never => {
  console.error('@typesafe-ai/sdk is not installed. Run `npm install` in this skill directory first.');
  process.exit(1);
});

const DEFAULT_SAMPLES_PATH = fileURLToPath(new URL('../assets/samples.json', import.meta.url));
const IN_PATH = process.argv[2] ?? DEFAULT_SAMPLES_PATH;
const OUT_PATH = process.argv[3] ?? 'overlap-check-results.json';

interface Sample {
  id: string;
  label: string;
  topic: string;
  answers: string[];
}

if (!process.env.TYPESAFE_API_KEY) {
  console.error('TYPESAFE_API_KEY is missing. Run through Doppler: doppler run -- node scripts/evaluate.ts');
  process.exit(1);
}

const parsed = JSON.parse(readFileSync(IN_PATH, 'utf8')) as Sample[] | Omit<Sample, 'id' | 'label'>;
const samples: Sample[] = Array.isArray(parsed) ? parsed : [{ id: 'input', label: 'input', ...parsed }];
const client = new TypeSafeClient({ timeout: 60_000 });

const question = {
  sameMaterial: noul(
    '2つの回答は、笑いの中心に同じ素材（同じ物・人・場所・出来事）を使っているか？',
    {
      true: '笑いの中心の素材が同じか、ほぼ同じ。',
      false: '笑いの中心の素材が別物。お題の言葉が共通しているだけの場合もこちら。',
    },
  ),
} as const;

/**
 * Calibrated on blind human similarity judgments (2026-09-23): at 0.7 it
 * caught 3-4 of 5 pairs the human called 被り (one sits right at the
 * threshold) and flagged none of the 10 they called different.
 * Topic-imposed forms (e.g. every answer being a katakana word) sit just
 * below it, so compare against a baseline set rather than reading one set's
 * count as absolute.
 */
const NEAR_DUPLICATE = 0.7;

/** Exact duplicates are a string question, not a Jev one. */
const normalize = (s: string): string => s.normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu, '');

const usage = { requests: 0, input_tokens: 0, output_tokens: 0 };

interface Overlap {
  sampleId: string;
  a: number;
  b: number;
  sameMaterial: number;
  exact: boolean;
  nearDuplicate: boolean;
}

async function overlaps(sample: Sample): Promise<Overlap[]> {
  const pairs = sample.answers.flatMap((_, i) => sample.answers.slice(i + 1).map((__, k) => [i, i + 1 + k] as const));
  return Promise.all(pairs.map(async ([i, j]) => {
    const result = await client.systemOne({
      model: 'jev-latest',
      state: { お題: sample.topic, 回答1: sample.answers[i], 回答2: sample.answers[j] },
      questions: question,
    });
    usage.requests++;
    usage.input_tokens += result.usage.input_tokens;
    usage.output_tokens += result.usage.output_tokens;
    const sameMaterial = result.answers.sameMaterial.noul;
    const exact = normalize(sample.answers[i]) === normalize(sample.answers[j]);
    return { sampleId: sample.id, a: i + 1, b: j + 1, sameMaterial, exact, nearDuplicate: exact || sameMaterial >= NEAR_DUPLICATE };
  }));
}

async function main(): Promise<void> {
  const rows: Overlap[] = [];
  for (const sample of samples) rows.push(...await overlaps(sample));

  const summaries = samples.map((sample) => ({
    id: sample.id,
    label: sample.label,
    nearDuplicates: rows.filter((o) => o.sampleId === sample.id && o.nearDuplicate).map((o) => [o.a, o.b]),
  }));

  writeFileSync(OUT_PATH, `${JSON.stringify({ usage, summaries, overlaps: rows }, null, 2)}\n`);

  for (const s of summaries) {
    console.log(`\n== ${s.id}: ${s.label}`);
    console.log(`  near duplicates (${NEAR_DUPLICATE}+ or exact): ${s.nearDuplicates.map(([a, b]) => `${a}-${b}`).join(', ') || 'none'}`);
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
  console.error(`overlap-check failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
