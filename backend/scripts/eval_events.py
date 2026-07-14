"""Evaluate violation detection against hand-labeled ground truth.

Ground truth CSV columns: segment, t_sec, cls, note
Matching rule: prediction matches a GT row when same segment and
|t_pred - t_gt| <= tolerance (default 3 s). Class-agnostic by default
(--strict-class to require class match). Greedy 1-to-1 matching by time.

Usage:
    .venv39/bin/python scripts/eval_events.py --gt tests/fixtures/ground_truth.csv [--tolerance 3]
"""
import argparse
import csv
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import db as dbmod  # noqa: E402


def load_gt(path):
    rows = []
    with open(path, encoding="utf-8") as f:
        for r in csv.DictReader(f):
            rows.append({"segment": r["segment"].strip(),
                         "t": float(r["t_sec"]), "cls": r["cls"].strip()})
    return rows


def load_predictions(conn):
    q = """SELECT e.ts_sec, e.cls, v.segment FROM events e
           JOIN videos v ON v.id = e.video_id WHERE v.status='done'"""
    return [{"segment": r["segment"], "t": r["ts_sec"], "cls": r["cls"]}
            for r in conn.execute(q).fetchall()]


def evaluate(gt, preds, tolerance, strict_class=False):
    by_seg_gt = defaultdict(list)
    for g in gt:
        by_seg_gt[g["segment"]].append(dict(g))
    tp, fp = 0, 0
    fp_list, matched = [], []
    for p in sorted(preds, key=lambda x: x["t"]):
        cands = [g for g in by_seg_gt[p["segment"]]
                 if not g.get("used") and abs(g["t"] - p["t"]) <= tolerance
                 and (not strict_class or g["cls"] == p["cls"])]
        if cands:
            best = min(cands, key=lambda g: abs(g["t"] - p["t"]))
            best["used"] = True
            tp += 1
            matched.append((p, best))
        else:
            fp += 1
            fp_list.append(p)
    fn_list = [g for seg in by_seg_gt.values() for g in seg if not g.get("used")]
    fn = len(fn_list)
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return {"tp": tp, "fp": fp, "fn": fn, "precision": precision,
            "recall": recall, "f1": f1, "fp_list": fp_list, "fn_list": fn_list}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--gt", required=True)
    ap.add_argument("--tolerance", type=float, default=3.0)
    ap.add_argument("--strict-class", action="store_true")
    args = ap.parse_args()

    gt = load_gt(args.gt)
    conn = dbmod.connect()
    preds = load_predictions(conn)
    segments = sorted({g["segment"] for g in gt})
    preds = [p for p in preds if p["segment"] in segments]  # eval only labeled segments

    print(f"ground truth: {len(gt)} events in {len(segments)} segments; predictions: {len(preds)}")
    overall = evaluate(gt, preds, args.tolerance, args.strict_class)
    print(f"\nOVERALL  P={overall['precision']:.2f} R={overall['recall']:.2f} F1={overall['f1']:.2f} "
          f"(tp={overall['tp']} fp={overall['fp']} fn={overall['fn']})")

    for seg in segments:
        seg_gt = [g for g in gt if g["segment"] == seg]
        seg_pr = [p for p in preds if p["segment"] == seg]
        r = evaluate(seg_gt, seg_pr, args.tolerance, args.strict_class)
        print(f"  {seg:14s} P={r['precision']:.2f} R={r['recall']:.2f} F1={r['f1']:.2f} "
              f"(tp={r['tp']} fp={r['fp']} fn={r['fn']})")

    if overall["fp_list"]:
        print("\nfalse positives:")
        for p in overall["fp_list"]:
            print(f"  {p['segment']} t={p['t']:.1f} {p['cls']}")
    if overall["fn_list"]:
        print("missed (fn):")
        for g in overall["fn_list"]:
            print(f"  {g['segment']} t={g['t']:.1f} {g['cls']}")


if __name__ == "__main__":
    main()
