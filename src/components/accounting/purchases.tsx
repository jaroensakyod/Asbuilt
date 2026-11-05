"use client";

import { useMemo, useState } from "react";
import { Check, Printer, Wallet } from "lucide-react";
import { Card, CardHead, inputCls } from "@/components/ui";
import { supplierBills, type SupplierBill } from "@/lib/biz";
import { A } from "@/lib/accounting/coa";
import { billPayable, billStatus, billWht, isServiceBill } from "@/lib/accounting/journal";
import { docPrefix, fmt, r2, thDateSlash } from "@/lib/accounting/money";
import { aging, AGING_BUCKETS } from "@/lib/accounting/reports";
import { whtForm } from "@/lib/accounting/tax";
import { ACC_TODAY, apPaymentsCol, isLockedDate, LOCKED_MSG, useAccess, useBooks } from "@/lib/accounting/store";
import type { ApPayment, BillX } from "@/lib/accounting/types";
import { Btn, CsvButton, Empty, I, Labeled, Modal, Notice, Num, numInput, Pill, PrintSheet, tableCls, td, tdR, th, thR } from "./bits";
import { VoucherDoc } from "./docs";
import { BillFromDocButton } from "@/components/ai-docs/bill-from-doc";

const STATUS: Record<SupplierBill["status"], { label: string; tone: "neutral" | "accent" | "pos" }> = {
  open: { label: "รออนุมัติ", tone: "neutral" },
  approved: { label: "อนุมัติจ่าย", tone: "accent" },
  paid: { label: "จ่ายแล้ว", tone: "pos" },
};

