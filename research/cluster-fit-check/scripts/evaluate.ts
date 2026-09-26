/**
 * Research judge, not an automated test: its cluster weights come from the
 * literature and cannot be checked against human-evals until per-rater
 * labels exist (see research/README.md).
 * Jev port of this directory's SKILL.md: per-answer feature detection, then a
 * fixed literature-derived weighted sum per user cluster (C0-C6). Not a
 * funniness judgment — a preference-fit signal.
 *
 * Usage: doppler run -- node research/cluster-fit-check/scripts/evaluate.ts [input.json] [output.json]
 * Input: [{ "id", "label", "topic", "answers": string[] }, ...] — a single
 * { "topic", "answers": [...] } object also works (wrapped as one sample).
 * Defaults to this skill's assets/samples.json / a results.json in the CWD.
 *
 * Split per this repo's own rule: anything decidable from the text alone
 * (bracket use, sentence-ending punctuation, length) is plain code, not a
 * Jev question. Only the semantic features (self-deprecation, surreal
 * nonsense, personification, etc.) go through Jev, as one `noul` each.
 * The original skill's "half weight for a weak match" is replaced by using
 * the noul probability directly as a continuous weight — no binarizing.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * `@typesafe-ai/sdk` is this skill's only dependency, and a freshly installed
 * copy of the skill doesn't have it yet — say so with the fix rather than
 * letting Node throw a bare ERR_MODULE_NOT_FOUND.
 */
const { noul, TypeSafeClient } = await import('@typesafe-ai/sdk').catch((): never => {
  console.error('@typesafe-ai/sdk is not installed. Run `npm install` at the humor-skills repo root first.');
  process.exit(1);
});

const DEFAULT_SAMPLES_PATH = fileURLToPath(new URL('../assets/samples.json', import.meta.url));
const IN_PATH = process.argv[2] ?? DEFAULT_SAMPLES_PATH;
const OUT_PATH = process.argv[3] ?? 'cluster-fit-check-results.json';

interface Sample {
  id: string;
  label: string;
  topic: string;
  answers: string[];
}

if (!process.env.TYPESAFE_API_KEY) {
  console.error('TYPESAFE_API_KEY is missing. Run through Doppler: doppler run -- node scripts/evaluate.ts');
  process.exit(1);
}

const parsed = JSON.parse(readFileSync(IN_PATH, 'utf8')) as Sample[] | Omit<Sample, 'id' | 'label'>;
const samples: Sample[] = Array.isArray(parsed) ? parsed : [{ id: 'input', label: 'input', ...parsed }];
const client = new TypeSafeClient({ timeout: 60_000 });

// --- Code-deterministic features -------------------------------------------------

function codeFeatures(answer: string): Record<string, number> {
  const chars = [...answer].length;
  const spaces = (answer.match(/[ 　]/g) ?? []).length;
  const sentenceBreaks = (answer.match(/[。！？]/g) ?? []).length;
  return {
    括弧の使用: /[「」()（）]/.test(answer) ? 1 : 0,
    複数文: sentenceBreaks >= 2 ? 1 : 0,
    三点リーダーで終わる: /(\.\.\.|…)$/.test(answer) ? 1 : 0,
    疑問符で終わる: /[?？]$/.test(answer) ? 1 : 0,
    短い長さ比率: chars <= 8 ? 1 : 0,
    非常に長い文字数: chars >= 30 ? 1 : 0,
    高いスペース比率: chars > 0 && spaces / chars >= 0.15 ? 1 : 0,
  };
}

// --- Jev-judged semantic features -------------------------------------------------

const semanticFeatures = {
  対話形式: noul('誰かの発話・返答・会話の形になっているか？'),
  自虐ネタ: noul('話者や回答内主体が自分を下げているか？'),
  シュールな無意味さ: noul('意味の接続より不可解さで成立しているか？'),
  形容詞で終わる: noul('最後が形容詞・形容動詞的な評価で終わっているか？'),
  擬人化: noul('物や概念が人間のように振る舞っているか？'),
  プロンプト内の固有名詞: noul('お題に含まれる固有名詞を核にしているか？'),
  プロンプト内の動詞: noul('お題に含まれる動詞を核にしているか？'),
  ミニストーリー: noul('短い中に前後関係や展開があるか？'),
  スラング: noul('ネット語・若者語・砕けた俗語が核にあるか？'),
  誇張表現: noul('ありえない大きさ・量・強度で押しているか？'),
  メタ的表現: noul('大喜利・回答・作者・AI・ネタであることに触れているか？'),
  パロディ: noul('既存作品・有名表現の型を借りているか？'),
  言葉遊び: noul('音・表記・二重意味・言い換えが核にあるか？'),
  適度な長さ: noul('1読で理解でき、削りすぎでも長すぎでもないか？'),
  過度に長い回答: noul('核に対して説明が多いか？'),
  名詞比率が高すぎる: noul('名詞を並べるだけで動きや関係が弱いか？'),
} as const;

