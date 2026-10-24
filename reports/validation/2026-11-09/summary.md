# Human agreement — reports/validation/2026-11-09

Labels: 170 answers (35 hits), 17 mixed sets, 9 set preferences, 20 answer-pair preferences (17 blind).

| evaluator | metric | AUC [95%] | in-set | sets | pairs | retest r | gate |
|---|---|---|---|---|---|---|---|
| cluster-fit-check (jev, jev-latest) | C0 | 0.55 [0.43, 0.66] | 0.52 | 0.56 (9) | 0.55 (20) | 0.99 |  |
| cluster-fit-check (jev, jev-latest) | C1 | 0.48 [0.39, 0.58] | 0.61 | 0.56 (9) | 0.50 (20) | 0.99 |  |
| cluster-fit-check (jev, jev-latest) | C2 | 0.49 [0.40, 0.58] | 0.59 | 0.56 (9) | 0.45 (20) | 1.00 |  |
| cluster-fit-check (jev, jev-latest) | C3 | 0.58 [0.46, 0.70] | 0.60 | 0.56 (9) | 0.60 (20) | 1.00 |  |
| cluster-fit-check (jev, jev-latest) | C4 | 0.51 [0.40, 0.61] | 0.47 | 0.56 (9) | 0.50 (20) | 0.99 |  |
| cluster-fit-check (jev, jev-latest) | C5 | 0.58 [0.47, 0.69] | 0.61 | 0.44 (9) | 0.60 (20) | 0.99 |  |
| cluster-fit-check (jev, jev-latest) | C6 | 0.53 [0.42, 0.65] | 0.39 | 0.33 (9) | 0.55 (20) | 0.99 |  |
| funniness-score (jev, jev-latest) | novelty | 0.53 [0.43, 0.64] | 0.45 | 0.33 (9) | 0.40 (20) | 0.99 |  |
| funniness-score (jev, jev-latest) | clarity | 0.50 [0.39, 0.60] | 0.51 | 0.44 (9) | 0.45 (20) | 0.99 |  |
| funniness-score (jev, jev-latest) | relevance | 0.45 [0.34, 0.55] | 0.39 | 0.56 (9) | 0.40 (20) | 0.99 |  |
| funniness-score (jev, jev-latest) | intelligence | 0.51 [0.40, 0.62] | 0.46 | 0.44 (9) | 0.35 (20) | 0.99 |  |
| funniness-score (jev, jev-latest) | empathy | 0.52 [0.41, 0.62] | 0.53 | 0.44 (9) | 0.35 (20) | 0.99 |  |
| funniness-score (jev, jev-latest) | overall | 0.52 [0.41, 0.61] | 0.51 | 0.56 (9) | 0.40 (20) | 0.99 |  |
| funniness-score (jev, jev-latest) | overallFloored | 0.52 [0.41, 0.61] | 0.51 | 0.56 (9) | 0.40 (20) | 0.99 |  |
| naive (jev, jev-latest) | funny | 0.55 [0.44, 0.66] | 0.50 | 0.56 (9) | 0.35 (20) | 0.99 |  |
| risk-flags (jev, jev-latest) | −betaRisk | 0.56 [0.45, 0.67] | 0.48 | 0.44 (9) | 0.50 (20) | 0.98 |  |
| risk-flags (jev, jev-latest) | −noTwistRisk | 0.51 [0.39, 0.64] | 0.56 | 0.44 (9) | 0.47 (20) | 0.97 |  |
| risk-flags (jev, jev-latest) | −empathyRisk | 0.51 [0.41, 0.61] | 0.67 | 0.50 (9) | 0.50 (20) | 0.96 |  |
| risk-flags (jev, jev-latest) | −recognitionRisk | 0.48 [0.38, 0.59] | 0.46 | 0.67 (9) | 0.45 (20) | 1.00 |  |
| risk-flags (jev, jev-latest) | −slipRisk | 0.42 [0.31, 0.52] | 0.41 | 0.67 (9) | 0.45 (20) | 0.98 |  |
| risk-flags (jev, jev-latest) | −sumRisk | 0.49 [0.38, 0.59] | 0.49 | 0.89 (9) | 0.45 (20) | 0.99 |  |
| trait-check (jev, jev-latest) | concrete | 0.62 [0.50, 0.72] | 0.49 | 0.78 (9) | 0.65 (20) | 1.00 |  |
| trait-check (jev, jev-latest) | −indirect | 0.60 [0.49, 0.71] | 0.60 | 0.56 (9) | 0.60 (20) | 0.98 |  |
| baseline (jev, -) | −length | 0.43 [0.32, 0.55] | 0.45 | 0.50 (9) | 0.57 (20) | - |  |

