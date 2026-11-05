"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCheck, FileDiff, Forward, Pencil, Printer, RotateCcw, Send, Trash2 } from "lucide-react";
import { Card, CardHead, cx, inputCls } from "@/components/ui";
import { Btn, Empty, I, KV, Modal, Pill, PrintStyle, useHydrated } from "@/components/ops/bits";
import { MediaField, MediaStrip } from "@/components/media/media-field";
import { getProject, thDate, TODAY } from "@/lib/data";
import { variations } from "@/lib/biz";
import { createVariationFromRfi, DISC_LABEL, msgId, nowIso, PRIORITY_LABEL, RFI_STATUS_LABEL, rfis, type Rfi, type RfiMessage } from "@/lib/engineering";
import type { MediaRef } from "@/lib/media";
import { Area, Back, Check, DocHeader, DocRow, DocSection, Due, PeopleList, Signatures, thDT, useEngPerms } from "./bits";
import { RfiForm } from "./rfi-form";
import { PRIORITY_TONE, RFI_TONE } from "./rfi-view";

export function RfiDetail({ id }: { id: string }) {
  const all = rfis.use();
  const hydrated = useHydrated();
  const r = all.find((x) => x.id === id);
  if (!r)
    return (
      <Card>
        <Empty>{hydrated ? `ไม่พบ ${id}` : "กำลังโหลด"}</Empty>
      </Card>
    );
  return <Body r={r} />;
}

