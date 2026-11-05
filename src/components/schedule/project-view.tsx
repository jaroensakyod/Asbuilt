"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Download, Flag, Plus, Search, X } from "lucide-react";
import { Card, cx, inputCls, PageHeader } from "@/components/ui";
import { Btn, Empty, I, IconBtn, Modal, Pill, Segmented, Select, StatCard } from "@/components/ops/bits";
import { MediaStrip } from "@/components/media/media-field";
import { COST_CODES, money as fmtMoney, type ProgressEntry } from "@/lib/biz";
import { thDate, TODAY, STATUS_LABEL } from "@/lib/data";
import {
  calOf,
  cpm,
  progressAware,
  createFromTemplate,
  diffDays,
  durationOf,
  leavesOf,
  newTaskId,
  rollup,
  setBaseline,
  summaryOf,
  taskState,
  TASK_STATE_LABEL,
  useScheduleCtx,
  type TaskState,
} from "@/lib/schedule";
import { DaysLate, downloadCsv, fmtIdx, fmtM, fmtPct, idxTone, ProgressBar, SOURCE_LABEL, StatePill, useAllProjects, useSchedulePerms } from "./bits";
import { Gantt, ganttRows, type GanttRow, type Zoom } from "./gantt";
import { EvPanel } from "./ev-panel";
import { LookAhead } from "./lookahead";
import { nextCode, TaskModal, type SchedTask } from "./task-modal";

type Tab = "gantt" | "list" | "lookahead" | "ev" | "log";
const th = "px-3 py-2 text-left text-[12px] font-normal text-ink-3 whitespace-nowrap";
const td = "px-3 py-2 align-top";

