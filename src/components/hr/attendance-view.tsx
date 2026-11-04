"use client";

import { useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, CloudRain, Plus, Save, X } from "lucide-react";
import { Card, CardHead, cx, Field, inputCls, PageHeader, Status } from "@/components/ui";
import { areaCls, Btn, Empty, FilterField, I, IconBtn, Modal, Pill, Select, StatCard } from "@/components/ops/bits";
import { thDate, TODAY } from "@/lib/data";
import { DAY_VALUE, type DayMark } from "@/lib/hr/calc";
import { addDays, employedOn, isWorkday, weekday } from "@/lib/hr/payroll";
import { ACTIVE_SITES } from "@/lib/hr/seed";
import { attendance, employees, leaves } from "@/lib/hr/store";
import { LEAVE_LABEL, LEAVE_QUOTA, NATIONALITY_LABEL, type AttendanceEntry, type AttendanceSheet, type Employee, type LeaveRequest, type LeaveType } from "@/lib/hr/types";
import { HrTabs, SubTabs, useHrAccess } from "./bits";

const WD = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
const MARK_LABEL: Record<DayMark, string> = { present: "มา", half: "ครึ่งวัน", absent: "ขาด" };
const MARK_CLS: Record<DayMark, string> = { present: "bg-ink text-card", half: "bg-warn-soft text-warn", absent: "bg-neg-soft text-neg" };

export function AttendanceView() {
  const [tab, setTab] = useState<"site" | "leave">("site");
  const pending = leaves.use().filter((l) => l.status === "pending").length;
  return (
    <>
      <PageHeader eyebrow="บุคคล" title="ลงเวลา & การลา" sub="โฟร์แมนบันทึกการมาทำงานของคนงานรายวันแต่ละหน้างาน ใช้คำนวณค่าแรงรายสัปดาห์ และใบลาของพนักงานรายเดือน" />
      <HrTabs />
      <div className="mb-5">
        <SubTabs
          value={tab}
          onChange={setTab}
          options={[
            { key: "site", label: "ลงเวลาหน้างาน" },
            { key: "leave", label: "ใบลา", count: pending || undefined },
          ]}
        />
      </div>
      {tab === "site" ? <SiteAttendance /> : <Leaves />}
    </>
  );
}

// ---------------- site attendance ----------------

