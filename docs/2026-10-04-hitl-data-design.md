# HITL（人間のフィードバック）をどう集め、溜め、使うか — 設計の判断（2026-10-04）

問い: 感覚を教える仕組みに人間を入れるとき、データの収集・蓄積・利用をどう組むか。
具体的には、(1) ファイルのベタ置きかベクタ DB か、(2) CSV か SQL か、(3) 古典的な機械学習や小規模言語モデルの学習が必要になるのか、それぞれ**どのデータ量から**か。

調べ方: 既存の人間フィードバック系（Argilla・Label Studio・Prodigy・LangSmith・Braintrust・promptfoo・Weave・Langfuse・OpenAI evals・Inspect・OpenAssistant・Chatbot Arena・PRISM・HH-RLHF・TRL・OpenClaw/Hermes）の保存とスキーマを一次資料で調査し、嗜好モデルの必要データ量を文献と統計で見積もり、**このリポジトリの実データで古典 ML が単一特徴に勝つかを実測**し、立場の異なる設計案 3 本（git ネイティブ最小主義・SQLite 中心・学習中心）を起こして、それぞれを懐疑的に検証した。検証で出た最重要の数値（§2）は私が再計算して確認した。前回の調査報告（[2026-10-04-sense-feedback-survey.md](2026-10-04-sense-feedback-survey.md)）の次の一手は、本稿 §8 で見直した。

---

## 0. 結論（問いへの直接の答え）

| 問い | 答え | 根拠 |
|---|---|---|
| ファイルか DB か | **git 上の追記専用 JSON + MD が正本。100x（2 万回答）でも変えない** | 現状 190 回答で JSON 31 KB。2 万回答でも 3〜5 MB。調査した 16 システムで 10²〜10⁴ 件を独自 DB に入れている例はなく、Langfuse・OpenAI evals・Prodigy はいずれも「イベントログが正本、DB は派生」 |
| ベクタ DB | **不要。** 10⁵ 件未満は総当たりで足りる | この環境の Node で 20,000 × 768 次元の総当たり余弦が 17〜23 ms（検証エージェントが実測）。しかも今はお題 13 個で、新しいお題に近傍が存在しない |
| CSV か SQL か | **CSV は閲覧用の派生のみ。SQL は必要なら DuckDB CLI で JSON を直接読む**。SQLite の鏡は作らない | `labels.ts` + `agreement.ts`（2,000 回ブートストラップ込み）が全体で 2.3 秒。SQL ビューは同じ計算の書き直しで情報が増えない |
| 古典 ML | **今は不要。** 当たり 70（約 240 回答）以降に、特徴 7 個以下のロジスティック回帰 / Bradley–Terry を「床」として検討 | 実測（n=75、当たり 22）: L2 ロジスティック回帰の外挿 AUC は 2 特徴 0.62、7 特徴 0.63、21 特徴 0.60 で、単一特徴 `concrete` の 0.67 を超えない。EPV 1〜3 で係数の符号が安定しない |
| 小規模 LM / 報酬モデル | **本人データだけでは 100x でも不要。有害** | 公開報酬モデルは 10⁵ 比較でも 61〜71%。当たり 33 件で学習すれば 2026-07-11 のハウススタイル化を判定側で再現する |
| では何に投資するか | **収集の手順と検証の規律。2 人日以内** | ボトルネックは保存でもモデルでもなく、人間の判定時間（1 セッション 20〜35 分、85 日で 4 セッション）と、質問を作ったデータで一致を測っている検証の設計 |

もうひとつ、設計を変える新事実が出た（§2）。**最新のブラインド 2 セッションで、`trait-check` の `concrete` は識別力を失っていた。** 生成側がその性質を目標にした瞬間に判定器は床としても効かなくなる、という既知の教訓の検証側での再現で、特徴ベースの学習モデルの前提（特徴の安定性）を崩す。

---

## 1. 前提となる数値

| 項目 | 値 |
|---|---|
| セッション | 7（2026-07-10 〜 2026-10-03）。うちセットを持つもの 5、ブラインド 4 |
| 回答 / 当たり | 190 / 33（当たり率 17%）。当たりラベルのある回答 165 |
| 一対比較 | 含意ペア（セット内 当たり × 外れ）84、明示ペア 20、セット単位の優劣 7、被り判定 16 |
| お題 | 13（文の一意数） |
| 評価者 | 1 人 |
| 判定器スコアと人間ラベルの重なり | 75 回答・22 当たり・混在セット 9（2026-09-25 時点） |
| 収集ペース | 1 セッション 45 回答 → 含意ペア 17〜50 件。明示ペアを足しても新規情報は約 27 件/セッション |
| 10x（約 1,000 ペア）到達 | 月 2〜3 セッションで**約 13 か月**。100x は収集方法を変えない限り到達しない |

