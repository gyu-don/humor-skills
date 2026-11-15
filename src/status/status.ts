/**
 * Writes STATUS.md: the one page that says where things stand — what is
 * waiting for a human, how each tool is used in the improvement loop and in
 * the final check and how far it agrees with the human, what human evidence
 * exists, and what has been tried on the generation skill with what verdict.
 *
 *   npm run status            (node src/status/status.ts [out path] [validation root])
 *
 * Nothing on the page is typed by hand. Numbers come from the latest
 * reports/validation/<date>/summary.json (written by agreement.ts), counts
 * from data/human-evals, tool descriptions from src/validation/judges.ts,
 * hypotheses from data/ledger and waiting requests from data/inbox. Other
 * documents point here instead of copying numbers. The output has no
 * timestamp, so it only changes when its inputs do.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadPending } from '../inbox/request.ts';
import { JUDGES, type Judge } from '../validation/judges.ts';
import { adoption, loadLabels, type Adoption } from '../validation/labels.ts';
import { wilson } from '../validation/stats.ts';
import type { AnswerRow, AnswerStats, GateSummary, PreferenceRow, Share, Summary, VersionSummary } from '../validation/summary.ts';
import { judge, loadLedger, type ChangeEntry, type ComparisonResult, type Entry, type Status, type TasteEntry } from './ledger.ts';

const OUT_PATH = process.argv[2] ?? 'STATUS.md';
/** Overridable so a test can point at a fixture. */
const VALIDATION_DIR = process.argv[3] ?? 'reports/validation';
/** trait-check verdict.ts's ALPHA. */
const ALPHA = 0.05;

function latestSummary(): Summary {
  const dirs = readdirSync(VALIDATION_DIR).sort().reverse();
  const dir = dirs.find((d) => existsSync(join(VALIDATION_DIR, d, 'summary.json')));
  if (!dir) {
    console.error(`no summary.json under ${VALIDATION_DIR}. Run: npm run validate:agreement -- ${VALIDATION_DIR}/<date>`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(join(VALIDATION_DIR, dir, 'summary.json'), 'utf8')) as Summary;
}

const labels = loadLabels();
const summary = latestSummary();
const ledger = loadLedger(labels);
const pending = loadPending();

const f2 = (x: number | null): string => (x === null ? '-' : x.toFixed(2));
const signed = (x: number): string => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(3)}`;

/** "AUC 0.52 [0.37, 0.67]（95本・当たり13）" */
const aucCell = (s: AnswerStats): string =>
  s.auc === null ? `-（${s.answers}本・当たり${s.hits}）` : `AUC ${f2(s.auc)} [${f2(s.lo)}, ${f2(s.hi)}]（${s.answers}本・当たり${s.hits}）`;

/** "0.59 [0.43, 0.73] (40)" */
const shareCell = (s: Share): string => {
  if (s.share === null) return '-';
  const [lo, hi] = wilson(s.share, s.n);
  return `${f2(s.share)} [${f2(lo)}, ${f2(hi)}] (${s.n})`;
};

/** Whether a 95% interval sits entirely on one side of chance. */
const side = (lo: number | null, hi: number | null): 'above' | 'below' | 'chance' =>
  lo !== null && lo > 0.5 ? 'above' : hi !== null && hi < 0.5 ? 'below' : 'chance';
const shareSide = (s: Share): 'above' | 'below' | 'chance' => (s.share === null ? 'chance' : side(...wilson(s.share, s.n)));
const SIDE = { above: '偶然より上', below: '偶然より下（逆向き）', chance: '偶然と区別できない' };
const RULE: Record<Adoption, string> = { adoptable: '採用可', return: '台帳に戻す' };

const lines: string[] = [];
const out = (s = ''): void => {
  lines.push(s);
};

// --- judges -----------------------------------------------------------------

const rowsOf = (evaluator: string): AnswerRow[] => summary.answer.filter((r) => r.evaluator === evaluator);
const prefsOf = (evaluator: string): PreferenceRow[] => summary.preference.filter((r) => r.evaluator === evaluator);
const metricName = (r: { metric: string; lowerIsBetter?: boolean }): string => `${r.lowerIsBetter ? '−' : ''}${r.metric}`;
const retest = (r: { retest: number | null }): string => (r.retest === null ? '-' : r.retest.toFixed(2));

type GateCase = GateSummary['cases'][number];
const gate: GateSummary | undefined = summary.gate[0];
const versions: VersionSummary[] = summary.versions ?? [];
const covered = (c: { runs: (object | null)[] }): boolean => c.runs.some((r) => r !== null);

/** Flagged in a run when any trait's reading is below ALPHA (old = worse by more than the baseline run gap). */
const flaggedIn = (run: GateCase['runs'][number], old: boolean): boolean =>
  run !== null && Object.values(run).some((m) => (old ? m.worsening > m.noise : m.p < ALPHA));

/** "4題中 3題" — a range when the two runs disagree. */
const flagCount = (cases: GateCase[], old: boolean): string => {
  const runs = Math.max(...cases.map((c) => c.runs.length));
  const perRun = Array.from({ length: runs }, (_, i) => cases.filter((c) => flaggedIn(c.runs[i], old)).length);
  return `${cases.length}題中 ${[...new Set(perRun)].sort((a, b) => a - b).join('〜')}題`;
};
const gateCases = (human: GateCase['human']): GateCase[] => (gate ? gate.cases.filter((c) => c.human === human && covered(c)) : []);
const HUMAN = { baseline: '人間が変更前を選んだ', tie: '人間が引き分けとした', candidate: '人間が変更後を選んだ' } as const;
/** "人間が変更前を選んだ1題中 0題、…" for one rule. */
const gateLine = (old: boolean): string =>
  (['baseline', 'tie', 'candidate'] as const)
    .map((h) => (gateCases(h).length ? `${HUMAN[h]}${flagCount(gateCases(h), old)}` : `${HUMAN[h]}題はまだない`))
    .join('、');

/** The pooled reading of one version comparison: "indirect の悪化 +0.012（p 0.31）、…" and whether any run flags it. */
function pooled(v: VersionSummary): { text: string; flagged: boolean } {
  const runs = v.runs.filter((r): r is NonNullable<typeof r> => r !== null);
  if (!runs.length) return { text: '最新の検証に結果なし', flagged: false };
  // Averaged over the runs for display; the flag is per run.
  const cells = v.metrics.map((m) => {
    const avg = (pick: (x: { worsening: number; p: number }) => number): number => runs.reduce((a, r) => a + pick(r[m]), 0) / runs.length;
    return `\`${m}\` の悪化 ${signed(avg((x) => x.worsening))}（p ${avg((x) => x.p).toFixed(2)}）`;
  });
  return { text: cells.join('、'), flagged: runs.some((r) => Object.values(r).some((m) => m.p < ALPHA)) };
}

