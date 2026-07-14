"""Render a site config's ROI over frames for visual validation (no YOLO).

Usage:
    .venv39/bin/python scripts/render_roi.py --site configs/sites/x.json --video <path> --times 300 350 400 --out-dir /tmp/roi
"""
import argparse
import sys
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.pipeline.config import load_site_config  # noqa: E402
from app.pipeline.scene_match import grab_frame  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", required=True)
    ap.add_argument("--video", required=True)
    ap.add_argument("--times", nargs="+", type=float, required=True)
    ap.add_argument("--out-dir", required=True)
    args = ap.parse_args()

    cfg = load_site_config(args.site)
    out = Path(args.out_dir)
    out.mkdir(parents=True, exist_ok=True)
    for t in args.times:
        frame = grab_frame(args.video, t)
        zone = np.array(cfg.danger_zone, dtype=np.int32)
        tint = frame.copy()
        cv2.fillPoly(tint, [zone], (0, 0, 255))
        frame = cv2.addWeighted(tint, 0.25, frame, 0.75, 0)
        cv2.polylines(frame, [zone], True, (0, 0, 255), 2)
        p1, p2 = cfg.stop_line
        cv2.line(frame, tuple(map(int, p1)), tuple(map(int, p2)), (255, 255, 255), 3)
        name = f"roi_{Path(args.site).stem}_{int(t)}.jpg"
        cv2.imwrite(str(out / name), frame)
        print(out / name)


if __name__ == "__main__":
    main()
