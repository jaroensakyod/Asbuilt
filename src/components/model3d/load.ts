"use client";

// Turns an uploaded 3D file into a three.js scene that's ready to show:
//   parse (GLB/glTF/OBJ/FBX/DAE/IFC) → fix orientation (Z-up) → scale to metres →
//   sit on the ground, centred → tag every mesh with its system and asset code.
// Loaders are imported lazily so the viewer chunk only pulls what a file needs.

import * as THREE from "three";
import { assetCodeOf, assetCodeOfPath, needsUpright, summarize, systemOfIfcType, systemOfPath, unitScale, type ModelFormat, type SysKey, type ViewFix } from "@/lib/model3d/classify";
import { isGenericName, KIND_SYS, registeredCode, type PartGroup, type PartKind } from "@/lib/model3d/parts-ai";

export type PartData = {
  /** system shown (from names, or from the AI label when there is one) */
  sys: SysKey;
  /** registered asset code (see relabel), null when none */
  asset: string | null;
  label: string;
  ifcType?: string;
  /** system guessed from names alone */
  sys0?: SysKey;
  /** code-looking text in the names, before checking the registry */
  code?: string | null;
  /** id of the group this mesh belongs to (see PartGroup) */
  gid?: string;
  kind?: PartKind;
};

export type LoadedModel = {
  root: THREE.Group;
  parts: THREE.Mesh[];
  size: THREE.Vector3; // metres, after normalising
  /** true when the file was turned from Z-up to Y-up */
  upright: boolean;
  stats: { parts: number; triangles: number; unit: string; size: [number, number, number]; bySys: Record<SysKey, number>; assets: string[] };
  /** groups of parts, described for AI labelling */
  groups: PartGroup[];
};

export type Progress = (stage: "download" | "parse" | "prepare", pct?: number) => void;

export const partOf = (o: THREE.Object3D) => o.userData.part as PartData | undefined;

