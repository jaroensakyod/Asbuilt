"use client";

// Meeting minutes: paste/dictate raw notes → minutes, decisions and action items to review, then apply.

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { cx, inputCls } from "@/components/ui";
import { areaCls, Btn, I, IconBtn } from "@/components/ops/bits";
import { aiJson } from "@/lib/ai/client";
import { MINUTES_SCHEMA, minutesPrompt, normalizeMinutes, type MinutesAction, type MinutesDraft } from "@/lib/ai-field/engineering";
import { getProject, TODAY } from "@/lib/data";
import type { Meeting } from "@/lib/engineering/types";
import { AiBusy, AiButton, AiError, AiPanel, useAiRun } from "./ai-bits";
import { DictateBox } from "./dictate";

type Row = MinutesAction & { on: boolean };

export function MinutesAssist({ meeting, carried, onApply }: { meeting: Meeting; carried: string[]; onApply: (d: { minutes: string; decisions: string[]; agenda: string[]; actions: MinutesAction[] }) => void }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [draft, setDraft] = useState<(MinutesDraft & { rows: Row[] }) | null>(null);
  const ai = useAiRun();
  const attendees = meeting.attendees.map((a) => ({ name: a.name, org: a.org }));

  const go = async () => {
    const p = minutesPrompt({ today: TODAY, date: meeting.date, title: meeting.title, projectName: getProject(meeting.projectId)?.name ?? meeting.projectId, attendees, agenda: meeting.agenda, carried, notes });
    const r = await ai.run(() => aiJson<Parameters<typeof normalizeMinutes>[0]>("meeting-minutes", { ...p, schema: MINUTES_SCHEMA }));
    if (!r) return;
    const d = normalizeMinutes(r, { date: meeting.date, attendees });
    setDraft({ ...d, rows: d.actions.map((a) => ({ ...a, on: true })) });
  };
  const setRow = (i: number, patch: Partial<Row>) => setDraft((d) => (d ? { ...d, rows: d.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) } : d));

  if (!open)
    return (
      <div>
        <AiButton onClick={() => setOpen(true)}>ให้ AI ร่างบันทึกประชุมจากโน้ต</AiButton>
      </div>
    );

  return (
    <AiPanel title="ร่างบันทึกประชุมจากโน้ต" onClose={() => setOpen(false)}>
      {!draft && (
        <>
          <p className="text-[12px] text-ink-3">วางโน้ตดิบ หรือกดไมโครโฟนแล้วพูดสรุป AI จะเรียบเรียงบันทึก มติ และงานที่ต้องทำ (จับคู่ผู้รับผิดชอบกับรายชื่อผู้เข้าประชุม) ให้ตรวจก่อนใส่</p>
          <DictateBox label="โน้ตการประชุม" value={notes} onChange={setNotes} rows={6} placeholder="เช่น ผู้รับเหมาไฟฟ้าแจ้งตู้ MDB มาส่งช้า 1 สัปดาห์ ที่ประชุมให้ส่ง shop drawing ภายในศุกร์นี้ เจ้าของบ้านยืนยันสีผนังห้องนอน..." />
          <AiError text={ai.error} onClose={ai.clearError} />
          {ai.busy ? (
            <AiBusy onCancel={ai.cancel} label="AI กำลังเรียบเรียงบันทึก" />
          ) : (
            <div>
              <AiButton disabled={notes.trim().length < 10} onClick={go}>
                ร่างบันทึก
              </AiButton>
            </div>
          )}
        </>
      )}
      {draft && (
        <div className="flex flex-col gap-3 text-[13px]">
          <label className="flex flex-col gap-1.5 text-ink-2">
            บันทึกการประชุม
            <textarea className={cx(areaCls, "min-h-[140px]")} value={draft.minutes} onChange={(e) => setDraft({ ...draft, minutes: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1.5 text-ink-2">
            มติที่ประชุม (บรรทัดละมติ)
            <textarea className={areaCls} value={draft.decisions.join("\n")} onChange={(e) => setDraft({ ...draft, decisions: e.target.value.split("\n") })} />
          </label>
          <div className="flex flex-col gap-1.5">
            <span className="text-ink-2">งานที่ต้องดำเนินการ · เลือกเฉพาะที่ต้องการเพิ่ม</span>
            {draft.rows.length === 0 && <p className="text-ink-3">ไม่พบงานที่มอบหมายในโน้ต</p>}
            {draft.rows.map((r, i) => (
              <div key={i} className="grid grid-cols-[20px_1fr] items-start gap-2 sm:grid-cols-[20px_1fr_180px_140px_32px] sm:items-center">
                <input type="checkbox" checked={r.on} onChange={(e) => setRow(i, { on: e.target.checked })} aria-label="เพิ่มงานนี้" className="mt-2 size-4 accent-[var(--ink)] sm:mt-0" />
                <input value={r.text} onChange={(e) => setRow(i, { text: e.target.value })} aria-label="งาน" className={cx(inputCls, "h-8 text-[13px]")} />
                <div className="col-start-2 sm:col-start-auto">
                  <input value={r.owner} onChange={(e) => setRow(i, { owner: e.target.value, matched: attendees.some((a) => a.name === e.target.value) })} list="eng-people" aria-label="ผู้รับผิดชอบ" className={cx(inputCls, "h-8 w-full text-[13px]", !r.matched && "border-warn")} />
                  {!r.matched && <span className="text-[11px] text-warn">ไม่อยู่ในรายชื่อผู้เข้าประชุม</span>}
                </div>
                <input type="date" value={r.due} onChange={(e) => setRow(i, { due: e.target.value })} aria-label="กำหนดเสร็จ" className={cx(inputCls, "col-start-2 h-8 font-mono text-[13px] sm:col-start-auto")} />
                <IconBtn label="ลบงาน" danger onClick={() => setDraft({ ...draft, rows: draft.rows.filter((_, j) => j !== i) })}>
                  <Trash2 {...I} />
                </IconBtn>
              </div>
            ))}
          </div>
          <p className="text-[12px] text-ink-3">เมื่อกดใส่ บันทึกและมติจะแทนที่ข้อความเดิมในหน้านี้ (ยังต้องกดบันทึกด้านบน) · งานที่เลือกจะถูกเพิ่มเป็นงานค้างของการประชุมนี้ทันที</p>
          <div className="flex flex-wrap justify-end gap-2">
            <Btn small onClick={() => setDraft(null)}>
              กลับไปแก้โน้ต
            </Btn>
            <Btn
              small
              primary
              disabled={!draft.minutes.trim() && !draft.rows.some((r) => r.on)}
              onClick={() => {
                onApply({ minutes: draft.minutes, decisions: draft.decisions.filter((x) => x.trim()), agenda: draft.agenda, actions: draft.rows.filter((r) => r.on && r.text.trim() && r.owner.trim()) });
                setDraft(null);
                setNotes("");
                setOpen(false);
              }}
            >
              ใส่ในรายงานการประชุม
            </Btn>
          </div>
        </div>
      )}
    </AiPanel>
  );
}
