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

/** Set on sessions that came through the inbox (data/inbox/README.md). */
export interface SessionRequest {
  id: string;
  kind: 'final-check' | 'criterion';
  /** data/ledger entry the request tests. */
  ledger?: string;
}

interface SessionFile {
  date: string;
  source: string;
  rater?: string;
  blind: boolean;
  request?: SessionRequest;
  topics: Record<string, string>;
  sets: {
    id: string;
    topic: string;
    condition: string;
    answers: string[];
    hits: number[] | null;
    /** Answers the human marked as bad. When present, unmarked answers are unknown rather than non-hits. */
    misses?: number[];
    ranking?: number[];
    converged?: string;
    role?: 'candidate' | 'baseline';
    sourceOrder?: string[];
  }[];
  setPreferences: { better: string; worse: string }[];
  setTies?: { a: string; b: string }[];
  pairPreferences: { a: string; b: string; winner: 'a' | 'b' | 'tie' }[];
  similarityJudgments?: { a: string; b: string; similarity: Similarity }[];
  traitJudgments?: { answer: string; judge: string; metric: string; question: string; label: TraitLabel; judgeProbability?: number }[];
}

export type TraitLabel = 'yes' | 'no' | 'unsure';

export type Similarity = 'similar' | 'partial' | 'different';

export interface LabeledSet {
  id: string;
  /** Date of the session the set was judged in, and whether that session hid the sources. */
  date: string;
  blind: boolean;
  /** File name of that session. */
  session: string;
  topic: string;
  answers: { id: string; text: string; hit: boolean | null }[];
  /** true when the human called out within-set convergence; unmentioned sets count as not converged. */
  converged: boolean;
}

/**
 * Every label carries `date`, the date of the session the judgment was made
 * in (not of the answers it refers to), so agreement.ts can separate the
 * labels a judge's questions were written from and the ones added later.
 */
export interface Labels {
  sessions: { file: string; date: string; rater: string; blind: boolean; request?: SessionRequest }[];
  sets: LabeledSet[];
  answers: Map<string, { setId: string; date: string; topic: string; text: string; hit: boolean | null }>;
  setPreferences: { better: string; worse: string; blind: boolean; date: string }[];
  setTies: { a: string; b: string; blind: boolean; date: string }[];
  /** お題 where two versions were compared and the human gave a set-level verdict, for trait-check's versions.ts. */
  gates: GateLabel[];
  /** The same お題 grouped into version comparisons — the unit the adoption rule applies to. */
  versions: VersionComparison[];
  /** A human's own answer to a judge's yes/no question, with the judge's probability when it was recorded. */
  traitJudgments: { answer: string; judge: string; metric: string; question: string; label: TraitLabel; judgeProbability?: number; date: string }[];
  pairPreferences: { a: string; b: string; winner: 'a' | 'b' | 'tie'; blind: boolean; date: string }[];
  similarityJudgments: { a: string; b: string; similarity: Similarity; blind: boolean; date: string }[];
}

/**
 * One お題 where a candidate and a baseline version were each generated in
 * separate runs (sets with `role` and `sourceOrder`), and the human compared
 * the pooled sets.
 */
export interface GateLabel {
  /** The candidate set's global id without its last segment: "<date>/<topic key>", or "<date>/<request id>/<topic key>" from the inbox. */
  id: string;
  /** The version comparison this お題 belongs to: the inbox request id, or the session date for older sessions. */
  group: string;
  date: string;
  topic: string;
  blind: boolean;
  /** Global IDs of the two pooled sets. */
  candidateSet: string;
  baselineSet: string;
  /** Answers per run, in run order and in each run's original order. */
  candidate: string[][];
  baseline: [string[], string[]];
  /** Which pooled set the human preferred. */
  human: 'candidate' | 'baseline' | 'tie';
}

export interface VersionComparison {
  id: string;
  date: string;
  gates: GateLabel[];
  wins: number;
  ties: number;
  losses: number;
  rule: Adoption;
}

export type Adoption = 'adoptable' | 'return';

/**
 * The adoption rule (owner decision, 2026-11-16): a version the human never
 * preferred the old version to, on any お題 of the blind comparison, may be
 * adopted; one loss sends it back to the ledger.
 */
export const adoption = (losses: number): Adoption => (losses === 0 ? 'adoptable' : 'return');

/** Order-independent key for an answer pair, shared by labels and pair-level ScoreFiles. */
export const pairKey = (a: string, b: string): string => [a, b].sort().join(' | ');

/** Session-local refs get the session date prepended; refs that already start with a date are global. */
const globalId = (date: string, ref: string): string => (/^\d{4}-\d{2}-\d{2}/.test(ref) ? ref : `${date}/${ref}`);

