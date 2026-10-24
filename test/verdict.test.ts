import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compareVerdict, tally, traitVerdict } from '../skills/trait-check/scripts/verdict.ts';

test('a drop no larger than the baseline run gap is noise', () => {
  // baseline runs .80 and .76 (gap .04, pooled .78); candidate .75 is .03 worse.
  const v = traitVerdict([0.8, 0.8], [0.76, 0.76], [0.75, 0.75], false);
  assert.ok(Math.abs(v.noise - 0.04) < 1e-9);
  assert.ok(Math.abs(v.worsening - 0.03) < 1e-9);
  assert.equal(v.regressed, false);
  assert.equal(traitVerdict([0.8], [0.76], [0.7], false).regressed, true);
});

test('indirect counts a rise as worse', () => {
  assert.equal(traitVerdict([0.1], [0.11], [0.2], true).regressed, true);
  assert.equal(traitVerdict([0.1], [0.11], [0.0], true).regressed, false);
});

test('compare regresses only when 0.5 − mean probA exceeds the baseline band', () => {
  const pairs = (...ps: number[]) => tally(ps.map((probA) => ({ probA, winner: probA > 0.55 ? 'A' as const : probA < 0.45 ? 'B' as const : 'draw' as const })));
  // 2026-11-08 Codex: candidate .491, baseline r1 vs r2 .442 (band .058) → noise.
  assert.equal(compareVerdict(pairs(0.491), pairs(0.442)).regressed, false);
  // haiku: candidate .475, band .008 → regressed.
  assert.equal(compareVerdict(pairs(0.475), pairs(0.508)).regressed, true);
  // a candidate above 0.5 never regresses
  assert.equal(compareVerdict(pairs(0.6), pairs(0.5)).regressed, false);
});

test('tally counts wins, losses, draws and the draw-excluded win rate', () => {
  const t = tally([{ probA: 0.9, winner: 'A' }, { probA: 0.2, winner: 'B' }, { probA: 0.5, winner: 'draw' }, { probA: 0.7, winner: 'A' }]);
  assert.deepEqual([t.winsA, t.winsB, t.draws], [2, 1, 1]);
  assert.ok(Math.abs(t.drawExcludedWinRate! - 2 / 3) < 1e-9);
  assert.ok(Math.abs(t.probA - 0.575) < 1e-9);
  assert.equal(tally([{ probA: 0.5, winner: 'draw' }]).drawExcludedWinRate, null);
});