async function download(url: string, onProgress?: Progress): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ดาวน์โหลดไฟล์ไม่สำเร็จ (${res.status})`);
  const total = Number(res.headers.get("content-length") ?? 0);
  if (!res.body || !total) return res.arrayBuffer();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    onProgress?.("download", Math.min(99, Math.round((got / total) * 100)));
  }
  const out = new Uint8Array(got);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out.buffer;
}

const text = (buf: ArrayBuffer) => new TextDecoder().decode(buf);

async function parse(buf: ArrayBuffer, fmt: ModelFormat): Promise<THREE.Object3D> {
  switch (fmt) {
    case "glb":
    case "gltf": {
      const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([
        import("three/examples/jsm/loaders/GLTFLoader.js"),
        import("three/examples/jsm/libs/meshopt_decoder.module.js"),
      ]);
      const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
      const gltf = await loader.parseAsync(fmt === "gltf" ? text(buf) : buf, "");
      return gltf.scene;
    }
    case "obj": {
      const { OBJLoader } = await import("three/examples/jsm/loaders/OBJLoader.js");
      return new OBJLoader().parse(text(buf));
    }
    case "fbx": {
      const { FBXLoader } = await import("three/examples/jsm/loaders/FBXLoader.js");
      return new FBXLoader().parse(buf, "");
    }
    case "dae": {
      const { ColladaLoader } = await import("three/examples/jsm/loaders/ColladaLoader.js");
      const c = new ColladaLoader().parse(text(buf), "");
      if (!c?.scene) throw new Error("อ่านไฟล์ DAE ไม่ได้");
      return c.scene; // the loader already turns Z-up into Y-up and applies the file's unit
    }
    case "ifc":
      return parseIfc(new Uint8Array(buf));
  }
}

// ---------- IFC (web-ifc, WASM served from /wasm/) ----------

async function parseIfc(data: Uint8Array): Promise<THREE.Group> {
  const WebIFC = await import("web-ifc");
  const api = new WebIFC.IfcAPI();
  api.SetWasmPath("/wasm/", true);
  await api.Init(undefined, true);
  const group = new THREE.Group();
  group.name = "IFC";
  const mats = new Map<string, THREE.MeshStandardMaterial>();
  const matOf = (c: { x: number; y: number; z: number; w: number }) => {
    const key = `${c.x.toFixed(3)},${c.y.toFixed(3)},${c.z.toFixed(3)},${c.w.toFixed(2)}`;
    let m = mats.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color: new THREE.Color(c.x, c.y, c.z), transparent: c.w < 1, opacity: c.w, side: THREE.DoubleSide, roughness: 0.85 });
      mats.set(key, m);
    }
    return m;
  };
  const id = api.OpenModel(data, { COORDINATE_TO_ORIGIN: true });
  try {
    api.StreamAllMeshes(id, (mesh) => {
      const eid = mesh.expressID;
      let type = "";
      let name = "";
      let tag = "";
      try {
        type = api.GetNameFromTypeCode(api.GetLineType(id, eid));
        const line = api.GetLine(id, eid);
        name = line?.Name?.value ?? "";
        tag = line?.Tag?.value ?? "";
      } catch {
        // some entities have no readable attributes; geometry is still fine
      }
      const sys = systemOfIfcType(type, name);
      const asset = assetCodeOf(name) ?? assetCodeOf(tag);
      const label = name || type.replace(/^IFC/, "Ifc");
      const geoms = mesh.geometries;
      for (let i = 0; i < geoms.size(); i++) {
        const pg = geoms.get(i);
        const g = api.GetGeometry(id, pg.geometryExpressID);
        const v = api.GetVertexArray(g.GetVertexData(), g.GetVertexDataSize());
        const idx = api.GetIndexArray(g.GetIndexData(), g.GetIndexDataSize());
        g.delete();
        if (!idx.length) continue;
        const n = v.length / 6;
        const pos = new Float32Array(n * 3);
        const nor = new Float32Array(n * 3);
        for (let k = 0; k < n; k++) {
          pos[k * 3] = v[k * 6];
          pos[k * 3 + 1] = v[k * 6 + 1];
          pos[k * 3 + 2] = v[k * 6 + 2];
          nor[k * 3] = v[k * 6 + 3];
          nor[k * 3 + 1] = v[k * 6 + 4];
          nor[k * 3 + 2] = v[k * 6 + 5];
        }
        const bg = new THREE.BufferGeometry();
        bg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        bg.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
        bg.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1));
        bg.applyMatrix4(new THREE.Matrix4().fromArray(pg.flatTransformation));
        const m = new THREE.Mesh(bg, matOf(pg.color));
        m.name = label;
        m.userData.part = { sys, asset, code: asset, label, ifcType: type } satisfies PartData;
        group.add(m);
      }
    });
  } finally {
    api.CloseModel(id);
  }
  if (!group.children.length) throw new Error("ไม่พบชิ้นส่วนที่มีรูปทรงในไฟล์ IFC");
  return group;
}

// ---------- normalise + classify ----------

const namesUp = (o: THREE.Object3D) => {
  const out: string[] = [];
  for (let p: THREE.Object3D | null = o; p; p = p.parent) {
    if (p.name) out.push(p.name);
    const extras = p.userData as Record<string, unknown>;
    for (const k of ["tag", "layer", "Tag", "Layer", "name"]) if (typeof extras[k] === "string") out.push(extras[k] as string);
  }
  return out;
};

const materialNames = (m: THREE.Mesh) => (Array.isArray(m.material) ? m.material : [m.material]).map((x) => x?.name).filter(Boolean) as string[];

function prepare(obj: THREE.Object3D, fmt: ModelFormat, fix: ViewFix = {}) {
  const root = new THREE.Group();
  root.name = "uploaded-model";
  const inner = new THREE.Group();
  inner.add(obj);
  root.add(inner);

  // orientation
  inner.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(inner);
  let size = box.getSize(new THREE.Vector3());
  const upright = needsUpright(size, fmt, fix.zUp);
  if (upright) {
    inner.rotation.x = -Math.PI / 2;
    inner.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(inner);
    size = box.getSize(new THREE.Vector3());
  }
  // units
  // DAE and IFC carry their own units (the loaders already converted them), so only the guess applies there
  const carriesUnit = fmt === "dae" || fmt === "ifc";
  const { scale, unit } = unitScale(Math.max(size.x, size.y, size.z), fmt, carriesUnit ? undefined : fix.unit);
  inner.scale.multiplyScalar(scale);
  inner.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(inner);
  const c = box.getCenter(new THREE.Vector3());
  inner.position.set(-c.x, -box.min.y, -c.z);
  inner.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(inner);
  size = box.getSize(new THREE.Vector3());

  // parts
  const parts: THREE.Mesh[] = [];
  let triangles = 0;
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    m.receiveShadow = true;
    // SketchUp models often have reversed faces: draw both sides
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) if (mat) mat.side = THREE.DoubleSide;
    if (!m.userData.part) {
      const names = namesUp(m);
      const sys = systemOfPath([...names, ...materialNames(m)]);
      const code = assetCodeOfPath(names);
      const label = names.find((n) => !isGenericName(n)) ?? names[0] ?? "ชิ้นส่วน";
      m.userData.part = { sys, asset: code, code, label } satisfies PartData;
    }
    const part = m.userData.part as PartData;
    part.sys0 ??= part.sys;
    m.userData.baseMaterial = m.material;
    const g = m.geometry;
    triangles += g.index ? g.index.count / 3 : (g.attributes.position?.count ?? 0) / 3;
    parts.push(m);
  });
  if (!parts.length) throw new Error("ไม่พบชิ้นส่วนที่มีรูปทรงในไฟล์");

  const groups = groupParts(obj, root, triangles);
  const sum = summarize(parts.map((p) => partOf(p)!));
  const r1 = (n: number) => Math.round(n * 10) / 10;
  return {
    root,
    parts,
    size,
    upright,
    stats: { parts: sum.parts, triangles: Math.round(triangles), unit, size: [r1(size.x), r1(size.y), r1(size.z)] as [number, number, number], bySys: sum.bySys, assets: sum.assets },
    groups,
  } satisfies LoadedModel;
}

// ---------- groups (for AI labelling) ----------

const trisOf = (m: THREE.Mesh) => {
  const g = m.geometry;
  const n = g.index ? g.index.count / 3 : (g.attributes.position?.count ?? 0) / 3;
  return (m as THREE.InstancedMesh).isInstancedMesh ? n * (m as THREE.InstancedMesh).count : n;
};

/**
 * Split the model into groups worth labelling: start from the file's top level and open up any
 * group that holds more than `share` of all triangles (a whole floor, the whole building …),
 * as long as the list stays under `max`. Every mesh gets the id of its group.
 */
function groupParts(obj: THREE.Object3D, root: THREE.Object3D, total: number, share = 0.08, max = 360): PartGroup[] {
  const tris = new Map<THREE.Object3D, number>();
  const count = (o: THREE.Object3D): number => {
    let n = (o as THREE.Mesh).isMesh ? trisOf(o as THREE.Mesh) : 0;
    for (const c of o.children) n += count(c);
    tris.set(o, n);
    return n;
  };
  count(obj);
  const ids = new Map<THREE.Object3D, string>([[obj, "r"]]);
  const kids = (o: THREE.Object3D) =>
    o.children
      .map((c, i) => {
        ids.set(c, `${ids.get(o)}.${i}`);
        return c;
      })
      .filter((c) => (tris.get(c) ?? 0) > 0);
  let groups = (obj as THREE.Mesh).isMesh ? [obj] : kids(obj);
  for (;;) {
    const big = groups
      .filter((g) => !(g as THREE.Mesh).isMesh && (tris.get(g) ?? 0) > share * total && kids(g).length > 1)
      .sort((a, b) => (tris.get(b) ?? 0) - (tris.get(a) ?? 0))[0];
    if (!big) break;
    const open = kids(big);
    if (groups.length - 1 + open.length > max) break;
    groups = groups.flatMap((g) => (g === big ? open : [g]));
  }
  if (!groups.length) groups = [obj];

  root.updateMatrixWorld(true);
  const set = new Set(groups);
  const out: PartGroup[] = [];
  for (const g of groups) {
    const id = ids.get(g)!;
    const box = new THREE.Box3().setFromObject(g);
    const sz = box.getSize(new THREE.Vector3());
    const names = new Set<string>();
    for (let p: THREE.Object3D | null = g; p && p !== root; p = p.parent) if (p.name && !isGenericName(p.name)) names.add(p.name);
    let meshes = 0;
    let color: string | undefined;
    g.traverse((o) => {
      if (o !== g && o.name && !isGenericName(o.name) && names.size < 6) names.add(o.name);
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      meshes++;
      // the mesh belongs to the nearest group above it
      let p: THREE.Object3D | null = m;
      while (p && !set.has(p)) p = p.parent;
      if (p === g) (m.userData.part as PartData).gid = id;
      const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial | undefined;
      color ??= mat?.color ? `#${mat.color.getHexString()}` : undefined;
    });
    const r = (n: number) => Math.round(n * 100) / 100;
    out.push({ id, names: [...names], size: [r(sz.x), r(sz.z), r(sz.y)], base: r(box.min.y), top: r(box.max.y), tris: Math.round(tris.get(g) ?? 0), meshes, color });
  }
  return out;
}

