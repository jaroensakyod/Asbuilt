"use client";

import { useState } from "react";

export type ChartPoint = { key: string; label: string; contract: number; contracts: number; handovers: number; ma: number };

const W = 960;
const PAD_L = 52;
const PAD_R = 12;
const TOP = 16;
const PLOT_H = 220;
const STRIP_Y = TOP + PLOT_H + 34;
const H = STRIP_Y + 30;

function niceMax(v: number) {
  if (v <= 0) return 10;
  const step = v > 50 ? 20 : v > 20 ? 10 : 5;
  return Math.ceil(v / step) * step;
}

/** Contract value bars by contract month, 12-month moving average, handovers strip */
export function ContractChart({ data }: { data: ChartPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(...data.map((d) => Math.max(d.contract, d.ma))));
  const ticks = 4;
  const bw = (W - PAD_L - PAD_R) / data.length;
  const x = (i: number) => PAD_L + i * bw;
  const y = (v: number) => TOP + PLOT_H - (v / max) * PLOT_H;
  const line = data.map((d, i) => `${i ? "L" : "M"}${(x(i) + bw / 2).toFixed(1)},${y(d.ma).toFixed(1)}`).join(" ");
  const h = hover != null ? data[hover] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="มูลค่าสัญญารายเดือน 24 เดือนล่าสุด" onPointerLeave={() => setHover(null)}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const i = Math.floor((((e.clientX - r.left) / r.width) * W - PAD_L) / bw);
          setHover(i >= 0 && i < data.length ? i : null);
        }}
      >
        {Array.from({ length: ticks + 1 }, (_, i) => {
          const v = (max / ticks) * i;
          return (
            <g key={i}>
              <line x1={PAD_L} x2={W - PAD_R} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth={1} />
              <text x={PAD_L - 8} y={y(v) + 4} textAnchor="end" className="fill-ink-3 font-mono text-[11px]">
                {v === 0 ? "0" : `${v} ล.`}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const bh = (d.contract / max) * PLOT_H;
          const isLast = i === data.length - 1;
          return (
            <g key={d.key}>
              {hover === i && <rect x={x(i)} y={TOP} width={bw} height={STRIP_Y + 22 - TOP} fill="var(--raised)" opacity={0.7} />}
              {d.contract > 0 && (
                <rect
                  x={x(i) + bw * 0.2}
                  y={y(d.contract)}
                  width={bw * 0.6}
                  height={Math.max(bh, 1)}
                  rx={2}
                  fill={hover === i || (hover == null && isLast) ? "var(--accent)" : "var(--text-2)"}
                  opacity={hover === i || (hover == null && isLast) ? 1 : 0.72}
                />
              )}
              {i % 3 === 0 && (
                <text x={x(i) + bw / 2} y={TOP + PLOT_H + 18} textAnchor="middle" className="fill-ink-3 font-mono text-[11px]">
                  {d.label}
                </text>
              )}
              {/* handovers strip */}
              {d.handovers > 0 ? (
                <g>
                  <rect x={x(i) + bw * 0.25} y={STRIP_Y} width={bw * 0.5} height={14} rx={3} fill="var(--pos)" opacity={0.85} />
                  <text x={x(i) + bw / 2} y={STRIP_Y + 11} textAnchor="middle" className="fill-card font-mono text-[10px]">
                    {d.handovers}
                  </text>
                </g>
              ) : (
                <rect x={x(i) + bw * 0.42} y={STRIP_Y + 6} width={bw * 0.16} height={2} rx={1} fill="var(--line-strong)" />
              )}
            </g>
          );
        })}
        <path d={line} fill="none" stroke="var(--text)" strokeWidth={1.5} strokeDasharray="5 4" pointerEvents="none" />
        <text x={PAD_L - 8} y={STRIP_Y + 11} textAnchor="end" className="fill-ink-3 text-[11px]">
          ส่งมอบ
        </text>
      </svg>
      {h && hover != null && (
        <div
          className="pointer-events-none absolute top-2 z-10 w-[188px] rounded-[10px] border border-line-strong bg-card px-3 py-2.5 text-[12px] shadow-[0_4px_16px_rgba(31,27,22,0.10)]"
          style={{
            left: `${((x(hover) + bw / 2) / W) * 100}%`,
            transform: hover > data.length * 0.6 ? "translateX(calc(-100% - 12px))" : "translateX(12px)",
          }}
        >
          <p className="font-mono text-ink-3">{h.label}</p>
          <dl className="mt-1.5 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5">
            <dt className="text-ink-2">มูลค่าสัญญา</dt>
            <dd className="num text-right font-mono">฿{h.contract.toFixed(1)} ล.</dd>
            <dt className="text-ink-2">จำนวนสัญญา</dt>
            <dd className="num text-right font-mono">{h.contracts}</dd>
            <dt className="text-ink-2">ค่าเฉลี่ย 12 เดือน</dt>
            <dd className="num text-right font-mono">฿{h.ma.toFixed(1)} ล.</dd>
            <dt className="text-ink-2">ส่งมอบ</dt>
            <dd className="num text-right font-mono">{h.handovers} หลัง</dd>
          </dl>
        </div>
      )}
    </div>
  );
}

export function ChartLegend() {
  return (
    <span className="flex flex-wrap items-center gap-4 text-[12px] text-ink-3">
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-[2px] bg-ink-2/70" />
        มูลค่าสัญญา
      </span>
      <span className="flex items-center gap-1.5">
        <svg width="18" height="4" aria-hidden>
          <line x1="0" x2="18" y1="2" y2="2" stroke="var(--text)" strokeWidth="1.5" strokeDasharray="5 3" />
        </svg>
        ค่าเฉลี่ย 12 เดือน
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-[2px] bg-pos/85" />
        ส่งมอบ
      </span>
    </span>
  );
}
