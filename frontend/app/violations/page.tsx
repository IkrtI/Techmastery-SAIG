"use client";

import { useEffect, useState } from "react";
import { API, apiGet, artifactUrl, CLS_TH, Report, SITE_TH, Violation } from "@/lib/api";

function fmtTime(ts: number) {
  const m = Math.floor(ts / 60);
  const s = (ts % 60).toFixed(1);
  return `${m}:${s.padStart(4, "0")} นาที`;
}

function ReportCard({ report }: { report: Report }) {
  return (
    <div className="space-y-3 text-sm">
      <div>
        <div className="font-semibold text-accent2 mb-1">สรุปเหตุการณ์</div>
        <p className="leading-relaxed">{report.summary}</p>
      </div>
      <div>
        <div className="font-semibold text-accent2 mb-1">ข้อกฎหมายที่เกี่ยวข้อง</div>
        <ul className="space-y-1.5">
          {report.law_sections?.map((s, i) => (
            <li key={i} className="border-l-2 border-accent pl-2">
              <span className="font-semibold">{s.section}</span> — {s.text_excerpt}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex gap-6">
        <div>
          <div className="font-semibold text-accent2 mb-1">โทษ/ค่าปรับ</div>
          <p>{report.fine}</p>
        </div>
      </div>
      {report.recommendation && (
        <div>
          <div className="font-semibold text-accent2 mb-1">ข้อเสนอแนะ</div>
          <p>{report.recommendation}</p>
        </div>
      )}
    </div>
  );
}

export default function Violations() {
  const [events, setEvents] = useState<Violation[]>([]);
  const [selected, setSelected] = useState<Violation | null>(null);
  const [genBusy, setGenBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = () =>
    apiGet<Violation[]>("/events").then(setEvents).catch((e) => setErr(String(e)));
  useEffect(() => { load(); }, []);

  async function generateReport(ev: Violation) {
    setGenBusy(true);
    try {
      const res = await fetch(`${API}/api/events/${ev.id}/report`);
      if (!res.ok) throw new Error(await res.text());
      const report = await res.json();
      setSelected({ ...ev, report });
      load();
    } catch (e) {
      setErr(String(e));
    } finally {
      setGenBusy(false);
    }
  }

  if (err) return <div className="text-accent">ผิดพลาด: {err}</div>;

  return (
    <div className="grid lg:grid-cols-[1fr_420px] gap-6">
      <div>
        <h1 className="text-2xl font-bold mb-4">เหตุฝ่าฝืนทางตัดรถไฟ ({events.length})</h1>
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-panel text-left">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">ภาพ</th>
                <th className="px-3 py-2">จุด</th>
                <th className="px-3 py-2">ประเภท</th>
                <th className="px-3 py-2">เวลาในคลิป</th>
                <th className="px-3 py-2">สถานะระบบ</th>
                <th className="px-3 py-2">รายงาน</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id}
                  onClick={() => setSelected(ev)}
                  className={`border-t border-border cursor-pointer hover:bg-panel/70 ${selected?.id === ev.id ? "bg-panel" : ""}`}>
                  <td className="px-3 py-2 tabular-nums">{ev.id}</td>
                  <td className="px-3 py-2">
                    {ev.snapshot && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={artifactUrl(ev.snapshot)!} alt="" className="h-10 w-16 object-cover rounded" />
                    )}
                  </td>
                  <td className="px-3 py-2">{SITE_TH[ev.site_id] ?? ev.site_id}</td>
                  <td className="px-3 py-2">{CLS_TH[ev.cls] ?? ev.cls}</td>
                  <td className="px-3 py-2 tabular-nums">{fmtTime(ev.ts_sec)}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${ev.state === "active" ? "bg-accent/20 text-accent" : "bg-amber-400/20 text-amber-300"}`}>
                      {ev.state === "active" ? "รถไฟกำลังผ่าน" : "เตือนรถไฟใกล้ถึง"}
                    </span>
                  </td>
                  <td className="px-3 py-2">{ev.report ? "✓" : "—"}</td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-8 text-center opacity-60">ยังไม่มีเหตุฝ่าฝืน — ประมวลผลวิดีโอก่อน</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <aside className="lg:sticky lg:top-20 h-fit">
        {selected ? (
          <div className="rounded-xl border border-border bg-panel p-4 space-y-4">
            <h2 className="font-semibold">
              เหตุการณ์ #{selected.id} · {SITE_TH[selected.site_id] ?? selected.site_id} · {CLS_TH[selected.cls] ?? selected.cls}
            </h2>
            {selected.snapshot && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={artifactUrl(selected.snapshot)!} alt="snapshot" className="rounded-lg border border-border w-full" />
            )}
            {selected.clip && (
              <video key={selected.clip} controls muted className="rounded-lg border border-border w-full">
                <source src={artifactUrl(selected.clip)!} type="video/mp4" />
              </video>
            )}
            {selected.report ? (
              <ReportCard report={selected.report} />
            ) : (
              <button
                onClick={() => generateReport(selected)}
                disabled={genBusy}
                className="w-full rounded-lg bg-accent/90 hover:bg-accent disabled:opacity-50 py-2 font-semibold">
                {genBusy ? "กำลังสร้างรายงาน..." : "สร้างรายงาน + อ้างข้อกฎหมาย (AI)"}
              </button>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-8 text-center opacity-60">
            เลือกเหตุการณ์จากตารางเพื่อดูหลักฐานและรายงาน
          </div>
        )}
      </aside>
    </div>
  );
}
