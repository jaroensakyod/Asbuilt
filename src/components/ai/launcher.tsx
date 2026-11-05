"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";
import { I } from "@/components/ops/bits";
import { AiChatPanel } from "./chat";

const OPEN_EVENT = "asbuilt:ai-chat-open";
/** open the assistant drawer from anywhere (e.g. a "ถาม AI" button on a page) */
export const openAiChat = () => window.dispatchEvent(new Event(OPEN_EVENT));

/**
 * Floating "ถาม AI" button (bottom-right) + Ctrl/⌘+J shortcut + the chat drawer.
 * Mount once in the app shell; hidden on /assistant (the full page has its own chat).
 */
export function AiChatLauncher() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const onPage = path === "/assistant" || path.startsWith("/assistant/");
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  if (onPage) return null;
  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="ถามผู้ช่วย AI (Ctrl+J)"
          title="ถามผู้ช่วย AI (Ctrl+J)"
          data-shell
          className="fixed bottom-[max(16px,env(safe-area-inset-bottom))] right-4 z-30 inline-flex h-10 items-center gap-2 rounded-full border border-line-strong bg-card pl-3 pr-3.5 text-[13px] font-medium text-ink shadow-[0_4px_16px_rgba(31,27,22,0.10)] transition-[background-color,transform] duration-150 hover:bg-raised active:scale-[0.98] print:hidden"
        >
          <Sparkles {...I} className="text-accent-text" />
          <span className="hidden sm:inline">ถาม AI</span>
        </button>
      )}
      <AiChatPanel open={open} onClose={close} />
    </>
  );
}
