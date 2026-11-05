"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowUp, Check, Copy, FileText, History, Image as ImageIcon, Maximize2, MessageSquarePlus, Paperclip, Sparkles, Square, Trash2, X } from "lucide-react";
import { cx } from "@/components/ui";
import { I, IconBtn } from "@/components/ops/bits";
import { useAiStatus } from "@/lib/ai/client";
import { pageRef, starterQuestions, type ChatMsg } from "@/lib/ai/tools/prompt";
import type { AiChat } from "@/lib/ai/tools/chats";
import { Markdown } from "./markdown";
import { acceptsFile, MAX_FILE_MB, MAX_FILES, useAiChat, type ChatError } from "./use-ai-chat";

type Chat = ReturnType<typeof useAiChat>;

const thTime = (iso: string) => new Date(iso).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// ---------- pieces ----------

function SetupCard({ detail }: { detail?: string }) {
  return (
    <div className="m-4 rounded-[12px] border border-line bg-raised px-4 py-3.5 text-[13px] leading-relaxed">
      <p className="text-[14px] font-medium text-ink">ยังไม่ได้ตั้งค่า AI</p>
      <p className="mt-1 text-ink-2">ผู้ช่วย AI ต้องมีคีย์ของ Google Gemini ก่อนใช้งาน ให้ผู้ดูแลระบบตั้งค่าตัวแปร GEMINI_API_KEY ในเซิร์ฟเวอร์ แล้วเปิดหน้านี้ใหม่</p>
      {detail && <p className="mt-1 text-ink-3">{detail}</p>}
    </div>
  );
}

function Starters({ chat, pathname, onAsk }: { chat: Chat; pathname?: string | null; onAsk: (q: string) => void }) {
  const page = pageRef(pathname);
  const qs = starterQuestions(chat.me.role);
  const list = page?.id ? [`สรุป${page.label ?? ""} ${page.id} หน้านี้ให้หน่อย`, ...qs.slice(0, 3)] : qs;
  return (
    <div className="flex flex-col gap-4 px-4 py-6">
      <div>
        <p className="flex items-center gap-2 text-[15px] font-medium">
          <Sparkles {...I} className="text-accent-text" />
          ถามข้อมูลบริษัทได้เลย
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-2">
          ตอบจากข้อมูลในระบบที่บทบาท {chat.me.roleLabel} ดูได้เท่านั้น อ่านอย่างเดียว ไม่แก้ไขข้อมูล{!chat.me.live && " · โหมดสาธิตใช้ข้อมูลตัวอย่าง"}
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        {list.map((q) => (
          <button key={q} type="button" onClick={() => onAsk(q)} className="rounded-[8px] border border-line bg-card px-3 py-2 text-left text-[13px] text-ink transition-colors duration-150 hover:bg-raised">
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <IconBtn
      label={done ? "คัดลอกแล้ว" : "คัดลอกคำตอบ"}
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          window.setTimeout(() => setDone(false), 1500);
        });
      }}
    >
      {done ? <Check {...I} /> : <Copy {...I} />}
    </IconBtn>
  );
}

function Message({ m, onNavigate }: { m: ChatMsg; onNavigate?: () => void }) {
  if (m.role === "user")
    return (
      <div className="flex flex-col items-end gap-1">
        {!!m.files?.length && (
          <div className="flex flex-wrap justify-end gap-1">
            {m.files.map((f, i) => (
              <span key={i} className="inline-flex max-w-[220px] items-center gap-1 rounded-[6px] border border-line bg-card px-1.5 py-0.5 text-[12px] text-ink-2">
                {f.type.startsWith("image/") ? <ImageIcon size={12} strokeWidth={1.5} /> : <FileText size={12} strokeWidth={1.5} />}
                <span className="truncate">{f.name}</span>
              </span>
            ))}
          </div>
        )}
        {m.text && <div className="max-w-[85%] whitespace-pre-wrap rounded-[12px] bg-raised px-3 py-2 text-[14px] leading-relaxed">{m.text}</div>}
      </div>
    );
  if (m.notice) return <p className="text-[13px] text-ink-3">{m.text}</p>;
  return (
    <div className="flex flex-col gap-1">
      <Markdown text={m.text} onNavigate={onNavigate} />
      <div className="flex items-center gap-1 text-[12px] text-ink-3">
        {!!m.steps?.length && <span className="min-w-0 flex-1 truncate">ค้นจาก: {m.steps.join(" · ")}</span>}
        <span className={cx(!m.steps?.length && "flex-1")} />
        <CopyBtn text={m.text} />
      </div>
    </div>
  );
}

