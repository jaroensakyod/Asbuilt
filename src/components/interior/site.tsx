"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Pencil, Plus } from "lucide-react";
import { Card, CardHead, cx, Field, inputCls } from "@/components/ui";
import { Btn, Empty, I, Modal, Pill, Select, areaCls } from "@/components/ops/bits";
import { MediaField, MediaStrip } from "@/components/media/media-field";
import { SignaturePad } from "@/components/media/signature-pad";
import { TODAY } from "@/lib/data";
import { suppliers } from "@/lib/procurement/store";
import {
  CREWS,
  SAMPLE_STATUS_LABEL,
  addDays,
  daysBetween,
  ffeItems,
  ffeRank,
  installJobs,
  interiorProjects,
  isSampleOverdue,
  products,
  punchItems,
  sampleReturnBy,
  samples,
  useInteriorSettings,
  type InstallJob,
  type InteriorProject,
  type PunchItem,
  type Sample,
  type SampleStatus,
} from "@/lib/interior";
import { Swatch, dateOr, td, th, usePerms } from "@/components/design/bits";

// ---------- samples ----------

const S_TONE: Record<SampleStatus, "neutral" | "accent" | "warn" | "pos"> = { requested: "neutral", received: "accent", shown: "warn", returned: "pos", kept: "pos" };
const S_NEXT: Partial<Record<SampleStatus, [SampleStatus, string][]>> = {
  requested: [["received", "ได้รับแล้ว"]],
  received: [["shown", "ให้ลูกค้าดูแล้ว"], ["returned", "คืนแล้ว"]],
  shown: [["returned", "คืนแล้ว"], ["kept", "เก็บไว้"]],
};
const S_STAMP: Partial<Record<SampleStatus, keyof Sample>> = { received: "receivedAt", shown: "shownAt", returned: "returnedAt" };