function skillsTable(j: Judge): void {
  out(`### \`${j.name}\``);
  out();
  out(`未使用ラベルは ${j.frozen} 以降のセッション（それより前のラベルを見て質問や閾値を決めた）。`);
  out();
  out('| 指標 | 再実行の相関 | 全ラベル | 未使用ラベル | 未使用ラベルでの読み |');
  out('|---|---|---|---|---|');
  for (const r of summary.overlap.filter((o) => j.evaluators.includes(o.evaluator) && o.metric === 'sameMaterial')) {
    const cell = (s: typeof r.all): string => `被り ${s.similar}組中 ${s.caught}組を検出、被りでない ${s.different}組の誤検出 ${s.falseFlags}`;
    out(`| 被りの検出（${r.metric} ≥ 0.7） | ${retest(r)} | ${cell(r.all)} | ${cell(r.unused)} | ${r.unused.similar + r.unused.different < 10 ? '件数が足りない' : '-'} |`);
  }
  for (const e of j.evaluators) {
    for (const r of rowsOf(e)) out(`| 回答ごとの \`${metricName(r)}\` | ${retest(r)} | ${aucCell(r.all)} | ${aucCell(r.unused)} | ${SIDE[side(r.unused.lo, r.unused.hi)]} |`);
    for (const r of prefsOf(e)) {
      const cell = (s: typeof r.all): string => `セット内 ${shareCell(s.inSet)}、直接比較 ${shareCell(s.pairs)}`;
      out(`| 一対比較の \`${r.metric}\` | ${retest(r)} | ${cell(r.all)} | ${cell(r.unused)} | セット内は${SIDE[shareSide(r.unused.inSet)]} |`);
    }
  }
  out();
  if (gate && j.evaluators.includes(gate.evaluator)) {
    out('版の比較（`scripts/versions.ts`）が、人間の判定をどこまで当てるか。合図が出るべきなのは、人間が変更前を選んだときだけ。');
    out();
    out(`- 題ごとの読み（いずれかの性質が p < ${ALPHA}）で合図が出た題: ${gateLine(false)}`);
    out(`- 置き換える前の規則（変更前2回の差を超えたら回帰）: ${gateLine(true)}`);
    for (const v of versions.filter(covered)) {
      const p = pooled(v);
      out(`- 版 \`${v.id}\`（${v.topics}題）: 人間は勝ち${v.human.win}・引き分け${v.human.tie}・負け${v.human.loss}で、規則では${RULE[v.rule]}。` +
        `全題をまとめた読みは ${p.text}。${p.flagged ? '合図あり' : '合図なし'}`);
    }
    out();
  }
}

