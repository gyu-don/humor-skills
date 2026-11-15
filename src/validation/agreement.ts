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
 *   recall       share of similar pairs flagged (score >= FLAG, overlap-check's threshold).
 *   false flags  share of different pairs flagged — the "invents similarity" failure.
 *   converged    AUC for separating human-called converged sets by their most similar
 *                within-set pair.
 *
 * Preference files (pairwise judges: trait-check compare.ts) go in a third table:
 *   in-set       share of hit-vs-non-hit pairs inside one set where the judge prefers the hit.
 *   pairs        share of non-tie human answer-pair preferences it agrees with.
 *   confident    the in-set share restricted to pairs it judged with |p - 0.5| >= 0.2 —
 *                a judge whose confident calls are worse than its average is anti-aligned.
 *
 * Gate files (trait-check versions.ts) go in a fourth section, against the
 * human's set-level verdict on candidate vs baseline (setPreferences /
 * setTies on sets with `role`). Per お題: how often each rule flags when the
 * human preferred the candidate, called a tie, or preferred the baseline —
 * a good rule flags only the last. "p < 0.05" is the permutation reading of
 * that お題 alone; "> noise (old)" is the rule it replaced (worse by more
 * than the gap between the two baseline runs). Per version comparison (all
 * of its お題 together, the unit versions.ts reports and the adoption rule
 * applies to): the human's wins / ties / losses, what the adoption rule
 * says, and the pooled reading.
 *
 * `gate` marks a metric that is good enough to stand in for a human verdict in
 * ogiri-ai's gate check: AUC interval above 0.5, sets >= 0.8, pairs >= 0.75.
 * A line under the table says how likely a judge of a given true accuracy is
 * to meet the sets and pairs thresholds with the current number of labels.
 * Baseline "length" (shorter = better) is always included; an evaluator that
 * cannot beat it is not measuring funniness.
 *
 * The last section (未使用ラベル) repeats the answer, pair and preference
 * metrics on the sessions each judge's questions were NOT written from
 * (`frozen` in judges.ts). A judge in skills/ has to hold up there.
 *
 * Everything is also written to <dir>/summary.json (summary.ts) for the
 * status page.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { unusedSince } from './judges.ts';
import { humanPairs as directPairs, inSetPairs as hitPairs, loadLabels, pairKey, preferencePairs, type PreferencePair } from './labels.ts';
import type { ScoreFile } from './score-file.ts';
import { auc, binomTail, bootstrap, cmp, mean, pearson, wilson } from './stats.ts';
import type { AnswerRow, AnswerStats, GateSummary, OverlapRow, OverlapStats, PreferenceRow, PreferenceStats, Share, Summary, VersionSummary } from './summary.ts';

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

/** NaN -> null, for summary.json. */
const num = (x: number): number | null => (Number.isFinite(x) ? x : null);
const everything = (): boolean => true;
const from = (since: string) => (date: string): boolean => date >= since;

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
const preferenceGroups: [string, ScoreFile[]][] = [];
const gateGroups: [string, ScoreFile[]][] = [];
const versionGroups: [string, ScoreFile[]][] = [];

// Collected for summary.json and the 未使用ラベル section.
const answerRows: AnswerRow[] = [];
const overlapRows: OverlapRow[] = [];
const preferenceRows: PreferenceRow[] = [];
const gateSummaries: GateSummary[] = [];
const versionSummaries: VersionSummary[] = [];