export function ProjectSchedule({ id }: { id: string }) {
  const perms = useSchedulePerms();
  const projects = useAllProjects();
  const project = projects.find((p) => p.id === id);
  const ctx = useScheduleCtx();
  const sp = useSearchParams();
  const [tab, setTab] = useState<Tab>("gantt");
  const [open, setOpen] = useState<{ id: string; tab?: "detail" | "progress" } | null>(() => (sp.get("task") ? { id: sp.get("task")!, tab: "progress" } : null));
  const [draft, setDraft] = useState<SchedTask | null>(null);
  const [msg, setMsg] = useState("");
  const [baselineAsk, setBaselineAsk] = useState(false);
  const [zoom, setZoom] = useState<Zoom>("week");
  const [showBaseline, setShowBaseline] = useState(true);
  const [showLinks, setShowLinks] = useState(true);
  const [critOnly, setCritOnly] = useState(false);
  const [crew, setCrew] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const tasks = useMemo(() => ctx.tasks.filter((t) => t.projectId === id) as SchedTask[], [ctx.tasks, id]);
  const entries = useMemo(() => ctx.entries.filter((e) => e.projectId === id), [ctx.entries, id]);
  const cal = useMemo(() => calOf(ctx.settings), [ctx.settings]);
  const leaves = useMemo(() => leavesOf(tasks), [tasks]);
  const res = useMemo(() => cpm(progressAware(leaves), cal), [leaves, cal]);
  const cpmRows = useMemo(() => (res.ok ? res.rows : {}), [res]);
  const critical = useMemo(() => new Set(res.ok ? res.critical : []), [res]);
  const roll = useMemo(() => rollup(tasks), [tasks]);
  const summary = useMemo(() => (project ? summaryOf(project, ctx, { withSeries: tab === "ev" }) : undefined), [project, ctx, tab]);
  const crews = useMemo(() => [...new Set(leaves.map((t) => t.crew).filter(Boolean) as string[])].sort(), [leaves]);

  const match = useCallback((t: SchedTask) => (!critOnly || critical.has(t.id)) && (!crew || t.crew === crew), [critOnly, critical, crew]);
  const rows = useMemo(() => ganttRows(tasks, roll, cpmRows, collapsed, critOnly || crew ? match : undefined), [tasks, roll, cpmRows, collapsed, match, critOnly, crew]);
  const durOf = useCallback((r: GanttRow) => (r.summary ? diffDays(r.start, r.finish) + 1 : (cpmRows[r.t.id]?.dur ?? durationOf(r.t.start, r.t.finish, cal, r.t.milestone))), [cpmRows, cal]);

  if (!project) return <Empty>ไม่พบโครงการ {id}</Empty>;

  const openTask = (tid: string, t?: "detail" | "progress") => setOpen({ id: tid, tab: t });
  const current = open ? tasks.find((t) => t.id === open.id) : undefined;
  const addTask = () => {
    const start = TODAY > project.start ? TODAY : project.start;
    setDraft({ id: newTaskId(id), projectId: id, code: nextCode(tasks), name: "", start, finish: start, deps: [], value: 0, pct: 0 });
  };
  const toggle = (tid: string) =>
    setCollapsed((s) => {
      const n = new Set(s);
      if (n.has(tid)) n.delete(tid);
      else n.add(tid);
      return n;
    });
  const groups = tasks.filter((t) => roll.get(t.id) && tasks.some((x) => x.parentId === t.id));

  const exportCsv = () => {
    const byId = new Map(tasks.map((t) => [t.id, t]));
    const sorted = ganttRows(tasks, roll, cpmRows, new Set());
    downloadCsv(`WBS-${id}`, [
      ["รหัส WBS", "ชื่องาน", "งานหลัก", "ประเภท", "รหัสต้นทุน", "เริ่ม", "เสร็จ", "ระยะเวลา (วัน)", "เส้นฐานเริ่ม", "เส้นฐานเสร็จ", "งานก่อนหน้า", "มูลค่า (บาท)", "ปริมาณ", "หน่วย", "ทีม/ผู้รับเหมา", "% สะสม", "Float รวม (วัน)", "งานวิกฤต", "สถานะ"],
      ...sorted.map((r) => {
        const t = r.t;
        const c = cpmRows[t.id];
        return [
          t.code,
          t.name,
          t.parentId ? (byId.get(t.parentId)?.code ?? "") : "",
          r.summary ? "งานหลัก" : t.milestone ? "หมุดหมาย" : "งาน",
          t.costCode ?? "",
          r.start,
          r.finish,
          durOf(r),
          r.bs ?? "",
          r.bf ?? "",
          t.deps.map((d) => `${byId.get(d.taskId)?.code ?? d.taskId}${d.type}${d.lag ? (d.lag > 0 ? `+${d.lag}` : d.lag) : ""}`).join(" "),
          r.summary ? (roll.get(t.id)?.value ?? 0) : t.value,
          t.qty ?? "",
          t.unit ?? "",
          t.crew ?? "",
          Math.round(r.pct * 10) / 10,
          c?.totalFloat ?? "",
          c?.critical ? "ใช่" : "",
          r.summary ? "" : TASK_STATE_LABEL[taskState(t, TODAY, ctx.settings.behindPts)],
        ];
      }),
    ]);
  };

  const s = summary;
  return (
    <>
      <PageHeader
        eyebrow={`แผนงาน & ความคืบหน้า · ${project.id}`}
        title={project.name}
        sub={`${STATUS_LABEL[project.status]} · ผู้จัดการโครงการ ${project.pm} · สัญญา ${thDate(project.start)} – ${thDate(project.finish)} · มูลค่า ${project.value.toLocaleString("th-TH")} ล้านบาท`}
        actions={
          tasks.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <Btn small onClick={exportCsv}>
                <Download {...I} />
                CSV
              </Btn>
              {perms.edit && (
                <>
                  <Btn small onClick={() => setBaselineAsk(true)}>
                    <Flag {...I} />
                    ตั้งเส้นฐาน (baseline)
                  </Btn>
                  <Btn small primary onClick={addTask}>
                    <Plus {...I} />
                    เพิ่มงาน
                  </Btn>
                </>
              )}
            </div>
          )
        }
      />

      {tasks.length === 0 ? (
        <Card>
          <Empty>
            โครงการนี้ยังไม่มีแผนงาน (WBS)
            {perms.edit && (
              <span className="mt-4 flex justify-center gap-2">
                <Btn
                  primary
                  onClick={() => {
                    createFromTemplate(project);
                    setMsg("สร้าง WBS จากแม่แบบแล้ว ตรวจสอบระยะเวลาและมูลค่าแต่ละงานก่อนตั้งเส้นฐาน");
                  }}
                >
                  สร้าง WBS จากแม่แบบ{project.modelCode.startsWith("CD") ? "อาคารชุด" : ` บ้าน ${project.floors} ชั้น`}
                </Btn>
                <Btn onClick={addTask}>เริ่มจากงานเปล่า</Btn>
              </span>
            )}
          </Empty>
        </Card>
      ) : (
        <>
          {s && (
            <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-5">
              <StatCard label="ความคืบหน้า (ถ่วงมูลค่า)" value={fmtPct(s.pct)} note={`ตามแผน ${fmtPct(s.planPct)} · เสร็จ ${s.done}/${s.tasks} งาน`} extra={<ProgressBar actual={s.pct} plan={s.planPct} />} />
              <StatCard label="SPI" value={fmtIdx(s.spi)} tone={idxTone(s.spi, ctx.settings.spiWarn) === "neg" ? "neg" : undefined} note={s.spi === undefined ? "ยังไม่ถึงกำหนดเริ่ม" : s.spi >= 1 ? "เร็วกว่าหรือตามแผน" : "ช้ากว่าแผน"} onClick={() => setTab("ev")} active={tab === "ev"} />
              <StatCard label="CPI" value={fmtIdx(s.cpi)} tone={idxTone(s.cpi, 0.95) === "neg" ? "neg" : undefined} note={s.cpi === undefined ? "ยังไม่มีต้นทุนจริง" : s.cpi >= 1 ? "ต้นทุนต่ำกว่ามูลค่างาน" : "ต้นทุนสูงกว่ามูลค่างาน"} onClick={() => setTab("ev")} />
              <StatCard label="คาดการณ์แล้วเสร็จ" value={s.forecastFinish ? thDate(s.forecastFinish) : "–"} note={<DaysLate d={s.daysLate} />} tone={s.daysLate > 0 ? "neg" : undefined} />
              <StatCard
                label="งานวิกฤตล่าช้า"
                value={s.criticalLate}
                unit="งาน"
                tone={s.criticalLate ? "neg" : undefined}
                note={`ล่าช้าทั้งหมด ${s.late} · ควรเริ่มแล้ว ${s.dueNotStarted}`}
                active={critOnly && tab === "gantt"}
                onClick={() => {
                  setTab("gantt");
                  setCritOnly(!critOnly);
                }}
              />
            </div>
          )}

          {!res.ok && <p className="mb-3 rounded-[10px] bg-neg-soft px-4 py-2.5 text-[13px] text-neg">ความสัมพันธ์ของงานเป็นวงวน ({res.cycle.join(" → ")}) แก้ไขงานก่อนหน้าเพื่อคำนวณเส้นทางวิกฤต</p>}
          {msg && (
            <div className="mb-3 flex items-center justify-between gap-3 rounded-[10px] bg-accent-soft px-4 py-2 text-[13px] text-accent-text">
              {msg}
              <IconBtn label="ปิด" onClick={() => setMsg("")}>
                <X {...I} />
              </IconBtn>
            </div>
          )}

          <div className="mb-3 overflow-x-auto">
            <Segmented
              value={tab}
              onChange={setTab}
              options={[
                { key: "gantt", label: "แกนต์ชาร์ต" },
                { key: "list", label: "รายการงาน" },
                { key: "lookahead", label: `Look-ahead ${ctx.settings.lookaheadWeeks} สัปดาห์` },
                { key: "ev", label: "Earned value" },
                { key: "log", label: "ประวัติความคืบหน้า" },
              ]}
            />
          </div>

          {tab === "gantt" && (
            <Card>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-2.5">
                <Segmented
                  value={zoom}
                  onChange={setZoom}
                  options={[
                    { key: "day", label: "วัน" },
                    { key: "week", label: "สัปดาห์" },
                    { key: "month", label: "เดือน" },
                  ]}
                />
                <Check label="เส้นฐาน" v={showBaseline} set={setShowBaseline} />
                <Check label="ความสัมพันธ์" v={showLinks} set={setShowLinks} />
                <Check label="เฉพาะงานวิกฤต" v={critOnly} set={setCritOnly} />
                <div className="w-full sm:w-[220px]">
                  <Select label="ทีมช่าง" value={crew} onChange={setCrew}>
                    <option value="">ทุกทีม</option>
                    {crews.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </Select>
                </div>
                <div className="ml-auto flex gap-2">
                  <Btn small onClick={() => setCollapsed(new Set(groups.map((g) => g.id)))}>
                    ย่อทั้งหมด
                  </Btn>
                  <Btn small onClick={() => setCollapsed(new Set())}>
                    ขยายทั้งหมด
                  </Btn>
                </div>
              </div>
              {rows.length ? (
                <Gantt rows={rows} zoom={zoom} today={TODAY} showBaseline={showBaseline} showLinks={showLinks} selected={open?.id} collapsed={collapsed} onToggle={toggle} onSelect={(tid) => openTask(tid)} durOf={durOf} />
              ) : (
                <Empty>ไม่มีงานตามตัวกรอง</Empty>
              )}
              <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-line px-4 py-2.5 text-[12px] text-ink-3">
                <LegendBox className="border border-line-strong bg-deep">งาน</LegendBox>
                <LegendBox className="border border-accent bg-accent-soft">งานวิกฤต</LegendBox>
                <LegendBox className="bg-ink-2">ความคืบหน้า</LegendBox>
                <LegendBox className="h-[3px] bg-ink-3/50">เส้นฐาน</LegendBox>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block size-2 rotate-45 bg-ink" />
                  หมุดหมาย
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-3 border-l border-dashed border-ink" />
                  วันนี้ {thDate(TODAY)}
                </span>
                {res.ok && <span className="ml-auto font-mono">เสร็จตามแผนปัจจุบัน {thDate(res.finish)}</span>}
              </div>
            </Card>
          )}

          {tab === "list" && <TaskList rows={ganttRows(tasks, roll, cpmRows, new Set())} cpmRows={cpmRows} durOf={durOf} behindPts={ctx.settings.behindPts} money={perms.money} onSelect={openTask} />}

          {tab === "lookahead" && <LookAhead project={project} leaves={leaves} critical={critical} weeks={ctx.settings.lookaheadWeeks} behindPts={ctx.settings.behindPts} onSelect={(tid) => openTask(tid, "progress")} />}

          {tab === "ev" && s?.ev && <EvPanel ev={s.ev} money={perms.money} spiWarn={ctx.settings.spiWarn} contractFinish={project.finish} />}

          {tab === "log" && <ProgressLog entries={entries} tasks={tasks} onSelect={(tid) => openTask(tid, "progress")} />}
        </>
      )}

      {current && (
        <TaskModal
          key={current.id}
          task={current}
          tasks={tasks}
          entries={entries}
          row={cpmRows[current.id]}
          roll={roll.get(current.id)}
          settings={ctx.settings}
          initialTab={open?.tab ?? (perms.edit ? "detail" : "progress")}
          onClose={() => setOpen(null)}
          onDone={setMsg}
        />
      )}
      {draft && <TaskModal key={draft.id} task={draft} isNew tasks={tasks} entries={[]} settings={ctx.settings} onClose={() => setDraft(null)} onDone={setMsg} />}

      <Modal
        open={baselineAsk}
        onClose={() => setBaselineAsk(false)}
        title="ตั้งเส้นฐาน (baseline)"
        width={520}
        footer={
          <>
            <Btn onClick={() => setBaselineAsk(false)}>ยกเลิก</Btn>
            <Btn
              primary
              onClick={() => {
                setBaseline(id);
                setBaselineAsk(false);
                setMsg("ตั้งเส้นฐานใหม่จากวันที่ปัจจุบันแล้ว");
              }}
            >
              ตั้งเส้นฐาน
            </Btn>
          </>
        }
      >
        <p className="text-[14px] text-ink-2">คัดลอกวันเริ่ม–เสร็จปัจจุบันของทุกงาน ({tasks.length} รายการ) ไปเป็นเส้นฐานใหม่ เส้นฐานเดิมจะถูกแทนที่ และค่า PV / SPI จะคำนวณจากเส้นฐานใหม่</p>
        <p className="mt-2 text-[13px] text-ink-3">ใช้เมื่ออนุมัติแผนงานครั้งแรก หรือเมื่อได้รับอนุมัติขยายเวลา (งานเปลี่ยนแปลง/ขยายสัญญา)</p>
      </Modal>
    </>
  );
}

