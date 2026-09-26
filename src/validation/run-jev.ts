/**
 * Runs every Jev judge over every human-labeled set, and stores the results
 * as ScoreFiles for agreement.ts: the automated-test skills in skills/, the
 * research judges in research/, and two no-rubric baselines (naive "how
 * funny" score, naive "which is funnier" pair).
 *
 *   doppler run -- npm run validate:jev -- reports/validation/<date> [runs=2]
 *
 * Each judge's own script is executed as-is, so this measures the code a
 * user actually installs. Two runs by default so agreement.ts can
 * report test-retest reliability next to validity.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { choice, score, TypeSafeClient } from '@typesafe-ai/sdk';
import { loadLabels, pairKey, preferencePairs, setsByTopic } from './labels.ts';
import type { ScoreFile } from './score-file.ts';

const outDir = process.argv[2];
const runs = Number(process.argv[3] ?? 2);
if (!outDir) {
  console.error('usage: node src/validation/run-jev.ts <out dir> [runs]');
  process.exit(1);
}
if (!process.env.TYPESAFE_API_KEY) {
  console.error('TYPESAFE_API_KEY is missing. Run through Doppler: doppler run -- npm run validate:jev -- <out dir>');
  process.exit(1);
}

const labels = loadLabels();
const samples = labels.sets.map((s) => ({ id: s.id, label: s.id, topic: s.topic, answers: s.answers.map((a) => a.text) }));
// overlap-check compares answers within one input, so feed it every set on a topic
// pooled together — that covers the within-set and cross-set pairs the human labels refer to.
const pools = [...setsByTopic(labels)].map(([topic, sets], i) => ({
  id: `pool${i + 1}`, label: topic, topic, ids: sets.flatMap((s) => s.answers.map((a) => a.id)),
  answers: sets.flatMap((s) => s.answers.map((a) => a.text)),
}));
const poolIds = new Map(pools.map((p) => [p.id, p.ids]));
// trait-check's compare.ts judges pairs: every same-topic pair with a known human preference, in pairKey order.
const comparisons = preferencePairs(labels).map(({ winner, loser }) => pairKey(winner, loser).split(' | '));
const text = (id: string): string => labels.answers.get(id)!.text;
const work = mkdtempSync(join(tmpdir(), 'validate-jev-'));
const inPath = join(work, 'input.json');
const poolPath = join(work, 'pools.json');
const pairPath = join(work, 'pairs.json');
writeFileSync(inPath, JSON.stringify(samples));
writeFileSync(poolPath, JSON.stringify(pools.map(({ ids, ...p }) => p)));
writeFileSync(pairPath, JSON.stringify(comparisons.map(([a, b], i) => ({
  id: String(i), label: pairKey(a, b), topic: labels.answers.get(a)!.topic, answerA: text(a), answerB: text(b),
}))));
mkdirSync(outDir, { recursive: true });

interface SkillRow { sampleId: string; index: number }

/** Runs `<dir>/scripts/<script>` (e.g. skills/trait-check/scripts/compare.ts) and returns its JSON output. */
function runScript<T>(dir: string, run: number, input = inPath, script = 'evaluate.ts'): T {
  const out = join(work, `${dir.replace('/', '-')}-${script}-${run}.json`);
  execFileSync('node', [join(dir, 'scripts', script), input, out], { stdio: ['ignore', 'ignore', 'inherit'] });
  return JSON.parse(readFileSync(out, 'utf8')) as T;
}

const save = (file: ScoreFile): void => {
  const path = join(outDir, `${file.evaluator}.${file.mode}.run${file.run}.json`);
  writeFileSync(path, `${JSON.stringify(file, null, 2)}\n`);
  console.log(`-> ${path}`);
};

const byAnswer = <R extends SkillRow>(rows: R[], f: (r: R) => Record<string, number>): ScoreFile['scores'] =>
  Object.fromEntries(rows.map((r) => [`${r.sampleId}#${r.index}`, f(r)]));

/** Baselines: one plain question each, no rubric — what every judge has to beat. */
const client = new TypeSafeClient({ timeout: 60_000 });
const naiveQuestion = {
  funny: score('大喜利の回答として、どれくらい面白いか', ['全く面白くない', 'あまり面白くない', '普通', '面白い', 'とても面白い']),
};