for (const [name, runs] of groups) {
  const level = runs[0].level;
  if (level === 'pair') {
    pairGroups.push([name, runs]);
    continue;
  }
  if (level === 'preference') {
    preferenceGroups.push([name, runs]);
    continue;
  }
  if (level === 'gate') {
    gateGroups.push([name, runs]);
    continue;
  }
  if (level === 'version') {
    versionGroups.push([name, runs]);
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

    /** Agreement with the labels from the sessions `keep` lets through. */
    const stats = (keep: (date: string) => boolean): AnswerStats & { raw: { auc: number; lo: number; hi: number; inSet: number; sets: number; pairs: number } } => {
      const xs = labeled.filter(([id, a]) => keep(a.date) && value(id) !== undefined).map(([id, a]) => ({ v: value(id)!, pos: a.hit! }));
      const both = xs.some((x) => x.pos) && xs.some((x) => !x.pos);
      const [lo, hi] = both ? bootstrap(xs) : [NaN, NaN];
      const inSets = mixedSets.filter((s) => keep(s.date))
        .map((s) => auc(s.answers.filter((a) => value(a.id) !== undefined).map((a) => ({ v: value(a.id)!, pos: a.hit! }))))
        .filter((x) => !Number.isNaN(x));
      const setMean = (setId: string): number | undefined => {
        const vs = labels.sets.find((s) => s.id === setId)!.answers.map((a) => value(a.id));
        return vs.some((v) => v === undefined) ? undefined : mean(vs as number[]);
      };
      const setAgree = labels.setPreferences.filter((p) => keep(p.date))
        .map((p) => [setMean(p.better), setMean(p.worse)])
        .filter(([b, w]) => b !== undefined && w !== undefined)
        .map(([b, w]) => cmp(b!, w!));
      const pairAgree = pairs
        .filter((p) => keep(p.date) && value(p.a) !== undefined && value(p.b) !== undefined)
        .map((p) => (p.winner === 'a' ? cmp(value(p.a)!, value(p.b)!) : cmp(value(p.b)!, value(p.a)!)));
      const raw = {
        auc: auc(xs), lo, hi, inSet: mean(inSets),
        sets: setAgree.length ? mean(setAgree) : NaN, pairs: pairAgree.length ? mean(pairAgree) : NaN,
      };
      return {
        raw, answers: xs.length, hits: xs.filter((x) => x.pos).length,
        auc: num(raw.auc), lo: num(lo), hi: num(hi), inSet: num(raw.inSet), inSetSets: inSets.length,
        sets: { share: num(raw.sets), n: setAgree.length }, pairs: { share: num(raw.pairs), n: pairAgree.length },
      };
    };

    const { raw, ...all } = stats(everything);
    const since = unusedSince(runs[0].evaluator);
    const { raw: _, ...unused } = stats(from(since));
    const gate = raw.lo > 0.5 && raw.sets >= 0.8 && raw.pairs >= 0.75;
    answerRows.push({
      name, evaluator: runs[0].evaluator, metric, lowerIsBetter: sign < 0, retest: retest === '-' ? null : Number(retest), since, gate, all, unused,
    });
    out(`| ${name} | ${sign < 0 ? '−' : ''}${metric} | ${raw.auc.toFixed(2)} [${raw.lo.toFixed(2)}, ${raw.hi.toFixed(2)}] | ` +
      `${raw.inSet.toFixed(2)} | ${raw.sets.toFixed(2)} (${all.sets.n}) | ${raw.pairs.toFixed(2)} (${all.pairs.n}) | ${retest} | ${gate ? 'yes' : ''} |`);
  }
}

// How often would a judge of a given true accuracy meet the sets and pairs thresholds of `gate`?
const gatePower = {
  sets: labels.setPreferences.length,
  pairs: pairs.length,
  at: [0.7, 0.8, 0.9].map((p) => ({
    p,
    pass: binomTail(labels.setPreferences.length, Math.ceil(0.8 * labels.setPreferences.length - 1e-9), p) *
      binomTail(pairs.length, Math.ceil(0.75 * pairs.length - 1e-9), p),
  })),
};
out('');
out(`\`gate\` の条件のうち sets ≥ 0.8（${gatePower.sets} 件）と pairs ≥ 0.75（${gatePower.pairs} 件）を両方満たす確率は、` +
  `真の一致率が ${gatePower.at.map(({ p, pass }) => `${p} の判定器で ${pass.toFixed(2)}`).join('、')}` +
  '（2つを独立とみなした概算。AUC の条件は含まない）。空欄は、合格できる判定器がないことまでは意味しない。');

