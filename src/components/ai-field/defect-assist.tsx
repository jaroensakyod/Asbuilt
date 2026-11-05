"use client";

// "ให้ AI ดูรูป" for defects / repairs, and the before/after check for a fixed punch item.

import { useState } from "react";
import { cx } from "@/components/ui";
import { Pill, SEV_TONE } from "@/components/ops/bits";
import { aiJson } from "@/lib/ai/client";
import { DEFECT_SCHEMA, defectPrompt, FIX_SCHEMA, FIX_VERDICT_LABEL, fixCheckPrompt, normalizeDefect, normalizeFix, type AssetCandidate, type DefectRaw, type DefectSuggestion, type FixCheck } from "@/lib/ai-field/defect";
import { SEVERITY_LABEL, SYSTEM_LABEL, TODAY } from "@/lib/data";
import { isImage, type MediaRef } from "@/lib/media";
import { AiBusy, AiButton, AiError, AiPanel, photosToAi, useAiRun } from "./ai-bits";

const CONF_LABEL = { high: "มั่นใจ", medium: "ค่อนข้างมั่นใจ", low: "ไม่ค่อยมั่นใจ" } as const;

export function DefectAssist({
  photos,
  note,
  location,
  context,
  assets,
  trades,
  onApply,
  phone,
}: {
  photos: readonly MediaRef[];
  note?: string;
  location?: string;
  context: "construction" | "repair";
  assets?: readonly AssetCandidate[];
  trades?: readonly string[];
  onApply: (s: DefectSuggestion) => void;
  phone?: boolean;
}) {
  const ai = useAiRun();
  const [res, setRes] = useState<DefectSuggestion | null>(null);
  const hasPhoto = photos.some(isImage);
  const go = async () => {
    setRes(null);
    const r = await ai.run(async () => {
      const files = await photosToAi(photos, 3);
      if (!files.length) throw new Error("อ่านไฟล์รูปไม่ได้");
      const p = defectPrompt({ today: TODAY, note, location, context, assets, trades });
      return aiJson<DefectRaw>(context === "repair" ? "repair-photo" : "defect-photo", { ...p, files, schema: DEFECT_SCHEMA });
    });
    if (r) setRes(normalizeDefect(r, { assets, trades }));
  };
  const t = phone ? "text-[14px]" : "text-[13px]";

  return (
    <div className="flex flex-col gap-2">
      {ai.busy ? (
        <AiBusy onCancel={ai.cancel} label="AI กำลังดูรูป" phone={phone} />
      ) : (
        <div className={cx("flex flex-wrap items-center gap-2", phone && "flex-col items-stretch")}>
          <AiButton phone={phone} disabled={!hasPhoto} onClick={go} title={hasPhoto ? undefined : "ถ่ายหรือแนบรูปก่อน"}>
            ให้ AI ดูรูป
          </AiButton>
          {!hasPhoto && <span className={cx("text-ink-3", phone ? "text-center text-[13px]" : "text-[12px]")}>ถ่ายหรือแนบรูปก่อน แล้วให้ AI ช่วยจัดประเภทและแนะนำวิธีแก้</span>}
        </div>
      )}
      <AiError text={ai.error} onClose={ai.clearError} phone={phone} />
      {res && (
        <AiPanel title="AI ดูรูปแล้ว (ร่างคำแนะนำ)" phone={phone} onClose={() => setRes(null)}>
          <div className={cx("flex flex-col gap-1.5", t)}>
            <p className="text-[15px] font-medium text-ink">{res.title}</p>
            <p className="flex flex-wrap items-center gap-1.5">
              <Pill>{SYSTEM_LABEL[res.system]}</Pill>
              <Pill tone={SEV_TONE[res.severity]}>ความรุนแรง{SEVERITY_LABEL[res.severity]}</Pill>
              {res.trade && <Pill>{res.trade}</Pill>}
              <span className="text-ink-3">{CONF_LABEL[res.confidence]}</span>
            </p>
            {res.detail && <p className="text-ink-2">{res.detail}</p>}
            {res.cause && (
              <p>
                <span className="text-ink-3">สาเหตุที่เป็นไปได้ </span>
                {res.cause}
              </p>
            )}
            {res.fix && (
              <p>
                <span className="text-ink-3">แนวทางแก้ </span>
                {res.fix}
              </p>
            )}
            {res.asset && (
              <p>
                <span className="text-ink-3">อุปกรณ์ที่น่าจะเกี่ยวข้อง </span>
                <span className="font-mono">{res.asset.code}</span> {res.asset.name}
                {res.asset.location && <span className="text-ink-3"> · {res.asset.location}</span>}
              </p>
            )}
            {res.confidence === "low" && <p className="text-warn">AI ไม่ค่อยมั่นใจ ตรวจสอบหน้างานก่อนใช้</p>}
          </div>
          <div className={cx("flex gap-2", phone ? "flex-col" : "justify-end")}>
            <button type="button" onClick={() => setRes(null)} className={cx("rounded-[10px] px-3 text-ink-2 hover:bg-raised", phone ? "h-12 text-[15px]" : "h-8 text-[13px]")}>
              ไม่ใช้
            </button>
            <button
              type="button"
              onClick={() => {
                onApply(res);
                setRes(null);
              }}
              className={cx("rounded-[10px] bg-ink px-4 font-medium text-card", phone ? "h-12 text-[15px]" : "h-8 text-[13px]")}
            >
              ใส่ในฟอร์ม
            </button>
          </div>
        </AiPanel>
      )}
    </div>
  );
}

