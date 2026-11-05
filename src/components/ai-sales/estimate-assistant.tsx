"use client";

// Estimating assistant: describe a scope in Thai → AI proposes BOQ lines (item code, qty, unit)
// → user edits → priced from the price book. Unmatched items stay "ต้องสืบราคา" until priced by hand.

import { useMemo, useState } from "react";
import { Check, Copy, Plus, Trash2, X } from "lucide-react";
import { Card, CardHead, cx, inputCls } from "@/components/ui";
import { Btn, IconBtn, Pill } from "@/components/ops/bits";
import { COST_CODES } from "@/lib/biz";
import { TODAY } from "@/lib/data";
import { BOOK_LABEL, priceItems, SOURCE_SHORT, usePriceBook, type BookChoice, type PriceSource } from "@/lib/sales/prices";
import { BOQ_SCHEMA, estimatePrompt, SYSTEM_ESTIMATOR, type BoqDraft } from "@/lib/ai-sales/estimate";
import { linesToTsv, priceLine, PRICE_STATUS_LABEL, totalsOf, type AiLine, type PricedLine } from "@/lib/ai-sales/pricing";
import { aiJsonBig, AiBusy, AiButton, AiError, AiPill, DraftNote, taCls, useAiRun, useCopy } from "./bits";

type Row = AiLine & { key: string; manualUnitCost?: number; fuzzy?: boolean; ai: boolean };
const n0 = (n: number) => Math.round(n).toLocaleString("th-TH");
const p2 = (n: number) => (Math.abs(n) < 100 ? n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : n0(n));
const STATUS_TONE = { book: "neutral", fuzzy: "accent", unpriced: "warn", manual: "neutral" } as const;
let seq = 0;
const rowKey = () => `R${Date.now().toString(36)}${seq++}`;

