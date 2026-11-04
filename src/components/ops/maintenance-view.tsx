"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, Check, ChevronLeft, ChevronRight, List, Plus, Search, Trash2, X } from "lucide-react";
import { AssetTag, Card, Field, cx, inputCls } from "@/components/ui";
import { getProject, projects, SYSTEM_LABEL, TH_MONTH_FULL, thDate, TODAY, type SystemKey } from "@/lib/data";
import { addMaintPlan, deleteMaint, maintState, markMaintDone, useMaintenance, type MaintState, type OpsMaint } from "@/lib/ops-store";
import { addDays, addMonths, projectAssets, TECH_BY_SYSTEM } from "./seed";
import { Btn, Empty, FilterField, I, IconBtn, KV, Modal, Pill, Segmented, Select, StatCard, type Tone } from "./bits";
import { TECHNICIANS } from "./repair-form";

const STATE_LABEL: Record<MaintState, string> = { overdue: "เลยกำหนด", soon: "ใกล้ถึงกำหนด", planned: "ตามแผน", done: "ทำแล้ว" };
const STATE_TONE: Record<MaintState, Tone> = { overdue: "neg", soon: "warn", planned: "neutral", done: "pos" };
const CHIP: Record<MaintState, string> = {
  overdue: "border-neg/40 bg-neg-soft text-neg",
  soon: "border-warn/40 bg-warn-soft text-warn",
  planned: "border-line-strong bg-card text-ink-2",
  done: "border-pos/30 bg-pos-soft text-pos",
};
const DOT: Record<MaintState, string> = { overdue: "bg-neg", soon: "bg-warn", planned: "bg-ink-3", done: "bg-pos" };
const WEEK = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
const TASKS = ["ล้างแอร์ทั้งหลัง", "ตักไขมันและล้างถังดักไขมัน", "ทดสอบเบรกเกอร์กันดูด (RCBO)", "ล้างถังเก็บน้ำ", "ตรวจปั๊มน้ำและถังแรงดัน", "ตรวจรางน้ำฝนและท่อลง", "สูบถังบำบัดน้ำเสีย", "ตรวจเครื่องทำน้ำอุ่นและทดสอบ ELCB", "ตรวจรอยร้าวและยาแนว"];

type Row = OpsMaint & { st: MaintState };
type Filters = { q: string; project: string; system: string; status: string; assignee: string; month: string };
const NO_FILTER: Filters = { q: "", project: "", system: "", status: "", assignee: "", month: "" };
const monthLabel = (ym: string) => `${TH_MONTH_FULL[Number(ym.slice(5, 7)) - 1]} ${Number(ym.slice(0, 4)) + 543}`;