function researchRow(j: Judge): void {
  for (const e of j.evaluators) {
    const rows = rowsOf(e);
    const prefs = prefsOf(e);
    if (rows.length === 1) {
      const r = rows[0];
      out(`| ${e} \`${metricName(r)}\` | ${aucCell(r.all)} | ${aucCell(r.unused)} | ${SIDE[side(r.unused.lo, r.unused.hi)]} |`);
    } else if (rows.length) {
      const range = (pick: (r: AnswerRow) => number | null): string => {
        const vs = rows.map(pick).filter((v): v is number => v !== null).sort((a, b) => a - b);
        return vs.length ? `AUC ${f2(vs[0])}〜${f2(vs.at(-1)!)}` : '-';
      };
      const named = (which: 'above' | 'below'): string => rows.filter((r) => side(r.unused.lo, r.unused.hi) === which).map(metricName).join('、');
      const reading = [named('above') && `上: ${named('above')}`, named('below') && `下: ${named('below')}`].filter(Boolean).join('。') || 'どの指標も偶然と区別できない';
      out(`| ${e}（${rows.length}指標） | ${range((r) => r.all.auc)} | ${range((r) => r.unused.auc)} | ${reading} |`);
    }
    for (const r of prefs) {
      out(`| ${e} \`${r.metric}\`（一対比較） | セット内 ${shareCell(r.all.inSet)} | セット内 ${shareCell(r.unused.inSet)} | ${SIDE[shareSide(r.unused.inSet)]} |`);
    }
    if (!rows.length && !prefs.length) out(`| ${e} | 最新の検証に結果なし | - | - |`);
  }
}

// --- human evidence ---------------------------------------------------------

const unreflected = labels.sessions.filter((s) => !summary.labels.sessions.includes(s.file));
const raters = [...new Set(labels.sessions.map((s) => s.rater))];
const labeledAnswers = [...labels.answers.values()].filter((a) => a.hit !== null);

/** Criterion spot checks: per request, how often the judge's yes/no matched the human's. */
const spotChecks = [...Map.groupBy(labels.traitJudgments.filter((t) => t.judge === 'criterion-count' && t.judgeProbability !== undefined), (t) => t.metric)]
  .map(([id, ts]) => {
    const decided = ts.filter((t) => t.label !== 'unsure');
    return {
      id, date: ts[0].date, question: ts[0].question,
      agree: decided.filter((t) => (t.judgeProbability! >= 0.5) === (t.label === 'yes')).length,
      judged: decided.length, unsure: ts.length - decided.length,
    };
  });

// --- ledger -----------------------------------------------------------------

const STATUS_LABEL: Record<Status, string> = { supported: '支持', refuted: '否定', open: '未決' };
const sessionOf = (setId: string) => labels.sessions.find((s) => s.file === labels.sets.find((x) => x.id === setId)?.session);

