# Repository guide

## Purpose

Two goals, in this order of priority:

1. **Automated tests for improving generation skills** — above all
   [gyu-don/ogiri-ai](https://github.com/gyu-don/ogiri-ai), where an agent
   revises the 大喜利 skill and needs checks it can run without a human.
   These live in `skills/` and are Jev-only: a check goes there only once it
   agrees with human judgments (see Validation).
2. **Research on measuring funniness by machine.** Nothing that asks "is it
   funny" agrees with the human labels yet, in Jev or in prompt mode. Those
   judges live in `research/` and keep being re-validated as labels grow;
   they are never used as automated tests.

Grown out of ogiri-ai's prompt-based dev tools (`fun-check`, `humor-eval`,
`humor-rank`, `diversity-check`, `cluster-fit-check`) and the
`jev-practice` playground, which proved the Jev question shape (`choice` /
`score` / `noul`, one atomic question per axis). The old tools were split
and renamed by what validation showed (2026-09-24):

| old | now |
|---|---|
| `fun-check` Step 3 (被り) | `skills/overlap-check` |
| `fun-check` 絵なし・長さ | `skills/trait-check` (`concrete`, `indirect`) |
| `humor-rank` | `skills/trait-check` `scripts/compare.ts` |
| `fun-check` other flags | `research/risk-flags` |
| `humor-eval` | `research/funniness-score` |
| `diversity-check`, `cluster-fit-check` | `research/` (same names) |

Reports under `reports/validation/` dated 2026-09-24 or earlier use the old names.

Write evaluators as reusable functions of `(topic, answers)`, not as
one-off scripts tied to ogiri-ai's output shape — this repo should stay
usable for other comedy-answer sources later, not just that one skill.

## Layout

- `skills/<name>/` — one automated-test skill, Jev-only, fully
  self-contained, following the standard skill layout:

  ```
  skills/<name>/
  ├── SKILL.md        what it checks, how to run it, how far to trust it
  ├── package.json    the one runtime dep (@typesafe-ai/sdk), nothing else
  ├── scripts/
  │   └── evaluate.ts the check (trait-check also has compare.ts)
  └── assets/
      └── samples.json default input / input-shape example
  ```

  Everything a skill needs travels together, because `npx skills add` /
  `/plugin install` copy exactly this directory — nothing outside it.
  Scripts resolve `../assets/*.json` relative to their own file location,
  not the CWD, so they keep working once copied elsewhere.
  No prompt-mode version: where Jev does the job, the prompt version was
  removed. `SKILL.md` must state the human agreement the check was
  validated at.
  `.claude/skills/<name>` symlinks to `skills/<name>` so the same skills also
  run locally in this repo — edit the `skills/` copy, never the symlink target.
  This repo's own `package.json` scripts (`npm run audit:<name>`) just call
  the same scripts with repo-relative sample/report paths, for convenience.

- `research/<name>/` — judges still under validation (funniness, risk
  flags, diversity, cluster fit); `research/README.md` lists their status
  and what would move one into `skills/`. Not installable; SKILL.md holds
  the prompt-mode procedure where there is one, `scripts/evaluate.ts` the
  Jev version.

- `src/ogiri-ai/` — not a `skills/` entry: this audits ogiri-ai's own
  generation SKILL.md (a separate repo, not one of the judge skills above),
  so it has no installable skill wrapper.
- `data/human-evals/<source>/` — human judgments, the ground truth every
  judge is validated against. One session = `<date>.md` (narrative)
  + `<date>.json` (structured labels), plus `findings.md` distilling
  recurring patterns. Storage rules and the JSON schema are in
  `data/human-evals/README.md`; follow them when adding a session.
- `src/validation/` — measures how well each judge agrees with those human
  labels (see Validation below).
- `reports/` — generated evaluator output only, never hand-edited except
  `notes.md` interpretations. `reports/<skill>/results.json` are the
  `audit:*` sample runs of `skills/`; `reports/validation/<date>/` are validation runs.
- Deterministic checks (char counts, punctuation, regex) go in plain code,
  never as a Jev question.

## What an installed skill needs

A copied-out skill is a normal (tiny) npm package, so its users need:

- Node.js >= 22.6 — `evaluate.ts` is run directly, via Node's TypeScript
  type stripping; there is no build step and no compiled output to ship.
- `TYPESAFE_API_KEY` in the environment (here: via `doppler run --`).
- One `npm install` inside the skill directory, first run only. The only
  dependency is `@typesafe-ai/sdk`, which itself has zero dependencies, so
  that install is a single ~230 KB package and needs no lockfile of its own.