含意: 設計は「今〜10x は 10²〜10³ ペア、独立単位は数十セット」という前提で決める。ペア数で数えると楽観的になる。含意ペア 50 件の独立単位は 9 セットで、セット単位の cluster bootstrap では区間が ±0.16 になる。

---

## 2. 新事実: ホールドアウトで `concrete` が失効した

2026-10-03 の 2 セッション（ブラインド、gpt-6.1-sol、90 回答・当たり 11）は、`trait-check` の質問作成に使われていない。ogiri-ai のゲート実行が**現行と同じハッシュの `evaluate.ts`**（provenance.json の `checks.trait-check` = `aced92d7…` が `skills/trait-check/scripts/evaluate.ts` の sha256 と一致）で全回答を採点済みなので、API を叩かずに照合できる。

| 指標 | 開発データ（2026-09-25、75 回答・当たり 22） | ホールドアウト（2026-10-03、89 回答・当たり 11） |
|---|---|---|
| `concrete` pooled AUC | 0.67 [0.52, 0.80] | **0.51 [0.34, 0.68]** |
| `concrete` セット内 AUC（混在セット平均） | 0.57 | **0.35**（7 セット） |
| `concrete` 含意ペア正答率 | — | **0.35**（34 組） |
| `−indirect` pooled AUC | 0.62 | **0.73** |
| `−indirect` セット内 / ペア | 0.65 / — | 0.63 / 0.65 |
| `−length`（ベースライン） | 0.51 | 0.33 |

読み方:

- `concrete`（具体的な物・現象が出てくるか）は、プロンプト 3 条件すべてが具体性を目標にしている生成器の出力では当たりと外れを分けない。セット内では逆向き。**生成器が目標にしている性質を測る判定器は識別力を失う**。07-11 の「勝ちパターンの正の指示化はハウススタイル化する」の、判定側での再現。
- `indirect`（説明的・遠回し）は保持した。負の性質（「こうなっていたら外れ」）のほうが、生成器が変わっても残りやすい。
- 注意: 当たり 11 なので 95% 半幅は ±0.18 あり、「下がった」とは言えても大きさは測れない。生成器も違う（Fable 5 / GPT-5.6 / gpt-6-astra 対 gpt-6.1-sol）。プロンプト 3 条件は `trait-check` の数値を見ながら改訂されたので、選択効果もある。
- もうひとつ露呈したこと: `reports/validation/2026-09-25/summary.md` の見出しは「75 answers (22 hits)」だが、今 `agreement.ts` を再実行すると 10-03 の追加で 165/33 になり、`−length` ベースラインは 0.51 → 0.44 に動く（検証エージェントが実行して確認、復元済み）。**summary.md がどのラベル集合で計算されたかを記録していない**。

設計への含意:

1. 判定器は「床」としてしか使えない、という既存の規約は正しく、さらに**床としても生成器ごとに再検証が要る**。
2. 特徴ベースの Bradley–Terry / ロジスティック回帰は、特徴の符号が生成器で反転する以上、生成条件を覚える方向に働く。当たり 70 を超えても「2 つ以上の生成器で特徴の向きが同じ」ことを確かめてからにする。
3. 新しい記述的特徴は、負の性質（説明的・概念だけ・形式外れ・被り）から探す。
4. ogiri-ai のゲート出力は、同じハッシュの判定器が人間に見せた回答を採点している限り、**毎回無料の検証サンプル**になる。ScoreFile に変換して取り込む。

---

## 3. 既存システムの共通パターンと、humor-skills との差分

### 3.1 16 システムから抽出した共通パターン

