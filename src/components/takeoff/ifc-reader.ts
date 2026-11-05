"use client";

// Reads an IFC file in the browser (web-ifc WASM from /wasm/) and returns one bounding box per
// wall / door / window / column / space, in a frame rotated so the main wall direction runs along x.

import type { IfcBox } from "@/lib/takeoff/ifc";

const cache = new Map<string, Promise<IfcBox[]>>();

/** Principal direction of points in plan (radians), from their 2×2 covariance. */
function planAngle(xs: number[], zs: number[]) {
  const n = xs.length;
  if (n < 2) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const mz = zs.reduce((a, b) => a + b, 0) / n;
  let sxx = 0;
  let szz = 0;
  let sxz = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dz = zs[i] - mz;
    sxx += dx * dx;
    szz += dz * dz;
    sxz += dx * dz;
  }
  return 0.5 * Math.atan2(2 * sxz, sxx - szz);
}

const mod90 = (a: number) => {
  const q = Math.PI / 2;
  return ((a % q) + q) % q;
};
const angDiff = (a: number, b: number) => {
  const d = Math.abs(mod90(a) - mod90(b));
  return Math.min(d, Math.PI / 2 - d);
};

async function read(url: string): Promise<IfcBox[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ดาวน์โหลดไฟล์ไม่สำเร็จ (${res.status})`);
  const data = new Uint8Array(await res.arrayBuffer());
  const W = await import("web-ifc");
  const api = new W.IfcAPI();
  api.SetWasmPath("/wasm/", true);
  await api.Init(undefined, true);
  const model = api.OpenModel(data, { COORDINATE_TO_ORIGIN: true });
  try {
    const kinds: [number, string][] = [
      [W.IFCWALL, "IFCWALL"],
      [W.IFCWALLSTANDARDCASE, "IFCWALLSTANDARDCASE"],
      [W.IFCWALLELEMENTEDCASE, "IFCWALLELEMENTEDCASE"],
      [W.IFCDOOR, "IFCDOOR"],
      [W.IFCWINDOW, "IFCWINDOW"],
      [W.IFCCOLUMN, "IFCCOLUMN"],
      [W.IFCSPACE, "IFCSPACE"],
    ];
    type Raw = { id: number; type: string; name: string; pts: Float32Array };
    const raws: Raw[] = [];
    const seen = new Set<number>();
    for (const [code, type] of kinds) {
      const ids = api.GetLineIDsWithType(model, code, false);
      for (let i = 0; i < ids.size(); i++) {
        const id = ids.get(i);
        if (seen.has(id)) continue;
        seen.add(id);
        let name = "";
        try {
          const line = api.GetLine(model, id);
          name = String(line?.LongName?.value ?? line?.Name?.value ?? "");
        } catch {
          // unreadable attributes: keep the geometry
        }
        const mesh = api.GetFlatMesh(model, id);
        const pts: number[] = [];
        const m = new Float64Array(16);
        for (let g = 0; g < mesh.geometries.size(); g++) {
          const pg = mesh.geometries.get(g);
          const geom = api.GetGeometry(model, pg.geometryExpressID);
          const v = api.GetVertexArray(geom.GetVertexData(), geom.GetVertexDataSize());
          geom.delete();
          m.set(pg.flatTransformation);
          for (let k = 0; k < v.length; k += 6) {
            const x = v[k];
            const y = v[k + 1];
            const z = v[k + 2];
            pts.push(m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]);
          }
        }
        if (pts.length) raws.push({ id, type, name, pts: new Float32Array(pts) });
      }
    }

    // main grid direction: the most common wall angle (mod 90°), weighted by wall length
    const walls = raws.filter((r) => r.type.startsWith("IFCWALL"));
    const angles = walls.map((r) => {
      const xs: number[] = [];
      const zs: number[] = [];
      for (let k = 0; k < r.pts.length; k += 3) {
        xs.push(r.pts[k]);
        zs.push(r.pts[k + 2]);
      }
      const len = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
      return { id: r.id, a: planAngle(xs, zs), len };
    });
    const bins = new Map<number, number>();
    for (const x of angles) {
      const b = Math.round((mod90(x.a) * 180) / Math.PI) % 90;
      bins.set(b, (bins.get(b) ?? 0) + x.len);
    }
    const main = ((([...bins.entries()].sort((p, q) => q[1] - p[1])[0]?.[0] ?? 0) as number) * Math.PI) / 180;
    const cos = Math.cos(-main);
    const sin = Math.sin(-main);
    const angleOf = new Map(angles.map((x) => [x.id, x.a]));

    return raws.map((r) => {
      const min: [number, number, number] = [Infinity, Infinity, Infinity];
      const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
      for (let k = 0; k < r.pts.length; k += 3) {
        const x = r.pts[k] * cos - r.pts[k + 2] * sin;
        const z = r.pts[k] * sin + r.pts[k + 2] * cos;
        const y = r.pts[k + 1];
        if (x < min[0]) min[0] = x;
        if (y < min[1]) min[1] = y;
        if (z < min[2]) min[2] = z;
        if (x > max[0]) max[0] = x;
        if (y > max[1]) max[1] = y;
        if (z > max[2]) max[2] = z;
      }
      const a = angleOf.get(r.id);
      return { id: r.id, type: r.type, name: r.name, min, max, aligned: a == null ? undefined : angDiff(a, main) < (2 * Math.PI) / 180 };
    });
  } finally {
    api.CloseModel(model);
  }
}

/** Boxes of an IFC file (cached per file id for this page session). */
export function readIfcBoxes(fileId: string, url: string) {
  let p = cache.get(fileId);
  if (!p) {
    p = read(url);
    p.catch(() => cache.delete(fileId));
    cache.set(fileId, p);
  }
  return p;
}
