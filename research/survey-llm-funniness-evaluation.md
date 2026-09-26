# サーベイ: 面白さを LLM で評価する方法（2026-09-26）

このリポジトリの目的 2（機械で面白さを測る研究）のための文献調査。
「LLM に面白さを判定させると人間とどれくらい一致するか」「一致を上げるにはどんな手法があるか」を、大喜利を中心に、
英語のジョーク・キャプション研究も含めてまとめる。最後に、このリポジトリの検証結果（`reports/validation/`）と照らして次の一手を書く。

数値は各論文の報告値。この環境で本文まで確認できたものと、要旨・二次情報までしか確認できなかったものは、末尾の文献一覧で区別した。

## 1. 要約

1. **「面白いか」を直接聞く LLM 判定は、人間との一致が弱い。** 絶対採点（Likert）では人間との相関が 0.2〜0.5 程度、選択式（複数候補から最も面白いものを選ぶ）でも正解率はクラウドワーカーと同程度の 65〜70%（大喜利・New Yorker キャプション）にとどまり、Cards Against Humanity のように攻めた笑いでは単純なベースラインを下回る。ゼロショットの frontier モデルをそのまま判定器にしても、人間の代わりにはならない、というのが 2023〜2026 年の一貫した結論。
2. **ただし人間同士の一致も低い。** 面白さの細かい採点は評価者間一致が Krippendorff α で 0.1〜0.2、一対比較でも κ 0.15〜0.4。「面白いか／面白くないか」の二値なら α 0.6〜0.7 に上がる。LLM 判定器を評価するときは、人間同士の一致を同じ指標で並べて見ないと、どこまでが判定器の失敗かわからない。
3. **一致を上げる手法は、効果の大きい順に次の 3 つ。**
   - **少量の人間の選好データで判定器を学習・調整する。** New Yorker キャプションでは 5,580 組の一対比較で SFT した GPT-4o が 67% → 82.4% となり、人間の専門家平均（78%）を超えた。プロンプトのペルソナ指定は +3% 程度で、学習には遠く及ばない。
   - **絶対採点をやめ、一対比較を Bradley–Terry で集約する。** 個々の判定はノイズでも、システム（版）単位の順位は安定する（SemEval-2026: 項目単位 κ=0.15 でも、評価者を 2 群に分けた順位の相関は ρ=0.79）。一対比較ベースの選好モデルは、絶対採点ベースより 10〜30 ポイント精度が高い。
   - **「面白いか」ではなく解釈可能な性質に分解して測る。** 視点転換・曖昧性の利用・不調和の解消・連想距離・短さ（Oogiri-Master）、言葉遊び・会話体・誇張・シュールの有無・長さ（Who Laughs with Whom）などの記述的な要因は、人間の面白さ判定と安定に相関する。特徴を LLM に渡して「迷ったときだけ参照せよ」とすると一致が上がる。
4. **LLM 判定器の系統的な偏り**は複数の論文で再現している。無関係な回答も高く採点する（positivity bias）、自分が生成した回答を高く採点する（self-preference）、共感より新規性を重視する、長い回答・語彙の多い回答を好む、位置バイアス、攻めた題材を避ける。LLM 同士の一致は LLM と人間の一致より高く、「安定しているが人間とずれた」好みを持つ。
5. **評価者の異質性。** 投票履歴でユーザをクラスタリングすると、クラスタごとに好みが違い、LLM の好みは「全ユーザ平均」と弱い負の相関（−0.2〜−0.4）だが、特定クラスタとは中程度の正の相関（0.5〜0.6）を持つ。「LLM は誰の好みを代弁しているか」という問いになる。評価者 1 人のデータで見た「LLM は人間と逆向き」は、その評価者とのずれである可能性がある。

## 2. 手法の分類

### 2.1 絶対採点（pointwise / Likert）

回答 1 件ずつに点数を付けさせる。もっとも素朴で、このリポジトリの `funniness-score` もこの型。

