# ร่างคำตอบฟอร์มส่งงาน (Submit → Artificial Intelligence)

## เทคโนโลยีที่ใช้ (Model/Framework)

- **Computer Vision:** Ultralytics YOLO11s (COCO pretrained) + ByteTrack multi-object tracking บน Apple Silicon (MPS), OpenCV สำหรับ decode/annotate, crossing state machine (IDLE→WARNING→ACTIVE พร้อม temporal hysteresis) และ stop-line crossing geometry ที่เขียนเอง พร้อม unit tests
- **RAG:** PyMuPDF แปลงคู่มือกฎหมายจราจร → chunk ตามมาตรา → sentence-transformers (multilingual MiniLM) → numpy vector store → LLM ผ่าน OpenRouter (Qwen3-Next-80B / Gemma-4 / Llama-3.3 fallback chain) สร้างรายงานเหตุการณ์ภาษาไทยพร้อมอ้างมาตราและค่าปรับ โดยมี guardrail ห้ามแต่งเลขมาตรา/ค่าปรับเอง
- **Data:** pandas วิเคราะห์สถิติอุบัติเหตุ 151,778 รายการ (dataset 1) ขึ้นแดชบอร์ด
- **App:** FastAPI + SQLite (backend), Next.js 16 + Tailwind + Recharts (frontend ภาษาไทย), pytest 45 tests

## ความท้าทาย

1. ฟุตเทจจริงเป็นกล้องมือถือเดินถ่ายหลายมุม ไม่ใช่ CCTV นิ่ง — ต้องสร้างระบบคัดช่วงมุมกล้องคงที่อัตโนมัติ (YOLO coarse scan + NCC scene matching) แล้วผูก ROI ต่อช่วง
2. COCO จำแนกรถไฟตู้สินค้าด้านข้างเป็น "truck" — แก้ด้วย train-evidence heuristic (ยานพาหนะกว้างผิดปกติทับเขตราง + ตรวจขอบล่าง bbox + hysteresis) ที่อธิบายได้และวัดผลได้
3. PDF กฎหมายไทยสูญเสียวรรณยุกต์จาก toUnicode ที่ไม่ครบ และไม่มีมาตรา 62/63 ฉบับเต็ม — เสริม corpus ด้วยมาตราจริงจาก พ.ร.บ.จราจรทางบก 2522 และตรวจสอบกับแหล่งอ้างอิงภายนอก
4. Free-tier LLM ไม่เสถียร (404/429) — ทำ model fallback chain + honor Retry-After + cache รายงานใน DB
5. ข้อจำกัดเครื่อง (M1/16GB, ดิสก์เกือบเต็ม) — เลือกโมเดล embedding ที่เล็กลง, บีบอัด overlay, แยก subprocess ต่อ segment กัน MPS memory pressure

## สิ่งที่เรียนรู้

- Engineering กับข้อมูลจริงคือการจัดการ "ความไม่เรียบร้อย" ของข้อมูล มากกว่าการเลือกโมเดลที่ใหม่ที่สุด
- Heuristic ที่อธิบายได้ + การวัดผลที่ซื่อสัตย์ (P/R/F1 บน ground truth ที่ label เอง พร้อมประกาศข้อจำกัด) มีคุณค่ากว่าตัวเลข accuracy สวย ๆ ที่ตรวจสอบไม่ได้
- การออกแบบระบบให้ตรวจสอบย้อนได้ (หลักฐาน snapshot/clip + citation ทุกมาตราที่อ้าง) สำคัญมากสำหรับ AI ที่เกี่ยวข้องกับการบังคับใช้กฎหมาย

## ทำไมถึงอยากเข้าแล็บ SAIG?

(ร่าง — ปรับเป็นน้ำเสียงของตัวเองก่อนส่ง)
ผมสนใจการนำ AI ไปแก้ปัญหาที่จับต้องได้ในเมืองไทยจริง ๆ ไม่ใช่แค่บนชุดข้อมูลสังเคราะห์ โปรเจกต์นี้ทำให้เห็นว่าปัญหาที่น่าสนุกที่สุดอยู่ตรงรอยต่อระหว่างโมเดลกับโลกจริง — กล้องสั่น ข้อมูลสกปรก โมเดลไม่รู้จักรถไฟไทย — และผมอยากทำงานกับกลุ่มคนที่จริงจังกับรอยต่อนี้ SAIG มีทั้งโจทย์วิจัยและ ecosystem (KMITL อยู่ติดทางตัดรถไฟที่ผมใช้เป็นข้อมูลด้วยซ้ำ) ที่จะให้ผมต่อยอด RailGuard จาก prototype เป็นระบบที่ติดตั้งจริงได้
