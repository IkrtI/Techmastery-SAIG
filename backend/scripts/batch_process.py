"""Process every site config, one isolated subprocess per segment.

In-process sequential runs showed order-dependent detection degradation
(MPS memory pressure across segments), so each segment gets a fresh python.

Usage:
    .venv39/bin/python scripts/batch_process.py [--fresh] [--only stem ...]
"""
import argparse
import shutil
import subprocess
import sys
import time
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND.parent
VIDEO_DIR = REPO_ROOT / "dataset" / "4_วิดีโอการจราจรติดทางรถไฟ"
PYTHON = BACKEND / ".venv39" / "bin" / "python"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--configs-dir", default=str(BACKEND / "configs" / "sites"))
    ap.add_argument("--fresh", action="store_true", help="delete DB + artifacts first")
    ap.add_argument("--only", nargs="*", default=None, help="config stems to run")
    args = ap.parse_args()

    if args.fresh:
        (REPO_ROOT / "data" / "railguard.db").unlink(missing_ok=True)
        shutil.rmtree(REPO_ROOT / "data" / "artifacts", ignore_errors=True)

    import json
    results = []
    for cfg_path in sorted(Path(args.configs_dir).glob("*.json")):
        if args.only and cfg_path.stem not in args.only:
            continue
        video = VIDEO_DIR / json.loads(cfg_path.read_text())["video_file"]
        t0 = time.time()
        proc = subprocess.run(
            [str(PYTHON), str(BACKEND / "scripts" / "process_video.py"),
             "--video", str(video), "--site", str(cfg_path)],
            capture_output=True, text=True, cwd=BACKEND,
        )
        tail = (proc.stdout or "").strip().splitlines()[-2:]
        status = "done" if proc.returncode == 0 else "FAIL"
        print(f"[{status}] {cfg_path.stem} ({time.time()-t0:.0f}s)", flush=True)
        for line in tail:
            print(f"    {line}", flush=True)
        if proc.returncode != 0:
            print(f"    stderr: {(proc.stderr or '').strip().splitlines()[-1:]}", flush=True)
        results.append((cfg_path.stem, status))

    print("\nsummary:", ", ".join(f"{s}={st}" for s, st in results), flush=True)


if __name__ == "__main__":
    main()
