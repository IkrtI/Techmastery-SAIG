from app.rag.ingest import chunk_law_text

THAI_LAW = (
    "มาตรา ๖๒ ในทางเดินรถตอนใดที่มีทางรถไฟผ่าน ถ้าปรากฏว่ามีเครื่องหมายหรือสัญญาณระวังรถไฟแสดงว่า"
    "รถไฟกำลังจะผ่าน ผู้ขับขี่ต้องลดความเร็วของรถและหยุดรถให้ห่างจากทางรถไฟไม่น้อยกว่าห้าเมตร "
    "มาตรา ๖๓ ในขณะที่ผู้ขับขี่รถผ่านทางรถไฟ ห้ามมิให้ผู้ขับขี่ขับรถผ่านเครื่องกั้นถนน "
    "มาตรา 148 ผู้ใดฝ่าฝืนหรือไม่ปฏิบัติตาม ต้องระวางโทษปรับไม่เกินหนึ่งพันบาท"
)


def test_splits_on_matra_headers():
    chunks = chunk_law_text(THAI_LAW)
    sections = [c.section for c in chunks]
    assert "มาตรา ๖๒" in sections
    assert "มาตรา ๖๓" in sections
    assert "มาตรา 148" in sections


def test_chunk_text_carries_full_section_body():
    chunks = chunk_law_text(THAI_LAW)
    m62 = next(c for c in chunks if c.section == "มาตรา ๖๒")
    assert "ห้าเมตร" in m62.text


def test_long_sections_are_split_with_overlap():
    long_text = "มาตรา ๙๙ " + "ก" * 3000
    chunks = chunk_law_text(long_text)
    assert len(chunks) >= 3
    assert all(len(c.text) <= 1200 for c in chunks)
    assert all(c.section == "มาตรา ๙๙" for c in chunks)


def test_plain_text_falls_back_to_paragraphs():
    text = ("ย่อหน้าแรกที่ยาวพอสมควรสำหรับการทดสอบระบบแบ่งข้อความนี้\n\n"
            "ย่อหน้าที่สองที่ยาวพอสมควรสำหรับการทดสอบระบบแบ่งข้อความนี้")
    chunks = chunk_law_text(text)
    assert len(chunks) == 2
    assert all(c.section == "" for c in chunks)
