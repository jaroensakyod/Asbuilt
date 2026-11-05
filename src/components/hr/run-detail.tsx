"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Banknote, Check, Coins, Download, FileText, Printer, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { Card, CardHead, cx, inputCls } from "@/components/ui";
import { Btn, Empty, I, Pill, Segmented, Select, StatCard } from "@/components/ops/bits";
import { thDate, TODAY } from "@/lib/data";
import { buildDailyRun, buildMonthlyRun, recalcLine, runTotals, ssoAlreadyThisMonth } from "@/lib/hr/payroll";
import { bankCsv, cashLines, downloadText } from "@/lib/hr/reports";
import { allRuns, attendance, employees, removeRun, saveRun, useHrSettings, useRuns } from "@/lib/hr/store";
import type { HrLine, HrRun } from "@/lib/hr/types";
import { fmt, HrPrintStyle, periodLabel, siteName, useHrAccess } from "./bits";
import { Payslip, type Ytd } from "./payslip";
import { advances, pieceClaims, useLabourSettings } from "@/lib/hr/labour-store";
import { applyAdvances, deductIssues } from "@/lib/hr/labour";
import { daysInMonth } from "@/lib/hr/payroll";
import { complianceIssues, IssueList } from "./crew-view";

export const RUN_STATUS: Record<HrRun["status"], { label: string; tone: "neutral" | "warn" | "pos" | "accent" }> = {
  draft: { label: "ร่าง", tone: "warn" },
  approved: { label: "อนุมัติแล้ว", tone: "accent" },
  paid: { label: "จ่ายแล้ว", tone: "pos" },
};

export const runTitle = (r: HrRun) => (r.kind === "monthly" ? `เงินเดือน ${periodLabel(r.period)}` : `ค่าแรงรายวัน ${r.from ? `${thDate(r.from)} – ${thDate(r.to ?? r.payDate)}` : periodLabel(r.period)}${r.projectId ? ` · ${r.projectId}` : ""}`);

export function RunDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const runs = useRuns();
  const run = runs.find((r) => r.id === id);
  if (!run)
    return (
      <Card>
        <Empty>{runs.length ? `ไม่พบรอบจ่าย ${id}` : "กำลังโหลด"}</Empty>
        <div className="flex justify-center pb-8">
          <Btn onClick={onBack}>กลับไปรายการ</Btn>
        </div>
      </Card>
    );
  return <Detail key={run.id} run={run} runs={runs} onBack={onBack} />;
}

