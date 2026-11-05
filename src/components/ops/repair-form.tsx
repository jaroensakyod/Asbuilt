"use client";

import { onTenantLoad } from "@/lib/workspace";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { AssetTag, Field, cx, inputCls } from "@/components/ui";
import { projects, SEVERITY_LABEL, SOURCE_LABEL, SYSTEM_LABEL, team, thDate, TODAY, type RepairSource, type Severity } from "@/lib/data";
import { roomOf } from "@/lib/house";
import { addRepair, createWorkOrderFromRepair, type NewRepair, type OpsRepair, type OpsWorkOrder } from "@/lib/ops-store";
import { MediaField } from "@/components/media/media-field";
import { AiFilledNote } from "@/components/ai-field/ai-bits";
import { DefectAssist } from "@/components/ai-field/defect-assist";
import { defectDetailText, type AssetCandidate } from "@/lib/ai-field/defect";
import type { MediaRef } from "@/lib/media";
import { assetLocation, ownerShort, projectAssets, SLA_HOURS, TECH_BY_SYSTEM } from "./seed";
import { areaCls, Btn, I, Modal } from "./bits";

// live arrays: refilled when a company is loaded
export const TECHNICIANS: string[] = [];
export const ASSIGNEES: string[] = [];
const fillPeople = () => {
  TECHNICIANS.splice(0, TECHNICIANS.length, ...team.filter((m) => m.role === "technician" && m.active).map((m) => m.name));
  const others = team.filter((m) => m.active && (m.role === "foreman" || m.role === "engineer" || m.role === "pm" || m.role === "admin")).map((m) => m.name);
  ASSIGNEES.splice(0, ASSIGNEES.length, ...new Set([...TECHNICIANS, ...others]));
  // a company with no technicians yet can still assign work to anyone on the team
  if (!TECHNICIANS.length) TECHNICIANS.push(...ASSIGNEES);
};
fillPeople();
onTenantLoad(fillPeople);

export type RepairPreset = { asset?: string; project?: string };

export function RepairForm({ open, onClose, preset, onSaved }: { open: boolean; onClose: () => void; preset?: RepairPreset; onSaved?: (r: OpsRepair, wo?: OpsWorkOrder) => void }) {
  return open ? <Body key={`${preset?.project ?? ""}-${preset?.asset ?? ""}`} onClose={onClose} preset={preset} onSaved={onSaved} /> : null;
}

