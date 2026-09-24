# Human agreement — reports/validation/2026-09-24

Labels: 75 answers (22 hits), 9 mixed sets, 7 set preferences, 13 answer-pair preferences (11 blind).

| evaluator | metric | AUC [95%] | in-set | sets | pairs | retest r | gate |
|---|---|---|---|---|---|---|---|
| cluster-fit-check (jev, jev-latest) | C0 | 0.58 [0.43, 0.74] | 0.77 | 0.29 (7) | 0.54 (13) | - |  |
| cluster-fit-check (jev, jev-latest) | C1 | 0.45 [0.32, 0.60] | 0.40 | 0.57 (7) | 0.46 (13) | - |  |
| cluster-fit-check (jev, jev-latest) | C2 | 0.49 [0.35, 0.64] | 0.52 | 0.71 (7) | 0.38 (13) | - |  |
| cluster-fit-check (jev, jev-latest) | C3 | 0.54 [0.37, 0.70] | 0.44 | 0.57 (7) | 0.46 (13) | - |  |
| cluster-fit-check (jev, jev-latest) | C4 | 0.54 [0.40, 0.68] | 0.41 | 0.57 (7) | 0.38 (13) | - |  |
| cluster-fit-check (jev, jev-latest) | C5 | 0.51 [0.37, 0.65] | 0.66 | 0.43 (7) | 0.69 (13) | - |  |
| cluster-fit-check (jev, jev-latest) | C6 | 0.48 [0.33, 0.64] | 0.34 | 0.43 (7) | 0.54 (13) | - |  |
| fun-check (jev, jev-latest) | −betaRisk | 0.56 [0.42, 0.70] | 0.48 | 0.43 (7) | 0.46 (13) | 0.99 |  |
| fun-check (jev, jev-latest) | −noPictureRisk | 0.66 [0.52, 0.80] | 0.52 | 0.86 (7) | 0.54 (13) | 1.00 |  |
| fun-check (jev, jev-latest) | −noTwistRisk | 0.41 [0.28, 0.55] | 0.36 | 0.43 (7) | 0.62 (13) | 0.98 |  |
| fun-check (jev, jev-latest) | −empathyRisk | 0.54 [0.40, 0.68] | 0.50 | 0.57 (7) | 0.69 (13) | 0.97 |  |
| fun-check (jev, jev-latest) | −recognitionRisk | 0.55 [0.42, 0.69] | 0.54 | 0.57 (7) | 0.46 (13) | 0.99 |  |
| fun-check (jev, jev-latest) | −lengthRisk | 0.64 [0.49, 0.77] | 0.62 | 0.43 (7) | 0.65 (13) | 0.97 |  |
| fun-check (jev, jev-latest) | −slipRisk | 0.46 [0.32, 0.60] | 0.50 | 0.57 (7) | 0.35 (13) | 0.98 |  |
| fun-check (jev, jev-latest) | −sumRisk | 0.67 [0.53, 0.81] | 0.53 | 0.86 (7) | 0.62 (13) | 0.99 |  |
| humor-eval (jev, jev-latest) | novelty | 0.44 [0.29, 0.60] | 0.49 | 0.29 (7) | 0.54 (13) | 1.00 |  |
| humor-eval (jev, jev-latest) | clarity | 0.41 [0.25, 0.57] | 0.37 | 0.29 (7) | 0.27 (13) | 1.00 |  |
| humor-eval (jev, jev-latest) | relevance | 0.40 [0.26, 0.55] | 0.40 | 0.57 (7) | 0.38 (13) | 1.00 |  |
| humor-eval (jev, jev-latest) | intelligence | 0.38 [0.23, 0.54] | 0.35 | 0.57 (7) | 0.38 (13) | 1.00 |  |
| humor-eval (jev, jev-latest) | empathy | 0.37 [0.22, 0.52] | 0.34 | 0.29 (7) | 0.31 (13) | 1.00 |  |
| humor-eval (jev, jev-latest) | overall | 0.43 [0.28, 0.58] | 0.40 | 0.43 (7) | 0.38 (13) | 0.99 |  |
| humor-eval (jev, jev-latest) | overallFloored | 0.43 [0.28, 0.58] | 0.40 | 0.43 (7) | 0.38 (13) | 0.99 |  |
| naive (jev, jev-latest) | funny | 0.41 [0.25, 0.58] | 0.44 | 0.43 (7) | 0.38 (13) | 1.00 |  |
| baseline (jev, -) | −length | 0.51 [0.36, 0.65] | 0.50 | 0.43 (7) | 0.58 (13) | - |  |

## 被りチェック — 15 human similarity judgments (5 similar), flag = score >= 0.7

| evaluator | metric | AUC | recall | false flags | converged AUC | retest r |
|---|---|---|---|---|---|---|
| fun-check-overlap (jev, jev-latest) | sameMaterial | 0.94 | 3/5 | 0/10 | 0.61 | 0.99 |
| fun-check-overlap (jev, jev-latest) | nearDuplicate | 0.80 | 3/5 | 0/10 | 0.41 | 0.89 |

## 一対比較 — 60 pairs with a human preference

| evaluator | metric | in-set | pairs | confident | retest r |
|---|---|---|---|---|---|
| humor-rank (jev, jev-latest) | probA | 0.66 (50) | 0.77 (13) | 0.73 (11) | 1.00 |
| humor-rank (jev, jev-latest) | concrete | 0.66 (50) | 0.54 (13) | 0.56 (18) | 1.00 |
| humor-rank (jev, jev-latest) | straight | 0.64 (50) | 0.69 (13) | 0.71 (21) | 1.00 |
| humor-rank (jev, jev-latest) | holistic | 0.54 (50) | 0.54 (13) | 0.47 (19) | 0.99 |
| humor-rank (prompt, sonnet) | win | 0.56 (50) | 0.46 (13) | 0.61 (28) | 0.68 |
| naive-pairwise (prompt, sonnet) | win | 0.54 (50) | 0.54 (13) | 0.54 (50) | - |
