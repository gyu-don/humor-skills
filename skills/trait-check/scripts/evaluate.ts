/**
 * Per-answer traits that agree with human judgments of 大喜利 answers:
 * whether a concrete thing or happening is on the table, and whether the
 * idea is said indirectly. Descriptive questions, not "is it funny".
 *
 * Usage: doppler run -- node scripts/evaluate.ts [input.json] [output.json]
 * Input: { "topic", "answers": string[] }, or an array of them for several
 * sets. "id" and "label" are optional; an array item without "id" becomes
 * "set-<n>" (1-based) and duplicate ids are rejected, since summaries are
 * keyed by id.
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
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { answerSet, readInputs } from './input.ts';
import { scoreAnswer, traitKeys, type TraitKey, usage, usageLine } from './judge.ts';

const DEFAULT_SAMPLES_PATH = fileURLToPath(new URL('../assets/samples.json', import.meta.url));
const IN_PATH = process.argv[2] ?? DEFAULT_SAMPLES_PATH;
const OUT_PATH = process.argv[3] ?? 'trait-check-results.json';

const samples = readInputs(IN_PATH, answerSet);

interface Row {
  sampleId: string;
  index: number;
  answer: string;
  traits: Record<TraitKey, number>;
}

const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

async function main(): Promise<void> {
  const rows: Row[] = [];
  const summaries = [];
  for (const sample of samples) {
    const own = await Promise.all(sample.answers.map(async (answer, i): Promise<Row> => ({
      sampleId: sample.id, index: i + 1, answer, traits: await scoreAnswer(sample.topic, answer),
    })));
    rows.push(...own);
    summaries.push({
      id: sample.id,
      label: sample.label,
      means: Object.fromEntries(traitKeys.map((key) => [key, mean(own.map((r) => r.traits[key]))])) as Record<TraitKey, number>,
    });
  }

  writeFileSync(OUT_PATH, `${JSON.stringify({ usage, summaries, rows }, null, 2)}\n`);

  for (const s of summaries) {
    console.log(`\n== ${s.id}: ${s.label}`);
    console.log(`  concrete ${s.means.concrete.toFixed(2)} (higher = better)  indirect ${s.means.indirect.toFixed(2)} (lower = better)`);
  }
  console.log(`\n${usageLine(OUT_PATH)}`);
}

try {
  await main();
} catch (error) {
  console.error(`trait-check failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
