"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { cx } from "@/components/ui";

export type MapPoint = {
  id: string;
  name: string;
  model: string;
  province: string;
  lat: number;
  lng: number;
  color: string;
  statusLabel: string;
  active: boolean;
  actual: number;
};

const LeafletMap = dynamic(() => import("./leaflet-map"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-raised" />,
});

export function ProjectMap({ points, legend }: { points: MapPoint[]; legend: { label: string; color: string; n: number }[] }) {
  const [view, setView] = useState<"bkk" | "all">("bkk");
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 px-5 py-3">
        <div role="tablist" aria-label="ขอบเขตแผนที่" className="inline-flex rounded-[8px] border border-line-strong bg-raised p-0.5 text-[13px]">
          {(
            [
              ["bkk", "กรุงเทพฯ & ปริมณฑล"],
              ["all", "ทั้งประเทศ"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={view === k}
              onClick={() => setView(k)}
              className={cx("h-7 rounded-[6px] px-3 transition-colors duration-150", view === k ? "bg-card text-ink shadow-[0_1px_2px_rgba(0,0,0,0.06)]" : "text-ink-2 hover:text-ink")}
            >
              {label}
            </button>
          ))}
        </div>
        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-2">
          {legend.map((l) => (
            <li key={l.label} className="flex items-center gap-1.5">
              <span className="inline-block size-2 rounded-full" style={{ background: l.color }} />
              {l.label}
              <span className="num font-mono text-ink-3">{l.n}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="relative z-0 min-h-[380px] flex-1 overflow-hidden rounded-b-[14px] border-t border-line">
        <LeafletMap points={points} view={view} />
      </div>
    </div>
  );
}