function Detail({ run, runs, onBack }: { run: HrRun; runs: HrRun[]; onBack: () => void }) {
  const { approve, edit, me } = useHrAccess();
  const emps = employees.use();
  const settings = useHrSettings();
  const labour = useLabourSettings();
  const sheets = attendance.use();
  const [mode, setMode] = useState<"lines" | "slips">("lines");
  const [size, setSize] = useState<"A4" | "A5">("A5");
  const [site, setSite] = useState("");
  const [only, setOnly] = useState("");
  const t = runTotals(run);
  const draft = run.status === "draft";
  const canChange = draft && edit;

  const sites = useMemo(() => [...new Set(run.lines.map((l) => l.projectId).filter((x): x is string => !!x))], [run]);
  const lines = run.lines.filter((l) => !site || l.projectId === site);

  const ytd = useMemo(() => {
    const year = run.period.slice(0, 4);
    const m = new Map<string, Ytd>();
    for (const r of runs) {
      if (!r.period.startsWith(year) || r.payDate > run.payDate || (r.status === "draft" && r.id !== run.id)) continue;
      for (const l of r.lines) {
        const cur = m.get(l.employeeId) ?? { income: 0, tax: 0, sso: 0 };
        cur.income += l.gross;
        cur.tax += l.wht;
        cur.sso += l.sso;
        m.set(l.employeeId, cur);
      }
    }
    return m;
  }, [runs, run]);

  const set = (patch: Partial<HrRun>) => saveRun({ ...run, ...patch });
  const editLine = (idx: number, patch: Partial<HrLine>) => {
    const already = run.kind === "daily" ? ssoAlreadyThisMonth(allRuns(), run.period, run.id) : new Map<string, number>();
    const next = run.lines.map((l, i) => (i === idx ? recalcLine({ ...l, ...patch }, emps.find((e) => e.id === l.employeeId), settings.sso, already.get(l.employeeId) ?? 0) : l));
    saveRun({ ...run, lines: next, employerSso: next.reduce((s, l) => s + (l.employerSso ?? 0), 0) });
  };
  const rebuild = () => {
    const fresh =
      run.kind === "monthly"
        ? buildMonthlyRun(emps, run.period, run.payDate, settings.sso, {
            otHours: (e) => run.lines.find((l) => l.employeeId === e.id)?.otHours ?? 0,
            deduction: (e) => {
              // keep manual deductions; scheduled advances are re-applied below
              const l = run.lines.find((x) => x.employeeId === e.id);
              const other = (l?.deduction ?? 0) - (l?.advances ?? []).reduce((t, x) => t + x.amount, 0);
              return l && other > 0 ? { amount: other, note: l.deductionNote ?? "" } : undefined;
            },
          })
        : buildDailyRun(emps, attendance.all(), {
            from: run.from ?? run.payDate,
            to: run.to ?? run.payDate,
            payDate: run.payDate,
            cycle: run.id.includes("-H") ? "semimonthly" : "weekly",
            projectId: run.projectId,
            sso: settings.sso,
            already: ssoAlreadyThisMonth(allRuns(), run.period, run.id),
          });
    saveRun({ ...run, lines: withAdvances(fresh.lines), employerSso: fresh.employerSso });
  };
  const withAdvances = (lines: HrLine[]) => applyAdvances(lines, run.id, advances.all(), allRuns(), pieceClaims.all(), labour.maxDeductShare);
  const deductAdvances = () => saveRun({ ...run, lines: withAdvances(run.lines) });
  const winFrom = run.kind === "daily" ? (run.from ?? run.payDate) : `${run.period}-01`;
  const winTo = run.kind === "daily" ? (run.to ?? run.payDate) : `${run.period}-${String(daysInMonth(run.period)).padStart(2, "0")}`;
  const runIds = new Set(run.lines.map((l) => l.employeeId));
  const issues = [
    ...complianceIssues(emps, sheets.filter((sh) => !run.projectId || sh.projectId === run.projectId), winFrom, winTo, labour, runIds).filter((i) => run.kind === "daily" || i.kind !== "min_wage"),
    ...deductIssues(run.lines, labour),
  ];
  const csv = () => downloadText(`${run.id}-bank-transfer.csv`, bankCsv(run));
  const cash = cashLines(run);
  const slipLines = (site ? lines : run.lines).filter((l) => !only || l.employeeId === only);

  return (
    <>
      <HrPrintStyle size={size} />
      <div className="hr-noprint flex flex-wrap items-center justify-between gap-3 pb-5">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={onBack} className="inline-flex h-8 items-center gap-1.5 rounded-[8px] px-2 text-[13px] text-ink-2 transition-colors duration-150 hover:bg-raised hover:text-ink">
            <ArrowLeft {...I} />
            รอบจ่ายทั้งหมด
          </button>
          <div>
            <p className="font-mono text-[12px] text-ink-3">{run.id}</p>
            <h2 className="text-[20px] font-normal leading-tight">{runTitle(run)}</h2>
          </div>
          <Pill tone={RUN_STATUS[run.status].tone}>{RUN_STATUS[run.status].label}</Pill>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canChange && (
            <>
              <Btn small danger onClick={() => (removeRun(run.id), onBack())}>
                <Trash2 {...I} />
                ลบร่าง
              </Btn>
              <Btn small onClick={deductAdvances} title="หักเงินเบิกล่วงหน้าที่อนุมัติแล้วตามจำนวนงวด">
                <Coins {...I} />
                หักเงินเบิกตามตาราง
              </Btn>
              <Btn small onClick={rebuild} title="คำนวณใหม่จากข้อมูลพนักงานและลงเวลาล่าสุด">
                <RefreshCw {...I} />
                คำนวณใหม่
              </Btn>
            </>
          )}
          {draft && approve && (
            <Btn small primary onClick={() => set({ status: "approved", approvedBy: me.name, approvedAt: TODAY })}>
              <Check {...I} />
              อนุมัติจ่าย
            </Btn>
          )}
          {run.status === "approved" && approve && (
            <Btn small onClick={() => set({ status: "draft", approvedBy: undefined, approvedAt: undefined })}>
              <RotateCcw {...I} />
              ยกเลิกอนุมัติ
            </Btn>
          )}
          {run.status === "approved" && (approve || edit) && (
            <Btn small primary onClick={() => set({ status: "paid", paidAt: TODAY })}>
              <Banknote {...I} />
              บันทึกว่าจ่ายแล้ว
            </Btn>
          )}
          <Btn small onClick={csv} disabled={draft}>
            <Download {...I} />
            ไฟล์โอนธนาคาร
          </Btn>
        </div>
      </div>
      {draft && !approve && <p className="hr-noprint -mt-2 mb-4 text-[13px] text-ink-3">รอผู้มีสิทธิ์อนุมัติ (ผู้ดูแลระบบหรือผู้บริหาร) อนุมัติก่อนส่งไฟล์โอน</p>}

      <div className="hr-noprint grid grid-cols-2 gap-3 lg:grid-cols-6">
        <StatCard label="จำนวนคน" value={t.heads} unit="คน" note={run.kind === "daily" ? `${sites.length} หน้างาน` : undefined} />
        <StatCard label="รายได้รวม" value={fmt(t.gross, 0)} unit="บาท" note={`OT ${fmt(t.ot, 0)}`} />
        <StatCard label="ประกันสังคม ลูกจ้าง" value={fmt(t.sso, 0)} unit="บาท" note={`นายจ้างสมทบ ${fmt(run.employerSso, 0)}`} />
        <StatCard label="ภาษีหัก ณ ที่จ่าย" value={fmt(t.wht, 0)} unit="บาท" note="ภ.ง.ด.1" />
        <StatCard label="จ่ายสุทธิ" value={fmt(t.net, 0)} unit="บาท" note={cash.length ? `เงินสด ${cash.length} คน` : "โอนทั้งหมด"} />
        <StatCard label="ต้นทุนนายจ้าง" value={fmt(t.gross + run.employerSso, 0)} unit="บาท" note="รายได้ + สมทบ" />
      </div>

      <Card className="hr-noprint mt-4">
        <CardHead
          title="ตรวจสอบตามกฎหมายแรงงาน"
          meta={issues.length ? `${issues.length} ประเด็น` : "ผ่าน"}
          action={
            <Link href="/hr/crew?tab=compliance" className="text-[13px] text-ink-2 underline decoration-line-strong underline-offset-2 hover:text-ink">
              ตั้งค่าขั้นต่ำ/OT
            </Link>
          }
        />
        <IssueList issues={issues} empty={run.kind === "daily" ? "ค่าแรงไม่ต่ำกว่าขั้นต่ำ OT ไม่เกินเพดาน รายการหักไม่เกินสัดส่วน" : "OT ไม่เกินเพดาน รายการหักไม่เกินสัดส่วน"} />
      </Card>

      <div className="hr-noprint mt-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { key: "lines", label: "รายการ", icon: <FileText {...I} /> },
            { key: "slips", label: "สลิป", icon: <Printer {...I} /> },
          ]}
        />
        <div className="flex flex-wrap items-center gap-2">
          {sites.length > 1 && (
            <Select label="หน้างาน" value={site} onChange={setSite} className="w-[240px]">
              <option value="">ทุกหน้างาน</option>
              {sites.map((p) => (
                <option key={p} value={p}>
                  {p} · {siteName(p)}
                </option>
              ))}
            </Select>
          )}
          {mode === "slips" && (
            <>
              <Select label="พนักงาน" value={only} onChange={setOnly} className="w-[220px]">
                <option value="">ทุกคน ({(site ? lines : run.lines).length})</option>
                {(site ? lines : run.lines).map((l) => (
                  <option key={l.employeeId + (l.projectId ?? "")} value={l.employeeId}>
                    {l.name}
                  </option>
                ))}
              </Select>
              <Segmented
                value={size}
                onChange={setSize}
                options={[
                  { key: "A5", label: "A5" },
                  { key: "A4", label: "A4" },
                ]}
              />
              <Btn small primary onClick={() => window.print()}>
                <Printer {...I} />
                พิมพ์สลิป
              </Btn>
            </>
          )}
        </div>
      </div>

      {mode === "lines" ? (
        <Card className="hr-noprint mt-4">
          <CardHead title="รายละเอียดการจ่าย" meta={`${lines.length} รายการ · จ่าย ${thDate(run.payDate)}${run.approvedBy ? ` · อนุมัติโดย ${run.approvedBy}` : ""}`} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-ink-3">
                  <th className="px-5 py-2 font-normal">พนักงาน</th>
                  {run.kind === "daily" ? (
                    <>
                      <th className="px-2 py-2 font-normal">หน้างาน</th>
                      <th className="px-2 py-2 text-right font-normal">วัน</th>
                      <th className="px-2 py-2 text-right font-normal">ค่าแรง</th>
                    </>
                  ) : (
                    <>
                      <th className="px-2 py-2 text-right font-normal">เงินเดือน</th>
                      <th className="px-2 py-2 text-right font-normal">ค่าตำแหน่ง</th>
                    </>
                  )}
                  <th className="px-2 py-2 text-right font-normal">OT ชม.</th>
                  <th className="px-2 py-2 text-right font-normal">OT</th>
                  <th className="px-2 py-2 text-right font-normal">รวมรายได้</th>
                  <th className="px-2 py-2 text-right font-normal">ประกันสังคม</th>
                  <th className="px-2 py-2 text-right font-normal">ภาษี</th>
                  <th className="px-2 py-2 text-right font-normal">หักอื่น</th>
                  <th className="px-5 py-2 text-right font-normal">สุทธิ</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const idx = run.lines.indexOf(l);
                  return (
                    <tr key={`${l.employeeId}-${l.projectId ?? ""}`} className="border-b border-line last:border-0">
                      <td className="px-5 py-1.5">
                        <span className="block">{l.name}</span>
                        <span className="font-mono text-[12px] text-ink-3">
                          {l.employeeId} · {l.position}
                        </span>
                      </td>
                      {run.kind === "daily" ? (
                        <>
                          <td className="px-2 py-1.5 font-mono text-[12px] text-ink-2">{l.projectId}</td>
                          <td className="num px-2 py-1.5 text-right font-mono">{l.days}</td>
                          <td className="num px-2 py-1.5 text-right font-mono">{fmt(l.base ?? 0)}</td>
                        </>
                      ) : (
                        <>
                          <td className="num px-2 py-1.5 text-right font-mono">{fmt(l.base ?? 0)}</td>
                          <td className="num px-2 py-1.5 text-right font-mono">{fmt(l.allowance ?? 0)}</td>
                        </>
                      )}
                      <td className="px-2 py-1.5 text-right">
                        {canChange ? (
                          <input type="number" min={0} step={0.5} aria-label={`OT ${l.name}`} className={cx(inputCls, "h-7 w-16 px-2 text-right font-mono text-[12px]")} value={l.otHours || ""} onChange={(e) => editLine(idx, { otHours: Math.max(0, Number(e.target.value) || 0) })} />
                        ) : (
                          <span className="num font-mono">{l.otHours || ""}</span>
                        )}
                      </td>
                      <td className="num px-2 py-1.5 text-right font-mono">{fmt(l.ot)}</td>
                      <td className="num px-2 py-1.5 text-right font-mono">{fmt(l.gross)}</td>
                      <td className="num px-2 py-1.5 text-right font-mono">{fmt(l.sso, 0)}</td>
                      <td className="num px-2 py-1.5 text-right font-mono">{fmt(l.wht)}</td>
                      <td className="px-2 py-1.5 text-right">
                        {canChange ? (
                          <input type="number" min={0} aria-label={`หักอื่น ${l.name}`} className={cx(inputCls, "h-7 w-20 px-2 text-right font-mono text-[12px]")} value={l.deduction || ""} onChange={(e) => editLine(idx, { deduction: Math.max(0, Number(e.target.value) || 0), deductionNote: l.deductionNote ?? "หักเงินเบิกล่วงหน้า" })} />
                        ) : (
                          <span className="num font-mono" title={l.deductionNote}>
                            {l.deduction ? fmt(l.deduction) : ""}
                          </span>
                        )}
                      </td>
                      <td className="num px-5 py-1.5 text-right font-mono font-medium">{fmt(l.net)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-line-strong text-[13px]">
                  <td className="px-5 py-2 font-medium" colSpan={run.kind === "daily" ? 5 : 4}>
                    รวม {lines.length} รายการ
                  </td>
                  <td className="num px-2 py-2 text-right font-mono">{fmt(lines.reduce((s, l) => s + l.ot, 0))}</td>
                  <td className="num px-2 py-2 text-right font-mono">{fmt(lines.reduce((s, l) => s + l.gross, 0))}</td>
                  <td className="num px-2 py-2 text-right font-mono">{fmt(lines.reduce((s, l) => s + l.sso, 0), 0)}</td>
                  <td className="num px-2 py-2 text-right font-mono">{fmt(lines.reduce((s, l) => s + l.wht, 0))}</td>
                  <td className="num px-2 py-2 text-right font-mono">{fmt(lines.reduce((s, l) => s + (l.deduction ?? 0), 0))}</td>
                  <td className="num px-5 py-2 text-right font-mono font-medium">{fmt(lines.reduce((s, l) => s + l.net, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          {cash.length > 0 && <p className="border-t border-line px-5 py-2.5 text-[12px] text-ink-3">ไม่มีบัญชีธนาคาร {cash.length} คน ({fmt(cash.reduce((s, l) => s + l.net, 0))} บาท) จ่ายเป็นเงินสด ไม่อยู่ในไฟล์โอน</p>}
        </Card>
      ) : (
        <div className="hr-print mt-4">
          {slipLines.map((l) => (
            <Payslip key={`${l.employeeId}-${l.projectId ?? ""}`} run={run} line={l} ytd={run.kind === "monthly" ? ytd.get(l.employeeId) : undefined} idNo={emps.find((e) => e.id === l.employeeId)?.idNo} />
          ))}
          {!slipLines.length && <Empty>ไม่มีสลิป</Empty>}
        </div>
      )}
      <p className="hr-noprint mt-4 text-[12px] text-ink-3">
        <Link href="/accounting" className="underline decoration-line-strong underline-offset-2 hover:text-ink">
          บัญชี
        </Link>{" "}
        ใช้รอบที่อนุมัติ/จ่ายแล้วลงสมุดรายวันเงินเดือน และค่าแรงรายวันที่มีรหัสโครงการถูกนับเป็นต้นทุนแรงงานหน้างาน
      </p>
    </>
  );
}
