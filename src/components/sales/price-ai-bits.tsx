"use client";

// Small shared pieces for the AI features of /prices and the ค่า K index import.

import { useRef, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { AiUnavailable, useAiStatus } from "@/lib/ai/client";
import { compressImage } from "@/lib/media";
import { fileToAi } from "@/lib/ai/client";
import { Btn } from "@/components/ops/bits";
import { cx } from "@/components/ui";

export const I = { size: 16, strokeWidth: 1.5 } as const;

/** Thai message for any AI failure */
export function aiErrorText(e: unknown) {
  if (e instanceof AiUnavailable) return `ยังไม่ได้ตั้งค่า AI — ผู้ดูแลระบบต้องตั้งค่า GEMINI_API_KEY บนเซิร์ฟเวอร์ (${e.message})`;
  return `AI ทำงานไม่สำเร็จ: ${e instanceof Error ? e.message : String(e)}`;
}

/**
 * Run one AI call with loading / error / cancel. Cancel discards the result (the request itself
 * finishes on the server).
 */
export function useAiRun() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const token = useRef(0);
  async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    const my = ++token.current;
    setBusy(true);
    setError(null);
    try {
      const r = await fn();
      return my === token.current ? r : undefined;
    } catch (e) {
      if (my === token.current) setError(aiErrorText(e));
      return undefined;
    } finally {
      if (my === token.current) setBusy(false);
    }
  }
  const cancel = () => {
    token.current++;
    setBusy(false);
  };
  return { busy, error, setError, run, cancel };
}

export function AiButton({ children, onClick, busy, disabled, small = true }: { children: React.ReactNode; onClick: () => void; busy?: boolean; disabled?: boolean; small?: boolean }) {
  const st = useAiStatus();
  const off = st !== undefined && !st.configured;
  return (
    <Btn small={small} onClick={onClick} disabled={disabled || busy || off} title={off ? "ยังไม่ได้ตั้งค่า AI (GEMINI_API_KEY)" : undefined}>
      {busy ? <Loader2 {...I} className="animate-spin" /> : <Sparkles {...I} />}
      {children}
    </Btn>
  );
}

export function AiPill({ className }: { className?: string }) {
  return <span className={cx("inline-flex h-4 items-center rounded-[4px] border border-accent/40 px-1 text-[10px] leading-none text-accent-text", className)}>AI</span>;
}

export function AiBusy({ label, onCancel }: { label: string; onCancel: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-[10px] border border-line bg-raised/50 px-4 py-3 text-[13px] text-ink-2">
      <Loader2 {...I} className="animate-spin text-ink-3" />
      <span className="flex-1">{label}</span>
      <button type="button" onClick={onCancel} className="text-[13px] text-ink-2 hover:text-ink hover:underline">
        ยกเลิก
      </button>
    </div>
  );
}

export function AiError({ text }: { text: string | null }) {
  if (!text) return null;
  return <p className="rounded-[10px] border border-neg/30 bg-neg-soft/40 px-4 py-2.5 text-[13px] text-neg">{text}</p>;
}

/** PDF or photo → AI file part (photos shrunk to ≤ 1600 px) */
export async function docToAi(file: File) {
  const blob = file.type.startsWith("image/") ? await compressImage(file) : file;
  return fileToAi(blob);
}
export const MAX_DOC_BYTES = 8 * 1024 * 1024;