export function EstimateAssistant({ choice, province, overheadPct, marginPct, onClose }: { choice: BookChoice; province?: string; overheadPct: number; marginPct: number; onClose: () => void }) {
  const items = priceItems.use();
  const book = usePriceBook(choice, province);
  const [scope, setScope] = useState("");
  const ai = useAiRun<BoqDraft>();
  const [rows, setRows] = useState<Row[]>([]);
  const { done, copy } = useCopy();

  const run = async () => {
    const r = await ai.start(() => aiJsonBig<BoqDraft>("estimate-scope", { system: SYSTEM_ESTIMATOR, prompt: estimatePrompt(scope, items, COST_CODES, TODAY), schema: BOQ_SCHEMA, temperature: 0.2 }));
    if (!r) return;
    // freeze the first match into the row so the user sees (and can change) the item code
    setRows(
      (r.lines ?? [])
        .filter((l) => l?.name?.trim() && Number(l.qty) > 0)
        .map((l) => {
          const p = priceLine(l, book, items);
          return { key: rowKey(), itemCode: p.itemCode, name: p.itemCode && p.status === "book" ? p.name : l.name, qty: p.qty, unit: p.unit, costCode: p.costCode, note: l.note, fuzzy: p.status === "fuzzy", ai: true };
        }),
    );
  };

  const priced: (PricedLine & { fuzzy?: boolean })[] = useMemo(() => rows.map((r) => ({ ...priceLine(r, book, items, { fuzzy: false }), fuzzy: r.fuzzy })), [rows, book, items]);
  const t = totalsOf(priced, overheadPct, marginPct);
  const set = (key: string, patch: Partial<Row>) => setRows(rows.map((r) => (r.key === key ? { ...r, ...patch, ai: false } : r)));
  const setCode = (key: string, code: string) => {
    const it = items.find((i) => i.code === code);
    set(key, it ? { itemCode: it.code, name: it.name, unit: it.unit, costCode: it.costCode, fuzzy: false } : { itemCode: undefined, fuzzy: false });
  };

  return (
    <Card className="mt-4">
      <CardHead
        title="ประเมินงานต่อเติม / งานเพิ่มด้วย AI"
        meta={`ราคาจาก ${BOOK_LABEL[choice]}${province ? ` · ${province}` : ""} · ค่าดำเนินการ ${overheadPct}% · กำไร ${marginPct}%`}
        action={
          <IconBtn label="ปิด" onClick={onClose}>
            <X size={16} strokeWidth={1.5} />
          </IconBtn>
        }
      />
      <div className="flex flex-col gap-3 px-5 py-4">
        <textarea className={cx(taCls, "min-h-[72px]")} value={scope} onChange={(e) => setScope(e.target.value)} placeholder="อธิบายขอบเขตงาน เช่น ต่อเติมห้องครัวหลังบ้าน 3x4 ม. หลังคาเมทัลชีท พื้นกระเบื้อง ผนังอิฐมวลเบาฉาบเรียบ มีซิงค์ล้างจาน 1 จุด ปลั๊ก 4 จุด" aria-label="ขอบเขตงาน" />
        <div className="flex flex-wrap items-center gap-3">
          <AiButton onClick={() => void run()} disabled={ai.busy || scope.trim().length < 8}>
            {rows.length ? "ถอดรายการใหม่" : "ให้ AI ถอดรายการ BOQ"}
          </AiButton>
          <span className="text-[12px] text-ink-3">AI เสนอรายการและปริมาณเท่านั้น ราคาต่อหน่วยดึงจากฐานราคาของบริษัท</span>
        </div>
        {ai.busy && <AiBusy onCancel={ai.cancel} />}
        <AiError text={ai.error} />
        {ai.data && (ai.data.assumptions?.length || ai.data.questions?.length) ? (
          <div className="grid gap-3 text-[13px] md:grid-cols-2">
            {ai.data.assumptions?.length ? (
              <div>
                <p className="text-ink-3">สมมติฐาน</p>
                <ul className="list-disc pl-5 text-ink-2">
                  {ai.data.assumptions.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {ai.data.questions?.length ? (
              <div>
                <p className="text-ink-3">ควรถามเพิ่ม</p>
                <ul className="list-disc pl-5 text-ink-2">
                  {ai.data.questions.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {rows.length > 0 && (
        <>
          <div className="overflow-x-auto border-t border-line">
            <table className="w-full min-w-[1020px] text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-[12px] text-ink-3">
                  <th className="py-2 pl-5 pr-2 font-normal">รายการในฐานราคา</th>
                  <th className="px-2 py-2 font-normal">ชื่อรายการ</th>
                  <th className="w-24 px-2 py-2 text-right font-normal">ปริมาณ</th>
                  <th className="w-16 px-2 py-2 font-normal">หน่วย</th>
                  <th className="w-28 px-2 py-2 text-right font-normal">วัสดุ+แรง/หน่วย</th>
                  <th className="w-28 px-2 py-2 text-right font-normal">รวม</th>
                  <th className="w-36 px-2 py-2 font-normal">ราคา</th>
                  <th className="w-10 pr-5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {priced.map((l, i) => {
                  const r = rows[i];
                  const status = l.fuzzy && l.status === "book" ? "fuzzy" : l.status;
                  return (
                    <tr key={l.key} className="align-top">
                      <td className="py-2 pl-5 pr-2">
                        <select className={cx(inputCls, "h-8 w-[220px] text-[13px]")} value={r.itemCode ?? ""} onChange={(e) => setCode(r.key, e.target.value)} aria-label="รายการในฐานราคา">
                          <option value="">ไม่อยู่ในฐานราคา</option>
                          {items.map((it) => (
                            <option key={it.code} value={it.code}>
                              {it.code} · {it.name}
                            </option>
                          ))}
                        </select>
                        <span className="mt-1 block text-[12px] text-ink-3">
                          {l.costCode} {COST_CODES[l.costCode as keyof typeof COST_CODES] ?? ""}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        <input className={cx(inputCls, "h-8 w-full")} value={r.name} onChange={(e) => set(r.key, { name: e.target.value })} aria-label="ชื่อรายการ" />
                        {(r.note || l.warnings.length > 0) && (
                          <span className="mt-1 block text-[12px] text-ink-3">
                            {r.ai && <AiPill className="mr-1" />}
                            {r.note}
                            {l.warnings.length > 0 && <span className="text-warn"> {l.warnings.join(" · ")}</span>}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <input type="number" min={0} step="any" className={cx(inputCls, "h-8 w-full text-right font-mono")} value={r.qty} onChange={(e) => set(r.key, { qty: Math.max(0, Number(e.target.value) || 0) })} aria-label="ปริมาณ" />
                      </td>
                      <td className="px-2 py-2">
                        {r.itemCode ? <span className="inline-block pt-2 text-ink-2">{l.unit}</span> : <input className={cx(inputCls, "h-8 w-full")} value={r.unit} onChange={(e) => set(r.key, { unit: e.target.value })} aria-label="หน่วย" />}
                      </td>
                      <td className="px-2 py-2 text-right">
                        {r.itemCode ? (
                          <span className="num inline-block pt-2 font-mono text-[12px]">{p2(l.unitCost)}</span>
                        ) : (
                          <input type="number" min={0} className={cx(inputCls, "h-8 w-full text-right font-mono", !r.manualUnitCost && "border-warn")} value={r.manualUnitCost ?? 0} onChange={(e) => set(r.key, { manualUnitCost: Math.max(0, Number(e.target.value) || 0) })} aria-label="ราคาต่อหน่วยที่สืบมา" />
                        )}
                      </td>
                      <td className="num px-2 py-2 pt-4 text-right font-mono">{n0(l.amount)}</td>
                      <td className="px-2 py-2 pt-3">
                        <Pill tone={STATUS_TONE[status]}>{PRICE_STATUS_LABEL[status]}</Pill>
                        {l.source && <span className="ml-1 text-[12px] text-ink-3">{SOURCE_SHORT[l.source as PriceSource] ?? l.source}</span>}
                        {l.sample && <span className="block text-[11px] text-ink-3">ราคาตัวอย่าง</span>}
                      </td>
                      <td className="py-1 pr-5">
                        <IconBtn label="ลบรายการ" danger onClick={() => setRows(rows.filter((x) => x.key !== r.key))}>
                          <Trash2 size={16} strokeWidth={1.5} />
                        </IconBtn>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-start justify-between gap-4 border-t border-line px-5 py-4">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                <Btn small onClick={() => setRows([...rows, { key: rowKey(), name: "", qty: 1, unit: "งาน", costCode: "10", ai: false }])}>
                  <Plus size={16} strokeWidth={1.5} />
                  เพิ่มรายการ
                </Btn>
                <Btn small onClick={() => void copy("tsv", linesToTsv(priced))}>
                  {done === "tsv" ? <Check size={16} strokeWidth={1.5} /> : <Copy size={16} strokeWidth={1.5} />}
                  {done === "tsv" ? "คัดลอกแล้ว" : "คัดลอกตาราง (วางใน Excel)"}
                </Btn>
              </div>
              {t.unpriced > 0 && <p className="text-[13px] text-warn">มี {t.unpriced} รายการต้องสืบราคา ยอดรวมยังไม่ครบ</p>}
              <DraftNote>รายการร่างโดย AI ตรวจปริมาณและรายการก่อนใช้เสนอราคา · ราคาตัวอย่างไม่ใช่ราคาทางการ</DraftNote>
            </div>
            <dl className="w-[300px] text-[13px]">
              <Sum k="ต้นทุนทางตรง" v={n0(t.direct)} />
              <Sum k={`ค่าดำเนินการ ${overheadPct}%`} v={n0(t.overhead)} />
              <Sum k="ต้นทุนรวม" v={n0(t.cost)} />
              <Sum k={`กำไร ${marginPct}% ของราคาขาย`} v={n0(t.margin)} />
              <div className="mt-1 flex items-baseline justify-between border-t border-line pt-2">
                <dt className="text-ink">ราคาขาย (ก่อน VAT)</dt>
                <dd className="num font-mono text-[18px] text-ink">{n0(t.selling)}</dd>
              </div>
              <Sum k="รวม VAT 7%" v={n0(t.selling * 1.07)} />
            </dl>
          </div>
        </>
      )}
    </Card>
  );
}

function Sum({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between py-0.5">
      <dt className="text-ink-2">{k}</dt>
      <dd className="num font-mono text-ink-2">{v}</dd>
    </div>
  );
}
