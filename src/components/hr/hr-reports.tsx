"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Printer } from "lucide-react";
import { Card, CardHead } from "@/components/ui";
import { Btn, Empty, FilterField, I, Select } from "@/components/ops/bits";
import { DocHeader, Signatures } from "@/components/ops/doc";
import { COMPANY_INFO, TODAY } from "@/lib/data";
import { annualCertificate, downloadText, labourByProject, pnd1Report, ssoReport } from "@/lib/hr/reports";
import { prevPeriod } from "@/lib/hr/payroll";
import { employees, useHrSettings, useRuns } from "@/lib/hr/store";
import type { HrRun } from "@/lib/hr/types";
import { bahtText, fmt, HrPrintStyle, periodLabel, siteName } from "./bits";

const periodsOf = (runs: HrRun[]) => [...new Set(runs.filter((r) => r.status !== "draft").map((r) => r.period))].sort().reverse();

function Toolbar({ children, onPrint, onCsv }: { children: React.ReactNode; onPrint: () => void; onCsv?: () => void }) {
  return (
    <div className="hr-noprint mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-wrap items-end gap-3">{children}</div>
      <div className="flex gap-2">
        {onCsv && (
          <Btn small onClick={onCsv}>
            <Download {...I} />
            CSV
          </Btn>
        )}
        <Btn small primary onClick={onPrint}>
          <Printer {...I} />
          พิมพ์
        </Btn>
      </div>
    </div>
  );
}

const Sheet = ({ children }: { children: React.ReactNode }) => (
  <article className="hr-page mx-auto w-full max-w-[980px] rounded-[4px] border border-line bg-white px-10 py-8 text-ink shadow-[0_2px_12px_rgba(31,27,22,0.08)]">{children}</article>
);

const th = "border border-line-strong px-2 py-1.5 text-left font-normal text-ink-2";
const td = "border border-line-strong px-2 py-1";
const tdn = "num border border-line-strong px-2 py-1 text-right font-mono";

// ---------------- สปส.1-10 ----------------

