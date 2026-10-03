# 第1ラウンドの検証結果

**バリエーション1・2とも `not passed`。** 軽量ループ2条件＋1回のゲート。独立18生成、90回答。

形式・20文字・括弧の上限は90本すべて合格。候補だけから当たりを抜き出して検査していない。

| お題 / 条件 | 被り組数 | concrete | indirect | 勝率 | 結果 |
|---|---:|---:|---:|---:|---|
| codex/baseline | 0 | 0.738 | 0.081 | — | reference |
| codex/variation-1 | 2 | 0.682 | 0.087 | 62% | not passed |
| codex/variation-2 | 1 | 0.644 | 0.077 | 40% | not passed |
| sylvanian/baseline | 2 | 0.849 | 0.115 | — | reference |
| sylvanian/variation-1 | 4 | 0.867 | 0.125 | 42% | not passed |
| sylvanian/variation-2 | 2 | 0.878 | 0.107 | 56% | mechanically passed |
| weather/baseline | 0 | 0.576 | 0.145 | — | reference |
| weather/variation-1 | 1 | 0.541 | 0.114 | 58% | not passed |
| weather/variation-2 | 2 | 0.699 | 0.141 | 54% | not passed |

勝率は具体性・直球さの比較であり、面白さの確率ではない。引分は半勝として計数。数値上昇は採用の理由にしない。baselineの2回差と全比較の内訳は `gate-summary.json` に残した。

バリエーション1は3題で被りがbaselineより多く、シルバニアでは説明的さと比較勝率にも差が出た。バリエーション2はCodexと天気で被りがbaselineより多い。Codexの比較勝率40%はbaseline自身の2回間のばらつきの範囲なので、独立の差し戻し理由には数えない。

`sameMaterial` の分布の増加と2回間の素材再使用も警告として記録した。仕組み・文型・比喩体系の群数は診断専用。人間はCodexの家族・会社への偏りと、天気の全条件の低評価を指摘した。

人間の明示的な組の優劣はないので、回答の当たりの数からセットの勝敗を推定していない。今回の人間評価は `../humor-skills/data/human-evals/ogiri-ai/2026-10-03-prompt-comparison.md/.json` に保存済み。

次の介入: 1場面への固定の解除と、人間の情けなさの必須条件の解除を別案にする。
