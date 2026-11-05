"use client";

// "ร่างคำตอบ" for the staff side of the customer chat. Builds a small project digest from the
// collections the signed-in role can view and drafts a polite Thai reply into the composer.
// Staff edit and press send themselves; nothing is sent automatically.

import { useState } from "react";
import { cx, inputCls } from "@/components/ui";
import { aiText } from "@/lib/ai/client";
import { installments, variations } from "@/lib/biz";
import { getProject, TODAY } from "@/lib/data";
import { useLocalProjects } from "@/lib/projects-store";
import { useRepairs } from "@/lib/ops-store";
import { selections } from "@/lib/interior/store";
import { canView } from "@/lib/permissions";
import { useMe } from "@/lib/use-me";
import type { PortalMessage } from "@/lib/design/types";
import { cleanReply, replyContext, replyPrompt, SYSTEM_REPLY } from "@/lib/ai-sales/reply";
import { AiBusy, AiButton, AiError, useAiRun } from "./bits";

export function ReplyDraftBar({ projectId, messages, onDraft }: { projectId: string; messages: PortalMessage[]; onDraft: (text: string) => void }) {
  const me = useMe();
  const local = useLocalProjects();
  const inst = installments.use();
  const vos = variations.use();
  const reps = useRepairs();
  const sels = selections.use();
  const [open, setOpen] = useState(false);
  const [ending, setEnding] = useState<"ครับ" | "ค่ะ">("ค่ะ");
  const [hint, setHint] = useState("");
  const ai = useAiRun<string>();

  const project = local.find((p) => p.id === projectId) ?? getProject(projectId);

  const draft = async () => {
    if (!project) return;
    const ctx = replyContext({
      project: { id: project.id, name: project.name, owner: project.owner, phase: project.phase, actual: project.actual, plan: project.plan, finish: project.finish, status: project.status, pm: project.pm },
      // only data this role may view goes to the model
      installments: canView(me.role, "accounting") || canView(me.role, "costs") ? inst : undefined,
      repairs: canView(me.role, "repairs") ? reps : undefined,
      selections: canView(me.role, "interior") ? sels : undefined,
      variations: canView(me.role, "contracts") ? vos : undefined,
      messages,
    });
    const r = await ai.start(() => aiText("portal-reply", { system: SYSTEM_REPLY, prompt: replyPrompt(ctx, { staffName: me.name, politeEnding: ending, instruction: hint.trim() || undefined, today: TODAY }), temperature: 0.5 }));
    if (r) onDraft(cleanReply(r));
  };

  if (!open)
    return (
      <div className="flex justify-end px-4 pb-3">
        <AiButton onClick={() => setOpen(true)} disabled={!project}>
          ร่างคำตอบ
        </AiButton>
      </div>
    );

  return (
    <div className="flex flex-col gap-2 px-4 pb-3">
      <div className="flex flex-wrap items-center gap-2">
        <input className={cx(inputCls, "h-8 min-w-[200px] flex-1 text-[13px]")} value={hint} onChange={(e) => setHint(e.target.value)} placeholder="บอก AI เพิ่ม (ไม่บังคับ) เช่น แจ้งว่าช่างจะเข้าวันศุกร์" aria-label="คำสั่งเพิ่มเติม" />
        <select className={cx(inputCls, "h-8 text-[13px]")} value={ending} onChange={(e) => setEnding(e.target.value as "ครับ" | "ค่ะ")} aria-label="คำลงท้าย">
          <option value="ค่ะ">ลงท้าย ค่ะ</option>
          <option value="ครับ">ลงท้าย ครับ</option>
        </select>
        <AiButton onClick={() => void draft()} disabled={ai.busy}>
          ร่างคำตอบ
        </AiButton>
        <button type="button" onClick={() => (ai.reset(), setOpen(false))} className="text-[13px] text-ink-3 hover:text-ink">
          ปิด
        </button>
      </div>
      {ai.busy && <AiBusy onCancel={ai.cancel} />}
      <AiError text={ai.error} />
      {ai.data && !ai.busy && <p className="text-[12px] text-ink-3">ร่างโดย AI ใส่ไว้ในช่องพิมพ์แล้ว ตรวจและแก้ไขก่อนกดส่ง</p>}
    </div>
  );
}
