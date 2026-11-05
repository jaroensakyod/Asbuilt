"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, ClipboardCheck, Gauge, Pencil, Plus, Save, Trash2, UserMinus, UserPlus } from "lucide-react";
import { Card, CardHead, cx, Field, inputCls, PageHeader } from "@/components/ui";
import { areaCls, Btn, Empty, I, IconBtn, Meter, Modal, Pill, StatCard } from "@/components/ops/bits";
import { MediaField, MediaStrip } from "@/components/media/media-field";
import { thDate, TODAY } from "@/lib/data";
import { prevPeriod } from "@/lib/hr/payroll";
import { ACTIVE_SITES } from "@/lib/hr/seed";
import { employees } from "@/lib/hr/store";
import { campInspections, campIssues, campMeters, camps } from "@/lib/hr/labour-store";
import { allocate, campScore, meterCost, nextReading, occupancy } from "@/lib/hr/camp";
import { CAMP_CHECKS, ROOM_KIND_LABEL, type Camp, type CampInspection, type CampIssue, type CampMeter, type CampRoom } from "@/lib/hr/labour-types";
import { fmt, fmt0, HrTabs, periodLabel, siteName, useHrAccess } from "./bits";

export function CampsView() {
  const params = useSearchParams();
  const list = camps.use();
  const meters = campMeters.use();
  const insp = campInspections.use();
  const issues = campIssues.use();
  const { edit, attendance: field } = useHrAccess();
  const [sel, setSel] = useState(params.get("q") ?? "");
  const [editing, setEditing] = useState<Camp | "new" | null>(null);
  const camp = list.find((c) => c.id === sel) ?? list[0];
  const last = prevPeriod(TODAY.slice(0, 7));
  const totals = list.reduce(
    (t, c) => {
      const o = occupancy(c);
      return { beds: t.beds + o.beds, occ: t.occ + o.occupied, over: t.over + o.over.length };
    },
    { beds: 0, occ: 0, over: 0 },
  );
  const lastCost = meters.filter((m) => m.period === last).reduce((s, m) => {
    const c = list.find((x) => x.id === m.campId);
    return s + (c ? meterCost(m, c).total : 0);
  }, 0);

  return (
    <>
      <PageHeader
        eyebrow="บุคคล"
        title="แคมป์คนงาน"
        sub="ที่พักคนงานแต่ละหน้างาน ห้องพักและผู้พัก ค่าน้ำค่าไฟจากมิเตอร์และการปันส่วน การตรวจสุขาภิบาล และเรื่องที่ต้องแก้ไข"
        actions={
          edit && (
            <Btn primary onClick={() => setEditing("new")}>
              <Plus {...I} />
              เพิ่มแคมป์
            </Btn>
          )
        }
      />
      <HrTabs />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="แคมป์" value={list.length} unit="แห่ง" note={`${new Set(list.map((c) => c.projectId)).size} หน้างาน`} />
        <StatCard label="ผู้พัก / ที่นอน" value={`${totals.occ}/${totals.beds}`} unit="คน" extra={<Meter value={totals.beds ? (totals.occ / totals.beds) * 100 : 0} />} />
        <StatCard label="ห้องเกินความจุ" value={totals.over} unit="ห้อง" tone={totals.over ? "neg" : undefined} />
        <StatCard label={`ค่าน้ำค่าไฟ ${periodLabel(last)}`} value={fmt0(lastCost)} unit="บาท" note={`เรื่องค้างแก้ไข ${issues.filter((i) => i.status === "open").length}`} />
      </div>

      {list.length ? (
        <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
          <div className="flex flex-col gap-3">
            {list.map((c) => {
              const o = occupancy(c);
              const li = insp.filter((x) => x.campId === c.id).sort((a, b) => b.date.localeCompare(a.date))[0];
              const open = issues.filter((x) => x.campId === c.id && x.status === "open").length;
              return (
                <button key={c.id} type="button" onClick={() => setSel(c.id)} className={cx("rounded-[14px] border bg-card px-4 py-3 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors duration-150", camp?.id === c.id ? "border-ink-3" : "border-line hover:border-line-strong")}>
                  <p className="text-[14px] font-medium">{c.name}</p>
                  <p className="text-[12px] text-ink-3">
                    <span className="font-mono">{c.projectId}</span> · {siteName(c.projectId)}
                  </p>
                  <div className="mt-2 flex items-center justify-between font-mono text-[12px]">
                    <span>
                      {o.occupied}/{o.beds} คน · {c.rooms.length} ห้อง
                    </span>
                    <span className="text-ink-3">{o.pct}%</span>
                  </div>
                  <div className="mt-1">
                    <Meter value={o.pct} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {o.over.length > 0 && <Pill tone="neg">เกินความจุ {o.over.length} ห้อง</Pill>}
                    {li && <Pill tone={campScore(li.items) >= 90 ? "pos" : campScore(li.items) >= 75 ? "warn" : "neg"}>สุขาภิบาล {campScore(li.items)}%</Pill>}
                    {open > 0 && <Pill tone="warn">ค้างแก้ไข {open}</Pill>}
                  </div>
                </button>
              );
            })}
          </div>
          {camp && <CampDetail key={camp.id} camp={camp} meters={meters} insp={insp} issues={issues} canEdit={edit} canField={field || edit} onEdit={() => setEditing(camp)} />}
        </div>
      ) : (
        <Card>
          <Empty>ยังไม่มีแคมป์คนงาน</Empty>
        </Card>
      )}
      {editing && <CampForm camp={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function CampDetail({ camp, meters, insp, issues, canEdit, canField, onEdit }: { camp: Camp; meters: CampMeter[]; insp: CampInspection[]; issues: CampIssue[]; canEdit: boolean; canField: boolean; onEdit: () => void }) {
  const emps = employees.use();
  const name = (id: string) => emps.find((e) => e.id === id)?.name ?? id;
  const [assign, setAssign] = useState<CampRoom | null>(null);
  const [reading, setReading] = useState(false);
  const [inspecting, setInspecting] = useState(false);
  const [issue, setIssue] = useState(false);
  const myMeters = meters.filter((m) => m.campId === camp.id).sort((a, b) => b.period.localeCompare(a.period));
  const myInsp = insp.filter((x) => x.campId === camp.id).sort((a, b) => b.date.localeCompare(a.date));
  const myIssues = issues.filter((x) => x.campId === camp.id).sort((a, b) => (a.status === b.status ? b.date.localeCompare(a.date) : a.status === "open" ? -1 : 1));
  const latest = myMeters[0];
  const share = latest ? allocate(camp, meterCost(latest, camp).total) : new Map<string, number>();
  const removeOcc = (room: CampRoom, id: string) => camps.upsert({ ...camp, rooms: camp.rooms.map((r) => (r.id === room.id ? { ...r, occupants: r.occupants.filter((x) => x !== id) } : r)) });

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <Card>
        <CardHead
          title={camp.name}
          meta={camp.id}
          action={
            canEdit && (
              <Btn small onClick={onEdit}>
                <Pencil {...I} />
                แก้ไขแคมป์
              </Btn>
            )
          }
        />
        <div className="grid gap-x-8 gap-y-1 px-5 py-3 text-[13px] sm:grid-cols-2">
          <p>
            <span className="text-ink-3">ที่ตั้ง </span>
            {camp.address}
          </p>
          <p>
            <span className="text-ink-3">หน้างาน </span>
            {camp.projectId} · {siteName(camp.projectId)}
          </p>
          <p>
            <span className="text-ink-3">ค่าน้ำ/ไฟ </span>
            <span className="font-mono">
              {camp.waterRate} ฿/หน่วย · {camp.elecRate} ฿/หน่วย
            </span>
          </p>
          <p>
            <span className="text-ink-3">ปันส่วน </span>
            {camp.allocation === "per_head" ? "เฉลี่ยต่อคน" : "เฉลี่ยต่อห้อง"} · {camp.chargeWorkers ? "หักจากค่าแรงคนงาน" : "บริษัทรับภาระ"}
          </p>
          {camp.facilities.length > 0 && (
            <p className="sm:col-span-2">
              <span className="text-ink-3">สิ่งอำนวยความสะดวก </span>
              {camp.facilities.join(" · ")}
            </p>
          )}
        </div>
      </Card>

      <Card>
        <CardHead title="ห้องพัก" meta={`${occupancy(camp).occupied}/${occupancy(camp).beds} คน`} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-ink-3">
                <th className="px-5 py-2 font-normal">ห้อง</th>
                <th className="px-3 py-2 font-normal">ประเภท</th>
                <th className="px-3 py-2 text-right font-normal">ผู้พัก/ความจุ</th>
                <th className="px-3 py-2 font-normal">ผู้พัก</th>
                <th className="px-5 py-2" />
              </tr>
            </thead>
            <tbody>
              {camp.rooms.map((r) => {
                const over = r.occupants.length > r.capacity;
                return (
                  <tr key={r.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-2 font-mono">{r.no}</td>
                    <td className="px-3 py-2 text-ink-2">{ROOM_KIND_LABEL[r.kind]}</td>
                    <td className={cx("num px-3 py-2 text-right font-mono", over && "text-neg")}>
                      {r.occupants.length}/{r.capacity}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {r.occupants.map((id) => (
                          <span key={id} className="inline-flex items-center gap-1 rounded-[6px] bg-raised px-1.5 py-0.5 text-[12px]">
                            {name(id)}
                            {canField && (
                              <button type="button" aria-label={`ย้ายออก ${name(id)}`} onClick={() => removeOcc(r, id)} className="text-ink-3 hover:text-neg">
                                <UserMinus size={12} strokeWidth={1.5} />
                              </button>
                            )}
                          </span>
                        ))}
                        {!r.occupants.length && <span className="text-ink-3">ว่าง</span>}
                        {over && <Pill tone="neg">เกินความจุ</Pill>}
                      </div>
                    </td>
                    <td className="px-5 py-2 text-right">
                      {canField && (
                        <IconBtn label="จัดคนเข้าพัก" onClick={() => setAssign(r)}>
                          <UserPlus {...I} />
                        </IconBtn>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHead
          title="ค่าน้ำค่าไฟ"
          meta={camp.allocation === "per_head" ? "ปันส่วนต่อคน" : "ปันส่วนต่อห้อง"}
          action={
            canField && (
              <Btn small onClick={() => setReading(true)}>
                <Gauge {...I} />
                บันทึกมิเตอร์
              </Btn>
            )
          }
        />
        {myMeters.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-ink-3">
                  <th className="px-5 py-2 font-normal">งวด</th>
                  <th className="px-3 py-2 text-right font-normal">น้ำ (หน่วย)</th>
                  <th className="px-3 py-2 text-right font-normal">ไฟ (หน่วย)</th>
                  <th className="px-3 py-2 text-right font-normal">ค่าน้ำ</th>
                  <th className="px-3 py-2 text-right font-normal">ค่าไฟ</th>
                  <th className="px-3 py-2 text-right font-normal">รวม</th>
                  <th className="px-5 py-2 text-right font-normal">เฉลี่ยต่อคน</th>
                </tr>
              </thead>
              <tbody>
                {myMeters.map((m) => {
                  const c = meterCost(m, camp);
                  const heads = occupancy(camp).occupied;
                  return (
                    <tr key={m.id} className="border-b border-line last:border-0">
                      <td className="px-5 py-2">
                        {periodLabel(m.period)}
                        <MediaStrip refs={m.photos} size={28} className="mt-1" />
                      </td>
                      <td className="num px-3 py-2 text-right font-mono">
                        {fmt0(c.water)}
                        <span className="block text-[11px] text-ink-3">
                          {m.waterPrev}→{m.waterCurr}
                        </span>
                      </td>
                      <td className="num px-3 py-2 text-right font-mono">
                        {fmt0(c.elec)}
                        <span className="block text-[11px] text-ink-3">
                          {m.elecPrev}→{m.elecCurr}
                        </span>
                      </td>
                      <td className="num px-3 py-2 text-right font-mono">{fmt(c.waterCost)}</td>
                      <td className="num px-3 py-2 text-right font-mono">{fmt(c.elecCost)}</td>
                      <td className="num px-3 py-2 text-right font-mono font-medium">{fmt(c.total)}</td>
                      <td className="num px-5 py-2 text-right font-mono">{heads ? fmt(c.total / heads) : "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>ยังไม่มีการบันทึกมิเตอร์</Empty>
        )}
        {latest && share.size > 0 && (
          <div className="border-t border-line px-5 py-3">
            <p className="mb-2 text-[13px] text-ink-2">
              ส่วนแบ่งงวด {periodLabel(latest.period)} {camp.chargeWorkers ? "· หักจากค่าแรง" : "· บริษัทรับภาระ (ต้นทุนโครงการ)"}
            </p>
            <div className="grid gap-x-6 gap-y-0.5 text-[12px] sm:grid-cols-2 lg:grid-cols-3">
              {[...share].map(([id, v]) => (
                <div key={id} className="flex justify-between border-b border-line py-0.5">
                  <span className="truncate">{name(id)}</span>
                  <span className="num font-mono">{fmt(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <div className="grid gap-6 2xl:grid-cols-2">
        <Card className="self-start">
          <CardHead
            title="ตรวจสุขาภิบาล"
            meta={`${myInsp.length} ครั้ง`}
            action={
              canField && (
                <Btn small onClick={() => setInspecting(true)}>
                  <ClipboardCheck {...I} />
                  ตรวจแคมป์
                </Btn>
              )
            }
          />
          {myInsp.length ? (
            <ul>
              {myInsp.map((x) => {
                const score = campScore(x.items);
                const fails = x.items.filter((i) => !i.ok);
                return (
                  <li key={x.id} className="border-b border-line px-5 py-2.5 text-[13px] last:border-0">
                    <div className="flex items-center justify-between gap-3">
                      <span>
                        {thDate(x.date)} · {x.by}
                        <span className="ml-2 font-mono text-[12px] text-ink-3">{x.id}</span>
                      </span>
                      <Pill tone={score >= 90 ? "pos" : score >= 75 ? "warn" : "neg"}>{score}%</Pill>
                    </div>
                    {fails.length > 0 && <p className="mt-1 text-[12px] text-neg">ไม่ผ่าน: {fails.map((f) => f.text).join(" · ")}</p>}
                    {x.note && <p className="mt-0.5 text-[12px] text-ink-3">{x.note}</p>}
                    <MediaStrip refs={x.photos} size={40} className="mt-1" />
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty>ยังไม่มีการตรวจ</Empty>
          )}
        </Card>
        <Card className="self-start">
          <CardHead
            title="เรื่องที่ต้องแก้ไข"
            meta={`ค้าง ${myIssues.filter((x) => x.status === "open").length}`}
            action={
              canField && (
                <Btn small onClick={() => setIssue(true)}>
                  <Plus {...I} />
                  แจ้งเรื่อง
                </Btn>
              )
            }
          />
          {myIssues.length ? (
            <ul>
              {myIssues.map((x) => (
                <li key={x.id} className="flex items-start gap-3 border-b border-line px-5 py-2.5 text-[13px] last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className={cx(x.status === "done" && "text-ink-3 line-through")}>{x.title}</p>
                    <p className="text-[12px] text-ink-3">
                      {thDate(x.date)} · {x.by}
                      {x.detail && ` · ${x.detail}`}
                    </p>
                    <MediaStrip refs={x.photos} size={36} className="mt-1" />
                  </div>
                  {x.status === "open" ? (
                    canField && (
                      <Btn small onClick={() => campIssues.upsert({ ...x, status: "done", doneAt: TODAY })}>
                        <Check {...I} />
                        แก้แล้ว
                      </Btn>
                    )
                  ) : (
                    <Pill tone="pos">แก้แล้ว {x.doneAt ? thDate(x.doneAt) : ""}</Pill>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>ไม่มีเรื่องค้าง</Empty>
          )}
        </Card>
      </div>

      {assign && <AssignForm camp={camp} room={assign} onClose={() => setAssign(null)} />}
      {reading && <MeterForm camp={camp} meters={meters} onClose={() => setReading(false)} />}
      {inspecting && <InspectForm camp={camp} onClose={() => setInspecting(false)} />}
      {issue && <IssueForm camp={camp} onClose={() => setIssue(false)} />}
    </div>
  );
}

function AssignForm({ camp, room, onClose }: { camp: Camp; room: CampRoom; onClose: () => void }) {
  const emps = employees.use();
  const all = camps.use();
  const housed = new Set(all.flatMap((c) => c.rooms.flatMap((r) => r.occupants)));
  const candidates = emps.filter((e) => e.type === "daily" && e.status !== "resigned" && !housed.has(e.id)).sort((a, b) => (a.projectId === camp.projectId ? -1 : 0) - (b.projectId === camp.projectId ? -1 : 0));
  const [pick, setPick] = useState<string[]>([]);
  const toggle = (id: string) => setPick((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const after = room.occupants.length + pick.length;
  const save = () => {
    camps.upsert({ ...camp, rooms: camp.rooms.map((r) => (r.id === room.id ? { ...r, occupants: [...r.occupants, ...pick] } : r)) });
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`จัดคนเข้าพัก ห้อง ${room.no}`}
      width={520}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!pick.length} onClick={save}>
            เข้าพัก {pick.length} คน
          </Btn>
        </>
      }
    >
      <p className={cx("mb-3 text-[13px]", after > room.capacity ? "text-neg" : "text-ink-2")}>
        ผู้พักหลังจัด {after}/{room.capacity} คน{after > room.capacity ? " เกินความจุของห้อง" : ""}
      </p>
      {candidates.length ? (
        <ul className="max-h-[360px] overflow-y-auto rounded-[10px] border border-line">
          {candidates.map((e) => (
            <li key={e.id}>
              <label className="flex cursor-pointer items-center gap-3 border-b border-line px-3 py-2 text-[13px] last:border-0 hover:bg-raised/60">
                <input type="checkbox" checked={pick.includes(e.id)} onChange={() => toggle(e.id)} />
                <span className="flex-1">{e.name}</span>
                <span className="font-mono text-[12px] text-ink-3">{e.projectId}</span>
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>คนงานทุกคนมีที่พักแล้ว</Empty>
      )}
    </Modal>
  );
}

function MeterForm({ camp, meters, onClose }: { camp: Camp; meters: CampMeter[]; onClose: () => void }) {
  const { me } = useHrAccess();
  const nx = nextReading(meters, camp.id);
  const [period, setPeriod] = useState(nx.lastPeriod ? nextPeriod(nx.lastPeriod) : prevPeriod(TODAY.slice(0, 7)));
  const [m, setM] = useState({ waterPrev: nx.waterPrev, waterCurr: nx.waterPrev, elecPrev: nx.elecPrev, elecCurr: nx.elecPrev });
  const [photos, setPhotos] = useState<CampMeter["photos"]>([]);
  const c = meterCost(m, camp);
  const exists = meters.some((x) => x.id === `CMR-${camp.id}-${period}`);
  const ok = m.waterCurr >= m.waterPrev && m.elecCurr >= m.elecPrev;
  const num = (k: keyof typeof m, v: string) => setM((x) => ({ ...x, [k]: Math.max(0, Number(v) || 0) }));
  const save = () => {
    campMeters.upsert({ id: `CMR-${camp.id}-${period}`, campId: camp.id, period, ...m, by: me.name, photos });
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`บันทึกมิเตอร์ ${camp.name}`}
      width={540}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!ok} onClick={save}>
            <Save {...I} />
            บันทึก
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="งวด (เดือน)">
          <input type="month" className={inputCls} value={period} onChange={(e) => e.target.value && setPeriod(e.target.value)} />
        </Field>
        <div />
        <Field label="มิเตอร์น้ำ ครั้งก่อน">
          <input type="number" className={cx(inputCls, "text-right font-mono")} value={m.waterPrev} onChange={(e) => num("waterPrev", e.target.value)} />
        </Field>
        <Field label="มิเตอร์น้ำ ครั้งนี้">
          <input type="number" className={cx(inputCls, "text-right font-mono")} value={m.waterCurr} onChange={(e) => num("waterCurr", e.target.value)} />
        </Field>
        <Field label="มิเตอร์ไฟ ครั้งก่อน">
          <input type="number" className={cx(inputCls, "text-right font-mono")} value={m.elecPrev} onChange={(e) => num("elecPrev", e.target.value)} />
        </Field>
        <Field label="มิเตอร์ไฟ ครั้งนี้">
          <input type="number" className={cx(inputCls, "text-right font-mono")} value={m.elecCurr} onChange={(e) => num("elecCurr", e.target.value)} />
        </Field>
        <div className="col-span-2">
          <MediaField value={photos} onChange={setPhotos} label="รูปหน้าปัดมิเตอร์" photosOnly />
        </div>
      </div>
      <p className="mt-3 text-[13px] text-ink-2">
        น้ำ {fmt0(c.water)} หน่วย × {camp.waterRate} = <span className="num font-mono">{fmt(c.waterCost)}</span> · ไฟ {fmt0(c.elec)} หน่วย × {camp.elecRate} = <span className="num font-mono">{fmt(c.elecCost)}</span> · รวม <span className="num font-mono font-medium">{fmt(c.total)}</span> บาท
      </p>
      {!ok && <p className="mt-1 text-[13px] text-neg">เลขมิเตอร์ครั้งนี้ต้องไม่น้อยกว่าครั้งก่อน</p>}
      {exists && <p className="mt-1 text-[13px] text-warn">มีการบันทึกงวด {periodLabel(period)} แล้ว บันทึกใหม่จะแทนที่ของเดิม</p>}
    </Modal>
  );
}
const nextPeriod = (p: string) => {
  const [y, m] = p.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
};

function InspectForm({ camp, onClose }: { camp: Camp; onClose: () => void }) {
  const { me } = useHrAccess();
  const [items, setItems] = useState(CAMP_CHECKS.map((text) => ({ text, ok: true })));
  const [photos, setPhotos] = useState<CampInspection["photos"]>([]);
  const [note, setNote] = useState("");
  const save = () => {
    campInspections.upsert({ id: campInspections.nextId(`CIN-${TODAY.slice(0, 4)}-`), campId: camp.id, date: TODAY, by: me.name, items, photos, note: note.trim() || undefined });
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`ตรวจสุขาภิบาล ${camp.name}`}
      width={600}
      footer={
        <>
          <span className="mr-auto text-[13px] text-ink-2">
            คะแนน <span className="num font-mono">{campScore(items)}%</span>
          </span>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary onClick={save}>
            <Save {...I} />
            บันทึกผลตรวจ
          </Btn>
        </>
      }
    >
      <ul className="rounded-[10px] border border-line">
        {items.map((it, i) => (
          <li key={it.text} className="flex items-center gap-3 border-b border-line px-3 py-2 text-[13px] last:border-0">
            <span className="flex-1">{it.text}</span>
            <div className="inline-flex gap-1" role="radiogroup" aria-label={it.text}>
              {[true, false].map((v) => (
                <button
                  key={String(v)}
                  type="button"
                  role="radio"
                  aria-checked={it.ok === v}
                  onClick={() => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ok: v } : x)))}
                  className={cx("h-8 min-w-[56px] rounded-[6px] px-2.5 text-[12px] transition-colors duration-150", it.ok === v ? (v ? "bg-ink text-card" : "bg-neg-soft text-neg") : "border border-line text-ink-3 hover:bg-raised")}
                >
                  {v ? "ผ่าน" : "ไม่ผ่าน"}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-col gap-3">
        <MediaField value={photos} onChange={setPhotos} label="รูปประกอบ" photosOnly />
        <Field label="หมายเหตุ / สิ่งที่ต้องแก้ไข">
          <textarea className={areaCls} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function IssueForm({ camp, onClose }: { camp: Camp; onClose: () => void }) {
  const { me } = useHrAccess();
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [photos, setPhotos] = useState<CampIssue["photos"]>([]);
  const save = () => {
    campIssues.upsert({ id: campIssues.nextId(`CIS-${TODAY.slice(0, 4)}-`), campId: camp.id, date: TODAY, title: title.trim(), detail: detail.trim() || undefined, by: me.name, status: "open", photos });
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`แจ้งเรื่อง ${camp.name}`}
      width={500}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!title.trim()} onClick={save}>
            บันทึก
          </Btn>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="เรื่อง">
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น ปั๊มน้ำเสีย หลังคารั่ว" />
        </Field>
        <Field label="รายละเอียด">
          <textarea className={areaCls} value={detail} onChange={(e) => setDetail(e.target.value)} />
        </Field>
        <MediaField value={photos} onChange={setPhotos} label="รูป" photosOnly />
      </div>
    </Modal>
  );
}

function CampForm({ camp, onClose }: { camp?: Camp; onClose: () => void }) {
  const [c, setC] = useState<Camp>(
    () =>
      camp ?? {
        id: "",
        projectId: ACTIVE_SITES[0]?.id ?? "",
        name: "",
        address: "",
        waterRate: 20,
        elecRate: 7,
        allocation: "per_head",
        chargeWorkers: false,
        rooms: [{ id: "R1", no: "A1", capacity: 4, kind: "male", occupants: [] }],
        facilities: [],
      },
  );
  const [fac, setFac] = useState((camp?.facilities ?? []).join(", "));
  const set = (p: Partial<Camp>) => setC((x) => ({ ...x, ...p }));
  const setRoom = (i: number, p: Partial<CampRoom>) => set({ rooms: c.rooms.map((r, j) => (j === i ? { ...r, ...p } : r)) });
  const ok = c.name.trim() && c.projectId && c.rooms.length && c.rooms.every((r) => r.no.trim() && r.capacity > 0);
  const save = () => {
    if (!ok) return;
    const id = c.id || camps.nextId("CMP-", 2);
    camps.upsert({ ...c, id, name: c.name.trim(), rooms: c.rooms.map((r, i) => ({ ...r, id: r.id.startsWith(id) ? r.id : `${id}-R${i + 1}-${r.no.trim()}` })), facilities: fac.split(",").map((s) => s.trim()).filter(Boolean) });
    onClose();
  };
  const num = (v: string) => Math.max(0, Number(v) || 0);
  return (
    <Modal
      open
      onClose={onClose}
      title={camp ? `แก้ไข ${camp.name}` : "เพิ่มแคมป์คนงาน"}
      width={640}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!ok} onClick={save}>
            <Save {...I} />
            บันทึก
          </Btn>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ชื่อแคมป์">
          <input className={inputCls} value={c.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="หน้างาน">
          <select className={inputCls} value={c.projectId} onChange={(e) => set({ projectId: e.target.value })}>
            {ACTIVE_SITES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} · {p.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="ที่ตั้ง">
            <input className={inputCls} value={c.address} onChange={(e) => set({ address: e.target.value })} />
          </Field>
        </div>
        <Field label="ค่าน้ำ (บาท/หน่วย)">
          <input type="number" min={0} step={0.5} className={cx(inputCls, "text-right font-mono")} value={c.waterRate} onChange={(e) => set({ waterRate: num(e.target.value) })} />
        </Field>
        <Field label="ค่าไฟ (บาท/หน่วย)">
          <input type="number" min={0} step={0.5} className={cx(inputCls, "text-right font-mono")} value={c.elecRate} onChange={(e) => set({ elecRate: num(e.target.value) })} />
        </Field>
        <Field label="ปันส่วนค่าน้ำค่าไฟ">
          <select className={inputCls} value={c.allocation} onChange={(e) => set({ allocation: e.target.value as Camp["allocation"] })}>
            <option value="per_head">เฉลี่ยต่อคน</option>
            <option value="per_room">เฉลี่ยต่อห้อง</option>
          </select>
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-[13px] text-ink-2">
          <input type="checkbox" checked={c.chargeWorkers} onChange={(e) => set({ chargeWorkers: e.target.checked })} />
          หักค่าน้ำค่าไฟจากค่าแรงคนงาน
        </label>
        <div className="sm:col-span-2">
          <Field label="สิ่งอำนวยความสะดวก (คั่นด้วยจุลภาค)">
            <input className={inputCls} value={fac} onChange={(e) => setFac(e.target.value)} placeholder="ห้องน้ำ 4 ห้อง, ครัวรวม, ถังดับเพลิง 3 ถัง" />
          </Field>
        </div>
      </div>
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[13px] text-ink-2">ห้องพัก</p>
          <Btn small onClick={() => set({ rooms: [...c.rooms, { id: `NEW-${c.rooms.length + 1}`, no: `A${c.rooms.length + 1}`, capacity: 4, kind: "male", occupants: [] }] })}>
            <Plus {...I} />
            เพิ่มห้อง
          </Btn>
        </div>
        <div className="flex flex-col gap-1.5">
          {c.rooms.map((r, i) => (
            <div key={r.id} className="flex items-center gap-2">
              <input className={cx(inputCls, "w-24 font-mono")} value={r.no} aria-label="เลขห้อง" onChange={(e) => setRoom(i, { no: e.target.value })} />
              <select className={cx(inputCls, "w-28")} value={r.kind} aria-label="ประเภทห้อง" onChange={(e) => setRoom(i, { kind: e.target.value as CampRoom["kind"] })}>
                {(Object.keys(ROOM_KIND_LABEL) as CampRoom["kind"][]).map((k) => (
                  <option key={k} value={k}>
                    {ROOM_KIND_LABEL[k]}
                  </option>
                ))}
              </select>
              <input type="number" min={1} className={cx(inputCls, "w-20 text-right font-mono")} value={r.capacity} aria-label="ความจุ" onChange={(e) => setRoom(i, { capacity: Math.max(1, num(e.target.value)) })} />
              <span className="flex-1 text-[12px] text-ink-3">{r.occupants.length} คนพักอยู่</span>
              <IconBtn label="ลบห้อง" danger onClick={() => set({ rooms: c.rooms.filter((_, j) => j !== i) })}>
                <Trash2 {...I} />
              </IconBtn>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
