"""Process every site config sequentially; prints per-segment summary.

Usage:
    .venv39/bin/python scripts/batch_process.py [--configs-dir configs/sites] [--fresh]
"""
import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import db as dbmod  # noqa: E402
from app.pipeline.config import load_site_config  # noqa: E402
from app.pipeline.detector import Detector  # noqa: E402
from app.pipeline.processor import process  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parents[2]
VIDEO_DIR = REPO_ROOT / "dataset" / "4_วิดีโอการจราจรติดทางรถไฟ"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--configs-dir", default=str(Path(__file__).resolve().parents[1] / "configs" / "sites"))
    ap.add_argument("--fresh", action="store_true", help="delete DB + artifacts first")
    ap.add_argument("--only", nargs="*", default=None, help="config stems to run")
    args = ap.parse_args()

    if args.fresh:
        db_path = REPO_ROOT / "data" / "railguard.db"
        db_path.unlink(missing_ok=True)
        import shutil
        shutil.rmtree(REPO_ROOT / "data" / "artifacts", ignore_errors=True)

    conn = dbmod.connect()
    detector = Detector()
    results = []
    for cfg_path in sorted(Path(args.configs_dir).glob("*.json")):
        if args.only and cfg_path.stem not in args.only:
            continue
        cfg = load_site_config(cfg_path)
        video = VIDEO_DIR / cfg.video_file
        t0 = time.time()
        try:
            detector.model.predictor = None  # reset tracker state between segments
            video_id, n_events, stats = process(video, cfg, conn=conn, detector=detector)
            results.append((cfg_path.stem, n_events, stats, time.time() - t0))
            print(f"[done] {cfg_path.stem}: events={n_events} "
                  f"accepted={stats['accepted']} restricted={stats['restricted']} "
                  f"train={stats['train_frames']} states={stats['states']} "
                  f"({time.time()-t0:.0f}s)", flush=True)
        except Exception as e:
            print(f"[fail] {cfg_path.stem}: {e}", flush=True)

    print("\nsummary:")
    for stem, n, stats, dt in results:
        print(f"  {stem:16s} events={n:3d} restricted={stats['restricted']:4d} train={stats['train_frames']:4d}")


if __name__ == "__main__":
    main()