| 研究 | 設定 | 人間との一致 |
|---|---|---|
| Sakabe ら 2025（Oogiri, 6 軸）| GPT-4.1 / Gemini 2.5 Pro / Claude Sonnet 4 に人間と同じ 0〜4 ルーブリック。人間側は Lancers で 1 回答 4 人 | Overall Funniness の Spearman ρ = 0.27（Claude）、0.22（GPT）、0.17（Gemini）。全 6 軸で 0.17〜0.44。人間の上位・中位・下位の弁別は 50〜54% |
| 坂部・金・小町 2025（ANLP, 大喜利茶屋）| GPT-4o / Claude 3.5 Sonnet に 0〜10 点。人間はクラウドソーシング 5 人 | 個々の評価者との Pearson r = 0.49（GPT）、0.38（Claude）。5 人平均とは 0.57 / 0.44。採点から順位を作ると QWK 0.45 / 0.33。GPT と Claude の間は 0.19 |
| Crowd Score（Góes ら 2022）| GPT-3 に 4 つのユーモアスタイルの人格を与えて投票させ集計。52 ジョーク | 「人間と同じ傾向」と報告するが統計量は弱い。few-shot > zero-shot。二値の問い方（Funny / Boring）の語の選び方だけで balanced accuracy が 25% 動く |

観察されている偏り:

- **positivity bias**: お題と無関係な回答（別のお題の 1 位回答）に LLM は平均 2.4〜3.3 点を付け、人間は 0.68（Sakabe ら 2025）。ANLP 2025 でも同じ現象。LLM は「お題との関係」を見ず、回答単体の面白さを見ている。
- **self-preference**: LLM が生成した回答を、人間の 1 位回答より高く採点する割合が高い（両論文）。
- **新規性偏重**: 人間の Overall と最も相関する軸は Empathy、LLM は Novelty（Sakabe ら 2025）。
- **長さ**: 人間の 1 位回答は平均 13.3 字、LLM 生成は 30〜33 字（ANLP 2025）。Oogiri-Master でも回答長は面白さと負相関（Cohen's d = −0.28）。

一般の LLM-as-a-judge 研究でも、Likert 採点は実行ごとにドリフトし、ルーブリックのアンカー語に敏感で、一対比較のほうが安定で人間と照合しやすいとされる（PairS: Liu ら 2024）。

### 2.2 選択・一対比較（pairwise / MCQA）

2 件以上を並べて「どちらが面白いか」を選ばせる。

| 研究 | 設定 | 結果 |
|---|---|---|
| Oogiri-Master（Murakami ら 2025）| 大喜利。1 お題 約 100 回答 × 約 100 人の独立評価（他人の票を見せない）。2 択（同お題・別お題）、3 択、4 択、二値分類の 5 タスク 600 問 | GPT-5 67.6%、Claude Opus 4 68.7%、Gemini 2.5 Pro 53.4%、クラウドワーカー 68.7%。日本語モデル 13B 級は 41〜50% |
| Humor in AI（Zhang ら 2024, NeurIPS）| New Yorker キャプションコンテスト。2.5 億票、220 万キャプション（3 段階評価を UCB バンディットで収集） | 一対比較で GPT-4 Turbo 67%、クラウドワーカー 61%。グループ比較では GPT-4 Turbo 74%、クラウド 59%、元編集者 94% |
| Bridging the Creativity Understanding Gap（2025, EMNLP Findings）| 同データ。上位 1〜10 位 vs 1000 位付近の一対比較 | プロンプトのみ: GPT-4o 67.3%、Claude 3.5 Sonnet 65.8%、o1 69%。専門家平均 78% |
| Cards Against LLMs（2026）| Cards Against Humanity。10 枚から人間の勝者を選ぶ。5 モデル、9,894 ラウンド | Claude 18%、Grok / Gemini 17%、GPT / DeepSeek 13〜14%。偶然 10%、単純予測ベースライン 19〜20%。モデル間一致 21〜45% > 人間との一致 |
| HumorRank（2026）| SemEval-2026 のジョークを LLM 判定器（Llama 3.3 70B）で一対比較 | 60 組で人間 3 人と照合: 人間同士の生一致 52.6%、人間–LLM 49.0% |
| Oogiri-GO / CLoT（Zhong ら 2024, CVPR）| 画像お題。「真の回答／画像キャプション／別画像のキャプション」の 3 択 | GPT-4 19.3%、提案手法 41.8%（画像入力なので OCR 能力が混ざる） |

要点: **選択式なら frontier モデルは「クラウドワーカー 1 人」程度**の精度になるが、専門家や多人数集計には遠い。攻めた笑い（CAH）では safety 調整と衝突して人間より政治・属性ネタを避け、位置バイアス（特定の選択肢位置に集中）も観測される。

### 2.3 トーナメント集約（Bradley–Terry / Elo）

一対比較を多数集めて、回答やシステムの潜在強さを推定する。

