"use client";

import { useEffect, useState } from "react";
import { apiGet, artifactUrl, SITE_TH, VideoRow } from "@/lib/api";

export default function Videos() {
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    apiGet<VideoRow[]>("/videos").then(setVideos).catch((e) => setErr(String(e)));
  }, []);

  if (err) return <div className="text-accent">ผิดพลาด: {err}</div>;

  const done = videos.filter((v) => v.overlay);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">วิดีโอที่ประมวลผลแล้ว (พร้อม AI overlay)</h1>
      <p className="text-sm opacity-70">
        กรอบสี = ยานพาหนะที่ติดตาม · พื้นที่แดง = เขตทางรถไฟ · เส้นขาว = เส้นหยุด ·
        กรอบแดงหนา = ผู้ฝ่าฝืน
      </p>
      <div className="grid md:grid-cols-2 gap-4">
        {done.map((v) => (
          <div key={v.id} className="rounded-xl border border-border bg-panel p-3 space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="font-semibold">{SITE_TH[v.site_id] ?? v.site_id}</span>
              <span className="text-xs opacity-60">{v.segment || v.file}</span>
            </div>
            <video controls muted preload="metadata" className="rounded-lg w-full border border-border">
              <source src={artifactUrl(v.overlay)!} type="video/mp4" />
            </video>
          </div>
        ))}
        {done.length === 0 && (
          <div className="opacity-60">ยังไม่มีวิดีโอที่ประมวลผลเสร็จ</div>
        )}
      </div>
    </div>
  );
}
