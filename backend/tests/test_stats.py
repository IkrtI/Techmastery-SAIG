from pathlib import Path

from app.stats.accidents import compute_stats

FIXTURE = Path(__file__).parent / "fixtures" / "accidents_fixture.csv"


def test_totals():
    stats = compute_stats(FIXTURE, use_cache=False)
    assert stats["total_accidents"] == 5
    assert stats["total_fatalities"] == 4
    assert stats["total_injuries"] == 6


def test_top_provinces_sorted():
    stats = compute_stats(FIXTURE, use_cache=False)
    names = [p["name"] for p in stats["top_provinces"]]
    assert names[0] in ("กรุงเทพมหานคร", "ชลบุรี")
    assert len(names) == 3


def test_by_hour_histogram():
    stats = compute_stats(FIXTURE, use_cache=False)
    hours = {h["hour"] for h in stats["by_hour"]}
    assert 16 in hours and 8 in hours
