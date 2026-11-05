"use client";

import { TODAY } from "@/lib/data";
import type { CurvePoint } from "@/lib/procurement";

const TH_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

/** Cumulative cost vs planned and earned value over the project timeline */
export function SCurve({ points, budget }: { points: CurvePoint[]; budget: number }) {
  if (points.length < 2) return <p className="px-5 py-10 text-center text-[13px] text-ink-3">ยังไม่มีข้อมูลเพียงพอสำหรับกราฟ</p>;
  const W = 760;
  const H = 260;
  const L = 52;
  const R = 16;
  const T = 14;
  const B = 30;
  const t0 = Date.parse(points[0].date);
  const t1 = Date.parse(points[points.length - 1].date);
  const maxY = Math.max(budget, ...points.map((p) => Math.max(p.planned, p.actual ?? 0, p.forecast ?? 0, p.earned ?? 0))) * 1.08 || 1;
  const x = (d: string) => L + ((Date.parse(d) - t0) / Math.max(1, t1 - t0)) * (W - L - R);
  const y = (v: number) => T + (1 - v / maxY) * (H - T - B);
  const path = (key: keyof CurvePoint) =>
    points
      .filter((p) => typeof p[key] === "number")
      .map((p, i) => `${i ? "L" : "M"}${x(p.date).toFixed(1)},${y(p[key] as number).toFixed(1)}`)
      .join(" ");
  const step = maxY > 20e6 ? 10e6 : maxY > 8e6 ? 2e6 : maxY > 3e6 ? 1e6 : 0.5e6;
  const yTicks: number[] = [];
  for (let v = 0; v <= maxY; v += step) yTicks.push(v);
  const months = points.filter((p) => p.date !== TODAY);
  const every = Math.max(1, Math.ceil(months.length / 8));
  const todayX = TODAY >= points[0].date && TODAY <= points[points.length - 1].date ? x(TODAY) : undefined;
  const last = [...points].reverse().find((p) => p.actual !== undefined);

  return (
    <div className="px-5 py-4">
      <div className="mb-2 flex flex-wrap gap-4 text-[12px] text-ink-2">
        <Legend dash className="stroke-ink-3">
          แผนงบประมาณ
        </Legend>
        <Legend className="stroke-ink">มูลค่างานที่ทำได้ (ตามความคืบหน้า)</Legend>
        <Legend className="stroke-accent" thick>
          ต้นทุนจริงสะสม
        </Legend>
        <Legend dash className="stroke-accent">
          คาดการณ์ถึงแล้วเสร็จ
        </Legend>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="กราฟ S-curve ต้นทุนเทียบความคืบหน้า">
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="stroke-line" strokeWidth={1} />
            <text x={L - 8} y={y(v) + 4} textAnchor="end" className="fill-ink-3 font-mono" fontSize={11}>
              {(v / 1e6).toLocaleString("th-TH", { maximumFractionDigits: 1 })}
            </text>
          </g>
        ))}
        <text x={8} y={T + 4} className="fill-ink-3" fontSize={11}>
          ล้าน
        </text>
        <line x1={L} x2={W - R} y1={y(budget)} y2={y(budget)} className="stroke-ink-3" strokeDasharray="2 3" strokeWidth={1} />
        <text x={W - R} y={y(budget) - 4} textAnchor="end" className="fill-ink-3" fontSize={11}>
          งบประมาณ
        </text>
        {months.map((p, i) =>
          i % every === 0 ? (
            <text key={p.date} x={x(p.date)} y={H - 10} textAnchor="middle" className="fill-ink-3" fontSize={11}>
              {TH_MONTH[Number(p.date.slice(5, 7)) - 1]} {String(Number(p.date.slice(0, 4)) + 543).slice(2)}
            </text>
          ) : null,
        )}
        {todayX !== undefined && (
          <g>
            <line x1={todayX} x2={todayX} y1={T} y2={H - B} className="stroke-ink-3" strokeWidth={1} />
            <text x={todayX + 4} y={T + 10} className="fill-ink-3" fontSize={11}>
              วันนี้
            </text>
          </g>
        )}
        <path d={path("planned")} fill="none" className="stroke-ink-3" strokeDasharray="5 4" strokeWidth={1.5} />
        <path d={path("earned")} fill="none" className="stroke-ink" strokeWidth={1.5} />
        <path d={path("forecast")} fill="none" className="stroke-accent" strokeDasharray="5 4" strokeWidth={1.5} />
        <path d={path("actual")} fill="none" className="stroke-accent" strokeWidth={2.25} />
        {last && <circle cx={x(last.date)} cy={y(last.actual!)} r={3.5} className="fill-accent" />}
      </svg>
    </div>
  );
}

function Legend({ children, className, dash, thick }: { children: React.ReactNode; className: string; dash?: boolean; thick?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width="22" height="8" aria-hidden>
        <line x1="1" x2="21" y1="4" y2="4" className={className} strokeWidth={thick ? 2.25 : 1.5} strokeDasharray={dash ? "4 3" : undefined} />
      </svg>
      {children}
    </span>
  );
}
