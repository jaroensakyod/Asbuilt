"use client";

// AI helpers used inside the procurement document forms:
//   DeliveryNoteAi  — ใบส่งของ → quantities in the goods-receipt form, checked against what is still open on the PO
//   GrInvoiceAi     — supplier invoice for a goods receipt → invoice no. / date + amount check against the receipt
//   QuoteAi         — supplier quotation → unit price per PR line in the RFQ editor

import { useState } from "react";
import { cx, inputCls } from "@/components/ui";
import { Btn, Modal } from "@/components/ops/bits";
import { TODAY } from "@/lib/data";
import type { MediaRef } from "@/lib/media";
import { suppliers, type GoodsReceipt, type PurchaseOrder, type PurchaseRequest, type Quote } from "@/lib/procurement";
import { billDraft, checkAmounts, compareWithPO, deliveryQty, matchPoNumber, matchSupplier, normDate, quotePrices, type Confidence, type InvoiceX, type Issue, type QuoteX } from "@/lib/ai-docs";
import { AiBanner, AiButton, AiPill, IssueList, ReadDocDialog } from "./bits";
import { readInvoice, readQuote } from "./run";
import { poRefLines } from "./bill-from-doc";

const fmt = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export type AiResult = { refs: MediaRef[]; issues: Issue[]; confidence: Confidence; note?: string };

// ---------- delivery note → goods receipt ----------

