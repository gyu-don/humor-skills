# 人間評価データ

評価器（`skills/*`）を検証するための正解データ。評価器の出力（`reports/`）とは分けて、人間の判定だけをここに置く。

```
data/human-evals/
└── <source>/                 評価対象の生成元（例: ogiri-ai）
    ├── findings.md           ログから蒸留した知見（日付を引用して書く。具体例つきの経緯）
    ├── <date>.md             セッションの記録（人間が読む。経緯・コメント・所感）
    └── <date>.json           同じセッションの構造化ラベル（スクリプトが読む）
```

同じ日に複数のセッションがある場合は `<date>-<slug>.md/.json` にする。セットの ID は日付を前に付けたものがグローバル ID になるので、同じ日のセッションどうしでも被らないようにする（被ると読み込みが止まる）。受付箱から来たセッションは、セットの ID の先頭に依頼の id が付く。

## 溜め方のルール

1. **1セッション = `.md` と `.json` の1組。** `.md` には経緯と自由記述のコメントを、`.json` には下のスキーマのラベルを書く。数字や順位は `.json` を正とする。
2. **生の出力を全部残す。** 褒めた回答だけでなく、セットの5本すべてを残す。2026-09-22 は生の出力が残っておらず、`.json` を作れなかった（当たりと比べる外れがないため、検証に使えない）。
3. **ブラインドかどうかを記録する（`blind`）。** 出所（モデル、版、スキルの有無）を知った状態の判定は、知らない状態の判定より偏りうる。可能ならブラインドで評価する。
4. **過去のセッションは書き換えない。** 判定が変わったら、新しいセッションとして追記する（例: 2026-09-23 のブラインド再評価）。誤記の修正だけは例外。
5. **ここにある具体例は「評価ゾーン」専用。** 生成側のプロンプト（ogiri-ai の `SKILL.md`）には持ち込まない（ogiri-ai の `DEVELOPMENT.md` にある Example Firewall を参照）。検証中の評価器にもこのディレクトリを読ませない（`src/validation/` のブラインド入力だけを渡す）。

## `.json` スキーマ

```jsonc
{
  "date": "2026-07-11",
  "source": "ogiri-ai",
  "rater": "repo-owner",
  "blind": false,                      // 出所を伏せて評価したか
  "log": "2026-07-11.md",
  "description": "何と何を比べたセッションか",
  "request": { "id": "...", "kind": "final-check", "ledger": "..." },   // 任意。受付箱（data/inbox/）から来たセッションに付く
  "topics": { "firsttake": "THE FIRST TAKEの新作" },   // セッション内のお題キー → お題の文
  "sets": [
    {
      "id": "firsttake/fable-5-skill-off",  // 同じ日付のセッション全体で一意。「<お題キー>/<条件>」（受付箱からは「<依頼 id>/<お題キー>/<版>」）
      "topic": "firsttake",
      "condition": "Fable 5 スキルなし",
      "answers": ["...", "...", "...", "...", "..."],
      "hits": [2, 3, 5],       // 人間が褒めた回答の番号（1始まり）。[] = 当たりなし、null = 回答ごとの判定なし
      "misses": [1],           // 任意。人間が悪いと印を付けた回答の番号。これがあるセットでは、hits にも misses にもない回答は
                               // 「外れ」ではなく「不明」として扱い、一致率の計算から外す（受付箱から来たセッションはこの形）
      "ranking": [2, 3, 5],    // 任意。明示された順位（良い順、部分的でもよい）
      "verdict": "人間のコメントの要約",
      "converged": "...",      // 任意。人間がセット内の収束を指摘した場合、その内容
      "role": "candidate",     // 任意。版の比較（ゲート）で、変更後の版なら "candidate"、変更前なら "baseline"
      "sourceOrder": ["cand-r1#5", "cand-r2#3", "..."]   // 任意。複数回の生成をプールしたセットで、answers と同じ順に
                               // 各回答の出所を "<版>-r<実行番号>#<その実行内の番号>" で書く
    }
  ],
  "setPreferences": [          // セット単位で明確に優劣が付いた組
    { "better": "firsttake/fable-5-skill-off", "worse": "firsttake/fable-5-skill-on" }
  ],
  "setTies": [                 // 任意。セット単位で比べて、引き分けとされた組
    { "a": "codex/candidate", "b": "codex/baseline" }
  ],
  "pairPreferences": [         // 回答単位の一対比較
    { "a": "geinou/before#1", "b": "geinou/after#2", "winner": "a", "note": "任意" }
  ],
  "similarityJudgments": [     // 任意。「同じセットに並んでいたら被っていると感じるか」
    { "a": "...#1", "b": "...#3", "similarity": "similar" }   // similar / partial / different
  ],
  "traitJudgments": [          // 任意。判定器の yes/no の質問に、同じ文面で人間が答えたもの
    { "answer": "2026-07-11/askul/fable-5-skill-on#4", "judge": "risk-flags", "metric": "betaRisk",
      "question": "判定器に渡した質問文", "label": "no", "note": "任意",    // yes / no / unsure
      "judgeProbability": 0.72 }   // 任意。そのとき判定器が出した yes の確率（criterion-count の抜き取り確認）
  ],
  "scoreJudgments": [          // 任意。判定器の score の質問に、同じ尺度で人間が答えたもの
    { "answer": "...#4", "judge": "funniness-score", "axis": "overall", "question": "...", "score": 3 }
  ]
}
```

- 回答の ID は `<set id>#<番号>`。別のセッションの回答を参照するときは、日付を前に付けて `2026-07-11/firsttake/fable-5-skill-off#3` と書く。
- 引き分けは、回答単位なら `"winner": "tie"`、セット単位なら `setTies` に書く。比べたのに `setPreferences` にも `setTies` にもない組は、「比べていない」と区別できなくなる。
- `role` と `sourceOrder` があるお題（候補・ベースラインの両方が、2回以上の生成をプールしたセット）は、`trait-check` の版の比較（`scripts/versions.ts`）の検証に使う。実行ごとの回答に戻せるように、プールしたセットには `sourceOrder` を必ず残す。
- 版の採否を決めるブラインド比較は、手で書かずに受付箱を通す（`data/inbox/README.md`）。判定が済むと、このスキーマのセッションが自動で書かれる。
- 「微妙」「まあまあ」のような中間の評価を `hits` に入れるかどうかは、`.md` のコメントで判断の根拠を残す。

## 知見の置き場所

セッションから引き出した仮説は、`data/ledger/<source>.json` に1件ずつ足す（書き方は `data/ledger/README.md`）。台帳には具体的な回答を書かず、状態（支持・否定・未決）を持たせる。`findings.md` は、具体例つきの経緯を残す場所として使う。
セッションを足したら `npm run status` で `STATUS.md` を作り直す。セット単位で比べた組は、優劣なら `setPreferences`、引き分けなら `setTies` に必ず入れる。入っていない組は、台帳の表で「未判定」と出る。

## 使い道

`src/validation/` のスクリプトがこのディレクトリの `.json` をすべて読み、評価器の判定と人間の判定の一致率を測る（`src/validation/README.md` を参照）。
新しいセッションを追加するたびに正解データが増え、評価器を改善したときの比較に使える。
