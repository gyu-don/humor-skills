/**
 * Runs the real judge scripts end to end against a fake SDK (test/fake-sdk),
 * so no API key or network is needed. Guards the bug where an array of sets
 * without ids merged every set into one summary.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const work = mkdtempSync(join(tmpdir(), 'humor-skills-test-'));
const write = (name: string, data: unknown): string => {
  const path = join(work, name);
  writeFileSync(path, JSON.stringify(data));
  return path;
};

function run(script: string, input: string): any {
  const out = join(work, `${script.replaceAll('/', '-')}.out.json`);
  execFileSync('node', ['--import', './test/fake-sdk/register.ts', script, input, out], {
    env: { ...process.env, TYPESAFE_API_KEY: 'test' },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  return JSON.parse(readFileSync(out, 'utf8'));
}

// Two id-less sets with different answers, as ogiri-ai passed them.
const twoSets = write('two-sets.json', [
  { topic: 'お題A', answers: ['りんご', 'みかん', 'ぶどう', 'もも', 'なし'] },
  { topic: 'お題B', answers: ['電車', 'バス', '船', '飛行機', '自転車'] },
]);

const withoutIds = ({ id, label, ...rest }: Record<string, unknown>) => rest;

for (const script of [
  'skills/overlap-check/scripts/evaluate.ts',
  'skills/trait-check/scripts/evaluate.ts',
  'research/funniness-score/scripts/evaluate.ts',
  'research/risk-flags/scripts/evaluate.ts',
  'research/cluster-fit-check/scripts/evaluate.ts',
]) {
  test(`${script}: id-less sets stay separate`, () => {
    const out = run(script, twoSets);
    const rows: { sampleId: string }[] = out.rows ?? out.overlaps;
    assert.deepEqual([...new Set(rows.map((r) => r.sampleId))], ['set-1', 'set-2']);
    if (out.summaries) {
      assert.deepEqual(out.summaries.map((s: { id: string }) => s.id), ['set-1', 'set-2']);
      assert.notDeepEqual(withoutIds(out.summaries[0]), withoutIds(out.summaries[1]), 'both sets got the same summary');
    }
  });
}

test('trait-check evaluate: each summary is the mean of its own rows', () => {
  const out = run('skills/trait-check/scripts/evaluate.ts', twoSets);
  for (const s of out.summaries) {
    const own = out.rows.filter((r: { sampleId: string }) => r.sampleId === s.id);
    assert.equal(own.length, 5);
    const mean = own.reduce((a: number, r: { traits: { concrete: number } }) => a + r.traits.concrete, 0) / own.length;
    assert.ok(Math.abs(s.means.concrete - mean) < 1e-12);
  }
});

test('overlap-check: each summary lists only its own flagged pairs', () => {
  const out = run('skills/overlap-check/scripts/evaluate.ts', twoSets);
  for (const s of out.summaries) {
    const own = out.overlaps.filter((o: { sampleId: string; nearDuplicate: boolean }) => o.sampleId === s.id && o.nearDuplicate);
    assert.deepEqual(s.nearDuplicates, own.map((o: { a: number; b: number }) => [o.a, o.b]));
  }
});

test('duplicate ids stop the script with a message', () => {
  const dup = write('dup.json', [
    { id: 'x', topic: 't', answers: ['a'] },
    { id: 'x', topic: 't', answers: ['b'] },
  ]);
  assert.throws(() => run('skills/trait-check/scripts/evaluate.ts', dup), (e: { stderr: Buffer }) => /duplicate id "x"/.test(String(e.stderr)));
});

test('trait-check compare: id-less pairs are numbered', () => {
  const pairs = write('pairs.json', [
    { topic: 't', answerA: 'a', answerB: 'b' },
    { topic: 't', answerA: 'c', answerB: 'd' },
  ]);
  const out = run('skills/trait-check/scripts/compare.ts', pairs);
  assert.deepEqual(out.results.map((r: { id: string }) => r.id), ['set-1', 'set-2']);
});
