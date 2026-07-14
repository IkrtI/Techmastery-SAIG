"""Generate AI reports for events that lack one, with rate-limit pacing.

Usage:
    .venv39/bin/python scripts/gen_reports.py [--limit 20] [--sleep 8]
"""
import argparse
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(REPO_ROOT / ".env")

from app import db as dbmod  # noqa: E402
from app.rag.llm import LLMClient  # noqa: E402
from app.rag.report import generate_report  # noqa: E402
from app.rag.store import VectorStore  # noqa: E402

SITE_NAMES = {
    "kmitl": "ทางตัดรถไฟหน้า สจล. ลาดกระบัง",
    "asok": "ทางตัดรถไฟอโศก",
    "donmueang": "ทางตัดรถไฟดอนเมือง",
    "ram": "ทางตัดรถไฟถนนรามคำแหง",
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=100)
    ap.add_argument("--sleep", type=float, default=8.0)
    args = ap.parse_args()

    conn = dbmod.connect()
    store = VectorStore.load(REPO_ROOT / "data" / "rag_store")
    llm = LLMClient()

    rows = conn.execute(
        "SELECT * FROM events WHERE report_json IS NULL ORDER BY id LIMIT ?",
        (args.limit,)).fetchall()
    print(f"{len(rows)} events need reports")
    ok = fail = 0
    for r in rows:
        ev = dict(r)
        try:
            report = generate_report(ev, store, llm, site_name=SITE_NAMES.get(ev["site_id"]))
            dbmod.set_report(conn, ev["id"], report)
            ok += 1
            print(f"  #{ev['id']} ok: {report['summary'][:60]}...")
        except Exception as e:
            fail += 1
            print(f"  #{ev['id']} FAIL: {e}")
        time.sleep(args.sleep)
    print(f"done ok={ok} fail={fail}")


if __name__ == "__main__":
    main()
