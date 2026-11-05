"use client";

// Browser side of .skp upload: send the file to /api/skp and get a GLB back.
//   demo / local: post the bytes, receive the GLB bytes, store them like any uploaded file
//   live: the .skp is first saved to Storage (saveMedia), then the server converts it there
//         and writes the GLB next to it — large files never pass through the API request body.

import { saveMedia, type MediaRef } from "@/lib/media";
import { isLiveReady } from "@/lib/workspace";

export type SkpInfo = {
  version: string | null;
  layers: string[];
  groups: number;
  triangles: number;
  dropped2d: number;
  droppedFar: number;
  materials: number;
  ms: number;
  glbBytes: number;
};

export type SkpStage = "upload" | "convert" | "save";

const glbName = (name: string) => name.replace(/\.skp$/i, "") + ".glb";

async function errorOf(res: Response) {
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return new Error(body.error ?? `แปลงไฟล์ไม่สำเร็จ (${res.status})`);
}

/** Convert a .skp file and store the resulting GLB. Returns the GLB's MediaRef and what the converter found. */
export async function convertAndSaveSkp(file: File, onStage?: (s: SkpStage) => void): Promise<{ media: MediaRef; info: SkpInfo; original?: MediaRef }> {
  let original: MediaRef | undefined;
  if (isLiveReady()) {
    onStage?.("upload");
    original = await saveMedia(file);
    if (original.path) {
      onStage?.("convert");
      const res = await fetch("/api/skp", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: original.path }) });
      if (!res.ok) throw await errorOf(res);
      const r = (await res.json()) as { path: string; size: number; info: SkpInfo };
      const media: MediaRef = { id: `MED-${Date.now().toString(36)}-glb`, name: glbName(file.name), type: "model/gltf-binary", size: r.size, at: new Date().toISOString(), path: r.path };
      return { media, info: r.info, original };
    }
    // Storage refused the file (e.g. over the plan's file-size limit): fall back to a direct conversion
  }
  onStage?.("convert");
  const res = await fetch("/api/skp", { method: "POST", headers: { "content-type": "application/octet-stream" }, body: file });
  if (!res.ok) throw await errorOf(res);
  const info = JSON.parse(decodeURIComponent(res.headers.get("x-skp-info") ?? "%7B%7D")) as SkpInfo;
  const glb = await res.blob();
  onStage?.("save");
  const media = await saveMedia(new File([glb], glbName(file.name), { type: "model/gltf-binary" }));
  // keep the original .skp too (in demo mode it stays in this browser) so it can be downloaded again
  original ??= await saveMedia(file).catch(() => undefined);
  return { media, info, original };
}
