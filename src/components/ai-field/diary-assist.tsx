"use client";

// "พูด/พิมพ์สรุปงานวันนี้" → AI fills the site-diary form (nothing is saved until the user presses save).

import { useState } from "react";
import { aiJson } from "@/lib/ai/client";
import { applyDiaryDraft, DIARY_SCHEMA, diaryPrompt, pickTasks, type DiaryDraft, type DiaryFields } from "@/lib/ai-field/diary";
import { subcontractors, wbsTasks, type SiteDiary } from "@/lib/biz";
import { getProject } from "@/lib/data";
import { AiBusy, AiButton, AiError, AiFilledNote, AiPanel, useAiRun } from "./ai-bits";
import { DictateBox } from "./dictate";

export const DIARY_FIELD_LABEL: Record<DiaryFields, string> = {
  weather: "อากาศ",
  manpower: "กำลังคน",
  equipment: "เครื่องจักร",
  work: "งานที่ทำ",
  deliveries: "วัสดุเข้า",
  issues: "ปัญหา",
  visitors: "ผู้เยี่ยมชม",
  safety: "ความปลอดภัย",
};

const EXAMPLE = "เช่น วันนี้ช่างปูน 6 คน ไฟฟ้า 2 คน เทพื้นชั้น 2 ไป 70% ฝนตกบ่าย 2 ชั่วโมง ปูนมาส่ง 20 ถุง";

export function DiaryAssist<D extends SiteDiary>({ diary, onApply, phone, filled }: { diary: D; onApply: (d: D, filled: DiaryFields[]) => void; phone?: boolean; filled: DiaryFields[] }) {
  const [open, setOpen] = useState(phone ?? false);
  const [text, setText] = useState("");
  const [before, setBefore] = useState<D | null>(null);
  const ai = useAiRun();

  const go = async () => {
    const all = wbsTasks.all();
    const tasks = pickTasks(all, diary.projectId, diary.date);
    const subs = subcontractors.all();
    const p = diaryPrompt({ text, date: diary.date, projectName: getProject(diary.projectId)?.name ?? diary.projectId, tasks, subs });
    const draft = await ai.run(() => aiJson<DiaryDraft>("diary-draft", { ...p, schema: DIARY_SCHEMA }));
    if (!draft) return;
    const r = applyDiaryDraft(diary, draft, tasks, subs);
    setBefore(diary);
    onApply(r.diary, r.filled);
  };

  if (!open)
    return (
      <div className="flex flex-wrap items-center gap-2">
        <AiButton onClick={() => setOpen(true)}>พูด/พิมพ์สรุปงานวันนี้ ให้ AI ช่วยกรอก</AiButton>
        <AiFilledNote fields={filled.map((f) => DIARY_FIELD_LABEL[f])} />
      </div>
    );

  return (
    <AiPanel title="พูด/พิมพ์สรุปงานวันนี้" phone={phone} onClose={phone ? undefined : () => setOpen(false)}>
      <p className={phone ? "text-[13px] text-ink-3" : "text-[12px] text-ink-3"}>เล่าสั้น ๆ ว่าวันนี้มีใคร ทำอะไร ไปถึงไหน อากาศ วัสดุเข้า ปัญหา แล้วให้ AI แยกลงช่องในฟอร์ม · ระบบส่งข้อความให้ผู้ให้บริการ AI ประมวลผล</p>
      <DictateBox label="สรุปงานวันนี้" value={text} onChange={setText} placeholder={EXAMPLE} phone={phone} rows={3} />
      <AiError text={ai.error} onClose={ai.clearError} phone={phone} />
      {ai.busy ? (
        <AiBusy onCancel={ai.cancel} label="AI กำลังแยกข้อมูลลงฟอร์ม" phone={phone} />
      ) : (
        <div className={phone ? "flex flex-col gap-2" : "flex flex-wrap items-center gap-2"}>
          <AiButton phone={phone} disabled={text.trim().length < 6} onClick={go}>
            ให้ AI กรอกรายงาน
          </AiButton>
        </div>
      )}
      <AiFilledNote
        phone={phone}
        fields={filled.map((f) => DIARY_FIELD_LABEL[f])}
        onUndo={
          before
            ? () => {
                onApply(before, []);
                setBefore(null);
              }
            : undefined
        }
      />
    </AiPanel>
  );
}
