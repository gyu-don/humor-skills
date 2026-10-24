/**
 * Stand-in for `@typesafe-ai/sdk` in tests: deterministic answers derived
 * from the request text, so different inputs give different scores without
 * calling the API.
 */
type Question = { kind: 'noul' | 'score' | 'choice'; options?: Record<string, string> };

export const noul = (): Question => ({ kind: 'noul' });
export const score = (): Question => ({ kind: 'score' });
export const choice = (_q: string, options: Record<string, string>): Question => ({ kind: 'choice', options });

/** FNV-1a hash of the text mapped to [0, 1). */
function unit(text: string): number {
  let h = 0x811c9dc5;
  for (const c of text) h = Math.imul(h ^ c.codePointAt(0)!, 0x01000193);
  return (h >>> 0) / 2 ** 32;
}

export class TypeSafeClient {
  async systemOne({ state, questions }: { state: Record<string, string>; questions: Record<string, Question> }) {
    const key = JSON.stringify(state);
    const answers = Object.fromEntries(Object.entries(questions).map(([name, q]) => {
      const p = unit(`${key}|${name}`);
      if (q.kind === 'choice') {
        const opts = Object.keys(q.options!);
        // Depends on which option text is listed first, so swapping the order changes it.
        const first = unit(`${q.options![opts[0]]}|${name}`);
        return [name, { probabilities: Object.fromEntries(opts.map((o, i) => [o, i === 0 ? first : (1 - first) / (opts.length - 1)])) }];
      }
      return [name, { noul: p, score: 1 + Math.floor(p * 5) }];
    }));
    return { answers, usage: { input_tokens: 1, output_tokens: 1 } };
  }
}
