import pytest

from app.rag.report import generate_report


class FakeStore:
    def search(self, query, k=4):
        return [
            {"section": "มาตรา 62", "text": "ต้องหยุดรถห่างทางรถไฟไม่น้อยกว่าห้าเมตร", "score": 0.9},
            {"section": "มาตรา 63", "text": "ปรับไม่เกินหนึ่งพันบาท", "score": 0.8},
        ]


class DeadLLM:
    def complete(self, messages, **kw):
        raise RuntimeError("all OpenRouter models failed: 429")


EVENT = {"site_id": "ram", "cls": "motorcycle", "ts_sec": 12.3, "state": "active"}


def test_falls_back_to_template_when_llm_dead():
    report = generate_report(EVENT, FakeStore(), DeadLLM(), site_name="ทางตัดรถไฟรามคำแหง")
    assert report["generated_by"] == "template"
    assert "รถจักรยานยนต์" in report["summary"]
    assert [s["section"] for s in report["law_sections"]] == ["มาตรา 62", "มาตรา 63"]
    assert report["citations"]


def test_fallback_can_be_disabled():
    with pytest.raises(RuntimeError):
        generate_report(EVENT, FakeStore(), DeadLLM(), allow_fallback=False)
