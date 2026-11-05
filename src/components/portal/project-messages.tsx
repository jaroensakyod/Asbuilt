"use client";

// Company side of the customer chat. Mount on the project page:
//   <div id="messages"><ProjectMessages projectId={p.id} /></div>
// Customer messages are marked read when staff open the thread.

import { useEffect, useState } from "react";
import { Card, CardHead } from "@/components/ui";
import { useHydrated } from "@/components/ops/bits";
import { useMe } from "@/lib/use-me";
import { canEdit } from "@/lib/permissions";
import { markMessagesRead, portalMessages, postMessage, surveys } from "@/lib/design/store";
import { responseAvg } from "@/lib/design/satisfaction";
import { Thread, Composer } from "./message-thread";
import { ReplyDraftBar } from "@/components/ai-sales/reply-draft";

export function ProjectMessages({ projectId, title = "ข้อความกับลูกค้า" }: { projectId: string; title?: string }) {
  const me = useMe();
  const hydrated = useHydrated();
  const all = portalMessages.use();
  const srv = surveys.use();
  const list = all.filter((m) => m.projectId === projectId);
  const unread = list.filter((m) => m.side === "customer" && !m.readAt).length;
  const can = canEdit(me.role, "projects") || canEdit(me.role, "design") || canEdit(me.role, "interior");
  const [draft, setDraft] = useState("");
  const scores = srv.filter((r) => r.projectId === projectId).map((r) => ({ r, avg: responseAvg(r) }));

  useEffect(() => {
    if (hydrated && unread > 0 && can) markMessagesRead(projectId);
  }, [hydrated, unread, can, projectId]);

  return (
    <Card>
      <CardHead title={title} meta={unread ? `ใหม่ ${unread}` : list.length ? `${list.length} ข้อความ` : undefined} />
      <Thread messages={hydrated ? list : []} viewer="company" empty="ยังไม่มีข้อความจากลูกค้า ลูกค้าส่งข้อความได้จากพอร์ทัลเจ้าของบ้าน" />
      {can && hydrated && <ReplyDraftBar projectId={projectId} messages={list} onDraft={setDraft} />}
      {can && <Composer value={draft} onValueChange={setDraft} onSend={(text, files) => void postMessage(projectId, "company", me.name, text, files)} placeholder="ตอบลูกค้า (ลูกค้าเห็นในพอร์ทัล)" />}
      {scores.length > 0 && (
        <div className="border-t border-line px-4 py-3 text-[13px]">
          <p className="mb-1 text-ink-2">แบบประเมินความพึงพอใจ</p>
          <ul className="flex flex-col gap-1">
            {scores.map(({ r, avg }) => (
              <li key={r.id} className="flex items-baseline justify-between gap-3">
                <span className="text-ink-3">{r.trigger === "handover" ? "หลังส่งมอบ" : `หลังซ่อม ${r.repairId}`} · {r.at}</span>
                <span className={avg !== undefined && avg <= 2.5 ? "num font-mono text-neg" : "num font-mono"}>{avg !== undefined ? avg.toFixed(2) : "–"} / 5</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
