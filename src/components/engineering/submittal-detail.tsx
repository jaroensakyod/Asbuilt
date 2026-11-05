"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Printer, RefreshCw, Stamp, Trash2 } from "lucide-react";
import { Card, CardHead, cx, Field, inputCls } from "@/components/ui";
import { Btn, Empty, I, KV, Modal, Pill, PrintStyle, useHydrated } from "@/components/ops/bits";
import { MediaField, MediaStrip } from "@/components/media/media-field";
import { getProject, thDate, TODAY } from "@/lib/data";
import { subcontractors } from "@/lib/biz";
import { addDays, DISC_LABEL, latestRev, REVIEW_CODE_LABEL, SUBMITTAL_STATE_LABEL, SUBMITTAL_TYPE_LABEL, submittals, submittalState, type ReviewCode, type Submittal } from "@/lib/engineering";
import type { MediaRef } from "@/lib/media";
import { Area, Back, DocHeader, DocRow, DocSection, Due, Signatures, useEngPerms } from "./bits";
import { CODE_TONE, STATE_TONE, SubmittalForm } from "./submittals-view";

const CODES: ReviewCode[] = ["A", "B", "C", "D"];
const CODE_HINT: Record<ReviewCode, string> = { A: "ใช้ได้ตามที่เสนอ", B: "ใช้ได้ แก้ไขตามความเห็น ไม่ต้องส่งใหม่", C: "ต้องแก้ไขและส่งใหม่ก่อนใช้", D: "ใช้ไม่ได้ เสนอรายการใหม่" };

export function SubmittalDetail({ id }: { id: string }) {
  const all = submittals.use();
  const hydrated = useHydrated();
  const s = all.find((x) => x.id === id);
  if (!s)
    return (
      <Card>
        <Empty>{hydrated ? `ไม่พบ ${id}` : "กำลังโหลด"}</Empty>
      </Card>
    );
  return <Body key={`${s.id}-${s.revs.length}`} s={s} />;
}