export function SsoReportView() {
  const runs = useRuns();
  const emps = employees.use();
  const { sso } = useHrSettings();
  const periods = periodsOf(runs);
  const [picked, setPeriod] = useState("");
  const period = picked || periods[0] || TODAY.slice(0, 7);
  const rep = ssoReport(runs, period, emps, sso);
  const csv = () =>
    downloadText(
      `sso-${period}.csv`,
      "﻿" + [["ลำดับ", "เลขประจำตัวประชาชน", "ชื่อ-สกุล", "ค่าจ้าง", "ฐานค่าจ้าง", "เงินสมทบลูกจ้าง", "เงินสมทบนายจ้าง"], ...rep.rows.map((r, i) => [i + 1, r.idNo, r.name, r.wage.toFixed(2), r.base.toFixed(2), r.employee, r.employer])].map((r) => r.join(",")).join("\r\n"),
    );
  return (
    <>
      <HrPrintStyle size="A4" />
      <Toolbar onPrint={() => window.print()} onCsv={csv}>
        <FilterField label="งวดค่าจ้าง" className="w-[200px]">
          <Select label="งวดค่าจ้าง" value={period} onChange={setPeriod}>
            {periods.map((p) => (
              <option key={p} value={p}>
                {periodLabel(p)}
              </option>
            ))}
          </Select>
        </FilterField>
        <p className="pb-2 text-[13px] text-ink-3">นำส่งภายในวันที่ 15 ของเดือนถัดไป · รวมคนงานรายวันที่ขึ้นทะเบียน (รวมยอดจากทุกรอบรายสัปดาห์ในเดือน)</p>
      </Toolbar>
      <div className="hr-print">
        <Sheet>
          <DocHeader title="แบบรายการแสดงการส่งเงินสมทบ" titleEn="SSO contribution list (สปส.1-10 ส่วนที่ 2)" code={`SSO-${period}`} meta={<p>งวดค่าจ้าง {periodLabel(period)}</p>} />
          <div className="mt-4 grid grid-cols-4 gap-3 text-[13px]">
            <Box k="จำนวนผู้ประกันตน" v={`${rep.rows.length} คน`} />
            <Box k="ค่าจ้างที่ใช้คำนวณ" v={fmt(rep.base)} />
            <Box k={`เงินสมทบลูกจ้าง ${sso.rate * 100}%`} v={fmt(rep.employee)} />
            <Box k={`เงินสมทบนายจ้าง ${sso.employerRate * 100}%`} v={fmt(rep.employer)} />
          </div>
          <p className="mt-2 text-[12px] text-ink-3">
            รวมเงินสมทบนำส่ง {fmt(rep.employee + rep.employer)} บาท ({bahtText(rep.employee + rep.employer)}) · ฐานค่าจ้างต่ำสุด {fmt(sso.floor, 0)} สูงสุด {fmt(sso.ceiling, 0)} บาท
          </p>
          {rep.rows.length ? (
            <table className="mt-4 w-full border-collapse text-[12px]">
              <thead>
                <tr>
                  <th className={th}>ลำดับ</th>
                  <th className={th}>เลขประจำตัวประชาชน/หนังสือเดินทาง</th>
                  <th className={th}>ชื่อ-สกุล</th>
                  <th className={th}>ประเภท</th>
                  <th className={`${th} text-right`}>ค่าจ้างจ่ายจริง</th>
                  <th className={`${th} text-right`}>ฐานค่าจ้าง</th>
                  <th className={`${th} text-right`}>ลูกจ้าง</th>
                  <th className={`${th} text-right`}>นายจ้าง</th>
                </tr>
              </thead>
              <tbody>
                {rep.rows.map((r, i) => (
                  <tr key={r.employeeId}>
                    <td className={tdn}>{i + 1}</td>
                    <td className={`${td} font-mono`}>{r.idNo}</td>
                    <td className={td}>{r.name}</td>
                    <td className={td}>{r.kind === "monthly" ? "รายเดือน" : "รายวัน"}</td>
                    <td className={tdn}>{fmt(r.wage)}</td>
                    <td className={tdn}>{fmt(r.base)}</td>
                    <td className={tdn}>{fmt(r.employee, 0)}</td>
                    <td className={tdn}>{fmt(r.employer, 0)}</td>
                  </tr>
                ))}
                <tr className="font-medium">
                  <td className={td} colSpan={4}>
                    รวม
                  </td>
                  <td className={tdn}>{fmt(rep.wage)}</td>
                  <td className={tdn}>{fmt(rep.base)}</td>
                  <td className={tdn}>{fmt(rep.employee, 0)}</td>
                  <td className={tdn}>{fmt(rep.employer, 0)}</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <Empty>ไม่มีรอบจ่ายที่อนุมัติในงวดนี้</Empty>
          )}
          <Signatures roles={[{ role: "ผู้จัดทำ" }, { role: "นายจ้าง/ผู้รับมอบอำนาจ" }]} />
        </Sheet>
      </div>
    </>
  );
}

const Box = ({ k, v }: { k: string; v: string }) => (
  <div className="rounded-[6px] border border-line-strong px-3 py-2">
    <p className="text-[12px] text-ink-3">{k}</p>
    <p className="num font-mono text-[15px]">{v}</p>
  </div>
);

// ---------------- ภ.ง.ด.1 ----------------