type SemanticKey = keyof typeof semanticFeatures;
const semanticKeys = Object.keys(semanticFeatures) as SemanticKey[];

// --- Cluster weight table (from SKILL.md's literature-derived table) -------------

const clusterWeights: Record<string, ReadonlyArray<readonly [string, number]>> = {
  C0: [['括弧の使用', 0.60], ['対話形式', 0.49], ['複数文', 0.36], ['自虐ネタ', -0.61], ['シュールな無意味さ', -0.37], ['短い長さ比率', -0.29]],
  C1: [['自虐ネタ', 0.61], ['形容詞で終わる', 0.27], ['擬人化', 0.09], ['プロンプト内の固有名詞', -0.27], ['誇張表現', -0.22], ['三点リーダーで終わる', -0.14]],
  C2: [['自虐ネタ', 0.23], ['ミニストーリー', 0.18], ['疑問符で終わる', 0.14], ['プロンプト内の固有名詞', -0.26], ['三点リーダーで終わる', -0.24], ['誇張表現', -0.22]],
  C3: [['括弧の使用', 0.39], ['三点リーダーで終わる', 0.34], ['高いスペース比率', 0.28], ['ミニストーリー', -0.16], ['誇張表現', -0.16], ['プロンプト内の動詞', -0.15]],
  C4: [['三点リーダーで終わる', 0.44], ['自虐ネタ', 0.35], ['括弧の使用', 0.28], ['スラング', -0.60], ['誇張表現', -0.53], ['メタ的表現', -0.21]],
  C5: [['スラング', 0.65], ['誇張表現', 0.21], ['プロンプト内の固有名詞', 0.20], ['シュールな無意味さ', -0.23], ['形容詞で終わる', -0.21], ['非常に長い文字数', -0.20]],
  C6: [['シュールな無意味さ', 0.28], ['プロンプト内の固有名詞', 0.28], ['パロディ', 0.21], ['三点リーダーで終わる', -0.83], ['スラング', -0.45], ['括弧の使用', -0.36]],
};
/** 共通傾向: applied on top of every cluster, at the fixed weight the skill assigns them. */
const commonTendencies: ReadonlyArray<readonly [string, number]> = [
  ['言葉遊び', 0.15],
  ['適度な長さ', 0.15],
  ['過度に長い回答', -0.15],
  ['名詞比率が高すぎる', -0.15],
];

function clusterScore(features: Record<string, number>, cluster: string): number {
  const rows = [...clusterWeights[cluster], ...commonTendencies];
  const raw = rows.reduce((sum, [feature, weight]) => sum + weight * (features[feature] ?? 0), 0);
  return Math.max(-1, Math.min(1, Math.round(raw * 100) / 100));
}

const usage = { requests: 0, input_tokens: 0, output_tokens: 0 };

interface Row {
  sampleId: string;
  index: number;
  answer: string;
  features: Record<string, number>;
  clusterFit: Record<string, number>;
}

async function scoreAnswer(sample: Sample, answer: string, index: number): Promise<Row> {
  const result = await client.systemOne({
    model: 'jev-latest',
    state: { お題: sample.topic, 回答: answer },
    questions: semanticFeatures,
  });

  usage.requests++;
  usage.input_tokens += result.usage.input_tokens;
  usage.output_tokens += result.usage.output_tokens;

  const features: Record<string, number> = {
    ...codeFeatures(answer),
    ...Object.fromEntries(semanticKeys.map((key) => [key, result.answers[key].noul])),
  };

  const clusterFit = Object.fromEntries(
    Object.keys(clusterWeights).map((cluster) => [cluster, clusterScore(features, cluster)]),
  );

  return { sampleId: sample.id, index, answer, features, clusterFit };
}

async function main(): Promise<void> {
  const rows: Row[] = [];

  for (const sample of samples) {
    const batch = await Promise.all(
      sample.answers.map((answer, i) => scoreAnswer(sample, answer, i + 1)),
    );
    rows.push(...batch);
  }

  writeFileSync(OUT_PATH, `${JSON.stringify({ usage, rows }, null, 2)}\n`);

  for (const sample of samples) {
    console.log(`\n== ${sample.id}: ${sample.label}`);
    for (const r of rows.filter((row) => row.sampleId === sample.id)) {
      const fits = Object.entries(r.clusterFit)
        .map(([c, v]) => `${c} ${v >= 0 ? '+' : ''}${v.toFixed(2)}`)
        .join(' / ');
      console.log(`  [${r.index}] ${r.answer}\n      ${fits}`);
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
  console.error(`cluster-fit-check failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
