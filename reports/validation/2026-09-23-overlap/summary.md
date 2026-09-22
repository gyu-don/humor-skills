# Human agreement — reports/validation/2026-09-23-overlap

Labels: 75 answers (22 hits), 9 mixed sets, 7 set preferences, 13 answer-pair preferences (11 blind).

| evaluator | metric | AUC [95%] | in-set | sets | pairs | retest r | gate |
|---|---|---|---|---|---|---|---|
| fun-check (jev, jev-latest) | −betaRisk | 0.56 [0.42, 0.70] | 0.45 | 0.43 (7) | 0.50 (13) | 0.99 |  |
| fun-check (jev, jev-latest) | −noPictureRisk | 0.60 [0.45, 0.74] | 0.58 | 0.43 (7) | 0.62 (13) | 0.99 |  |
| fun-check (jev, jev-latest) | −noTwistRisk | 0.43 [0.29, 0.57] | 0.32 | 0.43 (7) | 0.46 (13) | 0.98 |  |
| fun-check (jev, jev-latest) | −empathyRisk | 0.51 [0.37, 0.66] | 0.54 | 0.43 (7) | 0.62 (13) | 0.97 |  |
| fun-check (jev, jev-latest) | −recognitionRisk | 0.57 [0.44, 0.71] | 0.56 | 0.57 (7) | 0.46 (13) | 0.99 |  |
| fun-check (jev, jev-latest) | −lengthRisk | 0.57 [0.41, 0.72] | 0.55 | 0.57 (7) | 0.62 (13) | 0.98 |  |
| fun-check (jev, jev-latest) | −slipRisk | 0.45 [0.31, 0.59] | 0.45 | 0.57 (7) | 0.38 (13) | 0.97 |  |
| fun-check (jev, jev-latest) | −sumRisk | 0.60 [0.45, 0.74] | 0.54 | 0.43 (7) | 0.46 (13) | 0.99 |  |
| fun-check (prompt, sonnet) | −ベタ | 0.39 [0.28, 0.49] | 0.33 | 0.29 (7) | 0.35 (13) | - |  |
| fun-check (prompt, sonnet) | −絵なし | 0.51 [0.50, 0.53] | 0.50 | 0.57 (7) | 0.50 (13) | - |  |
| fun-check (prompt, sonnet) | −ひねりなし | 0.48 [0.42, 0.50] | 0.48 | 0.43 (7) | 0.46 (13) | - |  |
| fun-check (prompt, sonnet) | −共感 | 0.50 [0.50, 0.50] | 0.50 | 0.50 (7) | 0.50 (13) | - |  |
| fun-check (prompt, sonnet) | −認知度 | 0.54 [0.51, 0.58] | 0.50 | 0.79 (7) | 0.54 (13) | - |  |
| fun-check (prompt, sonnet) | −長さ | 0.51 [0.50, 0.53] | 0.52 | 0.43 (7) | 0.50 (13) | - |  |
| fun-check (prompt, sonnet) | −滑り | 0.46 [0.40, 0.52] | 0.46 | 0.43 (7) | 0.42 (13) | - |  |
| fun-check (prompt, sonnet) | −相対ベタ | 0.44 [0.32, 0.56] | 0.44 | 0.43 (7) | 0.58 (13) | - |  |
| fun-check (prompt, sonnet) | −被り | 0.59 [0.48, 0.69] | 0.61 | 0.43 (7) | 0.50 (13) | - |  |
| fun-check (prompt, sonnet) | −シュール手癖 | 0.55 [0.45, 0.64] | 0.64 | 0.50 (7) | 0.54 (13) | - |  |
| fun-check (prompt, sonnet) | −nflags | 0.48 [0.34, 0.62] | 0.48 | 0.36 (7) | 0.46 (13) | - |  |
| humor-eval (jev, jev-latest) | novelty | 0.46 [0.30, 0.61] | 0.51 | 0.43 (7) | 0.46 (13) | 1.00 |  |
| humor-eval (jev, jev-latest) | clarity | 0.41 [0.25, 0.57] | 0.36 | 0.29 (7) | 0.31 (13) | 1.00 |  |
| humor-eval (jev, jev-latest) | relevance | 0.40 [0.26, 0.55] | 0.43 | 0.57 (7) | 0.38 (13) | 0.99 |  |
| humor-eval (jev, jev-latest) | intelligence | 0.39 [0.24, 0.55] | 0.38 | 0.43 (7) | 0.38 (13) | 0.99 |  |
| humor-eval (jev, jev-latest) | empathy | 0.37 [0.23, 0.52] | 0.36 | 0.29 (7) | 0.31 (13) | 1.00 |  |
| humor-eval (jev, jev-latest) | overall | 0.42 [0.27, 0.58] | 0.42 | 0.43 (7) | 0.38 (13) | 1.00 |  |
| humor-eval (jev, jev-latest) | overallFloored | 0.42 [0.27, 0.58] | 0.42 | 0.43 (7) | 0.38 (13) | 1.00 |  |
| naive (jev, jev-latest) | funny | 0.43 [0.26, 0.59] | 0.44 | 0.43 (7) | 0.38 (13) | 1.00 |  |
| baseline (jev, -) | −length | 0.51 [0.36, 0.65] | 0.50 | 0.43 (7) | 0.58 (13) | - |  |

## 被りチェック — 15 human similarity judgments (5 similar), flag = score >= 0.7

| evaluator | metric | AUC | recall | false flags | converged AUC | retest r |
|---|---|---|---|---|---|---|
| fun-check-overlap (jev, jev-latest) | sameMaterial | 0.94 | 3/5 | 0/10 | 0.64 | 0.99 |
| fun-check-overlap (jev, jev-latest) | nearDuplicate | 0.80 | 3/5 | 0/10 | 0.41 | 0.89 |
| fun-check-overlap (prompt, sonnet) | flagged | 0.90 | 4/5 | 0/10 | 0.64 | - |
