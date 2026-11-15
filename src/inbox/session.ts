/**
 * Turns what the human answered on the inbox page into a human-eval session
 * (data/human-evals/<source>/<date>-<request id>.json and .md, schema in
 * data/human-evals/README.md), and links a final check to its ledger entry.
 * Pure functions plus two small writers, so the conversion can be tested
 * without a server.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { adoption, type Adoption, type TraitLabel } from '../validation/labels.ts';
import { criterionKey, finalCheckKey, type Side } from './ballot.ts';
import type { CriterionRequest, FinalCheckRequest } from './request.ts';

export type Choice = Side | 'tie' | 'skip';

/** What the page posts for a final check. Marks are side + 1-based position as shown, e.g. "A3". */
export interface FinalCheckAnswer {
  id: string;
  kind: 'final-check';
  topics: Record<string, { choice: Choice; good?: string[]; bad?: string[]; comment?: string }>;
}

/** What the page posts for a criterion spot check: one label per item, in the order shown. */
export interface CriterionAnswer {
  id: string;
  kind: 'criterion';
  labels: TraitLabel[];
}

export interface Meta {
  /** YYYY-MM-DD the human judged. */
  date: string;
  rater: string;
}

export interface Session {
  /** File name without extension: "<date>-<request id>". */
  base: string;
  json: Record<string, unknown>;
  md: string;
}

type Human = 'candidate' | 'baseline' | 'tie' | 'skip';

export interface FinalCheckResult extends Session {
  /** Global set IDs of every お題, for the ledger entry. */
  comparisons: { candidate: string; baseline: string }[];
  tally: { win: number; tie: number; loss: number; skipped: number };
  /** The adoption rule on the judged お題; undefined when every お題 was skipped. */
  rule?: Adoption;
  /** Shown to the human after judging: which side was which. */
  reveal: { key: string; topic: string; choice: Choice; A: string; B: string; human: Human }[];
}

const RULE_LABEL: Record<Adoption, string> = { adoptable: '採用可', return: '台帳に戻す' };
const VERSION_LABEL = { candidate: '変更後', baseline: '変更前' } as const;
const cell = (text: string): string => text.replaceAll('|', '｜').replaceAll('\n', ' ');

