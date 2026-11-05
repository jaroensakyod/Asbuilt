"use client";

// "ให้ AI ช่วยตั้งราคา" inside the variation (VO) form: describe the change → suggested lines
// (qty / unit / cost code) priced from the price book + markup, and a time-extension estimate.

import { useMemo, useState } from "react";
import { cx, inputCls } from "@/components/ui";
import { Btn, Pill } from "@/components/ops/bits";
import { COST_CODES } from "@/lib/biz";
import { TODAY } from "@/lib/data";
import { priceItems, usePriceBook } from "@/lib/sales/prices";
import { cleanDays, signedQty, SYSTEM_VARIATION, variationPrompt, VO_SCHEMA, voLineFrom, type VoDraft } from "@/lib/ai-sales/estimate";
import { priceLine, PRICE_STATUS_LABEL } from "@/lib/ai-sales/pricing";
import { aiJsonBig, AiBusy, AiButton, AiError, AiPill, DraftNote, taCls, useAiRun } from "./bits";

export type VoApply = {
  lines: ReturnType<typeof voLineFrom>[];
  title: string;
  reason: string;
  days: number;
  mode: "replace" | "append";
};

const n0 = (n: number) => Math.round(n).toLocaleString("th-TH");

export function AiVoHelper({
  project,
  initialText,
  onApply,
  onClose,
}: {
  project?: { id: string; name: string; phase: string; actual: number; finish: string; modelCode?: string; area?: number; province?: string };
  initialText?: string;
  onApply: (a: VoApply) => void;
  onClose: () => void;
}) {
  const items = priceItems.use();
  const book = usePriceBook("cgd", project?.province);
  const [text, setText] = useState(initialText ?? "");
  const [markup, setMarkup] = useState(25);
  const [off, setOff] = useState<Set<number>>(new Set());
  const ai = useAiRun<VoDraft>();

  const run = async () => {
    setOff(new Set());
    await ai.start(() => aiJsonBig<VoDraft>("vo-price", { system: SYSTEM_VARIATION, prompt: variationPrompt({ description: text, project, items, costCodes: COST_CODES, today: TODAY }), schema: VO_SCHEMA, temperature: 0.2 }));
  };

  const priced = useMemo(
    () =>
      (ai.data?.lines ?? [])
        .filter((l) => l?.name?.trim() && Number(l.qty))
        .map((l) => {
          const { line, sign } = signedQty(l);
          const p = priceLine(line, book, items);
          return { p, sign, vo: { ...voLineFrom(p, markup), qty: sign * p.qty } };
        }),
    [ai.data, book, items, markup],
  );
  const kept = priced.filter((_, i) => !off.has(i));
  const amount = kept.reduce((s, x) => s + x.vo.qty * x.vo.unitPrice, 0);
  const cost = kept.reduce((s, x) => s + x.vo.qty * x.vo.unitCost, 0);
  const unpriced = kept.filter((x) => x.p.status === "unpriced").length;
  const days = cleanDays(ai.data?.days);

  const apply = (mode: VoApply["mode"]) => ai.data && onApply({ lines: kept.map((x) => x.vo), title: ai.data.title ?? "", reason: ai.data.reason ?? "", days, mode });

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-[12px] border border-line bg-raised/40 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[14px] font-medium">ให้ AI ช่วยตั้งราคางานเปลี่ยนแปลง</p>
        <button type="button" onClick={onClose} className="text-[13px] text-ink-3 hover:text-ink">
          ปิด
        </button>
      </div>
      <textarea className={cx(taCls, "min-h-[64px]")} value={text} onChange={(e) => setText(e.target.value)} placeholder="อธิบายการเปลี่ยนแปลง เช่น ลูกค้าขอเปลี่ยนพื้นห้องนอนชั้น 2 (40 ตร.ม.) จากแกรนิตโต้เป็นลามิเนต และเพิ่มปลั๊ก 3 จุด" aria-label="คำอธิบายการเปลี่ยนแปลง" />
      <div className="flex flex-wrap items-center gap-3">
        <AiButton onClick={() => void run()} disabled={ai.busy || text.trim().length < 8}>
          {ai.data ? "ตั้งราคาใหม่" : "เสนอรายการและราคา"}
        </AiButton>
        <label className="inline-flex items-center gap-2 text-[13px] text-ink-2">
          Markup บนต้นทุน
          <input type="number" min={0} max={200} className={cx(inputCls, "h-8 w-20 text-right font-mono")} value={markup} onChange={(e) => setMarkup(Math.max(0, Number(e.target.value) || 0))} aria-label="Markup (%)" />%
        </label>
        <span className="text-[12px] text-ink-3">ต้นทุนจากฐานราคากรมบัญชีกลาง{project?.province ? ` (${project.province})` : ""}</span>
      </div>
      {ai.busy && <AiBusy onCancel={ai.cancel} />}
      <AiError text={ai.error} />

      {ai.data && (
        <>
          {priced.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-[13px]">
                <thead>
                  <tr className="border-b border-line text-left text-[12px] text-ink-3">
                    <th className="w-8 py-1.5 font-normal" />
                    <th className="py-1.5 font-normal">รายการ</th>
                    <th className="w-20 py-1.5 text-right font-normal">ปริมาณ</th>
                    <th className="w-16 py-1.5 pl-2 font-normal">หน่วย</th>
                    <th className="w-24 py-1.5 text-right font-normal">ต้นทุน/หน่วย</th>
                    <th className="w-24 py-1.5 text-right font-normal">ขาย/หน่วย</th>
                    <th className="w-28 py-1.5 text-right font-normal">ราคาขาย</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {priced.map(({ p, vo }, i) => (
                    <tr key={i} className={cx("align-top", off.has(i) && "opacity-50")}>
                      <td className="py-1.5">
                        <input
                          type="checkbox"
                          checked={!off.has(i)}
                          onChange={(e) => {
                            const n = new Set(off);
                            if (e.target.checked) n.delete(i);
                            else n.add(i);
                            setOff(n);
                          }}
                          aria-label="ใช้รายการนี้"
                        />
                      </td>
                      <td className="py-1.5 pr-2">
                        <span className="text-ink">{p.name}</span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] text-ink-3">
                          <AiPill />
                          <Pill tone={p.status === "unpriced" ? "warn" : p.status === "fuzzy" ? "accent" : "neutral"}>{PRICE_STATUS_LABEL[p.status]}</Pill>
                          {p.itemCode && <span className="font-mono">{p.itemCode}</span>}
                          <span>
                            {p.costCode} {COST_CODES[p.costCode as keyof typeof COST_CODES] ?? ""}
                          </span>
                          {p.note}
                        </span>
                      </td>
                      <td className="num py-1.5 text-right font-mono">{vo.qty.toLocaleString("th-TH")}</td>
                      <td className="py-1.5 pl-2 text-ink-2">{vo.unit}</td>
                      <td className="num py-1.5 text-right font-mono">{n0(vo.unitCost)}</td>
                      <td className="num py-1.5 text-right font-mono">{n0(vo.unitPrice)}</td>
                      <td className="num py-1.5 text-right font-mono">{n0(vo.qty * vo.unitPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-[13px] text-ink-3">AI ไม่เสนอรายการ ลองอธิบายให้ละเอียดขึ้น</p>
          )}
          <div className="flex flex-wrap items-baseline justify-between gap-3 text-[13px]">
            <span className="text-ink-2">
              ขยายเวลา <span className="num font-mono text-ink">{days}</span> วัน <AiPill /> · {ai.data.daysReason}
            </span>
            <span className="num font-mono text-ink">
              ขาย {n0(amount)} · ต้นทุน {n0(cost)}
            </span>
          </div>
          {ai.data.risks?.length ? <p className="text-[12px] text-ink-3">ข้อควรระวัง: {ai.data.risks.join(" · ")}</p> : null}
          {unpriced > 0 && <p className="text-[13px] text-warn">มี {unpriced} รายการต้องสืบราคา จะลงฟอร์มเป็นราคา 0 กรอกราคาเองก่อนบันทึกพร้อมราคา</p>}
          <div className="flex flex-wrap items-center gap-2">
            <Btn small primary disabled={!kept.length} onClick={() => apply("replace")}>
              ใส่ในฟอร์ม (แทนรายการเดิม)
            </Btn>
            <Btn small disabled={!kept.length} onClick={() => apply("append")}>
              เพิ่มต่อท้ายรายการเดิม
            </Btn>
            <DraftNote>ร่างโดย AI ตรวจสอบในฟอร์มก่อนบันทึก ไม่มีการส่งหรืออนุมัติอัตโนมัติ</DraftNote>
          </div>
        </>
      )}
    </div>
  );
}
