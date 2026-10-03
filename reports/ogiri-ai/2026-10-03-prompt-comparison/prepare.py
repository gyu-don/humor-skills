"""Preserve raw generation, prepare check inputs, and randomize blind sets."""

import argparse
import hashlib
import json
import random
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TOPICS = {
    "codex": "Codexのイケてる使い方",
    "sylvanian": "シルバニアファミリーの新作",
    "weather": "絶対に信用できない天気予報士の一言",
}
CONDITIONS = ("baseline", "variation-1", "variation-2")
PATTERN = r"\n\n".join(rf"【回答{i}】\n([^\n]+)" for i in range(1, 6))


def write_json(name, value):
    (ROOT / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def read_run(condition, topic, run):
    path = ROOT / "raw" / f"{condition}-{topic}-r{run}.txt"
    raw = path.read_text()
    match = re.fullmatch(PATTERN + r"\n?", raw)
    if not match:
        raise ValueError(f"Unexpected output format: {path}")
    return {
        "id": f"{topic}/{condition}/r{run}",
        "label": condition,
        "topic": TOPICS[topic],
        "answers": list(match.groups()),
        "rawPath": str(path.relative_to(ROOT)),
        "sha256": hashlib.sha256(raw.encode()).hexdigest(),
    }


def prepare(phase, include_known_topic=False):
    topic_keys = list(TOPICS) if phase == "gate" or include_known_topic else ["codex", "sylvanian"]
    run_numbers = [1, 2] if phase == "gate" else [1]
    runs = [read_run(c, t, r) for t in topic_keys for c in CONDITIONS for r in run_numbers]
    samples = []
    mechanical = []
    for topic in topic_keys:
        for condition in CONDITIONS:
            own = [r for r in runs if r["id"].startswith(f"{topic}/{condition}/")]
            answers = [a for r in own for a in r["answers"]]
            sample_id = f"{topic}/{condition}"
            samples.append({"id": sample_id, "label": condition, "topic": TOPICS[topic], "answers": answers})
            mechanical.append({
                "id": sample_id,
                "answerCount": len(answers),
                "lengths": [len(a) for a in answers],
                "lengthViolations": [i for i, a in enumerate(answers, 1) if len(a) > 20],
                "quoteAnswersPerRun": [sum("「" in a or "」" in a for a in r["answers"]) for r in own],
                "quoteViolations": [r["id"] for r in own if sum("「" in a or "」" in a for a in r["answers"]) > (2 if topic == "weather" else 1)],
                "rawOutputFormat": "passed",
                "semanticForm": "pending hand review",
            })
    write_json(f"{phase}-input.json", samples)
    write_json(f"{phase}-runs.json", runs)
    write_json(f"{phase}-mechanical.json", mechanical)
    if phase == "gate":
        by_id = {s["id"]: s for s in samples}
        for topic in topic_keys:
            baseline = by_id[f"{topic}/baseline"]["answers"]
            baseline_pairs = [{
                "id": f"{topic}/baseline-run-gap/{i}-{j}",
                "label": f"{topic}/baseline-run-gap",
                "topic": TOPICS[topic],
                "answerA": a,
                "answerB": b,
            } for i, a in enumerate(baseline[5:], 1) for j, b in enumerate(baseline[:5], 1)]
            write_json(f"pairs-{topic}-baseline-gap.json", baseline_pairs)
            for condition in CONDITIONS[1:]:
                candidate = by_id[f"{topic}/{condition}"]["answers"]
                pairs = [{
                    "id": f"{topic}/{condition}/{i}-{j}",
                    "label": f"{topic}/{condition}",
                    "topic": TOPICS[topic],
                    "answerA": a,
                    "answerB": b,
                } for i, a in enumerate(candidate, 1) for j, b in enumerate(baseline, 1)]
                write_json(f"pairs-{topic}-{condition}.json", pairs)
    print(json.dumps({"phase": phase, "sets": len(samples), "answers": sum(len(s["answers"]) for s in samples), "hardViolations": [m["id"] for m in mechanical if m["lengthViolations"] or m["quoteViolations"]]}, ensure_ascii=False))


def blind():
    key_path = ROOT / "blind-key.json"
    if key_path.exists():
        key = json.loads(key_path.read_text())
    else:
        key = {}
        for topic in TOPICS:
            shuffled = list(CONDITIONS)
            random.SystemRandom().shuffle(shuffled)
            key[topic] = dict(zip("ABC", shuffled))
        write_json("blind-key.json", key)
    for run in [1, 2]:
        if run == 2 and not any((ROOT / "raw").glob("*-r2.txt")):
            continue
        sections = [f"# ブラインド比較 第{run}回", "", "各お題のA/B/Cは独立に並べ替えています。評価欄は空欄です。", ""]
        for topic, text in TOPICS.items():
            if run == 2 and not all((ROOT / "raw" / f"{c}-{topic}-r2.txt").exists() for c in CONDITIONS):
                continue
            answers = {label: read_run(condition, topic, run)["answers"] for label, condition in key[topic].items()}
            sections.extend([f"## {text}", "", "| 番号 | A | B | C |", "|---|---|---|---|"])
            for i in range(5):
                sections.append(f"| {i + 1} | " + " | ".join(answers[label][i].replace("|", "\\|") for label in "ABC") + " |")
            sections.extend(["", "好きな組:　　好きな回答番号:　　コメント:", ""])
        (ROOT / f"blind-r{run}.md").write_text("\n".join(sections))
    print("Blind sets saved; condition mapping kept in blind-key.json")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("phase", choices=("light", "gate", "blind"))
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--include-known-topic", action="store_true")
    args = parser.parse_args()
    ROOT = args.root.resolve()
    blind() if args.phase == "blind" else prepare(args.phase, args.include_known_topic)
