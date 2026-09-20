/**
 * gyu-don/ogiri-ai の skills/ogiri-ai/SKILL.md が自分で明文化している規律を、
 * Jev で定量的に測る。
 *
 *   doppler run -- npm run audit:ogiri-ai
 *   doppler run -- npm run audit:ogiri-ai -- reports/ogiri-ai/rule-audit.json
 *
 * 測るのは 2 つ。
 *  1. バカの深さ（やり方 / 状況 / 前提）の分布。SKILL.md は「前提の勘違い」が一番笑えると
 *     主張しているが、その介入が効いているかを見る手段が今までなかった。
 *  2. SKILL.md の自己ルールの遵守率（1回答1ひねり、オチの語で文を終える、当人は真剣、
 *     自分にツッコまない、など）。「書いた指示が守られたか」と「結果が良くなったか」を分離する。
 *
 * 20 文字制限と「」の本数は Jev ではなくコードで数える（決定的に取れるものを聞かない）。
 *
 * ルール定義は SKILL.md の該当箇所と対応させてある。SKILL.md 側の文言が変わったら
 * ここも見直すこと。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { choice, noul, score, TypeSafeClient } from '@typesafe-ai/sdk';

const SAMPLES_PATH = 'data/ogiri-ai/samples.json';
const OUT_PATH = process.argv[2] ?? 'reports/ogiri-ai/rule-audit.json';

interface Sample {
  id: string;
  label: string;
  topic: string;
  answers: string[];
}

if (!process.env.TYPESAFE_API_KEY) {
  console.error(
    'TYPESAFE_API_KEY is missing. Run through Doppler: doppler run -- npm run audit:ogiri-ai',
  );
  process.exit(1);
}

const samples = JSON.parse(readFileSync(SAMPLES_PATH, 'utf8')) as Sample[];
const client = new TypeSafeClient({ timeout: 60_000 });

/** SKILL.md が明文化しているルールを 1 つ 1 問の Noul に割る。 */
const rules = {
  oneTwist: noul(
    '当たり前から外している箇所は 1 箇所だけか？',
    {
      true: '外している箇所は 1 箇所。その 1 箇所を戻すと普通の文として成立する。',
      false: '外している箇所が 2 箇所以上ある、または全体が現実から離れていて戻す場所を特定できない。',
    },
  ),
  punchlineLast: noul(
    '一番おかしい語がこの回答の末尾にあるか？',
    {
      true: '一番おかしい語で文が終わっている。',
      false: '一番おかしい語が文中に埋まっていて、その後に説明や補足が続いている。',
    },
  ),
  /** earnest は「人がいるか」と「その人が真剣か」の 2 因子なので分ける（分けないと人なし＝不真剣に潰れる）。 */
  hasPerson: noul(
    'この回答には、変なことをやっている人物が登場するか？',
    {
      true: '人物の行動・様子が描かれている。',
      false: '物・制度・数値の状態だけで、行動している人物がいない。',
    },
  ),
  earnest: noul(
    '登場人物がいるとすれば、その人は自分の行動を名案だと思って真剣にやっているか？',
    {
      true: '当人は真顔で、恥じてもウケを狙ってもいない。',
      false: '当人がふざけている、照れている、ウケを狙っている。',
    },
  ),
  noSelfTsukkomi: noul(
    'この回答は、自分のボケに自分でツッコミを入れずに終わっているか？',
    {
      true: 'おかしさの指摘は読み手に委ねられている。',
      false: '「なんでやねん」「おかしい」「変だ」のような評価・指摘を回答自身が書いている。',
    },
  ),
  grounded: noul(
    'この回答の土台になっている場面は、多くの人が「その状況わかる」と感じるベタな場面か？',
    {
      true: 'お題から誰もが思い浮かべる、具体的で映像のある平凡な場面が土台になっている。',
      false: 'SF・異世界・制度語・擬人化など、遠い設定や抽象語に逃げていて土台が平凡ではない。',
    },
  ),
  picture: noul(
    '読んだ瞬間に 1 コマの絵として見えるか？',
    {
      true: '誰が何をしている絵かが一読で見える。',
      false: '状態や概念の説明にとどまり、絵にならない。',
    },
  ),
  resolvable: noul(
    '読み手が補う 1 文が、ちょうど 1 通りに確定するか？',
    {
      true: '言われていない事実がひとつあり、それが何かは一意に決まる。',
      false: '全部言い切っていて補う文がない、または補い方が 2 通り以上あって決まらない。',
    },
  ),
  onTopic: noul(
    'この回答は、お題の具体的な要素に 1 文で接続できるか？',
    {
      true: 'お題に直接答えている。',
      false: 'お題の言葉を言い換えただけ、またはお題と関係なく成立してしまう。',
    },
  ),
  unsafe: noul(
    'この回答は、差別的・攻撃的・有害な内容を含むか？',
    {
      true: '特定の属性への差別、実在の個人への攻撃、危害の推奨などを含む。',
      false: 'そうした内容は含まない。',
    },
  ),
} as const;

