"use client";

// Customer-portal sections added by the design/interior module: approvals (design stages,
// variations, material selections), room boards, chat, receipts and satisfaction surveys.

import { useState } from "react";
import { Check, ChevronDown, FileText, Heart, Printer, Star } from "lucide-react";
import { Card, CardHead, cx, Field, inputCls } from "@/components/ui";
import { MediaStrip } from "@/components/media/media-field";
import { SignaturePad } from "@/components/media/signature-pad";
import { PrintStyle } from "@/components/ops/bits";
import { bahtText } from "@/lib/accounting/money";
import { thDate, TODAY, type Project, type Repair } from "@/lib/data";
import { money, type Installment, type Variation } from "@/lib/biz";
import type { PortalCompany } from "@/lib/portal";
import { STAGE_KEYS, STAGE_LABEL, STAGE_STATUS_LABEL, ASPECT_LABEL, SURVEY_ASPECTS, type DesignStage, type SurveyAspect, type SurveyResponse } from "@/lib/design/types";
import { allowanceTotal, isSelectionLate, optionTotal } from "@/lib/interior/calc";
import type { Selection } from "@/lib/interior/types";
import { BoardTileView } from "@/components/interior/boards";
import { Swatch } from "@/components/design/bits";
import { Thread, Composer } from "./message-thread";
import type { PortalApi } from "./portal-data";

const btn = "inline-flex h-10 items-center justify-center gap-1.5 rounded-[8px] border border-line-strong bg-card px-4 text-[14px] text-ink transition-colors duration-150 hover:bg-raised disabled:opacity-40";
const btnPrimary = "inline-flex h-10 items-center justify-center gap-1.5 rounded-[8px] bg-ink px-4 text-[14px] font-medium text-card transition-[background-color,transform] duration-150 hover:bg-[#3a332b] active:scale-[0.98] disabled:opacity-40";
const area = "min-h-[72px] w-full rounded-[8px] border border-line-strong bg-card px-3 py-2 text-[14px] outline-none placeholder:text-ink-3 focus:border-ink-3";
const b = (n: number) => `฿${money(n)}`;
const sb = (n: number) => (n === 0 ? "ไม่มีส่วนต่าง" : `${n > 0 ? "+" : "−"}฿${money(Math.abs(n))}`);

function useRun() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ทำรายการไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

// ---------- to-do summary ----------

export function PortalTodo({ api }: { api: PortalApi }) {
  const stages = api.stages.filter((s) => s.status === "client_review").length;
  const vos = api.variations.filter((v) => v.status === "submitted").length;
  const sels = api.selections.filter((s) => s.status === "pending").length;
  const items: [string, number, string][] = [
    ["แบบรออนุมัติ", stages, "#design"],
    ["งานเปลี่ยนแปลงรอลงนาม", vos, "#variations"],
    ["วัสดุที่ต้องเลือก", sels, "#selections"],
  ];
  if (!stages && !vos && !sels) return null;
  return (
    <Card className="border-accent/40">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3">
        <p className="text-[14px] font-medium">รายการที่รอคุณ</p>
        {items
          .filter(([, n]) => n > 0)
          .map(([label, n, href]) => (
            <a key={href} href={href} className="text-[14px] text-accent-text underline-offset-2 hover:underline">
              {label} <span className="num font-mono">{n}</span>
            </a>
          ))}
      </div>
    </Card>
  );
}

// ---------- design stages ----------

