"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { cx, Field, inputCls } from "@/components/ui";
import { areaCls, Btn, I, IconBtn, Modal } from "@/components/ops/bits";
import { COST_CODES, type CostCode } from "@/lib/biz";
import { TODAY } from "@/lib/data";
import { addDays, createClaim, isActiveProject, isSubCategory, newPR, stockItems, suppliers, type PRLine, type PurchaseRequest } from "@/lib/procurement";
import { useProcPerms, useProjects } from "./bits";

const CODES = Object.keys(COST_CODES) as CostCode[];

export function ProjectSelect({ value, onChange, warehouse, all }: { value: string; onChange: (v: string) => void; warehouse?: boolean; all?: boolean }) {
  const list = useProjects().filter((p) => all || isActiveProject(p) || p.status === "planning");
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
      {warehouse && <option value="">คลังกลาง (เติมสต็อก)</option>}
      {!warehouse && <option value="">เลือกโครงการ</option>}
      {list.map((p) => (
        <option key={p.id} value={p.id}>
          {p.id} · {p.name}
        </option>
      ))}
    </select>
  );
}

export function CodeSelect({ value, onChange }: { value: CostCode; onChange: (v: CostCode) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as CostCode)} className={inputCls}>
      {CODES.map((c) => (
        <option key={c} value={c}>
          {c} · {COST_CODES[c]}
        </option>
      ))}
    </select>
  );
}

const blankLine = (): PRLine => ({ itemId: "", description: "", qty: 1, unit: "", neededBy: addDays(TODAY, 7) });

export function PRForm({ onClose, onSaved, preset }: { onClose: () => void; onSaved: (pr: PurchaseRequest) => void; preset?: { projectId?: string; costCode?: CostCode } }) {
  const { me } = useProcPerms();
  const items = stockItems.use();
  const [projectId, setProjectId] = useState(preset?.projectId ?? "");
  const [costCode, setCostCode] = useState<CostCode>(preset?.costCode ?? "03");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<PRLine[]>([blankLine()]);
  const [tried, setTried] = useState(false);
  const byCode = useMemo(() => [...items].sort((a, b) => (a.costCode === costCode ? -1 : 0) - (b.costCode === costCode ? -1 : 0) || a.costCode.localeCompare(b.costCode)), [items, costCode]);

  const setLine = (i: number, patch: Partial<PRLine>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const valid = lines.every((l) => l.description.trim() && l.qty > 0 && l.unit.trim() && l.neededBy);

  const save = () => {
    setTried(true);
    if (!valid) return;
    const pr = newPR({ projectId: projectId || undefined, costCode, date: TODAY, requestedBy: me.name, lines: lines.map((l) => ({ ...l, itemId: l.itemId || undefined, description: l.description.trim() })), note: note || undefined });
    onSaved(pr);
  };

  return (
    <Modal
      open
      onClose={onClose}
      width={920}
      title="สร้างใบขอซื้อ (PR)"
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary onClick={save}>
            ส่งใบขอซื้อ
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-3 gap-4">
        <Field label="ส่งที่ / โครงการ">
          <ProjectSelect value={projectId} onChange={setProjectId} warehouse />
        </Field>
        <Field label="รหัสต้นทุน">
          <CodeSelect value={costCode} onChange={setCostCode} />
        </Field>
        <Field label="ผู้ขอ">
          <input value={me.name} readOnly className={cx(inputCls, "bg-raised/50")} />
        </Field>
      </div>

      <div className="mt-5 overflow-x-auto rounded-[10px] border border-line">
        <table className="w-full min-w-[760px] text-left text-[13px]">
          <thead>
            <tr className="text-ink-3">
              <th className="px-3 py-2 font-normal">รายการ</th>
              <th className="w-[96px] py-2 pr-3 text-right font-normal">จำนวน</th>
              <th className="w-[90px] py-2 pr-3 font-normal">หน่วย</th>
              <th className="w-[150px] py-2 pr-3 font-normal">ต้องการใช้</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-t border-line align-top">
                <td className="px-3 py-2">
                  <select
                    value={l.itemId}
                    onChange={(e) => {
                      const it = items.find((x) => x.id === e.target.value);
                      setLine(i, it ? { itemId: it.id, description: it.name, unit: it.unit } : { itemId: "" });
                    }}
                    className={cx(inputCls, "w-full")}
                    aria-label="รายการจากทะเบียนวัสดุ"
                  >
                    <option value="">ระบุเอง (ไม่อยู่ในทะเบียนวัสดุ)</option>
                    {byCode.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.costCode} · {it.id} · {it.name}
                      </option>
                    ))}
                  </select>
                  {!l.itemId && <input value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} placeholder="รายละเอียดสินค้า/งาน" className={cx(inputCls, "mt-1.5 w-full", tried && !l.description.trim() && "border-neg")} />}
                </td>
                <td className="py-2 pr-3">
                  <input type="number" min={0} value={l.qty} onChange={(e) => setLine(i, { qty: Number(e.target.value) })} className={cx(inputCls, "w-full text-right font-mono", tried && !(l.qty > 0) && "border-neg")} />
                </td>
                <td className="py-2 pr-3">
                  <input value={l.unit} onChange={(e) => setLine(i, { unit: e.target.value })} className={cx(inputCls, "w-full", tried && !l.unit.trim() && "border-neg")} />
                </td>
                <td className="py-2 pr-3">
                  <input type="date" value={l.neededBy} min={TODAY} onChange={(e) => setLine(i, { neededBy: e.target.value })} className={cx(inputCls, "w-full font-mono")} />
                </td>
                <td className="py-2 pr-2">
                  <IconBtn label="ลบรายการ" danger onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((_, j) => j !== i) : ls))}>
                    <Trash2 {...I} />
                  </IconBtn>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-line px-3 py-2">
          <Btn small onClick={() => setLines((ls) => [...ls, { ...blankLine(), neededBy: ls[ls.length - 1]?.neededBy ?? addDays(TODAY, 7) }])}>
            <Plus {...I} />
            เพิ่มรายการ
          </Btn>
        </div>
      </div>
      <div className="mt-4">
        <Field label="หมายเหตุ / วัตถุประสงค์">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} className={cx(areaCls, "min-h-[56px]")} placeholder="เช่น ใช้เทพื้นชั้น 2 ตามแผนสัปดาห์หน้า" />
        </Field>
      </div>
    </Modal>
  );
}

