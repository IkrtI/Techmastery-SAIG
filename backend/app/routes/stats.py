from fastapi import APIRouter, Request

from .. import db as dbmod
from ..stats.accidents import compute_stats

router = APIRouter()


@router.get("/stats")
def stats(request: Request):
    conn = request.app.state.db
    events = dbmod.list_events(conn)
    by_cls, by_site = {}, {}
    for e in events:
        by_cls[e["cls"]] = by_cls.get(e["cls"], 0) + 1
        by_site[e["site_id"]] = by_site.get(e["site_id"], 0) + 1
    try:
        accidents = compute_stats()
    except FileNotFoundError:
        accidents = None
    return {
        "violations": {
            "total": len(events),
            "by_class": [{"name": k, "count": v} for k, v in sorted(by_cls.items(), key=lambda x: -x[1])],
            "by_site": [{"name": k, "count": v} for k, v in sorted(by_site.items(), key=lambda x: -x[1])],
        },
        "accidents": accidents,
    }
