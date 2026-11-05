"use client";

// TOR / ประกาศประกวดราคา / BOQ (PDF or photos) → AI → reviewed patch of a tender record:
// Thai summary, key dates, budget & ราคากลาง, bid bond, qualifications, risks/penalties, BOQ lines.
// The user ticks which fields to take; the tender sheet then shows them as unsaved changes.

import { useState } from "react";
import { cx } from "@/components/ui";
import { Btn, Modal, Segmented } from "@/components/ops/bits";
import { thDate } from "@/lib/data";
import type { MediaRef } from "@/lib/media";
import { METHOD_LABEL, SOURCE_LABEL, type BoqLine, type Tender } from "@/lib/tender/types";
import { boqLines, tenderPatch, type TenderPatch, type TenderX } from "@/lib/ai-docs";
import { AiBanner, AiButton, ReadDocDialog } from "./bits";
import { readTender } from "./run";

const baht = (n: number) => `${Math.round(n).toLocaleString("th-TH")} บาท`;

type Row = { key: keyof TenderPatch; label: string; show: (v: unknown) => string };
const ROWS: Row[] = [
  { key: "title", label: "ชื่องาน", show: String },
  { key: "client", label: "ผู้ว่าจ้าง / หน่วยงาน", show: String },
  { key: "province", label: "จังหวัด", show: String },
  { key: "source", label: "ประเภท", show: (v) => SOURCE_LABEL[v as Tender["source"]] ?? String(v) },
  { key: "method", label: "วิธีจัดหา", show: (v) => METHOD_LABEL[v as Tender["method"]] ?? String(v) },
  { key: "egpNo", label: "เลขที่โครงการ e-GP", show: String },
  { key: "budget", label: "วงเงินงบประมาณ", show: (v) => baht(Number(v)) },
  { key: "medianPrice", label: "ราคากลาง", show: (v) => baht(Number(v)) },
  { key: "announced", label: "วันประกาศ", show: (v) => thDate(String(v)) },
  { key: "siteVisit", label: "ดูสถานที่", show: (v) => thDate(String(v)) },
  { key: "questionsDue", label: "ส่งคำถาม", show: (v) => thDate(String(v)) },
  { key: "submitDue", label: "ยื่นซอง", show: (v) => thDate(String(v)) },
  { key: "openDate", label: "เปิดซอง", show: (v) => thDate(String(v)) },
  { key: "bidBondAmount", label: "หลักประกันซอง", show: (v) => baht(Number(v)) },
  { key: "torNote", label: "สรุป TOR / คุณสมบัติ / ความเสี่ยง", show: String },
];

function current(t: Tender | undefined, k: keyof TenderPatch): unknown {
  if (!t) return undefined;
  if (k === "bidBondAmount") return t.bidBond?.amount;
  return t[k as keyof Tender];
}

/** apply the ticked parts of a patch to a tender */
export function applyTenderPatch(t: Tender, p: TenderPatch, keys: (keyof TenderPatch)[], boq: { mode: "skip" | "append" | "replace"; lines: BoqLine[] }): Tender {
  const out: Tender = { ...t };
  for (const k of keys) {
    const v = p[k];
    if (v === undefined) continue;
    if (k === "bidBondAmount") out.bidBond = { ...(t.bidBond ?? { type: "bank" }), amount: Number(v) };
    else if (k === "torNote") out.torNote = t.torNote && !t.torNote.includes(String(v)) ? `${t.torNote}\n\n${v}` : String(v);
    else (out as Record<string, unknown>)[k] = v;
  }
  if (boq.mode === "replace") out.lines = boq.lines;
  if (boq.mode === "append") out.lines = [...t.lines, ...boq.lines];
  return out;
}

export function TenderAiButton({ t, existing, onApply, label = "ให้ AI อ่าน TOR / BOQ" }: { t?: Tender; existing?: MediaRef[]; onApply: (fn: (t: Tender) => Tender, refs: MediaRef[]) => void; label?: string }) {
  const [step, setStep] = useState<null | "read" | { x: TenderX; refs: MediaRef[] }>(null);
  return (
    <>
      <AiButton onClick={() => setStep("read")}>{label}</AiButton>
      {step === "read" && (
        <ReadDocDialog
          title="อ่านเอกสารประกวดราคา"
          hint="เลือก TOR ประกาศ หรือ BOQ (PDF หลายหน้าได้) AI จะสรุปงาน วันสำคัญ วงเงิน ราคากลาง หลักประกันซอง คุณสมบัติ ความเสี่ยง และดึงรายการ BOQ"
          existing={existing}
          run={(files) => readTender(files, t ? `${t.title} · ${t.client}` : undefined)}
          onRead={(x, refs) => setStep({ x, refs })}
          onClose={() => setStep(null)}
        />
      )}
      {step && step !== "read" && (
        <TenderReview
          t={t}
          x={step.x}
          refs={step.refs}
          onClose={() => setStep(null)}
          onApply={(fn) => {
            onApply(fn, step.refs);
            setStep(null);
          }}
        />
      )}
    </>
  );
}

