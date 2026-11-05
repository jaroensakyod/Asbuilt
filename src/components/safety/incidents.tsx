"use client";

import { useState } from "react";
import { Check, Plus, Printer } from "lucide-react";
import { Card, cx, Field, inputCls } from "@/components/ui";
import { areaCls, Btn, Empty, FilterField, I, KV, Modal, Pill, PrintStyle, Select, StatCard } from "@/components/ops/bits";
import { tableCls, td, th } from "@/components/accounting/bits";
import { Drawer, Section } from "@/components/hr/bits";
import { MediaField, MediaStrip } from "@/components/media/media-field";
import { thDate, TODAY } from "@/lib/data";
import { employees } from "@/lib/hr/store";
import { NATIONALITY_LABEL } from "@/lib/hr/types";
import type { MediaRef } from "@/lib/media";
import { incidentFollowUp } from "@/lib/safety/calc";
import { incidents, useSafetySettings } from "@/lib/safety/store";
import { BODY_PARTS, CAUSE_CATS, INC_LABEL, INC_TONE, isSerious, type Incident, type IncidentClass } from "@/lib/safety/types";
import { CheckRow, n0, siteName, SiteSelect, useSafetyAccess, VerifyNote } from "./bits";

const STATUS_LABEL: Record<Incident["status"], string> = { open: "เปิด", investigating: "กำลังสอบสวน", closed: "ปิดแล้ว" };
const STATUS_TONE: Record<Incident["status"], "warn" | "accent" | "pos"> = { open: "warn", investigating: "accent", closed: "pos" };
const CLASSES = Object.keys(INC_LABEL) as IncidentClass[];

