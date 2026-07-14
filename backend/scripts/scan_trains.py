"""Coarse scan: when does a train (or train-like wide vehicle) appear?

Usage:
    .venv39/bin/python scripts/scan_trains.py --video <path> [--step 3]

Prints timestamps with train-evidence detections (COCO train class, or
truck/bus wider than --min-width px).
"""
import argparse
import sys
from pathlib import Path

import cv2

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.pipeline.detector import COCO_CLASSES  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", required=True)
    ap.add_argument("--step", type=float, default=3.0)
    ap.add_argument("--min-width", type=int, default=380)
    ap.add_argument("--conf", type=float, default=0.35)
    ap.add_argument("--out", default=None, help="also write report to this file")
    args = ap.parse_args()

    from ultralytics import YOLO
    import torch
    model = YOLO("yolo11s.pt")
    device = "mps" if torch.backends.mps.is_available() else "cpu"

    cap = cv2.VideoCapture(args.video)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    duration = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) / fps

    hits = []
    t = 0.0
    while t < duration:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(t * fps))
        ok, frame = cap.read()
        if not ok:
            break
        res = model.predict(frame, classes=[5, 6, 7], conf=args.conf,
                            device=device, verbose=False)
        evidence = []
        for b in res[0].boxes:
            cls = COCO_CLASSES.get(int(b.cls.item()), "?")
            x1, _, x2, _ = b.xyxy[0].tolist()
            w = x2 - x1
            if cls == "train" or w >= args.min_width:
                evidence.append(f"{cls}:{w:.0f}px@{float(b.conf.item()):.2f}")
        if evidence:
            hits.append((t, evidence))
        t += args.step
    cap.release()

    # merge into windows
    windows = []
    for t, ev in hits:
        if windows and t - windows[-1][1] <= args.step * 2:
            windows[-1][1] = t
            windows[-1][2].extend(ev)
        else:
            windows.append([t, t, list(ev)])
    lines = [f"train-evidence windows ({len(windows)}):"]
    for a, b, ev in windows:
        kinds = {}
        for e in ev:
            kinds[e.split(":")[0]] = kinds.get(e.split(":")[0], 0) + 1
        lines.append(f"  {a:.0f}-{b:.0f}s ({b-a:.0f}s) {kinds}")
    report = "\n".join(lines)
    print(report)
    if args.out:
        Path(args.out).write_text(report + "\n")


if __name__ == "__main__":
    main()
