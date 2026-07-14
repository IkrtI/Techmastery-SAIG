from pathlib import Path
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from pydantic import BaseModel

router = APIRouter()

REPO_ROOT = Path(__file__).resolve().parents[3]
JOBS = {}  # job_id -> {"status": ..., "detail": ...}


class JobRequest(BaseModel):
    video: str          # absolute path or path under dataset/
    site: str           # site config name, e.g. "kmitl"
    max_seconds: Optional[float] = None


def _run_job(job_id: str, video_path: Path, site_cfg_path: Path, max_seconds, db_conn):
    from ..pipeline.config import load_site_config
    from ..pipeline.processor import process

    try:
        JOBS[job_id]["status"] = "running"
        cfg = load_site_config(site_cfg_path)
        video_id, n_events, _stats = process(video_path, cfg, conn=db_conn, max_seconds=max_seconds)
        JOBS[job_id].update(status="done", video_id=video_id, events=n_events)
    except Exception as e:  # surfaced via GET /jobs/{id}
        JOBS[job_id].update(status="error", detail=str(e))


@router.post("/jobs")
def create_job(req: JobRequest, background: BackgroundTasks, request: Request):
    video_path = Path(req.video)
    if not video_path.is_absolute():
        video_path = REPO_ROOT / req.video
    if not video_path.exists():
        raise HTTPException(400, f"video not found: {video_path}")
    site_cfg = REPO_ROOT / "backend" / "configs" / "sites" / f"{req.site}.json"
    if not site_cfg.exists():
        raise HTTPException(400, f"unknown site: {req.site}")
    job_id = f"job_{len(JOBS) + 1}"
    JOBS[job_id] = {"status": "queued", "video": str(video_path), "site": req.site}
    background.add_task(_run_job, job_id, video_path, site_cfg, req.max_seconds,
                        request.app.state.db)
    return {"job_id": job_id, **JOBS[job_id]}


@router.get("/jobs/{job_id}")
def get_job(job_id: str):
    if job_id not in JOBS:
        raise HTTPException(404, "job not found")
    return {"job_id": job_id, **JOBS[job_id]}
