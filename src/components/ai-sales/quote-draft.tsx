"use client";

// Quote draft from a lead + chosen model: option lines (packages / price book), cover letter,
// terms summary and a LINE/email follow-up text. Nothing is saved until the user presses save,
// which goes through the normal createQuote flow.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { cx, Field, inputCls } from "@/components/ui";
import { Btn, IconBtn, Modal, Pill } from "@/components/ops/bits";
import { getHouseModel, houseModels, TODAY } from "@/lib/data";
import { createQuote, estimates, quotes, type Lead, type QuoteLine } from "@/lib/sales/crm";
import { DEFAULT_TERMS, VAT_RATE } from "@/lib/sales/terms";
import { priceItems, usePriceBook } from "@/lib/sales/prices";
import type { CostCode } from "@/lib/biz";
import type { LeadBrief } from "@/lib/ai-sales/lead";
import { noteFrom, priceOptions, QUOTE_DRAFT_SCHEMA, quoteDraftPrompt, SYSTEM_QUOTE, UPGRADE_PACKAGES, type DraftOption, type QuoteDraftAi } from "@/lib/ai-sales/quote";
import { aiJsonBig, AiBusy, AiButton, AiError, AiPill, CopyText, DraftNote, useAiRun } from "./bits";

const n0 = (n: number) => Math.round(n).toLocaleString("th-TH");
const BASIS: Record<DraftOption["basis"], { label: string; tone: "neutral" | "accent" | "warn" }> = {
  package: { label: "ราคาแพ็กเกจ", tone: "neutral" },
  book: { label: "ฐานราคา + markup", tone: "accent" },
  unpriced: { label: "ต้องสืบราคา", tone: "warn" },
};

