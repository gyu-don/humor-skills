/** gate.ts end to end against the fake SDK (see scripts.test.ts). */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const work = mkdtempSync(join(tmpdir(), 'humor-skills-gate-'));

function run(input: unknown): any {
  const inPath = join(work, 'in.json');
  const out = join(work, 'out.json');
  writeFileSync(inPath, JSON.stringify(input));
  execFileSync('node', ['--import', './test/fake-sdk/register.ts', 'skills/trait-check/scripts/gate.ts', inPath, out], {
    env: { ...process.env, TYPESAFE_API_KEY: 'test' },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  return JSON.parse(readFileSync(out, 'utf8'));
}

test('trait-check gate: noise band from the baseline runs, candidate pooled', () => {
  const [r] = run({
    topic: 'お題A',
    baseline: [['b1', 'b2', 'b3'], ['b4', 'b5', 'b6']],
    candidate: [['c1', 'c2'], ['c3', 'c4']],
  }).results;
  assert.equal(r.id, 'input');
  assert.equal(r.compare.baselineRun1VsRun2.winsA + r.compare.baselineRun1VsRun2.winsB + r.compare.baselineRun1VsRun2.draws, 9);
  assert.equal(r.compare.candidateVsBaseline.winsA + r.compare.candidateVsBaseline.winsB + r.compare.candidateVsBaseline.draws, 24);
  assert.equal(r.answers.length, 10);
  for (const k of ['concrete', 'indirect', 'compare']) {
    assert.equal(r[k].regressed, r[k].worsening > r[k].noise);
    assert.equal(r.regressed.includes(k), r[k].regressed);
  }
});
