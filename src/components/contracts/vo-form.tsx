"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { cx, inputCls } from "@/components/ui";
import { MediaField } from "@/components/media/media-field";
import { COST_CODES, type CostCode } from "@/lib/biz";
import { TODAY } from "@/lib/data";
import { fmt, r2 } from "@/lib/accounting/money";
import { lineAmount, lineCost, nextVoNo, ORIGIN_LABEL, useAllProjects, voCol, voTotals, type VariationX, type VoLine, type VoOrigin } from "@/lib/contracts";
import { useMe } from "@/lib/use-me";
import { areaCls, Btn, COST_CODE_OPTIONS, I, IconBtn, Labeled, Modal, numInput } from "./bits";
import { AiButton } from "@/components/ai-sales/bits";
import { AiVoHelper } from "@/components/ai-sales/variation-helper";

const blank = (): VoLine => ({ description: "", qty: 1, unit: "งาน", unitPrice: 0, unitCost: 0, costCode: "90" });

/** Create or edit a variation (draft / priced). */
export function VoForm({ initial, projectId, onClose, onSaved }: { initial?: VariationX; projectId?: string; onClose: () => void; onSaved?: (v: VariationX) => void }) {
  const me = useMe();
  const projects = useAllProjects().filter((p) => p.status !== "planning" || p.id === initial?.projectId);
  const [pid, setPid] = useState(initial?.projectId ?? projectId ?? projects.find((p) => p.status === "building")?.id ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [reason, setReason] = useState(initial?.reason ?? "");
  const [origin, setOrigin] = useState<VoOrigin>(initial?.origin ?? "client");
  const [days, setDays] = useState(String(initial?.days ?? 0));
  const [rfiId, setRfiId] = useState(initial?.rfiId ?? "");
  const [lines, setLines] = useState<VoLine[]>(initial?.lines.length ? initial.lines : [blank()]);
  const [attachments, setAttachments] = useState(initial?.attachments ?? []);
  const [aiOpen, setAiOpen] = useState(false);
  const t = voTotals(lines);
  const err = !pid ? "เลือกโครงการ" : !title.trim() ? "กรอกชื่องานเปลี่ยนแปลง" : !lines.some((l) => l.description.trim() && l.qty) ? "เพิ่มรายการอย่างน้อย 1 รายการ" : "";
  const set = (i: number, patch: Partial<VoLine>) => setLines(lines.map((l, k) => (k === i ? { ...l, ...patch } : l)));

  const save = (status: "draft" | "priced") => {
    if (err) return;
    const clean = lines.filter((l) => l.description.trim() && l.qty).map((l) => ({ ...l, description: l.description.trim(), qty: Number(l.qty) || 0, unitPrice: Number(l.unitPrice) || 0, unitCost: Number(l.unitCost) || 0 }));
    const tt = voTotals(clean);
    const no = initial && initial.projectId === pid ? initial.no : nextVoNo(pid);
    const vo: VariationX = {
      ...(initial ?? {}),
      id: initial && initial.projectId === pid ? initial.id : `VO-${pid}-${no}`,
      projectId: pid,
      no,
      title: title.trim(),
      reason: reason.trim(),
      origin,
      rfiId: rfiId.trim() || undefined,
      lines: clean,
      amount: tt.amount,
      cost: tt.cost,
      days: Math.max(0, Math.round(Number(days) || 0)),
      status,
      raisedBy: initial?.raisedBy ?? me.name,
      raisedAt: initial?.raisedAt ?? TODAY,
      attachments,
    };
    if (initial && initial.id !== vo.id) voCol.remove(initial.id);
    voCol.upsert(vo);
    onSaved?.(vo);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? `แก้ไข ${initial.id}` : "สร้างงานเปลี่ยนแปลง (VO)"}
      width={960}
      footer={
        <>
          {err && <span className="mr-auto text-[13px] text-neg">{err}</span>}
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn disabled={!!err} onClick={() => save("draft")}>
            บันทึกร่าง
          </Btn>
          <Btn primary disabled={!!err} onClick={() => save("priced")}>
            บันทึกพร้อมราคา
          </Btn>
        </>
      }
    >
      {aiOpen ? (
        <AiVoHelper
          project={projects.find((p) => p.id === pid)}
          initialText={[title, reason].filter(Boolean).join(" · ")}
          onClose={() => setAiOpen(false)}
          onApply={(a) => {
            const keep = lines.filter((l) => l.description.trim());
            const add: VoLine[] = a.lines.map((l) => ({ ...l, costCode: l.costCode as CostCode }));
            setLines(a.mode === "append" ? [...keep, ...add] : add);
            if (!title.trim() && a.title) setTitle(a.title);
            if (!reason.trim() && a.reason) setReason(a.reason);
            setDays(String(a.days));
            setAiOpen(false);
          }}
        />
      ) : (
        <div className="mb-3 flex justify-end">
          <AiButton onClick={() => setAiOpen(true)} disabled={!pid}>
            ให้ AI ช่วยตั้งราคา
          </AiButton>
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Labeled label="โครงการ" className="sm:col-span-2">
          <select className={inputCls} value={pid} onChange={(e) => setPid(e.target.value)} disabled={!!initial && initial.status !== "draft" && initial.status !== "priced"}>
            <option value="">เลือกโครงการ</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} {p.name}
              </option>
            ))}
          </select>
        </Labeled>
        <Labeled label="ที่มา">
          <select className={inputCls} value={origin} onChange={(e) => setOrigin(e.target.value as VoOrigin)}>
            {Object.entries(ORIGIN_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Labeled>
        <Labeled label="ขยายเวลา (วัน)">
          <input className={numInput} inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
        </Labeled>
        <Labeled label="ชื่องานเปลี่ยนแปลง" className="sm:col-span-3">
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น เพิ่มหลังคากันสาดที่จอดรถ" />
        </Labeled>
        <Labeled label={origin === "rfi" ? "อ้างอิง RFI" : origin === "selection" ? "อ้างอิงรายการเลือกวัสดุ" : "เลขอ้างอิง (ถ้ามี)"}>
          <input className={inputCls} value={rfiId} onChange={(e) => setRfiId(e.target.value)} placeholder="RFI-…" />
        </Labeled>
        <Labeled label="เหตุผล / รายละเอียด" className="sm:col-span-4">
          <textarea className={areaCls} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Labeled>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-[13px]">
          <thead>
            <tr className="text-left text-[12px] text-ink-3">
              <th className="py-1.5 font-normal">รายการ (ใส่ปริมาณติดลบสำหรับงานลด)</th>
              <th className="w-20 py-1.5 text-right font-normal">ปริมาณ</th>
              <th className="w-20 py-1.5 pl-2 font-normal">หน่วย</th>
              <th className="w-28 py-1.5 text-right font-normal">ราคาขาย/หน่วย</th>
              <th className="w-28 py-1.5 text-right font-normal">ต้นทุน/หน่วย</th>
              <th className="w-40 py-1.5 pl-2 font-normal">หมวดต้นทุน</th>
              <th className="w-28 py-1.5 text-right font-normal">ราคาขาย</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-t border-line">
                <td className="py-1.5 pr-2">
                  <input className={cx(inputCls, "w-full")} value={l.description} onChange={(e) => set(i, { description: e.target.value })} />
                </td>
                <td className="py-1.5">
                  <input className={cx(numInput, "w-full")} inputMode="decimal" value={String(l.qty)} onChange={(e) => set(i, { qty: e.target.value as unknown as number })} />
                </td>
                <td className="py-1.5 pl-2">
                  <input className={cx(inputCls, "w-full")} value={l.unit} onChange={(e) => set(i, { unit: e.target.value })} />
                </td>
                <td className="py-1.5 pl-2">
                  <input className={cx(numInput, "w-full")} inputMode="decimal" value={String(l.unitPrice)} onChange={(e) => set(i, { unitPrice: e.target.value as unknown as number })} />
                </td>
                <td className="py-1.5 pl-2">
                  <input className={cx(numInput, "w-full")} inputMode="decimal" value={String(l.unitCost)} onChange={(e) => set(i, { unitCost: e.target.value as unknown as number })} />
                </td>
                <td className="py-1.5 pl-2">
                  <select className={cx(inputCls, "w-full")} value={l.costCode ?? "90"} onChange={(e) => set(i, { costCode: e.target.value as CostCode })}>
                    {COST_CODE_OPTIONS(COST_CODES)}
                  </select>
                </td>
                <td className="num py-1.5 text-right font-mono">{fmt(lineAmount({ qty: Number(l.qty) || 0, unitPrice: Number(l.unitPrice) || 0 }))}</td>
                <td className="py-1.5 text-right">
                  <IconBtn label="ลบรายการ" danger onClick={() => setLines(lines.length > 1 ? lines.filter((_, k) => k !== i) : [blank()])}>
                    <Trash2 {...I} />
                  </IconBtn>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <Btn small onClick={() => setLines([...lines, blank()])}>
          <Plus {...I} />
          เพิ่มรายการ
        </Btn>
        <dl className="flex gap-6 text-[13px]">
          <div>
            <dt className="text-ink-3">ราคาขาย (ก่อน VAT)</dt>
            <dd className="num font-mono font-medium">{fmt(t.amount)}</dd>
          </div>
          <div>
            <dt className="text-ink-3">ต้นทุน</dt>
            <dd className="num font-mono">{fmt(lines.reduce((s, l) => s + lineCost({ qty: Number(l.qty) || 0, unitCost: Number(l.unitCost) || 0 }), 0))}</dd>
          </div>
          <div>
            <dt className="text-ink-3">กำไรขั้นต้น</dt>
            <dd className="num font-mono">{t.amount ? `${r2(((t.amount - t.cost) / Math.abs(t.amount)) * 100)}%` : "–"}</dd>
          </div>
        </dl>
      </div>
      <div className="mt-4">
        <MediaField value={attachments} onChange={setAttachments} label="ไฟล์แนบ (แบบ รูปหน้างาน ใบเสนอราคา)" />
      </div>
    </Modal>
  );
}
