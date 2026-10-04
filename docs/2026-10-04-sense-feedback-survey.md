# AIに「持っていない感覚」を教える仕組み — 文献・実装の調査（2026-10-04）

目的: 笑いや味覚のように AI が持っていない感覚を、人間のフィードバックで継続的に教え込む仕組みについて、既存の方法論（論文・実装）を調べ、humor-skills の次の一手と、レシピなど別の感覚への横展開の型を出す。

調べた範囲:

- humor-skills の現状（`data/human-evals/`、`src/validation/`、`reports/validation/*/notes.md`、`skills/`、`research/`）
- エージェントの記憶の実装: OpenClaw、Hermes Agent（Nous Research）、Letta、Mem0、Zep
- エージェント記憶の研究: Generative Agents、Reflexion、Voyager、ExpeL、Agent Workflow Memory、Memory-Skill Isomorphism、Adaptation of Agentic AI サーベイ
- 嗜好の学習: Inverse Constitutional AI、PRELUDE/CIPHER（編集からの嗜好推論）、個人別報酬モデル（VPL・PAL・LoRe・MRM）、DivPO、GEPA、Rubrics as Rewards / Checklist Feedback
- 笑いの計測: Oogiri-GO/CLoT、Oogiri 6軸評価、Oogiri-Master、Who Laughs with Whom、SemEval-2026 Task 1（MWAHAHA）、HumorRank、Mirowski らのコメディアン研究
- 知覚指標の学習: LPIPS（BAPPS）、PickScore（Pick-a-Pic）
- 味覚のモデリング: FEAST（ワイン）、ビール・コーヒー・果実のパネルデータ研究

`research/README.md` が「この環境からは本文を確認できていない」としていた arXiv:2512.21494（Oogiri-Master）と arXiv:2601.03103（Who Laughs with Whom）の本文は今回読めたので、§5 に中身を書いた。

---

## 0. 結論

1. **「感覚を教える」で実績のある型はひとつしかない。** 比較判定（一対比較・相対配置）を集め、絶対点ではなく比較から嗜好モデルを作り、それを生成の選抜と回帰テストに使う。画像の知覚距離（LPIPS）、画像生成の好み（PickScore）、笑い（SemEval-2026 優勝システム、HumorRank）、味覚（FEAST）がすべてこの型。到達精度はどれも 7 割前後で止まる。人間どうしの一致がその程度だから。
2. **笑いで LLM 判定が人間と一致するのは、一対比較 + 記述的な特徴のときだけ。** 「面白いか」を絶対採点させると人間との相関は 0.17〜0.27 で、LLM は新規性を、人間は共感を重視する（Oogiri 6軸評価）。一方、一対比較で笑いの機構（不調和・簡潔さ・視点転換）に接地させると、人間-LLM の一致が人間-人間の一致と区別できない水準になる（HumorRank、Oogiri-Master）。humor-skills で Jev の面白さ採点が逆向き（AUC 0.37〜0.44）、記述的な trait 質問が 0.62〜0.67 だった結果は、この文献と整合する。
3. **記憶システムの共通構造は「生ログ → 蒸留した所見 → 手順（スキル）」の 3 層と、層を上がるときのゲート。** OpenClaw（日次メモ → MEMORY.md → USER.md、dreaming で昇格）、Hermes（セッション DB → MEMORY.md/USER.md → 自動生成スキル、書き込み承認）、Generative Agents（memory stream → reflection）が同じ形。humor-skills はすでに 3 層を持っている（`data/human-evals/*.json` → `findings.md` → ogiri-ai の `SKILL.md` の条件付き修理ルール）。欠けているのは、(a) 所見を機械可読にして**所見ごとに人間ラベルの再現率を測る**こと（Inverse Constitutional AI の手順そのもの）、(b) 昇格ゲートの自動化、(c) 評価側で過去の類似判定を検索して使うこと。
4. **自己改善ループでは LLM 判定を「神託」ではなく「助言者」に降格し、決定的な検査と凍結した検証セットでゲートする**（PROCTOR）。humor-skills の「決定的検査はコード、判定器は下限確認にだけ使う、面白さは人間」はこの結論と同じ。不足は、質問作成に一度も使わない**凍結検証セット**と、ハックを検出する**カナリア**。
5. **勝ちパターンを正の指示にするとハウススタイル化する**という 2026-07-11 の所見は、文献では diversity collapse / reward hacking として知られた一般現象。対策も文献にある。条件付きの指示（Oogiri-Master では「迷ったときだけ特徴を参照せよ」が無条件参照より良かった）、閾値を超えた候補の中から多様性で選ぶ DivPO、判定値を最大化目標にしないこと。
6. **レシピへの横展開は、笑いより客観的に検査できる部分が多い**（分量比・温度・時間・アレルゲン）ので、決定的検査の比重が上がる。嗜好は食品科学の定石どおり、少数の感覚軸の JAR 尺度（just-about-right: 塩味・酸味・甘味・辛味・食感）と総合の比較で集める。評価器に予測させるのは「おいしいか」ではなく「この人の JAR がどの軸でどちらにずれるか」。

