"use client";

// Quote detail: draft a follow-up message for LINE / email. Text only — the user copies and sends it.

import { useState } from "react";
import { Btn, Modal } from "@/components/ops/bits";
import { aiText } from "@/lib/ai/client";
import { getHouseModel, TODAY } from "@/lib/data";
import { leads, QUOTE_STATUS_LABEL, quoteStatus, quoteTotals, validUntil, type Quote } from "@/lib/sales/crm";
import { followUpPrompt, SYSTEM_FOLLOWUP } from "@/lib/ai-sales/quote";
import { cleanReply } from "@/lib/ai-sales/reply";
import { AiBusy, AiButton, AiError, CopyText, DraftNote, useAiRun } from "./bits";

export function QuoteFollowUpButton({ q }: { q: Quote }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <AiButton small={false} onClick={() => setOpen(true)}>
        ร่างข้อความติดตาม
      </AiButton>
      {open && <FollowUpModal q={q} onClose={() => setOpen(false)} />}
    </>
  );
}

function FollowUpModal({ q, onClose }: { q: Quote; onClose: () => void }) {
  const [channel, setChannel] = useState<"line" | "email">("line");
  const [text, setText] = useState("");
  const ai = useAiRun<string>();
  const run = async () => {
    const lead = q.leadId ? leads.get(q.leadId) : undefined;
    const last = lead ? [...lead.activities].sort((a, b) => a.date.localeCompare(b.date)).at(-1) : undefined;
    const m = getHouseModel(q.modelCode);
    const r = await ai.start(() =>
      aiText("quote-followup", {
        system: SYSTEM_FOLLOWUP,
        prompt: followUpPrompt({
          quoteId: q.id,
          customer: q.customer.name || "ลูกค้า",
          model: m ? `${m.name} (${m.code})` : q.modelCode,
          total: quoteTotals(q).total,
          validUntil: validUntil(q),
          status: QUOTE_STATUS_LABEL[quoteStatus(q)],
          options: q.options.map((o) => o.name),
          lastActivity: last ? `${last.date} ${last.text}` : undefined,
          channel,
          owner: q.owner,
          today: TODAY,
        }),
        temperature: 0.5,
      }),
    );
    if (r) setText(cleanReply(r));
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`ข้อความติดตาม ${q.id}`}
      width={620}
      footer={
        <>
          <Btn onClick={onClose}>ปิด</Btn>
          <AiButton small={false} onClick={() => void run()} disabled={ai.busy}>
            {text ? "ร่างใหม่" : "ร่างด้วย AI"}
          </AiButton>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex gap-4 text-[13px] text-ink-2">
          {(["line", "email"] as const).map((c) => (
            <label key={c} className="inline-flex items-center gap-1.5">
              <input type="radio" name="fu-channel" checked={channel === c} onChange={() => setChannel(c)} />
              {c === "line" ? "LINE" : "อีเมล"}
            </label>
          ))}
        </div>
        {ai.busy && <AiBusy onCancel={ai.cancel} />}
        <AiError text={ai.error} />
        {text && <CopyText label="ข้อความ" value={text} onChange={setText} rows={8} />}
        <DraftNote>ระบบไม่ส่งข้อความให้ คัดลอกไปส่งเองทาง LINE หรืออีเมล</DraftNote>
      </div>
    </Modal>
  );
}
