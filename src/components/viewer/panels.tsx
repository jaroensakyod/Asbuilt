"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bath, BedDouble, ChevronDown, ChevronLeft, ChevronRight, ClipboardCheck, Gauge, Layers, Ruler, Search, Sofa, Tag, Trees, PanelTop, TriangleExclamationPoint, X, Zap } from "lucide-react";
import { AssetTag, Keycap, PlanBar, Status, cx, inputCls } from "@/components/ui";
import { PHASE_LABEL, assetOf, phaseProgress, progressAt, roomOf, type BuildingModel } from "@/lib/house";
import { REPAIR_STATUS_LABEL, STATUS_LABEL, SYSTEM_LABEL, TODAY, thDate, type Project, type Repair } from "@/lib/data";
import { HEAT_META, PHASE_COLOR, SYSTEMS, circuitCapacityW, elementSys, floorName, heatColor, systemCounts, type HeatMetric, type HeatValue, type Schedule, type SiteStats, type SysKey } from "@/lib/viewer-data";
import type { Display, Layers as LayerState, Selection } from "./scene";
import { RUN_COLOR } from "./scene";

const n = (v: number) => v.toLocaleString("th-TH");

export function Panel({ title, meta, children, className }: { title: string; meta?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cx("rounded-[14px] border border-line bg-card", className)}>
      <header className="flex items-baseline justify-between gap-3 px-4 pb-2 pt-3.5">
        <h3 className="text-[14px] font-medium">{title}</h3>
        {meta && <span className="font-mono text-[12px] text-ink-3">{meta}</span>}
      </header>
      {children}
    </section>
  );
}

// =====================================================================
// left: model tree
// =====================================================================

type Hit = { key: string; sel: NonNullable<Selection>; title: string; sub: string; code?: string };