---

## 1. 先行例: 学習された知覚指標

AI が持っていない感覚を人間の判定から作った、再現性のある成功例。

| 事例 | 人間データ | モデル | 到達精度 |
|---|---|---|---|
| LPIPS（画像の知覚的類似） | BAPPS: 2 択強制選択（2AFC）約 36k 件 | 深層特徴の距離を人間判定に合わせて重み付け | 2AFC 一致 68〜70% |
| PickScore（画像生成の好み） | Pick-a-Pic: 実ユーザーの一対選択 50 万件以上 | CLIP を InstructGPT の報酬モデルと同じ目的で微調整 | 70.5%（専門家の人間 68.0%） |
| FEAST（ワインの風味） | 7 回の試飲会・256 人が「紙の上に似たものを近くに並べる」（napping） | 画像・レビュー・人間の配置を共有埋め込みに | 個人の好みの予測、推薦 |
| ビール 250 銘柄 | 訓練パネルの記述 + 消費者評価 + 化学量 200 項目 | 勾配ブースティング | 従来統計を有意に上回る |
| コーヒー（UC Davis） | 消費者 liking + 感覚データ | 回帰 | 酸味・風味強度・甘味が最も予測する |
| 果実（PNAS） | 消費者パネル + 化学量 | XGBoost など | 酸味強度 0.87、総合 liking 0.46 |

共通点:

- **入力は比較か相対配置。** 絶対点は人によってスケールが違い、同じ人でも日によって動く。
- **中間に客観的に測れる特徴**（化学量、言語特徴）を置き、嗜好はその上の重みとして学ぶ。感覚そのものを直接は学ばない。
- **個人差は潜在変数。** 集団でモデルを作り、少数データで個人に合わせる（VPL は VAE で個人の潜在嗜好を推論、PAL・LoRe・MRM は共有基底の重み付き和で few-shot 適応）。
- **精度の天井は人間どうしの一致率。** 総合 liking の予測（果実 0.46）は、個別の感覚軸（酸味 0.87）よりはるかに難しい。

含意: 「面白さ」という総合軸を直接予測するのは、果実の「総合 liking」を予測するのと同じ最難問。個別の軸（短さ、具体性、視点転換）に分解したものから積み上げるのが、他分野で通った道。目標とする一致率は、人間の再テスト一致率（humor-skills では 2026-09-23 ブラインド再評価の 10/11）を上限の目安にする。

---

## 2. フィードバックをどう集めるか

### 2.1 形式

| 形式 | 長所 | 短所 | 文献 |
|---|---|---|---|
| **一対比較**（A/B） | 最も信号がきれい。スケールのずれがない。Bradley-Terry でランキングに変換できる | 1 回で得る情報が 1 bit | SemEval-2026 Task 1 優勝システムは Humor Arena で 2.5K ペアを集め嗜好モデルを訓練。HumorRank は Adaptive Swiss トーナメント + Bradley-Terry |
| **セット内の当たり選択**（humor-skills の `hits`） | 速い。1 セットから複数ペアが作れる | 当たりどうし・外れどうしの順序は得られない | humor-skills 現行 |
| **編集差分** | 「どう直せば良かったか」が入る。嗜好の記述を推論できる | 添削の労力 | PRELUDE/CIPHER（NeurIPS 2024）: ユーザーの編集から潜在嗜好の記述を推論し、似た文脈 k 件の嗜好を集約してプロンプトに入れる |
| **自然言語の理由** | 所見の原料。「なぜ外れたか」がわかる | 数値化できない。そのまま指示にするとアトラクター化する | ILF（Scheurer ら 2023）、Reflexion |
| **多次元の絶対尺度**（6 軸 0〜4 など） | 分析に使える | 人間どうしでも一致が低く、LLM との相関も低い | Oogiri 6 軸評価（相関 0.17〜0.27） |

推奨: **一対比較を主、理由を副**にする。humor-skills の「数値は `.json`、理由は `.md`」という分離はこの形になっている。`setPreferences`・`pairPreferences` を増やし、`hits` だけのセッションを減らす。

### 2.2 どのペアを聞くか（能動的選択）

人間の判定は高価なので、どのペアを見せるかで情報量が大きく変わる。

- **理論:** dueling bandits / interactive preference elicitation。不確実なペアを優先し、勝者候補集合を絞る（Interleaved Filter など）。
- **実務で効くもの:**
  1. 判定器が**高い確信度で外した**ペア。LangSmith の Align Evals の知見では、人間が判定器を修正した事例が最も情報量の多い few-shot になる。humor-skills の `confident` 列はこのための指標。
  2. 判定器どうし（Jev 版とプロンプト版、2 回の実行）が**割れた**ペア。
  3. 閾値付近のペア（`sameMaterial` 0.6〜0.7 など）。
  4. 新しい版 vs 旧版の、同じお題のペア（生成スキルの変更が効いたかを直接答える）。