| パターン | 例 | humor-skills |
|---|---|---|
| 正本は追記専用のイベント / 行ログ。集計・検索用の表は派生物として再生成 | Langfuse は全イベントを S3 に保存してから ClickHouse へ。OpenAI evals は spec 行 + イベント行の JSONL。Prodigy は Example 表に追記して `db-out` | 「過去セッションは書き換えない」規約で一致 |
| 交換フォーマットは JSONL。Parquet は 10⁵ 行以上の配布用 | HH-RLHF（jsonl.gz）、oasst、PRISM、Prodigy、promptfoo | JSON のまま git に置くのが主流と同じ |
| 1 人〜数万件は SQLite が既定。Postgres / ClickHouse は 10⁵ 件・複数同時ユーザから | Label Studio「SQLite で数万件、PostgreSQL は 10 万タスク × 5 人同時」。Argilla・Prodigy・promptfoo の既定も SQLite | 1 人・2 万回答でも SQLite の範囲。しかも必要になっていない |
| ベクタ DB は独立製品ではなく付属の索引 | Argilla は ES 内、OpenClaw は SQLite ハイブリッド、Hermes は FTS5 のみ | 埋め込みは派生ファイル、検索は総当たり |
| 学習用の判定表現は `prompt / chosen / rejected` の一対比較に収斂。順位・基数・多次元は派生 | TRL、HH-RLHF、UltraFeedback、Arena（tie は半勝半敗）、oasst の `rank`、PRISM の `score` + `if_chosen` 併記 | `preferencePairs()` がそのまま写せる。必要になったら出す |
| 評価者 ID・時刻・ブラインド・所要時間を**判定単位**で持つ | Arena: `judge`, `anony`, `tstamp`。Label Studio: `completed_by`, `lead_time`。Prodigy: `_annotator_id`, `_timestamp` | `rater` / `blind` はセッション単位。1 人のうちは足りる |
| 生成元の版を判定とは別フィールドで必ず持つ | Label Studio `predictions.model_version`、Braintrust `origin`、OpenAI evals `completion_fns` + `run_id`、Arena `model_a/model_b` | `condition` が自由文（"gpt-6.1-sol medium / round 1 / baseline / run 1 / shown as A"）。**構造化が要る** |
| 安定 ID はコンテンツハッシュ | Prodigy `_input_hash`（入力）/ `_task_hash`（入力 + 問い） | 位置 ID `<date>/<set>#<n>` のみ。同一回答文が別セットに 2 組ある（ラベル衝突はなし） |
| 人間判定と機械判定は別フィールド | Argilla `suggestions` vs `responses`、Label Studio `predictions` vs `annotations` | `data/human-evals/` と `reports/validation/` の分離で一致 |
| 人間の修正は few-shot に戻す。学習ではない | LangSmith few-shot evaluator は既定 5 件・説明必須。Align Evals は golden set 20 件以上・0/1 均衡。学習は 10⁴〜10⁵ ペアから | 10² 件の正しい使い道は検証と few-shot。few-shot は評価ゾーン限定 |
| 蒸留メモリは 2 層、文字予算と do/don't を持つ | OpenClaw: 日次メモ → dreaming（スコア・想起頻度・多様性の閾値）→ MEMORY.md。Hermes: 2,200 字 / 1,375 字の凍結注入 | `findings.md` が蒸留層。知見ごとの状態（有効 / 降格 / 未検証）がない。公式文書はこのメタデータを規定していないので独自規約になる |

### 3.2 足りないもの（4 点）

1. 生成元の版（ogiri-ai のコミット・SKILL.md のハッシュ・モデル・努力度）の構造化フィールド。値は `reports/ogiri-ai/<exp>/provenance.json` に既にある。
2. 回答のコンテンツハッシュ（派生で付ければよい。保存しない）。
3. `labels.ts` が既存の任意フィールドを黙って捨てている。`2026-09-23.json` の `purpose`、`2026-09-15.json` と `2026-09-23.json` の `note` は README に書かれておらず、集計にも出ない。
4. `findings.md` の各知見の状態メタデータ。07-11 で「痕跡 + 小さい数字」のルールが降格された経緯が、散文の中にしかない。

---

## 4. 収集: 何を、どう聞くか

### 4.1 続けるもの

- セットごとの当たり（`hits`、0 本可、判定しないなら `null`）、1 行の `verdict`、収束を感じたら `converged`。
- ブラインド、お題ごとに条件を A/B/C に無作為化、全出力を残す、過去ラベルを書き換えない。
- 評価者の実際の出力（「A5 が面白い。A1、C5 が次点」のような数行）を `.md` に原文で残し、JSON への書き起こしの判断（次点を `hits` に含めるか）を「ラベルの扱い」節に書く。これは正規表現で機械化できる種類の判断ではない。

### 4.2 足すもの

| 追加 | 理由 | 量 |
|---|---|---|
| **セット単位の優劣（`setPreferences`）を毎回必ず聞く**（「同じくらい」可） | 10-03 の 2 セッションは両方とも空で、生成条件の比較信号が取れていない。ゲートの本来の問い「新版はセットとして悪化していないか」に直接答える | お題ごとに 1 回 |
| **同一お題・条件横断の明示ペア** | 新版 vs 旧版の勝率を直接測る。勝率 0.6 の検出に約 194 組、0.65 で 85 組 | 10 組/セッション |
| **再テストペア（層別）** | 本人の再テスト一致 = 判定器の到達上限の推定。層別にしないと「明確な差のある組」だけで上振れする | 10 組/セッション: 当たり vs 外れ 3、限界域 4（判定器の `probA` が 0.4〜0.6、または同セット外れ同士）、当たり同士 3 |
| 理由 `note` | few-shot と所見の原料。全組ではなく 3〜5 組 | 任意 |
| 開始・終了時刻 | 所要時間の実測が 1 セッションもない | 自動 |