function ErrorLine({ e, onClose }: { e: ChatError; onClose: () => void }) {
  if (e.setup) return <SetupCard detail={e.text} />;
  return (
    <div role="alert" className="mx-4 mb-2 flex items-start gap-2 rounded-[8px] border border-line-strong bg-neg-soft px-3 py-2 text-[13px] text-neg">
      <span className="min-w-0 flex-1">{e.text}</span>
      <button type="button" onClick={onClose} aria-label="ปิด" className="shrink-0 text-neg/70 hover:text-neg">
        <X size={14} strokeWidth={1.5} />
      </button>
    </div>
  );
}

function Thread({ chat, pathname, onNavigate, onAsk }: { chat: Chat; pathname?: string | null; onNavigate?: () => void; onAsk: (q: string) => void }) {
  const end = useRef<HTMLDivElement>(null);
  const msgs = chat.chat?.messages ?? [];
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [msgs.length, chat.busy, chat.step]);
  if (!msgs.length && !chat.busy) return <Starters chat={chat} pathname={pathname} onAsk={onAsk} />;
  return (
    <div className="flex flex-col gap-5 px-4 py-4">
      {msgs.map((m) => (
        <Message key={m.id} m={m} onNavigate={onNavigate} />
      ))}
      {chat.busy && (
        <p className="flex items-center gap-2 text-[13px] text-ink-3" aria-live="polite">
          <span className="size-1.5 animate-pulse rounded-full bg-accent" />
          {chat.step ? `กำลังค้นข้อมูล: ${chat.step}` : "กำลังคิด…"}
        </p>
      )}
      <div ref={end} />
    </div>
  );
}