function TenderReview({ t, x, refs, onClose, onApply }: { t?: Tender; x: TenderX; refs: MediaRef[]; onClose: () => void; onApply: (fn: (t: Tender) => Tender) => void }) {
  const patch = tenderPatch(x);
  const rows = ROWS.filter((r) => patch[r.key] !== undefined);
  // take a field by default when the tender has nothing there yet
  const [keys, setKeys] = useState<Set<keyof TenderPatch>>(() => new Set(rows.filter((r) => r.key === "torNote" || !current(t, r.key)).map((r) => r.key)));
  const nextNo = (t?.lines ?? []).reduce((m, l) => Math.max(m, Number(l.id.slice(1)) || 0), 0) + 1;
  const [mode, setMode] = useState<"skip" | "append" | "replace">(x.boq.length ? (t?.lines.length ? "skip" : "replace") : "skip");
  const lines = boqLines(x, mode === "append" ? nextNo : 1);
  const toggle = (k: keyof TenderPatch) => setKeys((s) => (s.has(k) ? new Set([...s].filter((v) => v !== k)) : new Set([...s, k])));
  return (
    <Modal
      open
      onClose={onClose}
      width={880}
      title="ข้อมูลจากเอกสารประกวดราคา"
      footer={
        <>
          <span className="mr-auto text-[13px] text-ink-3">เลือก {keys.size} ช่อง{mode !== "skip" ? ` · BOQ ${lines.length} รายการ` : ""} · ยังไม่บันทึกจนกว่าจะกดบันทึกในหน้างานประมูล</span>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!keys.size && mode === "skip"} onClick={() => onApply((cur) => applyTenderPatch(cur, patch, [...keys], { mode, lines: boqLines(x, mode === "append" ? cur.lines.reduce((m, l) => Math.max(m, Number(l.id.slice(1)) || 0), 0) + 1 : 1) }))}>
            ใช้ข้อมูลที่เลือก
          </Btn>
        </>
      }
    >
      <AiBanner confidence={x.confidence} refs={refs} note={x.uncertain.length ? `อ่านไม่ชัด: ${x.uncertain.join(", ")}` : undefined} />
      {!rows.length && <p className="text-[13px] text-ink-3">ไม่พบข้อมูลงานประมูลในเอกสาร</p>}
      <table className="w-full text-left text-[13px]">
        <tbody>
          {rows.map((r) => {
            const cur = current(t, r.key);
            const v = patch[r.key];
            const same = cur !== undefined && String(cur) === String(v);
            return (
              <tr key={r.key} className="border-t border-line align-top">
                <td className="w-8 py-2">
                  <input type="checkbox" checked={keys.has(r.key)} onChange={() => toggle(r.key)} aria-label={`ใช้ ${r.label}`} />
                </td>
                <td className="w-[180px] py-2 pr-3 text-ink-2">{r.label}</td>
                <td className={cx("py-2 pr-3", r.key === "torNote" && "whitespace-pre-line")}>{r.show(v)}</td>
                <td className="w-[200px] py-2 text-[12px] text-ink-3">{same ? "ตรงกับที่บันทึกไว้" : cur ? `เดิม: ${r.key === "torNote" ? "มีบันทึกแล้ว (จะต่อท้าย)" : r.show(cur)}` : "ยังไม่มีข้อมูล"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {x.boq.length > 0 && (
        <div className="mt-4 rounded-[10px] border border-line">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
            <span className="text-[13px] font-medium">รายการ BOQ ที่อ่านได้ {lines.length} รายการ</span>
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                { key: "skip", label: "ไม่ใช้" },
                { key: "append", label: "ต่อท้าย BOQ เดิม" },
                { key: "replace", label: "แทนที่ BOQ ทั้งหมด" },
              ]}
            />
          </div>
          <div className="max-h-[260px] overflow-y-auto">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="text-ink-3">
                  <th className="px-3 py-1.5 font-normal">หมวด</th>
                  <th className="py-1.5 pr-2 font-normal">รายการ</th>
                  <th className="py-1.5 pr-2 text-right font-normal">ปริมาณ</th>
                  <th className="py-1.5 pr-2 font-normal">หน่วย</th>
                  <th className="py-1.5 pr-2 text-right font-normal">วัสดุ/หน่วย</th>
                  <th className="py-1.5 pr-3 text-right font-normal">ค่าแรง/หน่วย</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id} className="border-t border-line">
                    <td className="px-3 py-1 text-ink-2">{l.group}</td>
                    <td className="py-1 pr-2">{l.description}</td>
                    <td className="num py-1 pr-2 text-right font-mono">{l.qty.toLocaleString("th-TH")}</td>
                    <td className="py-1 pr-2">{l.unit}</td>
                    <td className="num py-1 pr-2 text-right font-mono">{l.material.toLocaleString("th-TH")}</td>
                    <td className="num py-1 pr-3 text-right font-mono">{l.labour.toLocaleString("th-TH")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {lines.some((l) => !l.material && !l.labour) && <p className="border-t border-line px-3 py-1.5 text-[12px] text-ink-3">รายการที่ไม่มีราคาต้องใส่ราคาวัสดุ/ค่าแรงเองในแท็บ BOQ</p>}
        </div>
      )}
    </Modal>
  );
}
