/**
 * Per-answer traits that agree with human judgments of 大喜利 answers:
 * whether a concrete thing or happening is on the table, and whether the
 * idea is said indirectly. Descriptive questions, not "is it funny".
 *
 * Usage: doppler run -- node scripts/evaluate.ts [input.json] [output.json]
 * Input: [{ "id", "label", "topic", "answers": string[] }, ...] — a single
 * { "topic", "answers": [...] } object also works (wrapped as one sample).
 * Defaults to this skill's assets/samples.json / a results.json in the CWD.
 *
 * Validated against human hits in humor-skills data/human-evals
 * (reports/validation/2026-09-24): `concrete` AUC 0.66-0.67 and 6 of 7 set
 * preferences, `indirect` AUC 0.62-0.64 (lower = better). Both are weak on
 * a single answer; compare set means against a previous version of the
 * same generator on the same topics. The questions were written from the
 * same labels they were checked on, so treat the numbers as optimistic
 * until a fresh human session confirms them.
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
const OUT_PATH = process.argv[3] ?? 'trait-check-results.json';

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

const traits = {
  /**
   * "Does a scene come to mind" let concept-only jokes through — a rule
   * restated in other words reads as a scene to the judge (AUC 0.60).
   */
  concrete: noul(
    '回答に、質感のある具体的な物、実際に起きている現象、または制度・設備・役割の具体的な異常が出てくるか？',
    {
      true: '具体的な物・出来事・現象が一つ置かれている。',
      false: 'ルール・概念・評価の言い換えだけで、物も出来事も出てこない。',
    },
  ),
  /** "Could it be cut by 30%" missed the finding it stands for: the same idea said straight and short wins. */
  indirect: noul(
    '同じ着眼点を、説明的・遠回しに言っているか？',
    {
      true: '説明や前置きが多く、直球で言い切っていない。',
      false: '直球で短く言い切っている。',
    },
  ),
} as const;

type TraitKey = keyof typeof traits;
const traitKeys = Object.keys(traits) as TraitKey[];

const usage = { requests: 0, input_tokens: 0, output_tokens: 0 };

interface Row {
  sampleId: string;
  index: number;
  answer: string;
  traits: Record<TraitKey, number>;
}

async function checkAnswer(sample: Sample, answer: string, index: number): Promise<Row> {
  const result = await client.systemOne({
    model: 'jev-latest',
    state: { お題: sample.topic, 回答: answer },
    questions: traits,
  });

  usage.requests++;
  usage.input_tokens += result.usage.input_tokens;
  usage.output_tokens += result.usage.output_tokens;

  return {
    sampleId: sample.id,
    index,
    answer,
    traits: Object.fromEntries(traitKeys.map((key) => [key, result.answers[key].noul])) as Record<TraitKey, number>,
  };
}

const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

async function main(): Promise<void> {
  const rows: Row[] = [];
  for (const sample of samples) {
    rows.push(...await Promise.all(sample.answers.map((answer, i) => checkAnswer(sample, answer, i + 1))));
  }

  const summaries = samples.map((sample) => {
    const own = rows.filter((r) => r.sampleId === sample.id);
    return {
      id: sample.id,
      label: sample.label,
      means: Object.fromEntries(traitKeys.map((key) => [key, mean(own.map((r) => r.traits[key]))])) as Record<TraitKey, number>,
    };
  });

  writeFileSync(OUT_PATH, `${JSON.stringify({ usage, summaries, rows }, null, 2)}\n`);

  for (const s of summaries) {
    console.log(`\n== ${s.id}: ${s.label}`);
    console.log(`  concrete ${s.means.concrete.toFixed(2)} (higher = better)  indirect ${s.means.indirect.toFixed(2)} (lower = better)`);
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
  console.error(`trait-check failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
