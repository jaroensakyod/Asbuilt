"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import { getModel } from "@/lib/house";
import { FloorTabs, OVERLAY_LABEL, PlanView, Segmented, markerOnFloor, type Overlay, type PlanFloor } from "@/components/plan/plan-view";

const OVERLAYS: Overlay[] = ["arch", "elec", "plumb", "hvac"];
const PREFIX: Record<Overlay, string> = { arch: "A", elec: "E", plumb: "P", hvac: "M" };

export function ModelPlans({ code }: { code: string }) {
  const model = getModel(code);
  const [floor, setFloor] = useState<PlanFloor>(1);
  const [overlay, setOverlay] = useState<Overlay>("arch");
  const [selected, setSelected] = useState<string | null>(null);
  const markers = model.assets.filter((a) => (overlay === "arch" ? a.system === "arch" : a.system === overlay));
  const counts: Record<string, number> = {};
  for (const f of [...Array.from({ length: model.floors }, (_, i) => i + 1), "ext" as const]) counts[String(f)] = markers.filter((m) => markerOnFloor(m, f, model.floors)).length;
  const sheet = floor === "ext" ? `${PREFIX[overlay]}-100 · ภายนอกอาคาร` : `${PREFIX[overlay]}-10${floor} · ชั้น ${floor}`;
  const sel = selected ? model.assets.find((a) => a.code === selected) : undefined;

  return (
    <Card>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
        <div className="flex items-baseline gap-3">
          <h2 className="text-[15px] font-medium">แบบแปลนพื้น</h2>
          <span className="font-mono text-[12px] text-ink-3">{sheet}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented options={OVERLAYS.map((o) => ({ key: o, label: OVERLAY_LABEL[o] }))} value={overlay} onChange={setOverlay} />
          <FloorTabs floors={model.floors} value={floor} onChange={setFloor} counts={counts} />
        </div>
      </header>
      <div className="p-3">
        <PlanView model={model} floor={floor} overlay={overlay} markers={markers} selected={selected} onSelect={setSelected} height={560} title={`${model.spec.name} ${sheet}`} />
        {sel && (
          <p className="px-2 pt-3 text-[13px] text-ink-2">
            <span className="font-mono text-[12px] text-ink">{sel.code}</span> {sel.name} · {sel.brand}
          </p>
        )}
      </div>
    </Card>
  );
}
