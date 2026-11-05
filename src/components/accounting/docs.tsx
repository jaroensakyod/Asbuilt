"use client";
// Printable A4 documents: ใบแจ้งหนี้ / ใบกำกับภาษี / ใบเสร็จรับเงิน, ใบสำคัญจ่าย, หนังสือรับรองการหักภาษี ณ ที่จ่าย (50 ทวิ).

import type { ReactNode } from "react";
import { Check as CheckIcon } from "lucide-react";
import { cx } from "@/components/ui";
import { Signatures } from "@/components/ops/doc";
import { COMPANY_INFO } from "@/lib/data";
import type { SupplierBill } from "@/lib/biz";
import { accountName, type Account } from "@/lib/accounting/coa";
import { bahtText, fmt, r2, thDateFull, thDateSlash } from "@/lib/accounting/money";
import { billPayable, billTotal, collectedVat } from "@/lib/accounting/journal";
import type { ApPayment, ArCredit, ArInvoice, ArReceipt, BillX, JournalLine, TaxMeta, WhtCertificate } from "@/lib/accounting/types";

const COMPANY_BRANCH = "สำนักงานใหญ่";

function Letterhead({ title, titleEn, no, meta }: { title: string; titleEn: string; no: string; meta: ReactNode }) {
  return (
    <header className="flex items-start justify-between gap-6 border-b-2 border-ink pb-4">
      <div className="text-[12px] leading-[18px] text-ink-2">
        <p className="text-[16px] font-medium leading-[22px] text-ink">{COMPANY_INFO.name}</p>
        <p className="text-ink-3">{COMPANY_INFO.nameEn}</p>
        <p>{COMPANY_INFO.address}</p>
        <p>โทร {COMPANY_INFO.phone}</p>
        <p>
          เลขประจำตัวผู้เสียภาษีอากร <span className="font-mono">{COMPANY_INFO.taxId}</span> · {COMPANY_BRANCH}
        </p>
      </div>
      <div className="shrink-0 text-right text-[12px] leading-[18px] text-ink-2">
        <p className="text-[18px] font-medium leading-[26px] text-ink">{title}</p>
        <p className="text-ink-3">{titleEn}</p>
        <p className="mt-2 inline-block rounded-[6px] border border-ink px-2 py-0.5 font-mono text-[13px] text-ink">{no}</p>
        <div className="mt-2">{meta}</div>
      </div>
    </header>
  );
}

function Party({ label, name, taxId, branch, address }: { label: string; name: string; taxId?: string; branch?: string; address?: string }) {
  return (
    <div className="rounded-[6px] border border-line-strong px-3 py-2 text-[13px]">
      <p className="text-[12px] text-ink-3">{label}</p>
      <p className="font-medium">{name}</p>
      {address && <p className="text-ink-2">{address}</p>}
      <p className="text-ink-2">
        เลขประจำตัวผู้เสียภาษีอากร <span className="font-mono">{taxId || "–"}</span>
        {branch ? ` · ${branch}` : ""}
      </p>
    </div>
  );
}

