"use client";

import { useState } from "react";
import Link from "next/link";
import { Layers, Paperclip, Pencil, Plus } from "lucide-react";
import { Card, CardHead, cx, Field, inputCls } from "@/components/ui";
import { Btn, Empty, I, KV, Modal, Pill, Select, areaCls } from "@/components/ops/bits";
import { MediaField } from "@/components/media/media-field";
import { TODAY, getProject } from "@/lib/data";
import {
  AUTHORITY_LABEL,
  COMPLETION_LABEL,
  FLAG_LABEL,
  ROUTE_LABEL,
  USE_LABEL,
  addDays,
  completionKindFor,
  eiaCheck,
  permitChecklist,
  permitState,
  permits,
  useDesignSettings,
  type AuthorityKind,
  type BuildingUse,
  type CompletionKind,
  type Permit,
  type PermitDoc,
  type PermitDocStatus,
  type PermitRoute,
} from "@/lib/design";
import { Check, Header, NumInput, PermitPill, VerifyNote, dateOr, usePerms } from "./bits";

const DOC_LABEL: Record<PermitDocStatus, string> = { missing: "ยังไม่มี", ready: "พร้อมยื่น", submitted: "ยื่นแล้ว" };
const STEPS: { label: string; on: (p: Permit) => boolean }[] = [
  { label: "เตรียมเอกสาร", on: () => true },
  { label: "ยื่นต่อหน่วยงาน", on: (p) => !!p.submittedAt },
  { label: "ได้รับอนุญาต/ใบรับแจ้ง", on: (p) => !!p.issuedAt },
  { label: "แจ้งก่อสร้างเสร็จ", on: (p) => !!p.completionSubmittedAt },
  { label: "ปิดเรื่อง", on: (p) => p.status === "completed" },
];

