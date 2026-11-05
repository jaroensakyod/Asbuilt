"use client";

import { useMemo, useState } from "react";
import { FileMinus, FileText, Printer, Receipt } from "lucide-react";
import { Card, CardHead, inputCls } from "@/components/ui";
import { A } from "@/lib/accounting/coa";
import { arAmount, arStatus, customerWithholds } from "@/lib/accounting/journal";
import { addDays, BOOKS_START, docPrefix, fmt, r2, thDateSlash, VAT_RATE } from "@/lib/accounting/money";
import { aging, AGING_BUCKETS } from "@/lib/accounting/reports";
import { validTaxId } from "@/lib/accounting/tax";
import { ACC_TODAY, arDocsCol, isLockedDate, LOCKED_MSG, settleBillingItem, useAccess, useBooks } from "@/lib/accounting/store";
import type { ArCredit, ArInvoice, ArReceipt, BillingItem, TaxMeta } from "@/lib/accounting/types";
import { Btn, CsvButton, Empty, I, Labeled, Modal, Notice, Num, numInput, Pill, PrintSheet, tableCls, td, tdR, th, thR } from "./bits";
import { CreditNoteDoc, InvoiceDoc, ReceiptDoc } from "./docs";

type St = NonNullable<ReturnType<typeof arStatus>>;
type Open = { inst: BillingItem; st: St };
type PrintDoc = { inv: ArInvoice; rc?: ArReceipt; cn?: ArCredit; credited?: number };

const ORIGIN_LABEL: Record<string, string> = { ipc: "เบิกตามผลงาน", advance: "เงินล่วงหน้า", retention: "คืนเงินประกัน" };

