"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Smartphone, Trash2 } from "lucide-react";
import { Card, cx, Field, inputCls } from "@/components/ui";
import { Btn, Empty, FilterField, I, IconBtn, KV, Modal, Pill, StatCard } from "@/components/ops/bits";
import { tableCls, td, th, thR, tdR } from "@/components/accounting/bits";
import { MediaField, MediaStrip } from "@/components/media/media-field";
import { SignaturePad } from "@/components/media/signature-pad";
import { subcontractors } from "@/lib/biz";
import { thDate, TODAY } from "@/lib/data";
import { addDays } from "@/lib/hr/payroll";
import { ACTIVE_SITES } from "@/lib/hr/seed";
import { attendance, employees } from "@/lib/hr/store";
import type { MediaRef } from "@/lib/media";
import { timeOfDay } from "@/lib/safety/now";
import { toolboxTalks } from "@/lib/safety/store";
import { talkHeadcount, TOPIC_CAT_LABEL, TOPICS, type Attendee, type TopicCat, type ToolboxTalk } from "@/lib/safety/types";
import { n0, siteName, SiteSelect, useSafetyAccess } from "./bits";

export function ToolboxTab({ q }: { q?: string }) {
  const talks = toolboxTalks.use();
  const { edit } = useSafetyAccess();
  const [site, setSite] = useState("");
  const [search, setSearch] = useState(q ?? "");
  const [open, setOpen] = useState<ToolboxTalk | null>(() => (q ? (toolboxTalks.get(q) ?? null) : null));
  const [creating, setCreating] = useState(false);

  const monthStart = `${TODAY.slice(0, 7)}-01`;
  const week = addDays(TODAY, -7);
  const thisMonth = talks.filter((t) => t.date >= monthStart);
  const shown = talks
    .filter((t) => (!site || t.projectId === site) && (!search || `${t.id} ${t.topic} ${t.presenter} ${t.projectId}`.toLowerCase().includes(search.toLowerCase())))
    .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time))
    .slice(0, 120);
  const idle = ACTIVE_SITES.filter((p) => !talks.some((t) => t.projectId === p.id && t.date > week));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Toolbox talk เดือนนี้" value={thisMonth.length} unit="ครั้ง" />
        <StatCard label="ผู้เข้าร่วมเดือนนี้" value={n0(thisMonth.reduce((s, t) => s + talkHeadcount(t), 0))} unit="คน-ครั้ง" />
        <StatCard label="ชั่วโมงอบรมเดือนนี้" value={n0(thisMonth.reduce((s, t) => s + (talkHeadcount(t) * t.durationMin) / 60, 0))} unit="ชม.-คน" />
        <StatCard label="หน้างานไม่มี talk 7 วัน" value={idle.length} unit="แห่ง" tone={idle.length ? "neg" : undefined} note={idle.map((p) => p.id).join(", ") || "ครบทุกหน้างาน"} />
      </div>

      <Card>
        <div className="flex flex-wrap items-end gap-3 border-b border-line px-5 py-4">
          <FilterField label="หน้างาน" className="min-w-[240px] flex-1">
            <SiteSelect value={site} onChange={setSite} />
          </FilterField>
          <FilterField label="ค้นหา" className="min-w-[200px] flex-1">
            <input className={inputCls} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="หัวข้อ ผู้บรรยาย เลขที่" />
          </FilterField>
          <div className="flex gap-2">
            <Link href="/m/toolbox" className="inline-flex h-9 items-center gap-2 rounded-[8px] border border-line-strong bg-card px-4 text-[14px] font-medium hover:bg-raised">
              <Smartphone {...I} />
              บันทึกด้วยมือถือ
            </Link>
            {edit && (
              <Btn primary onClick={() => setCreating(true)}>
                <Plus {...I} />
                บันทึก Toolbox talk
              </Btn>
            )}
          </div>
        </div>
        {shown.length ? (
          <div className="overflow-x-auto">
            <table className={cx(tableCls, "min-w-[860px]")}>
              <thead>
                <tr>
                  <th className={cx(th, "pl-5")}>วันที่</th>
                  <th className={th}>หน้างาน</th>
                  <th className={th}>หัวข้อ</th>
                  <th className={th}>ผู้บรรยาย</th>
                  <th className={thR}>ผู้เข้าร่วม</th>
                  <th className={thR}>นาที</th>
                  <th className={cx(th, "pr-5")}>หลักฐาน</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((t) => (
                  <tr key={t.id} className="cursor-pointer hover:bg-raised/50" onClick={() => setOpen(t)}>
                    <td className={cx(td, "pl-5")}>
                      <span className="block">{thDate(t.date)}</span>
                      <span className="font-mono text-[12px] text-ink-3">
                        {t.time} · {t.id}
                      </span>
                    </td>
                    <td className={td}>
                      <span className="block max-w-[180px] truncate">{siteName(t.projectId)}</span>
                      <span className="font-mono text-[12px] text-ink-3">{t.projectId}</span>
                    </td>
                    <td className={cx(td, "max-w-[320px]")}>{t.topic}</td>
                    <td className={td}>{t.presenter}</td>
                    <td className={cx(tdR, "font-mono")}>{talkHeadcount(t)}</td>
                    <td className={cx(tdR, "font-mono")}>{t.durationMin}</td>
                    <td className={cx(td, "pr-5")}>
                      <span className="flex flex-wrap gap-1">
                        {t.signature || t.signer ? <Pill tone="pos">ลงนาม</Pill> : <Pill tone="warn">ยังไม่ลงนาม</Pill>}
                        {t.photos.length > 0 && <Pill mono>{t.photos.length} รูป</Pill>}
                        {t.source === "phone" && <Pill>มือถือ</Pill>}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>ยังไม่มีบันทึก Toolbox talk ตามตัวกรอง</Empty>
        )}
      </Card>

      {open && <TalkDetail talk={open} onClose={() => setOpen(null)} canEdit={edit} />}
      {creating && <TalkForm onClose={() => setCreating(false)} />}
    </div>
  );
}

