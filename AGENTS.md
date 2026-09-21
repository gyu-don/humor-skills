# Repository guide

## Purpose

A toolkit for scoring humor/comedy answers with Jev, so judgments that are
currently only made qualitatively by an LLM reading a report become numbers
you can rerun and compare. Grown out of two prior efforts:

- [gyu-don/ogiri-ai](https://github.com/gyu-don/ogiri-ai)'s prompt-based dev
  tools (`fun-check`, `humor-eval`, `humor-rank`, `diversity-check`,
  `cluster-fit-check`) — good design for *what* to measure, but LLM-judged
  and not directly comparable run to run.
- the `jev-practice` playground — proved the Jev question shape (`choice` /
  `score` / `noul`, one atomic question per axis) works for this.

Write evaluators as reusable functions of `(topic, answers)`, not as
one-off scripts tied to ogiri-ai's output shape — this repo should stay
usable for other comedy-answer sources later, not just that one skill.

## Layout

- `skills/<name>/` — one judge skill, fully self-contained, following the
  standard skill layout:

  ```
  skills/<name>/
  ├── SKILL.md        the original prompt-based judgment, moved here as-is from ogiri-ai
  ├── package.json    the one runtime dep (@typesafe-ai/sdk), nothing else
  ├── scripts/
  │   └── evaluate.ts its Jev port
  └── assets/
      └── samples.json default input / input-shape example
  ```

  Everything a skill needs travels together, because `npx skills add` /
  `/plugin install` copy exactly this directory — nothing outside it.
  `evaluate.ts` resolves `../assets/samples.json` relative to its own file
  location, not the CWD, so it keeps working once copied elsewhere.
  `SKILL.md` documents both how to run it manually and how to call
  `scripts/evaluate.ts` for the numeric version.
  `.claude/skills/<name>` symlinks to `skills/<name>` so the same skills also
  run locally in this repo — edit the `skills/` copy, never the symlink target.
  This repo's own `package.json` scripts (`npm run audit:<name>`) just call
  the same `evaluate.ts` with repo-relative sample/report paths, for convenience.

- `src/ogiri-ai/` — not a `skills/` entry: this audits ogiri-ai's own
  generation SKILL.md (a separate repo, not one of the judge skills above),
  so it has no installable skill wrapper.
  - `src/ogiri-ai/evaluations/` — dated human-evaluation logs of ogiri-ai's
    generated answers, plus `findings.md` distilling recurring patterns.
    Ported from ogiri-ai's own `evaluations/` + `DEVELOPMENT.md`, from
    before evaluation skills lived in this repo. Use it to calibrate a judge
    skill (`fun-check` / `humor-rank`) blind against recorded human rankings.
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