聞かないもの: 6 軸などの絶対尺度（人間同士でも一致が低く、LLM との相関 0.17〜0.27）。「どれも面白くない」お題では強制 A/B を取らない（低情報）。

### 4.3 能動的選択の注意

- 「判定器が高確信で外したペア」を再出題するのは、**既にラベルのあるペアの再評価**であり、新しいラベルを増やさない。再テストの部分集合として扱う。09-23 の 7/8 は逆向きと分かっていた旧 humor-eval に対する値で、部分的に一致する `trait-compare` には外挿できない。
- 新規回答に対して選べるのは、判定器の不確実性（`probA` ≈ 0.5）と判定器間の不一致だけ。
- 無作為の `control` を半分以上残す。判定器の成績は `control` だけで報告する（09-23 の notes が指摘した選抜バイアス）。
- `purpose` を enum で必ず記録する: `control` / `retest` / `cross-condition` / `uncertainty` / `judge-disagreement` / `threshold`（被り判定の閾値付近）。

### 4.4 ツール

Web UI は作らない。Argilla は Elasticsearch、Label Studio は Postgres を要し、1 人には過剰。10-03 で使った Markdown の A/B/C 表（`blind-r1.md`）を正式な入出力にし、前後を小さなスクリプトで挟む。

- 前: `blind.ts make` を拡張して、seed 付き乱数（現在は seed なしの `Math.random()`）で条件→A/B/C とセット内の提示順を無作為化し、`key.json` に `shown_as` / `display_order` / ペアの `presented` を書く。
- 後: 人間（またはエージェント）が書いた JSON を**検査する**バリデータ（未知参照、5 本未満のセット、`blind: false` なら `blind_note` 必須、前コミットからの `answers` / `hits` / `winner` の変化、「次点を hits に含めたか」の明記）。`feedback:ingest` のような解析器は作らない。
- 評価者が 2 人以上になったら、静的 HTML フォーム（サーバなし）と `raters.json`（PRISM の survey 相当）を足す。それまでは作らない。

---

## 5. 蓄積: スキーマと保存

### 5.1 正本は v1 JSON のまま、任意フィールドを足す

v2 の JSONL イベントログ、`principles.json` の並行正本、`data/generations/` の新設は、いずれも検証で退けられた（二重正本、v1/v2 二重リーダー、既に `reports/ogiri-ai/<exp>/raw/` にある生出力の 3 つ目のコピー）。必要な追加はすべて v1 の任意フィールドで済む。`labels.ts` は未知フィールドを無視するので既存 7 ファイルは無変更。

| 場所 | フィールド | 意味 |
|---|---|---|
| セッション | `seed`、`tool`、`started_at` / `ended_at`、`blind_note`（`blind: false` のとき必須） | 無作為化の再現、所要時間、非ブラインドの理由 |
| `sets[]` | `generator: { repo, ref, prompt_sha256, model, effort, run }`、`shown_as`（A/B/C）、`display_order`（提示した順の回答番号）、`run_dir`（`reports/ogiri-ai/<exp>`） | 生成元の版（provenance.json の値をそのまま）、提示条件、生出力への参照 |
| `pairPreferences[]` / `similarityJudgments[]` | `purpose`（enum）、`note`、`presented`（`ab` / `ba`）、`created_at`、`seen_before`（再テスト時の自己申告） | 選抜理由、理由、位置バイアスの検定、再認の記録 |

派生 ID は保存せず `labels.ts` が計算する: `answer_hash = sha256(NFKC(お題) + '\n' + NFKC(回答))`。再評価・別セッションの同一回答・`assets/samples.json` の昇格元の突合に使う（Prodigy の `_input_hash` と同型）。

### 5.2 判定器の出力（ScoreFile）に版を持たせる

`judge_sha`（`scripts/evaluate.ts` + `SKILL.md` の sha256）、`labels_sha`（読んだ全セッション JSON の sha256）、`created_at` を足し、`summary.md` の冒頭にラベル集合のスナップショットと読んだ ScoreFile 一覧を出す。§2 で露呈した「75/22 で計算した表が、再実行すると 165/33 になる」問題の再発防止。`jev-latest` は別名で中身が動くので、別名が切り替わったらベースラインを含めて全件再採点し、notes.md に書く。

### 5.3 所見の状態は `findings.md` の中に持つ

前回の報告で `principles.json` を提案したが、1 人で `findings.md` と JSON を同期し続けるのは README が禁じる「派生物の手編集」の変種になる。まず `findings.md` の各知見の末尾に 1 行足す:

