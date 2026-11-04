"use client";

import type { ReactNode } from "react";
import { Lightbulb, LightbulbOff, Lock, LockOpen, Snowflake, Sun, X } from "lucide-react";
import { cx } from "@/components/ui";
import { ACI_HEX, LAYERS, layerDef } from "@/lib/drawing";

export const C = {
  bg: "#141415",
  panel: "#19191b",
  raised: "#232325",
  hover: "#2b2b2e",
  line: "#2e2e31",
  text: "#ededed",
  text2: "#a8a8ad",
  text3: "#7c7c82",
};

export type LayerState = { off: Set<string>; frozen: Set<string>; locked: Set<string>; current: string };

export function RB({ icon, label, onClick, disabled, active, big, title }: { icon: ReactNode; label: string; onClick?: () => void; disabled?: boolean; active?: boolean; big?: boolean; title?: string }) {
  return (
    <button
      type="button"
      title={title ?? label}
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "flex items-center rounded-[6px] text-[12px] transition-colors duration-150",
        big ? "h-[58px] w-[60px] flex-col justify-center gap-1 px-1 text-center leading-tight" : "h-[22px] gap-1.5 px-1.5",
        disabled ? "cursor-not-allowed text-[#5a5a60]" : active ? "bg-[#33363d] text-[#ededed]" : "text-[#d6d6da] hover:bg-[#2b2b2e]",
      )}
    >
      <span className={cx("shrink-0", disabled ? "opacity-50" : "")}>{icon}</span>
      <span className={big ? "" : "whitespace-nowrap"}>{label}</span>
    </button>
  );
}

export function Panel({ title, children, disabled }: { title: string; children: ReactNode; disabled?: boolean }) {
  return (
    <div className="flex h-full flex-col border-r border-[#2e2e31] px-2 pt-1.5">
      <div className="flex min-h-0 flex-1 items-start gap-1">{children}</div>
      <div className={cx("pb-1 text-center text-[11px]", disabled ? "text-[#5a5a60]" : "text-[#7c7c82]")}>{title}</div>
    </div>
  );
}

