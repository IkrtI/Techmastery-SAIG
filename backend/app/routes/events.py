import json

from fastapi import APIRouter, HTTPException, Request

from .. import db as dbmod
from ..rag.report import generate_report

router = APIRouter()


def _get_rag(request: Request):
    """Lazy-load the vector store + LLM client once per process."""
    app = request.app
    if app.state.rag_store is None:
        from pathlib import Path

        from ..rag.store import VectorStore
        store_dir = Path(__file__).resolve().parents[3] / "data" / "rag_store"
        if not store_dir.exists():
            raise HTTPException(503, "RAG store not built — run scripts/ingest_law.py")
        app.state.rag_store = VectorStore.load(store_dir)
    if app.state.llm is None:
        from ..rag.llm import LLMClient
        app.state.llm = LLMClient()
    return app.state.rag_store, app.state.llm


@router.get("/events")
def list_events(request: Request, site_id: str = None, cls: str = None):
    events = dbmod.list_events(request.app.state.db, site_id=site_id, cls=cls)
    for e in events:
        e["report"] = json.loads(e["report_json"]) if e["report_json"] else None
        del e["report_json"]
    return events


@router.get("/events/{event_id}")
def get_event(request: Request, event_id: int):
    ev = dbmod.get_event(request.app.state.db, event_id)
    if not ev:
        raise HTTPException(404, "event not found")
    ev["report"] = json.loads(ev["report_json"]) if ev["report_json"] else None
    del ev["report_json"]
    return ev


@router.get("/events/{event_id}/report")
def get_report(request: Request, event_id: int, force: bool = False):
    conn = request.app.state.db
    ev = dbmod.get_event(conn, event_id)
    if not ev:
        raise HTTPException(404, "event not found")
    if ev["report_json"] and not force:
        return json.loads(ev["report_json"])
    store, llm = _get_rag(request)
    report = generate_report(ev, store, llm)
    dbmod.set_report(conn, event_id, report)
    return report


@router.get("/videos")
def list_videos(request: Request):
    return dbmod.list_videos(request.app.state.db)
