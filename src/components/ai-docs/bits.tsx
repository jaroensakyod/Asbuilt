"use client";

// Shared pieces of the "AI reads a document" flows: the entry button, the AI / confidence markers,
// Thai error text, and ReadDocDialog (pick or photograph a file → AI extracts → caller gets the result
// plus the saved MediaRefs of the original file, so the record keeps it attached).

import { useRef, useState, type ReactNode } from "react";
import { Camera, FileText, Loader2, Paperclip, Sparkles, X } from "lucide-react";
import { cx } from "@/components/ui";
import { Btn, I, Modal, Pill } from "@/components/ops/bits";
import { AiUnavailable, fileToAi, mediaToAi, useAiStatus } from "@/lib/ai/client";
import type { AiFile } from "@/lib/ai/types";
import { compressImage, fileSize, saveMedia, type MediaRef } from "@/lib/media";
import type { Confidence, Issue } from "@/lib/ai-docs";

export function AiButton({ children, onClick, disabled, title }: { children: ReactNode; onClick: () => void; disabled?: boolean; title?: string }) {
  return (
    <Btn small onClick={onClick} disabled={disabled} title={title}>
      <Sparkles {...I} />
      {children}
    </Btn>
  );
}

/** small marker next to a field the AI filled */
export function AiPill({ show = true }: { show?: boolean }) {
  if (!show) return null;
  return (
    <span className="ml-1.5 inline-flex h-4 items-center rounded-[4px] bg-accent-soft px-1 align-middle text-[10px] leading-none text-accent-text" title="กรอกโดย AI ตรวจสอบก่อนบันทึก">
      AI
    </span>
  );
}

const CONF: Record<Confidence, { label: string; tone: "pos" | "warn" | "neg" }> = {
  high: { label: "AI มั่นใจสูง", tone: "pos" },
  medium: { label: "AI มั่นใจปานกลาง", tone: "warn" },
  low: { label: "AI ไม่ค่อยมั่นใจ", tone: "neg" },
};
export function ConfidencePill({ c }: { c?: Confidence }) {
  const x = CONF[c ?? "medium"] ?? CONF.medium;
  return <Pill tone={x.tone}>{x.label}</Pill>;
}

/** label + optional AI marker, same look as <Field> */
export function AiField({ label, ai, children, className }: { label: string; ai?: boolean; children: ReactNode; className?: string }) {
  return (
    <label className={cx("flex min-w-0 flex-col gap-1.5 text-[13px] text-ink-2", className)}>
      <span>
        {label}
        <AiPill show={!!ai} />
      </span>
      {children}
    </label>
  );
}

export function IssueList({ issues }: { issues: Issue[] }) {
  if (!issues.length) return null;
  return (
    <ul className="flex flex-col gap-1 rounded-[10px] border border-line bg-raised/50 px-3 py-2 text-[13px]">
      {issues.map((x, i) => (
        <li key={i} className={x.tone === "neg" ? "text-neg" : "text-warn"}>
          {x.msg}
        </li>
      ))}
    </ul>
  );
}

/** banner on top of a prefilled form */
export function AiBanner({ confidence, refs, note, children }: { confidence?: Confidence; refs?: MediaRef[]; note?: string; children?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-col gap-2 rounded-[10px] border border-line bg-accent-soft/40 px-3 py-2.5 text-[13px]">
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles {...I} className="text-accent-text" />
        <span className="text-ink">AI กรอกข้อมูลจากเอกสารให้แล้ว ตรวจสอบทุกช่องที่มีป้าย AI ก่อนบันทึก</span>
        <ConfidencePill c={confidence} />
        {refs?.map((r) => (
          <span key={r.id} className="inline-flex items-center gap-1 text-ink-3">
            <Paperclip size={14} strokeWidth={1.5} />
            {r.name}
          </span>
        ))}
      </div>
      {note && <p className="text-ink-2">{note}</p>}
      {children}
    </div>
  );
}

