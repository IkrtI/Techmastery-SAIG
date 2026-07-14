"""Interactive ROI author: click stop line (2 pts) then danger zone (n pts).

Usage:
    .venv/bin/python scripts/draw_roi.py --video <path> --t 300 --site-id kmitl --name "..." --out configs/sites/kmitl.json

Keys: left-click = add point, u = undo, Enter = next stage / save, q = abort.
Requires a desktop session (cv2.imshow).
"""
import argparse
import sys
from pathlib import Path

import cv2

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.pipeline.config import SiteConfig  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", required=True)
    ap.add_argument("--t", type=float, default=0, help="timestamp (s) of reference frame")
    ap.add_argument("--site-id", required=True)
    ap.add_argument("--name", default="")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    cap = cv2.VideoCapture(args.video)
    cap.set(cv2.CAP_PROP_POS_MSEC, args.t * 1000)
    ok, frame = cap.read()
    cap.release()
    if not ok:
        sys.exit("cannot read frame")

    stages = {"stop_line": [], "danger_zone": []}
    stage = "stop_line"
    points = stages[stage]

    def on_mouse(event, x, y, flags, param):
        if event == cv2.EVENT_LBUTTONDOWN:
            points.append([x, y])

    cv2.namedWindow("roi")
    cv2.setMouseCallback("roi", on_mouse)
    while True:
        vis = frame.copy()
        for label, pts in stages.items():
            for p in pts:
                cv2.circle(vis, tuple(p), 4, (0, 0, 255), -1)
            if len(pts) > 1:
                for a, b in zip(pts, pts[1:]):
                    cv2.line(vis, tuple(a), tuple(b), (0, 255, 255), 2)
        cv2.putText(vis, f"stage: {stage} ({len(points)} pts) — Enter=next, u=undo, q=quit",
                    (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        cv2.imshow("roi", vis)
        key = cv2.waitKey(30) & 0xFF
        if key == ord("q"):
            sys.exit("aborted")
        if key == ord("u") and points:
            points.pop()
        if key == 13:  # Enter
            if stage == "stop_line":
                if len(points) != 2:
                    continue
                stage = "danger_zone"
                points = stages[stage]
            else:
                if len(points) < 3:
                    continue
                break
    cv2.destroyAllWindows()

    cfg = SiteConfig(
        site_id=args.site_id,
        name=args.name or args.site_id,
        video_file=Path(args.video).name,
        stop_line=stages["stop_line"],
        danger_zone=stages["danger_zone"],
    )
    cfg.save(args.out)
    print(f"saved {args.out}")


if __name__ == "__main__":
    main()
