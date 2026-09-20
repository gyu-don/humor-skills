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

- `skills/<name>/` — one judge skill, fully self-contained: `SKILL.md` (the
  original prompt-based judgment, moved here as-is from `ogiri-ai`),
  `evaluate.ts` (its Jev port, once made), `samples.json` (default input),
  and its own minimal `package.json` (just `@typesafe-ai/sdk`). Everything a
  skill needs travels together, because `npx skills add`/`/plugin install`
  copy exactly this directory — nothing outside it. `evaluate.ts` resolves
  its default sample path relative to its own file location, not the CWD, so
  it keeps working once copied elsewhere (after an `npm install` there).
  `SKILL.md` documents both how to run it manually and how to call
  `evaluate.ts` for the numeric version.
  `.claude/skills/<name>` symlinks to `skills/<name>` so the same skills also
  run locally in this repo — edit the `skills/` copy, never the symlink target.
  This repo's own `package.json` scripts (`npm run audit:<name>`) just call
  the same `evaluate.ts` with repo-relative sample/report paths, for convenience.
- `src/ogiri-ai/` — not a `skills/` entry: this audits ogiri-ai's own
  generation SKILL.md (a separate repo, not one of the judge skills above),
  so it has no installable skill wrapper.
- Deterministic checks (char counts, punctuation, regex) go in plain code,
  never as a Jev question.

## Commands

- `npm install`, `npm run check` (type-check)
- `doppler run -- npm run audit:ogiri-ai [-- <output path>]`
- `npx skills add . -s <name>` to (re)install a skill locally; `--list` to see what's found

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
