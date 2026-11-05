"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, FileCheck2, Plus, Printer, Save, Trash2 } from "lucide-react";
import { Card, CardHead, cx, Field, inputCls } from "@/components/ui";
import { Btn, Empty, I, IconBtn, Pill, PrintStyle, Select, useHydrated } from "@/components/ops/bits";
import { getProject, thDate, TODAY } from "@/lib/data";
import { ACTION_STATUS_LABEL, actionItems, MEETING_TYPE_LABEL, meetings, nextPlainId, type ActionItem, type ActionStatus, type Meeting } from "@/lib/engineering";
import { Area, Back, DocHeader, DocRow, DocSection, Due, pname, PeopleList, Signatures, useEngPerms } from "./bits";
import { ACTION_TONE, isOverdue, NewMeetingModal } from "./meetings-view";

export function MeetingDetail({ id }: { id: string }) {
  const all = meetings.use();
  const hydrated = useHydrated();
  const m = all.find((x) => x.id === id);
  if (!m)
    return (
      <Card>
        <Empty>{hydrated ? `ไม่พบการประชุม ${id}` : "กำลังโหลด"}</Empty>
      </Card>
    );
  return <Body key={`${m.id}-${m.status}`} meeting={m} />;
}

function Body({ meeting }: { meeting: Meeting }) {
  const router = useRouter();
  const perms = useEngPerms();
  const acts = actionItems.use();
  const [m, setM] = useState<Meeting>(meeting);
  const [dirty, setDirty] = useState(false);
  const [nextOpen, setNextOpen] = useState(false);
  const [newAtt, setNewAtt] = useState({ name: "", org: "" });
  const [newAct, setNewAct] = useState({ text: "", owner: "", due: TODAY });
  const ro = !perms.edit;
  const p = getProject(m.projectId);

  const set = (patch: Partial<Meeting>) => {
    setM((x) => ({ ...x, ...patch }));
    setDirty(true);
  };
  const save = (extra?: Partial<Meeting>) => {
    meetings.upsert({ ...m, ...extra });
    setDirty(false);
  };
  const carried = m.carried.map((id) => acts.find((a) => a.id === id)).filter((a): a is ActionItem => !!a);
  const raised = acts.filter((a) => a.meetingId === m.id).sort((a, b) => a.id.localeCompare(b.id));
  const setAct = (a: ActionItem, patch: Partial<ActionItem>) => actionItems.upsert({ ...a, ...patch });
  const setActStatus = (a: ActionItem, s: ActionStatus) => setAct(a, { status: s, doneAt: s === "done" ? TODAY : undefined });
  const addAct = () => {
    if (!newAct.text.trim() || !newAct.owner.trim()) return;
    actionItems.upsert({ id: nextPlainId(actionItems.all(), "ACT", m.projectId), projectId: m.projectId, meetingId: m.id, text: newAct.text.trim(), owner: newAct.owner.trim(), due: newAct.due, status: "open" });
    setNewAct({ text: "", owner: newAct.owner, due: newAct.due });
  };
  const remove = () => {
    if (!window.confirm(`ลบการประชุม ${m.id}`)) return;
    for (const a of raised) actionItems.remove(a.id);
    meetings.remove(m.id);
    router.push("/meetings");
  };
  const issue = () => {
    if (!window.confirm("ออกรายงานการประชุมฉบับนี้")) return;
    save({ status: "issued" });
  };

  return (
    <>
      <PrintStyle />
      <PeopleList />
      <div className="ops-noprint">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-5">
          <div className="flex flex-wrap items-center gap-2">
            <Back href={`/meetings?project=${m.projectId}`} />
            <Pill mono>{m.id}</Pill>
            <Pill tone="accent">{MEETING_TYPE_LABEL[m.type]}</Pill>
            {m.status === "issued" ? <Pill tone="pos">ออกรายงานแล้ว</Pill> : <Pill tone="warn">ร่าง</Pill>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {perms.edit && dirty && (
              <Btn primary onClick={() => save()}>
                <Save {...I} />
                บันทึก
              </Btn>
            )}
            {perms.edit && m.status === "draft" && (
              <Btn onClick={issue}>
                <FileCheck2 {...I} />
                ออกรายงาน
              </Btn>
            )}
            {perms.edit && (
              <Btn onClick={() => setNextOpen(true)}>
                <CalendarPlus {...I} />
                นัดครั้งถัดไป
              </Btn>
            )}
            <Btn onClick={() => window.print()}>
              <Printer {...I} />
              พิมพ์รายงาน
            </Btn>
            {perms.approve && (
              <Btn danger onClick={remove}>
                <Trash2 {...I} />
              </Btn>
            )}
          </div>
        </div>

        {ro ? (
          <h1 className="text-[26px] font-normal leading-[1.2]">{m.title}</h1>
        ) : (
          <input value={m.title} onChange={(e) => set({ title: e.target.value })} aria-label="หัวข้อการประชุม" className="w-full bg-transparent text-[26px] font-normal leading-[1.2] outline-none focus:underline" />
        )}
        <p className="mt-1.5 pb-6 text-[13px] text-ink-2">
          {pname(m.projectId)} <span className="font-mono text-[12px] text-ink-3">{m.projectId}</span>
        </p>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
          <div className="flex flex-col gap-4">
            <Card>
              <CardHead title="เรื่องติดตามจากการประชุมครั้งก่อน" meta={carried.length} />
              {carried.length === 0 ? (
                <p className="px-5 py-4 text-[13px] text-ink-3">ไม่มีเรื่องค้างยกมา</p>
              ) : (
                <ActionList items={carried} ro={ro} onStatus={setActStatus} onNote={(a, note) => setAct(a, { note })} />
              )}
            </Card>

            <Card>
              <CardHead title="วาระการประชุม" />
              <div className="px-5 py-4">
                {ro ? (
                  <ol className="list-decimal pl-5 text-[14px]">
                    {m.agenda.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ol>
                ) : (
                  <Area value={m.agenda.join("\n")} onChange={(v) => set({ agenda: v.split("\n") })} rows={4} placeholder="บรรทัดละวาระ" />
                )}
              </div>
            </Card>

            <Card>
              <CardHead title="บันทึกการประชุม" />
              <div className="px-5 py-4">
                {ro ? <p className="whitespace-pre-wrap text-[14px]">{m.minutes || "–"}</p> : <Area value={m.minutes} onChange={(v) => set({ minutes: v })} rows={6} placeholder="สาระสำคัญที่หารือในแต่ละวาระ" />}
              </div>
            </Card>

            <Card>
              <CardHead title="มติที่ประชุม" meta={m.decisions.filter(Boolean).length} />
              <div className="px-5 py-4">
                {ro ? (
                  <ol className="list-decimal pl-5 text-[14px]">
                    {m.decisions.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ol>
                ) : (
                  <Area value={m.decisions.join("\n")} onChange={(v) => set({ decisions: v.split("\n") })} rows={4} placeholder="บรรทัดละมติ" />
                )}
              </div>
            </Card>

            <Card>
              <CardHead title="งานที่ต้องดำเนินการ (จากการประชุมนี้)" meta={raised.length} />
              {raised.length === 0 ? <p className="px-5 py-4 text-[13px] text-ink-3">ยังไม่มีงานที่มอบหมาย</p> : <ActionList items={raised} ro={ro} onStatus={setActStatus} onNote={(a, note) => setAct(a, { note })} />}
              {!ro && (
                <div className="grid grid-cols-1 gap-2 border-t border-line px-5 py-3 sm:grid-cols-[1fr_200px_150px_auto]">
                  <input value={newAct.text} onChange={(e) => setNewAct({ ...newAct, text: e.target.value })} placeholder="งานที่ต้องทำ" className={inputCls} />
                  <input value={newAct.owner} onChange={(e) => setNewAct({ ...newAct, owner: e.target.value })} placeholder="ผู้รับผิดชอบ" list="eng-people" className={inputCls} />
                  <input type="date" value={newAct.due} onChange={(e) => setNewAct({ ...newAct, due: e.target.value })} aria-label="กำหนดเสร็จ" className={cx(inputCls, "font-mono")} />
                  <Btn onClick={addAct} disabled={!newAct.text.trim() || !newAct.owner.trim()}>
                    <Plus {...I} />
                    เพิ่ม
                  </Btn>
                </div>
              )}
            </Card>
          </div>

          <div className="flex flex-col gap-4">
            <Card>
              <CardHead title="ข้อมูลการประชุม" />
              <div className="grid grid-cols-2 gap-3 px-5 py-4">
                <Field label="วันที่">
                  <input type="date" disabled={ro} value={m.date} onChange={(e) => set({ date: e.target.value })} className={cx(inputCls, "font-mono")} />
                </Field>
                <Field label="เวลา">
                  <input type="time" disabled={ro} value={m.time} onChange={(e) => set({ time: e.target.value })} className={cx(inputCls, "font-mono")} />
                </Field>
                <div className="col-span-2">
                  <Field label="สถานที่">
                    <input disabled={ro} value={m.place} onChange={(e) => set({ place: e.target.value })} className={inputCls} />
                  </Field>
                </div>
                <div className="col-span-2">
                  <Field label="ประธาน">
                    <input disabled={ro} value={m.chair} onChange={(e) => set({ chair: e.target.value })} list="eng-people" className={inputCls} />
                  </Field>
                </div>
                <div className="col-span-2">
                  <Field label="ประชุมครั้งถัดไป">
                    <input type="date" disabled={ro} value={m.nextDate ?? ""} onChange={(e) => set({ nextDate: e.target.value || undefined })} className={cx(inputCls, "font-mono")} />
                  </Field>
                </div>
              </div>
            </Card>
            <Card>
              <CardHead title="ผู้เข้าประชุม" meta={`${m.attendees.filter((a) => a.present).length}/${m.attendees.length}`} />
              <ul>
                {m.attendees.map((a, i) => (
                  <li key={`${a.name}-${i}`} className="flex items-center gap-3 border-t border-line px-5 py-2 first:border-t-0">
                    <input
                      type="checkbox"
                      disabled={ro}
                      checked={a.present}
                      aria-label={`${a.name} เข้าประชุม`}
                      onChange={(e) => set({ attendees: m.attendees.map((x, k) => (k === i ? { ...x, present: e.target.checked } : x)) })}
                      className="size-4 accent-[var(--ink)]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className={cx("block truncate text-[14px]", !a.present && "text-ink-3")}>{a.name}</span>
                      <span className="block truncate text-[12px] text-ink-3">
                        {a.org}
                        {!a.present && " · ไม่ได้เข้าประชุม"}
                      </span>
                    </span>
                    {!ro && (
                      <IconBtn label={`ลบ ${a.name}`} danger onClick={() => set({ attendees: m.attendees.filter((_, k) => k !== i) })}>
                        <Trash2 {...I} />
                      </IconBtn>
                    )}
                  </li>
                ))}
              </ul>
              {!ro && (
                <div className="flex flex-wrap gap-2 border-t border-line px-5 py-3">
                  <input value={newAtt.name} onChange={(e) => setNewAtt({ ...newAtt, name: e.target.value })} placeholder="ชื่อ" list="eng-people" className={cx(inputCls, "h-8 min-w-0 flex-1 text-[13px]")} />
                  <input value={newAtt.org} onChange={(e) => setNewAtt({ ...newAtt, org: e.target.value })} placeholder="หน่วยงาน" className={cx(inputCls, "h-8 min-w-0 flex-1 text-[13px]")} />
                  <Btn
                    small
                    disabled={!newAtt.name.trim()}
                    onClick={() => {
                      set({ attendees: [...m.attendees, { name: newAtt.name.trim(), org: newAtt.org.trim(), present: true }] });
                      setNewAtt({ name: "", org: "" });
                    }}
                  >
                    <Plus {...I} />
                  </Btn>
                </div>
              )}
            </Card>
            {dirty && <p className="text-center text-[13px] text-warn">มีการแก้ไขที่ยังไม่บันทึก</p>}
          </div>
        </div>
      </div>

      {/* printable minutes */}
      <article className="ops-print hidden bg-white text-ink print:block">
        <DocHeader
          title="รายงานการประชุม"
          titleEn="MINUTES OF MEETING"
          code={m.id}
          meta={
            <>
              <p>
                {thDate(m.date)} {m.time} น.
              </p>
              <p>{MEETING_TYPE_LABEL[m.type]}</p>
            </>
          }
        />
        <DocSection n={1} title="ข้อมูลการประชุม" en="MEETING">
          <div className="grid grid-cols-2 gap-x-6">
            <DocRow k="โครงการ">
              {m.projectId} · {p?.name}
            </DocRow>
            <DocRow k="หัวข้อ">{m.title}</DocRow>
            <DocRow k="สถานที่">{m.place}</DocRow>
            <DocRow k="ประธาน">{m.chair}</DocRow>
            <DocRow k="ประชุมครั้งถัดไป">{m.nextDate ? thDate(m.nextDate) : "–"}</DocRow>
            <DocRow k="สถานะรายงาน">{m.status === "issued" ? "ออกรายงานแล้ว" : "ร่าง"}</DocRow>
          </div>
        </DocSection>
        <DocSection n={2} title="ผู้เข้าประชุม" en="ATTENDEES">
          <div className="grid grid-cols-2 gap-x-6 text-[12px]">
            {m.attendees.map((a, i) => (
              <p key={i} className="border-b border-line py-1">
                {i + 1}. {a.name} <span className="text-ink-3">{a.org}</span> {!a.present && <span className="text-ink-3">(ไม่ได้เข้าประชุม)</span>}
              </p>
            ))}
          </div>
        </DocSection>
        <DocSection n={3} title="เรื่องติดตามจากการประชุมครั้งก่อน" en="CARRIED FORWARD">
          <PrintActions items={carried} />
        </DocSection>
        <DocSection n={4} title="วาระและบันทึกการประชุม" en="AGENDA & MINUTES">
          <ol className="list-decimal pl-5 text-[12px]">
            {m.agenda.filter(Boolean).map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ol>
          {m.minutes && <p className="mt-2 whitespace-pre-wrap text-[12px]">{m.minutes}</p>}
        </DocSection>
        <DocSection n={5} title="มติที่ประชุม" en="DECISIONS">
          <ol className="list-decimal pl-5 text-[12px]">
            {m.decisions.filter(Boolean).map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ol>
        </DocSection>
        <DocSection n={6} title="งานที่ต้องดำเนินการ" en="ACTION ITEMS">
          <PrintActions items={raised} />
        </DocSection>
        <Signatures roles={[{ role: "ผู้บันทึกการประชุม" }, { role: "ประธานการประชุม", name: m.chair }]} />
      </article>

      {nextOpen && <NewMeetingModal from={m} defaultProject={m.projectId} onClose={() => setNextOpen(false)} onCreated={(id) => router.push(`/meetings/${id}`)} />}
    </>
  );
}

function ActionList({ items, ro, onStatus, onNote }: { items: ActionItem[]; ro: boolean; onStatus: (a: ActionItem, s: ActionStatus) => void; onNote: (a: ActionItem, note: string) => void }) {
  return (
    <ul>
      {items.map((a) => (
        <li key={a.id} className="flex flex-wrap items-start gap-3 border-t border-line px-5 py-3 first:border-t-0">
          <div className="min-w-0 flex-1">
            <p className={cx("text-[14px]", a.status !== "open" && "text-ink-3")}>{a.text}</p>
            <p className="text-[12px] text-ink-3">
              <span className="font-mono">{a.id}</span> · {a.owner}
            </p>
            {ro ? (
              a.note && <p className="mt-1 text-[13px] text-ink-2">{a.note}</p>
            ) : (
              <input defaultValue={a.note ?? ""} onBlur={(e) => e.target.value !== (a.note ?? "") && onNote(a, e.target.value)} placeholder="ความคืบหน้า" className={cx(inputCls, "mt-1.5 h-8 w-full text-[13px]")} />
            )}
          </div>
          <Due date={a.due} done={a.status !== "open"} />
          {ro ? (
            <Pill tone={isOverdue(a) ? "neg" : ACTION_TONE[a.status]}>{ACTION_STATUS_LABEL[a.status]}</Pill>
          ) : (
            <Select label="สถานะ" value={a.status} onChange={(v) => onStatus(a, v as ActionStatus)} className="h-8 w-[120px] text-[13px]">
              {(Object.keys(ACTION_STATUS_LABEL) as ActionStatus[]).map((k) => (
                <option key={k} value={k}>
                  {ACTION_STATUS_LABEL[k]}
                </option>
              ))}
            </Select>
          )}
        </li>
      ))}
    </ul>
  );
}

function PrintActions({ items }: { items: ActionItem[] }) {
  if (!items.length) return <p className="text-[12px] text-ink-3">ไม่มี</p>;
  return (
    <table className="w-full text-left text-[12px]">
      <thead>
        <tr className="border-b border-ink-3 text-ink-3">
          <th className="w-8 py-1 font-normal">ที่</th>
          <th className="py-1 font-normal">เรื่อง</th>
          <th className="py-1 font-normal">ผู้รับผิดชอบ</th>
          <th className="py-1 font-normal">กำหนด</th>
          <th className="py-1 font-normal">สถานะ</th>
        </tr>
      </thead>
      <tbody>
        {items.map((a, i) => (
          <tr key={a.id} className="border-b border-line align-top">
            <td className="py-1 font-mono">{i + 1}</td>
            <td className="py-1">
              {a.text}
              {a.note && <span className="block text-ink-3">{a.note}</span>}
            </td>
            <td className="py-1">{a.owner}</td>
            <td className="py-1 font-mono">{thDate(a.due)}</td>
            <td className={cx("py-1", isOverdue(a) && "text-neg")}>{isOverdue(a) ? "เลยกำหนด" : ACTION_STATUS_LABEL[a.status]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
