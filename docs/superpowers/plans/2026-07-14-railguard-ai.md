# RailGuard AI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect rail-crossing violations from footage, generate Thai incident reports citing traffic-law sections via RAG, and demo it all in a web dashboard.

**Architecture:** Offline CV pipeline (YOLO11 pretrained + ByteTrack + per-site ROI + crossing state machine) writes violation events/artifacts to SQLite; a RAG layer (PDF → มาตรา chunks → multilingual embeddings → numpy vector store) plus OpenRouter LLM turns events into legally-cited reports; FastAPI serves events/stats/chat; Next.js renders the dashboard.

**Tech Stack:** Python 3.11+ (venv), ultralytics YOLO11, supervision, OpenCV, PyMuPDF, sentence-transformers (bge-m3 or MiniLM fallback), OpenAI SDK → OpenRouter, FastAPI, pytest; Next.js 15 + Tailwind + recharts.

**Deviation from spec:** ChromaDB replaced by a numpy cosine store persisted to disk (law corpus is a few hundred chunks — a vector DB is YAGNI).

**Working dir:** repo root `/Users/krit/Desktop/Techmastery-SAIG`. Backend commands run from `backend/` with `.venv` активated (or `./.venv/bin/python`).

---

## File Structure

```
backend/
  requirements.txt
  app/
    __init__.py
    main.py                 # FastAPI app, CORS, static /artifacts
    db.py                   # sqlite3 helpers + schema
    routes/{jobs,events,chat,stats}.py
    pipeline/
      geometry.py           # segment-crossing math
      config.py             # SiteConfig load/save (JSON)
      state_machine.py      # CrossingStateMachine
      detector.py           # YOLO wrapper (MPS/CPU, per-class conf)
      violations.py         # ViolationDetector (tracks × state × line)
      processor.py          # VideoProcessor: decode→track→SM→events→overlay mp4
    rag/
      ingest.py             # PDF → chunks → embeddings → store
      store.py              # numpy vector store (npz + jsonl)
      llm.py                # OpenRouter client w/ model fallback
      report.py             # violation → Thai report w/ citations
    stats/accidents.py      # dataset-1 aggregates (cached json)
  configs/sites/*.json      # per-video ROI configs
  scripts/
    draw_roi.py             # author site config from a frame
    process_video.py        # CLI: run pipeline on a file
    ingest_law.py           # CLI: build RAG store
  tests/
    test_geometry.py  test_state_machine.py  test_violations.py
    test_chunking.py  test_store.py  test_api.py
frontend/                   # Next.js app router
notebooks/eval.ipynb  notebooks/eda_accidents.ipynb
data/                       # gitignored: artifacts/, rag_store/, railguard.db, stats_cache/
```

---

### Task 1: Backend scaffold + env

**Files:** Create `backend/requirements.txt`, `backend/app/__init__.py`, empty package dirs.

- [ ] **Step 1:** Create venv with Python ≥3.11 (`python3.11`/`python3.12` if present; else `brew install python@3.12`). `cd backend && python3.12 -m venv .venv`
- [ ] **Step 2:** `requirements.txt`:

```
ultralytics>=8.3
supervision>=0.25
opencv-python-headless>=4.10
pymupdf>=1.24
sentence-transformers>=3.0
fastapi>=0.115
uvicorn[standard]>=0.32
openai>=1.50
pandas>=2.2
python-dotenv>=1.0
pytest>=8.0
httpx>=0.27
```

- [ ] **Step 3:** `./.venv/bin/pip install -r requirements.txt` (torch arrives via ultralytics). Verify: `./.venv/bin/python -c "import torch; print(torch.backends.mps.is_available())"` → `True`.
- [ ] **Step 4:** `.env` at repo root with `OPENROUTER_API_KEY=...` (already gitignored). Commit scaffold.

### Task 2: Geometry — segment crossing

**Files:** Create `backend/app/pipeline/geometry.py`, `backend/tests/test_geometry.py`.