export function ModelTree({
  model,
  floor,
  onFloor,
  selection,
  onPick,
  systems,
  onSystems,
  display,
  onDisplay,
  onClose,
}: {
  model: BuildingModel;
  floor: number | null;
  onFloor: (f: number | null) => void;
  selection: Selection;
  onPick: (s: NonNullable<Selection>) => void;
  systems: Record<SysKey, boolean>;
  onSystems: (s: Record<SysKey, boolean>) => void;
  display: Display;
  onDisplay: (d: Display) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<number[]>([]);
  const counts = useMemo(() => systemCounts(model), [model]);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const groups = useMemo(() => {
    const out: { f: number; count: number; rooms: { id: string; name: string; count: number }[] }[] = [];
    for (let f = 0; f <= model.floors + 1; f++) {
      const els = model.elements.filter((e) => e.floor === f).length;
      const as = model.assets.filter((a) => (f === 0 ? a.room === "ภายนอก" : a.floor === f && a.room !== "ภายนอก")).length;
      const rooms = model.rooms
        .filter((r) => r.floor === f)
        .map((r) => ({ id: r.id, name: r.name, count: model.elements.filter((e) => e.room === r.id).length + model.assets.filter((a) => a.room === r.id).length }));
      if (els + as) out.push({ f, count: els + as, rooms });
    }
    return out;
  }, [model]);

  const hits = useMemo<Hit[]>(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    const out: Hit[] = [];
    for (const r of model.rooms)
      if (r.name.toLowerCase().includes(s) || r.id.includes(s)) out.push({ key: `r${r.id}`, sel: { type: "room", id: r.id }, title: r.name, sub: `ชั้น ${r.floor} · ห้อง ${r.id}` });
    for (const a of model.assets)
      if (a.code.toLowerCase().includes(s) || a.name.toLowerCase().includes(s) || a.category.toLowerCase().includes(s)) {
        const room = roomOf(model, a.room);
        out.push({ key: `a${a.code}`, sel: { type: "asset", code: a.code }, title: a.name, sub: room ? `ชั้น ${a.floor} · ${room.name}` : a.room, code: a.code });
      }
    for (const e of model.elements)
      if (!e.code && (e.label.toLowerCase().includes(s) || e.id.toLowerCase() === s)) out.push({ key: `e${e.id}`, sel: { type: "element", id: e.id }, title: e.label, sub: `${e.id} · ${floorName(model, e.floor)}` });
    return out;
  }, [q, model]);

  const toggleSys = (k: SysKey, solo: boolean) => {
    const keys = SYSTEMS.map((s) => s.key);
    if (solo) {
      const already = keys.every((x) => systems[x] === (x === k));
      onSystems(Object.fromEntries(keys.map((x) => [x, already ? true : x === k])) as Record<SysKey, boolean>);
    } else onSystems({ ...systems, [k]: !systems[k] });
  };

  const isSel = (s: NonNullable<Selection>) => !!selection && selection.type === s.type && JSON.stringify(selection) === JSON.stringify(s);

  return (
    <aside className="flex h-full w-[300px] flex-col border-r border-line bg-card">
      <header className="flex items-start gap-3 px-4 pb-3 pt-3.5">
        <Layers size={16} strokeWidth={1.5} className="mt-1 text-ink-2" />
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-medium">โครงสร้างโมเดล</h3>
          <p className="font-mono text-[12px] text-ink-3">
            {model.code} · {n(total)} องค์ประกอบ
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="ซ่อนแผงโครงสร้าง" className="rounded-[6px] p-1 text-ink-3 transition-colors duration-150 hover:bg-raised hover:text-ink">
          <ChevronLeft size={16} strokeWidth={1.5} />
        </button>
      </header>
      <div className="px-4 pb-3">
        <label className="relative block">
          <Search size={16} strokeWidth={1.5} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหารหัส / ชื่อ เช่น WC-201, ดาวน์ไลท์" className={cx(inputCls, "w-full pl-8 text-[13px]")} aria-label="ค้นหาองค์ประกอบ" />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto border-t border-line">
        {q.trim() ? (
          <div>
            <p className="px-4 py-2 text-[12px] text-ink-3">{hits.length ? `พบ ${n(hits.length)} รายการ${hits.length > 80 ? " · แสดง 80 รายการแรก" : ""}` : "ไม่พบรายการที่ตรงกัน"}</p>
            <ul>
              {hits.slice(0, 80).map((h) => (
                <li key={h.key}>
                  <button type="button" onClick={() => onPick(h.sel)} className={cx("flex w-full flex-col gap-1 px-4 py-2 text-left transition-colors duration-150", isSel(h.sel) ? "bg-accent-soft" : "hover:bg-raised")}>
                    <span className="flex items-center gap-2">
                      {h.code && <AssetTag code={h.code} />}
                      <span className="truncate text-[13px]">{h.title}</span>
                    </span>
                    <span className="text-[12px] text-ink-3">{h.sub}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <ul className="py-1">
            {groups.map((g) => {
              const expanded = open.includes(g.f);
              const isolatable = g.f >= 1 && g.f <= model.floors;
              return (
                <li key={g.f}>
                  <div className={cx("flex h-9 items-center gap-1 pl-2 pr-4 transition-colors duration-150", floor === g.f ? "bg-raised" : "hover:bg-raised")}>
                    <button
                      type="button"
                      onClick={() => setOpen((o) => (expanded ? o.filter((x) => x !== g.f) : [...o, g.f]))}
                      disabled={!g.rooms.length}
                      aria-label={expanded ? "ยุบ" : "ขยาย"}
                      className="flex size-6 items-center justify-center rounded-[6px] text-ink-3 disabled:opacity-0"
                    >
                      {expanded ? <ChevronDown size={16} strokeWidth={1.5} /> : <ChevronRight size={16} strokeWidth={1.5} />}
                    </button>
                    <button type="button" onClick={() => isolatable && onFloor(floor === g.f ? null : g.f)} className="flex min-w-0 flex-1 items-center gap-2 text-left text-[13px]">
                      <Layers size={16} strokeWidth={1.5} className="shrink-0 text-ink-3" />
                      <span className="truncate">{floorName(model, g.f)}</span>
                    </button>
                    <span className="num font-mono text-[12px] text-ink-3">{n(g.count)}</span>
                  </div>
                  {expanded && (
                    <ul className="pb-1">
                      {g.rooms.map((r) => {
                        const s: NonNullable<Selection> = { type: "room", id: r.id };
                        return (
                          <li key={r.id}>
                            <button type="button" onClick={() => onPick(s)} className={cx("flex h-8 w-full items-center gap-2 pl-[52px] pr-4 text-left text-[13px] transition-colors duration-150", isSel(s) ? "bg-accent-soft" : "hover:bg-raised")}>
                              <span className="min-w-0 flex-1 truncate">{r.name}</span>
                              <span className="font-mono text-[11px] text-ink-3">{r.id}</span>
                              <span className="num w-8 text-right font-mono text-[12px] text-ink-3">{r.count}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-t border-line px-4 py-3">
        <p className="mb-2 text-[13px] text-ink-2">ระบบงาน</p>
        <div className="grid grid-cols-2 gap-1.5">
          {SYSTEMS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={(e) => toggleSys(s.key, e.shiftKey)}
              aria-pressed={systems[s.key]}
              className={cx(
                "flex h-8 items-center gap-2 rounded-[8px] border px-2 text-[13px] transition-[background-color,border-color,opacity] duration-150",
                systems[s.key] ? "border-line-strong bg-card text-ink" : "border-line bg-raised text-ink-3 opacity-70",
              )}
            >
              <span className="h-3.5 w-[3px] rounded-full" style={{ background: s.color, opacity: systems[s.key] ? 1 : 0.4 }} />
              <span className="flex-1 truncate text-left">{s.label}</span>
              <span className="num font-mono text-[11px] text-ink-3">{n(counts[s.key])}</span>
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[12px] text-ink-3">Shift+คลิก = แสดงระบบเดียว</p>
      </div>

      <div className="border-t border-line px-4 py-3">
        <p className="mb-1 text-[13px] text-ink-2">การแสดงผล</p>
        <div className="grid grid-cols-2 gap-x-3">
          {(
            [
              ["furniture", "เฟอร์นิเจอร์", Sofa],
              ["ceiling", "ฝ้าเพดาน", PanelTop],
              ["site", "บริเวณ/ภูมิทัศน์", Trees],
              ["labels", "ป้ายชื่อห้อง", Tag],
            ] as const
          ).map(([k, label, Icon]) => (
            <label key={k} className="flex h-9 cursor-pointer items-center gap-2 text-[13px]">
              <Icon size={16} strokeWidth={1.5} className="shrink-0 text-ink-3" />
              <span className="flex-1 truncate">{label}</span>
              <Switch on={display[k]} onChange={() => onDisplay({ ...display, [k]: !display[k] })} label={label} />
            </label>
          ))}
        </div>
      </div>
    </aside>
  );
}

function Switch({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onChange} className={cx("relative h-5 w-8 shrink-0 rounded-full transition-colors duration-150", on ? "bg-ink" : "bg-line-strong")}>
      <span className={cx("absolute top-0.5 size-4 rounded-full bg-card transition-transform duration-150", on ? "translate-x-3.5" : "translate-x-0.5")} />
    </button>
  );
}

// =====================================================================
// right: realistic
// =====================================================================

export function RealPanel({ project, model, repairs, onCompare, onPick }: { project: Project; model: BuildingModel; repairs: Repair[]; onCompare: () => void; onPick: (s: NonNullable<Selection>) => void }) {
  const counts = useMemo(() => systemCounts(model), [model]);
  const max = Math.max(...Object.values(counts));
  const open = repairs.filter((r) => r.status !== "closed");
  const spec = model.spec;
  return (
    <>
      <Panel title="โครงการ">
        <div className="px-4 pb-4">
          <p className="text-[15px] font-medium leading-snug">{project.name}</p>
          <p className="mt-0.5 font-mono text-[12px] text-ink-3">
            {spec.code} · {spec.name} · {spec.style}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <Status tone={project.status === "delivered" ? "pos" : project.status === "planning" ? "neutral" : "warn"}>{STATUS_LABEL[project.status]}</Status>
            <div className="flex-1">
              <PlanBar actual={project.actual} plan={project.plan} />
            </div>
            <span className="num font-mono text-[13px]">{project.actual}%</span>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2 text-center">
            {(
              [
                [Layers, spec.floors, "ชั้น"],
                [BedDouble, spec.beds, "ห้องนอน"],
                [Bath, spec.baths, "ห้องน้ำ"],
                [Ruler, n(spec.area), "ตร.ม."],
              ] as const
            ).map(([Icon, v, l]) => (
              <div key={l} className="rounded-[10px] bg-raised py-2">
                <Icon size={16} strokeWidth={1.5} className="mx-auto text-ink-3" />
                <p className="num mt-1 font-mono text-[14px]">{v}</p>
                <p className="text-[11px] text-ink-3">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </Panel>
      {project.status !== "delivered" && (
        <section className="rounded-[14px] border border-line bg-card px-4 py-3.5">
          <p className="text-[14px] font-medium">กำลังแสดงแบบที่ออกแบบ (100%)</p>
          <p className="mt-1 text-[13px] text-ink-2">บ้านจริงยังก่อสร้างอยู่ ดูสภาพหน้างาน ณ วันใดก็ได้ในโหมดเปรียบเทียบ</p>
          <button type="button" onClick={onCompare} className="mt-3 flex h-9 w-full items-center justify-center rounded-[8px] bg-ink text-[14px] font-medium text-card transition-colors duration-150 hover:bg-[#253d5c]">
            เปรียบเทียบกับหน้างาน
          </button>
        </section>
      )}
      <Panel title="องค์ประกอบที่ลงทะเบียน" meta={n(Object.values(counts).reduce((a, b) => a + b, 0))}>
        <ul className="px-4 pb-3">
          {SYSTEMS.map((s) => (
            <li key={s.key} className="grid grid-cols-[88px_1fr_48px] items-center gap-3 py-1 text-[13px]">
              <span className="flex items-center gap-2">
                <span className="size-2 rounded-[2px]" style={{ background: s.color }} />
                {s.label}
              </span>
              <span className="h-1 rounded-full bg-raised">
                <span className="block h-1 rounded-full" style={{ width: `${(counts[s.key] / max) * 100}%`, background: s.color }} />
              </span>
              <span className="num text-right font-mono text-[12px]">{n(counts[s.key])}</span>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="แจ้งซ่อมที่เปิดอยู่" meta={String(open.length)}>
        {open.length === 0 && <p className="px-4 pb-4 text-[13px] text-ink-3">ไม่มีงานค้าง</p>}
        <ul>
          {open.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => assetOf(model, r.asset) && onPick({ type: "asset", code: r.asset })}
                className="flex w-full flex-col gap-1 border-t border-line px-4 py-3 text-left transition-colors duration-150 hover:bg-raised"
              >
                <span className="flex items-center justify-between gap-2">
                  <AssetTag code={r.asset} />
                  <Status tone={r.slaHours < 0 ? "neg" : "warn"}>{REPAIR_STATUS_LABEL[r.status]}</Status>
                </span>
                <span className="text-[13px]">{r.title}</span>
                <span className="text-[12px] text-ink-3">{r.location}</span>
              </button>
            </li>
          ))}
        </ul>
      </Panel>
      <Hints />
    </>
  );
}

export function Hints() {
  return (
    <Panel title="การใช้งาน">
      <ul className="grid gap-1.5 px-4 pb-4 text-[12px] text-ink-2">
        <li className="flex items-center gap-1.5">
          <Keycap>คลิก</Keycap> เลือกองค์ประกอบหรือจุดแจ้งซ่อม
        </li>
        <li className="flex flex-wrap items-center gap-1.5">
          <Keycap>1</Keycap>–<Keycap>4</Keycap> สลับโหมด · <Keycap>F</Keycap> โฟกัส
        </li>
        <li className="flex flex-wrap items-center gap-1.5">
          <Keycap>L</Keycap> เลือกชั้น · <Keycap>E</Keycap> แยกชั้น · <Keycap>Esc</Keycap> ยกเลิก
        </li>
      </ul>
    </Panel>
  );
}

// =====================================================================
// right: x-ray
// =====================================================================

const LAYER_ROWS = [
  { key: "elec", label: "สายไฟฟ้า (วงจร)" },
  { key: "water", label: "ท่อน้ำดี" },
  { key: "drain", label: "ท่อน้ำทิ้ง" },
  { key: "hvac", label: "ท่อน้ำยาแอร์" },
] as const;

export function XrayPanel({ model, layers, onLayers, circuit, onCircuit }: { model: BuildingModel; layers: LayerState; onLayers: (l: LayerState) => void; circuit: string | null; onCircuit: (c: string | null) => void }) {
  const runCount = useMemo(() => {
    const out = { elec: 0, water: 0, drain: 0, hvac: 0 };
    for (const r of model.runs) out[r.system]++;
    return out;
  }, [model]);
  const eq = useMemo(() => {
    const out: Record<"elec" | "hvac" | "plumb" | "sanitary", number> = { elec: 0, hvac: 0, plumb: 0, sanitary: 0 };
    for (const a of model.assets) {
      if (!a.render && a.category !== "เบรกเกอร์ลูกย่อย" && a.category !== "สวิตช์ไฟ") continue;
      const s = a.system === "elec" ? "elec" : a.system === "hvac" ? "hvac" : a.system === "plumb" ? (/^(WC|LV|SK)-/.test(a.code) ? "sanitary" : "plumb") : null;
      if (s) out[s]++;
    }
    return out;
  }, [model]);
  const dbs = useMemo(() => {
    const ids = [...new Set(model.circuits.map((c) => c.db))];
    return ids.map((db) => {
      const list = model.circuits.filter((c) => c.db === db);
      return { db, name: assetOf(model, db)?.name ?? db, list, load: list.reduce((s, c) => s + c.loadW, 0) };
    });
  }, [model]);

  return (
    <>
      <Panel title="X-Ray งานระบบ">
        <p className="px-4 pb-2 text-[13px] text-ink-2">ผนัง พื้น หลังคาโปร่งใส ท่อและสายไฟแสดงตามสีระบบ</p>
        <p className="px-4 pb-1 pt-1 text-[12px] text-ink-3">แนวท่อ / สายไฟ</p>
        <ul className="px-2 pb-2">
          {LAYER_ROWS.map((l) => (
            <li key={l.key}>
              <label className="flex h-8 cursor-pointer items-center gap-3 rounded-[8px] px-2 text-[13px] transition-colors duration-150 hover:bg-raised">
                <input type="checkbox" checked={layers[l.key]} onChange={() => onLayers({ ...layers, [l.key]: !layers[l.key] })} className="accent-[var(--text)]" />
                <span className="h-0.5 w-4 rounded-full" style={{ background: RUN_COLOR[l.key] }} />
                <span className="flex-1">{l.label}</span>
                <span className="num font-mono text-[12px] text-ink-3">{n(runCount[l.key])}</span>
              </label>
            </li>
          ))}
        </ul>
        <p className="border-t border-line px-4 pb-1 pt-3 text-[12px] text-ink-3">อุปกรณ์</p>
        <ul className="px-4 pb-3">
          {(
            [
              ["elec", "อุปกรณ์ไฟฟ้า", RUN_COLOR.elec],
              ["hvac", "อุปกรณ์ปรับอากาศ", RUN_COLOR.hvac],
              ["plumb", "อุปกรณ์ประปา", RUN_COLOR.water],
              ["sanitary", "สุขภัณฑ์", "#4f9a8b"],
            ] as const
          ).map(([k, label, c]) => (
            <li key={k} className="flex h-7 items-center gap-3 text-[13px]">
              <span className="size-2.5 rounded-[3px]" style={{ background: c }} />
              <span className="flex-1">{label}</span>
              <span className="num font-mono text-[12px] text-ink-3">{n(eq[k])}</span>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="วงจรไฟฟ้า" meta={circuit ? "กำลังไล่วงจร" : "เลือกเพื่อไล่วงจร"}>
        {circuit && (
          <button type="button" onClick={() => onCircuit(null)} className="mx-4 mb-2 flex h-7 items-center gap-1.5 rounded-[8px] bg-raised px-2 text-[12px] text-ink-2 transition-colors duration-150 hover:text-ink">
            <X size={16} strokeWidth={1.5} /> ล้างการไล่วงจร
          </button>
        )}
        {dbs.map((g) => (
          <div key={g.db}>
            <div className="flex items-center gap-2 border-t border-line bg-raised/60 px-4 py-2">
              <Zap size={16} strokeWidth={1.5} className="text-ink-3" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px]">
                  <span className="font-mono text-[12px]">{g.db}</span> · {g.name}
                </span>
                <span className="block font-mono text-[11px] text-ink-3">
                  {g.list.length} วงจร · โหลดรวม {n(g.load)} W
                </span>
              </span>
            </div>
            <ul>
              {g.list.map((c) => {
                const on = circuit === c.id;
                const pts = model.assets.filter((a) => a.circuit === c.id && a.category !== "เบรกเกอร์ลูกย่อย").length;
                const pct = Math.min(100, (c.loadW / circuitCapacityW(c.rating)) * 100);
                const tone = pct >= 80 ? "bg-neg" : pct >= 60 ? "bg-warn" : "bg-pos";
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => onCircuit(on ? null : c.id)}
                      className={cx("grid w-full grid-cols-[56px_1fr_auto] items-center gap-x-2 border-t border-line px-4 py-2 text-left transition-colors duration-150", on ? "bg-accent-soft" : "hover:bg-raised")}
                    >
                      <span className={cx("font-mono text-[12px]", on ? "text-accent-text" : "text-ink-2")}>{c.breaker.replace("CB-", "")}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px]">{c.name}</span>
                        <span className="mt-1 block h-1 rounded-full bg-raised">
                          <span className={cx("block h-1 rounded-full", tone)} style={{ width: `${Math.max(2, pct)}%` }} />
                        </span>
                      </span>
                      <span className="num text-right font-mono text-[11px] leading-tight text-ink-3">
                        {c.rating.replace(/^(MCB|RCBO) /, "")}
                        <br />
                        {pts} จุด · {n(c.loadW)} W
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </Panel>
    </>
  );
}

// =====================================================================
// right: compare
// =====================================================================

export function ComparePanel({ model, t, sched, stats }: { model: BuildingModel; t: number; sched: Schedule; stats: SiteStats }) {
  const delta = stats.actual - stats.plan;
  const phases = phaseProgress(t, sched.today, sched.lag, model.elements);
  return (
    <>
      <Panel title="สภาพหน้างาน ณ วันที่" meta={thDate(sched.dateAt(t))}>
        <div className="px-4">
          <span className={cx("inline-flex h-6 items-center rounded-[6px] px-2 text-[12px]", Math.abs(delta) < 0.5 ? "bg-raised text-ink-2" : delta < 0 ? "bg-accent-soft text-accent-text" : "bg-pos-soft text-pos")}>
            {Math.abs(delta) < 0.5 ? "ตามแผน" : delta < 0 ? `ช้ากว่าแผน ${Math.abs(delta).toFixed(1)}%` : `เร็วกว่าแผน ${delta.toFixed(1)}%`}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 px-4 pb-3 pt-2">
          <div>
            <p className="text-[13px] text-ink-2">ผลงานจริง</p>
            <p className="num text-[30px] font-medium leading-tight">{stats.actual.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-[13px] text-ink-2">ตามแผน</p>
            <p className="num text-[30px] leading-tight text-ink-3">{stats.plan.toFixed(1)}%</p>
          </div>
        </div>
        <div className="px-4 pb-3">
          <PlanBar actual={stats.actual} plan={stats.plan} />
        </div>
        <div className="grid grid-cols-4 border-t border-line text-center">
          {(
            [
              [stats.built, "สร้างแล้ว", ""],
              [stats.inspected, "ตรวจผ่าน", "text-pos"],
              [stats.defects, "ข้อบกพร่อง", stats.defects ? "text-neg" : ""],
              [stats.inProgress, "กำลังทำ", "text-warn"],
            ] as const
          ).map(([v, l, c]) => (
            <div key={l} className="border-l border-line py-2.5 first:border-l-0">
              <p className={cx("num font-mono text-[15px]", c)}>{n(v)}</p>
              <p className="text-[11px] text-ink-3">{l}</p>
            </div>
          ))}
        </div>
        <p className="border-t border-line px-4 py-2.5 text-[12px] text-ink-3">
          จากทั้งหมด {n(stats.total)} ชิ้นงาน{stats.late > 0 && <span className="text-accent-text"> · ล่าช้ากว่าแผน {n(stats.late)} รายการ</span>}
        </p>
      </Panel>
      <Panel title="S-curve แผนงาน vs ผลงานจริง">
        <SCurve model={model} sched={sched} t={t} />
      </Panel>
      <Panel title="ความคืบหน้ารายงวดงาน" meta="| แผน">
        <ul className="px-4 pb-3">
          {phases.map((ph) => {
            const d = ph.actual - ph.plan;
            return (
              <li key={ph.phase} className="py-1.5">
                <div className="mb-1.5 flex items-center justify-between gap-2 text-[13px]">
                  <span className="flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ background: PHASE_COLOR[ph.phase] }} />
                    {PHASE_LABEL[ph.phase]}
                  </span>
                  <span className="num font-mono text-[12px] text-ink-2">
                    {Math.round(ph.actual)}%{d <= -3 && <span className="text-accent-text"> −{Math.round(-d)}</span>}
                  </span>
                </div>
                <PlanBar actual={ph.actual} plan={ph.plan} />
              </li>
            );
          })}
        </ul>
      </Panel>
    </>
  );
}

function SCurve({ model, sched, t }: { model: BuildingModel; sched: Schedule; t: number }) {
  const w = 300;
  const h = 120;
  const steps = 48;
  const { planPts, actPts } = useMemo(() => {
    const planPts: string[] = [];
    const actPts: string[] = [];
    for (let i = 0; i <= steps; i++) {
      const f = i / steps;
      const p = progressAt(f, sched.today, sched.lag, model.elements);
      planPts.push(`${(f * w).toFixed(1)},${(h - (p.plan / 100) * h).toFixed(1)}`);
      if (f <= sched.today + 1e-6) actPts.push(`${(f * w).toFixed(1)},${(h - (p.actual / 100) * h).toFixed(1)}`);
    }
    return { planPts, actPts };
  }, [model, sched]);
  const cur = progressAt(t, sched.today, sched.lag, model.elements);
  return (
    <div className="px-4 pb-4">
      <svg viewBox={`-26 -6 ${w + 32} ${h + 24}`} className="w-full" role="img" aria-label="กราฟความคืบหน้าสะสม แผนเทียบผลงานจริง">
        {[0, 0.25, 0.5, 0.75, 1].map((g) => (
          <g key={g}>
            <line x1={0} x2={w} y1={h * g} y2={h * g} stroke={g === 1 ? "var(--line-strong)" : "var(--line)"} />
            <text x={-6} y={h * g + 3} textAnchor="end" fontSize={9} fill="var(--text-3)" fontFamily="var(--font-mono)">
              {Math.round((1 - g) * 100)}%
            </text>
          </g>
        ))}
        <polyline points={planPts.join(" ")} fill="none" stroke="var(--text-3)" strokeWidth={1.5} strokeDasharray="4 4" />
        <polyline points={actPts.join(" ")} fill="none" stroke="var(--text)" strokeWidth={2} />
        {sched.todayVisible && <line x1={sched.today * w} x2={sched.today * w} y1={0} y2={h} stroke="var(--accent)" />}
        <line x1={t * w} x2={t * w} y1={0} y2={h} stroke="var(--text)" strokeDasharray="2 3" />
        <circle cx={t * w} cy={h - (cur.actual / 100) * h} r={3} fill="var(--text)" />
        <text x={0} y={h + 15} fontSize={9} fill="var(--text-3)" fontFamily="var(--font-mono)">
          {thDate(sched.dateAt(0))}
        </text>
        <text x={w} y={h + 15} textAnchor="end" fontSize={9} fill="var(--text-3)" fontFamily="var(--font-mono)">
          {thDate(sched.dateAt(1))}
        </text>
      </svg>
      <div className="mt-1 flex items-center gap-4 text-[12px] text-ink-3">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-ink" /> จริง
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0 w-4 border-t border-dashed border-ink-3" /> แผน
        </span>
        {sched.todayVisible && (
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-px bg-accent" /> วันนี้
          </span>
        )}
      </div>
    </div>
  );
}

// =====================================================================
// right: heatmap
// =====================================================================

const METRIC_ICON = { score: ClipboardCheck, defects: TriangleExclamationPoint, progress: Gauge, failures: Zap } as const;

export function HeatPanel({ model, metric, onMetric, values, selection, onPick }: { model: BuildingModel; metric: HeatMetric; onMetric: (m: HeatMetric) => void; values: Map<string, HeatValue>; selection: Selection; onPick: (s: NonNullable<Selection>) => void }) {
  const meta = HEAT_META[metric];
  const ranked = [...model.rooms].filter((r) => values.has(r.id)).sort((a, b) => values.get(a.id)!.good - values.get(b.id)!.good);
  return (
    <>
      <Panel title="Heatmap รายห้อง">
        <div className="mx-4 grid grid-cols-2 gap-0.5 rounded-[10px] bg-raised p-0.5">
          {(Object.keys(HEAT_META) as HeatMetric[]).map((k) => {
            const Icon = METRIC_ICON[k];
            return (
              <button
                key={k}
                type="button"
                onClick={() => onMetric(k)}
                aria-pressed={metric === k}
                className={cx("flex h-8 items-center justify-center gap-1.5 rounded-[8px] text-[13px] transition-colors duration-150", metric === k ? "bg-card text-ink shadow-[inset_0_0_0_1px_var(--line)]" : "text-ink-2 hover:text-ink")}
              >
                <Icon size={16} strokeWidth={1.5} />
                {HEAT_META[k].label}
              </button>
            );
          })}
        </div>
        <p className="px-4 pt-3 text-[12px] text-ink-3">{meta.legend}</p>
        <div className="mx-4 mt-1.5 flex h-2 overflow-hidden rounded-full">
          {[5, 25, 50, 75, 100].map((g) => (
            <span key={g} className="flex-1" style={{ background: heatColor(g) }} />
          ))}
        </div>
        <div className="flex justify-between px-4 pt-1 text-[12px] text-ink-3">
          <span>{meta.low}</span>
          <span>{meta.high}</span>
        </div>
        <p className="flex items-center gap-2 px-4 pb-3.5 pt-2 text-[12px] text-ink-3">
          <span className="size-2 rounded-[2px] bg-[#5e5953]" /> ไม่มีข้อมูล · มีข้อมูล {values.size}/{model.rooms.length} ห้อง
        </p>
      </Panel>
      <Panel title="ห้องที่ต้องให้ความสำคัญ" meta={ranked.length ? `${ranked.length} ห้อง` : undefined}>
        {ranked.length === 0 && <p className="px-4 pb-4 text-[13px] text-ink-3">ยังไม่มีข้อมูลสำหรับตัวชี้วัดนี้</p>}
        <ol>
          {ranked.slice(0, 40).map((r, i) => {
            const v = values.get(r.id)!;
            const on = selection?.type === "room" && selection.id === r.id;
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onPick({ type: "room", id: r.id })}
                  className={cx("grid w-full grid-cols-[20px_1fr_auto] items-center gap-3 border-t border-line px-4 py-2.5 text-left transition-colors duration-150", on ? "bg-raised" : "hover:bg-raised")}
                >
                  <span className="num font-mono text-[12px] text-ink-3">{i + 1}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px]">{r.name}</span>
                    <span className="block text-[12px] text-ink-3">
                      ชั้น {r.floor} · {r.id}
                    </span>
                    <span className="mt-1 block h-1 rounded-full bg-raised">
                      <span className="block h-1 rounded-full" style={{ width: `${Math.max(4, metric === "progress" ? v.good : 100 - v.good)}%`, background: heatColor(v.good) }} />
                    </span>
                  </span>
                  <span className="num font-mono text-[14px]" style={{ color: heatColor(v.good) }}>
                    {v.value}
                    {meta.unit === "%" ? "%" : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </Panel>
    </>
  );
}

// =====================================================================
// selection
// =====================================================================

export function SelectionCard({ model, selection, repairs, onClose, projectId }: { model: BuildingModel; selection: NonNullable<Selection>; repairs: Repair[]; onClose: () => void; projectId: string }) {
  let body: React.ReactNode = null;
  if (selection.type === "asset") {
    const a = assetOf(model, selection.code);
    if (!a) return null;
    const room = roomOf(model, a.room);
    const open = repairs.filter((r) => r.asset === a.code && r.status !== "closed");
    const inWarranty = a.warrantyUntil >= TODAY;
    const circuit = a.circuit ? model.circuits.find((c) => c.id === a.circuit) : undefined;
    body = (
      <>
        <div className="flex items-center gap-2 pr-6">
          <AssetTag code={a.code} />
          <span className="text-[13px] text-ink-3">{SYSTEM_LABEL[a.system]}</span>
        </div>
        <p className="mt-2 text-[15px] font-medium leading-snug">{a.name}</p>
        <dl className="mt-3 grid grid-cols-[88px_1fr] gap-y-1.5 text-[13px]">
          <dt className="text-ink-3">หมวด</dt>
          <dd>{a.category}</dd>
          <dt className="text-ink-3">ตำแหน่ง</dt>
          <dd>{room ? `ชั้น ${a.floor} · ${room.name}` : a.room}</dd>
          <dt className="text-ink-3">ยี่ห้อ / รุ่น</dt>
          <dd>{a.brand}</dd>
          {circuit && (
            <>
              <dt className="text-ink-3">วงจร</dt>
              <dd className="font-mono text-[12px]">
                {circuit.breaker} · {circuit.db}
              </dd>
            </>
          )}
          {(a.watts || a.btu) && (
            <>
              <dt className="text-ink-3">พิกัด</dt>
              <dd className="num font-mono text-[12px]">{[a.btu ? `${n(a.btu)} BTU` : "", a.watts ? `${n(a.watts)} W` : ""].filter(Boolean).join(" · ")}</dd>
            </>
          )}
          <dt className="text-ink-3">ติดตั้ง</dt>
          <dd className="num">{thDate(a.installed)}</dd>
          <dt className="text-ink-3">ประกัน</dt>
          <dd>
            <Status tone={inWarranty ? "pos" : "neutral"}>{inWarranty ? `ถึง ${thDate(a.warrantyUntil)}` : `หมดแล้ว ${thDate(a.warrantyUntil)}`}</Status>
          </dd>
        </dl>
        {open.length > 0 && <p className="mt-3 text-[12px] text-ink-3">แจ้งซ่อมที่เปิดอยู่ {open.length} รายการ</p>}
        {open.map((r) => (
          <Link key={r.id} href="/repairs" className="mt-1.5 block rounded-[8px] bg-accent-soft px-3 py-2 text-[13px] transition-opacity duration-150 hover:opacity-80">
            <span className="flex items-center justify-between gap-2">
              <span className="font-mono text-[12px] text-accent-text">{r.id}</span>
              <span className="text-[12px] text-ink-2">{REPAIR_STATUS_LABEL[r.status]}</span>
            </span>
            <span className="block text-ink">{r.title}</span>
          </Link>
        ))}
        <Link href={`/repairs?new=${encodeURIComponent(a.code)}&project=${encodeURIComponent(projectId)}`} className="mt-3 flex h-9 items-center justify-center rounded-[8px] bg-ink text-[14px] font-medium text-card transition-colors duration-150 hover:bg-[#253d5c]">
          แจ้งซ่อมจุดนี้
        </Link>
      </>
    );
  } else if (selection.type === "element") {
    const e = model.elements.find((x) => x.id === selection.id);
    if (!e) return null;
    const room = e.room ? roomOf(model, e.room) : undefined;
    body = (
      <>
        <p className="pr-6 text-[13px] text-ink-3">
          {PHASE_LABEL[e.phase]} · {SYSTEMS.find((s) => s.key === elementSys(e))?.label}
        </p>
        <p className="mt-1 text-[15px] font-medium">{e.label}</p>
        <dl className="mt-3 grid grid-cols-[88px_1fr] gap-y-1.5 text-[13px]">
          <dt className="text-ink-3">รหัสชิ้นงาน</dt>
          <dd className="font-mono text-[12px]">{e.id}</dd>
          <dt className="text-ink-3">ชั้น</dt>
          <dd>{floorName(model, e.floor)}</dd>
          {room && (
            <>
              <dt className="text-ink-3">ห้อง</dt>
              <dd>{room.name}</dd>
            </>
          )}
          <dt className="text-ink-3">ขนาด (ม.)</dt>
          <dd className="num font-mono text-[12px]">{e.size.map((s) => s.toFixed(2)).join(" × ")}</dd>
        </dl>
      </>
    );
  } else {
    const r = roomOf(model, selection.id);
    if (!r) return null;
    const list = model.assets.filter((a) => a.room === r.id && a.render);
    body = (
      <>
        <p className="pr-6 text-[13px] text-ink-3">
          ชั้น {r.floor} · ห้อง {r.id}
        </p>
        <p className="mt-1 text-[15px] font-medium">{r.name}</p>
        <dl className="mt-3 grid grid-cols-[88px_1fr] gap-y-1.5 text-[13px]">
          <dt className="text-ink-3">คะแนนตรวจ</dt>
          <dd className="num">{r.score ?? "—"} / 100</dd>
          <dt className="text-ink-3">ข้อบกพร่อง</dt>
          <dd className="num">{r.defects ?? 0}</dd>
          <dt className="text-ink-3">พื้นที่</dt>
          <dd className="num">{((r.x1 - r.x0) * (r.z1 - r.z0)).toFixed(1)} ตร.ม.</dd>
          <dt className="text-ink-3">อุปกรณ์</dt>
          <dd className="num">{model.assets.filter((a) => a.room === r.id).length} ชิ้น</dd>
        </dl>
        {list.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {list.slice(0, 10).map((a) => (
              <AssetTag key={a.code} code={a.code} />
            ))}
          </div>
        )}
      </>
    );
  }

  return (
    <section className="enter relative rounded-[14px] border border-line-strong bg-card p-4">
      <button type="button" onClick={onClose} aria-label="ปิด" className="absolute right-3 top-3 rounded-[6px] p-1 text-ink-3 transition-colors duration-150 hover:bg-raised hover:text-ink">
        <X size={16} strokeWidth={1.5} />
      </button>
      {body}
    </section>
  );
}