function Body({ onClose, preset, onSaved }: { onClose: () => void; preset?: RepairPreset; onSaved?: (r: OpsRepair, wo?: OpsWorkOrder) => void }) {
  const initialProject = projects.find((p) => p.id === preset?.project) ?? projects.find((p) => p.status === "delivered") ?? projects[0];
  const [projectId, setProjectId] = useState(initialProject.id);
  const project = projects.find((p) => p.id === projectId);
  const { model, assets } = useMemo(() => projectAssets(project), [project]);
  const [assetCode, setAssetCode] = useState(preset?.asset && assets.some((a) => a.code === preset.asset) ? preset.asset : "");
  const [q, setQ] = useState(preset?.asset && !assets.some((a) => a.code === preset.asset) ? preset.asset : "");
  const asset = assets.find((a) => a.code === assetCode);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [severity, setSeverity] = useState<Severity>("medium");
  const [source, setSource] = useState<RepairSource>(project?.status === "delivered" ? "customer" : "internal");
  const [reporter, setReporter] = useState(ownerShort(initialProject));
  const [assignee, setAssignee] = useState(asset ? TECH_BY_SYSTEM[asset.system] : TECHNICIANS[0] ?? "");
  const [withWo, setWithWo] = useState(false);
  const [photos, setPhotos] = useState<MediaRef[]>([]);
  const [aiFilled, setAiFilled] = useState<string[]>([]);
  const candidates = useMemo<AssetCandidate[]>(() => (model ? assets.filter((a) => a.category !== "เบรกเกอร์ลูกย่อย").map((a) => ({ code: a.code, name: a.name, system: a.system, category: a.category, location: assetLocation(model, a) })) : []), [assets, model]);

  const found = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!model) return [];
    return assets
      .filter((a) => a.category !== "เบรกเกอร์ลูกย่อย" || s)
      .filter((a) => !s || `${a.code} ${a.name} ${a.category} ${roomOf(model, a.room)?.name ?? a.room}`.toLowerCase().includes(s))
      .slice(0, 40);
  }, [assets, model, q]);

  const chooseProject = (id: string) => {
    setProjectId(id);
    setAssetCode("");
    const p = projects.find((x) => x.id === id);
    setReporter(ownerShort(p));
    setSource(p?.status === "delivered" ? "customer" : "internal");
  };
  const chooseAsset = (code: string) => {
    setAssetCode(code);
    const a = assets.find((x) => x.code === code);
    if (a) {
      setAssignee(TECH_BY_SYSTEM[a.system]);
      if (project?.status === "delivered" && a.warrantyUntil >= TODAY && source === "customer") setSource("warranty");
    }
  };

  const valid = !!asset && title.trim().length > 0;
  const save = () => {
    if (!asset || !model || !valid) return;
    // photos ride along on the record (OpsRepair has no photo field yet)
    const input: NewRepair & { photos?: MediaRef[] } = {
      photos: photos.length ? photos : undefined,
      title: title.trim(),
      detail: detail.trim(),
      asset: asset.code,
      assetName: asset.name,
      projectId,
      location: assetLocation(model, asset),
      system: asset.system,
      severity,
      source,
      assignee,
      reporter: reporter.trim() || undefined,
    };
    const r = addRepair(input);
    const wo = withWo ? createWorkOrderFromRepair(r.id) : undefined;
    onSaved?.(r, wo);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      width={760}
      title="แจ้งซ่อม / บันทึกปัญหา"
      footer={
        <>
          <label className="mr-auto flex items-center gap-2 text-[13px] text-ink-2">
            <input type="checkbox" checked={withWo} onChange={() => setWithWo((v) => !v)} className="accent-[var(--text)]" />
            สร้างใบสั่งงานทันที
          </label>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary onClick={save} disabled={!valid}>
            บันทึกแจ้งซ่อม
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Field label="โครงการ / บ้าน">
            <select value={projectId} onChange={(e) => chooseProject(e.target.value)} className={inputCls}>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id} · {p.name} · {p.modelCode}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="col-span-2 flex flex-col gap-1.5 text-[13px] text-ink-2">
          อุปกรณ์ / ชิ้นงาน
          <div className="grid grid-cols-[1fr_260px] gap-3">
            <div className="rounded-[10px] border border-line-strong">
              <div className="relative border-b border-line">
                <Search {...I} className="pointer-events-none absolute left-2.5 top-2.5 text-ink-3" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหารหัส ชื่ออุปกรณ์ หรือห้อง เช่น WC-201" className="h-9 w-full rounded-t-[10px] bg-transparent pl-8 pr-3 text-[14px] text-ink outline-none placeholder:text-ink-3" />
              </div>
              <ul className="max-h-[220px] overflow-y-auto py-1">
                {found.map((a) => (
                  <li key={a.code}>
                    <button
                      type="button"
                      onClick={() => chooseAsset(a.code)}
                      className={cx("flex w-full items-center gap-3 px-3 py-1.5 text-left text-[13px] transition-colors duration-150", a.code === assetCode ? "bg-raised" : "hover:bg-raised/60")}
                    >
                      <AssetTag code={a.code} />
                      <span className="min-w-0 flex-1 truncate text-ink">{a.name}</span>
                      <span className="shrink-0 text-ink-3">{model ? assetLocation(model, a) : ""}</span>
                    </button>
                  </li>
                ))}
                {found.length === 0 && <li className="px-3 py-4 text-ink-3">ไม่พบอุปกรณ์</li>}
              </ul>
            </div>
            <div className="rounded-[10px] border border-line bg-raised/50 p-3">
              {asset && model ? (
                <div className="flex flex-col gap-1.5">
                  <AssetTag code={asset.code} />
                  <p className="text-ink">{asset.name}</p>
                  <p className="text-ink-3">{asset.category}</p>
                  <p>{assetLocation(model, asset)}</p>
                  <p>ระบบ {SYSTEM_LABEL[asset.system]}</p>
                  <p>ยี่ห้อ {asset.brand}</p>
                  <p className={asset.warrantyUntil >= TODAY ? "text-pos" : "text-ink-3"}>
                    {asset.warrantyUntil >= TODAY ? "อยู่ในประกันถึง" : "หมดประกันเมื่อ"} {thDate(asset.warrantyUntil)}
                  </p>
                </div>
              ) : (
                <p className="text-ink-3">เลือกอุปกรณ์จากรายการด้านซ้าย</p>
              )}
            </div>
          </div>
        </div>

        <div className="col-span-2">
          <Field label="อาการ / หัวข้อ">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น ชักโครกน้ำไม่หยุดไหล" className={inputCls} />
          </Field>
        </div>
        <div className="col-span-2">
          <Field label="รายละเอียด">
            <textarea value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="สิ่งที่พบ เวลาที่เกิด ความถี่" className={areaCls} />
          </Field>
        </div>
        <div className="col-span-2 flex flex-col gap-2">
          <MediaField value={photos} onChange={setPhotos} label="รูปอาการ (ไม่บังคับ)" photosOnly />
          <DefectAssist
            photos={photos}
            note={[title, detail].filter(Boolean).join(" · ")}
            context={project?.status === "delivered" ? "repair" : "construction"}
            assets={candidates}
            onApply={(s) => {
              setTitle(s.title);
              setDetail(defectDetailText(s));
              setSeverity(s.severity);
              const f = ["อาการ", "รายละเอียด", "ความรุนแรง"];
              if (s.asset) {
                chooseAsset(s.asset.code);
                setQ(s.asset.code);
                f.push("อุปกรณ์");
              }
              setAiFilled(f);
            }}
          />
          <AiFilledNote fields={aiFilled} />
        </div>
        <div className="col-span-2 flex flex-col gap-1.5 text-[13px] text-ink-2">
          ความรุนแรง
          <div className="flex gap-2">
            {(["high", "medium", "low"] as Severity[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSeverity(s)}
                aria-pressed={severity === s}
                className={cx("flex h-9 flex-1 items-center justify-between rounded-[8px] border px-3 text-[13px] transition-colors duration-150", severity === s ? "border-ink bg-ink text-card" : "border-line-strong bg-card text-ink hover:bg-raised")}
              >
                {SEVERITY_LABEL[s]}
                <span className="num font-mono text-[12px] opacity-70">SLA {SLA_HOURS[s]} ชม.</span>
              </button>
            ))}
          </div>
        </div>
        <Field label="แหล่งที่มา">
          <select value={source} onChange={(e) => setSource(e.target.value as RepairSource)} className={inputCls}>
            {(Object.keys(SOURCE_LABEL) as RepairSource[]).map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="ผู้แจ้ง">
          <input value={reporter} onChange={(e) => setReporter(e.target.value)} className={inputCls} />
        </Field>
        <Field label="ผู้รับผิดชอบ">
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={inputCls}>
            {ASSIGNEES.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </Field>
        <div className="flex items-end pb-2 text-[13px] text-ink-3">ครบกำหนดภายใน {SLA_HOURS[severity] / 24} วัน นับจากวันนี้</div>
      </div>
    </Modal>
  );
}