export function MaintenanceView() {
  const raw = useMaintenance();
  const all: Row[] = useMemo(() => raw.map((m) => ({ ...m, st: maintState(m) })), [raw]);
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [month, setMonth] = useState(TODAY.slice(0, 7));
  const [f, setF] = useState<Filters>(NO_FILTER);
  const [formOpen, setFormOpen] = useState(false);
  const [openId, setOpenId] = useState<string | undefined>();
  const [day, setDay] = useState<string | undefined>();
  const set = (k: keyof Filters) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  const stats = useMemo(() => {
    const m = TODAY.slice(0, 7);
    const inMonth = all.filter((x) => x.date.startsWith(m));
    return {
      overdue: all.filter((x) => x.st === "overdue").length,
      soon: all.filter((x) => x.st === "soon").length,
      month: inMonth.length,
      houses: new Set(inMonth.map((x) => x.projectId)).size,
      done30: all.filter((x) => x.st === "done" && (x.doneOn ?? x.date) >= addDays(TODAY, -30)).length,
      done12: all.filter((x) => x.st === "done" && (x.doneOn ?? x.date) >= addDays(TODAY, -365)).length,
    };
  }, [all]);

  const filtered = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    return all
      .filter((x) => !f.project || x.projectId === f.project)
      .filter((x) => !f.system || x.system === f.system)
      .filter((x) => !f.status || x.st === f.status)
      .filter((x) => !f.assignee || x.assignee === f.assignee)
      .filter((x) => !f.month || x.date.startsWith(f.month))
      .filter((x) => {
        if (!q) return true;
        const p = getProject(x.projectId);
        return `${x.id} ${x.task} ${x.asset ?? ""} ${x.owner} ${p?.name ?? ""} ${p?.owner ?? ""}`.toLowerCase().includes(q);
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [all, f]);

  const statFilter = (patch: Partial<Filters>, active: boolean) => {
    setF(active ? NO_FILTER : { ...NO_FILTER, ...patch });
    if (!active) setView("list");
  };
  const listRows = f.status || f.month ? filtered : filtered.filter((x) => x.date.startsWith(month));
  const open = all.find((x) => x.id === openId);
  const isFiltered = JSON.stringify(f) !== JSON.stringify(NO_FILTER);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
        <div>
          <p className="mb-1 text-[13px] text-ink-3">บำรุงรักษาเชิงป้องกัน</p>
          <h1 className="text-[30px] font-normal leading-[1.15]">บำรุงรักษา</h1>
          <p className="mt-2 max-w-[48rem] text-ink-2">ตารางล้างแอร์ ตรวจเครื่องทำน้ำอุ่น สูบถังบำบัด ล้างถังเก็บน้ำ ของบ้านที่ส่งมอบแล้ว แจ้งเตือนก่อนครบกำหนด 14 วัน</p>
        </div>
        <div className="flex items-center gap-2">
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { key: "calendar", label: "ปฏิทิน", icon: <CalendarDays {...I} /> },
              { key: "list", label: "รายการ", icon: <List {...I} /> },
            ]}
          />
          <Btn primary onClick={() => setFormOpen(true)}>
            <Plus {...I} />
            เพิ่มแผนบำรุงรักษา
          </Btn>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="เลยกำหนด" value={stats.overdue} unit="รายการ" tone={stats.overdue ? "neg" : undefined} note="ต้องนัดหมายลูกค้าโดยด่วน · คลิกเพื่อกรอง" active={f.status === "overdue"} onClick={() => statFilter({ status: "overdue" }, f.status === "overdue")} />
        <StatCard label="ใกล้ถึงกำหนด" value={stats.soon} unit="รายการ" note="ภายใน 14 วัน · คลิกเพื่อกรอง" active={f.status === "soon"} onClick={() => statFilter({ status: "soon" }, f.status === "soon")} />
        <StatCard label="ครบกำหนดเดือนนี้" value={stats.month} unit="รายการ" note={`${monthLabel(TODAY.slice(0, 7))} · ดูแล ${stats.houses} หลัง`} active={f.month === TODAY.slice(0, 7) && !f.status} onClick={() => statFilter({ month: TODAY.slice(0, 7) }, f.month === TODAY.slice(0, 7) && !f.status)} />
        <StatCard label="ทำแล้ว 30 วัน" value={stats.done30} unit="รายการ" note={`รอบ 12 เดือน ${stats.done12} รายการ`} active={f.status === "done"} onClick={() => statFilter({ status: "done" }, f.status === "done")} />
      </div>

      <Card className="mb-4 px-4 py-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <FilterField label="ค้นหา" className="col-span-2">
            <div className="relative">
              <Search {...I} className="pointer-events-none absolute left-2.5 top-2.5 text-ink-3" />
              <input value={f.q} onChange={(e) => set("q")(e.target.value)} placeholder="รหัส PM งาน รหัสอุปกรณ์ ลูกค้า" className={cx(inputCls, "w-full pl-8")} />
            </div>
          </FilterField>
          <FilterField label="โครงการ / บ้าน">
            <Select label="โครงการ" value={f.project} onChange={set("project")}>
              <option value="">ทุกโครงการ</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id} · {p.name}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="ระบบงาน">
            <Select label="ระบบงาน" value={f.system} onChange={set("system")}>
              <option value="">ทุกระบบ</option>
              {Object.entries(SYSTEM_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="สถานะ">
            <Select label="สถานะ" value={f.status} onChange={set("status")}>
              <option value="">ทุกสถานะ</option>
              {(Object.keys(STATE_LABEL) as MaintState[]).map((s) => (
                <option key={s} value={s}>
                  {STATE_LABEL[s]}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="ผู้รับผิดชอบ">
            <Select label="ผู้รับผิดชอบ" value={f.assignee} onChange={set("assignee")}>
              <option value="">ทุกคน</option>
              {TECHNICIANS.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </Select>
          </FilterField>
        </div>
        {isFiltered && (
          <div className="mt-3 flex items-center gap-3 text-[13px] text-ink-3">
            <span className="num font-mono text-[12px]">{filtered.length} รายการ</span>
            <button type="button" onClick={() => setF(NO_FILTER)} className="inline-flex items-center gap-1 text-ink-2 hover:text-ink">
              <X {...I} />
              ล้างตัวกรอง
            </button>
          </div>
        )}
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="flex items-center gap-3">
            <IconBtn label="เดือนก่อนหน้า" onClick={() => setMonth((m) => addMonths(`${m}-01`, -1).slice(0, 7))}>
              <ChevronLeft {...I} />
            </IconBtn>
            <h2 className="min-w-[150px] text-center text-[16px] font-medium">{monthLabel(month)}</h2>
            <IconBtn label="เดือนถัดไป" onClick={() => setMonth((m) => addMonths(`${m}-01`, 1).slice(0, 7))}>
              <ChevronRight {...I} />
            </IconBtn>
            {month !== TODAY.slice(0, 7) && (
              <Btn small onClick={() => setMonth(TODAY.slice(0, 7))}>
                วันนี้
              </Btn>
            )}
          </div>
          <div className="flex items-center gap-4 text-[13px] text-ink-2">
            {(Object.keys(STATE_LABEL) as MaintState[]).map((s) => (
              <span key={s} className="flex items-center gap-1.5">
                <span className={cx("size-2 rounded-[2px]", DOT[s])} />
                {STATE_LABEL[s]}
              </span>
            ))}
          </div>
        </div>
        {view === "calendar" ? (
          <Calendar month={month} rows={filtered} onOpen={setOpenId} onDay={setDay} />
        ) : (
          <>
            {(f.status || f.month) && <p className="border-b border-line px-5 py-2 text-[13px] text-ink-3">แสดงทุกเดือนตามตัวกรอง</p>}
            <table className="w-full text-left">
              <thead>
                <tr className="text-[13px] text-ink-3">
                  <th className="px-5 py-3 font-normal">งาน</th>
                  <th className="py-3 pr-4 font-normal">บ้าน / ลูกค้า</th>
                  <th className="py-3 pr-4 font-normal">ระบบ · อุปกรณ์</th>
                  <th className="py-3 pr-4 font-normal">กำหนด</th>
                  <th className="py-3 pr-4 font-normal">ผู้รับผิดชอบ</th>
                  <th className="py-3 pr-4 font-normal">สถานะ</th>
                  <th className="py-3 pr-4" />
                </tr>
              </thead>
              <tbody>
                {listRows.map((m) => (
                  <tr key={m.id} onClick={() => setOpenId(m.id)} className="cursor-pointer border-t border-line align-top transition-colors duration-150 hover:bg-raised/60">
                    <td className="px-5 py-3">
                      <span className="font-mono text-[12px] text-ink-3">{m.id}</span>
                      <span className="block">{m.task}</span>
                      <span className="block text-[13px] text-ink-3">{m.cycle}</span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="block">{m.owner}</span>
                      <span className="block text-[13px] text-ink-3">
                        <span className="font-mono text-[12px]">{m.projectId}</span> · {getProject(m.projectId)?.name}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="block text-[13px]">{SYSTEM_LABEL[m.system]}</span>
                      {m.asset && <AssetTag code={m.asset} />}
                    </td>
                    <td className="py-3 pr-4">
                      <span className={cx("num block font-mono text-[13px]", m.st === "overdue" && "text-neg")}>{thDate(m.date)}</span>
                      {m.doneOn && <span className="block text-[12px] text-ink-3">ทำเมื่อ {thDate(m.doneOn)}</span>}
                    </td>
                    <td className="py-3 pr-4 text-[13px]">{m.assignee}</td>
                    <td className="py-3 pr-4">
                      <Pill tone={STATE_TONE[m.st]}>{STATE_LABEL[m.st]}</Pill>
                    </td>
                    <td className="py-2 pr-4 text-right" onClick={(e) => e.stopPropagation()}>
                      {m.st !== "done" && (
                        <Btn small onClick={() => markMaintDone(m.id)}>
                          <Check {...I} />
                          ทำแล้ว
                        </Btn>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {listRows.length === 0 && <Empty>ไม่มีรายการในช่วงนี้</Empty>}
          </>
        )}
      </Card>

      {open && <MaintDetail m={open} onClose={() => setOpenId(undefined)} />}
      {day && (
        <Modal open onClose={() => setDay(undefined)} title={`รายการวันที่ ${thDate(day)}`}>
          <ul className="flex flex-col gap-1.5">
            {filtered
              .filter((x) => x.date === day)
              .map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setDay(undefined);
                      setOpenId(m.id);
                    }}
                    className={cx("flex w-full items-center justify-between gap-3 rounded-[8px] border px-3 py-2 text-left text-[13px]", CHIP[m.st])}
                  >
                    <span>
                      {m.owner} · {m.task}
                    </span>
                    <span className="font-mono text-[12px]">{m.id}</span>
                  </button>
                </li>
              ))}
          </ul>
        </Modal>
      )}
      {formOpen && <PlanForm onClose={() => setFormOpen(false)} onSaved={(first) => setMonth(first.slice(0, 7))} />}
    </>
  );
}

function Calendar({ month, rows, onOpen, onDay }: { month: string; rows: Row[]; onOpen: (id: string) => void; onDay: (d: string) => void }) {
  const first = `${month}-01`;
  const startDow = new Date(`${first}T00:00:00Z`).getUTCDay();
  const daysIn = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  const cells = Math.ceil((startDow + daysIn) / 7) * 7;
  const byDay = new Map<string, Row[]>();
  for (const r of rows) if (r.date.startsWith(month)) byDay.set(r.date, [...(byDay.get(r.date) ?? []), r]);
  return (
    <div className="grid grid-cols-7">
      {WEEK.map((w) => (
        <div key={w} className="border-b border-line px-3 py-2 text-[13px] text-ink-3">
          {w}
        </div>
      ))}
      {Array.from({ length: cells }, (_, i) => {
        const d = i - startDow + 1;
        if (d < 1 || d > daysIn) return <div key={i} className="min-h-[124px] border-b border-r border-line bg-raised/30 [&:nth-child(7n)]:border-r-0" />;
        const iso = `${month}-${String(d).padStart(2, "0")}`;
        const items = byDay.get(iso) ?? [];
        const today = iso === TODAY;
        return (
          <div key={i} className={cx("min-h-[124px] border-b border-r border-line px-2 py-2 [&:nth-child(7n)]:border-r-0", today && "bg-accent-soft/40")}>
            <div className="mb-1.5 flex items-center justify-between">
              <span className={cx("num inline-flex size-6 items-center justify-center rounded-full font-mono text-[12px]", today ? "bg-ink text-card" : "text-ink-2")}>{d}</span>
              {items.length > 0 && <span className="num font-mono text-[11px] text-ink-3">{items.length}</span>}
            </div>
            <div className="flex flex-col gap-1">
              {items.slice(0, 3).map((m) => (
                <button key={m.id} type="button" onClick={() => onOpen(m.id)} title={`${m.id} · ${m.owner} · ${m.task}`} className={cx("truncate rounded-[6px] border px-1.5 py-0.5 text-left text-[12px] transition-opacity duration-150 hover:opacity-80", CHIP[m.st])}>
                  {m.st === "done" && <Check size={12} strokeWidth={1.5} className="mr-1 inline" />}
                  {m.owner} · {m.task}
                </button>
              ))}
              {items.length > 3 && (
                <button type="button" onClick={() => onDay(iso)} className="px-1.5 text-left text-[12px] text-ink-3 hover:text-ink">
                  +{items.length - 3} รายการ
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MaintDetail({ m, onClose }: { m: Row; onClose: () => void }) {
  const p = getProject(m.projectId);
  return (
    <Modal
      open
      onClose={onClose}
      title={`${m.id} · ${m.task}`}
      footer={
        <>
          <Btn
            danger
            onClick={() => {
              if (window.confirm(`ลบรายการ ${m.id}`)) {
                deleteMaint(m.id);
                onClose();
              }
            }}
          >
            <Trash2 {...I} />
            ลบ
          </Btn>
          <span className="mr-auto" />
          {m.st === "done" ? (
            <Btn onClick={() => markMaintDone(m.id, false)}>ยกเลิกสถานะทำแล้ว</Btn>
          ) : (
            <Btn primary onClick={() => markMaintDone(m.id)}>
              <Check {...I} />
              บันทึกว่าทำแล้ว
            </Btn>
          )}
        </>
      }
    >
      <Pill tone={STATE_TONE[m.st]}>{STATE_LABEL[m.st]}</Pill>
      <div className="mt-3 grid grid-cols-2 gap-x-6">
        <KV k="บ้าน">
          <Link href={`/projects/${m.projectId}`} className="hover:underline">
            {p?.name ?? m.projectId}
          </Link>
        </KV>
        <KV k="ลูกค้า">{m.owner}</KV>
        <KV k="ระบบงาน">{SYSTEM_LABEL[m.system]}</KV>
        <KV k="อุปกรณ์">{m.asset ? <AssetTag code={m.asset} href={`/projects/${m.projectId}`} /> : "ทั้งระบบ"}</KV>
        <KV k="กำหนด">{thDate(m.date)}</KV>
        <KV k="รอบ">{m.cycle}</KV>
        <KV k="ผู้รับผิดชอบ">{m.assignee}</KV>
        <KV k="ทำเมื่อ">{m.doneOn ? thDate(m.doneOn) : "–"}</KV>
        {p?.phone && <KV k="โทรลูกค้า">{p.phone}</KV>}
        {p?.address && <KV k="ที่อยู่">{p.address}</KV>}
      </div>
    </Modal>
  );
}

function PlanForm({ onClose, onSaved }: { onClose: () => void; onSaved: (first: string) => void }) {
  const pool = projects.filter((p) => p.status === "delivered" || p.status === "handover");
  const [projectId, setProjectId] = useState(pool[0]?.id ?? projects[0].id);
  const p = projects.find((x) => x.id === projectId);
  const { assets } = useMemo(() => projectAssets(p), [p]);
  const [assetCode, setAssetCode] = useState("");
  const [system, setSystem] = useState<SystemKey>("hvac");
  const [task, setTask] = useState("");
  const [cycle, setCycle] = useState(6);
  const [first, setFirst] = useState(addDays(TODAY, 7));
  const [assignee, setAssignee] = useState(TECH_BY_SYSTEM.hvac);
  const asset = assets.find((a) => a.code === assetCode);
  const sys = asset?.system ?? system;
  const dates: string[] = [];
  for (let d = first; d && d < addMonths(first, 24); d = addMonths(d, cycle)) dates.push(d);
  const valid = task.trim().length > 0 && !!first;
  const save = () => {
    if (!valid) return;
    addMaintPlan({ projectId, task: task.trim(), system: sys, asset: asset?.code, cycleMonths: cycle, first, assignee });
    onSaved(first);
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="เพิ่มแผนบำรุงรักษา"
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary onClick={save} disabled={!valid}>
            สร้าง {dates.length} รายการ
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Field label="บ้าน / โครงการ">
            <select
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                setAssetCode("");
              }}
              className={inputCls}
            >
              {pool.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.id} · {x.name} · {x.owner}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="อุปกรณ์ (ถ้ามี)">
          <select
            value={assetCode}
            onChange={(e) => {
              setAssetCode(e.target.value);
              const a = assets.find((x) => x.code === e.target.value);
              if (a) setAssignee(TECH_BY_SYSTEM[a.system]);
            }}
            className={inputCls}
          >
            <option value="">ทั้งระบบ ไม่ระบุอุปกรณ์</option>
            {assets
              .filter((a) => a.category !== "เบรกเกอร์ลูกย่อย" && a.category !== "โคมดาวน์ไลท์ LED" && a.category !== "สวิตช์ไฟ" && a.category !== "เต้ารับคู่มีกราวด์")
              .map((a) => (
                <option key={a.code} value={a.code}>
                  {a.code} · {a.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="ระบบงาน">
          <select
            value={sys}
            disabled={!!asset}
            onChange={(e) => {
              const s = e.target.value as SystemKey;
              setSystem(s);
              setAssignee(TECH_BY_SYSTEM[s]);
            }}
            className={inputCls}
          >
            {Object.entries(SYSTEM_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <div className="col-span-2">
          <Field label="งานบำรุงรักษา">
            <input value={task} onChange={(e) => setTask(e.target.value)} list="pm-tasks" placeholder="เช่น ล้างแอร์ทั้งหลัง" className={inputCls} />
            <datalist id="pm-tasks">
              {TASKS.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </Field>
        </div>
        <Field label="รอบ (เดือน)">
          <select value={cycle} onChange={(e) => setCycle(Number(e.target.value))} className={inputCls}>
            {[1, 2, 3, 6, 12, 24].map((n) => (
              <option key={n} value={n}>
                ทุก {n} เดือน
              </option>
            ))}
          </select>
        </Field>
        <Field label="ครั้งแรก">
          <input type="date" value={first} onChange={(e) => setFirst(e.target.value)} className={inputCls} />
        </Field>
        <Field label="ผู้รับผิดชอบ">
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={inputCls}>
            {TECHNICIANS.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="mt-5 rounded-[10px] border border-line bg-raised/50 px-4 py-3">
        <p className="text-[13px] text-ink-2">
          รายการที่จะสร้างใน 24 เดือน <span className="num font-mono text-ink-3">{dates.length}</span>
        </p>
        <p className="num mt-1 font-mono text-[12px] leading-[20px] text-ink-3">{dates.map(thDate).join(" · ")}</p>
      </div>
    </Modal>
  );
}
