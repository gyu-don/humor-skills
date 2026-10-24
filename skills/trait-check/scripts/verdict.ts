/**
 * Regression verdicts for gate.ts — plain arithmetic, no Jev. Kept apart so
 * the rules can be tested and reused by the validation scripts.
 *
 * The rule (provisional; see SKILL.md 「合否の決め方」): a difference no larger
 * than the gap between the baseline's own two runs is noise. A candidate
 * regresses on a metric only when it is worse than the baseline by more than
 * that gap.
 */

const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

export interface TraitVerdict {
  /** Pooled set means. */
  baseline: number;
  candidate: number;
  /** |mean(baseline run 1) − mean(baseline run 2)|. */
  noise: number;
  /** How much worse the candidate is (negative = better). */
  worsening: number;
  regressed: boolean;
}

/** Set-mean rule for `concrete` (higher = better) or `indirect` (lowerIsBetter). */
export function traitVerdict(baseRun1: number[], baseRun2: number[], candidate: number[], lowerIsBetter: boolean): TraitVerdict {
  const baseline = mean([...baseRun1, ...baseRun2]);
  const cand = mean(candidate);
  const noise = Math.abs(mean(baseRun1) - mean(baseRun2));
  const worsening = lowerIsBetter ? cand - baseline : baseline - cand;
  return { baseline, candidate: cand, noise, worsening, regressed: worsening > noise };
}

export interface PairTally {
  /** Mean probA over the pairs. */
  probA: number;
  winsA: number;
  winsB: number;
  draws: number;
  /** winsA / (winsA + winsB) — diagnostic only; it swings far more than probA. */
  drawExcludedWinRate: number | null;
}

export function tally(results: { probA: number; winner: 'A' | 'B' | 'draw' }[]): PairTally {
  const winsA = results.filter((r) => r.winner === 'A').length;
  const winsB = results.filter((r) => r.winner === 'B').length;
  return {
    probA: mean(results.map((r) => r.probA)),
    winsA,
    winsB,
    draws: results.length - winsA - winsB,
    drawExcludedWinRate: winsA + winsB ? winsA / (winsA + winsB) : null,
  };
}

export interface CompareVerdict {
  /** Every candidate answer (A) × every baseline answer (B). */
  candidateVsBaseline: PairTally;
  /** Baseline run 1 (A) × baseline run 2 (B). */
  baselineRun1VsRun2: PairTally;
  /** |probA − 0.5| of baselineRun1VsRun2. */
  noise: number;
  /** 0.5 − candidate probA (negative = candidate preferred). */
  worsening: number;
  regressed: boolean;
}

export function compareVerdict(candidateVsBaseline: PairTally, baselineRun1VsRun2: PairTally): CompareVerdict {
  const noise = Math.abs(baselineRun1VsRun2.probA - 0.5);
  const worsening = 0.5 - candidateVsBaseline.probA;
  return { candidateVsBaseline, baselineRun1VsRun2, noise, worsening, regressed: worsening > noise };
}
