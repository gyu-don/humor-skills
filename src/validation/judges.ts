/**
 * The one list of the tools a generator's development uses: where each
 * lives, what it measures, how it is used in the two places it can be used,
 * and (for judges) when its questions were fixed. agreement.ts uses `frozen`
 * to re-measure each judge on labels it has not seen; the status page
 * (src/status) prints the rest. Numbers never go here — they come from the
 * latest reports/validation/<date>/summary.json.
 *
 * The two uses ask different things of a tool:
 *   loop   the autonomous improvement loop, which never waits for a human.
 *          A tool earns its place by being cheap, repeatable and telling the
 *          agent what to fix. Weak agreement with the human is acceptable;
 *          a bias is not, because the loop optimises whatever it can measure.
 *   final  the check before a version is adopted. Only something that agrees
 *          with the human's verdict on versions belongs here.
 */
export interface Judge {
  name: string;
  /** skills / research: Jev judges. baseline: what a funniness judge has to beat. code / human: not a judge. */
  where: 'skills' | 'research' | 'baseline' | 'code' | 'human';
  /** ScoreFile `evaluator` names this judge writes (src/validation/run-jev.ts, blind.ts). */
  evaluators: string[];
  measures: string;
  loop: string;
  final: string;
  /**
   * The day its question text or threshold was last fixed while looking at
   * human labels. Sessions dated on or after it are "unused" labels for this
   * judge. Move it forward whenever the question is rewritten from the data.
   */
  frozen?: string;
}

const UNUSED = '使わない';

export const JUDGES: Judge[] = [
  {
    name: '形式・文字数の検査（`src/mechanical/check_form.py`）',
    where: 'code',
    evaluators: [],
    measures: '本数、文字数、文字種、括弧の数',
    loop: '違反を見つけて直す',
    final: '不合格条件。違反があれば受付箱に出さない',
  },
  {
    name: 'overlap-check',
    where: 'skills',
    evaluators: ['overlap-check'],
    measures: '笑いの中心の素材が同じ回答のペア（被り）',
    loop: '1回の出力内の被りを見つけて作り直す。複数回の生成をまとめて渡し、生成をまたぐ素材の繰り返しを変更前と件数で比べる',
    final: '不合格条件。1回の出力内に被りがあれば受付箱に出さない（検出できない被りもあるので、被りがない保証にはならない）',
    // The question and the 0.7 threshold were set on the 2026-09-23 similarity session.
    frozen: '2026-09-24',
  },
  {
    name: 'trait-check',
    where: 'skills',
    evaluators: ['trait-check', 'trait-compare', 'trait-gate', 'trait-versions'],
    measures: '具体性（concrete）と説明的さ（indirect）',
    loop: '説明的な回答を名指しして直す候補にする。全題をまとめた読みで、性質が動いたかを見る。値を上げることは目標にしない',
    final: `${UNUSED}（人間が変更前を選んだ版を見分けられていない）`,
    // Questions written on 2026-09-24 from the findings on sessions up to 2026-09-23.
    frozen: '2026-09-24',
  },
  {
    name: 'criterion-count',
    where: 'research',
    evaluators: [],
    measures: '実験ごとに書いた yes/no の質問に当てはまる回答の本数',
    loop: '狙った型が出たかを、変更前後で数える。質問ごとに人間の抜き取り確認を通す',
    final: UNUSED,
  },
  {
    name: '人間のブラインド比較（受付箱、`npm run inbox`）',
    where: 'human',
    evaluators: [],
    measures: 'お題ごとに、どちらのセットが面白いか',
    loop: '待たない。依頼を受付箱に置いて次の仮説に進む',
    final: '採否を決める。負けが0なら採用可、負けがあれば台帳に戻す',
  },
  {
    name: 'funniness-score',
    where: 'research',
    evaluators: ['funniness-score'],
    measures: '面白さの6軸採点',
    loop: UNUSED,
    final: UNUSED,
  },
  {
    name: 'risk-flags',
    where: 'research',
    evaluators: ['risk-flags'],
    measures: 'ベタ・ひねりなし・共感・認知度・滑りのリスク',
    loop: UNUSED,
    final: UNUSED,
  },
  {
    name: 'cluster-fit-check',
    where: 'research',
    evaluators: ['cluster-fit-check'],
    measures: '文献由来のユーザークラスタ別の嗜好への適合',
    loop: UNUSED,
    final: `${UNUSED}（評価者が1人では検証できない）`,
  },
  {
    name: 'diversity-check',
    where: 'research',
    evaluators: ['diversity-check'],
    measures: 'お題の分解軸の数（セットの収束）',
    loop: `${UNUSED}（プロンプト版のみ。レポートの文章を診断に読むのは任意）`,
    final: UNUSED,
  },
  {
    name: 'ベースライン',
    where: 'baseline',
    evaluators: ['naive', 'naive-pairwise', 'baseline'],
    measures: 'ルーブリックなしの「面白いか」「どちらが面白いか」、文字数',
    loop: UNUSED,
    final: UNUSED,
  },
];

export const judgeOf = (evaluator: string): Judge | undefined => JUDGES.find((j) => j.evaluators.includes(evaluator));

/** Untuned judges and baselines are shown on the same unused labels as the most recently tuned judge. */
export const DEFAULT_SINCE = JUDGES.map((j) => j.frozen ?? '').sort().at(-1)!;

/** First session date whose labels the evaluator's questions were not written from. */
export const unusedSince = (evaluator: string): string => judgeOf(evaluator)?.frozen ?? DEFAULT_SINCE;
