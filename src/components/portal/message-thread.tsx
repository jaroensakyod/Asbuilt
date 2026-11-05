"use client";

// Message thread between the customer (portal) and the company (project page).

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { cx } from "@/components/ui";
import { MediaField, MediaStrip } from "@/components/media/media-field";
import type { MediaRef } from "@/lib/media";
import type { PortalMessage } from "@/lib/design/types";

const time = (iso: string) => {
  const d = iso.slice(0, 10).split("-").map(Number);
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return `${d[2]} ${months[d[1] - 1]} ${iso.slice(11, 16)}`;
};

export function Thread({ messages, viewer, empty = "ยังไม่มีข้อความ" }: { messages: PortalMessage[]; viewer: PortalMessage["side"]; empty?: string }) {
  const end = useRef<HTMLDivElement>(null);
  const list = [...messages].sort((a, b) => a.at.localeCompare(b.at));
  useEffect(() => {
    const el = end.current?.parentElement;
    if (el) el.scrollTop = el.scrollHeight;
  }, [list.length]);
  if (!list.length) return <p className="px-5 py-6 text-center text-[13px] text-ink-3">{empty}</p>;
  return (
    <div className="flex max-h-[420px] flex-col gap-2.5 overflow-y-auto px-4 py-4">
      {list.map((m) => {
        const mine = m.side === viewer;
        return (
          <div key={m.id} className={cx("flex max-w-[86%] flex-col gap-1", mine ? "items-end self-end" : "items-start self-start")}>
            <span className="text-[12px] text-ink-3">
              {m.side === "company" ? `${m.author} · บริษัท` : m.author} · <span className="num font-mono">{time(m.at)}</span>
            </span>
            <div className={cx("whitespace-pre-line rounded-[12px] px-3 py-2 text-[14px] leading-relaxed", mine ? "bg-ink text-card" : "border border-line bg-raised text-ink")}>{m.text}</div>
            {m.attachments && <MediaStrip refs={m.attachments} size={48} />}
          </div>
        );
      })}
      <div ref={end} />
    </div>
  );
}

export function Composer({ onSend, placeholder = "พิมพ์ข้อความ", allowFiles = true, busy }: { onSend: (text: string, files: MediaRef[]) => void | Promise<void>; placeholder?: string; allowFiles?: boolean; busy?: boolean }) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<MediaRef[]>([]);
  const [showFiles, setShowFiles] = useState(false);
  const send = async () => {
    if (!text.trim() || busy) return;
    await onSend(text.trim(), files);
    setText("");
    setFiles([]);
    setShowFiles(false);
  };
  return (
    <div className="border-t border-line px-4 py-3">
      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void send();
          }}
          rows={2}
          maxLength={1000}
          placeholder={placeholder}
          aria-label="ข้อความ"
          className="min-h-[44px] flex-1 resize-y rounded-[8px] border border-line-strong bg-card px-3 py-2 text-[14px] text-ink outline-none placeholder:text-ink-3 focus:border-ink-3"
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={!text.trim() || busy}
          aria-label="ส่งข้อความ"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-[8px] bg-ink text-card transition-[background-color,transform] duration-150 hover:bg-[#3a332b] active:scale-[0.98] disabled:opacity-40"
        >
          <Send size={16} strokeWidth={1.5} />
        </button>
      </div>
      {allowFiles && (
        <div className="mt-2">
          {showFiles ? (
            <MediaField value={files} onChange={setFiles} label="แนบรูป" photosOnly geotag={false} max={6} />
          ) : (
            <button type="button" onClick={() => setShowFiles(true)} className="text-[12px] text-ink-3 hover:text-ink">
              + แนบรูป
            </button>
          )}
        </div>
      )}
    </div>
  );
}