function Body({ r }: { r: Rfi }) {
  const router = useRouter();
  const perms = useEngPerms();
  const p = getProject(r.projectId);
  const vos = variations.use();
  const vo = r.variationId ? vos.find((v) => v.id === r.variationId) : undefined;
  const [editOpen, setEditOpen] = useState(false);
  const [fwdOpen, setFwdOpen] = useState(false);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<MediaRef[]>([]);
  const [official, setOfficial] = useState(false);
  const answer = [...r.thread].reverse().find((m) => m.official);
  const late = r.status === "open" && r.due < TODAY;

  const save = (patch: Partial<Rfi>) => rfis.upsert({ ...r, ...patch });
  const post = () => {
    if (!text.trim()) return;
    const m: RfiMessage = { id: msgId(), at: nowIso(), by: perms.me.name, text: text.trim(), official: official || undefined, attachments: files.length ? files : undefined };
    save({
      thread: [...r.thread, m],
      ...(official ? { status: "answered" as const, answeredAt: TODAY, assignedTo: r.raisedBy } : {}),
    });
    setText("");
    setFiles([]);
    setOfficial(false);
  };
  const close = () => save({ status: "closed", closedAt: TODAY, closedBy: perms.me.name });
  const reopen = () => save({ status: "open", closedAt: undefined, closedBy: undefined });
  const del = () => {
    if (!window.confirm(`ลบ ${r.id}`)) return;
    rfis.remove(r.id);
    router.push("/rfi");
  };
  const makeVo = () => {
    const v = createVariationFromRfi(r, perms.me.name);
    window.alert(`สร้างงานเปลี่ยนแปลง ${v.id} (ร่าง) แล้ว ฝ่ายสัญญาจะประเมินราคาต่อ`);
  };

  return (
    <>
      <PrintStyle />
      <PeopleList />
      <div className="ops-noprint">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-5">
          <div className="flex flex-wrap items-center gap-2">
            <Back href={`/rfi?project=${r.projectId}`} />
            <Pill mono>{r.id}</Pill>
            <Pill tone={late ? "neg" : RFI_TONE[r.status]}>{late ? "เลยกำหนดตอบ" : RFI_STATUS_LABEL[r.status]}</Pill>
            <Pill tone={PRIORITY_TONE[r.priority]}>{PRIORITY_LABEL[r.priority]}</Pill>
            <Pill>{DISC_LABEL[r.disc]}</Pill>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {perms.edit && r.status !== "closed" && (
              <Btn onClick={() => setFwdOpen(true)}>
                <Forward {...I} />
                ส่งต่อ
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
              พิมพ์
            </Btn>
            {perms.approve && (
              <Btn danger onClick={del}>
                <Trash2 {...I} />
              </Btn>
            )}
          </div>
        </div>

        <h1 className="text-[26px] font-normal leading-[1.2]">{r.subject}</h1>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 pb-6 text-[13px] text-ink-2">
          <Link href={`/projects/${r.projectId}`} className="hover:text-ink">
            {p?.name ?? r.projectId} <span className="font-mono text-[12px] text-ink-3">{r.projectId}</span>
          </Link>
          {r.location && <span>{r.location}</span>}
          {r.sheet && <span className="font-mono text-[12px]">แบบ {r.sheet}</span>}
          <span>
            ถามโดย {r.raisedBy} · {thDate(r.raisedAt)}
          </span>
        </p>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
          <div className="flex min-w-0 flex-col gap-4">
            <Card>
              <CardHead title="คำถาม" />
              <div className="px-5 py-4">
                <p className="whitespace-pre-wrap">{r.question}</p>
                {r.proposal && (
                  <div className="mt-3 rounded-[10px] bg-raised px-3 py-2 text-[13px]">
                    <span className="text-ink-3">หน้างานเสนอ </span>
                    {r.proposal}
                  </div>
                )}
                <MediaStrip refs={r.attachments} className="mt-3" />
              </div>
            </Card>

            <Card>
              <CardHead title="การตอบโต้" meta={r.thread.length} />
              {r.thread.length === 0 ? (
                <p className="px-5 py-4 text-[13px] text-ink-3">ยังไม่มีข้อความ รอ {r.assignedTo} ตอบ</p>
              ) : (
                <ol>
                  {r.thread.map((m) => (
                    <li key={m.id} className={cx("border-t border-line px-5 py-3.5 first:border-t-0", m.official && "bg-accent-soft/40")}>
                      <p className="flex flex-wrap items-center gap-2 text-[13px]">
                        <span className="font-medium">{m.by}</span>
                        <span className="num font-mono text-[12px] text-ink-3">{thDT(m.at)}</span>
                        {m.official && <Pill tone="accent">คำตอบอย่างเป็นทางการ</Pill>}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap">{m.text}</p>
                      <MediaStrip refs={m.attachments} className="mt-2" />
                    </li>
                  ))}
                </ol>
              )}
              {perms.edit && r.status !== "closed" && (
                <div className="flex flex-col gap-3 border-t border-line px-5 py-4">
                  <Area value={text} onChange={setText} placeholder="พิมพ์ข้อความ คำตอบ หรือข้อมูลเพิ่มเติม" />
                  <MediaField value={files} onChange={setFiles} label="แนบรูป/แบบขยาย" />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Check checked={official} onChange={setOfficial}>
                      เป็นคำตอบอย่างเป็นทางการ (เปลี่ยนสถานะเป็นตอบแล้ว)
                    </Check>
                    <Btn primary onClick={post} disabled={!text.trim()}>
                      <Send {...I} />
                      ส่งข้อความ
                    </Btn>
                  </div>
                </div>
              )}
            </Card>
          </div>

          <div className="flex flex-col gap-4">
            <Card className="px-5 py-4">
              <p className="text-[13px] text-ink-2">รอใคร (ball in court)</p>
              <p className="mt-1.5 text-[17px]">{r.status === "closed" ? "ปิดแล้ว" : r.assignedTo}</p>
              <div className="mt-3">
                <KV k="กำหนดตอบ">
                  <Due date={r.due} done={r.status !== "open"} />
                </KV>
                <KV k="ตอบเมื่อ">{r.answeredAt ? thDate(r.answeredAt) : "–"}</KV>
                <KV k="ปิดเมื่อ">{r.closedAt ? `${thDate(r.closedAt)} · ${r.closedBy ?? ""}` : "–"}</KV>
                <KV k="ผลกระทบ">{[r.costImpact && "ค่าใช้จ่าย", r.timeImpact && "ระยะเวลา"].filter(Boolean).join(" · ") || "ไม่มี"}</KV>
              </div>
              {perms.edit && (
                <div className="mt-4 flex flex-col gap-2">
                  {r.status === "answered" && (
                    <Btn primary onClick={close}>
                      <CheckCheck {...I} />
                      ยอมรับคำตอบและปิด RFI
                    </Btn>
                  )}
                  {r.status === "open" && r.thread.length > 0 && <Btn onClick={close}>ปิดโดยไม่มีคำตอบทางการ</Btn>}
                  {r.status === "closed" && (
                    <Btn onClick={reopen}>
                      <RotateCcw {...I} />
                      เปิดอีกครั้ง
                    </Btn>
                  )}
                </div>
              )}
            </Card>

            <Card>
              <CardHead title="งานเปลี่ยนแปลง" />
              <div className="px-5 py-4 text-[13px]">
                {r.variationId ? (
                  <>
                    <Link href={`/contracts/variations/${r.variationId}`} className="font-mono text-accent-text hover:underline">
                      {r.variationId}
                    </Link>
                    <p className="mt-1 text-ink-2">{vo ? `${vo.title} · สถานะ ${vo.status}` : "สร้างแล้ว"}</p>
                  </>
                ) : (
                  <>
                    <p className="text-ink-3">{r.costImpact || r.timeImpact ? "RFI นี้อาจกระทบค่าใช้จ่ายหรือเวลา สร้างงานเปลี่ยนแปลง (ร่าง) ให้ฝ่ายสัญญาประเมินราคา" : "สร้างได้เมื่อคำตอบทำให้งานเปลี่ยนจากสัญญา"}</p>
                    {perms.edit && (
                      <div className="mt-3">
                        <Btn small onClick={makeVo}>
                          <FileDiff {...I} />
                          สร้างงานเปลี่ยนแปลงจาก RFI
                        </Btn>
                      </div>
                    )}
                  </>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* printable RFI form */}
      <article className="ops-print hidden bg-white text-ink print:block">
        <DocHeader
          title="ใบขอคำชี้แจงแบบ"
          titleEn="REQUEST FOR INFORMATION"
          code={r.id}
          meta={
            <>
              <p>วันที่ {thDate(r.raisedAt)}</p>
              <p>ต้องการคำตอบภายใน {thDate(r.due)}</p>
            </>
          }
        />
        <DocSection n={1} title="ข้อมูลโครงการ" en="PROJECT">
          <div className="grid grid-cols-2 gap-x-6">
            <DocRow k="โครงการ">
              {r.projectId} · {p?.name}
            </DocRow>
            <DocRow k="เจ้าของ">{p?.owner}</DocRow>
            <DocRow k="ถึง">{r.assignedTo}</DocRow>
            <DocRow k="จาก">{r.raisedBy}</DocRow>
            <DocRow k="หมวดงาน">{DISC_LABEL[r.disc]}</DocRow>
            <DocRow k="แผ่นแบบ">{r.sheet ?? "–"}</DocRow>
            <DocRow k="ตำแหน่ง">{r.location ?? "–"}</DocRow>
            <DocRow k="ความเร่งด่วน">{PRIORITY_LABEL[r.priority]}</DocRow>
          </div>
        </DocSection>
        <DocSection n={2} title="คำถาม" en="QUESTION">
          <p className="text-[13px] font-medium">{r.subject}</p>
          <p className="mt-1 whitespace-pre-wrap text-[13px]">{r.question}</p>
          {r.proposal && <p className="mt-2 text-[13px]">แนวทางที่เสนอ: {r.proposal}</p>}
          <p className="mt-2 text-[12px] text-ink-2">
            ผลกระทบ: ค่าใช้จ่าย {r.costImpact ? "☑ มี" : "☐ ไม่มี"} · ระยะเวลา {r.timeImpact ? "☑ มี" : "☐ ไม่มี"} · แนบไฟล์ {r.attachments.length} รายการ
          </p>
        </DocSection>
        <DocSection n={3} title="คำตอบ" en="RESPONSE">
          {answer ? (
            <>
              <p className="whitespace-pre-wrap text-[13px]">{answer.text}</p>
              <p className="mt-1 text-[12px] text-ink-2">
                โดย {answer.by} · {thDT(answer.at)}
              </p>
            </>
          ) : (
            <div className="h-24 border-b border-dashed border-ink-3" />
          )}
        </DocSection>
        {r.variationId && (
          <p className="mt-3 text-[12px]">
            อ้างอิงงานเปลี่ยนแปลง <span className="font-mono">{r.variationId}</span>
          </p>
        )}
        <Signatures roles={[{ role: "ผู้ขอคำชี้แจง", name: r.raisedBy }, { role: "ผู้ตอบ (ผู้ออกแบบ/ที่ปรึกษา)", name: answer?.by }, { role: "ผู้จัดการโครงการ", name: p?.pm }]} />
      </article>

      <RfiForm open={editOpen} onClose={() => setEditOpen(false)} edit={r} />
      {fwdOpen && <Forward2 onClose={() => setFwdOpen(false)} r={r} by={perms.me.name} />}
    </>
  );
}

/** Pass the ball to someone else (designer, consultant, owner) with an optional new due date */
function Forward2({ onClose, r, by }: { onClose: () => void; r: Rfi; by: string }) {
  const [to, setTo] = useState("");
  const [due, setDue] = useState(r.due);
  const [note, setNote] = useState("");
  const ok = to.trim() && to.trim() !== r.assignedTo;
  const save = () => {
    if (!ok) return;
    const m: RfiMessage = { id: msgId(), at: nowIso(), by, text: `ส่งต่อให้ ${to.trim()}${note.trim() ? ` · ${note.trim()}` : ""}` };
    rfis.upsert({ ...r, assignedTo: to.trim(), due, status: r.status === "answered" ? "open" : r.status, thread: [...r.thread, m] });
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="ส่งต่อ RFI"
      width={480}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary onClick={save} disabled={!ok}>
            ส่งต่อ
          </Btn>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-[13px] text-ink-2">ปัจจุบันรอ {r.assignedTo}</p>
        <label className="flex flex-col gap-1.5 text-[13px] text-ink-2">
          ส่งต่อให้
          <input list="eng-people" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] text-ink-2">
          กำหนดตอบใหม่
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={cx(inputCls, "font-mono")} />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] text-ink-2">
          หมายเหตุ
          <Area value={note} onChange={setNote} rows={2} />
        </label>
      </div>
    </Modal>
  );
}
