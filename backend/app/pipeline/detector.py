"""YOLO11 + ByteTrack wrapper. COCO classes only — no fine-tuning required."""
import os
from dataclasses import dataclass

COCO_CLASSES = {
    0: "person", 1: "bicycle", 2: "car", 3: "motorcycle",
    5: "bus", 6: "train", 7: "truck",
}
TRACK_CLASS_IDS = list(COCO_CLASSES.keys())


@dataclass
class Detection:
    track_id: int          # -1 when tracker hasn't assigned an id yet
    cls: str
    conf: float
    xyxy: tuple            # (x1, y1, x2, y2)

    @property
    def bottom_center(self):
        x1, _, x2, y2 = self.xyxy
        return ((x1 + x2) / 2.0, y2)

    @property
    def center(self):
        x1, y1, x2, y2 = self.xyxy
        return ((x1 + x2) / 2.0, (y1 + y2) / 2.0)


class Detector:
    def __init__(self, model_path=None, device=None):
        from ultralytics import YOLO
        import torch

        self.model = YOLO(model_path or os.environ.get("RAILGUARD_MODEL", "yolo11s.pt"))
        if device is None:
            device = "mps" if torch.backends.mps.is_available() else "cpu"
        self.device = device

    def track(self, frame) -> list:
        results = self.model.track(
            frame,
            persist=True,
            tracker="bytetrack.yaml",
            classes=TRACK_CLASS_IDS,
            device=self.device,
            verbose=False,
        )
        detections = []
        boxes = results[0].boxes
        if boxes is None:
            return detections
        for b in boxes:
            cls_id = int(b.cls.item())
            track_id = int(b.id.item()) if b.id is not None else -1
            detections.append(Detection(
                track_id=track_id,
                cls=COCO_CLASSES.get(cls_id, str(cls_id)),
                conf=float(b.conf.item()),
                xyxy=tuple(float(v) for v in b.xyxy[0].tolist()),
            ))
        return detections

    def reset(self):
        """Reset tracker state between videos."""
        if getattr(self.model, "predictor", None) is not None:
            self.model.predictor.trackers[0].reset()
