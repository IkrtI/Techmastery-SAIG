"""Scan a video for camera-stable stretches via downscaled frame differencing.

Usage:
    .venv39/bin/python scripts/scan_stability.py --video <path> [--step 2] [--thresh 8.0]

Prints per-sample motion score and contiguous stable windows.
Camera motion moves the whole frame → high mean abs diff; traffic alone
only perturbs part of the frame → lower score.
"""
import argparse
import sys

import cv2
import numpy as np


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", required=True)
    ap.add_argument("--step", type=float, default=2.0, help="seconds between samples")
    ap.add_argument("--thresh", type=float, default=8.0, help="stable if score below")
    ap.add_argument("--min-window", type=float, default=45.0, help="min stable window seconds")
    args = ap.parse_args()

    cap = cv2.VideoCapture(args.video)
    if not cap.isOpened():
        sys.exit("cannot open video")
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total / fps

    prev = None
    scores = []  # (t, score)
    t = 0.0
    while t < duration:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(t * fps))
        ok, frame = cap.read()
        if not ok:
            break
        small = cv2.cvtColor(cv2.resize(frame, (160, 90)), cv2.COLOR_BGR2GRAY).astype(np.float32)
        if prev is not None:
            scores.append((t, float(np.abs(small - prev).mean())))
        prev = small
        t += args.step
    cap.release()

    windows = []
    start = None
    for t, s in scores:
        if s < args.thresh:
            if start is None:
                start = t
        else:
            if start is not None and t - start >= args.min_window:
                windows.append((start, t))
            start = None
    if start is not None and scores and scores[-1][0] - start >= args.min_window:
        windows.append((start, scores[-1][0]))

    print(f"duration={duration:.0f}s samples={len(scores)}")
    print("motion timeline (t: score):")
    line = []
    for t, s in scores:
        line.append(f"{int(t)}:{s:.0f}")
        if len(line) == 15:
            print("  " + " ".join(line))
            line = []
    if line:
        print("  " + " ".join(line))
    print("stable windows (>= %.0fs, score < %.1f):" % (args.min_window, args.thresh))
    for a, b in windows:
        print(f"  {a:.0f} - {b:.0f}  ({b-a:.0f}s)")


if __name__ == "__main__":
    main()
