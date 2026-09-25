/**
 * Research judge, not an automated test: the per-answer risk flags of the
 * original fun-check skill (ベタ・ひねりなし・共感・認知度・滑り) plus its
 * relative-typicality ranking, kept so they can be re-validated as human
 * labels grow. As of 2026-09-24 none of them separates human hits from the
 * rest (AUC ~0.5), and ひねりなし・滑り point the wrong way (0.41-0.46).
 * The flags that did work moved to skills/trait-check (絵なし → concrete,
 * 長さ → indirect) and the 被りチェック to skills/overlap-check.
 *
 * Usage: doppler run -- node research/risk-flags/scripts/evaluate.ts [input.json] [output.json]
 * Input: [{ "id", "label", "topic", "answers": string[] }, ...] — a single
 * { "topic", "answers": [...] } object also works (wrapped as one sample).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * `@typesafe-ai/sdk` is this skill's only dependency, and a freshly installed
 * copy of the skill doesn't have it yet — say so with the fix rather than
 * letting Node throw a bare ERR_MODULE_NOT_FOUND.
 */
const { choice, noul, TypeSafeClient } = await import('@typesafe-ai/sdk').catch((): never => {
  console.error('@typesafe-ai/sdk is not installed. Run `npm install` at the humor-skills repo root first.');
  process.exit(1);
});

const DEFAULT_SAMPLES_PATH = fileURLToPath(new URL('../assets/samples.json', import.meta.url));
const IN_PATH = process.argv[2] ?? DEFAULT_SAMPLES_PATH;
const OUT_PATH = process.argv[3] ?? 'risk-flags-results.json';

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

/** true = the risk applies, matching the original skill's "◯◯リスク" wording. */
const risks = {
  betaRisk: noul(
    'このお題を見た100人が思いつく回答の中に入るか？（ベタリスク）',
    {
      true: '最初に出る発想の範囲に入る、典型的な回答。',
      false: '最初に出る典型的な発想からは外れている。',
    },
  ),
  noTwistRisk: noul(
    'お題の言葉をそのまま受け取っているだけで、1段階以上のズレ・読み替えがないか？（ひねりなしリスク）',
    {
      true: 'お題を字義通りに受け取っているだけで、接続のロジックを1文で説明できない。',
      false: 'お題との接続に1段階以上の読み替えがあり、1文で説明できる。',
    },
  ),
  empathyRisk: noul(
    '日本語ネイティブとして「わかる」「確かに」と感じる状況になっていないか？（共感リスク）',
    {
      true: '状況の納得感がない、または日本の日常ではありえない設定。',
      false: '状況に納得感があり、「わかる」と感じられる。',
    },
  ),
  recognitionRisk: noul(
    '回答の核心にある言葉を知らない人がいて、その言葉を知らないと意味が伝わらないか？（認知度リスク）',
    {
      true: '専門用語・特定コミュニティのミーム・新しい時事語などで、知らないと文脈でも意味が通らない。',
      false: '知らない人がいても文脈で意味が伝わる、または一般に広く知られている。',
    },
  ),
  slipRisk: noul(
    'お題と回答のズレを、1文で自然に回収できないか？（滑りリスク）',
    {
      true: 'お題の具体要素を使わず回答側の設定だけで成立している、または接続説明が2段階以上の屁理屈になる。',
      false: 'お題との接続理由を1文で自然に説明でき、場面や共感に着地する。',
    },
  ),
} as const;

type RiskKey = keyof typeof risks;

const riskKeys = Object.keys(risks) as RiskKey[];

const usage = { requests: 0, input_tokens: 0, output_tokens: 0 };

interface Row {
  sampleId: string;
  index: number;
  answer: string;
  risks: Record<RiskKey, number>;
}

async function checkAnswer(sample: Sample, answer: string, index: number): Promise<Row> {
  const result = await client.systemOne({
    model: 'jev-latest',
    state: { お題: sample.topic, 回答: answer },
    questions: risks,
  });

  usage.requests++;
  usage.input_tokens += result.usage.input_tokens;
  usage.output_tokens += result.usage.output_tokens;

  return {
    sampleId: sample.id,
    index,
    answer,
    risks: Object.fromEntries(riskKeys.map((key) => [key, result.answers[key].noul])) as Record<RiskKey, number>,
  };
}

/**
 * Relative typicality (Step 2 of the original): "which of these answers is
 * most typical" as one `choice` over the whole set, using the returned
 * probability distribution as a ranking rather than picking a single winner.
 */
async function relativeTypicality(sample: Sample): Promise<{ probabilities: Record<string, number>; top3: string[] }> {
  const criteria = Object.fromEntries(
    sample.answers.map((a, i) => [`answer${i + 1}`, a]),
  );
  const result = await client.systemOne({
    model: 'jev-latest',
    state: { お題: sample.topic },
    questions: {
      typical: choice('このお題を見た100人が最初に思いつきそうな順で、最も典型的な回答はどれか？', criteria),
    },
  });

  usage.requests++;
  usage.input_tokens += result.usage.input_tokens;
  usage.output_tokens += result.usage.output_tokens;

  const probabilities = result.answers.typical.probabilities as Record<string, number>;
  const top3 = Object.entries(probabilities)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key]) => key);
  return { probabilities, top3 };
}

async function main(): Promise<void> {
  const rows: Row[] = [];
  const typicality: Record<string, { probabilities: Record<string, number>; top3: string[] }> = {};

  for (const sample of samples) {
    const batch = await Promise.all(
      sample.answers.map((answer, i) => checkAnswer(sample, answer, i + 1)),
    );
    rows.push(...batch);
    typicality[sample.id] = await relativeTypicality(sample);
  }

  const pct = (x: number): string => `${(x * 100).toFixed(0)}%`;

  const summaries = samples.map((sample) => {
    const own = rows.filter((r) => r.sampleId === sample.id);
    const riskShare = Object.fromEntries(
      riskKeys.map((key) => [key, own.filter((r) => r.risks[key] > 0.5).length]),
    ) as Record<RiskKey, number>;
    return { id: sample.id, label: sample.label, riskShare, relativeTypicalTop3: typicality[sample.id].top3 };
  });

  writeFileSync(
    OUT_PATH,
    `${JSON.stringify({ usage, summaries, typicality, rows }, null, 2)}\n`,
  );

  for (const s of summaries) {
    console.log(`\n== ${s.id}: ${s.label}`);
    for (const key of riskKeys) {
      console.log(`  ${key.padEnd(16)} ${s.riskShare[key]} / ${samples.find((x) => x.id === s.id)!.answers.length} flagged`);
    }
    console.log(`  relative typicality top3: ${s.relativeTypicalTop3.join(', ')}`);
  }

  const usd = (usage.input_tokens * 42) / 1e9 + (usage.output_tokens * 42) / 1e9;
  console.log(
    `\n${usage.requests} requests / in ${usage.input_tokens} out ${usage.output_tokens} tokens ` +
      `(~$${usd.toFixed(5)})  -> ${OUT_PATH}. flagged = probability ${pct(0.5)}+`,
  );
}

try {
  await main();
} catch (error) {
  console.error(`risk-flags failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
