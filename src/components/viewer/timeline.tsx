"use client";

import { Pause, Play } from "lucide-react";
import { cx } from "@/components/ui";
import { PHASE_LABEL, PHASES, type Element } from "@/lib/house";
import { PHASE_COLOR, type Schedule } from "@/lib/viewer-data";
import { thDate } from "@/lib/data";

const TH_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

function months(start: string, finish: string) {
  const out: { iso: string; label: string; year: boolean }[] = [];
  const [sy, sm] = start.split("-").map(Number);
  const [fy, fm] = finish.split("-").map(Number);
  let y = sy;
  let m = sm + 1;
  while (y < fy || (y === fy && m <= fm)) {
    if (m > 12) {
      m = 1;
      y++;
      continue;
    }
    out.push({ iso: `${y}-${String(m).padStart(2, "0")}-01`, label: m === 1 ? `${TH_MONTH[0]} ${String(y + 543).slice(2)}` : TH_MONTH[m - 1], year: m === 1 });
    m++;
  }
  return out;
}

export function Timeline({
  t,
  onT,
  playing,
  onPlay,
  speed,
  onSpeed,
  sched,
  start,
  finish,
  elements,
}: {
  t: number;
  onT: (t: number) => void;
  playing: boolean;
  onPlay: () => void;
  speed: number;
  onSpeed: (s: number) => void;
  sched: Schedule;
  start: string;
  finish: string;
  elements: Element[];
}) {
  const ms = months(start, finish);
  const every = Math.max(1, Math.ceil(ms.length / 10));
  const phases = PHASES.map((ph) => {
    const plans = elements.filter((e) => e.phase === ph).map((e) => e.plan);
    return { ph, a: plans.length ? Math.min(...plans) * 0.98 : 0, b: plans.length ? Math.max(...plans) : 0 };
  });
  const pct = (v: number) => `${(v * 100).toFixed(2)}%`;

  return (
    <div className="flex items-center gap-4 border-t border-line bg-card px-4 py-3">
      <button
        type="button"
        onClick={onPlay}
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink text-card transition-transform duration-150 active:scale-[0.97]"
        aria-label={playing ? "หยุด" : "เล่นไทม์ไลน์"}
      >
        {playing ? <Pause size={16} strokeWidth={1.5} /> : <Play size={16} strokeWidth={1.5} />}
      </button>
      <div className="flex shrink-0 items-center gap-0.5 rounded-[8px] bg-raised p-0.5" role="group" aria-label="ความเร็วการเล่น">
        {[1, 2, 4].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSpeed(s)}
            className={cx("h-7 rounded-[6px] px-2 font-mono text-[12px] transition-colors duration-150", speed === s ? "bg-card text-ink shadow-[inset_0_0_0_1px_var(--line)]" : "text-ink-3 hover:text-ink")}
          >
            {s}×
          </button>
        ))}
      </div>

      <div className="relative min-w-0 flex-1 pt-4">
        {/* phase track */}
        <div className="relative h-1">
          {phases.map(({ ph, a, b }) => (
            <span key={ph} title={PHASE_LABEL[ph]} className="absolute inset-y-0 rounded-full" style={{ left: pct(a), width: pct(Math.max(0.004, b - a)), background: PHASE_COLOR[ph] }} />
          ))}
        </div>
        {/* progress track */}
        <div className="relative mt-1.5 h-1.5 rounded-full bg-raised">
          <div className="absolute inset-y-0 left-0 rounded-full bg-ink" style={{ width: pct(t) }} />
          <div className="absolute size-3.5 -translate-x-1/2 rounded-full border-2 border-card bg-ink shadow-[0_0_0_1px_var(--line-strong)]" style={{ left: pct(t), top: -4 }} />
        </div>
        {sched.todayVisible && (
          <div className="pointer-events-none absolute top-0 flex -translate-x-1/2 flex-col items-center" style={{ left: pct(sched.today) }}>
            <span className="rounded-[4px] bg-accent px-1 text-[10px] leading-[14px] text-card">วันนี้</span>
            <span className="h-4 w-px bg-accent" />
          </div>
        )}
        <div className="pointer-events-none absolute right-0 top-0 flex flex-col items-end">
          <span className="rounded-[4px] bg-ink px-1 text-[10px] leading-[14px] text-card">กำหนดเสร็จ</span>
          <span className="mr-0 h-4 w-px bg-ink" />
        </div>
        <input
          type="range"
          min={0}
          max={1000}
          value={Math.round(t * 1000)}
          onChange={(e) => onT(Number(e.target.value) / 1000)}
          className="absolute inset-x-0 top-3 h-6 w-full cursor-pointer opacity-0"
          aria-label="เลื่อนวันที่บนไทม์ไลน์"
          aria-valuetext={thDate(sched.dateAt(t))}
        />
        <div className="relative mt-1.5 h-4 font-mono text-[11px] text-ink-3">
          {ms.map((m, i) =>
            i % every === 0 || m.year ? (
              <span key={m.iso} className={cx("absolute -translate-x-1/2 whitespace-nowrap", m.year && "text-ink-2")} style={{ left: pct(sched.fracOf(m.iso)) }}>
                {m.label}
              </span>
            ) : null,
          )}
        </div>
      </div>

      <div className="w-[136px] shrink-0 text-right">
        <p className="text-[12px] text-ink-3">หน้างาน ณ วันที่</p>
        <p className="num text-[16px] font-medium leading-tight">{thDate(sched.dateAt(t))}</p>
      </div>
      <button
        type="button"
        onClick={() => onT(sched.today)}
        className="h-8 shrink-0 rounded-[8px] border border-line-strong px-3 text-[13px] text-ink transition-colors duration-150 hover:bg-raised"
      >
        วันนี้
      </button>
    </div>
  );
}
