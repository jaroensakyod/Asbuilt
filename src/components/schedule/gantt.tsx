"use client";

import { useEffect, useMemo, useRef } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cx } from "@/components/ui";
import type { WbsTask } from "@/lib/biz";
import { TH_MONTH_FULL } from "@/lib/data";
import { addDays, addMonths, compareCode, diffDays, monthStart, toDay, weekday, weekStart, type CpmRow, type Rolled } from "@/lib/schedule";

export type Zoom = "day" | "week" | "month";
const PX: Record<Zoom, number> = { day: 26, week: 7, month: 2.2 };
const ROW = 32;
const HEAD = 44;
const TH_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const be = (iso: string) => String(Number(iso.slice(0, 4)) + 543);

export type GanttRow = { t: WbsTask; depth: number; summary: boolean; start: string; finish: string; bs?: string; bf?: string; pct: number; critical: boolean };

/** Rows in WBS order (depth-first by code), hiding children of collapsed summaries. */
export function ganttRows(tasks: WbsTask[], roll: Map<string, Rolled>, rows: Record<string, CpmRow>, collapsed: Set<string>, match?: (t: WbsTask) => boolean): GanttRow[] {
  const kids = new Map<string, WbsTask[]>();
  const ids = new Set(tasks.map((t) => t.id));
  for (const t of tasks) {
    const k = t.parentId && ids.has(t.parentId) ? t.parentId : "";
    kids.set(k, [...(kids.get(k) ?? []), t]);
  }
  for (const v of kids.values()) v.sort((a, b) => compareCode(a.code, b.code));
  const keep = new Map<string, boolean>();
  const passes = (t: WbsTask): boolean => {
    const hit = keep.get(t.id);
    if (hit !== undefined) return hit;
    const ch = kids.get(t.id);
    const v = ch?.length ? ch.some(passes) : !match || match(t);
    keep.set(t.id, v);
    return v;
  };
  const out: GanttRow[] = [];
  const walk = (parent: string, depth: number) => {
    for (const t of kids.get(parent) ?? []) {
      if (!passes(t)) continue;
      const summary = !!kids.get(t.id)?.length;
      const r = roll.get(t.id);
      out.push({
        t,
        depth,
        summary,
        start: r?.start ?? t.start,
        finish: r?.finish ?? t.finish,
        bs: r?.baselineStart ?? t.baselineStart,
        bf: r?.baselineFinish ?? t.baselineFinish,
        pct: r?.pct ?? t.pct,
        critical: !summary && !!rows[t.id]?.critical,
      });
      if (summary && !collapsed.has(t.id)) walk(t.id, depth + 1);
    }
  };
  walk("", 0);
  return out;
}

