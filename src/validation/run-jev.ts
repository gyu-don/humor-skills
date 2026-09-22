/**
 * Runs the Jev ports of the judge skills (and a no-rubric baseline) over every
 * human-labeled set, and stores the results as ScoreFiles for agreement.ts.
 *
 *   doppler run -- npm run validate:jev -- reports/validation/<date> [runs=2]
 *
 * The skills' own scripts/evaluate.ts are executed as-is, so this measures
 * the code a user actually installs. Two runs by default so agreement.ts can
 * report test-retest reliability next to validity.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { score, TypeSafeClient } from '@typesafe-ai/sdk';
import { loadLabels, pairKey, setsByTopic } from './labels.ts';
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
// fun-check's 被りチェック compares answers within one input, so feed it every set on a topic
// pooled together — that covers the within-set and cross-set pairs the human labels refer to.
const pools = [...setsByTopic(labels)].map(([topic, sets], i) => ({
  id: `pool${i + 1}`, label: topic, topic, ids: sets.flatMap((s) => s.answers.map((a) => a.id)),
  answers: sets.flatMap((s) => s.answers.map((a) => a.text)),
}));
const poolIds = new Map(pools.map((p) => [p.id, p.ids]));
const work = mkdtempSync(join(tmpdir(), 'validate-jev-'));
const inPath = join(work, 'input.json');
const poolPath = join(work, 'pools.json');
writeFileSync(inPath, JSON.stringify(samples));
writeFileSync(poolPath, JSON.stringify(pools.map(({ ids, ...p }) => p)));
mkdirSync(outDir, { recursive: true });

interface SkillRow { sampleId: string; index: number }

function runSkill<T>(skill: string, run: number, input = inPath): T {
  const out = join(work, `${skill}-${run}.json`);
  execFileSync('node', [`skills/${skill}/scripts/evaluate.ts`, input, out], { stdio: ['ignore', 'ignore', 'inherit'] });
  return JSON.parse(readFileSync(out, 'utf8')) as T;
}

const save = (file: ScoreFile): void => {
  const path = join(outDir, `${file.evaluator}.${file.mode}.run${file.run}.json`);
  writeFileSync(path, `${JSON.stringify(file, null, 2)}\n`);
  console.log(`-> ${path}`);
};

/** Baseline: one plain "how funny" question, no rubric — what the skills have to beat. */
const client = new TypeSafeClient({ timeout: 60_000 });
const naiveQuestion = {
  funny: score('大喜利の回答として、どれくらい面白いか', ['全く面白くない', 'あまり面白くない', '普通', '面白い', 'とても面白い']),
};

async function naive(): Promise<Record<string, Record<string, number>>> {
  const all = labels.sets.flatMap((s) => s.answers.map((a) => ({ id: a.id, topic: s.topic, text: a.text })));
  const rows = await Promise.all(all.map(async (a) => {
    const r = await client.systemOne({ model: 'jev-latest', state: { お題: a.topic, 回答: a.text }, questions: naiveQuestion });
    return [a.id, { funny: r.answers.funny.score }] as const;
  }));
  return Object.fromEntries(rows);
}

for (let run = 1; run <= runs; run++) {
  const he = runSkill<{ rows: (SkillRow & { scores: Record<string, number>; overallFloored: number })[] }>('humor-eval', run).rows;
  save({
    evaluator: 'humor-eval', mode: 'jev', run, model: 'jev-latest', level: 'answer', lowerIsBetter: [],
    scores: Object.fromEntries(he.map((r) => [`${r.sampleId}#${r.index}`, { ...r.scores, overallFloored: r.overallFloored }])),
  });

  const fcOut = runSkill<{
    rows: (SkillRow & { risks: Record<string, number> })[];
    overlaps: { sampleId: string; a: number; b: number; sameMaterial: number; exact: boolean; nearDuplicate: boolean }[];
  }>('fun-check', run, poolPath);
  const fc = fcOut.rows;
  const answerId = (sampleId: string, index: number): string => poolIds.get(sampleId)![index - 1];
  const riskKeys = Object.keys(fc[0].risks);
  save({
    evaluator: 'fun-check-overlap', mode: 'jev', run, model: 'jev-latest', level: 'pair', lowerIsBetter: [],
    scores: Object.fromEntries(fcOut.overlaps.map((o) => [
      pairKey(answerId(o.sampleId, o.a), answerId(o.sampleId, o.b)),
      { sameMaterial: o.sameMaterial, nearDuplicate: o.nearDuplicate ? 1 : 0 },
    ])),
  });
  save({
    evaluator: 'fun-check', mode: 'jev', run, model: 'jev-latest', level: 'answer', lowerIsBetter: [...riskKeys, 'sumRisk'],
    scores: Object.fromEntries(fc.map((r) => [
      answerId(r.sampleId, r.index),
      { ...r.risks, sumRisk: Object.values(r.risks).reduce((a, b) => a + b, 0) },
    ])),
  });

  save({ evaluator: 'naive', mode: 'jev', run, model: 'jev-latest', level: 'answer', lowerIsBetter: [], scores: await naive() });
}
