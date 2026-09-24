/**
 * The one format every evaluator run is stored in under reports/validation/<date>/,
 * whether it came from a Jev script (run-jev.ts) or a prompt-mode subagent
 * (blind.ts unblind). agreement.ts reads only this.
 */
export interface ScoreFile {
  evaluator: string;
  /** "jev" for scripts/evaluate.ts, "prompt" for a subagent following SKILL.md. */
  mode: 'jev' | 'prompt';
  /** Runs with the same evaluator+mode+run-group are compared for test-retest reliability. */
  run: number;
  /** Judge model, e.g. "jev-latest" or "sonnet". */
  model: string;
  /**
   * "answer": keys are answer IDs. "set": keys are set IDs (e.g. diversity-check).
   * "pair": keys are pairKey(a, b) of two answer IDs on the same topic (被りチェック).
   * "preference": keys are pairKey(a, b); each metric is the probability that the
   * first ID of the key is the better answer (pairwise judges: humor-rank).
   */
  level: 'answer' | 'set' | 'pair' | 'preference';
  /** Pair-level judges that only list the pairs they flag: an unlisted pair scores 0. */
  missingIsZero?: boolean;
  /** Metrics where a smaller number means a better answer/set (risk flags, rank position...). */
  lowerIsBetter: string[];
  scores: Record<string, Record<string, number>>;
}
