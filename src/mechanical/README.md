# Mechanical form checks

`check_form.py` is an opt-in, offline development helper extracted from the
ogiri-ai generation skill. Run it on saved outputs during development; the
generation skill does not invoke it or require Python.

It takes `--check-json` followed by one JSON argument containing `answers`
(five nonempty body strings), optional `exact_length`, `character_pattern`
(a Python full-match regular expression), and `quote_limit` (1 by default,
or 2 for utterance prompts). It reports code-point lengths, quoted-answer
count and violations. The maximum body length is 20 code points. These
five-answer/20-character defaults preserve the policy of the originating
experiment, rather than introducing a new quality metric.

An optional `exception` with a one-based `index` and `rule` (`exact_length`
or `character_pattern`) waives only that condition for one answer. Supply
this only after a separate semantic audit accepts the departure. A valid
report does not establish that a joke or an exception makes sense. The
20-character maximum and quote cap cannot be waived. Self-claims, utterance
form, relevance and funniness require separate review.

Use a subprocess argument list or proper shell quoting for the JSON. No API,
SDK, key or network access is needed. For example, from a Python evaluation
runner:

```python
subprocess.run([
    "python3", "src/mechanical/check_form.py", "--check-json",
    json.dumps({"answers": answers, "exact_length": 7}, ensure_ascii=False),
], check=True)
```

The CLI returns a JSON report on stdout. Malformed input exits with code 2;
condition violations are represented by `valid: false` and `issues` in the
report. Callers must read `valid`, not infer compliance from the exit code.

This is plain deterministic code, not a Jev judge or a new installable skill.
The extracted implementation is unchanged from ogiri-ai candidate 5bb93909;
its old experiment records remain historical, including their gate failures.
