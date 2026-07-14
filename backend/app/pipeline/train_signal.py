"""Train-presence evidence.

COCO models frequently label freight cars seen side-on as "truck"/"bus",
and sometimes label static structures (station buildings, skywalks) as
"train". Evidence rules:

- class "train": counts only after its TRACK has moved >= train_min_travel px
  from where it was first seen (static structures never move; approaching
  locomotives do). Presence = moving train anywhere; in-zone = moving train
  whose bbox intersects the danger zone.
- class truck/bus: counts as rolling stock only when the bbox intersects the
  danger zone AND is wider than train_min_width px AND (when
  train_max_bottom_y is set) its bottom edge sits above that line —
  separating distant rolling stock from wide road vehicles near the camera.

Temporal hysteresis in CrossingStateMachine filters out remaining flicker.
"""
from .geometry import point_in_polygon

DEFAULT_RAIL_CLASSES = ("train", "truck", "bus")


def _bbox_intersects_zone(xyxy, zone, samples=5):
    x1, y1, x2, y2 = xyxy
    cy = (y1 + y2) / 2.0
    for i in range(samples):
        cx = x1 + (x2 - x1) * i / (samples - 1)
        # rolling stock rides above the rails: its box center can sit well
        # above the danger zone, so probe the bottom edge (wheels) too
        if point_in_polygon((cx, cy), zone) or point_in_polygon((cx, y2), zone):
            return True
    return False


class TrainEvidence:
    """Stateful evidence tracker (per processed segment)."""

    def __init__(self, cfg, min_travel=40):
        self.cfg = cfg
        self.min_travel = getattr(cfg, "train_min_travel", 0) or min_travel
        self._origin = {}   # train track_id -> first-seen center
        self._moving = set()

    def _train_is_moving(self, d):
        if d.track_id < 0:
            # untracked detection: can't prove movement — only trust it
            # when it already overlaps the danger zone
            return _bbox_intersects_zone(d.xyxy, self.cfg.danger_zone)
        if d.track_id in self._moving:
            return True
        cx, cy = d.center
        ox, oy = self._origin.setdefault(d.track_id, (cx, cy))
        if abs(cx - ox) + abs(cy - oy) >= self.min_travel:
            self._moving.add(d.track_id)
            return True
        return False

    def update(self, detections):
        """Feed one frame's detections; returns (train_present, train_in_zone)."""
        cfg = self.cfg
        rail_classes = getattr(cfg, "rail_classes", None) or DEFAULT_RAIL_CLASSES
        present = False
        in_zone = False
        for d in detections:
            if d.cls not in rail_classes or d.conf < cfg.train_conf:
                continue
            width = d.xyxy[2] - d.xyxy[0]
            if d.cls == "train":
                if not self._train_is_moving(d):
                    continue
                present = True
                in_zone = in_zone or _bbox_intersects_zone(d.xyxy, cfg.danger_zone)
            elif width >= cfg.train_min_width and _bbox_intersects_zone(d.xyxy, cfg.danger_zone):
                max_bottom = getattr(cfg, "train_max_bottom_y", 0)
                if max_bottom and d.xyxy[3] > max_bottom:
                    continue  # wide but close to camera → road vehicle
                present = True
                in_zone = True
        return present, in_zone


