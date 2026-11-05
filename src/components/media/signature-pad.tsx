"use client";

// Finger/mouse signature, saved as a PNG MediaRef (customer sign-off, permit-to-work, handover).
//   <SignaturePad onSave={(ref, name) => …} />

import { useEffect, useRef, useState } from "react";
import { saveMedia, type MediaRef } from "@/lib/media";
import { inputCls } from "@/components/ui";

export function SignaturePad({ onSave, nameLabel = "ชื่อผู้ลงนาม", height = 160 }: { onSave: (ref: MediaRef, signer: string) => void; nameLabel?: string; height?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [dirty, setDirty] = useState(false);
  const [signer, setSigner] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.clientWidth * ratio;
    c.height = height * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1f1a14";
  }, [height]);

  const pos = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };
  const down = (e: React.PointerEvent) => {
    drawing.current = true;
    canvas.current!.setPointerCapture(e.pointerId);
    const ctx = canvas.current!.getContext("2d")!;
    const [x, y] = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvas.current!.getContext("2d")!;
    const [x, y] = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setDirty(true);
  };
  const clear = () => {
    const c = canvas.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setDirty(false);
  };
  const save = async () => {
    setBusy(true);
    const blob = await new Promise<Blob | null>((r) => canvas.current!.toBlob(r, "image/png"));
    if (blob) onSave(await saveMedia(new File([blob], `signature-${Date.now()}.png`, { type: "image/png" }), { geotag: true, caption: `ลายมือชื่อ ${signer}` }), signer.trim());
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <input value={signer} onChange={(e) => setSigner(e.target.value)} placeholder={nameLabel} aria-label={nameLabel} className={inputCls} />
      <canvas
        ref={canvas}
        style={{ height }}
        className="w-full touch-none rounded-[8px] border border-dashed border-line-strong bg-card"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={() => (drawing.current = false)}
        onPointerLeave={() => (drawing.current = false)}
        aria-label="ช่องเซ็นชื่อ"
      />
      <div className="flex justify-between gap-2">
        <button type="button" onClick={clear} className="h-8 rounded-[8px] px-3 text-[13px] text-ink-2 hover:bg-raised">
          ล้าง
        </button>
        <button type="button" disabled={!dirty || !signer.trim() || busy} onClick={() => void save()} className="h-8 rounded-[8px] bg-ink px-3 text-[13px] font-medium text-card disabled:opacity-40">
          บันทึกลายเซ็น
        </button>
      </div>
    </div>
  );
}