export function QuoteDraftModal({ lead, modelCode, brief, onClose }: { lead: Lead; modelCode?: string; brief?: LeadBrief; onClose: () => void }) {
  const router = useRouter();
  const allEst = estimates.use();
  const items = priceItems.use();
  const book = usePriceBook("cgd", lead.province);
  const [model, setModel] = useState(modelCode ?? lead.models[0] ?? "HM-17");
  const [markup, setMarkup] = useState(30);
  const ai = useAiRun<QuoteDraftAi>();
  const [opts, setOpts] = useState<(DraftOption & { on: boolean })[]>([]);
  const [cover, setCover] = useState("");
  const [terms, setTerms] = useState("");
  const [follow, setFollow] = useState("");
  const [note, setNote] = useState("");

  const m = getHouseModel(model);
  const est = useMemo(() => allEst.filter((e) => e.leadId === lead.id && e.modelCode === model).sort((a, b) => b.date.localeCompare(a.date))[0], [allEst, lead.id, model]);
  const basePrice = est ? Math.round(est.selling / 1000) * 1000 : m ? Math.round(((m.priceMin + m.priceMax) / 2) * 1e6) : 0;
  const choices = useMemo(() => [...new Set([model, ...lead.models, ...houseModels.filter((x) => x.type !== "condo").map((x) => x.code)])], [model, lead.models]);

  const draft = async () => {
    if (!m) return;
    const r = await ai.start(() =>
      aiJsonBig<QuoteDraftAi>("sales-quote-draft", {
        system: SYSTEM_QUOTE,
        prompt: quoteDraftPrompt({
          customer: { name: lead.name, province: lead.province, budgetMillion: lead.budget || undefined, landSizeWa: lead.landSize, notes: lead.notes, activities: [...lead.activities].slice(-6).map((a) => `${a.date} ${a.text}`) },
          brief,
          model: m,
          basePrice,
          packages: UPGRADE_PACKAGES,
          items,
          terms: DEFAULT_TERMS,
          validDays: 30,
          vatRate: VAT_RATE,
          owner: lead.owner,
          today: TODAY,
        }),
        schema: QUOTE_DRAFT_SCHEMA,
        temperature: 0.4,
      }),
    );
    if (!r) return;
    setOpts(priceOptions(r.options, { packages: UPGRADE_PACKAGES, book, markupPct: markup }).map((o) => ({ ...o, on: true })));
    setCover(r.coverLetter ?? "");
    setTerms(r.termsSummary ?? "");
    setFollow(r.followUp ?? "");
    setNote(noteFrom(r) ?? "");
  };

  const set = (key: string, patch: Partial<DraftOption & { on: boolean }>) => setOpts(opts.map((o) => (o.key === key ? { ...o, ...patch } : o)));
  const chosen = opts.filter((o) => o.on);
  const optTotal = chosen.reduce((s, o) => s + o.qty * o.unitPrice, 0);
  const unpriced = chosen.filter((o) => o.unitPrice <= 0).length;

  const save = () => {
    const q = createQuote({ lead, modelCode: model, estimate: est, owner: lead.owner });
    const options: QuoteLine[] = chosen.map((o, i) => ({ id: `${q.id}-L${i + 1}`, name: o.name, qty: o.qty, unit: o.unit, unitPrice: o.unitPrice, discount: 0, costCode: o.costCode as CostCode }));
    quotes.upsert({ ...q, options, note: note.trim() || undefined });
    onClose();
    router.push(`/quotes/${q.id}`);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`ให้ AI ร่างใบเสนอราคา · ${lead.name}`}
      width={920}
      footer={
        <>
          {ai.data && unpriced > 0 && <span className="mr-auto text-[13px] text-warn">มี {unpriced} รายการต้องสืบราคา (ราคา 0) แก้ได้ในใบเสนอราคา</span>}
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!m || ai.busy || !ai.data} onClick={save}>
            สร้างใบเสนอราคา (ร่าง)
          </Btn>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto] sm:items-end">
          <Field label="แบบบ้าน">
            <select className={inputCls} value={model} onChange={(e) => setModel(e.target.value)}>
              {choices.map((c) => (
                <option key={c} value={c}>
                  {c} · {getHouseModel(c)?.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Markup รายการจากฐานราคา (%)">
            <input type="number" min={0} max={200} className={cx(inputCls, "font-mono")} value={markup} onChange={(e) => setMarkup(Math.max(0, Number(e.target.value) || 0))} />
          </Field>
          <AiButton small={false} onClick={() => void draft()} disabled={ai.busy || !m}>
            {ai.data ? "ร่างใหม่" : "ร่างด้วย AI"}
          </AiButton>
        </div>
        <p className="text-[12px] text-ink-3">
          ราคาฐาน {n0(basePrice)} บาท ก่อน VAT {est ? `จากประมาณการ ${est.id}` : "(ราคาแค็ตตาล็อกกลาง)"} · ราคารายการเสริมมาจากแพ็กเกจของบริษัทหรือฐานราคา AI ไม่ได้กำหนดราคาเอง
        </p>
        {ai.busy && <AiBusy onCancel={ai.cancel} />}
        <AiError text={ai.error} />

        {ai.data && (
          <>
            <section>
              <div className="mb-2 flex items-baseline justify-between">
                <p className="text-[14px] font-medium">รายการเสริม</p>
                <span className="num font-mono text-[13px] text-ink-2">รวม {n0(optTotal)} บาท</span>
              </div>
              {opts.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-[13px]">
                    <thead>
                      <tr className="border-b border-line text-left text-[12px] text-ink-3">
                        <th className="w-8 py-1.5 font-normal" />
                        <th className="py-1.5 font-normal">รายการ</th>
                        <th className="w-20 py-1.5 text-right font-normal">จำนวน</th>
                        <th className="w-20 py-1.5 pl-2 font-normal">หน่วย</th>
                        <th className="w-28 py-1.5 text-right font-normal">ราคา/หน่วย</th>
                        <th className="w-28 py-1.5 text-right font-normal">รวม</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {opts.map((o) => (
                        <tr key={o.key} className={cx("align-top", !o.on && "opacity-50")}>
                          <td className="py-2">
                            <input type="checkbox" checked={o.on} onChange={(e) => set(o.key, { on: e.target.checked })} aria-label="ใส่ในใบเสนอราคา" />
                          </td>
                          <td className="py-2 pr-2">
                            <input className={cx(inputCls, "h-8 w-full")} value={o.name} onChange={(e) => set(o.key, { name: e.target.value })} aria-label="รายการ" />
                            <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-ink-3">
                              <AiPill />
                              <Pill tone={BASIS[o.basis].tone}>{BASIS[o.basis].label}</Pill>
                              {o.code && <span className="font-mono">{o.code}</span>}
                              {o.reason}
                            </span>
                          </td>
                          <td className="py-2">
                            <input type="number" className={cx(inputCls, "h-8 w-full text-right font-mono")} value={o.qty} onChange={(e) => set(o.key, { qty: Math.max(0, Number(e.target.value) || 0) })} aria-label="จำนวน" />
                          </td>
                          <td className="py-2 pl-2">
                            <input className={cx(inputCls, "h-8 w-full")} value={o.unit} onChange={(e) => set(o.key, { unit: e.target.value })} aria-label="หน่วย" />
                          </td>
                          <td className="py-2 pl-2">
                            <input type="number" className={cx(inputCls, "h-8 w-full text-right font-mono", o.unitPrice <= 0 && "border-warn")} value={o.unitPrice} onChange={(e) => set(o.key, { unitPrice: Math.max(0, Number(e.target.value) || 0) })} aria-label="ราคาต่อหน่วย" />
                          </td>
                          <td className="num py-2 text-right font-mono">{n0(o.qty * o.unitPrice)}</td>
                          <td className="py-1">
                            <IconBtn label="ลบรายการ" danger onClick={() => setOpts(opts.filter((x) => x.key !== o.key))}>
                              <Trash2 size={16} strokeWidth={1.5} />
                            </IconBtn>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-[13px] text-ink-3">AI ไม่เสนอรายการเสริม</p>
              )}
            </section>
            <Field label="หมายเหตุที่พิมพ์ในใบเสนอราคา">
              <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="(ไม่บังคับ)" />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <CopyText label="จดหมายนำเสนอราคา" value={cover} onChange={setCover} rows={8} />
              <CopyText label="สรุปเงื่อนไข" value={terms} onChange={setTerms} rows={8} />
            </div>
            <CopyText label="ข้อความติดตามทาง LINE / อีเมล" value={follow} onChange={setFollow} rows={4} />
            <DraftNote>ร่างโดย AI ข้อความไม่ถูกส่งอัตโนมัติ คัดลอกไปส่งเอง · ใบเสนอราคาสร้างเป็นสถานะร่าง ตรวจและแก้ไขได้ก่อนส่ง</DraftNote>
          </>
        )}
      </div>
    </Modal>
  );
}
