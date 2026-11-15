/** trait-check's version reading: the permutation rule (verdict.ts) and versions.ts end to end against the fake SDK. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { ALPHA, shift } from '../skills/trait-check/scripts/verdict.ts';

const spread = (centre: number, n = 10): number[] => Array.from({ length: n }, (_, i) => centre + (i - (n - 1) / 2) * 0.01);

test('a clear drop is flagged, the same values are not', () => {
  const worse = shift([{ candidate: spread(0.5), baseline: spread(0.8) }], false);
  assert.ok(Math.abs(worse.worsening - 0.3) < 1e-9);
  assert.ok(worse.p < 0.001 && worse.flagged);

  const same = shift([{ candidate: spread(0.8), baseline: spread(0.8) }], false);
  assert.ok(Math.abs(same.worsening) < 1e-9);
  assert.ok(same.p > 0.5 && !same.flagged);
});

test('a better candidate is never flagged, and indirect counts a rise as worse', () => {
  assert.ok(shift([{ candidate: spread(0.9), baseline: spread(0.8) }], false).p > 1 - ALPHA);
  const rose = shift([{ candidate: spread(0.3), baseline: spread(0.1) }], true);
  assert.ok(rose.worsening > 0 && rose.flagged);
  assert.ok(!shift([{ candidate: spread(0.1), baseline: spread(0.3) }], true).flagged);
});

test('a small drop repeated on every お題 shows only when the お題 are read together', () => {
  // Wide spread within each お題, the candidate lower by .04 on each of six.
  const noisy = (centre: number): number[] => [-0.2, -0.12, -0.05, 0, 0.03, 0.08, 0.1, 0.16].map((d) => centre + d);
  const topic = { candidate: noisy(0.66), baseline: noisy(0.7) };
  const alone = shift([topic], false);
  const together = shift(Array.from({ length: 6 }, () => topic), false);
  assert.ok(Math.abs(alone.worsening - together.worsening) < 1e-9);
  assert.ok(!alone.flagged, `one お題: p ${alone.p}`);
  assert.ok(together.p < alone.p, `six お題: p ${together.p}`);
});

test('the same input always gives the same p, and never 0', () => {
  const t = [{ candidate: [0.2, 0.9, 0.4], baseline: [0.5, 0.6, 0.1, 0.8] }];
  assert.equal(shift(t, false).p, shift(t, false).p);
  assert.ok(shift([{ candidate: [0], baseline: [1, 1, 1] }], false).p > 0);
  assert.throws(() => shift([], false), /at least one/);
  assert.throws(() => shift([{ candidate: [], baseline: [1] }], false), /at least one/);
});

test('versions.ts: one reading over all お題, one per お題, every answer kept', () => {
  const work = mkdtempSync(join(tmpdir(), 'humor-skills-versions-'));
  const [inPath, out] = [join(work, 'in.json'), join(work, 'out.json')];
  writeFileSync(inPath, JSON.stringify([
    { topic: 'お題A', baseline: [['b1', 'b2', 'b3'], ['b4', 'b5', 'b6']], candidate: [['c1', 'c2'], ['c3', 'c4']] },
    { id: 'second', topic: 'お題B', baseline: [['x1', 'x2'], ['x3', 'x4']], candidate: [['y1', 'y2', 'y3']] },
  ]));
  execFileSync('node', ['--import', './test/fake-sdk/register.ts', 'skills/trait-check/scripts/versions.ts', inPath, out], {
    env: { ...process.env, TYPESAFE_API_KEY: 'test' },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  const { alpha, overall, results } = JSON.parse(readFileSync(out, 'utf8'));
  assert.equal(alpha, ALPHA);
  assert.equal(overall.topics, 2);
  assert.deepEqual(results.map((r: any) => [r.id, r.answers.length]), [['set-1', 10], ['second', 7]]);
  for (const reading of [overall, ...results]) {
    for (const k of ['concrete', 'indirect']) {
      assert.equal(reading[k].flagged, reading[k].p < ALPHA);
      assert.equal(reading.flagged.includes(k), reading[k].flagged);
    }
  }
  // Only candidate answers are named as repair candidates, each at or above the threshold.
  for (const r of results) {
    for (const a of r.explanatory) assert.ok(a.ref.startsWith('candidate-') && a.indirect >= 0.2);
  }
  assert.ok(results[0].answers.some((a: any) => a.ref === 'baseline-r2#3') && results[0].answers.some((a: any) => a.ref === 'candidate-r2#2'));
});
