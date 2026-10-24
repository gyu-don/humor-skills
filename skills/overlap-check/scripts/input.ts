/**
 * Input loading shared by the judge scripts. Each skill directory keeps its
 * own verbatim copy so it stays self-contained when installed;
 * test/input.test.ts fails if the copies drift apart.
 *
 * A script accepts one object or an array of them. Outputs are keyed by
 * `id`, so ids must be unique: an array item without `id` gets
 * `set-<position>` (1-based), a lone object gets `input`, and `label`
 * defaults to the id. A duplicate id is an error — before this, id-less
 * arrays all shared `undefined` and every set's summary silently became
 * the summary of all sets together.
 */
import { readFileSync } from 'node:fs';

export type Labeled<T> = T & { id: string; label: string };
type Check<T> = (item: Record<string, unknown>, where: string) => T;

export function labelInputs<T extends object>(parsed: unknown, check: Check<T>): Labeled<T>[] {
  const single = !Array.isArray(parsed);
  const items: unknown[] = single ? [parsed] : parsed;
  if (!items.length) throw new Error('input is an empty array');
  const seen = new Set<string>();
  return items.map((raw, i) => {
    const where = single ? 'input' : `input[${i}]`;
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Error(`${where} must be an object`);
    const item = raw as Record<string, unknown>;
    if (item.id !== undefined && (typeof item.id !== 'string' || item.id === '')) {
      throw new Error(`${where}.id must be a non-empty string`);
    }
    const id = (item.id as string | undefined) ?? (single ? 'input' : `set-${i + 1}`);
    if (seen.has(id)) throw new Error(`${where}: duplicate id "${id}" — give every item a unique id, or omit ids to number them`);
    seen.add(id);
    const label = typeof item.label === 'string' ? item.label : id;
    return { ...check(item, where), id, label };
  });
}

const str = (item: Record<string, unknown>, key: string, where: string): string => {
  if (typeof item[key] !== 'string' || item[key] === '') throw new Error(`${where}.${key} must be a non-empty string`);
  return item[key] as string;
};

const strings = (item: Record<string, unknown>, key: string, where: string): string[] => {
  const xs = item[key];
  if (!Array.isArray(xs) || !xs.length || xs.some((x) => typeof x !== 'string')) {
    throw new Error(`${where}.${key} must be a non-empty array of strings`);
  }
  return xs as string[];
};

/** `{ topic, answers }` — one set of answers to one お題. */
export const answerSet: Check<{ topic: string; answers: string[] }> = (item, where) => ({
  topic: str(item, 'topic', where),
  answers: strings(item, 'answers', where),
});

/** `{ topic, answerA, answerB }` — two answers to compare. */
export const answerPair: Check<{ topic: string; answerA: string; answerB: string }> = (item, where) => ({
  topic: str(item, 'topic', where),
  answerA: str(item, 'answerA', where),
  answerB: str(item, 'answerB', where),
});

/** `{ topic, baseline: [run1, run2], candidate: [run, ...] }` — each run is one generation's answers. */
export const gateRuns: Check<{ topic: string; baseline: [string[], string[]]; candidate: string[][] }> = (item, where) => {
  const runs = (key: string): string[][] => {
    const xs = item[key];
    if (!Array.isArray(xs) || !xs.length) throw new Error(`${where}.${key} must be an array of runs (arrays of answers)`);
    return xs.map((_, i) => strings(xs as unknown as Record<string, unknown>, String(i), `${where}.${key}`));
  };
  const baseline = runs('baseline');
  if (baseline.length !== 2) throw new Error(`${where}.baseline must hold exactly 2 runs (the noise band is run 1 vs run 2)`);
  return { topic: str(item, 'topic', where), baseline: baseline as [string[], string[]], candidate: runs('candidate') };
};

/** Reads and checks the input file, or exits with the reason. */
export function readInputs<T extends object>(path: string, check: Check<T>): Labeled<T>[] {
  try {
    return labelInputs(JSON.parse(readFileSync(path, 'utf8')), check);
  } catch (error) {
    console.error(`invalid input ${path}: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
