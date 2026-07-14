from app.pipeline.config import SiteConfig
from app.pipeline.detector import Detection
from app.pipeline.train_signal import train_signal

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
    present, in_zone = train_signal([det("truck", 0.7, (100, 380, 700, 470))], CFG)
    assert present and in_zone


def test_close_wide_truck_rejected_by_bottom_guard():
    # wide pickup near the camera: bottom edge below the cutoff
    present, in_zone = train_signal([det("truck", 0.9, (100, 400, 700, 650))], CFG)
    assert not present and not in_zone


def test_train_class_ignores_bottom_guard():
    present, in_zone = train_signal([det("train", 0.6, (100, 400, 700, 650))], CFG)
    assert present and in_zone
