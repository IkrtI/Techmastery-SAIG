"""RailGuard AI — FastAPI application."""
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

REPO_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(REPO_ROOT / ".env")

from . import db as dbmod                      # noqa: E402
from .routes import chat, events, jobs, stats  # noqa: E402

ARTIFACTS_DIR = Path(os.environ.get("RAILGUARD_ARTIFACTS", REPO_ROOT / "data" / "artifacts"))
ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)


def create_app() -> FastAPI:
    app = FastAPI(title="RailGuard AI")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.state.db = dbmod.connect()
    app.state.rag_store = None   # lazy-loaded on first use
    app.state.llm = None
    app.include_router(events.router, prefix="/api")
    app.include_router(jobs.router, prefix="/api")
    app.include_router(chat.router, prefix="/api")
    app.include_router(stats.router, prefix="/api")
    app.mount("/artifacts", StaticFiles(directory=ARTIFACTS_DIR), name="artifacts")

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    return app


app = create_app()
