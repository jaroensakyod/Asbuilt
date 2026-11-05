"use client";

// "ถาม AI เกี่ยวกับเอกสารนี้" on the documents page: a structured summary (contract: parties, value,
// payment terms, warranty, penalties; permit; spec …) and free questions about the same file.
// The file goes with every call (the API is stateless); answers are for reading, nothing is saved.

import { useRef, useState } from "react";
import { Loader2, Paperclip, Send, Sparkles } from "lucide-react";
import { cx, inputCls } from "@/components/ui";
import { Btn, I, Modal } from "@/components/ops/bits";
import { aiGenerate, useAiStatus } from "@/lib/ai/client";
import type { AiFile, AiMessage } from "@/lib/ai/types";
import { thDate, TODAY } from "@/lib/data";
import { docQaSystem, type DocSummaryX } from "@/lib/ai-docs";
import { aiErrorText, AiButton, ConfidencePill, toAiFiles } from "./bits";
import { summarizeDoc } from "./run";

export function DocAskButton(props: DocAskProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <AiButton onClick={() => setOpen(true)}>ถาม AI</AiButton>
      {open && <DocAskDialog {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

type DocAskProps = {
  title: string;
  fileName: string;
  /** docs-data category: contract / permit / drawing / report / warranty / manual / boq / photo */
  category: string;
  /** the file bytes when this browser has them (session upload or signed URL) */
  getBlob: () => Promise<Blob | undefined>;
  mime?: string;
};

const SUGGEST: Record<string, string[]> = {
  contract: ["งวดการจ่ายเงินมีกี่งวด แต่ละงวดเท่าไร", "ค่าปรับกรณีส่งมอบล่าช้าคิดอย่างไร", "เงินประกันผลงานคืนเมื่อไร"],
  permit: ["ใบอนุญาตหมดอายุเมื่อไร", "มีเงื่อนไขอะไรที่ต้องทำระหว่างก่อสร้าง"],
  manual: ["สเปกวัสดุหลักมีอะไรบ้าง", "มาตรฐานที่อ้างถึงมีอะไรบ้าง"],
  warranty: ["รับประกันกี่ปี ครอบคลุมอะไร", "อะไรไม่อยู่ในการรับประกัน"],
};

function DocAskDialog({ title, fileName, category, getBlob, mime, onClose }: DocAskProps & { onClose: () => void }) {
  const status = useAiStatus();
  const [file, setFile] = useState<AiFile | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState<"" | "summary" | "ask">("");
  const [err, setErr] = useState("");
  const [summary, setSummary] = useState<DocSummaryX | null>(null);
  const [chat, setChat] = useState<AiMessage[]>([]);
  const [q, setQ] = useState("");
  const run = useRef(0);
  const pick = useRef<HTMLInputElement>(null);

  const loadFile = async (): Promise<AiFile | null> => {
    if (file) return file;
    const blob = await getBlob().catch(() => undefined);
    if (!blob) {
      setMissing(true);
      return null;
    }
    const [f] = await toAiFiles([{ file: new File([blob], fileName, { type: blob.type || mime || "application/pdf" }) }]);
    setFile(f);
    return f;
  };
  const guard = async (kind: "summary" | "ask", fn: (f: AiFile, id: number) => Promise<void>) => {
    const id = ++run.current;
    setErr("");
    setBusy(kind);
    try {
      const f = await loadFile();
      if (f) await fn(f, id);
    } catch (e) {
      if (id === run.current) setErr(aiErrorText(e));
    } finally {
      if (id === run.current) setBusy("");
    }
  };
  const doSummary = () =>
    guard("summary", async (f, id) => {
      const r = await summarizeDoc([f], category, title);
      if (id === run.current) setSummary(r);
    });
  const ask = (text: string) => {
    const question = text.trim();
    if (!question) return;
    setQ("");
    void guard("ask", async (f, id) => {
      const first = chat.length === 0;
      const userTurn: AiMessage = { role: "user", parts: first ? [{ file: f }, { text: question }] : [{ text: question }] };
      const history = first ? [userTurn] : [...chat, userTurn];
      setChat(history);
      const r = await aiGenerate({ task: "doc-qa", system: docQaSystem(TODAY, title), messages: history, temperature: 0.2 });
      if (id === run.current) setChat([...history, { role: "model", parts: [{ text: r.text ?? "" }], raw: r.message.raw }]);
    });
  };
  const cancel = () => {
    run.current++;
    setBusy("");
  };

  const off = status && !status.configured;
  // plain text: drop markdown emphasis, turn "* " bullets into "• "
  const textOf = (m: AiMessage) =>
    m.parts
      .map((p) => ("text" in p ? p.text : ""))
      .join("")
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/^\s*[*-]\s+/gm, "• ");
  return (
    <Modal open onClose={() => (cancel(), onClose())} width={760} title={`ถาม AI · ${title}`} footer={<span className="mr-auto text-[12px] text-ink-3">คำตอบจาก AI อ่านจากไฟล์นี้เท่านั้น ตรวจกับต้นฉบับก่อนใช้ ไม่ใช่คำปรึกษากฎหมาย</span>}>
      <div className="flex flex-col gap-4 text-[13px]">
        {off && <p className="rounded-[8px] bg-warn-soft px-3 py-2 text-warn">ยังไม่ได้ตั้งค่า AI ผู้ดูแลระบบต้องใส่ GEMINI_API_KEY ในการตั้งค่าเซิร์ฟเวอร์ก่อน</p>}
        {missing && (
          <div className="flex flex-wrap items-center gap-2 rounded-[8px] bg-raised px-3 py-2 text-ink-2">
            ไฟล์ต้นฉบับไม่อยู่ในเบราว์เซอร์นี้ (ไฟล์ตัวอย่างหรืออัปโหลดในเซสชันอื่น) เลือกไฟล์เดียวกันอีกครั้งเพื่อให้ AI อ่าน
            <Btn small onClick={() => pick.current?.click()}>
              <Paperclip {...I} />
              เลือกไฟล์
            </Btn>
            <input
              ref={pick}
              type="file"
              accept="image/*,application/pdf"
              hidden
              onChange={async (e) => {
                const f0 = e.target.files?.[0];
                e.target.value = "";
                if (!f0) return;
                try {
                  const [f] = await toAiFiles([{ file: f0 }]);
                  setFile(f);
                  setMissing(false);
                } catch (x) {
                  setErr(aiErrorText(x));
                }
              }}
            />
          </div>
        )}

        <div className="flex items-center gap-2">
          <Btn primary small onClick={doSummary} disabled={!!busy || !!off}>
            <Sparkles {...I} />
            {summary ? "สรุปใหม่" : "สรุปเอกสารนี้"}
          </Btn>
          {busy && (
            <span className="inline-flex items-center gap-2 text-ink-2">
              <Loader2 {...I} className="animate-spin" />
              {busy === "summary" ? "AI กำลังอ่านและสรุป 5–30 วินาที" : "AI กำลังหาคำตอบ"}
              <button type="button" className="text-ink-3 hover:underline" onClick={cancel}>
                ยกเลิก
              </button>
            </span>
          )}
        </div>

        {summary && (
          <div className="rounded-[12px] border border-line px-4 py-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[14px] font-medium">{summary.title}</p>
              <ConfidencePill c={summary.confidence} />
            </div>
            <p className="whitespace-pre-line text-ink">{summary.summary}</p>
            {summary.facts.length > 0 && (
              <dl className="mt-3 grid grid-cols-[160px_minmax(0,1fr)] gap-x-3 gap-y-1.5 border-t border-line pt-3">
                {summary.facts.map((f, i) => (
                  <div key={i} className="contents">
                    <dt className="text-ink-3">{f.label}</dt>
                    <dd>{f.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {summary.keyDates.length > 0 && (
              <div className="mt-3 border-t border-line pt-3">
                <p className="mb-1 text-ink-3">วันสำคัญ</p>
                <ul className="flex flex-col gap-1">
                  {summary.keyDates.map((d, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="w-[120px] shrink-0 font-mono">{/^\d{4}-\d{2}-\d{2}$/.test(d.date) ? thDate(d.date) : d.date || "–"}</span>
                      <span>{d.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {summary.risks.length > 0 && (
              <div className="mt-3 border-t border-line pt-3">
                <p className="mb-1 text-ink-3">ข้อควรระวัง</p>
                <ul className="list-disc pl-5 text-warn">
                  {summary.risks.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="rounded-[12px] border border-line">
          <div className="max-h-[320px] overflow-y-auto px-4 py-3">
            {!chat.length && (
              <div className="flex flex-col gap-2 text-ink-3">
                <p>ถามอะไรก็ได้เกี่ยวกับเอกสารนี้</p>
                <div className="flex flex-wrap gap-1.5">
                  {(SUGGEST[category] ?? ["สรุปประเด็นสำคัญ 5 ข้อ", "มีวันที่หรือกำหนดเวลาอะไรบ้าง"]).map((s) => (
                    <button key={s} type="button" disabled={!!busy || !!off} onClick={() => ask(s)} className="rounded-[8px] border border-line px-2 py-1 text-ink-2 hover:border-line-strong hover:text-ink disabled:opacity-50">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-col gap-2">
              {chat.map((m, i) => (
                <div key={i} className={cx("max-w-[85%] whitespace-pre-line rounded-[10px] px-3 py-2", m.role === "user" ? "self-end bg-raised text-ink" : "self-start border border-line text-ink")}>
                  {textOf(m)}
                </div>
              ))}
            </div>
          </div>
          <form
            className="flex gap-2 border-t border-line px-3 py-2"
            onSubmit={(e) => {
              e.preventDefault();
              ask(q);
            }}
          >
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="เช่น ผู้รับเหมาต้องวางหลักประกันเท่าไร" className={cx(inputCls, "flex-1")} disabled={!!busy || !!off} aria-label="คำถาม" />
            <Btn type="submit" small disabled={!q.trim() || !!busy || !!off}>
              <Send {...I} />
              ถาม
            </Btn>
          </form>
        </div>
        {err && <p className="rounded-[8px] bg-neg-soft px-3 py-2 text-neg">{err}</p>}
      </div>
    </Modal>
  );
}
