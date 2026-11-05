import "server-only";

// .skp → GLB on the server with OpenSKP (MIT, reads SketchUp files without SketchUp).
// OpenSKP 1.5.0 is patched (patches/openskp+1.5.0.patch) to read SketchUp 2019 layer line styles
// and colour attributes. Instancing is kept (each component stored once), 2D CAD linework and far
// stray groups are dropped so the building fills the view.

import { buildInstancedScene, toInstancedGLB, type InstancedScene } from "openskp";
import { isSkp, pickBuilding, skpVersion } from "./skp-scene";

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

export class SkpError extends Error {}

export function convertSkp(bytes: Uint8Array): { glb: Uint8Array; info: SkpInfo } {
  if (!isSkp(bytes)) throw new SkpError("ไฟล์นี้ไม่ใช่ไฟล์ SketchUp (.skp)");
  const t0 = Date.now();
  let scene: InstancedScene;
  try {
    const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    scene = buildInstancedScene(ab, { respectEdgeVisibility: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new SkpError(`อ่านไฟล์ .skp ไม่ได้: ${msg.slice(0, 180)}`);
  }
  const meshTris = new Map(scene.meshResources.map((m) => [m.id, m.primitives.reduce((a, p) => a + (p.indices ? p.indices.length / 3 : 0), 0)]));
  const pick = pickBuilding(scene.sceneHierarchy.children, meshTris);
  if (!pick.keep.length) throw new SkpError("ไม่พบรูปทรง 3D ในไฟล์ (มีแต่เส้น 2D)");
  const glb = toInstancedGLB({ ...scene, sceneHierarchy: { ...scene.sceneHierarchy, children: pick.keep } });
  return {
    glb,
    info: {
      version: skpVersion(bytes),
      layers: Object.keys(scene.layerColors ?? scene.layerHidden ?? {}),
      groups: pick.keep.length,
      triangles: Math.round(pick.triangles),
      dropped2d: pick.dropped2d,
      droppedFar: pick.droppedFar,
      materials: scene.gltfMaterials.length,
      ms: Date.now() - t0,
      glbBytes: glb.byteLength,
    },
  };
}
