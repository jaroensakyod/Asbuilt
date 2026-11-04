"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft } from "lucide-react";
import { cx, Keycap } from "@/components/ui";
import { NAV } from "./sidebar";
import { projects, houseModels, getProject } from "@/lib/data";
import { useInspections, useRepairs, useWorkOrders } from "@/lib/ops-store";
import type { OpsInspection, OpsRepair, OpsWorkOrder } from "@/lib/ops-store";
import { getModel } from "@/lib/house";

type Hit = { group: string; title: string; sub: string; href: string; code?: string };

function buildIndex(repairs: OpsRepair[], workOrders: OpsWorkOrder[], inspections: OpsInspection[]): Hit[] {
  const hits: Hit[] = [];
  for (const g of NAV) for (const it of g.items) hits.push({ group: "หน้า", title: it.label, sub: g.label, href: it.href });
  for (const p of projects) hits.push({ group: "โครงการ", title: p.name, sub: `${p.id} · ${p.model} · ${p.province}`, href: `/projects/${p.id}`, code: p.id });
  for (const m of houseModels) hits.push({ group: "แบบบ้าน", title: `${m.code} ${m.name}`, sub: m.nameTh, href: `/models/${m.code}`, code: m.code });
  for (const r of repairs) hits.push({ group: "แจ้งซ่อม", title: r.title, sub: `${r.id} · ${r.asset} · ${getProject(r.projectId)?.name ?? r.projectId}`, href: `/repairs?q=${r.id}`, code: r.id });
  for (const w of workOrders) hits.push({ group: "ใบสั่งงาน", title: w.title, sub: `${w.id} · ${w.asset}`, href: `/work-orders/${w.id}`, code: w.id });
  for (const i of inspections) hits.push({ group: "การตรวจสอบ", title: i.title, sub: `${i.id} · ${i.projectId}`, href: `/inspections/${i.id}`, code: i.id });
  // equipment codes for projects that have open repairs or are active, so typing WC-201 finds it
  for (const p of projects.filter((q) => q.status !== "planning").slice(0, 16)) {
    const m = getModel(p.modelCode);
    for (const a of m.assets.filter((x) => !x.code.startsWith("LT") && !x.code.startsWith("SW") && !x.code.startsWith("FF")))
      hits.push({ group: "อุปกรณ์", title: `${a.code} ${a.name}`, sub: `${p.name} · ${p.id}`, href: `/assets?project=${p.id}&code=${a.code}`, code: a.code });
  }
  return hits;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const repairs = useRepairs();
  const workOrders = useWorkOrders();
  const inspections = useInspections();
  const index = useMemo(() => (open ? buildIndex(repairs, workOrders, inspections) : []), [open, repairs, workOrders, inspections]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("asbuilt:search", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("asbuilt:search", onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQ("");
      setSel(0);
      setTimeout(() => input.current?.focus(), 0);
    }
  }, [open]);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = s ? index.filter((h) => `${h.title} ${h.sub} ${h.code ?? ""}`.toLowerCase().includes(s)) : index.filter((h) => h.group === "หน้า");
    return list.slice(0, 40);
  }, [q, index]);

  if (!open) return null;

  const go = (h: Hit) => {
    setOpen(false);
    router.push(h.href);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-[rgb(31_27_22/0.28)] pt-[12vh]" onMouseDown={() => setOpen(false)}>
      <div role="dialog" aria-label="ค้นหา" className="enter w-[640px] overflow-hidden rounded-[16px] border border-line-strong bg-card shadow-[0_8px_24px_rgba(0,0,0,0.12)]" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search size={18} strokeWidth={1.5} className="text-ink-3" />
          <input
            ref={input}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSel((v) => Math.min(results.length - 1, v + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSel((v) => Math.max(0, v - 1));
              } else if (e.key === "Enter" && results[sel]) go(results[sel]);
            }}
            placeholder="โครงการ แจ้งซ่อม รหัสอุปกรณ์ เช่น WC-201"
            className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-3"
          />
          <Keycap>Esc</Keycap>
        </div>
        <ul className="max-h-[420px] overflow-y-auto py-1">
          {results.length === 0 && <li className="px-4 py-8 text-center text-ink-3">ไม่พบผลลัพธ์</li>}
          {results.map((h, i) => {
            const head = i === 0 || results[i - 1].group !== h.group;
            return (
              <li key={`${h.group}-${h.href}-${i}`}>
                {head && <p className="px-4 pb-1 pt-3 text-[12px] text-ink-3">{h.group}</p>}
                <button
                  type="button"
                  onMouseEnter={() => setSel(i)}
                  onClick={() => go(h)}
                  className={cx("flex w-full items-center gap-3 px-4 py-2 text-left", sel === i ? "bg-raised" : "")}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{h.title}</span>
                    <span className="block truncate text-[12px] text-ink-3">{h.sub}</span>
                  </span>
                  {sel === i && <CornerDownLeft size={14} strokeWidth={1.5} className="text-ink-3" />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
