"use client";

// Small kit shared by every field-assistant entry point: the Sparkles button, busy/error rows,
// the "AI" pill, photo → AI files, and a run() hook with cancel (late answers are ignored).

import { useCallback, useRef, useState, type ReactNode } from "react";
import { Loader2, Sparkles, X } from "lucide-react";
import { cx } from "@/components/ui";
import { I } from "@/components/ops/bits";
import { AiUnavailable, mediaToAi } from "@/lib/ai/client";
import type { AiFile } from "@/lib/ai/types";
import { isImage, type MediaRef } from "@/lib/media";

export function aiErrorText(e: unknown): string {
  if (e instanceof AiUnavailable) {
    return /ตั้งค่า|GEMINI/.test(e.message) ? "ยังไม่ได้ตั้งค่า AI · ให้ผู้ดูแลระบบใส่ GEMINI_API_KEY ในไฟล์ .env.local แล้วรีสตาร์ตเซิร์ฟเวอร์ (ดูที่ ตั้งค่า › ผู้ช่วย AI)" : e.message;
  }
  const m = e instanceof Error ? e.message : String(e);
  return `AI ทำงานไม่สำเร็จ ลองใหม่อีกครั้ง${m ? ` (${m.slice(0, 160)})` : ""}`;
}

/** run an AI call with busy / error / cancel; returns undefined when cancelled or failed */
export function useAiRun() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const token = useRef(0);
  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    const my = ++token.current;
    setBusy(true);
    setError("");
    try {
      const r = await fn();
      return my === token.current ? r : undefined;
    } catch (e) {
      if (my === token.current) setError(aiErrorText(e));
      return undefined;
    } finally {
      if (my === token.current) setBusy(false);
    }
  }, []);
  const cancel = useCallback(() => {
    token.current++;
    setBusy(false);
  }, []);
  return { busy, error, run, cancel, clearError: () => setError("") };
}

/** up to `max` image MediaRefs → inline files for the model (MediaRef photos are already ≤ 1600 px) */
export async function photosToAi(refs: readonly MediaRef[] | undefined, max = 4): Promise<AiFile[]> {
  const imgs = (refs ?? []).filter(isImage).slice(0, max);
  const files = await Promise.all(imgs.map((r) => mediaToAi(r).catch(() => undefined)));
  return files.filter((f): f is AiFile => !!f);
}

/** secondary Sparkles button; `phone` = 48 px full-width touch target */
export function AiButton({ children, onClick, disabled, phone, title }: { children: ReactNode; onClick: () => void; disabled?: boolean; phone?: boolean; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cx(
        "inline-flex items-center justify-center gap-2 border border-line-strong bg-card font-medium text-ink transition-[background-color,transform,opacity] duration-150 hover:bg-raised active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40",
        phone ? "h-12 w-full rounded-[12px] text-[15px]" : "h-8 rounded-[8px] px-3 text-[13px]",
      )}
    >
      <Sparkles {...I} />
      {children}
    </button>
  );
}

/** subtle marker next to a field the AI filled */
export function AiPill({ title = "AI กรอกให้ ตรวจทานก่อนบันทึก" }: { title?: string }) {
  return (
    <span title={title} className="inline-flex h-[18px] items-center gap-1 rounded-[5px] bg-accent-soft px-1.5 align-middle text-[11px] font-normal leading-none text-accent-text">
      <Sparkles size={11} strokeWidth={1.5} />
      AI
    </span>
  );
}

export function AiBusy({ onCancel, label = "AI กำลังอ่าน", phone }: { onCancel: () => void; label?: string; phone?: boolean }) {
  return (
    <div role="status" className={cx("flex items-center gap-2 text-ink-2", phone ? "min-h-12 text-[14px]" : "text-[13px]")}>
      <Loader2 {...I} className="animate-spin text-ink-3" />
      <span className="min-w-0 flex-1">{label} · ปกติใช้เวลา 2–15 วินาที</span>
      <button type="button" onClick={onCancel} className={cx("rounded-[8px] px-2 text-ink-2 hover:bg-raised", phone ? "h-10" : "h-7")}>
        ยกเลิก
      </button>
    </div>
  );
}

export function AiError({ text, onClose, phone }: { text: string; onClose?: () => void; phone?: boolean }) {
  if (!text) return null;
  return (
    <div role="alert" className={cx("flex items-start gap-2 rounded-[10px] bg-neg-soft px-3 py-2 text-neg", phone ? "text-[14px]" : "text-[13px]")}>
      <span className="min-w-0 flex-1">{text}</span>
      {onClose && (
        <button type="button" aria-label="ปิด" onClick={onClose} className="shrink-0 text-neg/80 hover:text-neg">
          <X {...I} />
        </button>
      )}
    </div>
  );
}

/** bordered panel that holds an assistant's input and result */
export function AiPanel({ title, children, onClose, phone, className }: { title: string; children: ReactNode; onClose?: () => void; phone?: boolean; className?: string }) {
  return (
    <section className={cx("flex flex-col gap-3 border border-line bg-raised/40", phone ? "rounded-[14px] p-3" : "rounded-[10px] p-3", className)}>
      <div className="flex items-center gap-2">
        <Sparkles {...I} className="text-ink-3" />
        <h3 className={cx("min-w-0 flex-1 font-medium", phone ? "text-[15px]" : "text-[14px]")}>{title}</h3>
        {onClose && (
          <button type="button" aria-label="ปิดผู้ช่วย AI" onClick={onClose} className={cx("inline-flex items-center justify-center rounded-[8px] text-ink-3 hover:bg-raised hover:text-ink", phone ? "size-10" : "size-7")}>
            <X {...I} />
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

/** the line under a filled form: what the AI filled and that a human must check it */
export function AiFilledNote({ fields, onUndo, phone }: { fields: string[]; onUndo?: () => void; phone?: boolean }) {
  if (!fields.length) return null;
  return (
    <p className={cx("flex flex-wrap items-center gap-x-2 gap-y-1 text-ink-2", phone ? "text-[14px]" : "text-[13px]")}>
      <AiPill />
      <span className="min-w-0 flex-1">AI กรอก {fields.join(" · ")} ให้แล้ว เป็นร่าง ตรวจทานและแก้ก่อนบันทึก</span>
      {onUndo && (
        <button type="button" onClick={onUndo} className={cx("rounded-[8px] px-2 text-ink-2 underline-offset-2 hover:underline", phone ? "h-10" : "h-7")}>
          ย้อนกลับ
        </button>
      )}
    </p>
  );
}
