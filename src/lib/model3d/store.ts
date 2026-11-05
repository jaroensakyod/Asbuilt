// 3D model files uploaded for a project (from SketchUp, Revit, ArchiCAD …).
// The record keeps a MediaRef; the bytes live in IndexedDB (demo) or Supabase Storage (live).

import { createCollection } from "@/lib/collection";
import { deleteMedia, saveMedia, type MediaRef } from "@/lib/media";
import { workspace } from "@/lib/workspace";
import { formatOf, isSkpName, rejectReason, type ModelFormat, type SysKey, type ViewFix } from "./classify";
import { convertAndSaveSkp, type SkpStage } from "./skp-client";

export type ModelStage = "design" | "construction" | "asbuilt";

export const STAGE_LABEL: Record<ModelStage, string> = {
  design: "แบบออกแบบ",
  construction: "แบบก่อสร้าง",
  asbuilt: "As-built",
};

export type ModelFile = {
  id: string; // M3D-<time>
  projectId: string;
  name: string; // display name
  format: ModelFormat;
  stage: ModelStage;
  media: MediaRef;
  at: string; // ISO upload time
  by: string;
  note?: string;
  /** set when the file was converted from SketchUp (.skp) on upload */
  source?: {
    name: string;
    size: number;
    version: string | null;
    /** the original .skp in Storage (live mode only) */
    original?: MediaRef;
    info: { layers: number; groups: number; triangles: number; dropped2d: number; droppedFar: number; ms: number };
  };
  /** manual fixes chosen in the viewer when the guess was wrong */
  fix?: ViewFix;
  /** filled after the first successful load in a browser */
  stats?: { parts: number; triangles: number; unit: string; size: [number, number, number]; bySys: Record<SysKey, number>; assets: string[] };
};

export const modelFiles = createCollection<ModelFile>("model_files", []);

export const projectModels = (list: ModelFile[], projectId: string) =>
  list.filter((m) => m.projectId === projectId).sort((a, b) => b.at.localeCompare(a.at));

const uploader = () => {
  const w = workspace();
  return w.displayName ?? w.email ?? "ผู้ใช้เดโม";
};

export async function uploadModel(
  projectId: string,
  file: File,
  opts: { stage: ModelStage; name?: string; note?: string; onSkpStage?: (s: SkpStage) => void },
): Promise<ModelFile> {
  const why = rejectReason(file.name, file.size);
  if (why) throw new Error(why);
  let media: MediaRef;
  let source: ModelFile["source"];
  let format: ModelFormat;
  if (isSkpName(file.name)) {
    // SketchUp: the server converts it to GLB; the record keeps where it came from
    const r = await convertAndSaveSkp(file, opts.onSkpStage);
    media = r.media;
    format = "glb";
    source = { name: file.name, size: file.size, version: r.info.version, original: r.original, info: { layers: r.info.layers.length, groups: r.info.groups, triangles: r.info.triangles, dropped2d: r.info.dropped2d, droppedFar: r.info.droppedFar, ms: r.info.ms } };
  } else {
    media = await saveMedia(file);
    format = formatOf(file.name)!;
  }
  const rec: ModelFile = {
    id: `M3D-${Date.now().toString(36)}`,
    projectId,
    name: opts.name?.trim() || file.name.replace(/\.[^.]+$/, ""),
    format,
    stage: opts.stage,
    media,
    at: new Date().toISOString(),
    by: uploader(),
    note: opts.note?.trim() || undefined,
    source,
  };
  modelFiles.upsert(rec);
  return rec;
}

export async function removeModel(m: ModelFile) {
  modelFiles.remove(m.id);
  await deleteMedia(m.media).catch(() => undefined);
  if (m.source?.original) await deleteMedia(m.source.original).catch(() => undefined);
}

export function saveFix(id: string, fix: ViewFix) {
  const m = modelFiles.get(id);
  if (m) modelFiles.upsert({ ...m, fix, stats: undefined });
}

export function saveStats(id: string, stats: NonNullable<ModelFile["stats"]>) {
  const m = modelFiles.get(id);
  if (!m || JSON.stringify(m.stats) === JSON.stringify(stats)) return;
  modelFiles.upsert({ ...m, stats });
}