export function Pnd1View() {
  const runs = useRuns();
  const emps = employees.use();
  const periods = periodsOf(runs);
  const [picked, setPeriod] = useState("");
  const period = picked || periods[0] || TODAY.slice(0, 7);
  const [taxOnly, setTaxOnly] = useState(false);
  const rep = pnd1Report(runs, period, emps, taxOnly);
  const due = `7 ${periodLabel(prevPeriod(period, -1))}`;
  return (
    <>
      <HrPrintStyle size="A4" />
      <Toolbar onPrint={() => window.print()}>
        <FilterField label="เดือนที่จ่ายเงินได้" className="w-[200px]">
          <Select label="เดือนที่จ่ายเงินได้" value={period} onChange={setPeriod}>
            {periods.map((p) => (
              <option key={p} value={p}>
                {periodLabel(p)}
              </option>
            ))}
          </Select>
        </FilterField>
        <label className="flex items-center gap-2 pb-2 text-[13px] text-ink-2">
          <input type="checkbox" checked={taxOnly} onChange={(e) => setTaxOnly(e.target.checked)} />
          เฉพาะผู้ที่ถูกหักภาษี
        </label>
        <p className="pb-2 text-[13px] text-ink-3">ยื่นภายใน {due} (ยื่นออนไลน์ได้อีก 8 วัน)</p>
      </Toolbar>
      <div className="hr-print">
        <Sheet>
          <DocHeader title="ใบแนบ ภ.ง.ด.1" titleEn="Withholding tax on salaries (PND1)" code={`PND1-${period}`} meta={<p>เดือนภาษี {periodLabel(period)}</p>} />
          <div className="mt-4 grid grid-cols-3 gap-3 text-[13px]">
            <Box k="จำนวนราย" v={`${rep.rows.length} ราย`} />
            <Box k="เงินได้ 40(1) รวม" v={fmt(rep.income)} />
            <Box k="ภาษีที่หักนำส่ง" v={fmt(rep.tax)} />
          </div>
          {rep.rows.length ? (
            <table className="mt-4 w-full border-collapse text-[12px]">
              <thead>
                <tr>
                  <th className={th}>ลำดับ</th>
                  <th className={th}>เลขประจำตัวผู้เสียภาษี</th>
                  <th className={th}>ชื่อผู้มีเงินได้</th>
                  <th className={th}>วันที่จ่าย</th>
                  <th className={`${th} text-right`}>จำนวนเงินได้</th>
                  <th className={`${th} text-right`}>ภาษีที่หัก</th>
                  <th className={th}>เงื่อนไข</th>
                </tr>
              </thead>
              <tbody>
                {rep.rows.map((r, i) => (
                  <tr key={r.employeeId}>
                    <td className={tdn}>{i + 1}</td>
                    <td className={`${td} font-mono`}>{r.idNo}</td>
                    <td className={td}>{r.name}</td>
                    <td className={`${td} font-mono`}>{r.payDate.split("-").reverse().join("/")}</td>
                    <td className={tdn}>{fmt(r.income)}</td>
                    <td className={tdn}>{fmt(r.tax)}</td>
                    <td className={td}>1 หัก ณ ที่จ่าย</td>
                  </tr>
                ))}
                <tr className="font-medium">
                  <td className={td} colSpan={4}>
                    รวม
                  </td>
                  <td className={tdn}>{fmt(rep.income)}</td>
                  <td className={tdn}>{fmt(rep.tax)}</td>
                  <td className={td} />
                </tr>
              </tbody>
            </table>
          ) : (
            <Empty>ไม่มีข้อมูลในเดือนนี้</Empty>
          )}
          <p className="mt-3 text-[12px] text-ink-3">ภาษีคำนวณแบบประมาณเงินได้ทั้งปี (เงินได้เดือนนี้ × 12) หักค่าใช้จ่าย 50% ไม่เกิน 100,000 บาท และค่าลดหย่อนที่พนักงานแจ้ง แล้วหารด้วย 12 · คนงานรายวันที่ไม่ถึงเกณฑ์เสียภาษีไม่แสดงในรายการ</p>
          <Signatures roles={[{ role: "ผู้จ่ายเงิน" }]} />
        </Sheet>
      </div>
    </>
  );
}

// ---------------- 50 ทวิ ----------------