type RuleKey = keyof typeof rules;
const ruleKeys = Object.keys(rules) as RuleKey[];

const depthQuestion = choice(
  'この回答の中で、当人がズレているのはどのレベルか？',
  {
    method: 'やり方の間違い。道具や手順を間違えているが、何の場面かは正しく分かっている。',
    situation: '状況の読み違い。場面は分かっているが、その深刻さや場の空気に気づいていない。',
    premise: '前提の勘違い。そもそも何の場面か、自分が何者か、何のための集まりかを取り違えている。',
    none: 'ズレている当人がいない。現実に普通に起きることを書いているだけ。',
  },
);

const heightQuestion = score(
  'この回答の、現実からの跳び方の高さは？',
  [
    '現実に普通に起きること。共感はされるが「あるある」止まり。',
    '現実にはまず起きないが、人間ならやりかねない範囲。',
    '絶対に起きない。だが当人の動機・理屈は 1 文で通っている。',
  ],
);

const usage = { requests: 0, input_tokens: 0, output_tokens: 0 };

interface Row {
  sampleId: string;
  index: number;
  answer: string;
  chars: number;
  overLimit: boolean;
  hasQuote: boolean;
  depth: string;
  depthProbabilities: Record<string, number>;
  height: number;
  rules: Record<RuleKey, number>;
}

async function auditAnswer(sample: Sample, answer: string, index: number): Promise<Row> {
  const result = await client.systemOne({
    model: 'jev-latest',
    state: { お題: sample.topic, 回答: answer },
    questions: { depth: depthQuestion, height: heightQuestion, ...rules },
  });

  usage.requests++;
  usage.input_tokens += result.usage.input_tokens;
  usage.output_tokens += result.usage.output_tokens;

  const chars = [...answer].length;
  return {
    sampleId: sample.id,
    index,
    answer,
    chars,
    overLimit: chars > 20,
    hasQuote: answer.includes('「'),
    depth: result.answers.depth.choice,
    depthProbabilities: result.answers.depth.probabilities,
    height: result.answers.height.score,
    rules: Object.fromEntries(
      ruleKeys.map((key) => [key, result.answers[key].noul]),
    ) as Record<RuleKey, number>,
  };
}

const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
const pct = (x: number): string => `${(x * 100).toFixed(0)}%`;

async function main(): Promise<void> {
  const rows: Row[] = [];

  for (const sample of samples) {
    const batch = await Promise.all(
      sample.answers.map((answer, i) => auditAnswer(sample, answer, i + 1)),
    );
    rows.push(...batch);
  }

  const summaries = samples.map((sample) => {
    const own = rows.filter((r) => r.sampleId === sample.id);
    const depthCounts = { method: 0, situation: 0, premise: 0, none: 0 };
    for (const r of own) depthCounts[r.depth as keyof typeof depthCounts]++;
    return {
      id: sample.id,
      label: sample.label,
      depthCounts,
      /** 前提レベルの確率を 5 本で平均した連続量。本数より解像度が高い。 */
      premiseShare: mean(own.map((r) => r.depthProbabilities.premise ?? 0)),
      meanHeight: mean(own.map((r) => r.height)),
      rules: Object.fromEntries(
        ruleKeys.map((key) => [key, mean(own.map((r) => r.rules[key]))]),
      ) as Record<RuleKey, number>,
      codeChecks: {
        overLimit: own.filter((r) => r.overLimit).length,
        maxChars: Math.max(...own.map((r) => r.chars)),
        quoteCount: own.filter((r) => r.hasQuote).length,
      },
    };
  });

  writeFileSync(OUT_PATH, `${JSON.stringify({ usage, summaries, rows }, null, 2)}\n`);

  for (const s of summaries) {
    console.log(`\n== ${s.id}: ${s.label}`);
    console.log(
      `  バカの深さ  前提${s.depthCounts.premise} 状況${s.depthCounts.situation} ` +
        `やり方${s.depthCounts.method} ズレなし${s.depthCounts.none}` +
        `  (前提確率の平均 ${pct(s.premiseShare)})`,
    );
    console.log(`  跳びの高さ  ${s.meanHeight.toFixed(2)} / 2`);
    console.log(
      `  コード検査  20文字超 ${s.codeChecks.overLimit}本 (最長 ${s.codeChecks.maxChars}) ` +
        `/ 「」 ${s.codeChecks.quoteCount}本`,
    );
    console.log('  自己ルール遵守率');
    for (const key of ruleKeys) {
      console.log(`    ${key.padEnd(16)} ${pct(s.rules[key])}`);
    }
  }

  const usd = (usage.input_tokens * 42) / 1e9 + (usage.output_tokens * 42) / 1e9;
  console.log(
    `\n${usage.requests} requests / in ${usage.input_tokens} out ${usage.output_tokens} tokens ` +
      `(~$${usd.toFixed(5)})  -> ${OUT_PATH}`,
  );
}

try {
  await main();
} catch (error) {
  console.error(`ogiri-ai rule audit failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
