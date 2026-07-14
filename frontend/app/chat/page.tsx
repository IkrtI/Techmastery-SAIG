"use client";

import { useRef, useState } from "react";
import { apiPost } from "@/lib/api";

interface Citation { section: string; text: string; score: number }
interface Msg { role: "user" | "assistant"; text: string; citations?: Citation[] }

const SUGGESTIONS = [
  "ฝ่าเครื่องกั้นทางรถไฟ โทษเท่าไหร่",
  "ขับรถผ่านทางรถไฟที่ไม่มีเครื่องกั้นต้องทำอย่างไร",
  "เมาแล้วขับ โทษปรับเท่าไหร่",
  "จอดรถบนทางเท้าผิดไหม",
];

export default function Chat() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function ask(q: string) {
    if (!q.trim() || busy) return;
    setMsgs((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setBusy(true);
    try {
      const res = await apiPost<{ answer: string; citations: Citation[] }>("/chat", { question: q });
      setMsgs((m) => [...m, { role: "assistant", text: res.answer, citations: res.citations }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", text: `ขออภัย เกิดข้อผิดพลาด: ${e}` }]);
    } finally {
      setBusy(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">ผู้ช่วยกฎหมายจราจร (RAG)</h1>
        <p className="text-sm opacity-70 mt-1">
          ตอบจากคู่มือกฎหมายจราจรไทย + พ.ร.บ.จราจรทางบก พ.ศ. 2522 พร้อมอ้างอิงมาตรา
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button key={s} onClick={() => ask(s)}
            className="text-xs rounded-full border border-border px-3 py-1.5 hover:bg-panel transition-colors">
            {s}
          </button>
        ))}
      </div>

      <div className="space-y-4 min-h-[300px]">
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : ""}>
            <div className={`inline-block rounded-xl px-4 py-2.5 max-w-[85%] text-sm whitespace-pre-wrap text-left ${
              m.role === "user" ? "bg-accent2/20" : "bg-panel border border-border"}`}>
              {m.text}
              {m.citations && m.citations.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border flex flex-wrap gap-1.5">
                  {m.citations.filter((c) => c.section).slice(0, 4).map((c, j) => (
                    <span key={j} title={c.text}
                      className="text-[11px] rounded bg-accent/15 text-accent px-1.5 py-0.5">
                      {c.section}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && <div className="opacity-60 text-sm animate-pulse">กำลังค้นกฎหมายและเรียบเรียงคำตอบ...</div>}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); ask(input); }}
        className="sticky bottom-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="ถามข้อกฎหมายจราจร..."
          className="flex-1 rounded-xl border border-border bg-panel px-4 py-2.5 text-sm outline-none focus:border-accent2" />
        <button disabled={busy || !input.trim()}
          className="rounded-xl bg-accent2/90 hover:bg-accent2 text-black font-semibold px-5 disabled:opacity-40">
          ถาม
        </button>
      </form>
    </div>
  );
}
