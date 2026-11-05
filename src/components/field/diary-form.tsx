"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { cx, Field, inputCls } from "@/components/ui";
import { areaCls, Btn, I, IconBtn, Modal, Select } from "@/components/ops/bits";
import { MediaField } from "@/components/media/media-field";
import { subcontractors, wbsTasks, WEATHER_LABEL, type Weather } from "@/lib/biz";
import { getProject, thDate } from "@/lib/data";
import { diaryTotals } from "@/lib/field/calc";
import { saveDiary, submitDiary } from "@/lib/field/store";
import type { Diary } from "@/lib/field/types";
import { WEATHERS } from "./bits";
import { AiPill } from "@/components/ai-field/ai-bits";
import { DiaryAssist } from "@/components/ai-field/diary-assist";
import type { DiaryFields } from "@/lib/ai-field/diary";

const num = (s: string) => Math.max(0, Number(s.replace(/[^\d.]/g, "")) || 0);
const OWN = "ทีมบริษัท";

export function DiaryForm({ initial, onClose, onSaved }: { initial: Diary; onClose: () => void; onSaved?: (d: Diary) => void }) {
  const [d, setD] = useState<Diary>(initial);
  const [aiFilled, setAiFilled] = useState<DiaryFields[]>([]);
  const ai = (k: DiaryFields) => aiFilled.includes(k);
  const subs = subcontractors.use();
  const allTasks = wbsTasks.use();
  const tasks = useMemo(() => allTasks.filter((t) => t.projectId === d.projectId && !t.milestone && !allTasks.some((c) => c.parentId === t.id)).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })), [allTasks, d.projectId]);
  const p = getProject(d.projectId);
  const set = <K extends keyof Diary>(k: K, v: Diary[K]) => setD((x) => ({ ...x, [k]: v }));
  const tot = diaryTotals(d);
  const groups = useMemo(() => [OWN, ...subs.map((s) => s.name)], [subs]);

  const setMan = (i: number, patch: Partial<Diary["manpower"][number]>) =>
    set(
      "manpower",
      d.manpower.map((m, j) => {
        if (j !== i) return m;
        const next = { ...m, ...patch };
        if (patch.group !== undefined) next.subcontractorId = subs.find((s) => s.name === patch.group)?.id;
        return next;
      }),
    );
  const setEq = (i: number, patch: Partial<Diary["equipment"][number]>) => set("equipment", d.equipment.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  const setWork = (i: number, patch: Partial<Diary["work"][number]>) => set("work", d.work.map((m, j) => (j === i ? { ...m, ...patch } : m)));

  const done = (x: Diary) => {
    onSaved?.(x);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      width={920}
      title={`รายงานประจำวัน · ${p?.name ?? d.projectId} · ${thDate(d.date)}`}
      footer={
        <>
          <span className="mr-auto text-[13px] text-ink-3">
            คนงาน <span className="num font-mono text-ink">{tot.headcount}</span> คน (บริษัท {tot.own} · ผู้รับเหมาช่วง {tot.sub}) · เครื่องจักร <span className="num font-mono text-ink">{tot.equipmentHours}</span> ชม.
          </span>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn onClick={() => done(saveDiary(d))}>บันทึกร่าง</Btn>
          <Btn primary onClick={() => done(submitDiary(d))}>
            ส่งให้ผู้จัดการโครงการอนุมัติ
          </Btn>
        </>
      }
    >
      {d.comment && d.status === "draft" && <p className="mb-4 rounded-[10px] bg-warn-soft px-3 py-2 text-[13px] text-warn">ความเห็นผู้ตรวจ: {d.comment}</p>}
      <div className="mb-4">
        <DiaryAssist
          diary={d}
          filled={aiFilled}
          onApply={(x, f) => {
            setD(x);
            setAiFilled(f);
          }}
        />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Field label={ai("weather") ? "อากาศช่วงเช้า · AI" : "อากาศช่วงเช้า"}>
          <Select label="อากาศช่วงเช้า" value={d.weatherAm} onChange={(v) => set("weatherAm", v as Weather)}>
            {WEATHERS.map((w) => (
              <option key={w} value={w}>
                {WEATHER_LABEL[w]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="อากาศช่วงบ่าย">
          <Select label="อากาศช่วงบ่าย" value={d.weatherPm} onChange={(v) => set("weatherPm", v as Weather)}>
            {WEATHERS.map((w) => (
              <option key={w} value={w}>
                {WEATHER_LABEL[w]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="ฝนตก (ชม.)">
          <input className={cx(inputCls, "num font-mono")} inputMode="decimal" value={d.rainHours ?? 0} onChange={(e) => set("rainHours", num(e.target.value))} />
        </Field>
        <Field label="ผู้บันทึก">
          <input className={inputCls} value={d.by} onChange={(e) => set("by", e.target.value)} />
        </Field>
      </div>

      <Section title="กำลังคน" ai={ai("manpower")} onAdd={() => set("manpower", [...d.manpower, { group: OWN, trade: "", count: 1 }])}>
        <datalist id="diary-groups">
          {groups.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
        {d.manpower.map((m, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_88px_32px] items-center gap-2">
            <input className={inputCls} list="diary-groups" value={m.group} onChange={(e) => setMan(i, { group: e.target.value })} aria-label="บริษัท/ทีม" placeholder="ทีม / ผู้รับเหมาช่วง" />
            <input className={inputCls} value={m.trade} onChange={(e) => setMan(i, { trade: e.target.value })} aria-label="ประเภทช่าง" placeholder="ประเภทช่าง" />
            <input className={cx(inputCls, "num text-right font-mono")} inputMode="numeric" value={m.count} onChange={(e) => setMan(i, { count: num(e.target.value) })} aria-label="จำนวนคน" />
            <IconBtn label="ลบแถว" danger onClick={() => set("manpower", d.manpower.filter((_, j) => j !== i))}>
              <Trash2 {...I} />
            </IconBtn>
          </div>
        ))}
      </Section>

      <Section title="เครื่องจักร/อุปกรณ์" ai={ai("equipment")} onAdd={() => set("equipment", [...d.equipment, { name: "", hours: 8 }])}>
        {d.equipment.length === 0 && <p className="text-[13px] text-ink-3">ไม่มีเครื่องจักรวันนี้</p>}
        {d.equipment.map((m, i) => (
          <div key={i} className="grid grid-cols-[1fr_88px_32px] items-center gap-2">
            <input className={inputCls} value={m.name} onChange={(e) => setEq(i, { name: e.target.value })} aria-label="เครื่องจักร" placeholder="เครื่องจักร" />
            <input className={cx(inputCls, "num text-right font-mono")} inputMode="decimal" value={m.hours} onChange={(e) => setEq(i, { hours: num(e.target.value) })} aria-label="ชั่วโมง" />
            <IconBtn label="ลบแถว" danger onClick={() => set("equipment", d.equipment.filter((_, j) => j !== i))}>
              <Trash2 {...I} />
            </IconBtn>
          </div>
        ))}
      </Section>

      <Section title="งานที่ทำวันนี้" ai={ai("work")} onAdd={() => set("work", [...d.work, { text: "" }])}>
        {tasks.length === 0 && <p className="text-[13px] text-ink-3">โครงการนี้ยังไม่มีแผนงาน WBS · บันทึกเป็นข้อความได้ เมื่อมีแผนงานแล้วเลือกงานและใส่ % เพื่ออัปเดตความคืบหน้า</p>}
        {d.work.map((w, i) => (
          <div key={i} className="grid grid-cols-1 items-center gap-2 md:grid-cols-[1fr_220px_88px_32px]">
            <input className={inputCls} value={w.text} onChange={(e) => setWork(i, { text: e.target.value })} aria-label="รายละเอียดงาน" placeholder="รายละเอียดงานที่ทำ" />
            <Select
              label="งานในแผน"
              value={w.taskId ?? ""}
              onChange={(v) => {
                const t = tasks.find((x) => x.id === v);
                setWork(i, { taskId: v || undefined, text: w.text || t?.name || "", pct: v ? (w.pct ?? t?.pct) : w.pct });
              }}
            >
              <option value="">ไม่ผูกงานในแผน</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code} {t.name} ({t.pct}%)
                </option>
              ))}
            </Select>
            <input className={cx(inputCls, "num text-right font-mono")} inputMode="numeric" value={w.pct ?? ""} placeholder="%" onChange={(e) => setWork(i, { pct: e.target.value === "" ? undefined : Math.min(100, num(e.target.value)) })} aria-label="ความคืบหน้าสะสม %" />
            <IconBtn label="ลบแถว" danger onClick={() => set("work", d.work.filter((_, j) => j !== i))}>
              <Trash2 {...I} />
            </IconBtn>
          </div>
        ))}
      </Section>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label={ai("deliveries") ? "วัสดุเข้าหน้างาน · AI" : "วัสดุเข้าหน้างาน"}>
          <textarea className={areaCls} value={d.deliveries ?? ""} onChange={(e) => set("deliveries", e.target.value || undefined)} />
        </Field>
        <Field label={ai("issues") ? "ปัญหา/ความล่าช้า · AI" : "ปัญหา/ความล่าช้า"}>
          <textarea className={areaCls} value={d.issues ?? ""} onChange={(e) => set("issues", e.target.value || undefined)} />
        </Field>
        <Field label={ai("visitors") ? "ผู้เข้าเยี่ยมชม/ตรวจงาน · AI" : "ผู้เข้าเยี่ยมชม/ตรวจงาน"}>
          <textarea className={areaCls} value={d.visitors ?? ""} onChange={(e) => set("visitors", e.target.value || undefined)} />
        </Field>
        <Field label={ai("safety") ? "ความปลอดภัย · AI" : "ความปลอดภัย"}>
          <textarea className={areaCls} value={d.safety ?? ""} onChange={(e) => set("safety", e.target.value || undefined)} />
        </Field>
      </div>
      <div className="mt-4">
        <MediaField value={d.photos} onChange={(photos) => set("photos", photos)} label="รูปหน้างาน" photosOnly />
      </div>
    </Modal>
  );
}

function Section({ title, onAdd, children, ai }: { title: string; onAdd: () => void; children: React.ReactNode; ai?: boolean }) {
  return (
    <section className="mt-5">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-[14px] font-medium">
          {title}
          {ai && <AiPill />}
        </h3>
        <Btn small onClick={onAdd}>
          <Plus {...I} />
          เพิ่มแถว
        </Btn>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}