/** Same threshold as overlap-check's nearDuplicates. Binary judges (0/1) are unaffected by it. */
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
    const stats = (keep: (date: string) => boolean): OverlapStats => {
      const xs = judged.filter((j) => keep(j.date))
        .map((j) => ({ v: value(pairKey(j.a, j.b)), pos: j.similarity === 'similar' }))
        .filter((x): x is { v: number; pos: boolean } => x.v !== undefined);
      const count = (pos: boolean, flagged: boolean): number => xs.filter((x) => x.pos === pos && (!flagged || x.v >= FLAG)).length;
      return { auc: num(auc(xs)), similar: count(true, false), caught: count(true, true), different: count(false, false), falseFlags: count(false, true) };
    };
    const all = stats(everything);
    const since = unusedSince(runs[0].evaluator);
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
    overlapRows.push({
      name, evaluator: runs[0].evaluator, metric, retest: retest === '-' ? null : Number(retest), since,
      convergedAuc: conv.length ? num(auc(conv)) : null, all, unused: stats(from(since)),
    });
    out(`| ${name} | ${metric} | ${(all.auc ?? NaN).toFixed(2)} | ${all.caught}/${all.similar} | ${all.falseFlags}/${all.different} | ` +
      `${conv.length ? auc(conv).toFixed(2) : '-'} | ${retest} |`);
  }
}

const inSetPairs = hitPairs(labels);
const humanPairs = directPairs(labels);
const shown = (s: Share): string => (s.share === null ? '-' : `${s.share.toFixed(2)} (${s.n})`);

if (preferenceGroups.length) {
  out('');
  out(`## 一対比較 — ${preferencePairs(labels).length} pairs with a human preference`);
  out('');
  out('| evaluator | metric | in-set | pairs | confident | retest r |');
  out('|---|---|---|---|---|---|');
}

for (const [name, runs] of preferenceGroups) {
  for (const metric of Object.keys(Object.values(runs[0].scores)[0])) {
    /** P(winner is judged better), averaged over runs. */
    const pWin = (p: { winner: string; loser: string }): number | undefined => {
      const key = pairKey(p.winner, p.loser);
      const vs = runs.map((r) => r.scores[key]?.[metric]).filter((v): v is number => v !== undefined);
      return vs.length ? mean(key.split(' | ')[0] === p.winner ? vs : vs.map((v) => 1 - v)) : undefined;
    };
    const agree = (ps: PreferencePair[], confident = false): Share => {
      const vs = ps.map(pWin).filter((v): v is number => v !== undefined && (!confident || Math.abs(v - 0.5) >= 0.2));
      return { share: vs.length ? mean(vs.map((v) => cmp(v, 0.5))) : null, n: vs.length };
    };
    const stats = (keep: (date: string) => boolean): PreferenceStats => {
      const [inSet, direct] = [inSetPairs, humanPairs].map((ps) => ps.filter((p) => keep(p.date)));
      return { inSet: agree(inSet), pairs: agree(direct), confident: agree(inSet, true) };
    };
    const all = stats(everything);
    const since = unusedSince(runs[0].evaluator);
    const retest = runs.length >= 2
      ? (() => {
          const keys = Object.keys(runs[0].scores).filter((k) => runs[1].scores[k]);
          return pearson(keys.map((k) => runs[0].scores[k][metric]), keys.map((k) => runs[1].scores[k][metric])).toFixed(2);
        })()
      : '-';
    preferenceRows.push({
      name, evaluator: runs[0].evaluator, metric, retest: retest === '-' ? null : Number(retest), since, all, unused: stats(from(since)),
    });
    out(`| ${name} | ${metric} | ${shown(all.inSet)} | ${shown(all.pairs)} | ${shown(all.confident)} | ${retest} |`);
  }
}

const verdictOrder = ['candidate', 'tie', 'baseline'] as const;
const gatesBy = (human: (typeof verdictOrder)[number]) => labels.gates.filter((g) => g.human === human);

/** Below this a reading is flagged — trait-check verdict.ts's ALPHA. */
const ALPHA = 0.05;

if (gateGroups.length) {
  out('');
  out(`## 版の比較 — ${labels.gates.length} お題 with a human set-level verdict ` +
    `(${labels.gates.filter((g) => g.blind).length} blind; human preferred candidate ${gatesBy('candidate').length}, ` +
    `tie ${gatesBy('tie').length}, baseline ${gatesBy('baseline').length})`);
  out('');
  out('Flagged per お題, per run. Only the "baseline better" column should be flagged. `p < 0.05` is the reading of that お題 alone; `> noise (old)` is the rule it replaced.');
  out('');
  out('| evaluator | rule | candidate better | tie | baseline better |');
  out('|---|---|---|---|---|');
}