export function finalCheckSession(request: FinalCheckRequest, answer: FinalCheckAnswer, meta: Meta): FinalCheckResult {
  if (answer.id !== request.id) throw new Error(`answer is for "${answer.id}", not "${request.id}"`);
  const key = finalCheckKey(request);
  const base = `${meta.date}-${request.id}`;
  // Set ids start with the request id: global ids are "<date>/<set id>", and two requests judged on
  // the same day may share お題 keys.
  const setIds = (topic: string) => ({ candidate: `${request.id}/${topic}/candidate`, baseline: `${request.id}/${topic}/baseline` });
  const sets: Record<string, unknown>[] = [];
  const setPreferences: { better: string; worse: string }[] = [];
  const setTies: { a: string; b: string }[] = [];
  const reveal: FinalCheckResult['reveal'] = [];
  const mdTopics: string[] = [];

  for (const t of key) {
    const a = answer.topics[t.key];
    if (!a || !['A', 'B', 'tie', 'skip'].includes(a.choice)) throw new Error(`お題 "${t.key}": no choice (A / B / tie / skip)`);
    const marks = new Map<string, 'good' | 'bad'>();
    for (const [kind, list] of [['good', a.good ?? []], ['bad', a.bad ?? []]] as const) {
      for (const mark of list) {
        const m = /^([AB])(\d+)$/.exec(mark);
        if (!m || Number(m[2]) < 1 || Number(m[2]) > t.sides[m[1] as Side].answers.length) throw new Error(`お題 "${t.key}": mark "${mark}" is not an answer shown`);
        if (marks.has(mark)) throw new Error(`お題 "${t.key}": "${mark}" is marked twice`);
        marks.set(mark, kind);
      }
    }
    const side = (version: 'candidate' | 'baseline'): Side => (t.sides.A.version === version ? 'A' : 'B');
    const human: Human = a.choice === 'tie' || a.choice === 'skip' ? a.choice : t.sides[a.choice].version;
    const ids = setIds(t.key);
    if (human === 'tie') setTies.push({ a: ids.candidate, b: ids.baseline });
    else if (human !== 'skip') setPreferences.push({ better: ids[human], worse: ids[human === 'candidate' ? 'baseline' : 'candidate'] });

    for (const version of ['candidate', 'baseline'] as const) {
      const s = side(version);
      const shown = t.sides[s].answers;
      const marked = (kind: 'good' | 'bad'): number[] => shown.map((_, i) => i + 1).filter((n) => marks.get(`${s}${n}`) === kind);
      const verdict = human === 'skip' ? '判定なし（スキップ）' : human === 'tie' ? '引き分け' : human === version ? '選好された' : '選好されなかった';
      sets.push({
        id: ids[version],
        topic: t.key,
        condition: `${version}; ${request.generator}; ${request[version]}; ${request.topics.find((x) => x.key === t.key)![version].length} runs pooled; shown as ${s}`,
        role: version,
        answers: shown.map((x) => x.text),
        // Answer-level labels only when the human marked something on this お題; then unmarked answers are unknown.
        ...(marks.size ? { hits: marked('good'), misses: marked('bad') } : { hits: null }),
        verdict: a.comment ? `${verdict}。${a.comment}` : verdict,
        sourceOrder: shown.map((x) => x.ref),
      });
    }

    reveal.push({ key: t.key, topic: t.topic, choice: a.choice, A: t.sides.A.version, B: t.sides.B.version, human });
    const mark = (s: Side, n: number): string => {
      const kind = marks.get(`${s}${n}`);
      return kind === 'good' ? ' ◎' : kind === 'bad' ? ' ×' : '';
    };
    const rows = Math.max(t.sides.A.answers.length, t.sides.B.answers.length);
    mdTopics.push(
      `### ${t.topic}`, '',
      `| 番号 | A（${VERSION_LABEL[t.sides.A.version]}） | B（${VERSION_LABEL[t.sides.B.version]}） |`, '|---|---|---|',
      ...Array.from({ length: rows }, (_, i) =>
        `| ${i + 1} | ${cell(t.sides.A.answers[i]?.text ?? '')}${mark('A', i + 1)} | ${cell(t.sides.B.answers[i]?.text ?? '')}${mark('B', i + 1)} |`),
      '',
    );
  }

  const count = (h: Human): number => reveal.filter((r) => r.human === h).length;
  const tally = { win: count('candidate'), tie: count('tie'), loss: count('baseline'), skipped: count('skip') };
  const judged = tally.win + tally.tie + tally.loss;
  const rule = judged ? adoption(tally.loss) : undefined;
  const CHOICE = { A: 'A', B: 'B', tie: '引き分け', skip: 'スキップ' } as const;
  const HUMAN = { candidate: '変更後を選好', baseline: '変更前を選好', tie: '引き分け', skip: '判定なし' } as const;

  const md = [
    `# 人間評価ログ ${meta.date} — 受付箱 \`${request.id}\`（最終チェック）`, '',
    `評価者: ${meta.rater}。ブラインド（お題ごとに A/B の割り当てと回答の並びを無作為化し、対応は判定後に開示）。構造化ラベルは [${base}.json](${base}.json)。`, '',
    `- 依頼: ${request.description}`,
    `- 台帳: \`${request.ledger}\``,
    `- 生成: ${request.generator}`,
    `- 変更後: ${request.candidate}`,
    `- 変更前: ${request.baseline}`,
    ...(request.machine ? [`- 機械の不合格条件: ${request.machine}`] : []),
    `- 依頼日: ${request.created}`, '',
    '## 結果', '',
    '| お題 | 選択 | A | B | 判定 | コメント |', '|---|---|---|---|---|---|',
    ...reveal.map((r) => `| ${cell(r.topic)} | ${CHOICE[r.choice]} | ${VERSION_LABEL[r.A as 'candidate']} | ${VERSION_LABEL[r.B as 'candidate']} | ${HUMAN[r.human]} | ${cell(answer.topics[r.key].comment ?? '')} |`),
    '',
    `変更後の版から見て、勝ち ${tally.win}・引き分け ${tally.tie}・負け ${tally.loss}${tally.skipped ? `・スキップ ${tally.skipped}` : ''}。` +
      (rule ? `採否の規則（負けが0なら採用可、負けがあれば台帳に戻す）: **${RULE_LABEL[rule]}**。` : '判定した題がないので、採否の規則は適用しない。'),
    '',
    '◎ は特に良いと印を付けた回答、× は悪いと印を付けた回答。印のない回答は、良いとも悪いとも判定していない。', '',
    '具体例は評価ゾーン専用とし、生成用の SKILL.md に持ち込まない。', '',
    '## 提示した全回答', '',
    ...mdTopics,
  ].join('\n');

  const json = {
    date: meta.date,
    source: request.source,
    rater: meta.rater,
    blind: true,
    log: `${base}.md`,
    description: request.description,
    request: {
      id: request.id, kind: 'final-check', ledger: request.ledger, created: request.created,
      generator: request.generator, candidate: request.candidate, baseline: request.baseline,
      ...(request.machine ? { machine: request.machine } : {}),
    },
    topics: Object.fromEntries(key.map((t) => [t.key, t.topic])),
    sets,
    setPreferences,
    setTies,
    pairPreferences: [],
  };
  const global = (id: string): string => `${meta.date}/${id}`;
  return {
    base, json, md: `${md.trimEnd()}\n`, tally, rule, reveal,
    comparisons: key.map((t) => {
      const ids = setIds(t.key);
      return { candidate: global(ids.candidate), baseline: global(ids.baseline) };
    }),
  };
}

