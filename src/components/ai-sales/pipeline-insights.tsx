"use client";

// "สรุปไปป์ไลน์ให้หน่อย" on /sales: AI summary of pipeline health, stalled leads and next actions,
// from a small aggregated digest (no phone numbers or contact details are sent).

import { useState } from "react";
import Link from "next/link";
import { Btn, Modal } from "@/components/ops/bits";
import { aiJson } from "@/lib/ai/client";
import { TODAY } from "@/lib/data";
import { canView } from "@/lib/permissions";
import { leads, quotes, quoteTotals, SOURCE_LABEL, STAGE_LABEL, STAGE_WEIGHT } from "@/lib/sales/crm";
import { useMe } from "@/lib/use-me";
import { cleanInsights, INSIGHTS_SCHEMA, insightsPrompt, pipelineDigest, SYSTEM_INSIGHTS, type Insights, type PipelineDigest } from "@/lib/ai-sales/pipeline";
import { AiBusy, AiButton, AiError, DraftNote, useAiRun } from "./bits";

export function PipelineInsightsButton() {
  const me = useMe();
  const [open, setOpen] = useState(false);
  if (!canView(me.role, "sales")) return null;
  return (
    <>
      <AiButton small={false} onClick={() => setOpen(true)}>
        สรุปไปป์ไลน์ให้หน่อย
      </AiButton>
      {open && <InsightsModal onClose={() => setOpen(false)} />}
    </>
  );
}

function InsightsModal({ onClose }: { onClose: () => void }) {
  const ls = leads.use();
  const qs = quotes.use();
  const ai = useAiRun<{ ins: Insights; d: PipelineDigest }>();

  const run = () =>
    ai.start(async () => {
      const d = pipelineDigest(
        ls,
        qs.map((q) => ({ id: q.id, leadId: q.leadId, status: q.status, date: q.date, validDays: q.validDays, total: quoteTotals(q).total })),
        { today: TODAY, weights: STAGE_WEIGHT },
      );
      const ins = await aiJson<Insights>("sales-insights", { system: SYSTEM_INSIGHTS, prompt: insightsPrompt(d, STAGE_LABEL, SOURCE_LABEL), schema: INSIGHTS_SCHEMA, temperature: 0.3 });
      return { ins: cleanInsights(ins, d, ls.map((l) => l.id)), d };
    });

  const r = ai.data;
  const name = (id: string) => ls.find((l) => l.id === id)?.name ?? "";

  return (
    <Modal
      open
      onClose={onClose}
      title="สรุปไปป์ไลน์การขายโดย AI"
      width={760}
      footer={
        <>
          <Btn onClick={onClose}>ปิด</Btn>
          {!ai.busy && (
            <AiButton small={false} onClick={() => void run()}>
              {r ? "สรุปใหม่" : "เริ่มสรุป"}
            </AiButton>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {!r && !ai.busy && !ai.error && <p className="text-[14px] text-ink-2">AI จะอ่านตัวเลขสรุปของลีดและใบเสนอราคา (จำนวนตามขั้น มูลค่า ลีดที่ค้าง ใบเสนอราคาใกล้หมดอายุ) ไม่ส่งเบอร์โทรหรือข้อมูลติดต่อลูกค้า</p>}
        {ai.busy && <AiBusy onCancel={ai.cancel} />}
        <AiError text={ai.error} />
        {r && (
          <>
            <p className="rounded-[10px] bg-raised px-4 py-3 text-[14px] leading-relaxed text-ink">{r.ins.health}</p>
            <p className="text-[12px] text-ink-3">
              ลีดเปิด {r.d.openLeads} ราย · ถ่วงน้ำหนัก {r.d.weightedM} ล้าน · ใหม่ 30 วัน {r.d.new30} ราย · ใบเสนอราคาใกล้หมดอายุ {r.d.expiringQuotes.length} ฉบับ
            </p>
            {r.ins.highlights.length > 0 && (
              <section>
                <p className="mb-1 text-[14px] font-medium">ข้อสังเกต</p>
                <ul className="list-disc space-y-0.5 pl-5 text-[13px] text-ink-2">
                  {r.ins.highlights.map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              </section>
            )}
            {r.ins.stalled.length > 0 && (
              <section>
                <p className="mb-1 text-[14px] font-medium">ลีดที่ควรรีบตาม</p>
                <ul className="divide-y divide-line rounded-[10px] border border-line">
                  {r.ins.stalled.map((s) => (
                    <li key={s.leadId} className="px-4 py-2 text-[13px]">
                      <Link href={`/sales/${s.leadId}`} className="font-mono text-[12px] text-accent-text hover:underline">
                        {s.leadId}
                      </Link>{" "}
                      <span className="text-ink">{name(s.leadId)}</span>
                      <span className="block text-ink-2">{s.why}</span>
                      <span className="block text-ink">→ {s.action}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {r.ins.actions.length > 0 && (
              <section>
                <p className="mb-1 text-[14px] font-medium">สิ่งที่ควรทำสัปดาห์นี้</p>
                <ol className="list-decimal space-y-0.5 pl-5 text-[13px] text-ink-2">
                  {r.ins.actions.map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ol>
              </section>
            )}
            <DraftNote>สรุปโดย AI จากตัวเลขในระบบ ณ วันที่ {TODAY} ตรวจสอบก่อนนำไปใช้</DraftNote>
          </>
        )}
      </div>
    </Modal>
  );
}
