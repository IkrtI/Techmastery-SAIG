"""Train-presence evidence.

COCO models frequently label freight cars seen side-on as "truck"/"bus",
so a plain train-class check misses real trains. Evidence rule:

- class "train" at conf >= train_conf anywhere counts as presence, or
- class train/truck/bus at conf >= train_conf whose bbox intersects the
  danger zone AND is wider than train_min_width px (side-on rolling stock
  is much wider than a road vehicle crossing the zone head-on).

Temporal hysteresis in CrossingStateMachine filters out remaining false hits.
"""
from .geometry import point_in_polygon

RAIL_CLASSES = ("train", "truck", "bus")


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


def train_signal(detections, cfg):
    """Returns (train_present, train_in_zone)."""
    present = False
    in_zone = False
    for d in detections:
        if d.cls not in RAIL_CLASSES or d.conf < cfg.train_conf:
            continue
        width = d.xyxy[2] - d.xyxy[0]
        intersects = _bbox_intersects_zone(d.xyxy, cfg.danger_zone)
        if d.cls == "train":
            present = True
            in_zone = in_zone or intersects
        elif intersects and width >= cfg.train_min_width:
            present = True
            in_zone = True
    return present, in_zone