export function IncidentsTab({ q }: { q?: string }) {
  const list = incidents.use();
  const { edit } = useSafetyAccess();
  const [site, setSite] = useState("");
  const [cls, setCls] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(() => (q && q.startsWith("INC-") ? q : null));
  const [creating, setCreating] = useState(false);

  const year = TODAY.slice(0, 4);
  const thisYear = list.filter((i) => i.date.startsWith(year));
  const count = (c: IncidentClass) => thisYear.filter((i) => i.cls === c).length;
  const openCount = list.filter((i) => i.status !== "closed").length;
  const daysLost = thisYear.reduce((s, i) => s + i.daysLost, 0);
  const seriousPending = list.filter((i) => {
    const f = incidentFollowUp(i, TODAY);
    return isSerious(i.cls) && (f.notifyLeft > 0 || f.kt16Missing);
  }).length;

  const needle = search.trim().toLowerCase();
  const shown = list
      .filter((i) => (!site || i.projectId === site) && (!cls || i.cls === cls) && (!status || i.status === status))
      .filter((i) => !needle || [i.id, i.place, i.description, i.injured?.name ?? "", siteName(i.projectId)].some((x) => x.toLowerCase().includes(needle)))
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));

  const current = openId ? list.find((i) => i.id === openId) : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <StatCard label={`เกือบเกิดเหตุ ปี ${Number(year) + 543}`} value={count("near_miss")} unit="ครั้ง" onClick={() => setCls(cls === "near_miss" ? "" : "near_miss")} active={cls === "near_miss"} />
        <StatCard label="ปฐมพยาบาล" value={count("first_aid")} unit="ครั้ง" onClick={() => setCls(cls === "first_aid" ? "" : "first_aid")} active={cls === "first_aid"} />
        <StatCard label="หยุดงาน (LTI)" value={count("lost_time")} unit="ครั้ง" tone={count("lost_time") ? "neg" : undefined} onClick={() => setCls(cls === "lost_time" ? "" : "lost_time")} active={cls === "lost_time"} />
        <StatCard label="เสียชีวิต" value={count("fatal")} unit="ราย" tone={count("fatal") ? "neg" : undefined} />
        <StatCard label="รอติดตาม" value={openCount} unit="เรื่อง" note={`วันหยุดงานรวม ${daysLost} วัน`} onClick={() => setStatus(status ? "" : "open")} active={status === "open"} />
        <StatCard label="กรณีร้ายแรงค้างแจ้ง" value={seriousPending} unit="เรื่อง" tone={seriousPending ? "neg" : undefined} note="แจ้งหน่วยงาน / กท.16" />
      </div>

      <Card>
        <div className="flex flex-wrap items-end gap-3 border-b border-line px-5 py-4">
          <FilterField label="หน้างาน" className="min-w-[220px] flex-1">
            <SiteSelect value={site} onChange={setSite} />
          </FilterField>
          <FilterField label="ประเภท" className="w-[180px]">
            <Select label="ประเภท" value={cls} onChange={setCls}>
              <option value="">ทุกประเภท</option>
              {CLASSES.map((c) => (
                <option key={c} value={c}>
                  {INC_LABEL[c]}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="สถานะ" className="w-[160px]">
            <Select label="สถานะ" value={status} onChange={setStatus}>
              <option value="">ทุกสถานะ</option>
              {(Object.keys(STATUS_LABEL) as Incident["status"][]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="ค้นหา" className="min-w-[180px] flex-1">
            <input className={inputCls} placeholder="เลขที่ สถานที่ ผู้บาดเจ็บ" value={search} onChange={(e) => setSearch(e.target.value)} />
          </FilterField>
          {edit && (
            <Btn primary onClick={() => setCreating(true)}>
              <Plus {...I} />
              รายงานอุบัติเหตุ
            </Btn>
          )}
        </div>
        {shown.length ? (
          <div className="overflow-x-auto">
            <table className={cx(tableCls, "min-w-[980px]")}>
              <thead>
                <tr>
                  <th className={cx(th, "pl-5")}>วันที่</th>
                  <th className={th}>ประเภท</th>
                  <th className={th}>หน้างาน / สถานที่</th>
                  <th className={th}>ผู้บาดเจ็บ</th>
                  <th className={cx(th, "text-right")}>วันหยุดงาน</th>
                  <th className={th}>การติดตาม</th>
                  <th className={cx(th, "pr-5")}>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((i) => {
                  const f = incidentFollowUp(i, TODAY);
                  return (
                    <tr key={i.id} className="cursor-pointer transition-colors duration-150 hover:bg-raised/60" onClick={() => setOpenId(i.id)}>
                      <td className={cx(td, "pl-5")}>
                        <span className="block whitespace-nowrap">
                          {thDate(i.date)} <span className="font-mono text-[12px] text-ink-3">{i.time}</span>
                        </span>
                        <span className="font-mono text-[12px] text-ink-3">{i.id}</span>
                      </td>
                      <td className={td}>
                        <Pill tone={INC_TONE[i.cls]}>{INC_LABEL[i.cls]}</Pill>
                      </td>
                      <td className={td}>
                        <span className="block">{siteName(i.projectId)}</span>
                        <span className="text-[12px] text-ink-3">{i.place}</span>
                      </td>
                      <td className={td}>
                        {i.injured ? (
                          <>
                            <span className="block">{i.injured.name}</span>
                            <span className="text-[12px] text-ink-3">{i.injured.bodyParts.join(", ")}</span>
                          </>
                        ) : (
                          <span className="text-ink-3">-</span>
                        )}
                      </td>
                      <td className={cx(td, "num text-right font-mono")}>{i.daysLost || ""}</td>
                      <td className={td}>
                        <div className="flex flex-wrap gap-1">
                          {f.overdue > 0 && <Pill tone="neg">เลยกำหนด {f.overdue}</Pill>}
                          {f.open > f.overdue && <Pill tone="warn">มาตรการค้าง {f.open - f.overdue}</Pill>}
                          {f.notifyLeft > 0 && <Pill tone="warn">ค้างแจ้ง {f.notifyLeft}</Pill>}
                          {f.kt16Missing && <Pill tone="neg">ยังไม่มี กท.16</Pill>}
                          {!f.open && !f.notifyLeft && !f.kt16Missing && <span className="text-[12px] text-ink-3">ครบ</span>}
                        </div>
                      </td>
                      <td className={cx(td, "pr-5")}>
                        <Pill tone={STATUS_TONE[i.status]}>{STATUS_LABEL[i.status]}</Pill>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>ไม่มีรายงานอุบัติเหตุตามเงื่อนไขที่เลือก</Empty>
        )}
      </Card>

      {current && <IncidentDrawer key={current.id} inc={current} onClose={() => setOpenId(null)} />}
      {creating && <IncidentForm onClose={() => setCreating(false)} onCreated={(id) => (setCreating(false), setOpenId(id))} />}
    </div>
  );
}

// ---------------- detail ----------------

function IncidentDrawer({ inc, onClose }: { inc: Incident; onClose: () => void }) {
  const { edit, me } = useSafetyAccess();
  const settings = useSafetySettings();
  const [actText, setActText] = useState("");
  const [actOwner, setActOwner] = useState("");
  const [actDue, setActDue] = useState(TODAY);
  const [msg, setMsg] = useState("");
  const [kt, setKt] = useState(inc.kt16 ?? { no: "", submittedAt: TODAY, office: "", wage: undefined as number | undefined, note: "" });
  const [printing, setPrinting] = useState(false);
  const serious = isSerious(inc.cls);
  const notify: Incident["notify"] = serious && !inc.notify.length ? settings.notifyItems.map((item) => ({ item, done: false })) : inc.notify;
  const f = incidentFollowUp(inc, TODAY);

  const save = (patch: Partial<Incident>) => incidents.upsert({ ...inc, ...patch });
  const setStatus = (s: Incident["status"]) => {
    if (s === "closed" && f.open) {
      setMsg(`ยังมีมาตรการแก้ไขค้าง ${f.open} รายการ ปิดเรื่องไม่ได้`);
      return;
    }
    if (s === "closed" && serious && (f.notifyLeft || f.kt16Missing)) {
      setMsg("กรณีร้ายแรง ต้องแจ้งหน่วยงานครบและบันทึก กท.16 ก่อนปิดเรื่อง");
      return;
    }
    setMsg("");
    save({ status: s });
  };
  const addAction = () => {
    if (!actText.trim()) return;
    const id = `A${inc.actions.reduce((m, a) => Math.max(m, Number(a.id.slice(1)) || 0), 0) + 1}`;
    save({ actions: [...inc.actions, { id, text: actText.trim(), owner: actOwner.trim() || me.name, due: actDue, done: false }] });
    setActText("");
    setActOwner("");
  };

  return (
    <>
      <Drawer
        open
        onClose={onClose}
        title={
          <div>
            <p className="font-mono text-[12px] text-ink-3">{inc.id}</p>
            <h2 className="text-[17px] font-medium leading-tight">{INC_LABEL[inc.cls]} · {siteName(inc.projectId)}</h2>
            <div className="mt-1.5 flex gap-2">
              <Pill tone={INC_TONE[inc.cls]}>{INC_LABEL[inc.cls]}</Pill>
              <Pill tone={STATUS_TONE[inc.status]}>{STATUS_LABEL[inc.status]}</Pill>
            </div>
          </div>
        }
        footer={
          <>
            <Btn small onClick={() => setPrinting(true)}>
              <Printer {...I} />
              พิมพ์รายงาน
            </Btn>
            {edit && inc.status === "open" && (
              <Btn small onClick={() => setStatus("investigating")}>
                เริ่มสอบสวน
              </Btn>
            )}
            {edit && inc.status !== "closed" && (
              <Btn small primary onClick={() => setStatus("closed")}>
                <Check {...I} />
                ปิดเรื่อง
              </Btn>
            )}
            {edit && inc.status === "closed" && (
              <Btn small onClick={() => setStatus("investigating")}>
                เปิดเรื่องอีกครั้ง
              </Btn>
            )}
          </>
        }
      >
        {msg && <p className="mb-3 rounded-[8px] bg-neg-soft px-3 py-2 text-[13px] text-neg">{msg}</p>}
        <Section title="ข้อมูลเหตุการณ์">
          <KV k="วันเวลา">
            {thDate(inc.date)} <span className="font-mono">{inc.time}</span> น.
          </KV>
          <KV k="สถานที่">{inc.place}</KV>
          <KV k="รายละเอียด">{inc.description}</KV>
          <KV k="ผู้เกี่ยวข้อง">{inc.people.filter(Boolean).join(", ") || "-"}</KV>
          <KV k="ผู้รายงาน">{inc.reportedBy}</KV>
        </Section>
        {inc.injured && (
          <Section title="ผู้บาดเจ็บ">
            <KV k="ชื่อ">
              {inc.injured.name}
              {inc.injured.employeeId && <span className="ml-1.5 font-mono text-[12px] text-ink-3">{inc.injured.employeeId}</span>}
            </KV>
            <KV k="ทักษะ / สัญชาติ">
              {inc.injured.trade ?? "-"} · {inc.injured.nationality ? (NATIONALITY_LABEL[inc.injured.nationality as keyof typeof NATIONALITY_LABEL] ?? inc.injured.nationality) : "-"}
            </KV>
            <KV k="อวัยวะ">{inc.injured.bodyParts.join(", ") || "-"}</KV>
            <KV k="การบาดเจ็บ">{inc.injured.injury}</KV>
            <KV k="การรักษา">
              {inc.injured.treatment}
              {inc.injured.hospital && ` · ${inc.injured.hospital}`}
            </KV>
          </Section>
        )}
        <Section title="วันหยุดงาน">
          <div className="grid grid-cols-2 gap-3">
            <Field label="จำนวนวันหยุดงาน">
              <input type="number" min={0} disabled={!edit} className={cx(inputCls, "font-mono")} value={inc.daysLost} onChange={(e) => save({ daysLost: Math.max(0, Number(e.target.value) || 0) })} />
            </Field>
            <Field label="กลับมาทำงานวันที่">
              <input type="date" disabled={!edit} className={inputCls} value={inc.returnedAt ?? ""} onChange={(e) => save({ returnedAt: e.target.value || undefined })} />
            </Field>
          </div>
        </Section>
        <Section title="วิเคราะห์สาเหตุ">
          <KV k="สาเหตุโดยตรง">{inc.cause.immediate || "-"}</KV>
          <KV k="สาเหตุรากเหง้า">{inc.cause.root || "-"}</KV>
          <div className="mt-2 flex flex-wrap gap-1">
            {inc.cause.cats.map((c) => (
              <Pill key={c}>{c}</Pill>
            ))}
          </div>
        </Section>
        <Section title="มาตรการแก้ไข" action={<span className="font-mono text-[12px] text-ink-3">{inc.actions.filter((a) => a.done).length}/{inc.actions.length}</span>}>
          {inc.actions.length ? (
            <ul>
              {inc.actions.map((a) => (
                <li key={a.id}>
                  <CheckRow
                    checked={a.done}
                    disabled={!edit}
                    onChange={(v) => save({ actions: inc.actions.map((x) => (x.id === a.id ? { ...x, done: v, doneAt: v ? TODAY : undefined } : x)) })}
                  >
                    <span className="block">{a.text}</span>
                    <span className={cx("text-[12px]", !a.done && a.due < TODAY ? "text-neg" : "text-ink-3")}>
                      {a.owner} · กำหนด {thDate(a.due)}
                      {a.doneAt && ` · เสร็จ ${thDate(a.doneAt)}`}
                    </span>
                  </CheckRow>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-ink-3">ยังไม่มีมาตรการ</p>
          )}
          {edit && (
            <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
              <input className={cx(inputCls, "col-span-2")} placeholder="มาตรการแก้ไข/ป้องกัน" value={actText} onChange={(e) => setActText(e.target.value)} />
              <input className={inputCls} placeholder="ผู้รับผิดชอบ" value={actOwner} onChange={(e) => setActOwner(e.target.value)} />
              <input type="date" className={inputCls} value={actDue} onChange={(e) => setActDue(e.target.value)} />
              <div className="col-span-2 flex justify-end">
                <Btn small onClick={addAction} disabled={!actText.trim()}>
                  <Plus {...I} />
                  เพิ่มมาตรการ
                </Btn>
              </div>
            </div>
          )}
        </Section>
        {serious && (
          <>
            <Section title="การแจ้งหน่วยงาน (กรณีร้ายแรง)" action={<span className="font-mono text-[12px] text-ink-3">{notify.filter((n) => n.done).length}/{notify.length}</span>}>
              <ul>
                {notify.map((n, k) => (
                  <li key={n.item}>
                    <CheckRow checked={n.done} disabled={!edit} onChange={(v) => save({ notify: notify.map((x, j) => (j === k ? { ...x, done: v, at: v ? TODAY : undefined } : x)) })}>
                      <span className="block">{n.item}</span>
                      {n.at && <span className="text-[12px] text-ink-3">ดำเนินการ {thDate(n.at)}</span>}
                    </CheckRow>
                  </li>
                ))}
              </ul>
              <VerifyNote>ระยะเวลาการแจ้งเป็นค่าเริ่มต้น ตรวจสอบกับกฎหมายความปลอดภัยและประกาศล่าสุด</VerifyNote>
            </Section>
            <Section title="แบบ กท.16 (แจ้งการประสบอันตราย กองทุนเงินทดแทน)">
              <div className="grid grid-cols-2 gap-3">
                <Field label="เลขที่รับแจ้ง">
                  <input className={cx(inputCls, "font-mono")} disabled={!edit} value={kt.no} onChange={(e) => setKt({ ...kt, no: e.target.value })} />
                </Field>
                <Field label="วันที่ยื่น">
                  <input type="date" className={inputCls} disabled={!edit} value={kt.submittedAt} onChange={(e) => setKt({ ...kt, submittedAt: e.target.value })} />
                </Field>
                <div className="col-span-2">
                  <Field label="สำนักงานประกันสังคม">
                    <input className={inputCls} disabled={!edit} value={kt.office} onChange={(e) => setKt({ ...kt, office: e.target.value })} />
                  </Field>
                </div>
                <Field label="ค่าจ้างต่อเดือน (บาท)">
                  <input type="number" min={0} className={cx(inputCls, "font-mono")} disabled={!edit} value={kt.wage ?? ""} onChange={(e) => setKt({ ...kt, wage: Number(e.target.value) || undefined })} />
                </Field>
                <Field label="หมายเหตุ">
                  <input className={inputCls} disabled={!edit} value={kt.note ?? ""} onChange={(e) => setKt({ ...kt, note: e.target.value })} />
                </Field>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <VerifyNote>แบบ กท.16 ยื่นภายใน 15 วัน ตรวจสอบกับประกาศสำนักงานประกันสังคมล่าสุด</VerifyNote>
                {edit && (
                  <Btn small primary disabled={!kt.no.trim() || !kt.office.trim()} onClick={() => save({ kt16: { ...kt, no: kt.no.trim(), office: kt.office.trim(), note: kt.note?.trim() || undefined } })}>
                    บันทึก กท.16
                  </Btn>
                )}
              </div>
              {inc.kt16 && <p className="mt-1 text-[12px] text-pos">บันทึกแล้ว · {inc.kt16.no}</p>}
            </Section>
          </>
        )}
        <Section title="รูปถ่าย">{edit ? <MediaField value={inc.photos} onChange={(photos) => save({ photos })} photosOnly label="รูปที่เกิดเหตุ" /> : inc.photos.length ? <MediaStrip refs={inc.photos} /> : <p className="text-[13px] text-ink-3">ไม่มีรูป</p>}</Section>
      </Drawer>
      {printing && <IncidentPrint inc={inc} onClose={() => setPrinting(false)} />}
    </>
  );
}

function IncidentPrint({ inc, onClose }: { inc: Incident; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-[rgb(31_27_22/0.28)] px-4 py-10 print:static print:bg-transparent print:p-0">
      <PrintStyle />
      <div className="ops-noprint mx-auto mb-3 flex max-w-[800px] justify-end gap-2">
        <Btn small onClick={onClose}>ปิด</Btn>
        <Btn small primary onClick={() => window.print()}>
          <Printer {...I} />
          พิมพ์
        </Btn>
      </div>
      <article className="ops-print mx-auto max-w-[800px] rounded-[12px] border border-line bg-card px-10 py-8 text-[13px]">
        <header className="mb-5 flex items-start justify-between border-b border-line pb-3">
          <div>
            <h1 className="text-[18px] font-medium">รายงานการเกิดอุบัติเหตุ / เหตุการณ์</h1>
            <p className="text-ink-2">{siteName(inc.projectId)} · {inc.projectId}</p>
          </div>
          <div className="text-right font-mono text-[12px]">
            <p>{inc.id}</p>
            <p>{INC_LABEL[inc.cls]}</p>
          </div>
        </header>
        <div className="grid grid-cols-2 gap-x-6">
          <KV k="วันเวลา">{thDate(inc.date)} {inc.time} น.</KV>
          <KV k="สถานที่">{inc.place}</KV>
          <KV k="ผู้รายงาน">{inc.reportedBy}</KV>
          <KV k="วันหยุดงาน">{inc.daysLost} วัน</KV>
          <KV k="รายละเอียด" wide>{inc.description}</KV>
          <KV k="ผู้เกี่ยวข้อง" wide>{inc.people.filter(Boolean).join(", ") || "-"}</KV>
          {inc.injured && (
            <>
              <KV k="ผู้บาดเจ็บ">{inc.injured.name}</KV>
              <KV k="อวัยวะ">{inc.injured.bodyParts.join(", ")}</KV>
              <KV k="การบาดเจ็บ">{inc.injured.injury}</KV>
              <KV k="การรักษา">{inc.injured.treatment}{inc.injured.hospital ? ` · ${inc.injured.hospital}` : ""}</KV>
            </>
          )}
          <KV k="สาเหตุโดยตรง" wide>{inc.cause.immediate}</KV>
          <KV k="สาเหตุรากเหง้า" wide>{inc.cause.root}</KV>
          <KV k="ปัจจัย" wide>{inc.cause.cats.join(", ") || "-"}</KV>
          {inc.kt16 && <KV k="กท.16" wide>{inc.kt16.no} · ยื่น {thDate(inc.kt16.submittedAt)} · {inc.kt16.office}</KV>}
        </div>
        <h2 className="mb-1 mt-5 text-[14px] font-medium">มาตรการแก้ไขและป้องกัน</h2>
        <table className={tableCls}>
          <thead>
            <tr>
              <th className={th}>มาตรการ</th>
              <th className={th}>ผู้รับผิดชอบ</th>
              <th className={th}>กำหนด</th>
              <th className={th}>สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {inc.actions.map((a) => (
              <tr key={a.id}>
                <td className={td}>{a.text}</td>
                <td className={td}>{a.owner}</td>
                <td className={td}>{thDate(a.due)}</td>
                <td className={td}>{a.done ? "เสร็จ" : "ค้าง"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="avoid-break mt-12 grid grid-cols-3 gap-6 text-center text-[12px] text-ink-2">
          {["ผู้รายงาน", "เจ้าหน้าที่ความปลอดภัย (จป.)", "ผู้จัดการโครงการ"].map((r) => (
            <div key={r}>
              <div className="mb-1 h-10 border-b border-line-strong" />
              {r}
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}

// ---------------- create ----------------

function Chips({ options, value, onChange }: { options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}
            className={cx("h-7 rounded-[6px] px-2.5 text-[12px] transition-colors duration-150", on ? "bg-ink text-card" : "border border-line text-ink-2 hover:bg-raised")}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

function IncidentForm({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { me } = useSafetyAccess();
  const settings = useSafetySettings();
  const emps = employees.use();
  const [cls, setCls] = useState<IncidentClass>("near_miss");
  const [projectId, setProjectId] = useState("HC-2025-03");
  const [date, setDate] = useState(TODAY);
  const [time, setTime] = useState("09:00");
  const [place, setPlace] = useState("");
  const [description, setDescription] = useState("");
  const [people, setPeople] = useState("");
  const [empId, setEmpId] = useState("");
  const [injName, setInjName] = useState("");
  const [bodyParts, setBodyParts] = useState<string[]>([]);
  const [injury, setInjury] = useState("");
  const [treatment, setTreatment] = useState("");
  const [hospital, setHospital] = useState("");
  const [immediate, setImmediate] = useState("");
  const [root, setRoot] = useState("");
  const [cats, setCats] = useState<string[]>([]);
  const [daysLost, setDaysLost] = useState(0);
  const [photos, setPhotos] = useState<MediaRef[]>([]);

  const siteEmps = emps.filter((e) => e.projectId === projectId && e.status !== "resigned" && e.type !== "subcontract");
  const emp = emps.find((e) => e.id === empId);
  const hasInjured = cls !== "near_miss";
  const name = emp?.name ?? injName.trim();
  const ok = place.trim() && description.trim() && (!hasInjured || name);

  const submit = () => {
    if (!ok) return;
    const id = incidents.nextId("INC-2026-");
    incidents.upsert({
      id,
      projectId,
      cls,
      date,
      time,
      place: place.trim(),
      description: description.trim(),
      people: people.split(",").map((s) => s.trim()).filter(Boolean),
      injured: hasInjured ? { employeeId: emp?.id, name, trade: emp?.skill ?? emp?.position, nationality: emp?.nationality, bodyParts, injury: injury.trim(), treatment: treatment.trim(), hospital: hospital.trim() || undefined } : undefined,
      cause: { immediate: immediate.trim(), root: root.trim(), cats },
      actions: [],
      daysLost: cls === "lost_time" ? daysLost : 0,
      status: "open",
      reportedBy: me.name,
      notify: isSerious(cls) ? settings.notifyItems.map((item) => ({ item, done: false })) : [],
      photos,
    });
    onCreated(id);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="รายงานอุบัติเหตุ / เหตุการณ์"
      width={720}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!ok} onClick={submit}>
            บันทึกรายงาน
          </Btn>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ประเภท">
          <select className={inputCls} value={cls} onChange={(e) => setCls(e.target.value as IncidentClass)}>
            {CLASSES.map((c) => (
              <option key={c} value={c}>
                {INC_LABEL[c]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="หน้างาน">
          <SiteSelect value={projectId} onChange={(v) => (setProjectId(v), setEmpId(""))} all={false} />
        </Field>
        <Field label="วันที่">
          <input type="date" max={TODAY} className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="เวลา">
          <input type="time" className={inputCls} value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="สถานที่เกิดเหตุ">
            <input className={inputCls} value={place} onChange={(e) => setPlace(e.target.value)} placeholder="เช่น ชั้น 3 ช่องบันได" />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="รายละเอียดเหตุการณ์">
            <textarea className={areaCls} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="ผู้เกี่ยวข้อง/พยาน (คั่นด้วยจุลภาค)">
            <input className={inputCls} value={people} onChange={(e) => setPeople(e.target.value)} />
          </Field>
        </div>
        {hasInjured && (
          <>
            <Field label="ผู้บาดเจ็บ (พนักงาน)">
              <select className={inputCls} value={empId} onChange={(e) => setEmpId(e.target.value)}>
                <option value="">ไม่อยู่ในรายชื่อ / ระบุเอง</option>
                {siteEmps.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} · {e.skill ?? e.position}
                  </option>
                ))}
              </select>
            </Field>
            {emp ? (
              <Field label="ทักษะ / สัญชาติ">
                <input className={inputCls} readOnly value={`${emp.skill ?? emp.position} · ${NATIONALITY_LABEL[emp.nationality]}`} />
              </Field>
            ) : (
              <Field label="ชื่อผู้บาดเจ็บ">
                <input className={inputCls} value={injName} onChange={(e) => setInjName(e.target.value)} placeholder="เช่น คนงานผู้รับเหมาช่วง" />
              </Field>
            )}
            <div className="sm:col-span-2">
              <Field label="อวัยวะที่บาดเจ็บ">
                <Chips options={BODY_PARTS} value={bodyParts} onChange={setBodyParts} />
              </Field>
            </div>
            <Field label="ลักษณะการบาดเจ็บ">
              <input className={inputCls} value={injury} onChange={(e) => setInjury(e.target.value)} />
            </Field>
            <Field label="การรักษา">
              <input className={inputCls} value={treatment} onChange={(e) => setTreatment(e.target.value)} />
            </Field>
            <Field label="สถานพยาบาล">
              <input className={inputCls} value={hospital} onChange={(e) => setHospital(e.target.value)} />
            </Field>
            {cls === "lost_time" && (
              <Field label="วันหยุดงาน (ประมาณ)">
                <input type="number" min={0} className={cx(inputCls, "font-mono")} value={daysLost} onChange={(e) => setDaysLost(Math.max(0, Number(e.target.value) || 0))} />
              </Field>
            )}
          </>
        )}
        <Field label="สาเหตุโดยตรง">
          <input className={inputCls} value={immediate} onChange={(e) => setImmediate(e.target.value)} />
        </Field>
        <Field label="สาเหตุรากเหง้า">
          <input className={inputCls} value={root} onChange={(e) => setRoot(e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="ปัจจัยที่เกี่ยวข้อง">
            <Chips options={CAUSE_CATS} value={cats} onChange={setCats} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <MediaField value={photos} onChange={setPhotos} photosOnly label="รูปที่เกิดเหตุ" />
        </div>
        {isSerious(cls) && (
          <p className="text-[13px] text-neg sm:col-span-2">กรณีร้ายแรง ระบบจะสร้างรายการแจ้งหน่วยงาน {settings.notifyItems.length} รายการ และต้องบันทึกแบบ กท.16 ภายใน 15 วัน</p>
        )}
        <p className="text-[12px] text-ink-3 sm:col-span-2">รวมวันหยุดงานปีนี้ใช้คำนวณ LTIFR ในแท็บตัวชี้วัด · ทุกเหตุการณ์ รวมถึงเกือบเกิดเหตุ ควรรายงานภายในวันเดียวกัน · {n0(siteEmps.length)} คนในหน้างานนี้</p>
      </div>
    </Modal>
  );
}
