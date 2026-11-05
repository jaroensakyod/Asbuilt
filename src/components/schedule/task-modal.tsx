"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { cx, Field, inputCls } from "@/components/ui";
import { areaCls, Btn, I, IconBtn, KV, Modal, Pill, Segmented, Select } from "@/components/ops/bits";
import { MediaField, MediaStrip } from "@/components/media/media-field";
import { COST_CODES, money, type CostCode, type DepType, type ProgressEntry, type WbsTask } from "@/lib/biz";
import { thDate, TODAY } from "@/lib/data";
import type { MediaRef } from "@/lib/media";
import {
  calOf,
  compareCode,
  deleteProgress,
  deleteTask,
  durationOf,
  finishFrom,
  leavesOf,
  newProgressId,
  recordProgress,
  saveTask,
  summaryIds,
  taskState,
  wouldCycle,
  type CpmRow,
  type Rolled,
  type SchedTask,
  type ScheduleSettings,
} from "@/lib/schedule";
export type { SchedTask };
import { DEP_LABEL, fmtPct, SOURCE_LABEL, StatePill, useSchedulePerms } from "./bits";


/** next free WBS code under a parent ("3.4") or at the top level ("12") */
export function nextCode(tasks: WbsTask[], parentId?: string) {
  const parent = parentId ? tasks.find((t) => t.id === parentId) : undefined;
  const sib = tasks.filter((t) => (t.parentId ?? "") === (parentId ?? ""));
  const last = Math.max(0, ...sib.map((t) => Number(t.code.split(".").pop()) || 0));
  return parent ? `${parent.code}.${last + 1}` : String(last + 1);
}

export function TaskModal({
  task,
  isNew,
  tasks,
  entries,
  row,
  roll,
  settings,
  initialTab = "detail",
  onClose,
  onDone,
}: {
  task: SchedTask;
  isNew?: boolean;
  tasks: SchedTask[];
  entries: ProgressEntry[];
  row?: CpmRow;
  roll?: Rolled;
  settings: ScheduleSettings;
  initialTab?: "detail" | "progress";
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const perms = useSchedulePerms();
  const sums = useMemo(() => summaryIds(tasks), [tasks]);
  const isSummary = sums.has(task.id);
  const [tab, setTab] = useState<"detail" | "progress">(isSummary || isNew ? "detail" : initialTab);
  const title = isNew ? "เพิ่มงาน" : `${task.code} ${task.name}`;
  return (
    <Modal open onClose={onClose} title={title} width={780}>
      {!isNew && !isSummary && (
        <div className="mb-4">
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { key: "detail", label: "รายละเอียดงาน" },
              { key: "progress", label: "บันทึกความคืบหน้า" },
            ]}
          />
        </div>
      )}
      {tab === "detail" ? (
        <DetailForm task={task} isNew={isNew} tasks={tasks} isSummary={isSummary} row={row} roll={roll} settings={settings} canEdit={perms.edit} onClose={onClose} onDone={onDone} />
      ) : (
        <ProgressForm task={task} entries={entries.filter((e) => e.taskId === task.id)} me={perms.me.name} role={perms.me.role} canRecord={perms.progress} canDelete={perms.edit} onDone={onDone} />
      )}
    </Modal>
  );
}

