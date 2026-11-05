"use client";

import { useMemo, useState } from "react";
import { cx, Field, inputCls } from "@/components/ui";
import { Btn, Modal, Select } from "@/components/ops/bits";
import { MediaField } from "@/components/media/media-field";
import { getProject, TODAY } from "@/lib/data";
import { sheetIndex } from "@/lib/drawing/sheets";
import { addDays, DISC_LABEL, DISCS, nextRfiId, PRIORITY_LABEL, rfis, type Disc, type Priority, type Rfi } from "@/lib/engineering";
import { Area, Check, PeopleList, ProjectSelect, useEngPerms } from "./bits";
import { RfiAssist } from "@/components/ai-field/eng-assist";

const DUE_BY_PRIORITY: Record<Priority, number> = { urgent: 2, high: 5, normal: 7, low: 14 };

/** Sheets of the project's house model for the drawing picker (cheap index, no geometry). */
function useSheets(projectId: string) {
  return useMemo(() => {
    const p = getProject(projectId);
    if (!p) return [];
    try {
      return sheetIndex(p.modelCode);
    } catch {
      return [];
    }
  }, [projectId]);
}

export function RfiForm({ open, onClose, edit, initProject, onSaved }: { open: boolean; onClose: () => void; edit?: Rfi; initProject?: string; onSaved?: (r: Rfi) => void }) {
  if (!open) return null;
  return <Inner key={edit?.id ?? "new"} onClose={onClose} edit={edit} initProject={initProject} onSaved={onSaved} />;
}

function Inner({ onClose, edit, initProject, onSaved }: { onClose: () => void; edit?: Rfi; initProject?: string; onSaved?: (r: Rfi) => void }) {
  const { me } = useEngPerms();
  const [projectId, setProjectId] = useState(edit?.projectId ?? initProject ?? "");
  const [subject, setSubject] = useState(edit?.subject ?? "");
  const [question, setQuestion] = useState(edit?.question ?? "");
  const [proposal, setProposal] = useState(edit?.proposal ?? "");
  const [disc, setDisc] = useState<Disc>(edit?.disc ?? "S");
  const [sheet, setSheet] = useState(edit?.sheet ?? "");
  const [location, setLocation] = useState(edit?.location ?? "");
  const [assignedTo, setAssignedTo] = useState(edit?.assignedTo ?? "");
  const [priority, setPriority] = useState<Priority>(edit?.priority ?? "normal");
  const [due, setDue] = useState(edit?.due ?? addDays(TODAY, DUE_BY_PRIORITY.normal));
  const [costImpact, setCost] = useState(edit?.costImpact ?? false);
  const [timeImpact, setTime] = useState(edit?.timeImpact ?? false);
  const [attachments, setAttachments] = useState(edit?.attachments ?? []);
  const sheets = useSheets(projectId);
  const discSheets = sheets.filter((s) => s.disc === disc);
  const ok = projectId && subject.trim() && question.trim() && assignedTo.trim() && due;

  const save = () => {
    if (!ok) return;
    const head = edit ?? { ...nextRfiId(projectId), raisedBy: me.name, raisedAt: TODAY, status: "open" as const, thread: [] };
    const r: Rfi = {
      ...head,
      projectId,
      subject: subject.trim(),
      question: question.trim(),
      proposal: proposal.trim() || undefined,
      disc,
      sheet: sheet.trim() || undefined,
      location: location.trim() || undefined,
      assignedTo: assignedTo.trim(),
      priority,
      due,
      costImpact,
      timeImpact,
      attachments,
    };
    rfis.upsert(r);
    onSaved?.(r);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={edit ? `แก้ไข ${edit.id}` : "สร้าง RFI (ขอคำชี้แจงแบบ)"}
      width={720}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary onClick={save} disabled={!ok}>
            {edit ? "บันทึก" : "ส่ง RFI"}
          </Btn>
        </>
      }
    >
      <PeopleList />
      <div className="mb-4">
        <RfiAssist
          projectId={projectId}
          sheets={sheets}
          attachments={attachments}
          onApply={(d) => {
            if (d.subject) setSubject(d.subject);
            if (d.question) setQuestion(d.question);
            if (d.proposal) setProposal(d.proposal);
            setDisc(d.disc);
            if (d.location) setLocation(d.location);
            if (d.sheet) setSheet(d.sheet);
            setPriority(d.priority);
            if (!edit) setDue(addDays(TODAY, DUE_BY_PRIORITY[d.priority]));
            setCost(d.costImpact);
            setTime(d.timeImpact);
          }}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="โครงการ">
          {edit ? <input value={`${projectId} · ${getProject(projectId)?.name ?? ""}`} disabled className={inputCls} /> : <ProjectSelect value={projectId} onChange={setProjectId} required />}
        </Field>
        <Field label="หมวดงาน">
          <Select label="หมวดงาน" value={disc} onChange={(v) => setDisc(v as Disc)}>
            {DISCS.map((k) => (
              <option key={k} value={k}>
                {DISC_LABEL[k]}
              </option>
            ))}
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="เรื่อง">
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="สรุปสั้น ๆ เช่น ระยะทาบเหล็กคานไม่ตรงรายการประกอบแบบ" className={inputCls} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="คำถาม / สิ่งที่พบ">
            <Area value={question} onChange={setQuestion} rows={4} placeholder="ระบุแบบ ตำแหน่ง และสิ่งที่ขัดแย้งหรือไม่ชัดเจน" />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="แนวทางที่หน้างานเสนอ (ถ้ามี)">
            <Area value={proposal} onChange={setProposal} rows={2} />
          </Field>
        </div>
        <Field label="แผ่นแบบอ้างอิง">
          {discSheets.length ? (
            <Select label="แผ่นแบบอ้างอิง" value={sheet} onChange={setSheet}>
              <option value="">ไม่ระบุ</option>
              {sheet && !discSheets.some((s) => s.id === sheet) && <option value={sheet}>{sheet}</option>}
              {discSheets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id} · {s.titleTh}
                </option>
              ))}
            </Select>
          ) : (
            <input value={sheet} onChange={(e) => setSheet(e.target.value)} placeholder="เช่น S-101" className={cx(inputCls, "font-mono")} />
          )}
        </Field>
        <Field label="ตำแหน่ง">
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="เช่น คาน B2-04 แนวแกน C/3" className={inputCls} />
        </Field>
        <Field label="ส่งถึง (ผู้ต้องตอบ)">
          <input list="eng-people" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} placeholder="ผู้ออกแบบ / ที่ปรึกษา" className={inputCls} />
        </Field>
        <Field label="ความเร่งด่วน">
          <Select
            label="ความเร่งด่วน"
            value={priority}
            onChange={(v) => {
              setPriority(v as Priority);
              if (!edit) setDue(addDays(TODAY, DUE_BY_PRIORITY[v as Priority]));
            }}
          >
            {(Object.keys(PRIORITY_LABEL) as Priority[]).map((k) => (
              <option key={k} value={k}>
                {PRIORITY_LABEL[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="ต้องการคำตอบภายใน">
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={cx(inputCls, "font-mono")} />
        </Field>
        <div className="flex flex-col justify-end gap-2 pb-1">
          <Check checked={costImpact} onChange={setCost}>
            อาจกระทบค่าใช้จ่าย
          </Check>
          <Check checked={timeImpact} onChange={setTime}>
            อาจกระทบระยะเวลา
          </Check>
        </div>
        <div className="sm:col-span-2">
          <MediaField value={attachments} onChange={setAttachments} label="รูปหน้างานและไฟล์แนบ" />
        </div>
      </div>
    </Modal>
  );
}
