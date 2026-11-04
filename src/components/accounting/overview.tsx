"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Card, CardHead, Dot, Stat } from "@/components/ui";
import { addDays, addMonths, BOOKS_START, fmt, periodLabel, periodLabelFull, periodOf, periodsBetween } from "@/lib/accounting/money";
import { A } from "@/lib/accounting/coa";
import { invoiceOf, receiptOf, ssoDue, vatReturns, whtSummary } from "@/lib/accounting/journal";
import { normalBalance, plByMonth } from "@/lib/accounting/reports";
import { ACC_TODAY, certsCol, filingsCol, useBooks } from "@/lib/accounting/store";
import { Num, tableCls, td, tdR, th, thR } from "./bits";

const short = (n: number) => (Math.abs(n) >= 1e6 ? `${(n / 1e6).toLocaleString("th-TH", { maximumFractionDigits: 2 })} ล้าน` : fmt(n));

export function AccountingOverview() {
  const { entries, problems, late, accounts, input, register } = useBooks();
  const filings = filingsCol.use();
  const certs = certsCol.use();
  const month = periodOf(ACC_TODAY);
  const prev = addMonths(month, -1);

  const data = useMemo(() => {
    const bal = (c: string) => normalBalance(entries, c, ACC_TODAY);
    const cash = bal(A.cash) + bal(A.bank) + bal(A.petty);
    const ar = bal(A.ar) + bal(A.retention);
    const ap = bal(A.ap);
    const vat = vatReturns(entries, month);
    const prevVat = vat.find((v) => v.period === prev);
    const months = periodsBetween(periodOf(BOOKS_START), month).slice(-6);
    const pl = plByMonth(entries, accounts, months);
    return { cash, ar, ap, wht: bal(A.whtPayable), sso: bal(A.ssoPayable), prevVat, months, pl };
  }, [entries, accounts, month, prev]);

  const alerts = useMemo(() => {
    const out: { tone: "neg" | "warn" | "accent"; text: string; href: string }[] = [];
    for (const p of problems) out.push({ tone: "neg", text: p.text, href: "/accounting/journal" });
    for (const p of late) out.push({ tone: "warn", text: p.text, href: "/accounting/close" });
    const toInvoice = input.installments.filter((i) => !invoiceOf(i, input.arDocs, input.projects) && i.dueDate <= addDays(ACC_TODAY, 7));
    if (toInvoice.length) out.push({ tone: "accent", text: `งวดเงินลูกค้า ${toInvoice.length} งวดถึงกำหนดภายใน 7 วันและยังไม่ออกใบแจ้งหนี้`, href: "/accounting/sales" });
    const overdue = input.installments.filter((i) => {
      const inv = invoiceOf(i, input.arDocs, input.projects);
      return inv && !receiptOf(i, input.arDocs, inv) && inv.dueDate < ACC_TODAY;
    });
    if (overdue.length) out.push({ tone: "warn", text: `ลูกหนี้เกินกำหนดชำระ ${overdue.length} รายการ`, href: "/accounting/sales" });
    const billsDue = input.bills.filter((b) => b.status !== "paid" && b.dueDate <= addDays(ACC_TODAY, 7));
    if (billsDue.length) out.push({ tone: "accent", text: `ใบแจ้งหนี้ผู้ขาย ${billsDue.length} ใบถึงกำหนดจ่ายภายใน 7 วัน`, href: "/accounting/purchases" });
    // filings due for last month (ภ.ง.ด. by the 7th, ภ.พ.30 / ประกันสังคม by the 15th of the next month)
    const has = (kind: string) => filings.some((f) => f.kind === kind && f.period === prev);
    if (prev >= periodOf(BOOKS_START)) {
      if (!has("pp30")) out.push({ tone: "warn", text: `ยังไม่บันทึกยื่น ภ.พ.30 งวด ${periodLabelFull(prev)} (กำหนด 15 ${periodLabel(month)})`, href: "/accounting/tax" });
      for (const [kind, form] of [
        ["pnd1", "ภ.ง.ด.1"],
        ["pnd3", "ภ.ง.ด.3"],
        ["pnd53", "ภ.ง.ด.53"],
      ] as const)
        if (!has(kind) && whtSummary(entries, prev, form).amount > 0) out.push({ tone: "warn", text: `ยังไม่บันทึกนำส่ง ${form} งวด ${periodLabelFull(prev)} (กำหนด 7 ${periodLabel(month)})`, href: "/accounting/tax" });
      if (!has("sso") && ssoDue(entries, prev) > 0) out.push({ tone: "warn", text: `ยังไม่บันทึกนำส่งประกันสังคม งวด ${periodLabelFull(prev)}`, href: "/accounting/tax" });
    }
    const whtItems = entries.flatMap((e) => e.wht ?? []).filter((w) => w.form !== "ภ.ง.ด.1");
    const pendingCerts = whtItems.filter((w) => !certs.some((c) => c.key === w.key)).length;
    if (pendingCerts) out.push({ tone: "accent", text: `ยังไม่ออกหนังสือรับรองหัก ณ ที่จ่าย (50 ทวิ) ${pendingCerts} รายการ`, href: "/accounting/tax" });
    const unnumbered = entries.filter((e) => !e.id && !register.some((r) => r.key === e.key)).length;
    if (unnumbered) out.push({ tone: "accent", text: `รายการบัญชี ${unnumbered} รายการรอเลขที่ JV`, href: "/accounting/journal" });
    if (input.locks.length === 0 || !input.locks.some((l) => l.id === addMonths(prev, -1)))
      if (addMonths(prev, -1) >= periodOf(BOOKS_START)) out.push({ tone: "accent", text: `งวด ${periodLabelFull(addMonths(prev, -1))} ยังไม่ปิดบัญชี`, href: "/accounting/close" });
    return out;
  }, [problems, late, input, filings, prev, month, entries, certs, register]);

  const i = data.months.length - 1;
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat label="เงินสดและเงินฝาก" value={short(data.cash)} unit="บาท" note="1111 + 1112 + 1113" />
        <Stat label="ลูกหนี้ค่างวด" value={short(data.ar)} unit="บาท" note="รวมเงินประกันผลงาน" />
        <Stat label="เจ้าหนี้การค้า" value={short(data.ap)} unit="บาท" />
        <Stat
          label={`ภาษีมูลค่าเพิ่ม ${data.prevVat ? periodLabel(data.prevVat.period) : ""}`}
          value={data.prevVat ? fmt(data.prevVat.payable || data.prevVat.creditOut) : "–"}
          unit="บาท"
          note={data.prevVat ? (data.prevVat.payable ? "ต้องชำระ" : "เครดิตยกไป") : "ยังไม่มีงวด"}
        />
        <Stat label="ภาษีหัก ณ ที่จ่ายค้างนำส่ง" value={fmt(data.wht)} unit="บาท" note={`ประกันสังคมค้างนำส่ง ${fmt(data.sso)}`} />
        <Stat label={`รายได้ ${periodLabel(month)}`} value={short(data.pl.totals.income[i] ?? 0)} unit="บาท" />
        <Stat label={`ต้นทุนและค่าใช้จ่าย ${periodLabel(month)}`} value={short((data.pl.totals.cost[i] ?? 0) + (data.pl.totals.sga[i] ?? 0))} unit="บาท" />
        <Stat label={`กำไรสุทธิ ${periodLabel(month)}`} value={short(data.pl.totals.net[i] ?? 0)} unit="บาท" note="ก่อนภาษีเงินได้นิติบุคคล" />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_420px]">
        <Card>
          <CardHead title="ผลการดำเนินงาน 6 เดือนล่าสุด" action={<Link href="/accounting/profit-loss" className="text-[13px] text-accent-text hover:underline">ดูงบกำไรขาดทุน</Link>} />
          <div className="overflow-x-auto">
            <table className={tableCls}>
              <thead>
                <tr>
                  <th className={th}>รายการ</th>
                  {data.months.map((m) => (
                    <th key={m} className={thR}>
                      {periodLabel(m)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ["รายได้", data.pl.totals.income],
                    ["ต้นทุนงานก่อสร้าง", data.pl.totals.cost],
                    ["กำไรขั้นต้น", data.pl.totals.gross],
                    ["ค่าใช้จ่ายขายและบริหาร", data.pl.totals.sga],
                    ["กำไร(ขาดทุน)สุทธิ", data.pl.totals.net],
                  ] as const
                ).map(([k, vals]) => (
                  <tr key={k}>
                    <td className={td}>{k}</td>
                    {vals.map((v, j) => (
                      <td key={j} className={tdR}>
                        <Num v={v} acc strong={k.startsWith("กำไร")} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card>
          <CardHead title="สิ่งที่ต้องทำ" meta={alerts.length || undefined} />
          {alerts.length ? (
            <ul className="divide-y divide-line">
              {alerts.slice(0, 14).map((a, k) => (
                <li key={k}>
                  <Link href={a.href} className="block px-5 py-2.5 text-[13px] transition-colors duration-150 hover:bg-raised/60">
                    <span className="flex items-baseline gap-2 text-ink-2">
                      <span className="relative top-[-2px]"><Dot tone={a.tone} /></span>
                      {a.text}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-8 text-center text-[13px] text-ink-3">ไม่มีรายการค้าง</p>
          )}
        </Card>
      </div>
    </div>
  );
}