- **SemEval-2026 Task 1 MWAHAHA**（初のユーモア生成 shared task）。37 チーム、Chatbot Arena 型で 12,936 件の人間の一対比較を集め Bradley–Terry で順位化。**項目単位の一致は Fleiss κ = 0.15、Krippendorff α = 0.17 と低いが、評価者プールを 2 分割して作ったシステム順位同士の Spearman は平均 0.79**。ノイズの多い個別判定でも集約すれば順位は信頼できる、という設計上の教訓。ただし Gemini 2.5 Flash のゼロショットベースラインが全サブタスクで 1 位タイ、あるチームが**自分の最下位候補を提出しても 1 位タイ**になった。上位の差が人間評価のノイズより小さい飽和領域に入っている。
- **HumorRank**: Adaptive Swiss トーナメント + Bradley–Terry MLE（ブートストラップ CI）+ Stable Elo。LLM 判定器 2 種（Llama 3.3 70B、Qwen 2.5 72B）のリーダーボードは Kendall τ = 0.889 で一致。ただし人間との項目単位一致は 49%（上記）。**判定器同士の一致の高さは、人間との一致を意味しない。**
- SemEval-2026 の参加システム 28 件中 18 件が **generate-then-rank**（候補を多数生成し LLM 判定や選好モデルで選ぶ）。「生成より選択がボトルネック」（lmfaoooo）。

### 2.4 解釈可能な要因への分解

「面白いか」を聞かず、面白さと相関する性質を測る。このリポジトリが `trait-check`（具体性・説明的さ）でやっていることの一般化。

- **中川ら 2019（ANLP）**: クラウドソーシングで大喜利の面白さの構成要素を評価し回帰。「関係性」「わかりやすさ」「新しさ」の 3 要素で面白さの大部分が説明できる。
- **Oogiri-Master**: 人間の面白さ評価との効果量（Cohen's d）。視点転換 0.50、曖昧性の利用 0.42、不調和の解消 0.36、連想距離 0.33、良性の逸脱 0.27、比喩 0.24（いずれも LLM に採点させた特徴）。回答長 −0.28、お題との長さ比 −0.27。意味距離・surprisal・品詞比率は |d| < 0.2 で寄与が小さい。この特徴をプロンプトに入れる **insight-augmented prompting** は、「迷ったときだけ参照せよ」と指示した場合に GPT-5 で 67.6 → 70.7%（常時参照は 68.9%）。ただし Claude Opus 4 では −9.5 ポイントと逆効果で、モデル依存。
- **Who Laughs with Whom（Murakami ら 2026、ANLP 2026 Q6-6 と同内容）**: 言語特徴 45 個（長さ・文字種・品詞・文末・文体・お題との関係）+ ユーモア戦略ラベル 11 個（incongruity、black_joke_satire、personification、parody、wordplay、self_reference、surreal_nonsense、exaggeration、dialogue、mini_story、meta。GPT-5.1 で 3 回投票の多数決で付与）を要因とし、投票データから Bradley–Terry–Luce で要因重みを推定。多くのクラスタで共通して正: wordplay、適切な長さ（len-char-medium）。共通して負: exaggeration、surreal_nonsense、名詞優位。
- **lmfaoooo（SemEval-2026 1 位）**: 選好ペアの差分を LLM に説明させ、クラスタリングして 17 個の解釈可能な特徴（Clear Punchline、Subverting Expectations、Wordplay with Purpose、Dark Humor など）を作り、その上で**一対比較の選好モデル**を学習。絶対採点モデルとの比較: Reddit 83% vs 63%、Scale.AI 64% vs 58%、自前の Humor Arena（2,543 組）77% vs 45%。特徴の一部（Clear Punchline、Subverting Expectations）はデータセット間で転移し、他は評価者集団に固有。
- **HumorRank**: GTVH（General Theory of Verbal Humor）に基づき、判定器に機構（incongruity、absurdity、wordplay…）・提示（簡潔さ、punchline の位置）・失敗（cliché、weak punchline、overexplained）のタグを付けさせる。理由付きの判定になり、単なる点数より監査しやすい。
- **THInC（2024）**: ユーモア理論（優越・解放・不調和・不調和解消）ごとに代理特徴を設計し、解釈可能な GA2M 分類器のアンサンブルで検出 F1 85%。ジョーク検出（二値）向き。

