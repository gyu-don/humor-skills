/**
 * Reads two versions of a generator on the same お題 side by side: did
 * `concrete` or `indirect` move, taken over all お題 at once, and which of
 * the new answers read as explanatory.
 *
 * Usage: doppler run -- node scripts/versions.ts <input.json> [output.json]
 * Input: { "topic", "baseline": [run1, run2], "candidate": [run, ...] }, or an
 * array of them (one per お題). Each run is the string[] of answers one
 * generation produced. "id" and "label" are optional, as in evaluate.ts.
 *
 * Output:
 *   overall     one reading per trait across every お題 (verdict.ts): how
 *               much worse the candidate is and the permutation p. `flagged`
 *               lists the traits with p < 0.05.
 *   results[]   the same reading for each お題 alone (diagnostic — with ten
 *               answers a side it rarely reaches 0.05), the candidate answers
 *               at or above EXPLANATORY on `indirect`, and every answer's
 *               values.
 *
 * A flag is a prompt to look at the answers, not a reason to reject the
 * version: no trait here has been shown to detect a version the human liked
 * less (SKILL.md 「信頼度」). Whether the version is adopted is decided by a
 * blind human comparison.
 */
import { writeFileSync } from 'node:fs';
import { gateRuns, readInputs } from './input.ts';
import { scoreAnswer, traitKeys, type TraitKey, usage, usageLine } from './judge.ts';
import { ALPHA, shift, type Shift } from './verdict.ts';

const IN_PATH = process.argv[2];
const OUT_PATH = process.argv[3] ?? 'trait-versions-results.json';
if (!IN_PATH) {
  console.error('usage: node scripts/versions.ts <input.json> [output.json]');
  process.exit(1);
}

/**
 * `indirect` at or above this marks an answer as a repair candidate. On the
 * human labels (humor-skills reports/validation/2026-11-15, 170 answers) 3
 * of the 29 answers at or above 0.2 were hits, against 32 of the 141 below;
 * on the labels added after the question was written, 0 of 12 against 13 of
 * 83. The values run low: median 0.13, 90th percentile 0.25.
 */
const EXPLANATORY = 0.2;

/** `indirect` rises when worse; `concrete` falls. */
const LOWER_IS_BETTER: Record<TraitKey, boolean> = { concrete: false, indirect: true };

const topics = readInputs(IN_PATH, gateRuns);

/** One answer with where it came from, e.g. "baseline-r2#3". */
interface Answer { ref: string; text: string }
type Scored = Answer & Record<TraitKey, number>;

const refs = (version: string, runs: string[][]): Answer[] =>
  runs.flatMap((run, r) => run.map((text, i) => ({ ref: `${version}-r${r + 1}#${i + 1}`, text })));

async function score(topic: string, answers: Answer[]): Promise<Scored[]> {
  return Promise.all(answers.map(async (a) => ({ ...a, ...await scoreAnswer(topic, a.text) })));
}

const readings = (pairs: { candidate: Scored[]; baseline: Scored[] }[]): Record<TraitKey, Shift> =>
  Object.fromEntries(traitKeys.map((key) => [
    key,
    shift(pairs.map((p) => ({ candidate: p.candidate.map((a) => a[key]), baseline: p.baseline.map((a) => a[key]) })), LOWER_IS_BETTER[key]),
  ])) as Record<TraitKey, Shift>;

const flaggedOf = (r: Record<TraitKey, Shift>): TraitKey[] => traitKeys.filter((key) => r[key].flagged);

async function main(): Promise<void> {
  const scored = [];
  for (const t of topics) {
    const [candidate, baseline] = await Promise.all([score(t.topic, refs('candidate', t.candidate)), score(t.topic, refs('baseline', t.baseline))]);
    scored.push({ topic: t, candidate, baseline });
  }

  const all = readings(scored);
  const results = scored.map(({ topic, candidate, baseline }) => {
    const own = readings([{ candidate, baseline }]);
    return {
      id: topic.id,
      label: topic.label,
      ...own,
      flagged: flaggedOf(own),
      explanatory: candidate.filter((a) => a.indirect >= EXPLANATORY).map(({ ref, text, indirect }) => ({ ref, text, indirect })),
      answers: [...baseline, ...candidate],
    };
  });
  const overall = { topics: topics.length, ...all, flagged: flaggedOf(all) };

  writeFileSync(OUT_PATH, `${JSON.stringify({ usage, alpha: ALPHA, explanatoryAt: EXPLANATORY, overall, results }, null, 2)}\n`);

  const f = (x: number): string => x.toFixed(3);
  const line = (key: TraitKey, s: Shift): string =>
    `  ${key.padEnd(8)} candidate ${f(s.candidate)} baseline ${f(s.baseline)}  worse by ${f(s.worsening)}  p ${s.p.toFixed(3)}${s.flagged ? '  FLAGGED' : ''}`;
  for (const r of results) {
    console.log(`\n== ${r.id}: ${r.label}`);
    for (const key of traitKeys) console.log(line(key, r[key]));
    for (const a of r.explanatory) console.log(`  explanatory (indirect ${a.indirect.toFixed(2)}) ${a.ref}: ${a.text}`);
  }
  console.log(`\n== all ${topics.length} お題 together`);
  for (const key of traitKeys) console.log(line(key, all[key]));
  console.log(`  -> ${overall.flagged.length ? `flagged: ${overall.flagged.join(', ')} — look at the answers; this is not a verdict on the version` : `no trait moved beyond p < ${ALPHA}`}`);
  console.log(`\n${usageLine(OUT_PATH)}`);
}

try {
  await main();
} catch (error) {
  console.error(`trait-check versions failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
