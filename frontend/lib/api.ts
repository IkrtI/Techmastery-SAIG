export const API = process.env.NEXT_PUBLIC_API ?? "http://localhost:8000";

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API}/api${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

export function artifactUrl(rel: string | null): string | null {
  return rel ? `${API}/artifacts/${rel}` : null;
}

export interface LawSection {
  section: string;
  text_excerpt: string;
}

export interface Report {
  summary: string;
  law_sections: LawSection[];
  fine: string;
  recommendation: string;
  citations?: { section: string; score: number }[];
}

export interface Violation {
  id: number;
  video_id: number;
  site_id: string;
  track_id: number;
  cls: string;
  frame: number;
  ts_sec: number;
  state: string;
  snapshot: string | null;
  clip: string | null;
  report: Report | null;
}

export interface VideoRow {
  id: number;
  site_id: string;
  segment: string;
  file: string;
  status: string;
  overlay: string | null;
  fps: number;
  frames: number;
}

export interface Stats {
  violations: {
    total: number;
    by_class: { name: string; count: number }[];
    by_site: { name: string; count: number }[];
  };
  accidents: {
    total_accidents: number;
    total_fatalities: number;
    total_injuries: number;
    top_provinces: { name: string; count: number }[];
    top_causes: { name: string; count: number }[];
    by_vehicle: { name: string; count: number }[];
    by_hour: { hour: number; count: number }[];
    monthly: { month: string; count: number }[];
  } | null;
}

export const CLS_TH: Record<string, string> = {
  person: "คนเดินเท้า",
  bicycle: "จักรยาน",
  car: "รถยนต์",
  motorcycle: "รถจักรยานยนต์",
  bus: "รถโดยสาร",
  truck: "รถบรรทุก",
};

export const SITE_TH: Record<string, string> = {
  kmitl: "สจล. (ลาดกระบัง)",
  asok: "อโศก",
  donmueang: "ดอนเมือง",
  ram: "รามคำแหง",
};
