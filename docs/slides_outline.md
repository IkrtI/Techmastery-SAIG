# Slides Outline — RailGuard AI (10-12 สไลด์)

1. **Hook** — คลิปข่าวรถชนรถไฟที่ทางตัดวัดใจ + ตัวเลขจาก dataset 1:
   อุบัติเหตุ 151,778 ครั้ง เสียชีวิต 20,736 ราย (ชุดข้อมูลทั่วประเทศ)
   สาเหตุอันดับ 1 = พฤติกรรมฝ่าฝืน (ขับเร็วเกินกำหนด 100k+ ครั้ง)
2. **Pain point** — ทางตัดรถไฟ: ฝ่าเครื่องกั้นเป็นเรื่องปกติ ไม่มีหลักฐาน ไม่มี enforcement
   ไม่มีข้อมูลให้ รฟท./ตำรวจวางแผน
3. **Solution: RailGuard AI** — กล้อง + AI = ตรวจจับ → บันทึกหลักฐาน → อ้างมาตรา + ค่าปรับอัตโนมัติ → แดชบอร์ด
   (demo screenshot แดชบอร์ด)
4. **Multi-modal datasets** — วิดีโอ 4 ทางตัด (dataset 4) + คู่มือกฎหมาย PDF (dataset 3) + สถิติอุบัติเหตุ (dataset 1)
5. **CV Pipeline** — แผนภาพ: YOLO11 → ByteTrack → Crossing State Machine (IDLE/WARNING/ACTIVE) →
   stop-line crossing detection → snapshot + clip + DB
6. **สู้กับข้อมูลจริง #1** — COCO ไม่รู้จักรถไฟตู้สินค้า (เห็นเป็น truck)
   → train-evidence heuristic: ยานพาหนะกว้างผิดปกติทับเขตราง + temporal hysteresis
   (ภาพเทียบ: containers detected as truck / heuristic จับเป็นรถไฟ)
7. **สู้กับข้อมูลจริง #2** — ฟุตเทจมือถือเดินเปลี่ยนมุมตลอด → segment curation อัตโนมัติ
   (YOLO coarse scan หาช่วงรถไฟผ่าน + NCC scene matching) + ROI ต่อ segment
8. **RAG กฎหมาย** — PDF → chunk ตามมาตรา → embeddings → retrieve → LLM สร้างรายงานไทย
   guardrail: ห้ามแต่งเลขมาตรา/ค่าปรับ + เสริม corpus มาตรา 62/63 ที่ PDF ไม่มี
   (screenshot รายงานเหตุการณ์ + law chat)
9. **Accuracy** — ตาราง P/R/F1 ต่อ segment จาก eval notebook + วิธี label ground truth
   + ข้อจำกัดที่ประกาศ (curated segments, single annotator)
10. **Demo** — วิดีโอ overlay (zone แดง/เส้นหยุด/กรอบผู้ฝ่าฝืน) + แดชบอร์ด + รายงาน AI
11. **Impact & ต่อยอด** — ติด CCTV ถาวรที่ทางตัดวัดใจ 600+ จุดทั่วไทย, ส่งหลักฐานเข้าระบบใบสั่งอิเล็กทรอนิกส์,
    แจ้งเตือนเรียลไทม์ผ่านป้าย/ไซเรน, ขยายไปทางม้าลาย/ฝ่าไฟแดง
12. **ทีม + สิ่งที่เรียนรู้** — วิศวกรรมกับข้อมูลจริง ≠ ตำรา, explainable heuristics ชนะ fine-tune เมื่อเวลาจำกัด