/** Subcontractor progress claim without a PO */
export function ClaimForm({ onClose }: { onClose: () => void }) {
  const list = suppliers.use().filter((s) => s.status === "active" && s.categories.some(isSubCategory));
  const [supplierId, setSupplierId] = useState(list[0]?.id ?? "");
  const [projectId, setProjectId] = useState("");
  const [costCode, setCostCode] = useState<CostCode>("03");
  const [date, setDate] = useState(TODAY);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(0);
  const [invoiceNo, setInvoiceNo] = useState("");
  const ok = supplierId && projectId && description.trim() && amount > 0;
  const s = list.find((x) => x.id === supplierId);
  return (
    <Modal
      open
      onClose={onClose}
      width={640}
      title="บันทึกงวดงานผู้รับเหมาช่วง"
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn
            primary
            disabled={!ok}
            onClick={() => {
              createClaim({ supplierId, projectId, costCode, date, description: description.trim(), amount, invoiceNo: invoiceNo || undefined });
              onClose();
            }}
          >
            บันทึกใบแจ้งหนี้
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Field label="ผู้รับเหมาช่วง">
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={inputCls}>
              {list.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="โครงการ">
          <ProjectSelect value={projectId} onChange={setProjectId} />
        </Field>
        <Field label="รหัสต้นทุน">
          <CodeSelect value={costCode} onChange={setCostCode} />
        </Field>
        <div className="col-span-2">
          <Field label="รายละเอียดงวดงาน">
            <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} placeholder="ค่าจ้างงานโครงสร้างชั้น 2 งวดที่ 3 ตามผลงาน" />
          </Field>
        </div>
        <Field label="มูลค่างาน (ก่อน VAT)">
          <input type="number" min={0} value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} className={cx(inputCls, "text-right font-mono")} />
        </Field>
        <Field label="วันที่ใบแจ้งหนี้">
          <input type="date" value={date} max={TODAY} onChange={(e) => setDate(e.target.value)} className={cx(inputCls, "font-mono")} />
        </Field>
        <Field label="เลขที่ใบแจ้งหนี้ผู้ขาย">
          <input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} className={cx(inputCls, "font-mono")} />
        </Field>
        {s && (
          <p className="self-end pb-2 text-[13px] text-ink-3">
            {s.vatRegistered ? "VAT 7%" : "ไม่มี VAT"} · หัก ณ ที่จ่าย {s.whtRate}% · เครดิต {s.paymentTerms} วัน
          </p>
        )}
      </div>
    </Modal>
  );
}