/** "セット単位で勝ち0・引き分け1・負け2（3題、非ブラインド）。指名された回答は変更後 0本、変更前 5本（2題）" */
function humanVerdict(results: ComparisonResult[]): string {
  if (!results.length) return '人間が比べたセッションがない';
  const parts: string[] = [];
  const judged = results.filter((r) => r.verdict);
  if (judged.length) {
    const n = (v: string): number => judged.filter((r) => r.verdict === v).length;
    const blind = judged.filter((r) => r.blind).length;
    const how = blind === judged.length ? 'すべてブラインド' : blind ? `うちブラインド${blind}題` : '非ブラインド';
    parts.push(`セット単位で勝ち${n('win')}・引き分け${n('tie')}・負け${n('loss')}（${judged.length}題、${how}）`);
  }
  const withHits = results.filter((r) => r.hits);
  if (withHits.length) {
    const sum = (k: 'candidate' | 'baseline'): number => withHits.reduce((a, r) => a + r.hits![k], 0);
    parts.push(`指名された回答は変更後 ${sum('candidate')}本、変更前 ${sum('baseline')}本（${withHits.length}題）`);
  }
  const unjudged = results.filter((r) => !r.verdict && !r.hits).length;
  if (unjudged) parts.push(`未判定${unjudged}題`);
  return parts.join('。');
}

/** Final checks that came through the inbox for this entry, one line each. */
function finalChecks(results: ComparisonResult[]): string[] {
  const byRequest = Map.groupBy(
    results.filter((r) => sessionOf(r.candidate)?.request?.kind === 'final-check'),
    (r) => sessionOf(r.candidate)!.request!.id,
  );
  return [...byRequest].map(([id, rs]) => {
    const n = (v: string): number => rs.filter((r) => r.verdict === v).length;
    const judged = n('win') + n('tie') + n('loss');
    const verdict = judged ? `規則では**${RULE[adoption(n('loss'))]}**` : '判定した題がない';
    return `\`${id}\`（${sessionOf(rs[0].candidate)!.date}）: 勝ち${n('win')}・引き分け${n('tie')}・負け${n('loss')}${rs.length - judged ? `・スキップ${rs.length - judged}` : ''}。${verdict}`;
  });
}

/** What trait-check's versions.ts read on the version comparisons these sets belong to, in the latest validation. */
function machineReading(results: ComparisonResult[]): string[] {
  const groups = new Set(results
    .map((r) => labels.gates.find((g) => g.candidateSet === r.candidate && g.baselineSet === r.baseline)?.group)
    .filter((g): g is string => g !== undefined));
  return versions.filter((v) => groups.has(v.id) && covered(v)).map((v) => {
    const p = pooled(v);
    return `${v.topics}題をまとめて ${p.text}。${p.flagged ? '合図あり' : '合図なし'}`;
  });
}

function changeBlock(e: ChangeEntry): void {
  const results = e.comparisons.map((c) => judge(labels, c));
  out(`**${STATUS_LABEL[e.status]}** · ${e.date} · \`${e.id}\``);
  out();
  out(`- 仮説: ${e.hypothesis}`);
  out(`- 変更: ${e.change}`);
  out(`- 人間の判定: ${humanVerdict(results)}`);
  for (const line of finalChecks(results)) out(`- 最終チェック ${line}`);
  for (const p of pending.filter((r) => r.ledger === e.id)) out(`- 判定待ち: 受付箱の \`${p.id}\`（${p.created}）`);
  for (const line of machineReading(results)) out(`- \`trait-check\` の読み: ${line}`);
  out(`- 扱い: ${e.decision}`);
  out(`- 但し書き: ${e.note}`);
  out();
}

function tasteBlock(e: TasteEntry): void {
  out(`**${STATUS_LABEL[e.status]}** · ${e.date} · \`${e.id}\``);
  out();
  out(`- 仮説: ${e.hypothesis}`);
  if (e.judge) {
    const { evaluator, metric } = e.judge;
    const row = summary.answer.find((r) => r.evaluator === evaluator && r.metric === metric);
    const overlap = summary.overlap.find((r) => r.evaluator === evaluator && r.metric === metric);
    const measured = row
      ? `未使用ラベルで ${aucCell(row.unused)}、${SIDE[side(row.unused.lo, row.unused.hi)]}`
      : overlap
        ? `未使用ラベルで被り ${overlap.unused.similar}組中 ${overlap.unused.caught}組を検出、被りでない ${overlap.unused.different}組の誤検出 ${overlap.unused.falseFlags}`
        : '最新の検証に結果なし';
    out(`- 質問にした判定器: \`${evaluator}\` の \`${metric}\` — ${measured}`);
  }
  out(`- 但し書き: ${e.note}`);
  out();
}

const tally = (entries: Entry[]): string =>
  (['supported', 'refuted', 'open'] as Status[]).map((s) => `${STATUS_LABEL[s]} ${entries.filter((e) => e.status === s).length}`).join('・');

