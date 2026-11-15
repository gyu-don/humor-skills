/** The inbox: request checks, blinding, the conversion to a human-eval session, and the server end to end on temp dirs. */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { ballot, finalCheckKey } from '../src/inbox/ballot.ts';
import { checkRequest, loadPending, storeRequest, type CriterionRequest, type FinalCheckRequest } from '../src/inbox/request.ts';
import { inboxServer } from '../src/inbox/serve.ts';
import { criterionSession, finalCheckSession, writeSession, type FinalCheckAnswer } from '../src/inbox/session.ts';
import { sample } from '../src/inbox/spot-check.ts';
import { loadLabels } from '../src/validation/labels.ts';

const run = (prefix: string, n = 5): string[] => Array.from({ length: n }, (_, i) => `${prefix}の回答${i + 1}`);
const topic = (key: string) => ({
  key, topic: `お題 ${key}`,
  candidate: [run(`${key}新1`), run(`${key}新2`)],
  baseline: [run(`${key}旧1`), run(`${key}旧2`)],
});
const raw = {
  id: 'trial', kind: 'final-check', source: 'gen', created: '2026-11-16', ledger: 'some-change',
  description: '説明文', generator: 'model-x / high', candidate: 'rev-NEW', baseline: 'rev-OLD',
  topics: [topic('one'), topic('two'), topic('three')],
};
const request = (seed = 7): FinalCheckRequest => ({ ...checkRequest(raw), seed } as FinalCheckRequest);
const criterion: CriterionRequest = {
  ...(checkRequest({
    id: 'question-1', kind: 'criterion', source: 'gen', created: '2026-11-16',
    criterion: { question: '質問？', true: 'はいの意味', false: 'いいえの意味' },
    items: [
      { topic: 'お題X', answer: 'あ', probability: 0.9 }, { topic: 'お題X', answer: 'い', probability: 0.1 },
      { topic: 'お題Y', answer: 'う', probability: 0.6 }, { topic: 'お題Y', answer: 'え', probability: 0.2 },
    ],
  }) as Omit<CriterionRequest, 'seed'>),
  seed: 3,
};

/** Answers every お題 by naming the version the "human" prefers; the test knows the key, the page does not. */
function answerFor(req: FinalCheckRequest, prefer: Record<string, 'candidate' | 'baseline' | 'tie' | 'skip'>): FinalCheckAnswer {
  return {
    id: req.id, kind: 'final-check',
    topics: Object.fromEntries(finalCheckKey(req).map((t) => {
      const want = prefer[t.key];
      const choice = want === 'tie' || want === 'skip' ? want : t.sides.A.version === want ? 'A' : 'B';
      return [t.key, { choice }];
    })),
  };
}

test('a request is checked field by field', () => {
  assert.equal(checkRequest(raw).kind, 'final-check');
  assert.throws(() => checkRequest({ ...raw, id: 'Trial 1' }), /lowercase letters, digits and hyphens/);
  assert.throws(() => checkRequest({ ...raw, ledger: '' }), /ledger must be a non-empty string/);
  assert.throws(() => checkRequest({ ...raw, topics: [{ ...topic('one'), baseline: [run('x')] }] }), /exactly 2 runs/);
  assert.throws(() => checkRequest({ ...raw, topics: [topic('one'), topic('one')] }), /used twice/);
  assert.throws(() => checkRequest({ ...raw, kind: 'poll' }), /not "final-check" or "criterion"/);
  assert.throws(() => checkRequest({ ...criterion, items: [{ topic: 't', answer: 'a', probability: 1.2 }] }), /from 0 to 1/);
});

test('the ballot shows every answer and nothing that tells the versions apart', () => {
  const req = request();
  const b = ballot(req);
  assert.equal(b.kind, 'final-check');
  const text = JSON.stringify(b);
  for (const secret of ['candidate', 'baseline', 'rev-NEW', 'rev-OLD', 'model-x', '説明文', 'some-change', '-r1#']) {
    assert.ok(!text.includes(secret), `the ballot leaks "${secret}"`);
  }
  if (b.kind !== 'final-check') return;
  for (const [i, t] of b.topics.entries()) {
    const all = [...raw.topics[i].candidate.flat(), ...raw.topics[i].baseline.flat()].sort();
    assert.deepEqual([...t.A, ...t.B].sort(), all);
    assert.equal(t.A.length, 10);
  }
  // The same seed gives the same ballot; over many seeds the candidate is on either side.
  assert.deepEqual(ballot(request()), b);
  const sides = new Set(Array.from({ length: 30 }, (_, seed) => finalCheckKey(request(seed))[0].sides.A.version));
  assert.deepEqual([...sides].sort(), ['baseline', 'candidate']);
  assert.ok(!JSON.stringify(ballot(criterion)).includes('probability'));
});