```
状態: 検証済 | 候補 | 降格 | 置換   根拠: 2026-07-11, 2026-09-22   対応指標: trait-check.indirect   備考: 2026-10-03 のホールドアウトで保持
```

「原則ごとに人間ラベルの再現率を測る」（Inverse Constitutional AI の手順）は、対応指標がある知見については `agreement.ts` の表の行そのものなので、新しい仕組みは要らない。機械可読な JSON は、それを読むスクリプトができた時点で `findings.md` から起こす。

### 5.4 作らないもの（トリガー付き）

| 作らないもの | 作るトリガー |
|---|---|
| 派生 JSONL（`answers.jsonl` / `pairs.jsonl`、TRL 形式） | それを読む消費者（kNN、BT、外部ツール）が実際に予定されたとき。今は `labels.ts` を直接読む消費者しかない |
| SQLite の鏡（`node:sqlite`） | `labels.ts` + `agreement.ts` の実行が数十秒を超えたとき。即席の SQL は DuckDB CLI の `SELECT … FROM read_json_auto('data/human-evals/ogiri-ai/*.json')` で足りる |
| 埋め込みと kNN few-shot | お題 50 以上・回答 1,000 以上、かつ research/ で k ∈ {0, 3, 10} の学習曲線を描く実験を予定したとき。その時も JSONL + TypedArray の総当たりから始め、Python や sqlite-vec は入れない |
| ベクタ DB | 複数プロセスからの同時書き込みか 10⁵ 件超。1 人では来ない |
| Postgres | 評価者 5 人以上が同時に書き、行数 10⁵ 超（Label Studio の目安）。来ない |
| git-lfs / 分割 | `data/` 合計 50 MB 超。2 万回答でも 3〜5 MB |

---

## 6. 利用: 検証・較正・蒸留・生成

### 6.1 検証

- **凍結セットではなく前向き分割。** 静的な凍結セット（10-03 の 2 セッションを frozen に）は検証で退けられた。評価者 = 質問の作者 = メンテナが 1 人なので、`.md` を読んだ時点で凍結は燃える。実体も混在セット 7・含意ペア 34・当たり 11 で、95% 半幅 ±0.18 では何も判定できない。代わりに、各判定器の**質問文を最後に変えた日**（`judge_sha` の初出日）を記録し、`agreement.ts` が「その日より後に取ったセッション」だけの列を別に出す。新セッションが来るたび検証集合が増え、燃えない。これは `research/README.md` の昇格条件 3「検証に使っていない新しい人間評価でも再現」を機械化したもの。
- pooled AUC・セット内 AUC・セット優劣・ペア正答率を**並べて**読む（主要指標を 1 つに固定しない。指標を同じデータで選ぶのは選択バイアス）。
- ペアの区間は**セット単位の cluster bootstrap**。50 ペアの独立単位は 9 セット。
- `purpose` 別に集計し、判定器の成績は `control` だけで報告する。
- `−length` ベースラインを判定器と同じ回答集合で計算する（今は全ラベルで計算されており、判定器より多い回答に基づく）。
- `overlap-check` の採点対象を「人間の被り判定ペア + 全セットのセット内ペア」に絞る。現在はお題プール内の全ペアで 1 回 1,780 呼び出し（検証エージェントの実測）だが、人間ラベルと比べるのは約 400 ペアだけ。
- n < 585 では「0.05 の差」を主張する文言を SKILL.md・notes.md から消す。

### 6.2 較正（判定器を人間に合わせる）

- 主経路は現行どおり、**人間の `note` と `findings.md` から 1 問 1 軸の記述的質問を作り、前向き分割で測る**。候補は負の性質を優先する（§2）。Oogiri-Master の効果量が大きい特徴（視点転換 d = 0.50、曖昧性の利用 0.42、不調和の解消 0.36）も候補だが、生成器が目標にしうる正の性質なので、床としての寿命は短いと見る。
- 理由付きペアの few-shot（LangSmith 流、k = 3〜5、当たり / 外れ均衡）と、原則リストによる較正（ICAI 流、30〜80 ペアで 3 原則）は `research/` の判定器だけで試し、k = 0 を上回らなければやめる。`skills/` にはインストール先が生成リポジトリなので入れない。
- kNN による few-shot 選択は、お題 50 以上になるまで効かない（今は近傍が同じセットの兄弟回答になり、答えが漏れる）。

### 6.3 蒸留

