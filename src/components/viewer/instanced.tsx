"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import type { Vec3 } from "@/lib/house";

export type Inst = { pos: Vec3; size: Vec3; color: string; rot?: Vec3 };

const dummy = new THREE.Object3D();
const tmpColor = new THREE.Color();

export type Shape = "box" | "cyl" | "cone4" | "ico";

/** Unit geometry for one instanced group (R3F disposes it with the mesh) */
export function unitGeometry(shape: Shape): THREE.BufferGeometry {
  if (shape === "box") return new THREE.BoxGeometry(1, 1, 1);
  if (shape === "cyl") return new THREE.CylinderGeometry(0.5, 0.5, 1, 20);
  if (shape === "ico") return new THREE.IcosahedronGeometry(0.5, 1);
  const g = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1);
  g.rotateY(Math.PI / 4);
  return g;
}

type MatKind = "standard" | "basic";

export type InstancesProps<T extends Inst> = {
  items: T[];
  /** capacity; the mesh is recreated only when this changes */
  cap?: number;
  shape?: Shape;
  material?: MatKind;
  opacity?: number;
  roughness?: number;
  metalness?: number;
  flat?: boolean;
  shadows?: boolean;
  offset?: (it: T) => number;
  onPick?: (it: T, e: ThreeEvent<MouseEvent>) => void;
  renderOrder?: number;
};

function bucketCap(n: number) {
  return Math.max(16, 2 ** Math.ceil(Math.log2(n + 1)));
}

export function Instances<T extends Inst>(p: InstancesProps<T>) {
  const cap = p.cap ?? bucketCap(p.items.length);
  return <InstancesInner key={cap} {...p} cap={cap} />;
}

function InstancesInner<T extends Inst>({ items, cap, shape = "box", material = "standard", opacity = 1, roughness = 0.85, metalness = 0, flat, shadows = true, offset, onPick, renderOrder }: InstancesProps<T> & { cap: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geom = useMemo(() => unitGeometry(shape), [shape]);
  const transparent = opacity < 1;

  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const n = Math.min(items.length, cap);
    for (let i = 0; i < n; i++) {
      const it = items[i];
      dummy.position.set(it.pos[0], it.pos[1] + (offset ? offset(it) : 0), it.pos[2]);
      if (it.rot) dummy.rotation.set(it.rot[0], it.rot[1], it.rot[2]);
      else dummy.rotation.set(0, 0, 0);
      dummy.scale.set(Math.max(it.size[0], 1e-4), Math.max(it.size[1], 1e-4), Math.max(it.size[2], 1e-4));
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      m.setColorAt(i, tmpColor.set(it.color));
    }
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [items, cap, offset]);

  return (
    <instancedMesh
      ref={ref}
      args={[geom, undefined, cap]}
      castShadow={shadows && !transparent}
      receiveShadow={shadows && !transparent}
      frustumCulled={false}
      renderOrder={renderOrder}
      onClick={
        onPick
          ? (e) => {
              if (e.instanceId === undefined || !items[e.instanceId]) return;
              e.stopPropagation();
              onPick(items[e.instanceId], e);
            }
          : undefined
      }
      onPointerOver={
        onPick
          ? (e) => {
              e.stopPropagation();
              document.body.style.cursor = "pointer";
            }
          : undefined
      }
      onPointerOut={onPick ? () => (document.body.style.cursor = "") : undefined}
    >
      {material === "basic" ? (
        <meshBasicMaterial transparent={transparent} opacity={opacity} depthWrite={!transparent} toneMapped={false} />
      ) : (
        <meshStandardMaterial transparent={transparent} opacity={opacity} depthWrite={!transparent} roughness={roughness} metalness={metalness} flatShading={flat} />
      )}
    </instancedMesh>
  );
}

// ---------- merged box edges ----------

const CORNERS: Vec3[] = [
  [-0.5, -0.5, -0.5],
  [0.5, -0.5, -0.5],
  [0.5, 0.5, -0.5],
  [-0.5, 0.5, -0.5],
  [-0.5, -0.5, 0.5],
  [0.5, -0.5, 0.5],
  [0.5, 0.5, 0.5],
  [-0.5, 0.5, 0.5],
];
const EDGES = [0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7];
const mtx = new THREE.Matrix4();
const v3 = new THREE.Vector3();
const quat = new THREE.Quaternion();
const eul = new THREE.Euler();
const scl = new THREE.Vector3();
const pos = new THREE.Vector3();

/** All box outlines of a group drawn as one line-segments object */
export function BoxEdges<T extends Inst>({ items, color, opacity = 1, offset }: { items: T[]; color: string; opacity?: number; offset?: (it: T) => number }) {
  const geo = useMemo(() => {
    const arr = new Float32Array(items.length * EDGES.length * 3);
    let k = 0;
    for (const it of items) {
      pos.set(it.pos[0], it.pos[1] + (offset ? offset(it) : 0), it.pos[2]);
      quat.setFromEuler(it.rot ? eul.set(it.rot[0], it.rot[1], it.rot[2]) : eul.set(0, 0, 0));
      scl.set(it.size[0], it.size[1], it.size[2]);
      mtx.compose(pos, quat, scl);
      for (const idx of EDGES) {
        const c = CORNERS[idx];
        v3.set(c[0], c[1], c[2]).applyMatrix4(mtx);
        arr[k++] = v3.x;
        arr[k++] = v3.y;
        arr[k++] = v3.z;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    return g;
  }, [items, offset]);
  useEffect(() => () => geo.dispose(), [geo]);
  if (!items.length) return null;
  return (
    <lineSegments geometry={geo} frustumCulled={false} raycast={() => null}>
      <lineBasicMaterial color={color} transparent={opacity < 1} opacity={opacity} depthWrite={false} />
    </lineSegments>
  );
}

// ---------- merged polylines (pipes, wires) ----------

export type Poly = { points: Vec3[]; color: string; floor?: number };

export function Polylines({ lines, opacity = 1, offset }: { lines: Poly[]; opacity?: number; offset?: (l: Poly) => number }) {
  const geo = useMemo(() => {
    let n = 0;
    for (const l of lines) n += Math.max(0, l.points.length - 1) * 2;
    const p = new Float32Array(n * 3);
    const c = new Float32Array(n * 3);
    let k = 0;
    for (const l of lines) {
      tmpColor.set(l.color);
      const dy = offset ? offset(l) : 0;
      for (let i = 0; i < l.points.length - 1; i++)
        for (const q of [l.points[i], l.points[i + 1]]) {
          p[k] = q[0];
          p[k + 1] = q[1] + dy;
          p[k + 2] = q[2];
          c[k] = tmpColor.r;
          c[k + 1] = tmpColor.g;
          c[k + 2] = tmpColor.b;
          k += 3;
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    g.setAttribute("color", new THREE.BufferAttribute(c, 3));
    return g;
  }, [lines, offset]);
  useEffect(() => () => geo.dispose(), [geo]);
  if (!lines.length) return null;
  return (
    <lineSegments geometry={geo} frustumCulled={false} raycast={() => null}>
      <lineBasicMaterial vertexColors transparent={opacity < 1} opacity={opacity} depthWrite={false} toneMapped={false} />
    </lineSegments>
  );
}
