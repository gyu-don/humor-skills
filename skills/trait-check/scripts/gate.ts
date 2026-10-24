/**
 * Regression check between two versions of a generator on the same お題:
 * the baseline's two runs set the noise band, and the candidate fails a
 * metric only when it is worse than the baseline by more than that band.
 *
 * Usage: doppler run -- node scripts/gate.ts <input.json> [output.json]
 * Input: { "topic", "baseline": [run1, run2], "candidate": [run, ...] }, or an
 * array of them (one per お題). Each run is the string[] of answers one
 * generation produced. "id" and "label" are optional, as in evaluate.ts.
 *
 * Per お題:
 *   concrete / indirect  pooled set means; noise = |baseline run 1 − run 2|.
 *   compare              mean probA over every candidate (A) × baseline (B)
 *                        pair; noise = |mean probA − 0.5| of baseline run 1 (A)
 *                        × run 2 (B). The draw-excluded win rate is reported
 *                        but never decides — on 2026-11-08 one baseline's run 1
 *                        beat its own run 2 at 0.80.
 * `regressed` lists the metrics whose worsening exceeds their noise.
 *
 * The band comes from a single pair of runs: an operational tolerance, not a
 * confidence interval. Its agreement with human verdicts is tracked in
 * humor-skills reports/validation (the "回帰判定" table); see SKILL.md.
 */
import { writeFileSync } from 'node:fs';
import { gateRuns, readInputs } from './input.ts';
import { compareAnswers, scoreAnswer, traitKeys, type TraitKey, usage, usageLine } from './judge.ts';
import { compareVerdict, tally, traitVerdict } from './verdict.ts';

const IN_PATH = process.argv[2];
const OUT_PATH = process.argv[3] ?? 'trait-gate-results.json';
if (!IN_PATH) {
  console.error('usage: node scripts/gate.ts <input.json> [output.json]');
  process.exit(1);
}

const topics = readInputs(IN_PATH, gateRuns);

/** One answer with where it came from, e.g. "baseline-r2#3". */
interface Answer { ref: string; text: string }

const refs = (version: string, runs: string[][]): Answer[][] =>
  runs.map((run, r) => run.map((text, i) => ({ ref: `${version}-r${r + 1}#${i + 1}`, text })));

async function gate(t: (typeof topics)[number]) {
  const [base1, base2] = refs('baseline', t.baseline);
  const cand = refs('candidate', t.candidate).flat();

  const all = [...base1, ...base2, ...cand];
  const scores = new Map(await Promise.all(all.map(async (a) => [a.ref, await scoreAnswer(t.topic, a.text)] as const)));
  const trait = (as: Answer[], key: TraitKey): number[] => as.map((a) => scores.get(a.ref)![key]);

  const pairs = async (as: Answer[], bs: Answer[]) => Promise.all(as.flatMap((a) => bs.map(async (b) => ({
    a: a.ref, b: b.ref, ...await compareAnswers(t.topic, a.text, b.text),
  }))));
  const [noisePairs, candPairs] = await Promise.all([pairs(base1, base2), pairs(cand, [...base1, ...base2])]);

  const verdicts = {
    concrete: traitVerdict(trait(base1, 'concrete'), trait(base2, 'concrete'), trait(cand, 'concrete'), false),
    indirect: traitVerdict(trait(base1, 'indirect'), trait(base2, 'indirect'), trait(cand, 'indirect'), true),
    compare: compareVerdict(tally(candPairs), tally(noisePairs)),
  };
  return {
    id: t.id,
    label: t.label,
    regressed: (Object.keys(verdicts) as (keyof typeof verdicts)[]).filter((k) => verdicts[k].regressed),
    ...verdicts,
    answers: all.map((a) => ({ ...a, ...Object.fromEntries(traitKeys.map((k) => [k, scores.get(a.ref)![k]])) })),
    pairs: [...noisePairs, ...candPairs].map(({ a, b, probA, winner }) => ({ a, b, probA, winner })),
  };
}

async function main(): Promise<void> {
  const results = [];
  for (const t of topics) results.push(await gate(t));

  writeFileSync(OUT_PATH, `${JSON.stringify({ usage, results }, null, 2)}\n`);

  const f = (x: number): string => x.toFixed(3);
  for (const r of results) {
    console.log(`\n== ${r.id}: ${r.label}`);
    for (const k of ['concrete', 'indirect'] as const) {
      const v = r[k];
      console.log(`  ${k.padEnd(8)} candidate ${f(v.candidate)} baseline ${f(v.baseline)}  worse by ${f(v.worsening)} / noise ${f(v.noise)}` +
        `${v.regressed ? '  REGRESSED' : ''}`);
    }
    const c = r.compare;
    console.log(`  compare  mean P(candidate) ${f(c.candidateVsBaseline.probA)}  worse by ${f(c.worsening)} / noise ${f(c.noise)}` +
      `${c.regressed ? '  REGRESSED' : ''}  (W/L/D ${c.candidateVsBaseline.winsA}/${c.candidateVsBaseline.winsB}/${c.candidateVsBaseline.draws})`);
    console.log(`  -> ${r.regressed.length ? `regressed: ${r.regressed.join(', ')}` : 'no regression beyond noise'}`);
  }
  console.log(`\n${usageLine(OUT_PATH)}`);
}

try {
  await main();
} catch (error) {
  console.error(`trait-check gate failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
