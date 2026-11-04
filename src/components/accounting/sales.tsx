"use client";

import { useMemo, useState } from "react";
import { FileText, Printer, Receipt } from "lucide-react";
import { Card, CardHead, inputCls } from "@/components/ui";
import { installments, type Installment } from "@/lib/biz";
import { A } from "@/lib/accounting/coa";
import { customerWithholds, invoiceOf, receiptOf } from "@/lib/accounting/journal";
import { addDays, BOOKS_START, docPrefix, fmt, r2, thDateSlash } from "@/lib/accounting/money";
import { aging, AGING_BUCKETS } from "@/lib/accounting/reports";
import { validTaxId } from "@/lib/accounting/tax";
import { ACC_TODAY, arDocsCol, isLockedDate, LOCKED_MSG, useAccess, useBooks } from "@/lib/accounting/store";
import type { ArInvoice, ArReceipt } from "@/lib/accounting/types";
import { Btn, CsvButton, Empty, I, Labeled, Modal, Notice, Num, numInput, Pill, PrintSheet, tableCls, td, tdR, th, thR } from "./bits";
import { InvoiceDoc, ReceiptDoc } from "./docs";

type Open = { inst: Installment; inv: ArInvoice };

export function SalesView() {
  const { input, projectName, locks } = useBooks();
  const { edit } = useAccess();
  const [issue, setIssue] = useState<Installment | null>(null);
  const [receive, setReceive] = useState<Open | null>(null);
  const [print, setPrint] = useState<{ inv: ArInvoice; rc?: ArReceipt } | null>(null);

  const rows = useMemo(() => {
    const toInvoice: Installment[] = [];
    const open: Open[] = [];
    const done: { inst: Installment; inv: ArInvoice; rc: ArReceipt }[] = [];
    for (const inst of input.installments) {
      const inv = invoiceOf(inst, input.arDocs, input.projects);
      if (!inv) {
        toInvoice.push(inst);
        continue;
      }
      const rc = receiptOf(inst, input.arDocs, inv);
      if (rc) done.push({ inst, inv, rc });
      else open.push({ inst, inv });
    }
    toInvoice.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    open.sort((a, b) => a.inv.dueDate.localeCompare(b.inv.dueDate));
    done.sort((a, b) => b.rc.date.localeCompare(a.rc.date));
    return { toInvoice, open, done };
  }, [input]);

  const ag = useMemo(() => aging(rows.open, (o) => o.inv.dueDate, (o) => r2(o.inv.amount + o.inv.vat), ACC_TODAY), [rows.open]);
  const byCustomer = useMemo(() => {
    const m = new Map<string, number[]>();
    for (const r of ag.rows) {
      const k = r.item.inv.customerName;
      const v = m.get(k) ?? AGING_BUCKETS.map(() => 0);
      v[r.bucket] = r2(v[r.bucket] + r.item.inv.amount + r.item.inv.vat);
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
              rows={() => [["เลขที่", "วันที่", "ครบกำหนด", "ลูกค้า", "โครงการ", "ยอด", "ช่วงอายุ"], ...ag.rows.map((r) => [r.item.inv.id, r.item.inv.date, r.item.inv.dueDate, r.item.inv.customerName, r.item.inst.projectId, r2(r.item.inv.amount + r.item.inv.vat), AGING_BUCKETS[r.bucket]])]}
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
                  <th className={thR}>ยอดรวม VAT</th>
                  <th className={thR}>เงินประกัน</th>
                  <th className={th}>อายุหนี้</th>
                  <th className={th} />
                </tr>
              </thead>
              <tbody>
                {ag.rows.map(({ item: o, bucket, days }) => (
                  <tr key={o.inst.id}>
                    <td className={td}>
                      <span className="font-mono">{o.inv.id}</span>
                    </td>
                    <td className={td}>
                      <span className="num font-mono">{thDateSlash(o.inv.dueDate)}</span>
                    </td>
                    <td className={td}>
                      {o.inv.customerName}
                      <span className="block font-mono text-[12px] text-ink-3">{o.inst.projectId}</span>
                    </td>
                    <td className={td}>{o.inst.title}</td>
                    <td className={tdR}>
                      <Num v={o.inv.amount + o.inv.vat} />
                    </td>
                    <td className={tdR}>
                      <Num v={o.inv.retention} acc />
                    </td>
                    <td className={td}>
                      <Pill tone={bucket >= 3 ? "neg" : bucket >= 1 ? "warn" : "neutral"}>{bucket ? `เกิน ${days} วัน` : AGING_BUCKETS[0]}</Pill>
                    </td>
                    <td className={tdR}>
                      <div className="flex justify-end gap-1.5">
                        <Btn small onClick={() => setPrint({ inv: o.inv })}>
                          <Printer {...I} />
                        </Btn>
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
        <CardHead title="รับชำระแล้ว" meta={rows.done.length} />
        {rows.done.length ? (
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
                {rows.done.slice(0, 60).map(({ inst, inv, rc }) => (
                  <tr key={inst.id}>
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

      {issue && <IssueInvoice inst={issue} onClose={() => setIssue(null)} locks={locks} defaults={lastCustomer(input.arDocs, issue.projectId)} owner={input.projects.find((p) => p.id === issue.projectId)} />}
      {receive && <ReceivePayment open={receive} onClose={() => setReceive(null)} locks={locks} />}
      <PrintSheet open={!!print} onClose={() => setPrint(null)} title={print?.rc ? "ใบเสร็จรับเงิน" : "ใบแจ้งหนี้"}>
        {print && (print.rc ? <ReceiptDoc rc={print.rc} inv={print.inv} projectName={projectName(print.inv.projectId)} /> : <InvoiceDoc inv={print.inv} projectName={projectName(print.inv.projectId)} />)}
      </PrintSheet>
    </div>
  );
}

const lastCustomer = (docs: ReturnType<typeof arDocsCol.all>, projectId: string) =>
  docs.filter((d): d is ArInvoice => d.kind === "invoice" && d.projectId === projectId).sort((a, b) => b.date.localeCompare(a.date))[0];

function IssueInvoice({ inst, onClose, locks, defaults, owner }: { inst: Installment; onClose: () => void; locks: ReturnType<typeof useBooks>["locks"]; defaults?: ArInvoice; owner?: { owner: string; address?: string } }) {
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
    };
    arDocsCol.upsert(inv);
    installments.upsert({ ...inst, invoiceNo: id, status: "invoiced" });
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

function ReceivePayment({ open, onClose, locks }: { open: Open; onClose: () => void; locks: ReturnType<typeof useBooks>["locks"] }) {
  const { inst, inv } = open;
  const base = r2(inv.amount - inv.retention);
  const due = r2(inv.amount + inv.vat - inv.retention);
  const [date, setDate] = useState(ACC_TODAY);
  const [account, setAccount] = useState<string>(A.bank);
  const [rate, setRate] = useState(customerWithholds(inv.customerName, inv.customerTaxId) ? "3" : "0");
  const [whtText, setWhtText] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const wht = whtText !== null ? r2(Number(whtText) || 0) : r2((base * (Number(rate) || 0)) / 100);
  const received = r2(due - wht);
  const locked = isLockedDate(date, locks);
  const err = locked ? LOCKED_MSG : date < inv.date ? "วันที่รับชำระก่อนวันที่ใบแจ้งหนี้" : wht < 0 || wht > base ? "ยอดภาษีถูกหักไม่ถูกต้อง" : "";
  const save = () => {
    if (err) return;
    const id = arDocsCol.nextId(docPrefix("RC", date));
    const rc: ArReceipt = { id, kind: "receipt", installmentId: inst.id, projectId: inst.projectId, invoiceNo: inv.id, date, account, whtRate: Number(rate) || 0, wht, received, note: note.trim() || undefined };
    // freeze a reconstructed invoice so its date and amounts no longer follow later installment edits
    if (inv.synthetic) arDocsCol.upsert(inv);
    arDocsCol.upsert(rc);
    installments.upsert({ ...inst, invoiceNo: inst.invoiceNo ?? (inv.synthetic ? undefined : inv.id), receiptNo: id, status: "paid", paidDate: date });
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
      <dl className="mt-4 grid grid-cols-3 gap-3 rounded-[10px] bg-raised px-4 py-3 text-[13px]">
        <div>
          <dt className="text-ink-3">ยอดตามใบแจ้งหนี้</dt>
          <dd><Num v={due} /></dd>
        </div>
        <div>
          <dt className="text-ink-3">ภาษีถูกหัก ณ ที่จ่าย (1157)</dt>
          <dd><Num v={wht} acc /></dd>
        </div>
        <div>
          <dt className="text-ink-3">รับเงินสุทธิ</dt>
          <dd><Num v={received} strong /></dd>
        </div>
      </dl>
      {inv.taxPoint === "receipt" && inv.vat > 0 && <p className="mt-3 text-[12px] text-ink-3">ภาษีขายของงวดนี้จะถึงกำหนดในเดือนที่รับเงิน (โอนจาก 2136 เข้า 2135) และใบเสร็จนี้เป็นใบกำกับภาษี</p>}
    </Modal>
  );
}
