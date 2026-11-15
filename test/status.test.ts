/**
 * The status page and the hypothesis ledger against the real data in this
 * repo: no API, no fixtures. These fail when a human-eval session, the ledger
 * or a validation changes without `npm run status`, and when the ledger
 * breaks its own rules (data/ledger/README.md).
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { judge, loadLedger } from '../src/status/ledger.ts';
import { loadLabels } from '../src/validation/labels.ts';
import { binomTail, wilson } from '../src/validation/stats.ts';

const labels = loadLabels();

test('STATUS.md is what `npm run status` writes from the current data', () => {
  const out = join(mkdtempSync(join(tmpdir(), 'humor-skills-status-')), 'STATUS.md');
  execFileSync('node', ['src/status/status.ts', out], { stdio: ['ignore', 'ignore', 'pipe'] });
  assert.equal(readFileSync('STATUS.md', 'utf8'), readFileSync(out, 'utf8'), 'STATUS.md is out of date: run `npm run status`');
});

test('every ledger entry refers to sets that exist, and verdicts come from the labels', () => {
  const ledger = loadLedger(labels);
  assert.ok(ledger.length > 0);
  const verdict = (candidate: string, baseline: string) => judge(labels, { candidate, baseline });

  // 2026-07-11: the skill lost to the bare model on this topic (not blind).
  const lost = verdict('2026-07-11/firsttake/fable-5-skill-on', '2026-07-11/firsttake/fable-5-skill-off');
  assert.deepEqual([lost.verdict, lost.blind, lost.hits], ['loss', false, { candidate: 0, baseline: 3 }]);
  // 2026-11-08: blind set-level win, no answer-level judgments.
  const won = verdict('2026-11-08/sylvanian/candidate', '2026-11-08/sylvanian/baseline');
  assert.deepEqual([won.verdict, won.blind, won.hits], ['win', true, undefined]);
  // A tie is a verdict; a pair nobody compared as sets has none.
  assert.equal(verdict('2026-11-09/target/candidate', '2026-11-09/target/baseline').verdict, 'tie');
  assert.equal(verdict('2026-10-03/codex/round2-variation-2-r1', '2026-10-03/codex/round2-baseline-r1').verdict, undefined);
});

test('the ledger carries no answer text (Example Firewall)', () => {
  // Short answers ("お手") would match ordinary prose, so only answers long enough to be distinctive count.
  const answers = [...labels.answers.values()].map((a) => a.text).filter((t) => [...t].length >= 6);
  for (const e of loadLedger(labels)) {
    const prose = [e.hypothesis, e.note, e.kind === 'change' ? `${e.change} ${e.decision}` : ''].join(' ');
    const leaked = answers.find((t) => prose.includes(t));
    assert.equal(leaked, undefined, `ledger entry "${e.id}" quotes the answer 「${leaked}」`);
  }
});

test('wilson interval and binomial tail', () => {
  const [lo, hi] = wilson(7 / 9, 9);
  assert.ok(lo > 0.44 && lo < 0.46 && hi > 0.93 && hi < 0.95, `${lo}, ${hi}`);
  assert.deepEqual(wilson(0.5, 0).map(Number.isNaN), [true, true]);
  // 8 or more of 9 at p = 0.7, and 15 or more of 20: the two `gate` thresholds.
  assert.ok(Math.abs(binomTail(9, 8, 0.7) - 0.196) < 0.001);
  assert.ok(Math.abs(binomTail(20, 15, 0.7) - 0.416) < 0.001);
  assert.ok(Math.abs(binomTail(5, 0, 0.3) - 1) < 1e-9);
});