function TalkDetail({ talk, onClose, canEdit }: { talk: ToolboxTalk; onClose: () => void; canEdit: boolean }) {
  return (
    <Modal
      open
      onClose={onClose}
      title={`${talk.id} · ${thDate(talk.date)}`}
      width={640}
      footer={
        <>
          {canEdit && (
            <Btn
              danger
              onClick={() => {
                toolboxTalks.remove(talk.id);
                onClose();
              }}
            >
              <Trash2 {...I} />
              ลบ
            </Btn>
          )}
          <Btn onClick={onClose}>ปิด</Btn>
        </>
      }
    >
      <div className="grid gap-x-6 sm:grid-cols-2">
        <KV k="หน้างาน">{siteName(talk.projectId)}</KV>
        <KV k="เวลา">
          <span className="font-mono">{talk.time}</span> · {talk.durationMin} นาที
        </KV>
        <KV k="หัวข้อ" wide>
          {talk.topic}
        </KV>
        <KV k="ผู้บรรยาย">{talk.presenter}</KV>
        <KV k="ผู้เข้าร่วม">
          <span className="font-mono">{talkHeadcount(talk)}</span> คน
        </KV>
      </div>
      {talk.notes && <p className="mt-3 text-[13px] text-ink-2">{talk.notes}</p>}
      <h3 className="mb-1 mt-4 text-[14px] font-medium">รายชื่อ</h3>
      <ul className="columns-1 gap-6 text-[13px] sm:columns-2">
        {talk.attendees.map((a, i) => (
          <li key={i} className="break-inside-avoid border-b border-line py-1">
            {a.name}
            {a.group && <span className="ml-1 text-[12px] text-ink-3">· {a.group}</span>}
          </li>
        ))}
        {talk.crews.map((c, i) => (
          <li key={`c${i}`} className="break-inside-avoid border-b border-line py-1">
            {c.name} <span className="font-mono text-[12px] text-ink-3">× {c.count}</span>
          </li>
        ))}
      </ul>
      {(talk.photos.length > 0 || talk.signature) && (
        <div className="mt-4 flex flex-col gap-2">
          <MediaStrip refs={talk.photos} size={72} />
          {talk.signature && (
            <div>
              <p className="mb-1 text-[12px] text-ink-3">ลายมือชื่อ {talk.signer}</p>
              <MediaStrip refs={[talk.signature]} size={96} />
            </div>
          )}
        </div>
      )}
      {!talk.signature && talk.signer && <p className="mt-3 text-[12px] text-ink-3">ลงนามโดย {talk.signer} (บันทึกก่อนมีลายเซ็นดิจิทัล)</p>}
    </Modal>
  );
}

