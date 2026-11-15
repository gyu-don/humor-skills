# 仮説の台帳

生成スキルについて「何を試し、人間がどう判定し、今どう扱っているか」を、1件1行で残す。
散文のログ（`data/human-evals/<source>/findings.md`、ogiri-ai の iteration log）を読み返さなくても、次の改善の出発点にできるようにする。

```
data/ledger/
└── <source>.json     生成元ごとに1ファイル（例: ogiri-ai.json）
```

表の形では `STATUS.md`（`npm run status` が生成）に出る。人間の判定と判定器の一致は、そこで `data/human-evals/` と最新の検証から引いて並べる。

## 1件の形

```jsonc
{
  "id": "trace-and-number-rule",     // ファイル内で一意。後から引用するための名前
  "kind": "change",                  // "change": 生成スキルへの変更 / "taste": この評価者が何を面白がるかの仮説
  "date": "2026-07-10",              // 仮説を立てた日（変更なら、変更した日）
  "hypothesis": "...",               // 仕組みだけを書く。具体的な回答は書かない（下の規則）
  "change": "...",                   // kind=change のみ。生成スキルの何を変えたか
  "comparisons": [                   // kind=change のみ。この変更を試した、変更後と変更前のセットの組
    { "candidate": "2026-07-11/firsttake/fable-5-skill-on", "baseline": "2026-07-11/firsttake/fable-5-skill-off" }
  ],
  "judge": { "evaluator": "trait-check", "metric": "concrete" },   // kind=taste のみ、任意。この仮説を質問にした判定器
  "status": "refuted",               // supported / refuted / open
  "decision": "...",                 // kind=change のみ。その変更をどう扱ったか（採用、降格、取り消しなど）
  "note": "...",                     // status の理由と但し書き（題数、ブラインドか、何が未確認か）
  "sources": ["data/human-evals/ogiri-ai/2026-07-11.md"]
}
```

- `comparisons` の ID は `data/human-evals/` のセットの ID（`<date>/<set id>`）。勝ち負けはここに書かない。`STATUS.md` が `setPreferences`・`setTies`・`hits` から引く。人間が比べていない組は「未判定」と出る。受付箱を通した最終チェックの分は、判定のときに自動で足される
- `status`
  - `supported`: 人間の判定が仮説の向きに出た
  - `refuted`: 人間の判定が逆に出た。または、狙った効果が出ずに取り消した
  - `open`: 人間の判定がない、割れている、1題の観察にとどまる
- 件数の少なさは `status` ではなく `note` と、`STATUS.md` に並ぶ判定の内訳で読む。1題の `supported` は弱い

## 書き方の規則

1. **具体的な回答、素材、場面、オチを書かない。** 仕組みだけを書く。読んだ人が元の回答を復元できるなら、抽象化が足りない（ogiri-ai `DEVELOPMENT.md` の Example Firewall と同じ基準）。具体例が要るときは `sources` のセッションを開く
2. **数値を書かない。** 一致率や AUC は検証のたびに変わる。`judge` で判定器を指しておけば、`STATUS.md` が最新の値を並べる
3. **追記する。** 判定が増えたら `comparisons`・`status`・`note`・`sources` を更新する。仮説そのものを書き換えたくなったら、新しい行を足して `note` で元の行を引く
4. **新しい改善は、ここの行を引用して始める。** ogiri-ai の iteration log の仮説欄に、根拠にした行の `id` を書く。`refuted` の行と同じ変更をもう一度試すなら、何が違うのかを書く
5. **改善が終わったら1行足す。** 採用しなかった変更も足す。人間の判定がまだなら `open` にしておく
6. **最終チェックは受付箱に出す。** 依頼に行の `id` を書いて `npm run inbox:add` で置く（`data/inbox/README.md`）。行がないと受付箱は依頼を受け付けない。人間が判定すると、その比較が `comparisons` に、ログが `sources` に自動で足され、`STATUS.md` に勝ち・引き分け・負けと採否の規則の結果が出る。`status`・`decision`・`note` は、その結果を見て手で更新する

検証中の判定器には読ませない（どのセットが勝ったかが分かる）。`data/human-evals/` と同じ扱い。
