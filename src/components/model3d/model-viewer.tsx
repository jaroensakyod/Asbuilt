"use client";

// Full viewer for 3D files uploaded to a project: pick a file, toggle systems, X-ray,
// cut by height, click a part to see its asset (registry + repairs). Fixes for units /
// orientation are saved on the file record so everyone sees the model the same way.

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type * as THREE from "three";
import { Camera, Focus, Layers, LoaderCircle, RotateCcw, ScanEye, Scissors, TriangleAlert, Upload } from "lucide-react";
import { AssetTag, Card, CardHead, cx, inputCls, Status } from "@/components/ui";
import { REPAIR_STATUS_LABEL, repairs, type Project } from "@/lib/data";
import { assetOf, getModel } from "@/lib/house";
import { useMediaUrl, fileSize } from "@/lib/media";
import { ALL_SYSTEMS, SYSTEMS } from "@/lib/viewer-data";
import { modelFiles, projectModels, saveFix, saveStats, STAGE_LABEL, type ModelFile } from "@/lib/model3d/store";
import { FORMATS, UNIT_LABEL, type SysKey, type Unit } from "@/lib/model3d/classify";
import { disposeModel, loadModel, partOf, type LoadedModel } from "./load";
import { UploadModelForm } from "./upload-form";

const ModelScene = dynamic(() => import("./model-scene").then((m) => m.ModelScene), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-raised" />,
});

const btn =
  "inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-line-strong bg-card px-3 text-[13px] text-ink transition-colors duration-150 hover:bg-raised disabled:opacity-50";
const on = "border-ink bg-ink text-page hover:bg-ink";

type LoadState = { status: "idle" } | { status: "loading"; stage: string; pct?: number } | { status: "ready"; model: LoadedModel } | { status: "error"; error: string };

const noop = () => () => {};

const STAGE_TEXT ={ download: "กำลังดาวน์โหลดไฟล์", parse: "กำลังอ่านโมเดล", prepare: "กำลังจัดวางโมเดล" } as const;

export function ModelViewer({ project, initialFile }: { project: Project; initialFile?: string }) {
  const all = modelFiles.use();
  const files = useMemo(() => projectModels(all, project.id), [all, project.id]);
  const [fileId, setFileId] = useState<string | undefined>(initialFile);
  const file = files.find((f) => f.id === fileId) ?? files[0];
  const [adding, setAdding] = useState(false);
  // the file list lives in browser storage: until hydrated, show a placeholder instead of "no files"
  const hydrated = useSyncExternalStore(noop, () => true, () => false);

  if (!hydrated) return <div className="h-[62vh] min-h-[380px] rounded-[14px] border border-line bg-raised" />;

  if (!files.length || adding)
    return (
      <Card>
        <CardHead title={files.length ? "อัปโหลดโมเดลใหม่" : "ยังไม่มีไฟล์ 3D ของโครงการนี้"} />
        <div className="p-5">
          <UploadModelForm
            projectId={project.id}
            onDone={(m) => {
              setFileId(m.id);
              setAdding(false);
            }}
            onCancel={files.length ? () => setAdding(false) : undefined}
          />
        </div>
      </Card>
    );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 rounded-[14px] border border-line bg-card px-3 py-2.5">
        <label className="flex min-w-0 items-center gap-2 text-[13px] text-ink-2">
          ไฟล์
          <select className={cx(inputCls, "h-8 max-w-[320px] text-[13px]")} value={file.id} onChange={(e) => setFileId(e.target.value)}>
            {files.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} · {f.format.toUpperCase()} · {STAGE_LABEL[f.stage]}
              </option>
            ))}
          </select>
        </label>
        <span className="text-[12px] text-ink-3">
          {fileSize(file.media.size)} · อัปโหลดโดย {file.by} · {new Date(file.at).toLocaleDateString("th-TH", { dateStyle: "medium" })}
          {file.source && (
            <>
              {" "}· แปลงจาก {file.source.name}
              {file.source.version ? ` (SketchUp ${file.source.version.split(".")[0]})` : ""} ใน {(file.source.info.ms / 1000).toFixed(0)} วิ
              {file.source.info.dropped2d + file.source.info.droppedFar > 0 ? ` · ตัดเส้น 2D/ส่วนที่อยู่ห่าง ${file.source.info.dropped2d + file.source.info.droppedFar} กลุ่ม` : ""}
            </>
          )}
        </span>
        <button type="button" className={cx(btn, "ml-auto")} onClick={() => setAdding(true)}>
          <Upload size={16} strokeWidth={1.5} /> อัปโหลดไฟล์ใหม่
        </button>
      </div>
      <FileView key={`${file.id}:${JSON.stringify(file.fix ?? {})}`} file={file} project={project} />
    </div>
  );
}