export interface CriterionResult extends Session {
  /** Items where the human said yes or no, and how many of those the judge got right at 0.5. */
  agreement: { agree: number; judged: number; unsure: number };
}

export function criterionSession(request: CriterionRequest, answer: CriterionAnswer, meta: Meta): CriterionResult {
  if (answer.id !== request.id) throw new Error(`answer is for "${answer.id}", not "${request.id}"`);
  const items = criterionKey(request);
  if (answer.labels.length !== items.length || answer.labels.some((l) => !['yes', 'no', 'unsure'].includes(l))) {
    throw new Error(`expected ${items.length} labels, each yes / no / unsure`);
  }
  const base = `${meta.date}-${request.id}`;
  const topics = [...new Set(items.map((it) => it.topic))];
  const topicKey = (topic: string): string => `t${topics.indexOf(topic) + 1}`;
  const sets = topics.map((topic) => ({
    id: `${request.id}/${topicKey(topic)}/spot-check`,
    topic: topicKey(topic),
    condition: `criterion-count の抜き取り（依頼 ${request.id}）`,
    answers: items.filter((it) => it.topic === topic).map((it) => it.answer),
    hits: null,
  }));
  const judgeYes = (p: number): boolean => p >= 0.5;
  const rows = items.map((it, i) => {
    const n = items.slice(0, i + 1).filter((x) => x.topic === it.topic).length;
    return { ...it, label: answer.labels[i], ref: `${request.id}/${topicKey(it.topic)}/spot-check#${n}` };
  });
  const decided = rows.filter((r) => r.label !== 'unsure');
  const agreement = {
    agree: decided.filter((r) => judgeYes(r.probability) === (r.label === 'yes')).length,
    judged: decided.length,
    unsure: rows.length - decided.length,
  };
  const LABEL = { yes: 'はい', no: 'いいえ', unsure: 'どちらとも' } as const;

  const md = [
    `# 人間評価ログ ${meta.date} — 受付箱 \`${request.id}\`（狙いの質問の抜き取り確認）`, '',
    `評価者: ${meta.rater}。判定器の答えは伏せた。構造化ラベルは [${base}.json](${base}.json)。`, '',
    `- 質問: ${request.criterion.question}`,
    `- はい: ${request.criterion.true}`,
    `- いいえ: ${request.criterion.false}`,
    ...(request.ledger ? [`- 台帳: \`${request.ledger}\``] : []),
    `- 依頼日: ${request.created}`, '',
    '## 結果', '',
    `人間が「はい」か「いいえ」と答えた ${agreement.judged}本のうち、判定器（確率 0.5 以上を「はい」とする）と一致したのは ${agreement.agree}本。「どちらとも」は ${agreement.unsure}本。`, '',
    '| お題 | 回答 | 人間 | 判定器の確率 | 一致 |', '|---|---|---|---|---|',
    ...rows.map((r) => `| ${cell(r.topic)} | ${cell(r.answer)} | ${LABEL[r.label]} | ${r.probability.toFixed(2)} | ` +
      `${r.label === 'unsure' ? '-' : judgeYes(r.probability) === (r.label === 'yes') ? '○' : '**×**'} |`),
    '',
    '具体例は評価ゾーン専用とし、生成用の SKILL.md に持ち込まない。',
  ].join('\n');

  const json = {
    date: meta.date,
    source: request.source,
    rater: meta.rater,
    blind: true,
    log: `${base}.md`,
    description: `criterion-count の質問に、人間が同じ文面で答えた抜き取り確認（依頼 ${request.id}）`,
    request: { id: request.id, kind: 'criterion', ...(request.ledger ? { ledger: request.ledger } : {}), created: request.created },
    topics: Object.fromEntries(topics.map((topic) => [topicKey(topic), topic])),
    sets,
    setPreferences: [],
    pairPreferences: [],
    traitJudgments: rows.map((r) => ({
      answer: r.ref, judge: 'criterion-count', metric: request.id,
      question: `${request.criterion.question}（はい: ${request.criterion.true}／いいえ: ${request.criterion.false}）`,
      label: r.label, judgeProbability: r.probability,
    })),
  };
  return { base, json, md: `${md}\n`, agreement };
}

