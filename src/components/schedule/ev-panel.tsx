"use client";

import type { ReactNode } from "react";
import { Card, CardHead, cx } from "@/components/ui";
import { StatCard } from "@/components/ops/bits";
import { thDate, TODAY } from "@/lib/data";
import { diffDays, type EvPoint, type EvResult } from "@/lib/schedule";
import { fmtIdx, fmtM, fmtPct, idxTone } from "./bits";

const TH_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export function EvPanel({ ev, money, spiWarn, contractFinish }: { ev: EvResult; money: boolean; spiWarn: number; contractFinish: string }) {
  const m = (n?: number) => (n === undefined ? "–" : money ? fmtM(n) : "•••");
  const late = diffDays(contractFinish, ev.forecastFinish);
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="SPI ดัชนีกำหนดเวลา" value={fmtIdx(ev.spi)} tone={idxTone(ev.spi, spiWarn) === "neg" ? "neg" : undefined} note={`EV ÷ PV · SPI(t) ${fmtIdx(ev.spiT)}`} />
        <StatCard label="CPI ดัชนีต้นทุน" value={fmtIdx(ev.cpi)} tone={idxTone(ev.cpi, 0.95) === "neg" ? "neg" : undefined} note="EV ÷ AC (ตามงบต้นทุน)" />
        <StatCard label="คาดการณ์แล้วเสร็จ" value={thDate(ev.forecastFinish)} note={late > 0 ? `ช้ากว่าสัญญา ${late} วัน` : late < 0 ? `ก่อนสิ้นสุดสัญญา ${-late} วัน` : "ตรงวันสิ้นสุดสัญญา"} tone={late > 0 ? "neg" : undefined} />
        <StatCard label="EAC ต้นทุนเมื่อแล้วเสร็จ" value={m(ev.eac)} unit="ล้านบาท" note={ev.vac === undefined ? "ยังไม่มีต้นทุนจริง" : money ? `${ev.vac < 0 ? "เกินงบ" : "ต่ำกว่างบ"} ${fmtM(Math.abs(ev.vac))} ล้าน (VAC)` : "•••"} tone={ev.vac !== undefined && ev.vac < 0 ? "neg" : undefined} />
      </div>

      <Card>
        <CardHead title="S-curve มูลค่างาน" meta={`ณ ${thDate(TODAY)} · หน่วยล้านบาท (ตามงบต้นทุน)`} />
        <EvChart points={ev.series} bac={ev.bacCost} money={money} />
      </Card>

      <Card>
        <CardHead title="ตัวชี้วัด earned value" />
        <div className="grid gap-x-8 px-5 py-3 text-[13px] sm:grid-cols-2 xl:grid-cols-3">
          <Row k="BAC งบต้นทุนทั้งโครงการ" v={m(ev.bacCost)} sub={money ? `มูลค่าสัญญาตาม WBS ${fmtM(ev.bac)} ล้าน` : undefined} />
          <Row k="PV มูลค่างานตามแผน" v={m(ev.pv)} sub={fmtPct(ev.planPct)} />
          <Row k="EV มูลค่างานที่ทำได้" v={m(ev.ev)} sub={fmtPct(ev.actualPct)} />
          <Row k="AC ต้นทุนจริงสะสม" v={m(ev.ac)} />
          <Row k="SV ผลต่างกำหนดเวลา (EV − PV)" v={m(ev.sv)} neg={ev.sv < 0} />
          <Row k="CV ผลต่างต้นทุน (EV − AC)" v={m(ev.cv)} neg={ev.cv < 0} />
          <Row k="ETC ต้นทุนที่ต้องใช้อีก" v={m(ev.etc)} />
          <Row k="TCPI ประสิทธิภาพที่ต้องทำได้" v={fmtIdx(ev.tcpi)} neg={(ev.tcpi ?? 0) > 1.05} />
          <Row k="งานที่ทำได้ตรงกับแผนของวันที่" v={ev.earnedDate ? thDate(ev.earnedDate) : "–"} />
          <Row k="เสร็จตามเส้นฐาน" v={thDate(ev.plannedFinish)} />
          <Row k="สิ้นสุดสัญญา" v={thDate(contractFinish)} />
        </div>
        <p className="border-t border-line px-5 py-3 text-[12px] text-ink-3">
          PV กระจายมูลค่างานแต่ละรายการเชิงเส้นตามวันเริ่ม–เสร็จของเส้นฐาน · EV = มูลค่างาน × % ที่วัดได้ · มูลค่างานเป็นราคาตามสัญญา จึงแปลงเป็นฐานต้นทุนด้วยสัดส่วนงบต้นทุนต่อมูลค่าสัญญาก่อนเทียบกับ AC · AC มาจากรายการต้นทุนจริง (วัสดุ ผู้รับเหมาช่วง เครื่องจักร) และค่าแรงหน้างานจากเงินเดือน
        </p>
      </Card>
    </div>
  );
}

