# Human agreement — reports/validation/2026-11-15

Labels: 170 answers (35 hits), 17 mixed sets, 9 set preferences, 20 answer-pair preferences (17 blind).

| evaluator | metric | AUC [95%] | in-set | sets | pairs | retest r | gate |
|---|---|---|---|---|---|---|---|
| cluster-fit-check (jev, jev-latest) | C0 | 0.55 [0.43, 0.67] | 0.53 | 0.56 (9) | 0.55 (20) | 0.99 |  |
| cluster-fit-check (jev, jev-latest) | C1 | 0.48 [0.39, 0.58] | 0.57 | 0.56 (9) | 0.45 (20) | 0.99 |  |
| cluster-fit-check (jev, jev-latest) | C2 | 0.49 [0.40, 0.58] | 0.59 | 0.56 (9) | 0.42 (20) | 1.00 |  |
| cluster-fit-check (jev, jev-latest) | C3 | 0.58 [0.46, 0.70] | 0.62 | 0.56 (9) | 0.53 (20) | 1.00 |  |
| cluster-fit-check (jev, jev-latest) | C4 | 0.51 [0.41, 0.62] | 0.47 | 0.56 (9) | 0.55 (20) | 0.99 |  |
| cluster-fit-check (jev, jev-latest) | C5 | 0.58 [0.47, 0.69] | 0.61 | 0.44 (9) | 0.60 (20) | 0.99 |  |
| cluster-fit-check (jev, jev-latest) | C6 | 0.53 [0.43, 0.65] | 0.40 | 0.33 (9) | 0.55 (20) | 0.99 |  |
| funniness-score (jev, jev-latest) | novelty | 0.54 [0.44, 0.65] | 0.43 | 0.33 (9) | 0.40 (20) | 0.99 |  |
| funniness-score (jev, jev-latest) | clarity | 0.51 [0.40, 0.61] | 0.48 | 0.44 (9) | 0.45 (20) | 0.99 |  |
| funniness-score (jev, jev-latest) | relevance | 0.44 [0.34, 0.55] | 0.40 | 0.56 (9) | 0.45 (20) | 0.99 |  |
| funniness-score (jev, jev-latest) | intelligence | 0.52 [0.41, 0.63] | 0.48 | 0.44 (9) | 0.40 (20) | 0.99 |  |
| funniness-score (jev, jev-latest) | empathy | 0.51 [0.41, 0.61] | 0.55 | 0.44 (9) | 0.30 (20) | 0.99 |  |
| funniness-score (jev, jev-latest) | overall | 0.52 [0.42, 0.62] | 0.55 | 0.44 (9) | 0.40 (20) | 0.99 |  |
| funniness-score (jev, jev-latest) | overallFloored | 0.52 [0.42, 0.62] | 0.55 | 0.44 (9) | 0.40 (20) | 0.99 |  |
| naive (jev, jev-latest) | funny | 0.55 [0.43, 0.66] | 0.47 | 0.44 (9) | 0.35 (20) | 0.99 |  |
| risk-flags (jev, jev-latest) | −betaRisk | 0.55 [0.45, 0.66] | 0.44 | 0.44 (9) | 0.50 (20) | 0.99 |  |
| risk-flags (jev, jev-latest) | −noTwistRisk | 0.50 [0.38, 0.61] | 0.52 | 0.44 (9) | 0.40 (20) | 0.96 |  |
| risk-flags (jev, jev-latest) | −empathyRisk | 0.50 [0.40, 0.60] | 0.67 | 0.44 (9) | 0.50 (20) | 0.97 |  |
| risk-flags (jev, jev-latest) | −recognitionRisk | 0.49 [0.37, 0.60] | 0.46 | 0.78 (9) | 0.45 (20) | 0.99 |  |
| risk-flags (jev, jev-latest) | −slipRisk | 0.43 [0.32, 0.52] | 0.39 | 0.56 (9) | 0.42 (20) | 0.98 |  |
| risk-flags (jev, jev-latest) | −sumRisk | 0.48 [0.37, 0.59] | 0.48 | 0.89 (9) | 0.45 (20) | 0.98 |  |
| trait-check (jev, jev-latest) | concrete | 0.61 [0.50, 0.72] | 0.49 | 0.78 (9) | 0.57 (20) | 1.00 |  |
| trait-check (jev, jev-latest) | −indirect | 0.59 [0.48, 0.70] | 0.58 | 0.56 (9) | 0.55 (20) | 0.98 |  |
| baseline (jev, -) | −length | 0.43 [0.32, 0.55] | 0.45 | 0.50 (9) | 0.57 (20) | - |  |

