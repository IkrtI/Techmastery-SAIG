from app.pipeline.state_machine import CrossingStateMachine, State


def make_sm():
    return CrossingStateMachine(warning_frames=3, clear_frames=5)


def test_starts_idle():
    assert make_sm().state == State.IDLE


def test_warning_needs_consecutive_train_frames():
    sm = make_sm()
    sm.update(train_present=True)
    sm.update(train_present=False)
    sm.update(train_present=True)
    sm.update(train_present=True)
    assert sm.state == State.IDLE  # streak broken, only 2 consecutive
    sm.update(train_present=True)
    assert sm.state == State.WARNING  # 3 consecutive


def test_active_when_train_in_zone():
    sm = make_sm()
    for _ in range(3):
        sm.update(train_present=True)
    sm.update(train_present=True, train_in_zone=True)
    assert sm.state == State.ACTIVE


def test_clears_back_to_idle_after_clear_frames():
    sm = make_sm()
    for _ in range(3):
        sm.update(train_present=True)
    for _ in range(5):
        sm.update(train_present=False)
    assert sm.state == State.IDLE


def test_is_restricted_during_warning_and_active():
    sm = make_sm()
    assert not sm.is_restricted
    for _ in range(3):
        sm.update(train_present=True)
    assert sm.is_restricted
    sm.update(train_present=True, train_in_zone=True)
    assert sm.is_restricted
