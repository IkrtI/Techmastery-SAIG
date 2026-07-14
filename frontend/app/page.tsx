"use client";

import { useEffect, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { apiGet, CLS_TH, SITE_TH, Stats } from "@/lib/api";

const COLORS = ["#f43f5e", "#38bdf8", "#fbbf24", "#34d399", "#a78bfa", "#fb923c"];

function Kpi({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-panel p-4">
      <div className="text-xs opacity-70">{label}</div>
      <div className={`text-3xl font-bold mt-1 ${tone ?? ""}`}>{value}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-panel p-4">
      <h2 className="text-sm font-semibold mb-3 opacity-80">{title}</h2>
      {children}
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    apiGet<Stats>("/stats").then(setStats).catch((e) => setErr(String(e)));
  }, []);

  if (err) return <div className="text-accent">เชื่อมต่อ backend ไม่ได้: {err}</div>;
  if (!stats) return <div className="opacity-60">กำลังโหลด...</div>;

  const v = stats.violations;
  const a = stats.accidents;
  const byClass = v.by_class.map((d) => ({ ...d, name: CLS_TH[d.name] ?? d.name }));
  const bySite = v.by_site.map((d) => ({ ...d, name: SITE_TH[d.name] ?? d.name }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">แดชบอร์ดความปลอดภัยทางตัดรถไฟ</h1>
        <p className="text-sm opacity-70 mt-1">
          ตรวจจับผู้ฝ่าฝืนขณะรถไฟกำลังผ่านด้วย Computer Vision + อ้างข้อกฎหมายอัตโนมัติด้วย RAG
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="เหตุฝ่าฝืนที่ตรวจพบ" value={v.total} tone="text-accent" />
        <Kpi label="จุดทางตัดที่เฝ้าระวัง" value={v.by_site.length} tone="text-accent2" />
        <Kpi label="อุบัติเหตุทั่วประเทศ (ชุดข้อมูล)" value={a ? a.total_accidents.toLocaleString() : "-"} />
        <Kpi label="ผู้เสียชีวิตรวม" value={a ? a.total_fatalities.toLocaleString() : "-"} tone="text-amber-400" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Panel title="เหตุฝ่าฝืนตามประเภทผู้ใช้ทาง">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={byClass}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2630" />
              <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <Tooltip contentStyle={{ background: "#11161d", border: "1px solid #1e2630" }} />
              <Bar dataKey="count">
                {byClass.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="เหตุฝ่าฝืนตามจุดทางตัด">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={bySite}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2630" />
              <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <Tooltip contentStyle={{ background: "#11161d", border: "1px solid #1e2630" }} />
              <Bar dataKey="count">
                {bySite.map((_, i) => <Cell key={i} fill={COLORS[(i + 1) % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      {a && (
        <div className="grid md:grid-cols-2 gap-4">
          <Panel title="อุบัติเหตุรายชั่วโมง (ทั่วประเทศ)">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={a.by_hour}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2630" />
                <XAxis dataKey="hour" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                <Tooltip contentStyle={{ background: "#11161d", border: "1px solid #1e2630" }} />
                <Line type="monotone" dataKey="count" stroke="#38bdf8" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="สาเหตุอุบัติเหตุอันดับต้น">
            <ul className="space-y-2 text-sm">
              {a.top_causes.slice(0, 6).map((c, i) => (
                <li key={c.name} className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="opacity-70 tabular-nums">{c.count.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}
    </div>
  );
}
