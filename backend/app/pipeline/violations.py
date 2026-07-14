"""Stop-line crossing detection over tracked objects."""
from dataclasses import dataclass

from .geometry import segments_intersect


@dataclass
class Violation:
    track_id: int
    cls: str
    frame: int


class ViolationDetector:
    def __init__(self, stop_line):
        self.stop_line = (tuple(stop_line[0]), tuple(stop_line[1]))
        self._last_point = {}   # track_id -> (x, y)
        self._flagged = set()   # track_ids already reported this episode
        self._was_restricted = False

    def observe(self, track_id, cls, point, frame, restricted) -> list:
        """Feed one tracked position; returns new Violations (0 or 1)."""
        # new restricted episode → allow tracks to be flagged again
        if restricted and not self._was_restricted:
            self._flagged.clear()
        self._was_restricted = restricted

        events = []
        prev = self._last_point.get(track_id)
        self._last_point[track_id] = point
        if (
            restricted
            and prev is not None
            and track_id not in self._flagged
            and segments_intersect(prev, point, *self.stop_line)
        ):
            self._flagged.add(track_id)
            events.append(Violation(track_id=track_id, cls=cls, frame=frame))
        return events