`gate` の条件のうち sets ≥ 0.8（9 件）と pairs ≥ 0.75（20 件）を両方満たす確率は、真の一致率が 0.7 の判定器で 0.08、0.8 の判定器で 0.35、0.9 の判定器で 0.77（2つを独立とみなした概算。AUC の条件は含まない）。空欄は、合格できる判定器がないことまでは意味しない。

## 被りチェック — 16 human similarity judgments (6 similar), flag = score >= 0.7

| evaluator | metric | AUC | recall | false flags | converged AUC | retest r |
|---|---|---|---|---|---|---|
| overlap-check (jev, jev-latest) | sameMaterial | 0.85 | 4/6 | 0/10 | 0.45 | 0.99 |
| overlap-check (jev, jev-latest) | nearDuplicate | 0.83 | 4/6 | 0/10 | 0.35 | 0.92 |

## 一対比較 — 106 pairs with a human preference

| evaluator | metric | in-set | pairs | confident | retest r |
|---|---|---|---|---|---|
| naive-pairwise (jev, jev-latest) | funny | 0.49 (90) | 0.45 (20) | 0.50 (24) | 0.99 |
| trait-compare (jev, jev-latest) | probA | 0.63 (90) | 0.65 (20) | 0.56 (16) | 0.99 |
| trait-compare (jev, jev-latest) | concrete | 0.51 (90) | 0.50 (20) | 0.54 (39) | 0.99 |
| trait-compare (jev, jev-latest) | straight | 0.66 (90) | 0.55 (20) | 0.69 (32) | 0.99 |

## 回帰判定 — 7 version comparisons with a human set-level verdict (4 blind; human preferred candidate 1, tie 5, baseline 1)

Flagged as regression, per run. Only the "baseline better" column should be flagged.

| evaluator | rule | candidate better | tie | baseline better |
|---|---|---|---|---|
| trait-gate (jev, jev-latest) | concrete > 0 | 0/1 · 1/1 | 4/5 · 4/5 | 1/1 · 0/1 |
| trait-gate (jev, jev-latest) | indirect > 0 | 0/1 · 0/1 | 2/5 · 2/5 | 1/1 · 1/1 |
| trait-gate (jev, jev-latest) | compare > 0 | 0/1 · 0/1 | 4/5 · 4/5 | 1/1 · 1/1 |
| trait-gate (jev, jev-latest) | any > 0 | 0/1 · 1/1 | 5/5 · 5/5 | 1/1 · 1/1 |
| trait-gate (jev, jev-latest) | concrete > noise | 0/1 · 0/1 | 2/5 · 2/5 | 0/1 · 0/1 |
| trait-gate (jev, jev-latest) | indirect > noise | 0/1 · 0/1 | 1/5 · 2/5 | 1/1 · 1/1 |
| trait-gate (jev, jev-latest) | compare > noise | 0/1 · 0/1 | 2/5 · 2/5 | 0/1 · 0/1 |
| trait-gate (jev, jev-latest) | any > noise | 0/1 · 0/1 | 4/5 · 4/5 | 1/1 · 1/1 |

| comparison | human | blind | concrete worse / noise | indirect worse / noise | compare worse / noise |
|---|---|---|---|---|---|
| 2026-11-08/codex | tie | yes | 0.061 / 0.030 **R** · 0.066 / 0.046 **R** | -0.013 / 0.040 · -0.014 / 0.044 | 0.008 / 0.060 · 0.012 / 0.056 |
| 2026-11-08/sylvanian | candidate | yes | -0.006 / 0.020 · 0.004 / 0.006 | -0.003 / 0.016 · -0.011 / 0.030 | -0.010 / 0.076 · -0.012 / 0.078 |
| 2026-11-08/target | tie | no | 0.052 / 0.208 · 0.060 / 0.220 | -0.004 / 0.056 · -0.000 / 0.058 | -0.051 / 0.036 · -0.053 / 0.036 |
| 2026-11-08/dev | tie | no | -0.145 / 0.044 · -0.141 / 0.052 | 0.048 / 0.014 **R** · 0.052 / 0.012 **R** | 0.049 / 0.062 · 0.049 / 0.068 |
| 2026-11-08/haiku | tie | no | 0.017 / 0.062 · 0.017 / 0.054 | -0.038 / 0.122 · -0.033 / 0.106 | 0.020 / 0.004 **R** · 0.021 / 0.005 **R** |
| 2026-11-09/target | tie | yes | 0.175 / 0.104 **R** · 0.171 / 0.104 **R** | 0.009 / 0.034 · 0.021 / 0.018 **R** | 0.067 / 0.057 **R** · 0.066 / 0.054 **R** |
| 2026-11-09/sylvanian | baseline | yes | 0.000 / 0.030 · -0.009 / 0.024 | 0.012 / 0.002 **R** · 0.006 / 0.002 **R** | 0.020 / 0.031 · 0.023 / 0.031 |