export function Col({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-0.5">{children}</div>;
}

export function LayerRow({ name, ls, onToggle, onCurrent, count }: { name: string; ls: LayerState; onToggle: (k: "off" | "frozen" | "locked", name: string) => void; onCurrent?: (name: string) => void; count?: number }) {
  const d = layerDef(name);
  const off = ls.off.has(name);
  const fz = ls.frozen.has(name);
  const lk = ls.locked.has(name);
  return (
    <div className={cx("flex h-7 items-center gap-2 rounded-[6px] px-1.5 text-[12px]", ls.current === name ? "bg-[#2b2b2e]" : "hover:bg-[#232325]")}>
      <button type="button" title={off ? "เปิดเลเยอร์" : "ปิดเลเยอร์"} onClick={() => onToggle("off", name)} className="text-[#d6d6da]">
        {off ? <LightbulbOff size={14} strokeWidth={1.5} className="text-[#5a5a60]" /> : <Lightbulb size={14} strokeWidth={1.5} className="text-[#ffe14d]" />}
      </button>
      <button type="button" title={fz ? "Thaw" : "Freeze"} onClick={() => onToggle("frozen", name)}>
        {fz ? <Snowflake size={14} strokeWidth={1.5} className="text-[#8ab4ff]" /> : <Sun size={14} strokeWidth={1.5} className="text-[#ffe14d]" />}
      </button>
      <button type="button" title={lk ? "Unlock" : "Lock"} onClick={() => onToggle("locked", name)}>
        {lk ? <Lock size={14} strokeWidth={1.5} className="text-[#ededed]" /> : <LockOpen size={14} strokeWidth={1.5} className="text-[#7c7c82]" />}
      </button>
      <span className="size-3 shrink-0 border border-[#4a4a4f]" style={{ background: ACI_HEX[d.aci] ?? "#ededed" }} />
      <button type="button" onClick={() => onCurrent?.(name)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <span className={cx("w-[60px] font-mono", off || fz ? "text-[#7c7c82]" : "text-[#ededed]")}>{name}</span>
        <span className="truncate text-[#a8a8ad]">{d.desc}</span>
      </button>
      {count !== undefined && <span className="font-mono text-[11px] text-[#7c7c82]">{count.toLocaleString()}</span>}
    </div>
  );
}

export function LayerManager({ ls, counts, onToggle, onCurrent, onAll, onClose }: { ls: LayerState; counts: Map<string, number>; onToggle: (k: "off" | "frozen" | "locked", name: string) => void; onCurrent: (name: string) => void; onAll: () => void; onClose: () => void }) {
  const names = LAYERS.map((l) => l.name).filter((n) => counts.has(n));
  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-black/40" onClick={onClose}>
      <div role="dialog" aria-label="Layer Properties Manager" onClick={(e) => e.stopPropagation()} className="w-[min(980px,94%)] overflow-hidden rounded-[10px] border border-[#3a3a3f] bg-[#19191b] text-[#ededed] shadow-[0_16px_48px_rgba(0,0,0,0.5)]">
        <div className="flex h-10 items-center justify-between border-b border-[#2e2e31] px-3">
          <span className="text-[13px]">Layer Properties Manager · ตัวจัดการเลเยอร์</span>
          <button type="button" aria-label="ปิด" onClick={onClose} className="grid size-7 place-items-center rounded-[6px] text-[#a8a8ad] hover:bg-[#2b2b2e]">
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
        <div className="flex items-center gap-2 border-b border-[#2e2e31] px-3 py-2 text-[12px]">
          <span className="text-[#a8a8ad]">Current layer:</span>
          <span className="font-mono">{ls.current}</span>
          <span className="ml-auto text-[#7c7c82]">{names.length} layers · read-only drawing</span>
          <button type="button" onClick={onAll} className="rounded-[6px] border border-[#3a3a3f] px-2 py-1 hover:bg-[#2b2b2e]">
            All on · Thaw all
          </button>
        </div>
        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 bg-[#232325] text-left text-[#a8a8ad]">
              <tr>
                {["S", "Name", "On", "Freeze", "Lock", "Color", "Linetype", "Lineweight", "Objects", "Description"].map((h) => (
                  <th key={h} className="px-2 py-1.5 font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {names.map((n) => {
                const d = layerDef(n);
                return (
                  <tr key={n} className="border-t border-[#26262a] hover:bg-[#202023]">
                    <td className="px-2 py-1 text-[#5ee85e]">{ls.current === n ? "✓" : ""}</td>
                    <td className="px-2 py-1">
                      <button type="button" onClick={() => onCurrent(n)} className="font-mono hover:underline">
                        {n}
                      </button>
                    </td>
                    <td className="px-2 py-1">
                      <button type="button" onClick={() => onToggle("off", n)}>
                        {ls.off.has(n) ? <LightbulbOff size={14} strokeWidth={1.5} className="text-[#5a5a60]" /> : <Lightbulb size={14} strokeWidth={1.5} className="text-[#ffe14d]" />}
                      </button>
                    </td>
                    <td className="px-2 py-1">
                      <button type="button" onClick={() => onToggle("frozen", n)}>
                        {ls.frozen.has(n) ? <Snowflake size={14} strokeWidth={1.5} className="text-[#8ab4ff]" /> : <Sun size={14} strokeWidth={1.5} className="text-[#ffe14d]" />}
                      </button>
                    </td>
                    <td className="px-2 py-1">
                      <button type="button" onClick={() => onToggle("locked", n)}>
                        {ls.locked.has(n) ? <Lock size={14} strokeWidth={1.5} /> : <LockOpen size={14} strokeWidth={1.5} className="text-[#7c7c82]" />}
                      </button>
                    </td>
                    <td className="px-2 py-1">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="size-3 border border-[#4a4a4f]" style={{ background: ACI_HEX[d.aci] }} />
                        <span className="font-mono text-[#a8a8ad]">{d.aci === 7 ? "white" : d.aci}</span>
                      </span>
                    </td>
                    <td className="px-2 py-1 font-mono text-[#a8a8ad]">{d.lt}</td>
                    <td className="px-2 py-1 font-mono text-[#a8a8ad]">{d.lw.toFixed(2)} mm</td>
                    <td className="px-2 py-1 font-mono text-[#a8a8ad]">{(counts.get(n) ?? 0).toLocaleString()}</td>
                    <td className="px-2 py-1 text-[#a8a8ad]">{d.desc}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function PropRow({ k, v, mono = true }: { k: string; v: ReactNode; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[46%_54%] border-b border-[#232325] text-[12px]">
      <span className="truncate px-2 py-[3px] text-[#a8a8ad]">{k}</span>
      <span className={cx("truncate px-2 py-[3px]", mono && "font-mono")}>{v}</span>
    </div>
  );
}

export function PropHead({ children }: { children: ReactNode }) {
  return <div className="bg-[#232325] px-2 py-1 text-[12px] text-[#ededed]">{children}</div>;
}