要点: **記述的な要因は人間と安定に相関し、判定器の再テスト信頼性も高い。** 一方で SemEval-2026 の総括にあるように、理論に基づくプロンプトやペルソナは「広く試されるが差別化要因にはならない」。特徴は生成の目標ではなく、評価・選択側に置くのが文献でも実務でも定番。

### 2.5 説明に基づく評価（面白さではなく理解を測る）

「面白いか」の主観性を避け、「なぜ面白いかを説明できるか」を測る系列。

- **HumorBench（2025）**: New Yorker のキャプションについて、モデルの説明が人手で書いた「要素」（1〜3 個の検証可能な事実）を含むかを GPT-4o が採点。人間の専門家 300 判定に対し正解率 92%（ただし偽陽性 14.8% > 偽陰性 6.5% で甘い）。「面白さの判定は理解と好みの 2 能力を混ぜてしまう」と明示して理解だけを測る。STEM 推論能力と高相関。
- **Chumor 1.0 / 2.0**: 中国語のユーモア説明データセット。最良 LLM 60.3%、人間 78.3%。
- **Comparing Apples to Oranges（2025）**: 駄洒落から時事ネタまでのジョークで LLM の説明を Prometheus 2 / Qwen 72B の判定器で採点。
- **From Punchlines to Predictions（Romanowski ら 2025）**: スタンダップの書き起こしから笑いどころを抽出させる。ファジー一致・埋め込み・部分空間類似の 3 指標。LLM は最大 51%、人間は 41%。
- **Pun Unintended（2025, EMNLP）**: 駄洒落の理解は表面的で、少し変えると崩れる。

要点: 「理解」の自動採点は 90% 超の一致が出せるが、それは**面白さの判定ではない**。生成物の質を測る用途には直接使えないが、「お題との接続が説明できるか」のような足切り（Relevance の下限）には使える可能性がある。

### 2.6 人間の選好で判定器を学習・調整する

- **Bridging the Creativity Understanding Gap（2025）**: 279 枚の漫画 × 20 組 = **5,580 組**の一対比較（上位 1〜10 位 vs 1000 位付近、30 位付近 vs 300 位付近）で GPT-4o を SFT。プロンプトのみ 67.3% → 視覚記述の改善 +3 → o1 生成の説明を添える +3 → 選好での学習 **+9.4 → 82.4%**。専門家平均 78% を上回る。ペルソナ（弁護士、Bob Mankoff 等 9 種）は最大 +3%。「特定の集団・個人への少量アライメント」が効く、が主張。
- **Humor in AI（2024）**: 生成側では SFT が性能を落とし、Best-of-N 選択と DPO が効いた（RLHF より DPO）。判定器を良くして選ぶ、という generate-then-rank の裏付け。
- **lmfaoooo（2026）**: 上記。2.5K 組の人間比較 + Reddit 票 + Scale.AI 注釈で軽量な選好モデルを学習し、LLM-as-judge ベースラインを上回る。
- **IROH（JOKER 2026）**: 理由（rationale）を蒸留して QLoRA で学習した 7B の判定器が 31B を上回る。「小さくても較正の良いモデルが主観的な順位付けでは勝つ」。ただし理由なし学習との対照実験がなく、理由の寄与は未証明。
- **Cross-Model Humor Preference Modeling（2025）**: Claude が GPT-4o の好みを予測する CAH 課題。役割指示だけでは 0.7% → 19〜26% だが、**過去の選択例を見せると 72.8%、理由付きで見せると 82.3%**。「誰の好みか」を教える最も効く方法は、指示でもペルソナでもなく、その人の判定例と理由。
- **One Joke to Rule them All（2025）**: 複数ジョークデータで学習した検出器の未知ドメインへの転移は最大 75%。多様なデータで学習すると転移が 2〜4% 上がる。

要点: **数千組（New Yorker）〜数百組（CAH の 97 例）の人間の一対比較があれば、LLM 判定器を人間の専門家水準まで寄せられる。** ゼロショットの限界（2.1〜2.2）と、この結果の差は大きい。

### 2.7 評価者の異質性とペルソナ