export function Gantt({
  rows,
  zoom,
  today,
  showBaseline,
  showLinks,
  selected,
  collapsed,
  onToggle,
  onSelect,
  durOf,
}: {
  rows: GanttRow[];
  zoom: Zoom;
  today: string;
  showBaseline: boolean;
  showLinks: boolean;
  selected?: string;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  durOf: (r: GanttRow) => number;
}) {
  const px = PX[zoom];
  const box = useRef<HTMLDivElement>(null);

  const range = useMemo(() => {
    const ds = rows.flatMap((r) => [r.start, r.finish, r.bs, r.bf].filter(Boolean) as string[]);
    ds.push(today);
    let a = ds.reduce((x, y) => (x < y ? x : y));
    let b = ds.reduce((x, y) => (x > y ? x : y));
    if (zoom === "month") {
      a = monthStart(addDays(a, -10));
      b = addDays(addMonths(monthStart(b), 2), -1);
    } else {
      a = weekStart(addDays(a, -3));
      b = addDays(weekStart(addDays(b, 14)), 6);
    }
    return { a, b, days: diffDays(a, b) + 1 };
  }, [rows, today, zoom]);

  const W = Math.ceil(range.days * px);
  const H = rows.length * ROW;
  const x = (iso: string) => (toDay(iso) - toDay(range.a)) * px;
  const xe = (iso: string) => (toDay(iso) - toDay(range.a) + 1) * px;

  // scroll so today (or the start) is in view when the zoom changes
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.scrollLeft = Math.max(0, x(today) - el.clientWidth * 0.35);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, range.a]);
  // and the first unfinished work row near the top (once)
  const scrolledY = useRef(false);
  useEffect(() => {
    const el = box.current;
    if (!el || scrolledY.current || !rows.length) return;
    scrolledY.current = true;
    const i = rows.findIndex((r) => !r.summary && r.pct < 100 && r.finish >= today);
    if (i > 3) el.scrollTop = (i - 3) * ROW;
  }, [rows, today]);

  // header ticks
  const ticks = useMemo(() => {
    const top: { x: number; w: number; label: string }[] = [];
    const bottom: { x: number; w: number; label: string; sun?: boolean }[] = [];
    const xa = (iso: string) => (toDay(iso) - toDay(range.a)) * px;
    if (zoom === "month") {
      for (let m = monthStart(range.a); m <= range.b; m = addMonths(m, 1)) {
        const w = (diffDays(m, addMonths(m, 1)) || 30) * px;
        bottom.push({ x: xa(m), w, label: TH_MONTH[Number(m.slice(5, 7)) - 1] });
      }
      for (let y = range.a.slice(0, 4) + "-01-01"; y <= range.b; y = addMonths(y, 12)) {
        const s = y < range.a ? range.a : y;
        const e = addMonths(y, 12) > range.b ? addDays(range.b, 1) : addMonths(y, 12);
        top.push({ x: xa(s), w: diffDays(s, e) * px, label: `พ.ศ. ${be(y)}` });
      }
    } else {
      for (let m = monthStart(range.a); m <= range.b; m = addMonths(m, 1)) {
        const s = m < range.a ? range.a : m;
        const e = addMonths(m, 1) > range.b ? addDays(range.b, 1) : addMonths(m, 1);
        top.push({ x: xa(s), w: diffDays(s, e) * px, label: `${zoom === "day" ? TH_MONTH_FULL[Number(m.slice(5, 7)) - 1] : TH_MONTH[Number(m.slice(5, 7)) - 1]} ${zoom === "day" ? be(m) : be(m).slice(2)}` });
      }
      if (zoom === "day") for (let d = range.a; d <= range.b; d = addDays(d, 1)) bottom.push({ x: xa(d), w: px, label: String(Number(d.slice(8))), sun: weekday(d) === 0 });
      else for (let d = range.a; d <= range.b; d = addDays(d, 7)) bottom.push({ x: xa(d), w: 7 * px, label: String(Number(d.slice(8))) });
    }
    return { top, bottom };
  }, [range, zoom, px]);

  const index = useMemo(() => new Map(rows.map((r, i) => [r.t.id, i])), [rows]);

  const links = useMemo(() => {
    if (!showLinks) return [];
    const out: { d: string; crit: boolean; key: string }[] = [];
    for (const [si, r] of rows.entries()) {
      if (r.summary) continue;
      for (const dep of r.t.deps) {
        const pi = index.get(dep.taskId);
        if (pi === undefined) continue;
        const p = rows[pi];
        if (p.summary) continue;
        const fromEnd = dep.type === "FS" || dep.type === "FF";
        const toStart = dep.type === "FS" || dep.type === "SS";
        const pMs = !!p.t.milestone;
        const sMs = !!r.t.milestone;
        const ax = pMs ? xe(p.finish) + (fromEnd ? 5 : -5) : fromEnd ? xe(p.finish) : x(p.start);
        const bx = sMs ? xe(r.finish) + (toStart ? -6 : 6) : toStart ? x(r.start) : xe(r.finish);
        const ay = pi * ROW + 14;
        const by = si * ROW + 14;
        const ox = ax + (fromEnd ? 6 : -6);
        const tx = bx + (toStart ? -6 : 6);
        let d: string;
        if ((toStart && tx >= ox) || (!toStart && tx <= ox)) d = `M${ax},${ay} H${ox} V${by} H${bx}`;
        else {
          const midY = by + (by > ay ? -ROW / 2 : ROW / 2);
          d = `M${ax},${ay} H${ox} V${midY} H${tx} V${by} H${bx}`;
        }
        out.push({ d, crit: r.critical && p.critical, key: `${p.t.id}-${r.t.id}-${dep.type}` });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, index, showLinks, range, px]);

  return (
    <div ref={box} className="relative max-h-[70vh] overflow-auto overscroll-contain">
      <div className="flex w-max min-w-full">
        {/* task table */}
        <div className="sticky left-0 z-20 w-[210px] shrink-0 border-r border-line bg-card sm:w-[400px]">
          <div className="sticky top-0 z-30 flex items-end border-b border-line bg-card px-3 pb-1.5 text-[12px] text-ink-3" style={{ height: HEAD }}>
            <span className="hidden w-14 shrink-0 sm:block">รหัส</span>
            <span className="min-w-0 flex-1">งาน</span>
            <span className="hidden w-12 shrink-0 text-right sm:block">วัน</span>
            <span className="w-12 shrink-0 text-right">%</span>
          </div>
          {rows.map((r) => (
            <div
              key={r.t.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(r.t.id)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect(r.t.id))}
              className={cx("flex cursor-pointer items-center border-b border-line px-3 text-[13px] transition-colors duration-150 hover:bg-raised/60", selected === r.t.id && "bg-raised")}
              style={{ height: ROW }}
            >
              <span className="hidden w-14 shrink-0 font-mono text-[11px] text-ink-3 sm:block">{r.t.code}</span>
              <span className="flex min-w-0 flex-1 items-center gap-1" style={{ paddingLeft: r.depth * 12 }}>
                {r.summary ? (
                  <button
                    type="button"
                    aria-label={collapsed.has(r.t.id) ? "ขยาย" : "ย่อ"}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggle(r.t.id);
                    }}
                    className="-ml-1 inline-flex size-5 shrink-0 items-center justify-center rounded-[4px] text-ink-3 hover:bg-deep hover:text-ink"
                  >
                    {collapsed.has(r.t.id) ? <ChevronRight size={14} strokeWidth={1.5} /> : <ChevronDown size={14} strokeWidth={1.5} />}
                  </button>
                ) : (
                  <span className="w-4 shrink-0" />
                )}
                <span className={cx("truncate", r.summary && "font-medium", r.critical && "text-accent-text")} title={r.t.name}>
                  {r.t.name}
                </span>
              </span>
              <span className="hidden w-12 shrink-0 text-right font-mono text-[12px] text-ink-3 sm:block">{r.t.milestone ? 0 : durOf(r)}</span>
              <span className={cx("w-12 shrink-0 text-right font-mono text-[12px]", r.pct >= 100 ? "text-pos" : "text-ink-2")}>{Math.round(r.pct)}</span>
            </div>
          ))}
        </div>

        {/* timeline */}
        <div className="relative shrink-0" style={{ width: W }}>
          <div className="sticky top-0 z-10 border-b border-line bg-card" style={{ height: HEAD }}>
            <svg width={W} height={HEAD} className="block" aria-hidden>
              {ticks.top.map((t) => (
                <g key={`t${t.x}`}>
                  <line x1={t.x} x2={t.x} y1={0} y2={HEAD} className="stroke-line-strong" />
                  <text x={t.x + 6} y={16} fontSize={12} className="fill-ink-2">
                    {t.w > 40 ? t.label : ""}
                  </text>
                </g>
              ))}
              <line x1={0} x2={W} y1={22} y2={22} className="stroke-line" />
              {ticks.bottom.map((t) => (
                <g key={`b${t.x}`}>
                  {t.sun && <rect x={t.x} y={22} width={t.w} height={HEAD - 22} className="fill-raised" />}
                  <line x1={t.x} x2={t.x} y1={22} y2={HEAD} className="stroke-line" />
                  <text x={t.x + t.w / 2} y={37} fontSize={11} textAnchor="middle" className={cx("font-mono", t.sun ? "fill-ink-3" : "fill-ink-3")}>
                    {t.w >= 14 ? t.label : ""}
                  </text>
                </g>
              ))}
              <g>
                <rect x={x(today) - 20} y={25} width={40} height={16} rx={4} className="fill-ink" />
                <text x={x(today)} y={37} fontSize={11} textAnchor="middle" className="fill-card">
                  วันนี้
                </text>
              </g>
            </svg>
          </div>
          <svg width={W} height={Math.max(H, ROW)} className="block" role="img" aria-label="แผนภูมิแกนต์">
            <defs>
              <marker id="g-arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M0,0 L6,3 L0,6 z" className="fill-ink-3" />
              </marker>
              <marker id="g-arrow-c" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M0,0 L6,3 L0,6 z" className="fill-accent" />
              </marker>
            </defs>
            {/* grid */}
            {ticks.bottom.map((t) => (
              <g key={`g${t.x}`}>
                {t.sun && <rect x={t.x} y={0} width={t.w} height={H} className="fill-raised" opacity={0.6} />}
                <line x1={t.x} x2={t.x} y1={0} y2={H} className="stroke-line" />
              </g>
            ))}
            {rows.map((r, i) => (
              <line key={`r${r.t.id}`} x1={0} x2={W} y1={(i + 1) * ROW - 0.5} y2={(i + 1) * ROW - 0.5} className="stroke-line" />
            ))}
            {selected && index.has(selected) && <rect x={0} y={index.get(selected)! * ROW} width={W} height={ROW - 1} className="fill-raised" opacity={0.7} />}
            {/* links */}
            {links.map((l) => (
              <path key={l.key} d={l.d} fill="none" strokeWidth={1} className={l.crit ? "stroke-accent" : "stroke-ink-3"} opacity={l.crit ? 0.9 : 0.55} markerEnd={`url(#${l.crit ? "g-arrow-c" : "g-arrow"})`} />
            ))}
            {/* bars */}
            {rows.map((r, i) => {
              const y = i * ROW;
              const title = `${r.t.code} ${r.t.name}\n${r.start} → ${r.finish}${r.bs ? `\nเส้นฐาน ${r.bs} → ${r.bf}` : ""}\n${Math.round(r.pct)}%`;
              const bx = x(r.start);
              const bw = Math.max(2, xe(r.finish) - bx);
              const base =
                showBaseline && r.bs && r.bf ? (
                  r.t.milestone ? (
                    <path d={`M${xe(r.bf)},${y + 20} l4,4 l-4,4 l-4,-4 z`} className="fill-ink-3" opacity={0.5} />
                  ) : (
                    <rect x={x(r.bs)} y={y + 23} width={Math.max(2, xe(r.bf) - x(r.bs))} height={3} rx={1} className="fill-ink-3" opacity={0.5} />
                  )
                ) : null;
              if (r.t.milestone) {
                const cx0 = xe(r.finish);
                return (
                  <g key={r.t.id} onClick={() => onSelect(r.t.id)} className="cursor-pointer">
                    <title>{title}</title>
                    {base}
                    <path d={`M${cx0},${y + 7} l7,7 l-7,7 l-7,-7 z`} className={r.critical ? "fill-accent" : "fill-ink"} />
                    <text x={cx0 + 11} y={y + 18} fontSize={11} className="fill-ink-2">
                      {zoom !== "month" ? r.t.name : ""}
                    </text>
                  </g>
                );
              }
              if (r.summary)
                return (
                  <g key={r.t.id} onClick={() => onSelect(r.t.id)} className="cursor-pointer">
                    <title>{title}</title>
                    {base}
                    <rect x={bx} y={y + 10} width={bw} height={6} className="fill-ink-3" opacity={0.45} />
                    <rect x={bx} y={y + 10} width={(bw * Math.min(100, r.pct)) / 100} height={6} className="fill-ink" />
                    <path d={`M${bx},${y + 10} h5 l-5,7 z M${bx + bw},${y + 10} h-5 l5,7 z`} className="fill-ink" />
                  </g>
                );
              return (
                <g key={r.t.id} onClick={() => onSelect(r.t.id)} className="cursor-pointer">
                  <title>{title}</title>
                  {base}
                  <rect x={bx} y={y + 7} width={bw} height={14} rx={3} className={r.critical ? "fill-accent-soft stroke-accent" : "fill-deep stroke-line-strong"} strokeWidth={1} />
                  {r.pct > 0 && <rect x={bx} y={y + 7} width={(bw * Math.min(100, r.pct)) / 100} height={14} rx={3} className={r.critical ? "fill-accent" : "fill-ink-2"} opacity={0.85} />}
                  {zoom !== "month" && (
                    <text x={bx + bw + 6} y={y + 18} fontSize={11} className="fill-ink-3">
                      {r.t.crew ?? ""}
                    </text>
                  )}
                </g>
              );
            })}
            {/* today */}
            <line x1={x(today)} x2={x(today)} y1={0} y2={H} className="stroke-ink" strokeDasharray="3 3" strokeWidth={1} />
          </svg>
        </div>
      </div>
    </div>
  );
}
