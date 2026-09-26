/**
 * Prompt-mode validation: the judge is a subagent following a research judge's SKILL.md,
 * so there is no script to call. This makes blinded, shuffled inputs for the
 * subagents and maps their JSON answers back to labeled IDs.
 *
 *   node src/validation/blind.ts make <dir>
 *     -> <dir>/pool-<n>.md   answers pooled per topic, shuffled, sources hidden (answer-level judges)
 *        <dir>/sets-<n>.md   the same topics as separate 5-answer sets (set-level judges)
 *        <dir>/pairs.md      same-topic A/B pairs with a human preference, shuffled (pairwise judges)
 *        <dir>/key.json      blind ID -> labeled ID. Never give this to a judge.
 *
 *   node src/validation/blind.ts unblind <dir> <format> <judge output.json> <run> <model>
 *     -> <dir>/../<evaluator>.prompt.run<run>.json (a ScoreFile)
 *
 * Formats (what the subagent is asked to write — see src/validation/README.md):
 *   funniness-score  {"<answer id>": {"novelty":n, ..., "overall":n, "overallFloored":n}}
 *   risk-flags       {"answers": {"<answer id>": ["ベタ", "ひねりなし", ...]}}
 *   ranking          {"<topic id>": {"ranking": [ids best->worst], "hits": [ids]}}   (no-rubric baseline)
 *   diversity-check  {"<set id>": {"axes": n, "largestAxisCount": n}}
 *   naive-pairwise   {"judgments": [{"id": "P1", "winner": "A" | "B" | "draw", "confidence": n}, ...]}
 *                    (no-rubric "which is funnier" baseline)
 *
 * Judges in skills/ are Jev-only and validated by run-jev.ts; they have no prompt mode.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { loadLabels, pairKey, preferencePairs, setsByTopic } from './labels.ts';
import type { ScoreFile } from './score-file.ts';

const TOPICS_PER_FILE = 4;
const RISK_FLAGS = ['ベタ', 'ひねりなし', '共感', '認知度', '滑り', '相対ベタ', 'シュール手癖'];

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function make(dir: string): void {
  mkdirSync(dir, { recursive: true });
  const labels = loadLabels();
  const topics = shuffle([...setsByTopic(labels)]);
  const key: Record<string, string> = {};

  for (let f = 0; f * TOPICS_PER_FILE < topics.length; f++) {
    const pool: string[] = [];
    const sets: string[] = [];
    topics.slice(f * TOPICS_PER_FILE, (f + 1) * TOPICS_PER_FILE).forEach(([topic, topicSets], i) => {
      const tid = `t${f * TOPICS_PER_FILE + i + 1}`;
      key[tid] = topic;

      pool.push(`## お題ID ${tid}`, `お題: ${topic}`, '回答:');
      shuffle(topicSets.flatMap((s) => s.answers)).forEach((a, n) => {
        const aid = `${tid}-${String(n + 1).padStart(2, '0')}`;
        key[aid] = a.id;
        pool.push(`- ${aid}: ${a.text}`);
      });
      pool.push('');

      sets.push(`## お題ID ${tid}`, `お題: ${topic}`);
      shuffle(topicSets).forEach((s, n) => {
        const sid = `${tid}-set${String.fromCharCode(65 + n)}`;
        key[sid] = s.id;
        sets.push(`### ${sid}`, ...s.answers.map((a, j) => `${j + 1}. ${a.text}`));
      });
      sets.push('');
    });
    writeFileSync(join(dir, `pool-${f + 1}.md`), pool.join('\n'));
    writeFileSync(join(dir, `sets-${f + 1}.md`), sets.join('\n'));
  }
  const pairs = ['# 一対比較', '', '各ペアは同じお題の回答2つ。出所は伏せてある。', ''];
  shuffle(preferencePairs(labels)).forEach(({ winner, loser }, n) => {
    const [a, b] = Math.random() < 0.5 ? [winner, loser] : [loser, winner];
    key[`P${n + 1}-A`] = a;
    key[`P${n + 1}-B`] = b;
    pairs.push(`## P${n + 1}`, `お題: ${labels.answers.get(a)!.topic}`, `- A: ${labels.answers.get(a)!.text}`, `- B: ${labels.answers.get(b)!.text}`, '');
  });
  writeFileSync(join(dir, 'pairs.md'), pairs.join('\n'));
  writeFileSync(join(dir, 'key.json'), `${JSON.stringify(key, null, 2)}\n`);
  console.log(`blind inputs -> ${dir} (${topics.length} topics)`);
}

function unblind(dir: string, format: string, inputs: string[], run: number, model: string): void {
  const key = JSON.parse(readFileSync(join(dir, 'key.json'), 'utf8')) as Record<string, string>;
  const real = (id: string): string => {
    if (!key[id]) throw new Error(`unknown blind id ${id}`);
    return key[id];
  };
  // A judge may be split across several subagents (one per pool file); merge their outputs.
  const parsed = inputs.map((p) => JSON.parse(readFileSync(p, 'utf8')));
  const scores: ScoreFile['scores'] = {};
  let file: Omit<ScoreFile, 'scores'>;

  switch (format) {
    case 'funniness-score':
      for (const [id, sc] of parsed.flatMap((p) => Object.entries(p as Record<string, Record<string, number>>))) scores[real(id)] = sc;
      file = { evaluator: 'funniness-score', mode: 'prompt', run, model, level: 'answer', lowerIsBetter: [] };
      break;
    case 'risk-flags':
      for (const [id, flags] of parsed.flatMap((p) => Object.entries((p as { answers: Record<string, string[]> }).answers))) {
        scores[real(id)] = {
          ...Object.fromEntries(RISK_FLAGS.map((f) => [f, flags.includes(f) ? 1 : 0])),
          nflags: flags.length,
        };
      }
      file = { evaluator: 'risk-flags', mode: 'prompt', run, model, level: 'answer', lowerIsBetter: [...RISK_FLAGS, 'nflags'] };
      break;
    case 'ranking':
      for (const v of parsed.flatMap((p) => Object.values(p as Record<string, { ranking: string[]; hits: string[] }>))) {
        v.ranking.forEach((id, r) => {
          scores[real(id)] = { rank: 1 - r / (v.ranking.length - 1), hit: v.hits.includes(id) ? 1 : 0 };
        });
      }
      file = { evaluator: 'naive', mode: 'prompt', run, model, level: 'answer', lowerIsBetter: [] };
      break;
    case 'diversity-check':
      for (const [id, s] of parsed.flatMap((p) => Object.entries(p as Record<string, Record<string, number>>))) scores[real(id)] = s;
      file = { evaluator: 'diversity-check', mode: 'prompt', run, model, level: 'set', lowerIsBetter: ['largestAxisCount'] };
      break;
    case 'naive-pairwise':
      for (const j of parsed.flatMap((p) => (p as { judgments: { id: string; winner: 'A' | 'B' | 'draw' }[] }).judgments)) {
        const [a, b] = [real(`${j.id}-A`), real(`${j.id}-B`)];
        const pA = j.winner === 'A' ? 1 : j.winner === 'B' ? 0 : 0.5;
        scores[pairKey(a, b)] = { win: pairKey(a, b).split(' | ')[0] === a ? pA : 1 - pA };
      }
      file = { evaluator: format, mode: 'prompt', run, model, level: 'preference', lowerIsBetter: [] };
      break;
    default:
      throw new Error(`unknown format ${format}`);
  }

  writeScoreFile(dir, { ...file, scores });
}

function writeScoreFile(blindDir: string, file: ScoreFile): void {
  const out = join(dirname(blindDir), `${file.evaluator}.${file.mode}.run${file.run}.json`);
  writeFileSync(out, `${JSON.stringify(file, null, 2)}\n`);
  console.log(`-> ${out} (${Object.keys(file.scores).length} entries)`);
}

const [cmd, dir, ...rest] = process.argv.slice(2);
if (cmd === 'make' && dir) {
  make(dir);
} else if (cmd === 'unblind' && dir && rest.length >= 4) {
  const [format, ...more] = rest;
  const model = more.pop()!;
  const run = Number(more.pop());
  unblind(dir, format, more, run, model);
} else {
  console.error('usage: blind.ts make <dir> | blind.ts unblind <dir> <format> <judge output.json>... <run> <model>');
  process.exit(1);
}
