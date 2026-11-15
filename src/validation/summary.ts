/**
 * The machine-readable twin of summary.md, written next to it by
 * agreement.ts as summary.json. The status page (src/status) reads the
 * latest one, so nothing else needs to copy numbers out of a report.
 * NaN is stored as null.
 */

/** A share of `n` comparisons (null when n is 0). */
export interface Share {
  share: number | null;
  n: number;
}

/** Agreement of one answer-level metric with the hit labels, on some subset of sessions. */
export interface AnswerStats {
  answers: number;
  hits: number;
  auc: number | null;
  /** 95% bootstrap interval of `auc`. */
  lo: number | null;
  hi: number | null;
  /** Mean within-set AUC over `inSetSets` sets that have both a hit and a non-hit. */
  inSet: number | null;
  inSetSets: number;
  /** Human set preferences / direct answer-pair preferences it agrees with. */
  sets: Share;
  pairs: Share;
}

interface Row {
  /** "<evaluator> (<mode>, <model>)", as printed in summary.md. */
  name: string;
  evaluator: string;
  metric: string;
  /** Pearson r between the first two runs; null with one run. */
  retest: number | null;
  /** First session date counted as unused for this evaluator (judges.ts). */
  since: string;
}

export interface AnswerRow extends Row {
  lowerIsBetter: boolean;
  /** Good enough to stand in for a human verdict (see agreement.ts). */
  gate: boolean;
  all: AnswerStats;
  unused: AnswerStats;
}

/** 被りチェック against human similarity judgments ("partial" left out). */
export interface OverlapStats {
  auc: number | null;
  similar: number;
  /** Similar pairs flagged. */
  caught: number;
  different: number;
  /** Different pairs flagged. */
  falseFlags: number;
}

export interface OverlapRow extends Row {
  convergedAuc: number | null;
  all: OverlapStats;
  unused: OverlapStats;
}

export interface PreferenceStats {
  inSet: Share;
  pairs: Share;
  confident: Share;
}

export interface PreferenceRow extends Row {
  all: PreferenceStats;
  unused: PreferenceStats;
}

export interface GateSummary {
  name: string;
  evaluator: string;
  metrics: string[];
  cases: {
    /** GateLabel id, "<date>/<topic key>". */
    id: string;
    /** VersionComparison id this お題 belongs to. */
    group: string;
    human: 'candidate' | 'tie' | 'baseline';
    blind: boolean;
    /**
     * Per run: trait -> that お題's reading (worsening, permutation p) and the
     * baseline run gap of the old rule; null when that run did not cover the case.
     */
    runs: (Record<string, { worsening: number; p: number; noise: number }> | null)[];
  }[];
}

/** One version comparison: the human verdicts over its お題 and the pooled reading. */
export interface VersionSummary {
  name: string;
  evaluator: string;
  id: string;
  date: string;
  topics: number;
  human: { win: number; tie: number; loss: number };
  /** The adoption rule applied to the human verdicts (labels.ts). */
  rule: 'adoptable' | 'return';
  metrics: string[];
  runs: (Record<string, { worsening: number; p: number }> | null)[];
}

export interface Summary {
  /** The reports/validation/<date> directory this was computed in. */
  dir: string;
  labels: {
    answers: number;
    hits: number;
    mixedSets: number;
    setPreferences: number;
    setTies: number;
    pairs: number;
    blindPairs: number;
    similarity: number;
    /** Latest session date among the labels used. */
    latestSession: string;
    /** Session files the labels came from — a file missing here was added after this report. */
    sessions: string[];
  };
  /** Chance that a judge of true accuracy `p` meets the sets and pairs thresholds of the `gate` column. */
  gatePower: { sets: number; pairs: number; at: { p: number; pass: number }[] };
  answer: AnswerRow[];
  overlap: OverlapRow[];
  preference: PreferenceRow[];
  gate: GateSummary[];
  versions: VersionSummary[];
}
