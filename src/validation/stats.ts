/** Plain statistics shared by agreement.ts and the status page. No I/O. */

export const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

/** 1 when a beats b, 0.5 on a tie, 0 otherwise. */
export const cmp = (a: number, b: number): number => (a > b ? 1 : a === b ? 0.5 : 0);

/** P(a positive scores above a negative). NaN when either class is empty. */
export function auc(xs: { v: number; pos: boolean }[]): number {
  const pos = xs.filter((x) => x.pos);
  const neg = xs.filter((x) => !x.pos);
  if (!pos.length || !neg.length) return NaN;
  return mean(pos.flatMap((p) => neg.map((n) => cmp(p.v, n.v))));
}

/** Seeded PRNG so the bootstrap interval is reproducible between runs of the report. */
function mulberry32(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 95% bootstrap interval of the AUC, resampling answers. */
export function bootstrap(xs: { v: number; pos: boolean }[]): [number, number] {
  const rand = mulberry32(1);
  const stats = Array.from({ length: 2000 }, () => auc(xs.map(() => xs[Math.floor(rand() * xs.length)])))
    .filter((x) => !Number.isNaN(x))
    .sort((a, b) => a - b);
  return [stats[Math.floor(stats.length * 0.025)], stats[Math.floor(stats.length * 0.975)]];
}

export function pearson(a: number[], b: number[]): number {
  const ma = mean(a);
  const mb = mean(b);
  const cov = mean(a.map((x, i) => (x - ma) * (b[i] - mb)));
  const sd = (xs: number[], m: number): number => Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
  return cov / (sd(a, ma) * sd(b, mb));
}

/** 95% Wilson interval for a share of `n` trials — what "0.78 (9)" can still mean. */
export function wilson(share: number, n: number): [number, number] {
  if (!n) return [NaN, NaN];
  const z = 1.96;
  const centre = (share + (z * z) / (2 * n)) / (1 + (z * z) / n);
  const half = (z * Math.sqrt((share * (1 - share)) / n + (z * z) / (4 * n * n))) / (1 + (z * z) / n);
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

/** P(at least k successes in n trials of probability p). */
export function binomTail(n: number, k: number, p: number): number {
  const choose = (m: number, i: number): number => {
    let c = 1;
    for (let j = 0; j < i; j++) c = (c * (m - j)) / (j + 1);
    return c;
  };
  let total = 0;
  for (let i = Math.max(0, k); i <= n; i++) total += choose(n, i) * p ** i * (1 - p) ** (n - i);
  return total;
}