// --- page -------------------------------------------------------------------

const byDate = (a: Entry, b: Entry): number => a.date.localeCompare(b.date);
const changes = ledger.filter((e): e is ChangeEntry => e.kind === 'change').sort(byDate);
const tastes = ledger.filter((e): e is TasteEntry => e.kind === 'taste').sort(byDate);
const gateYes = summary.answer.filter((r) => r.gate).map((r) => `${r.evaluator} ${metricName(r)}`);
const skills = JUDGES.filter((j) => j.where === 'skills');
const named = (keep: (s: 'above' | 'below' | 'chance') => boolean): string[] => skills.flatMap((j) => j.evaluators.flatMap((e) => [
  ...rowsOf(e).filter((r) => keep(side(r.unused.lo, r.unused.hi))).map((r) => `\`${e}\` の \`${metricName(r)}\``),
  ...prefsOf(e).filter((r) => keep(shareSide(r.unused.inSet))).map((r) => `\`${e}\` の \`${r.metric}\``),
]));
const holding = named((s) => s === 'above');
const notHolding = named((s) => s !== 'above');
const unjudgedChanges = changes.filter((e) => e.comparisons.map((c) => judge(labels, c)).every((r) => !r.verdict && !r.hits));
const size = (r: (typeof pending)[number]): string => (r.kind === 'final-check' ? `${r.topics.length}題` : `${r.items.length}本`);
const KIND = { 'final-check': '最終チェック', criterion: '狙いの質問の抜き取り確認' } as const;

out('# 現状');
out();
out('`npm run status` が生成する。手で編集しない。数値は最新の検証と `data/human-evals/`、仮説は `data/ledger/`、判定待ちは `data/inbox/` から引いている。');
out('ほかの文書（`SKILL.md` の信頼度を除く）は数値を写さず、このページを指す。');
out();
out(`- 検証: \`${summary.dir}\`（${summary.labels.latestSession} までのセッションを反映。解釈は同じディレクトリの \`notes.md\`）`);
out(`- 検証より後に足された人間評価: ${unreflected.length ? `${unreflected.map((s) => `\`${s.file}\``).join('、')}（検証を回し直すまで、判定器の数値には入らない。台帳の判定には入っている）` : 'なし'}`);
out();
out('## 判定待ち');
out();
if (pending.length) {
  out('`npm run inbox` で開いて判定する。エージェントはこれを待たずに進む。');
  out();
  out('| 依頼 | 種類 | 量 | 依頼日 | 台帳の行 |');
  out('|---|---|---|---|---|');
  for (const r of pending) out(`| \`${r.id}\` | ${KIND[r.kind]} | ${size(r)} | ${r.created} | ${r.ledger ? `\`${r.ledger}\`` : '-'} |`);
} else {
  out('なし。');
}
out();
out('## 要点');
out();
out(`- 人間の判定の代わりに使える指標（\`gate: yes\`）: ${gateYes.length ? gateYes.join('、') : 'なし'}。採否は人間のブラインド比較で決める（負けが0なら採用可、負けがあれば台帳に戻す）`);
out(`- \`skills/\` の指標のうち、未使用ラベルで偶然を上回るもの: ${holding.length ? holding.join('、') : 'なし'}`);
out(`- 上回っていないもの: ${notHolding.length ? notHolding.join('、') : 'なし'}`);
if (gate) out(`- 版の比較で \`trait-check\` の合図（p < ${ALPHA}）が出た題: ${gateLine(false)}`);
out(`- 生成スキルへの変更 ${changes.length}件: ${tally(changes)}。人間がまだ比べていない変更: ${unjudgedChanges.length ? unjudgedChanges.map((e) => `\`${e.id}\``).join('、') : 'なし'}`);
out(`- 人間評価: 評価者は ${raters.join('、')} のみ。当たりか外れかの判定がある回答 ${labeledAnswers.length}本（当たり ${labeledAnswers.filter((a) => a.hit).length}本）`);
out();
out('## 道具の使い方');
out();
out('改善ループは人を待たずに回る。ここでは、安く、再現し、直す箇所が分かることを求める。最終チェックは版を採用する前に1回行う。ここに置けるのは、人間の判定と一致するものだけ。');
out();
out('| 道具 | 測るもの | 改善ループ | 最終チェック |');
out('|---|---|---|---|');
for (const j of JUDGES.filter((x) => x.where !== 'baseline')) {
  out(`| ${j.where === 'skills' || j.where === 'research' ? `\`${j.name}\`` : j.name} | ${j.measures} | ${j.loop} | ${j.final} |`);
}
out();
out('## 判定器と人間の一致');
out();
out('0.5 が偶然。角括弧は 95% 区間、丸括弧は件数。「未使用ラベル」は、その判定器の質問や閾値を決めたときに見ていないセッションだけで測った値で、`skills/` に置く根拠はこちら。再実行の相関は、同じ入力を2回判定させたときの値で、ループで使える安定さの目安。');
out();
for (const j of skills) skillsTable(j);
out('### 検証中の判定器（`research/`）とベースライン');
out();
out('面白さを測ろうとする判定器は、ルーブリックなしの質問（naive）と文字数を上回る必要がある。指標が多いと、偶然でも区間が 0.5 を外れるものが出る（20指標で1つ程度）。');
out();
out('| 判定器 | 全ラベル | 未使用ラベル | 未使用ラベルで区間が 0.5 を外れる指標 |');
out('|---|---|---|---|');
for (const j of JUDGES.filter((x) => x.where === 'research' || x.where === 'baseline')) researchRow(j);
out();
out(`\`gate: yes\` の条件のうち、セット比較（${summary.gatePower.sets}件で 0.8 以上）と直接比較（${summary.gatePower.pairs}件で 0.75 以上）を両方満たす確率は、` +
  `真の一致率が ${summary.gatePower.at.map(({ p, pass }) => `${p} の判定器で ${pass.toFixed(2)}`).join('、')}。今のラベル数では、良い判定器でも通りにくい。`);
