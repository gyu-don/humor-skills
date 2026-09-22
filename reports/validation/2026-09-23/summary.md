# Human agreement — reports/validation/2026-09-23

Labels: 75 answers (22 hits), 9 mixed sets, 7 set preferences, 13 answer-pair preferences (11 blind).

| evaluator | metric | AUC [95%] | in-set | sets | pairs | retest r | gate |
|---|---|---|---|---|---|---|---|
| diversity-check (prompt, sonnet) | axes (converged AUC, n=17) | 0.49 | - | - | - | - | - |
| diversity-check (prompt, sonnet) | largestAxisCount (converged AUC, n=17) | 0.51 | - | - | - | - | - |
| fun-check (jev, jev-latest) | −betaRisk | 0.56 [0.42, 0.70] | 0.44 | 0.43 (7) | 0.46 (13) | 0.99 |  |
| fun-check (jev, jev-latest) | −noPictureRisk | 0.61 [0.46, 0.75] | 0.56 | 0.43 (7) | 0.54 (13) | 0.99 |  |
| fun-check (jev, jev-latest) | −noTwistRisk | 0.43 [0.29, 0.57] | 0.37 | 0.43 (7) | 0.46 (13) | 0.98 |  |
| fun-check (jev, jev-latest) | −empathyRisk | 0.51 [0.37, 0.66] | 0.52 | 0.71 (7) | 0.58 (13) | 0.96 |  |
| fun-check (jev, jev-latest) | −recognitionRisk | 0.56 [0.43, 0.70] | 0.56 | 0.57 (7) | 0.50 (13) | 0.99 |  |
| fun-check (jev, jev-latest) | −lengthRisk | 0.59 [0.43, 0.74] | 0.58 | 0.43 (7) | 0.69 (13) | 0.96 |  |
| fun-check (jev, jev-latest) | −slipRisk | 0.45 [0.31, 0.59] | 0.48 | 0.57 (7) | 0.31 (13) | 0.98 |  |
| fun-check (jev, jev-latest) | −sumRisk | 0.60 [0.46, 0.74] | 0.56 | 0.43 (7) | 0.62 (13) | 0.99 |  |
| fun-check (prompt, sonnet) | −ベタ | 0.41 [0.28, 0.53] | 0.40 | 0.14 (7) | 0.46 (13) | - |  |
| fun-check (prompt, sonnet) | −絵なし | 0.53 [0.50, 0.56] | 0.52 | 0.57 (7) | 0.54 (13) | - |  |
| fun-check (prompt, sonnet) | −ひねりなし | 0.48 [0.42, 0.50] | 0.48 | 0.43 (7) | 0.46 (13) | - |  |
| fun-check (prompt, sonnet) | −共感 | 0.50 [0.50, 0.50] | 0.50 | 0.50 (7) | 0.50 (13) | - |  |
| fun-check (prompt, sonnet) | −認知度 | 0.49 [0.43, 0.52] | 0.48 | 0.50 (7) | 0.46 (13) | - |  |
| fun-check (prompt, sonnet) | −長さ | 0.51 [0.50, 0.53] | 0.50 | 0.57 (7) | 0.50 (13) | - |  |
| fun-check (prompt, sonnet) | −滑り | 0.50 [0.44, 0.54] | 0.51 | 0.43 (7) | 0.46 (13) | - |  |
| fun-check (prompt, sonnet) | −相対ベタ | 0.38 [0.25, 0.49] | 0.37 | 0.29 (7) | 0.38 (13) | - |  |
| fun-check (prompt, sonnet) | −被り | 0.47 [0.34, 0.58] | 0.50 | 0.29 (7) | 0.46 (13) | - |  |
| fun-check (prompt, sonnet) | −シュール手癖 | 0.55 [0.49, 0.62] | 0.61 | 0.36 (7) | 0.54 (13) | - |  |
| fun-check (prompt, sonnet) | −nflags | 0.40 [0.26, 0.54] | 0.43 | 0.14 (7) | 0.38 (13) | - |  |
| humor-eval (jev, jev-latest) | novelty | 0.45 [0.30, 0.61] | 0.48 | 0.29 (7) | 0.46 (13) | 1.00 |  |
| humor-eval (jev, jev-latest) | clarity | 0.42 [0.25, 0.58] | 0.38 | 0.29 (7) | 0.31 (13) | 0.99 |  |
| humor-eval (jev, jev-latest) | relevance | 0.39 [0.25, 0.54] | 0.43 | 0.57 (7) | 0.38 (13) | 1.00 |  |
| humor-eval (jev, jev-latest) | intelligence | 0.39 [0.24, 0.55] | 0.38 | 0.57 (7) | 0.38 (13) | 0.99 |  |
| humor-eval (jev, jev-latest) | empathy | 0.37 [0.23, 0.53] | 0.38 | 0.29 (7) | 0.31 (13) | 0.99 |  |
| humor-eval (jev, jev-latest) | overall | 0.43 [0.28, 0.59] | 0.42 | 0.43 (7) | 0.38 (13) | 1.00 |  |
| humor-eval (jev, jev-latest) | overallFloored | 0.43 [0.28, 0.59] | 0.42 | 0.43 (7) | 0.38 (13) | 1.00 |  |
| humor-eval (prompt, sonnet) | novelty | 0.45 [0.30, 0.60] | 0.50 | 0.29 (7) | 0.35 (13) | 0.57 |  |
| humor-eval (prompt, sonnet) | clarity | 0.49 [0.35, 0.63] | 0.42 | 0.71 (7) | 0.50 (13) | 0.54 |  |
| humor-eval (prompt, sonnet) | relevance | 0.44 [0.30, 0.58] | 0.46 | 0.43 (7) | 0.46 (13) | 0.57 |  |
| humor-eval (prompt, sonnet) | intelligence | 0.41 [0.28, 0.56] | 0.54 | 0.21 (7) | 0.46 (13) | 0.66 |  |
| humor-eval (prompt, sonnet) | empathy | 0.54 [0.40, 0.68] | 0.53 | 0.64 (7) | 0.58 (13) | 0.42 |  |
| humor-eval (prompt, sonnet) | overall | 0.49 [0.35, 0.64] | 0.59 | 0.29 (7) | 0.46 (13) | 0.58 |  |
| humor-eval (prompt, sonnet) | overallFloored | 0.49 [0.35, 0.64] | 0.59 | 0.36 (7) | 0.46 (13) | 0.55 |  |
| naive (jev, jev-latest) | funny | 0.42 [0.26, 0.58] | 0.44 | 0.43 (7) | 0.38 (13) | 1.00 |  |
| naive (prompt, sonnet) | rank | 0.52 [0.37, 0.68] | 0.62 | 0.43 (7) | 0.38 (13) | - |  |
| naive (prompt, sonnet) | hit | 0.55 [0.42, 0.67] | 0.64 | 0.43 (7) | 0.58 (13) | - |  |
| baseline (jev, -) | −length | 0.51 [0.36, 0.65] | 0.50 | 0.43 (7) | 0.58 (13) | - |  |
