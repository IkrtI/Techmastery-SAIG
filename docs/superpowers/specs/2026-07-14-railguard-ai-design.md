# RailGuard AI — Design Spec

**Date:** 2026-07-14 · **Deadline:** within this week · **Target:** SAIG Techmastery submission (AI track)

## Problem

Thai "วัดใจ" railway crossings: drivers run barriers/signals while trains approach. No automated evidence capture, no legal follow-through. Product detects violations from camera footage, generates Thai incident reports citing exact law sections and fines.

## Datasets used

- **Dataset 4** (core): rail-crossing footage — 4 sites (KMITL, Asok, Donmueang, Ramkhamhaeng) + supplementary clips. 720p30.
- **Dataset 3** (core): กฏหมายจราจร.pdf → RAG corpus.
- **Dataset 1** (supporting): nationwide accident CSV → hotspot/severity stats for dashboard + slides narrative.

## Approach (chosen: pretrained detector + tracking + zone state machine)

Rejected alternatives: full fine-tuned custom detector (labeling cost too high for 1 week; kept as stretch), VLM-per-frame judgment (slow, costly, weak accuracy metrics).

### CV pipeline (`backend/pipeline/`)

1. **Detect:** YOLO11 (COCO pretrained) on Apple M1 MPS. Classes: person, bicycle, car, motorcycle, bus, truck, train.
2. **Track:** ByteTrack via `supervision`/ultralytics `model.track`.
3. **Site config:** per-video JSON — stop-line segment, danger-zone polygon, optional barrier ROI. Authored once per site with a small ROI-drawing helper script.
4. **Crossing state machine:** `IDLE → WARNING (train detected, temporal-smoothed N consecutive frames) → ACTIVE (train in/near zone) → CLEARING`. Barrier ROI heuristic optional signal.
5. **Violation rule:** while state ∈ {WARNING, ACTIVE}, any tracked road user whose bottom-center crosses stop line into danger zone ⇒ violation event: `{track_id, class, frame_ts, site, snapshot.jpg, clip.mp4 (±5 s)}`.
6. **Store:** SQLite (`events`, `videos`, `sites` tables), snapshots/clips on disk under `data/artifacts/`.

### RAG + report (`backend/rag/`)

- Parse PDF (pymupdf), chunk by มาตรา/section headers, embed with `bge-m3` (local, sentence-transformers), store in ChromaDB.
- **Report generation:** violation event → retrieve relevant มาตรา (barrier running, signal violation, fines) → OpenRouter LLM composes Thai incident report with citations + fine amounts.
- **Law chat:** free-form Thai Q&A endpoint with retrieved-chunk citations.
- OpenRouter key in `.env` (gitignored). Model configurable via env, default a free Thai-capable model; key considered exposed → rotate after submission.

### Backend (FastAPI)

Endpoints: `POST /jobs` (process video), `GET /jobs/{id}`, `GET /events` (+filters), `GET /events/{id}/report`, `POST /chat` (RAG), `GET /stats` (accident CSV aggregates + event stats), static serving of snapshots/clips. Background processing via `BackgroundTasks` (single worker fine for demo).

### Frontend (Next.js + Tailwind)

Pages: **Dashboard** (KPI cards, charts from stats API), **Video** (processed playback with baked-in overlay boxes + event markers), **Violations** (table: snapshot, class, time, site, law citation, fine; detail drawer with report), **Law Chat** (Thai chat UI with citations).

### Accuracy evaluation

Hand-label ground truth on held-out clip segments (all 4 sites): violation events with timestamps. Report precision/recall/F1 of event detection + per-class breakdown. Notebook in `notebooks/eval.ipynb`. This is the "แม่นยำ" evidence for slides.

## Error handling

- COCO `train` class weak → confidence threshold per class + temporal smoothing (N-frame hysteresis).
- Camera shake/angle variance → per-site ROI config; document limitation (fixed-camera assumption).
- OpenRouter failures/rate limits → retry with backoff; report generation is async and cached in DB.
- Videos are large (up to 1.4 GB) → process by frame stride (e.g. every 2nd frame), stream decode via OpenCV, never load whole video.

## Repo structure

```
backend/   FastAPI app, pipeline/, rag/, tests/
frontend/  Next.js app
notebooks/ EDA + eval
docs/      spec, slides outline
data/      (gitignored) artifacts, chroma, sqlite
```

## Out of scope

Real-time RTSP ingest, multi-camera live ops, user auth, fine-tuned detector (stretch), deployment (local demo only). Submission items owned by user: CV/resume, final slide polish, demo video recording (repo includes slide outline + demo script).

## Success criteria

1. Pipeline processes all 4 site videos, produces violation events with snapshots.
2. Each event gets a Thai report citing real มาตรา + fine from the PDF via RAG.
3. Dashboard demo-able end-to-end locally (one command per service).
4. Eval notebook reports precision/recall on labeled segments.
5. Repo pushable to GitHub with README (Thai) covering tech stack, challenges, learnings — feeding submission form Q4/Q5.
