"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Box, Download, Map as MapIcon, Search, TriangleAlert, Wrench } from "lucide-react";
import { AssetTag, Card, CardHead, Status, cx, inputCls } from "@/components/ui";
import { REPAIR_STATUS_LABEL, SEVERITY_LABEL, SOURCE_LABEL, STATUS_LABEL, SYSTEM_LABEL, getHouseModel, thDate, type Project, type Repair } from "@/lib/data";
import type { AssetCategory, BuildingModel } from "@/lib/house";
import {
  ASSET_STATE_LABEL,
  ASSET_STATE_TONE,
  WARRANTY_LABEL,
  locationOf,
  projectOpenRepairCount,
  selectableProjects,
  type AssetState,
  type AssetSummary,
  type ProjectAsset,
} from "@/lib/asset-status";
import { SymbolSwatch } from "./symbols";

// ---------- page header ----------

export function SystemHeader({ icon, title, en, sub, project }: { icon: ReactNode; title: string; en: string; sub: string; project: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 pb-5">
      <div className="flex items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-[10px] border border-line-strong bg-raised text-ink">{icon}</span>
        <div>
          <h1 className="text-[26px] font-normal leading-[1.2]">
            {title} <span className="text-ink-3">{en}</span>
          </h1>
          <p className="mt-1 max-w-[46rem] text-ink-2">{sub}</p>
        </div>
      </div>
      <ProjectSelect value={project} />
    </div>
  );
}