function DetailForm({
  task,
  isNew,
  tasks,
  isSummary,
  row,
  roll,
  settings,
  canEdit,
  onClose,
  onDone,
}: {
  task: SchedTask;
  isNew?: boolean;
  tasks: SchedTask[];
  isSummary: boolean;
  row?: CpmRow;
  roll?: Rolled;
  settings: ScheduleSettings;
  canEdit: boolean;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const cal = calOf(settings);
  const [d, setD] = useState<SchedTask>(task);
  const [dur, setDur] = useState(() => durationOf(task.start, task.finish, cal, task.milestone));
  const [err, setErr] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const set = (p: Partial<SchedTask>) => setD((x) => ({ ...x, ...p }));
  const group = isSummary || !!d.group;

  // descendants cannot be predecessors or parents
  const below = useMemo(() => {
    const s = new Set([task.id]);
    for (let grew = true; grew; ) {
      grew = false;
      for (const t of tasks)
        if (t.parentId && s.has(t.parentId) && !s.has(t.id)) {
          s.add(t.id);
          grew = true;
        }
    }
    return s;
  }, [tasks, task.id]);
  const sums = summaryIds(tasks);
  const parents = tasks.filter((t) => (sums.has(t.id) || t.group) && !below.has(t.id)).sort((a, b) => compareCode(a.code, b.code));
  const preds = (leavesOf(tasks) as SchedTask[])
    .filter((t) => !below.has(t.id) && !t.group)
    .sort((a, b) => compareCode(a.code, b.code));
  const crews = [...new Set(tasks.map((t) => t.crew).filter(Boolean) as string[])].sort();

  const setStart = (start: string) => set({ start, finish: d.milestone ? start : finishFrom(start, dur, cal) });
  const setFinish = (finish: string) => {
    set({ finish });
    setDur(durationOf(d.start, finish, cal, d.milestone));
  };
  const setDuration = (n: number) => {
    const v = Math.max(1, Math.round(n) || 1);
    setDur(v);
    set({ finish: finishFrom(d.start, v, cal) });
  };

  const save = () => {
    setErr("");
    if (!d.name.trim()) return setErr("กรอกชื่องาน");
    if (!d.code.trim()) return setErr("กรอกรหัส WBS");
    if (!d.start || (!d.milestone && !d.finish) || (!d.milestone && d.finish < d.start)) return setErr("วันที่ไม่ถูกต้อง");
    const deps = group ? [] : d.deps.filter((x) => x.taskId);
    if (new Set(deps.map((x) => x.taskId)).size !== deps.length) return setErr("มีงานก่อนหน้าซ้ำกัน");
    if (!group && wouldCycle(leavesOf([...tasks.filter((t) => t.id !== d.id), d]), d.id, deps)) return setErr("ความสัมพันธ์นี้ทำให้เกิดวงวน (งานอ้างอิงกันเป็นวง) กรุณาเลือกงานก่อนหน้าใหม่");
    const out: SchedTask = { ...d, name: d.name.trim(), code: d.code.trim(), deps, finish: d.milestone ? d.start : d.finish, value: group ? 0 : Math.max(0, d.value || 0) };
    if (!out.parentId) delete out.parentId;
    const r = saveTask(out);
    if (!r.ok) return setErr("ความสัมพันธ์ของงานเป็นวงวน คำนวณแผนไม่ได้");
    onDone(r.moved.length ? `บันทึกแล้ว · คำนวณแผนใหม่ เลื่อนงานที่ตามมา ${r.moved.length} งาน` : "บันทึกแล้ว");
    onClose();
  };
  const remove = () => {
    deleteTask(task.id);
    onDone(`ลบงาน ${task.code} แล้ว`);
    onClose();
  };

  const ro = !canEdit;
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
        <Field label="รหัส WBS">
          <input value={d.code} disabled={ro} onChange={(e) => set({ code: e.target.value })} className={cx(inputCls, "font-mono")} />
        </Field>
        <div className="col-span-2 sm:col-span-5">
          <Field label="ชื่องาน">
            <input value={d.name} disabled={ro} onChange={(e) => set({ name: e.target.value })} className={inputCls} />
          </Field>
        </div>
        <div className="col-span-2 sm:col-span-3">
          <Field label="อยู่ภายใต้งานหลัก">
            <Select label="งานหลัก" value={d.parentId ?? ""} onChange={(v) => set({ parentId: v || undefined, ...(isNew ? { code: nextCode(tasks, v || undefined) } : {}) })} className={ro ? "pointer-events-none opacity-70" : ""}>
              <option value="">— ระดับบนสุด —</option>
              {parents.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code} {t.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {!group && (
          <div className="col-span-2 sm:col-span-3">
            <Field label="รหัสต้นทุน">
              <Select label="รหัสต้นทุน" value={d.costCode ?? ""} onChange={(v) => set({ costCode: (v || undefined) as CostCode | undefined })} className={ro ? "pointer-events-none opacity-70" : ""}>
                <option value="">—</option>
                {Object.entries(COST_CODES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {k} {v}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}
      </div>

      {isNew && (
        <label className="flex items-center gap-2 text-[13px] text-ink-2">
          <input type="checkbox" className="accent-[var(--accent)]" checked={!!d.group} onChange={(e) => set({ group: e.target.checked || undefined, milestone: undefined, deps: [], value: 0 })} />
          เป็นงานหลัก (กลุ่มงาน) — วันที่ มูลค่า และ % คำนวณจากงานย่อย
        </label>
      )}

      {group ? (
        roll && (
          <div className="grid grid-cols-2 gap-x-6">
            <KV k="ช่วงงาน">
              <span className="font-mono">
                {thDate(roll.start)} – {thDate(roll.finish)}
              </span>
            </KV>
            <KV k="เส้นฐาน">
              <span className="font-mono">{roll.baselineStart ? `${thDate(roll.baselineStart)} – ${thDate(roll.baselineFinish!)}` : "–"}</span>
            </KV>
            <KV k="มูลค่างานย่อย">
              <span className="num font-mono">{money(roll.value)}</span>
            </KV>
            <KV k="ความคืบหน้า">
              <span className="num font-mono">{fmtPct(roll.pct)}</span>
            </KV>
          </div>
        )
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="วันเริ่ม">
              <input type="date" value={d.start} disabled={ro} onChange={(e) => e.target.value && setStart(e.target.value)} className={cx(inputCls, "font-mono")} />
            </Field>
            <Field label={d.milestone ? "ระยะเวลา" : `ระยะเวลา (วัน${settings.skipSundays ? "ทำงาน" : ""})`}>
              <input type="number" min={1} value={d.milestone ? 0 : dur} disabled={ro || d.milestone} onChange={(e) => setDuration(Number(e.target.value))} className={cx(inputCls, "num font-mono")} />
            </Field>
            <Field label="วันเสร็จ">
              <input type="date" value={d.milestone ? d.start : d.finish} disabled={ro || d.milestone} min={d.start} onChange={(e) => e.target.value && setFinish(e.target.value)} className={cx(inputCls, "font-mono")} />
            </Field>
            <label className="flex items-end gap-2 pb-2 text-[13px] text-ink-2">
              <input type="checkbox" className="accent-[var(--accent)]" disabled={ro} checked={!!d.milestone} onChange={(e) => set({ milestone: e.target.checked || undefined, finish: e.target.checked ? d.start : finishFrom(d.start, dur, cal) })} />
              หมุดหมาย (milestone)
            </label>
          </div>
          {(task.pct || 0) > 0 ? (
            <p className="-mt-2 text-[12px] text-ink-3">งานเริ่มแล้ว วันเริ่มเป็นวันเริ่มจริงและไม่เลื่อนตามงานก่อนหน้า ปรับวันเสร็จ/ระยะเวลาตามงานที่เหลือได้</p>
          ) : (
            <div className="-mt-1 grid grid-cols-2 items-end gap-3 sm:grid-cols-4">
              <Field label="เริ่มไม่ก่อนวันที่ (ถ้ามี)">
                <input type="date" value={d.notBefore ?? ""} disabled={ro} onChange={(e) => set({ notBefore: e.target.value || undefined })} className={cx(inputCls, "font-mono")} />
              </Field>
              <p className="col-span-1 pb-2 text-[12px] text-ink-3 sm:col-span-3">{row?.driven ? "วันเริ่มกำหนดโดยงานก่อนหน้า เมื่อบันทึกระบบจะคำนวณวันเริ่มใหม่ตามความสัมพันธ์ (แก้ระยะเวลาได้)" : "งานไม่มีงานก่อนหน้า เริ่มตามวันที่กำหนด"} · ใช้ “เริ่มไม่ก่อน” เมื่อรอวัสดุ ใบอนุญาต หรือพื้นที่หน้างาน</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="มูลค่างาน (บาท)">
              <input type="number" min={0} step={1000} value={d.value || 0} disabled={ro} onChange={(e) => set({ value: Number(e.target.value) })} className={cx(inputCls, "num text-right font-mono")} />
            </Field>
            <Field label="ปริมาณงาน">
              <input type="number" min={0} value={d.qty ?? ""} disabled={ro} onChange={(e) => set({ qty: e.target.value === "" ? undefined : Number(e.target.value) })} className={cx(inputCls, "num text-right font-mono")} />
            </Field>
            <Field label="หน่วย">
              <input value={d.unit ?? ""} disabled={ro} onChange={(e) => set({ unit: e.target.value || undefined })} placeholder="ลบ.ม. / ตร.ม. / ต้น" className={inputCls} />
            </Field>
            <Field label="ทีมช่าง / ผู้รับเหมา">
              <input list="sched-crews" value={d.crew ?? ""} disabled={ro} onChange={(e) => set({ crew: e.target.value || undefined })} className={inputCls} />
              <datalist id="sched-crews">
                {crews.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[13px] text-ink-2">งานก่อนหน้า (ความสัมพันธ์)</span>
              {!ro && (
                <Btn small onClick={() => set({ deps: [...d.deps, { taskId: "", type: "FS", lag: 0 }] })}>
                  <Plus {...I} />
                  เพิ่มความสัมพันธ์
                </Btn>
              )}
            </div>
            {d.deps.length === 0 && <p className="rounded-[8px] border border-dashed border-line-strong px-3 py-2.5 text-[13px] text-ink-3">ไม่มีงานก่อนหน้า — งานเริ่มตามวันที่กำหนดเอง</p>}
            <div className="grid gap-2">
              {d.deps.map((dep, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_170px_90px_auto]">
                  <Select label="งานก่อนหน้า" value={dep.taskId} onChange={(v) => set({ deps: d.deps.map((x, j) => (j === i ? { ...x, taskId: v } : x)) })} className={ro ? "pointer-events-none opacity-70" : ""}>
                    <option value="">เลือกงาน…</option>
                    {preds.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.code} {t.name}
                      </option>
                    ))}
                  </Select>
                  <div className="col-span-2 row-start-2 grid grid-cols-2 gap-2 sm:col-span-2 sm:col-start-2 sm:row-start-1">
                    <Select label="ชนิดความสัมพันธ์" value={dep.type} onChange={(v) => set({ deps: d.deps.map((x, j) => (j === i ? { ...x, type: v as DepType } : x)) })} className={ro ? "pointer-events-none opacity-70" : ""}>
                      {(Object.keys(DEP_LABEL) as DepType[]).map((k) => (
                        <option key={k} value={k}>
                          {DEP_LABEL[k]}
                        </option>
                      ))}
                    </Select>
                    <input type="number" aria-label="lag (วัน)" title="lag (วัน) ค่าลบ = เริ่มซ้อนก่อน" value={dep.lag} disabled={ro} onChange={(e) => set({ deps: d.deps.map((x, j) => (j === i ? { ...x, lag: Math.round(Number(e.target.value) || 0) } : x)) })} className={cx(inputCls, "num text-right font-mono")} />
                  </div>
                  {!ro && (
                    <IconBtn label="ลบความสัมพันธ์" danger onClick={() => set({ deps: d.deps.filter((_, j) => j !== i) })}>
                      <Trash2 {...I} />
                    </IconBtn>
                  )}
                </div>
              ))}
            </div>
            {d.deps.length > 0 && <p className="mt-1.5 text-[12px] text-ink-3">ตัวเลขท้ายแถวคือ lag เป็นวัน{settings.skipSundays ? "ทำงาน" : ""} (ค่าลบ = เริ่มซ้อนก่อน)</p>}
          </div>

          {row && !isNew && (
            <div className="grid grid-cols-2 gap-x-6 rounded-[10px] bg-raised/60 px-3 py-2">
              <KV k="เริ่มเร็ว / ช้าสุด">
                <span className="font-mono">
                  {thDate(row.start)} / {thDate(row.lateStart)}
                </span>
              </KV>
              <KV k="เสร็จเร็ว / ช้าสุด">
                <span className="font-mono">
                  {thDate(row.finish)} / {thDate(row.lateFinish)}
                </span>
              </KV>
              <KV k="Float รวม / อิสระ">
                <span className="font-mono">
                  {row.totalFloat} / {row.freeFloat} วัน
                </span>
              </KV>
              <KV k="สถานะ">
                <span className="flex flex-wrap gap-1">
                  {row.critical && <Pill tone="accent">งานวิกฤต</Pill>}
                  <StatePill s={taskState(task, TODAY, settings.behindPts)} />
                </span>
              </KV>
              {task.baselineStart && (
                <KV k="เส้นฐาน" wide>
                  <span className="font-mono">
                    {thDate(task.baselineStart)} – {thDate(task.baselineFinish!)}
                    {task.finish !== task.baselineFinish && <span className="ml-2 text-neg">({task.finish > task.baselineFinish! ? "ช้ากว่า" : "เร็วกว่า"}เส้นฐาน)</span>}
                  </span>
                </KV>
              )}
            </div>
          )}
        </>
      )}

      {err && <p className="rounded-[8px] bg-neg-soft px-3 py-2 text-[13px] text-neg">{err}</p>}

      <div className="-mx-5 -mb-4 flex items-center justify-between gap-2 border-t border-line px-5 py-3">
        <div>
          {!isNew &&
            canEdit &&
            (confirmDel ? (
              <span className="flex items-center gap-2 text-[13px] text-neg">
                ลบงานนี้{isSummary ? "และงานย่อยทั้งหมด" : ""}พร้อมประวัติความคืบหน้า?
                <Btn small danger onClick={remove}>
                  ยืนยันลบ
                </Btn>
                <Btn small onClick={() => setConfirmDel(false)}>
                  ไม่ลบ
                </Btn>
              </span>
            ) : (
              <Btn small danger onClick={() => setConfirmDel(true)}>
                <Trash2 {...I} />
                ลบงาน
              </Btn>
            ))}
        </div>
        <div className="flex gap-2">
          <Btn onClick={onClose}>{canEdit ? "ยกเลิก" : "ปิด"}</Btn>
          {canEdit && (
            <Btn primary onClick={save}>
              บันทึก
            </Btn>
          )}
        </div>
      </div>
    </div>
  );
}

function ProgressForm({ task, entries, me, role, canRecord, canDelete, onDone }: { task: WbsTask; entries: ProgressEntry[]; me: string; role: string; canRecord: boolean; canDelete: boolean; onDone: (msg: string) => void }) {
  const [date, setDate] = useState(TODAY);
  const [pct, setPct] = useState(task.pct || 0);
  const [qty, setQty] = useState<number | undefined>(task.qty ? Math.round((task.qty * (task.pct || 0)) / 100) : undefined);
  const [source, setSource] = useState<ProgressEntry["source"]>(role === "foreman" ? "foreman" : role === "subcontractor" ? "subcontractor" : "engineer");
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<MediaRef[]>([]);
  const [err, setErr] = useState("");
  const list = [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

  const setPctV = (v: number) => {
    const n = Math.max(0, Math.min(100, Math.round(v)));
    setPct(n);
    if (task.qty) setQty(Math.round((task.qty * n) / 100));
  };
  const setQtyV = (v: number | undefined) => {
    setQty(v);
    if (task.qty && v !== undefined) setPct(Math.max(0, Math.min(100, Math.round((v / task.qty) * 100))));
  };
  const save = () => {
    setErr("");
    if (date > TODAY) return setErr("วันที่วัดผลต้องไม่เกินวันนี้");
    recordProgress({ id: newProgressId(task.projectId), projectId: task.projectId, taskId: task.id, date, pct, qtyToDate: qty, by: me, source, note: note.trim() || undefined, photos: photos.length ? photos : undefined });
    onDone(`บันทึกความคืบหน้า ${task.code} เป็น ${pct}%`);
    setNote("");
    setPhotos([]);
  };

  return (
    <div className="grid gap-4">
      {canRecord ? (
        <div className="grid gap-3 rounded-[12px] border border-line p-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="วันที่วัดผล">
              <input type="date" value={date} max={TODAY} onChange={(e) => e.target.value && setDate(e.target.value)} className={cx(inputCls, "font-mono")} />
            </Field>
            <Field label="ความคืบหน้าสะสม (%)">
              <input type="number" min={0} max={100} value={pct} onChange={(e) => setPctV(Number(e.target.value))} className={cx(inputCls, "num text-right font-mono")} />
            </Field>
            <Field label={`ปริมาณสะสม${task.unit ? ` (${task.unit})` : ""}`}>
              <input type="number" min={0} value={qty ?? ""} disabled={!task.qty} placeholder={task.qty ? `จาก ${task.qty}` : "ไม่ได้กำหนดปริมาณ"} onChange={(e) => setQtyV(e.target.value === "" ? undefined : Number(e.target.value))} className={cx(inputCls, "num text-right font-mono")} />
            </Field>
            <Field label="แหล่งข้อมูล">
              <Select label="แหล่งข้อมูล" value={source} onChange={(v) => setSource(v as ProgressEntry["source"])}>
                {(Object.keys(SOURCE_LABEL) as ProgressEntry["source"][]).map((k) => (
                  <option key={k} value={k}>
                    {SOURCE_LABEL[k]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <input type="range" min={0} max={100} step={5} value={pct} onChange={(e) => setPctV(Number(e.target.value))} aria-label="ความคืบหน้า" className="w-full accent-[var(--accent)]" />
          <Field label="หมายเหตุ">
            <textarea value={note} onChange={(e) => setNote(e.target.value)} className={areaCls} placeholder="สิ่งที่ทำได้ ปัญหา สาเหตุที่ล่าช้า" />
          </Field>
          <MediaField value={photos} onChange={setPhotos} label="รูปถ่ายหน้างาน" photosOnly geotag />
          {err && <p className="rounded-[8px] bg-neg-soft px-3 py-2 text-[13px] text-neg">{err}</p>}
          <div className="flex justify-end">
            <Btn primary onClick={save}>
              บันทึกความคืบหน้า
            </Btn>
          </div>
        </div>
      ) : (
        <p className="text-[13px] text-ink-3">บทบาทของคุณดูได้อย่างเดียว</p>
      )}

      <div>
        <p className="mb-2 text-[13px] text-ink-2">ประวัติการวัดผล ({list.length})</p>
        {list.length === 0 && <p className="text-[13px] text-ink-3">ยังไม่มีการบันทึก</p>}
        <ul className="grid gap-2">
          {list.map((e) => (
            <li key={e.id} className="rounded-[10px] border border-line px-3 py-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px]">
                    <span className="num font-mono font-medium">{e.pct}%</span>
                    {e.qtyToDate !== undefined && task.unit && (
                      <span className="ml-2 font-mono text-ink-3">
                        {e.qtyToDate.toLocaleString("th-TH")} {task.unit}
                      </span>
                    )}
                    <span className="ml-2 text-ink-3">
                      {thDate(e.date)} · {SOURCE_LABEL[e.source]} · {e.by}
                    </span>
                  </p>
                  {e.note && <p className="mt-0.5 text-[13px] text-ink-2">{e.note}</p>}
                </div>
                {canDelete && (
                  <IconBtn label="ลบรายการ" danger onClick={() => deleteProgress(e.id)}>
                    <Trash2 {...I} />
                  </IconBtn>
                )}
              </div>
              <MediaStrip refs={e.photos} size={48} className="mt-2" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
