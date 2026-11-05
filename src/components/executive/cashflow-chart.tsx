"use client";

import { useState } from "react";
import type { FlowMonth } from "./metrics";

const W = 960;
const PAD_L = 60;
const PAD_R = 12;
const TOP = 14;
const PLOT_H = 260;
const H = TOP + PLOT_H + 30;

function niceStep(v: number) {
  if (v <= 0) return 1e6;
  const raw = v / 3;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
}
const fmt = (v: number) => {
  const a = Math.abs(v) / 1e6;
  const s = a >= 10 ? a.toFixed(0) : a.toFixed(1);
  return `${v < 0 ? "-" : ""}${s} ล.`;
};

/** Cash in (above zero) vs cash out (below zero) by month; net as the one highlighted line. Forecast months lighter. */
export function CashflowChart({ data }: { data: FlowMonth[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const maxIn = Math.max(0, ...data.map((d) => Math.max(d.inflow, d.net)));
  const maxOut = Math.max(0, ...data.map((d) => Math.max(d.outflow, -d.net)));
  const step = niceStep(Math.max(maxIn, maxOut));
  const top = Math.max(step, Math.ceil(maxIn / step) * step);
  const bottom = Math.max(step, Math.ceil(maxOut / step) * step);
  const span = top + bottom;
  const y = (v: number) => TOP + ((top - v) / span) * PLOT_H;
  const bw = (W - PAD_L - PAD_R) / data.length;
  const x = (i: number) => PAD_L + i * bw;
  const firstF = data.findIndex((d) => d.forecast);
  const ticks: number[] = [];
  for (let v = -bottom; v <= top + 1; v += step) ticks.push(v);
  const line = data.map((d, i) => `${i ? "L" : "M"}${(x(i) + bw / 2).toFixed(1)},${y(d.net).toFixed(1)}`).join(" ");
  const h = hover != null ? data[hover] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full"
        role="img"
        aria-label="กระแสเงินสดรายเดือน เงินเข้า เงินออก และสุทธิ"
        onPointerLeave={() => setHover(null)}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const i = Math.floor((((e.clientX - r.left) / r.width) * W - PAD_L) / bw);
          setHover(i >= 0 && i < data.length ? i : null);
        }}
      >
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(v)} y2={y(v)} stroke={v === 0 ? "var(--line-strong)" : "var(--line)"} strokeWidth={1} />
            <text x={PAD_L - 8} y={y(v) + 4} textAnchor="end" className="fill-ink-3 font-mono text-[11px]">
              {v === 0 ? "0" : fmt(v)}
            </text>
          </g>
        ))}
        {firstF > 0 && (
          <g>
            <line x1={x(firstF)} x2={x(firstF)} y1={TOP} y2={TOP + PLOT_H} stroke="var(--line-strong)" strokeDasharray="3 3" />
            <text x={x(firstF) + 6} y={TOP + 10} className="fill-ink-3 text-[11px]">
              คาดการณ์
            </text>
          </g>
        )}
        {data.map((d, i) => {
          const op = d.forecast ? 0.45 : 0.8;
          return (
            <g key={d.key}>
              {hover === i && <rect x={x(i)} y={TOP} width={bw} height={PLOT_H} fill="var(--raised)" opacity={0.7} />}
              {d.inflow > 0 && <rect x={x(i) + bw * 0.22} y={y(d.inflow)} width={bw * 0.56} height={Math.max(1, y(0) - y(d.inflow))} rx={2} fill="var(--text-2)" opacity={op} />}
              {d.outflow > 0 && <rect x={x(i) + bw * 0.22} y={y(0)} width={bw * 0.56} height={Math.max(1, y(-d.outflow) - y(0))} rx={2} fill="var(--text-3)" opacity={op * 0.55} />}
              <text x={x(i) + bw / 2} y={TOP + PLOT_H + 18} textAnchor="middle" className="fill-ink-3 font-mono text-[11px]">
                {d.label}
              </text>
            </g>
          );
        })}
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth={1.75} pointerEvents="none" />
        {data.map((d, i) => (
          <circle key={d.key} cx={x(i) + bw / 2} cy={y(d.net)} r={hover === i ? 4 : 2.75} fill={d.forecast ? "var(--card)" : "var(--accent)"} stroke="var(--accent)" strokeWidth={1.5} pointerEvents="none" />
        ))}
      </svg>
      {h && hover != null && (
        <div
          className="pointer-events-none absolute top-2 z-10 w-[200px] rounded-[10px] border border-line-strong bg-card px-3 py-2.5 text-[12px] shadow-[0_4px_16px_rgba(31,27,22,0.10)]"
          style={{ left: `${((x(hover) + bw / 2) / W) * 100}%`, transform: hover > data.length * 0.6 ? "translateX(calc(-100% - 12px))" : "translateX(12px)" }}
        >
          <p className="font-mono text-ink-3">
            {h.label} · {h.forecast ? "คาดการณ์" : "เกิดขึ้นจริง"}
          </p>
          <dl className="mt-1.5 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5">
            <dt className="text-ink-2">เงินเข้า</dt>
            <dd className="num text-right font-mono">{fmt(h.inflow)}</dd>
            <dt className="text-ink-2">เงินออก</dt>
            <dd className="num text-right font-mono">{fmt(h.outflow)}</dd>
            <dt className="text-ink">สุทธิ</dt>
            <dd className={h.net < 0 ? "num text-right font-mono text-neg" : "num text-right font-mono"}>{fmt(h.net)}</dd>
          </dl>
        </div>
      )}
    </div>
  );
}

export function CashflowLegend() {
  return (
    <span className="flex flex-wrap items-center gap-4 text-[12px] text-ink-3">
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-[2px] bg-ink-2/80" />
        เงินเข้า (งวดลูกค้า)
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-[2px] bg-ink-3/45" />
        เงินออก (ผู้ขาย + เงินเดือน)
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-0.5 w-4 rounded-full bg-accent" />
        สุทธิ
      </span>
    </span>
  );
}
