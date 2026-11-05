"use client";

import { COMPANY_INFO, thDate } from "@/lib/data";
import type { HrLine, HrRun } from "@/lib/hr/types";
import { bahtText, fmt, maskAccount, periodLabel, siteName } from "./bits";

export type Ytd = { income: number; tax: number; sso: number };

/** One payslip. Fits A5 portrait; on A4 two fit per sheet when `compact`. */
export function Payslip({ run, line, ytd, idNo }: { run: HrRun; line: HrLine; ytd?: Ytd; idNo?: string }) {
  const daily = line.kind === "daily";
  const rate = daily && line.days ? (line.base ?? 0) / line.days : 0;
  const earnings: [string, string, number][] = daily
    ? [
        ["ค่าแรง", `${line.days} วัน × ${fmt(rate)}`, line.base ?? line.gross - line.ot],
        ["ค่าล่วงเวลา (1.5 เท่า)", line.otHours ? `${line.otHours} ชม.` : "", line.ot],
      ]
    : [
        ["เงินเดือน", "", line.base ?? line.gross - line.ot - (line.allowance ?? 0)],
        ["ค่าตำแหน่ง/ค่าเดินทาง", "", line.allowance ?? 0],
        ["ค่าล่วงเวลา (1.5 เท่า)", line.otHours ? `${line.otHours} ชม.` : "", line.ot],
      ];
  const deductions: [string, number][] = [
    ["เงินสมทบประกันสังคม 5%", line.sso],
    ["ภาษีหัก ณ ที่จ่าย", line.wht],
    [line.deductionNote ?? "รายการหักอื่น", line.deduction ?? 0],
  ];
  const totalDed = deductions.reduce((s, [, v]) => s + v, 0);

  return (
    <article className="hr-page avoid-break mx-auto mb-6 w-full max-w-[620px] rounded-[4px] border border-line bg-white px-8 py-6 text-[12px] leading-[18px] text-ink shadow-[0_2px_12px_rgba(31,27,22,0.08)]">
      <header className="flex items-start justify-between gap-4 border-b-2 border-ink pb-3">
        <div>
          <p className="text-[14px] font-medium">{COMPANY_INFO.name}</p>
          <p className="text-ink-3">{COMPANY_INFO.address}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[15px] font-medium">{daily ? "ใบแจ้งค่าแรง" : "สลิปเงินเดือน"}</p>
          <p className="text-ink-3">{daily ? "Wage slip" : "Payslip"}</p>
          <p className="mt-1 font-mono">{run.id}</p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-x-6 gap-y-1 border-b border-line py-3">
        <Row k="ชื่อ-สกุล" v={line.name} />
        <Row k="รหัส" v={<span className="font-mono">{line.employeeId}</span>} />
        <Row k={daily ? "ทักษะ" : "ตำแหน่ง"} v={line.position ?? "-"} />
        <Row k="งวด" v={daily && run.from && run.to ? `${thDate(run.from)} – ${thDate(run.to)}` : periodLabel(run.period)} />
        {daily && <Row k="หน้างาน" v={`${line.projectId ?? ""} ${siteName(line.projectId)}`} />}
        <Row k="วันที่จ่าย" v={thDate(run.payDate)} />
        <Row k="บัญชี" v={line.bankAccount ? `${line.bank ?? ""} ${maskAccount(line.bankAccount)}` : "เงินสด"} />
        {idNo && <Row k="เลขประจำตัว" v={<span className="font-mono">{`•••• ${idNo.slice(-4)}`}</span>} />}
      </div>

      <div className="grid grid-cols-2 gap-6 py-3">
        <div>
          <p className="mb-1 font-medium">รายได้</p>
          {earnings.map(([k, note, v]) => (
            <div key={k} className="flex justify-between gap-2 border-b border-line py-1">
              <span>
                {k}
                {note && <span className="ml-1 text-ink-3">{note}</span>}
              </span>
              <span className="num font-mono">{fmt(v)}</span>
            </div>
          ))}
          <div className="flex justify-between py-1 font-medium">
            <span>รวมรายได้</span>
            <span className="num font-mono">{fmt(line.gross)}</span>
          </div>
        </div>
        <div>
          <p className="mb-1 font-medium">รายการหัก</p>
          {deductions.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2 border-b border-line py-1">
              <span>{k}</span>
              <span className="num font-mono">{fmt(v)}</span>
            </div>
          ))}
          <div className="flex justify-between py-1 font-medium">
            <span>รวมรายการหัก</span>
            <span className="num font-mono">{fmt(totalDed)}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-[6px] bg-ink px-3 py-2 text-card">
        <span>เงินได้สุทธิ</span>
        <span className="num font-mono text-[15px]">{fmt(line.net)} บาท</span>
      </div>
      <p className="mt-1 text-right text-ink-3">({bahtText(line.net)})</p>

      {ytd && (
        <div className="mt-3 grid grid-cols-3 gap-3 border-t border-line pt-2 text-ink-2">
          <Row k="เงินได้สะสม" v={<span className="num font-mono">{fmt(ytd.income)}</span>} />
          <Row k="ภาษีสะสม" v={<span className="num font-mono">{fmt(ytd.tax)}</span>} />
          <Row k="ประกันสังคมสะสม" v={<span className="num font-mono">{fmt(ytd.sso, 0)}</span>} />
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-8 text-center text-ink-2">
        <div>
          <div className="h-8 border-b border-ink-3" />
          <p className="mt-1">ผู้จ่ายเงิน</p>
        </div>
        <div>
          <div className="h-8 border-b border-ink-3" />
          <p className="mt-1">ผู้รับเงิน</p>
        </div>
      </div>
    </article>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <p className="flex gap-2">
      <span className="shrink-0 text-ink-3">{k}</span>
      <span className="min-w-0">{v}</span>
    </p>
  );
}