function SiteAttendance() {
  const sheets = attendance.use();
  const emps = employees.use();
  const { attendance: canKey, me } = useHrAccess();
  const [site, setSite] = useState(ACTIVE_SITES[0]?.id ?? "");
  const [date, setDate] = useState(TODAY);

  const step = (n: number) => {
    let d = addDays(date, n);
    while (weekday(d) === 0) d = addDays(d, n);
    if (d <= TODAY) setDate(d);
  };

  const sheetOf = (pid: string, d: string) => sheets.find((s) => s.projectId === pid && s.date === d);
  const daySummary = ACTIVE_SITES.map((p) => {
    const s = sheetOf(p.id, date);
    const assigned = emps.filter((e) => e.type === "daily" && e.projectId === p.id && employedOn(e, date)).length;
    return { p, s, assigned, present: s ? s.entries.reduce((t, x) => t + DAY_VALUE[x.mark], 0) : 0 };
  });
  const missing = daySummary.filter((r) => !r.s && r.assigned > 0).length;

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <div className="flex min-w-0 flex-col gap-6">
        <Card>
          <div className="flex flex-wrap items-end gap-3 border-b border-line px-5 py-4">
            <FilterField label="หน้างาน" className="min-w-[260px] flex-1">
              <Select label="หน้างาน" value={site} onChange={setSite}>
                {ACTIVE_SITES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id} · {p.name} · {p.province}
                  </option>
                ))}
              </Select>
            </FilterField>
            <FilterField label="วันที่" className="w-[230px]">
              <div className="flex items-center gap-1">
                <IconBtn label="วันก่อนหน้า" onClick={() => step(-1)}>
                  <ChevronLeft {...I} />
                </IconBtn>
                <input type="date" max={TODAY} className={cx(inputCls, "flex-1")} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
                <IconBtn label="วันถัดไป" onClick={() => step(1)}>
                  <ChevronRight {...I} />
                </IconBtn>
              </div>
            </FilterField>
          </div>
          <SheetEditor key={`${site}|${date}`} site={site} date={date} sheet={sheetOf(site, date)} emps={emps} canKey={canKey} by={me.name} />
        </Card>
        <WeekMatrix site={site} date={date} sheets={sheets} emps={emps} onPick={setDate} />
      </div>

      <Card className="self-start">
        <CardHead title={`ทุกหน้างาน ${thDate(date)}`} meta={missing ? `ยังไม่ลง ${missing}` : "ครบ"} />
        <ul>
          {daySummary.map((r) => (
            <li key={r.p.id}>
              <button type="button" onClick={() => setSite(r.p.id)} className={cx("flex w-full items-center gap-3 border-b border-line px-5 py-2.5 text-left transition-colors duration-150 last:border-0 hover:bg-raised/60", site === r.p.id && "bg-raised")}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px]">{r.p.name}</span>
                  <span className="block font-mono text-[12px] text-ink-3">{r.p.id}</span>
                </span>
                {r.s ? (
                  <span className="num font-mono text-[12px]">
                    {r.present}/{r.assigned}
                  </span>
                ) : !isWorkday(date) ? (
                  <span className="text-[12px] text-ink-3">วันหยุด</span>
                ) : r.assigned ? (
                  <Pill tone="warn">ยังไม่ลง</Pill>
                ) : (
                  <span className="text-[12px] text-ink-3">ไม่มีคนงาน</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function SheetEditor({ site, date, sheet, emps, canKey, by }: { site: string; date: string; sheet?: AttendanceSheet; emps: Employee[]; canKey: boolean; by: string }) {
  const crew = useMemo(() => {
    const ids = new Set(sheet?.entries.map((e) => e.employeeId));
    return emps.filter((e) => e.type === "daily" && ((e.projectId === site && employedOn(e, date)) || ids.has(e.id)));
  }, [emps, site, date, sheet]);
  const [rows, setRows] = useState<Record<string, AttendanceEntry>>(() =>
    Object.fromEntries(crew.map((e) => [e.id, sheet?.entries.find((x) => x.employeeId === e.id) ?? { employeeId: e.id, mark: "present" as DayMark, ot: 0 }])),
  );
  const [note, setNote] = useState(sheet?.note ?? "");
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  const patch = (id: string, p: Partial<AttendanceEntry>) => {
    setRows((r) => ({ ...r, [id]: { ...r[id], ...p } }));
    setDirty(true);
    setSaved(false);
  };
  const all = (mark: DayMark) => {
    setRows((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, { ...v, mark, ot: mark === "present" ? v.ot : 0 }])));
    setDirty(true);
    setSaved(false);
  };
  const save = () => {
    attendance.upsert({ id: `ATT-${site}-${date}`, projectId: site, date, by, entries: Object.values(rows), note: note.trim() || undefined });
    setDirty(false);
    setSaved(true);
  };

  const list = Object.values(rows);
  const manDays = list.reduce((s, x) => s + DAY_VALUE[x.mark], 0);
  const ot = list.reduce((s, x) => s + x.ot, 0);
  const readOnly = !canKey;

  if (!crew.length) return <Empty>ไม่มีคนงานรายวันประจำหน้างานนี้ในวันที่เลือก</Empty>;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
        <div className="flex flex-wrap items-center gap-3 text-[13px] text-ink-2">
          {sheet && !dirty ? (
            <Status tone="pos">
              บันทึกแล้ว โดย {sheet.by}
            </Status>
          ) : (
            <Status tone="warn">{dirty ? "ยังไม่ได้บันทึกการแก้ไข" : isWorkday(date) ? "ยังไม่ลงเวลา ค่าเริ่มต้นคือมาทำงานทุกคน" : "วันหยุด"}</Status>
          )}
          <span className="num font-mono text-[12px]">
            {manDays} แรง · OT {ot} ชม. · {crew.length} คน
          </span>
          {saved && <span className="text-pos">บันทึกเรียบร้อย</span>}
        </div>
        {!readOnly && (
          <div className="flex gap-2">
            <Btn small onClick={() => all("present")}>
              <Check {...I} />
              มาทุกคน
            </Btn>
            <Btn small onClick={() => all("half")}>
              <CloudRain {...I} />
              ครึ่งวันทั้งไซต์
            </Btn>
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-[13px]">
          <thead>
            <tr className="border-y border-line text-left text-ink-3">
              <th className="px-5 py-2 font-normal">คนงาน</th>
              <th className="px-3 py-2 font-normal">ทักษะ</th>
              <th className="px-3 py-2 font-normal">สัญชาติ</th>
              <th className="px-3 py-2 font-normal">การมาทำงาน</th>
              <th className="px-5 py-2 text-right font-normal">OT (ชม.)</th>
            </tr>
          </thead>
          <tbody>
            {crew.map((e) => {
              const r = rows[e.id];
              return (
                <tr key={e.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-2">
                    <span className="block">{e.name}</span>
                    <span className="font-mono text-[12px] text-ink-3">{e.id}</span>
                  </td>
                  <td className="px-3 py-2 text-ink-2">{e.skill}</td>
                  <td className="px-3 py-2 text-ink-2">{NATIONALITY_LABEL[e.nationality]}</td>
                  <td className="px-3 py-2">
                    <div className="inline-flex gap-1" role="radiogroup" aria-label={`การมาทำงาน ${e.name}`}>
                      {(["present", "half", "absent"] as DayMark[]).map((m) => (
                        <button
                          key={m}
                          type="button"
                          role="radio"
                          aria-checked={r.mark === m}
                          disabled={readOnly}
                          onClick={() => patch(e.id, { mark: m, ot: m === "present" ? r.ot : 0 })}
                          className={cx("h-7 rounded-[6px] px-2.5 text-[12px] transition-colors duration-150 disabled:cursor-default", r.mark === m ? MARK_CLS[m] : "border border-line text-ink-3 hover:bg-raised")}
                        >
                          {MARK_LABEL[m]}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-2 text-right">
                    <input
                      type="number"
                      min={0}
                      max={6}
                      step={0.5}
                      disabled={readOnly || r.mark !== "present"}
                      aria-label={`OT ${e.name}`}
                      value={r.ot || ""}
                      onChange={(v) => patch(e.id, { ot: Math.max(0, Math.min(6, Number(v.target.value) || 0)) })}
                      className={cx(inputCls, "h-8 w-20 text-right font-mono disabled:opacity-40")}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-end gap-3 border-t border-line px-5 py-3">
        <input className={cx(inputCls, "min-w-[240px] flex-1")} placeholder="หมายเหตุ เช่น ฝนตก วัสดุไม่เข้า" value={note} disabled={readOnly} onChange={(e) => (setNote(e.target.value), setDirty(true))} />
        {!readOnly && (
          <Btn primary onClick={save} disabled={!dirty && !!sheet}>
            <Save {...I} />
            บันทึกใบลงเวลา
          </Btn>
        )}
      </div>
      {readOnly && <p className="px-5 pb-3 text-[12px] text-ink-3">บทบาทของคุณดูได้อย่างเดียว</p>}
    </>
  );
}

function WeekMatrix({ site, date, sheets, emps, onPick }: { site: string; date: string; sheets: AttendanceSheet[]; emps: Employee[]; onPick: (d: string) => void }) {
  const days = useMemo(() => {
    const out: string[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = addDays(date, -i);
      if (weekday(d) !== 0) out.push(d);
    }
    return out;
  }, [date]);
  const bySheet = new Map(sheets.filter((s) => s.projectId === site && days.includes(s.date)).map((s) => [s.date, s]));
  const crew = emps.filter((e) => e.type === "daily" && (e.projectId === site || [...bySheet.values()].some((s) => s.entries.some((x) => x.employeeId === e.id))));
  return (
    <Card>
      <CardHead title="ภาพรวม 2 สัปดาห์" meta={site} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-[12px]">
          <thead>
            <tr className="border-b border-line text-ink-3">
              <th className="px-5 py-2 text-left font-normal">คนงาน</th>
              {days.map((d) => (
                <th key={d} className="px-1 py-2 font-normal">
                  <button type="button" onClick={() => onPick(d)} className={cx("rounded-[4px] px-1 leading-tight hover:text-ink", d === date && "text-ink")}>
                    {WD[weekday(d)]}
                    <span className="block font-mono">{Number(d.slice(8))}</span>
                  </button>
                </th>
              ))}
              <th className="px-5 py-2 text-right font-normal">แรง</th>
            </tr>
          </thead>
          <tbody>
            {crew.map((e) => {
              let total = 0;
              return (
                <tr key={e.id} className="border-b border-line last:border-0">
                  <td className="truncate px-5 py-1.5 text-[13px]">{e.name}</td>
                  {days.map((d) => {
                    const en = bySheet.get(d)?.entries.find((x) => x.employeeId === e.id);
                    if (en) total += DAY_VALUE[en.mark];
                    return (
                      <td key={d} className="px-1 py-1.5 text-center">
                        {en ? (
                          <span title={`${MARK_LABEL[en.mark]}${en.ot ? ` OT ${en.ot}` : ""}`} className={cx("inline-flex size-5 items-center justify-center rounded-[4px] font-mono text-[10px]", MARK_CLS[en.mark])}>
                            {en.ot ? en.ot : ""}
                          </span>
                        ) : (
                          <span className="inline-block size-5 rounded-[4px] border border-dashed border-line-strong" />
                        )}
                      </td>
                    );
                  })}
                  <td className="num px-5 py-1.5 text-right font-mono">{total}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t border-line px-5 py-2.5 text-[12px] text-ink-3">ช่องทึบ = มา · เหลือง = ครึ่งวัน · แดง = ขาด · ตัวเลขในช่อง = ชั่วโมง OT · ช่องเส้นประ = ยังไม่ลง/วันหยุด</p>
    </Card>
  );
}

// ---------------- leave ----------------

function countWorkdays(from: string, to: string) {
  let n = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) if (isWorkday(d)) n++;
  return n;
}

function Leaves() {
  const list = leaves.use();
  const emps = employees.use();
  const { approve, edit, me } = useHrAccess();
  const staff = emps.filter((e) => e.type === "monthly" && e.status !== "resigned");
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [creating, setCreating] = useState(false);
  const year = TODAY.slice(0, 4);
  const mine = staff.find((e) => e.name === me.name);

  const used = useMemo(() => {
    const m = new Map<string, Record<LeaveType, number>>();
    for (const l of list) {
      if (l.status !== "approved" || !l.from.startsWith(year)) continue;
      const cur = m.get(l.employeeId) ?? { sick: 0, personal: 0, vacation: 0, unpaid: 0 };
      cur[l.type] += l.days;
      m.set(l.employeeId, cur);
    }
    return m;
  }, [list, year]);

  const shown = list.filter((l) => filter === "all" || l.status === "pending").sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  const onLeaveToday = list.filter((l) => l.status === "approved" && l.from <= TODAY && l.to >= TODAY);
  const name = (id: string) => emps.find((e) => e.id === id)?.name ?? id;

  const decide = (l: LeaveRequest, status: "approved" | "rejected") => leaves.upsert({ ...l, status, approver: me.name, decidedAt: TODAY });

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="รออนุมัติ" value={list.filter((l) => l.status === "pending").length} unit="ใบ" active={filter === "pending"} onClick={() => setFilter("pending")} />
        <StatCard label="ลาวันนี้" value={onLeaveToday.length} unit="คน" note={onLeaveToday.map((l) => name(l.employeeId).split(" ")[0]).join(", ") || "ไม่มี"} />
        <StatCard label={`ลาป่วยปี ${Number(year) + 543}`} value={[...used.values()].reduce((s, u) => s + u.sick, 0)} unit="วัน" />
        <StatCard label={`ลาพักร้อนปี ${Number(year) + 543}`} value={[...used.values()].reduce((s, u) => s + u.vacation, 0)} unit="วัน" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_440px]">
        <Card>
          <CardHead
            title="ใบลา"
            action={
              <div className="flex items-center gap-2">
                <SubTabs
                  value={filter}
                  onChange={setFilter}
                  options={[
                    { key: "pending", label: "รออนุมัติ" },
                    { key: "all", label: "ทั้งหมด" },
                  ]}
                />
                {(edit || mine) && (
                  <Btn small onClick={() => setCreating(true)}>
                    <Plus {...I} />
                    ยื่นใบลา
                  </Btn>
                )}
              </div>
            }
          />
          {shown.length ? (
            <ul>
              {shown.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px]">
                      <span className="font-medium">{name(l.employeeId)}</span> · {LEAVE_LABEL[l.type]} {l.days} วัน
                    </p>
                    <p className="text-[12px] text-ink-3">
                      {thDate(l.from)}
                      {l.to !== l.from && ` – ${thDate(l.to)}`} · {l.reason} · <span className="font-mono">{l.id}</span>
                    </p>
                  </div>
                  {l.status === "pending" ? (
                    approve ? (
                      <div className="flex gap-2">
                        <Btn small onClick={() => decide(l, "rejected")}>
                          <X {...I} />
                          ไม่อนุมัติ
                        </Btn>
                        <Btn small primary onClick={() => decide(l, "approved")}>
                          <Check {...I} />
                          อนุมัติ
                        </Btn>
                      </div>
                    ) : (
                      <Pill tone="warn">รออนุมัติ</Pill>
                    )
                  ) : (
                    <Status tone={l.status === "approved" ? "pos" : "neg"}>
                      {l.status === "approved" ? "อนุมัติ" : "ไม่อนุมัติ"} · {l.approver?.split(" ")[0]}
                    </Status>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>ไม่มีใบลาที่รออนุมัติ</Empty>
          )}
        </Card>

        <Card className="self-start">
          <CardHead title="สิทธิ์การลาคงเหลือ" meta={`ปี ${Number(year) + 543}`} />
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-ink-3">
                  <th className="px-5 py-2 font-normal">พนักงาน</th>
                  {(["sick", "personal", "vacation"] as LeaveType[]).map((t) => (
                    <th key={t} className="px-2 py-2 text-right font-normal">
                      {LEAVE_LABEL[t].replace("ลา", "")}
                      <span className="block font-mono text-[11px]">/{LEAVE_QUOTA[t]}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staff.map((e) => {
                  const u = used.get(e.id);
                  return (
                    <tr key={e.id} className="border-b border-line last:border-0">
                      <td className="truncate px-5 py-1.5">{e.name}</td>
                      {(["sick", "personal", "vacation"] as LeaveType[]).map((t) => {
                        const left = LEAVE_QUOTA[t] - (u?.[t] ?? 0);
                        return (
                          <td key={t} className={cx("num px-2 py-1.5 text-right font-mono text-[12px]", left <= 0 ? "text-neg" : left <= 2 ? "text-warn" : "text-ink-2")}>
                            {left}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="border-t border-line px-5 py-2.5 text-[12px] text-ink-3">ลาป่วยได้รับค่าจ้างไม่เกิน 30 วันทำงาน/ปี · ลากิจตามระเบียบบริษัท · พักร้อนเมื่อทำงานครบ 1 ปี</p>
        </Card>
      </div>

      {creating && <LeaveForm staff={edit ? staff : mine ? [mine] : []} onClose={() => setCreating(false)} />}
    </div>
  );
}

function LeaveForm({ staff, onClose }: { staff: Employee[]; onClose: () => void }) {
  const [employeeId, setEmployeeId] = useState(staff[0]?.id ?? "");
  const [type, setType] = useState<LeaveType>("sick");
  const [from, setFrom] = useState(TODAY);
  const [to, setTo] = useState(TODAY);
  const [reason, setReason] = useState("");
  const days = to >= from ? countWorkdays(from, to) : 0;
  const ok = employeeId && days > 0 && reason.trim();
  const submit = () => {
    if (!ok) return;
    leaves.upsert({ id: leaves.nextId(`LV-${TODAY.slice(0, 4)}-`), employeeId, type, from, to, days, reason: reason.trim(), requestedAt: TODAY, status: "pending" });
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="ยื่นใบลา"
      width={520}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!ok} onClick={submit}>
            ส่งขออนุมัติ
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="พนักงาน">
          <select className={inputCls} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            {staff.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="ประเภทการลา">
          <select className={inputCls} value={type} onChange={(e) => setType(e.target.value as LeaveType)}>
            {(Object.keys(LEAVE_LABEL) as LeaveType[]).map((t) => (
              <option key={t} value={t}>
                {LEAVE_LABEL[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="ตั้งแต่">
          <input type="date" className={inputCls} value={from} onChange={(e) => (setFrom(e.target.value), e.target.value > to && setTo(e.target.value))} />
        </Field>
        <Field label="ถึง">
          <input type="date" className={inputCls} min={from} value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <div className="col-span-2">
          <Field label="เหตุผล">
            <textarea className={areaCls} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </div>
        <p className="col-span-2 text-[13px] text-ink-2">
          รวม <span className="num font-mono">{days}</span> วันทำงาน (ไม่นับวันอาทิตย์และวันหยุดนักขัตฤกษ์)
        </p>
      </div>
    </Modal>
  );
}
