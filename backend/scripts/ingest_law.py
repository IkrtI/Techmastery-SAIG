"""CLI: build the law RAG store from the traffic-law PDF.

Usage:
    .venv/bin/python scripts/ingest_law.py [--pdf path] [--out data/rag_store] [--preview]
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_PDF = REPO_ROOT / "dataset" / "3_คู่มือกฎหมายจราจรไทย" / "กฏหมายจราจร.pdf"
DEFAULT_OUT = REPO_ROOT / "data" / "rag_store"


def main():
    from app.rag.ingest import extract_pdf_text, chunk_law_text
    from app.rag.store import VectorStore

    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", default=str(DEFAULT_PDF))
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    ap.add_argument("--preview", action="store_true", help="print chunks, no embedding")
    args = ap.parse_args()

    text = extract_pdf_text(args.pdf)
    print(f"extracted {len(text)} chars")
    print("--- first 500 chars ---")
    print(text[:500])
    chunks = chunk_law_text(text)
    print(f"--- {len(chunks)} chunks ---")
    for c in chunks[:5]:
        print(f"[{c.section or 'no-section'}] {c.text[:120]}...")
    if args.preview:
        return

    store = VectorStore()
    store.add([c.text for c in chunks], metas=[{"section": c.section} for c in chunks])
    store.save(args.out)
    print(f"saved store to {args.out}")

    for q in ["ฝ่าเครื่องกั้นทางรถไฟ โทษเท่าไหร่", "จอดรถใกล้ทางรถไฟได้ไหม"]:
        hits = store.search(q, k=2)
        print(f"\nQ: {q}")
        for h in hits:
            print(f"  [{h.get('section', '')}] score={h['score']:.3f} {h['text'][:100]}")


if __name__ == "__main__":
    main()