- **Who Laughs with Whom（2026）**: 大喜利総合サイトの投票履歴（276 人、57,751 票）を TF-IDF → SVD → K-means で 7 クラスタに分割。クラスタ間の要因重みの相関は −0.39〜0.41 で、好みは本当に異なる。GPT-5.1 / Gemini 3 Pro / Claude Sonnet 4.5 に「最も面白い回答」を選ばせて同じ要因で BTL 推定すると、**全ユーザ平均とは −0.22〜−0.36、C0 とは 0.52〜0.57**。LLM は極端に長い回答・語彙の多い回答・スラングを人間のどのクラスタより好む。ペルソナ（性別 × 年齢 20/45/65）で C0 との相関を 0.39 → 0.63 に上げられるが、「整合するクラスタを切り替えるのではなく強さを変える」だけ。著者らは「一致率の低さをノイズではなく異質性として扱う」枠組みを提案。
- **Bridging the Creativity Understanding Gap**: ペルソナは +3% 程度（上記）。
- **Curiosity-Driven LLM-as-a-judge（2025）**: 判定器が不確かな領域を探索して個人ごとの好みモデルを作る。固定ルーブリックからの脱却を主張。
- **Crowd Score**: ユーモアスタイル別の人格を複数与えて投票を集計。攻撃的・自虐的な人格は攻撃的・自虐的なジョークを面白がる、という方向性の一致は出る。

要点: **「LLM は人間と一致しない」の多くは「LLM は評価者集団の平均と一致しない」。** 評価者 1 人なら、その人が LLM の好みに近いクラスタかどうかで結果が変わる。ペルソナは安価だが効果は小さく、判定例を見せる（2.6）ほうが効く。

### 2.8 対照ペアと「面白くなさ」の検出

- **Unfun.me（West & Horvitz 2019）**、**Getting Serious about Humor（Horvitz ら 2024）**: 風刺見出しを最小編集で「真面目」にした対照ペア。LLM は「笑いを取り除く」のは上手い。面白い／面白くないの最小対で、どこで笑いが生まれるかを局所化できる。
- **Sakabe ら 2025**: 人間と LLM の一致は「面白くない回答」で最も高い（ρ ≈ 0.45）。「negative の一致」。
- **Jentzsch & Kersting 2023**: ChatGPT は 1,008 ジョーク中 90% 超が同じ 25 種。検出では、ジョークらしい表面特徴（設定–punchline 構造）があれば中身がなくても「ジョーク」と判定する。
- HAHA / SemEval 2021 HaHackathon: 「ユーモアか」の二値は α 0.60〜0.74、「どれくらい面白いか」の採点は α 0.09〜0.22。

要点: **「面白くない」「成立していない」の判定は、「どれくらい面白いか」より人間と一致しやすい。** ただし大喜利の生成物のように全回答が「笑わせようとしている」データでは値域が狭く、この利点は使いにくい（このリポジトリの `risk-flags` がチャンスレベルなのはこれと整合する）。

## 3. 人間同士の一致（判定器の上限として）

| データ | 指標 | 値 |
|---|---|---|
| SemEval-2026 一対比較（3 値）| Fleiss κ / Krippendorff α | 0.15 / 0.17（サブタスク別 0〜0.34）|
| SemEval-2026 システム順位（評価者 2 分割）| Spearman ρ | 平均 0.79（0.59〜0.90）|
| HumorRank 一対比較（60 組）| Krippendorff α | 0.43（2 人）→ 0.40（3 人）。生一致 52.6% |
| HAHA 2021 スペイン語ツイート | α | 二値 0.60、5 段階採点 0.09 |
| SemEval 2021 HaHackathon 英語 | α | 二値 0.74、採点 0.12 |
| Castro ら 2016 | Fleiss κ | 0.33〜0.42 |
| Humor in AI 一対比較 | クラウドワーカー正解率 | 61%（集約ラベルに対して）|
| Oogiri-Master 選択課題 | クラウドワーカー正解率 | 68.7%（約 100 人集約ラベルに対して）|

含意:

- **項目単位の一致は人間同士でも 50〜60% 台、κ で 0.1〜0.4。** LLM 判定器が項目単位で 65〜70% なら「クラウドワーカー 1 人」相当で、それ以上を求めるなら人間側も多人数集約が必要。
- **信頼できる正解ラベルは多人数集約から生まれる。** Oogiri-Master は 1 回答 約 100 人、New Yorker は 1 キャプション数百票、Sakabe らは 4 人、ANLP 2025 は 5 人。評価者 1 人 × 少数のラベルは、判定器を検証するには区間が広すぎる。
- **順位は集約すれば安定する。** 版やシステムの優劣を比べる用途なら、項目単位の一致が低くても Bradley–Terry で十分に判別できる（SemEval-2026）。

## 4. このリポジトリへの示唆

