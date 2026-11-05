"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check as CheckIcon, MessageSquare, Pencil, Plus, Send, Stamp, Undo2 } from "lucide-react";
import { Card, CardHead, cx, Field, inputCls } from "@/components/ui";
import { Btn, Empty, I, KV, Meter, Modal, Pill, Select, StatCard, areaCls } from "@/components/ops/bits";
import { MediaField, MediaStrip } from "@/components/media/media-field";
import { ProjectMessages } from "@/components/portal/project-messages";
import { TODAY, getProject } from "@/lib/data";
import { installments } from "@/lib/biz";
import { portalTokenFor } from "@/lib/portal";
import {
  ENGINEERS,
  ARCHITECTS,
  FEE_STATUS_LABEL,
  STAGE_EN,
  STAGE_KEYS,
  STAGE_LABEL,
  addStageComment,
  approveStage,
  designJobs,
  designStages,
  designState,
  feeStateOf,
  isStageLate,
  linkFeeInstallment,
  permits,
  reconcileFeeInstallments,
  requestStageChanges,
  stageProgress,
  submitStage,
  useDesignSettings,
  waitingDays,
  type DesignStage,
  type FeeStatus,
  type StageKey,
} from "@/lib/design";
import { Amt, Check, Header, NumInput, PermitPill, StagePill, dateOr, usePerms } from "./bits";

const FEE_TONE: Record<FeeStatus, "neutral" | "accent" | "warn" | "pos"> = { in_contract: "neutral", pending: "neutral", ready: "warn", invoiced: "accent", paid: "pos" };