## 未使用ラベル — 質問や閾値を決めたときに見ていないセッションだけで測った値

`since` 以降のセッションのラベルだけを使う。`skills/` の判定器は質問・閾値を確定した日（`src/validation/judges.ts` の `frozen`）、それ以外は最も新しい確定日。角括弧は 95% 区間（AUC はブートストラップ、割合は Wilson）、丸括弧は件数。

| evaluator | metric | since | answers (hits) | AUC [95%] | in-set | sets | pairs |
|---|---|---|---|---|---|---|---|
| cluster-fit-check (jev, jev-latest) | C0 | 2026-09-24 | 95 (13) | 0.44 [0.26, 0.61] | 0.31 (8) | 1.00 [0.34, 1.00] (2) | 0.57 [0.25, 0.84] (7) |
| cluster-fit-check (jev, jev-latest) | C1 | 2026-09-24 | 95 (13) | 0.50 [0.36, 0.65] | 0.76 (8) | 0.00 [0.00, 0.66] (2) | 0.29 [0.08, 0.64] (7) |
| cluster-fit-check (jev, jev-latest) | C2 | 2026-09-24 | 95 (13) | 0.47 [0.34, 0.62] | 0.73 (8) | 0.00 [0.00, 0.66] (2) | 0.29 [0.08, 0.64] (7) |
| cluster-fit-check (jev, jev-latest) | C3 | 2026-09-24 | 95 (13) | 0.65 [0.49, 0.81] | 0.74 (8) | 0.50 [0.09, 0.91] (2) | 0.64 [0.30, 0.88] (7) |
| cluster-fit-check (jev, jev-latest) | C4 | 2026-09-24 | 95 (13) | 0.38 [0.23, 0.54] | 0.59 (8) | 0.50 [0.09, 0.91] (2) | 0.86 [0.49, 0.97] (7) |
| cluster-fit-check (jev, jev-latest) | C5 | 2026-09-24 | 95 (13) | 0.72 [0.56, 0.86] | 0.59 (8) | 0.50 [0.09, 0.91] (2) | 0.29 [0.08, 0.64] (7) |
| cluster-fit-check (jev, jev-latest) | C6 | 2026-09-24 | 95 (13) | 0.63 [0.47, 0.77] | 0.43 (8) | 0.50 [0.09, 0.91] (2) | 0.71 [0.36, 0.92] (7) |
| funniness-score (jev, jev-latest) | novelty | 2026-09-24 | 95 (13) | 0.62 [0.45, 0.76] | 0.33 (8) | 0.50 [0.09, 0.91] (2) | 0.29 [0.08, 0.64] (7) |
| funniness-score (jev, jev-latest) | clarity | 2026-09-24 | 95 (13) | 0.57 [0.41, 0.73] | 0.52 (8) | 0.50 [0.09, 0.91] (2) | 0.57 [0.25, 0.84] (7) |
| funniness-score (jev, jev-latest) | relevance | 2026-09-24 | 95 (13) | 0.42 [0.26, 0.57] | 0.40 (8) | 0.50 [0.09, 0.91] (2) | 0.43 [0.16, 0.75] (7) |
| funniness-score (jev, jev-latest) | intelligence | 2026-09-24 | 95 (13) | 0.66 [0.49, 0.80] | 0.56 (8) | 0.50 [0.09, 0.91] (2) | 0.43 [0.16, 0.75] (7) |
| funniness-score (jev, jev-latest) | empathy | 2026-09-24 | 95 (13) | 0.59 [0.44, 0.74] | 0.64 (8) | 1.00 [0.34, 1.00] (2) | 0.43 [0.16, 0.75] (7) |
| funniness-score (jev, jev-latest) | overall | 2026-09-24 | 95 (13) | 0.59 [0.44, 0.73] | 0.66 (8) | 0.50 [0.09, 0.91] (2) | 0.43 [0.16, 0.75] (7) |
| funniness-score (jev, jev-latest) | overallFloored | 2026-09-24 | 95 (13) | 0.59 [0.44, 0.73] | 0.66 (8) | 0.50 [0.09, 0.91] (2) | 0.43 [0.16, 0.75] (7) |
| naive (jev, jev-latest) | funny | 2026-09-24 | 95 (13) | 0.66 [0.48, 0.83] | 0.49 (8) | 0.50 [0.09, 0.91] (2) | 0.43 [0.16, 0.75] (7) |
| risk-flags (jev, jev-latest) | −betaRisk | 2026-09-24 | 95 (13) | 0.51 [0.36, 0.66] | 0.40 (8) | 0.50 [0.09, 0.91] (2) | 0.57 [0.25, 0.84] (7) |
| risk-flags (jev, jev-latest) | −noTwistRisk | 2026-09-24 | 95 (13) | 0.57 [0.38, 0.76] | 0.54 (8) | 0.50 [0.09, 0.91] (2) | 0.43 [0.16, 0.75] (7) |
| risk-flags (jev, jev-latest) | −empathyRisk | 2026-09-24 | 95 (13) | 0.54 [0.36, 0.72] | 0.71 (8) | 0.50 [0.09, 0.91] (2) | 0.43 [0.16, 0.75] (7) |
| risk-flags (jev, jev-latest) | −recognitionRisk | 2026-09-24 | 95 (13) | 0.35 [0.19, 0.50] | 0.43 (8) | 0.50 [0.09, 0.91] (2) | 0.57 [0.25, 0.84] (7) |
| risk-flags (jev, jev-latest) | −slipRisk | 2026-09-24 | 95 (13) | 0.41 [0.26, 0.57] | 0.42 (8) | 0.50 [0.09, 0.91] (2) | 0.43 [0.16, 0.75] (7) |
| risk-flags (jev, jev-latest) | −sumRisk | 2026-09-24 | 95 (13) | 0.36 [0.21, 0.52] | 0.47 (8) | 1.00 [0.34, 1.00] (2) | 0.57 [0.25, 0.84] (7) |
| trait-check (jev, jev-latest) | concrete | 2026-09-24 | 95 (13) | 0.51 [0.36, 0.67] | 0.41 (8) | 0.50 [0.09, 0.91] (2) | 0.43 [0.16, 0.75] (7) |
| trait-check (jev, jev-latest) | −indirect | 2026-09-24 | 95 (13) | 0.71 [0.54, 0.87] | 0.59 (8) | 1.00 [0.34, 1.00] (2) | 0.50 [0.20, 0.80] (7) |
| baseline (jev, -) | −length | 2026-09-24 | 95 (13) | 0.32 [0.16, 0.49] | 0.39 (8) | 0.75 [0.20, 0.97] (2) | 0.57 [0.25, 0.84] (7) |