function Body({ s }: { s: Submittal }) {
  const router = useRouter();
  const perms = useEngPerms();
  const subs = subcontractors.use();
  const p = getProject(s.projectId);
  const r = latestRev(s);
  const state = submittalState(s, TODAY);
  const [code, setCode] = useState<ReviewCode | "">("");
  const [comments, setComments] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [resubOpen, setResubOpen] = useState(false);
  const canReview = perms.approve || perms.me.name === s.reviewer || s.reviewer.includes(perms.me.name);
  const sub = s.subcontractorId ? subs.find((x) => x.id === s.subcontractorId) : undefined;

  const review = () => {
    if (!code) return;
    const revs = s.revs.map((x, i) => (i === s.revs.length - 1 ? { ...x, code, comments: comments.trim() || undefined, reviewedAt: TODAY, reviewedBy: perms.me.name } : x));
    submittals.upsert({ ...s, revs });
    setCode("");
    setComments("");
  };
  const del = () => {
    if (!window.confirm(`ลบ ${s.id}`)) return;
    submittals.remove(s.id);
    router.push("/submittals");
  };

  return (
    <>
      <PrintStyle />
      <div className="ops-noprint">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-5">
          <div className="flex flex-wrap items-center gap-2">
            <Back href={`/submittals?project=${s.projectId}`} />
            <Pill mono>{s.id}</Pill>
            <Pill mono>Rev.{r.rev}</Pill>
            <Pill tone={STATE_TONE[state]}>{SUBMITTAL_STATE_LABEL[state]}</Pill>
            <Pill>{SUBMITTAL_TYPE_LABEL[s.type]}</Pill>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {perms.edit && (state === "resubmit" || state === "rejected" || state === "approvedNotes") && (
              <Btn primary onClick={() => setResubOpen(true)}>
                <RefreshCw {...I} />
                ส่งใหม่ Rev.{r.rev + 1}
              </Btn>
            )}
            {perms.edit && (
              <Btn onClick={() => setEditOpen(true)}>
                <Pencil {...I} />
                แก้ไข
              </Btn>
            )}
            <Btn onClick={() => window.print()}>
              <Printer {...I} />
              พิมพ์ใบส่งอนุมัติ
            </Btn>
            {perms.approve && (
              <Btn danger onClick={del}>
                <Trash2 {...I} />
              </Btn>
            )}
          </div>
        </div>

        <h1 className="text-[26px] font-normal leading-[1.2]">{s.title}</h1>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 pb-6 text-[13px] text-ink-2">
          <Link href={`/projects/${s.projectId}`} className="hover:text-ink">
            {p?.name ?? s.projectId} <span className="font-mono text-[12px] text-ink-3">{s.projectId}</span>
          </Link>
          <span>{s.specSection}</span>
          {s.supplier && <span>ผู้ขาย {s.supplier}</span>}
          {sub && <span>ผู้รับเหมาช่วง {sub.name}</span>}
        </p>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
          <div className="flex min-w-0 flex-col gap-4">
            <Card>
              <CardHead title={`ฉบับปัจจุบัน Rev.${r.rev}`} meta={thDate(r.submittedAt)} />
              <div className="px-5 py-4">
                {r.note && <p className="whitespace-pre-wrap">{r.note}</p>}
                {r.attachments.length ? <MediaStrip refs={r.attachments} className="mt-3" /> : <p className="text-[13px] text-ink-3">ไม่มีไฟล์แนบใน Rev. นี้</p>}
                {r.code && (
                  <div className="mt-4 rounded-[10px] border border-line px-4 py-3">
                    <p className="flex items-center gap-2">
                      <Pill tone={CODE_TONE[r.code]}>
                        {r.code} · {REVIEW_CODE_LABEL[r.code]}
                      </Pill>
                      <span className="text-[13px] text-ink-3">
                        {r.reviewedBy} · {r.reviewedAt && thDate(r.reviewedAt)}
                      </span>
                    </p>
                    {r.comments && <p className="mt-2 whitespace-pre-wrap text-[14px]">{r.comments}</p>}
                  </div>
                )}
              </div>
              {!r.code && (
                <div className="border-t border-line px-5 py-4">
                  {canReview ? (
                    <div className="flex flex-col gap-3">
                      <p className="text-[13px] text-ink-2">ผลการพิจารณา</p>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {CODES.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setCode(c)}
                            aria-pressed={code === c}
                            className={cx("rounded-[10px] border px-3 py-2 text-left transition-colors duration-150", code === c ? "border-ink-3 bg-raised" : "border-line hover:border-line-strong")}
                          >
                            <span className="flex items-center gap-2 text-[14px]">
                              <span className="font-mono">{c}</span>
                              {REVIEW_CODE_LABEL[c]}
                            </span>
                            <span className="block text-[12px] text-ink-3">{CODE_HINT[c]}</span>
                          </button>
                        ))}
                      </div>
                      <Area value={comments} onChange={setComments} placeholder="ความเห็นผู้พิจารณา" />
                      <div className="flex justify-end">
                        <Btn primary onClick={review} disabled={!code || ((code === "B" || code === "C" || code === "D") && !comments.trim())}>
                          <Stamp {...I} />
                          บันทึกผลพิจารณา
                        </Btn>
                      </div>
                      {code && code !== "A" && !comments.trim() && <p className="text-right text-[12px] text-ink-3">รหัส {code} ต้องระบุความเห็น</p>}
                    </div>
                  ) : (
                    <p className="text-[13px] text-ink-3">รอ {s.reviewer} พิจารณา</p>
                  )}
                </div>
              )}
            </Card>

            <Card>
              <CardHead title="ประวัติการส่ง" meta={`${s.revs.length} Rev.`} />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-[13px]">
                  <thead>
                    <tr className="text-ink-3">
                      <th className="px-5 py-2 font-normal">Rev.</th>
                      <th className="px-3 py-2 font-normal">ส่ง</th>
                      <th className="px-3 py-2 font-normal">กำหนด</th>
                      <th className="px-3 py-2 font-normal">พิจารณา</th>
                      <th className="px-3 py-2 font-normal">รหัส</th>
                      <th className="px-3 py-2 pr-5 font-normal">ความเห็น · ไฟล์</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...s.revs].reverse().map((x) => (
                      <tr key={x.rev} className="border-t border-line align-top">
                        <td className="px-5 py-2.5 font-mono">{x.rev}</td>
                        <td className="num px-3 py-2.5 font-mono text-[12px]">
                          {thDate(x.submittedAt)}
                          <span className="block font-sans text-ink-3">{x.submittedBy}</span>
                        </td>
                        <td className="num px-3 py-2.5 font-mono text-[12px]">{thDate(x.due)}</td>
                        <td className="num px-3 py-2.5 font-mono text-[12px]">{x.reviewedAt ? thDate(x.reviewedAt) : "–"}</td>
                        <td className="px-3 py-2.5">{x.code ? <Pill tone={CODE_TONE[x.code]}>{x.code}</Pill> : <span className="text-ink-3">รอ</span>}</td>
                        <td className="px-3 py-2.5 pr-5 text-ink-2">
                          {x.comments ?? x.note ?? ""}
                          <MediaStrip refs={x.attachments} size={40} className="mt-1.5" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          <Card className="self-start px-5 py-4">
            <KV k="ประเภท">{SUBMITTAL_TYPE_LABEL[s.type]}</KV>
            <KV k="หมวดงาน">{DISC_LABEL[s.disc]}</KV>
            <KV k="หมวดสเปก">{s.specSection}</KV>
            <KV k="ผู้พิจารณา">{s.reviewer}</KV>
            <KV k="ส่งโดย">{r.submittedBy}</KV>
            <KV k="กำหนดพิจารณา">
              <Due date={r.due} done={!!r.code} />
            </KV>
            <p className="mt-3 text-[12px] text-ink-3">A อนุมัติ · B อนุมัติตามแก้ไข · C แก้ไขส่งใหม่ · D ไม่อนุมัติ</p>
          </Card>
        </div>
      </div>

      {/* printable submittal */}
      <article className="ops-print hidden bg-white text-ink print:block">
        <DocHeader
          title="ใบขออนุมัติวัสดุ/แบบ"
          titleEn="SUBMITTAL"
          code={`${s.id} Rev.${r.rev}`}
          meta={
            <>
              <p>วันที่ส่ง {thDate(r.submittedAt)}</p>
              <p>กำหนดพิจารณา {thDate(r.due)}</p>
            </>
          }
        />
        <DocSection n={1} title="รายละเอียด" en="DETAILS">
          <div className="grid grid-cols-2 gap-x-6">
            <DocRow k="โครงการ">
              {s.projectId} · {p?.name}
            </DocRow>
            <DocRow k="เจ้าของ">{p?.owner}</DocRow>
            <DocRow k="รายการ">{s.title}</DocRow>
            <DocRow k="ประเภท">{SUBMITTAL_TYPE_LABEL[s.type]}</DocRow>
            <DocRow k="หมวดสเปก">{s.specSection}</DocRow>
            <DocRow k="ผู้ขาย/ผู้ผลิต">{s.supplier ?? "–"}</DocRow>
            <DocRow k="ผู้พิจารณา">{s.reviewer}</DocRow>
            <DocRow k="ไฟล์แนบ">{r.attachments.length ? r.attachments.map((a) => a.name).join(", ") : "–"}</DocRow>
          </div>
          {r.note && <p className="mt-2 text-[13px]">{r.note}</p>}
        </DocSection>
        <DocSection n={2} title="ผลการพิจารณา" en="REVIEW">
          <div className="grid grid-cols-2 gap-2 text-[13px]">
            {CODES.map((c) => (
              <p key={c}>
                {r.code === c ? "☑" : "☐"} {c} {REVIEW_CODE_LABEL[c]}
              </p>
            ))}
          </div>
          <p className="mt-2 min-h-16 whitespace-pre-wrap border-b border-dashed border-ink-3 pb-2 text-[13px]">{r.comments ?? ""}</p>
        </DocSection>
        {s.revs.length > 1 && (
          <DocSection n={3} title="ประวัติการส่ง" en="REVISIONS">
            {s.revs.map((x) => (
              <DocRow key={x.rev} k={`Rev.${x.rev}`}>
                ส่ง {thDate(x.submittedAt)} · {x.code ? `${x.code} ${REVIEW_CODE_LABEL[x.code]}` : "รอพิจารณา"} {x.comments ? `· ${x.comments}` : ""}
              </DocRow>
            ))}
          </DocSection>
        )}
        <Signatures roles={[{ role: "ผู้ส่ง", name: r.submittedBy }, { role: "ผู้พิจารณา", name: r.reviewedBy ?? s.reviewer }, { role: "ผู้จัดการโครงการ", name: p?.pm }]} />
      </article>

      {editOpen && <SubmittalForm onClose={() => setEditOpen(false)} edit={s} />}
      {resubOpen && <Resubmit s={s} by={perms.me.name} onClose={() => setResubOpen(false)} />}
    </>
  );
}

