"use client";

// Rule-based flags (always) + an optional AI review that explains them and adds what rules miss.

import { useMemo, useState } from "react";
import { LoaderCircle, ShieldCheck } from "lucide-react";
import { Card, cx } from "@/components/ui";
import { AiButton } from "@/components/ai-sales/bits";
import { aiJson, useAiStatus } from "@/lib/ai/client";
import { REVIEW_SCHEMA, reviewPrompt, takeoffFlags, type AiReview, type Severity } from "@/lib/takeoff/checks";
import type { CatSummary, TakeoffItem, TakeoffSource, Wall } from "@/lib/takeoff/types";

const SEV: Record<Severity, { label: string; cls: string }> = {
  high: { label: "สำคัญ", cls: "bg-[#d9483b]/12 text-[#b3352a]" },
  medium: { label: "ควรตรวจ", cls: "bg-[#f2a23a]/18 text-[#8a5a12]" },
  low: { label: "หมายเหตุ", cls: "bg-raised text-ink-2" },
};

export function ReviewCard(p: { project: string; source: TakeoffSource; walls: Wall[]; items: TakeoffItem[]; summary: CatSummary[]; onCode: (code: string) => void }) {
  const flags = useMemo(() => takeoffFlags(p.source, p.walls, p.items, p.summary), [p.source, p.walls, p.items, p.summary]);
  const ai = useAiStatus();
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<AiReview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const prompt = reviewPrompt({ project: p.project, source: p.source, walls: p.walls, items: p.items, summary: p.summary, flags });
      setReview(await aiJson<AiReview>("takeoff-review", { ...prompt, schema: REVIEW_SCHEMA, temperature: 0.2 }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const Codes = ({ codes }: { codes: string[] }) =>
    codes.length ? (
      <span className="mt-1 flex flex-wrap gap-1">
        {codes.slice(0, 8).map((c) => (
          <button key={c} type="button" onClick={() => p.onCode(c)} className="rounded-[4px] border border-line-strong px-1.5 font-mono text-[11px] hover:bg-raised">
            {c}
          </button>
        ))}
      </span>
    ) : null;

  return (
    <Card>
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="flex items-center gap-1.5 text-[14px] font-medium">
          <ShieldCheck size={16} strokeWidth={1.5} /> ตรวจความผิดปกติ
        </h2>
        <span className="font-mono text-[12px] text-ink-3">{flags.length} ข้อ</span>
      </div>
      <div className="flex flex-col gap-2 px-4 py-3 text-[13px]">
        {flags.length ? (
          <ul className="flex max-h-[260px] flex-col gap-2 overflow-auto">
            {flags.map((f) => (
              <li key={f.id} className="flex flex-col">
                <span className="flex items-start gap-1.5">
                  <span className={cx("shrink-0 rounded-[4px] px-1.5 text-[11px] leading-[18px]", SEV[f.severity].cls)}>{SEV[f.severity].label}</span>
                  <span className="text-ink">{f.title}</span>
                </span>
                <span className="pl-1 text-[12px] text-ink-3">{f.detail}</span>
                <Codes codes={f.codes} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-3">กฎตรวจอัตโนมัติไม่พบความผิดปกติ</p>
        )}

        <div className="mt-1 border-t border-line pt-2.5">
          <AiButton onClick={run} disabled={busy || ai?.configured === false} title={ai?.configured === false ? "ยังไม่ได้ตั้งค่า GEMINI_API_KEY" : undefined}>
            {busy ? "กำลังให้ AI ตรวจ" : "ให้ AI ตรวจและสรุป"}
          </AiButton>
          {ai?.configured === false && <p className="mt-1.5 text-[12px] text-ink-3">ยังไม่ได้ตั้งค่า AI (GEMINI_API_KEY) ใช้ผลจากกฎตรวจด้านบนได้</p>}
          {busy && (
            <p className="mt-2 flex items-center gap-1.5 text-ink-3">
              <LoaderCircle size={14} strokeWidth={1.5} className="animate-spin" /> ส่งตัวเลขสรุปให้ AI (ไม่ส่งชื่อลูกค้า)
            </p>
          )}
          {error && <p className="mt-2 text-[12px] text-accent-text">AI ตรวจไม่สำเร็จ: {error}</p>}
          {review && (
            <div className="mt-2 flex flex-col gap-2">
              <p className="leading-relaxed text-ink-2">{review.summary}</p>
              <ul className="flex flex-col gap-2">
                {review.issues.map((x, i) => (
                  <li key={i} className="rounded-[8px] border border-line px-2.5 py-2">
                    <span className="flex items-start gap-1.5">
                      <span className={cx("shrink-0 rounded-[4px] px-1.5 text-[11px] leading-[18px]", SEV[x.severity]?.cls ?? SEV.low.cls)}>{SEV[x.severity]?.label ?? "หมายเหตุ"}</span>
                      <span className="text-ink">{x.title}</span>
                    </span>
                    <p className="mt-0.5 text-[12px] text-ink-2">{x.detail}</p>
                    {x.suggestion && <p className="mt-0.5 text-[12px] text-ink-3">ควรทำ: {x.suggestion}</p>}
                    <Codes codes={x.codes ?? []} />
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-ink-3">ผลจาก AI เป็นข้อสังเกต ต้องตรวจกับแบบจริง</p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
