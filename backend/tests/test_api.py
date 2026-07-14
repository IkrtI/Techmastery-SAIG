import json

import pytest
from fastapi.testclient import TestClient

from app import db as dbmod
from app.main import create_app


@pytest.fixture
def client(tmp_path, monkeypatch):
    app = create_app()
    app.state.db = dbmod.connect(tmp_path / "test.db")
    return TestClient(app)


class FakeStore:
    def search(self, query, k=4):
        return [{"section": "มาตรา ๖๓", "text": "ห้ามขับรถผ่านเครื่องกั้น", "score": 0.9}]


class FakeLLM:
    def complete(self, messages, **kw):
        return json.dumps({
            "summary": "รายงานทดสอบ", "law_sections": [], "fine": "-", "recommendation": "-",
        }, ensure_ascii=False)


def seed_event(client):
    conn = client.app.state.db
    vid = dbmod.insert_video(conn, "kmitl", "x.mp4")
    return dbmod.insert_event(conn, vid, "kmitl", 1, "motorcycle", 100, 3.3, "active")


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_list_events_empty(client):
    assert client.get("/api/events").json() == []


def test_list_events_and_filter(client):
    seed_event(client)
    events = client.get("/api/events").json()
    assert len(events) == 1
    assert events[0]["cls"] == "motorcycle"
    assert client.get("/api/events", params={"site_id": "nowhere"}).json() == []


def test_event_report_generated_and_cached(client):
    eid = seed_event(client)
    client.app.state.rag_store = FakeStore()
    client.app.state.llm = FakeLLM()
    r = client.get(f"/api/events/{eid}/report")
    assert r.status_code == 200
    assert r.json()["summary"] == "รายงานทดสอบ"
    # cached in DB now
    ev = client.get(f"/api/events/{eid}").json()
    assert ev["report"]["summary"] == "รายงานทดสอบ"


def test_chat(client):
    client.app.state.rag_store = FakeStore()

    class ChatLLM:
        def complete(self, messages, **kw):
            return "ตอบตามมาตรา ๖๓"

    client.app.state.llm = ChatLLM()
    r = client.post("/api/chat", json={"question": "ฝ่าเครื่องกั้นผิดไหม"})
    assert r.status_code == 200
    body = r.json()
    assert "มาตรา ๖๓" in body["answer"]
    assert body["citations"]


def test_stats_shape(client):
    seed_event(client)
    body = client.get("/api/stats").json()
    assert body["violations"]["total"] == 1
    assert body["violations"]["by_class"][0]["name"] == "motorcycle"


def test_job_validation(client):
    r = client.post("/api/jobs", json={"video": "missing.mp4", "site": "kmitl"})
    assert r.status_code == 400