- **humor-skills での実装:** `npm run validate:blind -- make` が出す `pairs.md` を、上の優先度でソートして上位 20〜30 組だけ出す。順序は毎回入れ替える。

### 2.3 バイアス管理

- **ブラインド**（出所を伏せる）: 現行の `blind` フィールド。
- **順序の入れ替え:** 一対比較の位置バイアスは 10〜15 ポイント、冗長バイアスは 15〜30 ポイントと報告されている（Wang ら 2023 「LLMs are not Fair Evaluators」ほか）。人間の判定でも A/B の順序をセッションごとに乱数化する。判定器にはスワップして 2 回聞き、両方で勝った場合だけ勝ちとする。
- **全出力を残す:** 当たりだけ残すと外れがなく検証に使えない（2026-09-22 の失敗、README 2 項）。
- **過去ラベルを書き換えない**（README 4 項）。Oogiri-Master は約 100 人が他人の票を見ずに独立採点しており、同じ理由（人気信号の混入を避ける）。
- **評価者を記録する**（`rater`）。Who Laughs with Whom は投票ログでユーザーをクラスタに分け、クラスタごとに Bradley-Terry-Luce で解釈可能な特徴の重みを推定した。LLM の好みは特定クラスタに似ており、ペルソナで誘導できる。Oogiri-Master はクラウドワーカーと platform users の demographic mismatch を指摘している。**1 人の感覚を教えるのか、聴衆の感覚を教えるのかを最初に決める。** 1 人なら評価者 1 人のデータで十分だが、`cluster-fit-check` のような聴衆モデルは検証できない（`research/README.md` が書いているとおり）。

---

## 3. どう溜めるか: 記憶アーキテクチャの比較

### 3.1 各システムの構造

| システム | 層 | 書き込みの契機 | 昇格のゲート | 取り出し |
|---|---|---|---|---|
| **Generative Agents**（Park ら 2023） | memory stream（自然言語の全経験）→ reflection（上位の推論） | 毎イベント。重要度の累積が閾値を超えたら reflection | 重要度スコア | 関連度 × 新しさ × 重要度 |
| **OpenClaw** | `memory/YYYY-MM-DD.md`（日次の作業メモ）→ `MEMORY.md`（恒久的な事実・決定）→ `USER.md`（安定した嗜好を**指示形**で、observed-date と active/superseded のメタデータ付き）。`DREAMS.md` は昇格の履歴 | 作業中に随時。compaction 直前に「重要な文脈を保存せよ」という無言のターン（memory flush） | **dreaming**: スコア・想起頻度・クエリ多様性の閾値を通ったものだけ長期記憶へ。履歴は人間が読める | `MEMORY.md`/`USER.md` はセッション開始時に注入（予算超過は切り詰め）。日次メモは `memory_search`（ベクトル + キーワードのハイブリッド）で都度検索 |
| **Hermes Agent** | セッション DB（SQLite + FTS5 全文検索）→ `MEMORY.md`（2,200 字）/ `USER.md`（1,375 字）→ `~/.hermes/skills/`（手順を自動でスキル化） | 「複数ステップの手順を見つけた」「行き詰まりから抜け出す道を見つけた」「ユーザーが直した」とき `skill_manage` で書く | `write_approval`: 書き込みを `pending/` に待機させ `/skills approve` で承認。lint が incident-log の肥大を警告。容量超過はエラーになり `replace` で圧縮を強制 | 2 ファイルはセッション開始時の凍結スナップショットとして注入（プレフィックスキャッシュのため）。スキルは一覧 → 本文 → 参照ファイルの段階開示 |
| **Letta**（旧 MemGPT） | core / recall / archival の 3 層 | エージェント自身が編集 | sleep-time compute: 対話の合間に別エージェントが記憶を整理・先読み | core は常駐、recall/archival は検索 |
| **Mem0 / Zep** | Mem0 は事実抽出のベクトル優先、Zep は時間付き知識グラフ | 自動抽出 | 重複・矛盾の解消 | 検索（LoCoMo・LongMemEval で比較） |
| **Voyager / ExpeL / AWM / Reflexion** | 経験 → 実行可能スキル / 洞察 / ワークフロー / 反省文 | タスク成功・失敗時 | 成功したものだけ保存（選択が品質管理） | 自然言語の説明で検索 |
| **Memory-Skill Isomorphism**（2026） | スキルを記憶の容器に統一。常駐 1,024 字 + 索引 + 詳細ファイルの段階開示 | 履歴は追記、現状は書き換えて再検証 | 運用例では書き込み 4 件に 1 件だけ台帳へ | 常駐 + BM25（差は無視できる程度） |
| **Inverse Constitutional AI**（ICLR 2025） | 一対比較 → 自然言語の原則集（constitution） | 候補原則を LLM で生成 → 埋め込みでクラスタリング・重複除去 | **各原則が人間ラベルをどれだけ再現できるかをテストし、通ったものだけ残す** | 原則を LLM 判定器に渡す。2026 の追試: 同じ原則でも executor（LLM 判定 vs 多数決）で一致 73%、精錬で 78%。「原則 + executor のシステム」として評価せよ |