function FileView({ file, project }: { file: ModelFile; project: Project }) {
  const url = useMediaUrl(file.media);
  // this view is remounted per file (and per fix), so it always starts in "loading"
  const [state, setState] = useState<LoadState>({ status: "loading", stage: STAGE_TEXT.download });
  const [visible, setVisible] = useState<Record<SysKey, boolean>>(ALL_SYSTEMS);
  const [xray, setXray] = useState(false);
  const [cutOn, setCutOn] = useState(false);
  const [cut, setCut] = useState(0);
  const [selected, setSelected] = useState<THREE.Mesh | null>(null);
  const [fitKey, setFitKey] = useState(0);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!url) return;
    let alive = true;
    let loaded: LoadedModel | null = null;
    loadModel(url, file.format, file.fix, (stage, pct) => alive && setState({ status: "loading", stage: STAGE_TEXT[stage], pct }))
      .then((m) => {
        loaded = m;
        if (!alive) return disposeModel(m);
        setState({ status: "ready", model: m });
        setCut(Math.round(m.size.y * 0.6 * 10) / 10);
        saveStats(file.id, m.stats);
      })
      .catch((e: unknown) => alive && setState({ status: "error", error: e instanceof Error ? e.message : String(e) }));
    return () => {
      alive = false;
      if (loaded) disposeModel(loaded);
    };
    // file.fix is part of the parent's key, so a fix remounts this view
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, file.id, file.format]);

  const projectRepairs = useMemo(() => repairs.filter((r) => r.projectId === project.id), [project.id]);
  const flagged = useMemo(() => new Set(projectRepairs.filter((r) => r.status !== "closed").map((r) => r.asset)), [projectRepairs]);
  const model = state.status === "ready" ? state.model : null;
  const stats = model?.stats;

  const onSelect = useCallback((m: THREE.Mesh | null) => setSelected(m), []);
  const selectAsset = (code: string) => {
    const m = model?.parts.find((p) => partOf(p)?.asset === code);
    if (!m) return;
    const sys = partOf(m)!.sys;
    setVisible((v) => ({ ...v, [sys]: true }));
    setSelected(m);
  };
  const snapshot = () => {
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${project.id}_${file.name}.png`;
    a.click();
  };

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="relative h-[62vh] min-h-[380px] overflow-hidden rounded-[14px] border border-line bg-raised lg:h-[calc(100vh-190px)]">
        {model && (
          <ModelScene model={model} visible={visible} xray={xray} cut={cutOn ? cut : null} selected={selected} onSelect={onSelect} flagged={flagged} fitKey={fitKey} onCanvas={setCanvas} />
        )}
        {(state.status === "loading" || state.status === "idle") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[14px] text-ink-2">
            <LoaderCircle size={22} strokeWidth={1.5} className="animate-spin" />
            {state.status === "loading" ? state.stage : "กำลังเตรียมไฟล์"}
            {state.status === "loading" && state.pct != null && <span className="num font-mono text-[12px] text-ink-3">{state.pct}%</span>}
          </div>
        )}
        {state.status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-[14px] text-ink-2">
            <TriangleAlert size={22} strokeWidth={1.5} className="text-accent-text" />
            <p className="max-w-[460px]">{state.error}</p>
            <p className="max-w-[460px] text-[12px] text-ink-3">ลอง export ใหม่เป็น GLB หรือ DAE แล้วอัปโหลดอีกครั้ง</p>
          </div>
        )}
        {model && (
          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            <button type="button" className={cx(btn, "shadow-sm", xray && on)} onClick={() => setXray((x) => !x)} aria-pressed={xray}>
              <ScanEye size={16} strokeWidth={1.5} /> X-Ray
            </button>
            <button type="button" className={cx(btn, "shadow-sm", cutOn && on)} onClick={() => setCutOn((x) => !x)} aria-pressed={cutOn}>
              <Scissors size={16} strokeWidth={1.5} /> ตัดตามความสูง
            </button>
            <button type="button" className={cx(btn, "shadow-sm")} onClick={() => setFitKey((k) => k + 1)}>
              <Focus size={16} strokeWidth={1.5} /> มุมเริ่มต้น
            </button>
            <button type="button" className={cx(btn, "shadow-sm")} onClick={snapshot} disabled={!canvas}>
              <Camera size={16} strokeWidth={1.5} /> บันทึกภาพ
            </button>
          </div>
        )}
        {model && cutOn && (
          <div className="absolute bottom-3 left-3 right-3 flex items-center gap-3 rounded-[10px] border border-line bg-card/95 px-3 py-2 text-[13px] shadow-sm sm:right-auto sm:w-[360px]">
            <span className="shrink-0 text-ink-2">ความสูงตัด</span>
            <input
              type="range"
              min={0}
              max={Math.ceil(model.size.y * 10) / 10}
              step={0.1}
              value={cut}
              onChange={(e) => setCut(Number(e.target.value))}
              className="min-w-0 flex-1 accent-[var(--color-ink,#13243b)]"
              aria-label="ความสูงที่ตัดโมเดล (เมตร)"
            />
            <span className="num w-14 shrink-0 text-right font-mono">{cut.toFixed(1)} ม.</span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {selected && <SelectionCard mesh={selected} project={project} repairsOf={projectRepairs} onClose={() => setSelected(null)} />}

        <Card>
          <CardHead title="ระบบงาน" meta={stats ? `${stats.parts.toLocaleString("th-TH")} ชิ้น` : undefined} action={<Layers size={16} strokeWidth={1.5} className="text-ink-3" />} />
          <ul className="flex flex-col py-1.5">
            {SYSTEMS.map((s) => {
              const n = stats?.bySys[s.key] ?? 0;
              return (
                <li key={s.key}>
                  <label className={cx("flex cursor-pointer items-center gap-2.5 px-5 py-1.5 text-[14px]", !n && "opacity-45")}>
                    <input type="checkbox" checked={visible[s.key]} onChange={(e) => setVisible((v) => ({ ...v, [s.key]: e.target.checked }))} className="size-4 accent-[#13243b]" />
                    <span className="size-2.5 rounded-full" style={{ background: s.color }} />
                    <span className="flex-1">{s.label}</span>
                    <span className="num font-mono text-[12px] text-ink-3">{n.toLocaleString("th-TH")}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="flex gap-2 border-t border-line px-5 py-2.5">
            <button type="button" className={btn} onClick={() => setVisible(ALL_SYSTEMS)}>
              แสดงทั้งหมด
            </button>
            <button type="button" className={btn} onClick={() => setVisible({ ...Object.fromEntries(SYSTEMS.map((s) => [s.key, false])), elec: true, plumb: true, sanitary: true, hvac: true } as Record<SysKey, boolean>)}>
              เฉพาะงานระบบ
            </button>
          </div>
        </Card>

        {stats && (
          <Card>
            <CardHead title="อุปกรณ์ในโมเดล" meta={`${stats.assets.length} รหัส`} />
            {stats.assets.length ? (
              <div className="flex max-h-[220px] flex-wrap gap-1.5 overflow-auto px-5 py-3">
                {stats.assets.map((code) => (
                  <button key={code} type="button" onClick={() => selectAsset(code)} className={cx("rounded-[6px] transition-opacity hover:opacity-70", flagged.has(code) && "ring-2 ring-[#d9483b]/60")} title={flagged.has(code) ? "มีแจ้งซ่อมเปิดอยู่" : undefined}>
                    <AssetTag code={code} />
                  </button>
                ))}
              </div>
            ) : (
              <p className="px-5 py-3 text-[13px] leading-relaxed text-ink-3">
                ไม่พบรหัสอุปกรณ์ในชื่อชิ้นส่วน ให้ตั้งชื่อ Component ใน SketchUp เป็นรหัส เช่น <span className="font-mono">AC-201</span>, <span className="font-mono">WC-101</span> แล้วคลิกที่ชิ้นนั้นจะเห็นประวัติแจ้งซ่อมและประกัน
              </p>
            )}
          </Card>
        )}

        {model && <FixCard file={file} model={model} />}
      </div>
    </div>
  );
}

function SelectionCard({ mesh, project, repairsOf, onClose }: { mesh: THREE.Mesh; project: Project; repairsOf: typeof repairs; onClose: () => void }) {
  const part = partOf(mesh)!;
  const sys = SYSTEMS.find((s) => s.key === part.sys)!;
  const reg = part.asset ? assetOf(getModel(project.modelCode), part.asset) : undefined;
  const reps = part.asset ? repairsOf.filter((r) => r.asset === part.asset) : [];
  return (
    <Card className="border-ink/30">
      <CardHead
        title={part.asset ?? "ชิ้นส่วนที่เลือก"}
        meta={sys.label}
        action={
          <button type="button" onClick={onClose} className="text-[13px] text-ink-2 hover:text-ink">
            ปิด
          </button>
        }
      />
      <div className="flex flex-col gap-2 px-5 py-3 text-[13px]">
        <p className="break-words text-ink">{part.label}</p>
        {part.ifcType && <p className="font-mono text-[12px] text-ink-3">{part.ifcType}</p>}
        {reg ? (
          <dl className="grid grid-cols-[88px_1fr] gap-x-2 gap-y-1 text-ink-2">
            <dt className="text-ink-3">ชื่ออุปกรณ์</dt>
            <dd>{reg.name}</dd>
            <dt className="text-ink-3">ยี่ห้อ</dt>
            <dd>{reg.brand}</dd>
            <dt className="text-ink-3">ติดตั้ง</dt>
            <dd>{reg.installed}</dd>
            <dt className="text-ink-3">ประกันถึง</dt>
            <dd>{reg.warrantyUntil}</dd>
          </dl>
        ) : part.asset ? (
          <p className="text-ink-3">รหัส {part.asset} ยังไม่อยู่ในทะเบียนอุปกรณ์ของแบบบ้าน {project.modelCode}</p>
        ) : (
          <p className="text-ink-3">ชิ้นส่วนนี้ไม่มีรหัสอุปกรณ์</p>
        )}
        {part.asset && (
          <div className="mt-1 border-t border-line pt-2">
            <p className="mb-1.5 text-ink-3">แจ้งซ่อม {reps.length} เรื่อง</p>
            {reps.slice(0, 5).map((r) => (
              <Link key={r.id} href="/repairs" className="flex items-center justify-between gap-2 py-1 hover:text-ink">
                <span className="truncate">
                  <span className="font-mono text-[12px] text-ink-3">{r.id}</span> {r.title}
                </span>
                <Status tone={r.status === "closed" ? "pos" : "warn"}>{REPAIR_STATUS_LABEL[r.status]}</Status>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

const UNITS: Unit[] = ["m", "cm", "mm", "in", "ft"];

function FixCard({ file, model }: { file: ModelFile; model: LoadedModel }) {
  const carriesUnit = file.format === "dae" || file.format === "ifc";
  const [w, h, d] = model.stats.size; // three.js axes: x width, y height, z depth
  const fmt = FORMATS.find((f) => f.ext === file.format);
  return (
    <Card>
      <CardHead title="ขนาดและการจัดวาง" meta={fmt?.label} />
      <div className="flex flex-col gap-3 px-5 py-3 text-[13px]">
        <p className="text-ink-2">
          กว้าง <span className="num font-mono">{w}</span> × ลึก <span className="num font-mono">{d}</span> × สูง <span className="num font-mono">{h}</span> ม. ·{" "}
          <span className="num font-mono">{model.stats.triangles.toLocaleString("th-TH")}</span> สามเหลี่ยม
        </p>
        <p className="text-[12px] text-ink-3">ถ้าขนาดหรือทิศผิด (บ้านเล็กจิ๋ว ใหญ่เกิน หรือนอนตะแคง) ปรับได้ที่นี่ ค่าจะบันทึกไว้กับไฟล์</p>
        {!carriesUnit && (
          <label className="flex items-center gap-2 text-ink-2">
            หน่วยในไฟล์
            <select
              className={cx(inputCls, "h-8 flex-1 text-[13px]")}
              value={file.fix?.unit ?? ""}
              onChange={(e) => saveFix(file.id, { ...file.fix, unit: (e.target.value || undefined) as Unit | undefined })}
            >
              <option value="">อัตโนมัติ (ตอนนี้: {UNIT_LABEL[model.stats.unit as Unit] ?? model.stats.unit})</option>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {UNIT_LABEL[u]}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btn} onClick={() => saveFix(file.id, { ...file.fix, zUp: !model.upright })}>
            <RotateCcw size={16} strokeWidth={1.5} /> หมุน 90° (แก้นอนตะแคง)
          </button>
          {file.fix && (
            <button type="button" className={btn} onClick={() => saveFix(file.id, {})}>
              ล้างค่าที่ปรับ
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}
