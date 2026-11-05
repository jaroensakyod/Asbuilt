"use client";

// Supplier tax invoice / receipt / bill (photo or PDF) → AI → editable supplier bill.
// The vendor is matched to procurement suppliers by tax id, then by name; the PO number links an
// open PO and the bill is compared with the PO (or the goods receipt) line by line.
// Saving goes through the same supplier_bills collection procurement and accounting already use.

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { cx, inputCls } from "@/components/ui";
import { Btn, I, IconBtn, Modal, Pill } from "@/components/ops/bits";
import { CodeSelect, ProjectSelect } from "@/components/procurement/forms";
import { SupplierForm } from "@/components/procurement/supplier-form";
import { thDate, TODAY } from "@/lib/data";
import type { CostCode } from "@/lib/biz";
import type { MediaRef } from "@/lib/media";
import {
  asProcBill,
  billOfGR,
  goodsReceipts,
  isOpenPO,
  purchaseOrders,
  supplierBills,
  suppliers,
  VAT_RATE,
  type GoodsReceipt,
  type ProcBill,
  type PurchaseOrder,
  type Supplier,
} from "@/lib/procurement";
import { addDays, billDraft, checkAmounts, compareWithPO, DOC_KIND_LABEL, matchPoNumber, matchSupplier, nameSimilarity, normTaxId, r2, taxIdChecksumOk, WHT_RATES, type InvoiceX, type Issue } from "@/lib/ai-docs";
import { AiBanner, AiButton, AiField, AiPill, IssueList, ReadDocDialog } from "./bits";
import { readInvoice } from "./run";

const fmt = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** extra fields kept on a bill created from a document */
export type AiBill = ProcBill & { docs?: MediaRef[]; aiRead?: { at: string; confidence: string } };

export function BillFromDocButton({ label = "อ่านใบกำกับภาษีด้วย AI" }: { label?: string }) {
  const pos = purchaseOrders.use();
  const [step, setStep] = useState<null | "read" | { x: InvoiceX; refs: MediaRef[] }>(null);
  const openPoIds = useMemo(() => pos.filter(isOpenPO).map((p) => p.id), [pos]);
  return (
    <>
      <AiButton onClick={() => setStep("read")}>{label}</AiButton>
      {step === "read" && (
        <ReadDocDialog
          title="อ่านใบกำกับภาษี / ใบแจ้งหนี้ผู้ขาย"
          hint="ถ่ายรูปหรือเลือกไฟล์ใบกำกับภาษี ใบเสร็จ หรือใบแจ้งหนี้ของผู้ขาย AI จะอ่านผู้ขาย เลขที่ วันที่ รายการ และยอดเงิน แล้วเปิดแบบฟอร์มให้ตรวจก่อนบันทึก"
          run={(files) => readInvoice(files, { purpose: "bill", poNumbers: openPoIds })}
          onRead={(x, refs) => setStep({ x, refs })}
          onClose={() => setStep(null)}
        />
      )}
      {step && step !== "read" && <BillReview x={step.x} refs={step.refs} onClose={() => setStep(null)} />}
    </>
  );
}

type Line = { description: string; qty: number; unit: string; unitPrice: number };

/** PO lines with the quantity the bill should cover: received on the chosen GR, else ordered */
export function poRefLines(po: PurchaseOrder, gr?: GoodsReceipt) {
  const refQty = gr ? po.lines.map((_, i) => gr.lines.find((x) => x.line === i)?.qty ?? 0) : po.lines.map((l) => l.qty);
  return { ref: po.lines, refQty };
}