/** Writes <base>.json and <base>.md. Refuses to overwrite a session. */
export function writeSession(evalsDir: string, source: string, session: Session): string[] {
  const paths = ['json', 'md'].map((ext) => join(evalsDir, source, `${session.base}.${ext}`));
  for (const p of paths) if (existsSync(p)) throw new Error(`${p} already exists — a session with this id was recorded today`);
  writeFileSync(paths[0], `${JSON.stringify(session.json, null, 2)}\n`);
  writeFileSync(paths[1], session.md);
  return paths;
}

/** Adds a final check's set pairs and its log to the ledger entry the request named. */
export function linkLedger(ledgerDir: string, source: string, entryId: string, comparisons: { candidate: string; baseline: string }[], log: string): void {
  const path = join(ledgerDir, `${source}.json`);
  const ledger = JSON.parse(readFileSync(path, 'utf8')) as {
    entries: { id: string; kind: string; comparisons?: { candidate: string; baseline: string }[]; sources: string[] }[];
  };
  const entry = ledger.entries.find((e) => e.id === entryId);
  if (!entry || entry.kind !== 'change') throw new Error(`${path}: no "change" entry "${entryId}"`);
  entry.comparisons ??= [];
  for (const c of comparisons) {
    if (!entry.comparisons.some((x) => x.candidate === c.candidate && x.baseline === c.baseline)) entry.comparisons.push(c);
  }
  if (!entry.sources.includes(log)) entry.sources.push(log);
  writeFileSync(path, `${JSON.stringify(ledger, null, 2)}\n`);
}
