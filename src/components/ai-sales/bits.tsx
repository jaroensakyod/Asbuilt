"use client";

// Shared UI for the AI sales & estimating helpers: entry button, "AI" pill, run state with cancel,
// Thai error messages and a copy-to-clipboard text box.

import { useCallback, useRef, useState, type ReactNode } from "react";
import { Check, Copy, Loader2, Sparkles } from "lucide-react";
import { cx } from "@/components/ui";
import { aiGenerate, AiUnavailable } from "@/lib/ai/client";
import type { JsonSchema } from "@/lib/ai/types";

export const I = { size: 16, strokeWidth: 1.5 } as const;

/** Small secondary entry button with the Sparkles icon. */
export function AiButton({ children, onClick, disabled, small = true, title }: { children: ReactNode; onClick: () => void; disabled?: boolean; small?: boolean; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-[8px] border border-line-strong bg-card font-medium text-ink transition-[background-color,transform,opacity] duration-150 hover:bg-raised active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40",
        small ? "h-8 px-3 text-[13px]" : "h-9 px-4 text-[14px]",
      )}
    >
      <Sparkles {...I} />
      {children}
    </button>
  );
}

/** Marks a value the AI filled in. */
export function AiPill({ className, label = "AI" }: { className?: string; label?: string }) {
  return <span className={cx("inline-flex h-[18px] items-center rounded-[5px] border border-accent/40 px-1 text-[11px] leading-none text-accent-text", className)}>{label}</span>;
}

export function aiErrorText(e: unknown) {
  if (e instanceof AiUnavailable) return `ยังไม่ได้ตั้งค่า AI (${e.message}) · ผู้ดูแลระบบต้องตั้งค่า GEMINI_API_KEY ในเซิร์ฟเวอร์ก่อน`;
  const m = e instanceof Error ? e.message : String(e);
  return `AI ทำงานไม่สำเร็จ: ${m || "ไม่ทราบสาเหตุ"} ลองใหม่อีกครั้ง`;
}

/**
 * One AI call at a time. `cancel()` drops the pending result (the request itself finishes on the server,
 * but nothing is shown or saved).
 */
export function useAiRun<T>() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<T | null>(null);
  const run = useRef(0);
  const start = useCallback(async (fn: () => Promise<T>) => {
    const id = ++run.current;
    setBusy(true);
    setError("");
    try {
      const r = await fn();
      if (id === run.current) setData(r);
      return id === run.current ? r : null;
    } catch (e) {
      if (id === run.current) setError(aiErrorText(e));
      return null;
    } finally {
      if (id === run.current) setBusy(false);
    }
  }, []);
  const cancel = useCallback(() => {
    run.current++;
    setBusy(false);
  }, []);
  const reset = useCallback(() => {
    run.current++;
    setBusy(false);
    setError("");
    setData(null);
  }, []);
  return { busy, error, data, setData, start, cancel, reset };
}

export function AiBusy({ text = "AI กำลังคิด อาจใช้เวลา 5–15 วินาที", onCancel }: { text?: string; onCancel?: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-[10px] border border-line bg-raised/60 px-4 py-3 text-[13px] text-ink-2" role="status">
      <Loader2 {...I} className="animate-spin" />
      <span className="flex-1">{text}</span>
      {onCancel && (
        <button type="button" onClick={onCancel} className="text-[13px] text-ink-3 hover:text-ink">
          ยกเลิก
        </button>
      )}
    </div>
  );
}

export function AiError({ text }: { text: string }) {
  if (!text) return null;
  return <p className="rounded-[10px] border border-neg/30 bg-neg-soft px-4 py-3 text-[13px] text-neg">{text}</p>;
}

/** Note shown under every AI draft. */
export function DraftNote({ children = "ร่างโดย AI ตรวจสอบและแก้ไขก่อนบันทึก" }: { children?: ReactNode }) {
  return <p className="text-[12px] text-ink-3">{children}</p>;
}

export function useCopy() {
  const [done, setDone] = useState("");
  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(key);
      setTimeout(() => setDone((d) => (d === key ? "" : d)), 1600);
    } catch {
      window.prompt("คัดลอกข้อความนี้", text);
    }
  };
  return { done, copy };
}

/** Editable text with a copy button (for LINE / email messages the user sends themselves). */
export function CopyText({ label, value, onChange, rows = 4 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  const { done, copy } = useCopy();
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-3">
          {label} <AiPill />
        </span>
        <button type="button" onClick={() => void copy(label, value)} className="inline-flex items-center gap-1 text-[12px] text-ink-2 hover:text-ink">
          {done === label ? <Check size={14} strokeWidth={1.5} /> : <Copy size={14} strokeWidth={1.5} />}
          {done === label ? "คัดลอกแล้ว" : "คัดลอก"}
        </button>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full resize-y rounded-[8px] border border-line-strong bg-card px-3 py-2 text-[14px] leading-relaxed text-ink outline-none focus:border-ink-3"
      />
    </div>
  );
}

export const taCls = "w-full resize-y rounded-[8px] border border-line-strong bg-card px-3 py-2 text-[14px] leading-relaxed text-ink outline-none placeholder:text-ink-3 focus:border-ink-3";

/** aiJson with a larger output budget (long BOQ / VO / quote drafts get cut at the 4096-token default). */
export async function aiJsonBig<T>(task: string, o: { system?: string; prompt: string; schema: JsonSchema; temperature?: number; maxOutputTokens?: number }): Promise<T> {
  const r = await aiGenerate({ task, system: o.system, messages: [{ role: "user", parts: [{ text: o.prompt }] }], json: o.schema, temperature: o.temperature, maxOutputTokens: o.maxOutputTokens ?? 12000 });
  return r.json as T;
}
