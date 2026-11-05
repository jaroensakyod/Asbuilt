"use client";

// RFI and NCR drafting from a rough Thai note + photos, and the supervision report narrative.

import { useState } from "react";
import { aiJson } from "@/lib/ai/client";
import { NCR_SCHEMA, ncrPrompt, normalizeNcr, normalizeRfi, normalizeSupervision, RFI_SCHEMA, rfiPrompt, SUPERVISION_SCHEMA, supervisionPrompt, type DiaryDigest, type NcrDraft, type RfiDraft, type SupervisionDraft, type TestDigest } from "@/lib/ai-field/engineering";
import { siteDiaries, WEATHER_LABEL } from "@/lib/biz";
import { getProject, TODAY } from "@/lib/data";
import { concreteTests, ncrs, pileTests, PILE_RESULT_LABEL } from "@/lib/engineering";
import type { MediaRef } from "@/lib/media";
import { AiBusy, AiButton, AiError, AiFilledNote, AiPanel, photosToAi, useAiRun } from "./ai-bits";
import { DictateBox } from "./dictate";

function NoteDraft<T>({ title, hint, placeholder, button, run, onDone, allowEmptyNote }: { title: string; hint: string; placeholder: string; button: string; run: (note: string) => Promise<T>; onDone: (r: T) => string[]; allowEmptyNote?: boolean }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [filled, setFilled] = useState<string[]>([]);
  const ai = useAiRun();
  if (!open)
    return (
      <div className="flex flex-wrap items-center gap-2">
        <AiButton onClick={() => setOpen(true)}>{title}</AiButton>
        <AiFilledNote fields={filled} />
      </div>
    );
  return (
    <AiPanel title={title} onClose={() => setOpen(false)}>
      <p className="text-[12px] text-ink-3">{hint}</p>
      <DictateBox label={title} value={note} onChange={setNote} rows={3} placeholder={placeholder} />
      <AiError text={ai.error} onClose={ai.clearError} />
      {ai.busy ? (
        <AiBusy onCancel={ai.cancel} label="AI กำลังร่าง" />
      ) : (
        <div>
          <AiButton
            disabled={!allowEmptyNote && note.trim().length < 6}
            onClick={async () => {
              const r = await ai.run(() => run(note));
              if (r === undefined) return;
              setFilled(onDone(r));
              setOpen(false);
            }}
          >
            {button}
          </AiButton>
        </div>
      )}
    </AiPanel>
  );
}

export function RfiAssist({ projectId, sheets, attachments, onApply }: { projectId: string; sheets: readonly { id: string; titleTh: string }[]; attachments: readonly MediaRef[]; onApply: (d: RfiDraft) => void }) {
  return (
    <NoteDraft
      title="ให้ AI เรียบเรียงคำถาม RFI"
      hint="พิมพ์หรือพูดสิ่งที่พบแบบสั้น ๆ AI จะเขียนเป็นคำถามทางการ ระบุหมวดงาน ตำแหน่ง และความเร่งด่วน (ใช้รูปที่แนบด้านล่างประกอบ) แล้วกรอกลงฟอร์มให้ตรวจ"
      placeholder="เช่น เหล็กคาน B2 แบบโครงสร้างเขียน DB16 4 เส้น แต่รายการคำนวณเป็น DB20 จะเทพรุ่งนี้"
      button="ร่าง RFI"
      run={async (note) => {
        const files = await photosToAi(attachments, 3);
        const p = rfiPrompt({ today: TODAY, projectName: getProject(projectId)?.name ?? (projectId || "-"), note, sheets, photoCount: files.length });
        return normalizeRfi(await aiJson("rfi-draft", { ...p, files, schema: RFI_SCHEMA }), sheets);
      }}
      onDone={(d) => {
        onApply(d);
        return ["เรื่อง", "คำถาม", "หมวดงาน", "ความเร่งด่วน", ...(d.location ? ["ตำแหน่ง"] : []), ...(d.sheet ? ["แผ่นแบบ"] : [])];
      }}
    />
  );
}

export function NcrAssist({ projectId, photos, onApply }: { projectId: string; photos: readonly MediaRef[]; onApply: (d: NcrDraft) => void }) {
  return (
    <NoteDraft
      title="ให้ AI ร่าง NCR จากโน้ตและรูป"
      hint="บอกสิ่งที่พบสั้น ๆ (หรือเว้นว่างถ้าแนบรูปแล้ว) AI จะร่างรายละเอียด สาเหตุ การแก้ไข และการป้องกัน เป็นข้อเสนอให้ผู้รับผิดชอบยืนยัน"
      placeholder="เช่น เสาชั้น 4 แนว C/3 ถอดแบบแล้วเจอรูพรุนเห็นเหล็ก ประมาณ 30x40 ซม."
      button="ร่าง NCR"
      allowEmptyNote={photos.length > 0}
      run={async (note) => {
        const files = await photosToAi(photos, 3);
        if (!files.length && note.trim().length < 6) throw new Error("ใส่โน้ตหรือแนบรูปก่อน");
        const p = ncrPrompt({ today: TODAY, projectName: getProject(projectId)?.name ?? (projectId || "-"), note, photoCount: files.length });
        return normalizeNcr(await aiJson("ncr-draft", { ...p, files, schema: NCR_SCHEMA }));
      }}
      onDone={(d) => {
        onApply(d);
        return ["หัวข้อ", "รายละเอียด", "หมวดงาน", "ความรุนแรง", "สาเหตุ", "การแก้ไข", "การป้องกัน"];
      }}
    />
  );
}