const VERDICT_TONE = { fixed: "pos", not_fixed: "neg", unsure: "neutral" } as const;

/** before/after photo comparison for a punch item; the verifier still decides */
export function FixCheckAssist({ title, location, before, after, phone }: { title: string; location?: string; before: readonly MediaRef[]; after: readonly MediaRef[]; phone?: boolean }) {
  const ai = useAiRun();
  const [res, setRes] = useState<FixCheck | null>(null);
  const ok = before.some(isImage) && after.some(isImage);
  if (!ok) return null;
  const go = async () => {
    setRes(null);
    const r = await ai.run(async () => {
      const b = await photosToAi(before, 2);
      const a = await photosToAi(after, 2);
      if (!b.length || !a.length) throw new Error("อ่านไฟล์รูปไม่ได้");
      const p = fixCheckPrompt({ today: TODAY, title, location, beforeCount: b.length, afterCount: a.length });
      return aiJson<Partial<FixCheck>>("punch-fix-check", { ...p, files: [...b, ...a], schema: FIX_SCHEMA });
    });
    if (r) setRes(normalizeFix(r));
  };
  return (
    <div className="flex flex-col gap-2">
      {ai.busy ? (
        <AiBusy onCancel={ai.cancel} label="AI กำลังเทียบรูปก่อน/หลัง" phone={phone} />
      ) : (
        !res && (
          <AiButton phone={phone} onClick={go}>
            ดูเหมือนแก้แล้วหรือยัง
          </AiButton>
        )
      )}
      <AiError text={ai.error} onClose={ai.clearError} phone={phone} />
      {res && (
        <div className={cx("flex flex-col gap-1 rounded-[12px] border border-line bg-raised/40 p-3", phone ? "text-[14px]" : "text-[13px]")}>
          <p className="flex items-center gap-2">
            <Pill tone={VERDICT_TONE[res.verdict]}>AI · {FIX_VERDICT_LABEL[res.verdict]}</Pill>
            <button type="button" onClick={() => setRes(null)} className="ml-auto text-[12px] text-ink-3 hover:text-ink">
              ซ่อน
            </button>
          </p>
          {res.reason && <p className="text-ink-2">{res.reason}</p>}
          {res.remaining.length > 0 && (
            <ul className="list-disc pl-5 text-ink-2">
              {res.remaining.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          )}
          <p className="text-[12px] text-ink-3">เป็นความเห็นประกอบ ผู้ตรวจต้องดูหน้างานและกดผ่าน/ไม่ผ่านเอง</p>
        </div>
      )}
    </div>
  );
}
