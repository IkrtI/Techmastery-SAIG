# RailGuard AI 🚂 — ระบบตรวจจับผู้ฝ่าฝืนทางตัดรถไฟ + อ้างข้อกฎหมายอัตโนมัติ

> Smart Mobility Challenge (Hack the Streets with AI) — สาย Artificial Intelligence, SAIG Lab

**Pain point:** ทางตัดรถไฟ "วัดใจ" ในไทยมีผู้ฝ่าเครื่องกั้น/ฝ่าสัญญาณขณะรถไฟกำลังมาเป็นประจำ
ไม่มีระบบบันทึกหลักฐาน ไม่มีการเชื่อมโยงข้อกฎหมาย และไม่มีข้อมูลเชิงสถิติสำหรับหน่วยงาน

**RailGuard AI** เปลี่ยนกล้องธรรมดาที่ทางตัดให้เป็นระบบเฝ้าระวังอัจฉริยะ:
ตรวจจับยานพาหนะ/คนที่ข้ามเส้นหยุดขณะรถไฟกำลังผ่านด้วย Computer Vision
แล้วสร้างรายงานเหตุการณ์ภาษาไทยพร้อมอ้างอิงมาตราและค่าปรับอัตโนมัติด้วย RAG

## Datasets ที่ใช้ (จากโจทย์)

| Dataset | บทบาท |
|---|---|
| **4. ฟุตเทจวิดีโอทางตัดรถไฟ (MP4)** | แกนหลัก — object detection + tracking + violation logic (4 จุด: สจล./อโศก/ดอนเมือง/รามคำแหง) |
| **3. คู่มือกฎหมายจราจรไทย (PDF)** | RAG corpus — ตอบข้อกฎหมาย + อ้างมาตราในรายงานเหตุการณ์ |
| **1. สถิติอุบัติเหตุทั่วประเทศ (CSV)** | แดชบอร์ดสถิติ + EDA สนับสนุน narrative ความเสี่ยง |

## Architecture

```
วิดีโอทางตัด ─► YOLO11s (MPS) ─► ByteTrack ─► Crossing State Machine ─► Violation Events
                    │                              ▲                        │ snapshot/clip/SQLite
                    └─ train-evidence heuristic ───┘                        ▼
กฎหมายจราจร.pdf ─► มาตรา-aware chunking ─► multilingual embeddings ─► Vector Store ─► LLM (OpenRouter)
                                                                          │
   FastAPI  ◄──────────────────────────────────────────────────────────── รายงานไทย + มาตรา + ค่าปรับ
     ▲
   Next.js dashboard (แดชบอร์ด / เหตุฝ่าฝืน / วิดีโอ overlay / ถามกฎหมาย)
```

### เทคนิคเด่น (สิ่งที่ต้องสู้กับข้อมูลจริง)

1. **Train-evidence heuristic** — COCO มองตู้สินค้าด้านข้างเป็น `truck` ไม่ใช่ `train`
   → ใช้กติกา "ยานพาหนะกว้าง ≥ N px ที่ทับเขตราง" + ตรวจขอบล่าง bbox (ล้อ) + temporal hysteresis
2. **Crossing State Machine** — `IDLE → WARNING → ACTIVE → clear` ด้วย streak แบบ hysteresis
   กันสัญญาณหลอกจาก detection กระพริบ
3. **Curated segments + scene matcher** — ฟุตเทจต้นฉบับเป็นกล้องมือถือเดินเปลี่ยนมุม
   → ระบุช่วงมุมกล้องคงที่ต่อจุด (สแกนอัตโนมัติด้วย YOLO coarse scan + NCC top-band) แล้วผูก ROI ต่อช่วง
4. **RAG แบบ hybrid corpus** — PDF ที่ให้มาไม่มีมาตรา 62/63 (ทางรถไฟ) ฉบับเต็ม
   → เสริม corpus ด้วยมาตราจริงจาก พ.ร.บ.จราจรทางบก 2522 พร้อม prompt ที่ห้ามแต่งเลขมาตรา/ค่าปรับเอง
5. **Per-segment subprocess isolation** — กัน MPS memory pressure ทำให้ detection เพี้ยนเมื่อรันหลาย segment ต่อเนื่อง

## Stack

- **CV:** ultralytics YOLO11s (COCO pretrained), ByteTrack, OpenCV — รันบน Apple Silicon MPS
- **RAG:** PyMuPDF, sentence-transformers (multilingual MiniLM), numpy vector store, OpenRouter (Qwen3/Gemma/Llama fallback chain)
- **Backend:** FastAPI + SQLite · **Frontend:** Next.js 16 + Tailwind + Recharts (ภาษาไทยทั้งระบบ)
- **Eval:** human-reviewed verdict ต่อ event — **precision 0.81 (26 TP / 6 FP จาก 32 เหตุการณ์, 4 จุดทางตัด)** + วิเคราะห์ recall เชิงคุณภาพ (`notebooks/eval.ipynb`)

## Run

```bash
# backend (Python 3.9+)
cd backend && python3 -m venv .venv39 && ./.venv39/bin/pip install -r requirements.txt
cp ../.env.example ../.env   # ใส่ OPENROUTER_API_KEY

./.venv39/bin/python scripts/ingest_law.py          # สร้าง RAG store
./.venv39/bin/python scripts/batch_process.py --fresh  # ประมวลผลวิดีโอทุก segment
./.venv39/bin/python -m uvicorn app.main:app --port 8000

# frontend
cd frontend && npm install && npm run dev   # http://localhost:3000
```

Tests: `cd backend && ./.venv39/bin/python -m pytest tests/` (45 tests)

## ความท้าทายและสิ่งที่เรียนรู้

- **ข้อมูลจริงไม่เหมือนโจทย์ในตำรา:** ฟุตเทจเป็นกล้องมือถือหลายมุม/หลายช่วงเวลา ไม่ใช่ CCTV นิ่ง —
  ต้องออกแบบ segment curation + scene gating แทนการสมมติมุมคงที่
- **ขีดจำกัดของ pretrained model:** COCO ไม่รู้จักรถไฟสินค้าด้านข้าง → แก้ด้วย domain heuristic ที่อธิบายได้
  แทนการ fine-tune ที่ต้องใช้ label จำนวนมากภายในเวลาจำกัด
- **PDF ภาษาไทยสูญเสียวรรณยุกต์:** toUnicode mapping ไม่ครบ → ยอมรับ + เสริม corpus สะอาดเฉพาะหมวดทางรถไฟ
- **Free-tier LLM ไม่เสถียร:** ออกแบบ fallback chain หลายโมเดล + honor Retry-After + cache รายงานใน DB

## ข้อจำกัดที่ประกาศไว้ (honesty)

- ประเมินผลบน curated segments (มุมกล้องคงที่) — production จริงต้องใช้กล้องติดตั้งถาวร
- Ground truth label โดย annotator เดียว
- ตัวเลขค่าปรับอ้างอิงคู่มือ + พ.ร.บ. ฉบับหลัก ควรตรวจทานกับฉบับแก้ไขล่าสุดก่อนใช้จริง
