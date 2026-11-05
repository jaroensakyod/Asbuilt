"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Plus, X } from "lucide-react";
import { Card, cx, Field, inputCls } from "@/components/ui";
import { Btn, Empty, FilterField, I, Modal, Pill, Select, StatCard, type Tone } from "@/components/ops/bits";
import { getProject, thDate, TODAY } from "@/lib/data";
import {
  ACTION_STATUS_LABEL,
  actionItems,
  MEETING_TYPE_LABEL,
  meetings,
  nextSeries,
  type ActionItem,
  type ActionStatus,
  type Attendee,
  type Meeting,
  type MeetingType,
} from "@/lib/engineering";
import { Area, Due, pname, PeopleList, ProjectSelect, rowCls, SearchBox, Tabs, td, th, useEngPerms } from "./bits";

export const ACTION_TONE: Record<ActionStatus, Tone> = { open: "warn", done: "pos", cancelled: "neutral" };
export const isOverdue = (a: ActionItem) => a.status === "open" && a.due < TODAY;

/** Create a meeting; open action items of the project are carried forward into it. */
export function createMeeting(input: Omit<Meeting, "id" | "no" | "carried" | "status" | "minutes" | "decisions"> & { minutes?: string; decisions?: string[] }): Meeting {
  const { id, no } = nextSeries(meetings.all(), "MTG", input.projectId);
  const carried = actionItems
    .all()
    .filter((a) => a.projectId === input.projectId && a.status === "open")
    .map((a) => a.id);
  const m: Meeting = { minutes: "", decisions: [], ...input, id, no, carried, status: "draft" };
  meetings.upsert(m);
  return m;
}

/** attendees of the latest earlier meeting of the project (default for a new one) */
export function previousAttendees(projectId: string, type?: MeetingType): Attendee[] {
  const prev = meetings
    .all()
    .filter((m) => m.projectId === projectId && (!type || m.type === type))
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  return prev ? prev.attendees.map((a) => ({ ...a, present: true })) : [];
}

const parseAttendees = (s: string): Attendee[] =>
  s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [name, org] = l.split("|").map((x) => x.trim());
      return { name, org: org ?? "", present: true };
    });
const lines = (s: string) =>
  s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

type Tab = "meetings" | "actions";

export function MeetingsView() {
  const sp = useSearchParams();
  return <Inner key={sp.toString()} initTab={sp.get("tab") === "actions" ? "actions" : "meetings"} initProject={sp.get("project") ?? ""} />;
}

