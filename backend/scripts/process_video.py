"""CLI: process one video with a site config.

Usage:
    .venv/bin/python scripts/process_video.py --video <path> --site configs/sites/kmitl.json [--max-seconds 60] [--no-render]
"""
import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.pipeline.config import load_site_config
from app.pipeline.processor import process


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", required=True)
    ap.add_argument("--site", required=True)
    ap.add_argument("--max-seconds", type=float, default=None)
    ap.add_argument("--no-render", action="store_true")
    ap.add_argument("--debug-dir", default=None)
    args = ap.parse_args()

    cfg = load_site_config(args.site)
    t0 = time.time()

    def progress(i, total):
        pct = 100.0 * i / max(total, 1)
        rate = i / max(time.time() - t0, 1e-6)
        print(f"  frame {i}/{total} ({pct:.1f}%) {rate:.1f} fps", flush=True)

    video_id, n_events, stats = process(
        args.video, cfg, render=not args.no_render,
        max_seconds=args.max_seconds, progress_cb=progress,
        debug_dir=args.debug_dir,
    )
    print(f"done video_id={video_id} events={n_events} elapsed={time.time()-t0:.0f}s")
    print(f"stats: {stats}")


if __name__ == "__main__":
    main()
