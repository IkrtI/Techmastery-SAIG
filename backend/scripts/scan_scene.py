"""Report which parts of a video match a reference viewpoint.

Usage:
    .venv39/bin/python scripts/scan_scene.py --video <path> --ref-time 450 [--step 4] [--thresh 0.7]
"""
import argparse
import sys
from pathlib import Path

import cv2

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.pipeline.scene_match import SceneMatcher, grab_frame  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", required=True)
    ap.add_argument("--ref-time", type=float, required=True)
    ap.add_argument("--step", type=float, default=4.0)
    ap.add_argument("--thresh", type=float, default=0.7)
    ap.add_argument("--band", type=float, default=0.3)
    args = ap.parse_args()

    matcher = SceneMatcher(grab_frame(args.video, args.ref_time), band=args.band)
    cap = cv2.VideoCapture(args.video)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    duration = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) / fps

    accepted = 0
    total = 0
    windows = []
    start = None
    t = 0.0
    while t < duration:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(t * fps))
        ok, frame = cap.read()
        if not ok:
            break
        s = matcher.score(frame)
        total += 1
        if s >= args.thresh:
            accepted += 1
            if start is None:
                start = t
        else:
            if start is not None:
                windows.append((start, t))
                start = None
        t += args.step
    if start is not None:
        windows.append((start, t))
    cap.release()

    print(f"accepted {accepted}/{total} samples ({100.0*accepted/max(total,1):.0f}%)")
    for a, b in windows:
        if b - a >= args.step * 2:
            print(f"  window {a:.0f}-{b:.0f}s ({b-a:.0f}s)")


if __name__ == "__main__":
    main()