for (const [name, runs] of gateGroups) {
  const metrics = Object.keys(Object.values(runs[0].scores)[0]).filter((m) => m.endsWith('Worsening')).map((m) => m.slice(0, -'Worsening'.length));
  const flagged = (r: ScoreFile, id: string, metric: string, old: boolean): boolean | undefined => {
    const s = r.scores[id];
    if (!s) return undefined;
    return old ? s[`${metric}Worsening`] > s[`${metric}Noise`] : s[`${metric}P`] < ALPHA;
  };
  const rules: [string, (r: ScoreFile, id: string) => boolean | undefined][] = [];
  for (const old of [false, true]) {
    const label = old ? '> noise (old)' : `p < ${ALPHA}`;
    for (const m of metrics) rules.push([`${m} ${label}`, (r, id) => flagged(r, id, m, old)]);
    rules.push([`any ${label}`, (r, id) => {
      const fs = metrics.map((m) => flagged(r, id, m, old));
      return fs.some((f) => f === undefined) ? undefined : fs.some(Boolean);
    }]);
  }
  for (const [rule, f] of rules) {
    const cell = (human: (typeof verdictOrder)[number]): string => {
      const gs = gatesBy(human);
      if (!gs.length) return '-';
      return runs.map((r) => {
        const vs = gs.map((g) => f(r, g.id)).filter((v): v is boolean => v !== undefined);
        return `${vs.filter(Boolean).length}/${vs.length}`;
      }).join(' · ');
    };
    out(`| ${name} | ${rule} | ${verdictOrder.map(cell).join(' | ')} |`);
  }

  out('');
  out('| お題 | human | blind | ' + metrics.map((m) => `${m} worse (p) / old noise`).join(' | ') + ' |');
  out('|---|---|---|' + metrics.map(() => '---|').join(''));
  for (const g of labels.gates) {
    const cells = metrics.map((m) => runs.map((r) => {
      const s = r.scores[g.id];
      if (!s) return '-';
      return `${s[`${m}Worsening`].toFixed(3)} (${s[`${m}P`].toFixed(2)})${s[`${m}P`] < ALPHA ? ' **F**' : ''} / ${s[`${m}Noise`].toFixed(3)}`;
    }).join(' · '));
    out(`| ${g.id} | ${g.human} | ${g.blind ? 'yes' : 'no'} | ${cells.join(' | ')} |`);
  }

  gateSummaries.push({
    name, evaluator: runs[0].evaluator, metrics,
    cases: labels.gates.map((g) => ({
      id: g.id, group: g.group, human: g.human, blind: g.blind,
      runs: runs.map((r) => {
        const s = r.scores[g.id];
        return s ? Object.fromEntries(metrics.map((m) => [m, { worsening: s[`${m}Worsening`], p: s[`${m}P`], noise: s[`${m}Noise`] }])) : null;
      }),
    })),
  });
}

for (const [name, runs] of versionGroups) {
  const metrics = Object.keys(Object.values(runs[0].scores)[0]).filter((m) => m.endsWith('Worsening')).map((m) => m.slice(0, -'Worsening'.length));
  out('');
  out(`### まとめた読み — ${labels.versions.length} version comparisons (${name})`);
  out('');
  out('All お題 of one comparison together, per run. `rule` is the adoption rule on the human verdicts: no loss = adoptable, any loss = return.');
  out('');
  out('| comparison | お題 | human win / tie / loss | rule | ' + metrics.map((m) => `${m} worse (p)`).join(' | ') + ' |');
  out('|---|---|---|---|' + metrics.map(() => '---|').join(''));
  for (const v of labels.versions) {
    const cells = metrics.map((m) => runs.map((r) => {
      const s = r.scores[v.id];
      return s ? `${s[`${m}Worsening`].toFixed(3)} (${s[`${m}P`].toFixed(2)})${s[`${m}P`] < ALPHA ? ' **F**' : ''}` : '-';
    }).join(' · '));
    out(`| ${v.id} | ${v.gates.length} | ${v.wins} / ${v.ties} / ${v.losses} | ${v.rule} | ${cells.join(' | ')} |`);
    versionSummaries.push({
      name, evaluator: runs[0].evaluator, id: v.id, date: v.date, topics: v.gates.length,
      human: { win: v.wins, tie: v.ties, loss: v.losses }, rule: v.rule, metrics,
      runs: runs.map((r) => {
        const s = r.scores[v.id];
        return s ? Object.fromEntries(metrics.map((m) => [m, { worsening: s[`${m}Worsening`], p: s[`${m}P`] }])) : null;
      }),
    });
  }
}