export function aiErrorText(e: unknown): string {
  if (e instanceof AiUnavailable) return /ตั้งค่า/.test(e.message) ? "ยังไม่ได้ตั้งค่า AI ผู้ดูแลระบบต้องใส่ GEMINI_API_KEY ในการตั้งค่าเซิร์ฟเวอร์ก่อน" : e.message;
  const m = e instanceof Error ? e.message : String(e);
  if (/413|ใหญ่เกิน/.test(m)) return "ไฟล์ใหญ่เกินไป ลองแบ่ง PDF หรือถ่ายรูปทีละหน้า";
  return m || "AI อ่านเอกสารไม่สำเร็จ ลองใหม่อีกครั้ง";
}

const MAX_BYTES = 8.5 * 1024 * 1024; // /api/ai accepts ~12 MB of base64

type Picked = { key: string; file?: File; ref?: MediaRef; name: string; size: number; type: string };
let pickKey = 0;

/** prepare files for the model: photos downscaled to ≤ 1600 px, PDFs as they are */
export async function toAiFiles(picked: { file?: File; ref?: MediaRef }[]): Promise<AiFile[]> {
  const out: AiFile[] = [];
  for (const p of picked) {
    if (p.file) out.push(await fileToAi(await compressImage(p.file)));
    else if (p.ref) {
      const f = await mediaToAi(p.ref);
      if (!f) throw new Error(`เปิดไฟล์ ${p.ref.name} ไม่ได้ (ไฟล์อยู่ในเครื่องอื่น?) ลองแนบไฟล์ใหม่`);
      out.push(f);
    }
  }
  const bytes = out.reduce((t, f) => t + f.data.length * 0.75, 0);
  if (bytes > MAX_BYTES) throw new Error("ไฟล์รวมใหญ่เกิน 8 MB ลองส่งเฉพาะหน้าที่จำเป็น");
  return out;
}

/**
 * Pick/photograph one or more files (or reuse attached ones), let the AI read them, then hand the
 * result and the saved MediaRefs back. Nothing is saved to records here; the caller shows a review form.
 */