Hermes のスキル本文の節構成（When to Use / Procedure / Pitfalls / Verification）と、OpenClaw の「行動に影響する記憶」の 5 項目（何が行動を変えるか・いつ適用されるか・いつ失効するか・何を避けるか・出典）は、そのまま所見のテンプレートとして使える。

### 3.2 humor-skills への対応

| 層 | humor-skills の現状 | 不足 |
|---|---|---|
| 生ログ（episodic） | `data/human-evals/<source>/<date>.json/.md`。`rater`・`blind`・全出力・一対比較・被り判定 | なし。この層は文献の水準を満たしている |
| 所見（semantic） | `findings.md`（日付を引用して手書き） | 機械可読でない。所見ごとの**検証状態・出典・有効/失効**がない。OpenClaw の observed-date / superseded に相当するものがない |
| 手順（procedural） | `skills/`（検証済み判定器）、ogiri-ai の `SKILL.md`（条件付き修理ルール）、Example Firewall | 所見 → ルールの昇格が手動。昇格の基準（人間ラベルの再現率）が書かれていない |
| 検索（retrieval） | なし | 評価側で過去の類似判定を参照しない（CIPHER の k 近傍に相当するものがない） |
| 統合（consolidation） | 人手で `findings.md` を更新 | 新セッション追加時に所見候補を自動提案し、人間が承認する「dreaming」がない |

### 3.3 所見の推奨スキーマ

`findings.md` の各項目を、次の形で `data/human-evals/<source>/principles.json` に並行して持つ。

```jsonc
{
  "id": "concept-is-not-a-picture",
  "statement": "質感のある物か起きている現象が出てこない回答は、理屈が通っていても選ばれない",
  "kind": "negative",                     // negative / conditional-repair / positive
  "evidence": ["2026-07-11/firsttake/...#2", "2026-09-22/..."],
  "first_observed": "2026-07-11",
  "status": "validated",                  // candidate / validated / retired
  "reconstruction": { "auc": 0.67, "pairs": 60, "date": "2026-09-24" },
  "scope": ["evaluator:trait-check.concrete", "generation:conditional-repair"],
  "superseded_by": null
}
```

ICAI の手順と humor-skills の「所見 → 1 問の記述的質問 → 一致を測る → 通ったものだけ使う」（`reports/validation/2026-09-24/notes.md` の提案 1）は同じもの。`validate:agreement` に「原則 × ペア」の表を足せば、所見の検証を自動化できる。`kind: positive` の所見は、07-11 の教訓どおり既定で生成側に入れず、`conditional-repair` に書き直してから入れる。

---

## 4. どう使うか: 4 つの経路

| 経路 | 必要データ量 | 安全性 | 文献 |
|---|---|---|---|
| **A. 評価器の較正** | 数十〜数百ペア | 高い。生成に触らない | few-shot に人間の修正例（Align Evals）、原則（ICAI）、記述的な特徴質問（Oogiri-Master） |
| **B. 生成プロンプトの改訂** | 所見数件 | アトラクター化のリスク | GEPA: 評価のテキストを読んで指示を反省的に変異させる。RL（GRPO）より最大 35 倍少ない試行で平均 +10%。ただし**判定器が人間と一致していなければ判定器をハックするだけ** |
| **C. 選抜（best-of-N）** | 嗜好モデル or 検証済み判定器 | 中。多様性が落ちやすい | SemEval-2026 優勝: 多様な候補を多く生成 → 比較で学んだ嗜好モデルで選抜。DivPO: 閾値を超えた候補の中で最も多様なものを選ぶ（物語の多様性 +74.6%、勝率維持） |
| **D. 重みの更新**（DPO・報酬モデル） | 数千ペア以上 | 低。diversity collapse | 個人別報酬モデル（VPL・PAL・LoRe・MRM）は少数データで個人に適応するが、集団データが前提。Oogiri-GO（13 万件、likes 付き）を集団側に使う選択肢はある |

現状のデータ量（一対比較 60 組）では **A と B** が現実的で、C は検証済み判定器（`overlap-check` と `trait-check` の下限確認）だけで始められる。D は時期尚早。

### 4.1 B の注意: 評価テキストの源を人間に限る