export function DesignSection({ api, project }: { api: PortalApi; project: Project }) {
  const stages = [...api.stages].sort((a, b) => STAGE_KEYS.indexOf(a.key) - STAGE_KEYS.indexOf(b.key));
  if (!stages.length) return null;
  const waiting = stages.filter((s) => s.status === "client_review");
  return (
    <Card>
      <div id="design" className="scroll-mt-4" />
      <CardHead title="แบบบ้าน" meta={waiting.length ? `รอคุณพิจารณา ${waiting.length}` : `อนุมัติแล้ว ${stages.filter((s) => s.status === "approved").length}/${stages.length}`} />
      <ol className="flex flex-col px-5 py-4">
        {stages.map((s, i) => (
          <li key={s.id} className="relative flex gap-3 pb-3 last:pb-0">
            {i < stages.length - 1 && <span aria-hidden className="absolute left-[5px] top-4 h-[calc(100%-8px)] w-px bg-line" />}
            <span aria-hidden className={cx("relative mt-1.5 size-[11px] shrink-0 rounded-full border", s.status === "approved" ? "border-ink bg-ink" : s.status === "client_review" ? "border-accent bg-accent" : s.status === "changes_requested" ? "border-warn bg-card" : "border-line-strong bg-card")} />
            <div className="flex min-w-0 flex-1 items-baseline justify-between gap-3">
              <span className={cx("text-[14px]", s.status === "not_started" ? "text-ink-3" : "text-ink")}>{STAGE_LABEL[s.key]}</span>
              <span className="shrink-0 text-[12px] text-ink-3">{s.status === "approved" && s.approvedAt ? `อนุมัติ ${thDate(s.approvedAt)}` : STAGE_STATUS_LABEL[s.status]}</span>
            </div>
          </li>
        ))}
      </ol>
      {waiting.map((s) => (
        <StageReview key={s.id} s={s} api={api} owner={project.owner} />
      ))}
    </Card>
  );
}