function TalkForm({ onClose }: { onClose: () => void }) {
  const { me } = useSafetyAccess();
  const emps = employees.use();
  const sheets = attendance.use();
  const subs = subcontractors.use();
  const [projectId, setProjectId] = useState(ACTIVE_SITES[0]?.id ?? "");
  const [date, setDate] = useState(TODAY);
  const [time, setTime] = useState(timeOfDay);
  const [topicId, setTopicId] = useState(TOPICS[0].id);
  const [custom, setCustom] = useState("");
  const [presenter, setPresenter] = useState(me.name);
  const [duration, setDuration] = useState(15);
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<MediaRef[]>([]);
  const [sig, setSig] = useState<{ ref: MediaRef; signer: string } | null>(null);
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const [crews, setCrews] = useState<{ name: string; count: number }[] | null>(null);

  const people = emps.filter((e) => e.projectId === projectId && e.status !== "resigned" && e.type !== "subcontract");
  const sheet = sheets.find((s) => s.projectId === projectId && s.date === date);
  const presentIds = new Set(sheet?.entries.filter((e) => e.mark !== "absent").map((e) => e.employeeId) ?? people.map((e) => e.id));
  const chosen = picked ?? presentIds;
  const crewRows = crews ?? emps.filter((e) => e.type === "subcontract" && e.projectId === projectId).map((e) => ({ name: e.name, count: e.crewSize ?? 1 }));
  const switchSite = (id: string) => {
    setProjectId(id);
    setPicked(null);
    setCrews(null);
  };
  const toggle = (id: string) => {
    const next = new Set(chosen);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  };
  const topic = topicId === "custom" ? custom.trim() : (TOPICS.find((t) => t.id === topicId)?.title ?? "");
  const attendees: Attendee[] = people.filter((e) => chosen.has(e.id)).map((e) => ({ employeeId: e.id, name: e.name, group: e.type === "monthly" ? "พนักงานบริษัท" : "คนงานบริษัท" }));
  const head = attendees.length + crewRows.reduce((s, c) => s + c.count, 0);
  const ok = projectId && topic && presenter.trim() && head > 0;
  const cats = Object.keys(TOPIC_CAT_LABEL) as TopicCat[];

  const save = () => {
    if (!ok) return;
    toolboxTalks.upsert({
      id: toolboxTalks.nextId(`TBT-${date.slice(0, 4)}-`),
      projectId,
      date,
      time,
      topicId: topicId === "custom" ? undefined : topicId,
      topic,
      presenter: presenter.trim(),
      attendees,
      crews: crewRows.filter((c) => c.count > 0 && c.name.trim()),
      durationMin: duration,
      notes: notes.trim() || undefined,
      photos,
      signature: sig?.ref,
      signer: sig?.signer || undefined,
      source: "web",
    });
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="บันทึก Toolbox talk"
      width={760}
      footer={
        <>
          <span className="mr-auto text-[13px] text-ink-2">
            ผู้เข้าร่วม <span className="num font-mono">{head}</span> คน
          </span>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!ok} onClick={save}>
            บันทึก
          </Btn>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <Field label="หน้างาน">
            <SiteSelect value={projectId} onChange={switchSite} all={false} />
          </Field>
        </div>
        <Field label="วันที่">
          <input type="date" className={inputCls} value={date} max={TODAY} onChange={(e) => e.target.value && (setDate(e.target.value), setPicked(null))} />
        </Field>
        <Field label="เวลา">
          <input type="time" className={inputCls} value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
        <div className="sm:col-span-3">
          <Field label="หัวข้อจากคลังหัวข้อ">
            <select className={inputCls} value={topicId} onChange={(e) => setTopicId(e.target.value)}>
              {cats.map((c) => (
                <optgroup key={c} label={TOPIC_CAT_LABEL[c]}>
                  {TOPICS.filter((t) => t.cat === c).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </optgroup>
              ))}
              <option value="custom">หัวข้ออื่น (พิมพ์เอง)</option>
            </select>
          </Field>
        </div>
        <Field label="ระยะเวลา (นาที)">
          <input type="number" min={5} step={5} className={cx(inputCls, "font-mono")} value={duration} onChange={(e) => setDuration(Math.max(5, Number(e.target.value) || 15))} />
        </Field>
        {topicId === "custom" && (
          <div className="sm:col-span-4">
            <Field label="หัวข้อ">
              <input className={inputCls} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="เช่น การทำงานใกล้แนวสายไฟแรงสูง" />
            </Field>
          </div>
        )}
        <div className="sm:col-span-2">
          <Field label="ผู้บรรยาย">
            <input className={inputCls} value={presenter} onChange={(e) => setPresenter(e.target.value)} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="หมายเหตุ">
            <input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ประเด็นที่ถาม/ตอบ ข้อสั่งการ" />
          </Field>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_260px]">
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[13px] text-ink-2">
              คนงานบริษัท {chosen.size}/{people.length} {sheet ? "· ตั้งต้นจากใบลงเวลา" : ""}
            </span>
            <span className="flex gap-1">
              <Btn small onClick={() => setPicked(new Set(people.map((e) => e.id)))}>
                ทุกคน
              </Btn>
              <Btn small onClick={() => setPicked(new Set())}>
                ล้าง
              </Btn>
            </span>
          </div>
          <div className="max-h-[220px] overflow-y-auto rounded-[8px] border border-line">
            {people.length ? (
              people.map((e) => (
                <label key={e.id} className="flex cursor-pointer items-center gap-2.5 border-b border-line px-3 py-1.5 text-[13px] last:border-0 hover:bg-raised/50">
                  <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={chosen.has(e.id)} onChange={() => toggle(e.id)} />
                  <span className="min-w-0 flex-1 truncate">{e.name}</span>
                  <span className="text-[12px] text-ink-3">{e.skill ?? e.position}</span>
                </label>
              ))
            ) : (
              <p className="px-3 py-4 text-[13px] text-ink-3">ไม่มีพนักงานประจำหน้างานนี้</p>
            )}
          </div>
        </div>
        <div>
          <span className="mb-1 block text-[13px] text-ink-2">ทีมผู้รับเหมาช่วง (จำนวนคน)</span>
          <div className="flex flex-col gap-1.5">
            {crewRows.map((c, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input
                  className={cx(inputCls, "h-8 min-w-0 flex-1 text-[13px]")}
                  value={c.name}
                  list="tbt-subs"
                  aria-label="ชื่อทีม"
                  onChange={(e) => setCrews(crewRows.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))}
                />
                <input
                  type="number"
                  min={0}
                  aria-label="จำนวนคน"
                  className={cx(inputCls, "h-8 w-16 px-2 text-right font-mono text-[13px]")}
                  value={c.count}
                  onChange={(e) => setCrews(crewRows.map((x, k) => (k === i ? { ...x, count: Math.max(0, Number(e.target.value) || 0) } : x)))}
                />
                <IconBtn label="ลบทีม" onClick={() => setCrews(crewRows.filter((_, k) => k !== i))}>
                  <Trash2 {...I} />
                </IconBtn>
              </div>
            ))}
            <datalist id="tbt-subs">
              {subs.map((s) => (
                <option key={s.id} value={s.name} />
              ))}
            </datalist>
            <Btn small onClick={() => setCrews([...crewRows, { name: "", count: 1 }])}>
              <Plus {...I} />
              เพิ่มทีม
            </Btn>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <MediaField value={photos} onChange={setPhotos} label="รูปถ่ายการประชุม" photosOnly />
        <div>
          <span className="mb-1 block text-[13px] text-ink-2">ลายมือชื่อผู้บรรยาย / หัวหน้างาน</span>
          {sig ? (
            <div className="flex items-center gap-3">
              <MediaStrip refs={[sig.ref]} size={72} />
              <span className="text-[13px]">{sig.signer}</span>
              <Btn small onClick={() => setSig(null)}>
                เซ็นใหม่
              </Btn>
            </div>
          ) : (
            <SignaturePad height={120} onSave={(ref, signer) => setSig({ ref, signer })} />
          )}
        </div>
      </div>
    </Modal>
  );
}