export function Tawi50View() {
  const runs = useRuns();
  const emps = employees.use();
  const years = [...new Set(runs.filter((r) => r.status === "paid").map((r) => r.period.slice(0, 4)))].sort().reverse();
  const [pickedYear, setYear] = useState("");
  const year = pickedYear || years[0] || TODAY.slice(0, 4);
  const staff = emps.filter((e) => e.type === "monthly" && runs.some((r) => r.period.startsWith(year) && r.status === "paid" && r.lines.some((l) => l.employeeId === e.id)));
  const [who, setWho] = useState("");
  const shown = who ? staff.filter((e) => e.id === who) : staff;
  return (
    <>
      <HrPrintStyle size="A4" />
      <Toolbar onPrint={() => window.print()}>
        <FilterField label="ปีภาษี" className="w-[140px]">
          <Select label="ปีภาษี" value={year} onChange={setYear}>
            {years.map((y) => (
              <option key={y} value={y}>
                {Number(y) + 543}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="พนักงาน" className="w-[260px]">
          <Select label="พนักงาน" value={who} onChange={setWho}>
            <option value="">ทุกคน ({staff.length})</option>
            {staff.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </Select>
        </FilterField>
        <p className="pb-2 text-[13px] text-ink-3">รวมเฉพาะรอบที่จ่ายแล้วในปี · ออกให้พนักงานภายในเดือนกุมภาพันธ์ของปีถัดไป</p>
      </Toolbar>
      <div className="hr-print flex flex-col gap-6">
        {shown.map((e) => {
          const c = annualCertificate(runs, year, e.id);
          return (
            <article key={e.id} className="hr-page avoid-break mx-auto w-full max-w-[860px] rounded-[4px] border border-line bg-white px-10 py-8 text-[13px] text-ink shadow-[0_2px_12px_rgba(31,27,22,0.08)]">
              <div className="flex items-start justify-between border-b-2 border-ink pb-3">
                <div>
                  <p className="text-[17px] font-medium">หนังสือรับรองการหักภาษี ณ ที่จ่าย</p>
                  <p className="text-ink-3">ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร</p>
                </div>
                <p className="font-mono">
                  เล่มที่ {year} · เลขที่ {e.id.slice(-4)}
                </p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-4">
                <div className="rounded-[6px] border border-line-strong p-3">
                  <p className="text-ink-3">ผู้มีหน้าที่หักภาษี ณ ที่จ่าย</p>
                  <p className="font-medium">{COMPANY_INFO.name}</p>
                  <p className="text-ink-2">{COMPANY_INFO.address}</p>
                  <p>
                    เลขประจำตัวผู้เสียภาษี <span className="font-mono">{COMPANY_INFO.taxId}</span>
                  </p>
                </div>
                <div className="rounded-[6px] border border-line-strong p-3">
                  <p className="text-ink-3">ผู้ถูกหักภาษี ณ ที่จ่าย</p>
                  <p className="font-medium">{e.name}</p>
                  <p className="text-ink-2">{e.position}</p>
                  <p>
                    เลขประจำตัวผู้เสียภาษี <span className="font-mono">{e.idNo}</span>
                  </p>
                </div>
              </div>
              <p className="mt-3">ลำดับที่ในแบบ ☑ ภ.ง.ด.1ก</p>
              <table className="mt-2 w-full border-collapse text-[12px]">
                <thead>
                  <tr>
                    <th className={th}>ประเภทเงินได้พึงประเมินที่จ่าย</th>
                    <th className={th}>ปีภาษีที่จ่าย</th>
                    <th className={`${th} text-right`}>จำนวนเงินที่จ่าย</th>
                    <th className={`${th} text-right`}>ภาษีที่หักและนำส่งไว้</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className={td}>1. เงินเดือน ค่าจ้าง เบี้ยเลี้ยง โบนัส ฯลฯ ตามมาตรา 40 (1)</td>
                    <td className={`${td} font-mono`}>{Number(year) + 543}</td>
                    <td className={tdn}>{fmt(c.income)}</td>
                    <td className={tdn}>{fmt(c.tax)}</td>
                  </tr>
                  <tr className="font-medium">
                    <td className={td} colSpan={2}>
                      รวมเงินที่จ่ายและภาษีที่หักนำส่ง
                    </td>
                    <td className={tdn}>{fmt(c.income)}</td>
                    <td className={tdn}>{fmt(c.tax)}</td>
                  </tr>
                </tbody>
              </table>
              <p className="mt-2">รวมเงินภาษีที่หักนำส่ง (ตัวอักษร) {bahtText(c.tax)}</p>
              <p className="mt-1">เงินที่จ่ายเข้ากองทุนประกันสังคม {fmt(c.sso)} บาท · จำนวน {c.months} เดือน</p>
              <p className="mt-1">ผู้จ่ายเงิน ☑ (1) หัก ณ ที่จ่าย</p>
              <div className="mt-8 grid grid-cols-2 gap-6">
                <p className="text-[12px] text-ink-3">ขอรับรองว่าข้อความและตัวเลขดังกล่าวข้างต้นถูกต้องตรงกับความจริงทุกประการ</p>
                <div className="text-center text-[12px] text-ink-2">
                  <div className="h-10 border-b border-ink-3" />
                  <p className="mt-1">ผู้จ่ายเงิน · ประทับตรานิติบุคคล</p>
                  <p>วันที่ออกหนังสือ ........../........../..........</p>
                </div>
              </div>
            </article>
          );
        })}
        {!shown.length && <Empty>ไม่มีพนักงานรายเดือนที่ได้รับเงินในปีนี้</Empty>}
      </div>
    </>
  );
}

// ---------------- labour cost per project ----------------

export function LabourView() {
  const runs = useRuns();
  const periods = periodsOf(runs.filter((r) => r.kind === "daily"));
  const [range, setRange] = useState<"all" | string>("all");
  const rows = useMemo(() => labourByProject(runs, (r) => range === "all" || r.period === range), [runs, range]);
  const monthly = useMemo(() => {
    const ps = [...periods].reverse();
    return ps.map((p) => ({ p, rows: labourByProject(runs, (r) => r.period === p) }));
  }, [runs, periods]);
  const total = rows.reduce((s, r) => s + r.cost, 0);
  const max = Math.max(1, ...rows.map((r) => r.cost));
  const csv = () =>
    downloadText(
      `labour-by-project-${range}.csv`,
      "﻿" + [["โครงการ", "ชื่อ", "จำนวนคน", "แรง (วัน)", "ค่าแรง", "OT", "สมทบนายจ้าง", "ต้นทุนรวม"], ...rows.map((r) => [r.projectId, siteName(r.projectId), r.heads, r.days, r.gross.toFixed(2), r.ot.toFixed(2), r.employerSso, r.cost.toFixed(2)])].map((r) => r.join(",")).join("\r\n"),
    );
  return (
    <>
      <HrPrintStyle size="A4" />
      <Toolbar onPrint={() => window.print()} onCsv={csv}>
        <FilterField label="ช่วงเวลา" className="w-[220px]">
          <Select label="ช่วงเวลา" value={range} onChange={setRange}>
            <option value="all">ทั้งหมด ({periods.length} เดือน)</option>
            {periods.map((p) => (
              <option key={p} value={p}>
                {periodLabel(p)}
              </option>
            ))}
          </Select>
        </FilterField>
        <p className="pb-2 text-[13px] text-ink-3">ค่าแรงรายวันที่อนุมัติแล้ว + เงินสมทบนายจ้าง · ไม่รวมทีมผู้รับเหมาค่าแรง (บันทึกผ่านใบแจ้งหนี้)</p>
      </Toolbar>
      <div className="hr-print">
        <Card className="hr-page">
          <CardHead title="ต้นทุนแรงงานหน้างานตามโครงการ" meta={`รวม ${fmt(total, 0)} บาท`} />
          {rows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-[13px]">
                <thead>
                  <tr className="border-b border-line text-left text-ink-3">
                    <th className="px-5 py-2 font-normal">โครงการ</th>
                    <th className="px-2 py-2 text-right font-normal">คน</th>
                    <th className="px-2 py-2 text-right font-normal">แรง (วัน)</th>
                    <th className="px-2 py-2 text-right font-normal">ค่าแรง+OT</th>
                    <th className="px-2 py-2 text-right font-normal">OT</th>
                    <th className="px-2 py-2 text-right font-normal">สมทบนายจ้าง</th>
                    <th className="px-2 py-2 text-right font-normal">ต้นทุนรวม</th>
                    <th className="w-[180px] px-5 py-2 font-normal" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.projectId} className="border-b border-line last:border-0">
                      <td className="px-5 py-2">
                        <Link href={`/projects/${r.projectId}`} className="hover:underline">
                          {siteName(r.projectId)}
                        </Link>
                        <span className="block font-mono text-[12px] text-ink-3">{r.projectId}</span>
                      </td>
                      <td className="num px-2 py-2 text-right font-mono">{r.heads}</td>
                      <td className="num px-2 py-2 text-right font-mono">{fmt(r.days, 1)}</td>
                      <td className="num px-2 py-2 text-right font-mono">{fmt(r.gross)}</td>
                      <td className="num px-2 py-2 text-right font-mono">{fmt(r.ot)}</td>
                      <td className="num px-2 py-2 text-right font-mono">{fmt(r.employerSso, 0)}</td>
                      <td className="num px-2 py-2 text-right font-mono font-medium">{fmt(r.cost)}</td>
                      <td className="px-5 py-2">
                        <div className="h-1.5 rounded-full bg-raised">
                          <div className="h-full rounded-full bg-ink" style={{ width: `${(r.cost / max) * 100}%` }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>ไม่มีค่าแรงรายวันในช่วงนี้</Empty>
          )}
        </Card>
        {range === "all" && monthly.length > 0 && (
          <Card className="hr-noprint mt-6">
            <CardHead title="ต้นทุนแรงงานรายเดือน" meta="บาท" />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-[12px]">
                <thead>
                  <tr className="border-b border-line text-left text-ink-3">
                    <th className="px-5 py-2 font-normal">โครงการ</th>
                    {monthly.map((m) => (
                      <th key={m.p} className="px-2 py-2 text-right font-normal">
                        {periodLabel(m.p).split(" ")[0].slice(0, 3)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.projectId} className="border-b border-line last:border-0">
                      <td className="px-5 py-1.5 font-mono">{r.projectId}</td>
                      {monthly.map((m) => {
                        const v = m.rows.find((x) => x.projectId === r.projectId)?.cost ?? 0;
                        return (
                          <td key={m.p} className="num px-2 py-1.5 text-right font-mono text-ink-2">
                            {v ? fmt(v, 0) : "-"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
