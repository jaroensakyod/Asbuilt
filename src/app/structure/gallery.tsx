"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Box, Columns2, Flame, House, ScanEye, Search, TriangleExclamationPoint } from "lucide-react";
import { Status, cx, inputCls } from "@/components/ui";
import { HouseThumb } from "@/components/house-thumb";
import { STATUS_LABEL, thDate, type ProjectStatus } from "@/lib/data";
import type { ProjectCard } from "@/lib/viewer-data";

type Tab = "all" | "building" | "delivered" | "planning";
const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "ทั้งหมด" },
  { key: "building", label: "กำลังก่อสร้าง" },
  { key: "delivered", label: "ส่งมอบแล้ว" },
  { key: "planning", label: "วางแผน" },
];

const inTab = (s: ProjectStatus, t: Tab) => t === "all" || (t === "building" ? s === "building" || s === "handover" : s === t);
const tone = (s: ProjectStatus) => (s === "delivered" ? "pos" : s === "planning" ? "neutral" : "warn");

const MODE_LINKS = [
  { mode: "real", label: "สมจริง", icon: House },
  { mode: "xray", label: "X-Ray", icon: ScanEye },
  { mode: "compare", label: "เปรียบเทียบ", icon: Columns2 },
  { mode: "heat", label: "Heatmap", icon: Flame },
] as const;

export function Gallery({ cards }: { cards: ProjectCard[] }) {
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");

  const counts = useMemo(() => Object.fromEntries(TABS.map((t) => [t.key, cards.filter((c) => inTab(c.status, t.key)).length])) as Record<Tab, number>, [cards]);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return cards.filter(
      (c) =>
        inTab(c.status, tab) &&
        (!s || [c.name, c.owner, c.id, c.model, c.modelCode, c.province].some((v) => v.toLowerCase().includes(s))),
    );
  }, [cards, tab, q]);

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-4">
        <div>
          <h2 className="text-[18px] font-medium">อาคารในโครงการ</h2>
          <p className="mt-1 text-[13px] text-ink-2">คลิกการ์ดเพื่อเปิดโมเดล หรือเลือกโหมดด้านล่างการ์ด</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-0.5 rounded-[10px] bg-raised p-0.5" role="tablist" aria-label="สถานะโครงการ">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={cx(
                  "flex h-8 items-center gap-1.5 rounded-[8px] px-3 text-[13px] transition-colors duration-150",
                  tab === t.key ? "bg-card text-ink shadow-[0_1px_2px_rgba(0,0,0,0.06),inset_0_0_0_1px_var(--line)]" : "text-ink-2 hover:text-ink",
                )}
              >
                {t.label}
                <span className="num font-mono text-[11px] text-ink-3">{counts[t.key]}</span>
              </button>
            ))}
          </div>
          <label className="relative block w-[280px]">
            <Search size={16} strokeWidth={1.5} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาโครงการ / ลูกค้า / แบบบ้าน" className={cx(inputCls, "w-full pl-8")} aria-label="ค้นหาโครงการ" />
          </label>
        </div>
      </div>

      {list.length === 0 ? (
        <p className="rounded-[14px] border border-line bg-card px-5 py-10 text-center text-ink-3">ไม่พบโครงการที่ตรงกับคำค้น</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {list.map((c) => (
            <li key={c.id} className="flex flex-col overflow-hidden rounded-[14px] border border-line bg-card transition-colors duration-150 hover:border-line-strong">
              <Link href={`/structure/${c.id}`} className="block flex-1">
                <div className="relative">
                  <HouseThumb code={c.modelCode} className="h-44 w-full" />
                  <span className="absolute left-3 top-3 rounded-[6px] bg-card/95 px-2 py-0.5">
                    <Status tone={tone(c.status)}>{STATUS_LABEL[c.status]}</Status>
                  </span>
                </div>
                <div className="px-4 pb-3 pt-3">
                  <p className="truncate text-[15px] font-medium">
                    {c.name} <span className="font-normal text-ink-3">· {c.model}</span>
                  </p>
                  <p className="mt-0.5 truncate text-[12px] text-ink-3">
                    <span className="font-mono">
                      {c.id} · {c.modelCode}
                    </span>{" "}
                    {c.model} · {c.province}
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="h-1.5 flex-1 rounded-full bg-raised">
                      <div className="h-1.5 rounded-full bg-ink" style={{ width: `${c.actual}%` }} />
                    </div>
                    <span className="num w-10 text-right font-mono text-[13px]">{c.actual}%</span>
                  </div>
                  <div className="mt-2.5 flex items-center gap-3 text-[12px] text-ink-3">
                    <span className="flex items-center gap-1.5" title="ชิ้นงานที่สร้างแล้ว / ทั้งหมด">
                      <Box size={16} strokeWidth={1.5} />
                      <span className="num font-mono">
                        {c.built.toLocaleString("th-TH")}/{c.total.toLocaleString("th-TH")}
                      </span>
                    </span>
                    {c.openRepairs > 0 && (
                      <span className="flex items-center gap-1 text-accent-text">
                        <TriangleExclamationPoint size={16} strokeWidth={1.5} />
                        แจ้งซ่อม {c.openRepairs}
                      </span>
                    )}
                    <span className="ml-auto whitespace-nowrap">
                      {c.dateLabel} <span className="num font-mono text-ink-2">{thDate(c.date)}</span>
                    </span>
                  </div>
                </div>
              </Link>
              <div className="grid grid-cols-4 border-t border-line">
                {MODE_LINKS.map((m) => {
                  const Icon = m.icon;
                  return (
                    <Link
                      key={m.mode}
                      href={`/structure/${c.id}?mode=${m.mode}`}
                      className="flex h-14 flex-col items-center justify-center gap-0.5 border-l border-line text-[12px] text-ink-2 transition-colors duration-150 first:border-l-0 hover:bg-raised hover:text-ink"
                    >
                      <Icon size={16} strokeWidth={1.5} />
                      {m.label}
                    </Link>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
