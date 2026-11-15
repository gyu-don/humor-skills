/**
 * Loads data/ledger/<source>.json (schema and rules in data/ledger/README.md)
 * and checks every reference against the human labels, so a typo in a set ID
 * fails here instead of showing up as "not judged" on the status page.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Labels } from '../validation/labels.ts';

export const LEDGER_DIR = 'data/ledger';

export type Status = 'supported' | 'refuted' | 'open';

export interface Comparison {
  /** Global set IDs ("<date>/<set id>") in data/human-evals. */
  candidate: string;
  baseline: string;
}

interface Base {
  id: string;
  date: string;
  hypothesis: string;
  status: Status;
  note: string;
  sources: string[];
}

/** A change to the generation skill and the sets that tested it. */
export interface ChangeEntry extends Base {
  kind: 'change';
  change: string;
  comparisons: Comparison[];
  decision: string;
}

/** A claim about what this rater finds funny, optionally turned into a judge question. */
export interface TasteEntry extends Base {
  kind: 'taste';
  judge?: { evaluator: string; metric: string };
}

export type Entry = ChangeEntry | TasteEntry;

const STATUSES: Status[] = ['supported', 'refuted', 'open'];

export function loadLedger(labels: Labels, source = 'ogiri-ai', dir = LEDGER_DIR): Entry[] {
  const path = join(dir, `${source}.json`);
  const { entries } = JSON.parse(readFileSync(path, 'utf8')) as { entries: Entry[] };
  const setIds = new Set(labels.sets.map((s) => s.id));
  const seen = new Set<string>();

  for (const e of entries) {
    const fail = (msg: string): never => {
      throw new Error(`${path}: entry "${e.id}": ${msg}`);
    };
    if (seen.has(e.id)) fail('duplicate id');
    seen.add(e.id);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) fail(`date "${e.date}" is not YYYY-MM-DD`);
    if (!STATUSES.includes(e.status)) fail(`status "${e.status}" is not one of ${STATUSES.join(' / ')}`);
    for (const key of ['hypothesis', 'note'] as const) if (!e[key]) fail(`${key} is empty`);
    if (!e.sources?.length) fail('sources is empty');
    if (e.kind === 'change') {
      if (!e.change || !e.decision) fail('a change entry needs "change" and "decision"');
      for (const c of e.comparisons) {
        for (const id of [c.candidate, c.baseline]) if (!setIds.has(id)) fail(`comparison refers to unknown set ${id}`);
      }
    } else if (e.kind !== 'taste') {
      fail(`kind "${(e as { kind: string }).kind}" is not "change" or "taste"`);
    }
  }
  return entries;
}

export type Verdict = 'win' | 'tie' | 'loss';

export interface ComparisonResult extends Comparison {
  /** The human's set-level verdict for the candidate; undefined when the two sets were not compared as sets. */
  verdict?: Verdict;
  blind: boolean;
  /** Answers the human singled out in each set; undefined when the session has no answer-level judgments. */
  hits?: { candidate: number; baseline: number };
}

/** Looks one candidate/baseline pair up in the human labels. */
export function judge(labels: Labels, c: Comparison): ComparisonResult {
  const same = (a: string, b: string): boolean => (a === c.candidate && b === c.baseline) || (a === c.baseline && b === c.candidate);
  const pref = labels.setPreferences.find((p) => same(p.better, p.worse));
  const tie = labels.setTies.find((p) => same(p.a, p.b));
  const set = (id: string) => labels.sets.find((s) => s.id === id)!;
  const hitCount = (id: string): number | undefined => {
    const answers = set(id).answers;
    return answers.some((a) => a.hit === null) ? undefined : answers.filter((a) => a.hit).length;
  };
  const [candidate, baseline] = [hitCount(c.candidate), hitCount(c.baseline)];
  return {
    ...c,
    verdict: pref ? (pref.better === c.candidate ? 'win' : 'loss') : tie ? 'tie' : undefined,
    blind: (pref ?? tie)?.blind ?? set(c.candidate).blind,
    hits: candidate === undefined || baseline === undefined ? undefined : { candidate, baseline },
  };
}