- 3 層（生ログ → `findings.md` → ogiri-ai の条件付き修理ルール）は維持。
- 新セッションの後に「検証済の所見で説明できないペア」を列挙して所見候補にする作業は、まず人手で `notes.md` に書く。LLM に原則文を生成させない（LLM の好みが混ざる）。書き込みは人間が承認してから（Hermes の `write_approval` と同じ思想。ここではコミット前のレビューがそれ）。
- 「負の規則なら安全」ではない。09-24 の notes が `concrete` / `straight` について Goodhart を警告したとおり、負の規則も最大化されれば一型に収束させる。安全性は規則の種類ではなく「下限確認にだけ使う」運用で決まる。

### 6.4 生成側への反映

経路は 2 つだけ。(a) 条件付き修理ルールを人手で ogiri-ai の `SKILL.md` に書く（現行）。(b) 候補を 2〜3 倍生成し、決定的検査 → `overlap-check` で被りを落とす → `trait-check` の床を満たす候補から**多様性で**選ぶ（DivPO の選び方）。面白さで選ばない。

Example Firewall の機械検査は、`data/human-evals/` の回答文（NFKC 正規化、完全一致。お題文は除外）が ogiri-ai の `SKILL.md` と `skills/*/assets/*.json` に含まれないことを `npm run check` で確かめる程度にとどめ、README に限界を明記する。07-11 のアトラクター化は例文の転記ではなく「勝者から抽象化した規則」の漏れで起きたので、n-gram 一致では原理的に検出できない。本命の防御は手続き（SKILL.md の変更は `findings.md` の知見を引用し、「降格」の知見を引用した変更は差し戻す）。

なお `skills/trait-check/assets/samples.json` の `idol_skill` は 2026-07-10 の人間評価セットそのもので、`npx skills add` で ogiri-ai に入る。重大ではない（元は ogiri-ai 自身の出力）が、合成例への差し替えは 30 分で済む。

### 6.5 モデル: データ量ごとの判断

| 手法 | 有用になる量 | 信頼できる量 | 今の判断 |
|---|---|---|---|
| 記述的 1 問 1 軸の Jev 判定（現行） | 既にある | 回答 500（AUC 区間 ±0.05）= 約 10 セッション | 継続。生成器ごとに前向きに再検証 |
| 原則リスト（ICAI 型）で判定を較正 | ペア 30〜80 | 原則抽出に使わない後続 1〜2 セッション | research/ で今から試せる唯一の較正手法 |
| 人間修正 k 件の few-shot | k = 3〜5 | 後続ペア 100 以上で k ∈ {0, 3, 10} の学習曲線 | research/ のみ。MT-Bench では一貫性のみ改善し人間一致は不変の報告があるので自測 |
| 特徴 2〜7 個 + ロジスティック / Bradley–Terry | 特徴 2〜3 個: ペア 80〜100 | 特徴 7 個: 当たり 70 ≈ 回答 240（EPV 10）。17 特徴: 2,500 ペア（SemEval-2026 優勝: 77%） | **今は負ける**（実測 §0）。当たり 70 以降、かつ 2 生成器以上で特徴の向きが一致してから。床専用 |
| 埋め込み kNN で few-shot 選択 | お題 50〜100・回答 1,000 | 後続セッションで学習曲線 | 10x で。ベクタ DB は不要 |
| クロスエンコーダ / 報酬モデル（本人データのみ） | ペア 5,000 | 10⁴〜10⁵ | 採用しない。現行ペースでは到達もしない |
| 母集団モデル + 本人を数十件でローカライズ（LoRe / PAL 型） | 本人 9〜50 ペア + 母集団 20〜1,000 人 | 母集団データ（Who Laughs with Whom 57,751 票など）の入手が前提 | research/ の課題。退行検知には使わない |
| LoRA / DPO で生成側を本人嗜好に | 厳選 1,000 例 | 10³〜10⁴ ペア + 多様性制約 | 採用しない。多様性崩壊（online DPO 8.5% vs DivPO 54%）と Firewall に衝突 |

統計の目安（Hanley–McNeil、当たり : 外れ = 1 : 2、AUC 0.7）: 回答 80 → 95% 半幅 ±0.13、200 → ±0.08、500 → ±0.05、2,000 → ±0.025。「偶然より上」を区間で示す最小ペア数: 正答率 0.6 で 93、0.65 で 39、0.7 で 21。生成条件 A/B の勝率 0.6 の検出（α 0.05、検出力 0.8）に約 194 ペア、0.65 で 85。

---

## 7. レシピへの含意