GEPA が RL より効くのは「スカラー報酬より自然言語の評価のほうが情報が多い」から。だが ogiri-ai の場合、面白さを判定できる自動評価器がない（`gate: yes` が 0）ので、GEPA 型のループで反省の材料にできるテキストは **人間の `.md` コメントと、検証済み判定器の悪化報告だけ**。それ以外の LLM 評価テキスト（`funniness-score` の改善メモなど）を生成スキルの改訂に流すと、LLM の好み（新規性重視、「equal parts absurd and oddly profound」型の表現への収束）を学習する。

Mirowski らのコメディアン 20 人の研究で、安全調整された LLM は「1950 年代のクルーズ船の無難なネタ」に寄ると評された。2026-09-15 の「当たり障りのない譲歩案に寄った」所見と同根で、モデル側の既定の引力。これに対抗する指示は正の指示になりやすいので、「無難になったら戻す」形の条件付き修理として書く。

### 4.2 ガードレール（PROCTOR の 5 点と humor-skills の対応）

| PROCTOR | humor-skills / ogiri-ai |
|---|---|
| 判定は助言、決定的検査でゲート | 文字数・形式・括弧はコード、`nearDuplicates` は絶対条件（済） |
| 凍結した検証セット | **未整備。** 09-24 の質問は検証データを見た所見から作られ、同じデータで一致を測っている（notes の過学習注記）。質問作成に使わない人間セッションを 1 つ以上「凍結」として分け、昇格判定にだけ使う |
| カナリア（ハックを検出する事例） | **未整備。** 例: 「痕跡 + 小さい数字」型だけで構成したセット、概念だけのセット、同一素材のセット。判定器がこれを高く評価したら退行 |
| 役割分離（診断と実行を別エージェント） | ogiri-ai の gate と生成が同じエージェントなら分ける |
| 密閉されたサンドボックス | Example Firewall（評価例を生成プロンプトに入れない）が同じ役割 |

---

## 5. 笑い固有の整理

### 5.1 文献の LLM 判定の成績

| 研究 | 形式 | 結果 |
|---|---|---|
| Oogiri 6 軸評価（AAAI 2026, arXiv:2511.09133） | 5 点絶対尺度 × 6 軸 | Overall Funniness の人間との Spearman: Claude Sonnet 4 0.266、GPT-4.1 0.224、Gemini 2.5 Pro 0.169。**LLM は Novelty を、人間は Empathy を重視。** 生成能力は人間の低〜中位 |
| Oogiri-Master（arXiv:2512.21494） | 一対比較 5 タスク、約 100 回答 × 約 100 人の独立採点 | GPT-5 67.6%、Claude Opus 4 68.7%、クラウドワーカー 68.7%。特徴を「迷ったときだけ参照」で GPT-5 70.7%。無条件参照は一部モデルで悪化（特徴の大きさに過剰依存） |
| HumorRank（arXiv:2604.19786） | Adaptive Swiss + Bradley-Terry、笑いの機構に接地した判定 | 2 つの LLM 判定の順位相関 τ = 0.889。難しい対戦で人間-LLM 一致 ≒ 人間-人間。品質は不調和・簡潔さ・エスカレーション・不条理と相関し、モデルサイズとは相関しない |
| SemEval-2026 Task 1 優勝（arXiv:2606.00022） | 2.5K 一対比較 → 嗜好モデル → 選抜 | 絶対点ではなく比較から学ぶモデルがベースラインを一貫して上回り、ドメイン転移も強い |
| Who Laughs with Whom（EMNLP 2026, arXiv:2601.03103） | 投票ログのクラスタ × BTL | クラスタごとに嗜好が異なる。LLM は特定クラスタに似る。ペルソナで誘導可 |
| Cards Against LLMs ほか | 一対比較 | LLM どうしの一致 > LLM-人間の一致。差は位置バイアスと内容の好みで一部説明される |

Oogiri-Master が報告した、人間の高評価と結びつく特徴（Cohen's d）:

| 特徴 | d | 向き |
|---|---|---|
| 視点転換（perspective shift） | 0.50 | 高いほど良い |
| 曖昧性の利用（ambiguity exploitation） | 0.42 | 高いほど良い |
| 不調和の解消（incongruity resolution） | 0.36 | 高いほど良い |
| 長さ | −0.28 | 短いほど良い |
| 語彙の新規性 | −0.21 | 低いほど良い |
| surprisal・意味距離・品詞比率 | 小未満 | 有意だが効果量が無視できる |

### 5.2 humor-skills の結果との照合

