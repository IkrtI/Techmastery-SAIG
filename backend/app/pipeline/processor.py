"""End-to-end video processing: decode → detect/track → state machine → events.

Writes annotated overlay video, per-event snapshots, and DB rows.
"""
import subprocess
from pathlib import Path

import cv2
import numpy as np

from .. import db as dbmod
from .config import SiteConfig
from .detector import Detector
from .scene_match import SceneMatcher, grab_frame
from .state_machine import CrossingStateMachine, State
from .train_signal import train_signal
from .violations import ViolationDetector

STATE_COLORS = {
    State.IDLE: (80, 200, 80),
    State.WARNING: (0, 200, 255),
    State.ACTIVE: (0, 0, 255),
}
FFMPEG = "/opt/homebrew/bin/ffmpeg"


def _draw_overlay(frame, detections, cfg: SiteConfig, state: State, new_event_ids):
    color = STATE_COLORS[state]
    zone = np.array(cfg.danger_zone, dtype=np.int32)
    tint = frame.copy()
    cv2.fillPoly(tint, [zone], color)
    frame = cv2.addWeighted(tint, 0.15, frame, 0.85, 0)
    cv2.polylines(frame, [zone], True, color, 2)
    p1, p2 = cfg.stop_line
    cv2.line(frame, tuple(map(int, p1)), tuple(map(int, p2)), (255, 255, 255), 2)
    for d in detections:
        x1, y1, x2, y2 = map(int, d.xyxy)
        is_violator = d.track_id in new_event_ids
        box_color = (0, 0, 255) if is_violator else (0, 165, 255) if d.cls == "train" else (200, 200, 0)
        thickness = 3 if is_violator else 1
        cv2.rectangle(frame, (x1, y1), (x2, y2), box_color, thickness)
        label = f"{d.cls}#{d.track_id}"
        cv2.putText(frame, label, (x1, max(12, y1 - 4)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45, box_color, 1, cv2.LINE_AA)
    cv2.putText(frame, f"STATE: {state.value.upper()}", (12, 28),
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2, cv2.LINE_AA)
    return frame


def _extract_clip(video_path, ts_sec, out_path, before=5, after=5):
    start = max(0, ts_sec - before)
    cmd = [FFMPEG, "-y", "-v", "error", "-ss", str(start), "-i", str(video_path),
           "-t", str(before + after), "-c:v", "libx264", "-preset", "veryfast",
           "-an", str(out_path)]
    subprocess.run(cmd, check=False, capture_output=True)


def _transcode_h264(src, dst):
    # crf 28 keeps demo overlays small — the host disk is nearly full
    subprocess.run([FFMPEG, "-y", "-v", "error", "-i", str(src),
                    "-c:v", "libx264", "-preset", "veryfast", "-crf", "28",
                    "-pix_fmt", "yuv420p", "-an", str(dst)],
                   check=False, capture_output=True)
    Path(src).unlink(missing_ok=True)


def process(video_path, cfg: SiteConfig, conn=None, artifacts_dir=None,
            render=True, max_seconds=None, detector=None, progress_cb=None,
            debug_dir=None):
    """Process one video; returns (video_id, n_events, stats)."""
    conn = conn or dbmod.connect()
    artifacts_dir = Path(artifacts_dir or Path(__file__).resolve().parents[3] / "data" / "artifacts")
    site_dir = artifacts_dir / cfg.site_id
    site_dir.mkdir(parents=True, exist_ok=True)

    matcher = SceneMatcher(grab_frame(video_path, cfg.ref_time), band=cfg.match_band)

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise RuntimeError(f"cannot open video: {video_path}")
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    start_frame = int(cfg.start_sec * fps)
    if start_frame:
        cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)
    end_frame = int(cfg.end_sec * fps) if cfg.end_sec else total
    if max_seconds:
        end_frame = min(end_frame, start_frame + int(max_seconds * fps))
    max_frames = end_frame

    video_id = dbmod.insert_video(conn, cfg.site_id, Path(video_path).name, fps=fps,
                                  segment=cfg.segment)

    detector = detector or Detector()
    sm = CrossingStateMachine(cfg.warning_frames, cfg.clear_frames)
    vd = ViolationDetector(cfg.stop_line)

    writer = None
    overlay_raw = site_dir / f"overlay_{video_id}_raw.mp4"
    overlay_final = site_dir / f"overlay_{video_id}.mp4"
    if render:
        out_fps = max(1.0, fps / cfg.frame_stride)
        writer = cv2.VideoWriter(str(overlay_raw), cv2.VideoWriter_fourcc(*"mp4v"),
                                 out_fps, (width, height))

    n_events = 0
    frame_idx = start_frame - 1
    pending_clips = []
    skip_streak = 0
    scene_lost = False
    stats = {"considered": 0, "accepted": 0, "restricted": 0, "train_frames": 0,
             "states": {"idle": 0, "warning": 0, "active": 0}}
    debug_count = 0
    while True:
        ok, frame = cap.read()
        if not ok or frame_idx + 1 >= max_frames:
            break
        frame_idx += 1
        if frame_idx % cfg.frame_stride:
            continue

        stats["considered"] += 1
        if matcher.score(frame) < cfg.scene_match_min:
            skip_streak += 1
            if skip_streak >= cfg.gap_reset_frames and not scene_lost:
                # camera wandered off — forget stale positions and cool down
                vd.reset_positions()
                sm.state = State.IDLE
                scene_lost = True
            continue
        if scene_lost:
            vd.reset_positions()
            scene_lost = False
        skip_streak = 0

        detections = detector.track(frame)
        train_present, train_in_zone = train_signal(detections, cfg)
        sm.update(train_present=train_present, train_in_zone=train_in_zone)
        stats["accepted"] += 1
        stats["states"][sm.state.value] += 1
        if train_present:
            stats["train_frames"] += 1
        if sm.is_restricted:
            stats["restricted"] += 1
        if debug_dir and stats["accepted"] % 100 == 1:
            debug_count += 1
            dbg = _draw_overlay(frame.copy(), detections, cfg, sm.state, set())
            cv2.imwrite(str(Path(debug_dir) / f"dbg_{cfg.site_id}_{frame_idx}.jpg"), dbg)

        new_event_ids = set()
        ts_sec = frame_idx / fps
        for d in detections:
            if d.cls not in cfg.watch_classes or d.conf < cfg.vehicle_conf or d.track_id < 0:
                continue
            for v in vd.observe(d.track_id, d.cls, d.bottom_center, frame_idx, sm.is_restricted):
                new_event_ids.add(v.track_id)
                snap_path = site_dir / f"event_{video_id}_{frame_idx}_{v.track_id}.jpg"
                clip_path = site_dir / f"clip_{video_id}_{frame_idx}_{v.track_id}.mp4"
                annotated = _draw_overlay(frame.copy(), detections, cfg, sm.state, {v.track_id})
                cv2.imwrite(str(snap_path), annotated)
                rel = lambda p: str(p.relative_to(artifacts_dir))
                dbmod.insert_event(conn, video_id, cfg.site_id, v.track_id, v.cls,
                                   frame_idx, ts_sec, sm.state.value,
                                   snapshot=rel(snap_path), clip=rel(clip_path))
                pending_clips.append((ts_sec, clip_path))
                n_events += 1

        if writer is not None:
            writer.write(_draw_overlay(frame.copy(), detections, cfg, sm.state, new_event_ids))
        if progress_cb and frame_idx % 300 == 0:
            progress_cb(frame_idx, max_frames)

    cap.release()
    overlay_rel = None
    if writer is not None:
        writer.release()
        _transcode_h264(overlay_raw, overlay_final)
        overlay_rel = str(overlay_final.relative_to(artifacts_dir))
    for ts_sec, clip_path in pending_clips:
        _extract_clip(video_path, ts_sec, clip_path)
    dbmod.finish_video(conn, video_id, frames=frame_idx + 1, overlay=overlay_rel)
    return video_id, n_events, stats