function Composer({ chat, disabled, autoFocus }: { chat: Chat; disabled?: boolean; autoFocus?: boolean }) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [warn, setWarn] = useState<string>();
  const ta = useRef<HTMLTextAreaElement>(null);
  const pick = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) ta.current?.focus();
  }, [autoFocus]);
  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(160, el.scrollHeight)}px`;
  }, [text]);

  const submit = () => {
    if (chat.busy || disabled || (!text.trim() && !files.length)) return;
    void chat.send(text, files);
    setText("");
    setFiles([]);
    setWarn(undefined);
  };
  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const ok: File[] = [];
    let msg: string | undefined;
    for (const f of Array.from(list)) {
      if (!acceptsFile(f)) msg = "แนบได้เฉพาะรูปภาพหรือ PDF";
      else if (f.size > MAX_FILE_MB * 1024 * 1024) msg = `ไฟล์ใหญ่เกิน ${MAX_FILE_MB} MB`;
      else ok.push(f);
    }
    const next = [...files, ...ok];
    if (next.length > MAX_FILES) msg = `แนบได้ไม่เกิน ${MAX_FILES} ไฟล์ต่อคำถาม`;
    setFiles(next.slice(0, MAX_FILES));
    setWarn(msg);
  };

  return (
    <div className="border-t border-line bg-card px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2.5">
      {(files.length > 0 || warn) && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {files.map((f, i) => (
            <span key={i} className="inline-flex max-w-[220px] items-center gap-1 rounded-[6px] border border-line bg-raised px-1.5 py-0.5 text-[12px] text-ink-2">
              {f.type.startsWith("image/") ? <ImageIcon size={12} strokeWidth={1.5} /> : <FileText size={12} strokeWidth={1.5} />}
              <span className="truncate">{f.name}</span>
              <button type="button" aria-label={`เอา ${f.name} ออก`} onClick={() => setFiles(files.filter((_, k) => k !== i))} className="text-ink-3 hover:text-ink">
                <X size={12} strokeWidth={1.5} />
              </button>
            </span>
          ))}
          {warn && <span className="text-[12px] text-warn">{warn}</span>}
        </div>
      )}
      <div className="flex items-end gap-1.5 rounded-[10px] border border-line-strong bg-card px-1.5 py-1.5 focus-within:border-ink-3">
        <input ref={pick} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => (addFiles(e.target.files), (e.target.value = ""))} />
        <IconBtn label="แนบรูปหรือ PDF" onClick={() => pick.current?.click()}>
          <Paperclip {...I} />
        </IconBtn>
        <textarea
          ref={ta}
          rows={1}
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          onPaste={(e) => {
            if (e.clipboardData.files.length) {
              e.preventDefault();
              addFiles(e.clipboardData.files);
            }
          }}
          placeholder={disabled ? "ยังใช้งาน AI ไม่ได้" : "ถามเรื่องโครงการ เงิน งานค้าง…"}
          aria-label="คำถามถึงผู้ช่วย AI"
          className="max-h-40 min-h-8 flex-1 resize-none bg-transparent px-1 py-1.5 text-[14px] leading-snug text-ink outline-none placeholder:text-ink-3"
        />
        {chat.busy ? (
          <button type="button" onClick={chat.stop} aria-label="หยุด" title="หยุด" className="inline-flex size-8 shrink-0 items-center justify-center rounded-[8px] border border-line-strong bg-card text-ink hover:bg-raised">
            <Square size={12} strokeWidth={1.5} fill="currentColor" />
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={disabled || (!text.trim() && !files.length)}
            aria-label="ส่ง"
            title="ส่ง (Enter)"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-ink text-card transition-opacity duration-150 hover:bg-[#3a332b] disabled:opacity-30"
          >
            <ArrowUp {...I} />
          </button>
        )}
      </div>
      <p className="mt-1.5 px-1 text-[11px] text-ink-3">AI อาจผิดพลาด ตรวจตัวเลขสำคัญกับหน้าต้นทางก่อนใช้ · Shift+Enter ขึ้นบรรทัดใหม่</p>
    </div>
  );
}

function HistoryList({ chat, onPick, className }: { chat: Chat; onPick?: () => void; className?: string }) {
  if (!chat.chats.length) return <p className={cx("px-4 py-8 text-center text-[13px] text-ink-3", className)}>ยังไม่มีแชทที่บันทึกไว้</p>;
  return (
    <ul className={cx("flex flex-col py-2", className)}>
      {chat.chats.map((c: AiChat) => (
        <li key={c.id} className="group flex items-center gap-1 px-2">
          <button
            type="button"
            onClick={() => {
              chat.select(c.id);
              onPick?.();
            }}
            className={cx("min-w-0 flex-1 rounded-[8px] px-2.5 py-2 text-left transition-colors duration-150 hover:bg-raised", c.id === chat.chatId && "bg-raised")}
          >
            <p className="truncate text-[13px] text-ink">{c.title}</p>
            <p className="text-[12px] text-ink-3">
              {thTime(c.updated)} · {c.messages.filter((m) => m.role === "user").length} คำถาม
            </p>
          </button>
          <IconBtn label="ลบแชทนี้" danger onClick={() => window.confirm(`ลบแชท "${c.title}" ?`) && chat.remove(c.id)}>
            <Trash2 {...I} />
          </IconBtn>
        </li>
      ))}
    </ul>
  );
}

function Body({ chat, pathname, onNavigate, autoFocus }: { chat: Chat; pathname?: string | null; onNavigate?: () => void; autoFocus?: boolean }) {
  const status = useAiStatus();
  const off = status ? !status.configured : false;
  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {off && <SetupCard />}
        <Thread chat={chat} pathname={pathname} onNavigate={onNavigate} onAsk={(q) => !off && void chat.send(q)} />
      </div>
      {chat.error && <ErrorLine e={chat.error} onClose={chat.clearError} />}
      <Composer chat={chat} disabled={off} autoFocus={autoFocus} />
    </>
  );
}

function HeadBtn({ label, onClick, href, children }: { label: string; onClick?: () => void; href?: string; children: ReactNode }) {
  if (href)
    return (
      <Link href={href} onClick={onClick} aria-label={label} title={label} className="inline-flex size-8 items-center justify-center rounded-[8px] text-ink-3 transition-colors duration-150 hover:bg-raised hover:text-ink">
        {children}
      </Link>
    );
  return (
    <IconBtn label={label} onClick={onClick}>
      {children}
    </IconBtn>
  );
}

// ---------- drawer ----------

/** Right-side drawer (420px; full screen on phones). Renders nothing while closed. */
export function AiChatPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return <PanelInner onClose={onClose} />;
}

function PanelInner({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();
  const chat = useAiChat(pathname);
  const [showHistory, setShowHistory] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  // on phones the drawer covers the page: close it when a link in an answer is followed
  const onNavigate = () => window.matchMedia("(max-width: 639px)").matches && onClose();
  return (
    <aside role="dialog" aria-label="ผู้ช่วย AI" className="enter fixed inset-0 z-40 flex flex-col bg-card print:hidden sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[420px] sm:border-l sm:border-line sm:shadow-[0_12px_40px_rgba(31,27,22,0.12)]">
      <header className="flex h-14 shrink-0 items-center gap-1 border-b border-line pl-4 pr-2">
        <Sparkles {...I} className="text-accent-text" />
        <p className="ml-1 min-w-0 flex-1 truncate text-[15px] font-medium">{showHistory ? "แชทที่ผ่านมา" : (chat.chat?.title ?? "ผู้ช่วย AI")}</p>
        <HeadBtn label={showHistory ? "กลับไปที่แชท" : "แชทที่ผ่านมา"} onClick={() => setShowHistory(!showHistory)}>
          <History {...I} />
        </HeadBtn>
        <HeadBtn
          label="แชทใหม่"
          onClick={() => {
            chat.select(undefined);
            setShowHistory(false);
          }}
        >
          <MessageSquarePlus {...I} />
        </HeadBtn>
        <HeadBtn label="เปิดเต็มหน้า" href="/assistant" onClick={onClose}>
          <Maximize2 {...I} />
        </HeadBtn>
        <HeadBtn label="ปิด (Esc)" onClick={onClose}>
          <X {...I} />
        </HeadBtn>
      </header>
      {showHistory ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <HistoryList chat={chat} onPick={() => setShowHistory(false)} />
        </div>
      ) : (
        <Body chat={chat} pathname={pathname} onNavigate={onNavigate} autoFocus />
      )}
    </aside>
  );
}

// ---------- full page ----------

/** /assistant: chat history on the left, conversation on the right. */
export function AssistantView() {
  const chat = useAiChat("/assistant");
  const [showHistory, setShowHistory] = useState(false);
  return (
    <div className="flex h-[calc(100dvh-56px)] min-h-[480px]">
      <aside className={cx("w-[260px] shrink-0 flex-col border-r border-line bg-page", showHistory ? "fixed inset-0 z-30 flex w-full bg-card sm:static sm:w-[260px]" : "hidden md:flex")}>
        <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
          <button
            type="button"
            onClick={() => {
              chat.select(undefined);
              setShowHistory(false);
            }}
            className="inline-flex h-8 flex-1 items-center justify-center gap-2 rounded-[8px] border border-line-strong bg-card px-3 text-[13px] font-medium hover:bg-raised"
          >
            <MessageSquarePlus {...I} />
            แชทใหม่
          </button>
          {showHistory && (
            <IconBtn label="ปิด" onClick={() => setShowHistory(false)}>
              <X {...I} />
            </IconBtn>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <HistoryList chat={chat} onPick={() => setShowHistory(false)} />
        </div>
      </aside>
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-line px-4 md:hidden">
          <HeadBtn label="แชทที่ผ่านมา" onClick={() => setShowHistory(true)}>
            <History {...I} />
          </HeadBtn>
          <p className="min-w-0 flex-1 truncate text-[14px]">{chat.chat?.title ?? "แชทใหม่"}</p>
        </div>
        <div className="mx-auto flex min-h-0 w-full max-w-[820px] flex-1 flex-col">
          <Body chat={chat} pathname="/assistant" autoFocus />
        </div>
      </section>
    </div>
  );
}