function Check({ label, v, set }: { label: string; v: boolean; set: (v: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-1.5 text-[13px] text-ink-2">
      <input type="checkbox" className="accent-[var(--accent)]" checked={v} onChange={(e) => set(e.target.checked)} />
      {label}
    </label>
  );
}

function LegendBox({ className, children }: { className: string; children: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cx("inline-block h-2.5 w-5 rounded-[2px]", className)} />
      {children}
    </span>
  );
}

function TaskList({ rows, cpmRows, durOf, behindPts, money, onSelect }: { rows: GanttRow[]; cpmRows: Record<string, { totalFloat: number; critical: boolean }>; durOf: (r: GanttRow) => number; behindPts: number; money: boolean; onSelect: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [state, setState] = useState<"" | TaskState>("");
  const needle = q.trim().toLowerCase();
  const list = rows.filter((r) => (!needle || `${r.t.code} ${r.t.name} ${r.t.crew ?? ""}`.toLowerCase().includes(needle)) && (!state || (!r.summary && taskState(r.t, TODAY, behindPts) === state)));
  return (
    <Card>
      <div className="grid grid-cols-2 gap-3 border-b border-line px-4 py-3 lg:grid-cols-4">
        <div className="relative col-span-2">
          <Search {...I} className="pointer-events-none absolute left-2.5 top-2.5 text-ink-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหารหัส ชื่องาน ทีม" className={cx(inputCls, "w-full pl-8")} />
        </div>
        <Select label="สถานะงาน" value={state} onChange={(v) => setState(v as "" | TaskState)}>
          <option value="">ทุกสถานะ</option>
          {(Object.keys(TASK_STATE_LABEL) as TaskState[]).map((k) => (
            <option key={k} value={k}>
              {TASK_STATE_LABEL[k]}
            </option>
          ))}
        </Select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] border-collapse text-[13px]">
          <thead>
            <tr>
              <th className={cx(th, "pl-5")}>รหัส</th>
              <th className={th}>งาน</th>
              <th className={th}>ทีม/ผู้รับเหมา</th>
              <th className={th}>รหัสต้นทุน</th>
              <th className={th}>เริ่ม – เสร็จ</th>
              <th className={th}>เทียบเส้นฐาน</th>
              <th className={cx(th, "text-right")}>วัน</th>
              <th className={cx(th, "text-right")}>Float</th>
              <th className={cx(th, "text-right")}>มูลค่า</th>
              <th className={cx(th, "w-[120px]")}>%</th>
              <th className={cx(th, "pr-5")}>สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => {
              const slip = r.bf ? diffDays(r.bf, r.finish) : 0;
              const c = cpmRows[r.t.id];
              return (
                <tr key={r.t.id} onClick={() => onSelect(r.t.id)} className={cx("cursor-pointer border-t border-line transition-colors duration-150 hover:bg-raised/60", r.summary && "bg-raised/30")}>
                  <td className={cx(td, "pl-5 font-mono text-[12px] text-ink-3")}>{r.t.code}</td>
                  <td className={td}>
                    <span className={cx("block max-w-[300px] truncate", r.summary && "font-medium", r.critical && "text-accent-text")} style={{ paddingLeft: r.depth * 12 }}>
                      {r.t.milestone && <span className="mr-1.5 inline-block size-2 rotate-45 bg-ink align-middle" />}
                      {r.t.name}
                    </span>
                  </td>
                  <td className={cx(td, "max-w-[180px] truncate text-ink-2")}>{r.t.crew ?? ""}</td>
                  <td className={cx(td, "text-ink-2")}>{r.t.costCode ? <span title={COST_CODES[r.t.costCode]} className="font-mono text-[12px]">{r.t.costCode}</span> : ""}</td>
                  <td className={cx(td, "whitespace-nowrap font-mono text-[12px]")}>
                    {thDate(r.start)} – {thDate(r.finish)}
                  </td>
                  <td className={cx(td, "whitespace-nowrap font-mono text-[12px]")}>{r.bf ? slip > 0 ? <span className="text-neg">ช้า {slip} วัน</span> : slip < 0 ? <span className="text-pos">เร็ว {-slip} วัน</span> : <span className="text-ink-3">ตรง</span> : "–"}</td>
                  <td className={cx(td, "text-right font-mono text-[12px]")}>{r.t.milestone ? 0 : durOf(r)}</td>
                  <td className={cx(td, "text-right font-mono text-[12px]")}>{c ? <span className={c.critical ? "text-accent-text" : "text-ink-2"}>{c.totalFloat}</span> : ""}</td>
                  <td className={cx(td, "text-right font-mono text-[12px]")}>{money ? fmtMoney(r.summary ? 0 : r.t.value) : "•••"}</td>
                  <td className={td}>
                    <ProgressBar actual={r.pct} plan={r.bs && r.bf ? Math.min(100, Math.max(0, ((diffDays(r.bs, TODAY) + 1) / (diffDays(r.bs, r.bf) + 1)) * 100)) : 0} />
                    <span className="mt-1 block font-mono text-[11px] text-ink-3">{fmtPct(r.pct, 0)}</span>
                  </td>
                  <td className={cx(td, "pr-5")}>
                    {r.summary ? null : (
                      <span className="flex flex-wrap gap-1">
                        <StatePill s={taskState(r.t, TODAY, behindPts)} />
                        {r.critical && <Pill tone="accent">วิกฤต</Pill>}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {list.length === 0 && <Empty>ไม่พบงาน</Empty>}
      {money && (
        <p className="border-t border-line px-5 py-2.5 text-right font-mono text-[12px] text-ink-3">
          มูลค่ารวม {fmtM(rows.filter((r) => !r.summary).reduce((s, r) => s + (r.t.value || 0), 0))} ล้านบาท
        </p>
      )}
    </Card>
  );
}

function ProgressLog({ entries, tasks, onSelect }: { entries: ProgressEntry[]; tasks: SchedTask[]; onSelect: (id: string) => void }) {
  const [src, setSrc] = useState("");
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const list = entries.filter((e) => !src || e.source === src).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const shown = list.slice(0, 200);
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <p className="text-[13px] text-ink-2">{list.length} รายการวัดผล</p>
        <div className="w-full sm:w-[220px]">
          <Select label="แหล่งข้อมูล" value={src} onChange={setSrc}>
            <option value="">ทุกแหล่ง</option>
            {Object.entries(SOURCE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <ul>
        {shown.map((e) => {
          const t = byId.get(e.taskId);
          return (
            <li key={e.id} className="border-t border-line first:border-t-0">
              <button type="button" onClick={() => onSelect(e.taskId)} className="flex w-full items-start gap-4 px-5 py-2.5 text-left transition-colors duration-150 hover:bg-raised/60">
                <span className="w-[72px] shrink-0 font-mono text-[12px] text-ink-3">{thDate(e.date)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px]">
                    <span className="font-mono text-[12px] text-ink-3">{t?.code}</span> {t?.name ?? e.taskId}
                  </span>
                  <span className="block text-[12px] text-ink-3">
                    {SOURCE_LABEL[e.source]} · {e.by}
                    {e.note ? ` · ${e.note}` : ""}
                  </span>
                  <MediaStrip refs={e.photos} size={40} className="mt-1.5" />
                </span>
                <span className="num shrink-0 font-mono text-[13px]">{e.pct}%</span>
              </button>
            </li>
          );
        })}
      </ul>
      {list.length === 0 && <Empty>ยังไม่มีการบันทึกความคืบหน้า</Empty>}
      {list.length > shown.length && <p className="border-t border-line px-5 py-2.5 text-[12px] text-ink-3">แสดง 200 รายการล่าสุด</p>}
      <p className="border-t border-line px-5 py-2.5 text-[12px] text-ink-3">
        บันทึกจากหน้างานผ่านแกนต์ชาร์ตหรือ Look-ahead · ดูภาพรวมทุกโครงการที่ <Link href="/schedule" className="underline">แผนงานทุกโครงการ</Link>
      </p>
    </Card>
  );
}
