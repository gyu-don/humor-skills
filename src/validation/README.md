# 検証（人間の判定との一致）

判定器は `data/human-evals/` の人間の判定とだけ比べる。別の判定器とは比べない。
出力は新しい `reports/validation/<date>/` に置く。

## 手順

1. **Jev モード** — 1コマンドで、すべての判定器（`skills/` と `research/`）の実スクリプトと、ルーブリックなしのベースラインを2回ずつ実行する（再テスト信頼性のため）:
   `doppler run -- npm run validate:jev -- reports/validation/<date>`
2. **プロンプトモード**（`research/` の判定器のみ） — 判定器は `SKILL.md` に従うサブエージェント:
   - `npm run validate:blind -- make reports/validation/<date>/blind`
     で、シャッフルして出典を隠した `pool-<n>.md`（回答単位）と `sets-<n>.md`（セット単位）、`key.json` を書き出す。
     あわせて `pairs.md` も書き出す。人間の好みがわかっている同じお題の A/B ペアで、ルーブリックなしの「どちらが面白いか」ベースライン（`naive-pairwise`）に使う。新しい人間評価のセッションで同じファイルを判定してもらうこともできる。
   - 判定器ごと・入力ファイルごとにサブエージェントを1つ立てる（1サブエージェントに1判定器）。読ませるのはその判定器の `SKILL.md` と入力ファイル1つだけで、`key.json`・`data/human-evals/`・他のレポートは読ませない。お題ごとに独立に判定させ、`blind.ts` 冒頭にある形式で JSON を書かせる。
     `diversity-check` には `sets-<n>.md`、`naive-pairwise` には `pairs.md`、それ以外には `pool-<n>.md` を渡す。`funniness-score` は2回実行する。
   - 判定器の出力ごとに
     `npm run validate:blind -- unblind <blind dir> <format> <out-1.json> <out-2.json> <run> <model>`
     を実行する。サブエージェントの文章レポートは `prompt-reports/` に残す。判定器が失敗した「理由」がわかる。
3. `npm run validate:agreement -- reports/validation/<date>` で `summary.md` を書き出す。解釈は同じディレクトリの `notes.md` に書く。

## `summary.md` の読み方

最新の `notes.md` から読む。`summary.md` で見るべき行は少ない。
AUC 0.5 はチャンスレベル。`length` ベースラインを上回らない判定器は面白さを測っていない。

`skills/` は退行していないかを確認する:

- `trait-check`（`concrete`、`−indirect`）: AUC の区間の下限、`sets`
- 被りチェック表の `overlap-check`: `false flags` が 0 のままであること。被りを探させると判定器は被りを捏造しがち（`reports/validation/2026-09-23-overlap/notes.md`）
- 一対比較表の `trait-compare`: `in-set`、`confident`。確信度の高い判定が平均より悪いなら、ノイズではなく人間と逆向き

`research/` は、`naive` / `naive-pairwise` / `length` ベースラインを上回るものが出てきたかを見る。

`gate` 列は、ogiri-ai のゲートチェックで人間の判定の代わりに使えるほどの指標を示す。2026-09-24 時点で該当するものはない（`reports/validation/2026-09-24/notes.md`）。

## 旧名

2026-09-24 以前のレポートは旧ツール名を使っている:

| 旧名 | 現在 |
|---|---|
| `fun-check` Step 3（被り） | `skills/overlap-check` |
| `fun-check` 絵なし・長さ | `skills/trait-check`（`concrete`、`indirect`） |
| `humor-rank` | `skills/trait-check` の `scripts/compare.ts` |
| `fun-check` のその他のフラグ | `research/risk-flags` |
| `humor-eval` | `research/funniness-score` |
| `diversity-check`、`cluster-fit-check` | `research/`（同名） |
