import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { answerSet, gateRuns, labelInputs } from '../skills/trait-check/scripts/input.ts';

const set = (topic: string, ...answers: string[]) => ({ topic, answers });

test('a lone object becomes id "input"', () => {
  assert.deepEqual(labelInputs(set('t', 'a'), answerSet), [{ topic: 't', answers: ['a'], id: 'input', label: 'input' }]);
});

test('array items without id are numbered set-<n>, and label defaults to the id', () => {
  const out = labelInputs([set('t', 'a'), { ...set('t', 'b'), label: 'second' }], answerSet);
  assert.deepEqual(out.map((s) => [s.id, s.label]), [['set-1', 'set-1'], ['set-2', 'second']]);
});

test('explicit ids are kept', () => {
  const out = labelInputs([{ id: 'x', ...set('t', 'a') }, set('t', 'b')], answerSet);
  assert.deepEqual(out.map((s) => s.id), ['x', 'set-2']);
});

test('duplicate ids are rejected, including an explicit id equal to a generated one', () => {
  assert.throws(() => labelInputs([{ id: 'x', ...set('t', 'a') }, { id: 'x', ...set('t', 'b') }], answerSet), /duplicate id "x"/);
  assert.throws(() => labelInputs([set('t', 'a'), { id: 'set-1', ...set('t', 'b') }], answerSet), /duplicate id "set-1"/);
});

test('malformed items fail with their position', () => {
  assert.throws(() => labelInputs([set('t', 'a'), { topic: 't' }], answerSet), /input\[1\]\.answers/);
  assert.throws(() => labelInputs([{ answers: ['a'] }], answerSet), /input\[0\]\.topic/);
  assert.throws(() => labelInputs([{ id: 3, ...set('t', 'a') }], answerSet), /input\[0\]\.id/);
  assert.throws(() => labelInputs([], answerSet), /empty array/);
});

test('gate input needs exactly two baseline runs', () => {
  const ok = { topic: 't', baseline: [['a'], ['b']], candidate: [['c'], ['d']] };
  assert.deepEqual(labelInputs(ok, gateRuns)[0].baseline, [['a'], ['b']]);
  assert.throws(() => labelInputs({ ...ok, baseline: [['a']] }, gateRuns), /exactly 2 runs/);
  assert.throws(() => labelInputs({ ...ok, candidate: [['c'], []] }, gateRuns), /candidate/);
});

test('every judge keeps an identical copy of input.ts', () => {
  const copies = [
    'skills/overlap-check/scripts/input.ts',
    'research/funniness-score/scripts/input.ts',
    'research/risk-flags/scripts/input.ts',
    'research/cluster-fit-check/scripts/input.ts',
  ];
  const original = readFileSync('skills/trait-check/scripts/input.ts', 'utf8');
  for (const path of copies) assert.equal(readFileSync(path, 'utf8'), original, `${path} differs from skills/trait-check/scripts/input.ts`);
});