現状（`reports/validation/2026-09-25/summary.md`）: `funniness-score` の 6 軸は Jev で AUC 0.37〜0.44（逆向き）、ルーブリックなしの `naive` も 0.42、記述的な `trait-check`（`concrete`、`−indirect`）が 0.62〜0.67、被りの `overlap-check` は 0.94。正解データは評価者 1 人、75 回答（当たり 22）、一対比較 60 組。

文献と照らすと:

1. **「面白いか」を直接聞く判定がチャンスレベル以下なのは、文献の一般傾向と同じ。** Sakabe らの ρ 0.17〜0.27、HumorRank の 49%、CAH の 13〜18% と並ぶ。ただし「逆向き」（AUC < 0.5）は文献にはあまりなく、評価者の好みが LLM の好みと逆のクラスタにある（Who Laughs with Whom）か、サンプルが小さいかのどちらか。**複数評価者のデータが入るまで、逆向きの信号を反転して使ってはいけない**（`research/README.md` の既存方針と同じ）。
2. **記述的な質問に寄せた判断は、文献の結論と一致する。** `concrete`（質感のある物・現象）と `−indirect`（説明的でない）は、Oogiri-Master の「回答長 d=−0.28」「視点転換 d=0.50」、Who Laughs with Whom の「exaggeration は多くのクラスタで負」「len-char-medium は正」と同じ方向。Oogiri-Master の 6 特徴（曖昧性の利用、連想距離、良性の逸脱、不調和の解消、比喩、視点転換）と、Who Laughs with Whom の 11 戦略ラベルは、**新しい Jev の 1 問候補**としてそのまま試せる。特に `exaggeration`（人間の所見「誇張のみは失敗する」07-10 と一致）と `surreal_nonsense`（`risk-flags` のシュール手癖）は、人間側の裏付けがある。
3. **判定器の改善で最も効くのは、人間の一対比較データで判定器を調整すること。** Jev は固定モデルなので学習はできないが、プロンプト版の判定器なら、Cross-Model CAH の結果（判定例 + 理由で 0.7% → 82.3%）を踏まえて、**ブラインドの一対比較に人間の判定例と理由を数十組添える**のが最も安価な実験。ただし `data/human-evals/README.md` の Example Firewall どおり、検証に使うペアと、例として見せるペアは分け、お題も分ける。New Yorker で必要だったのは 5,580 組、CAH で 97 例なので、今の 60 組は例に回すには足りず、まず正解データを増やす必要がある。
4. **正解データの取り方は一対比較 + 多人数へ。** 文献の正解ラベルは 4〜100 人の集約。今の「1 人・75 回答」で AUC の 95% 区間が ±0.15 なのは妥当な幅で、判定器の差 0.05 を見分けるには足りない。`npm run validate:blind -- make` が出す `pairs.md` を複数人に配る（`research/README.md` の cluster-fit-check の項にある手順）が、判定器の検証にもそのまま効く。
5. **セット・版の優劣は Bradley–Terry で集約する。** ogiri-ai のゲートチェックで新旧の版を比べるときは、回答単位の判定の一致率ではなく、SemEval-2026 のように多数の一対比較を BT で集約した版の強さで比べる。項目単位の一致が低くても順位は安定する、という結果はこの用途を直接支持する。`trait-check` の `compare.ts` で総当たりして勝率を出す案（`reports/validation/2026-09-24/notes.md`）は、この形。
6. **偏りの検査を検証に組み込む。** 文献で再現している偏りのうち、このリポジトリで未検査のもの: (a) **位置バイアス**（A/B を入れ替えて再判定し、判定の反転率を出す）、(b) **無関係回答への positivity bias**（別のお題の当たり回答を混ぜて、判定器が下げられるか。Relevance の足切りが機能しているかの検査になる）、(c) **長さ**（すでに `−length` ベースラインあり）。self-preference は出所を伏せているので、検証としては対応済み。
7. **「理解」の採点は Relevance の足切りに使える可能性がある。** HumorBench 型の「お題との接続を説明できるか」は人間と 90% 超で一致する。面白さの判定ではないが、`funniness-score` の Step 2（Relevance ≤ 1 で Overall をクリップ）を、点数ではなく「接続の説明が成立するか」の noul に置き換えると、Jev で安定しやすいはず。
8. **Goodhart への警戒は文献も同じ。** SemEval-2026 で「最下位候補を出しても 1 位タイ」になった飽和、Humor in AI で SFT が生成を悪化させた結果、07-11 のアトラクター化は、いずれも「測れる性質を最大化すると面白さが落ちる」例。記述的な指標は下限の確認（退行の検出）に使い、最大化の目標にしない、という現行方針を維持する。

