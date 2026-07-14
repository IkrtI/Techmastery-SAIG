"""Viewpoint gate for handheld footage.

The source videos wander between viewpoints (walking camera). ROI geometry is
only valid for the reference viewpoint, so frames are accepted or skipped by
normalized cross-correlation against a reference signature.

Design constraints learned from the footage:
- Passing trains occlude the mid-frame, so the signature uses only a thin
  top strip (sky / building tops / footbridges) that rolling stock never
  reaches.
- Handheld tilt shifts content vertically, so the reference strip slides
  over a taller search window (matchTemplate) instead of a fixed crop.
"""
import cv2

SMALL = (320, 180)
TEMPLATE_FRAC = 0.15   # reference strip: top 15% of the frame
SEARCH_FRAC = 0.45     # searched region: top 45% (tolerates tilt)


class SceneMatcher:
    def __init__(self, ref_frame, band=TEMPLATE_FRAC):
        self.band = band
        self.template = self._strip(ref_frame, self.band)

    @staticmethod
    def _gray_small(frame):
        return cv2.cvtColor(cv2.resize(frame, SMALL), cv2.COLOR_BGR2GRAY)

    def _strip(self, frame, frac):
        gray = self._gray_small(frame)
        h = max(12, int(SMALL[1] * frac))
        return gray[:h]

    def score(self, frame) -> float:
        search = self._strip(frame, SEARCH_FRAC)
        res = cv2.matchTemplate(search, self.template, cv2.TM_CCOEFF_NORMED)
        return float(res.max())


def grab_frame(video_path, t_sec):
    cap = cv2.VideoCapture(str(video_path))
    cap.set(cv2.CAP_PROP_POS_MSEC, t_sec * 1000)
    ok, frame = cap.read()
    cap.release()
    if not ok:
        raise RuntimeError(f"cannot read frame at {t_sec}s from {video_path}")
    return frame