export function PoCompare({ po, gr, lines }: { po: PurchaseOrder; gr?: GoodsReceipt; lines: Line[] }) {
  const { ref, refQty } = poRefLines(po, gr);
  const c = compareWithPO(ref, lines, { refQty });
  return (
    <div className="overflow-x-auto rounded-[10px] border border-line">
      <table className="w-full min-w-[640px] text-left text-[13px]">
        <thead>
          <tr className="text-ink-3">
            <th className="px-3 py-2 font-normal">รายการใน {po.id}</th>
            <th className="py-2 pr-3 text-right font-normal">{gr ? `รับตาม ${gr.id}` : "สั่ง"}</th>
            <th className="py-2 pr-3 text-right font-normal">ราคา PO</th>
            <th className="py-2 pr-3 text-right font-normal">ในบิล</th>
            <th className="py-2 pr-3 text-right font-normal">ราคาบิล</th>
            <th className="py-2 pr-3 font-normal">ผลเทียบ</th>
          </tr>
        </thead>
        <tbody>
          {c.lines.map((d) => (
            <tr key={d.ref} className="border-t border-line">
              <td className="px-3 py-1.5">{ref[d.ref].description}</td>
              <td className="num py-1.5 pr-3 text-right font-mono">
                {d.qtyRef.toLocaleString("th-TH")} {ref[d.ref].unit}
              </td>
              <td className="num py-1.5 pr-3 text-right font-mono">{fmt(d.priceRef)}</td>
              <td className="num py-1.5 pr-3 text-right font-mono">{d.found >= 0 ? d.qty.toLocaleString("th-TH") : "–"}</td>
              <td className="num py-1.5 pr-3 text-right font-mono">{d.found >= 0 ? fmt(d.price) : "–"}</td>
              <td className={cx("py-1.5 pr-3", d.issue ? "text-warn" : "text-pos")}>{d.issue ?? "ตรงกัน"}</td>
            </tr>
          ))}
          {c.extra.map((j) => (
            <tr key={`x${j}`} className="border-t border-line">
              <td className="px-3 py-1.5 text-ink-2" colSpan={3}>
                {lines[j].description}
              </td>
              <td className="num py-1.5 pr-3 text-right font-mono">{lines[j].qty.toLocaleString("th-TH")}</td>
              <td className="num py-1.5 pr-3 text-right font-mono">{fmt(lines[j].unitPrice)}</td>
              <td className="py-1.5 pr-3 text-warn">ไม่มีใน PO</td>
            </tr>
          ))}
          <tr className="border-t border-line-strong">
            <td className="px-3 py-1.5 font-medium" colSpan={3}>
              มูลค่าก่อน VAT · {gr ? "ตามที่รับ" : "ตาม PO"} {fmt(c.refTotal)}
            </td>
            <td className="py-1.5 pr-3 text-right font-mono" colSpan={2}>
              บิล {fmt(c.billTotal)}
            </td>
            <td className={cx("py-1.5 pr-3", Math.abs(c.diff) <= 1 ? "text-pos" : "text-neg")}>{Math.abs(c.diff) <= 1 ? "ยอดตรงกัน" : `ต่าง ${c.diff > 0 ? "+" : ""}${fmt(c.diff)}`}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function newSupplierFrom(x: InvoiceX): Supplier {
  const tax = normTaxId(x.vendorTaxId);
  return {
    id: "",
    name: x.vendorName.trim(),
    taxId: tax,
    branch: x.vendorBranch.trim() || "สำนักงานใหญ่",
    juristic: tax.startsWith("0"),
    vatRegistered: x.vat > 0 || x.vatRate > 0,
    address: x.vendorAddress.trim(),
    contact: "",
    phone: x.vendorPhone.trim(),
    categories: [],
    paymentTerms: x.creditDays || 30,
    whtRate: WHT_RATES.includes(x.whtRate) ? x.whtRate : 0,
    bank: { bank: "กสิกรไทย", account: "", name: "" },
    rating: { quality: 4, onTime: 4, price: 4 },
    status: "active",
    since: TODAY,
    note: "เพิ่มจากใบกำกับภาษีที่ AI อ่าน",
  };
}

function BillReview({ x, refs, onClose }: { x: InvoiceX; refs: MediaRef[]; onClose: () => void }) {
  const sups = suppliers.use();
  const pos = purchaseOrders.use();
  const grs = goodsReceipts.use();
  const bills = supplierBills.use();

  // initial matches (computed once from the extraction)
  const [init] = useState(() => {
    const m = matchSupplier(suppliers.all(), { taxId: x.vendorTaxId, name: x.vendorName, branch: x.vendorBranch });
    const allPos = purchaseOrders.all();
    const scoped = m ? allPos.filter((p) => p.supplierId === m.supplier.id) : allPos;
    const poId = matchPoNumber(x.poNumber, scoped.map((p) => p.id)) ?? matchPoNumber(x.poNumber, allPos.map((p) => p.id));
    const po = allPos.find((p) => p.id === poId);
    const supplier = m?.supplier ?? (po ? suppliers.get(po.supplierId) : undefined);
    return { m, poId: po?.id ?? "", supplier, poBySupplier: !m && !!po };
  });
  const [supplierId, setSupplierId] = useState(init.supplier?.id ?? "");
  const [creating, setCreating] = useState(false);
  const s = sups.find((v) => v.id === supplierId);
  const [d, setD] = useState(() => billDraft(x, { today: TODAY, supplier: init.supplier }));
  const [poId, setPoId] = useState(init.poId);
  const po = pos.find((p) => p.id === poId);
  const unbilled = po ? grs.filter((g) => g.poId === po.id && !billOfGR(bills, g.id)) : [];
  const [grId, setGrId] = useState(() => {
    const p = purchaseOrders.get(init.poId);
    if (!p) return "";
    const open = goodsReceipts.all().filter((g) => g.poId === p.id && !billOfGR(supplierBills.all(), g.id));
    const value = (g: GoodsReceipt) => r2(g.lines.reduce((t, l) => t + l.qty * p.lines[l.line].unitPrice, 0));
    return open.find((g) => Math.abs(value(g) - d.subtotal) <= 1)?.id ?? (open.length === 1 ? open[0].id : "");
  });
  const gr = unbilled.find((g) => g.id === grId);
  const [projectId, setProjectId] = useState("");
  const [costCode, setCostCode] = useState<CostCode>("03");
  const [tried, setTried] = useState(false);
  const [saved, setSaved] = useState("");
  const ai = {
    supplier: !!init.supplier && supplierId === init.supplier.id,
    invoiceNo: !!x.docNo && d.invoiceNo === x.docNo.trim(),
    po: !!init.poId && poId === init.poId,
  };

  const subtotal = r2(d.lines.reduce((t, l) => t + l.qty * l.unitPrice, 0));
  const setLine = (i: number, patch: Partial<Line>) => setD((v) => ({ ...v, lines: v.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));
  const pickSupplier = (id: string) => {
    setSupplierId(id);
    const ns = suppliers.get(id);
    if (!ns) return;
    setD((v) => ({ ...v, dueDate: x.dueDate || x.creditDays ? v.dueDate : addDays(v.date, ns.paymentTerms), whtRate: x.whtRate ? v.whtRate : ns.whtRate }));
    if (po && po.supplierId !== id) setPoId("");
  };
  // open POs, recently received ones that may still be billed, and the one the document names
  const supplierPos = pos.filter((p) => p.supplierId === supplierId && (isOpenPO(p) || (p.status === "received" && p.date >= addDays(TODAY, -120)) || p.id === poId));

  const issues: Issue[] = [...checkAmounts(x)];
  if (normTaxId(x.vendorTaxId) && !taxIdChecksumOk(x.vendorTaxId)) issues.push({ field: "supplier", tone: "warn", msg: `เลขผู้เสียภาษีที่อ่านได้ ${normTaxId(x.vendorTaxId)} ไม่ผ่านการตรวจหลักสุดท้าย อาจอ่านผิด` });
  if (x.vendorTaxId && s && normTaxId(x.vendorTaxId) && normTaxId(x.vendorTaxId) !== s.taxId) issues.push({ field: "supplier", tone: "neg", msg: `เลขผู้เสียภาษีในเอกสาร ${normTaxId(x.vendorTaxId)} ไม่ตรงกับผู้ขายที่เลือก (${s.taxId})` });
  if (init.poBySupplier && s) issues.push({ field: "supplier", tone: "warn", msg: `ไม่พบผู้ขายจากชื่อ/เลขภาษี เลือก ${s.name} ตามผู้ขายของ ${init.poId}` });
  if (s && s.status !== "active") issues.push({ field: "supplier", tone: "warn", msg: `ผู้ขายนี้สถานะ "${s.status === "hold" ? "ระงับชั่วคราว" : "เลิกใช้"}"` });
  if (s && !s.vatRegistered && d.vat > 0) issues.push({ field: "vat", tone: "warn", msg: "ผู้ขายในทะเบียนไม่ได้จด VAT แต่เอกสารมี VAT" });
  const dup = bills.find((b) => b.supplierId === supplierId && d.invoiceNo && asProcBill(b).invoiceNo?.trim() === d.invoiceNo.trim());
  if (dup) issues.push({ field: "invoiceNo", tone: "neg", msg: `เลขที่ ${d.invoiceNo} ของผู้ขายนี้บันทึกแล้วเป็น ${dup.id}` });
  if (x.poNumber && !init.poId) issues.push({ field: "po", tone: "warn", msg: `เอกสารอ้าง PO "${x.poNumber}" แต่ไม่พบในระบบ` });
  if (po && po.kind === "goods" && !gr && !unbilled.length) issues.push({ field: "po", tone: "warn", msg: `${po.id} ยังไม่มีการรับสินค้าที่รอวางบิล ตรวจสอบว่ารับของแล้วหรือยัง` });
  if (d.vat && Math.abs(d.vat - r2((subtotal * VAT_RATE) / 100)) > 1) issues.push({ field: "vat", tone: "warn", msg: `VAT ${fmt(d.vat)} ไม่เท่ากับ 7% ของยอดก่อน VAT (${fmt(r2((subtotal * VAT_RATE) / 100))})` });

  const err = !supplierId ? "เลือกหรือเพิ่มผู้ขาย" : !d.date ? "ใส่วันที่" : !d.lines.length || d.lines.some((l) => !l.description.trim() || !(l.qty > 0)) ? "ตรวจรายการให้ครบ" : subtotal <= 0 ? "ยอดก่อน VAT ต้องมากกว่า 0" : dup ? "เลขที่ใบกำกับซ้ำ" : "";

  const save = () => {
    setTried(true);
    if (err || !s) return;
    const bill: AiBill = {
      id: supplierBills.nextId(`BILL-${d.date.slice(0, 4)}-`),
      supplierId: s.id,
      supplierName: s.name,
      supplierTaxId: s.taxId,
      poId: po?.id,
      grId: gr?.id,
      invoiceNo: d.invoiceNo.trim() || undefined,
      projectId: po ? po.projectId : projectId || undefined,
      costCode: po ? po.costCode : costCode,
      date: d.date,
      dueDate: d.dueDate,
      subtotal,
      vat: r2(d.vat),
      whtRate: d.whtRate,
      status: "open",
      lines: d.lines.map((l) => ({ ...l, description: l.description.trim() })),
      docs: refs,
      aiRead: { at: TODAY, confidence: x.confidence },
    };
    supplierBills.upsert(bill);
    setSaved(bill.id);
  };

  if (saved)
    return (
      <Modal open onClose={onClose} width={480} title="บันทึกใบแจ้งหนี้แล้ว" footer={<Btn primary onClick={onClose}>ปิด</Btn>}>
        <p className="text-[14px]">
          บันทึกเป็น <span className="font-mono">{saved}</span> สถานะรออนุมัติจ่าย พร้อมแนบไฟล์ต้นฉบับ
        </p>
        <p className="mt-2 text-[13px] text-ink-3">
          ฝ่ายบัญชีเห็นรายการนี้ในหน้า{" "}
          <Link className="text-accent-text hover:underline" href="/accounting/purchases">
            บัญชี · ซื้อ/เจ้าหนี้
          </Link>
        </p>
      </Modal>
    );

  const sel = cx(inputCls, "w-full");
  const num = cx(inputCls, "w-full text-right font-mono");
  return (
    <Modal
      open
      onClose={onClose}
      width={1000}
      title={`ใบแจ้งหนี้จากเอกสาร · ${DOC_KIND_LABEL[x.docKind] ?? "เอกสาร"}`}
      footer={
        <>
          {tried && err && <span className="mr-auto text-[13px] text-neg">{err}</span>}
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary onClick={save}>
            บันทึกใบแจ้งหนี้
          </Btn>
        </>
      }
    >
      <AiBanner confidence={x.confidence} refs={refs} note={x.note || (x.uncertain.length ? `อ่านไม่ชัด: ${x.uncertain.join(", ")}` : undefined)} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <AiField label="ผู้ขาย" ai={ai.supplier}>
          <div className="flex gap-2">
            <select value={supplierId} onChange={(e) => pickSupplier(e.target.value)} className={cx(sel, tried && !supplierId && "border-neg")}>
              <option value="">— เลือกผู้ขาย —</option>
              {[...sups]
                .sort((a, b) => nameSimilarity(b.name, x.vendorName) - nameSimilarity(a.name, x.vendorName))
                .map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} · {v.branch}
                  </option>
                ))}
            </select>
            <Btn small onClick={() => setCreating(true)} title="เพิ่มผู้ขายใหม่จากข้อมูลในเอกสาร">
              <Plus {...I} />
              ใหม่
            </Btn>
          </div>
          <span className="text-[12px] text-ink-3">
            ในเอกสาร: {x.vendorName || "–"} · <span className="font-mono">{normTaxId(x.vendorTaxId) || "ไม่มีเลขผู้เสียภาษี"}</span>
            {x.vendorBranch && ` · ${x.vendorBranch}`}
            {init.m && ` · จับคู่จาก${init.m.by === "taxId" ? "เลขผู้เสียภาษี" : `ชื่อ (${Math.round(init.m.score * 100)}%)`}`}
            {!init.supplier && " · ไม่พบในทะเบียนผู้ขาย"}
          </span>
        </AiField>
        <div className="grid grid-cols-3 gap-3">
          <AiField label="เลขที่ใบกำกับ" ai={ai.invoiceNo}>
            <input value={d.invoiceNo} onChange={(e) => setD({ ...d, invoiceNo: e.target.value })} className={cx(inputCls, "font-mono", dup && "border-neg")} />
          </AiField>
          <AiField label="วันที่" ai={!!x.date && d.date === x.date}>
            <input type="date" value={d.date} max={TODAY} onChange={(e) => setD({ ...d, date: e.target.value })} className={cx(inputCls, "font-mono")} />
          </AiField>
          <AiField label="ครบกำหนด" ai={!!(x.dueDate || x.creditDays)}>
            <input type="date" value={d.dueDate} min={d.date} onChange={(e) => setD({ ...d, dueDate: e.target.value })} className={cx(inputCls, "font-mono")} />
          </AiField>
        </div>
        <AiField label="อ้างอิงใบสั่งซื้อ (PO)" ai={ai.po}>
          <select
            value={poId}
            onChange={(e) => {
              setPoId(e.target.value);
              setGrId("");
            }}
            className={sel}
            disabled={!supplierId}
          >
            <option value="">ไม่มี PO (ค่าใช้จ่าย/งวดงานโดยตรง)</option>
            {supplierPos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} · {p.projectId ?? "คลังกลาง"} · {thDate(p.date)}
              </option>
            ))}
          </select>
          {x.poNumber && <span className="text-[12px] text-ink-3">ในเอกสาร: {x.poNumber}</span>}
        </AiField>
        {po ? (
          <AiField label="ตรงกับการรับสินค้า (GR)">
            <select value={grId} onChange={(e) => setGrId(e.target.value)} className={sel}>
              <option value="">ไม่ผูกกับใบรับสินค้า</option>
              {unbilled.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.id} · {thDate(g.date)} · {g.receiver}
                </option>
              ))}
            </select>
            <span className="text-[12px] text-ink-3">
              โครงการ {po.projectId ?? "คลังกลาง"} · รหัสต้นทุน {po.costCode} ตาม PO{po.kind === "goods" ? " · ต้นทุนวัสดุลงไว้ตอนรับของ" : ""}
            </span>
          </AiField>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <AiField label="โครงการ">
              <ProjectSelect value={projectId} onChange={setProjectId} warehouse />
            </AiField>
            <AiField label="รหัสต้นทุน">
              <CodeSelect value={costCode} onChange={setCostCode} />
            </AiField>
          </div>
        )}
      </div>

      <div className="mt-4 overflow-x-auto rounded-[10px] border border-line">
        <table className="w-full min-w-[720px] text-left text-[13px]">
          <thead>
            <tr className="text-ink-3">
              <th className="px-3 py-2 font-normal">
                รายการ
                <AiPill />
              </th>
              <th className="w-[100px] py-2 pr-3 text-right font-normal">จำนวน</th>
              <th className="w-[90px] py-2 pr-3 font-normal">หน่วย</th>
              <th className="w-[130px] py-2 pr-3 text-right font-normal">ราคา/หน่วย (ก่อน VAT)</th>
              <th className="w-[120px] py-2 pr-3 text-right font-normal">จำนวนเงิน</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {d.lines.map((l, i) => (
              <tr key={i} className="border-t border-line">
                <td className="px-3 py-1.5">
                  <input value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} className={cx(sel, tried && !l.description.trim() && "border-neg")} aria-label="รายการ" />
                </td>
                <td className="py-1.5 pr-3">
                  <input type="number" value={l.qty} onChange={(e) => setLine(i, { qty: Number(e.target.value) })} className={num} aria-label="จำนวน" />
                </td>
                <td className="py-1.5 pr-3">
                  <input value={l.unit} onChange={(e) => setLine(i, { unit: e.target.value })} className={sel} aria-label="หน่วย" />
                </td>
                <td className="py-1.5 pr-3">
                  <input type="number" value={l.unitPrice} onChange={(e) => setLine(i, { unitPrice: Number(e.target.value) })} className={num} aria-label="ราคาต่อหน่วย" />
                </td>
                <td className="num py-1.5 pr-3 text-right font-mono">{fmt(r2(l.qty * l.unitPrice))}</td>
                <td className="py-1.5 pr-2">
                  <IconBtn label="ลบรายการ" danger onClick={() => setD({ ...d, lines: d.lines.filter((_, j) => j !== i) })}>
                    <Trash2 {...I} />
                  </IconBtn>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-line px-3 py-2">
          <Btn small onClick={() => setD({ ...d, lines: [...d.lines, { description: "", qty: 1, unit: "", unitPrice: 0 }] })}>
            <Plus {...I} />
            เพิ่มรายการ
          </Btn>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-3">
          {po && <PoCompare po={po} gr={gr} lines={d.lines} />}
          <IssueList issues={issues} />
        </div>
        <div className="rounded-[12px] border border-line bg-raised/50 px-4 py-3 text-[13px]">
          <div className="flex justify-between py-1">
            <span className="text-ink-2">ก่อน VAT</span>
            <span className="num font-mono">{fmt(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between gap-2 py-1">
            <span className="text-ink-2">
              VAT
              <AiPill show={x.vat > 0} />
            </span>
            <span className="flex items-center gap-1">
              <button type="button" className="text-[12px] text-accent-text hover:underline" onClick={() => setD({ ...d, vat: r2((subtotal * VAT_RATE) / 100) })}>
                7%
              </button>
              <button type="button" className="text-[12px] text-ink-3 hover:underline" onClick={() => setD({ ...d, vat: 0 })}>
                0
              </button>
              <input type="number" value={d.vat} onChange={(e) => setD({ ...d, vat: Number(e.target.value) })} className={cx(inputCls, "h-8 w-28 text-right font-mono")} aria-label="VAT" />
            </span>
          </div>
          <div className="flex justify-between border-t border-line py-1 font-medium">
            <span>รวม</span>
            <span className="num font-mono">{fmt(r2(subtotal + d.vat))}</span>
          </div>
          {x.total > 0 && Math.abs(r2(subtotal + d.vat) - x.total) > 1 && <p className="text-[12px] text-neg">ยอดในเอกสาร {fmt(x.total)}</p>}
          <div className="flex items-center justify-between gap-2 py-1">
            <span className="text-ink-2">
              หัก ณ ที่จ่าย
              <AiPill show={x.whtRate > 0} />
            </span>
            <select value={d.whtRate} onChange={(e) => setD({ ...d, whtRate: Number(e.target.value) })} className={cx(inputCls, "h-8 w-24")}>
              {WHT_RATES.map((r) => (
                <option key={r} value={r}>
                  {r ? `${r}%` : "ไม่หัก"}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-between border-t border-line-strong pt-2 font-medium">
            <span>จ่ายสุทธิ</span>
            <span className="num font-mono">{fmt(r2(subtotal + d.vat - (subtotal * d.whtRate) / 100))}</span>
          </div>
          {s && <p className="mt-2 text-[12px] text-ink-3">ทะเบียนผู้ขาย: {s.vatRegistered ? "จด VAT" : "ไม่จด VAT"} · หัก {s.whtRate}% · เครดิต {s.paymentTerms} วัน</p>}
          <p className="mt-1">
            <Pill>สถานะเมื่อบันทึก: รออนุมัติจ่าย</Pill>
          </p>
        </div>
      </div>

      {creating && (
        <SupplierForm
          initial={newSupplierFrom(x)}
          onClose={() => setCreating(false)}
          onSaved={(ns) => {
            setCreating(false);
            pickSupplier(ns.id);
          }}
        />
      )}
    </Modal>
  );
}