// --- 未使用ラベル: the same metrics on the sessions each judge's questions were not written from ---

/** "0.29 [0.08, 0.64] (7)" — a share of n with its 95% Wilson interval. */
const withInterval = (s: Share): string => {
  if (s.share === null) return '-';
  const [lo, hi] = wilson(s.share, s.n);
  return `${s.share.toFixed(2)} [${lo.toFixed(2)}, ${hi.toFixed(2)}] (${s.n})`;
};
const f2 = (x: number | null): string => (x === null ? '-' : x.toFixed(2));

out('');
out('## 未使用ラベル — 質問や閾値を決めたときに見ていないセッションだけで測った値');
out('');
out('`since` 以降のセッションのラベルだけを使う。`skills/` の判定器は質問・閾値を確定した日（`src/validation/judges.ts` の `frozen`）、' +
  'それ以外は最も新しい確定日。角括弧は 95% 区間（AUC はブートストラップ、割合は Wilson）、丸括弧は件数。');
out('');
out('| evaluator | metric | since | answers (hits) | AUC [95%] | in-set | sets | pairs |');
out('|---|---|---|---|---|---|---|---|');
for (const r of answerRows) {
  const u = r.unused;
  out(`| ${r.name} | ${r.lowerIsBetter ? '−' : ''}${r.metric} | ${r.since} | ${u.answers} (${u.hits}) | ` +
    `${u.auc === null ? '-' : `${f2(u.auc)} [${f2(u.lo)}, ${f2(u.hi)}]`} | ${u.inSet === null ? '-' : `${f2(u.inSet)} (${u.inSetSets})`} | ` +
    `${withInterval(u.sets)} | ${withInterval(u.pairs)} |`);
}
if (preferenceRows.length) {
  out('');
  out('| evaluator | metric | since | in-set | pairs | confident |');
  out('|---|---|---|---|---|---|');
  for (const r of preferenceRows) {
    out(`| ${r.name} | ${r.metric} | ${r.since} | ${withInterval(r.unused.inSet)} | ${withInterval(r.unused.pairs)} | ${withInterval(r.unused.confident)} |`);
  }
}
if (overlapRows.length) {
  out('');
  out('| evaluator | metric | since | recall | false flags |');
  out('|---|---|---|---|---|');
  for (const r of overlapRows) {
    out(`| ${r.name} | ${r.metric} | ${r.since} | ${r.unused.caught}/${r.unused.similar} | ${r.unused.falseFlags}/${r.unused.different} |`);
  }
}

writeFileSync(join(dir, 'summary.md'), `${lines.join('\n')}\n`);

const summary: Summary = {
  dir,
  labels: {
    answers: labeled.length,
    hits: labeled.filter(([, a]) => a.hit).length,
    mixedSets: mixedSets.length,
    setPreferences: labels.setPreferences.length,
    setTies: labels.setTies.length,
    pairs: pairs.length,
    blindPairs: pairs.filter((p) => p.blind).length,
    similarity: judged.length,
    latestSession: labels.sessions.map((s) => s.date).sort().at(-1) ?? '',
    sessions: labels.sessions.map((s) => s.file),
  },
  gatePower,
  answer: answerRows,
  overlap: overlapRows,
  preference: preferenceRows,
  gate: gateSummaries,
  versions: versionSummaries,
};
writeFileSync(join(dir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