test('a final check becomes a session the validation scripts read as a version comparison', () => {
  const req = request();
  const key = finalCheckKey(req);
  const answer = answerFor(req, { one: 'candidate', two: 'tie', three: 'baseline' });
  // On お題 one, mark the first answer shown on each side: A good, B bad.
  answer.topics.one.good = ['A1'];
  answer.topics.one.bad = ['B1'];
  answer.topics.two.comment = 'どちらも弱い';

  const result = finalCheckSession(req, answer, { date: '2026-11-20', rater: 'tester' });
  assert.deepEqual(result.tally, { win: 1, tie: 1, loss: 1, skipped: 0 });
  assert.equal(result.rule, 'return');
  assert.equal(result.base, '2026-11-20-trial');
  assert.ok(result.md.includes('台帳に戻す') && result.md.includes('どちらも弱い'));

  const dir = mkdtempSync(join(tmpdir(), 'humor-skills-inbox-'));
  mkdirSync(join(dir, 'gen'));
  writeSession(dir, 'gen', result);
  assert.throws(() => writeSession(dir, 'gen', result), /already exists/);

  const labels = loadLabels('gen', dir);
  assert.deepEqual(labels.gates.map((g) => [g.id, g.human, g.group, g.blind]), [
    ['2026-11-20/trial/one', 'candidate', 'trial', true], ['2026-11-20/trial/two', 'tie', 'trial', true], ['2026-11-20/trial/three', 'baseline', 'trial', true],
  ]);
  assert.deepEqual(labels.versions.map((v) => [v.id, v.wins, v.ties, v.losses, v.rule]), [['trial', 1, 1, 1, 'return']]);
  // The runs come back in generation order whatever order they were shown in.
  assert.deepEqual(labels.gates[0].candidate, raw.topics[0].candidate);
  assert.deepEqual(labels.gates[0].baseline, raw.topics[0].baseline);

  // Marks: the answer shown first on A is a hit, the one shown first on B a miss, the rest of that お題 unknown.
  const hit = (text: string): boolean | null | undefined => [...labels.answers.values()].find((a) => a.text === text)?.hit;
  assert.equal(hit(key[0].sides.A.answers[0].text), true);
  assert.equal(hit(key[0].sides.B.answers[0].text), false);
  assert.equal(hit(key[0].sides.A.answers[1].text), null);
  // No marks on お題 two: no answer-level judgment at all.
  assert.equal(hit(key[1].sides.A.answers[0].text), null);
  assert.equal(labels.sessions[0].request?.ledger, 'some-change');
});

test('two final checks judged on one day with the same お題 keys stay apart', () => {
  const other = { ...request(), id: 'trial-2' };
  const meta = { date: '2026-11-20', rater: 'tester' };
  const first = finalCheckSession(request(), answerFor(request(), { one: 'candidate', two: 'tie', three: 'tie' }), meta);
  const second = finalCheckSession(other, answerFor(other, { one: 'baseline', two: 'tie', three: 'tie' }), meta);
  assert.notDeepEqual(first.comparisons, second.comparisons);

  const dir = mkdtempSync(join(tmpdir(), 'humor-skills-inbox-'));
  mkdirSync(join(dir, 'gen'));
  writeSession(dir, 'gen', first);
  writeSession(dir, 'gen', second);
  const labels = loadLabels('gen', dir);
  assert.equal(labels.sets.length, 12);
  assert.equal(new Set(labels.gates.map((g) => g.id)).size, 6);
  assert.deepEqual(labels.versions.map((v) => [v.id, v.wins, v.losses]).sort(), [['trial', 1, 0], ['trial-2', 0, 1]]);

  // A hand-written session that reuses a set id on the same date is refused rather than merged.
  const clash = { ...second.json, request: undefined, sets: (second.json.sets as { id: string }[]).map((x) => ({ ...x, id: x.id.replace('trial-2/', 'trial/') })) };
  writeFileSync(join(dir, 'gen', '2026-11-20-clash.json'), JSON.stringify({ ...clash, setPreferences: [], setTies: [] }));
  assert.throws(() => loadLabels('gen', dir), /set 2026-11-20\/trial\/one\/(candidate|baseline) is in both/);
});

test('no loss is adoptable; an all-skip answer has no rule; a bad answer is refused', () => {
  const req = request();
  const date = { date: '2026-11-20', rater: 'tester' };
  assert.equal(finalCheckSession(req, answerFor(req, { one: 'candidate', two: 'tie', three: 'skip' }), date).rule, 'adoptable');
  const skipped = finalCheckSession(req, answerFor(req, { one: 'skip', two: 'skip', three: 'skip' }), date);
  assert.equal(skipped.rule, undefined);
  assert.equal((skipped.json.setPreferences as unknown[]).length + (skipped.json.setTies as unknown[]).length, 0);

  const bad = answerFor(req, { one: 'candidate', two: 'tie', three: 'tie' });
  delete bad.topics.two;
  assert.throws(() => finalCheckSession(req, bad, date), /お題 "two": no choice/);
  const marked = answerFor(req, { one: 'candidate', two: 'tie', three: 'tie' });
  marked.topics.one.good = ['A11'];
  assert.throws(() => finalCheckSession(req, marked, date), /"A11" is not an answer shown/);
});

