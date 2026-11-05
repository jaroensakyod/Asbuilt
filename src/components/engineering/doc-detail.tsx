"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Columns2, MapPin, Plus, RotateCcw, Send, ShieldCheck, Trash2, X } from "lucide-react";
import { Card, CardHead, cx, Field, inputCls } from "@/components/ui";
import { Btn, Empty, I, IconBtn, Modal, Pill, Select, useHydrated } from "@/components/ops/bits";
import { MediaField } from "@/components/media/media-field";
import { thDate, TODAY } from "@/lib/data";
import { controlledDocs, DISC_LABEL, DOC_KIND_LABEL, DOC_STATUS_LABEL, nowIso, WF_LABEL, type ControlledDoc, type DocRevision, type DocStatus, type Pin } from "@/lib/engineering";
import { Area, Back, pname, thDT, useEngPerms } from "./bits";
import { AfcStamp, current, DocStatusPill } from "./doc-control-view";
import { defaultFile, previewables, RevPreview } from "./doc-preview";

const save = (d: ControlledDoc) => controlledDocs.upsert(d);
const patchRev = (d: ControlledDoc, revId: string, patch: Partial<DocRevision>) => save({ ...d, revs: d.revs.map((r) => (r.id === revId ? { ...r, ...patch } : r)) });

/** next revision label: A → B, 0 → 1 */
function nextRevLabel(last?: string) {
  if (!last) return "A";
  if (/^\d+$/.test(last)) return String(Number(last) + 1);
  if (/^[A-Y]$/i.test(last)) return String.fromCharCode(last.toUpperCase().charCodeAt(0) + 1);
  return `${last}.1`;
}

export function DocDetail({ id }: { id: string }) {
  const docs = controlledDocs.use();
  const hydrated = useHydrated();
  const doc = docs.find((d) => d.id === id);
  if (!doc)
    return (
      <Card>
        <Empty>{hydrated ? `ไม่พบเอกสาร ${id}` : "กำลังโหลด"}</Empty>
      </Card>
    );
  return <Body doc={doc} />;
}