/** supervision narrative from the period's site diaries, material tests and open NCRs */
export function SupervisionAssist({ projectId, from, to, engineer, onApply }: { projectId: string; from: string; to: string; engineer: string; onApply: (d: SupervisionDraft, diaryIds: string[]) => void }) {
  const ai = useAiRun();
  const [filled, setFilled] = useState<string[]>([]);
  const go = async () => {
    const ds = siteDiaries.all().filter((x) => x.projectId === projectId && x.date >= from && x.date <= to).sort((a, b) => a.date.localeCompare(b.date));
    const diaries: DiaryDigest[] = ds.map((x) => ({
      date: x.date,
      weather: `${WEATHER_LABEL[x.weatherAm]}/${WEATHER_LABEL[x.weatherPm]}${x.rainHours ? ` ฝน ${x.rainHours} ชม.` : ""}`,
      headcount: x.manpower.reduce((s, m) => s + m.count, 0),
      work: x.work.map((w) => `${w.text}${w.pct !== undefined ? ` ${w.pct}%` : ""}`),
      issues: x.issues,
      safety: x.safety,
    }));
    const tests: TestDigest[] = [
      ...concreteTests
        .all()
        .filter((t) => t.projectId === projectId && t.pourDate >= from && t.pourDate <= to)
        .map((t) => ({ date: t.pourDate, text: `เทคอนกรีต ${t.element}${t.volume ? ` ${t.volume} ลบ.ม.` : ""} fc ${t.fc} ksc${t.slump !== undefined ? ` slump ${t.slump} ซม.` : ""}${t.sets.some((s) => s.results.length) ? ` ผลกด ${t.sets.map((s) => `${s.age} วัน: ${s.results.join("/") || "รอ"}`).join(", ")}` : ""}` })),
      ...concreteTests
        .all()
        .filter((t) => t.projectId === projectId && t.sets.some((s) => s.testedAt && s.testedAt >= from && s.testedAt <= to) && !(t.pourDate >= from && t.pourDate <= to))
        .map((t) => ({ date: t.sets.find((s) => s.testedAt)?.testedAt ?? t.pourDate, text: `ผลกดก้อนตัวอย่าง ${t.element} fc ${t.fc} ksc: ${t.sets.map((s) => `${s.age} วัน ${s.results.join("/") || "รอ"}`).join(", ")}` })),
      ...pileTests
        .all()
        .filter((t) => t.projectId === projectId && t.date >= from && t.date <= to)
        .map((t) => ({ date: t.date, text: `ทดสอบเสาเข็ม ${t.pileNo} (${t.method}) ผล ${PILE_RESULT_LABEL[t.result]}${t.capacity ? ` รับได้ ${t.capacity} ตัน` : ""}` })),
    ];
    const open = ncrs
      .all()
      .filter((n) => n.projectId === projectId && n.status !== "closed")
      .map((n) => `${n.id} ${n.title} (${n.location})`);
    const p = supervisionPrompt({ today: TODAY, projectName: getProject(projectId)?.name ?? projectId, from, to, engineer, diaries, tests, ncrs: open });
    const r = await ai.run(() => aiJson<Partial<SupervisionDraft>>("supervision-report", { ...p, schema: SUPERVISION_SCHEMA }));
    if (!r) return;
    onApply(normalizeSupervision(r), ds.map((x) => x.id));
    setFilled(["งานที่ตรวจ", "การทดสอบ", "ข้อสั่งการ", "ปัญหา", `อ้างอิงรายงานประจำวัน ${ds.length} ฉบับ`]);
  };
  return (
    <div className="flex flex-col gap-2">
      {ai.busy ? (
        <AiBusy onCancel={ai.cancel} label="AI กำลังสรุปจากรายงานประจำวันและผลทดสอบ" />
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <AiButton disabled={!projectId || from > to} onClick={go}>
            ให้ AI ร่างจากรายงานประจำวันและผลทดสอบ
          </AiButton>
          <AiFilledNote fields={filled} />
        </div>
      )}
      <AiError text={ai.error} onClose={ai.clearError} />
    </div>
  );
}
