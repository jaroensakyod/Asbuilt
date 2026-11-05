"use client";

// "AI ช่วยประเมิน" for one QC checklist item with photos. The inspector always presses pass/fail.

import { useState } from "react";
import { cx } from "@/components/ui";
import { Pill } from "@/components/ops/bits";
import { aiJson } from "@/lib/ai/client";
import { ITEM_SCHEMA, ITEM_VERDICT_LABEL, itemPrompt, normalizeItem, type ItemAssessment } from "@/lib/ai-field/inspection";
import { SEVERITY_LABEL, TODAY } from "@/lib/data";
import { isImage, type MediaRef } from "@/lib/media";
import { AiBusy, AiButton, AiError, photosToAi, useAiRun } from "./ai-bits";

const TONE = { pass: "pos", fail: "neg", unsure: "neutral" } as const;

export function InspectItemAssist({ text, standard, phase, location, note, media, onUse }: { text: string; standard: string; phase: string; location: string; note?: string; media: readonly MediaRef[]; onUse: (a: ItemAssessment) => void }) {
  const ai = useAiRun();
  const [res, setRes] = useState<ItemAssessment | null>(null);
  if (!media.some(isImage)) return null;
  const go = async () => {
    setRes(null);
    const r = await ai.run(async () => {
      const files = await photosToAi(media, 3);
      if (!files.length) throw new Error("อ่านไฟล์รูปไม่ได้");
      const p = itemPrompt({ today: TODAY, text, standard, phase, location, note, photoCount: files.length });
      return aiJson<Parameters<typeof normalizeItem>[0]>("inspection-item", { ...p, files, schema: ITEM_SCHEMA });
    });
    if (r) setRes(normalizeItem(r));
  };
  return (
    <div className="flex flex-col gap-2">
      {ai.busy ? (
        <AiBusy onCancel={ai.cancel} label="AI กำลังดูรูปเทียบกับเกณฑ์" />
      ) : (
        !res && (
          <div>
            <AiButton onClick={go}>AI ช่วยประเมิน</AiButton>
          </div>
        )
      )}
      <AiError text={ai.error} onClose={ai.clearError} />
      {res && (
        <div className="flex flex-col gap-1.5 rounded-[10px] border border-line bg-raised/40 p-3 text-[13px]">
          <p className="flex flex-wrap items-center gap-2">
            <Pill tone={TONE[res.verdict]}>AI · {ITEM_VERDICT_LABEL[res.verdict]}</Pill>
            {res.verdict === "fail" && <span className="text-ink-3">ความรุนแรง{SEVERITY_LABEL[res.severity]}</span>}
          </p>
          {res.comment && <p className="text-ink-2">{res.comment}</p>}
          {res.checks.length > 0 && (
            <div>
              <p className="text-ink-3">ควรตรวจ/วัดเพิ่มที่หน้างาน</p>
              <ul className="list-disc pl-5 text-ink-2">
                {res.checks.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-[12px] text-ink-3">เป็นความเห็นประกอบ ผู้ตรวจเป็นผู้ตัดสินผลเอง</p>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setRes(null)} className="h-8 rounded-[8px] px-3 text-ink-2 hover:bg-raised">
              ไม่ใช้
            </button>
            <button
              type="button"
              onClick={() => {
                onUse(res);
                setRes(null);
              }}
              className={cx("h-8 rounded-[8px] px-3 font-medium", res.verdict === "unsure" ? "border border-line-strong bg-card text-ink" : "bg-ink text-card")}
            >
              {res.verdict === "unsure" ? "ใส่หมายเหตุอย่างเดียว" : `ใช้ผล "${res.verdict === "pass" ? "ผ่าน" : "ไม่ผ่าน"}" และหมายเหตุ`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
