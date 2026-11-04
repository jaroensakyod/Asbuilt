"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DoorOpen, Droplets, Package, Snowflake, Zap } from "lucide-react";
import { Card, CardHead } from "@/components/ui";
import { getProject, type SystemKey } from "@/lib/data";
import { modelForProject, type AssetCategory } from "@/lib/house";
import { openRepairsOf, planFloorOf, projectAssets, summarize, type ProjectAsset } from "@/lib/asset-status";
import { FloorTabs, OVERLAY_LABEL, PlanView, Segmented, type Overlay, type PlanFloor } from "@/components/plan/plan-view";
import { AssetDetail, AssetStats, AssetTable, CategoryChips, ProjectInfoBar, RepairsCard, SystemHeader, WatchCard, countCategories } from "@/components/plan/registry";

const DEFAULT_PROJECT = "HC-2025-01";

const ORDER: AssetCategory[] = [
  "ประตู",
  "หน้าต่าง",
  "พื้น/กระเบื้อง",
  "หลังคา/กันซึม",
  "ตู้ควบคุมไฟฟ้า",
  "เบรกเกอร์ลูกย่อย",
  "โคมดาวน์ไลท์ LED",
  "สวิตช์ไฟ",
  "เต้ารับคู่มีกราวด์",
  "เครื่องทำน้ำอุ่น",
  "สุขภัณฑ์ (ชักโครก)",
  "อ่างล้างหน้า",
  "ซิงค์ล้างจาน",
  "ปั๊มน้ำอัตโนมัติ",
  "ถังเก็บน้ำ",
  "ถังบำบัดน้ำเสีย",
  "เครื่องปรับอากาศติดผนัง (Fan Coil)",
  "คอยล์ร้อน (Condensing Unit)",
];

const OVERLAYS: Overlay[] = ["arch", "elec", "plumb", "hvac"];
const PLAN_TITLE: Record<Overlay, [string, string]> = {
  arch: ["แบบสถาปัตยกรรม", "A"],
  elec: ["แบบระบบไฟฟ้า", "E"],
  plumb: ["แบบระบบสุขาภิบาล", "P"],
  hvac: ["แบบระบบปรับอากาศ", "M"],
};

const overlayOf = (s: SystemKey): Overlay => (s === "elec" || s === "plumb" || s === "hvac" ? s : "arch");

export function AssetsView() {
  const params = useSearchParams();
  const project = getProject(params.get("project") ?? "") ?? getProject(DEFAULT_PROJECT)!;
  return (
    <>
      <SystemHeader
        icon={<Package size={20} strokeWidth={1.5} />}
        title="อุปกรณ์อาคารทั้งหมด"
        en="Building Asset Registry"
        sub="ทะเบียนทรัพย์สินอาคาร ทุกประตู หน้าต่าง พื้น หลังคา อุปกรณ์ไฟฟ้า สุขภัณฑ์ และแอร์ ที่แจ้งซ่อมได้ถึงจุด"
        project={project.id}
      />
      <ProjectInfoBar project={project} />
      <RegistryBody key={`${project.id}-${params.get("code") ?? ""}`} projectId={project.id} initialCode={params.get("code")} />
    </>
  );
}

