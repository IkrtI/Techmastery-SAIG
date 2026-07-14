from app.pipeline.violations import ViolationDetector

STOP = [[0, 100], [200, 100]]


def test_violation_when_crossing_during_restricted():
    vd = ViolationDetector(stop_line=STOP)
    vd.observe(track_id=1, cls="motorcycle", point=(50, 120), frame=1, restricted=True)
    events = vd.observe(track_id=1, cls="motorcycle", point=(50, 80), frame=2, restricted=True)
    assert len(events) == 1
    assert events[0].track_id == 1
    assert events[0].cls == "motorcycle"
    assert events[0].frame == 2


def test_no_violation_when_idle():
    vd = ViolationDetector(stop_line=STOP)
    vd.observe(1, "car", (50, 120), 1, False)
    assert vd.observe(1, "car", (50, 80), 2, False) == []


def test_track_flagged_once():
    vd = ViolationDetector(stop_line=STOP)
    vd.observe(1, "car", (50, 120), 1, True)
    vd.observe(1, "car", (50, 80), 2, True)
    assert vd.observe(1, "car", (50, 60), 3, True) == []


def test_independent_tracks_each_flagged():
    vd = ViolationDetector(stop_line=STOP)
    vd.observe(1, "car", (50, 120), 1, True)
    vd.observe(2, "motorcycle", (80, 120), 1, True)
    e1 = vd.observe(1, "car", (50, 80), 2, True)
    e2 = vd.observe(2, "motorcycle", (80, 80), 2, True)
    assert len(e1) == 1 and len(e2) == 1


def test_no_violation_without_previous_point():
    vd = ViolationDetector(stop_line=STOP)
    # first observation can't cross anything
    assert vd.observe(1, "car", (50, 80), 1, True) == []