export function loadLabels(source = 'ogiri-ai', dir = HUMAN_EVALS_DIR): Labels {
  const labels: Labels = {
    sessions: [], sets: [], answers: new Map(), setPreferences: [], setTies: [], gates: [], versions: [], pairPreferences: [],
    similarityJudgments: [], traitJudgments: [],
  };
  const files = readdirSync(join(dir, source)).filter((f) => f.endsWith('.json')).sort();
  const setFile = new Map<string, string>();

  for (const file of files) {
    const s = JSON.parse(readFileSync(join(dir, source, file), 'utf8')) as SessionFile;
    const date = s.date;
    labels.sessions.push({ file, date, rater: s.rater ?? 'unknown', blind: s.blind, request: s.request });
    for (const set of s.sets) {
      const setId = globalId(s.date, set.id);
      // Two sessions on one date with the same set id would merge silently.
      if (setFile.has(setId)) throw new Error(`set ${setId} is in both ${setFile.get(setId)} and ${file} — make set ids unique within a date`);
      setFile.set(setId, file);
      const topic = s.topics[set.topic];
      const answers = set.answers.map((text, i) => ({
        id: `${setId}#${i + 1}`,
        text,
        hit: hitOf(set, i + 1),
      }));
      labels.sets.push({ id: setId, date, blind: s.blind, session: file, topic, answers, converged: set.converged !== undefined });
      for (const a of answers) labels.answers.set(a.id, { setId, date, topic, text: a.text, hit: a.hit });
    }
    for (const p of s.setPreferences) {
      labels.setPreferences.push({ better: globalId(s.date, p.better), worse: globalId(s.date, p.worse), blind: s.blind, date });
    }
    for (const p of s.setTies ?? []) {
      labels.setTies.push({ a: globalId(s.date, p.a), b: globalId(s.date, p.b), blind: s.blind, date });
    }
    labels.gates.push(...gatesOf(s));
    for (const p of s.pairPreferences) {
      labels.pairPreferences.push({ a: globalId(s.date, p.a), b: globalId(s.date, p.b), winner: p.winner, blind: s.blind, date });
    }
    for (const p of s.similarityJudgments ?? []) {
      labels.similarityJudgments.push({ a: globalId(s.date, p.a), b: globalId(s.date, p.b), similarity: p.similarity, blind: s.blind, date });
    }
    for (const t of s.traitJudgments ?? []) labels.traitJudgments.push({ ...t, answer: globalId(s.date, t.answer), date });
  }

  const groups = new Map<string, GateLabel[]>();
  for (const g of labels.gates) groups.set(g.group, [...(groups.get(g.group) ?? []), g]);
  for (const [id, gates] of groups) {
    const count = (human: GateLabel['human']): number => gates.filter((g) => g.human === human).length;
    labels.versions.push({
      id, date: gates[0].date, gates, wins: count('candidate'), ties: count('tie'), losses: count('baseline'), rule: adoption(count('baseline')),
    });
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

/**
 * true = singled out as good, false = not, null = unknown. Without `misses`
 * every answer the human did not name counts as a non-hit; with it, only the
 * answers marked bad do, and the unmarked ones are left out of the metrics.
 */
function hitOf(set: SessionFile['sets'][number], n: number): boolean | null {
  if (set.misses) return (set.hits ?? []).includes(n) ? true : set.misses.includes(n) ? false : null;
  return set.hits === null ? null : set.hits.includes(n);
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
    const where = globalId(s.date, c).replace(/\/[^/]+$/, '');
    const baseline = runsOf(base[0], where);
    if (baseline.length !== 2) throw new Error(`${where}: the baseline needs exactly 2 runs, found ${baseline.length}`);
    out.push({
      id: where,
      group: s.request?.id ?? s.date,
      date: s.date,
      topic: s.topics[topic],
      blind: s.blind,
      candidateSet: globalId(s.date, c),
      baselineSet: globalId(s.date, b),
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
  for (const p of inSetPairs(labels)) add(p.winner, p.loser);
  for (const p of humanPairs(labels)) add(p.winner, p.loser);
  return out;
}

/** `date` is the session the preference comes from. */
export interface PreferencePair { winner: string; loser: string; date: string }

/** Every hit vs every non-hit inside one set — implied by the hits, not compared directly. */
export function inSetPairs(labels: Labels): PreferencePair[] {
  return labels.sets.flatMap((set) => set.answers.filter((a) => a.hit).flatMap((h) =>
    set.answers.filter((a) => a.hit === false).map((n) => ({ winner: h.id, loser: n.id, date: set.date }))));
}

/** Pairs the human compared directly, ties left out. */
export function humanPairs(labels: Labels): PreferencePair[] {
  return labels.pairPreferences.filter((p) => p.winner !== 'tie').map((p) => ({
    winner: p.winner === 'a' ? p.a : p.b, loser: p.winner === 'a' ? p.b : p.a, date: p.date,
  }));
}
