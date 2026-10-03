# 2026-10-03 プロンプト3条件比較

## 比較設計

- ベースライン: 開始時の `skills/ogiri-ai/SKILL.md` をそのまま保存する。
- バリエーション1: 伝わる候補にも省略・推論を強制するため、ボケが遠回しになり、発話を求めるお題でも状況描写に変わるという仮説。直接形を既定にし、ひねりは説明的な候補を直す場合だけ使う。
- バリエーション2: バリエーション1から1点変更する。強いズラし3本と全候補の2段階過激化を強制すると、情景よりノルマが優先され、前提の勘違い・極端な数量に収束するという仮説。過激化を弱い候補だけの修理にし、強さの配分を選抜条件から外す。
- 各条件は同じモデル・同じ努力度・同じ依頼文で生成する。別条件や過去の回答を生成者に渡さない。
- 固定お題: `Codexのイケてる使い方`、`シルバニアファミリーの新作`。
- 未見カテゴリ: `絶対に信用できない天気予報士の一言`。形式適合も確認する。
- まず固定2題の第1回を軽量ループとして検査する。その後、全3題の独立2回を合算し、各条件・各お題10本でゲート検査する。
- 人間用には各条件の第1回5本をすべて提示する。お題ごとに条件順を無作為化し、A/B/Cだけを示す。第2回も別ファイルで全部保存し、当たりだけの抜き出しはしない。
- 自動検査の数値は悪化の検出だけに使い、面白さはユーザーが判定する。現時点の最新検証 `../humor-skills/reports/validation/2026-09-25/summary.md` に `gate: yes` の面白さ評価器はない。
- 本採用は人間の比較を反映して決める。候補の作成と検査は評価待ちで停止しない。

## 参照

- [OpenAI: Rethinking skills and prompts for GPT-6 Astra](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra)（2026-09-11、2026-10-03確認）: 細かすぎるレシピは出力を縛る可能性がある。これは大喜利での効果を保証しないため、今回の比較で検証する。
- [OpenAI: Prompt engineering](https://developers.openai.com/api/docs/guides/prompt-engineering)（2026-10-03確認）: 明示した出力条件と評価による改善。
- [Anthropic: Prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)（2026-10-03確認）: 意図と出力条件を明確にする。具体例追加は本リポジトリの Example Firewall を優先して行わない。
- `../humor-skills/data/human-evals/ogiri-ai/findings.md`: 2026-07-11の型の収束、2026-09-15の直球表現、2026-09-22の発話形式違反。

## iteration 1（light）

仮説: 全候補へのひねり強制が、説明的な間接表現と回答形式違反を生む。
変更: バリエーション1。ひねりを条件付き修理へ降格し、お題が求める形を保つ。
お題: 固定2題。
overlap-check:
trait-check:
手計数:
人間ブラインド比較: 未実施。
判断: 実測結果は下の確定記録に記載。

## iteration 2（light）

仮説: 過激化と強さの配分ノルマが、前提違い・数量の誇張への収束を招く。
変更: バリエーション2。バリエーション1を土台として、過激化と配分だけを任意の修理に変更する。
お題: 固定2題。
overlap-check:
trait-check:
手計数:
人間ブラインド比較: 未実施。
判断: 実測結果は下の確定記録に記載。

## gate（予定）

仮説: 上記の2条件が未見のお題でも形式と具体性を損なわないか。
お題: 固定2題＋未見1題、各条件独立2回、各10本。
overlap-check:
trait-check（ベースライン平均・2回の差・総当たり勝率）:
手計数（「」・形式・仕組み・文型・比喩体系・2回間の素材）:
ハード検査:
ベースラインに対する警告:
人間ブラインド比較: 未実施。
結果: 未実施。

## 第1ラウンド確定記録

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

### 軽量ループの全計数

- codex/baseline: nearDuplicates=0、sameMaterial最大=0.30、concrete=0.624、indirect=0.084、括弧=0、形式違反=0、仕組み群=1、文型群=0、比喩体系群=0。
- codex/variation-1: nearDuplicates=0、sameMaterial最大=0.68、concrete=0.716、indirect=0.094、括弧=0、形式違反=0、仕組み群=1、文型群=0、比喩体系群=0。
- codex/variation-2: nearDuplicates=0、sameMaterial最大=0.33、concrete=0.684、indirect=0.072、括弧=0、形式違反=0、仕組み群=0、文型群=0、比喩体系群=0。
- sylvanian/baseline: nearDuplicates=0、sameMaterial最大=0.24、concrete=0.886、indirect=0.122、括弧=0、形式違反=0、仕組み群=0、文型群=1、比喩体系群=0。
- sylvanian/variation-1: nearDuplicates=0、sameMaterial最大=0.63、concrete=0.842、indirect=0.112、括弧=0、形式違反=0、仕組み群=2、文型群=0、比喩体系群=0。
- sylvanian/variation-2: nearDuplicates=0、sameMaterial最大=0.56、concrete=0.876、indirect=0.100、括弧=0、形式違反=0、仕組み群=1、文型群=0、比喩体系群=0。

iteration 1: Codexの具体性は上がったが、シルバニアでは0.044低下。採用根拠にせず比較対象として保持。iteration 2: variant1よりシルバニアの具体性・直球さが戻ったが、採用根拠にはしない。ユーザー指定の3条件比較を完成させるためゲートを実施。両条件not passed。