- [ ] **Step 1:** Failing tests:

```python
from app.pipeline.geometry import segments_intersect, side_of_line

def test_crossing_segments_intersect():
    assert segments_intersect((0, 0), (10, 10), (0, 10), (10, 0))

def test_parallel_segments_do_not_intersect():
    assert not segments_intersect((0, 0), (10, 0), (0, 1), (10, 1))

def test_side_of_line_sign_flips_across_line():
    a, b = (0, 0), (10, 0)
    assert side_of_line((5, 5), a, b) > 0
    assert side_of_line((5, -5), a, b) < 0
```

- [ ] **Step 2:** Run `./.venv/bin/pytest tests/test_geometry.py -v` → FAIL (module missing).
- [ ] **Step 3:** Implement with cross-product orientation test:

```python
def side_of_line(p, a, b):
    return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])

def segments_intersect(p1, p2, q1, q2):
    d1 = side_of_line(q1, p1, p2)
    d2 = side_of_line(q2, p1, p2)
    d3 = side_of_line(p1, q1, q2)
    d4 = side_of_line(p2, q1, q2)
    return ((d1 > 0) != (d2 > 0)) and ((d3 > 0) != (d4 > 0))
```

- [ ] **Step 4:** Tests pass → commit `feat: line-crossing geometry`.

### Task 3: Site config

**Files:** Create `backend/app/pipeline/config.py`, `backend/configs/sites/` (populated in Task 8).

- [ ] **Step 1:** Dataclass + JSON loader (no test beyond round-trip in test_violations):

```python
@dataclass
class SiteConfig:
    site_id: str; name: str; video_file: str
    stop_line: list          # [[x1,y1],[x2,y2]]
    danger_zone: list        # polygon [[x,y],...]
    frame_stride: int = 2
    train_conf: float = 0.35
    vehicle_conf: float = 0.4
    warning_frames: int = 8   # N consecutive train frames → WARNING
    clear_frames: int = 45    # N frames w/o train → IDLE
```

`load_site_config(path) -> SiteConfig`, `SiteConfig.save(path)`.
- [ ] **Step 2:** Commit `feat: site config`.

### Task 4: Crossing state machine (TDD)

**Files:** Create `backend/app/pipeline/state_machine.py`, `backend/tests/test_state_machine.py`.

- [ ] **Step 1:** Failing tests covering hysteresis:

```python
from app.pipeline.state_machine import CrossingStateMachine, State

def make_sm():
    return CrossingStateMachine(warning_frames=3, clear_frames=5)

def test_starts_idle():
    assert make_sm().state == State.IDLE

def test_warning_needs_consecutive_train_frames():
    sm = make_sm()
    sm.update(train_present=True); sm.update(train_present=False)
    sm.update(train_present=True); sm.update(train_present=True)
    assert sm.state == State.IDLE          # streak broken, only 2 consecutive
    sm.update(train_present=True)
    assert sm.state == State.WARNING       # 3 consecutive

def test_active_when_train_in_zone():
    sm = make_sm()
    for _ in range(3): sm.update(train_present=True)
    sm.update(train_present=True, train_in_zone=True)
    assert sm.state == State.ACTIVE

def test_clears_back_to_idle_after_clear_frames():
    sm = make_sm()
    for _ in range(3): sm.update(train_present=True)
    for _ in range(5): sm.update(train_present=False)
    assert sm.state == State.IDLE

def test_is_restricted_during_warning_and_active():
    sm = make_sm()
    for _ in range(3): sm.update(train_present=True)
    assert sm.is_restricted
```

- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement:

