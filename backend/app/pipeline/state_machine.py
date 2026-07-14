"""Crossing activity state machine with temporal hysteresis.

COCO's train class is noisy frame-to-frame, so transitions require
consecutive-frame streaks rather than single detections.
"""
from enum import Enum


class State(Enum):
    IDLE = "idle"
    WARNING = "warning"
    ACTIVE = "active"


class CrossingStateMachine:
    def __init__(self, warning_frames: int = 8, clear_frames: int = 45):
        self.warning_frames = warning_frames
        self.clear_frames = clear_frames
        self.state = State.IDLE
        self._train_streak = 0
        self._absent_streak = 0

    @property
    def is_restricted(self) -> bool:
        return self.state in (State.WARNING, State.ACTIVE)

    def update(self, train_present: bool, train_in_zone: bool = False) -> State:
        if train_present:
            self._train_streak += 1
            self._absent_streak = 0
        else:
            self._absent_streak += 1
            self._train_streak = 0

        if self.state == State.IDLE and self._train_streak >= self.warning_frames:
            self.state = State.WARNING
        if self.state == State.WARNING and train_in_zone:
            self.state = State.ACTIVE
        if self.state != State.IDLE and self._absent_streak >= self.clear_frames:
            self.state = State.IDLE
        return self.state