export function ReadDocDialog<T>({
  title,
  hint,
  existing,
  accept = "image/*,application/pdf",
  run,
  onRead,
  onClose,
  extra,
}: {
  title: string;
  hint: ReactNode;
  existing?: MediaRef[];
  accept?: string;
  run: (files: AiFile[]) => Promise<T>;
  onRead: (result: T, refs: MediaRef[]) => void;
  onClose: () => void;
  extra?: ReactNode;
}) {
  const status = useAiStatus();
  const [picked, setPicked] = useState<Picked[]>(() => (existing?.length === 1 ? [{ key: `p${++pickKey}`, ref: existing[0], name: existing[0].name, size: existing[0].size, type: existing[0].type }] : []));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const run0 = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  const add = (list: FileList | null) => {
    if (!list?.length) return;
    setErr("");
    // copy now: the input is cleared right after, which empties the live FileList
    const files = Array.from(list);
    setPicked((p) => [...p, ...files.map((f) => ({ key: `p${++pickKey}`, file: f, name: f.name, size: f.size, type: f.type }))].slice(0, 6));
  };
  const toggleRef = (r: MediaRef) => setPicked((p) => (p.some((x) => x.ref?.id === r.id) ? p.filter((x) => x.ref?.id !== r.id) : [...p, { key: `p${++pickKey}`, ref: r, name: r.name, size: r.size, type: r.type }]));

  const go = async () => {
    const id = ++run0.current;
    setBusy(true);
    setErr("");
    try {
      const files = await toAiFiles(picked);
      const result = await run(files);
      if (id !== run0.current) return; // cancelled
      const refs: MediaRef[] = [];
      for (const p of picked) refs.push(p.ref ?? (await saveMedia(p.file!)));
      onRead(result, refs);
    } catch (e) {
      if (id === run0.current) setErr(aiErrorText(e));
    } finally {
      if (id === run0.current) setBusy(false);
    }
  };
  const cancel = () => {
    run0.current++;
    setBusy(false);
  };

  const off = status && !status.configured;
  return (
    <Modal
      open
      onClose={() => (cancel(), onClose())}
      width={600}
      title={title}
      footer={
        busy ? (
          <>
            <span className="mr-auto inline-flex items-center gap-2 text-[13px] text-ink-2">
              <Loader2 {...I} className="animate-spin" />
              AI กำลังอ่านเอกสาร ใช้เวลาประมาณ 5–20 วินาที
            </span>
            <Btn onClick={cancel}>ยกเลิก</Btn>
          </>
        ) : (
          <>
            <Btn onClick={onClose}>ปิด</Btn>
            <Btn primary disabled={!picked.length || !!off} onClick={go}>
              <Sparkles {...I} />
              ให้ AI อ่าน
            </Btn>
          </>
        )
      }
    >
      <div className="flex flex-col gap-3 text-[13px]">
        <p className="text-ink-2">{hint}</p>
        {off && <p className="rounded-[8px] bg-warn-soft px-3 py-2 text-warn">ยังไม่ได้ตั้งค่า AI ผู้ดูแลระบบต้องใส่ GEMINI_API_KEY ในการตั้งค่าเซิร์ฟเวอร์ก่อน</p>}
        {!!existing?.length && (
          <div>
            <p className="mb-1.5 text-ink-3">ไฟล์ที่แนบไว้แล้ว</p>
            <div className="flex flex-col gap-1">
              {existing.map((r) => (
                <label key={r.id} className="flex items-center gap-2">
                  <input type="checkbox" checked={picked.some((x) => x.ref?.id === r.id)} onChange={() => toggleRef(r)} disabled={busy} />
                  <FileText size={14} strokeWidth={1.5} className="text-ink-3" />
                  <span className="truncate">{r.name}</span>
                  <span className="font-mono text-[12px] text-ink-3">{fileSize(r.size)}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Btn small onClick={() => fileRef.current?.click()} disabled={busy}>
            <Paperclip {...I} />
            เลือกไฟล์ (รูป/PDF)
          </Btn>
          <Btn small onClick={() => camRef.current?.click()} disabled={busy}>
            <Camera {...I} />
            ถ่ายรูป
          </Btn>
          <input ref={fileRef} type="file" accept={accept} multiple hidden data-ai-docs="file" onChange={(e) => (add(e.target.files), (e.target.value = ""))} />
          <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => (add(e.target.files), (e.target.value = ""))} />
        </div>
        {picked.filter((p) => p.file).length > 0 && (
          <ul className="flex flex-col gap-1 rounded-[10px] border border-line px-3 py-2">
            {picked
              .filter((p) => p.file)
              .map((p) => (
                <li key={p.key} className="flex items-center gap-2">
                  <FileText size={14} strokeWidth={1.5} className="text-ink-3" />
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <span className="font-mono text-[12px] text-ink-3">{fileSize(p.size)}</span>
                  {!busy && (
                    <button type="button" aria-label={`เอา ${p.name} ออก`} className="rounded-[6px] p-1 text-ink-3 hover:bg-raised hover:text-ink" onClick={() => setPicked((x) => x.filter((y) => y.key !== p.key))}>
                      <X size={14} strokeWidth={1.5} />
                    </button>
                  )}
                </li>
              ))}
          </ul>
        )}
        <p className="text-[12px] text-ink-3">รูปถ่ายหลายหน้าเลือกพร้อมกันได้ (สูงสุด 6 ไฟล์) PDF หลายหน้าส่งทั้งไฟล์ ไฟล์ต้นฉบับจะแนบไว้กับรายการที่บันทึก</p>
        {extra}
        {err && <p className="rounded-[8px] bg-neg-soft px-3 py-2 text-neg">{err}</p>}
      </div>
    </Modal>
  );
}