```python
class State(Enum):
    IDLE = "idle"; WARNING = "warning"; ACTIVE = "active"

class CrossingStateMachine:
    def __init__(self, warning_frames=8, clear_frames=45):
        self.warning_frames, self.clear_frames = warning_frames, clear_frames
        self.state = State.IDLE
        self._train_streak = 0; self._absent_streak = 0

    @property
    def is_restricted(self):
        return self.state in (State.WARNING, State.ACTIVE)

    def update(self, train_present: bool, train_in_zone: bool = False):
        if train_present:
            self._train_streak += 1; self._absent_streak = 0
        else:
            self._absent_streak += 1; self._train_streak = 0
        if self.state == State.IDLE and self._train_streak >= self.warning_frames:
            self.state = State.WARNING
        if self.state == State.WARNING and train_in_zone:
            self.state = State.ACTIVE
        if self.state != State.IDLE and self._absent_streak >= self.clear_frames:
            self.state = State.IDLE
        return self.state
```

- [ ] **Step 4:** Pass → commit `feat: crossing state machine`.

### Task 5: Violation detector (TDD, synthetic tracks — no YOLO needed)

**Files:** Create `backend/app/pipeline/violations.py`, `backend/tests/test_violations.py`.

- [ ] **Step 1:** Failing tests: feed synthetic per-frame track positions; expect one violation when a track's bottom-center crosses stop line while `is_restricted`, none when state idle, and no duplicate for same track:

```python
from app.pipeline.violations import ViolationDetector

STOP = [[0, 100], [200, 100]]

def test_violation_when_crossing_during_restricted():
    vd = ViolationDetector(stop_line=STOP)
    vd.observe(track_id=1, cls="motorcycle", point=(50, 120), frame=1, restricted=True)
    events = vd.observe(track_id=1, cls="motorcycle", point=(50, 80), frame=2, restricted=True)
    assert len(events) == 1 and events[0].track_id == 1

def test_no_violation_when_idle():
    vd = ViolationDetector(stop_line=STOP)
    vd.observe(1, "car", (50, 120), 1, False)
    assert vd.observe(1, "car", (50, 80), 2, False) == []

def test_track_flagged_once():
    vd = ViolationDetector(stop_line=STOP)
    vd.observe(1, "car", (50, 120), 1, True)
    vd.observe(1, "car", (50, 80), 2, True)
    assert vd.observe(1, "car", (50, 60), 3, True) == []
```

- [ ] **Step 2:** FAIL. **Step 3:** Implement — keep last point per track, on update check `segments_intersect(prev, curr, stop_line)`; emit `Violation(track_id, cls, frame)` once per track id per restricted episode. **Step 4:** Pass → commit `feat: violation detector`.

### Task 6: YOLO detector wrapper

**Files:** Create `backend/app/pipeline/detector.py`.

- [ ] **Step 1:** Wrapper: loads `yolo11s.pt` (env `RAILGUARD_MODEL` override), device `mps` if available else `cpu`, `model.track(frame, persist=True, tracker="bytetrack.yaml", classes=[0,1,2,3,5,6,7], verbose=False)`; returns list of `(track_id, cls_name, conf, xyxy)`. COCO ids: 0 person, 1 bicycle, 2 car, 3 motorcycle, 5 bus, 6 train, 7 truck.
- [ ] **Step 2:** Smoke script check on an extracted frame (no unit test — model download): confirms ≥1 vehicle detected on `kmitl_300.jpg`. Commit `feat: yolo detector wrapper`.

### Task 7: Video processor + DB

**Files:** Create `backend/app/db.py`, `backend/app/pipeline/processor.py`, `backend/scripts/process_video.py`, `backend/tests/test_db.py`.

- [ ] **Step 1:** `db.py`: sqlite3, tables

```sql
CREATE TABLE IF NOT EXISTS videos(id INTEGER PRIMARY KEY, site_id TEXT, file TEXT, processed_at TEXT, frames INTEGER, fps REAL, status TEXT);
CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY, video_id INTEGER, site_id TEXT, track_id INTEGER, cls TEXT, frame INTEGER, ts_sec REAL, state TEXT, snapshot TEXT, clip TEXT, report_json TEXT);
```

