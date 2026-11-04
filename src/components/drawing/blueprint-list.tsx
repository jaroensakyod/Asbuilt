"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { cx } from "@/components/ui";
import { houseModels, MODEL_TYPE_LABEL, projects } from "@/lib/data";
import { getSheet, sheetIndex, THEME, thumbDataUrl } from "@/lib/drawing";
import { useIsClient } from "./shared";

export function PlanThumb({ code, theme = "paper", className }: { code: string; theme?: "paper" | "blueprint"; className?: string }) {
  const client = useIsClient();
  const src = useMemo(() => {
    if (!client) return null;
    const s = getSheet(code, "A-101");
    return s ? thumbDataUrl(s, THEME[theme], true) : null;
  }, [client, code, theme]);
  return (
    <span className={cx("block overflow-hidden", className)} style={{ background: THEME[theme].bg }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src && <img src={src} alt={`แปลนพื้นชั้น 1 ${code}`} className="h-full w-full object-contain p-3" />}
    </span>
  );
}

export function BlueprintList() {
  const [q, setQ] = useState("");
  const rows = useMemo(
    () =>
      houseModels.map((m) => ({
        m,
        sheets: sheetIndex(m.code).length,
        used: projects.filter((p) => p.modelCode === m.code),
      })),
    [],
  );
  const t = q.trim().toLowerCase();
  const list = rows.filter(({ m, used }) => !t || `${m.code} ${m.name} ${m.nameTh} ${MODEL_TYPE_LABEL[m.type]} ${m.style} ${used.map((p) => p.id + " " + p.name).join(" ")}`.toLowerCase().includes(t));
  const total = rows.reduce((s, r) => s + r.sheets, 0);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
        <div>
          <p className="mb-1 text-[13px] text-ink-3">แบบก่อสร้าง</p>
          <h1 className="text-[30px] font-normal leading-[1.15]">ชุดแบบบ้าน</h1>
          <p className="mt-2 max-w-[44rem] text-ink-2">
            แบบสถาปัตย์ โครงสร้าง ไฟฟ้า สุขาภิบาล และปรับอากาศ ของแบบบ้านทุกรุ่น <span className="font-mono">{houseModels.length}</span> ชุด รวม <span className="font-mono">{total}</span> แผ่น คลิกอุปกรณ์ในแบบเพื่อดูข้อมูลและแจ้งซ่อม
          </p>
        </div>
        <label className="flex h-9 w-[320px] items-center gap-2 rounded-[8px] border border-line-strong bg-card px-3 text-ink-3 focus-within:border-ink-3">
          <Search size={16} strokeWidth={1.5} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาแบบ รหัส หรือโครงการ" className="w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-3" />
        </label>
      </div>
      {list.length === 0 ? (
        <p className="rounded-[14px] border border-line bg-card px-5 py-10 text-center text-ink-2">ไม่พบชุดแบบที่ตรงกับ “{q}”</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(290px,1fr))] gap-4">
          {list.map(({ m, sheets, used }) => (
            <Link key={m.code} href={`/blueprint/${m.code}`} className="group overflow-hidden rounded-[14px] border border-line bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-[border-color,transform] duration-150 hover:border-line-strong active:scale-[0.995]">
              <span className="relative block border-b border-line">
                <PlanThumb code={m.code} className="aspect-[16/10]" />
                <span className="absolute left-3 top-3 rounded-[4px] bg-ink px-1.5 py-0.5 font-mono text-[12px] text-card">{m.code}</span>
                <span className="absolute right-3 top-3 rounded-[4px] border border-line-strong bg-card px-1.5 py-0.5 font-mono text-[12px] text-ink-2">A-101</span>
              </span>
              <span className="block px-4 py-3">
                <span className="block text-[15px] font-medium">{m.name}</span>
                <span className="block truncate text-[13px] text-ink-2">{m.nameTh}</span>
                <span className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-ink-3">
                  <span>
                    <span className="font-mono text-ink-2">{sheets}</span> แผ่น
                  </span>
                  <span>{MODEL_TYPE_LABEL[m.type]}</span>
                  <span>{m.floors} ชั้น</span>
                  <span>
                    <span className="font-mono">{m.area.toLocaleString()}</span> ตร.ม.
                  </span>
                </span>
                <span className="mt-2 flex items-center gap-1.5 border-t border-line pt-2 text-[12px] text-ink-3">
                  {used.length ? (
                    <>
                      ใช้ใน <span className="font-mono text-ink-2">{used.length}</span> โครงการ
                      <span className="truncate font-mono">· {used.slice(0, 3).map((p) => p.id).join(", ")}{used.length > 3 ? " …" : ""}</span>
                    </>
                  ) : (
                    "ยังไม่มีโครงการที่ใช้แบบนี้"
                  )}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
