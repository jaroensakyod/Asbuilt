"use client";

import { useMemo, useState } from "react";
import { Card, CardHead, cx } from "@/components/ui";
import { payrollRuns } from "@/lib/biz";
import { TODAY } from "@/lib/data";
import { goodsReceipts, isOpenPO, poTotals, purchaseOrders, receivedValue, suppliers } from "@/lib/procurement";
import { A } from "@/lib/accounting/coa";
import { arStatus, billStatus } from "@/lib/accounting/journal";
import { addMonths, periodLabel, periodOf, r2, sum } from "@/lib/accounting/money";
import { netByAccount } from "@/lib/accounting/reports";
import { useBooks } from "@/lib/accounting/store";
import { addDaysIso, buildCashflow, certCol, clientCertsOf, contractTerms, INFLOW_CATS, monthsFrom, OUTFLOW_CATS, retentionDueDate, retentionHeld, scCol, subCertsOf, termsFor, useAllProjects, useContractSettings, useContractSummaries, type CashflowInput, type CfRow, type InCat, type MeasuredForecast, type OutCat } from "@/lib/contracts";
import { Baht, CsvButton, FilterField, Header, millions, Select, StatCard, tableCls, td, tdR, th, thR } from "./bits";

const MONTHS = 12;

export function CashflowView() {
  const projects = useAllProjects();
  const [scope, setScope] = useState("");
  const { input, entries } = useBooks();
  const terms = contractTerms.use();
  const settings = useContractSettings();
  const certs = certCol.use();
  const scs = scCol.use();
  const pos = purchaseOrders.use();
  const grs = goodsReceipts.use();
  const sups = suppliers.use();
  const runs = payrollRuns.use();
  const summaries = useContractSummaries();

  const cf = useMemo(() => {
    const months = monthsFrom(periodOf(TODAY), MONTHS);
    const inScope = (pid?: string) => !scope || pid === scope;
    const receivables: CashflowInput["receivables"] = [];
    for (const item of input.installments) {
      if (!inScope(item.projectId)) continue;
      const cat: InCat = item.origin === "ipc" ? "certs" : item.origin === "retention" ? "retention" : "installments";
      const st = arStatus(item, input.arDocs, input.projects);
      if (!st) {
        if (item.status !== "paid") receivables.push({ cat, date: item.dueDate, amount: r2(item.amount + item.vat) });
      } else if (!st.paid) receivables.push({ cat, date: st.inv.dueDate < TODAY ? TODAY : st.inv.dueDate, amount: r2(st.outstanding - (item.wht ?? 0) * (st.outstanding / Math.max(1, st.inv.amount + st.inv.vat - st.inv.retention))) });
    }
    const measured: MeasuredForecast[] = [];
    for (const s of summaries) {
      const t = s.terms;
      if (t.billing !== "measured" || !inScope(s.project.id)) continue;
      const mine = clientCertsOf(certs, s.project.id);
      // certificates not yet certified are paid after certification + the payment term
      for (const c of mine.filter((x) => x.status === "draft" || x.status === "submitted")) receivables.push({ cat: "certs", date: addDaysIso(TODAY, t.certPayDays + 7), amount: c.net });
      const held = retentionHeld(certs, s.project.id);
      if (!t.retentionRelease && held > 0) {
        const due = retentionDueDate(s.project.handedOver ?? (s.project.status === "delivered" ? s.project.finish : undefined), t.defectsMonths) ?? addDaysIso(s.project.finish, 30 * t.defectsMonths);
        receivables.push({ cat: "retention", date: due < TODAY ? addDaysIso(TODAY, 30) : addDaysIso(due, 30), amount: r2(held * (1 - t.whtRate / 100)) });
      }
      if (s.project.status === "building" || s.project.status === "handover")
        measured.push({ projectId: s.project.id, finish: s.project.finish, contractValue: s.contractValue, grossToDate: mine.at(-1)?.grossToDate ?? 0, retentionPct: t.retentionPct, retentionRoom: Math.max(0, r2((s.contractValue * t.retentionCapPct) / 100 - held)), advanceLeft: s.advanceOutstanding, whtRate: t.whtRate, payLagDays: t.certPayDays + 10 });
    }
    const payables: CashflowInput["payables"] = [];
    for (const po of pos) {
      if (!isOpenPO(po) || !inScope(po.projectId)) continue;
      const tt = poTotals(po);
      const left = r2(tt.subtotal - receivedValue(po, grs));
      if (!(left > 0)) continue;
      const terms0 = sups.find((x) => x.id === po.supplierId)?.paymentTerms ?? 30;
      payables.push({ cat: "pos", date: addDaysIso(po.deliveryDate < TODAY ? TODAY : po.deliveryDate, terms0), amount: r2(left * (1 + po.vatRate / 100) * (1 - po.whtRate / 100)) });
    }
    for (const b of input.bills) {
      if (!inScope(b.projectId)) continue;
      const st = billStatus(b, input.apPayments);
      if (st.paid) continue;
      const whtLeft = r2((b.subtotal * (b.whtRate || 0)) / 100 - sum(st.payments.map((p) => p.wht)));
      payables.push({ cat: "bills", date: b.dueDate < TODAY ? TODAY : b.dueDate, amount: r2(st.outstanding - Math.max(0, whtLeft)) });
    }
    const subcontracts: CashflowInput["subcontracts"] = [];
    for (const sc of scs) {
      if ((sc.status !== "active" && sc.status !== "draft") || !inScope(sc.projectId)) continue;
      const done = subCertsOf(certs, sc.id).filter((c) => c.status === "certified" || c.status === "paid").at(-1)?.grossToDate ?? 0;
      const left = r2(sc.value - done);
      if (left > 0) subcontracts.push({ amount: r2(left * (1 + (sc.vat ? settings.vatRate : 0) / 100) - (left * (sc.retentionPct + sc.whtRate)) / 100), finish: sc.finish < TODAY ? TODAY : sc.finish });
    }
    // payroll: average net pay of the last three months (site lines only for one project)
    const from = addMonths(periodOf(TODAY), -3);
    const recent = runs.filter((r) => r.status !== "draft" && r.period >= from && r.period < periodOf(TODAY));
    const lines = recent.flatMap((r) => r.lines).filter((l) => !scope || l.projectId === scope);
    const payrollMonthly = r2(sum(lines.map((l) => l.net)) / 3);
    const project = projects.find((p) => p.id === scope);
    const opening = scope ? 0 : (() => {
      const bal = netByAccount(entries, { to: TODAY });
      return r2((bal.get(A.bank)?.net ?? 0) + (bal.get(A.cash)?.net ?? 0) + (bal.get(A.petty)?.net ?? 0));
    })();
    return { months, ...buildCashflow({ months, vatRate: settings.vatRate, receivables, measured, payables, subcontracts, payrollMonthly, payrollUntil: project?.finish, opening }), opening, payrollMonthly };
  }, [scope, input, entries, summaries, certs, scs, pos, grs, sups, runs, settings, projects]);

  const low = cf.rows.reduce<CfRow | undefined>((m, r) => (!m || r.cumulative < m.cumulative ? r : m), undefined);
  const negatives = cf.rows.filter((r) => r.negative);
  const active = projects.filter((p) => p.status === "building" || p.status === "handover" || termsFor(terms, p.id).billing === "measured");

  return (
    <>
      <Header
        eyebrow="สัญญา & เงินในสัญญา"
        title="กระแสเงินสดโครงการ"
        sub="คาดการณ์เงินเข้า-ออก 12 เดือนข้างหน้า จากงวดเงินและการเบิกตามผลงาน ใบสั่งซื้อที่รอรับของ เจ้าหนี้ค้างจ่าย งานผู้รับเหมาช่วงที่เหลือ และค่าแรงเฉลี่ย"
        actions={
          <div className="flex items-end gap-2">
            <FilterField label="ขอบเขต" className="w-72">
              <Select label="ขอบเขต" value={scope} onChange={setScope}>
                <option value="">ทั้งบริษัท</option>
                {active.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id} {p.name}
                  </option>
                ))}
              </Select>
            </FilterField>
            <CsvButton
              name={`cashflow-${scope || "company"}-${TODAY}`}
              rows={() => [
                ["รายการ", ...cf.months.map((m) => m)],
                ...(Object.keys(INFLOW_CATS) as InCat[]).map((k) => [`เงินเข้า: ${INFLOW_CATS[k]}`, ...cf.inflow[k]]),
                ...(Object.keys(OUTFLOW_CATS) as OutCat[]).map((k) => [`เงินออก: ${OUTFLOW_CATS[k]}`, ...cf.outflow[k]]),
                ["สุทธิ", ...cf.rows.map((r) => r.net)],
                ["สะสม", ...cf.rows.map((r) => r.cumulative)],
              ]}
            />
          </div>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label={scope ? "เงินสดสุทธิสะสมต้นงวด" : "เงินสดและเงินฝาก ณ วันนี้"} value={millions(cf.opening)} unit="ล้านบาท" note={scope ? "เริ่มนับจากวันนี้" : "จากบัญชี 1111–1113"} />
        <StatCard label="เงินเข้า 12 เดือน" value={millions(cf.totalIn)} unit="ล้านบาท" note="รวม VAT หลังหักประกันและ ณ ที่จ่าย" />
        <StatCard label="เงินออก 12 เดือน" value={millions(cf.totalOut)} unit="ล้านบาท" note={`ค่าแรงเฉลี่ย ${millions(cf.payrollMonthly)} ล้าน/เดือน`} />
        <StatCard label="จุดต่ำสุดของเงินสะสม" value={millions(low?.cumulative ?? 0)} unit="ล้านบาท" tone={negatives.length ? "neg" : undefined} note={low ? `${periodLabel(low.period)}${negatives.length ? ` · ติดลบ ${negatives.length} เดือน` : ""}` : "–"} />
      </div>
      <Card className="mb-4">
        <CardHead title="เงินเข้า เงินออก และเงินสะสมรายเดือน" meta="ล้านบาท" />
        <CashChart rows={cf.rows} />
      </Card>
      <Card>
        <CardHead title="รายละเอียดรายเดือน" meta="บาท" />
        <div className="overflow-x-auto">
          <table className={cx(tableCls, "min-w-[1200px]")}>
            <thead>
              <tr>
                <th className={cx(th, "pl-5")}>รายการ</th>
                {cf.rows.map((r) => (
                  <th key={r.period} className={cx(thR, r.negative && "text-neg")}>
                    {periodLabel(r.period)}
                  </th>
                ))}
                <th className={cx(thR, "pr-5")}>รวม</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(INFLOW_CATS) as InCat[]).map((k) => (
                <Row key={k} label={INFLOW_CATS[k]} values={cf.inflow[k]} rows={cf.rows} />
              ))}
              <Row label="รวมเงินเข้า" values={cf.rows.map((r) => r.inflow)} rows={cf.rows} strong />
              {(Object.keys(OUTFLOW_CATS) as OutCat[]).map((k) => (
                <Row key={k} label={OUTFLOW_CATS[k]} values={cf.outflow[k]} rows={cf.rows} />
              ))}
              <Row label="รวมเงินออก" values={cf.rows.map((r) => r.outflow)} rows={cf.rows} strong />
              <Row label="สุทธิ" values={cf.rows.map((r) => r.net)} rows={cf.rows} strong />
              <Row label="เงินสะสม" values={cf.rows.map((r) => r.cumulative)} rows={cf.rows} strong noTotal />
            </tbody>
          </table>
        </div>
        <p className="border-t border-line px-5 py-2 text-[12px] text-ink-3">
          ยอดที่เลยกำหนดแล้วนับรวมในเดือนแรก · โครงการเบิกตามผลงานคาดการณ์งานคงเหลือเฉลี่ยถึงวันแล้วเสร็จ รับเงินหลังรับรองตามเงื่อนไขชำระ · ใบสั่งซื้อจ่ายตามเครดิตผู้ขายหลังวันส่งของ · เดือนที่เงินสะสมติดลบแสดงเป็นสีแดง
        </p>
      </Card>
    </>
  );
}

