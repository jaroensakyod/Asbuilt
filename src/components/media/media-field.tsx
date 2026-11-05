"use client";

// Shared photo/file picker used by every module. On phones "ถ่ายรูป" opens the rear camera.
//   <MediaField value={item.photos ?? []} onChange={(photos) => save({ ...item, photos })} />
//   <MediaStrip refs={item.photos} />            // read-only thumbnails

import { useRef, useState } from "react";
import { Camera, FileText, Paperclip, X } from "lucide-react";
import { cx } from "@/components/ui";
import { deleteMedia, fileSize, isImage, saveMedia, useMediaUrl, type MediaRef } from "@/lib/media";

function Thumb({ m, onOpen, onRemove, size = 72 }: { m: MediaRef; onOpen: () => void; onRemove?: () => void; size?: number }) {
  const url = useMediaUrl(m);
  return (
    <div className="group relative shrink-0" style={{ width: size, height: size }}>
      <button type="button" onClick={onOpen} title={m.caption ?? m.name} className="size-full overflow-hidden rounded-[8px] border border-line bg-raised">
        {isImage(m) && url ? (
          // eslint-disable-next-line @next/next/no-img-element -- object/signed URLs, not static assets
          <img src={url} alt={m.caption ?? m.name} className="size-full object-cover" />
        ) : (
          <span className="flex size-full flex-col items-center justify-center gap-1 px-1 text-ink-3">
            <FileText size={18} strokeWidth={1.5} />
            <span className="w-full truncate text-center text-[10px]">{m.name}</span>
          </span>
        )}
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`ลบ ${m.name}`}
          className="absolute -right-1.5 -top-1.5 hidden size-5 items-center justify-center rounded-full border border-line-strong bg-card text-ink-2 group-hover:flex"
        >
          <X size={12} strokeWidth={1.5} />
        </button>
      )}
    </div>
  );
}

function Viewer({ m, onClose }: { m: MediaRef; onClose: () => void }) {
  const url = useMediaUrl(m);
  return (
    <div role="dialog" aria-label={m.name} className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-6" onClick={onClose}>
      <div className="max-h-full max-w-[min(1100px,100%)] overflow-hidden rounded-[12px] bg-card" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-2.5">
          <p className="min-w-0 truncate text-[13px]">
            {m.caption ?? m.name}
            <span className="ml-2 font-mono text-[12px] text-ink-3">
              {fileSize(m.size)} · {new Date(m.at).toLocaleString("th-TH")}
              {m.lat !== undefined && ` · ${m.lat.toFixed(5)}, ${m.lng?.toFixed(5)}`}
            </span>
          </p>
          <div className="flex items-center gap-2">
            {url && (
              <a href={url} download={m.name} className="text-[13px] text-ink-2 hover:text-ink">
                ดาวน์โหลด
              </a>
            )}
            <button type="button" onClick={onClose} aria-label="ปิด" className="rounded-[6px] p-1 text-ink-3 hover:bg-raised hover:text-ink">
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>
        </div>
        {isImage(m) && url ? (
          // eslint-disable-next-line @next/next/no-img-element -- object/signed URLs
          <img src={url} alt={m.caption ?? m.name} className="max-h-[78vh] w-auto" />
        ) : (
          <p className="px-6 py-10 text-center text-[13px] text-ink-3">ไฟล์นี้แสดงตัวอย่างไม่ได้ กดดาวน์โหลดเพื่อเปิด</p>
        )}
      </div>
    </div>
  );
}

export function MediaStrip({ refs, size = 56, className }: { refs?: MediaRef[]; size?: number; className?: string }) {
  const [open, setOpen] = useState<MediaRef | null>(null);
  if (!refs?.length) return null;
  return (
    <>
      <div className={cx("flex flex-wrap gap-2", className)}>
        {refs.map((m) => (
          <Thumb key={m.id} m={m} size={size} onOpen={() => setOpen(m)} />
        ))}
      </div>
      {open && <Viewer m={open} onClose={() => setOpen(null)} />}
    </>
  );
}

export function MediaField({
  value,
  onChange,
  label = "รูปและไฟล์แนบ",
  accept = "image/*,application/pdf,.dxf,.dwg,.ifc,.xlsx,.docx",
  photosOnly,
  geotag = true,
  max = 30,
}: {
  value: MediaRef[];
  onChange: (next: MediaRef[]) => void;
  label?: string;
  accept?: string;
  photosOnly?: boolean;
  geotag?: boolean;
  max?: number;
}) {
  const cam = useRef<HTMLInputElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<MediaRef | null>(null);

  const add = async (list: FileList | null) => {
    if (!list?.length) return;
    setBusy(true);
    try {
      const room = Math.max(0, max - value.length);
      const saved: MediaRef[] = [];
      for (const f of [...list].slice(0, room)) saved.push(await saveMedia(f, { geotag }));
      onChange([...value, ...saved]);
    } finally {
      setBusy(false);
      if (cam.current) cam.current.value = "";
      if (file.current) file.current.value = "";
    }
  };
  const remove = (m: MediaRef) => {
    onChange(value.filter((x) => x.id !== m.id));
    void deleteMedia(m);
  };

  const btn = "inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-line-strong bg-card px-3 text-[13px] text-ink transition-colors duration-150 hover:bg-raised disabled:opacity-40";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] text-ink-2">
          {label}
          {value.length > 0 && <span className="ml-1.5 font-mono text-[12px] text-ink-3">{value.length}</span>}
        </span>
        <div className="flex gap-2">
          <button type="button" className={btn} disabled={busy || value.length >= max} onClick={() => cam.current?.click()}>
            <Camera size={16} strokeWidth={1.5} />
            ถ่ายรูป
          </button>
          {!photosOnly && (
            <button type="button" className={btn} disabled={busy || value.length >= max} onClick={() => file.current?.click()}>
              <Paperclip size={16} strokeWidth={1.5} />
              แนบไฟล์
            </button>
          )}
        </div>
      </div>
      <input ref={cam} type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => void add(e.target.files)} />
      <input ref={file} type="file" accept={photosOnly ? "image/*" : accept} multiple hidden onChange={(e) => void add(e.target.files)} />
      {busy && <p className="text-[12px] text-ink-3">กำลังบันทึกไฟล์…</p>}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((m) => (
            <Thumb key={m.id} m={m} onOpen={() => setOpen(m)} onRemove={() => remove(m)} />
          ))}
        </div>
      )}
      {open && <Viewer m={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
