"use client";

// Preview of one document revision (uploaded image / PDF, or the generated drawing
// sheet of the project's house model) with an optional pin-markup overlay.

import { useMemo, useRef, useState } from "react";
import { FileText, MapPin } from "lucide-react";
import { cx, inputCls } from "@/components/ui";
import { Btn, I, useHydrated } from "@/components/ops/bits";
import { getSheet, THEME, thumbDataUrl } from "@/lib/drawing";
import { fileSize, isImage, useMediaUrl, type MediaRef } from "@/lib/media";
import type { DocRevision, Pin } from "@/lib/engineering";

export const SHEET_FILE = "sheet";

/** files the revision can show, generated sheet last */
export function previewables(rev: DocRevision): { id: string; label: string; media?: MediaRef }[] {
  const out: { id: string; label: string; media?: MediaRef }[] = rev.files.map((m) => ({ id: m.id, label: m.name, media: m }));
  if (rev.sheetRef) out.push({ id: SHEET_FILE, label: `แบบจากระบบ ${rev.sheetRef.split("/")[1]}` });
  return out;
}
/** default file to preview: first image, else first file, else generated sheet */
export function defaultFile(rev: DocRevision) {
  return rev.files.find(isImage)?.id ?? (rev.sheetRef ? SHEET_FILE : rev.files[0]?.id);
}

function useSheetUrl(sheetRef?: string) {
  const hydrated = useHydrated();
  return useMemo(() => {
    if (!hydrated || !sheetRef) return undefined;
    const [code, id] = sheetRef.split("/");
    const s = getSheet(code, id);
    return s ? thumbDataUrl(s, THEME.paper) : undefined;
  }, [hydrated, sheetRef]);
}

export function RevPreview({
  rev,
  fileId,
  pins,
  markup,
  onAddPin,
  height = 520,
}: {
  rev: DocRevision;
  fileId?: string;
  pins?: Pin[];
  markup?: boolean;
  onAddPin?: (x: number, y: number, text: string) => void;
  height?: number;
}) {
  const media = rev.files.find((m) => m.id === fileId);
  const mediaUrl = useMediaUrl(media);
  const sheetUrl = useSheetUrl(fileId === SHEET_FILE ? rev.sheetRef : undefined);
  const box = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null);
  const [text, setText] = useState("");

  const imgUrl = fileId === SHEET_FILE ? sheetUrl : media && isImage(media) ? mediaUrl : undefined;
  const isPdf = media?.type === "application/pdf";

  if (!fileId) return <Placeholder height={height}>ยังไม่มีไฟล์ในฉบับนี้</Placeholder>;
  if (media && !isImage(media)) {
    if (isPdf && mediaUrl) return <iframe title={media.name} src={mediaUrl} className="w-full rounded-[10px] border border-line bg-raised" style={{ height }} />;
    return (
      <Placeholder height={height}>
        <FileText size={20} strokeWidth={1.5} />
        <span className="text-ink-2">{media.name}</span>
        <span className="font-mono text-[12px]">{fileSize(media.size)}</span>
        {mediaUrl ? (
          <a href={mediaUrl} download={media.name} className="text-accent-text hover:underline">
            ดาวน์โหลดเพื่อเปิด
          </a>
        ) : (
          <span>ไฟล์อยู่ในเครื่องที่อัปโหลด</span>
        )}
      </Placeholder>
    );
  }
  if (!imgUrl) return <Placeholder height={height}>{media ? "ไฟล์อยู่ในเครื่องที่อัปโหลด เปิดดูไม่ได้ในเครื่องนี้" : "กำลังสร้างภาพตัวอย่าง"}</Placeholder>;

  const shown = (pins ?? []).filter((p) => p.fileId === fileId);
  const place = (e: React.MouseEvent) => {
    if (!markup || !box.current) return;
    const r = box.current.getBoundingClientRect();
    const x = Math.round(((e.clientX - r.left) / r.width) * 1000) / 10;
    const y = Math.round(((e.clientY - r.top) / r.height) * 1000) / 10;
    setPending({ x, y });
    setText("");
  };

  return (
    <div>
      <div className="overflow-auto rounded-[10px] border border-line bg-raised" style={{ maxHeight: height }}>
        <div ref={box} onClick={place} className={cx("relative mx-auto w-full", markup && "cursor-crosshair")}>
          {/* eslint-disable-next-line @next/next/no-img-element -- object / data URL */}
          <img src={imgUrl} alt={rev.sheetRef ?? media?.name ?? ""} className="block h-auto w-full select-none" draggable={false} />
          {shown.map((p) => (
            <span
              key={p.id}
              title={p.text}
              className={cx(
                "absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-card font-mono text-[11px] shadow-[0_1px_3px_rgba(0,0,0,0.25)]",
                p.resolved ? "bg-ink-3 text-card" : "bg-accent text-card",
              )}
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
            >
              {p.n}
            </span>
          ))}
          {pending && (
            <span className="absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-dashed border-accent bg-card text-accent-text" style={{ left: `${pending.x}%`, top: `${pending.y}%` }}>
              <MapPin size={12} strokeWidth={1.5} />
            </span>
          )}
        </div>
      </div>
      {pending && onAddPin && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="ความเห็นของหมุดนี้" className={cx(inputCls, "min-w-[220px] flex-1")} />
          <Btn small onClick={() => setPending(null)}>
            ยกเลิก
          </Btn>
          <Btn
            small
            primary
            disabled={!text.trim()}
            onClick={() => {
              onAddPin(pending.x, pending.y, text.trim());
              setPending(null);
            }}
          >
            <MapPin {...I} />
            ปักหมุด
          </Btn>
        </div>
      )}
    </div>
  );
}

function Placeholder({ height, children }: { height: number; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-[10px] border border-dashed border-line-strong bg-raised px-6 text-center text-[13px] text-ink-3" style={{ height: Math.min(height, 320) }}>
      {children}
    </div>
  );
}
