"use client";

import { onTenantLoad } from "@/lib/workspace";
import { useState } from "react";
import { Field, cx, inputCls } from "@/components/ui";
import { checklists, projects, SYSTEM_LABEL, team, TODAY, type SystemKey } from "@/lib/data";
import { addInspection, updateInspection, type OpsInspection } from "@/lib/ops-store";
import { PHASES, PHASE_SYSTEMS } from "./seed";
import { Btn, Modal } from "./bits";

// live arrays: refilled when a company is loaded
export const INSPECTORS: string[] = [];
const PROJECTS: typeof projects = [];
const fillLists = () => {
  INSPECTORS.splice(0, INSPECTORS.length, ...team.filter((m) => m.active && (m.role === "qc" || m.role === "engineer" || m.role === "pm" || m.role === "foreman" || m.role === "admin")).map((m) => m.name));
  PROJECTS.splice(0, PROJECTS.length, ...projects.filter((p) => p.status !== "planning"));
};
fillLists();
onTenantLoad(fillLists);

export function InspectionForm({ open, onClose, edit, onSaved }: { open: boolean; onClose: () => void; edit?: OpsInspection; onSaved?: (ins: OpsInspection) => void }) {
  return open ? <FormBody key={edit?.id ?? "new"} onClose={onClose} edit={edit} onSaved={onSaved} /> : null;
}

function FormBody({ onClose, edit, onSaved }: { onClose: () => void; edit?: OpsInspection; onSaved?: (ins: OpsInspection) => void }) {
  const [projectId, setProjectId] = useState(edit?.projectId ?? PROJECTS[0]?.id ?? "");
  const [phase, setPhase] = useState(edit?.phase ?? (PROJECTS[0] && PHASES.includes(PROJECTS[0].phase) ? PROJECTS[0].phase : PHASES[0]));
  const [title, setTitle] = useState(edit?.title ?? "");
  const [systems, setSystems] = useState<SystemKey[]>(() => edit?.systems ?? PHASE_SYSTEMS[phase] ?? []);
  const [location, setLocation] = useState(edit?.location ?? "ชั้น 1");
  const [inspector, setInspector] = useState(edit?.inspector ?? INSPECTORS[0] ?? "");
  const [date, setDate] = useState(edit?.date ?? TODAY);
  const [time, setTime] = useState(edit?.time ?? "09:00");
  const project = projects.find((p) => p.id === projectId);
  const template = checklists[phase] ?? [];
  const floors = project?.floors ?? 2;
  const locations = ["ทั้งหลัง", ...Array.from({ length: floors }, (_, i) => `ชั้น ${i + 1}`), "หลังคา", "ภายนอก"];
  const valid = !!projectId && !!phase && !!inspector && !!date;

  const pickPhase = (v: string) => {
    setPhase(v);
    setSystems(PHASE_SYSTEMS[v] ?? []);
  };
  const toggle = (s: SystemKey) => setSystems((x) => (x.includes(s) ? x.filter((y) => y !== s) : [...x, s]));

  const save = () => {
    if (!valid) return;
    const data = {
      projectId,
      phase,
      title: title.trim() || `ตรวจ${phase} ${location}`,
      systems,
      location,
      inspector,
      date,
      time,
      items: edit && edit.phase === phase ? edit.items : template.length,
    };
    if (edit) {
      updateInspection(edit.id, data);
      onSaved?.({ ...edit, ...data });
    } else {
      const ins = addInspection({ ...data, result: "scheduled" });
      onSaved?.(ins);
    }
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={edit ? `แก้ไขการตรวจสอบ ${edit.id}` : "สร้างการตรวจสอบ"}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary onClick={save} disabled={!valid}>
            {edit ? "บันทึก" : "สร้างและนัดตรวจ"}
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="โครงการ">
          <select
            value={projectId}
            onChange={(e) => {
              setProjectId(e.target.value);
              const np = projects.find((x) => x.id === e.target.value);
              if (!edit && np && PHASES.includes(np.phase)) pickPhase(np.phase);
            }}
            className={inputCls}
          >
            {PROJECTS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} · {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="งวดงาน">
          <select value={phase} onChange={(e) => pickPhase(e.target.value)} className={inputCls}>
            {PHASES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </Field>
        <div className="col-span-2">
          <Field label="หัวข้อการตรวจ">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`ตรวจ${phase} ${location}`} className={inputCls} />
          </Field>
        </div>
        <div className="col-span-2 flex flex-col gap-1.5 text-[13px] text-ink-2">
          ระบบงานที่ตรวจ
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(SYSTEM_LABEL) as SystemKey[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggle(s)}
                aria-pressed={systems.includes(s)}
                className={cx("h-8 rounded-[8px] border px-3 text-[13px] transition-colors duration-150", systems.includes(s) ? "border-ink bg-ink text-card" : "border-line-strong bg-card text-ink-2 hover:bg-raised")}
              >
                {SYSTEM_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
        <Field label="ตำแหน่ง / ชั้น">
          <select value={location} onChange={(e) => setLocation(e.target.value)} className={inputCls}>
            {locations.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </Field>
        <Field label="ผู้ตรวจ">
          <select value={inspector} onChange={(e) => setInspector(e.target.value)} className={inputCls}>
            {INSPECTORS.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </Field>
        <Field label="วันที่นัดตรวจ">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </Field>
        <Field label="เวลา">
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} />
        </Field>
      </div>
      <div className="mt-5 rounded-[10px] border border-line bg-raised/50 px-4 py-3">
        <p className="text-[13px] text-ink-2">
          เช็กลิสต์มาตรฐาน {phase} <span className="num font-mono text-ink-3">{template.length} รายการ</span>
        </p>
        <ol className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-[13px] text-ink-3">
          {template.map((t) => (
            <li key={t.id} className="truncate">
              <span className="mr-1.5 font-mono text-[12px]">{t.id}</span>
              {t.text}
            </li>
          ))}
        </ol>
      </div>
    </Modal>
  );
}