function Row({ label, values, rows, strong, noTotal }: { label: string; values: number[]; rows: CfRow[]; strong?: boolean; noTotal?: boolean }) {
  return (
    <tr className={strong ? "font-medium" : undefined}>
      <td className={cx(td, "pl-5 whitespace-nowrap")}>{label}</td>
      {values.map((v, k) => (
        <td key={k} className={cx(tdR, rows[k]?.negative && "bg-neg-soft/40")}>
          <Baht v={v} className={v === 0 ? "text-ink-3" : undefined} />
        </td>
      ))}
      <td className={cx(tdR, "pr-5")}>{noTotal ? null : <Baht v={sum(values)} />}</td>
    </tr>
  );
}

/** Bars for monthly inflow (up) and outflow (down) with the cumulative cash line; negative months shaded. */
function CashChart({ rows }: { rows: CfRow[] }) {
  if (!rows.length) return null;
  const W = 760,
    H = 280,
    L = 52,
    R = 16,
    T = 16,
    B = 30;
  const hi = Math.max(1, ...rows.map((r) => Math.max(r.inflow, r.cumulative)));
  const lo = Math.min(0, ...rows.map((r) => Math.min(-r.outflow, r.cumulative)));
  const span = hi - lo || 1;
  const y = (v: number) => T + ((hi - v) / span) * (H - T - B);
  const colW = (W - L - R) / rows.length;
  const x = (i: number) => L + colW * i + colW / 2;
  const bw = Math.min(14, colW / 3);
  const raw = span / 5;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(Math.abs(v) < step / 1e6 ? 0 : v);
  const line = rows.map((r, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(r.cumulative).toFixed(1)}`).join(" ");
  return (
    <div className="px-5 py-4">
      <div className="mb-2 flex flex-wrap gap-4 text-[12px] text-ink-2">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[2px] bg-ink" />
          เงินเข้า
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[2px] bg-accent" />
          เงินออก
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="22" height="8" aria-hidden>
            <line x1="1" x2="21" y1="4" y2="4" className="stroke-ink" strokeWidth={2} />
          </svg>
          เงินสะสม
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[2px] bg-neg-soft" />
          เดือนที่เงินสะสมติดลบ
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="กราฟกระแสเงินสดรายเดือน">
        {rows.map((r, i) => (r.negative ? <rect key={r.period} x={L + colW * i} y={T} width={colW} height={H - T - B} className="fill-neg-soft" /> : null))}
        {ticks.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className={v === 0 ? "stroke-ink-3" : "stroke-line"} strokeWidth={1} />
            <text x={L - 8} y={y(v) + 4} textAnchor="end" className="fill-ink-3 font-mono" fontSize={11}>
              {(v / 1e6).toLocaleString("th-TH", { maximumFractionDigits: 1 })}
            </text>
          </g>
        ))}
        {rows.map((r, i) => (
          <g key={r.period}>
            <rect x={x(i) - bw - 1} y={y(r.inflow)} width={bw} height={Math.max(0, y(0) - y(r.inflow))} rx={2} className="fill-ink" />
            <rect x={x(i) + 1} y={y(0)} width={bw} height={Math.max(0, y(-r.outflow) - y(0))} rx={2} className="fill-accent" />
            <text x={x(i)} y={H - 10} textAnchor="middle" className={r.negative ? "fill-neg" : "fill-ink-3"} fontSize={11}>
              {periodLabel(r.period)}
            </text>
          </g>
        ))}
        <path d={line} fill="none" className="stroke-ink" strokeWidth={2} />
        {rows.map((r, i) => (
          <circle key={r.period} cx={x(i)} cy={y(r.cumulative)} r={3} className={r.negative ? "fill-neg" : "fill-ink"} />
        ))}
      </svg>
    </div>
  );
}