out();
out('### 狙いの質問の抜き取り確認（`criterion-count`）');
out();
if (spotChecks.length) {
  out('| 依頼 | 日付 | 判定器と人間の一致 | どちらとも | 質問 |');
  out('|---|---|---|---|---|');
  for (const s of spotChecks) out(`| \`${s.id}\` | ${s.date} | ${s.agree} / ${s.judged}本 | ${s.unsure}本 | ${s.question} |`);
} else {
  out('まだない。質問を初めて使うときに `npm run inbox:spot-check` で依頼を作る（`research/criterion-count/SKILL.md`）。');
}
out();
out('## 人間評価');
out();
out('| 種類 | 件数 |');
out('|---|---|');
out(`| セッション | ${labels.sessions.length}（ブラインド ${labels.sessions.filter((s) => s.blind).length}、受付箱から ${labels.sessions.filter((s) => s.request).length}）。最新 ${labels.sessions.map((s) => s.date).sort().at(-1)} |`);
out(`| 評価者 | ${raters.join('、')} |`);
out(`| 当たりか外れかの判定がある回答 | ${labeledAnswers.length}本（当たり ${labeledAnswers.filter((a) => a.hit).length}本） |`);
out(`| 回答の直接比較 | ${labels.pairPreferences.filter((p) => p.winner !== 'tie').length}組（ほかに引き分け ${labels.pairPreferences.filter((p) => p.winner === 'tie').length}組） |`);
out(`| セット単位の比較 | 優劣あり ${labels.setPreferences.length}組、引き分け ${labels.setTies.length}組 |`);
out(`| 被りの判定 | ${labels.similarityJudgments.length}組 |`);
out(`| 版の比較（変更前を2回生成し、人間がセット単位で判定） | ${labels.gates.length}題、${labels.versions.length}版 |`);
out();
out('## 仮説の台帳');
out();
out('`data/ledger/ogiri-ai.json` の内容（書き方は `data/ledger/README.md`）。人間の判定と判定器の値は、ここで `data/human-evals/` と最新の検証から引いている。');
out();
out(`### 生成スキルへの変更（${tally(changes)}）`);
out();
for (const e of changes) changeBlock(e);
out(`### 何が面白いかについての仮説（${tally(tastes)}）`);
out();
for (const e of tastes) tasteBlock(e);

writeFileSync(OUT_PATH, `${lines.join('\n').trimEnd()}\n`);
console.log(`-> ${OUT_PATH} (${summary.dir}, ${ledger.length} ledger entries, ${pending.length} waiting)`);