- Jev の面白さ採点が逆向き（AUC 0.37〜0.44）、ルーブリックなしの「どちらが面白いか」が確信度の高い判定ほど外れる（0.32）→ 6 軸評価の「LLM は Novelty 重視」と一致。「意外性だけの回答を過大評価する」は文献で確認された傾向。
- `trait-check` の `concrete` 0.67・`indirect` 0.62〜0.64 → Oogiri-Master の「短い」「不調和の解消」と同じ種類の記述的特徴。**視点転換・曖昧性の利用は未実装の候補。** 語彙の新規性が負なのは、`risk-flags` の「認知度リスク」と方向が合う。
- 「迷ったときだけ特徴を参照」が勝ったのは、humor-skills の「正の指示を条件付き修理ツールに降格する」と同じ発見で、生成側だけでなく判定側でも成り立つ。
- HumorRank が示す「笑いの機構に接地した一対比較なら人間並み」は、`trait-check` の `compare.ts`（具体物・直球の 2 問の平均）が総合 1 問より良かった（13 組で 0.46 → 0.77）ことと整合する。

### 5.3 推奨

1. 人間の判定は一対比較を主にし、絶対採点は分析用途に限る。
2. `trait-check` に「視点転換」「曖昧性の利用」「不調和の解消」の記述的質問を候補として足し、凍結セットで検証する。
3. 「面白さ」を 1 問で聞く判定器は research に留める。研究目的 2 の観点では、LLM の好みが評価者と一貫して逆向きなこと自体が、6 軸評価の「Novelty vs Empathy」の個人レベルの再現で、報告する価値がある。
4. 評価者が 1 人である限り、作っているのは「この評価者の感覚」。聴衆の感覚にしたい場合だけ複数評価者を集め、クラスタ検証（`research/README.md` の手順）に進む。

---

## 6. 味覚（レシピ）への転用

### 6.1 笑いとの違い

| | 笑い | 味覚（レシピ） |
|---|---|---|
| 1 回のフィードバックのコスト | 秒 | 時間（作って食べる）。1 日 1〜3 件が上限 |
| 結果の依存先 | 文面のみ | 実行（火加減・食材の個体差）に依存。レシピの良さと出来の良さを分けて記録する必要がある |
| 感覚の次元 | 総合 1 軸 + 機構 | 塩味・酸味・甘味・苦味・旨味・辛味・食感・温度・香りと総合。食品科学では**記述分析（訓練パネル）と消費者 liking を分ける**のが定石 |
| 客観的に検査できる部分 | 文字数・形式・被り | 分量比（塩分 %、糖酸比）、温度・時間の整合、アレルゲン、工程の順序、器具 → **決定的検査の比重が大きい** |
| 集団データ | Oogiri-GO 13 万件 | レシピサイトのレビュー（偏りが大きい）、食品科学の sensory データ |

### 6.2 フィードバックのスキーマ案

`data/human-evals/recipe/<date>.json` を humor-skills と同じ規約（1 セッション = `.md` + `.json`、全出力保存、過去を書き換えない）で持つ。

```jsonc
{
  "date": "2026-10-10",
  "source": "recipe-skill",
  "rater": "repo-owner",
  "dishes": [
    {
      "id": "mapo-tofu/v3",
      "recipe_sha": "...",                      // 生成されたレシピ本文のハッシュ
      "changes_from": "mapo-tofu/v2",           // 前回からの差分（スキル側の変更 or 自分の手直し）
      "executed_as_written": true,              // 逸脱があれば false と内容
      "jar": { "salt": 0, "acid": -1, "sweet": 0, "heat": +1, "richness": 0, "texture": -1 },
                                                // just-about-right: −2(足りない)〜+2(強すぎる)、0 がちょうど
      "liking": 7,                              // 9 点 hedonic。比較の補助
      "vs_previous": "better",                  // better / worse / same（一対比較）
      "would_repeat": true,
      "note": "..."
    }
  ],
  "pairPreferences": [ { "a": "mapo-tofu/v3", "b": "mapo-tofu/v2", "winner": "a" } ]
}
```

JAR 尺度は食品産業の消費者調査で標準的に使われ、「どの軸をどちらに動かすか」が直接レシピの修正に落ちる。「おいしいか」の 1 問（liking）は比較の補助に留める。これは笑いの「面白いか」を直接聞かないのと同じ理由。

### 6.3 評価器の構成

1. **決定的検査（コード）:** 総重量に対する塩分 %（和食の汁物 0.8〜1.0% など料理カテゴリ別の帯）、糖酸比、辛味素材の量、温度・時間の物理的整合（中心温度、加熱時間）、アレルゲン・禁忌食材、工程の順序違反。レシピでは、笑いの「文字数・形式」よりずっと多くがここに入る。
2. **記述的 Jev 質問（検証後に `skills/` へ）:** 「この人の過去の JAR から見て、塩味が強く出る方向の変更か」「食感が単調になる構成か」など。人間の JAR ラベルで AUC を測り、通ったものだけ回帰テストに使う。
3. **嗜好プロファイル（USER.md 相当）:** OpenClaw の `USER.md` の形式（指示形、observed-date、active/superseded）で「この人は酸味を既定より弱く、辛味を強く好む（2026-10 観測、麻婆豆腐 v1〜v3）」のように持ち、生成スキルに条件付き修理ルールとして渡す。「酸味を足すな」という正の禁止ではなく、「酸味が目立つ構成なら 2 割減らす」という条件付きにする。