export function ProjectSelect({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const list = selectableProjects();
  return (
    <label className="flex items-center gap-2 text-[13px] text-ink-2">
      อาคาร/โครงการ
      <select
        value={value}
        onChange={(e) => router.replace(`${pathname}?project=${e.target.value}`, { scroll: false })}
        className={cx(inputCls, "max-w-[460px] pr-8")}
      >
        {list.map((p) => (
          <option key={p.id} value={p.id}>
            {`${p.id} · ${p.name} – ${p.model} • แจ้งซ่อม ${projectOpenRepairCount(p.id)}`}
          </option>
        ))}
      </select>
    </label>
  );
}

// ---------- project info bar ----------

export function ProjectInfoBar({ project }: { project: Project }) {
  const spec = getHouseModel(project.modelCode);
  const delivered = project.status === "delivered" || project.status === "handover";
  return (
    <Card className="mb-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-3.5">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-[13px] text-ink-2">
        <span className="flex items-baseline gap-2">
          <span className="text-[15px] font-medium text-ink">{project.name}</span>
          <span className="font-mono text-[12px] text-ink-3">{project.id}</span>
        </span>
        <Status tone={project.status === "delivered" ? "pos" : "warn"}>{STATUS_LABEL[project.status]}</Status>
        <span>
          แบบบ้าน <span className="font-mono text-[12px] text-ink">{project.modelCode}</span> {spec?.name ?? project.model}
        </span>
        <span>
          เจ้าของ <span className="text-ink">{project.owner}</span>
        </span>
        {delivered && project.handedOver ? (
          <span>
            ส่งมอบ <span className="text-ink">{thDate(project.handedOver)}</span>
          </span>
        ) : (
          <span>
            กำหนดเสร็จ <span className="text-ink">{thDate(project.finish)}</span>
          </span>
        )}
        {project.warrantyUntil && (
          <span>
            ประกันโครงการถึง <span className="text-ink">{thDate(project.warrantyUntil)}</span>
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <SmallLink href={`/structure/${project.id}`} icon={<Box size={16} strokeWidth={1.5} />}>
          โมเดล 3D
        </SmallLink>
        <SmallLink href={`/blueprint/${project.modelCode}`} icon={<MapIcon size={16} strokeWidth={1.5} />}>
          ชุดแบบ
        </SmallLink>
      </div>
    </Card>
  );
}

function SmallLink({ href, icon, children }: { href: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-line-strong bg-card px-3 text-[13px] text-ink transition-colors duration-150 hover:bg-raised">
      {icon}
      {children}
    </Link>
  );
}

// ---------- stat cards ----------

function StatCard({ label, value, note, tone }: { label: string; value: number; note?: ReactNode; tone?: "accent" | "warn" }) {
  return (
    <Card className="px-4 py-3.5">
      <p className="text-[13px] text-ink-2">{label}</p>
      <p className={cx("num mt-1.5 text-[28px] font-medium leading-none", tone === "accent" && value > 0 && "text-accent-text", tone === "warn" && value > 0 && "text-warn")}>{value}</p>
      {note && <div className="mt-2 text-[12px] leading-[18px] text-ink-3">{note}</div>}
    </Card>
  );
}

function Bar({ pct }: { pct: number }) {
  return (
    <div className="mb-1 h-1 w-full rounded-full bg-raised">
      <div className="h-1 rounded-full bg-pos" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function AssetStats({ s, openRepairs }: { s: AssetSummary; openRepairs: number }) {
  const pct = s.total ? Math.round((s.normal / s.total) * 100) : 0;
  const wpct = s.total ? Math.round((s.inWarranty / s.total) * 100) : 0;
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4 2xl:grid-cols-8">
      <StatCard label="จำนวนอุปกรณ์" value={s.total} note="จุดที่ติดตามได้ในอาคาร" />
      <StatCard
        label="ปกติ"
        value={s.normal}
        note={
          <>
            <Bar pct={pct} />
            {pct}%
          </>
        }
      />
      <StatCard label="เตือน/เฝ้าระวัง" value={s.watch} tone="warn" note="จากผลตรวจรอบล่าสุด" />
      <StatCard label="ขัดข้อง/ชำรุด" value={s.fault} tone="accent" note="มีแจ้งซ่อมค้างอยู่" />
      <StatCard label="ซ่อมบำรุง" value={s.service} note="ช่างกำลังดำเนินการ" />
      <StatCard label="แจ้งซ่อมเปิดอยู่" value={openRepairs} tone="accent" note="ยังไม่ปิดงาน" />
      <StatCard
        label="อยู่ในประกัน"
        value={s.inWarranty}
        note={
          <>
            <Bar pct={wpct} />
            {s.expiring} รายการหมดใน 90 วัน
          </>
        }
      />
      <StatCard label="ถึงรอบบำรุงรักษา" value={s.due30} note="ภายใน 30 วัน" />
    </div>
  );
}

// ---------- category chips ----------

export type CatCount = { cat: AssetCategory; count: number; faults: number };

export function countCategories(list: ProjectAsset[], order?: AssetCategory[]): CatCount[] {
  const map = new Map<AssetCategory, CatCount>();
  for (const a of list) {
    const c = map.get(a.category) ?? { cat: a.category, count: 0, faults: 0 };
    c.count++;
    if (a.state === "fault" || a.state === "service") c.faults++;
    map.set(a.category, c);
  }
  const out = [...map.values()];
  if (order) out.sort((a, b) => order.indexOf(a.cat) - order.indexOf(b.cat));
  return out;
}

export function CategoryChips({ cats, value, onChange }: { cats: CatCount[]; value: AssetCategory | null; onChange: (c: AssetCategory | null) => void }) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      <Chip on={value === null} onClick={() => onChange(null)}>
        ทุกหมวด
        <span className="num font-mono text-[12px] text-ink-3">{cats.reduce((s, c) => s + c.count, 0)}</span>
      </Chip>
      {cats.map((c) => (
        <Chip key={c.cat} on={value === c.cat} onClick={() => onChange(value === c.cat ? null : c.cat)}>
          <SymbolSwatch cat={c.cat} />
          {c.cat}
          <span className="num font-mono text-[12px] text-ink">{c.count}</span>
          {c.faults > 0 && <span className="num grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 font-mono text-[11px] leading-none text-card">{c.faults}</span>}
        </Chip>
      ))}
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cx(
        "inline-flex h-8 items-center gap-2 rounded-[8px] border px-3 text-[13px] transition-colors duration-150",
        on ? "border-ink bg-card text-ink" : "border-line-strong bg-card text-ink-2 hover:bg-raised hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

// ---------- right column cards ----------

const REPAIR_TONE: Record<Repair["status"], "accent" | "warn" | "neutral" | "pos"> = { open: "accent", fixing: "warn", waiting: "neutral", closed: "pos" };
const SEV_TONE: Record<Repair["severity"], "neg" | "warn" | "neutral"> = { high: "neg", medium: "warn", low: "neutral" };

export function RepairsCard({ repairs, model, onSelect }: { repairs: Repair[]; model: BuildingModel; onSelect?: (code: string) => void }) {
  return (
    <Card>
      <CardHead
        title="แจ้งซ่อมที่เปิดอยู่"
        meta={`${repairs.length} รายการ`}
        action={
          <Link href="/repairs" className="text-[13px] text-ink-2 transition-colors duration-150 hover:text-ink">
            ทั้งหมด
          </Link>
        }
      />
      {repairs.length === 0 ? (
        <p className="px-5 py-4 text-[13px] text-ink-3">ไม่มีแจ้งซ่อมค้างในระบบนี้</p>
      ) : (
        <ul>
          {repairs.map((r) => {
            const a = model.assets.find((q) => q.code === r.asset);
            return (
              <li key={r.id} className="border-t border-line px-5 py-3 first:border-t-0">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-[12px]">{r.id}</span>
                    <Status tone={REPAIR_TONE[r.status]}>{REPAIR_STATUS_LABEL[r.status]}</Status>
                  </span>
                  <Status tone={SEV_TONE[r.severity]}>{SEVERITY_LABEL[r.severity]}</Status>
                </div>
                <p className="mt-1 text-[14px]">{r.title}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[12px] text-ink-3">
                  <button type="button" onClick={() => a && onSelect?.(a.code)} className="transition-opacity duration-150 hover:opacity-70">
                    <AssetTag code={r.asset} />
                  </button>
                  <span>{a ? locationOf(a, model) : r.location}</span>
                  <span>· {SOURCE_LABEL[r.source]}</span>
                  <span>· {thDate(r.reported)}</span>
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export function WatchCard({ assets, model, onSelect, selected }: { assets: ProjectAsset[]; model: BuildingModel; onSelect: (code: string) => void; selected?: string | null }) {
  const list = assets.filter((a) => a.state !== "normal");
  return (
    <Card>
      <CardHead title="จุดที่ต้องติดตาม" meta={`${list.length} จุด`} />
      {list.length === 0 ? (
        <p className="px-5 py-4 text-[13px] text-ink-3">อุปกรณ์ทุกชิ้นทำงานปกติ</p>
      ) : (
        <ul>
          {list.map((a) => (
            <li key={a.code}>
              <button
                type="button"
                onClick={() => onSelect(a.code)}
                className={cx("flex w-full items-start gap-3 border-t border-line px-5 py-3 text-left transition-colors duration-150 first:border-t-0", selected === a.code ? "bg-raised" : "hover:bg-raised")}
              >
                <span className="mt-0.5">
                  {a.state === "watch" ? <TriangleAlert size={16} strokeWidth={1.5} className="text-warn" /> : <Wrench size={16} strokeWidth={1.5} className="text-accent" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-[12px] text-ink">{a.code}</span>
                    <span className="truncate text-[13px]">{a.name}</span>
                  </span>
                  <span className="mt-0.5 block text-[12px] text-ink-3">
                    {locationOf(a, model)}
                    {a.note ? ` · ${a.note}` : ""}
                  </span>
                </span>
                <span className="flex flex-col items-end gap-1">
                  <Status tone={ASSET_STATE_TONE[a.state]}>{ASSET_STATE_LABEL[a.state]}</Status>
                  {a.openRepairs.length > 0 && <span className="text-[12px] text-accent-text">แจ้งซ่อม {a.openRepairs.length}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function AssetDetail({ a, model, onClose }: { a: ProjectAsset; model: BuildingModel; onClose: () => void }) {
  const circuit = a.circuit ? model.circuits.find((c) => c.id === a.circuit) : undefined;
  return (
    <Card className="enter p-5">
      <div className="flex items-start justify-between gap-3">
        <AssetTag code={a.code} />
        <button type="button" onClick={onClose} className="text-[13px] text-ink-3 transition-colors duration-150 hover:text-ink">
          ปิด
        </button>
      </div>
      <p className="mt-2 text-[16px] font-medium">{a.name}</p>
      <p className="text-[13px] text-ink-3">{a.category}</p>
      <dl className="mt-3 grid grid-cols-[104px_1fr] gap-y-1.5 text-[13px]">
        <dt className="text-ink-3">สถานะ</dt>
        <dd>
          <Status tone={ASSET_STATE_TONE[a.state]}>{ASSET_STATE_LABEL[a.state]}</Status>
          {a.note && <span className="ml-2 text-ink-2">{a.note}</span>}
        </dd>
        <dt className="text-ink-3">ตำแหน่ง</dt>
        <dd>{locationOf(a, model)}</dd>
        <dt className="text-ink-3">ยี่ห้อ / รุ่น</dt>
        <dd>{a.brand}</dd>
        {circuit && (
          <>
            <dt className="text-ink-3">วงจร</dt>
            <dd>
              <span className="font-mono text-[12px]">{circuit.breaker}</span> {circuit.name} · {circuit.db}
            </dd>
          </>
        )}
        {a.btu && (
          <>
            <dt className="text-ink-3">ขนาด</dt>
            <dd className="num">{a.btu.toLocaleString("en-US")} BTU</dd>
          </>
        )}
        {a.watts && !a.btu && (
          <>
            <dt className="text-ink-3">กำลังไฟ</dt>
            <dd className="num">{a.watts.toLocaleString("en-US")} W</dd>
          </>
        )}
        <dt className="text-ink-3">ติดตั้ง</dt>
        <dd>{thDate(a.installed)}</dd>
        <dt className="text-ink-3">ประกัน</dt>
        <dd>
          <Status tone={a.warranty === "active" ? "pos" : a.warranty === "expiring" ? "warn" : "neutral"}>
            {a.warranty === "expired" ? `หมดเมื่อ ${thDate(a.warrantyUntil)}` : `ถึง ${thDate(a.warrantyUntil)}`}
          </Status>
        </dd>
        {a.nextService && (
          <>
            <dt className="text-ink-3">บำรุงรักษา</dt>
            <dd>
              ทุก {a.cycle} เดือน · ครั้งถัดไป {thDate(a.nextService)}
            </dd>
          </>
        )}
      </dl>
      {a.openRepairs.map((r) => (
        <p key={r.id} className="mt-3 rounded-[8px] bg-accent-soft px-3 py-2 text-[13px]">
          <span className="font-mono text-[12px] text-accent-text">{r.id}</span>
          <span className="block">{r.title}</span>
        </p>
      ))}
    </Card>
  );
}

// ---------- equipment table ----------

const STATES: AssetState[] = ["normal", "watch", "fault", "service"];

export function AssetTable({
  assets,
  model,
  project,
  selected,
  onSelect,
  category,
  onCategory,
  categories,
  showSystem,
  csv,
  title = "รายการอุปกรณ์",
}: {
  assets: ProjectAsset[];
  model: BuildingModel;
  project: Project;
  selected: string | null;
  onSelect: (code: string) => void;
  category: AssetCategory | null;
  onCategory: (c: AssetCategory | null) => void;
  categories: AssetCategory[];
  showSystem?: boolean;
  csv?: boolean;
  title?: string;
}) {
  const [q, setQ] = useState("");
  const [state, setState] = useState<AssetState | "">("");
  const [warranty, setWarranty] = useState<"" | "in" | "out">("");
  const [system, setSystem] = useState("");
  const box = useRef<HTMLDivElement>(null);

  const needle = q.trim().toLowerCase();
  const rows = assets.filter(
    (a) =>
      (!category || a.category === category) &&
      (!state || a.state === state) &&
      (!system || a.system === system) &&
      (!warranty || (warranty === "in" ? a.warranty !== "expired" : a.warranty === "expired")) &&
      (!needle || `${a.code} ${a.name} ${a.brand} ${locationOf(a, model)}`.toLowerCase().includes(needle)),
  );
  const systems = [...new Set(assets.map((a) => a.system))];

  useEffect(() => {
    const el = box.current;
    if (!el || !selected) return;
    const row = el.querySelector<HTMLElement>(`[data-code="${selected}"]`);
    if (row) el.scrollTo({ top: row.offsetTop - el.clientHeight / 2, behavior: "smooth" });
  }, [selected]);

  const exportCsv = () => {
    const head = ["รหัส", "รายการ", "หมวด", "ระบบ", "ชั้น", "ตำแหน่ง", "ยี่ห้อ/รุ่น", "ติดตั้ง", "ประกันถึง", "สถานะประกัน", "สถานะ", "หมายเหตุ"];
    const lines = rows.map((a) =>
      [a.code, a.name, a.category, SYSTEM_LABEL[a.system], a.floor, locationOf(a, model), a.brand, a.installed, a.warrantyUntil, WARRANTY_LABEL[a.warranty], ASSET_STATE_LABEL[a.state], a.note ?? ""]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob(["﻿" + [head.join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `asset-registry-${project.id}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const sel = cx(inputCls, "h-8 pr-7 text-[13px]");
  return (
    <Card className="mt-4">
      <CardHead
        title={title}
        meta={`${rows.length} จาก ${assets.length} รายการ`}
        action={
          csv && (
            <button type="button" onClick={exportCsv} className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-line-strong bg-card px-3 text-[13px] transition-colors duration-150 hover:bg-raised">
              <Download size={16} strokeWidth={1.5} />
              ส่งออก CSV
            </button>
          )
        }
      />
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
        <label className="relative">
          <Search size={16} strokeWidth={1.5} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหารหัส ชื่อ ยี่ห้อ ห้อง" aria-label="ค้นหาอุปกรณ์" className={cx(inputCls, "h-8 w-[260px] pl-8 text-[13px]")} />
        </label>
        <select aria-label="หมวด" value={category ?? ""} onChange={(e) => onCategory((e.target.value || null) as AssetCategory | null)} className={sel}>
          <option value="">ทุกหมวด</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {showSystem && (
          <select aria-label="ระบบ" value={system} onChange={(e) => setSystem(e.target.value)} className={sel}>
            <option value="">ทุกระบบ</option>
            {systems.map((s) => (
              <option key={s} value={s}>
                {SYSTEM_LABEL[s]}
              </option>
            ))}
          </select>
        )}
        <select aria-label="สถานะ" value={state} onChange={(e) => setState(e.target.value as AssetState | "")} className={sel}>
          <option value="">ทุกสถานะ</option>
          {STATES.map((s) => (
            <option key={s} value={s}>
              {ASSET_STATE_LABEL[s]}
            </option>
          ))}
        </select>
        <select aria-label="ประกัน" value={warranty} onChange={(e) => setWarranty(e.target.value as "" | "in" | "out")} className={sel}>
          <option value="">ประกันทั้งหมด</option>
          <option value="in">อยู่ในประกัน</option>
          <option value="out">หมดประกัน</option>
        </select>
      </div>
      <div ref={box} className="relative max-h-[520px] overflow-y-auto">
        <table className="w-full text-left text-[13px]">
          <thead className="sticky top-0 z-[1] bg-card text-[12px] text-ink-3">
            <tr className="border-b border-line">
              <th className="py-2 pl-5 font-normal">รหัส</th>
              <th className="py-2 font-normal">รายการ</th>
              {showSystem && <th className="py-2 font-normal">ระบบ</th>}
              <th className="py-2 font-normal">ตำแหน่ง</th>
              <th className="py-2 font-normal">ยี่ห้อ / รุ่น</th>
              <th className="py-2 font-normal">ประกัน</th>
              <th className="py-2 pr-5 font-normal">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr
                key={a.code}
                data-code={a.code}
                onClick={() => onSelect(a.code)}
                className={cx("cursor-pointer border-b border-line transition-colors duration-150 last:border-b-0", selected === a.code ? "bg-raised" : "hover:bg-raised/60")}
              >
                <td className="py-2 pl-5">
                  <AssetTag code={a.code} />
                </td>
                <td className="py-2">
                  <span className="block">{a.name}</span>
                  <span className="block text-[12px] text-ink-3">{a.category}</span>
                </td>
                {showSystem && <td className="py-2 text-ink-2">{SYSTEM_LABEL[a.system]}</td>}
                <td className="py-2 text-ink-2">{locationOf(a, model)}</td>
                <td className="py-2 text-ink-2">{a.brand}</td>
                <td className="py-2">
                  <Status tone={a.warranty === "active" ? "pos" : a.warranty === "expiring" ? "warn" : "neutral"}>
                    {a.warranty === "expired" ? "หมดประกัน" : thDate(a.warrantyUntil)}
                  </Status>
                </td>
                <td className="py-2 pr-5">
                  <Status tone={ASSET_STATE_TONE[a.state]}>{ASSET_STATE_LABEL[a.state]}</Status>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-6 text-center text-ink-3">
                  ไม่พบอุปกรณ์ตามตัวกรอง
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