## 被りチェック — 16 human similarity judgments (6 similar), flag = score >= 0.7

| evaluator | metric | AUC | recall | false flags | converged AUC | retest r |
|---|---|---|---|---|---|---|
| overlap-check (jev, jev-latest) | sameMaterial | 0.84 | 3/6 | 0/10 | 0.50 | 0.99 |
| overlap-check (jev, jev-latest) | nearDuplicate | 0.75 | 3/6 | 0/10 | 0.46 | 0.92 |

## 一対比較 — 106 pairs with a human preference

| evaluator | metric | in-set | pairs | confident | retest r |
|---|---|---|---|---|---|
| naive-pairwise (jev, jev-latest) | funny | 0.47 (90) | 0.40 (20) | 0.52 (23) | 0.99 |
| trait-compare (jev, jev-latest) | probA | 0.62 (90) | 0.60 (20) | 0.64 (14) | 0.99 |
| trait-compare (jev, jev-latest) | concrete | 0.49 (90) | 0.55 (20) | 0.59 (39) | 1.00 |
| trait-compare (jev, jev-latest) | straight | 0.66 (90) | 0.65 (20) | 0.71 (31) | 0.99 |

## 回帰判定 — 5 version comparisons with a human set-level verdict (2 blind; human preferred candidate 1, tie 4, baseline 0)

Flagged as regression, per run. Only the "baseline better" column should be flagged.

| evaluator | rule | candidate better | tie | baseline better |
|---|---|---|---|---|
| trait-gate (jev, jev-latest) | concrete > 0 | 0/1 · 1/1 | 3/4 · 3/4 | - |
| trait-gate (jev, jev-latest) | indirect > 0 | 0/1 · 0/1 | 1/4 · 1/4 | - |
| trait-gate (jev, jev-latest) | compare > 0 | 0/1 · 0/1 | 3/4 · 3/4 | - |
| trait-gate (jev, jev-latest) | any > 0 | 0/1 · 1/1 | 4/4 · 4/4 | - |
| trait-gate (jev, jev-latest) | concrete > noise | 0/1 · 0/1 | 1/4 · 1/4 | - |
| trait-gate (jev, jev-latest) | indirect > noise | 0/1 · 0/1 | 1/4 · 1/4 | - |
| trait-gate (jev, jev-latest) | compare > noise | 0/1 · 0/1 | 1/4 · 1/4 | - |
| trait-gate (jev, jev-latest) | any > noise | 0/1 · 0/1 | 3/4 · 3/4 | - |

| comparison | human | blind | concrete worse / noise | indirect worse / noise | compare worse / noise |
|---|---|---|---|---|---|
| 2026-11-08/codex | tie | yes | 0.059 / 0.028 **R** · 0.057 / 0.036 **R** | -0.009 / 0.026 · -0.012 / 0.034 | 0.006 / 0.059 · 0.010 / 0.052 |
| 2026-11-08/sylvanian | candidate | yes | -0.003 / 0.004 · 0.003 / 0.022 | -0.014 / 0.016 · -0.009 / 0.022 | -0.015 / 0.075 · -0.013 / 0.073 |
| 2026-11-08/target | tie | no | 0.056 / 0.210 · 0.057 / 0.202 | -0.009 / 0.058 · -0.000 / 0.070 | -0.053 / 0.033 · -0.050 / 0.033 |
| 2026-11-08/dev | tie | no | -0.139 / 0.046 · -0.143 / 0.060 | 0.054 / 0.012 **R** · 0.047 / 0.012 **R** | 0.048 / 0.070 · 0.050 / 0.064 |
| 2026-11-08/haiku | tie | no | 0.013 / 0.058 · 0.014 / 0.040 | -0.034 / 0.118 · -0.038 / 0.104 | 0.023 / 0.004 **R** · 0.022 / 0.002 **R** |