export function DesignProjectView({ projectId }: { projectId: string }) {
  const { edit, me } = usePerms("design");
  const p = getProject(projectId);
  const jobs = designJobs.use();
  const all = designStages.use();
  const inst = installments.use();
  const pmts = permits.use();
  const settings = useDesignSettings();
  const job = jobs.find((j) => j.projectId === projectId);
  const stages = useMemo(() => all.filter((s) => s.projectId === projectId).sort((a, b) => STAGE_KEYS.indexOf(a.key) - STAGE_KEYS.indexOf(b.key)), [all, projectId]);
  const st = designState(stages, settings.feePct);
  const [sel, setSel] = useState<StageKey | null>(null);
  const current = stages.find((s) => s.key === (sel ?? st.current?.key ?? "permit"));
  const permit = pmts.find((x) => x.projectId === projectId);

  // live mode: approvals made in the portal only flag the stage; create the missing fee installments here
  useEffect(() => {
    if (edit) reconcileFeeInstallments();
  }, [edit, all]);

  if (!job)
    return (
      <Card>
        <Empty>
          โครงการ {projectId} ยังไม่มีงานออกแบบ ·{" "}
          <Link href="/design-stages" className="text-ink underline-offset-2 hover:underline">
            ไปที่ขั้นตอนออกแบบเพื่อเริ่มงาน
          </Link>
        </Empty>
      </Card>
    );

  const billed = stages.filter((s) => ["invoiced", "paid"].includes(feeStateOf(s, inst))).reduce((t, s) => t + s.fee, 0);
  return (
    <>
      <Header
        eyebrow={`ขั้นตอนออกแบบ · ${projectId}`}
        title={p?.name ?? projectId}
        sub={`${p?.owner ?? ""} · ${p?.model ?? ""} · สถาปนิก ${job.leadArchitect} · ${job.note ?? ""}`}
        actions={
          <>
            <Link href={`/permits/${projectId}`} className="inline-flex h-9 items-center gap-2 rounded-[8px] border border-line-strong bg-card px-4 text-[14px] font-medium hover:bg-raised">
              <Stamp {...I} />
              ใบอนุญาต
            </Link>
            <a href={`/portal/${portalTokenFor(projectId)}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-[8px] border border-line-strong bg-card px-4 text-[14px] font-medium hover:bg-raised">
              <ArrowUpRight {...I} />
              มุมมองลูกค้า
            </a>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="ความคืบหน้างานออกแบบ" value={st.pct} unit="%" extra={<Meter value={st.pct} />} />
        <StatCard label="ลูกค้าอนุมัติแล้ว" value={`${st.approved}/${st.total}`} unit="ขั้นตอน" note={st.current ? `ขั้นปัจจุบัน: ${STAGE_LABEL[st.current.key]}` : "ครบทุกขั้นตอน"} />
        <StatCard label="ลูกค้าขอแก้ไขแบบ" value={st.revisions} unit="ครั้ง" note="รวมทุกขั้นตอน" />
        <StatCard label="ค่าออกแบบ" value={job.feeTotal ? <Amt n={job.feeTotal} /> : "รวมในสัญญา"} note={job.feeTotal ? `เรียกเก็บแล้ว ${Math.round((billed / job.feeTotal) * 100)}%` : "ไม่มีงวดแยก"} />
      </div>

      <ol className="mb-4 grid grid-cols-5 gap-2">
        {stages.map((s, i) => {
          const on = current?.key === s.key;
          const prog = stageProgress(s);
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setSel(s.key)}
                aria-pressed={on}
                className={cx("flex h-full w-full flex-col gap-1.5 rounded-[12px] border bg-card px-3 py-2.5 text-left transition-colors duration-150", on ? "border-ink-3" : "border-line hover:border-line-strong")}
              >
                <span className="flex items-center justify-between gap-2 text-[12px] text-ink-3">
                  <span className="num font-mono">{i + 1}</span>
                  <span className="hidden truncate sm:inline">{STAGE_EN[s.key]}</span>
                </span>
                <span className="text-[14px]">{STAGE_LABEL[s.key]}</span>
                <Meter value={prog.pct} />
                <span className="hidden sm:block">
                  <StagePill s={s.status} />
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="grid gap-4 xl:grid-cols-[1fr_400px]">
        {current ? <StagePanel s={current} owner={p?.owner ?? "ลูกค้า"} me={me.name} edit={edit} permitStatus={permit?.status} /> : <Card><Empty>ไม่มีขั้นตอน</Empty></Card>}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHead title="ทีมออกแบบ" />
            <div className="px-5 py-3">
              <KV k="สถาปนิก">{job.leadArchitect}</KV>
              <KV k="วิศวกรโครงสร้าง">{job.structural}</KV>
              <KV k="วิศวกรงานระบบ">{job.mep}</KV>
              <KV k="เริ่มออกแบบ">{dateOr(job.start)}</KV>
              {permit && (
                <KV k="ใบอนุญาต">
                  <Link href={`/permits/${projectId}`} className="hover:underline">
                    <PermitPill s={permit.status} />
                  </Link>
                </KV>
              )}
            </div>
          </Card>
          <div id="messages">
            <ProjectMessages projectId={projectId} />
          </div>
        </div>
      </div>
    </>
  );
}

function StagePanel({ s, owner, me, edit, permitStatus }: { s: DesignStage; owner: string; me: string; edit: boolean; permitStatus?: string }) {
  const inst = installments.use();
  const settings = useDesignSettings();
  const [modal, setModal] = useState<null | "submit" | "approve" | "changes" | "comment" | "edit">(null);
  const [newItem, setNewItem] = useState("");
  const prog = stageProgress(s);
  const locked = s.status === "approved";
  const wait = waitingDays(s, TODAY);
  const fee = feeStateOf(s, inst);
  const reviews = [...s.reviews].sort((a, b) => b.at.localeCompare(a.at));

  const toggle = (id: string) => designStages.upsert({ ...s, deliverables: s.deliverables.map((d) => (d.id === id ? { ...d, done: !d.done } : d)), status: s.status === "not_started" ? "in_progress" : s.status, start: s.start ?? TODAY });
  const addItem = () => {
    if (!newItem.trim()) return;
    designStages.upsert({ ...s, deliverables: [...s.deliverables, { id: `x-${Date.now().toString(36)}`, text: newItem.trim(), done: false }] });
    setNewItem("");
  };

  return (
    <Card>
      <CardHead
        title={`ขั้น${STAGE_LABEL[s.key]}`}
        meta={STAGE_EN[s.key]}
        action={
          <div className="flex items-center gap-2">
            <StagePill s={s.status} />
            {edit && (
              <Btn small onClick={() => setModal("edit")}>
                <Pencil {...I} />
                แก้ไข
              </Btn>
            )}
          </div>
        }
      />
      <div className="grid gap-x-6 px-5 py-3 sm:grid-cols-2">
        <KV k="เริ่ม">{dateOr(s.start)}</KV>
        <KV k="กำหนดส่ง">
          <span className={cx(isStageLate(s, TODAY) && "text-neg")}>{dateOr(s.due)}</span>
          {isStageLate(s, TODAY) && <span className="ml-2 text-[12px] text-neg">เลยกำหนด</span>}
        </KV>
        <KV k="สถาปนิก">{s.architect}</KV>
        <KV k="วิศวกร">{s.engineers.length ? s.engineers.join(", ") : "–"}</KV>
        <KV k="ส่งลูกค้าล่าสุด">
          {dateOr(s.submittedAt)}
          {wait !== undefined && <span className={cx("ml-2 text-[12px]", wait > settings.reviewAlertDays ? "text-neg" : "text-warn")}>รอ {wait} วัน</span>}
        </KV>
        <KV k="อนุมัติ">{s.approvedAt ? `${dateOr(s.approvedAt)} · ${s.approvedBy}` : "–"}</KV>
        <KV k="แก้ไขแบบ">
          <span className="num font-mono">{s.revisions}</span> ครั้ง
        </KV>
        <KV k="ค่าออกแบบขั้นนี้">
          {s.feeStatus === "in_contract" ? (
            <span className="text-ink-3">รวมในสัญญาก่อสร้าง</span>
          ) : (
            <span className="flex flex-wrap items-center gap-2">
              <Amt n={s.fee} />
              <Pill tone={FEE_TONE[fee]}>{FEE_STATUS_LABEL[fee]}</Pill>
            </span>
          )}
        </KV>
      </div>
      {s.feeStatus !== "in_contract" && fee === "ready" && (
        <div className="mx-5 mb-3 flex flex-wrap items-center justify-between gap-2 rounded-[10px] bg-warn-soft px-3 py-2 text-[13px] text-warn">
          {s.installmentId ? (
            <span>
              สร้างงวด {s.installmentId} แล้ว รอฝ่ายบัญชีออกใบแจ้งหนี้ ·{" "}
              <Link href="/accounting/sales" className="underline-offset-2 hover:underline">
                ไปที่ลูกหนี้
              </Link>
            </span>
          ) : (
            <>
              <span>ลูกค้าอนุมัติแล้ว พร้อมเรียกเก็บค่าออกแบบขั้นนี้</span>
              {edit && (
                <Btn small onClick={() => linkFeeInstallment(s)}>
                  สร้างงวด “ค่าออกแบบ”
                </Btn>
              )}
            </>
          )}
        </div>
      )}
      {s.key === "permit" && permitStatus && (
        <p className="mx-5 mb-3 text-[13px] text-ink-2">
          สถานะคำขออนุญาต:{" "}
          <Link href={`/permits/${s.projectId}`} className="hover:underline">
            <PermitPill s={permitStatus as never} />
          </Link>
        </p>
      )}

      <div className="border-t border-line px-5 py-3">
        <div className="mb-2 flex items-baseline justify-between">
          <p className="text-[14px] font-medium">รายการส่งมอบ</p>
          <span className="num font-mono text-[12px] text-ink-3">
            {prog.done}/{prog.total}
          </span>
        </div>
        <ul className="flex flex-col gap-1.5">
          {s.deliverables.map((d) => (
            <li key={d.id}>
              <Check checked={d.done || locked} onChange={() => toggle(d.id)} disabled={!edit || locked} label={d.text} />
            </li>
          ))}
        </ul>
        {edit && !locked && (
          <div className="mt-2 flex gap-2">
            <input value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addItem()} placeholder="เพิ่มรายการส่งมอบ" className={cx(inputCls, "flex-1")} />
            <Btn small onClick={addItem}>
              <Plus {...I} />
              เพิ่ม
            </Btn>
          </div>
        )}
      </div>

      <div className="border-t border-line px-5 py-3">
        {edit ? (
          <MediaField value={s.attachments} onChange={(attachments) => designStages.upsert({ ...s, attachments })} label="ไฟล์แบบที่ส่งให้ลูกค้า (แสดงในพอร์ทัล)" geotag={false} />
        ) : (
          <>
            <p className="mb-2 text-[13px] text-ink-2">ไฟล์แบบ</p>
            {s.attachments.length ? <MediaStrip refs={s.attachments} /> : <p className="text-[13px] text-ink-3">ยังไม่มีไฟล์</p>}
          </>
        )}
      </div>

      {edit && (
        <div className="flex flex-wrap gap-2 border-t border-line px-5 py-3">
          {(s.status === "in_progress" || s.status === "changes_requested" || s.status === "not_started") && (
            <Btn primary small onClick={() => setModal("submit")}>
              <Send {...I} />
              ส่งให้ลูกค้าพิจารณา
            </Btn>
          )}
          {s.status === "client_review" && (
            <>
              <Btn primary small onClick={() => setModal("approve")}>
                <CheckIcon {...I} />
                บันทึกลูกค้าอนุมัติ
              </Btn>
              <Btn small onClick={() => setModal("changes")}>
                <Undo2 {...I} />
                บันทึกลูกค้าขอแก้ไข
              </Btn>
            </>
          )}
          <Btn small onClick={() => setModal("comment")}>
            <MessageSquare {...I} />
            เพิ่มบันทึก
          </Btn>
        </div>
      )}

      <div className="border-t border-line px-5 py-3">
        <p className="mb-2 text-[14px] font-medium">ประวัติการพิจารณา</p>
        {reviews.length === 0 ? (
          <p className="text-[13px] text-ink-3">ยังไม่มีการส่งให้ลูกค้า</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {reviews.map((r) => (
              <li key={r.id} className="flex gap-3 text-[13px]">
                <span className="num w-[86px] shrink-0 font-mono text-[12px] text-ink-3">{dateOr(r.at)}</span>
                <div className="min-w-0">
                  <p>
                    <span className="text-ink-2">{r.by}</span>{" "}
                    <Pill tone={r.action === "approved" ? "pos" : r.action === "changes" ? "neg" : r.action === "submitted" ? "accent" : "neutral"}>
                      {{ approved: "อนุมัติ", changes: "ขอแก้ไข", submitted: "ส่งพิจารณา", comment: "บันทึก" }[r.action]}
                    </Pill>
                    {r.side === "client" && <span className="ml-1.5 text-[12px] text-ink-3">ลูกค้า</span>}
                  </p>
                  {r.comment && <p className="mt-0.5 text-ink">{r.comment}</p>}
                  {r.signature && <MediaStrip refs={[r.signature]} size={48} className="mt-1" />}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {modal === "edit" && <EditStage s={s} onClose={() => setModal(null)} />}
      {modal && modal !== "edit" && (
        <ActionModal
          kind={modal}
          owner={owner}
          onClose={() => setModal(null)}
          onSave={(by, text) => {
            if (modal === "submit") submitStage(s, me, text || undefined);
            if (modal === "approve") approveStage(s, by, "client", `บันทึกโดย ${me}${text ? ` · ${text}` : ""}`);
            if (modal === "changes") requestStageChanges(s, by, "client", text);
            if (modal === "comment") addStageComment(s, me, "company", text);
            setModal(null);
          }}
        />
      )}
    </Card>
  );
}

function ActionModal({ kind, owner, onClose, onSave }: { kind: "submit" | "approve" | "changes" | "comment"; owner: string; onClose: () => void; onSave: (by: string, text: string) => void }) {
  const [by, setBy] = useState(owner);
  const [text, setText] = useState("");
  const title = { submit: "ส่งแบบให้ลูกค้าพิจารณา", approve: "บันทึกการอนุมัติจากลูกค้า", changes: "บันทึกลูกค้าขอแก้ไข", comment: "เพิ่มบันทึก" }[kind];
  const need = kind === "changes" || kind === "comment";
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={need && !text.trim()} onClick={() => onSave(by.trim() || owner, text.trim())}>
            บันทึก
          </Btn>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {(kind === "approve" || kind === "changes") && (
          <Field label="ผู้อนุมัติ/ผู้แจ้ง (ฝั่งลูกค้า)">
            <input value={by} onChange={(e) => setBy(e.target.value)} className={inputCls} />
          </Field>
        )}
        <Field label={kind === "changes" ? "รายการที่ลูกค้าขอแก้ไข" : "ข้อความ"}>
          <textarea value={text} onChange={(e) => setText(e.target.value)} className={areaCls} placeholder={kind === "submit" ? "เช่น ส่งผังพื้นและรูปด้านรอบที่ 2 ให้พิจารณา" : undefined} />
        </Field>
        {kind === "submit" && <p className="text-[12px] text-ink-3">ลูกค้าจะเห็นขั้นตอนนี้ในพอร์ทัล พร้อมไฟล์แบบ และกดอนุมัติหรือขอแก้ไขได้เอง</p>}
        {kind === "approve" && <p className="text-[12px] text-ink-3">ใช้เมื่อลูกค้าอนุมัติทางกระดาษหรือแชต เมื่อบันทึกแล้วระบบจะสร้างงวดค่าออกแบบ (ถ้ามี) และเปิดขั้นตอนถัดไป</p>}
      </div>
    </Modal>
  );
}

function EditStage({ s, onClose }: { s: DesignStage; onClose: () => void }) {
  const [v, setV] = useState(s);
  const toggleEng = (e: string) => setV((x) => ({ ...x, engineers: x.engineers.includes(e) ? x.engineers.filter((y) => y !== e) : [...x.engineers, e] }));
  return (
    <Modal
      open
      onClose={onClose}
      title={`แก้ไขขั้น${STAGE_LABEL[s.key]}`}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary onClick={() => (designStages.upsert(v), onClose())}>
            บันทึก
          </Btn>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="วันเริ่ม">
          <input type="date" value={v.start ?? ""} onChange={(e) => setV({ ...v, start: e.target.value || undefined })} className={inputCls} />
        </Field>
        <Field label="กำหนดส่ง">
          <input type="date" value={v.due} onChange={(e) => setV({ ...v, due: e.target.value })} className={inputCls} />
        </Field>
        <Field label="สถาปนิก">
          <Select label="สถาปนิก" value={v.architect} onChange={(architect) => setV({ ...v, architect })}>
            {[...new Set([v.architect, ...ARCHITECTS])].map((a) => (
              <option key={a}>{a}</option>
            ))}
          </Select>
        </Field>
        {v.feeStatus !== "in_contract" && (
          <Field label="ค่าออกแบบขั้นนี้ (บาท)">
            <NumInput value={v.fee} onChange={(fee) => setV({ ...v, fee })} step={500} />
          </Field>
        )}
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-[13px] text-ink-2">วิศวกรที่รับผิดชอบ</p>
          <div className="flex flex-col gap-1.5">
            {[...new Set([...ENGINEERS, ...v.engineers])].map((e) => (
              <Check key={e} checked={v.engineers.includes(e)} onChange={() => toggleEng(e)} label={e} />
            ))}
          </div>
        </div>
        <div className="sm:col-span-2">
          <Field label="หมายเหตุ">
            <textarea value={v.note ?? ""} onChange={(e) => setV({ ...v, note: e.target.value })} className={areaCls} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
