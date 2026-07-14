"""Per-site camera configuration: ROI geometry + tuning knobs."""
import json
from dataclasses import dataclass, field, asdict
from pathlib import Path


@dataclass
class SiteConfig:
    site_id: str
    name: str
    video_file: str
    stop_line: list          # [[x1, y1], [x2, y2]] in pixel coords
    danger_zone: list        # polygon [[x, y], ...] around the tracks
    frame_stride: int = 2
    train_conf: float = 0.35
    vehicle_conf: float = 0.4
    warning_frames: int = 8   # consecutive train frames before WARNING
    clear_frames: int = 45    # frames without train before back to IDLE
    watch_classes: list = field(default_factory=lambda: [
        "person", "bicycle", "car", "motorcycle", "bus", "truck"
    ])

    def save(self, path):
        Path(path).write_text(json.dumps(asdict(self), ensure_ascii=False, indent=2))


def load_site_config(path) -> SiteConfig:
    data = json.loads(Path(path).read_text())
    return SiteConfig(**data)
