"""Precision report from human-reviewed event verdicts.

Every detected event was manually reviewed against its annotated snapshot/clip
(verdict TP/FP in tests/fixtures/event_verdicts.csv). Recall is reported
qualitatively — see notebooks/eval.ipynb.

Usage:
    .venv39/bin/python scripts/eval_precision.py
"""
import csv
from collections import defaultdict
from pathlib import Path

VERDICTS = Path(__file__).resolve().parents[1] / "tests" / "fixtures" / "event_verdicts.csv"


def main():
    rows = list(csv.DictReader(open(VERDICTS, encoding="utf-8")))
    by_seg = defaultdict(lambda: {"TP": 0, "FP": 0})
    for r in rows:
        by_seg[r["segment"]][r["verdict"]] += 1

    tp = sum(s["TP"] for s in by_seg.values())
    fp = sum(s["FP"] for s in by_seg.values())
    print(f"reviewed events: {len(rows)}")
    print(f"OVERALL precision = {tp}/{tp+fp} = {tp/(tp+fp):.2f}\n")
    print(f"{'segment':14s} {'TP':>3s} {'FP':>3s} {'precision':>9s}")
    for seg in sorted(by_seg):
        s = by_seg[seg]
        n = s["TP"] + s["FP"]
        print(f"{seg:14s} {s['TP']:3d} {s['FP']:3d} {s['TP']/n:9.2f}")

    print("\nFP breakdown:")
    for r in rows:
        if r["verdict"] == "FP":
            print(f"  #{r['event_id']} {r['segment']} {r['cls']}: {r['note']}")


if __name__ == "__main__":
    main()
