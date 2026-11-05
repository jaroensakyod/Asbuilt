"use client";

// Edit one wall of the takeoff: height, block type, leave it out, remove / add openings.
// Edits are saved per project + source and applied before the takeoff is computed.

import { useState } from "react";
import { Plus, RotateCcw, Trash2, Undo2 } from "lucide-react";
import { Card, cx, inputCls } from "@/components/ui";
import { openingProblem } from "@/lib/takeoff/walls";
import { addOpening, editWall, removeOpening, resetEdits, resetWall, restoreOpening } from "@/lib/takeoff/store";
import { BLOCKS, type BlockType, type OpeningKind, type TakeoffEdits, type Wall } from "@/lib/takeoff/types";

const btn = "inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-line-strong bg-card px-3 text-[13px] text-ink transition-colors duration-150 hover:bg-raised disabled:opacity-50";

const PRESETS: { label: string; kind: OpeningKind; width: number; sill: number; head: number }[] = [
  { label: "ประตู 0.90×2.10", kind: "door", width: 0.9, sill: 0, head: 2.1 },
  { label: "ประตู 0.80×2.00 (ห้องน้ำ)", kind: "door", width: 0.8, sill: 0, head: 2.0 },
  { label: "ประตูบานคู่ 1.80×2.20", kind: "door", width: 1.8, sill: 0, head: 2.2 },
  { label: "หน้าต่าง 1.20×1.20", kind: "window", width: 1.2, sill: 0.9, head: 2.1 },
  { label: "หน้าต่าง 0.60×0.60", kind: "window", width: 0.6, sill: 1.5, head: 2.1 },
  { label: "หน้าต่าง 2.00×1.40", kind: "window", width: 2, sill: 0.8, head: 2.2 },
];

const num = (v: string) => (v === "" ? NaN : Number(v));