export function SamplesTab({ p }: { p: InteriorProject }) {
  const { edit } = usePerms("interior");
  const all = samples.use();
  const prods = products.use();
  const sups = suppliers.use();
  const st = useInteriorSettings();
  const list = all.filter((s) => s.interiorId === p.id).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  const [form, setForm] = useState<{ s?: Sample } | null>(null);
  const move = (s: Sample, to: SampleStatus) => {
    const key = S_STAMP[to];
    samples.upsert({ ...s, status: to, ...(key ? { [key]: TODAY } : {}) });
  };
  return (
    <Card>
      <CardHead
        title="ตัวอย่างวัสดุ"
        meta={`คืนภายใน ${st.sampleReturnDays} วันหลังได้รับ/ให้ลูกค้าดู`}
        action={
          edit && (
            <Btn small primary onClick={() => setForm({})}>
              <Plus {...I} />
              ขอตัวอย่าง
            </Btn>
          )
        }
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-left">
          <thead>
            <tr>
              <th className={cx(th, "px-5")}>ตัวอย่าง</th>
              <th className={th}>ผู้ขาย</th>
              <th className={th}>ขอ</th>
              <th className={th}>ได้รับ</th>
              <th className={th}>ให้ลูกค้าดู</th>
              <th className={th}>ต้องคืน</th>
              <th className={th}>ที่เก็บ</th>
              <th className={cx(th, "pr-5")}>สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {list.map((s) => {
              const pr = prods.find((x) => x.id === s.productId);
              const overdue = isSampleOverdue(s, TODAY, st.sampleReturnDays);
              const by = sampleReturnBy(s, st.sampleReturnDays);
              return (
                <tr key={s.id} className="border-t border-line">
                  <td className={cx(td, "px-5")}>
                    <div className="flex items-center gap-3">
                      <Swatch image={pr?.images[0]} color={pr?.swatch} label={s.description} className="size-9 shrink-0" />
                      <div>
                        <p>{s.description}</p>
                        <p className="font-mono text-[12px] text-ink-3">{s.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className={cx(td, "text-[12px]")}>{s.supplierId ? (sups.find((x) => x.id === s.supplierId)?.name ?? s.supplierId) : (s.supplierName ?? "–")}</td>
                  <td className={td}>{dateOr(s.requestedAt)}</td>
                  <td className={td}>{dateOr(s.receivedAt)}</td>
                  <td className={td}>{dateOr(s.shownAt)}</td>
                  <td className={cx(td, overdue && "text-neg")}>
                    {s.status === "returned" ? `คืน ${dateOr(s.returnedAt)}` : s.status === "kept" ? "–" : dateOr(by)}
                    {overdue && by && <span className="block text-[12px]">เกิน {daysBetween(by, TODAY)} วัน</span>}
                  </td>
                  <td className={cx(td, "text-[12px]")}>{s.location}</td>
                  <td className={cx(td, "pr-5")}>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Pill tone={overdue ? "neg" : S_TONE[s.status]}>{SAMPLE_STATUS_LABEL[s.status]}</Pill>
                      {edit &&
                        S_NEXT[s.status]?.map(([to, label]) => (
                          <button key={to} type="button" className="text-[12px] text-accent-text hover:underline" onClick={() => move(s, to)}>
                            {label}
                          </button>
                        ))}
                      {edit && (
                        <button type="button" aria-label="แก้ไข" onClick={() => setForm({ s })} className="inline-flex size-7 items-center justify-center rounded-[6px] text-ink-3 hover:bg-raised hover:text-ink">
                          <Pencil size={14} strokeWidth={1.5} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {list.length === 0 && <Empty>ยังไม่มีการขอตัวอย่าง</Empty>}
      {form && <SampleForm p={p} initial={form.s} onClose={() => setForm(null)} />}
    </Card>
  );
}

function SampleForm({ p, initial, onClose }: { p: InteriorProject; initial?: Sample; onClose: () => void }) {
  const prods = products.use();
  const sups = suppliers.use();
  const [v, setV] = useState<Sample>(initial ?? { id: samples.nextId("SMP-"), interiorId: p.id, description: "", status: "requested", requestedAt: TODAY, location: "ห้องตัวอย่าง สำนักงานใหญ่ ชั้น 2" });
  const pick = (id: string) => {
    const pr = prods.find((x) => x.id === id);
    setV({ ...v, productId: id || undefined, description: v.description || (pr ? `ตัวอย่าง ${pr.name}` : ""), supplierId: pr?.supplierId ?? v.supplierId, supplierName: pr?.supplierName ?? v.supplierName });
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? `แก้ไข ${initial.id}` : "ขอตัวอย่างวัสดุ"}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!v.description.trim()} onClick={() => (samples.upsert({ ...v, description: v.description.trim() }), onClose())}>
            บันทึก
          </Btn>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="สินค้า (ถ้ามีในแคตตาล็อก)">
            <Select label="สินค้า" value={v.productId ?? ""} onChange={pick}>
              <option value="">–</option>
              {prods.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.sku} · {x.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="รายละเอียดตัวอย่าง">
            <input value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} className={inputCls} />
          </Field>
        </div>
        <Field label="ผู้ขาย">
          <Select label="ผู้ขาย" value={v.supplierId ?? ""} onChange={(supplierId) => setV({ ...v, supplierId: supplierId || undefined })}>
            <option value="">– อื่น ๆ –</option>
            {sups.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="หรือชื่อผู้ผลิต">
          <input value={v.supplierName ?? ""} disabled={!!v.supplierId} onChange={(e) => setV({ ...v, supplierName: e.target.value || undefined })} className={inputCls} />
        </Field>
        <Field label="วันที่ขอ">
          <input type="date" value={v.requestedAt} onChange={(e) => setV({ ...v, requestedAt: e.target.value })} className={inputCls} />
        </Field>
        <Field label="ต้องคืนภายใน (ถ้าผู้ขายกำหนด)">
          <input type="date" value={v.returnBy ?? ""} onChange={(e) => setV({ ...v, returnBy: e.target.value || undefined })} className={inputCls} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="ที่เก็บ">
            <input value={v.location} onChange={(e) => setV({ ...v, location: e.target.value })} className={inputCls} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

// ---------- installation schedule ----------

export function InstallTab({ p }: { p: InteriorProject }) {
  const { edit } = usePerms("interior");
  const all = installJobs.use();
  const items = ffeItems.use();
  const jobs = all.filter((j) => j.interiorId === p.id).sort((a, b) => a.start.localeCompare(b.start));
  const [form, setForm] = useState<{ j?: InstallJob } | null>(null);
  const range = useMemo(() => {
    if (!jobs.length) return null;
    const start = jobs.reduce((m, j) => (j.start < m ? j.start : m), jobs[0].start);
    const end = jobs.reduce((m, j) => (j.end > m ? j.end : m), jobs[0].end);
    const from = addDays(start, -1);
    const days = Math.min(70, Math.max(14, daysBetween(from, end) + 2));
    return { from, days };
  }, [jobs]);
  const crews = [...new Set(jobs.map((j) => j.crew))];
  return (
    <Card>
      <CardHead
        title="ตารางติดตั้งตามทีมช่าง"
        action={
          edit && (
            <Btn small primary onClick={() => setForm({})}>
              <Plus {...I} />
              นัดติดตั้ง
            </Btn>
          )
        }
      />
      {!range ? (
        <Empty>ยังไม่มีนัดติดตั้ง</Empty>
      ) : (
        <div className="overflow-x-auto px-5 py-4">
          <div style={{ minWidth: 220 + range.days * 22 }}>
            <div className="flex text-[11px] text-ink-3">
              <div className="w-[220px] shrink-0" />
              {Array.from({ length: range.days }, (_, i) => {
                const d = addDays(range.from, i);
                const dow = new Date(d).getUTCDay();
                return (
                  <div key={d} className={cx("w-[22px] shrink-0 text-center font-mono", d === TODAY && "text-accent-text", dow === 0 && "text-ink-3/60")}>
                    {Number(d.slice(8))}
                  </div>
                );
              })}
            </div>
            {crews.map((crew) => (
              <div key={crew} className="mt-3">
                <p className="mb-1 text-[13px] font-medium">{crew}</p>
                {jobs
                  .filter((j) => j.crew === crew)
                  .map((j) => {
                    const off = daysBetween(range.from, j.start);
                    const len = daysBetween(j.start, j.end) + 1;
                    const missing = j.ffeIds.filter((id) => {
                      const f = items.find((x) => x.id === id);
                      return f && ffeRank(f.status) < ffeRank("received");
                    }).length;
                    return (
                      <div key={j.id} className="flex items-center py-0.5">
                        <button type="button" disabled={!edit} onClick={() => setForm({ j })} className="w-[220px] shrink-0 truncate pr-3 text-left text-[13px] hover:underline disabled:no-underline">
                          {j.room}
                          {missing > 0 && j.status !== "done" && <span className="ml-1 text-[12px] text-warn">ของยังไม่ครบ {missing}</span>}
                        </button>
                        <div className="relative h-6 flex-1">
                          <div
                            className={cx("absolute top-1 h-4 rounded-[4px]", j.status === "done" ? "bg-pos" : j.status === "in_progress" ? "bg-accent" : "bg-deep border border-line-strong")}
                            style={{ left: off * 22, width: len * 22 - 4 }}
                            title={`${j.room} · ${dateOr(j.start)}–${dateOr(j.end)}`}
                          />
                          {daysBetween(range.from, TODAY) >= 0 && <div className="absolute inset-y-0 w-px bg-accent/50" style={{ left: daysBetween(range.from, TODAY) * 22 + 11 }} />}
                        </div>
                      </div>
                    );
                  })}
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-4 text-[12px] text-ink-3">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-4 rounded-[2px] border border-line-strong bg-deep" />
              นัดไว้
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-4 rounded-[2px] bg-accent" />
              กำลังติดตั้ง
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-4 rounded-[2px] bg-pos" />
              เสร็จแล้ว
            </span>
          </div>
        </div>
      )}
      {form && <JobForm p={p} initial={form.j} onClose={() => setForm(null)} />}
    </Card>
  );
}

function JobForm({ p, initial, onClose }: { p: InteriorProject; initial?: InstallJob; onClose: () => void }) {
  const items = ffeItems.use().filter((i) => i.interiorId === p.id);
  const [v, setV] = useState<InstallJob>(initial ?? { id: installJobs.nextId(`IJ-${p.id}-`, 1), interiorId: p.id, room: p.rooms[0]?.name ?? "", crew: CREWS[0], start: TODAY, end: addDays(TODAY, 2), ffeIds: [], status: "planned" });
  const roomItems = items.filter((i) => i.room === v.room);
  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? "แก้ไขนัดติดตั้ง" : "นัดติดตั้ง"}
      footer={
        <>
          {initial && (
            <Btn danger onClick={() => (installJobs.remove(initial.id), onClose())}>
              ลบ
            </Btn>
          )}
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!v.room || !v.crew.trim() || v.end < v.start} onClick={() => (installJobs.upsert(v), onClose())}>
            บันทึก
          </Btn>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ห้อง">
          <Select label="ห้อง" value={v.room} onChange={(room) => setV({ ...v, room, ffeIds: [] })}>
            {p.rooms.map((r) => (
              <option key={r.name}>{r.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="ทีมช่าง">
          <input list="crews" value={v.crew} onChange={(e) => setV({ ...v, crew: e.target.value })} className={inputCls} />
          <datalist id="crews">
            {CREWS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="เริ่ม">
          <input type="date" value={v.start} onChange={(e) => setV({ ...v, start: e.target.value })} className={inputCls} />
        </Field>
        <Field label="เสร็จ">
          <input type="date" value={v.end} onChange={(e) => setV({ ...v, end: e.target.value })} className={inputCls} />
        </Field>
        <Field label="สถานะ">
          <Select label="สถานะ" value={v.status} onChange={(s) => setV({ ...v, status: s as InstallJob["status"] })}>
            <option value="planned">นัดไว้</option>
            <option value="in_progress">กำลังติดตั้ง</option>
            <option value="done">เสร็จแล้ว</option>
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-[13px] text-ink-2">รายการที่ติดตั้ง</p>
          {roomItems.length === 0 ? (
            <p className="text-[13px] text-ink-3">ไม่มีรายการ FF&E ในห้องนี้</p>
          ) : (
            <div className="flex flex-col gap-1">
              {roomItems.map((i) => (
                <label key={i.id} className="flex items-center gap-2 text-[13px]">
                  <input type="checkbox" checked={v.ffeIds.includes(i.id)} onChange={(e) => setV({ ...v, ffeIds: e.target.checked ? [...v.ffeIds, i.id] : v.ffeIds.filter((x) => x !== i.id) })} className="size-4 accent-[var(--accent)]" />
                  <span className="font-mono text-ink-3">{i.code}</span> {i.description}
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="sm:col-span-2">
          <Field label="หมายเหตุ">
            <input value={v.note ?? ""} onChange={(e) => setV({ ...v, note: e.target.value || undefined })} className={inputCls} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

// ---------- punch list + sign-off ----------

const P_LABEL = { open: "ต้องแก้ไข", fixed: "แก้แล้ว รอตรวจ", verified: "ตรวจผ่าน" } as const;
const P_TONE = { open: "neg", fixed: "warn", verified: "pos" } as const;

export function PunchTab({ p }: { p: InteriorProject }) {
  const { edit, me } = usePerms("interior");
  const all = punchItems.use();
  const list = all.filter((x) => x.interiorId === p.id);
  const [form, setForm] = useState(false);
  const [fixing, setFixing] = useState<PunchItem | null>(null);
  const rooms = [...new Set(list.map((x) => x.room))];
  const allDone = list.length > 0 && list.every((x) => x.status === "verified");
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
      <Card>
        <CardHead
          title="รายการแก้ไขก่อนส่งมอบ"
          meta={`ค้าง ${list.filter((x) => x.status !== "verified").length} / ${list.length}`}
          action={
            edit && (
              <Btn small primary onClick={() => setForm(true)}>
                <Plus {...I} />
                เพิ่มรายการ
              </Btn>
            )
          }
        />
        {list.length === 0 && <Empty>ยังไม่มีรายการแก้ไข เดินตรวจหน้างานแล้วบันทึกพร้อมรูป</Empty>}
        {rooms.map((r) => (
          <section key={r} className="border-t border-line first:border-t-0">
            <p className="px-5 pt-3 text-[13px] font-medium">{r}</p>
            <ul className="divide-y divide-line">
              {list
                .filter((x) => x.room === r)
                .map((x) => (
                  <li key={x.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1 text-[13px]">
                      <p className="text-ink">{x.text}</p>
                      <p className="text-[12px] text-ink-3">
                        {dateOr(x.createdAt)} · {x.by}
                        {x.assignee ? ` · ผู้แก้ไข ${x.assignee}` : ""}
                        {x.fixedAt ? ` · แก้ ${dateOr(x.fixedAt)}` : ""}
                      </p>
                      <div className="mt-1 flex gap-4">
                        {x.photos.length > 0 && <MediaStrip refs={x.photos} size={44} />}
                        {x.afterPhotos && x.afterPhotos.length > 0 && <MediaStrip refs={x.afterPhotos} size={44} />}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Pill tone={P_TONE[x.status]}>{P_LABEL[x.status]}</Pill>
                      {edit && x.status === "open" && (
                        <Btn small onClick={() => setFixing(x)}>
                          แก้แล้ว
                        </Btn>
                      )}
                      {edit && x.status === "fixed" && (
                        <Btn small onClick={() => punchItems.upsert({ ...x, status: "verified" })}>
                          <CheckCircle2 {...I} />
                          ตรวจผ่าน
                        </Btn>
                      )}
                    </div>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </Card>
      <Card>
        <CardHead title="ลูกค้าเซ็นรับงาน" />
        <div className="px-5 py-4">
          {p.handover ? (
            <div className="text-[13px]">
              <p className="flex items-center gap-2 text-pos">
                <CheckCircle2 {...I} />
                ลูกค้าเซ็นรับงานแล้ว
              </p>
              <p className="mt-1">
                {p.handover.signedBy} · {dateOr(p.handover.signedAt)}
              </p>
              {p.handover.note && <p className="text-ink-2">{p.handover.note}</p>}
              {p.handover.signature && <MediaStrip refs={[p.handover.signature]} size={96} className="mt-2" />}
            </div>
          ) : !allDone ? (
            <p className="text-[13px] text-ink-3">ลูกค้าเซ็นรับได้เมื่อทุกรายการตรวจผ่านแล้ว</p>
          ) : edit ? (
            <>
              <p className="mb-2 text-[13px] text-ink-2">ให้ลูกค้าเซ็นบนหน้าจอเพื่อยืนยันรับงานตกแต่งทั้งหมด</p>
              <SignaturePad nameLabel="ชื่อลูกค้า" onSave={(signature, signer) => interiorProjects.upsert({ ...p, status: "closed", handover: { signedBy: signer || p.client, signedAt: TODAY, signature, note: `บันทึกโดย ${me.name}` } })} />
            </>
          ) : (
            <p className="text-[13px] text-ink-3">รอเจ้าหน้าที่ให้ลูกค้าเซ็นรับงาน</p>
          )}
        </div>
      </Card>
      {form && <PunchForm p={p} by={me.name} onClose={() => setForm(false)} />}
      {fixing && <FixModal x={fixing} onClose={() => setFixing(null)} />}
    </div>
  );
}

function PunchForm({ p, by, onClose }: { p: InteriorProject; by: string; onClose: () => void }) {
  const [v, setV] = useState<PunchItem>({ id: punchItems.nextId(`PL-${p.id}-`, 1), interiorId: p.id, room: p.rooms[0]?.name ?? "", text: "", photos: [], status: "open", createdAt: TODAY, by });
  return (
    <Modal
      open
      onClose={onClose}
      title="เพิ่มรายการแก้ไข"
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!v.text.trim()} onClick={() => (punchItems.upsert({ ...v, text: v.text.trim() }), onClose())}>
            บันทึก
          </Btn>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ห้อง">
          <Select label="ห้อง" value={v.room} onChange={(room) => setV({ ...v, room })}>
            {p.rooms.map((r) => (
              <option key={r.name}>{r.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="ผู้แก้ไข">
          <input list="crews-p" value={v.assignee ?? ""} onChange={(e) => setV({ ...v, assignee: e.target.value || undefined })} className={inputCls} />
          <datalist id="crews-p">
            {CREWS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <div className="sm:col-span-2">
          <Field label="สิ่งที่ต้องแก้ไข">
            <textarea value={v.text} onChange={(e) => setV({ ...v, text: e.target.value })} className={areaCls} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <MediaField value={v.photos} onChange={(photos) => setV({ ...v, photos })} label="รูปก่อนแก้" photosOnly />
        </div>
      </div>
    </Modal>
  );
}

function FixModal({ x, onClose }: { x: PunchItem; onClose: () => void }) {
  const [after, setAfter] = useState(x.afterPhotos ?? []);
  return (
    <Modal
      open
      onClose={onClose}
      title="บันทึกแก้ไขแล้ว"
      width={520}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary onClick={() => (punchItems.upsert({ ...x, status: "fixed", fixedAt: TODAY, afterPhotos: after }), onClose())}>
            บันทึก
          </Btn>
        </>
      }
    >
      <p className="mb-3 text-[13px] text-ink-2">{x.text}</p>
      <MediaField value={after} onChange={setAfter} label="รูปหลังแก้" photosOnly />
    </Modal>
  );
}