- 大喜利の「セット」は同じお題への候補群の同時提示（横断比較）。レシピは同じ料理の v1 → v2 → v3 を別の日に作る**縦断比較**で、1 回の調理で 1〜2 版しかなく、含意ペアも混在セットも生まれない。セッションのスキーマを流用するのではなく、**1 料理 1 ログ**（`data/human-evals/recipe/<dish>.json` に版を追記）にし、一対比較は `{ a: 'mapo-tofu/v2', b: 'mapo-tofu/v3', winner, days_apart }` のように異日比較であることを残す。
- 共有できる部品は、追記専用・`rater` / `blind` / `generator` / コンテンツハッシュ・`findings` の蒸留層・「決定的検査はコード」の 4 つ。`agreement.ts` の AUC は転用できず、「また作るか（`would_repeat`）」の縦断率と、JAR 軸ごとの方向一致率（判定器が予測した方向 vs 人間の JAR の符号）が指標になる。
- JAR（just-about-right）は食べた人が「強すぎる / ちょうど / 足りない」を自己申告する質問紙で、計測機器は要らない（機器や訓練パネルが要るのは記述分析のほう）。軸は料理カテゴリごとに選ぶが、香り（口中香を含む。風味の大半は嗅覚）・食感・温度・辛味・油脂感は省かない。「おいしいか」（9 点 liking）は補助。`executed_as_written` と逸脱内容を必須にして、レシピの良さと出来の良さを分ける。
- 1 日 1〜3 皿なので 10x は来ない。学習器は書かない。決定的検査（総重量に対する塩分 %、糖酸比、加熱時間・温度の整合、アレルゲン、工程順）と、本人限定の条件付き修理ルール（「酸味が目立つ構成なら 2 割減らす」）で完結する。
- **10 皿を `.md` + 最小の `.json` で記録してから器を決める。** 抽象化（軸定義ファイル、順序回帰）は早すぎる。

---

## 8. やること（2 人日）と、やらないこと

前回の報告（§7）で挙げた「`principles.json`」「凍結検証セット + カナリア」「能動的ペア選択」は、検証を経て次のように縮約・置換する。

### 今やる（合計 2 人日）

1. **`labels.ts` の拡張（0.5 日）**: `purpose` / `note` / `generator` / `shown_as` / `display_order` / `presented` / `created_at` / `seen_before` を読む。`answer_hash` を計算する。`data/human-evals/README.md` のスキーマ節を更新する。
2. **10-03 のゲート出力を ScoreFile に変換し、`reports/validation/2026-10-04/` を作る（0.5 日）**: §2 の数値を `summary.md` と `notes.md` に正式に残す。`skills/trait-check/SKILL.md` の信頼度節に「`concrete` は生成器が具体性を目標にしている出力では識別力がない（2026-10-03）。`indirect` は保持」と書く。以後、同じハッシュの判定器が人間提示回答を採点したゲート出力は毎回取り込む。
3. **`agreement.ts` の拡張（0.5 日）**: 判定器ごとの `questions_frozen_at` と前向き分割の列、セット単位の cluster bootstrap、`purpose` 別のペア集計、同じ回答集合でのベースライン計算、`summary.md` 冒頭のラベル集合スナップショット（`labels_sha`）。
4. **`findings.md` に状態行、`samples.json` の差し替え、Firewall の完全一致検査（0.5 日）**。
5. **次のセッションの手順**（コード不要）: `setPreferences` を必ず聞く。条件横断ペア 10 組 + 層別再テスト 10 組。seed・`shown_as`・`display_order`・開始終了時刻を記録。3 セッション後に平均所要と `kind` 別ペア数を見て増減を決める。

### やらない（§5.4 のトリガーまで）

派生 JSONL、`principles.json`、SQLite の鏡、埋め込み・kNN、Bradley–Terry / ロジスティック回帰、報酬モデル、LoRA / DPO、Web UI、`data/generations/`。それぞれのトリガーは `research/README.md` に日付付きで書いておく。

---

## 9. いただいた 2 つの指摘への回答

**「人間同士の一致 7 割が天井なら、クラスタ分けでクラスタ内の一致を上げられるはず」** — そのとおりで、前回の報告の表現が雑だった（修正済み）。天井は「誰の感覚を予測するか」で決まる。不特定多数なら集団の一致率、クラスタ内ならそれより高いクラスタ内一致率、1 人ならその人の再テスト一致率。Who Laughs with Whom はまさにクラスタ別に別の重みを推定しているが、クラスタ分離は弱い（シルエット 0.025）ので、「クラスタに割り当てる」より「連続的な重み」（LoRe / PAL 型）が向く。評価者 1 人の今は「クラスタ = 本人」で、必要なのはクラスタ分けではなく本人の比較判定を貯めること。ただし、本人の再テスト 10/11 = 0.91 は天井の推定としては上振れしている。2026-09-23 の 12 組はすべて「明確な品質差のある当たり vs 外れ」で、判定器が苦しむ限界域は 1 組も含まず、うち 6 組は評価者自身が `findings.md` や `assets` に引用した回答を含む（記憶による再現が混じる）。Wilson 95% 下限 0.62 は 7 割と区別できない。本当の天井は、§4.2 の層別再テスト（限界域を含む）を累積 100 件まで取ってから分かる。

