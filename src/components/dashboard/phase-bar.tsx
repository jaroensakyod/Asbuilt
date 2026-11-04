import { cx } from "@/components/ui";
import type { PhaseSeg } from "./metrics";

/**
 * One segment per construction phase. Dark = actual work done, lighter warm
 * = planned by today but not yet built, raised = later phases.
 */
export function PhaseBar({ segs, className }: { segs: PhaseSeg[]; className?: string }) {
  return (
    <div className={cx("flex gap-[3px]", className)} role="img" aria-label={segs.map((s) => `${s.label} ${Math.round(s.actual)}%`).join(", ")}>
      {segs.map((s) => (
        <div key={s.phase} title={`${s.label} · จริง ${Math.round(s.actual)}% · แผน ${Math.round(s.plan)}%`} className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-raised">
          {s.plan > s.actual && <div className="absolute inset-y-0 left-0 bg-warn/35" style={{ width: `${s.plan}%` }} />}
          <div className={cx("absolute inset-y-0 left-0", s.state === "done" ? "bg-ink" : "bg-accent")} style={{ width: `${s.actual}%` }} />
        </div>
      ))}
    </div>
  );
}

export function PhaseLegend() {
  return (
    <span className="flex items-center gap-3 text-[12px] text-ink-3">
      <span className="flex items-center gap-1.5">
        <span className="h-1.5 w-3 rounded-full bg-ink" />
        เสร็จแล้ว
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-1.5 w-3 rounded-full bg-accent" />
        กำลังทำ
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-1.5 w-3 rounded-full bg-warn/35" />
        ตามแผนแต่ยังไม่เสร็จ
      </span>
    </span>
  );
}