export function PurchasesView() {
  const { input, entries, accounts, projectName, locks } = useBooks();
  const { edit, approve } = useAccess();
  const [filter, setFilter] = useState<"unpaid" | "paid" | "all">("unpaid");
  const [pay, setPay] = useState<SupplierBill | null>(null);
  const [voucher, setVoucher] = useState<{ bill: SupplierBill; pay: ApPayment } | null>(null);

  const bills = useMemo(() => [...input.bills].sort((a, b) => a.dueDate.localeCompare(b.dueDate)), [input.bills]);
  const stOf = useMemo(() => new Map(bills.map((b) => [b.id, billStatus(b, input.apPayments)])), [bills, input.apPayments]);
  const unpaid = useMemo(() => bills.filter((b) => !stOf.get(b.id)!.paid), [bills, stOf]);
  const shown = filter === "all" ? bills : filter === "paid" ? bills.filter((b) => stOf.get(b.id)!.paid).reverse() : unpaid;
  const ag = useMemo(() => aging(unpaid, (b) => b.dueDate, (b) => stOf.get(b.id)!.outstanding, ACC_TODAY), [unpaid, stOf]);
  const bySupplier = useMemo(() => {
    const m = new Map<string, number[]>();
    for (const r of ag.rows) {
      const v = m.get(r.item.supplierName) ?? AGING_BUCKETS.map(() => 0);
      v[r.bucket] = r2(v[r.bucket] + stOf.get(r.item.id)!.outstanding);
      m.set(r.item.supplierName, v);
    }
    return [...m.entries()].sort((a, b) => b[1].reduce((s, x) => s + x, 0) - a[1].reduce((s, x) => s + x, 0));
  }, [ag, stOf]);

  const voucherLines = voucher ? (entries.find((e) => e.key === `bill-payment:${voucher.pay.id}`)?.lines ?? []) : [];

  return (
    <div className="flex flex-col gap-5">
      {!bills.length && <Notice>ยังไม่มีใบแจ้งหนี้ผู้ขายจากโมดูลจัดซื้อ เมื่อรับสินค้าและบันทึกใบแจ้งหนี้แล้ว รายการจะแสดงที่นี่อัตโนมัติ</Notice>}
      <Card>
        <CardHead
          title="ใบแจ้งหนี้ผู้ขาย"
          meta={`ค้างจ่าย ${unpaid.length} ใบ · ${fmt(ag.total)} บาท`}
          action={
            <div className="flex items-center gap-2">
              {edit && <BillFromDocButton label="อ่านบิลผู้ขายด้วย AI" />}
              <select aria-label="สถานะ" className={inputCls} value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
                <option value="unpaid">ค้างจ่าย</option>
                <option value="paid">จ่ายแล้ว</option>
                <option value="all">ทั้งหมด</option>
              </select>
              <CsvButton
                name={`supplier-bills-${ACC_TODAY}`}
                rows={() => [["เลขที่", "วันที่", "ครบกำหนด", "ผู้ขาย", "เลขผู้เสียภาษี", "โครงการ", "หมวดต้นทุน", "ก่อน VAT", "VAT", "หัก ณ ที่จ่าย %", "สถานะ"], ...shown.map((b) => [b.id, b.date, b.dueDate, b.supplierName, b.supplierTaxId ?? "", b.projectId ?? "", b.costCode ?? "", b.subtotal, b.vat, b.whtRate, STATUS[b.status].label])]}
              />
            </div>
          }
        />
        {shown.length ? (
          <div className="overflow-x-auto">
            <table className={tableCls}>
              <thead>
                <tr>
                  <th className={th}>เลขที่</th>
                  <th className={th}>ครบกำหนด</th>
                  <th className={th}>ผู้ขาย</th>
                  <th className={th}>โครงการ</th>
                  <th className={thR}>ก่อน VAT</th>
                  <th className={thR}>VAT</th>
                  <th className={thR}>หัก ณ ที่จ่าย</th>
                  <th className={thR}>ชำระแล้ว / คงค้าง</th>
                  <th className={th}>สถานะ</th>
                  <th className={th} />
                </tr>
              </thead>
              <tbody>
                {shown.slice(0, 80).map((b) => {
                  const st = stOf.get(b.id)!;
                  const ret = (b as BillX).retention ?? 0;
                  return (
                    <tr key={b.id}>
                      <td className={td}>
                        <span className="font-mono">{b.id}</span>
                        <span className="block text-[12px] text-ink-3">{thDateSlash(b.date)}</span>
                      </td>
                      <td className={td}>
                        <span className={b.status !== "paid" && b.dueDate < ACC_TODAY ? "num font-mono text-neg" : "num font-mono"}>{thDateSlash(b.dueDate)}</span>
                      </td>
                      <td className={td}>
                        {b.supplierName}
                        <span className="block font-mono text-[12px] text-ink-3">{b.supplierTaxId ?? "ไม่มีเลขผู้เสียภาษี"}</span>
                      </td>
                      <td className={td}>
                        {b.projectId ? projectName(b.projectId) : <span className="text-ink-3">คลังวัสดุ</span>}
                        {b.costCode && <span className="block font-mono text-[12px] text-ink-3">51{b.costCode}</span>}
                      </td>
                      <td className={tdR}>
                        <Num v={b.subtotal} />
                      </td>
                      <td className={tdR}>
                        <Num v={b.vat} acc />
                        {isServiceBill(b) && b.vat > 0 && <span className="block text-[11px] text-ink-3">ยังไม่ถึงกำหนด</span>}
                      </td>
                      <td className={tdR}>
                        {b.whtRate ? (
                          <>
                            <Num v={billWht(b)} />
                            <span className="block text-[11px] text-ink-3">
                              {b.whtRate}% {whtForm(b.supplierTaxId, b.whtRate)}
                            </span>
                          </>
                        ) : (
                          <span className="text-ink-3">–</span>
                        )}
                      </td>
                      <td className={tdR}>
                        <Num v={st.settled} acc />
                        <span className="block text-[11px] text-ink-3">
                          คงค้าง <Num v={st.outstanding} />
                        </span>
                        {ret > 0 && <span className="block text-[11px] text-ink-3">ประกันผลงาน {fmt(ret)}</span>}
                      </td>
                      <td className={td}>
                        <Pill tone={STATUS[b.status].tone}>{STATUS[b.status].label}</Pill>
                        {!st.paid && st.payments.length > 0 && <span className="mt-1 block text-[11px] text-ink-3">จ่ายบางส่วน {st.payments.length} ครั้ง</span>}
                      </td>
                      <td className={tdR}>
                        <div className="flex justify-end gap-1.5">
                          {b.status === "open" && approve && (
                            <Btn small onClick={() => supplierBills.upsert({ ...b, status: "approved" })}>
                              <Check {...I} />
                              อนุมัติ
                            </Btn>
                          )}
                          {b.status === "approved" && edit && (
                            <Btn small onClick={() => setPay(b)}>
                              <Wallet {...I} />
                              จ่ายชำระ
                            </Btn>
                          )}
                          {st.payments.map((p) => (
                            <Btn key={p.id} small onClick={() => setVoucher({ bill: b, pay: p })}>
                              <Printer {...I} />
                              {p.synthetic ? "ใบสำคัญจ่าย" : p.id}
                            </Btn>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>ไม่มีรายการ</Empty>
        )}
      </Card>

      <Card>
        <CardHead title="อายุเจ้าหนี้ตามผู้ขาย" meta={`ณ ${thDateSlash(ACC_TODAY)}`} />
        <div className="overflow-x-auto">
          <table className={tableCls}>
            <thead>
              <tr>
                <th className={th}>ผู้ขาย</th>
                {AGING_BUCKETS.map((b) => (
                  <th key={b} className={thR}>
                    {b}
                  </th>
                ))}
                <th className={thR}>รวม</th>
              </tr>
            </thead>
            <tbody>
              {bySupplier.map(([name, v]) => (
                <tr key={name}>
                  <td className={td}>{name}</td>
                  {v.map((x, k) => (
                    <td key={k} className={tdR}>
                      <Num v={x} acc />
                    </td>
                  ))}
                  <td className={tdR}>
                    <Num v={v.reduce((s, x) => s + x, 0)} strong />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className={td}>รวม</td>
                {ag.totals.map((x, k) => (
                  <td key={k} className={tdR}>
                    <Num v={x} acc strong />
                  </td>
                ))}
                <td className={tdR}>
                  <Num v={ag.total} strong />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {pay && <PayBill bill={pay} onClose={() => setPay(null)} locks={locks} pays={input.apPayments} />}
      <PrintSheet open={!!voucher} onClose={() => setVoucher(null)} title="ใบสำคัญจ่าย">
        {voucher && <VoucherDoc bill={voucher.bill} pay={voucher.pay} lines={voucherLines} accounts={accounts} />}
      </PrintSheet>
    </div>
  );
}

/** Pay all or part of a bill; withholding is on the pre-VAT share of what is paid now. */
function PayBill({ bill, onClose, locks, pays }: { bill: SupplierBill; onClose: () => void; locks: ReturnType<typeof useBooks>["locks"]; pays: ApPayment[] }) {
  const st = billStatus(bill, pays);
  const owed = st.outstanding;
  const payable = billPayable(bill) || 1;
  const [date, setDate] = useState(ACC_TODAY);
  const [account, setAccount] = useState<string>(A.bank);
  const [note, setNote] = useState("");
  const [amountText, setAmountText] = useState(String(owed));
  const settle = r2(Number(amountText) || 0);
  const full = settle >= owed - 0.005;
  const whtLeft = r2(billWht(bill) - st.payments.reduce((s, p) => s + p.wht, 0));
  const wht = full ? Math.max(0, whtLeft) : r2((bill.subtotal * settle * (Number(bill.whtRate) || 0)) / 100 / payable);
  const paid = r2(settle - wht);
  const err = isLockedDate(date, locks) ? LOCKED_MSG : date < bill.date ? "วันที่จ่ายก่อนวันที่ใบแจ้งหนี้" : !(settle > 0) ? "กรอกยอดที่จ่าย" : settle > owed + 0.005 ? `ยอดจ่ายเกินยอดคงค้าง ${fmt(owed)} บาท` : "";
  const save = () => {
    if (err) return;
    const id = apPaymentsCol.nextId(docPrefix("PV", date));
    apPaymentsCol.upsert({ id, billId: bill.id, date, account, whtRate: bill.whtRate, wht, paid, note: note.trim() || undefined });
    if (full) supplierBills.upsert({ ...bill, status: "paid", paidDate: date });
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`จ่ายชำระ ${bill.id}`}
      footer={
        <>
          {err && <span className="mr-auto text-[13px] text-neg">{err}</span>}
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!!err} onClick={save}>
            ออกใบสำคัญจ่าย
          </Btn>
        </>
      }
    >
      <p className="mb-3 text-[13px] text-ink-2">
        {bill.supplierName} <span className="font-mono text-ink-3">{bill.supplierTaxId}</span>
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Labeled label="วันที่จ่าย">
          <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
        </Labeled>
        <Labeled label="จ่ายจาก">
          <select className={inputCls} value={account} onChange={(e) => setAccount(e.target.value)}>
            <option value={A.bank}>1112 เงินฝากธนาคาร</option>
            <option value={A.cash}>1111 เงินสด</option>
          </select>
        </Labeled>
        <Labeled label="ยอดชำระครั้งนี้ (ก่อนหัก ณ ที่จ่าย)" className="col-span-2">
          <input className={numInput} inputMode="decimal" value={amountText} onChange={(e) => setAmountText(e.target.value)} />
        </Labeled>
        <Labeled label="หมายเหตุ / เลขที่เช็ค / อ้างอิงโอน" className="col-span-2">
          <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
        </Labeled>
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-3 rounded-[10px] bg-raised px-4 py-3 text-[13px]">
        <div>
          <dt className="text-ink-3">คงค้างก่อนจ่าย</dt>
          <dd><Num v={owed} /></dd>
        </div>
        <div>
          <dt className="text-ink-3">หัก ณ ที่จ่าย {bill.whtRate ? `${bill.whtRate}% ${whtForm(bill.supplierTaxId, bill.whtRate)}` : ""}</dt>
          <dd><Num v={wht} acc /></dd>
        </div>
        <div>
          <dt className="text-ink-3">จ่ายสุทธิ</dt>
          <dd><Num v={paid} strong /></dd>
        </div>
      </dl>
      {st.payments.length > 0 && <p className="mt-3 text-[12px] text-ink-3">จ่ายแล้ว {st.payments.length} ครั้ง: {st.payments.map((p) => `${p.id} ${thDateSlash(p.date)} ${fmt(p.paid + p.wht)}`).join(" · ")}</p>}
      {((bill as BillX).retention ?? 0) > 0 && <p className="mt-3 text-[12px] text-ink-3">หักเงินประกันผลงาน {fmt((bill as BillX).retention ?? 0)} บาท ไว้ในบัญชี 2150 จนกว่าจะคืนให้ผู้รับเหมาช่วง</p>}
      {isServiceBill(bill) && bill.vat > 0 && <p className="mt-3 text-[12px] text-ink-3">ค่าบริการ: ภาษีซื้อใช้สิทธิตามสัดส่วนเงินที่จ่ายในเดือนที่จ่าย (โอนจาก 1155 เข้า 1154) เมื่อได้รับใบกำกับภาษีจากผู้ขาย · ทั้งใบ {fmt(bill.vat)} บาท</p>}
    </Modal>
  );
}
