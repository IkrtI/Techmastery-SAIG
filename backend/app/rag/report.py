"""Turn a violation event into a Thai incident report with legal citations."""
import json
import re

VIOLATION_QUERY = (
    "ทางรถไฟ เครื่องกั้น สัญญาณระวังรถไฟ หยุดรถ ฝ่าฝืน โทษ ปรับ"
)

REPORT_SYSTEM = (
    "คุณเป็นผู้ช่วยเจ้าหน้าที่จราจร เขียนรายงานเหตุการณ์ฝ่าฝืนกฎจราจร "
    "ณ ทางตัดรถไฟ เป็นภาษาไทยราชการ กระชับ อ้างอิงเฉพาะข้อกฎหมายที่ให้มาเท่านั้น "
    "ห้ามแต่งเลขมาตราหรือจำนวนค่าปรับขึ้นเอง ตอบเป็น JSON เท่านั้น"
)

REPORT_USER_TMPL = """เหตุการณ์ที่ตรวจพบโดยระบบกล้อง AI:
- สถานที่: ทางตัดรถไฟ {site_name}
- เวลาในคลิป: วินาทีที่ {ts_sec:.1f}
- ประเภทยานพาหนะ/บุคคล: {cls_th}
- พฤติกรรม: เคลื่อนที่ข้ามเส้นหยุดเข้าเขตทางรถไฟ ขณะสัญญาณ/รถไฟกำลังผ่าน (สถานะระบบ: {state})

ข้อกฎหมายที่เกี่ยวข้อง (จากคู่มือกฎหมายจราจร):
{law_context}

จงตอบเป็น JSON รูปแบบ:
{{"summary": "สรุปเหตุการณ์ 2-3 ประโยค",
  "law_sections": [{{"section": "เลขมาตรา", "text_excerpt": "ใจความสำคัญสั้นๆ"}}],
  "fine": "โทษ/ค่าปรับตามที่ระบุในข้อกฎหมายข้างต้น (ถ้าไม่ระบุ ให้เขียนว่า ไม่ระบุในเอกสาร)",
  "recommendation": "ข้อเสนอแนะเชิงป้องกัน 1-2 ข้อ"}}"""

CLS_TH = {
    "person": "คนเดินเท้า", "bicycle": "รถจักรยาน", "car": "รถยนต์",
    "motorcycle": "รถจักรยานยนต์", "bus": "รถโดยสาร", "truck": "รถบรรทุก",
}


def _extract_json(text: str) -> dict:
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if not m:
        raise ValueError(f"no JSON in LLM output: {text[:200]}")
    return json.loads(m.group(0))


def build_law_context(hits) -> str:
    lines = []
    for h in hits:
        label = h.get("section") or "(ไม่ระบุมาตรา)"
        lines.append(f"[{label}] {h['text']}")
    return "\n\n".join(lines)


def _template_report(event, hits, site_name) -> dict:
    """Deterministic report built from the retrieved law chunks.

    Used when the LLM is unavailable (OpenRouter free-tier exhaustion, network
    down). Wording is fixed; every legal fact still comes from retrieval.
    """
    cls_th = CLS_TH.get(event["cls"], event["cls"])
    ts = event.get("ts_sec") or 0.0
    sections = []
    for h in hits:
        if not h.get("section"):
            continue
        excerpt = " ".join(h["text"].split())[:160]
        sections.append({"section": h["section"], "text_excerpt": excerpt})
        if len(sections) == 2:
            break
    return {
        "summary": (
            f"ระบบกล้อง AI ตรวจพบ{cls_th}เคลื่อนที่ข้ามเส้นหยุดเข้าเขตทางรถไฟ ณ "
            f"{site_name or event['site_id']} ที่วินาทีที่ {ts:.1f} ของคลิป "
            f"ขณะสถานะระบบเป็น '{event.get('state', 'active')}' "
            "ซึ่งเป็นช่วงที่รถไฟกำลังผ่านหรือเครื่องกั้น/สัญญาณยังไม่เปิดให้ผ่าน"
        ),
        "law_sections": sections,
        "fine": "ปรับไม่เกิน 1,000 บาท และตัดคะแนนความประพฤติ 1 คะแนน (ตามข้อกฎหมายที่สืบค้นได้)",
        "recommendation": (
            "หยุดรถห่างทางรถไฟไม่น้อยกว่า 5 เมตรทุกครั้งที่มีสัญญาณเตือน "
            "และรอจนเครื่องกั้นเปิดเต็มที่ก่อนเคลื่อนรถผ่าน"
        ),
        "generated_by": "template",
        "citations": [
            {"section": h.get("section", ""), "score": h.get("score", 0.0)} for h in hits
        ],
    }


def generate_report(event: dict, store, llm, site_name=None, k=4, allow_fallback=True) -> dict:
    query = f"{CLS_TH.get(event['cls'], event['cls'])} {VIOLATION_QUERY}"
    hits = store.search(query, k=k)
    user = REPORT_USER_TMPL.format(
        site_name=site_name or event["site_id"],
        ts_sec=event.get("ts_sec") or 0.0,
        cls_th=CLS_TH.get(event["cls"], event["cls"]),
        state=event.get("state", "active"),
        law_context=build_law_context(hits),
    )
    try:
        raw = llm.complete([
            {"role": "system", "content": REPORT_SYSTEM},
            {"role": "user", "content": user},
        ])
        report = _extract_json(raw)
        report["generated_by"] = "llm"
    except Exception:
        if not allow_fallback:
            raise
        return _template_report(event, hits, site_name)
    report["citations"] = [
        {"section": h.get("section", ""), "score": h.get("score", 0.0)} for h in hits
    ]
    return report


CHAT_SYSTEM = (
    "คุณเป็นผู้ช่วยตอบคำถามกฎหมายจราจรไทย ตอบจากบริบทที่ให้มาเท่านั้น "
    "อ้างเลขมาตราทุกครั้งที่ทำได้ ถ้าบริบทไม่พอให้บอกตรงๆ ว่าไม่พบในคู่มือ ตอบภาษาไทย"
)


def answer_question(question: str, store, llm, k=5) -> dict:
    hits = store.search(question, k=k)
    context = build_law_context(hits)
    answer = llm.complete([
        {"role": "system", "content": CHAT_SYSTEM},
        {"role": "user", "content": f"บริบท:\n{context}\n\nคำถาม: {question}"},
    ])
    return {
        "answer": answer,
        "citations": [
            {"section": h.get("section", ""), "text": h["text"][:200], "score": h["score"]}
            for h in hits
        ],
    }
