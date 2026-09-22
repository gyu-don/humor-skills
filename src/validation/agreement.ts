/**
 * Human-agreement report: how well each evaluator run in <dir> (ScoreFiles
 * from run-jev.ts / blind.ts) agrees with the labels in data/human-evals.
 *
 *   npm run validate:agreement -- reports/validation/<date>
 *     -> prints a table and writes <dir>/summary.md
 *
 * Answer-level metrics (per evaluator metric, runs of the same evaluator+mode averaged):
 *   AUC       P(a praised answer scores above an unpraised one), pooled over every labeled
 *             answer, with a 95% bootstrap interval. 0.5 = chance.
 *   in-set    the same AUC computed inside each set that has both kinds, then averaged —
 *             "can it pick the hit out of one 5-answer output?"
 *   sets      share of human set preferences (better/worse) where the evaluator's set mean agrees.
 *   pairs     share of non-tie human answer-pair preferences the evaluator agrees with.
 *   retest    Pearson r between two runs of the same evaluator+mode (reliability, not validity).
 * Set-level files (diversity-check) get one metric instead: AUC for separating the sets the
 * human called converged from the rest.
 *
 * Pair-level files (被りチェック) go in a second table, against the blind human
 * similarity judgments ("would these two feel like 被り in one set?"):
 *   AUC          similar vs different pairs ("partial" left out).
 *   recall       share of similar pairs flagged (score >= FLAG, the fun-check threshold).
 *   false flags  share of different pairs flagged — the "invents similarity" failure.
 *   converged    AUC for separating human-called converged sets by their most similar
 *                within-set pair.
 *
 * `gate` marks a metric that is good enough to stand in for a human verdict in
 * ogiri-ai's gate check: AUC interval above 0.5, sets >= 0.8, pairs >= 0.75.
 * Baseline "length" (shorter = better) is always included; an evaluator that
 * cannot beat it is not measuring funniness.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadLabels, pairKey } from './labels.ts';
import type { ScoreFile } from './score-file.ts';

const dir = process.argv[2];
if (!dir) {
  console.error('usage: node src/validation/agreement.ts <dir with ScoreFiles>');
  process.exit(1);
}

const labels = loadLabels();
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as ScoreFile)
  .filter((f) => f.scores !== undefined);

files.push({
  evaluator: 'baseline', mode: 'jev', run: 1, model: '-', level: 'answer', lowerIsBetter: ['length'],
  scores: Object.fromEntries([...labels.answers].map(([id, a]) => [id, { length: [...a.text].length }])),
});

/** Seeded PRNG so the bootstrap interval is reproducible between runs of this report. */
function mulberry32(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
const cmp = (a: number, b: number): number => (a > b ? 1 : a === b ? 0.5 : 0);

function auc(xs: { v: number; pos: boolean }[]): number {
  const pos = xs.filter((x) => x.pos);
  const neg = xs.filter((x) => !x.pos);
  if (!pos.length || !neg.length) return NaN;
  return mean(pos.flatMap((p) => neg.map((n) => cmp(p.v, n.v))));
}

function bootstrap(xs: { v: number; pos: boolean }[]): [number, number] {
  const rand = mulberry32(1);
  const stats = Array.from({ length: 2000 }, () => auc(xs.map(() => xs[Math.floor(rand() * xs.length)])))
    .filter((x) => !Number.isNaN(x))
    .sort((a, b) => a - b);
  return [stats[Math.floor(stats.length * 0.025)], stats[Math.floor(stats.length * 0.975)]];
}

function pearson(a: number[], b: number[]): number {
  const ma = mean(a);
  const mb = mean(b);
  const cov = mean(a.map((x, i) => (x - ma) * (b[i] - mb)));
  const sd = (xs: number[], m: number): number => Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
  return cov / (sd(a, ma) * sd(b, mb));
}

const groups = new Map<string, ScoreFile[]>();
for (const f of files) {
  const k = `${f.evaluator} (${f.mode}, ${f.model})`;
  groups.set(k, [...(groups.get(k) ?? []), f]);
}

const lines: string[] = [];
const out = (s: string): void => {
  lines.push(s);
  console.log(s);
};

const labeled = [...labels.answers].filter(([, a]) => a.hit !== null);
const mixedSets = labels.sets.filter((s) => s.answers.some((a) => a.hit) && s.answers.some((a) => a.hit === false));
const pairs = labels.pairPreferences.filter((p) => p.winner !== 'tie');

out(`# Human agreement — ${dir}`);
out('');
out(`Labels: ${labeled.length} answers (${labeled.filter(([, a]) => a.hit).length} hits), ` +
  `${mixedSets.length} mixed sets, ${labels.setPreferences.length} set preferences, ` +
  `${pairs.length} answer-pair preferences (${pairs.filter((p) => p.blind).length} blind).`);
out('');
out('| evaluator | metric | AUC [95%] | in-set | sets | pairs | retest r | gate |');
out('|---|---|---|---|---|---|---|---|');

const pairGroups: [string, ScoreFile[]][] = [];

for (const [name, runs] of groups) {
  const level = runs[0].level;
  if (level === 'pair') {
    pairGroups.push([name, runs]);
    continue;
  }
  const metrics = Object.keys(Object.values(runs[0].scores)[0]);
  for (const metric of metrics) {
    const sign = runs[0].lowerIsBetter.includes(metric) ? -1 : 1;
    const value = (id: string): number | undefined => {
      const vs = runs.map((r) => r.scores[id]?.[metric]).filter((v): v is number => v !== undefined);
      return vs.length ? sign * mean(vs) : undefined;
    };
    const retest = runs.length >= 2
      ? (() => {
          const ids = Object.keys(runs[0].scores).filter((id) => runs[1].scores[id]);
          return pearson(ids.map((id) => runs[0].scores[id][metric]), ids.map((id) => runs[1].scores[id][metric])).toFixed(2);
        })()
      : '-';

    if (level === 'set') {
      const xs = labels.sets.filter((s) => value(s.id) !== undefined).map((s) => ({ v: -value(s.id)!, pos: s.converged }));
      out(`| ${name} | ${metric} (converged AUC, n=${xs.length}) | ${auc(xs).toFixed(2)} | - | - | - | ${retest} | - |`);
      continue;
    }

    const xs = labeled.filter(([id]) => value(id) !== undefined).map(([id, a]) => ({ v: value(id)!, pos: a.hit! }));
    const [lo, hi] = bootstrap(xs);
    const inSet = mean(mixedSets.map((s) => auc(s.answers.filter((a) => value(a.id) !== undefined).map((a) => ({ v: value(a.id)!, pos: a.hit! })))).filter((x) => !Number.isNaN(x)));
    const setMean = (setId: string): number | undefined => {
      const vs = labels.sets.find((s) => s.id === setId)!.answers.map((a) => value(a.id));
      return vs.some((v) => v === undefined) ? undefined : mean(vs as number[]);
    };
    const setAgree = labels.setPreferences
      .map((p) => [setMean(p.better), setMean(p.worse)])
      .filter(([b, w]) => b !== undefined && w !== undefined)
      .map(([b, w]) => cmp(b!, w!));
    const pairAgree = pairs
      .filter((p) => value(p.a) !== undefined && value(p.b) !== undefined)
      .map((p) => (p.winner === 'a' ? cmp(value(p.a)!, value(p.b)!) : cmp(value(p.b)!, value(p.a)!)));
    const setsScore = setAgree.length ? mean(setAgree) : NaN;
    const pairsScore = pairAgree.length ? mean(pairAgree) : NaN;
    const gate = lo > 0.5 && setsScore >= 0.8 && pairsScore >= 0.75 ? 'yes' : '';
    out(`| ${name} | ${sign < 0 ? '−' : ''}${metric} | ${auc(xs).toFixed(2)} [${lo.toFixed(2)}, ${hi.toFixed(2)}] | ` +
      `${inSet.toFixed(2)} | ${setsScore.toFixed(2)} (${setAgree.length}) | ${pairsScore.toFixed(2)} (${pairAgree.length}) | ${retest} | ${gate} |`);
  }
}

/** Same threshold as fun-check's nearDuplicates. Binary judges (0/1) are unaffected by it. */
const FLAG = 0.7;
const judged = labels.similarityJudgments.filter((j) => j.similarity !== 'partial');

if (pairGroups.length) {
  out('');
  out(`## 被りチェック — ${judged.length} human similarity judgments ` +
    `(${judged.filter((j) => j.similarity === 'similar').length} similar), flag = score >= ${FLAG}`);
  out('');
  out('| evaluator | metric | AUC | recall | false flags | converged AUC | retest r |');
  out('|---|---|---|---|---|---|---|');
}

for (const [name, runs] of pairGroups) {
  for (const metric of Object.keys(Object.values(runs[0].scores)[0])) {
    const value = (key: string): number | undefined => {
      const vs = runs
        .map((r) => r.scores[key]?.[metric] ?? (r.missingIsZero ? 0 : undefined))
        .filter((v): v is number => v !== undefined);
      return vs.length ? mean(vs) : undefined;
    };
    const xs = judged
      .map((j) => ({ v: value(pairKey(j.a, j.b)), pos: j.similarity === 'similar' }))
      .filter((x): x is { v: number; pos: boolean } => x.v !== undefined);
    const share = (pos: boolean): string => {
      const ys = xs.filter((x) => x.pos === pos);
      return `${ys.filter((x) => x.v >= FLAG).length}/${ys.length}`;
    };
    const maxInSet = (set: (typeof labels.sets)[number]): number | undefined => {
      const vs = set.answers.flatMap((a, i) => set.answers.slice(i + 1).map((b) => value(pairKey(a.id, b.id))));
      return vs.some((v) => v === undefined) ? undefined : Math.max(...(vs as number[]));
    };
    const conv = labels.sets
      .map((s) => ({ v: maxInSet(s), pos: s.converged }))
      .filter((x): x is { v: number; pos: boolean } => x.v !== undefined);
    const retest = runs.length >= 2 && !runs[0].missingIsZero
      ? (() => {
          const keys = Object.keys(runs[0].scores).filter((k) => runs[1].scores[k]);
          return pearson(keys.map((k) => runs[0].scores[k][metric]), keys.map((k) => runs[1].scores[k][metric])).toFixed(2);
        })()
      : '-';
    out(`| ${name} | ${metric} | ${auc(xs).toFixed(2)} | ${share(true)} | ${share(false)} | ` +
      `${conv.length ? auc(conv).toFixed(2) : '-'} | ${retest} |`);
  }
}

writeFileSync(join(dir, 'summary.md'), `${lines.join('\n')}\n`);