function Row({ k, v, sub, neg }: { k: string; v: ReactNode; sub?: string; neg?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2">
      <span className="text-ink-2">{k}</span>
      <span className="text-right">
        <span className={cx("num font-mono", neg && "text-neg")}>{v}</span>
        {sub && <span className="block font-mono text-[11px] text-ink-3">{sub}</span>}
      </span>
    </div>
  );
}

export function EvChart({ points, bac, money }: { points: EvPoint[]; bac: number; money: boolean }) {
  if (points.length < 2) return <p className="px-5 py-10 text-center text-[13px] text-ink-3">ยังไม่มีข้อมูลเพียงพอสำหรับกราฟ</p>;
  const W = 820;
  const H = 280;
  const L = 52;
  const R = 44;
  const T = 14;
  const B = 30;
  const t0 = Date.parse(points[0].date);
  const t1 = Date.parse(points[points.length - 1].date);
  const maxY = Math.max(bac, ...points.map((p) => Math.max(p.pv, p.ev ?? 0, p.ac ?? 0))) * 1.06 || 1;
  const x = (d: string) => L + ((Date.parse(d) - t0) / Math.max(1, t1 - t0)) * (W - L - R);
  const y = (v: number) => T + (1 - v / maxY) * (H - T - B);
  const path = (key: "pv" | "ev" | "ac") =>
    points
      .filter((p) => typeof p[key] === "number")
      .map((p, i) => `${i ? "L" : "M"}${x(p.date).toFixed(1)},${y(p[key] as number).toFixed(1)}`)
      .join(" ");
  const step = maxY > 40e6 ? 10e6 : maxY > 16e6 ? 4e6 : maxY > 6e6 ? 1e6 : 0.5e6;
  const yTicks: number[] = [];
  for (let v = 0; v <= maxY; v += step) yTicks.push(v);
  const months: string[] = [];
  for (const p of points) if (!months.length || p.date.slice(0, 7) !== months[months.length - 1].slice(0, 7)) months.push(p.date);
  const every = Math.max(1, Math.ceil(months.length / 10));
  const todayX = TODAY >= points[0].date && TODAY <= points[points.length - 1].date ? x(TODAY) : undefined;
  const last = [...points].reverse().find((p) => p.ev !== undefined);

  return (
    <div className="px-5 py-4">
      <div className="mb-2 flex flex-wrap gap-4 text-[12px] text-ink-2">
        <Legend dash className="stroke-ink-3">
          PV ตามแผน (เส้นฐาน)
        </Legend>
        <Legend className="stroke-ink">EV มูลค่างานที่ทำได้</Legend>
        <Legend className="stroke-accent" thick>
          AC ต้นทุนจริง
        </Legend>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="S-curve PV EV AC">
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="stroke-line" strokeWidth={1} />
            <text x={L - 8} y={y(v) + 4} textAnchor="end" className="fill-ink-3 font-mono" fontSize={11}>
              {money ? (v / 1e6).toLocaleString("th-TH", { maximumFractionDigits: 1 }) : ""}
            </text>
          </g>
        ))}
        {[0, 25, 50, 75, 100].map((pc) => (
          <text key={pc} x={W - R + 6} y={y((bac * pc) / 100) + 4} className="fill-ink-3 font-mono" fontSize={10}>
            {pc}%
          </text>
        ))}
        <line x1={L} x2={W - R} y1={y(bac)} y2={y(bac)} className="stroke-ink-3" strokeDasharray="2 3" strokeWidth={1} />
        <text x={L + 4} y={y(bac) - 4} className="fill-ink-3" fontSize={11}>
          BAC
        </text>
        {months.map((d, i) =>
          i % every === 0 ? (
            <text key={d} x={x(d)} y={H - 10} textAnchor="middle" className="fill-ink-3" fontSize={11}>
              {TH_MONTH[Number(d.slice(5, 7)) - 1]} {String(Number(d.slice(0, 4)) + 543).slice(2)}
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
        <path d={path("pv")} fill="none" className="stroke-ink-3" strokeDasharray="5 4" strokeWidth={1.5} />
        <path d={path("ev")} fill="none" className="stroke-ink" strokeWidth={1.75} />
        <path d={path("ac")} fill="none" className="stroke-accent" strokeWidth={2.25} />
        {last && <circle cx={x(last.date)} cy={y(last.ev!)} r={3.5} className="fill-ink" />}
        {last?.ac !== undefined && <circle cx={x(last.date)} cy={y(last.ac)} r={3.5} className="fill-accent" />}
      </svg>
    </div>
  );
}

function Legend({ children, className, dash, thick }: { children: ReactNode; className: string; dash?: boolean; thick?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width="22" height="8" aria-hidden>
        <line x1="1" x2="21" y1="4" y2="4" className={className} strokeWidth={thick ? 2.25 : 1.5} strokeDasharray={dash ? "4 3" : undefined} />
      </svg>
      {children}
    </span>
  );
}
