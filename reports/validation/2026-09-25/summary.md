# Human agreement — reports/validation/2026-09-25

Labels: 75 answers (22 hits), 9 mixed sets, 7 set preferences, 13 answer-pair preferences (11 blind).

| evaluator | metric | AUC [95%] | in-set | sets | pairs | retest r | gate |
|---|---|---|---|---|---|---|---|
| cluster-fit-check (jev, jev-latest) | C0 | 0.58 [0.42, 0.73] | 0.73 | 0.29 (7) | 0.46 (13) | 1.00 |  |
| cluster-fit-check (jev, jev-latest) | C1 | 0.44 [0.31, 0.58] | 0.41 | 0.57 (7) | 0.42 (13) | 0.99 |  |
| cluster-fit-check (jev, jev-latest) | C2 | 0.48 [0.34, 0.63] | 0.52 | 0.71 (7) | 0.38 (13) | 0.99 |  |
| cluster-fit-check (jev, jev-latest) | C3 | 0.55 [0.39, 0.72] | 0.48 | 0.57 (7) | 0.50 (13) | 1.00 |  |
| cluster-fit-check (jev, jev-latest) | C4 | 0.55 [0.42, 0.69] | 0.42 | 0.57 (7) | 0.38 (13) | 0.99 |  |
| cluster-fit-check (jev, jev-latest) | C5 | 0.51 [0.36, 0.65] | 0.63 | 0.43 (7) | 0.69 (13) | 0.99 |  |
| cluster-fit-check (jev, jev-latest) | C6 | 0.49 [0.33, 0.65] | 0.34 | 0.43 (7) | 0.38 (13) | 1.00 |  |
| funniness-score (jev, jev-latest) | novelty | 0.45 [0.30, 0.61] | 0.51 | 0.43 (7) | 0.46 (13) | 1.00 |  |
| funniness-score (jev, jev-latest) | clarity | 0.42 [0.25, 0.58] | 0.35 | 0.29 (7) | 0.31 (13) | 1.00 |  |
| funniness-score (jev, jev-latest) | relevance | 0.40 [0.26, 0.55] | 0.41 | 0.57 (7) | 0.31 (13) | 0.99 |  |
| funniness-score (jev, jev-latest) | intelligence | 0.39 [0.24, 0.55] | 0.39 | 0.57 (7) | 0.38 (13) | 1.00 |  |
| funniness-score (jev, jev-latest) | empathy | 0.38 [0.23, 0.53] | 0.40 | 0.29 (7) | 0.31 (13) | 0.99 |  |
| funniness-score (jev, jev-latest) | overall | 0.43 [0.27, 0.58] | 0.42 | 0.43 (7) | 0.38 (13) | 1.00 |  |
| funniness-score (jev, jev-latest) | overallFloored | 0.43 [0.27, 0.58] | 0.42 | 0.43 (7) | 0.38 (13) | 1.00 |  |
| naive (jev, jev-latest) | funny | 0.42 [0.26, 0.57] | 0.42 | 0.29 (7) | 0.38 (13) | 0.99 |  |
| risk-flags (jev, jev-latest) | −betaRisk | 0.55 [0.42, 0.70] | 0.41 | 0.43 (7) | 0.46 (13) | 0.99 |  |
| risk-flags (jev, jev-latest) | −noTwistRisk | 0.40 [0.26, 0.55] | 0.31 | 0.43 (7) | 0.38 (13) | 0.98 |  |
| risk-flags (jev, jev-latest) | −empathyRisk | 0.52 [0.37, 0.66] | 0.56 | 0.50 (7) | 0.62 (13) | 0.95 |  |
| risk-flags (jev, jev-latest) | −recognitionRisk | 0.56 [0.43, 0.70] | 0.56 | 0.57 (7) | 0.50 (13) | 0.99 |  |
| risk-flags (jev, jev-latest) | −slipRisk | 0.43 [0.29, 0.57] | 0.44 | 0.57 (7) | 0.42 (13) | 0.98 |  |
| risk-flags (jev, jev-latest) | −sumRisk | 0.55 [0.42, 0.68] | 0.47 | 0.71 (7) | 0.38 (13) | 0.99 |  |
| trait-check (jev, jev-latest) | concrete | 0.67 [0.52, 0.80] | 0.57 | 0.86 (7) | 0.62 (13) | 1.00 |  |
| trait-check (jev, jev-latest) | −indirect | 0.62 [0.47, 0.75] | 0.65 | 0.57 (7) | 0.65 (13) | 0.98 |  |
| baseline (jev, -) | −length | 0.51 [0.36, 0.65] | 0.50 | 0.43 (7) | 0.58 (13) | - |  |

## 被りチェック — 15 human similarity judgments (5 similar), flag = score >= 0.7

| evaluator | metric | AUC | recall | false flags | converged AUC | retest r |
|---|---|---|---|---|---|---|
| overlap-check (jev, jev-latest) | sameMaterial | 0.94 | 4/5 | 0/10 | 0.63 | 0.99 |
| overlap-check (jev, jev-latest) | nearDuplicate | 0.90 | 4/5 | 0/10 | 0.44 | 0.90 |

## 一対比較 — 60 pairs with a human preference

| evaluator | metric | in-set | pairs | confident | retest r |
|---|---|---|---|---|---|
| naive-pairwise (jev, jev-latest) | funny | 0.42 (50) | 0.38 (13) | 0.33 (21) | 1.00 |
| trait-compare (jev, jev-latest) | probA | 0.64 (50) | 0.77 (13) | 0.75 (12) | 1.00 |
| trait-compare (jev, jev-latest) | concrete | 0.66 (50) | 0.54 (13) | 0.63 (16) | 0.99 |
| trait-compare (jev, jev-latest) | straight | 0.66 (50) | 0.69 (13) | 0.71 (21) | 1.00 |
