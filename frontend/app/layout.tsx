import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "RailGuard AI — ตรวจจับผู้ฝ่าฝืนทางตัดรถไฟ",
  description: "AI ตรวจจับผู้ฝ่าฝืนทางตัดรถไฟ พร้อมอ้างอิงข้อกฎหมายอัตโนมัติ",
};

const NAV = [
  { href: "/", label: "แดชบอร์ด" },
  { href: "/violations", label: "เหตุฝ่าฝืน" },
  { href: "/videos", label: "วิดีโอ" },
  { href: "/chat", label: "ถามกฎหมาย" },
];

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="border-b border-border bg-panel/80 backdrop-blur sticky top-0 z-20">
          <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight">
              <span className="inline-block h-3 w-3 rounded-full bg-accent animate-pulse" />
              RailGuard <span className="text-accent2">AI</span>
            </Link>
            <nav className="flex gap-1 text-sm">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href}
                  className="px-3 py-1.5 rounded-md hover:bg-border/60 transition-colors">
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl w-full px-4 py-6 flex-1">{children}</main>
        <footer className="border-t border-border py-4 text-center text-xs opacity-60">
          RailGuard AI — Smart Mobility Challenge (SAIG) · ข้อมูล: ทางตัดรถไฟ 4 จุดใน กทม.
        </footer>
      </body>
    </html>
  );
}
