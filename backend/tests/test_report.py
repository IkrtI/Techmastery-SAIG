import json

from app.rag.report import generate_report, answer_question


class FakeStore:
    def search(self, query, k=4):
        return [
            {"section": "มาตรา ๖๓", "text": "ห้ามขับรถผ่านเครื่องกั้นถนนขณะปิด", "score": 0.9},
            {"section": "มาตรา 148", "text": "ฝ่าฝืนปรับไม่เกินหนึ่งพันบาท", "score": 0.8},
        ]


class FakeLLM:
    def __init__(self):
        self.last_messages = None

    def complete(self, messages, **kw):
        self.last_messages = messages
        return json.dumps({
            "summary": "พบรถจักรยานยนต์ฝ่าเครื่องกั้น",
            "law_sections": [{"section": "มาตรา ๖๓", "text_excerpt": "ห้ามผ่านเครื่องกั้น"}],
            "fine": "ปรับไม่เกิน 1,000 บาท",
            "recommendation": "ติดตั้งกล้องเพิ่ม",
        }, ensure_ascii=False)


EVENT = {"site_id": "kmitl", "cls": "motorcycle", "ts_sec": 12.3, "state": "active"}


def test_report_prompt_contains_retrieved_law():
    llm = FakeLLM()
    generate_report(EVENT, FakeStore(), llm)
    user_msg = llm.last_messages[1]["content"]
    assert "มาตรา ๖๓" in user_msg
    assert "เครื่องกั้น" in user_msg


def test_report_parses_json_and_adds_citations():
    report = generate_report(EVENT, FakeStore(), FakeLLM())
    assert report["summary"].startswith("พบรถจักรยานยนต์")
    assert report["citations"][0]["section"] == "มาตรา ๖๓"


def test_report_extracts_json_from_noisy_output():
    class NoisyLLM(FakeLLM):
        def complete(self, messages, **kw):
            return "แน่นอนครับ นี่คือ JSON:\n```json\n" + super().complete(messages) + "\n```"

    report = generate_report(EVENT, FakeStore(), NoisyLLM())
    assert "summary" in report


def test_chat_answer_includes_citations():
    class ChatLLM(FakeLLM):
        def complete(self, messages, **kw):
            self.last_messages = messages
            return "ตามมาตรา ๖๓ ห้ามขับผ่านเครื่องกั้น"

    result = answer_question("ฝ่าเครื่องกั้นผิดไหม", FakeStore(), ChatLLM())
    assert "มาตรา ๖๓" in result["answer"]
    assert len(result["citations"]) == 2
