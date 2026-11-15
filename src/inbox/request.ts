/**
 * Requests waiting for a human in data/inbox/<source>/<id>.json (format and
 * flow in data/inbox/README.md). Two kinds:
 *
 *   final-check  two versions of a generator on the same お題, for a blind
 *                set-level comparison before a version is adopted.
 *   criterion    a sample of answers a criterion-count question was asked
 *                of, for the human to answer the same question.
 *
 * `seed` is added when the request enters the inbox. Which side is shown as A
 * and the order of the answers are derived from it (ballot.ts), so the key
 * exists before anyone looks at the page.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const INBOX_DIR = 'data/inbox';

interface Base {
  id: string;
  source: string;
  /** YYYY-MM-DD the request was written. */
  created: string;
  seed: number;
}

export interface FinalCheckTopic {
  key: string;
  topic: string;
  /** Each run is the answers of one generation. The baseline has exactly two. */
  candidate: string[][];
  baseline: [string[], string[]];
}

export interface FinalCheckRequest extends Base {
  kind: 'final-check';
  /** data/ledger entry (kind "change") this version tests. */
  ledger: string;
  /** What is being compared. Shown only after the human has judged. */
  description: string;
  generator: string;
  /** Revisions of the generator skill. */
  candidate: string;
  baseline: string;
  /** Result of the hard checks the agent ran before submitting (free text). */
  machine?: string;
  topics: FinalCheckTopic[];
}

export interface CriterionRequest extends Base {
  kind: 'criterion';
  ledger?: string;
  criterion: { question: string; true: string; false: string };
  /** `probability` is the judge's P(yes); the page never shows it. */
  items: { topic: string; answer: string; probability: number }[];
}

export type InboxRequest = FinalCheckRequest | CriterionRequest;

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** Checks a request as an agent wrote it (no seed yet) and returns it typed. Throws with the field that is wrong. */
export function checkRequest(raw: unknown): Omit<FinalCheckRequest, 'seed'> | Omit<CriterionRequest, 'seed'> {
  if (!isObject(raw)) throw new Error('the request must be a JSON object');
  const str = (obj: Record<string, unknown>, key: string, where: string): string => {
    if (typeof obj[key] !== 'string' || obj[key] === '') throw new Error(`${where}${key} must be a non-empty string`);
    return obj[key] as string;
  };
  const id = str(raw, 'id', '');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new Error(`id "${id}" must be lowercase letters, digits and hyphens (it becomes a file name)`);
  const created = str(raw, 'created', '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(created)) throw new Error(`created "${created}" is not YYYY-MM-DD`);
  const base = { id, source: str(raw, 'source', ''), created };

  if (raw.kind === 'final-check') {
    if (!Array.isArray(raw.topics) || !raw.topics.length) throw new Error('topics must be a non-empty array');
    const keys = new Set<string>();
    const topics = raw.topics.map((t, i): FinalCheckTopic => {
      const where = `topics[${i}].`;
      if (!isObject(t)) throw new Error(`topics[${i}] must be an object`);
      const key = str(t, 'key', where);
      if (!/^[a-z0-9][a-z0-9-]*$/.test(key)) throw new Error(`${where}key "${key}" must be lowercase letters, digits and hyphens`);
      if (keys.has(key)) throw new Error(`${where}key "${key}" is used twice`);
      keys.add(key);
      const runs = (name: string): string[][] => {
        const xs = t[name];
        const ok = Array.isArray(xs) && xs.length > 0 &&
          xs.every((run) => Array.isArray(run) && run.length > 0 && run.every((a) => typeof a === 'string' && a !== ''));
        if (!ok) throw new Error(`${where}${name} must be an array of runs, each a non-empty array of answers`);
        return xs as string[][];
      };
      const baseline = runs('baseline');
      if (baseline.length !== 2) throw new Error(`${where}baseline must hold exactly 2 runs (two independent generations of the unchanged version)`);
      return { key, topic: str(t, 'topic', where), candidate: runs('candidate'), baseline: baseline as [string[], string[]] };
    });
    return {
      ...base, kind: 'final-check', ledger: str(raw, 'ledger', ''), description: str(raw, 'description', ''),
      generator: str(raw, 'generator', ''), candidate: str(raw, 'candidate', ''), baseline: str(raw, 'baseline', ''),
      ...(typeof raw.machine === 'string' && raw.machine ? { machine: raw.machine } : {}),
      topics,
    };
  }

  if (raw.kind === 'criterion') {
    if (!isObject(raw.criterion)) throw new Error('criterion must be an object');
    const criterion = {
      question: str(raw.criterion, 'question', 'criterion.'), true: str(raw.criterion, 'true', 'criterion.'), false: str(raw.criterion, 'false', 'criterion.'),
    };
    if (!Array.isArray(raw.items) || !raw.items.length) throw new Error('items must be a non-empty array');
    const items = raw.items.map((it, i) => {
      if (!isObject(it)) throw new Error(`items[${i}] must be an object`);
      const p = it.probability;
      if (typeof p !== 'number' || !(p >= 0 && p <= 1)) throw new Error(`items[${i}].probability must be a number from 0 to 1`);
      return { topic: str(it, 'topic', `items[${i}].`), answer: str(it, 'answer', `items[${i}].`), probability: p };
    });
    return { ...base, kind: 'criterion', ...(typeof raw.ledger === 'string' && raw.ledger ? { ledger: raw.ledger } : {}), criterion, items };
  }

  throw new Error(`kind "${String(raw.kind)}" is not "final-check" or "criterion"`);
}

export const requestPath = (dir: string, source: string, id: string): string => join(dir, source, `${id}.json`);

/** Requests waiting in the inbox, oldest first. */
export function loadPending(dir = INBOX_DIR): InboxRequest[] {
  if (!existsSync(dir)) return [];
  const out: InboxRequest[] = [];
  for (const source of readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
    for (const file of readdirSync(join(dir, source)).filter((f) => f.endsWith('.json')).sort()) {
      const raw = JSON.parse(readFileSync(join(dir, source, file), 'utf8')) as { seed?: unknown };
      const checked = checkRequest(raw);
      if (typeof raw.seed !== 'number') throw new Error(`${join(dir, source, file)}: no seed — add requests with \`npm run inbox:add\`, not by copying files`);
      out.push({ ...checked, seed: raw.seed } as InboxRequest);
    }
  }
  return out.sort((a, b) => a.created.localeCompare(b.created) || a.id.localeCompare(b.id));
}

/** Stores a checked request with its seed. Refuses an id that is already waiting. */
export function storeRequest(request: InboxRequest, dir = INBOX_DIR): string {
  const path = requestPath(dir, request.source, request.id);
  if (existsSync(path)) throw new Error(`${path} already exists — pick another id`);
  mkdirSync(join(dir, request.source), { recursive: true });
  writeFileSync(path, `${JSON.stringify(request, null, 2)}\n`);
  return path;
}