with `insert_video/insert_event/list_events/get_event/set_report` helpers + tests on tmp db.
- [ ] **Step 2:** `processor.py` — `process(video_path, site_config, db, artifacts_dir, render=True)`:
  - OpenCV `VideoCapture`, process every `frame_stride`-th frame.
  - Per frame: detector → train presence (conf ≥ `train_conf`) + `train_in_zone` (bbox center in `danger_zone` via `cv2.pointPolygonTest`) → SM update → for each non-train track, bottom-center point → `ViolationDetector.observe(..., restricted=sm.is_restricted)`.
  - On violation: save snapshot JPG (annotated frame), record event row (clip extraction ±5 s via ffmpeg happens post-pass).
  - `render=True`: write overlay mp4 (boxes, stop line, zone tint by state, event flashes) via `cv2.VideoWriter` (mp4v) then ffmpeg-transcode to H.264 for browser playback.
- [ ] **Step 3:** CLI `scripts/process_video.py --video ... --site configs/sites/x.json`. Smoke on the 59-s `Recording 2026-05-30 143224.mp4` once its config exists (Task 8). Commit `feat: video processor`.

### Task 8: Site ROI configs

**Files:** Create `backend/scripts/draw_roi.py`, `backend/configs/sites/{kmitl,asok,donmueang,ram}.json` (+ any extra clips worth demoing).

- [ ] **Step 1:** `draw_roi.py --video path --t seconds` extracts frame, lets author click stop-line (2 pts) then zone polygon (n pts, close on Enter), writes JSON. (When executed agentically: set coordinates by inspecting extracted frames directly and hand-writing JSON.)
- [ ] **Step 2:** Author configs for the 4 site videos; sanity-run processor on a 60-s segment of KMITL (`--max-seconds` flag) and verify state transitions + ≥0 events without crash. Commit `feat: site configs`.

### Task 9: RAG — law ingest + vector store (TDD on chunker/store)

**Files:** Create `backend/app/rag/{ingest,store}.py`, `backend/scripts/ingest_law.py`, `backend/tests/test_chunking.py`, `backend/tests/test_store.py`.

- [ ] **Step 1:** Failing chunker tests: Thai text with `มาตรา ๑๒` / `มาตรา 15` headers splits into chunks carrying `section` metadata; long sections split ≤ ~1200 chars with overlap; plain text without headers → paragraph chunks.
- [ ] **Step 2:** Implement `chunk_law_text(text) -> list[Chunk(section, text)]` using regex `r"(?=มาตรา\s*[๐-๙0-9]+)"` split + length guard.
- [ ] **Step 3:** Failing store tests: `VectorStore.add(texts, metas)` then `search("ฝ่าฝืนเครื่องกั้น", k=3)` returns ranked hits; persists to dir and reloads identically.
- [ ] **Step 4:** Implement store: sentence-transformers model (`BAAI/bge-m3`; fallback env override), L2-normalized matrix, cosine = dot; persist `embeddings.npy` + `chunks.jsonl`.
- [ ] **Step 5:** `ingest_law.py`: PyMuPDF extract text per page → chunk → embed → save under `data/rag_store/`. Run on `กฏหมายจราจร.pdf`; **verify Thai extraction is legible** (print first chunks — this is the risk gate; if glyphs garbled, fall back to OCR route `pytesseract` — decide then). Commit `feat: law RAG ingest`.

### Task 10: OpenRouter LLM + report + chat

**Files:** Create `backend/app/rag/{llm,report}.py`, tests with mocked client.

