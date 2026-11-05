"use client";

// Selections helper: suggest 2–3 catalogue products for a client selection, within the allowance.

import { useState } from "react";
import { Pill } from "@/components/ops/bits";
import { aiJson } from "@/lib/ai/client";
import { getHouseModel, getProject } from "@/lib/data";
import {
  products as productsCol,
  SEL_CATEGORY_LABEL,
  type Product,
  type Selection,
} from "@/lib/interior";
import {
  candidates,
  cleanPicks,
  SELECTION_SCHEMA,
  selectionPrompt,
  SYSTEM_SELECTION,
} from "@/lib/ai-sales/selection";
import { AiBusy, AiButton, AiError, AiPill, useAiRun } from "./bits";

type Res = { picks: { id: string; reason: string }[]; advice?: string };
const n0 = (n: number) => Math.round(n).toLocaleString("th-TH");

export function AiSelectionSuggest({
  sel,
  onAdd,
}: {
  sel: Selection;
  onAdd: (picks: { product: Product; reason: string }[]) => void;
}) {
  const prods = productsCol.use();
  const ai = useAiRun<Res>();
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const existing = sel.options
    .map((o) => o.productId)
    .filter((x): x is string => !!x);
  const cands = candidates(sel, prods, existing);
  const style = getHouseModel(
    getProject(sel.projectId)?.modelCode ?? "",
  )?.style;

  const run = async () => {
    const r = await ai.start(() =>
      aiJson<Res>("selection-suggest", {
        system: SYSTEM_SELECTION,
        prompt: selectionPrompt({
          item: sel.item || SEL_CATEGORY_LABEL[sel.category],
          room: sel.room,
          categoryLabel: SEL_CATEGORY_LABEL[sel.category],
          qty: sel.qty,
          unit: sel.unit,
          allowanceUnit: sel.allowanceUnit,
          clientNote: sel.clientNote,
          style,
          existing: sel.options.map((o) => o.name).filter(Boolean),
          products: cands,
        }),
        schema: SELECTION_SCHEMA,
        temperature: 0.4,
      }),
    );
    if (r)
      setChosen(
        new Set(
          cleanPicks(r.picks, cands, sel.allowanceUnit).map(
            (p) => p.product.id,
          ),
        ),
      );
  };
  const picks = ai.data
    ? cleanPicks(ai.data.picks, cands, sel.allowanceUnit)
    : [];

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-[10px] border border-line bg-raised/40 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <AiButton
          onClick={() => void run()}
          disabled={ai.busy || !cands.length || !sel.allowanceUnit}
        >
          ให้ AI แนะนำตัวเลือก
        </AiButton>
        <span className="text-[12px] text-ink-3">
          {!sel.allowanceUnit
            ? "กรอกงบมาตรฐาน/หน่วยก่อน"
            : cands.length
              ? `เลือกจากแค็ตตาล็อก ${cands.length} รายการในหมวดนี้ (ไม่เกิน 1.5 เท่าของงบ)`
              : "ไม่มีสินค้าในแค็ตตาล็อกที่ตรงหมวดและงบ"}
        </span>
      </div>
      {ai.busy && <AiBusy onCancel={ai.cancel} />}
      <AiError text={ai.error} />
      {ai.data && (
        <>
          {picks.length ? (
            <ul className="flex flex-col gap-1.5">
              {picks.map((p) => (
                <li
                  key={p.product.id}
                  className="flex items-start gap-2 text-[13px]"
                >
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={chosen.has(p.product.id)}
                    onChange={(e) => {
                      const n = new Set(chosen);
                      if (e.target.checked) n.add(p.product.id);
                      else n.delete(p.product.id);
                      setChosen(n);
                    }}
                    aria-label={`เพิ่ม ${p.product.name}`}
                  />
                  <div className="min-w-0 flex-1">
                    <span className="text-ink">{p.product.name}</span>{" "}
                    <span className="font-mono text-[12px] text-ink-3">
                      {p.product.sku}
                    </span>{" "}
                    <span className="num font-mono text-[12px]">
                      {n0(p.product.clientPrice)}/{p.product.unit}
                    </span>{" "}
                    <Pill tone={p.within ? "pos" : "warn"}>
                      {p.within
                        ? "ในงบ"
                        : `เกินงบ ${n0(p.diffUnit)}/${sel.unit}`}
                    </Pill>
                    <span className="block text-[12px] text-ink-2">
                      <AiPill className="mr-1" />
                      {p.reason}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-ink-3">
              AI ไม่ได้เลือกสินค้าจากแค็ตตาล็อก
            </p>
          )}
          {ai.data.advice && (
            <p className="text-[12px] text-ink-2">{ai.data.advice}</p>
          )}
          {picks.length > 0 && (
            <div>
              <AiButton
                disabled={!chosen.size}
                onClick={() => {
                  onAdd(
                    picks
                      .filter((p) => chosen.has(p.product.id))
                      .flatMap((p) => {
                        const full = prods.find((x) => x.id === p.product.id);
                        return full
                          ? [{ product: full, reason: p.reason }]
                          : [];
                      }),
                  );
                  ai.reset();
                }}
              >
                เพิ่มเป็นตัวเลือก ({chosen.size})
              </AiButton>
            </div>
          )}
        </>
      )}
    </div>
  );
}
