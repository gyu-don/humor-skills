/**
 * What the human sees for a request, derived only from the request and its
 * seed: which version is shown as A, and the order of the answers. The page
 * gets a Ballot and nothing else, so no version name, run number or judge
 * probability reaches it.
 */
import type { CriterionRequest, FinalCheckRequest, InboxRequest } from './request.ts';

function mulberry32(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(xs: T[], rand: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export type Side = 'A' | 'B';
type Version = 'candidate' | 'baseline';

/** One shown answer and where it came from, e.g. "candidate-r2#3". Only `text` goes to the page. */
export interface Shown { text: string; ref: string }

export interface TopicKey {
  key: string;
  topic: string;
  /** The version behind each side, and its answers in the order shown. */
  sides: Record<Side, { version: Version; answers: Shown[] }>;
}

/** The key for a final-check request: per お題, which version is A and the shown order. */
export function finalCheckKey(request: FinalCheckRequest): TopicKey[] {
  const rand = mulberry32(request.seed);
  return request.topics.map((t) => {
    const pool = (version: Version): Shown[] =>
      shuffled(t[version].flatMap((run, r) => run.map((text, i) => ({ text, ref: `${version}-r${r + 1}#${i + 1}` }))), rand);
    const [a, b]: Version[] = rand() < 0.5 ? ['candidate', 'baseline'] : ['baseline', 'candidate'];
    return { key: t.key, topic: t.topic, sides: { A: { version: a, answers: pool(a) }, B: { version: b, answers: pool(b) } } };
  });
}

/** The key for a criterion request: the items in the order shown. */
export function criterionKey(request: CriterionRequest): CriterionRequest['items'] {
  return shuffled(request.items, mulberry32(request.seed));
}

export type Ballot =
  | { id: string; kind: 'final-check'; created: string; topics: { key: string; topic: string; A: string[]; B: string[] }[] }
  | { id: string; kind: 'criterion'; created: string; criterion: CriterionRequest['criterion']; items: { topic: string; answer: string }[] };

/** The blinded view of a request. */
export function ballot(request: InboxRequest): Ballot {
  if (request.kind === 'final-check') {
    return {
      id: request.id, kind: 'final-check', created: request.created,
      topics: finalCheckKey(request).map((t) => ({
        key: t.key, topic: t.topic, A: t.sides.A.answers.map((a) => a.text), B: t.sides.B.answers.map((a) => a.text),
      })),
    };
  }
  return {
    id: request.id, kind: 'criterion', created: request.created, criterion: request.criterion,
    items: criterionKey(request).map(({ topic, answer }) => ({ topic, answer })),
  };
}
