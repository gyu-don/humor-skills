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
  }[];
  setPreferences: { better: string; worse: string }[];
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
  pairPreferences: { a: string; b: string; winner: 'a' | 'b' | 'tie'; blind: boolean }[];
  similarityJudgments: { a: string; b: string; similarity: Similarity; blind: boolean }[];
}

/** Order-independent key for an answer pair, shared by labels and pair-level ScoreFiles. */
export const pairKey = (a: string, b: string): string => [a, b].sort().join(' | ');

/** Session-local refs get the session date prepended; refs that already start with a date are global. */
const globalId = (date: string, ref: string): string => (/^\d{4}-\d{2}-\d{2}/.test(ref) ? ref : `${date}/${ref}`);

export function loadLabels(source = 'ogiri-ai', dir = HUMAN_EVALS_DIR): Labels {
  const labels: Labels = { sets: [], answers: new Map(), setPreferences: [], pairPreferences: [], similarityJudgments: [] };
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
  return labels;
}

/** Topics (by text) with every labeled set on that topic — the unit evaluators see as one pool. */
export function setsByTopic(labels: Labels): Map<string, LabeledSet[]> {
  const byTopic = new Map<string, LabeledSet[]>();
  for (const set of labels.sets) byTopic.set(set.topic, [...(byTopic.get(set.topic) ?? []), set]);
  return byTopic;
}