Both prerequisites fail loudly with the fix: `evaluate.ts` imports the SDK
through a guarded dynamic import that says to run `npm install`, and checks
`TYPESAFE_API_KEY` before making any call. Keep that true of any new script —
a skill running on someone else's machine can't assume this repo's setup.

Inside this repo no per-skill install is needed: Node resolves the SDK by
walking up to the root `node_modules`.

## Commands

- `npm install`, `npm run check` (type-check)
- `doppler run -- npm run audit:ogiri-ai [-- <output path>]`
- `doppler run -- npm run validate:jev -- reports/validation/<date> [runs]`
- `npm run validate:blind -- make|unblind ...`, `npm run validate:agreement -- reports/validation/<date>`
- `doppler run -- npm run audit:overlap-check` / `audit:trait-check` (sample runs)
- `npx skills add . -s <name>` to (re)install a skill locally; `--list` to see what's found
  (after installing, run `npm install` in the installed skill directory once)

`TYPESAFE_API_KEY` comes from Doppler — never print/commit it or add a
`.env`. Any command touching the TypeSafe API must run under `doppler run --`.
We use `jj`, not `git`, for version control.

## Jev conventions

- `@typesafe-ai/sdk`'s `TypeSafeClient`, model alias `jev-latest` unless an
  experiment documents why it pins a version.
- One atomic question per axis (`choice` / `score` / `noul`); split any axis
  that's really two independent factors (e.g. "has a person" vs. "that
  person is earnest").
- Batch independent questions about the same state into one call.
- Calibrate thresholds against real measured examples, not arbitrary numbers.

Reference docs (check before changing SDK/API usage):

- https://docs.typesafe.ai/introduction/quickstart
- https://docs.typesafe.ai/sdk/javascript
- https://docs.typesafe.ai/models
- https://docs.typesafe.ai/api

## Change workflow

After code changes: `npm run check`, and if request shape changed, one real
`doppler run --` call to confirm the response still parses as expected.

After any change to a judge's `SKILL.md` or scripts (in `skills/` or `research/`), run
Validation and compare its `summary.md` with the previous run's. A judge
change is an improvement only if human agreement goes up — not because its
scores look more plausible.

## Validation

Judges are validated against `data/human-evals/`, never against another
judge. Output goes to a new `reports/validation/<date>/`.

1. Jev mode — one command, runs every judge's real script (`skills/` and
   `research/`) plus the no-rubric baselines, twice (for test-retest):
   `doppler run -- npm run validate:jev -- reports/validation/<date>`
2. Prompt mode (`research/` judges only) — the judge is a subagent following `SKILL.md`:
   - `npm run validate:blind -- make reports/validation/<date>/blind`
     writes shuffled, source-hidden `pool-<n>.md` (answer-level) and
     `sets-<n>.md` (set-level), plus `key.json`.
     It also writes `pairs.md`: same-topic A/B pairs with a known human
     preference, for the no-rubric "which is funnier" baseline
     (`naive-pairwise`) — and for new human sessions, which can rate the
     same file.
   - One subagent per skill per input file (one skill per subagent). Tell it
     to read only the judge's `SKILL.md` and that one input file — **not**
     `key.json`, `data/human-evals/`, or other reports — to apply the skill
     to each お題 independently, and to write JSON in the shape listed at the
     top of `src/validation/blind.ts`. Use `sets-<n>.md` for
     `diversity-check`, `pairs.md` for `naive-pairwise`, `pool-<n>.md` for the rest. Run `funniness-score` twice.
   - `npm run validate:blind -- unblind <blind dir> <format> <out-1.json> <out-2.json> <run> <model>`
     per judge output. Keep the subagents' prose reports under
     `prompt-reports/`; they show *why* a judge failed.
3. `npm run validate:agreement -- reports/validation/<date>` writes
   `summary.md`. Put the interpretation in `notes.md` next to it.

Reading the summary: start from the latest `notes.md`; in `summary.md`
only a few rows matter. AUC 0.5 is chance, and a judge that does not beat
the `length` baseline is not measuring funniness. For `skills/`, check that
nothing regressed: `trait-check` (`concrete`, `−indirect`: AUC interval
lower bound, `sets`), `overlap-check` in the 被りチェック table (`false
flags` must stay 0 — judges asked to find overlaps tend to invent them,
`reports/validation/2026-09-23-overlap/notes.md`), and `trait-compare` in
the 一対比較 table (`in-set`, `confident` — a judge whose confident calls
are worse than its average is anti-aligned with the human, not just
noisy). For `research/`, the question is whether anything has started to
beat the `naive` / `naive-pairwise` / `length` baselines.
The `gate` column marks metrics good enough to replace a human verdict in
ogiri-ai's gate check; as of 2026-09-24 nothing qualifies
(`reports/validation/2026-09-24/notes.md`).
