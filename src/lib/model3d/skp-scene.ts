// Pick the 3D building out of a parsed SketchUp scene. Pure (no OpenSKP import), so node --test can load it.
//
// Architectural .skp files often carry imported 2D CAD plans (lines only, no faces) and stray copies
// placed far away. Viewers frame the whole bounds, so the building ends up a dot. We keep top-level
// groups that have triangles and sit near the main cluster.

export type SceneNodeLike = {
  name: string;
  definitionName: string;
  layer: string;
  positionMm: [number, number, number];
  meshResourceId?: string;
  children: SceneNodeLike[];
};

export type PickResult<N extends SceneNodeLike> = {
  keep: N[];
  triangles: number;
  dropped2d: number; // top-level groups with no faces (CAD linework, text)
  droppedFar: number; // groups with faces but far from the building
};

/** Triangles under a node (its own mesh + all children). */
export function subtreeTriangles(n: SceneNodeLike, meshTris: Map<string, number>): number {
  let t = n.meshResourceId ? (meshTris.get(n.meshResourceId) ?? 0) : 0;
  for (const c of n.children) t += subtreeTriangles(c, meshTris);
  return t;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

/**
 * Keep the groups that form the building: triangles > 0 and within `radiusM` of the median
 * position of all such groups (weighted equally — large stray copies stay out).
 */
export function pickBuilding<N extends SceneNodeLike>(top: N[], meshTris: Map<string, number>, radiusM = 60): PickResult<N> {
  const withTris = top.map((n) => ({ n, t: subtreeTriangles(n, meshTris) })).filter((x) => x.t > 0);
  const mx = median(withTris.map((x) => x.n.positionMm[0]));
  const my = median(withTris.map((x) => x.n.positionMm[1]));
  const near = withTris.filter((x) => Math.hypot(x.n.positionMm[0] - mx, x.n.positionMm[1] - my) <= radiusM * 1000);
  return {
    keep: near.map((x) => x.n),
    triangles: near.reduce((a, x) => a + x.t, 0),
    dropped2d: top.length - withTris.length,
    droppedFar: withTris.length - near.length,
  };
}

/** SketchUp version written in the file header, e.g. "19.2.222" (UTF-16 "{19.2.222}"). */
export function skpVersion(bytes: Uint8Array): string | null {
  const head = new TextDecoder("utf-16le").decode(bytes.subarray(0, Math.min(bytes.length, 96)));
  return head.match(/\{(\d+\.\d+\.\d+)\}/)?.[1] ?? null;
}

export function isSkp(bytes: Uint8Array): boolean {
  // legacy files start with FF FE FF 0E "SketchUp Model" (UTF-16); 2021+ files also begin with that banner
  const head = new TextDecoder("utf-16le").decode(bytes.subarray(4, Math.min(bytes.length, 40)));
  return head.startsWith("SketchUp Model");
}
