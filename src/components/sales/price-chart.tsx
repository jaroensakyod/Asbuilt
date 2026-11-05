"use client";

import { useState } from "react";
import { MONTHS, SOURCE_LABEL, thMonth, type PricePoint, type PriceSource } from "@/lib/sales/prices";
import { price } from "./common";

export const SOURCE_STROKE: Record<PriceSource, { color: string; dash?: string }> = {
  moc: { color: "var(--text)" },
  cgd: { color: "var(--text-3)", dash: "5 4" },
  supplier: { color: "var(--accent)" },
};

/** Price history, one line per source, muted grid, hover read-out per month */
export function PriceChart({ series, unit }: { series: Partial<Record<PriceSource, PricePoint[]>>; unit: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 680;
  const H = 240;
  const pad = { l: 56, r: 30, t: 14, b: 28 };
  const months = Array.from(new Set([...MONTHS, ...Object.values(series).flatMap((s) => s?.map((p) => p.date) ?? [])])).sort().slice(-24);
  const all = Object.values(series).flatMap((s) => s?.filter((p) => months.includes(p.date)).map((p) => p.price) ?? []);
  if (!all.length) return <p className="py-10 text-center text-[13px] text-ink-3">ยังไม่มีข้อมูลราคา</p>;
  let lo = Math.min(...all);
  let hi = Math.max(...all);
  const span = hi - lo || hi * 0.1 || 1;
  lo -= span * 0.15;
  hi += span * 0.15;
  const x = (i: number) => pad.l + (i / Math.max(1, months.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
  const ticks = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4);
  const idx = (d: string) => months.indexOf(d);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="กราฟราคาย้อนหลัง" onMouseLeave={() => setHover(null)}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--text-3)" className="font-mono">
              {price(t)}
            </text>
          </g>
        ))}
        {months.map((m, i) =>
          i % 3 === 0 || i === months.length - 1 ? (
            <text key={m} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--text-3)">
              {thMonth(m)}
            </text>
          ) : null,
        )}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="var(--line-strong)" />}
        {(Object.keys(series) as PriceSource[]).map((s) => {
          const pts = (series[s] ?? []).filter((p) => idx(p.date) >= 0);
          if (!pts.length) return null;
          const d = pts.map((p, i) => `${i ? "L" : "M"}${x(idx(p.date)).toFixed(1)},${y(p.price).toFixed(1)}`).join(" ");
          const st = SOURCE_STROKE[s];
          const last = pts[pts.length - 1];
          return (
            <g key={s}>
              <path d={d} fill="none" stroke={st.color} strokeWidth={1.5} strokeDasharray={st.dash} strokeLinejoin="round" />
              <circle cx={x(idx(last.date))} cy={y(last.price)} r={3} fill={st.color} />
              {hover !== null &&
                pts
                  .filter((p) => idx(p.date) === hover)
                  .map((p) => <circle key={p.date} cx={x(hover)} cy={y(p.price)} r={3.5} fill="var(--card)" stroke={st.color} strokeWidth={1.5} />)}
            </g>
          );
        })}
        {months.map((m, i) => (
          <rect key={m} x={x(i) - (W - pad.l - pad.r) / months.length / 2} y={pad.t} width={(W - pad.l - pad.r) / months.length} height={H - pad.t - pad.b} fill="transparent" onMouseEnter={() => setHover(i)} />
        ))}
      </svg>
      <div className="mt-2 flex min-h-[22px] flex-wrap items-center gap-x-5 gap-y-1 text-[12px] text-ink-2">
        {(Object.keys(series) as PriceSource[]).map((s) => {
          const st = SOURCE_STROKE[s];
          const p = hover !== null ? series[s]?.find((q) => q.date === months[hover]) : undefined;
          return (
            <span key={s} className="inline-flex items-center gap-2">
              <svg width="18" height="6" aria-hidden>
                <line x1="0" x2="18" y1="3" y2="3" stroke={st.color} strokeWidth="1.5" strokeDasharray={st.dash} />
              </svg>
              {SOURCE_LABEL[s]}
              {hover !== null && <span className="num font-mono text-ink">{p ? `${price(p.price)} บ./${unit}` : "–"}</span>}
            </span>
          );
        })}
        {hover !== null && <span className="ml-auto text-ink-3">{thMonth(months[hover])}</span>}
      </div>
    </div>
  );
}
