# Human agreement — reports/validation/2026-09-24/candidates

Labels: 75 answers (22 hits), 9 mixed sets, 7 set preferences, 13 answer-pair preferences (11 blind).

| evaluator | metric | AUC [95%] | in-set | sets | pairs | retest r | gate |
|---|---|---|---|---|---|---|---|
| candidates-r1 (jev, jev-latest) | concrete | 0.66 [0.52, 0.79] | 0.56 | 0.86 (7) | 0.62 (13) | - |  |
| candidates-r1 (jev, jev-latest) | −conceptOnly | 0.61 [0.46, 0.75] | 0.53 | 0.79 (7) | 0.46 (13) | - |  |
| candidates-r1 (jev, jev-latest) | −exaggerationOnly | 0.57 [0.42, 0.72] | 0.56 | 0.71 (7) | 0.42 (13) | - |  |
| candidates-r1 (jev, jev-latest) | −explanatory | 0.62 [0.47, 0.75] | 0.62 | 0.50 (7) | 0.69 (13) | - |  |
| candidates-r1 (jev, jev-latest) | −cleverOnly | 0.42 [0.28, 0.57] | 0.42 | 0.71 (7) | 0.54 (13) | - |  |
| candidates-r1 (jev, jev-latest) | bold | 0.56 [0.40, 0.70] | 0.46 | 0.57 (7) | 0.54 (13) | - |  |
| candidates-r1 (jev, jev-latest) | laugh.laugh | 0.43 [0.28, 0.58] | 0.44 | 0.57 (7) | 0.38 (13) | - |  |
| candidates-r1 (jev, jev-latest) | −laugh.silent | 0.40 [0.24, 0.56] | 0.44 | 0.29 (7) | 0.38 (13) | - |  |
| candidates-r1 (jev, jev-latest) | −laugh.smirk | 0.58 [0.43, 0.72] | 0.59 | 0.86 (7) | 0.54 (13) | - |  |
| candidates-r1 (jev, jev-latest) | formFit | 0.43 [0.29, 0.58] | 0.38 | 0.43 (7) | 0.42 (13) | - |  |
| candidates-r2 (jev, jev-latest) | concrete | 0.67 [0.53, 0.81] | 0.59 | 0.86 (7) | 0.73 (13) | 1.00 |  |
| candidates-r2 (jev, jev-latest) | −conceptRisk | 0.65 [0.50, 0.79] | 0.57 | 0.71 (7) | 0.46 (13) | 0.99 |  |
| candidates-r2 (jev, jev-latest) | concrete2 | 0.65 [0.50, 0.78] | 0.54 | 0.86 (7) | 0.62 (13) | 1.00 |  |
| candidates-r2 (jev, jev-latest) | −explanatory | 0.62 [0.47, 0.75] | 0.66 | 0.57 (7) | 0.65 (13) | 0.99 |  |
| candidates-r2 (jev, jev-latest) | −lengthRisk2 | 0.62 [0.48, 0.76] | 0.58 | 0.43 (7) | 0.46 (13) | 0.99 |  |
| candidates-r2 (jev, jev-latest) | heOverallRich | 0.39 [0.24, 0.54] | 0.41 | 0.29 (7) | 0.46 (13) | 1.00 |  |
| candidates-r2 (jev, jev-latest) | −typical | 0.58 [0.44, 0.72] | 0.55 | 0.50 (7) | 0.50 (13) | 0.98 |  |
| same-direction (jev, jev-latest) | sameDirection (converged AUC, n=20) | 0.50 | - | - | - | - | - |
| baseline (jev, -) | −length | 0.51 [0.36, 0.65] | 0.50 | 0.43 (7) | 0.58 (13) | - |  |

## 一対比較 — 60 pairs with a human preference

| evaluator | metric | in-set | pairs | confident | retest r |
|---|---|---|---|---|---|
| pair-criteria (jev, jev-latest) | recover | 0.36 (50) | 0.38 (13) | 0.33 (18) | - |
| pair-criteria (jev, jev-latest) | picture | 0.54 (50) | 0.46 (13) | 0.45 (22) | - |
| pair-criteria (jev, jev-latest) | concrete | 0.66 (50) | 0.54 (13) | 0.67 (18) | - |
| pair-criteria (jev, jev-latest) | straight | 0.64 (50) | 0.65 (13) | 0.68 (19) | - |
| pair-criteria (jev, jev-latest) | novel | 0.46 (50) | 0.54 (13) | 0.45 (31) | - |
| pairwise-holistic (jev, jev-latest) | adopt | 0.51 (50) | 0.50 (13) | 0.43 (21) | - |
| pairwise-holistic (jev, jev-latest) | funny | 0.44 (50) | 0.38 (13) | 0.32 (22) | - |
| pairwise-holistic (jev, jev-latest) | laugh | 0.48 (50) | 0.54 (13) | 0.32 (19) | - |