function Inner({ initTab, initProject }: { initTab: Tab; initProject: string }) {
  const router = useRouter();
  const perms = useEngPerms();
  const ms = meetings.use();
  const acts = actionItems.use();
  const [tab, setTab] = useState<Tab>(initTab);
  const [q, setQ] = useState("");
  const [project, setProject] = useState(initProject);
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [aStatus, setAStatus] = useState("open");
  const [owner, setOwner] = useState("");
  const [newOpen, setNewOpen] = useState(false);

  const month = TODAY.slice(0, 7);
  const pa = acts.filter((a) => !project || a.projectId === project);
  const pm = ms.filter((m) => !project || m.projectId === project);
  const stats = {
    month: pm.filter((m) => m.date.startsWith(month)).length,
    open: pa.filter((a) => a.status === "open").length,
    overdue: pa.filter(isOverdue).length,
    draft: pm.filter((m) => m.status === "draft").length,
  };
  const needle = q.trim().toLowerCase();
  const mRows = useMemo(
    () =>
      ms
        .filter((m) => !project || m.projectId === project)
        .filter((m) => !type || m.type === type)
        .filter((m) => !status || m.status === status)
        .filter((m) => !needle || `${m.id} ${m.title} ${m.chair} ${pname(m.projectId)} ${m.decisions.join(" ")}`.toLowerCase().includes(needle))
        .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
    [ms, project, type, status, needle],
  );
  const owners = useMemo(() => [...new Set(acts.map((a) => a.owner))].sort((a, b) => a.localeCompare(b, "th")), [acts]);
  const aRows = useMemo(
    () =>
      acts
        .filter((a) => !project || a.projectId === project)
        .filter((a) => !owner || a.owner === owner)
        .filter((a) => !aStatus || (aStatus === "overdue" ? isOverdue(a) : a.status === aStatus))
        .filter((a) => !needle || `${a.id} ${a.text} ${a.owner} ${pname(a.projectId)}`.toLowerCase().includes(needle))
        .sort((a, b) => a.due.localeCompare(b.due)),
    [acts, project, owner, aStatus, needle],
  );
  const setAct = (a: ActionItem, s: ActionStatus) => actionItems.upsert({ ...a, status: s, doneAt: s === "done" ? TODAY : undefined });
  const filtered = q || project || type || status || owner;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
        <div>
          <p className="mb-1 text-[13px] text-ink-3">วิศวกรรม & คุณภาพ</p>
          <h1 className="text-[30px] font-normal leading-[1.15]">ประชุม</h1>
          <p className="mt-2 max-w-[48rem] text-ink-2">วาระ บันทึก มติ และงานที่ต้องติดตาม เรื่องที่ยังค้างจะยกไปติดตามในการประชุมครั้งถัดไปของโครงการโดยอัตโนมัติ</p>
        </div>
        {perms.edit && (
          <Btn primary onClick={() => setNewOpen(true)}>
            <Plus {...I} />
            นัดประชุม
          </Btn>
        )}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="ประชุมเดือนนี้" value={stats.month} note={project ? pname(project) : "ทุกโครงการ"} active={tab === "meetings" && !status} onClick={() => (setTab("meetings"), setStatus(""))} />
        <StatCard label="รายงานรอออก" value={stats.draft} note="ยังเป็นร่าง" active={tab === "meetings" && status === "draft"} onClick={() => (setTab("meetings"), setStatus(status === "draft" ? "" : "draft"))} />
        <StatCard label="งานค้างจากที่ประชุม" value={stats.open} note="ยังไม่เสร็จ" active={tab === "actions" && aStatus === "open"} onClick={() => (setTab("actions"), setAStatus("open"))} />
        <StatCard label="เลยกำหนด" value={stats.overdue} tone={stats.overdue ? "neg" : undefined} note="งานที่เลยวันครบกำหนด" active={tab === "actions" && aStatus === "overdue"} onClick={() => (setTab("actions"), setAStatus("overdue"))} />
      </div>

      <Card className="mb-4">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { key: "meetings", label: "การประชุม", count: pm.length },
            { key: "actions", label: "งานที่ต้องติดตาม", count: pa.length },
          ]}
        />
        <div className="grid grid-cols-2 gap-3 px-4 py-3 lg:grid-cols-5">
          <SearchBox value={q} onChange={setQ} placeholder={tab === "meetings" ? "หัวข้อ ประธาน มติ" : "งาน ผู้รับผิดชอบ"} className="col-span-2" />
          <FilterField label="โครงการ">
            <ProjectSelect value={project} onChange={setProject} />
          </FilterField>
          {tab === "meetings" ? (
            <>
              <FilterField label="ประเภท">
                <Select label="ประเภท" value={type} onChange={setType}>
                  <option value="">ทุกประเภท</option>
                  {(Object.keys(MEETING_TYPE_LABEL) as MeetingType[]).map((k) => (
                    <option key={k} value={k}>
                      {MEETING_TYPE_LABEL[k]}
                    </option>
                  ))}
                </Select>
              </FilterField>
              <FilterField label="สถานะ">
                <Select label="สถานะ" value={status} onChange={setStatus}>
                  <option value="">ทุกสถานะ</option>
                  <option value="draft">ร่าง</option>
                  <option value="issued">ออกรายงานแล้ว</option>
                </Select>
              </FilterField>
            </>
          ) : (
            <>
              <FilterField label="ผู้รับผิดชอบ">
                <Select label="ผู้รับผิดชอบ" value={owner} onChange={setOwner}>
                  <option value="">ทุกคน</option>
                  {owners.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </Select>
              </FilterField>
              <FilterField label="สถานะ">
                <Select label="สถานะ" value={aStatus} onChange={setAStatus}>
                  <option value="">ทุกสถานะ</option>
                  <option value="overdue">เลยกำหนด</option>
                  {(Object.keys(ACTION_STATUS_LABEL) as ActionStatus[]).map((k) => (
                    <option key={k} value={k}>
                      {ACTION_STATUS_LABEL[k]}
                    </option>
                  ))}
                </Select>
              </FilterField>
            </>
          )}
        </div>
        <div className="flex items-center gap-3 border-t border-line px-4 py-2 text-[13px] text-ink-3">
          <span className="num font-mono text-[12px]">{tab === "meetings" ? mRows.length : aRows.length} รายการ</span>
          {filtered && (
            <button type="button" onClick={() => (setQ(""), setProject(""), setType(""), setStatus(""), setOwner(""))} className="inline-flex items-center gap-1 text-ink-2 hover:text-ink">
              <X {...I} />
              ล้างตัวกรอง
            </button>
          )}
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          {tab === "meetings" ? (
            mRows.length === 0 ? (
              <Empty>ไม่พบการประชุมตามตัวกรอง</Empty>
            ) : (
              <table className="w-full min-w-[820px]">
                <thead>
                  <tr>
                    <th className={th}>ครั้งที่ · วันที่</th>
                    <th className={th}>หัวข้อ</th>
                    <th className={th}>ประเภท</th>
                    <th className={th}>ผู้เข้าประชุม</th>
                    <th className={th}>งานติดตาม</th>
                    <th className={th}>สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {mRows.map((m) => {
                    const raised = acts.filter((a) => a.meetingId === m.id);
                    return (
                      <tr key={m.id} className={rowCls} onClick={() => router.push(`/meetings/${m.id}`)}>
                        <td className={td}>
                          <span className="font-mono text-[12px] text-accent-text">{m.id}</span>
                          <span className="num block font-mono text-[12px] text-ink-3">
                            {thDate(m.date)} {m.time} น.
                          </span>
                        </td>
                        <td className={td}>
                          <span className="block max-w-[320px] truncate">{m.title}</span>
                          <span className="block max-w-[320px] truncate text-[12px] text-ink-3">{pname(m.projectId)}</span>
                        </td>
                        <td className={cx(td, "text-[13px] text-ink-2")}>{MEETING_TYPE_LABEL[m.type]}</td>
                        <td className={cx(td, "num font-mono text-[13px]")}>
                          {m.attendees.filter((a) => a.present).length}/{m.attendees.length}
                        </td>
                        <td className={cx(td, "text-[13px] text-ink-2")}>
                          ใหม่ {raised.length} · ยกมา {m.carried.length}
                        </td>
                        <td className={td}>{m.status === "issued" ? <Pill tone="pos">ออกรายงานแล้ว</Pill> : <Pill tone="warn">ร่าง</Pill>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          ) : aRows.length === 0 ? (
            <Empty>ไม่มีงานตามตัวกรอง</Empty>
          ) : (
            <table className="w-full min-w-[820px]">
              <thead>
                <tr>
                  <th className={th}>งาน</th>
                  <th className={th}>ผู้รับผิดชอบ</th>
                  <th className={th}>กำหนด</th>
                  <th className={th}>จากการประชุม</th>
                  <th className={th}>สถานะ</th>
                  <th className={th} />
                </tr>
              </thead>
              <tbody>
                {aRows.map((a) => {
                  const m = ms.find((x) => x.id === a.meetingId);
                  return (
                    <tr key={a.id} className="border-t border-line">
                      <td className={td}>
                        <span className="block max-w-[360px]">{a.text}</span>
                        <span className="block font-mono text-[11px] text-ink-3">
                          {a.id} · {getProject(a.projectId)?.name ?? a.projectId}
                        </span>
                      </td>
                      <td className={cx(td, "text-[13px]")}>{a.owner}</td>
                      <td className={td}>
                        <Due date={a.due} done={a.status !== "open"} />
                      </td>
                      <td className={cx(td, "text-[13px]")}>
                        <button type="button" onClick={() => router.push(`/meetings/${a.meetingId}`)} className="text-left text-accent-text hover:underline">
                          {m ? `${m.title}` : a.meetingId}
                        </button>
                        {m && <span className="num block font-mono text-[12px] text-ink-3">{thDate(m.date)}</span>}
                      </td>
                      <td className={td}>
                        <Pill tone={isOverdue(a) ? "neg" : ACTION_TONE[a.status]}>{isOverdue(a) ? "เลยกำหนด" : ACTION_STATUS_LABEL[a.status]}</Pill>
                        {a.doneAt && <span className="num block font-mono text-[12px] text-ink-3">{thDate(a.doneAt)}</span>}
                      </td>
                      <td className={cx(td, "text-right")}>
                        {perms.edit &&
                          (a.status === "open" ? (
                            <Btn small onClick={() => setAct(a, "done")}>
                              <Check {...I} />
                              เสร็จแล้ว
                            </Btn>
                          ) : (
                            <Btn small onClick={() => setAct(a, "open")}>
                              เปิดอีกครั้ง
                            </Btn>
                          ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {newOpen && <NewMeetingModal defaultProject={project} onClose={() => setNewOpen(false)} onCreated={(id) => router.push(`/meetings/${id}`)} />}
    </>
  );
}

export function NewMeetingModal({ defaultProject, onClose, onCreated, from }: { defaultProject: string; onClose: () => void; onCreated: (id: string) => void; from?: Meeting }) {
  const { me } = useEngPerms();
  const [projectId, setProjectId] = useState(from?.projectId ?? defaultProject);
  const [type, setType] = useState<MeetingType>(from?.type ?? "site");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(from?.nextDate ?? TODAY);
  const [time, setTime] = useState(from?.time ?? "09:00");
  const [place, setPlace] = useState(from?.place ?? "สำนักงานสนาม");
  const [chair, setChair] = useState(from?.chair ?? getProject(defaultProject)?.pm ?? me.name);
  const toText = (a: Attendee[]) => a.map((x) => `${x.name}${x.org ? ` | ${x.org}` : ""}`).join("\n");
  const [att, setAtt] = useState(() => toText(from ? from.attendees : defaultProject ? previousAttendees(defaultProject) : []));
  const [agenda, setAgenda] = useState("ติดตามเรื่องค้างจากการประชุมครั้งก่อน\nความคืบหน้างาน\nปัญหาและอุปสรรค\nความปลอดภัย");
  const openCount = actionItems.all().filter((a) => a.projectId === projectId && a.status === "open").length;
  const no = meetings.all().filter((m) => m.projectId === projectId).length + 1;
  const ok = projectId && date && chair.trim();
  const changeProject = (v: string) => {
    setProjectId(v);
    setAtt(toText(previousAttendees(v, type)));
    const pm = getProject(v)?.pm;
    if (pm) setChair(pm);
  };
  const save = () => {
    if (!ok) return;
    const m = createMeeting({
      projectId,
      type,
      title: title.trim() || `${MEETING_TYPE_LABEL[type]} ครั้งที่ ${no}`,
      date,
      time,
      place: place.trim(),
      chair: chair.trim(),
      attendees: parseAttendees(att),
      agenda: lines(agenda),
    });
    onClose();
    onCreated(m.id);
  };
  return (
    <Modal
      open
      onClose={onClose}
      width={720}
      title={from ? "นัดประชุมครั้งถัดไป" : "นัดประชุม"}
      footer={
        <>
          <span className="mr-auto text-[13px] text-ink-3">{projectId ? `ยกเรื่องค้าง ${openCount} เรื่องมาติดตาม` : ""}</span>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!ok} onClick={save}>
            สร้างการประชุม
          </Btn>
        </>
      }
    >
      <PeopleList />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="โครงการ">
            <ProjectSelect value={projectId} onChange={changeProject} required />
          </Field>
        </div>
        <Field label="ประเภท">
          <Select label="ประเภท" value={type} onChange={(v) => setType(v as MeetingType)}>
            {(Object.keys(MEETING_TYPE_LABEL) as MeetingType[]).map((k) => (
              <option key={k} value={k}>
                {MEETING_TYPE_LABEL[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="หัวข้อ">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`${MEETING_TYPE_LABEL[type]} ครั้งที่ ${no}`} className={inputCls} />
        </Field>
        <Field label="วันที่">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={cx(inputCls, "font-mono")} />
        </Field>
        <Field label="เวลา">
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={cx(inputCls, "font-mono")} />
        </Field>
        <Field label="สถานที่">
          <input value={place} onChange={(e) => setPlace(e.target.value)} className={inputCls} />
        </Field>
        <Field label="ประธานการประชุม">
          <input value={chair} onChange={(e) => setChair(e.target.value)} list="eng-people" className={inputCls} />
        </Field>
        <Field label="ผู้เข้าประชุม (บรรทัดละคน · ชื่อ | หน่วยงาน)">
          <Area value={att} onChange={setAtt} rows={5} placeholder={"ศิริพร ตั้งเจริญ | ผู้จัดการโครงการ"} />
        </Field>
        <Field label="วาระการประชุม (บรรทัดละวาระ)">
          <Area value={agenda} onChange={setAgenda} rows={5} />
        </Field>
      </div>
    </Modal>
  );
}