## 5. 未確認・未調査

- **HumorGen（2026, EMNLP）**、**Who's Laughing Now?（Loakman ら 2025, サーベイ）**、**OpenMic（2026）** は要旨のみ確認。評価の詳細は未読。
- **Oogiri-Master の「二値分類（funny / not funny）」タスクの単独の数値**は未確認（5 タスク平均のみ）。
- **日本語の生成物に対する学習済み選好モデル**（Oogiri-Corpus で学習した reward model）の報告は見つからなかった。Oogiri-Corpus には約 100 人 × 約 100 回答の独立評価があるので、Bridging の再現（少量 SFT で人間水準）を日本語で試す余地がある。
- **評価者 1 人の場合の LLM 判定の「逆向き」現象**を扱った論文は見つからなかった。

## 文献一覧

本文まで確認（HTML またはテキスト抽出）:

- Murakami, Kamigaito, Takamura, Okumura. *Oogiri-Master: Benchmarking Humor Understanding via Oogiri.* [arXiv:2512.21494](https://arxiv.org/abs/2512.21494)（2025）。データ構築: [CyberAgentAILab/oogiri-dataset-builder](https://github.com/CyberAgentAILab/oogiri-dataset-builder)
- Murakami ら. *Who Laughs with Whom? Disentangling Influential Factors in Humor Preferences across User Clusters and LLMs.* [arXiv:2601.03103](https://arxiv.org/abs/2601.03103)（2026）。日本語版: 村上・上垣外・高村・奥村「個別選好の異質性を考慮した大喜利ユーモア選好要因の分析」[ANLP 2026 Q6-6](https://www.anlp.jp/proceedings/annual_meeting/2026/pdf_dir/Q6-6.pdf)
- Sakabe, Kim, Hirasawa, Komachi. *Assessing the Capabilities of LLMs in Humor: A Multi-dimensional Analysis of Oogiri Generation and Evaluation.* [arXiv:2511.09133](https://arxiv.org/abs/2511.09133)（2025, AAAI 2026）。`funniness-score` の 6 軸の出典
- 坂部・金・小町「人間と LLM の“面白さ”の感性は一致するのか？」[ANLP 2025 P7-9](https://www.anlp.jp/proceedings/annual_meeting/2025/pdf_dir/P7-9.pdf)
- 中川・村脇・河原・黒橋「クラウドソーシングによる大喜利の面白さの構成要素の分析」[ANLP 2019 B3-2](https://www.anlp.jp/proceedings/annual_meeting/2019/pdf_dir/B3-2.pdf)（要旨のみ）
- Chiruzzo ら. *SemEval-2026 Task 1: MWAHAHA, Models Write Automatic Humor And Humans Annotate.* [ACL Anthology 2026.semeval-1.454](https://aclanthology.org/2026.semeval-1.454/)。[Codabench](https://www.codabench.org/competitions/9719/)、[GitHub](https://github.com/pln-fing-udelar/semeval-2026-humor-gen)
- Tikhonov, Ivanov. *lmfaoooo at SemEval-2026 Task 1: Humor Is an Audience. Preference Modeling for Constrained Humor Generation.* [arXiv:2606.00022](https://arxiv.org/abs/2606.00022)
- *HumorRank: A Tournament-Based Leaderboard for Evaluating Humor Generation in Large Language Models.* [arXiv:2604.19786](https://arxiv.org/abs/2604.19786)（2026）
- *Bridging the Creativity Understanding Gap: Small-Scale Human Alignment Enables Expert-Level Humor Ranking in LLMs.* [arXiv:2502.20356](https://arxiv.org/abs/2502.20356)、[EMNLP 2025 Findings](https://aclanthology.org/2025.findings-emnlp.884/)
- Zhang ら. *Humor in AI: Massive Scale Crowd-Sourced Preferences and Benchmarks for Cartoon Captioning.* [arXiv:2406.10522](https://arxiv.org/abs/2406.10522)（NeurIPS 2024）
- *Cards Against LLMs: Benchmarking Humor Alignment in Large Language Models.* [arXiv:2604.08757](https://arxiv.org/abs/2604.08757)（2026）
- Winter, Lakhany. *Cross-Model Humor Preference Modeling with Cards Against Humanity.* [arXiv:2608.07481](https://arxiv.org/abs/2608.07481)（2025）
- *Which LLMs Get the Joke? Probing Non-STEM Reasoning Abilities with HumorBench.* [arXiv:2507.21476](https://arxiv.org/abs/2507.21476)（2025）
- Góes, Zhou, Sawicki, Grzes, Brown. *Crowd Score: A Method for the Evaluation of Jokes using Large Language Model AI Voters as Judges.* [arXiv:2212.11214](https://arxiv.org/abs/2212.11214)（2022）

要旨・二次情報のみ:

- Hessel ら. *Do Androids Laugh at Electric Sheep? Humor "Understanding" Benchmarks from The New Yorker Caption Contest.* [arXiv:2209.06293](https://arxiv.org/abs/2209.06293)（ACL 2023 best paper）
- Zhong ら. *Let's Think Outside the Box: Exploring Leap-of-Thought in LLMs with Creative Humor Generation (CLoT, Oogiri-GO).* [arXiv:2312.02439](https://arxiv.org/abs/2312.02439)（CVPR 2024）
- Jentzsch, Kersting. *ChatGPT is fun, but it is not funny!* [arXiv:2306.04563](https://arxiv.org/abs/2306.04563)（WASSA 2023）
- Gorenz, Schwarz. *How funny is ChatGPT? A comparison of human- and A.I.-produced jokes.* [PLOS ONE 2024](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0305364)
- Horvitz ら. *Getting Serious about Humor: Crafting Humor Datasets with Unfunny LLMs.* [arXiv:2403.00794](https://arxiv.org/abs/2403.00794)（ACL 2024）。West, Horvitz. *Reverse-Engineering Satire (Unfun.me).* [AAAI 2019](https://dlab.epfl.ch/people/west/pub/West-Horvitz_AAAI-19.pdf)
- Romanowski, Valois, Fukui. *From Punchlines to Predictions: A Metric to Assess LLM Performance in Identifying Humor in Stand-Up Comedy.* [arXiv:2504.09049](https://arxiv.org/abs/2504.09049)（CMCL 2025）
- *Comparing Apples to Oranges: A Dataset & Analysis of LLM Humour Understanding from Traditional Puns to Topical Jokes.* [arXiv:2507.13335](https://arxiv.org/abs/2507.13335)（EMNLP 2025 Findings）
- *Pun Unintended: LLMs and the Illusion of Humor Understanding.* [arXiv:2509.12158](https://arxiv.org/abs/2509.12158)（EMNLP 2025）
- *Chumor 2.0: Towards Benchmarking Chinese Humor Understanding.* [arXiv:2412.17729](https://arxiv.org/abs/2412.17729)
- *THInC: A Theory-Driven Framework for Computational Humor Detection.* [arXiv:2409.01232](https://arxiv.org/abs/2409.01232)（ECAI 2024）
- *One Joke to Rule them All? On the (Im)possibility of Generalizing Humor.* [arXiv:2508.19402](https://arxiv.org/abs/2508.19402)
- *Curiosity-Driven LLM-as-a-judge for Personalized Creative Judgment.* [arXiv:2510.05135](https://arxiv.org/abs/2510.05135)
- *IROH: Insightful Ranking Of Humor using Multi-Stage Hybrid Retrieval with Rationale-Distilled LLM Judges (JOKER 2026).* [arXiv:2609.15618](https://arxiv.org/abs/2609.15618)
- Tikhonov, Shtykovskiy. *Humor Mechanics: Advancing Humor Generation with Multistep Reasoning.* [arXiv:2405.07280](https://arxiv.org/abs/2405.07280)
- Loakman, Thorne, Lin. *Who's Laughing Now? An Overview of Computational Humour Generation and Explanation.* [arXiv:2509.21175](https://arxiv.org/abs/2509.21175)
- *HumorGen: Cognitive Synergy for Humor Generation in LLMs via Persona-Based Distillation.* [arXiv:2604.09629](https://arxiv.org/abs/2604.09629)（EMNLP 2026）
- *Re-defining Humor Data Objects for AI Humor Research.* [arXiv:2605.25171](https://arxiv.org/abs/2605.25171)
- Liu ら. *Aligning with Human Judgement: The Role of Pairwise Preference in LLM Evaluators (PairS).* [arXiv:2403.16950](https://arxiv.org/abs/2403.16950)
- Gu ら. *A Survey on LLM-as-a-Judge.* [arXiv:2411.16594](https://arxiv.org/abs/2411.16594)