async function naive(): Promise<ScoreFile['scores']> {
  const all = labels.sets.flatMap((s) => s.answers.map((a) => ({ id: a.id, topic: s.topic, text: a.text })));
  const rows = await Promise.all(all.map(async (a) => {
    const r = await client.systemOne({ model: 'jev-latest', state: { お題: a.topic, 回答: a.text }, questions: naiveQuestion });
    return [a.id, { funny: r.answers.funny.score }] as const;
  }));
  return Object.fromEntries(rows);
}

async function naivePairwise(): Promise<ScoreFile['scores']> {
  const ask = async (topic: string, first: string, second: string): Promise<number> => {
    const r = await client.systemOne({
      model: 'jev-latest', state: { お題: topic },
      questions: { w: choice('大喜利の回答として、どちらが面白いか？', { first: `回答: ${first}`, second: `回答: ${second}` }) },
    });
    return r.answers.w.probabilities.first;
  };
  const rows = await Promise.all(comparisons.map(async ([a, b]) => {
    const topic = labels.answers.get(a)!.topic;
    const [normal, swapped] = await Promise.all([ask(topic, text(a), text(b)), ask(topic, text(b), text(a))]);
    return [pairKey(a, b), { funny: (normal + 1 - swapped) / 2 }] as const;
  }));
  return Object.fromEntries(rows);
}

for (let run = 1; run <= runs; run++) {
  // --- skills/: automated tests ---
  const oc = runScript<{ overlaps: { sampleId: string; a: number; b: number; sameMaterial: number; nearDuplicate: boolean }[] }>(
    'skills/overlap-check', run, poolPath).overlaps;
  const answerId = (sampleId: string, index: number): string => poolIds.get(sampleId)![index - 1];
  save({
    evaluator: 'overlap-check', mode: 'jev', run, model: 'jev-latest', level: 'pair', lowerIsBetter: [],
    scores: Object.fromEntries(oc.map((o) => [
      pairKey(answerId(o.sampleId, o.a), answerId(o.sampleId, o.b)),
      { sameMaterial: o.sameMaterial, nearDuplicate: o.nearDuplicate ? 1 : 0 },
    ])),
  });

  const tc = runScript<{ rows: (SkillRow & { traits: Record<string, number> })[] }>('skills/trait-check', run).rows;
  save({
    evaluator: 'trait-check', mode: 'jev', run, model: 'jev-latest', level: 'answer', lowerIsBetter: ['indirect'],
    scores: byAnswer(tc, (r) => r.traits),
  });

  const cmp = runScript<{ results: { id: string; probA: number; criteria: Record<string, number> }[] }>(
    'skills/trait-check', run, pairPath, 'compare.ts').results;
  save({
    evaluator: 'trait-compare', mode: 'jev', run, model: 'jev-latest', level: 'preference', lowerIsBetter: [],
    scores: Object.fromEntries(cmp.map((r) => [pairKey(...(comparisons[Number(r.id)] as [string, string])), { probA: r.probA, ...r.criteria }])),
  });

  // --- research/: judges still under validation ---
  const fs = runScript<{ rows: (SkillRow & { scores: Record<string, number>; overallFloored: number })[] }>('research/funniness-score', run).rows;
  save({
    evaluator: 'funniness-score', mode: 'jev', run, model: 'jev-latest', level: 'answer', lowerIsBetter: [],
    scores: byAnswer(fs, (r) => ({ ...r.scores, overallFloored: r.overallFloored })),
  });

  const rf = runScript<{ rows: (SkillRow & { risks: Record<string, number> })[] }>('research/risk-flags', run).rows;
  const riskKeys = Object.keys(rf[0].risks);
  save({
    evaluator: 'risk-flags', mode: 'jev', run, model: 'jev-latest', level: 'answer', lowerIsBetter: [...riskKeys, 'sumRisk'],
    scores: byAnswer(rf, (r) => ({ ...r.risks, sumRisk: Object.values(r.risks).reduce((a, b) => a + b, 0) })),
  });

  const cf = runScript<{ rows: (SkillRow & { clusterFit: Record<string, number> })[] }>('research/cluster-fit-check', run).rows;
  save({
    evaluator: 'cluster-fit-check', mode: 'jev', run, model: 'jev-latest', level: 'answer', lowerIsBetter: [],
    scores: byAnswer(cf, (r) => r.clusterFit),
  });

  save({ evaluator: 'naive', mode: 'jev', run, model: 'jev-latest', level: 'answer', lowerIsBetter: [], scores: await naive() });
  save({ evaluator: 'naive-pairwise', mode: 'jev', run, model: 'jev-latest', level: 'preference', lowerIsBetter: [], scores: await naivePairwise() });
}
