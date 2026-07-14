"""SQLite persistence for videos, jobs and violation events."""
import json
import os
import sqlite3
from pathlib import Path

DEFAULT_DB = Path(os.environ.get(
    "RAILGUARD_DB",
    Path(__file__).resolve().parents[2] / "data" / "railguard.db",
))

SCHEMA = """
CREATE TABLE IF NOT EXISTS videos(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_id TEXT NOT NULL,
    segment TEXT DEFAULT '',
    file TEXT NOT NULL,
    processed_at TEXT,
    frames INTEGER,
    fps REAL,
    status TEXT DEFAULT 'pending',
    overlay TEXT
);
CREATE TABLE IF NOT EXISTS events(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id INTEGER REFERENCES videos(id),
    site_id TEXT NOT NULL,
    track_id INTEGER,
    cls TEXT,
    frame INTEGER,
    ts_sec REAL,
    state TEXT,
    snapshot TEXT,
    clip TEXT,
    report_json TEXT
);
"""


def connect(db_path=None) -> sqlite3.Connection:
    path = Path(db_path or DEFAULT_DB)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    return conn


def insert_video(conn, site_id, file, fps=None, frames=None, status="processing", segment=""):
    cur = conn.execute(
        "INSERT INTO videos(site_id, segment, file, fps, frames, status) VALUES (?,?,?,?,?,?)",
        (site_id, segment, file, fps, frames, status),
    )
    conn.commit()
    return cur.lastrowid


def finish_video(conn, video_id, frames, overlay=None, status="done"):
    conn.execute(
        "UPDATE videos SET frames=?, status=?, overlay=?, processed_at=datetime('now') WHERE id=?",
        (frames, status, overlay, video_id),
    )
    conn.commit()


def insert_event(conn, video_id, site_id, track_id, cls, frame, ts_sec, state, snapshot=None, clip=None):
    cur = conn.execute(
        "INSERT INTO events(video_id, site_id, track_id, cls, frame, ts_sec, state, snapshot, clip)"
        " VALUES (?,?,?,?,?,?,?,?,?)",
        (video_id, site_id, track_id, cls, frame, ts_sec, state, snapshot, clip),
    )
    conn.commit()
    return cur.lastrowid


def list_events(conn, site_id=None, cls=None):
    q = "SELECT * FROM events"
    cond, args = [], []
    if site_id:
        cond.append("site_id=?"); args.append(site_id)
    if cls:
        cond.append("cls=?"); args.append(cls)
    if cond:
        q += " WHERE " + " AND ".join(cond)
    q += " ORDER BY id DESC"
    return [dict(r) for r in conn.execute(q, args).fetchall()]


def get_event(conn, event_id):
    row = conn.execute("SELECT * FROM events WHERE id=?", (event_id,)).fetchone()
    return dict(row) if row else None


def set_report(conn, event_id, report: dict):
    conn.execute(
        "UPDATE events SET report_json=? WHERE id=?",
        (json.dumps(report, ensure_ascii=False), event_id),
    )
    conn.commit()


def list_videos(conn):
    return [dict(r) for r in conn.execute("SELECT * FROM videos ORDER BY id DESC").fetchall()]
