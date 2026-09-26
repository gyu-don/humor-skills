# Repository guide

## Purpose

Two goals, in this order of priority:

1. **Automated tests for improving generation skills** — above all
   [gyu-don/ogiri-ai](https://github.com/gyu-don/ogiri-ai), where an agent
   revises the 大喜利 skill and needs checks it can run without a human.
   These live in `skills/` and are Jev-only: a check goes there only once it
   agrees with human judgments.
2. **Research on measuring funniness by machine.** Nothing that asks "is it
   funny" agrees with the human labels yet. Those judges live in `research/`
   and are never used as automated tests.

Write evaluators as reusable functions of `(topic, answers)`, not tied to
ogiri-ai's output shape.

## Layout

- `skills/<name>/` — one automated-test skill, fully self-contained
  (`SKILL.md`, `package.json` with only `@typesafe-ai/sdk`,
  `scripts/evaluate.ts`, `assets/samples.json`), because installing copies
  exactly this directory. Scripts resolve `../assets/*.json` relative to their
  own file, fail loudly with the fix when the SDK isn't installed or
  `TYPESAFE_API_KEY` is missing, and run directly on Node >= 22.6 (no build).
  `SKILL.md` must state the human agreement it was validated at.
  `.claude/skills/<name>` symlinks here — edit the `skills/` copy.
- `research/<name>/` — judges still under validation; status and promotion
  criteria in `research/README.md`. Not installable.
- `data/human-evals/<source>/` — human judgments, the ground truth. Follow
  `data/human-evals/README.md` when adding a session.
- `src/validation/` — measures judge agreement with human labels
  (procedure in `src/validation/README.md`).
- `reports/` — generated output only; never hand-edit except `notes.md`.
- Deterministic checks (char counts, punctuation, regex) go in plain code,
  never as a Jev question.

## Commands

- `npm install`, `npm run check` (type-check)
- `doppler run -- npm run audit:overlap-check` / `audit:trait-check`
- `doppler run -- npm run validate:jev -- reports/validation/<date> [runs]`
- `npm run validate:blind -- make|unblind ...`, `npm run validate:agreement -- reports/validation/<date>`
- `npx skills add . -s <name>` to install a skill locally (`--list` to see what's found)

`TYPESAFE_API_KEY` comes from Doppler — never print/commit it or add a
`.env`; anything touching the TypeSafe API runs under `doppler run --`.
Use `jj`, not `git`.

## Jev conventions

- `@typesafe-ai/sdk`'s `TypeSafeClient`, model alias `jev-latest` unless an
  experiment documents why it pins a version.
- One atomic question per axis (`choice` / `score` / `noul`); split any axis
  that's really two independent factors.
- Batch independent questions about the same state into one call.
- Calibrate thresholds against real measured examples.
- Before changing SDK/API usage, check https://docs.typesafe.ai/sdk/javascript
  (and `/models`, `/api`).

## Change workflow

After code changes: `npm run check`, and if request shape changed, one real
`doppler run --` call to confirm the response still parses.

After any change to a judge (`skills/` or `research/`), run validation
(`src/validation/README.md`) and compare `summary.md` with the previous run.
A change is an improvement only if human agreement goes up. For `skills/`,
nothing may regress — in particular `overlap-check` `false flags` must stay 0.
