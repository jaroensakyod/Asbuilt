"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AiUnavailable, fileToAi, runToolLoop } from "@/lib/ai/client";
import type { AiFile, AiMessage } from "@/lib/ai/types";
import { compressImage } from "@/lib/media";
import { useMe } from "@/lib/use-me";
import { useCompanyTools, useAssistantPrompt } from "@/lib/ai/tools/use-company-tools";
import { TOOL_LABEL } from "@/lib/ai/tools/company";
import { aiChats, newChatId, newMsgId, saveChat, type AiChat } from "@/lib/ai/tools/chats";
import { chatTitle, historyForModel, type ChatMsg } from "@/lib/ai/tools/prompt";

export const MAX_FILES = 4;
export const MAX_FILE_MB = 8;
export const acceptsFile = (f: File) => f.type.startsWith("image/") || f.type === "application/pdf";

/** chat shown last in this tab, so the drawer and /assistant reopen where the user was */
let lastChatId: string | undefined;

class Stopped extends Error {}

export type ChatError = { text: string; setup?: boolean };

export function useAiChat(pathname?: string | null) {
  const me = useMe();
  const owner = me.email || me.name;
  const tools = useCompanyTools();
  const system = useAssistantPrompt(pathname);
  const all = aiChats.use();
  const chats = useMemo(() => all.filter((c) => c.owner === owner).sort((a, b) => b.updated.localeCompare(a.updated)), [all, owner]);
  const [chatId, setChatId] = useState<string | undefined>(lastChatId);
  const chat = chats.find((c) => c.id === chatId);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<string>();
  const [error, setError] = useState<ChatError>();
  const run = useRef<{ stopped: boolean } | null>(null);

  useEffect(() => {
    lastChatId = chatId;
  }, [chatId]);

  const select = useCallback((id: string | undefined) => {
    setChatId(id);
    setError(undefined);
  }, []);

  const stop = useCallback(() => {
    if (run.current) run.current.stopped = true;
  }, []);

  const send = useCallback(
    async (text: string, files: File[] = []) => {
      const q = text.trim();
      if ((!q && !files.length) || busy) return;
      setError(undefined);
      const now = new Date().toISOString();
      const userMsg: ChatMsg = { id: newMsgId(), role: "user", text: q, at: now, files: files.length ? files.map((f) => ({ name: f.name, type: f.type, size: f.size })) : undefined };
      const base: AiChat = chat ?? { id: newChatId(), owner, title: chatTitle(q || files[0]?.name || ""), created: now, updated: now, page: pathname ?? undefined, messages: [] };
      const prior = base.messages;
      const id = base.id;
      saveChat({ ...base, updated: now, messages: [...prior, userMsg] });
      setChatId(id);

      const token = { stopped: false };
      run.current = token;
      setBusy(true);
      setStep(undefined);
      const steps: string[] = [];
      const finish = (msg: Omit<ChatMsg, "id" | "at">) => {
        const cur = aiChats.get(id);
        if (!cur) return;
        saveChat({ ...cur, updated: new Date().toISOString(), messages: [...cur.messages, { id: newMsgId(), at: new Date().toISOString(), ...msg }] });
      };
      try {
        const aiFiles: AiFile[] = [];
        for (const f of files) aiFiles.push(await fileToAi(f.type.startsWith("image/") ? await compressImage(f) : f));
        const history: AiMessage[] = historyForModel(prior).map((m) => ({ role: m.role, parts: [{ text: m.text }] }));
        const messages: AiMessage[] = [...history, { role: "user", parts: [...aiFiles.map((file) => ({ file })), { text: q || "อธิบายไฟล์ที่แนบมา" }] }];
        const res = await runToolLoop({
          task: "chat",
          system,
          messages,
          tools,
          maxSteps: 6,
          onStep: (name) => {
            if (token.stopped) throw new Stopped();
            const label = TOOL_LABEL[name] ?? name;
            if (!steps.includes(label)) steps.push(label);
            setStep(label);
          },
        });
        if (token.stopped) finish({ role: "model", text: "หยุดแล้ว", notice: "stopped", steps });
        else finish({ role: "model", text: res.text.trim() || "ขออภัย ไม่ได้คำตอบจาก AI ลองถามใหม่อีกครั้ง", steps: steps.length ? steps : undefined });
      } catch (e) {
        if (token.stopped || e instanceof Stopped) finish({ role: "model", text: "หยุดแล้ว", notice: "stopped", steps });
        else if (e instanceof AiUnavailable) setError({ text: e.message || "ยังไม่ได้ตั้งค่า AI", setup: true });
        else setError({ text: `AI ตอบไม่สำเร็จ: ${e instanceof Error ? e.message : String(e)}` });
      } finally {
        if (run.current === token) run.current = null;
        setBusy(false);
        setStep(undefined);
      }
    },
    [busy, chat, owner, pathname, system, tools],
  );

  const remove = useCallback(
    (id: string) => {
      aiChats.remove(id);
      if (id === chatId) setChatId(undefined);
    },
    [chatId],
  );

  return { me, chats, chat, chatId, select, send, stop, remove, busy, step, error, clearError: () => setError(undefined) };
}
