"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Droplets, Snowflake, Zap } from "lucide-react";
import { Card } from "@/components/ui";
import { getProject } from "@/lib/data";
import { modelForProject, type AssetCategory } from "@/lib/house";
import { openRepairsOf, planFloorOf, projectAssets, summarize } from "@/lib/asset-status";
import { FloorTabs, PlanView, type PlanFloor } from "@/components/plan/plan-view";
import { AssetDetail, AssetStats, AssetTable, CategoryChips, ProjectInfoBar, RepairsCard, SystemHeader, WatchCard, countCategories } from "@/components/plan/registry";
import { KINDS, type Kind } from "./kinds";
import { SystemSchedule, SystemSummary } from "./summaries";

const ICON = { elec: Zap, plumb: Droplets, hvac: Snowflake };

export function SystemView({ kind }: { kind: Kind }) {
  const params = useSearchParams();
  const k = KINDS[kind];
  const project = getProject(params.get("project") ?? "") ?? getProject(k.defaultProject)!;
  const Icon = ICON[kind];
  return (
    <>
      <SystemHeader icon={<Icon size={20} strokeWidth={1.5} />} title={k.title} en={k.en} sub={k.sub} project={project.id} />
      <ProjectInfoBar project={project} />
      <SystemBody key={project.id} kind={kind} projectId={project.id} initialCode={params.get("code")} />
    </>
  );
}

function SystemBody({ kind, projectId, initialCode }: { kind: Kind; projectId: string; initialCode: string | null }) {
  const k = KINDS[kind];
  const project = getProject(projectId)!;
  const model = modelForProject(project);
  const all = projectAssets(project);
  const list = all.filter((a) => a.system === kind);
  const init = initialCode ? list.find((a) => a.code === initialCode) : undefined;

  const [selected, setSelected] = useState<string | null>(init?.code ?? null);
  const [floor, setFloor] = useState<PlanFloor>(init ? planFloorOf(init, model) : 1);
  const [category, setCategory] = useState<AssetCategory | null>(null);

  const repairs = openRepairsOf(project.id, kind);
  const shown = category ? list.filter((a) => a.category === category) : list;
  const sel = selected ? list.find((a) => a.code === selected) : undefined;

  const select = (code: string | null) => {
    setSelected(code);
    const a = code ? list.find((q) => q.code === code) : undefined;
    if (a) setFloor(planFloorOf(a, model));
  };

  const counts: Record<string, number> = {};
  const problems = new Set<string>();
  for (const a of shown) {
    const f = String(planFloorOf(a, model));
    counts[f] = (counts[f] ?? 0) + 1;
    if (a.state === "fault" || a.state === "service") problems.add(f);
  }
  const sheet = floor === "ext" ? `${k.sheet}-100 · ภายนอกอาคาร` : `${k.sheet}-10${floor} · ชั้น ${floor}`;

  return (
    <>
      <AssetStats s={summarize(list)} openRepairs={repairs.length} />
      <CategoryChips cats={countCategories(list, k.categories)} value={category} onChange={setCategory} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <Card>
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
            <div className="flex items-baseline gap-3">
              <h2 className="text-[15px] font-medium">{k.plan}</h2>
              <span className="font-mono text-[12px] text-ink-3">{sheet}</span>
            </div>
            <FloorTabs floors={model.floors} value={floor} onChange={setFloor} counts={counts} problems={problems} />
          </header>
          <div className="p-3">
            <PlanView model={model} floor={floor} overlay={kind} markers={shown} selected={selected} onSelect={select} height={620} title={`${k.plan} ${sheet} · ${project.id}`} />
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          {sel && <AssetDetail a={sel} model={model} onClose={() => setSelected(null)} />}
          <RepairsCard repairs={repairs} model={model} onSelect={select} />
          <WatchCard assets={list} model={model} onSelect={select} selected={selected} />
          <SystemSummary kind={kind} model={model} list={list} all={all} />
        </div>
      </div>

      <SystemSchedule kind={kind} model={model} list={list} onSelect={select} selected={selected} />

      <AssetTable
        assets={list}
        model={model}
        project={project}
        selected={selected}
        onSelect={select}
        category={category}
        onCategory={setCategory}
        categories={k.categories.filter((c) => list.some((a) => a.category === c))}
        title={`อุปกรณ์${k.title}`}
      />
    </>
  );
}
