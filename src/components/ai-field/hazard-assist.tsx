"use client";

// Safety photo hazard check (inspection form / site walk / phone) and toolbox-talk topic suggestions.

import { useState } from "react";
import { Check } from "lucide-react";
import { cx } from "@/components/ui";
import { Pill, type Tone } from "@/components/ops/bits";
import { aiJson } from "@/lib/ai/client";
import { buildWeekContext, HAZARD_SCHEMA, HAZARD_SEV_LABEL, hazardPrompt, normalizeHazards, normalizeTopics, TOPIC_SCHEMA, topicPrompt, type Hazard, type HazardResult, type HazardSeverity, type TopicSuggestion } from "@/lib/ai-field/safety";
import { siteDiaries, wbsTasks, WEATHER_LABEL } from "@/lib/biz";
import { getProject, TODAY } from "@/lib/data";
import { isImage, type MediaRef } from "@/lib/media";
import { canView } from "@/lib/permissions";
import { incidents, permits, safetyInspections, toolboxTalks } from "@/lib/safety/store";
import { INC_LABEL, PERMIT_SHORT, TOPICS } from "@/lib/safety/types";
import { useMe } from "@/lib/use-me";
import { AiBusy, AiButton, AiError, AiPanel, photosToAi, useAiRun } from "./ai-bits";

export const HAZ_TONE: Record<HazardSeverity, Tone> = { high: "neg", medium: "warn", low: "neutral" };