### 6.4 汎用テンプレート: 「感覚スキル」1 セットの構成

笑いとレシピに共通する部品。新しい感覚（例: 音楽の選曲、文体）でも同じ。

1. **生成スキル**（`SKILL.md`）。評価例を含めない（Example Firewall）。所見は条件付き修理ルールとして入れる。
2. **フィードバック収集**: 一対比較を主に、軸別の JAR 的尺度と自由記述を副に。ブラインド、順序乱数化、全出力保存、評価者 ID。
3. **所見の蒸留**: `findings.md`（人間が読む）+ `principles.json`（機械が読む。出典・検証状態・失効）。
4. **判定器の 2 分類**: 人間ラベルと一致したものだけ `skills/`、それ以外は `research/`。「良いか」を直接聞く判定器は research に留める。
5. **ゲート**: 決定的検査（絶対条件）→ 検証済み判定器の下限確認（悪化検出のみ）→ 人間の抜き取り比較。凍結検証セットとカナリアを持つ。
6. **統合（dreaming）**: 新セッション追加時に所見候補を自動生成し、原則ごとの再現率を測り、人間が承認して昇格。

---

## 7. humor-skills への次の一手（優先順）

1. **`principles.json` と原則ごとの再現率**（§3.3）。`findings.md` の既存項目を候補として起こし、`validate:agreement` に「原則 × 人間ペア」の一致表を足す。ICAI と同じ基準（再現率が偶然を上回り、2 回で安定）で `validated` にする。所見の昇格が数値で決まるようになる。
2. **凍結検証セットとカナリア**（§4.2）。質問作成に一度も使わないセッションを決め、昇格の最終判定だけに使う。アトラクター型・概念型・同一素材型の合成セットをカナリアとして `assets/` に置き、判定器がそれを高く評価したら退行とする。
3. **能動的ペア選択と順序入れ替え**（§2.2）。`validate:blind make` の `pairs.md` を、判定器の確信度の高い誤判定・判定器間の不一致・閾値付近・新旧版の同お題で優先順位付けし、人間の 1 セッションあたりの情報量を上げる。
4. **Oogiri-Master の特徴を `trait-check` の候補に**（§5.1）。視点転換・曖昧性の利用・不調和の解消を 1 問ずつの noul にし、2 の凍結セットで検証する。
5. **統合スクリプト**（§3.1 の dreaming 相当）。新しい `.json` を読み、過去の原則で説明できないペアを列挙し、所見候補を提案する。Hermes の `write_approval` と同じく、人間が承認してから `findings.md` と `principles.json` に書く。
6. **評価側の近傍検索**（research）。CIPHER 流に、過去の人間判定から似たお題・似た回答の判定 k 件を few-shot として研究用判定器に渡し、一致が上がるかを測る。Example Firewall は生成側の規約なので評価側には適用しないが、凍結セットの事例は渡さない。
7. **選抜用途の試験**（§4 の C）。ogiri-ai が候補を 2〜3 倍生成し、`overlap-check` で被りを落としたうえで `trait-check` の下限を満たす候補から**多様性で**選ぶ（DivPO の選び方）。面白さで選ばないことを守る。
8. **レシピはスキーマから始める**（§6.2）。判定器より先に、JAR 尺度と一対比較で 10 件ほど記録し、決定的検査を書く。笑いで一致した「記述的質問 → 人間ラベルで検証」の手順をそのまま使う。

---

## 参考文献