export function PermitDetail({ projectId }: { projectId: string }) {
  const { edit } = usePerms("design");
  const s = useDesignSettings();
  const list = permits.use();
  const p = list.find((x) => x.projectId === projectId);
  const proj = getProject(projectId);
  const [modal, setModal] = useState<null | "info" | "submit" | "query" | "issue" | "extend" | "complete">(null);
  const [reply, setReply] = useState<{ id: string; text: string } | null>(null);
  const [openDoc, setOpenDoc] = useState<string | null>(null);

  if (!p)
    return (
      <Card>
        <Empty>
          ยังไม่มีคำขออนุญาตของ {projectId} ·{" "}
          <Link href="/permits" className="text-ink underline-offset-2 hover:underline">
            เพิ่มคำขอจากหน้าขออนุญาตก่อสร้าง
          </Link>
        </Empty>
      </Card>
    );

  const st = permitState(p, TODAY, s);
  const eia = eiaCheck(p, s);
  const save = (patch: Partial<Permit>) => permits.upsert({ ...p, ...patch });
  const setDoc = (key: string, patch: Partial<PermitDoc>) => save({ docs: p.docs.map((d) => (d.key === key ? { ...d, ...patch } : d)) });
  const reviewDays = p.route === "m39" ? s.m39ReviewDays : s.permitReviewDays;

  return (
    <>
      <Header
        eyebrow={`ขออนุญาตก่อสร้าง · ${projectId}`}
        title={proj?.name ?? projectId}
        sub={`${ROUTE_LABEL[p.route]} · ${p.authorityName}${p.permitNo ? ` · ${p.permitNo}` : ""}`}
        actions={
          <Link href={`/design-stages/${projectId}`} className="inline-flex h-9 items-center gap-2 rounded-[8px] border border-line-strong bg-card px-4 text-[14px] font-medium hover:bg-raised">
            <Layers {...I} />
            ขั้นตอนออกแบบ
          </Link>
        }
      />

      <ol className="mb-4 grid grid-cols-5 gap-2">
        {STEPS.map((x, i) => {
          const done = x.on(p);
          return (
            <li key={x.label} className={cx("rounded-[12px] border px-3 py-2 text-[13px]", done ? "border-ink-3 bg-card" : "border-line bg-raised/50 text-ink-3")}>
              <span className="num mr-1.5 font-mono text-[12px]">{i + 1}</span>
              {x.label}
            </li>
          );
        })}
      </ol>
      {st.flags.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {st.flags.map((f) => (
            <Pill key={f} tone={f === "expired" || f === "stuck" ? "neg" : "warn"}>
              {FLAG_LABEL[f]}
              {f === "stuck" && ` · ${st.pendingDays} วัน`}
              {f === "expiring" && ` · อีก ${st.expiresIn} วัน`}
            </Pill>
          ))}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHead title="เอกสารประกอบการยื่น" meta={`พร้อม ${st.docs.ready}/${st.docs.total} รายการที่ต้องใช้`} />
            <ul className="divide-y divide-line">
              {p.docs.map((d) => (
                <li key={d.key} className="px-5 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px]">
                        {d.label}
                        {!d.required && <span className="ml-2 text-[12px] text-ink-3">(ถ้ามี)</span>}
                      </p>
                      {d.note && <p className="text-[12px] text-warn">{d.note}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setOpenDoc(openDoc === d.key ? null : d.key)} className="inline-flex h-8 items-center gap-1 rounded-[8px] px-2 text-[13px] text-ink-2 hover:bg-raised hover:text-ink">
                        <Paperclip {...I} />
                        <span className="num font-mono">{d.files.length}</span>
                      </button>
                      {edit ? (
                        <select aria-label={`สถานะ ${d.label}`} value={d.status} onChange={(e) => setDoc(d.key, { status: e.target.value as PermitDocStatus })} className={cx(inputCls, "h-8 w-[120px] pr-6 text-[13px]", d.status === "missing" && d.required && "text-neg")}>
                          {Object.entries(DOC_LABEL).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Pill tone={d.status === "missing" ? (d.required ? "neg" : "neutral") : "pos"}>{DOC_LABEL[d.status]}</Pill>
                      )}
                    </div>
                  </div>
                  {openDoc === d.key && (
                    <div className="mt-2 rounded-[10px] border border-line bg-raised/40 p-3">
                      <MediaField value={d.files} onChange={(files) => setDoc(d.key, { files, status: files.length && d.status === "missing" ? "ready" : d.status })} label="ไฟล์เอกสาร (สแกน/PDF)" geotag={false} />
                      {edit && (
                        <input defaultValue={d.note ?? ""} onBlur={(e) => e.target.value !== (d.note ?? "") && setDoc(d.key, { note: e.target.value || undefined })} placeholder="หมายเหตุ" className={cx(inputCls, "mt-2 w-full")} />
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {edit && <AddDoc onAdd={(label) => save({ docs: [...p.docs, { key: `x-${p.docs.length + 1}`, label, required: true, status: "missing", files: [] }] })} />}
          </Card>

          <Card>
            <CardHead
              title="การยื่นและข้อซักถามของเจ้าหน้าที่"
              action={
                edit && (
                  <div className="flex gap-2">
                    {p.status === "preparing" && (
                      <Btn small primary onClick={() => setModal("submit")}>
                        บันทึกการยื่น
                      </Btn>
                    )}
                    {(p.status === "submitted" || p.status === "query") && (
                      <Btn small onClick={() => setModal("query")}>
                        <Plus {...I} />
                        ข้อซักถาม
                      </Btn>
                    )}
                  </div>
                )
              }
            />
            <div className="px-5 py-3">
              <KV k="วันที่ยื่น">
                {dateOr(p.submittedAt)}
                {st.pendingDays !== undefined && <span className={cx("ml-2 text-[12px]", st.flags.includes("stuck") ? "text-neg" : "text-ink-3")}>ผ่านมา {st.pendingDays} วัน</span>}
              </KV>
              <KV k="เจ้าหน้าที่">{p.officer ?? "–"}</KV>
              <KV k="ระยะพิจารณา">
                {p.route === "m39" ? `ตรวจแบบภายใน ${reviewDays} วันหลังรับแจ้ง` : `พิจารณาภายใน ${reviewDays} วัน`} <VerifyNote />
              </KV>
            </div>
            {p.queries.length === 0 ? (
              <p className="px-5 pb-4 text-[13px] text-ink-3">ยังไม่มีข้อซักถาม</p>
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {p.queries.map((qq) => (
                  <li key={qq.id} className="px-5 py-3 text-[13px]">
                    <p className="text-ink-3">
                      {dateOr(qq.date)} · {qq.officer}
                    </p>
                    <p className="mt-0.5 text-ink">{qq.text}</p>
                    {qq.repliedAt ? (
                      <p className="mt-1 text-ink-2">
                        <Pill tone="pos">ตอบแล้ว {dateOr(qq.repliedAt)}</Pill> {qq.reply}
                      </p>
                    ) : reply?.id === qq.id ? (
                      <div className="mt-2 flex flex-col gap-2">
                        <textarea value={reply.text} onChange={(e) => setReply({ id: qq.id, text: e.target.value })} className={areaCls} placeholder="สิ่งที่ส่งชี้แจง/แก้ไข" />
                        <div className="flex gap-2">
                          <Btn small primary disabled={!reply.text.trim()} onClick={() => (save({ queries: p.queries.map((x) => (x.id === qq.id ? { ...x, reply: reply.text.trim(), repliedAt: TODAY } : x)), status: p.status === "query" ? "submitted" : p.status }), setReply(null))}>
                            บันทึกคำตอบ
                          </Btn>
                          <Btn small onClick={() => setReply(null)}>
                            ยกเลิก
                          </Btn>
                        </div>
                      </div>
                    ) : (
                      edit && (
                        <button type="button" onClick={() => setReply({ id: qq.id, text: "" })} className="mt-1 text-[13px] text-accent-text hover:underline">
                          บันทึกการชี้แจง
                        </button>
                      )
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHead
              title="ข้อมูลคำขอ"
              action={
                edit && (
                  <Btn small onClick={() => setModal("info")}>
                    <Pencil {...I} />
                    แก้ไข
                  </Btn>
                )
              }
            />
            <div className="px-5 py-3">
              <KV k="สถานะ">
                <PermitPill s={p.status} />
              </KV>
              <KV k="ช่องทาง">{ROUTE_LABEL[p.route]}</KV>
              <KV k="หน่วยงาน">
                {p.authorityName}
                <span className="block text-[12px] text-ink-3">{AUTHORITY_LABEL[p.authorityKind]}</span>
              </KV>
              <KV k="ประเภทอาคาร">{USE_LABEL[p.use]}</KV>
              <KV k="ความสูง / พื้นที่">
                <span className="num font-mono">
                  {p.height} ม. · {p.floorArea.toLocaleString("th-TH")} ตร.ม.
                </span>
                {p.units ? <span className="num ml-1 font-mono">· {p.units} ห้อง</span> : null}
              </KV>
              <KV k="EIA">
                {eia.required ? <span className="text-warn">ต้องจัดทำ · {eia.reasons.join(", ")}</span> : <span className="text-ink-2">ไม่เข้าเกณฑ์</span>}
                <span className="block">
                  <VerifyNote />
                </span>
              </KV>
              <KV k="ค่าธรรมเนียม">{p.fee ? `฿${p.fee.toLocaleString("th-TH")}` : "–"}</KV>
              {p.note && <KV k="หมายเหตุ">{p.note}</KV>}
            </div>
          </Card>

          <Card>
            <CardHead
              title={p.route === "m39" ? "ใบรับแจ้ง" : "ใบอนุญาต (อ.1)"}
              action={
                edit &&
                (p.status === "submitted" || p.status === "query" ? (
                  <Btn small primary onClick={() => setModal("issue")}>
                    บันทึกได้รับ
                  </Btn>
                ) : p.status === "approved" ? (
                  <Btn small onClick={() => setModal("extend")}>
                    ขอต่ออายุ
                  </Btn>
                ) : null)
              }
            />
            <div className="px-5 py-3">
              <KV k="เลขที่">{p.permitNo ?? "–"}</KV>
              <KV k="วันที่ออก">{dateOr(p.issuedAt)}</KV>
              <KV k="หมดอายุ">
                {dateOr(st.expiry)}
                {st.expiresIn !== undefined && <span className={cx("ml-2 text-[12px]", st.expiresIn < 0 ? "text-neg" : st.flags.includes("expiring") ? "text-warn" : "text-ink-3")}>{st.expiresIn < 0 ? `เกิน ${-st.expiresIn} วัน` : `อีก ${st.expiresIn} วัน`}</span>}
              </KV>
            </div>
            {p.extensions.length > 0 && (
              <ul className="divide-y divide-line border-t border-line">
                {p.extensions.map((e, i) => (
                  <li key={e.id} className="px-5 py-2.5 text-[13px]">
                    <p>
                      ต่ออายุครั้งที่ {i + 1} · ยื่น {dateOr(e.requestedAt)}
                      {e.approvedAt ? <Pill tone="pos">อนุมัติ {dateOr(e.approvedAt)}</Pill> : <Pill tone="warn">รอพิจารณา</Pill>}
                    </p>
                    {e.newExpiry && <p className="text-ink-3">หมดอายุใหม่ {dateOr(e.newExpiry)}</p>}
                    {e.note && <p className="text-ink-2">{e.note}</p>}
                    {!e.approvedAt && edit && (
                      <button type="button" className="mt-1 text-accent-text hover:underline" onClick={() => save({ extensions: p.extensions.map((x) => (x.id === e.id ? { ...x, approvedAt: TODAY, newExpiry: x.newExpiry ?? addDays(st.expiry ?? TODAY, s.permitValidityDays) } : x)) })}>
                        บันทึกว่าอนุมัติแล้ว
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHead
              title="หลังก่อสร้างเสร็จ"
              meta={COMPLETION_LABEL[p.completionKind]}
              action={
                edit &&
                (p.status === "approved" ? (
                  <Btn small onClick={() => setModal("complete")}>
                    แจ้งก่อสร้างเสร็จ
                  </Btn>
                ) : p.status === "completion" ? (
                  <Btn small primary onClick={() => setModal("complete")}>
                    ปิดเรื่อง
                  </Btn>
                ) : null)
              }
            />
            <div className="px-5 py-3">
              <KV k="ยื่นแจ้ง">{dateOr(p.completionSubmittedAt)}</KV>
              <KV k="ได้รับ/ปิดเรื่อง">{dateOr(p.completionIssuedAt)}</KV>
              <KV k="เลขที่อ้างอิง">{p.completionRef ?? "–"}</KV>
              <p className="pt-2 text-[12px] text-ink-3">
                {p.completionKind === "a6" ? "อาคารประเภทควบคุมการใช้ ต้องได้ใบรับรองการก่อสร้าง (อ.6) ก่อนเปิดใช้อาคาร" : "บ้านพักอาศัย แจ้งการก่อสร้างเสร็จต่อเจ้าพนักงานท้องถิ่นก่อนเข้าอยู่"} <VerifyNote />
              </p>
            </div>
          </Card>
        </div>
      </div>

      {modal === "info" && <InfoModal p={p} onClose={() => setModal(null)} />}
      {modal === "submit" && (
        <DateModal
          title="บันทึกการยื่นคำขอ"
          label="วันที่ยื่น"
          extra={!st.docs.complete ? <p className="text-[13px] text-warn">ยังมีเอกสารที่ต้องใช้ไม่ครบ {st.docs.total - st.docs.ready} รายการ</p> : null}
          withText="เจ้าหน้าที่ผู้รับเรื่อง (ถ้าทราบ)"
          onClose={() => setModal(null)}
          onSave={(date, officer) =>
            save({
              submittedAt: date,
              officer: officer || p.officer,
              status: "submitted",
              docs: p.docs.map((d) => (d.status === "ready" ? { ...d, status: "submitted" } : d)),
            })
          }
        />
      )}
      {modal === "query" && <QueryModal p={p} onClose={() => setModal(null)} onSave={(q) => save({ queries: [...p.queries, q], status: "query" })} />}
      {modal === "issue" && (
        <DateModal title={p.route === "m39" ? "บันทึกได้รับใบรับแจ้ง" : "บันทึกได้รับใบอนุญาต (อ.1)"} label="วันที่ออก" withText="เลขที่ใบอนุญาต/ใบรับแจ้ง" required onClose={() => setModal(null)} onSave={(date, no) => save({ issuedAt: date, permitNo: no, expiresAt: addDays(date, s.permitValidityDays), status: "approved" })} />
      )}
      {modal === "extend" && <DateModal title="ยื่นขอต่ออายุใบอนุญาต" label="วันที่ยื่น" withText="หมายเหตุ" onClose={() => setModal(null)} onSave={(date, note) => save({ extensions: [...p.extensions, { id: `E${p.extensions.length + 1}`, requestedAt: date, note: note || undefined }] })} />}
      {modal === "complete" &&
        (p.status === "approved" ? (
          <DateModal title={`ยื่น${COMPLETION_LABEL[p.completionKind]}`} label="วันที่ยื่น" onClose={() => setModal(null)} onSave={(date) => save({ completionSubmittedAt: date, status: "completion" })} />
        ) : (
          <DateModal title="ปิดเรื่อง (ได้รับใบรับรอง/รับแจ้งแล้ว)" label="วันที่ได้รับ" withText="เลขที่อ้างอิง" onClose={() => setModal(null)} onSave={(date, ref) => save({ completionIssuedAt: date, completionRef: ref || undefined, status: "completed" })} />
        ))}
    </>
  );
}

function AddDoc({ onAdd }: { onAdd: (label: string) => void }) {
  const [v, setV] = useState("");
  return (
    <div className="flex gap-2 border-t border-line px-5 py-3">
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder="เพิ่มเอกสารอื่นที่หน่วยงานขอ" className={cx(inputCls, "flex-1")} />
      <Btn small disabled={!v.trim()} onClick={() => (onAdd(v.trim()), setV(""))}>
        <Plus {...I} />
        เพิ่ม
      </Btn>
    </div>
  );
}

function DateModal({ title, label, withText, required, extra, onClose, onSave }: { title: string; label: string; withText?: string; required?: boolean; extra?: React.ReactNode; onClose: () => void; onSave: (date: string, text: string) => void }) {
  const [date, setDate] = useState(TODAY);
  const [text, setText] = useState("");
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      width={480}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!date || (required && !text.trim())} onClick={() => (onSave(date, text.trim()), onClose())}>
            บันทึก
          </Btn>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label={label}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </Field>
        {withText && (
          <Field label={withText}>
            <input value={text} onChange={(e) => setText(e.target.value)} className={inputCls} />
          </Field>
        )}
        {extra}
      </div>
    </Modal>
  );
}

function QueryModal({ p, onClose, onSave }: { p: Permit; onClose: () => void; onSave: (q: Permit["queries"][number]) => void }) {
  const [date, setDate] = useState(TODAY);
  const [officer, setOfficer] = useState(p.officer ?? "");
  const [text, setText] = useState("");
  return (
    <Modal
      open
      onClose={onClose}
      title="บันทึกข้อซักถามจากเจ้าหน้าที่"
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!text.trim()} onClick={() => (onSave({ id: `Q${p.queries.length + 1}`, date, officer: officer.trim() || "เจ้าหน้าที่", text: text.trim() }), onClose())}>
            บันทึก
          </Btn>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="วันที่">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </Field>
        <Field label="เจ้าหน้าที่">
          <input value={officer} onChange={(e) => setOfficer(e.target.value)} className={inputCls} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="สิ่งที่ขอเพิ่ม/ให้แก้ไข">
            <textarea value={text} onChange={(e) => setText(e.target.value)} className={areaCls} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

function InfoModal({ p, onClose }: { p: Permit; onClose: () => void }) {
  const s = useDesignSettings();
  const [v, setV] = useState(p);
  const save = () => {
    const docs = permitChecklist({ route: v.route, use: v.use, height: v.height, floorArea: v.floorArea, units: v.units, ownerIsApplicant: v.ownerIsApplicant }, s, p.docs);
    permits.upsert({ ...v, docs, completionKind: v.completionKind });
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="แก้ไขข้อมูลคำขอ"
      width={640}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary onClick={save}>
            บันทึก
          </Btn>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ช่องทาง">
          <Select label="ช่องทาง" value={v.route} onChange={(route) => setV({ ...v, route: route as PermitRoute })}>
            <option value="permit">{ROUTE_LABEL.permit}</option>
            <option value="m39">{ROUTE_LABEL.m39}</option>
          </Select>
        </Field>
        <Field label="ประเภทหน่วยงาน">
          <Select label="ประเภทหน่วยงาน" value={v.authorityKind} onChange={(k) => setV({ ...v, authorityKind: k as AuthorityKind })}>
            {Object.entries(AUTHORITY_LABEL).map(([k, x]) => (
              <option key={k} value={k}>
                {x}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="ชื่อหน่วยงาน">
          <input value={v.authorityName} onChange={(e) => setV({ ...v, authorityName: e.target.value })} className={inputCls} />
        </Field>
        <Field label="เจ้าหน้าที่">
          <input value={v.officer ?? ""} onChange={(e) => setV({ ...v, officer: e.target.value || undefined })} className={inputCls} />
        </Field>
        <Field label="ประเภทอาคาร">
          <Select label="ประเภทอาคาร" value={v.use} onChange={(u) => setV({ ...v, use: u as BuildingUse, completionKind: completionKindFor(u as BuildingUse) })}>
            {Object.entries(USE_LABEL).map(([k, x]) => (
              <option key={k} value={k}>
                {x}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="หลังก่อสร้างเสร็จ">
          <Select label="หลังก่อสร้างเสร็จ" value={v.completionKind} onChange={(c) => setV({ ...v, completionKind: c as CompletionKind })}>
            {Object.entries(COMPLETION_LABEL).map(([k, x]) => (
              <option key={k} value={k}>
                {x}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="ความสูง (ม.)">
          <NumInput value={v.height} onChange={(height) => setV({ ...v, height })} step={0.1} />
        </Field>
        <Field label="พื้นที่รวม (ตร.ม.)">
          <NumInput value={v.floorArea} onChange={(floorArea) => setV({ ...v, floorArea })} />
        </Field>
        <Field label="จำนวนห้องชุด">
          <NumInput value={v.units ?? 0} onChange={(units) => setV({ ...v, units: units || undefined })} />
        </Field>
        <Field label="ค่าธรรมเนียม (บาท)">
          <NumInput value={v.fee ?? 0} onChange={(fee) => setV({ ...v, fee })} />
        </Field>
        <div className="sm:col-span-2">
          <Check checked={v.ownerIsApplicant} onChange={(ownerIsApplicant) => setV({ ...v, ownerIsApplicant })} label="ผู้ขออนุญาตเป็นเจ้าของที่ดิน" />
        </div>
        <div className="sm:col-span-2">
          <Field label="หมายเหตุ">
            <textarea value={v.note ?? ""} onChange={(e) => setV({ ...v, note: e.target.value || undefined })} className={areaCls} />
          </Field>
        </div>
      </div>
      <p className="mt-2 text-[12px] text-ink-3">รายการเอกสารจะปรับตามช่องทาง ขนาดอาคาร และเกณฑ์ EIA โดยเก็บไฟล์ที่แนบไว้แล้ว</p>
    </Modal>
  );
}
