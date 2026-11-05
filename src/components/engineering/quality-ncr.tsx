"use client";

import { useMemo, useState } from "react";
import { CheckCheck, Pencil, Printer, RotateCcw, Wrench } from "lucide-react";
import { Card, cx, Field, inputCls } from "@/components/ui";
import { Btn, Empty, I, KV, Modal, Pill, Select, type Tone } from "@/components/ops/bits";
import { MediaField, MediaStrip } from "@/components/media/media-field";
import { subcontractors } from "@/lib/biz";
import { getProject, thDate, TODAY } from "@/lib/data";
import {
  addDays,
  DISC_LABEL,
  DISCS,
  diffDays,
  NCR_SEVERITY_LABEL,
  NCR_STATUS_LABEL,
  ncrs,
  nextSeries,
  useEngSettings,
  type Disc,
  type Ncr,
  type NcrSeverity,
  type NcrStatus,
} from "@/lib/engineering";
import { Area, DocHeader, DocRow, DocSection, Due, PeopleList, pname, ProjectSelect, rowCls, Signatures, td, th, useEngPerms } from "./bits";
import { NcrAssist } from "@/components/ai-field/eng-assist";
import { matchQ, QFilters, useNewTrigger, type QFilter, type SetQ } from "./quality-bits";

export const NCR_TONE: Record<NcrStatus, Tone> = { open: "neg", action: "warn", verify: "accent", closed: "pos" };
export const SEV_TONE: Record<NcrSeverity, Tone> = { minor: "neutral", major: "warn", critical: "neg" };