export function DeliveryNoteAi({ po, remain, onApply }: { po: PurchaseOrder; remain: number[]; onApply: (r: AiResult & { qty: number[]; docNo: string; date: string }) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <AiButton onClick={() => setOpen(true)}>อ่านใบส่งของด้วย AI</AiButton>
      {open && (
        <ReadDocDialog
          title={`อ่านใบส่งของ · ${po.id}`}
          hint="ถ่ายรูปใบส่งของที่คนขับนำมา AI จะอ่านรายการและจำนวนที่ส่ง แล้วใส่ในช่อง 'รับครั้งนี้' ให้ตรวจก่อนบันทึก"
          run={(files) => readInvoice(files, { purpose: "delivery", poNumbers: [po.id], poLines: po.lines.map((l) => `${l.description} (${l.unit})`) })}
          onRead={(x, refs) => {
            setOpen(false);
            const r = deliveryQty(po.lines, remain, x);
            const issues: Issue[] = [];
            r.over.forEach((o, i) => o > 0 && issues.push({ field: `qty.${i}`, tone: "warn", msg: `${po.lines[i].description}: ใบส่งของ ${r.want[i]} ${po.lines[i].unit} เกินยอดค้างรับ ${o} ${po.lines[i].unit} ใส่เฉพาะที่ค้างรับ` }));
            r.matched.forEach((f, i) => f < 0 && remain[i] > 0 && issues.push({ field: `qty.${i}`, tone: "warn", msg: `${po.lines[i].description}: ไม่พบในใบส่งของ` }));
            r.extra.forEach((j) => issues.push({ field: "extra", tone: "warn", msg: `ใบส่งของมี "${r.found[j].description}" ${r.found[j].qty} ${r.found[j].unit} ที่ไม่อยู่ใน PO` }));
            if (x.poNumber && matchPoNumber(x.poNumber, [po.id]) !== po.id) issues.push({ field: "po", tone: "neg", msg: `ใบส่งของอ้าง PO "${x.poNumber}" ไม่ใช่ ${po.id}` });
            onApply({ qty: r.qty, refs, issues, confidence: x.confidence, docNo: x.docNo, date: normDate(x.date), note: x.note || undefined });
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

// ---------- invoice for a goods receipt ----------

export function GrInvoiceAi({ po, gr, onApply }: { po: PurchaseOrder; gr: GoodsReceipt; onApply: (r: AiResult & { invoiceNo: string; date: string; x: InvoiceX }) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <AiButton onClick={() => setOpen(true)}>อ่านใบกำกับด้วย AI</AiButton>
      {open && (
        <ReadDocDialog
          title={`อ่านใบกำกับภาษี · ${gr.id}`}
          hint="AI จะอ่านเลขที่และวันที่ใบกำกับ แล้วเทียบรายการและยอดเงินกับที่รับสินค้าจริง"
          run={(files) => readInvoice(files, { purpose: "bill", poNumbers: [po.id], poLines: po.lines.map((l) => `${l.description} (${l.unit})`) })}
          onRead={(x, refs) => {
            setOpen(false);
            const s = suppliers.get(po.supplierId);
            const d = billDraft(x, { today: TODAY, supplier: s });
            const { ref, refQty } = poRefLines(po, gr);
            const c = compareWithPO(ref, d.lines, { refQty });
            const issues: Issue[] = [...checkAmounts(x)];
            for (const l of c.lines) if (l.issue) issues.push({ field: `line.${l.ref}`, tone: "warn", msg: `${ref[l.ref].description}: ${l.issue}` });
            for (const j of c.extra) issues.push({ field: "extra", tone: "warn", msg: `ในบิลมี "${d.lines[j].description}" ที่ไม่อยู่ใน PO` });
            if (Math.abs(c.diff) > 1) issues.push({ field: "total", tone: "neg", msg: `ยอดก่อน VAT ในบิล ${fmt(d.subtotal)} ต่างจากมูลค่าที่รับ ${fmt(c.refTotal)} (${c.diff > 0 ? "+" : ""}${fmt(c.diff)}) ระบบจะตั้งหนี้ตามที่รับจริง` });
            if (s) {
              const m = matchSupplier([s], { taxId: x.vendorTaxId, name: x.vendorName }, 0.5);
              if (!m) issues.push({ field: "supplier", tone: "neg", msg: `ผู้ขายในเอกสาร "${x.vendorName}" ไม่ตรงกับผู้ขายของ PO (${s.name})` });
            }
            onApply({ invoiceNo: x.docNo.trim(), date: d.date, x, refs, issues, confidence: x.confidence, note: x.note || undefined });
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

// ---------- quotation → RFQ prices ----------

export type AiQuote = Quote & { docs?: MediaRef[] };

export function QuoteAi({ pr, quotes, onApply }: { pr: PurchaseRequest; quotes: Quote[]; onApply: (q: AiQuote, aiLines: number[]) => void }) {
  const [step, setStep] = useState<null | "read" | { x: QuoteX; refs: MediaRef[] }>(null);
  return (
    <>
      <AiButton onClick={() => setStep("read")}>อ่านใบเสนอราคาด้วย AI</AiButton>
      {step === "read" && (
        <ReadDocDialog
          title={`อ่านใบเสนอราคา · ${pr.id}`}
          hint="เลือกไฟล์หรือถ่ายรูปใบเสนอราคาของผู้ขาย 1 ราย AI จะจับคู่รายการกับใบขอซื้อ และใส่ราคาต่อหน่วยให้ตรวจ"
          run={(files) => readQuote(files, pr.lines)}
          onRead={(x, refs) => setStep({ x, refs })}
          onClose={() => setStep(null)}
        />
      )}
      {step && step !== "read" && (
        <QuoteReview
          pr={pr}
          quotes={quotes}
          x={step.x}
          refs={step.refs}
          onClose={() => setStep(null)}
          onApply={(q, ai) => {
            setStep(null);
            onApply(q, ai);
          }}
        />
      )}
    </>
  );
}

function QuoteReview({ pr, quotes, x, refs, onClose, onApply }: { pr: PurchaseRequest; quotes: Quote[]; x: QuoteX; refs: MediaRef[]; onClose: () => void; onApply: (q: AiQuote, aiLines: number[]) => void }) {
  const list = suppliers.use().filter((s) => s.status === "active");
  const [init] = useState(() => quotePrices(pr.lines, x, { today: TODAY }));
  const m = matchSupplier(list, { taxId: x.vendorTaxId, name: x.vendorName });
  const [supplierId, setSupplierId] = useState(m?.supplier.id ?? "");
  const [matched, setMatched] = useState<number[]>(init.matched);
  const r = quotePrices(pr.lines, x, { today: TODAY, matched });
  const [prices, setPrices] = useState<number[]>(init.prices);
  const [leadDays, setLeadDays] = useState(init.leadDays);
  const [validUntil, setValidUntil] = useState(init.validUntil);
  const replacing = quotes.some((q) => q.supplierId === supplierId);
  const full = quotes.length >= 3 && !replacing;
  const ok = supplierId && !full && prices.some((p) => p > 0);
  return (
    <Modal
      open
      onClose={onClose}
      width={880}
      title="ตรวจราคาจากใบเสนอราคา"
      footer={
        <>
          {full && <span className="mr-auto text-[13px] text-neg">มีผู้เสนอราคาครบ 3 รายแล้ว ลบรายใดรายหนึ่งก่อน</span>}
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn
            primary
            disabled={!ok}
            onClick={() =>
              onApply(
                { supplierId, prices, leadDays, validUntil, note: [x.docNo && `ใบเสนอราคา ${x.docNo}`, x.note].filter(Boolean).join(" · ") || undefined, docs: refs },
                matched.map((f, i) => (f >= 0 ? i : -1)).filter((i) => i >= 0),
              )
            }
          >
            {replacing ? "แทนราคาของผู้ขายรายนี้" : "เพิ่มเป็นผู้เสนอราคา"}
          </Btn>
        </>
      }
    >
      <AiBanner confidence={x.confidence} refs={refs} note={x.pricesIncludeVat ? "ราคาในใบเสนอราคารวม VAT แล้ว ระบบแปลงเป็นราคาก่อน VAT (÷ 1.07)" : undefined} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_140px_170px] text-[13px]">
        <label className="flex flex-col gap-1.5 text-ink-2">
          <span>
            ผู้เสนอราคา
            <AiPill show={!!m && m.supplier.id === supplierId} />
          </span>
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={cx(inputCls, !supplierId && "border-neg")}>
            <option value="">— เลือกผู้ขาย —</option>
            {list.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <span className="text-[12px] text-ink-3">
            ในเอกสาร: {x.vendorName || "–"}
            {!m && " · ไม่พบในทะเบียนผู้ขาย เพิ่มผู้ขายในหน้าผู้ขายก่อน"}
          </span>
        </label>
        <label className="flex flex-col gap-1.5 text-ink-2">
          <span>
            ส่งใน (วัน)
            <AiPill show={x.leadDays > 0} />
          </span>
          <input type="number" min={0} value={leadDays} onChange={(e) => setLeadDays(Number(e.target.value))} className={cx(inputCls, "font-mono")} />
        </label>
        <label className="flex flex-col gap-1.5 text-ink-2">
          <span>
            ยืนราคาถึง
            <AiPill show={!!(x.validUntil || x.validDays)} />
          </span>
          <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className={cx(inputCls, "font-mono")} />
        </label>
      </div>
      <div className="mt-4 overflow-x-auto rounded-[10px] border border-line">
        <table className="w-full min-w-[700px] text-left text-[13px]">
          <thead>
            <tr className="text-ink-3">
              <th className="px-3 py-2 font-normal">รายการที่ขอราคา</th>
              <th className="py-2 pr-3 font-normal">ตรงกับรายการในใบเสนอราคา</th>
              <th className="w-[140px] py-2 pr-3 text-right font-normal">ราคา/หน่วย ก่อน VAT</th>
            </tr>
          </thead>
          <tbody>
            {pr.lines.map((l, i) => (
              <tr key={i} className="border-t border-line">
                <td className="px-3 py-1.5">
                  {l.description}
                  <span className="block text-[12px] text-ink-3">
                    {l.qty.toLocaleString("th-TH")} {l.unit}
                  </span>
                </td>
                <td className="py-1.5 pr-3">
                  <select
                    value={matched[i]}
                    onChange={(e) => {
                      const f = Number(e.target.value);
                      const next = matched.map((v, j) => (j === i ? f : v));
                      setMatched(next);
                      const nr = quotePrices(pr.lines, x, { today: TODAY, matched: next });
                      setPrices((p) => p.map((v, j) => (j === i ? nr.prices[i] : v)));
                    }}
                    className={cx(inputCls, "w-full", matched[i] < 0 && "text-ink-3")}
                    aria-label="รายการในใบเสนอราคา"
                  >
                    <option value={-1}>ไม่มีในใบเสนอราคา</option>
                    {r.found.map((f, j) => (
                      <option key={j} value={j}>
                        {f.description} · {f.qty} {f.unit} · {fmt(f.unitPrice)}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-1.5 pr-3">
                  <input type="number" min={0} value={prices[i] || ""} onChange={(e) => setPrices((p) => p.map((v, j) => (j === i ? Number(e.target.value) : v)))} className={cx(inputCls, "w-full text-right font-mono", !prices[i] && "border-warn")} aria-label="ราคาต่อหน่วย" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {prices.some((p) => !p) && <p className="mt-2 text-[12px] text-warn">รายการที่ไม่มีราคา ต้องกรอกเองก่อนบันทึกใบเสนอราคา</p>}
      <IssueList issues={x.total && x.subtotal && Math.abs(x.subtotal + x.vat - x.total) > 1 ? [{ field: "total", tone: "warn", msg: `ยอดรวมในเอกสารไม่สอดคล้อง: ${fmt(x.subtotal)} + VAT ${fmt(x.vat)} ≠ ${fmt(x.total)}` }] : []} />
    </Modal>
  );
}
