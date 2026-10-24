/**
 * Loads the human labels in data/human-evals/<source>/*.json (schema in
 * data/human-evals/README.md) into global IDs, so evaluator scores from any
 * session can be matched against any label.
 *
 * Global IDs: set = "<date>/<set id>", answer = "<date>/<set id>#<n>".
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const HUMAN_EVALS_DIR = 'data/human-evals';

interface SessionFile {
  date: string;
  source: string;
  blind: boolean;
  topics: Record<string, string>;
  sets: {
    id: string;
    topic: string;
    condition: string;
    answers: string[];
    hits: number[] | null;
    ranking?: number[];
    converged?: string;
    role?: 'candidate' | 'baseline';
    sourceOrder?: string[];
  }[];
  setPreferences: { better: string; worse: string }[];
  setTies?: { a: string; b: string }[];
  pairPreferences: { a: string; b: string; winner: 'a' | 'b' | 'tie' }[];
  similarityJudgments?: { a: string; b: string; similarity: Similarity }[];
}

export type Similarity = 'similar' | 'partial' | 'different';

export interface LabeledSet {
  id: string;
  topic: string;
  answers: { id: string; text: string; hit: boolean | null }[];
  /** true when the human called out within-set convergence; unmentioned sets count as not converged. */
  converged: boolean;
}

export interface Labels {
  sets: LabeledSet[];
  answers: Map<string, { setId: string; topic: string; text: string; hit: boolean | null }>;
  setPreferences: { better: string; worse: string; blind: boolean }[];
  setTies: { a: string; b: string; blind: boolean }[];
  /** Version comparisons with a human set-level verdict, for trait-check's gate.ts. */
  gates: GateLabel[];
  pairPreferences: { a: string; b: string; winner: 'a' | 'b' | 'tie'; blind: boolean }[];
  similarityJudgments: { a: string; b: string; similarity: Similarity; blind: boolean }[];
}

/**
 * One お題 where a candidate and a baseline version were each generated in
 * separate runs (sets with `role` and `sourceOrder`), and the human compared
 * the pooled sets.
 */
export interface GateLabel {
  /** "<date>/<topic key>" */
  id: string;
  topic: string;
  blind: boolean;
  /** Answers per run, in run order and in each run's original order. */
  candidate: string[][];
  baseline: [string[], string[]];
  /** Which pooled set the human preferred. */
  human: 'candidate' | 'baseline' | 'tie';
}

/** Order-independent key for an answer pair, shared by labels and pair-level ScoreFiles. */
export const pairKey = (a: string, b: string): string => [a, b].sort().join(' | ');

/** Session-local refs get the session date prepended; refs that already start with a date are global. */
const globalId = (date: string, ref: string): string => (/^\d{4}-\d{2}-\d{2}/.test(ref) ? ref : `${date}/${ref}`);

export function loadLabels(source = 'ogiri-ai', dir = HUMAN_EVALS_DIR): Labels {
  const labels: Labels = {
    sets: [], answers: new Map(), setPreferences: [], setTies: [], gates: [], pairPreferences: [], similarityJudgments: [],
  };
  const files = readdirSync(join(dir, source)).filter((f) => f.endsWith('.json')).sort();

  for (const file of files) {
    const s = JSON.parse(readFileSync(join(dir, source, file), 'utf8')) as SessionFile;
    for (const set of s.sets) {
      const setId = globalId(s.date, set.id);
      const topic = s.topics[set.topic];
      const answers = set.answers.map((text, i) => ({
        id: `${setId}#${i + 1}`,
        text,
        hit: set.hits === null ? null : set.hits.includes(i + 1),
      }));
      labels.sets.push({ id: setId, topic, answers, converged: set.converged !== undefined });
      for (const a of answers) labels.answers.set(a.id, { setId, topic, text: a.text, hit: a.hit });
    }
    for (const p of s.setPreferences) {
      labels.setPreferences.push({ better: globalId(s.date, p.better), worse: globalId(s.date, p.worse), blind: s.blind });
    }
    for (const p of s.setTies ?? []) {
      labels.setTies.push({ a: globalId(s.date, p.a), b: globalId(s.date, p.b), blind: s.blind });
    }
    labels.gates.push(...gatesOf(s));
    for (const p of s.pairPreferences) {
      labels.pairPreferences.push({ a: globalId(s.date, p.a), b: globalId(s.date, p.b), winner: p.winner, blind: s.blind });
    }
    for (const p of s.similarityJudgments ?? []) {
      labels.similarityJudgments.push({ a: globalId(s.date, p.a), b: globalId(s.date, p.b), similarity: p.similarity, blind: s.blind });
    }
  }

  for (const ref of [...labels.pairPreferences, ...labels.similarityJudgments].flatMap((p) => [p.a, p.b])) {
    if (!labels.answers.has(ref)) throw new Error(`pair label refers to unknown answer ${ref}`);
  }
  const setIds = new Set(labels.sets.map((s) => s.id));
  for (const ref of [...labels.setPreferences.flatMap((p) => [p.better, p.worse]), ...labels.setTies.flatMap((p) => [p.a, p.b])]) {
    if (!setIds.has(ref)) throw new Error(`set label refers to unknown set ${ref}`);
  }
  return labels;
}

