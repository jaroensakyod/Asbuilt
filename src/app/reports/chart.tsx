"use client";

import { useState } from "react";

export type BarDatum = { label: string; value: number; hi?: number; note?: string };

const fmt = (v: number) => (Math.abs(v) >= 100 ? Math.round(v).toLocaleString("th-TH") : String(Math.round(v * 10) / 10));

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * p;
}

/**
 * Vertical bar chart. `value` is the whole bar (muted ink); `hi` is the part of
 * it drawn in the single highlight colour (e.g. failed, overdue, this month).
 */
export function BarChart({ data, unit, hiLabel, baseLabel }: { data: BarDatum[]; unit: string; hiLabel?: string; baseLabel: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 800;
  const H = 260;
  const L = 44;
  const R = 8;
  const T = 12;
  const B = 28;
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const iw = W - L - R;
  const ih = H - T - B;
  const step = data.length ? iw / data.length : iw;
  const bw = Math.max(2, Math.min(36, step * 0.62));
  const y = (v: number) => T + ih - (v / max) * ih;
  const every = Math.max(1, Math.ceil(data.length / 12));
  const h = hover !== null ? data[hover] : null;

  return (
    <div className="relative">
      <div className="mb-3 flex flex-wrap items-center gap-4 text-[12px] text-ink-2">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[2px] bg-ink/55" />
          {baseLabel}
        </span>
        {hiLabel && (
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[2px] bg-accent" />
            {hiLabel}
          </span>
        )}
        <span className="font-mono text-ink-3">หน่วย {unit}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`กราฟ ${baseLabel}`} onMouseLeave={() => setHover(null)}>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={L} x2={W - R} y1={y(max * f)} y2={y(max * f)} stroke="var(--line-strong)" strokeWidth={f === 0 ? 1 : 0.6} strokeDasharray={f === 0 ? undefined : "2 4"} />
            <text x={L - 8} y={y(max * f) + 4} textAnchor="end" className="fill-ink-3 font-mono" fontSize={11}>
              {fmt(max * f)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = L + step * i + step / 2;
          const hi = Math.min(d.hi ?? 0, d.value);
          return (
            <g key={i} onMouseEnter={() => setHover(i)}>
              <rect x={L + step * i} y={T} width={step} height={ih} fill="transparent" />
              {hover === i && <rect x={L + step * i} y={T} width={step} height={ih} fill="var(--raised)" opacity={0.7} />}
              <rect x={cx - bw / 2} y={y(d.value)} width={bw} height={Math.max(0, y(0) - y(d.value))} rx={2} fill="var(--text)" opacity={0.55} />
              {hi > 0 && <rect x={cx - bw / 2} y={y(hi)} width={bw} height={Math.max(0, y(0) - y(hi))} rx={2} fill="var(--accent)" />}
              {i % every === 0 && (
                <text x={cx} y={H - 9} textAnchor="middle" className="fill-ink-3 font-mono" fontSize={11}>
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {h && hover !== null && (
        <div
          className="pointer-events-none absolute top-8 z-10 min-w-36 rounded-[8px] border border-line-strong bg-card px-3 py-2 text-[12px] shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
          style={{ left: `${Math.min(78, ((L + step * hover + step / 2) / W) * 100)}%` }}
        >
          <p className="font-mono text-ink-3">{h.label}</p>
          <p className="mt-0.5 text-ink">
            {baseLabel} <span className="num font-mono">{fmt(h.value)}</span>
          </p>
          {hiLabel && (
            <p className="text-accent-text">
              {hiLabel} <span className="num font-mono">{fmt(h.hi ?? 0)}</span>
            </p>
          )}
          {h.note && <p className="text-ink-3">{h.note}</p>}
        </div>
      )}
    </div>
  );
}

export type HBarDatum = { label: string; sub?: string; value: number; mark?: number; hi?: boolean };

/** List with bars: value bar with an optional tick (e.g. plan); `hi` rows use the highlight colour */
export function HBarList({ data, max = 100, unit = "%" }: { data: HBarDatum[]; max?: number; unit?: string }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {data.map((d, i) => (
        <li key={i} className="grid grid-cols-[minmax(0,220px)_minmax(0,1fr)_64px] items-center gap-4">
          <div className="min-w-0">
            <p className="truncate text-[13px] text-ink">{d.label}</p>
            {d.sub && <p className="truncate font-mono text-[11px] text-ink-3">{d.sub}</p>}
          </div>
          <div className="relative h-2 rounded-full bg-raised">
            <div className={d.hi ? "absolute inset-y-0 left-0 rounded-full bg-accent" : "absolute inset-y-0 left-0 rounded-full bg-ink/55"} style={{ width: `${Math.min(100, (d.value / max) * 100)}%` }} />
            {d.mark !== undefined && <div className="absolute -top-1 h-4 w-px bg-ink" style={{ left: `${Math.min(100, (d.mark / max) * 100)}%` }} />}
          </div>
          <p className="num text-right font-mono text-[12px] text-ink-2">
            {fmt(d.value)}
            {unit}
          </p>
        </li>
      ))}
    </ul>
  );
}