function Totals({ rows, words }: { rows: [string, number, boolean?][]; words: number }) {
  return (
    <div className="avoid-break mt-3 grid grid-cols-[1fr_300px] gap-6 text-[13px]">
      <p className="self-end rounded-[6px] bg-raised px-3 py-2">({bahtText(words)})</p>
      <div>
        {rows.map(([k, v, strong]) => (
          <div key={k} className={cx("flex justify-between border-b border-line py-1.5", strong && "font-medium")}>
            <span className={strong ? "" : "text-ink-2"}>{k}</span>
            <span className="num font-mono">{fmt(v)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const itemTable = (rows: { desc: string; amount: number }[]) => (
  <table className="mt-4 w-full border-collapse text-[13px]">
    <thead>
      <tr className="border-y border-ink">
        <th className="w-12 py-1.5 text-left font-normal text-ink-3">ลำดับ</th>
        <th className="py-1.5 text-left font-normal text-ink-3">รายการ</th>
        <th className="w-40 py-1.5 text-right font-normal text-ink-3">จำนวนเงิน (บาท)</th>
      </tr>
    </thead>
    <tbody>
      {rows.map((r, i) => (
        <tr key={i} className="border-b border-line">
          <td className="py-2 align-top">{i + 1}</td>
          <td className="py-2">{r.desc}</td>
          <td className="num py-2 text-right font-mono">{fmt(r.amount)}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

/** ใบแจ้งหนี้ (ใบกำกับภาษี) for an installment */
export function InvoiceDoc({ inv, projectName }: { inv: ArInvoice; projectName: string }) {
  const isTax = inv.taxPoint === "invoice";
  const total = r2(inv.amount + inv.vat);
  return (
    <>
      <Letterhead
        title={isTax ? "ใบแจ้งหนี้/ใบกำกับภาษี" : "ใบแจ้งหนี้"}
        titleEn={isTax ? "INVOICE / TAX INVOICE" : "INVOICE"}
        no={inv.id}
        meta={
          <>
            <p>วันที่ {thDateFull(inv.date)}</p>
            <p>ครบกำหนดชำระ {thDateFull(inv.dueDate)}</p>
            {isTax && <p>ต้นฉบับ</p>}
          </>
        }
      />
      <div className="mt-4 grid grid-cols-[1fr_220px] gap-4">
        <Party label="ลูกค้า" name={inv.customerName} taxId={inv.customerTaxId} branch={inv.customerBranch} address={inv.customerAddress} />
        <div className="rounded-[6px] border border-line-strong px-3 py-2 text-[13px]">
          <p className="text-[12px] text-ink-3">โครงการ</p>
          <p>{projectName}</p>
          <p className="font-mono text-ink-2">{inv.projectId}</p>
        </div>
      </div>
      {itemTable([{ desc: inv.description, amount: inv.amount }])}
      <Totals
        words={r2(total - inv.retention)}
        rows={[
          ["มูลค่าก่อนภาษีมูลค่าเพิ่ม", inv.amount],
          ["ภาษีมูลค่าเพิ่ม 7%", inv.vat],
          ["รวมทั้งสิ้น", total, true],
          ...(inv.retention > 0 ? ([["หัก เงินประกันผลงาน", inv.retention], ["ยอดที่ต้องชำระ", r2(total - inv.retention), true]] as [string, number, boolean?][]) : []),
        ]}
      />
      {!isTax && <p className="mt-3 text-[12px] text-ink-3">เอกสารนี้ไม่ใช่ใบกำกับภาษี บริษัทจะออกใบเสร็จรับเงิน/ใบกำกับภาษีเมื่อได้รับชำระเงิน (ค่าก่อสร้างเป็นการให้บริการ ภาษีขายถึงกำหนดเมื่อได้รับชำระ)</p>}
      <p className="mt-3 text-[12px] text-ink-2">ชำระโดยโอนเข้าบัญชี {COMPANY_INFO.name} · กรุณาแจ้งหลักฐานการโอนที่ {COMPANY_INFO.phone}</p>
      <Signatures roles={[{ role: "ผู้รับวางบิล" }, { role: "ผู้มีอำนาจลงนาม" }]} />
    </>
  );
}

/** ใบเสร็จรับเงิน (/ใบกำกับภาษี when output VAT is due on payment) */
export function ReceiptDoc({ rc, inv, projectName, tax }: { rc: ArReceipt; inv: ArInvoice; projectName: string; tax?: TaxMeta }) {
  const total = r2(rc.received + rc.wht);
  const release = inv.origin === "retention";
  const isTax = inv.taxPoint === "receipt" && (tax ? tax.vat > 0 : inv.vat > 0);
  // VAT of this receipt as posted (receipts in parts split the invoice pro rata); else derived from the invoice
  const vat = tax ? tax.vat : release ? 0 : isTax ? collectedVat(inv) : r2(inv.vat * (inv.amount ? (inv.amount - inv.retention) / inv.amount : 1));
  const base = r2(total - vat);
  const partial = total < r2(inv.amount + inv.vat - inv.retention) - 0.005;
  return (
    <>
      <Letterhead
        title={isTax ? "ใบเสร็จรับเงิน/ใบกำกับภาษี" : "ใบเสร็จรับเงิน"}
        titleEn={isTax ? "RECEIPT / TAX INVOICE" : "RECEIPT"}
        no={rc.id}
        meta={
          <>
            <p>วันที่ {thDateFull(rc.date)}</p>
            <p>อ้างอิง {inv.id}</p>
            <p>ต้นฉบับ</p>
          </>
        }
      />
      <div className="mt-4 grid grid-cols-[1fr_220px] gap-4">
        <Party label="ได้รับเงินจาก" name={inv.customerName} taxId={inv.customerTaxId} branch={inv.customerBranch} address={inv.customerAddress} />
        <div className="rounded-[6px] border border-line-strong px-3 py-2 text-[13px]">
          <p className="text-[12px] text-ink-3">โครงการ</p>
          <p>{projectName}</p>
          <p className="font-mono text-ink-2">{inv.projectId}</p>
        </div>
      </div>
      {itemTable([{ desc: `${inv.description}${inv.retention > 0 ? " (ส่วนที่ไม่รวมเงินประกันผลงาน)" : ""}${partial ? " · รับชำระบางส่วน" : ""}`, amount: base }])}
      <Totals
        words={total}
        rows={[
          ["มูลค่าก่อนภาษีมูลค่าเพิ่ม", base],
          ["ภาษีมูลค่าเพิ่ม 7%", vat],
          ["รวมรับชำระ", total, true],
          ...(rc.wht > 0 ? ([["ลูกค้าหักภาษี ณ ที่จ่าย", rc.wht], ["รับเงินสุทธิ", rc.received, true]] as [string, number, boolean?][]) : []),
        ]}
      />
      <p className="mt-3 text-[12px] text-ink-2">
        ชำระโดย {rc.account === "1111" ? "เงินสด" : "โอนเข้าบัญชีธนาคาร"} {rc.note ? `· ${rc.note}` : ""}
        {rc.wht > 0 ? " · โปรดส่งหนังสือรับรองการหักภาษี ณ ที่จ่ายให้บริษัท" : ""}
      </p>
      <Signatures roles={[{ role: "ผู้รับเงิน" }, { role: "ผู้มีอำนาจลงนาม" }]} />
    </>
  );
}

/** ใบลดหนี้ / ใบกำกับภาษี against an invoice (มาตรา 86/10): original value, correct value, difference and VAT */
export function CreditNoteDoc({ cn, inv, projectName, credited }: { cn: ArCredit; inv: ArInvoice; projectName: string; credited: number }) {
  const before = r2(inv.amount - (credited - cn.amount));
  const after = r2(before - cn.amount);
  const total = r2(cn.amount + cn.vat);
  return (
    <>
      <Letterhead
        title="ใบลดหนี้/ใบกำกับภาษี"
        titleEn="CREDIT NOTE / TAX INVOICE"
        no={cn.id}
        meta={
          <>
            <p>วันที่ {thDateFull(cn.date)}</p>
            <p>อ้างอิงใบกำกับภาษี/ใบแจ้งหนี้ {inv.id}</p>
            <p>ลงวันที่ {thDateSlash(inv.date)}</p>
            <p>ต้นฉบับ</p>
          </>
        }
      />
      <div className="mt-4 grid grid-cols-[1fr_220px] gap-4">
        <Party label="ลูกค้า" name={inv.customerName} taxId={inv.customerTaxId} branch={inv.customerBranch} address={inv.customerAddress} />
        <div className="rounded-[6px] border border-line-strong px-3 py-2 text-[13px]">
          <p className="text-[12px] text-ink-3">โครงการ</p>
          <p>{projectName}</p>
          <p className="font-mono text-ink-2">{inv.projectId}</p>
        </div>
      </div>
      <p className="mt-4 text-[13px]">
        <span className="text-ink-3">เหตุที่ลดหนี้ </span>
        {cn.reason}
      </p>
      {itemTable([{ desc: `${inv.description}${cn.note ? ` · ${cn.note}` : ""}`, amount: cn.amount }])}
      <Totals
        words={total}
        rows={[
          ["มูลค่าสินค้า/บริการตามใบกำกับภาษีเดิม", before],
          ["มูลค่าที่ถูกต้อง", after],
          ["ผลต่าง", cn.amount],
          ["ภาษีมูลค่าเพิ่ม 7%", cn.vat],
          ["รวมลดหนี้", total, true],
        ]}
      />
      <Signatures roles={[{ role: "ผู้รับเอกสาร" }, { role: "ผู้มีอำนาจลงนาม" }]} />
    </>
  );
}

/** ใบสำคัญจ่าย */
export function VoucherDoc({ pay, bill, lines, accounts }: { pay: ApPayment; bill: SupplierBill; lines: JournalLine[]; accounts: Account[] }) {
  const total = billTotal(bill);
  const retention = (bill as BillX).retention ?? 0;
  const settle = r2(pay.paid + pay.wht);
  const partial = settle < billPayable(bill) - 0.005;
  const extra: [string, number, boolean?][] = [...(retention > 0 ? ([["หัก เงินประกันผลงาน", retention]] as [string, number][]) : []), ...(partial ? ([["ชำระครั้งนี้ (บางส่วน)", settle, true]] as [string, number, boolean][]) : [])];
  return (
    <>
      <Letterhead title="ใบสำคัญจ่าย" titleEn="PAYMENT VOUCHER" no={pay.id} meta={<p>วันที่ {thDateFull(pay.date)}</p>} />
      <div className="mt-4 grid grid-cols-[1fr_220px] gap-4">
        <Party label="จ่ายให้" name={bill.supplierName} taxId={bill.supplierTaxId} />
        <div className="rounded-[6px] border border-line-strong px-3 py-2 text-[13px]">
          <p className="text-[12px] text-ink-3">อ้างอิงใบแจ้งหนี้</p>
          <p className="font-mono">{bill.id}</p>
          <p className="text-ink-2">ลงวันที่ {thDateSlash(bill.date)}</p>
          {bill.projectId && <p className="font-mono text-ink-2">{bill.projectId}</p>}
        </div>
      </div>
      {itemTable(bill.lines.length ? bill.lines.map((l) => ({ desc: `${l.description} ${l.qty} ${l.unit} × ${fmt(l.unitPrice)}`, amount: r2(l.qty * l.unitPrice) })) : [{ desc: "ตามใบแจ้งหนี้", amount: bill.subtotal }])}
      <Totals
        words={pay.paid}
        rows={[
          ["มูลค่าก่อนภาษี", bill.subtotal],
          ["ภาษีมูลค่าเพิ่ม", bill.vat],
          ["รวม", total, true],
          ...extra,
          ["หัก ภาษี ณ ที่จ่าย " + (pay.whtRate ? `${pay.whtRate}%` : ""), pay.wht],
          ["จ่ายสุทธิ", pay.paid, true],
        ]}
      />
      <table className="avoid-break mt-5 w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-y border-ink">
            <th className="py-1 text-left font-normal text-ink-3">รหัสบัญชี</th>
            <th className="py-1 text-left font-normal text-ink-3">ชื่อบัญชี</th>
            <th className="py-1 text-right font-normal text-ink-3">เดบิต</th>
            <th className="py-1 text-right font-normal text-ink-3">เครดิต</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} className="border-b border-line">
              <td className="py-1 font-mono">{l.account}</td>
              <td className="py-1">{accountName(accounts, l.account)}</td>
              <td className="num py-1 text-right font-mono">{l.debit ? fmt(l.debit) : ""}</td>
              <td className="num py-1 text-right font-mono">{l.credit ? fmt(l.credit) : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-[12px] text-ink-2">จ่ายจาก {accountName(accounts, pay.account)}{pay.note ? ` · ${pay.note}` : ""}</p>
      <Signatures roles={[{ role: "ผู้จัดทำ" }, { role: "ผู้ตรวจสอบ" }, { role: "ผู้อนุมัติ" }, { role: "ผู้รับเงิน" }]} />
    </>
  );
}

// ---------- 50 ทวิ ----------

function Boxes({ id }: { id?: string }) {
  const d = String(id || "").replace(/\D/g, "").padEnd(13, " ").slice(0, 13).split("");
  const groups = [1, 4, 5, 2, 1];
  let i = 0;
  return (
    <span className="inline-flex gap-1.5 align-middle">
      {groups.map((n, g) => (
        <span key={g} className="inline-flex">
          {d.slice(i, (i += n)).map((c, k) => (
            <span key={k} className="flex h-5 w-4 items-center justify-center border border-ink font-mono text-[12px] [&:not(:first-child)]:border-l-0">
              {c.trim()}
            </span>
          ))}
        </span>
      ))}
    </span>
  );
}
const Check = ({ on, children }: { on: boolean; children: ReactNode }) => (
  <span className="inline-flex items-center gap-1 whitespace-nowrap">
    <span className="flex size-3.5 items-center justify-center border border-ink text-[10px] leading-none">{on ? <CheckIcon size={11} strokeWidth={2} /> : null}</span>
    {children}
  </span>
);

const INCOME_ROWS: { row: WhtCertificate["incomeRow"]; text: string }[] = [
  { row: "1", text: "1. เงินเดือน ค่าจ้าง เบี้ยเลี้ยง โบนัส ฯลฯ ตามมาตรา 40 (1)" },
  { row: "2", text: "2. ค่าธรรมเนียม ค่านายหน้า ฯลฯ ตามมาตรา 40 (2)" },
  { row: "3", text: "3. ค่าแห่งลิขสิทธิ์ ฯลฯ ตามมาตรา 40 (3)" },
  { row: "4a", text: "4. (ก) ดอกเบี้ย ฯลฯ ตามมาตรา 40 (4) (ก)" },
  { row: "4b", text: "    (ข) เงินปันผล เงินส่วนแบ่งกำไร ฯลฯ ตามมาตรา 40 (4) (ข)" },
  { row: "5", text: "5. การจ่ายเงินได้ที่ต้องหักภาษี ณ ที่จ่าย ตามคำสั่งกรมสรรพากรที่ออกตามมาตรา 3 เตรส เช่น ค่าจ้างทำของ ค่าบริการ ค่าเช่า ค่าขนส่ง ค่าโฆษณา ค่าเบี้ยประกันวินาศภัย" },
  { row: "6", text: "6. อื่น ๆ (ระบุ)" },
];
export const INCOME_ROW_LABEL: Record<WhtCertificate["incomeRow"], string> = { "1": "40(1)", "2": "40(2)", "3": "40(3)", "4a": "40(4)(ก)", "4b": "40(4)(ข)", "5": "3 เตรส", "6": "อื่น ๆ" };

export function Wht50Doc({ c }: { c: WhtCertificate }) {
  const [book, seq] = c.no.split("/");
  const forms = ["ภ.ง.ด.1ก", "ภ.ง.ด.1ก พิเศษ", "ภ.ง.ด.2", "ภ.ง.ด.3", "ภ.ง.ด.2ก", "ภ.ง.ด.3ก", "ภ.ง.ด.53"];
  const formOn = (f: string) => f === c.form || (c.form === "ภ.ง.ด.1" && f === "ภ.ง.ด.1ก");
  return (
    <div className="text-[12px] leading-[18px]">
      <div className="flex items-start justify-between">
        <p className="text-ink-3">ฉบับที่ 1 (สำหรับผู้ถูกหักภาษี ณ ที่จ่าย ใช้แนบพร้อมกับแบบแสดงรายการภาษี)</p>
        <p>
          เล่มที่ <span className="font-mono">{book}</span> · เลขที่ <span className="font-mono">{seq}</span>
        </p>
      </div>
      <h1 className="mt-2 text-center text-[17px] font-medium">หนังสือรับรองการหักภาษี ณ ที่จ่าย</h1>
      <p className="text-center text-ink-2">ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร</p>

      <section className="mt-3 border border-ink px-3 py-2">
        <div className="flex items-center justify-between gap-3">
          <p className="font-medium">ผู้มีหน้าที่หักภาษี ณ ที่จ่าย</p>
          <p>
            เลขประจำตัวผู้เสียภาษีอากร <Boxes id={COMPANY_INFO.taxId} />
          </p>
        </div>
        <p>ชื่อ {COMPANY_INFO.name} ({COMPANY_BRANCH})</p>
        <p>ที่อยู่ {COMPANY_INFO.address}</p>
      </section>
      <section className="mt-2 border border-ink px-3 py-2">
        <div className="flex items-center justify-between gap-3">
          <p className="font-medium">ผู้ถูกหักภาษี ณ ที่จ่าย</p>
          <p>
            เลขประจำตัวผู้เสียภาษีอากร <Boxes id={c.payeeTaxId} />
          </p>
        </div>
        <p>
          ชื่อ {c.payee}
          {c.payeeBranch ? ` (${c.payeeBranch})` : ""}
        </p>
        <p>ที่อยู่ {c.payeeAddress || ".............................................................................................................."}</p>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
          <span>ในแบบ</span>
          {forms.map((f, i) => (
            <Check key={f} on={formOn(f)}>
              ({i + 1}) {f}
            </Check>
          ))}
        </div>
      </section>

      <table className="mt-2 w-full border-collapse border border-ink">
        <thead>
          <tr className="border-b border-ink">
            <th className="border-r border-ink px-2 py-1 text-left font-normal">ประเภทเงินได้พึงประเมินที่จ่าย</th>
            <th className="w-28 border-r border-ink px-2 py-1 font-normal">วัน เดือน ปีภาษี ที่จ่าย</th>
            <th className="w-32 border-r border-ink px-2 py-1 text-right font-normal">จำนวนเงินที่จ่าย</th>
            <th className="w-32 px-2 py-1 text-right font-normal">ภาษีที่หักและนำส่งไว้</th>
          </tr>
        </thead>
        <tbody>
          {INCOME_ROWS.map((r) => {
            const on = r.row === c.incomeRow;
            return (
              <tr key={r.row} className="align-top">
                <td className="whitespace-pre-wrap border-r border-ink px-2 py-1">
                  {r.text}
                  {on && c.incomeDesc ? <span className="block pl-4 text-ink-2">{c.incomeDesc} (อัตรา {c.rate}%)</span> : null}
                </td>
                <td className="border-r border-ink px-2 py-1 text-center font-mono">{on ? thDateSlash(c.date) : ""}</td>
                <td className="num border-r border-ink px-2 py-1 text-right font-mono">{on ? fmt(c.base) : ""}</td>
                <td className="num px-2 py-1 text-right font-mono">{on ? fmt(c.amount) : ""}</td>
              </tr>
            );
          })}
          <tr className="border-t border-ink font-medium">
            <td className="border-r border-ink px-2 py-1 text-right" colSpan={2}>
              รวมเงินที่จ่ายและภาษีที่หักนำส่ง
            </td>
            <td className="num border-r border-ink px-2 py-1 text-right font-mono">{fmt(c.base)}</td>
            <td className="num px-2 py-1 text-right font-mono">{fmt(c.amount)}</td>
          </tr>
          <tr className="border-t border-ink">
            <td className="px-2 py-1" colSpan={4}>
              รวมเงินภาษีที่หักนำส่ง (ตัวอักษร) <span className="ml-2 rounded-[4px] bg-raised px-2">{bahtText(c.amount)}</span>
            </td>
          </tr>
        </tbody>
      </table>
      <p className="mt-2">เงินที่จ่ายเข้า กบข./กสจ./กองทุนสงเคราะห์ครูโรงเรียนเอกชน ............ บาท · กองทุนประกันสังคม ............ บาท · กองทุนสำรองเลี้ยงชีพ ............ บาท</p>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
        <span>ผู้จ่ายเงิน</span>
        <Check on={c.payerMode === "withhold"}>(1) หัก ณ ที่จ่าย</Check>
        <Check on={c.payerMode === "always"}>(2) ออกให้ตลอดไป</Check>
        <Check on={c.payerMode === "once"}>(3) ออกให้ครั้งเดียว</Check>
        <Check on={false}>(4) อื่น ๆ</Check>
      </div>
      <div className="avoid-break mt-4 grid grid-cols-[1fr_260px] gap-4 border border-ink px-3 py-3">
        <p className="text-ink-2">
          คำเตือน ผู้มีหน้าที่ออกหนังสือรับรองการหักภาษี ณ ที่จ่าย ฝ่าฝืนไม่ปฏิบัติตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร ต้องรับโทษทางอาญาตามมาตรา 35 แห่งประมวลรัษฎากร
        </p>
        <div className="text-center">
          <p>ขอรับรองว่าข้อความและตัวเลขดังกล่าวข้างต้นถูกต้องตรงกับความจริงทุกประการ</p>
          <div className="mt-8 border-b border-ink-3" />
          <p className="mt-1">ลงชื่อ ผู้จ่ายเงิน</p>
          <p>{thDateFull(c.date)}</p>
          <p className="mt-1 text-ink-3">ประทับตรานิติบุคคล (ถ้ามี)</p>
        </div>
      </div>
    </div>
  );
}