function Body({ doc }: { doc: ControlledDoc }) {
  const router = useRouter();
  const perms = useEngPerms();
  const hydrated = useHydrated();
  const cur = current(doc);
  const [revId, setRevId] = useState(cur.id);
  const rev = doc.revs.find((r) => r.id === revId) ?? cur;
  const [fileId, setFileId] = useState<string | undefined>(() => defaultFile(rev));
  const files = previewables(rev);
  const shownFile = files.some((f) => f.id === fileId) ? fileId : defaultFile(rev);
  const [markup, setMarkup] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const pickRev = (r: DocRevision) => {
    setRevId(r.id);
    setFileId(defaultFile(r));
    setMarkup(false);
  };
  const addPin = (x: number, y: number, text: string) => {
    if (!shownFile) return;
    const n = rev.pins.reduce((m, p) => Math.max(m, p.n), 0) + 1;
    const pin: Pin = { id: `PIN-${Date.now().toString(36)}`, n, x, y, text, by: perms.me.name, at: nowIso(), fileId: shownFile };
    patchRev(doc, rev.id, { pins: [...rev.pins, pin] });
  };
  const pins = rev.pins.filter((p) => p.fileId === shownFile);
  const imageLike = shownFile === "sheet" || !!rev.files.find((m) => m.id === shownFile && m.type.startsWith("image/"));

  // workflow
  const submit = (r: DocRevision) => patchRev(doc, r.id, { wf: "submitted", submittedAt: nowIso(), status: r.status === "prelim" ? "approval" : r.status, wfNote: undefined });
  const review = (r: DocRevision) => patchRev(doc, r.id, { wf: "reviewed", reviewedBy: perms.me.name, reviewedAt: nowIso() });
  const approve = (r: DocRevision) => patchRev(doc, r.id, { wf: "approved", approvedBy: perms.me.name, approvedAt: nowIso(), status: r.status === "asbuilt" ? "asbuilt" : "afc" });
  const reject = (r: DocRevision) => {
    patchRev(doc, r.id, { wf: "rejected", wfNote: rejectNote.trim() || undefined, status: r.status === "asbuilt" ? "asbuilt" : "prelim", reviewedBy: perms.me.name, reviewedAt: nowIso() });
    setRejecting(null);
    setRejectNote("");
  };
  const removeDoc = () => {
    if (!window.confirm(`ลบเอกสาร ${doc.number} ออกจากทะเบียน`)) return;
    controlledDocs.remove(doc.id);
    router.push("/doc-control");
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <Back href={`/doc-control?project=${doc.projectId}`} />
          <Pill mono>{doc.number}</Pill>
          <Pill>{DISC_LABEL[doc.disc]}</Pill>
          <Pill>{DOC_KIND_LABEL[doc.kind]}</Pill>
          {cur.status === "afc" ? <AfcStamp small /> : <DocStatusPill s={cur.status} />}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Btn onClick={() => setCompareOpen(true)} disabled={doc.revs.length < 2}>
            <Columns2 {...I} />
            เปรียบเทียบฉบับ
          </Btn>
          {perms.edit && (
            <Btn primary onClick={() => setAddOpen(true)}>
              <Plus {...I} />
              ออกฉบับแก้ไข
            </Btn>
          )}
          {perms.approve && (
            <Btn danger onClick={removeDoc}>
              <Trash2 {...I} />
            </Btn>
          )}
        </div>
      </div>
      <h1 className="text-[26px] font-normal leading-[1.2]">{doc.title}</h1>
      <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 pb-6 text-[13px] text-ink-2">
        <span>
          {pname(doc.projectId)} <span className="font-mono text-[12px] text-ink-3">{doc.projectId}</span>
        </span>
        <span className="font-mono text-[12px]">{doc.id}</span>
        <span>ฉบับปัจจุบัน Rev.{cur.rev}</span>
        <span>{doc.revs.length} ฉบับ</span>
      </p>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_380px]">
        <Card>
          <CardHead
            title={`Rev.${rev.rev} · ${DOC_STATUS_LABEL[rev.status]}`}
            meta={thDate(rev.date)}
            action={
              imageLike && perms.edit ? (
                <Btn small primary={markup} onClick={() => setMarkup((m) => !m)}>
                  <MapPin {...I} />
                  {markup ? "เลิกปักหมุด" : "ปักหมุดความเห็น"}
                </Btn>
              ) : undefined
            }
          />
          <div className="px-5 py-4">
            {files.length > 1 && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {files.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFileId(f.id)}
                    className={cx("h-7 max-w-[240px] truncate rounded-[6px] border px-2 text-[12px] transition-colors duration-150", f.id === shownFile ? "border-ink-3 bg-raised text-ink" : "border-line text-ink-2 hover:bg-raised")}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
            <div className="relative">
              {rev.status === "superseded" && (
                <span className="pointer-events-none absolute left-3 top-3 z-10 rounded-[4px] border-2 border-neg bg-card/90 px-2 py-0.5 text-[13px] font-medium text-neg">ยกเลิก ห้ามใช้ก่อสร้าง</span>
              )}
              {rev.status === "afc" && (
                <span className="pointer-events-none absolute right-3 top-3 z-10">
                  <AfcStamp />
                </span>
              )}
              <RevPreview key={`${rev.id}-${shownFile}`} rev={rev} fileId={shownFile} pins={rev.pins} markup={markup} onAddPin={addPin} />
            </div>
            {markup && <p className="mt-2 text-[12px] text-ink-3">คลิกบนแบบเพื่อวางหมุด แล้วพิมพ์ความเห็น ตำแหน่งเก็บเป็นเปอร์เซ็นต์ของภาพ</p>}
            {rev.note && <p className="mt-3 text-[13px] text-ink-2">หมายเหตุฉบับนี้ {rev.note}</p>}
            {perms.edit && (
              <div className="mt-4 border-t border-line pt-3">
                <MediaField value={rev.files} onChange={(next) => patchRev(doc, rev.id, { files: next })} label="ไฟล์ของฉบับนี้ (PDF, DXF, รูป, IFC)" accept="image/*,application/pdf,.dxf,.dwg,.ifc" geotag={false} />
              </div>
            )}
          </div>
          <div className="border-t border-line">
            <p className="px-5 pb-1 pt-3 text-[13px] text-ink-2">
              หมุดความเห็น <span className="font-mono text-[12px] text-ink-3">{pins.length}</span>
            </p>
            {pins.length === 0 ? (
              <p className="px-5 pb-4 text-[13px] text-ink-3">{imageLike ? "ยังไม่มีหมุดบนไฟล์นี้" : "ปักหมุดได้บนไฟล์รูปหรือแบบจากระบบ"}</p>
            ) : (
              <ul className="pb-2">
                {pins.map((p) => (
                  <li key={p.id} className="flex items-start gap-3 px-5 py-2">
                    <span className={cx("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full font-mono text-[11px] text-card", p.resolved ? "bg-ink-3" : "bg-accent")}>{p.n}</span>
                    <div className="min-w-0 flex-1">
                      <p className={cx("text-[13px]", p.resolved && "text-ink-3 line-through")}>{p.text}</p>
                      <p className="text-[12px] text-ink-3">
                        {p.by} · {hydrated ? thDT(p.at) : thDate(p.at.slice(0, 10))}
                      </p>
                    </div>
                    {perms.edit && (
                      <>
                        <IconBtn label={p.resolved ? "เปิดหมุดอีกครั้ง" : "แก้ไขแล้ว"} onClick={() => patchRev(doc, rev.id, { pins: rev.pins.map((x) => (x.id === p.id ? { ...x, resolved: !x.resolved } : x)) })}>
                          {p.resolved ? <RotateCcw {...I} /> : <Check {...I} />}
                        </IconBtn>
                        <IconBtn label="ลบหมุด" danger onClick={() => patchRev(doc, rev.id, { pins: rev.pins.filter((x) => x.id !== p.id) })}>
                          <Trash2 {...I} />
                        </IconBtn>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <CardHead title="ประวัติฉบับแก้ไข" meta={doc.revs.length} />
          <ol>
            {[...doc.revs].reverse().map((r) => (
              <li key={r.id} className={cx("border-t border-line px-5 py-3.5 first:border-t-0", r.id === rev.id && "bg-raised/60")}>
                <button type="button" onClick={() => pickRev(r)} className="block w-full text-left">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[14px]">Rev.{r.rev}</span>
                    {r.status === "afc" ? <AfcStamp small /> : <DocStatusPill s={r.status} />}
                    <span className="num ml-auto font-mono text-[12px] text-ink-3">{thDate(r.date)}</span>
                  </span>
                  {r.note && <span className="mt-1 block text-[13px] text-ink-2">{r.note}</span>}
                  <span className="mt-1 block text-[12px] text-ink-3">
                    {r.by} · {r.files.length} ไฟล์{r.sheetRef ? " · แบบจากระบบ" : ""}
                    {r.pins.length > 0 && ` · หมุด ${r.pins.length}`}
                  </span>
                </button>
                <div className="mt-2 rounded-[8px] border border-line bg-card px-3 py-2 text-[12px] text-ink-2">
                  <p className="flex items-center justify-between gap-2">
                    <span>การอนุมัติ</span>
                    <span className={cx(r.wf === "approved" ? "text-pos" : r.wf === "rejected" ? "text-neg" : r.wf === "draft" ? "text-ink-3" : "text-warn")}>{WF_LABEL[r.wf]}</span>
                  </p>
                  {r.submittedAt && <p className="text-ink-3">ส่งตรวจ {hydrated ? thDT(r.submittedAt) : thDate(r.submittedAt.slice(0, 10))}</p>}
                  {r.reviewedBy && r.reviewedAt && (
                    <p className="text-ink-3">
                      ตรวจโดย {r.reviewedBy} · {hydrated ? thDT(r.reviewedAt) : thDate(r.reviewedAt.slice(0, 10))}
                    </p>
                  )}
                  {r.approvedBy && r.approvedAt && (
                    <p className="text-ink-3">
                      อนุมัติโดย {r.approvedBy} · {hydrated ? thDT(r.approvedAt) : thDate(r.approvedAt.slice(0, 10))}
                    </p>
                  )}
                  {r.wfNote && <p className="text-neg">เหตุผลที่ตีกลับ {r.wfNote}</p>}
                  {r.status !== "superseded" && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(r.wf === "draft" || r.wf === "rejected") && perms.edit && (
                        <Btn small onClick={() => submit(r)}>
                          <Send {...I} />
                          ส่งตรวจ
                        </Btn>
                      )}
                      {r.wf === "submitted" && perms.edit && (
                        <Btn small onClick={() => review(r)}>
                          <Check {...I} />
                          ตรวจแล้ว
                        </Btn>
                      )}
                      {r.wf === "reviewed" && perms.approve && (
                        <Btn small primary onClick={() => approve(r)}>
                          <ShieldCheck {...I} />
                          อนุมัติ
                        </Btn>
                      )}
                      {(r.wf === "submitted" || r.wf === "reviewed") && (perms.approve || (r.wf === "submitted" && perms.edit)) && (
                        <Btn small danger onClick={() => (setRejecting(r.id), setRejectNote(""))}>
                          <X {...I} />
                          ตีกลับ
                        </Btn>
                      )}
                      {r.wf === "reviewed" && !perms.approve && <span className="text-ink-3">รอผู้มีสิทธิ์อนุมัติ</span>}
                    </div>
                  )}
                  {rejecting === r.id && (
                    <div className="mt-2 flex flex-col gap-2">
                      <Area value={rejectNote} onChange={setRejectNote} rows={2} placeholder="เหตุผล / สิ่งที่ต้องแก้ไข" />
                      <div className="flex justify-end gap-2">
                        <Btn small onClick={() => setRejecting(null)}>
                          ยกเลิก
                        </Btn>
                        <Btn small danger onClick={() => reject(r)}>
                          ยืนยันตีกลับ
                        </Btn>
                      </div>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      {addOpen && <AddRevModal doc={doc} onClose={() => setAddOpen(false)} onAdded={(r) => pickRev(r)} />}
      {compareOpen && <CompareModal doc={doc} onClose={() => setCompareOpen(false)} />}
    </>
  );
}

function AddRevModal({ doc, onClose, onAdded }: { doc: ControlledDoc; onClose: () => void; onAdded: (r: DocRevision) => void }) {
  const { me } = useEngPerms();
  const last = current(doc);
  const [rev, setRev] = useState(nextRevLabel(last?.rev));
  const [status, setStatus] = useState<DocStatus>(last?.status === "asbuilt" ? "asbuilt" : "approval");
  const [date, setDate] = useState(TODAY);
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<DocRevision["files"]>([]);
  const dup = doc.revs.some((r) => r.rev === rev.trim());
  const ok = rev.trim() && !dup;
  const add = () => {
    if (!ok) return;
    const r: DocRevision = {
      id: `${doc.number}-${rev.trim()}-${Date.now().toString(36)}`,
      rev: rev.trim(),
      date,
      status,
      note: note.trim() || undefined,
      by: me.name,
      files,
      sheetRef: last?.sheetRef,
      wf: "draft",
      pins: [],
    };
    save({ ...doc, revs: [...doc.revs.map((x) => (x.status === "superseded" ? x : { ...x, status: "superseded" as const })), r] });
    onAdded(r);
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`ออกฉบับแก้ไข · ${doc.number}`}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!ok} onClick={add}>
            บันทึกฉบับใหม่
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="ฉบับ (Rev.)">
          <input value={rev} onChange={(e) => setRev(e.target.value)} className={cx(inputCls, "font-mono", dup && "border-neg")} />
        </Field>
        <Field label="สถานะ">
          <Select label="สถานะ" value={status} onChange={(v) => setStatus(v as DocStatus)}>
            {(["prelim", "approval", "asbuilt"] as DocStatus[]).map((k) => (
              <option key={k} value={k}>
                {DOC_STATUS_LABEL[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="วันที่">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={cx(inputCls, "font-mono")} />
        </Field>
        <div className="sm:col-span-3">
          <Field label="รายละเอียดการแก้ไข">
            <Area value={note} onChange={setNote} rows={2} placeholder="แก้ไขตาม RFI-… / ตามความเห็นผู้ควบคุมงาน" />
          </Field>
        </div>
        <div className="sm:col-span-3">
          <MediaField value={files} onChange={setFiles} label="ไฟล์แบบ (PDF, DXF, รูป, IFC)" accept="image/*,application/pdf,.dxf,.dwg,.ifc" geotag={false} />
        </div>
      </div>
      {dup && <p className="mt-2 text-[12px] text-neg">มีฉบับ Rev.{rev} อยู่แล้ว</p>}
      <p className="mt-3 text-[12px] text-ink-3">ฉบับก่อนหน้าทั้งหมดจะเปลี่ยนเป็น “ยกเลิก (มีฉบับใหม่)” ฉบับใหม่ต้องผ่านการอนุมัติก่อนใช้ก่อสร้าง</p>
    </Modal>
  );
}

function CompareModal({ doc, onClose }: { doc: ControlledDoc; onClose: () => void }) {
  const n = doc.revs.length;
  const [a, setA] = useState(doc.revs[n - 2]?.id ?? doc.revs[0].id);
  const [b, setB] = useState(doc.revs[n - 1].id);
  const ra = doc.revs.find((r) => r.id === a)!;
  const rb = doc.revs.find((r) => r.id === b)!;
  const side = (r: DocRevision, value: string, set: (v: string) => void, label: string) => (
    <div className="min-w-0">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[13px] text-ink-3">{label}</span>
        <Select label={label} value={value} onChange={set} className="h-8 text-[13px]">
          {doc.revs.map((x) => (
            <option key={x.id} value={x.id}>
              Rev.{x.rev} · {DOC_STATUS_LABEL[x.status]} · {thDate(x.date)}
            </option>
          ))}
        </Select>
      </div>
      <RevPreview key={`${r.id}-cmp`} rev={r} fileId={defaultFile(r)} pins={r.pins} height={440} />
      <p className="mt-2 text-[12px] text-ink-3">
        {r.by}
        {r.note ? ` · ${r.note}` : ""}
      </p>
      {r.files.length > 0 && <p className="text-[12px] text-ink-3">ไฟล์ {r.files.map((f) => f.name).join(", ")}</p>}
    </div>
  );
  return (
    <Modal open onClose={onClose} width={1160} title={`เปรียบเทียบฉบับ · ${doc.number}`}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {side(ra, a, setA, "ฉบับเดิม")}
        {side(rb, b, setB, "ฉบับใหม่")}
      </div>
    </Modal>
  );
}