**「JAR 尺度を計測できる設備はプロでも持っていない。香味や食感の情報が要らないのか疑問」** — JAR は機器計測ではなく、食べた本人が「塩味が強すぎる / ちょうど / 足りない」を答える質問紙で、家庭で取れる（機器と訓練パネルが要るのは記述分析のほう）。香味と食感は要る。前回の報告は軸の例として五味寄りに書いていたので、香り（口中香）・食感・温度・油脂感を既定の軸に含める形に修正した。§7 のとおり、レシピ側はまず 10 皿を記録してから器を決める。

---

## 付録 A: §2 の再計算手順

`reports/ogiri-ai/2026-10-03-prompt-comparison/{gate-traits.json, gate-input.json}` と `round-2/{light-traits.json, light-input.json}` の `rows[].traits` を、`sampleId` → お題文（`*-input.json`）→ 人間ラベル（`data/human-evals/ogiri-ai/2026-10-03-prompt-comparison*.json` の `sets[].answers` / `hits`）に（お題文, 回答文）で結合し、当たり vs 外れの AUC（同点 0.5）、混在セット内 AUC の平均、セット内 当たり × 外れ ペアの正答率を計算した。結合は 89 回答・当たり 11（「雨雲は消しゴムで消しました」が 2 セッションに出るため 90 → 89）。`provenance.json` の `checks.trait-check` と現行 `skills/trait-check/scripts/evaluate.ts` の sha256 が一致することを確認した。bootstrap 区間は 2,000 回の回答単位再標本化。

## 付録 B: 主な出典

- 保存・スキーマ: [Label Studio storage](https://labelstud.io/guide/storedata)、[Prodigy components](https://prodi.gy/docs/api-components)、[LangSmith few-shot evaluators](https://docs.langchain.com/langsmith/create-few-shot-evaluators)、[Align Evals](https://blog.langchain.com/introducing-align-evals)、[Braintrust human review](https://www.braintrust.dev/docs/guides/human-review)、[Langfuse self-hosting](https://langfuse.com/self-hosting)、[OpenAI evals record.py](https://github.com/openai/evals/blob/main/evals/record.py)、[oasst1](https://huggingface.co/datasets/OpenAssistant/oasst1)、[Chatbot Arena 55k](https://huggingface.co/datasets/lmsys/lmsys-arena-human-preference-55k)、[PRISM](https://huggingface.co/datasets/HannahRoseKirk/prism-alignment)、[TRL dataset formats](https://huggingface.co/docs/trl/main/en/dataset_formats)、[OpenClaw memory](https://docs.openclaw.ai/concepts/memory)、[Hermes memory](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory)、[DuckDB JSON](https://duckdb.org/docs/current/data/json/overview.html)、[node:sqlite](https://nodejs.org/api/sqlite.html)
- 必要データ量: [Inverse Constitutional AI](https://arxiv.org/abs/2406.06560)、[MT-Bench](https://arxiv.org/abs/2306.05685)、[lmfaoooo at SemEval-2026](https://arxiv.org/abs/2606.00022)、[LoRe](https://arxiv.org/abs/2504.14439)、[PAL](https://arxiv.org/abs/2406.08469)、[VPL](https://arxiv.org/abs/2408.10075)、[DivPO](https://arxiv.org/abs/2501.18101)、[LIMA](https://arxiv.org/abs/2305.11206)、[PickScore](https://arxiv.org/abs/2305.01569)、[OpenAssistant DeBERTa reward model](https://huggingface.co/OpenAssistant/reward-model-deberta-v3-large-v2)、[KATE](https://arxiv.org/abs/2101.06804)、[Ruri v3](https://huggingface.co/cl-nagoya/ruri-v3-310m)、[HaHackathon](https://aclanthology.org/2021.semeval-1.9/)、[Who Laughs with Whom](https://arxiv.org/abs/2601.03103)、[Oogiri-Master](https://arxiv.org/abs/2512.21494)
- 統計: Peduzzi ら 1996（EPV, [doi](https://doi.org/10.1016/S0895-4356(96)00236-3)）、Riley ら 2020（[BMJ](https://doi.org/10.1136/bmj.m441)）、Hanley & McNeil 1982（[doi](https://doi.org/10.1148/radiology.143.1.7063747)）、Cawley & Talbot 2010（[JMLR](https://jmlr.org/papers/v11/cawley10a.html)）