- [ ] **Step 1:** `llm.py`: OpenAI SDK, `base_url="https://openrouter.ai/api/v1"`, key from env. `MODEL_CANDIDATES` env-overridable list of free models; `complete(messages)` tries candidates on 404/429, exponential backoff ×3.
- [ ] **Step 2:** `report.py`: `generate_report(event, retriever, llm)` — retrieve top-4 chunks for query built from `cls` + "ฝ่าฝืนสัญญาณ/เครื่องกั้นทางรถไฟ โทษ ปรับ", prompt LLM (Thai) to produce JSON `{summary, law_sections:[{section, text_excerpt}], fine, recommendation}`; cache into `events.report_json`.
- [ ] **Step 3:** Mocked-LLM test: prompt contains retrieved chunk text; result cached. Live smoke once. Commit `feat: llm reports`.

### Task 11: Accident stats module

**Files:** Create `backend/app/stats/accidents.py`, `backend/tests/test_stats.py` (on 50-row fixture CSV).

- [ ] **Step 1:** `compute_stats(csv_path) -> dict`: totals, fatalities/injuries sums, top-10 provinces, top-10 causes, by-hour histogram, by-vehicle breakdown, monthly trend; cache JSON to `data/stats_cache/`. Test on fixture. Commit `feat: accident stats`.

### Task 12: FastAPI wiring

**Files:** Create `backend/app/main.py`, `backend/app/routes/*.py`, `backend/tests/test_api.py`.

- [ ] **Step 1:** Failing TestClient tests: `GET /api/events` → list from tmp DB; `GET /api/stats` → dict with `top_provinces`; `POST /api/chat` (mocked llm+store) → `{answer, citations}`; `GET /api/events/{id}/report` triggers/caches report (mocked).
- [ ] **Step 2:** Implement routes; `POST /api/jobs {video, site}` runs processor via BackgroundTasks with `jobs` status row; CORS `*`; mount `/artifacts` static → `data/artifacts`. Pass → commit `feat: api`.

### Task 13: Next.js dashboard

**Files:** Create `frontend/` via `npx create-next-app@latest frontend --ts --tailwind --app --no-src-dir`.

- [ ] **Step 1:** Scaffold + `lib/api.ts` (fetch wrapper, `NEXT_PUBLIC_API=http://localhost:8000`), recharts.
- [ ] **Step 2:** Pages: `/` dashboard (KPI cards: events by class/site, restricted-time stats + accident-stats charts: top provinces, causes, hourly), `/violations` (table + drawer: snapshot img, report JSON rendered as Thai report card), `/videos` (processed mp4 players per site), `/chat` (law chat with citation chips). Dark theme, Thai UI copy.
- [ ] **Step 3:** Manual verify against running backend; commit `feat: dashboard`.

### Task 14: Full processing run + eval + docs

**Files:** Create `notebooks/eval.ipynb`, `notebooks/eda_accidents.ipynb`, `backend/tests/fixtures/ground_truth.csv`, `README.md`, `docs/slides_outline.md`, `docs/demo_script.md`.

- [ ] **Step 1:** Batch-process all 4 site videos (background, logged). Record events count per site.
- [ ] **Step 2:** Ground truth: scrub each site video's chosen eval segment (≥5 min or full short clips), hand-label violation events (timestamp ±2 s, class) into `ground_truth.csv`; eval notebook matches predictions↔GT with ±2 s tolerance → precision/recall/F1 table per site + overall.
- [ ] **Step 3:** EDA notebook on accident CSV (supports slides: rail-crossing relevance, hotspots, causes).
- [ ] **Step 4:** README (Thai): architecture diagram, stack (Model/Framework), challenges, learnings, setup, submission-form answer drafts. Slides outline + demo-video script. Final commit.

---

## Self-review notes

- Spec coverage: pipeline (T2-8), RAG+report+chat (T9-10), stats (T11), API (T12), frontend (T13), eval+docs+batch (T14), success criteria 1-5 all mapped.
- Risk gates called out: MPS availability (T1), Thai PDF extraction (T9 step 5), COCO train-class reliability (per-site conf + hysteresis, T3/T4 params).
- Types consistent: `SiteConfig` fields used by processor; `ViolationDetector.observe(track_id, cls, point, frame, restricted)` matches processor calls.