function RegistryBody({ projectId, initialCode }: { projectId: string; initialCode: string | null }) {
  const project = getProject(projectId)!;
  const model = modelForProject(project);
  const list = projectAssets(project);
  const init = initialCode ? list.find((a) => a.code === initialCode) : undefined;

  const [selected, setSelected] = useState<string | null>(init?.code ?? null);
  const [floor, setFloor] = useState<PlanFloor>(init ? planFloorOf(init, model) : 1);
  const [overlay, setOverlay] = useState<Overlay>(init ? overlayOf(init.system) : "arch");
  const [category, setCategory] = useState<AssetCategory | null>(null);

  const repairs = openRepairsOf(project.id);
  const sel = selected ? list.find((a) => a.code === selected) : undefined;
  const inCat = category ? list.filter((a) => a.category === category) : list;
  const markers = inCat.filter((a) => overlayOf(a.system) === overlay);

  const select = (code: string | null) => {
    setSelected(code);
    const a = code ? list.find((q) => q.code === code) : undefined;
    if (a) {
      setFloor(planFloorOf(a, model));
      setOverlay(overlayOf(a.system));
    }
  };
  const pickCategory = (c: AssetCategory | null) => {
    setCategory(c);
    const a = c ? list.find((q) => q.category === c) : undefined;
    if (a) setOverlay(overlayOf(a.system));
  };

  const counts: Record<string, number> = {};
  const problems = new Set<string>();
  for (const a of markers) {
    const f = String(planFloorOf(a, model));
    counts[f] = (counts[f] ?? 0) + 1;
    if (a.state === "fault" || a.state === "service") problems.add(f);
  }
  const [planTitle, prefix] = PLAN_TITLE[overlay];
  const sheet = floor === "ext" ? `${prefix}-100 · ภายนอกอาคาร` : `${prefix}-10${floor} · ชั้น ${floor}`;

  return (
    <>
      <AssetStats s={summarize(list)} openRepairs={repairs.length} />
      <CategoryChips cats={countCategories(list, ORDER)} value={category} onChange={pickCategory} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <Card>
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
            <div className="flex items-baseline gap-3">
              <h2 className="text-[15px] font-medium">{planTitle}</h2>
              <span className="font-mono text-[12px] text-ink-3">{sheet}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Segmented options={OVERLAYS.map((o) => ({ key: o, label: OVERLAY_LABEL[o] }))} value={overlay} onChange={setOverlay} />
              <FloorTabs floors={model.floors} value={floor} onChange={setFloor} counts={counts} problems={problems} />
            </div>
          </header>
          <div className="p-3">
            <PlanView model={model} floor={floor} overlay={overlay} markers={markers} selected={selected} onSelect={select} height={640} title={`${planTitle} ${sheet} · ${project.id}`} />
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          {sel && <AssetDetail a={sel} model={model} onClose={() => setSelected(null)} />}
          <RepairsCard repairs={repairs} model={model} onSelect={select} />
          <WatchCard assets={list} model={model} onSelect={select} selected={selected} />
          <Breakdown list={list} projectId={project.id} />
        </div>
      </div>

      <AssetTable
        assets={list}
        model={model}
        project={project}
        selected={selected}
        onSelect={select}
        category={category}
        onCategory={pickCategory}
        categories={ORDER.filter((c) => list.some((a) => a.category === c))}
        showSystem
        csv
        title="ทะเบียนอุปกรณ์อาคาร"
      />
    </>
  );
}

const SYSTEMS: { key: SystemKey; label: string; icon: typeof Zap; href?: string }[] = [
  { key: "elec", label: "ระบบไฟฟ้า", icon: Zap, href: "/systems/elec" },
  { key: "plumb", label: "ประปา & สุขภัณฑ์", icon: Droplets, href: "/systems/plumb" },
  { key: "hvac", label: "ปรับอากาศ", icon: Snowflake, href: "/systems/hvac" },
  { key: "arch", label: "งานสถาปัตย์", icon: DoorOpen },
];

function Breakdown({ list, projectId }: { list: ProjectAsset[]; projectId: string }) {
  return (
    <Card>
      <CardHead title="แยกตามระบบงาน" />
      <ul>
        {SYSTEMS.map(({ key, label, icon: Icon, href }) => {
          const items = list.filter((a) => a.system === key);
          const s = summarize(items);
          const pct = s.total ? Math.round((s.inWarranty / s.total) * 100) : 0;
          return (
            <li key={key} className="flex items-center gap-3 border-t border-line px-5 py-3 first:border-t-0">
              <span className="grid size-8 place-items-center rounded-[8px] bg-raised text-ink-2">
                <Icon size={16} strokeWidth={1.5} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px]">{label}</span>
                <span className="block text-[12px] text-ink-3">
                  ในประกัน {pct}%{s.fault + s.service > 0 ? ` · ขัดข้อง ${s.fault + s.service}` : ""}
                </span>
              </span>
              <span className="num font-mono text-[14px]">{s.total}</span>
              {href ? (
                <Link href={`${href}?project=${projectId}`} className="w-8 text-right text-[13px] text-ink-2 transition-colors duration-150 hover:text-ink">
                  เปิด
                </Link>
              ) : (
                <span className="w-8" />
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