function Resubmit({ s, by, onClose }: { s: Submittal; by: string; onClose: () => void }) {
  const last = latestRev(s);
  const [note, setNote] = useState("");
  const [due, setDue] = useState(addDays(TODAY, 7));
  const [files, setFiles] = useState<MediaRef[]>([]);
  const save = () => {
    submittals.upsert({ ...s, revs: [...s.revs, { rev: last.rev + 1, submittedAt: TODAY, submittedBy: by, due, note: note.trim() || undefined, attachments: files }] });
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`ส่งใหม่ ${s.id} Rev.${last.rev + 1}`}
      width={600}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary onClick={save} disabled={!note.trim()}>
            ส่ง Rev.{last.rev + 1}
          </Btn>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {last.comments && (
          <p className="rounded-[10px] bg-raised px-3 py-2 text-[13px]">
            <span className="text-ink-3">ความเห็น Rev.{last.rev}: </span>
            {last.comments}
          </p>
        )}
        <Field label="สิ่งที่แก้ไข">
          <Area value={note} onChange={setNote} placeholder="อธิบายการแก้ไขตามความเห็น" />
        </Field>
        <Field label="กำหนดพิจารณา">
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={cx(inputCls, "font-mono")} />
        </Field>
        <MediaField value={files} onChange={setFiles} label="ไฟล์ฉบับแก้ไข" />
      </div>
    </Modal>
  );
}