export type Labels = { known: ReadonlySet<string>; kinds?: Record<string, PartKind> };

/**
 * Apply the company's asset registry and the AI labels to the parts (mutates part data) and
 * return the counts for the side panel. Cheap enough to run whenever either changes.
 */
export function relabel(model: LoadedModel, { known, kinds }: Labels) {
  const unregistered = new Set<string>();
  const byKind: Partial<Record<PartKind, number>> = {};
  for (const m of model.parts) {
    const p = partOf(m)!;
    p.asset = registeredCode(p.code, known);
    if (p.code && !p.asset) unregistered.add(p.code);
    p.kind = p.gid ? kinds?.[p.gid] : undefined;
    // a name that clearly says the system (แอร์, ไฟฟ้า …) beats the AI's guess from size
    p.sys = p.kind && (p.sys0 ?? "arch") === "arch" ? KIND_SYS[p.kind] : (p.sys0 ?? p.sys);
    if (p.kind) byKind[p.kind] = (byKind[p.kind] ?? 0) + 1;
  }
  const sum = summarize(model.parts.map((p) => partOf(p)!));
  return { stats: { ...model.stats, bySys: sum.bySys, assets: sum.assets }, byKind, unregistered: [...unregistered].sort() };
}

export async function loadModel(url: string, fmt: ModelFormat, fix: ViewFix = {}, onProgress?: Progress): Promise<LoadedModel> {
  onProgress?.("download", 0);
  const buf = await download(url, onProgress);
  onProgress?.("parse");
  let obj: THREE.Object3D;
  try {
    obj = await parse(buf, fmt);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`อ่านไฟล์ ${fmt.toUpperCase()} ไม่ได้: ${msg.slice(0, 160)}`);
  }
  onProgress?.("prepare");
  return prepare(obj, fmt, fix);
}

/** Free GPU memory of a model that is no longer shown. */
export function disposeModel(m: LoadedModel) {
  const mats = new Set<THREE.Material>();
  for (const p of m.parts) {
    p.geometry.dispose();
    const base = p.userData.baseMaterial as THREE.Material | THREE.Material[];
    for (const x of Array.isArray(base) ? base : [base]) if (x) mats.add(x);
  }
  for (const x of mats) {
    for (const v of Object.values(x)) if (v instanceof THREE.Texture) v.dispose();
    x.dispose();
  }
}
