from app.pipeline.config import SiteConfig
from app.pipeline.detector import Detection
from app.pipeline.train_signal import train_signal

CFG = SiteConfig(
    site_id="t", name="t", video_file="t.mp4",
    stop_line=[[0, 500], [1000, 500]],
    danger_zone=[[0, 300], [1000, 300], [1000, 450], [0, 450]],
    train_conf=0.35,
    train_min_width=300,
)


def det(cls, conf, xyxy):
    return Detection(track_id=1, cls=cls, conf=conf, xyxy=xyxy)


def test_train_class_in_zone():
    present, in_zone = train_signal([det("train", 0.6, (100, 320, 900, 430))], CFG)
    assert present and in_zone


def test_wide_truck_in_zone_counts_as_train():
    present, in_zone = train_signal([det("truck", 0.7, (300, 320, 740, 440))], CFG)
    assert present and in_zone


def test_narrow_truck_in_zone_is_not_train():
    present, in_zone = train_signal([det("truck", 0.7, (400, 320, 550, 440))], CFG)
    assert not present and not in_zone


def test_wide_truck_outside_zone_is_not_train():
    present, in_zone = train_signal([det("truck", 0.9, (100, 500, 700, 700))], CFG)
    assert not present and not in_zone


def test_low_conf_ignored():
    present, _ = train_signal([det("train", 0.2, (100, 320, 900, 430))], CFG)
    assert not present


def test_car_never_counts():
    present, _ = train_signal([det("car", 0.99, (100, 320, 900, 430))], CFG)
    assert not present
