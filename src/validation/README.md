# 検証（人間の判定との一致）

判定器は `data/human-evals/` の人間の判定とだけ比べる。別の判定器とは比べない。
出力は新しい `reports/validation/<date>/` に置く。

## 手順

1. **Jev モード** — 1コマンドで、すべての判定器（`skills/` と `research/`）の実スクリプトと、ルーブリックなしのベースラインを2回ずつ実行する（再テスト信頼性のため）。`trait-check` の `versions.ts` も、版の比較のラベルがあるお題に対して実行する:
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
3. `npm run validate:agreement -- reports/validation/<date>` で `summary.md` と、同じ内容を機械可読にした `summary.json` を書き出す。解釈は同じディレクトリの `notes.md` に書く。
4. `npm run status` で、リポジトリ直下の `STATUS.md` を最新の検証から作り直す。現在の値を知りたい人とエージェントが読むのはこのページで、ほかの文書には数値を写さない。人間評価のセッションや台帳（`data/ledger/`）を足したときも実行する（`npm test` が、作り直していない `STATUS.md` を検出する）。

## `summary.md` の読み方

最新の `notes.md` から読む。`summary.md` で見るべき行は少ない。
AUC 0.5 はチャンスレベル。`length` ベースラインを上回らない判定器は面白さを測っていない。

`skills/` は退行していないかを確認する:

- `trait-check`（`concrete`、`−indirect`）: AUC の区間の下限、`sets`
- 被りチェック表の `overlap-check`: `false flags` が 0 のままであること。被りを探させると判定器は被りを捏造しがち（`reports/validation/2026-09-23-overlap/notes.md`）
- 一対比較表の `trait-compare`: `in-set`、`confident`。確信度の高い判定が平均より悪いなら、ノイズではなく人間と逆向き
- 「版の比較」の節（`trait-check` の `scripts/versions.ts`）: 題ごとの表では、人間が変更後の版を選んだお題や引き分けとしたお題で、`p < 0.05` の規則が合図を出さないこと。`> noise (old)` の行は、置き換える前の規則との比較用。「まとめた読み」の表は、版ごとに全題をまとめた読みと、人間の判定に採否の規則（負けが0なら採用可）を当てた結果を並べる。合図が出るべきなのは、規則が `return` の版だけ。対象は、`role` と `sourceOrder` があり、セット単位の判定（`setPreferences` か `setTies`）が付いたお題（`data/human-evals/README.md`）。受付箱から来た最終チェックは、自動でこの形になる

`research/` は、`naive` / `naive-pairwise` / `length` ベースラインを上回るものが出てきたかを見る。

`gate` 列は、ogiri-ai のゲートチェックで人間の判定の代わりに使えるほどの指標を示す。該当するものがあるかは `STATUS.md` の要点に出る。表の下の1行は、今のラベル数で、真の一致率が 0.7〜0.9 の判定器が条件を満たす確率。これが低いうちは、空欄を「使える判定器がない」と読まない。

### 未使用ラベルの節

判定器の質問や閾値は、人間のラベルを見て書いている。同じラベルで測った一致は楽観的に出るので、最後の節で、判定器ごとに「質問を確定した日より後のセッション」のラベルだけで測り直す。

- 確定した日は `src/validation/judges.ts` の `frozen`。人間のラベルを見て質問や閾値を変えたら、その日付に更新する
- `frozen` のない判定器（`research/` とベースライン）は、最も新しい `frozen` と同じ日からのラベルで測る。`skills/` の判定器と同じ土俵で比べるため
- `skills/` に置く根拠はこの節の値。全ラベルの表で区間が 0.5 を超えていても、この節で超えていなければ再現していない
- 件数が少ないうちは区間が広い。区間が 0.5 をまたぐのは「効かない」ではなく「まだ分からない」

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
