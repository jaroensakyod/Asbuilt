"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, DraftingCompass, FolderOpen, House, Plus, Search } from "lucide-react";
import { cx } from "@/components/ui";
import { houseModels, MODEL_TYPE_LABEL, projects, STATUS_LABEL } from "@/lib/data";
import { sheetIndex } from "@/lib/drawing";
import { PlanThumb } from "./blueprint-list";

export const dwgName = (code: string, name: string) => `${code}_${name.replace(/\s+/g, "-")}.dwg`;

export function CadLibrary() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [panel, setPanel] = useState<"open" | "asbuilt" | null>(null);
  const t = q.trim().toLowerCase();
  const list = houseModels.filter((m) => {
    if (!t) return true;
    const used = projects.filter((p) => p.modelCode === m.code);
    return `${dwgName(m.code, m.name)} ${m.nameTh} ${MODEL_TYPE_LABEL[m.type]} ${used.map((p) => `${p.id} ${p.name}`).join(" ")}`.toLowerCase().includes(t);
  });
  const btn = "flex h-10 w-full items-center gap-2.5 rounded-[8px] border border-[#2e2e31] bg-[#232325] px-3 text-left text-[14px] text-[#ededed] transition-colors duration-150 hover:bg-[#2b2b2e]";

  return (
    <div className="flex min-h-[calc(100vh-88px)] overflow-hidden rounded-[14px] border border-[#2e2e31] bg-[#141415] text-[#ededed]">
      <aside className="w-[280px] shrink-0 border-r border-[#2e2e31] bg-[#19191b] p-4">
        <div className="flex items-center gap-3 pb-5">
          <span className="grid size-10 place-items-center rounded-[10px] bg-[#232325] text-[#ededed]">
            <DraftingCompass size={20} strokeWidth={1.5} />
          </span>
          <div>
            <p className="text-[16px] font-medium leading-tight">CAD Viewer</p>
            <p className="text-[12px] text-[#a8a8ad]">DWG/DXF · แบบก่อสร้าง</p>
          </div>
        </div>
        <div className="space-y-2">
          <button type="button" className={btn} onClick={() => setPanel((p) => (p === "open" ? null : "open"))} aria-expanded={panel === "open"}>
            <FolderOpen size={16} strokeWidth={1.5} className="text-[#a8a8ad]" /> <span className="flex-1">เปิดแบบบ้าน (Open drawing)</span>
            <ChevronDown size={14} strokeWidth={1.5} className={cx("text-[#7c7c82] transition-transform duration-150", panel !== "open" && "-rotate-90")} />
          </button>
          {panel === "open" && (
            <div className="max-h-[260px] overflow-y-auto rounded-[8px] border border-[#2e2e31] bg-[#141415] py-1">
              {houseModels.map((m) => (
                <button key={m.code} type="button" onClick={() => router.push(`/cad/${m.code}`)} className="block w-full truncate px-3 py-1.5 text-left font-mono text-[12px] text-[#c9c9ce] transition-colors duration-150 hover:bg-[#232325]">
                  {dwgName(m.code, m.name)}
                </button>
              ))}
            </div>
          )}
          <button type="button" className={btn} onClick={() => setPanel((p) => (p === "asbuilt" ? null : "asbuilt"))} aria-expanded={panel === "asbuilt"}>
            <House size={16} strokeWidth={1.5} className="text-[#a8a8ad]" /> <span className="flex-1">แบบของโครงการ (As-built)</span>
            <ChevronDown size={14} strokeWidth={1.5} className={cx("text-[#7c7c82] transition-transform duration-150", panel !== "asbuilt" && "-rotate-90")} />
          </button>
          {panel === "asbuilt" && (
            <div className="max-h-[300px] overflow-y-auto rounded-[8px] border border-[#2e2e31] bg-[#141415] py-1">
              {projects.map((p) => (
                <Link key={p.id} href={`/cad/${p.modelCode}?project=${p.id}`} className="block px-3 py-1.5 transition-colors duration-150 hover:bg-[#232325]">
                  <span className="block truncate text-[13px]">{p.name}</span>
                  <span className="block font-mono text-[11px] text-[#7c7c82]">
                    {p.id} · {p.modelCode} · {STATUS_LABEL[p.status]}
                  </span>
                </Link>
              ))}
            </div>
          )}
          <button type="button" disabled className={cx(btn, "cursor-not-allowed text-[#7c7c82] hover:bg-[#232325]")} title="ไฟล์ในระบบเป็นแบบอ่านอย่างเดียว">
            <Plus size={16} strokeWidth={1.5} /> New drawing (read-only)
          </button>
        </div>
        <div className="mt-6 space-y-3 text-[13px] leading-relaxed text-[#a8a8ad]">
          <p>
            <span className="text-[#ededed]">เปิดดูไฟล์แบบ AutoCAD ของบ้านแต่ละหลัง</span> แบบสถาปัตย์ โครงสร้าง ไฟฟ้า สุขาภิบาล และปรับอากาศ ครบทุกแผ่น วางเรียงใน Model space ตามพิกัดจริง พร้อม Layout แผ่น A3 และตารางชื่อแบบ
          </p>
          <p>
            คำสั่ง CAD ที่ใช้ได้ <span className="font-mono text-[12px] text-[#ededed]">ZOOM, PAN, LAYER, DIST, AREA, ID, LIST, FIND, REGEN, HELP</span> · ดาวน์โหลด DXF · พิมพ์ Layout
          </p>
          <p>คลิกอุปกรณ์ในแบบเพื่อดูข้อมูลและแจ้งซ่อม หรือเปิดจากโครงการเพื่อดูแบบสร้างจริง</p>
        </div>
      </aside>

      <div className="min-w-0 flex-1 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
          <p className="text-[18px]">
            แบบบ้าน (Drawing sets) <span className="ml-2 text-[13px] text-[#7c7c82]">{list.length} แบบ · คลิกเพื่อเปิดไฟล์</span>
          </p>
          <label className="flex h-9 w-[300px] items-center gap-2 rounded-[8px] border border-[#2e2e31] bg-[#19191b] px-3 text-[#7c7c82] focus-within:border-[#4a4a4f]">
            <Search size={16} strokeWidth={1.5} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาแบบ / รหัส / โครงการ" className="w-full bg-transparent text-[13px] text-[#ededed] outline-none placeholder:text-[#7c7c82]" />
          </label>
        </div>
        {list.length === 0 && <p className="py-16 text-center text-[#a8a8ad]">ไม่พบไฟล์ที่ตรงกับ “{q}”</p>}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3">
          {list.map((m) => {
            const used = projects.filter((p) => p.modelCode === m.code);
            const built = used.filter((p) => p.status === "delivered" || p.status === "handover").length;
            return (
              <Link key={m.code} href={`/cad/${m.code}`} className="group overflow-hidden rounded-[10px] border border-[#2e2e31] bg-[#1d1d20] transition-[border-color,transform] duration-150 hover:border-[#4a4a4f] active:scale-[0.995]">
                <span className="relative block">
                  <PlanThumb code={m.code} className="aspect-[4/3]" />
                  <span className="absolute left-2 top-2 rounded-[4px] bg-[#232325] px-1.5 py-0.5 font-mono text-[11px] text-[#ededed]">{m.code}</span>
                </span>
                <span className="block px-3 py-2.5">
                  <span className="flex items-center gap-1.5 font-mono text-[12px] text-[#ededed]">
                    <DraftingCompass size={14} strokeWidth={1.5} className="shrink-0 text-[#7c7c82]" />
                    <span className="truncate">{dwgName(m.code, m.name)}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-[13px] text-[#c9c9ce]">{m.nameTh}</span>
                  <span className="mt-1 block text-[12px] text-[#7c7c82]">
                    {MODEL_TYPE_LABEL[m.type]} · {m.floors} ชั้น · {m.area.toLocaleString()} ตร.ม. · {sheetIndex(m.code).length} แผ่น{built ? ` · สร้างแล้ว ${built} หลัง` : used.length ? ` · กำลังสร้าง ${used.length} หลัง` : ""}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
