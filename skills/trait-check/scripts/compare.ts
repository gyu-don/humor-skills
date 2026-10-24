/**
 * Pairwise version of evaluate.ts: for two answers to the same お題, which one
 * puts a concrete thing or happening on the table, and which one says it
 * straight and short. Their mean is the probability that A is the better
 * candidate.
 *
 * Usage: doppler run -- node scripts/compare.ts [input.json] [output.json]
 * Input: { "topic", "answerA", "answerB" }, or an array of them. "id" and
 * "label" are optional; an array item without "id" becomes "set-<n>"
 * (1-based) and duplicate ids are rejected.
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
 *
 * To compare two versions of a generator, use gate.ts: it runs every
 * candidate × baseline pair and measures the noise band from the baseline's
 * own two runs.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { answerPair, readInputs } from './input.ts';
import { compareAnswers, usage, usageLine } from './judge.ts';

const DEFAULT_PAIRS_PATH = fileURLToPath(new URL('../assets/pairs.json', import.meta.url));
const IN_PATH = process.argv[2] ?? DEFAULT_PAIRS_PATH;
const OUT_PATH = process.argv[3] ?? 'trait-compare-results.json';

const samples = readInputs(IN_PATH, answerPair);

async function main(): Promise<void> {
  const results = await Promise.all(samples.map(async (s) => ({
    id: s.id, label: s.label, ...await compareAnswers(s.topic, s.answerA, s.answerB),
  })));

  writeFileSync(OUT_PATH, `${JSON.stringify({ usage, results }, null, 2)}\n`);

  for (const r of results) {
    console.log(`\n== ${r.id}: ${r.label}`);
    console.log(`  concrete ${r.criteria.concrete.toFixed(2)}  straight ${r.criteria.straight.toFixed(2)}`);
    console.log(`  winner: ${r.winner}  (P(A wins)=${r.probA.toFixed(2)}, confidence ${r.confidence.toFixed(2)})`);
  }
  console.log(`\n${usageLine(OUT_PATH)}`);
}

try {
  await main();
} catch (error) {
  console.error(`trait-check compare failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
