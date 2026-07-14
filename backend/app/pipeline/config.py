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
    segment: str = ""        # config-file stem; set by load_site_config
    frame_stride: int = 2
    train_conf: float = 0.35
    vehicle_conf: float = 0.4
    train_min_width: int = 300  # px; wide truck/bus in zone counts as train evidence
    # which classes may count as rolling stock. Sites where trains are seen
    # side-on as containers need ["train","truck"]; passenger-train sites keep
    # ["train"] so buses/trucks crossing the zone can't re-arm the state.
    rail_classes: list = field(default_factory=lambda: ["train", "truck", "bus"])
    warning_frames: int = 8   # consecutive train frames before WARNING
    clear_frames: int = 45    # frames without train before back to IDLE
    # scene matching: handheld videos wander between viewpoints; only frames
    # whose top band correlates with the reference frame are processed
    ref_time: float = 0.0            # seconds; reference-viewpoint frame
    scene_match_min: float = 0.7     # NCC threshold to accept a frame
    match_band: float = 0.3          # top fraction of frame used for NCC
    gap_reset_frames: int = 60       # processed-frame gaps longer than this reset state
    start_sec: float = 0.0
    end_sec: float = 0.0             # 0 = until end of video
    watch_classes: list = field(default_factory=lambda: [
        "person", "bicycle", "car", "motorcycle", "bus", "truck"
    ])

    def save(self, path):
        Path(path).write_text(json.dumps(asdict(self), ensure_ascii=False, indent=2))


def load_site_config(path) -> SiteConfig:
    data = json.loads(Path(path).read_text())
    data.setdefault("segment", Path(path).stem)
    return SiteConfig(**data)
