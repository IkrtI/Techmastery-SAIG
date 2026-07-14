import json

from app import db


def make_conn(tmp_path):
    return db.connect(tmp_path / "test.db")


def test_video_and_event_roundtrip(tmp_path):
    conn = make_conn(tmp_path)
    vid = db.insert_video(conn, "kmitl", "KMITL Train.mp4", fps=30.0)
    eid = db.insert_event(conn, vid, "kmitl", 7, "motorcycle", 900, 30.0, "active", snapshot="s.jpg")
    events = db.list_events(conn)
    assert len(events) == 1
    assert events[0]["id"] == eid
    assert events[0]["cls"] == "motorcycle"


def test_list_events_filters(tmp_path):
    conn = make_conn(tmp_path)
    vid = db.insert_video(conn, "kmitl", "x.mp4")
    db.insert_event(conn, vid, "kmitl", 1, "car", 1, 0.1, "warning")
    db.insert_event(conn, vid, "asok", 2, "motorcycle", 2, 0.2, "active")
    assert len(db.list_events(conn, site_id="kmitl")) == 1
    assert len(db.list_events(conn, cls="motorcycle")) == 1


def test_set_report(tmp_path):
    conn = make_conn(tmp_path)
    vid = db.insert_video(conn, "kmitl", "x.mp4")
    eid = db.insert_event(conn, vid, "kmitl", 1, "car", 1, 0.1, "warning")
    db.set_report(conn, eid, {"summary": "รายงาน", "fine": "ไม่เกิน 1,000 บาท"})
    ev = db.get_event(conn, eid)
    assert json.loads(ev["report_json"])["summary"] == "รายงาน"