/** photo → hazards list with checkboxes; `onApply` gets the ticked ones */
export function HazardAssist({ photos, checklist, location, note, onApply, phone, applyLabel = "ใส่ผลในใบตรวจ", extra }: { photos: readonly MediaRef[]; checklist: readonly string[]; location?: string; note?: string; onApply: (h: Hazard[], r: HazardResult) => void; phone?: boolean; applyLabel?: string; extra?: (h: Hazard[], r: HazardResult) => React.ReactNode }) {
  const ai = useAiRun();
  const [res, setRes] = useState<HazardResult | null>(null);
  const [off, setOff] = useState<number[]>([]);
  const hasPhoto = photos.some(isImage);
  const go = async () => {
    setRes(null);
    setOff([]);
    const r = await ai.run(async () => {
      const files = await photosToAi(photos, 4);
      if (!files.length) throw new Error("อ่านไฟล์รูปไม่ได้");
      const p = hazardPrompt({ today: TODAY, checklist, location, note });
      return aiJson<Parameters<typeof normalizeHazards>[0]>("safety-hazard", { ...p, files, schema: HAZARD_SCHEMA });
    });
    if (r) setRes(normalizeHazards(r, checklist));
  };
  const chosen = res ? res.hazards.filter((_, i) => !off.includes(i)) : [];
  const t = phone ? "text-[14px]" : "text-[13px]";

  return (
    <div className="flex flex-col gap-2">
      {ai.busy ? (
        <AiBusy onCancel={ai.cancel} label="AI กำลังตรวจหาความเสี่ยงในรูป" phone={phone} />
      ) : (
        <div className={cx("flex flex-wrap items-center gap-2", phone && "flex-col items-stretch")}>
          <AiButton phone={phone} disabled={!hasPhoto} onClick={go}>
            ให้ AI ตรวจความเสี่ยงจากรูป
          </AiButton>
          {!hasPhoto && <span className={cx("text-ink-3", phone ? "text-center text-[13px]" : "text-[12px]")}>แนบรูปหน้างานก่อน</span>}
        </div>
      )}
      <AiError text={ai.error} onClose={ai.clearError} phone={phone} />
      {res && (
        <AiPanel title={res.hazards.length ? `AI พบความเสี่ยง ${res.hazards.length} จุด (ร่าง)` : "AI ไม่พบความเสี่ยงที่เห็นชัดในรูป"} phone={phone} onClose={() => setRes(null)}>
          {res.summary && <p className={cx("text-ink-2", t)}>{res.summary}</p>}
          {res.hazards.length > 0 && (
            <ul className="flex flex-col divide-y divide-line rounded-[10px] border border-line bg-card">
              {res.hazards.map((h, i) => {
                const on = !off.includes(i);
                return (
                  <li key={i}>
                    <button type="button" aria-pressed={on} onClick={() => setOff((o) => (on ? [...o, i] : o.filter((x) => x !== i)))} className={cx("flex w-full items-start gap-3 px-3 text-left", phone ? "min-h-12 py-2.5" : "py-2", t)}>
                      <span className={cx("mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-[5px] border", on ? "border-ink bg-ink text-card" : "border-line-strong")}>{on && <Check size={14} strokeWidth={1.5} />}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className={cx(!on && "text-ink-3")}>{h.hazard}</span>
                          <Pill tone={HAZ_TONE[h.severity]}>{HAZARD_SEV_LABEL[h.severity]}</Pill>
                        </span>
                        {h.where && <span className="block text-[12px] text-ink-3">{h.where}</span>}
                        {h.action && <span className="block text-ink-2">แก้ไข: {h.action}</span>}
                        <span className="block text-[12px] text-ink-3">{h.item >= 0 ? `ข้อ ${h.item + 1} ${checklist[h.item]}` : "ไม่ตรงกับข้อในเช็กลิสต์ (ใส่ในการแก้ไขที่สั่ง)"}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {res.good.length > 0 && <p className={cx("text-pos", t)}>ทำได้ดี: {res.good.join(" · ")}</p>}
          <p className="text-[12px] text-ink-3">AI เห็นเฉพาะสิ่งที่อยู่ในรูป ผู้ตรวจต้องยืนยันที่หน้างาน · แตะเพื่อเลือก/ไม่เลือก</p>
          <div className={cx("flex gap-2", phone ? "flex-col" : "flex-wrap justify-end")}>
            {extra?.(chosen, res)}
            <button
              type="button"
              disabled={!chosen.length}
              onClick={() => {
                onApply(chosen, res);
                setRes(null);
              }}
              className={cx("rounded-[10px] bg-ink px-4 font-medium text-card disabled:opacity-40", phone ? "h-12 text-[15px]" : "h-8 text-[13px]")}
            >
              {applyLabel}
            </button>
          </div>
        </AiPanel>
      )}
    </div>
  );
}

/** "แนะนำหัวข้อ Toolbox Talk" from the site's last two weeks (incidents, permits, weather, walk findings) */
export function TopicAssist({ site, onPick, phone }: { site: string; onPick: (t: TopicSuggestion) => void; phone?: boolean }) {
  const me = useMe();
  const ai = useAiRun();
  const [res, setRes] = useState<TopicSuggestion[] | null>(null);
  const go = async () => {
    setRes(null);
    const safety = canView(me.role, "safety");
    const ctx = buildWeekContext({
      site,
      today: TODAY,
      incidents: safety ? incidents.all() : [],
      permits: safety ? permits.all() : [],
      diaries: siteDiaries.all(),
      inspections: safety ? safetyInspections.all() : [],
      talks: toolboxTalks.all(),
      tasks: wbsTasks.all(),
      labels: { incident: INC_LABEL, permit: PERMIT_SHORT, weather: WEATHER_LABEL },
    });
    const p = topicPrompt({ today: TODAY, siteName: getProject(site)?.name ?? site, ctx, library: TOPICS });
    const r = await ai.run(() => aiJson<Parameters<typeof normalizeTopics>[0]>("toolbox-topics", { ...p, schema: TOPIC_SCHEMA }));
    if (r) setRes(normalizeTopics(r, TOPICS));
  };
  const t = phone ? "text-[14px]" : "text-[13px]";
  return (
    <div className="flex flex-col gap-2">
      {ai.busy ? (
        <AiBusy onCancel={ai.cancel} label="AI กำลังดูเหตุการณ์และงานสัปดาห์นี้" phone={phone} />
      ) : (
        <AiButton phone={phone} disabled={!site} onClick={go}>
          แนะนำหัวข้อ Toolbox Talk
        </AiButton>
      )}
      <AiError text={ai.error} onClose={ai.clearError} phone={phone} />
      {res && (
        <AiPanel title="หัวข้อที่แนะนำสัปดาห์นี้" phone={phone} onClose={() => setRes(null)}>
          {res.length === 0 && <p className={cx("text-ink-3", t)}>AI ไม่มีคำแนะนำ ลองใหม่อีกครั้ง</p>}
          <ul className="flex flex-col gap-2">
            {res.map((s, i) => (
              <li key={i} className="rounded-[10px] border border-line bg-card p-3">
                <p className={cx("font-medium", phone ? "text-[15px]" : "text-[14px]")}>
                  {s.title} {s.topicId && <span className="font-mono text-[12px] font-normal text-ink-3">{s.topicId}</span>}
                </p>
                {s.why && <p className={cx("mt-0.5 text-ink-2", t)}>{s.why}</p>}
                {s.points.length > 0 && (
                  <ul className={cx("mt-1 list-disc pl-5 text-ink-2", t)}>
                    {s.points.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onPick(s);
                    setRes(null);
                  }}
                  className={cx("mt-2 w-full rounded-[10px] border border-line-strong font-medium hover:bg-raised", phone ? "h-11 text-[15px]" : "h-8 text-[13px]")}
                >
                  ใช้หัวข้อนี้
                </button>
              </li>
            ))}
          </ul>
        </AiPanel>
      )}
    </div>
  );
}