/** Splits a pooled set back into its runs using sourceOrder ("<version>-r<run>#<n>"). */
function runsOf(set: SessionFile['sets'][number], where: string): string[][] {
  const order = set.sourceOrder!;
  if (order.length !== set.answers.length) throw new Error(`${where}: sourceOrder has ${order.length} entries for ${set.answers.length} answers`);
  const runs = new Map<number, [number, string][]>();
  order.forEach((ref, i) => {
    const m = /-r(\d+)#(\d+)$/.exec(ref);
    if (!m) throw new Error(`${where}: sourceOrder entry "${ref}" is not "<version>-r<run>#<n>"`);
    runs.set(Number(m[1]), [...(runs.get(Number(m[1])) ?? []), [Number(m[2]), set.answers[i]]]);
  });
  return [...runs].sort(([a], [b]) => a - b).map(([, xs]) => xs.sort(([a], [b]) => a - b).map(([, text]) => text));
}

/** Topics in one session with a candidate set, a baseline set (both split into runs) and a human set-level verdict. */
function gatesOf(s: SessionFile): GateLabel[] {
  const out: GateLabel[] = [];
  for (const topic of Object.keys(s.topics)) {
    const withRole = (role: string) => s.sets.filter((x) => x.topic === topic && x.role === role && x.sourceOrder);
    const [cand, base] = [withRole('candidate'), withRole('baseline')];
    if (cand.length !== 1 || base.length !== 1) continue;
    const [c, b] = [cand[0].id, base[0].id];
    const preferred = s.setPreferences.find((p) => [p.better, p.worse].sort().join() === [c, b].sort().join());
    const tied = (s.setTies ?? []).some((p) => [p.a, p.b].sort().join() === [c, b].sort().join());
    if (!preferred && !tied) continue;
    const where = `${s.date}/${topic}`;
    const baseline = runsOf(base[0], where);
    if (baseline.length !== 2) throw new Error(`${where}: the baseline needs exactly 2 runs for a noise band, found ${baseline.length}`);
    out.push({
      id: where,
      topic: s.topics[topic],
      blind: s.blind,
      candidate: runsOf(cand[0], where),
      baseline: baseline as [string[], string[]],
      human: tied ? 'tie' : preferred!.better === c ? 'candidate' : 'baseline',
    });
  }
  return out;
}

/** Topics (by text) with every labeled set on that topic — the unit evaluators see as one pool. */
export function setsByTopic(labels: Labels): Map<string, LabeledSet[]> {
  const byTopic = new Map<string, LabeledSet[]>();
  for (const set of labels.sets) byTopic.set(set.topic, [...(byTopic.get(set.topic) ?? []), set]);
  return byTopic;
}

/**
 * Answer pairs with a known human preference, for pairwise judges (trait-check compare.ts):
 * every hit vs every non-hit inside one set, plus every non-tie pairPreference.
 */
export function preferencePairs(labels: Labels): { winner: string; loser: string }[] {
  const seen = new Set<string>();
  const out: { winner: string; loser: string }[] = [];
  const add = (winner: string, loser: string): void => {
    const k = pairKey(winner, loser);
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ winner, loser });
  };
  for (const set of labels.sets) {
    for (const h of set.answers.filter((a) => a.hit)) {
      for (const n of set.answers.filter((a) => a.hit === false)) add(h.id, n.id);
    }
  }
  for (const p of labels.pairPreferences) {
    if (p.winner !== 'tie') add(p.winner === 'a' ? p.a : p.b, p.winner === 'a' ? p.b : p.a);
  }
  return out;
}
