from app.pipeline.config import SiteConfig
from app.pipeline.detector import Detection
from app.pipeline.train_signal import TrainEvidence

CFG = SiteConfig(
    site_id="t", name="t", video_file="t.mp4",
    stop_line=[[0, 500], [1000, 500]],
    danger_zone=[[0, 300], [1000, 300], [1000, 450], [0, 450]],
    train_conf=0.35,
    train_min_width=300,
)


def det(cls, conf, xyxy, track_id=1):
    return Detection(track_id=track_id, cls=cls, conf=conf, xyxy=xyxy)


def test_static_train_structure_never_counts():
    ev = TrainEvidence(CFG)
    for _ in range(30):  # skywalk misdetected as train, never moves
        present, in_zone = ev.update([det("train", 0.8, (500, 0, 1280, 330))])
        assert not present and not in_zone


def test_moving_train_counts_after_travel():
    ev = TrainEvidence(CFG, min_travel=40)
    assert ev.update([det("train", 0.6, (100, 320, 900, 430))]) == (False, False)
    # same track shifted 60 px → moving
    present, in_zone = ev.update([det("train", 0.6, (160, 320, 960, 430))])
    assert present and in_zone


def test_moving_train_outside_zone_is_present_not_in_zone():
    ev = TrainEvidence(CFG, min_travel=40)
    ev.update([det("train", 0.6, (100, 50, 400, 150))])
    present, in_zone = ev.update([det("train", 0.6, (180, 50, 480, 150))])
    assert present and not in_zone


def test_wide_truck_in_zone_counts_as_train():
    ev = TrainEvidence(CFG)
    present, in_zone = ev.update([det("truck", 0.7, (300, 320, 740, 440))])
    assert present and in_zone


def test_narrow_truck_in_zone_is_not_train():
    ev = TrainEvidence(CFG)
    present, in_zone = ev.update([det("truck", 0.7, (400, 320, 550, 440))])
    assert not present and not in_zone


def test_wide_truck_outside_zone_is_not_train():
    ev = TrainEvidence(CFG)
    present, in_zone = ev.update([det("truck", 0.9, (100, 500, 700, 700))])
    assert not present and not in_zone


def test_low_conf_ignored():
    ev = TrainEvidence(CFG, min_travel=40)
    ev.update([det("train", 0.2, (100, 320, 900, 430))])
    present, _ = ev.update([det("train", 0.2, (180, 320, 980, 430))])
    assert not present


def test_car_never_counts():
    ev = TrainEvidence(CFG)
    present, _ = ev.update([det("car", 0.99, (100, 320, 900, 430))])
    assert not present