| evaluator | metric | since | in-set | pairs | confident |
|---|---|---|---|---|---|
| naive-pairwise (jev, jev-latest) | funny | 2026-09-24 | 0.55 [0.40, 0.69] (40) | 0.43 [0.16, 0.75] (7) | 1.00 [0.65, 1.00] (7) |
| trait-compare (jev, jev-latest) | probA | 2026-09-24 | 0.60 [0.45, 0.74] (40) | 0.29 [0.08, 0.64] (7) | 0.25 [0.05, 0.70] (4) |
| trait-compare (jev, jev-latest) | concrete | 2026-09-24 | 0.40 [0.26, 0.55] (40) | 0.43 [0.16, 0.75] (7) | 0.40 [0.20, 0.64] (15) |
| trait-compare (jev, jev-latest) | straight | 2026-09-24 | 0.68 [0.52, 0.80] (40) | 0.43 [0.16, 0.75] (7) | 0.64 [0.35, 0.85] (11) |

| evaluator | metric | since | recall | false flags |
|---|---|---|---|---|
| overlap-check (jev, jev-latest) | sameMaterial | 2026-09-24 | 0/1 | 0/0 |
| overlap-check (jev, jev-latest) | nearDuplicate | 2026-09-24 | 0/1 | 0/0 |
