/**
 * Did a trait move between two versions of a generator? Plain arithmetic, no
 * Jev, so the rule can be tested and reused by the validation scripts.
 *
 * The question is asked of all お題 at once. Within each お題 the version
 * labels are shuffled among that お題's answers; the p-value is how often a
 * shuffle makes the candidate look at least as much worse as it really does.
 * Nothing is estimated from a single pair of runs, and one reading covers
 * the whole comparison instead of one verdict per お題 per metric.
 *
 * This replaced the baseline-run-gap rule ("worse by more than the gap
 * between the baseline's two runs"): on the 7 お題 with a human verdict that
 * rule flagged 4 of the 5 the human called a tie, because a gap measured
 * from one pair of runs is sometimes near zero (humor-skills
 * reports/validation/2026-11-15).
 */

const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Readings below this are flagged. Fixed in advance; do not move it after seeing a result. */
export const ALPHA = 0.05;

/** Per-answer values of one trait on one お題, for each version. */
export interface TopicValues {
  candidate: number[];
  baseline: number[];
}

export interface Shift {
  /** Mean over お題 of each version's set mean. */
  baseline: number;
  candidate: number;
  /** How much worse the candidate is, averaged over お題 (negative = better). */
  worsening: number;
  /** One-sided: the share of within-お題 label shuffles at least this much worse. */
  p: number;
  /** p < ALPHA. A prompt to look, not a verdict on the version. */
  flagged: boolean;
}

/** Seeded PRNG so the same input always gives the same p. */
function mulberry32(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * `lowerIsBetter`: true for `indirect` (a rise is worse), false for `concrete`
 * (a drop is worse). One お題 gives that お題's own reading.
 */
export function shift(topics: TopicValues[], lowerIsBetter: boolean, permutations = 20000, seed = 1): Shift {
  if (!topics.length || topics.some((t) => !t.candidate.length || !t.baseline.length)) {
    throw new Error('every お題 needs at least one candidate answer and one baseline answer');
  }
  const sign = lowerIsBetter ? 1 : -1;
  const pools = topics.map((t) => ({ values: [...t.candidate, ...t.baseline], n: t.candidate.length }));
  /** Mean over お題 of (candidate mean − baseline mean), signed so that positive is worse. */
  const worsening = (): number => mean(pools.map(({ values, n }) => {
    let head = 0;
    let total = 0;
    for (let i = 0; i < values.length; i++) {
      total += values[i];
      if (i < n) head += values[i];
    }
    return sign * (head / n - (total - head) / (values.length - n));
  }));

  const observed = worsening();
  const rand = mulberry32(seed);
  let atLeast = 0;
  for (let k = 0; k < permutations; k++) {
    // Draw each お題's "candidate" answers at random: a partial Fisher–Yates shuffle of the first n places.
    for (const { values, n } of pools) {
      for (let i = 0; i < n; i++) {
        const j = i + Math.floor(rand() * (values.length - i));
        [values[i], values[j]] = [values[j], values[i]];
      }
    }
    if (worsening() >= observed - 1e-12) atLeast++;
  }
  // +1 counts the observed labelling itself, so p is never 0.
  const p = (atLeast + 1) / (permutations + 1);
  return {
    baseline: mean(topics.map((t) => mean(t.baseline))),
    candidate: mean(topics.map((t) => mean(t.candidate))),
    worsening: observed,
    p,
    flagged: p < ALPHA,
  };
}