export function WallEditor({ wall, original, edits, onClose }: { wall: Wall; original: Wall | undefined; edits: TakeoffEdits; onClose: () => void }) {
  const we = edits.walls[wall.id] ?? {};
  const len = Math.round((wall.b - wall.a) * 100) / 100;
  const [preset, setPreset] = useState(3);
  const p = PRESETS[preset];
  const [offset, setOffset] = useState(String(Math.max(0, Math.round((len / 2 - p.width / 2) * 100) / 100)));
  const [width, setWidth] = useState(String(p.width));
  const [sill, setSill] = useState(String(p.sill));
  const [head, setHead] = useState(String(p.head));
  const [height, setHeight] = useState(String(wall.height));

  const draft = { kind: p.kind, offset: num(offset), width: num(width), sill: num(sill), head: num(head) };
  const valid = [draft.offset, draft.width, draft.sill, draft.head].every(Number.isFinite);
  const problem = valid ? openingProblem(wall, draft) : "กรอกตัวเลขให้ครบ";

  const applyPreset = (i: number) => {
    const q = PRESETS[i];
    setPreset(i);
    setWidth(String(q.width));
    setSill(String(q.sill));
    setHead(String(q.head));
    setOffset(String(Math.max(0, Math.round((len / 2 - q.width / 2) * 100) / 100)));
  };

  const removedHere = edits.removed.filter((k) => k.startsWith(`${wall.id}:`));

  return (
    <Card className="border-ink/30">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-[14px] font-medium">
          แก้ไขผนัง <span className="font-mono">{wall.id}</span>
        </h2>
        <button type="button" className="text-[12px] text-ink-3 hover:text-ink" onClick={onClose}>
          ปิด
        </button>
      </div>
      <div className="flex flex-col gap-3 px-4 py-3 text-[13px]">
        <p className="text-ink-2">
          {wall.exterior ? "ผนังภายนอก" : "ผนังภายใน"} · ชั้น {wall.floor} · ยาว <span className="num font-mono">{len.toFixed(2)}</span> ม.
          {original && original.height !== wall.height && <span className="text-ink-3"> (เดิมสูง {original.height.toFixed(2)} ม.)</span>}
        </p>

        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-ink-2">
            ความสูงก่อ (ม.)
            <input
              type="number"
              step={0.1}
              min={0.6}
              className={cx(inputCls, "h-8 font-mono text-[13px]")}
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              onBlur={() => {
                const v = num(height);
                if (Number.isFinite(v) && v >= 0.6 && v <= 12) editWall(edits, wall.id, { height: original && Math.abs(v - original.height) < 0.005 ? undefined : v });
                else setHeight(String(wall.height));
              }}
            />
          </label>
          <label className="flex flex-col gap-1 text-ink-2">
            ชนิดอิฐ
            <select className={cx(inputCls, "h-8 text-[13px]")} value={we.block ?? ""} onChange={(e) => editWall(edits, wall.id, { block: (e.target.value || undefined) as BlockType | undefined })}>
              <option value="">ตามค่าหมวด</option>
              {(Object.keys(BLOCKS) as BlockType[]).map((b) => (
                <option key={b} value={b}>
                  {BLOCKS[b].label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div>
          <p className="mb-1.5 text-ink-2">ช่องเปิด {wall.openings.length} ช่อง</p>
          <ul className="flex flex-col divide-y divide-line rounded-[8px] border border-line">
            {wall.openings.map((o) => (
              <li key={o.id} className="flex items-center gap-2 px-2.5 py-1.5">
                <span className="min-w-0 flex-1">
                  <span className="font-mono text-[12px]">{o.id}</span> {o.kind === "door" ? "ประตู" : "หน้าต่าง"}{" "}
                  <span className="num font-mono text-[12px] text-ink-3">
                    {(o.s1 - o.s0).toFixed(2)}×{(o.head - o.sill).toFixed(2)} @ {(o.s0 - wall.a).toFixed(2)}
                  </span>
                </span>
                <button type="button" aria-label={`ลบช่องเปิด ${o.id}`} className="rounded-[6px] p-1 text-ink-3 hover:bg-raised hover:text-ink" onClick={() => removeOpening(edits, wall.id, o.id)}>
                  <Trash2 size={14} strokeWidth={1.5} />
                </button>
              </li>
            ))}
            {!wall.openings.length && <li className="px-2.5 py-2 text-ink-3">ไม่มีช่องเปิด</li>}
          </ul>
          {removedHere.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {removedHere.map((k) => (
                <button key={k} type="button" className="inline-flex items-center gap-1 rounded-[6px] border border-dashed border-line-strong px-2 py-0.5 text-[12px] text-ink-3 hover:text-ink" onClick={() => restoreOpening(edits, k)}>
                  <Undo2 size={12} strokeWidth={1.5} /> คืน {k.split(":")[1]}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 rounded-[10px] bg-raised/60 p-2.5">
          <p className="font-medium">เพิ่มช่องเปิด</p>
          <select className={cx(inputCls, "h-8 text-[13px]")} value={preset} onChange={(e) => applyPreset(Number(e.target.value))} aria-label="ชนิดช่องเปิด">
            {PRESETS.map((q, i) => (
              <option key={q.label} value={i}>
                {q.label}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <Small label="ระยะจากต้นผนัง" value={offset} onChange={setOffset} />
            <Small label="กว้าง" value={width} onChange={setWidth} />
            <Small label="ขอบล่าง" value={sill} onChange={setSill} />
            <Small label="ขอบบน" value={head} onChange={setHead} />
          </div>
          {problem && <p className="text-[12px] text-accent-text">{problem}</p>}
          <button type="button" className={btn} disabled={!!problem} onClick={() => addOpening(edits, { wallId: wall.id, ...draft })}>
            <Plus size={14} strokeWidth={1.5} /> เพิ่ม{p.kind === "door" ? "ประตู" : "หน้าต่าง"}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" className={btn} onClick={() => editWall(edits, wall.id, { excluded: true })}>
            ไม่นับผนังนี้
          </button>
          {wall.edited && (
            <button type="button" className={btn} onClick={() => resetWall(edits, wall.id)}>
              <RotateCcw size={14} strokeWidth={1.5} /> คืนค่าผนังนี้
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}

function Small({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-[12px] text-ink-2">
      {label} (ม.)
      <input type="number" step={0.05} className={cx(inputCls, "h-8 font-mono text-[13px]")} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

/** Summary of all edits on this source with undo. */
export function EditsCard({ edits }: { edits: TakeoffEdits }) {
  const excluded = Object.entries(edits.walls).filter(([, v]) => v.excluded);
  const changed = Object.entries(edits.walls).filter(([, v]) => !v.excluded).length;
  const n = excluded.length + changed + edits.removed.length + edits.added.length;
  if (!n) return null;
  return (
    <Card>
      <div className="flex flex-col gap-2 px-4 py-3 text-[13px]">
        <div className="flex items-center justify-between">
          <p className="font-medium">การแก้ไขในแหล่งข้อมูลนี้</p>
          <button
            type="button"
            className="flex items-center gap-1 text-[12px] text-ink-3 hover:text-ink"
            onClick={() => {
              if (window.confirm("ล้างการแก้ไขผนังทั้งหมดของแหล่งข้อมูลนี้?")) resetEdits(edits);
            }}
          >
            <RotateCcw size={13} strokeWidth={1.5} /> ล้างทั้งหมด
          </button>
        </div>
        <p className="text-ink-2">
          ปรับผนัง {changed} · ไม่นับ {excluded.length} · ลบช่องเปิด {edits.removed.length} · เพิ่มช่องเปิด {edits.added.length}
        </p>
        {excluded.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {excluded.map(([id]) => (
              <button key={id} type="button" className="inline-flex items-center gap-1 rounded-[6px] border border-dashed border-line-strong px-2 py-0.5 text-[12px] text-ink-3 hover:text-ink" onClick={() => editWall(edits, id, { excluded: undefined })}>
                <Undo2 size={12} strokeWidth={1.5} /> นับ {id} กลับ
              </button>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