### 笑い
- Zhong ら, [Let's Think Outside the Box: Exploring Leap-of-Thought in LLMs with Creative Humor Generation (CLoT, Oogiri-GO)](https://arxiv.org/abs/2312.02439), CVPR 2024
- [Assessing the Capabilities of LLMs in Humor: A Multi-dimensional Analysis of Oogiri Generation and Evaluation](https://arxiv.org/abs/2511.09133), AAAI 2026
- Murakami ら, [Oogiri-Master: Benchmarking Humor Understanding via Oogiri](https://arxiv.org/abs/2512.21494)（本文: [HTML](https://arxiv.org/html/2512.21494v1)）
- Murakami ら, [Who Laughs with Whom? Disentangling Influential Factors in Humor Preferences across User Clusters and LLMs](https://arxiv.org/abs/2601.03103), EMNLP 2026
- [lmfaoooo at SemEval-2026 Task 1: Humor Is an Audience. Preference Modeling for Constrained Humor Generation](https://arxiv.org/abs/2606.00022)
- [HumorRank: A Tournament-Based Leaderboard for Evaluating Humor Generation in LLMs](https://arxiv.org/abs/2604.19786)
- [Cards Against LLMs: Benchmarking Humor Alignment in LLMs](https://www.alphaxiv.org/abs/2604.08757v1)
- Mirowski ら, [A Robot Walks into a Bar: Can Language Models Serve as Creativity Support Tools for Comedy?](https://arxiv.org/abs/2405.20956), FAccT 2024

### 嗜好の学習・判定器
- Findeis ら, [Inverse Constitutional AI: Compressing Preferences into Principles](https://arxiv.org/abs/2406.06560), ICLR 2025
- [Open Problems in Constitutional Preference Reconstruction](https://arxiv.org/abs/2606.30116), 2026
- Gao ら, [Aligning LLM Agents by Learning Latent Preference from User Edits (PRELUDE/CIPHER)](https://arxiv.org/abs/2404.15269), NeurIPS 2024
- [PAL: Sample-Efficient Personalized Reward Modeling for Pluralistic Alignment](https://proceedings.iclr.cc/paper_files/paper/2025/hash/2858f8c8683aaa8c12d487354cf328dc-Abstract-Conference.html), ICLR 2025
- [Diverse Preference Optimization](https://arxiv.org/abs/2501.18101)
- [GEPA: Reflective Prompt Evolution Can Outperform Reinforcement Learning](https://arxiv.org/abs/2507.19457), ICLR 2026
- [Rubrics as Rewards](https://arxiv.org/abs/2507.17746)、[Checklists Are Better Than Reward Models For Aligning Language Models](https://arxiv.org/abs/2507.18624), NeurIPS 2025
- [LLM-as-a-Judge Is Not an Oracle: Why Self-Improving Agents Need Deterministic Guardrails (PROCTOR)](https://arxiv.org/abs/2609.02246), 2026
- [Preference is More Than Comparisons: Rethinking Dueling Bandits with Augmented Human Feedback](https://arxiv.org/abs/2511.09047v1), AAAI
- LangChain, [How to Calibrate LLM-as-a-Judge with Human Corrections](https://www.langchain.com/resources/llm-as-a-judge)
- Wang ら, Large Language Models are not Fair Evaluators (2023); 位置・冗長バイアスの数値は [この整理](https://memx.app/blog/llm-as-a-judge-biases-and-fixes/) を参照

### 記憶アーキテクチャ
- Park ら, [Generative Agents: Interactive Simulacra of Human Behavior](https://arxiv.org/abs/2304.03442), 2023
- OpenClaw, [Memory](https://docs.openclaw.ai/concepts/memory)（[リポジトリ](https://github.com/openclaw/openclaw)）
- Hermes Agent, [Memory](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory)、[Skills](https://hermes-agent.nousresearch.com/docs/user-guide/features/skills)（[リポジトリ](https://github.com/nousresearch/hermes-agent)）
- Letta, [Sleep-time Compute](https://letta.com/blog/sleep-time-compute)（[arXiv:2504.13171](https://arxiv.org/abs/2504.13171)）
- Mem0, [State of AI Agent Memory 2026](https://mem0.ai/blog/state-of-ai-agent-memory-2026)、[LoCoMo benchmark](https://mem0.ai/blog/locomo-benchmark)
- [Adaptation of Agentic AI: A Survey of Post-Training, Memory, and Skills](https://arxiv.org/abs/2512.16301)
- [Memory-Skill Isomorphism: One Skill Carrier, Two Native Uses](https://arxiv.org/abs/2609.16669), 2026
- Reflexion (Shinn ら 2023)、Voyager (Wang ら 2023)、ExpeL (Zhao ら 2023)、Agent Workflow Memory (Wang ら 2024) — 上記サーベイに整理あり

### 知覚指標・味覚
- Kirstain ら, [Pick-a-Pic: An Open Dataset of User Preferences for Text-to-Image Generation (PickScore)](https://arxiv.org/abs/2305.01569), NeurIPS 2023
- Zhang ら, The Unreasonable Effectiveness of Deep Features as a Perceptual Metric (LPIPS / BAPPS), CVPR 2018
- [Teaching tech to taste (FEAST, University of Copenhagen)](https://www.beveragedaily.com/Article/2024/01/05/teaching-tech-algorithm-to-taste-a-first-step-towards-accurate-flavour-modelling/)
- UC Davis, [AI-driven prediction of consumer liking of coffee from sensory data](https://foodandhealth.ucdavis.edu/ai-driven-prediction-of-consumer-liking-of-coffee-from-sensory-data/)
- Schreurs ら, Predicting and improving complex beer flavor through machine learning, Nature Communications 2024
- Colantonio ら, Metabolomic selection for enhanced fruit flavor, PNAS 2022
- [Culinary Class Wars: Evaluating LLMs using ASH](https://arxiv.org/abs/2411.01996v1)、[On Recipe Memorization and Creativity in LLMs](https://www.arxiv.org/pdf/2506.23527)
