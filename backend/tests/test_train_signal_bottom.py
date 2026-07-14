from app.pipeline.config import SiteConfig
from app.pipeline.detector import Detection
from app.pipeline.train_signal import TrainEvidence

CFG = SiteConfig(
    site_id="t", name="t", video_file="t.mp4",
    stop_line=[[0, 500], [1000, 500]],
    danger_zone=[[0, 300], [1000, 300], [1000, 600], [0, 600]],
    train_conf=0.35,
    train_min_width=300,
    train_max_bottom_y=500,
    rail_classes=["train", "truck"],
)


def det(cls, conf, xyxy):
    return Detection(track_id=1, cls=cls, conf=conf, xyxy=xyxy)


def test_distant_wide_truck_counts_as_train():
    ev = TrainEvidence(CFG)
    present, in_zone = ev.update([det("truck", 0.7, (100, 380, 700, 470))])
    assert present and in_zone


def test_close_wide_truck_rejected_by_bottom_guard():
    ev = TrainEvidence(CFG)
    # wide pickup near the camera: bottom edge below the cutoff
    present, in_zone = ev.update([det("truck", 0.9, (100, 400, 700, 650))])
    assert not present and not in_zone


def test_moving_train_ignores_bottom_guard():
    ev = TrainEvidence(CFG, min_travel=40)
    ev.update([det("train", 0.6, (100, 400, 700, 650))])
    present, in_zone = ev.update([det("train", 0.6, (180, 400, 780, 650))])
    assert present and in_zone