function StageReview({ s, api, owner }: { s: DesignStage; api: PortalApi; owner: string }) {
  const [mode, setMode] = useState<null | "approve" | "changes">(null);
  const [comment, setComment] = useState("");
  const [name, setName] = useState(owner);
  const { busy, error, run } = useRun();
  const note = [...s.reviews].reverse().find((r) => r.action === "submitted")?.comment;
  return (
    <div className="border-t border-line px-5 py-4">
      <p className="text-[15px] font-medium">ขั้น{STAGE_LABEL[s.key]} · รอคุณพิจารณา</p>
      <p className="mt-0.5 text-[13px] text-ink-2">
        ส่งเมื่อ {s.submittedAt ? thDate(s.submittedAt) : "–"} โดย {s.architect}
        {s.revisions > 0 && ` · แก้ไขมาแล้ว ${s.revisions} ครั้ง`}
      </p>
      {note && <p className="mt-2 rounded-[8px] bg-raised px-3 py-2 text-[13px] text-ink-2">{note}</p>}
      <ul className="mt-2 flex flex-col gap-1 text-[13px]">
        {s.deliverables.map((d) => (
          <li key={d.id} className="flex items-center gap-2">
            <FileText size={14} strokeWidth={1.5} className="shrink-0 text-ink-3" />
            {d.text}
          </li>
        ))}
      </ul>
      {s.attachments.length > 0 && <MediaStrip refs={s.attachments} size={64} className="mt-3" />}
      {mode === null ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={btnPrimary} onClick={() => setMode("approve")}>
            <Check size={16} strokeWidth={1.5} />
            อนุมัติแบบ
          </button>
          <button type="button" className={btn} onClick={() => setMode("changes")}>
            ขอแก้ไข
          </button>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          <Field label="ชื่อผู้พิจารณา">
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </Field>
          <Field label={mode === "changes" ? "สิ่งที่ต้องการให้แก้ไข" : "ความเห็นเพิ่มเติม (ถ้ามี)"}>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} className={area} />
          </Field>
          {error && <p className="text-[13px] text-neg">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              className={btnPrimary}
              disabled={busy || !name.trim() || (mode === "changes" && !comment.trim())}
              onClick={() => run(() => (mode === "approve" ? api.approveStage(s, name.trim(), comment.trim() || undefined) : api.requestChanges(s, name.trim(), comment.trim())))}
            >
              {mode === "approve" ? "ยืนยันอนุมัติ" : "ส่งคำขอแก้ไข"}
            </button>
            <button type="button" className={btn} onClick={() => setMode(null)}>
              ยกเลิก
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- variations ----------

const VO_STATUS: Record<string, string> = { submitted: "รอคุณอนุมัติ", approved: "อนุมัติแล้ว", rejected: "ไม่อนุมัติ" };

export function VariationsSection({ api, project }: { api: PortalApi; project: Project }) {
  const list = api.variations.filter((v) => ["submitted", "approved", "rejected"].includes(v.status)).sort((a, b) => Number(b.status === "submitted") - Number(a.status === "submitted") || b.raisedAt.localeCompare(a.raisedAt));
  if (!list.length) return null;
  const waiting = list.filter((v) => v.status === "submitted");
  return (
    <Card>
      <div id="variations" className="scroll-mt-4" />
      <CardHead title="งานเปลี่ยนแปลง" meta={waiting.length ? `รออนุมัติ ${waiting.length}` : undefined} />
      <ul className="divide-y divide-line">
        {list.map((v) => (
          <VariationRow key={v.id} v={v} api={api} owner={project.owner} />
        ))}
      </ul>
    </Card>
  );
}

function VariationRow({ v, api, owner }: { v: Variation; api: PortalApi; owner: string }) {
  const [open, setOpen] = useState(v.status === "submitted");
  const [mode, setMode] = useState<null | "sign" | "decline">(null);
  const [reason, setReason] = useState("");
  const { busy, error, run } = useRun();
  const vat = Math.round(v.amount * 7) / 100;
  return (
    <li className="px-5 py-3">
      <button type="button" onClick={() => setOpen((x) => !x)} className="flex w-full items-start justify-between gap-3 text-left">
        <div className="min-w-0">
          <p className="text-[14px]">{v.title}</p>
          <p className="mt-0.5 text-[12px] text-ink-3">
            <span className="font-mono">{v.id}</span> · {thDate(v.raisedAt)} · {VO_STATUS[v.status] ?? v.status}
            {v.approvedAt && v.status !== "submitted" ? ` ${thDate(v.approvedAt)}` : ""}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1">
          <span className={cx("num font-mono text-[14px]", v.amount < 0 && "text-pos")}>{sb(v.amount)}</span>
          <ChevronDown size={16} strokeWidth={1.5} className={cx("text-ink-3 transition-transform duration-150", open && "rotate-180")} />
        </span>
      </button>
      {open && (
        <div className="mt-2 text-[13px]">
          <p className="text-ink-2">{v.reason}</p>
          <table className="mt-2 w-full text-left">
            <tbody>
              {v.lines.map((l, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="py-1.5 pr-2">{l.description}</td>
                  <td className="num whitespace-nowrap py-1.5 pr-2 text-right font-mono text-ink-2">
                    {l.qty} {l.unit} × {money(l.unitPrice)}
                  </td>
                  <td className="num whitespace-nowrap py-1.5 text-right font-mono">{money(l.qty * l.unitPrice)}</td>
                </tr>
              ))}
              <tr className="border-t border-line">
                <td className="py-1.5 text-ink-3" colSpan={2}>
                  VAT 7%
                </td>
                <td className="num py-1.5 text-right font-mono">{money(vat)}</td>
              </tr>
              <tr className="border-t border-line-strong">
                <td className="py-1.5 font-medium" colSpan={2}>
                  รวมทั้งสิ้น{v.days ? ` · ขยายเวลา ${v.days} วัน` : ""}
                </td>
                <td className="num py-1.5 text-right font-mono font-medium">{money(v.amount + vat)}</td>
              </tr>
            </tbody>
          </table>
          {v.status === "approved" && v.signature && (
            <div className="mt-2 flex items-center gap-3 text-[12px] text-ink-3">
              <MediaStrip refs={[v.signature]} size={56} />
              ลงนามโดย {v.approvedBy}
            </div>
          )}
          {v.status === "submitted" &&
            (mode === null ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className={btnPrimary} onClick={() => setMode("sign")}>
                  อนุมัติและลงนาม
                </button>
                <button type="button" className={btn} onClick={() => setMode("decline")}>
                  ไม่อนุมัติ
                </button>
              </div>
            ) : mode === "sign" ? (
              <div className="mt-3">
                <p className="mb-2 text-[13px] text-ink-2">ลงนามเพื่ออนุมัติงานเปลี่ยนแปลงและราคาข้างต้น ยอดนี้จะรวมในงวดชำระถัดไป</p>
                <SignaturePad nameLabel="ชื่อผู้อนุมัติ" onSave={(ref, signer) => void run(() => api.approveVariation(v, signer || owner, ref))} />
                <button type="button" className={cx(btn, "mt-2")} onClick={() => setMode(null)} disabled={busy}>
                  ยกเลิก
                </button>
              </div>
            ) : (
              <div className="mt-3 flex flex-col gap-2">
                <Field label="เหตุผล (บริษัทจะติดต่อกลับ)">
                  <textarea value={reason} onChange={(e) => setReason(e.target.value)} className={area} />
                </Field>
                <div className="flex gap-2">
                  <button type="button" className={btnPrimary} disabled={busy || !reason.trim()} onClick={() => run(() => api.declineVariation(v, owner, reason.trim()))}>
                    ส่ง
                  </button>
                  <button type="button" className={btn} onClick={() => setMode(null)}>
                    ยกเลิก
                  </button>
                </div>
              </div>
            ))}
          {error && <p className="mt-2 text-[13px] text-neg">{error}</p>}
        </div>
      )}
    </li>
  );
}

// ---------- selections ----------

export function SelectionsSection({ api, project }: { api: PortalApi; project: Project }) {
  const list = api.selections;
  if (!list.length) return null;
  const open = list.filter((s) => s.status !== "approved").sort((a, b) => a.deadline.localeCompare(b.deadline));
  const done = list.filter((s) => s.status === "approved");
  return (
    <Card>
      <div id="selections" className="scroll-mt-4" />
      <CardHead title="เลือกวัสดุและอุปกรณ์" meta={`เลือกแล้ว ${list.length - list.filter((s) => s.status === "pending").length}/${list.length}`} />
      {open.length === 0 ? (
        <p className="px-5 py-4 text-[14px] text-ink-3">เลือกครบทุกรายการแล้ว ขอบคุณครับ</p>
      ) : (
        <ul className="divide-y divide-line">
          {open.map((s) => (
            <SelectionPick key={s.id} s={s} api={api} owner={project.owner} />
          ))}
        </ul>
      )}
      {done.length > 0 && (
        <details className="border-t border-line px-5 py-3 text-[13px]">
          <summary className="cursor-pointer text-ink-2">รายการที่อนุมัติแล้ว {done.length} รายการ</summary>
          <ul className="mt-2 flex flex-col gap-1">
            {done.map((s) => (
              <li key={s.id} className="flex justify-between gap-3">
                <span>
                  {s.room} · {s.item}
                </span>
                <span className="text-ink-3">{s.options.find((o) => o.id === s.chosenId)?.name ?? "–"}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}

function SelectionPick({ s, api, owner }: { s: Selection; api: PortalApi; owner: string }) {
  const [note, setNote] = useState("");
  const { busy, error, run } = useRun();
  const late = isSelectionLate(s, TODAY);
  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[15px]">
          {s.item} <span className="text-[13px] text-ink-3">· {s.room}</span>
        </p>
        <span className={cx("text-[13px]", late ? "text-neg" : "text-ink-2")}>
          {s.status === "chosen" ? "เลือกแล้ว รอบริษัทยืนยัน" : late ? `เลยกำหนด ${thDate(s.deadline)} กรุณาเลือกโดยเร็ว` : `เลือกภายใน ${thDate(s.deadline)}`}
        </span>
      </div>
      <p className="mt-0.5 text-[12px] text-ink-3">
        งบในสัญญา {b(allowanceTotal(s))} ({s.qty} {s.unit}){s.blocks ? ` · ใช้สำหรับ${s.blocks}` : ""}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {s.options.map((o) => {
          const chosen = s.chosenId === o.id;
          const d = optionTotal(s, o) - allowanceTotal(s);
          return (
            <button key={o.id} type="button" disabled={busy} onClick={() => run(() => api.choose(s, o.id, owner, note.trim() || undefined))} aria-pressed={chosen} className={cx("flex flex-col gap-1.5 rounded-[10px] border p-2 text-left transition-colors duration-150", chosen ? "border-ink bg-raised" : "border-line hover:border-line-strong")}>
              <OptionImage o={o} />
              <span className="text-[13px] leading-snug">{o.name}</span>
              {o.brand && <span className="text-[12px] text-ink-3">{o.brand}</span>}
              <span className={cx("num font-mono text-[12px]", d > 0 ? "text-warn" : d < 0 ? "text-pos" : "text-ink-3")}>{sb(d)}</span>
              {chosen && (
                <span className="flex items-center gap-1 text-[12px] font-medium">
                  <Check size={14} strokeWidth={1.5} /> ที่คุณเลือก
                </span>
              )}
            </button>
          );
        })}
      </div>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="หมายเหตุถึงทีมงาน (ถ้ามี) แล้วแตะตัวเลือก" className={cx(inputCls, "mt-2 w-full")} />
      {error && <p className="mt-1 text-[13px] text-neg">{error}</p>}
    </li>
  );
}

function OptionImage({ o }: { o: Selection["options"][number] }) {
  return <Swatch image={o.images[0]} color={o.swatch} label={o.name} className="aspect-[4/3] w-full" />;
}

// ---------- boards ----------

export function BoardsSection({ api }: { api: PortalApi }) {
  const boards = api.boards.filter((x) => x.shared);
  if (!boards.length) return null;
  return (
    <Card>
      <CardHead title="ไอเดียตกแต่งภายใน" meta={`${boards.length} ห้อง`} />
      <div className="flex flex-col divide-y divide-line">
        {boards.map((bd) => (
          <BoardView key={bd.id} b={bd} api={api} />
        ))}
      </div>
    </Card>
  );
}

function BoardView({ b: bd, api }: { b: PortalApi["boards"][number]; api: PortalApi }) {
  const [comment, setComment] = useState("");
  const { busy, error, run } = useRun();
  return (
    <div className="px-5 py-4">
      <p className="text-[15px]">{bd.title}</p>
      {bd.notes && <p className="mt-0.5 text-[13px] text-ink-2">{bd.notes}</p>}
      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {bd.tiles.map((t) => (
          <BoardTileView key={t.id} t={t} prods={api.products} />
        ))}
      </div>
      {bd.clientComment && <p className="mt-3 rounded-[8px] bg-raised px-3 py-2 text-[13px]">ความเห็นของคุณ: {bd.clientComment}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy} onClick={() => run(() => api.commentBoard(bd, "", !bd.clientLiked))} className={cx(btn, bd.clientLiked && "border-accent text-accent-text")} aria-pressed={!!bd.clientLiked}>
          <Heart size={16} strokeWidth={1.5} className={bd.clientLiked ? "fill-accent text-accent" : undefined} />
          {bd.clientLiked ? "ชอบแล้ว" : "ชอบ"}
        </button>
        <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="ความเห็นถึงมัณฑนากร" className={cx(inputCls, "h-10 min-w-0 flex-1")} />
        <button type="button" className={btn} disabled={busy || !comment.trim()} onClick={() => run(async () => (await api.commentBoard(bd, comment.trim(), !!bd.clientLiked), setComment("")))}>
          ส่ง
        </button>
      </div>
      {error && <p className="mt-1 text-[13px] text-neg">{error}</p>}
    </div>
  );
}

// ---------- messages ----------

export function MessagesSection({ api, project }: { api: PortalApi; project: Project }) {
  const { error, run, busy } = useRun();
  return (
    <Card>
      <CardHead title="ข้อความถึงทีมงาน" meta={api.messages.length ? `${api.messages.length} ข้อความ` : undefined} />
      <Thread messages={api.messages} viewer="customer" empty="ส่งคำถามถึงผู้จัดการโครงการได้ที่นี่ ทีมงานตอบในเวลาทำการ" />
      <Composer busy={busy} onSend={(text, files) => run(() => api.send(text, project.owner, files))} allowFiles={!api.live} />
      {error && <p className="px-4 pb-3 text-[13px] text-neg">{error}</p>}
    </Card>
  );
}

// ---------- receipts ----------

export function ReceiptsSection({ list, project, company }: { list: Installment[]; project: Project; company: PortalCompany & { address?: string; taxId?: string } }) {
  const paid = list.filter((i) => i.status === "paid" && i.receiptNo).sort((a, b) => (b.paidDate ?? "").localeCompare(a.paidDate ?? ""));
  const [open, setOpen] = useState<Installment | null>(null);
  if (!paid.length) return null;
  return (
    <Card>
      <CardHead title="ใบเสร็จรับเงิน" meta={`${paid.length} ฉบับ`} />
      <ul className="divide-y divide-line">
        {paid.map((i) => (
          <li key={i.id} className="flex items-center justify-between gap-3 px-5 py-3">
            <div className="min-w-0">
              <p className="text-[14px]">
                <span className="font-mono">{i.receiptNo}</span>
              </p>
              <p className="truncate text-[12px] text-ink-3">
                {i.title} · {i.paidDate ? thDate(i.paidDate) : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="num font-mono text-[14px]">{b(i.amount + i.vat)}</span>
              <button type="button" onClick={() => setOpen(i)} aria-label={`พิมพ์ใบเสร็จ ${i.receiptNo}`} className="flex size-9 items-center justify-center rounded-[8px] border border-line-strong text-ink-2 hover:bg-raised hover:text-ink">
                <Printer size={16} strokeWidth={1.5} />
              </button>
            </div>
          </li>
        ))}
      </ul>
      {open && <ReceiptSheet i={open} project={project} company={company} onClose={() => setOpen(null)} />}
    </Card>
  );
}

function ReceiptSheet({ i, project, company, onClose }: { i: Installment; project: Project; company: PortalCompany & { address?: string; taxId?: string }; onClose: () => void }) {
  const total = i.amount + i.vat;
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[rgb(31_27_22/0.28)] px-3 py-6">
      <PrintStyle />
      <div className="ops-noprint mx-auto mb-3 flex max-w-[760px] justify-end gap-2">
        <button type="button" className={btnPrimary} onClick={() => window.print()}>
          <Printer size={16} strokeWidth={1.5} />
          พิมพ์ / บันทึก PDF
        </button>
        <button type="button" className={btn} onClick={onClose}>
          ปิด
        </button>
      </div>
      <article className="ops-print mx-auto max-w-[760px] rounded-[4px] bg-white px-8 py-8 text-[13px] text-ink">
        <div className="flex items-start justify-between gap-4 border-b border-ink pb-3">
          <div>
            <p className="text-[15px] font-medium">{company.name}</p>
            {company.address && <p className="text-ink-2">{company.address}</p>}
            {company.taxId && <p className="text-ink-2">เลขประจำตัวผู้เสียภาษี {company.taxId}</p>}
          </div>
          <div className="text-right">
            <p className="text-[18px] font-medium">ใบเสร็จรับเงิน</p>
            <p className="text-ink-2">สำเนาสำหรับลูกค้า</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1">
          <p>
            <span className="text-ink-3">เลขที่</span> <span className="font-mono">{i.receiptNo}</span>
          </p>
          <p>
            <span className="text-ink-3">วันที่</span> {i.paidDate ? thDate(i.paidDate) : "–"}
          </p>
          <p>
            <span className="text-ink-3">ได้รับเงินจาก</span> {project.owner}
          </p>
          <p>
            <span className="text-ink-3">โครงการ</span> {project.name} ({project.id})
          </p>
        </div>
        <table className="mt-4 w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-line-strong text-ink-3">
              <th className="py-1.5 font-normal">รายการ</th>
              <th className="py-1.5 text-right font-normal">จำนวนเงิน</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-line">
              <td className="py-1.5">
                {i.title}
                {i.invoiceNo && <span className="block text-[12px] text-ink-3">อ้างอิงใบแจ้งหนี้ {i.invoiceNo}</span>}
              </td>
              <td className="num py-1.5 text-right font-mono">{money(i.amount)}</td>
            </tr>
            <tr className="border-b border-line">
              <td className="py-1.5 text-ink-2">ภาษีมูลค่าเพิ่ม</td>
              <td className="num py-1.5 text-right font-mono">{money(i.vat)}</td>
            </tr>
            <tr>
              <td className="py-1.5 font-medium">รวมทั้งสิ้น ({bahtText(total)})</td>
              <td className="num py-1.5 text-right font-mono font-medium">{money(total)}</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-6 text-[12px] text-ink-3">เอกสารนี้เป็นสำเนาจากพอร์ทัลเจ้าของบ้าน ใบเสร็จฉบับจริงออกโดยฝ่ายบัญชีของบริษัท</p>
      </article>
    </div>
  );
}

// ---------- satisfaction survey ----------

type Pending = { id: string; trigger: SurveyResponse["trigger"]; repairId?: string; label: string };

export function SurveySection({ api, project, repairs }: { api: PortalApi; project: Project; repairs: Repair[] }) {
  const done = new Set(api.surveys.map((s) => s.id));
  const pending: Pending[] = [];
  const handedRecently = !!project.handedOver && project.handedOver >= new Date(Date.parse(TODAY) - 365 * 86400000).toISOString().slice(0, 10);
  if (project.status === "delivered" && handedRecently && !done.has(`SRV-${project.id}-handover`)) pending.push({ id: `SRV-${project.id}-handover`, trigger: "handover", label: "หลังส่งมอบบ้าน" });
  const recent = new Date(Date.parse(TODAY) - 90 * 86400000).toISOString().slice(0, 10);
  for (const r of repairs) if (r.status === "closed" && r.reported >= recent && !done.has(`SRV-${project.id}-${r.id}`)) pending.push({ id: `SRV-${project.id}-${r.id}`, trigger: "repair", repairId: r.id, label: `งานซ่อม ${r.title}` });
  const answered = api.surveys.filter((s) => s.projectId === project.id);
  if (!pending.length && !answered.length) return null;
  return (
    <Card>
      <CardHead title="ประเมินความพึงพอใจ" meta={pending.length ? `รอคุณประเมิน ${pending.length}` : "ขอบคุณที่ให้คะแนน"} />
      {pending.slice(0, 3).map((p) => (
        <SurveyForm key={p.id} p={p} project={project} api={api} />
      ))}
      {answered.length > 0 && (
        <ul className="divide-y divide-line border-t border-line">
          {answered.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-[13px]">
              <span className="text-ink-2">
                {r.trigger === "handover" ? "หลังส่งมอบบ้าน" : `หลังงานซ่อม ${r.repairId}`} · {thDate(r.at)}
              </span>
              <span className="flex gap-3">
                {SURVEY_ASPECTS.filter((a) => r.scores[a]).map((a) => (
                  <span key={a} className="text-ink-3">
                    {ASPECT_LABEL[a]} <span className="num font-mono text-ink">{r.scores[a]}</span>
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function SurveyForm({ p, project, api }: { p: Pending; project: Project; api: PortalApi }) {
  const [scores, setScores] = useState<Partial<Record<SurveyAspect, number>>>({});
  const [comments, setComments] = useState<Partial<Record<SurveyAspect, string>>>({});
  const [general, setGeneral] = useState("");
  const { busy, error, run } = useRun();
  const aspects: SurveyAspect[] = p.trigger === "repair" ? ["quality", "onTime", "communication", "afterSales"] : SURVEY_ASPECTS;
  const complete = aspects.every((a) => scores[a]);
  const submit = () =>
    run(() =>
      api.survey({
        id: p.id,
        projectId: project.id,
        trigger: p.trigger,
        repairId: p.repairId,
        at: TODAY,
        by: project.owner,
        scores,
        comments: Object.fromEntries(Object.entries(comments).filter(([, v]) => v && v.trim())) as SurveyResponse["comments"],
        general: general.trim() || undefined,
      }),
    );
  return (
    <div className="border-t border-line px-5 py-4 first:border-t-0">
      <p className="text-[14px] font-medium">{p.label}</p>
      <div className="mt-2 flex flex-col gap-3">
        {aspects.map((a) => (
          <div key={a}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[14px]">{ASPECT_LABEL[a]}</span>
              <StarInput value={scores[a] ?? 0} onChange={(v) => setScores({ ...scores, [a]: v })} label={ASPECT_LABEL[a]} />
            </div>
            {(scores[a] ?? 5) <= 3 && <input value={comments[a] ?? ""} onChange={(e) => setComments({ ...comments, [a]: e.target.value })} placeholder="บอกเราว่าควรปรับปรุงอะไร" className={cx(inputCls, "mt-1.5 w-full")} />}
          </div>
        ))}
        <textarea value={general} onChange={(e) => setGeneral(e.target.value)} placeholder="ความเห็นเพิ่มเติม (ถ้ามี)" className={area} />
        {error && <p className="text-[13px] text-neg">{error}</p>}
        <div>
          <button type="button" className={btnPrimary} disabled={!complete || busy} onClick={submit}>
            ส่งแบบประเมิน
          </button>
        </div>
      </div>
    </div>
  );
}

function StarInput({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <span className="flex gap-1" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} type="button" role="radio" aria-checked={value === i} aria-label={`${i} ดาว`} onClick={() => onChange(i)} className="flex size-9 items-center justify-center rounded-[8px] hover:bg-raised">
          <Star size={22} strokeWidth={1.5} className={i <= value ? "fill-accent text-accent" : "text-ink-3"} />
        </button>
      ))}
    </span>
  );
}