export function NcrTab({ f, setF, newKey }: { f: QFilter; setF: SetQ; newKey: number }) {
  const perms = useEngPerms();
  const s = useEngSettings();
  const all = ncrs.use();
  const [edit, setEdit] = useState<Ncr | null | "new">(null);
  const [view, setView] = useState<string | null>(() => all.find((n) => n.id === f.q)?.id ?? null);
  useNewTrigger(newKey, () => setEdit("new"));

  const people = useMemo(() => [...new Set(all.map((n) => n.responsible))].sort(), [all]);
  const rows = useMemo(
    () =>
      all
        .filter((n) => !f.project || n.projectId === f.project)
        .filter((n) => !f.status || (f.status === "notclosed" ? n.status !== "closed" : f.status === "old" ? n.status !== "closed" && diffDays(n.raisedAt, TODAY) > s.ncrOpenDays : n.status === f.status))
        .filter((n) => !f.person || n.responsible === f.person)
        .filter((n) => matchQ(f.q, n.id, n.title, n.location, n.description, n.responsible))
        .sort((a, b) => Number(a.status === "closed") - Number(b.status === "closed") || b.raisedAt.localeCompare(a.raisedAt)),
    [all, f, s.ncrOpenDays],
  );
  const viewing = view ? all.find((n) => n.id === view) : undefined;

  return (
    <>
      <QFilters f={f} setF={setF} count={rows.length} personLabel="ผู้รับผิดชอบ" people={people} statuses={[...Object.entries(NCR_STATUS_LABEL), ["notclosed", "ยังไม่ปิด"], ["old", `ค้างเกิน ${s.ncrOpenDays} วัน`]]} />
      <Card className="ops-noprint">
        {rows.length === 0 ? (
          <Empty>ไม่มี NCR ตามตัวกรองนี้</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px]">
              <thead>
                <tr>
                  <th className={th}>NCR</th>
                  <th className={th}>เรื่อง · ตำแหน่ง</th>
                  <th className={th}>ความรุนแรง</th>
                  <th className={th}>ผู้รับผิดชอบ</th>
                  <th className={th}>กำหนดแก้ไข</th>
                  <th className={th}>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((n) => {
                  const age = diffDays(n.raisedAt, TODAY);
                  return (
                    <tr key={n.id} className={rowCls} onClick={() => setView(n.id)}>
                      <td className={td}>
                        <span className="font-mono text-[12px] text-accent-text">{n.id}</span>
                        <span className="block text-[12px] text-ink-3">
                          {thDate(n.raisedAt)} · {n.raisedBy}
                        </span>
                      </td>
                      <td className={td}>
                        <span className="block max-w-[340px] truncate">{n.title}</span>
                        <span className="block text-[12px] text-ink-3">
                          {pname(n.projectId)} · {n.location} · {DISC_LABEL[n.disc]}
                        </span>
                      </td>
                      <td className={td}>
                        <Pill tone={SEV_TONE[n.severity]}>{NCR_SEVERITY_LABEL[n.severity]}</Pill>
                      </td>
                      <td className={cx(td, "text-[13px]")}>{n.responsible}</td>
                      <td className={td}>
                        <Due date={n.due} done={n.status === "closed"} />
                      </td>
                      <td className={td}>
                        <Pill tone={NCR_TONE[n.status]}>{NCR_STATUS_LABEL[n.status]}</Pill>
                        {n.status !== "closed" && <span className={cx("mt-1 block text-[12px]", age > s.ncrOpenDays ? "text-neg" : "text-ink-3")}>เปิด {age} วัน</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {viewing && <NcrDetail n={viewing} onClose={() => setView(null)} onEdit={() => setEdit(viewing)} canEdit={perms.edit} />}
      {edit && <NcrForm init={edit === "new" ? undefined : edit} defaultProject={f.project} onClose={() => setEdit(null)} onSaved={(id) => setView(id)} />}
    </>
  );
}

export function NcrForm({ init, defaultProject, onClose, onSaved, preset }: { init?: Ncr; defaultProject?: string; onClose: () => void; onSaved?: (id: string) => void; preset?: Partial<Ncr> }) {
  const perms = useEngPerms();
  const subs = subcontractors.use();
  const [d, setD] = useState<Ncr>(
    () =>
      init ?? {
        id: "",
        projectId: defaultProject ?? "",
        no: 0,
        title: "",
        description: "",
        location: "",
        disc: "S",
        severity: "major",
        raisedBy: perms.me.name,
        raisedAt: TODAY,
        responsible: "",
        due: addDays(TODAY, 7),
        status: "open",
        photos: [],
        closePhotos: [],
        ...preset,
      },
  );
  const set = <K extends keyof Ncr>(k: K, v: Ncr[K]) => setD((x) => ({ ...x, [k]: v }));
  const ok = d.projectId && d.title.trim() && d.responsible.trim();
  const save = () => {
    if (!ok) return;
    let rec = d;
    if (!init) {
      const { id, no } = nextSeries(ncrs.all(), "NCR", d.projectId);
      rec = { ...d, id, no };
    }
    ncrs.upsert(rec);
    onSaved?.(rec.id);
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={init ? `แก้ไข ${init.id}` : "ออกรายงานงานไม่เป็นไปตามข้อกำหนด (NCR)"}
      width={760}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!ok} onClick={save}>
            บันทึก
          </Btn>
        </>
      }
    >
      <PeopleList />
      <div className="mb-4">
        <NcrAssist
          projectId={d.projectId}
          photos={d.photos}
          onApply={(a) =>
            setD((x) => ({
              ...x,
              title: a.title || x.title,
              description: a.description || x.description,
              location: a.location || x.location,
              disc: a.disc,
              severity: a.severity,
              rootCause: a.rootCause || x.rootCause,
              corrective: a.corrective || x.corrective,
              preventive: a.preventive || x.preventive,
            }))
          }
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {!init && (
          <Field label="โครงการ">
            <ProjectSelect value={d.projectId} onChange={(v) => set("projectId", v)} required />
          </Field>
        )}
        <Field label="หัวข้อ">
          <input value={d.title} onChange={(e) => set("title", e.target.value)} className={inputCls} placeholder="เช่น รูพรุนคอนกรีตเสาชั้น 4" />
        </Field>
        <Field label="ตำแหน่ง">
          <input value={d.location} onChange={(e) => set("location", e.target.value)} className={inputCls} placeholder="ชั้น / แนวแกน / ห้อง" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="หมวดงาน">
            <Select label="หมวดงาน" value={d.disc} onChange={(v) => set("disc", v as Disc)}>
              {DISCS.map((k) => (
                <option key={k} value={k}>
                  {DISC_LABEL[k]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="ความรุนแรง">
            <Select label="ความรุนแรง" value={d.severity} onChange={(v) => set("severity", v as NcrSeverity)}>
              {(Object.keys(NCR_SEVERITY_LABEL) as NcrSeverity[]).map((k) => (
                <option key={k} value={k}>
                  {NCR_SEVERITY_LABEL[k]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="รายละเอียดสิ่งที่พบ">
            <Area value={d.description} onChange={(v) => set("description", v)} placeholder="สิ่งที่ไม่เป็นไปตามแบบ / ข้อกำหนด / มาตรฐาน" />
          </Field>
        </div>
        <Field label="ผู้รับเหมาช่วง (ถ้ามี)">
          <Select
            label="ผู้รับเหมาช่วง"
            value={d.subcontractorId ?? ""}
            onChange={(v) => {
              const sub = subs.find((x) => x.id === v);
              setD((x) => ({ ...x, subcontractorId: v || undefined, responsible: sub ? sub.name : x.responsible }));
            }}
          >
            <option value="">ไม่ระบุ / ทีมบริษัท</option>
            {subs.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
            {d.subcontractorId && !subs.some((x) => x.id === d.subcontractorId) && <option value={d.subcontractorId}>{d.subcontractorId}</option>}
          </Select>
        </Field>
        <Field label="ผู้รับผิดชอบแก้ไข">
          <input value={d.responsible} onChange={(e) => set("responsible", e.target.value)} list="eng-people" className={inputCls} placeholder="ชื่อทีม / บุคคล" />
        </Field>
        <Field label="กำหนดแก้ไขเสร็จ">
          <input type="date" value={d.due} onChange={(e) => set("due", e.target.value)} className={cx(inputCls, "font-mono")} />
        </Field>
        <Field label="ผู้ออกรายงาน">
          <input value={d.raisedBy} onChange={(e) => set("raisedBy", e.target.value)} list="eng-people" className={inputCls} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="สาเหตุ (Root cause)">
            <Area value={d.rootCause ?? ""} onChange={(v) => set("rootCause", v || undefined)} rows={2} />
          </Field>
        </div>
        <Field label="การแก้ไข (Corrective action)">
          <Area value={d.corrective ?? ""} onChange={(v) => set("corrective", v || undefined)} rows={2} />
        </Field>
        <Field label="การป้องกันไม่ให้เกิดซ้ำ (Preventive action)">
          <Area value={d.preventive ?? ""} onChange={(v) => set("preventive", v || undefined)} rows={2} />
        </Field>
        <div className="sm:col-span-2">
          <MediaField label="รูปสิ่งที่พบ" value={d.photos} onChange={(photos) => set("photos", photos)} />
        </div>
      </div>
    </Modal>
  );
}

function NcrDetail({ n, onClose, onEdit, canEdit }: { n: Ncr; onClose: () => void; onEdit: () => void; canEdit: boolean }) {
  const perms = useEngPerms();
  const [closePhotos, setClosePhotos] = useState(n.closePhotos);
  const [verifier, setVerifier] = useState(n.verifiedBy ?? perms.me.name);
  const p = getProject(n.projectId);
  const save = (patch: Partial<Ncr>) => ncrs.upsert({ ...n, ...patch });
  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={n.id}
        width={780}
        footer={
          <>
            <Btn onClick={() => window.print()}>
              <Printer {...I} />
              พิมพ์ NCR
            </Btn>
            {canEdit && (
              <Btn onClick={onEdit}>
                <Pencil {...I} />
                แก้ไข
              </Btn>
            )}
            {canEdit && n.status === "open" && (
              <Btn primary onClick={() => save({ status: "action" })} disabled={!n.corrective}>
                <Wrench {...I} />
                เริ่มแก้ไข
              </Btn>
            )}
            {canEdit && n.status === "action" && (
              <Btn primary onClick={() => save({ status: "verify" })}>
                แก้ไขเสร็จ ขอตรวจยืนยัน
              </Btn>
            )}
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2 pb-3">
          <Pill tone={NCR_TONE[n.status]}>{NCR_STATUS_LABEL[n.status]}</Pill>
          <Pill tone={SEV_TONE[n.severity]}>{NCR_SEVERITY_LABEL[n.severity]}</Pill>
          <Pill>{DISC_LABEL[n.disc]}</Pill>
          {n.inspectionRequestId && <Pill mono>{n.inspectionRequestId}</Pill>}
        </div>
        <h3 className="text-[18px] font-normal">{n.title}</h3>
        <p className="mt-1 whitespace-pre-line text-[14px] text-ink-2">{n.description}</p>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 sm:gap-x-6">
          <KV k="โครงการ">{p?.name ?? n.projectId}</KV>
          <KV k="ตำแหน่ง">{n.location}</KV>
          <KV k="ผู้ออกรายงาน">
            {n.raisedBy} · {thDate(n.raisedAt)}
          </KV>
          <KV k="ผู้รับผิดชอบ">{n.responsible}</KV>
          <KV k="กำหนดแก้ไข">{thDate(n.due)}</KV>
          <KV k="เปิดมาแล้ว">{diffDays(n.raisedAt, n.closedAt ?? TODAY)} วัน</KV>
          <KV k="สาเหตุ" wide>
            {n.rootCause ?? <span className="text-ink-3">ยังไม่ระบุ</span>}
          </KV>
          <KV k="การแก้ไข" wide>
            {n.corrective ?? <span className="text-ink-3">ยังไม่ระบุ (ต้องระบุก่อนเริ่มแก้ไข)</span>}
          </KV>
          <KV k="การป้องกัน" wide>
            {n.preventive ?? <span className="text-ink-3">ยังไม่ระบุ</span>}
          </KV>
        </div>
        {n.photos.length > 0 && (
          <div className="mt-3">
            <p className="mb-1.5 text-[13px] text-ink-3">รูปสิ่งที่พบ</p>
            <MediaStrip refs={n.photos} />
          </div>
        )}
        {(n.status === "verify" || n.status === "closed") && (
          <div className="mt-4 rounded-[10px] border border-line bg-raised/50 p-3">
            <p className="text-[14px] font-medium">ตรวจยืนยันและปิด NCR</p>
            {n.status === "closed" ? (
              <>
                <p className="mt-1 text-[13px] text-ink-2">
                  ปิดโดย {n.verifiedBy} · {n.closedAt && thDate(n.closedAt)}
                </p>
                <MediaStrip refs={n.closePhotos} className="mt-2" />
                {canEdit && (
                  <div className="mt-2">
                    <Btn small onClick={() => save({ status: "action", closedAt: undefined, verifiedBy: undefined })}>
                      <RotateCcw {...I} />
                      เปิดใหม่
                    </Btn>
                  </div>
                )}
              </>
            ) : canEdit ? (
              <div className="mt-2 flex flex-col gap-3">
                <Field label="ผู้ตรวจยืนยัน">
                  <input value={verifier} onChange={(e) => setVerifier(e.target.value)} list="eng-people" className={inputCls} />
                </Field>
                <PeopleList />
                <MediaField label="รูปหลังแก้ไข" value={closePhotos} onChange={(v) => (setClosePhotos(v), save({ closePhotos: v }))} />
                <div className="flex flex-wrap gap-2">
                  <Btn primary disabled={!verifier.trim()} onClick={() => save({ status: "closed", verifiedBy: verifier.trim(), closedAt: TODAY, closePhotos })}>
                    <CheckCheck {...I} />
                    ผ่าน ปิด NCR
                  </Btn>
                  <Btn danger onClick={() => save({ status: "action" })}>
                    ยังไม่ผ่าน ส่งกลับแก้ไข
                  </Btn>
                </div>
              </div>
            ) : (
              <p className="mt-1 text-[13px] text-ink-3">รอผู้มีสิทธิ์ตรวจยืนยัน</p>
            )}
          </div>
        )}
      </Modal>

      <article className="ops-print hidden bg-white text-ink print:block">
        <DocHeader title="รายงานงานไม่เป็นไปตามข้อกำหนด" titleEn="NON-CONFORMANCE REPORT" code={n.id} meta={<p>วันที่ออก {thDate(n.raisedAt)}</p>} />
        <DocSection n={1} title="ข้อมูลโครงการ" en="PROJECT">
          <div className="grid grid-cols-2 gap-x-6">
            <DocRow k="โครงการ">
              {n.projectId} · {p?.name}
            </DocRow>
            <DocRow k="ผู้จัดการโครงการ">{p?.pm}</DocRow>
            <DocRow k="ตำแหน่ง">{n.location}</DocRow>
            <DocRow k="หมวดงาน">{DISC_LABEL[n.disc]}</DocRow>
            <DocRow k="ความรุนแรง">{NCR_SEVERITY_LABEL[n.severity]}</DocRow>
            <DocRow k="สถานะ">{NCR_STATUS_LABEL[n.status]}</DocRow>
          </div>
        </DocSection>
        <DocSection n={2} title="สิ่งที่ไม่เป็นไปตามข้อกำหนด" en="NON-CONFORMANCE">
          <p className="text-[13px] font-medium">{n.title}</p>
          <p className="mt-1 whitespace-pre-line text-[13px]">{n.description}</p>
          <MediaStrip refs={n.photos} size={96} className="mt-2" />
        </DocSection>
        <DocSection n={3} title="สาเหตุและการแก้ไข" en="ROOT CAUSE · CORRECTIVE · PREVENTIVE">
          <DocRow k="สาเหตุ">{n.rootCause ?? "–"}</DocRow>
          <DocRow k="การแก้ไข">{n.corrective ?? "–"}</DocRow>
          <DocRow k="การป้องกัน">{n.preventive ?? "–"}</DocRow>
          <DocRow k="ผู้รับผิดชอบ">{n.responsible}</DocRow>
          <DocRow k="กำหนดแล้วเสร็จ">{thDate(n.due)}</DocRow>
        </DocSection>
        <DocSection n={4} title="การตรวจยืนยันและปิด" en="VERIFICATION">
          <DocRow k="ผลการตรวจ">{n.status === "closed" ? `ผ่าน ปิด NCR วันที่ ${n.closedAt ? thDate(n.closedAt) : ""}` : "ยังไม่ปิด"}</DocRow>
          <MediaStrip refs={n.closePhotos} size={96} className="mt-2" />
        </DocSection>
        <Signatures roles={[{ role: "ผู้ออกรายงาน", name: n.raisedBy }, { role: "ผู้รับผิดชอบแก้ไข", name: n.responsible }, { role: "ผู้ควบคุมงาน / ผู้ตรวจยืนยัน", name: n.verifiedBy }]} />
      </article>
    </>
  );
}
