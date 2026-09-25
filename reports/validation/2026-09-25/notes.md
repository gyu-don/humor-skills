# 再編後の確認 2026-09-25 — 所見

数値は [summary.md](summary.md)。判定器の中身（質問文）は変えず、置き場所と名前を変えた再編の後に、同じ検証を回した。

## 再編

- `skills/`（自動テスト、Jev のみ）: `overlap-check`（旧 fun-check の被りチェック）、`trait-check`（旧 fun-check の絵なし・長さ → `concrete`・`indirect`、旧 humor-rank → `scripts/compare.ts`）
- `research/`（検証を続けるもの）: `funniness-score`（旧 humor-eval）、`risk-flags`（旧 fun-check の残り）、`diversity-check`、`cluster-fit-check`
- Jev で機能するもののプロンプト版は削除した（旧 humor-rank の手順、旧 fun-check の絵なし・長さ・被り）
- `trait-check` の一対比較からは、比較用に残していた総合の1問を外した。代わりに、ベースライン `naive-pairwise`（「どちらが面白いか」）を検証スクリプトで回す

## 結果

[2026-09-24](../2026-09-24/notes.md) と同じ値が再現した（差は実行ごとの揺れの範囲）。

| 判定器 | 指標 | 2026-09-24 | 2026-09-25 |
|---|---|---|---|
| `overlap-check` | `sameMaterial` AUC・誤検出 | 0.94・0/10 | 0.94・0/10 |
| `trait-check` | `concrete` AUC・セット | 0.66・6/7 | 0.67・6/7 |
| `trait-check` | `−indirect` AUC | 0.64 | 0.62 |
| `trait-compare` | `probA` セット内・13組 | 0.66・0.77 | 0.64・0.77 |
| `naive-pairwise`（Jev） | セット内・確信度の高い判定 | 0.44・0.32（候補の実験） | 0.42・0.33 |

`research/` の判定器は、どれもベースラインを上回っていない。`risk-flags` の合計は、絵なし・長さを抜いたので AUC 0.55 に下がった（旧 fun-check の合計は 0.64〜0.67）。

プロンプト版（`funniness-score`・`risk-flags`・`diversity-check`）は再実行していない。手順の中身は変えていないので、前回までの結果（旧名）を参照する。