export function SalesView() {
  const { input, entries, projectName, locks } = useBooks();
  const { edit } = useAccess();
  const [issue, setIssue] = useState<BillingItem | null>(null);
  const [receive, setReceive] = useState<Open | null>(null);
  const [credit, setCredit] = useState<Open | null>(null);
  const [print, setPrint] = useState<PrintDoc | null>(null);

  const rows = useMemo(() => {
    const toInvoice: BillingItem[] = [];
    const open: Open[] = [];
    const receipts: { inst: BillingItem; inv: ArInvoice; rc: ArReceipt }[] = [];
    const credits: { inst: BillingItem; st: St; cn: ArCredit }[] = [];
    for (const inst of input.installments) {
      const st = arStatus(inst, input.arDocs, input.projects);
      if (!st) {
        toInvoice.push(inst);
        continue;
      }
      if (!st.paid) open.push({ inst, st });
      for (const rc of st.receipts) receipts.push({ inst, inv: st.inv, rc });
      for (const cn of st.credits) credits.push({ inst, st, cn });
    }
    toInvoice.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    open.sort((a, b) => a.st.inv.dueDate.localeCompare(b.st.inv.dueDate));
    receipts.sort((a, b) => b.rc.date.localeCompare(a.rc.date) || b.rc.id.localeCompare(a.rc.id));
    credits.sort((a, b) => b.cn.date.localeCompare(a.cn.date));
    return { toInvoice, open, receipts, credits };
  }, [input]);
  const taxOf = (key: string): TaxMeta | undefined => entries.find((e) => e.key === key)?.tax?.[0];

  const ag = useMemo(() => aging(rows.open, (o) => o.st.inv.dueDate, (o) => o.st.outstanding, ACC_TODAY), [rows.open]);
  const byCustomer = useMemo(() => {
    const m = new Map<string, number[]>();
    for (const r of ag.rows) {
      const k = r.item.st.inv.customerName;
      const v = m.get(k) ?? AGING_BUCKETS.map(() => 0);
      v[r.bucket] = r2(v[r.bucket] + r.item.st.outstanding);
      m.set(k, v);
    }
    return [...m.entries()];
  }, [ag]);

  return (
    <div className="flex flex-col gap-5">
      {!input.installments.length && <Notice>ยังไม่มีงวดเงินลูกค้าจากโมดูลการขาย เมื่อมีใบเสนอราคาที่เป็นสัญญาแล้ว งวดเงินจะแสดงที่นี่อัตโนมัติ</Notice>}

      <Card>
        <CardHead title="งวดที่ถึงกำหนดออกใบแจ้งหนี้" meta={rows.toInvoice.length} />
        {rows.toInvoice.length ? (
          <div className="overflow-x-auto">
            <table className={tableCls}>
              <thead>
                <tr>
                  <th className={th}>กำหนด</th>
                  <th className={th}>โครงการ</th>
                  <th className={th}>งวด</th>
                  <th className={thR}>มูลค่า</th>
                  <th className={thR}>VAT</th>
                  <th className={th}>สถานะ</th>
                  <th className={th} />
                </tr>
              </thead>
              <tbody>
                {rows.toInvoice.slice(0, 40).map((i) => (
                  <tr key={i.id}>
                    <td className={td}>
                      <span className="num font-mono">{thDateSlash(i.dueDate)}</span>
                    </td>
                    <td className={td}>
                      {projectName(i.projectId)} <span className="font-mono text-[12px] text-ink-3">{i.projectId}</span>
                    </td>
                    <td className={td}>{i.title}</td>
                    <td className={tdR}>
                      <Num v={i.amount} />
                    </td>
                    <td className={tdR}>
                      <Num v={i.vat} />
                    </td>
                    <td className={td}>
                      <Pill tone={i.dueDate < ACC_TODAY ? "warn" : i.dueDate <= addDays(ACC_TODAY, 14) ? "accent" : "neutral"}>{i.dueDate < ACC_TODAY ? "ถึงกำหนดแล้ว" : i.status === "due" ? "ถึงกำหนด" : "ตามแผน"}</Pill>
                    </td>
                    <td className={tdR}>
                      {edit && (
                        <Btn small onClick={() => setIssue(i)}>
                          <FileText {...I} />
                          ออกใบแจ้งหนี้
                        </Btn>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>ไม่มีงวดที่รอออกใบแจ้งหนี้</Empty>
        )}
      </Card>

      <Card>
        <CardHead
          title="ลูกหนี้คงค้าง"
          meta={`${rows.open.length} ใบ · ${fmt(ag.total)} บาท`}
          action={
            <CsvButton
              name={`ar-aging-${ACC_TODAY}`}
              rows={() => [["เลขที่", "วันที่", "ครบกำหนด", "ลูกค้า", "โครงการ", "ยอดตามใบแจ้งหนี้", "รับแล้ว", "ลดหนี้", "คงค้าง", "ช่วงอายุ"], ...ag.rows.map((r) => [r.item.st.inv.id, r.item.st.inv.date, r.item.st.inv.dueDate, r.item.st.inv.customerName, r.item.inst.projectId, arAmount(r.item.st.inv), r.item.st.settled, r.item.st.credited, r.item.st.outstanding, AGING_BUCKETS[r.bucket]])]}
            />
          }
        />
        {rows.open.length ? (
          <div className="overflow-x-auto">
            <table className={tableCls}>
              <thead>
                <tr>
                  <th className={th}>เลขที่</th>
                  <th className={th}>ครบกำหนด</th>
                  <th className={th}>ลูกค้า</th>
                  <th className={th}>งวด</th>
                  <th className={thR}>ยอดตามใบแจ้งหนี้</th>
                  <th className={thR}>รับแล้ว / ลดหนี้</th>
                  <th className={thR}>คงค้าง</th>
                  <th className={th}>อายุหนี้</th>
                  <th className={th} />
                </tr>
              </thead>
              <tbody>
                {ag.rows.map(({ item: o, bucket, days }) => (
                  <tr key={o.inst.id}>
                    <td className={td}>
                      <span className="font-mono">{o.st.inv.id}</span>
                      {o.inst.origin && ORIGIN_LABEL[o.inst.origin] && <span className="block text-[12px] text-ink-3">{ORIGIN_LABEL[o.inst.origin]}</span>}
                    </td>
                    <td className={td}>
                      <span className="num font-mono">{thDateSlash(o.st.inv.dueDate)}</span>
                    </td>
                    <td className={td}>
                      {o.st.inv.customerName}
                      <span className="block font-mono text-[12px] text-ink-3">{o.inst.projectId}</span>
                    </td>
                    <td className={td}>{o.inst.title}</td>
                    <td className={tdR}>
                      <Num v={arAmount(o.st.inv)} />
                      {o.st.inv.retention > 0 && (
                        <span className="block text-[11px] text-ink-3">
                          หักประกันผลงาน <Num v={o.st.inv.retention} />
                        </span>
                      )}
                    </td>
                    <td className={tdR}>
                      <Num v={o.st.settled} acc />
                      {o.st.credited > 0 && (
                        <span className="block text-[11px] text-ink-3">
                          ลดหนี้ <Num v={o.st.credited} />
                        </span>
                      )}
                    </td>
                    <td className={tdR}>
                      <Num v={o.st.outstanding} strong />
                    </td>
                    <td className={td}>
                      <Pill tone={bucket >= 3 ? "neg" : bucket >= 1 ? "warn" : "neutral"}>{bucket ? `เกิน ${days} วัน` : AGING_BUCKETS[0]}</Pill>
                    </td>
                    <td className={tdR}>
                      <div className="flex justify-end gap-1.5">
                        <Btn small title="พิมพ์ใบแจ้งหนี้" onClick={() => setPrint({ inv: o.st.inv })}>
                          <Printer {...I} />
                        </Btn>
                        {edit && (o.inst.origin ?? "installment") !== "retention" && (
                          <Btn small title="ออกใบลดหนี้" onClick={() => setCredit(o)}>
                            <FileMinus {...I} />
                          </Btn>
                        )}
                        {edit && (
                          <Btn small onClick={() => setReceive(o)}>
                            <Receipt {...I} />
                            รับชำระ
                          </Btn>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>ไม่มีลูกหนี้คงค้าง</Empty>
        )}
      </Card>

      <Card>
        <CardHead title="อายุลูกหนี้ตามลูกค้า" meta={`ณ ${thDateSlash(ACC_TODAY)}`} />
        <div className="overflow-x-auto">
          <table className={tableCls}>
            <thead>
              <tr>
                <th className={th}>ลูกค้า</th>
                {AGING_BUCKETS.map((b) => (
                  <th key={b} className={thR}>
                    {b}
                  </th>
                ))}
                <th className={thR}>รวม</th>
              </tr>
            </thead>
            <tbody>
              {byCustomer.map(([name, v]) => (
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

      <Card>
        <CardHead title="ประวัติการรับชำระ" meta={rows.receipts.length} />
        {rows.receipts.length ? (
          <div className="overflow-x-auto">
            <table className={tableCls}>
              <thead>
                <tr>
                  <th className={th}>ใบเสร็จ</th>
                  <th className={th}>วันที่</th>
                  <th className={th}>ใบแจ้งหนี้</th>
                  <th className={th}>ลูกค้า</th>
                  <th className={thR}>รับสุทธิ</th>
                  <th className={thR}>ถูกหัก ณ ที่จ่าย</th>
                  <th className={th} />
                </tr>
              </thead>
              <tbody>
                {rows.receipts.slice(0, 80).map(({ inst, inv, rc }) => (
                  <tr key={`${inst.id}-${rc.id}`}>
                    <td className={td}>
                      <span className="font-mono">{rc.id}</span>
                    </td>
                    <td className={td}>
                      <span className="num font-mono">{thDateSlash(rc.date)}</span>
                    </td>
                    <td className={td}>
                      <span className="font-mono">{inv.id}</span>
                    </td>
                    <td className={td}>{inv.customerName}</td>
                    <td className={tdR}>
                      <Num v={rc.received} />
                    </td>
                    <td className={tdR}>
                      <Num v={rc.wht} acc />
                    </td>
                    <td className={tdR}>
                      <div className="flex justify-end gap-1.5">
                        <Btn small onClick={() => setPrint({ inv })}>ใบแจ้งหนี้</Btn>
                        <Btn small onClick={() => setPrint({ inv, rc })}>ใบเสร็จ</Btn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>ยังไม่มีการรับชำระ</Empty>
        )}
      </Card>

      <Card>
        <CardHead title="ใบลดหนี้" meta={rows.credits.length} />
        {rows.credits.length ? (
          <div className="overflow-x-auto">
            <table className={tableCls}>
              <thead>
                <tr>
                  <th className={th}>เลขที่</th>
                  <th className={th}>วันที่</th>
                  <th className={th}>อ้างอิง</th>
                  <th className={th}>ลูกค้า / เหตุผล</th>
                  <th className={thR}>มูลค่า</th>
                  <th className={thR}>VAT</th>
                  <th className={th} />
                </tr>
              </thead>
              <tbody>
                {rows.credits.map(({ st, cn }) => (
                  <tr key={cn.id}>
                    <td className={td}>
                      <span className="font-mono">{cn.id}</span>
                    </td>
                    <td className={td}>
                      <span className="num font-mono">{thDateSlash(cn.date)}</span>
                    </td>
                    <td className={td}>
                      <span className="font-mono">{st.inv.id}</span>
                    </td>
                    <td className={td}>
                      {st.inv.customerName}
                      <span className="block text-[12px] text-ink-3">{cn.reason}</span>
                    </td>
                    <td className={tdR}>
                      <Num v={cn.amount} />
                    </td>
                    <td className={tdR}>
                      <Num v={cn.vat} />
                    </td>
                    <td className={tdR}>
                      <Btn small onClick={() => setPrint({ inv: st.inv, cn, credited: r2(st.credits.filter((x) => x.date < cn.date || (x.date === cn.date && x.id <= cn.id)).reduce((s, x) => s + x.amount, 0)) })}>
                        <Printer {...I} />
                      </Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>ยังไม่มีใบลดหนี้</Empty>
        )}
      </Card>

      {issue && <IssueInvoice inst={issue} onClose={() => setIssue(null)} locks={locks} defaults={lastCustomer(input.arDocs, issue.projectId)} owner={input.projects.find((p) => p.id === issue.projectId)} />}
      {receive && <ReceivePayment open={receive} onClose={() => setReceive(null)} locks={locks} />}
      {credit && <IssueCredit open={credit} onClose={() => setCredit(null)} locks={locks} />}
      <PrintSheet open={!!print} onClose={() => setPrint(null)} title={print?.cn ? "ใบลดหนี้" : print?.rc ? "ใบเสร็จรับเงิน" : "ใบแจ้งหนี้"}>
        {print &&
          (print.cn ? (
            <CreditNoteDoc cn={print.cn} inv={print.inv} projectName={projectName(print.inv.projectId)} credited={print.credited ?? print.cn.amount} />
          ) : print.rc ? (
            <ReceiptDoc rc={print.rc} inv={print.inv} projectName={projectName(print.inv.projectId)} tax={taxOf(`receipt:${print.rc.id}`)} />
          ) : (
            <InvoiceDoc inv={print.inv} projectName={projectName(print.inv.projectId)} />
          ))}
      </PrintSheet>
    </div>
  );
}

const lastCustomer = (docs: ReturnType<typeof arDocsCol.all>, projectId: string) =>
  docs.filter((d): d is ArInvoice => d.kind === "invoice" && d.projectId === projectId).sort((a, b) => b.date.localeCompare(a.date))[0];

function IssueInvoice({ inst, onClose, locks, defaults, owner }: { inst: BillingItem; onClose: () => void; locks: ReturnType<typeof useBooks>["locks"]; defaults?: ArInvoice; owner?: { owner: string; address?: string } }) {
  const [date, setDate] = useState(ACC_TODAY);
  const [dueDate, setDueDate] = useState(addDays(ACC_TODAY, 15));
  const [name, setName] = useState(defaults?.customerName ?? owner?.owner ?? "");
  const [taxId, setTaxId] = useState(defaults?.customerTaxId ?? "");
  const [branch, setBranch] = useState(defaults?.customerBranch ?? "");
  const [address, setAddress] = useState(defaults?.customerAddress ?? owner?.address ?? "");
  const [description, setDescription] = useState(inst.title);
  const [retPct, setRetPct] = useState("0");
  const [taxPoint, setTaxPoint] = useState<ArInvoice["taxPoint"]>("receipt");
  const retention = r2((inst.amount * (Number(retPct) || 0)) / 100);
  const locked = isLockedDate(date, locks);
  const err = locked ? LOCKED_MSG : date < BOOKS_START ? "วันที่ก่อนเริ่มใช้ระบบบัญชี" : !name.trim() ? "กรอกชื่อลูกค้า" : taxId && !validTaxId(taxId) ? "เลขประจำตัวผู้เสียภาษีไม่ถูกต้อง (13 หลัก)" : "";

  const save = () => {
    if (err) return;
    const id = arDocsCol.nextId(docPrefix("IV", date));
    const inv: ArInvoice = {
      id,
      kind: "invoice",
      installmentId: inst.id,
      projectId: inst.projectId,
      date,
      dueDate,
      customerName: name.trim(),
      customerTaxId: taxId.replace(/\D/g, "") || undefined,
      customerBranch: branch.trim() || undefined,
      customerAddress: address.trim() || undefined,
      description: description.trim() || inst.title,
      amount: r2(inst.amount),
      vat: r2(inst.vat),
      retention,
      taxPoint,
      origin: inst.origin,
    };
    arDocsCol.upsert(inv);
    settleBillingItem(inst, { invoiceNo: id, status: "invoiced" });
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`ออกใบแจ้งหนี้ · ${inst.title}`}
      width={720}
      footer={
        <>
          {err && <span className="mr-auto text-[13px] text-neg">{err}</span>}
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!!err} onClick={save}>
            ออกเลขที่และบันทึก
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Labeled label="วันที่เอกสาร">
          <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
        </Labeled>
        <Labeled label="ครบกำหนดชำระ">
          <input type="date" className={inputCls} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Labeled>
        <Labeled label="ชื่อลูกค้า" className="col-span-2">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
        </Labeled>
        <Labeled label="เลขประจำตัวผู้เสียภาษีของลูกค้า">
          <input className={numInput.replace("text-right", "")} value={taxId} onChange={(e) => setTaxId(e.target.value)} placeholder="13 หลัก (ถ้ามี)" />
        </Labeled>
        <Labeled label="สาขา">
          <input className={inputCls} value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="สำนักงานใหญ่ / สาขาที่ 00001" />
        </Labeled>
        <Labeled label="ที่อยู่ลูกค้า" className="col-span-2">
          <input className={inputCls} value={address} onChange={(e) => setAddress(e.target.value)} />
        </Labeled>
        <Labeled label="รายการ" className="col-span-2">
          <input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Labeled>
        <Labeled label="หักเงินประกันผลงาน (%)">
          <input className={numInput} inputMode="decimal" value={retPct} onChange={(e) => setRetPct(e.target.value)} />
        </Labeled>
        <Labeled label="จุดความรับผิดภาษีขาย">
          <select className={inputCls} value={taxPoint} onChange={(e) => setTaxPoint(e.target.value as ArInvoice["taxPoint"])}>
            <option value="receipt">เมื่อรับชำระ (ใบแจ้งหนี้ / ใบเสร็จ-ใบกำกับภาษี)</option>
            <option value="invoice">ออกใบกำกับภาษีพร้อมใบแจ้งหนี้</option>
          </select>
        </Labeled>
      </div>
      <dl className="mt-4 grid grid-cols-4 gap-3 rounded-[10px] bg-raised px-4 py-3 text-[13px]">
        <div>
          <dt className="text-ink-3">มูลค่า</dt>
          <dd><Num v={inst.amount} /></dd>
        </div>
        <div>
          <dt className="text-ink-3">VAT 7%</dt>
          <dd><Num v={inst.vat} /></dd>
        </div>
        <div>
          <dt className="text-ink-3">เงินประกันผลงาน</dt>
          <dd><Num v={retention} acc /></dd>
        </div>
        <div>
          <dt className="text-ink-3">ลูกหนี้ (1130)</dt>
          <dd><Num v={r2(inst.amount + inst.vat - retention)} strong /></dd>
        </div>
      </dl>
    </Modal>
  );
}

/** Receive all or part of what is owed on an invoice; the receipt is the tax invoice for its share of the VAT. */
function ReceivePayment({ open, onClose, locks }: { open: Open; onClose: () => void; locks: ReturnType<typeof useBooks>["locks"] }) {
  const { inst, st } = open;
  const inv = st.inv;
  const owed = st.outstanding;
  const release = inv.origin === "retention";
  const baseAll = release ? inv.amount : r2(inv.amount - inv.retention);
  const [date, setDate] = useState(ACC_TODAY);
  const [account, setAccount] = useState<string>(A.bank);
  const [amountText, setAmountText] = useState(String(owed));
  const [rate, setRate] = useState(customerWithholds(inv.customerName, inv.customerTaxId) ? "3" : "0");
  const [whtText, setWhtText] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const settle = r2(Number(amountText) || 0);
  const ar = arAmount(inv) || 1;
  // withholding is on the pre-VAT part of what is paid now
  const base = r2((baseAll * settle) / ar);
  const wht = whtText !== null ? r2(Number(whtText) || 0) : r2((base * (Number(rate) || 0)) / 100);
  const received = r2(settle - wht);
  const full = settle >= owed - 0.005;
  const locked = isLockedDate(date, locks);
  const err = locked
    ? LOCKED_MSG
    : date < inv.date
      ? "วันที่รับชำระก่อนวันที่ใบแจ้งหนี้"
      : !(settle > 0)
        ? "กรอกยอดที่รับชำระ"
        : settle > owed + 0.005
          ? `ยอดรับเกินยอดคงค้าง ${fmt(owed)} บาท`
          : wht < 0 || wht > base
            ? "ยอดภาษีถูกหักไม่ถูกต้อง"
            : "";
  const save = () => {
    if (err) return;
    const id = arDocsCol.nextId(docPrefix("RC", date));
    const rc: ArReceipt = { id, kind: "receipt", installmentId: inst.id, projectId: inst.projectId, invoiceNo: inv.id, date, account, whtRate: Number(rate) || 0, wht, received, note: note.trim() || undefined };
    // freeze a reconstructed invoice so its date and amounts no longer follow later installment edits
    if (inv.synthetic) arDocsCol.upsert({ ...inv, synthetic: undefined });
    arDocsCol.upsert(rc);
    const invoiceNo = inst.invoiceNo ?? (inv.synthetic ? undefined : inv.id);
    settleBillingItem(inst, full ? { invoiceNo, receiptNo: id, status: "paid", paidDate: date } : { invoiceNo });
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`รับชำระ ${inv.id}`}
      footer={
        <>
          {err && <span className="mr-auto text-[13px] text-neg">{err}</span>}
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!!err} onClick={save}>
            ออกใบเสร็จและบันทึก
          </Btn>
        </>
      }
    >
      <p className="mb-3 text-[13px] text-ink-2">
        {inv.customerName} · {inst.title}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Labeled label="วันที่รับเงิน">
          <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
        </Labeled>
        <Labeled label="รับเข้า">
          <select className={inputCls} value={account} onChange={(e) => setAccount(e.target.value)}>
            <option value={A.bank}>1112 เงินฝากธนาคาร</option>
            <option value={A.cash}>1111 เงินสด</option>
          </select>
        </Labeled>
        <Labeled label="ยอดชำระครั้งนี้ (ก่อนหัก ณ ที่จ่าย)" className="col-span-2">
          <input className={numInput} inputMode="decimal" value={amountText} onChange={(e) => (setAmountText(e.target.value), setWhtText(null))} />
        </Labeled>
        <Labeled label="ลูกค้าหักภาษี ณ ที่จ่าย (%)">
          <select className={inputCls} value={rate} onChange={(e) => (setRate(e.target.value), setWhtText(null))}>
            {[0, 1, 2, 3, 5].map((r) => (
              <option key={r} value={r}>
                {r ? `${r}%` : "ไม่หัก"}
              </option>
            ))}
          </select>
        </Labeled>
        <Labeled label="ภาษีถูกหัก (บาท)">
          <input className={numInput} inputMode="decimal" value={whtText ?? String(wht)} onChange={(e) => setWhtText(e.target.value)} />
        </Labeled>
        <Labeled label="หมายเหตุ / อ้างอิงการโอน" className="col-span-2">
          <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
        </Labeled>
      </div>
      <dl className="mt-4 grid grid-cols-4 gap-3 rounded-[10px] bg-raised px-4 py-3 text-[13px]">
        <div>
          <dt className="text-ink-3">คงค้างก่อนรับ</dt>
          <dd><Num v={owed} /></dd>
        </div>
        <div>
          <dt className="text-ink-3">ภาษีถูกหัก (1157)</dt>
          <dd><Num v={wht} acc /></dd>
        </div>
        <div>
          <dt className="text-ink-3">รับเงินสุทธิ</dt>
          <dd><Num v={received} strong /></dd>
        </div>
        <div>
          <dt className="text-ink-3">คงค้างหลังรับ</dt>
          <dd><Num v={r2(owed - settle)} acc /></dd>
        </div>
      </dl>
      {st.receipts.length > 0 && (
        <p className="mt-3 text-[12px] text-ink-3">
          รับชำระแล้ว {st.receipts.length} ครั้ง: {st.receipts.map((r) => `${r.id} ${thDateSlash(r.date)} ${fmt(r.received + r.wht)}`).join(" · ")}
        </p>
      )}
      {inv.taxPoint === "receipt" && (inv.vat > 0 || (inv.releaseVat ?? 0) > 0) && <p className="mt-3 text-[12px] text-ink-3">ภาษีขายถึงกำหนดตามสัดส่วนเงินที่รับในเดือนที่รับเงิน (โอนจาก 2136 เข้า 2135) และใบเสร็จนี้เป็นใบกำกับภาษี{full ? "" : " · รับบางส่วน: ใบแจ้งหนี้ยังคงค้างส่วนที่เหลือ"}</p>}
    </Modal>
  );
}

/** ใบลดหนี้: reduce what the customer owes on an invoice and reverse its VAT. */
function IssueCredit({ open, onClose, locks }: { open: Open; onClose: () => void; locks: ReturnType<typeof useBooks>["locks"] }) {
  const { inst, st } = open;
  const inv = st.inv;
  const vatRate = inv.amount > 0 && inv.vat > 0 ? Math.round((inv.vat / inv.amount) * 100) : inv.vat > 0 ? VAT_RATE * 100 : 0;
  const [date, setDate] = useState(ACC_TODAY);
  const [reason, setReason] = useState("");
  const [amountText, setAmountText] = useState("");
  const [vatText, setVatText] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const amount = r2(Number(amountText) || 0);
  const vat = vatText !== null ? r2(Number(vatText) || 0) : r2((amount * vatRate) / 100);
  const total = r2(amount + vat);
  const already = r2(st.credits.reduce((s, c) => s + c.amount, 0));
  const err = isLockedDate(date, locks)
    ? LOCKED_MSG
    : date < inv.date
      ? "วันที่ใบลดหนี้ก่อนวันที่ใบแจ้งหนี้"
      : !reason.trim()
        ? "ระบุเหตุที่ลดหนี้ (ต้องพิมพ์ในใบลดหนี้)"
        : !(amount > 0)
          ? "กรอกมูลค่าที่ลด"
          : amount > r2(inv.amount - already) + 0.005
            ? "มูลค่าที่ลดเกินมูลค่าคงเหลือของใบแจ้งหนี้"
            : "";
  const save = () => {
    if (err) return;
    const id = arDocsCol.nextId(docPrefix("CN", date));
    const cn: ArCredit = { id, kind: "credit", installmentId: inst.id, projectId: inst.projectId, invoiceNo: inv.id, date, reason: reason.trim(), amount, vat, note: note.trim() || undefined };
    if (inv.synthetic) arDocsCol.upsert({ ...inv, synthetic: undefined });
    arDocsCol.upsert(cn);
    if (st.outstanding - total <= 0.005) settleBillingItem(inst, { invoiceNo: inst.invoiceNo ?? inv.id, status: "paid", paidDate: date, receiptNo: st.receipts.at(-1)?.id });
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`ออกใบลดหนี้ อ้างอิง ${inv.id}`}
      footer={
        <>
          {err && <span className="mr-auto text-[13px] text-neg">{err}</span>}
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!!err} onClick={save}>
            ออกเลขที่ใบลดหนี้
          </Btn>
        </>
      }
    >
      <p className="mb-3 text-[13px] text-ink-2">
        {inv.customerName} · {inst.title}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Labeled label="วันที่ใบลดหนี้">
          <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
        </Labeled>
        <Labeled label="มูลค่าที่ลด (ก่อน VAT)">
          <input className={numInput} inputMode="decimal" value={amountText} onChange={(e) => setAmountText(e.target.value)} />
        </Labeled>
        <Labeled label="เหตุที่ลดหนี้" className="col-span-2">
          <input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="เช่น ลดราคางานเนื่องจากงานบางส่วนไม่เป็นไปตามแบบ / ยกเลิกงานบางรายการ" />
        </Labeled>
        <Labeled label={`ภาษีมูลค่าเพิ่ม (${vatRate}%)`}>
          <input className={numInput} inputMode="decimal" value={vatText ?? String(vat)} onChange={(e) => setVatText(e.target.value)} />
        </Labeled>
        <Labeled label="หมายเหตุ">
          <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
        </Labeled>
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-3 rounded-[10px] bg-raised px-4 py-3 text-[13px]">
        <div>
          <dt className="text-ink-3">มูลค่าตามใบแจ้งหนี้</dt>
          <dd><Num v={r2(inv.amount - already)} /></dd>
        </div>
        <div>
          <dt className="text-ink-3">รวมลดหนี้</dt>
          <dd><Num v={total} strong /></dd>
        </div>
        <div>
          <dt className="text-ink-3">คงค้างหลังลดหนี้</dt>
          <dd><Num v={r2(st.outstanding - total)} acc /></dd>
        </div>
      </dl>
      <p className="mt-3 text-[12px] text-ink-3">
        ภาษีขายที่ยังไม่ถึงกำหนดของใบนี้ (2136) ถูกกลับรายการก่อน ส่วนที่ออกใบกำกับภาษีไปแล้วจะลดภาษีขาย (2135) และแสดงเป็นยอดติดลบในรายงานภาษีขายของเดือนที่ออกใบลดหนี้ (ม.86/10, ม.82/10)
        {st.outstanding - total < -0.005 ? " · ยอดลดหนี้เกินยอดค้างชำระ ส่วนเกินเป็นเงินที่ต้องคืนลูกค้า" : ""}
      </p>
    </Modal>
  );
}