test('a criterion spot check records the human labels next to the judge probability', () => {
  const shown = ballot(criterion);
  assert.equal(shown.kind, 'criterion');
  if (shown.kind !== 'criterion') return;
  // The human says yes only to あ; the judge said yes to あ (0.9) and う (0.6).
  const labels = shown.items.map((it) => (it.answer === 'あ' ? 'yes' : it.answer === 'え' ? 'unsure' : 'no'));
  const result = criterionSession(criterion, { id: criterion.id, kind: 'criterion', labels }, { date: '2026-11-20', rater: 'tester' });
  assert.deepEqual(result.agreement, { agree: 2, judged: 3, unsure: 1 });

  const dir = mkdtempSync(join(tmpdir(), 'humor-skills-inbox-'));
  mkdirSync(join(dir, 'gen'));
  writeSession(dir, 'gen', result);
  const loaded = loadLabels('gen', dir);
  assert.equal(loaded.traitJudgments.length, 4);
  const u = loaded.traitJudgments.find((t) => loaded.answers.get(t.answer)?.text === 'う')!;
  assert.deepEqual([u.judge, u.metric, u.label, u.judgeProbability], ['criterion-count', 'question-1', 'no', 0.6]);
});

test('the spot-check sample keeps the yes side and spreads over the rest', () => {
  const rows = Array.from({ length: 40 }, (_, i) => ({ topic: 't', answer: `a${i}`, yes: i / 40 }));
  const picked = sample([...rows, rows[39]], 10);
  assert.equal(picked.length, 10);
  assert.equal(new Set(picked.map((r) => r.answer)).size, 10);
  assert.deepEqual(picked.slice(0, 6).map((r) => r.answer), ['a39', 'a38', 'a37', 'a36', 'a35', 'a34']);
  assert.ok(picked.slice(6).every((r) => r.yes < 0.35 || r.yes < picked[5].yes));
  assert.deepEqual(sample(rows, 10), sample(rows, 10));
  assert.equal(sample(rows.slice(0, 3), 10).length, 3);
});

test('the server shows the page blinded, records a submission once and links the ledger', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'humor-skills-inbox-'));
  const [inboxDir, evalsDir, ledgerDir] = ['inbox', 'evals', 'ledger'].map((d) => join(dir, d));
  mkdirSync(join(evalsDir, 'gen'), { recursive: true });
  mkdirSync(ledgerDir);
  writeFileSync(join(ledgerDir, 'gen.json'), JSON.stringify({
    entries: [{ id: 'some-change', kind: 'change', date: '2026-11-01', hypothesis: 'h', change: 'c', comparisons: [], status: 'open', decision: 'd', note: 'n', sources: ['x'] }],
  }));
  const req = request();
  storeRequest(req, inboxDir);
  assert.throws(() => storeRequest(req, inboxDir), /already exists/);

  let rebuilt = 0;
  const server = inboxServer({ inboxDir, evalsDir, ledgerDir, rater: 'tester', afterSubmit: () => { rebuilt++; }, today: () => '2026-11-20' });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const html = await (await fetch(url)).text();
    assert.ok(html.includes('お題 one') && html.includes('tester'));
    for (const secret of ['rev-NEW', 'rev-OLD', '説明文', 'some-change']) assert.ok(!html.includes(secret), `the page leaks "${secret}"`);

    const post = (payload: unknown) => fetch(`${url}/api/submit`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    const res = await post(answerFor(req, { one: 'candidate', two: 'tie', three: 'tie' }));
    assert.equal(res.status, 200);
    const shown = await res.json() as { rule: string; ruleLabel: string; files: string[]; reveal: unknown[] };
    assert.deepEqual([shown.rule, shown.ruleLabel, shown.reveal.length], ['adoptable', '採用可', 3]);
    assert.ok(shown.files.every((f) => existsSync(f)));
    assert.equal(rebuilt, 1);
    assert.equal(loadPending(inboxDir).length, 0);

    const entry = JSON.parse(readFileSync(join(ledgerDir, 'gen.json'), 'utf8')).entries[0];
    assert.deepEqual(entry.comparisons[0], { candidate: '2026-11-20/trial/one/candidate', baseline: '2026-11-20/trial/one/baseline' });
    assert.equal(entry.comparisons.length, 3);
    assert.ok(entry.sources.includes(shown.files[1]));

    const again = await post(answerFor(req, { one: 'tie', two: 'tie', three: 'tie' }));
    assert.equal(again.status, 400);
    assert.match((await again.json() as { error: string }).error, /no waiting request "trial"/);
    assert.equal((await fetch(`${url}/nope`)).status, 404);
  } finally {
    server.close();
  }
});
