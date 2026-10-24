/**
 * The Jev questions behind evaluate.ts, compare.ts and gate.ts. The question
 * text is what was validated (reports/validation/2026-09-24) — change it only
 * with a new validation run.
 */
import { basename } from 'node:path';

/**
 * `@typesafe-ai/sdk` is this skill's only dependency, and a freshly installed
 * copy of the skill doesn't have it yet — say so with the fix rather than
 * letting Node throw a bare ERR_MODULE_NOT_FOUND.
 */
const { choice, noul, TypeSafeClient } = await import('@typesafe-ai/sdk').catch((): never => {
  console.error('@typesafe-ai/sdk is not installed. Run `npm install` in this skill directory first.');
  process.exit(1);
});

if (!process.env.TYPESAFE_API_KEY) {
  console.error(`TYPESAFE_API_KEY is missing. Run through Doppler: doppler run -- node scripts/${basename(process.argv[1])}`);
  process.exit(1);
}

const client = new TypeSafeClient({ timeout: 60_000 });

export const usage = { requests: 0, input_tokens: 0, output_tokens: 0 };

export function usageLine(outPath: string): string {
  const usd = (usage.input_tokens * 42) / 1e9 + (usage.output_tokens * 42) / 1e9;
  return `${usage.requests} requests / in ${usage.input_tokens} out ${usage.output_tokens} tokens ` +
    `(~$${usd.toFixed(5)})  -> ${outPath}`;
}

// --- per answer -------------------------------------------------------------

const traits = {
  /**
   * "Does a scene come to mind" let concept-only jokes through — a rule
   * restated in other words reads as a scene to the judge (AUC 0.60).
   */
  concrete: noul(
    '回答に、質感のある具体的な物、実際に起きている現象、または制度・設備・役割の具体的な異常が出てくるか？',
    {
      true: '具体的な物・出来事・現象が一つ置かれている。',
      false: 'ルール・概念・評価の言い換えだけで、物も出来事も出てこない。',
    },
  ),
  /** "Could it be cut by 30%" missed the finding it stands for: the same idea said straight and short wins. */
  indirect: noul(
    '同じ着眼点を、説明的・遠回しに言っているか？',
    {
      true: '説明や前置きが多く、直球で言い切っていない。',
      false: '直球で短く言い切っている。',
    },
  ),
} as const;

export type TraitKey = keyof typeof traits;
export const traitKeys = Object.keys(traits) as TraitKey[];

/** P(yes) per trait for one answer. `concrete`: higher = better; `indirect`: lower = better. */
export async function scoreAnswer(topic: string, answer: string): Promise<Record<TraitKey, number>> {
  const result = await client.systemOne({
    model: 'jev-latest',
    state: { お題: topic, 回答: answer },
    questions: traits,
  });
  usage.requests++;
  usage.input_tokens += result.usage.input_tokens;
  usage.output_tokens += result.usage.output_tokens;
  return Object.fromEntries(traitKeys.map((key) => [key, result.answers[key].noul])) as Record<TraitKey, number>;
}

// --- pairwise ---------------------------------------------------------------

const criteria = {
  concrete: '質感のある具体的な物、または実際に起きている現象・出来事がはっきり置かれているのはどちらか？',
  straight: '説明や前置きがなく、直球で短く言い切っているのはどちらか？',
} as const;

export type CriterionKey = keyof typeof criteria;
export const criterionKeys = Object.keys(criteria) as CriterionKey[];

/** One call asking every criterion about two labeled answers; returns P(first wins) per criterion. */
async function pick(topic: string, first: string, second: string): Promise<Record<CriterionKey, number>> {
  const opts = { first: `回答: ${first}`, second: `回答: ${second}` };
  const result = await client.systemOne({
    model: 'jev-latest',
    state: { お題: topic },
    questions: Object.fromEntries(criterionKeys.map((k) => [k, choice(criteria[k], opts)])),
  });
  usage.requests++;
  usage.input_tokens += result.usage.input_tokens;
  usage.output_tokens += result.usage.output_tokens;
  return Object.fromEntries(
    criterionKeys.map((k) => [k, (result.answers[k] as { probabilities: Record<string, number> }).probabilities.first]),
  ) as Record<CriterionKey, number>;
}

export interface Comparison {
  /** Per-criterion probability that A wins, averaged over both presentation orders. */
  criteria: Record<CriterionKey, number>;
  /** Mean of the criteria: the probability that A is the better candidate. */
  probA: number;
  winner: 'A' | 'B' | 'draw';
  confidence: number;
}

/** Asks in both presentation orders and averages, which cancels position bias. */
export async function compareAnswers(topic: string, answerA: string, answerB: string): Promise<Comparison> {
  const [normal, swapped] = await Promise.all([pick(topic, answerA, answerB), pick(topic, answerB, answerA)]);
  const byCriterion = Object.fromEntries(
    criterionKeys.map((k) => [k, (normal[k] + (1 - swapped[k])) / 2]),
  ) as Record<CriterionKey, number>;
  const probA = criterionKeys.reduce((sum, k) => sum + byCriterion[k], 0) / criterionKeys.length;
  const confidence = Math.abs(probA - 0.5) * 2;
  const winner: Comparison['winner'] = confidence <= 0.1 ? 'draw' : probA > 0.5 ? 'A' : 'B';
  return { criteria: byCriterion, probA, winner, confidence };
}
