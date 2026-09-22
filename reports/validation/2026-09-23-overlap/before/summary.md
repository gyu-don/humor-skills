# Human agreement — reports/validation/2026-09-23-overlap/before

Labels: 75 answers (22 hits), 9 mixed sets, 7 set preferences, 13 answer-pair preferences (11 blind).

| evaluator | metric | AUC [95%] | in-set | sets | pairs | retest r | gate |
|---|---|---|---|---|---|---|---|
| fun-check (prompt, sonnet) | −ベタ | 0.38 [0.25, 0.49] | 0.38 | 0.21 (7) | 0.31 (13) | - |  |
| fun-check (prompt, sonnet) | −絵なし | 0.53 [0.45, 0.60] | 0.51 | 0.43 (7) | 0.54 (13) | - |  |
| fun-check (prompt, sonnet) | −ひねりなし | 0.44 [0.36, 0.51] | 0.40 | 0.36 (7) | 0.42 (13) | - |  |
| fun-check (prompt, sonnet) | −共感 | 0.48 [0.43, 0.50] | 0.47 | 0.43 (7) | 0.50 (13) | - |  |
| fun-check (prompt, sonnet) | −認知度 | 0.51 [0.45, 0.55] | 0.51 | 0.50 (7) | 0.46 (13) | - |  |
| fun-check (prompt, sonnet) | −長さ | 0.51 [0.50, 0.53] | 0.51 | 0.43 (7) | 0.54 (13) | - |  |
| fun-check (prompt, sonnet) | −滑り | 0.49 [0.42, 0.56] | 0.48 | 0.43 (7) | 0.46 (13) | - |  |
| fun-check (prompt, sonnet) | −相対ベタ | 0.38 [0.26, 0.49] | 0.42 | 0.14 (7) | 0.42 (13) | - |  |
| fun-check (prompt, sonnet) | −被り | 0.54 [0.41, 0.65] | 0.61 | 0.29 (7) | 0.46 (13) | - |  |
| fun-check (prompt, sonnet) | −シュール手癖 | 0.54 [0.44, 0.62] | 0.56 | 0.57 (7) | 0.54 (13) | - |  |
| fun-check (prompt, sonnet) | −nflags | 0.40 [0.27, 0.53] | 0.45 | 0.21 (7) | 0.31 (13) | - |  |
| baseline (jev, -) | −length | 0.51 [0.36, 0.65] | 0.50 | 0.43 (7) | 0.58 (13) | - |  |

## 被りチェック — 15 human similarity judgments (5 similar), flag = score >= 0.7

| evaluator | metric | AUC | recall | false flags | converged AUC | retest r |
|---|---|---|---|---|---|---|
| fun-check-overlap (prompt, sonnet) | flagged | 0.70 | 4/5 | 4/10 | 0.41 | - |
