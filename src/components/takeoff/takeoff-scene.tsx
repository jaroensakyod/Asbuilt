"use client";

// 3D for the takeoff: the building as a light ghost, the active category's lines in its colour,
// the selected line in amber. Click a highlighted part to select its line.

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { Box, Cat, TakeoffItem } from "@/lib/takeoff/types";

export const CAT_COLOR: Record<Cat, string> = {
  masonry: "#b5653a",
  plaster: "#7d8e9c",
  paint: "#4f86c6",
  ties: "#2f4f45",
  bead: "#2e8b57",
  floorTile: "#a08a5e",
  wallTile: "#3c9aa6",
};
const SELECT = "#f2a23a";

export type View = "iso" | "top" | "front" | "back";

export type TakeoffSceneProps = {
  ghost: Box[]; // walls of the visible floors
  floors: Box[]; // slabs of the visible floors
  items: TakeoffItem[]; // highlighted lines (active category, filtered)
  cat: Cat;
  selected: string | null;
  onSelect: (code: string | null) => void;
  center: [number, number, number];
  span: number;
  view: View;
  viewKey: number;
};

const unit = new THREE.BoxGeometry(1, 1, 1);
const ghostMat = new THREE.MeshStandardMaterial({ color: "#e8e5df", transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide });
const edgeMat = new THREE.LineBasicMaterial({ color: "#b9b4aa", transparent: true, opacity: 0.6 });
const slabMat = new THREE.MeshStandardMaterial({ color: "#f3f1ec", roughness: 0.95 });
const selMat = new THREE.MeshStandardMaterial({ color: SELECT, emissive: SELECT, emissiveIntensity: 0.35 });
const catMats = new Map<Cat, THREE.MeshStandardMaterial>();
const catMat = (c: Cat) => {
  let m = catMats.get(c);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: CAT_COLOR[c], roughness: 0.7, transparent: c === "plaster" || c === "paint", opacity: c === "plaster" || c === "paint" ? 0.75 : 1 });
    catMats.set(c, m);
  }
  return m;
};

function BoxMesh({ b, mat, code, onPick }: { b: Box; mat: THREE.Material; code?: string; onPick?: (e: ThreeEvent<MouseEvent>, code: string) => void }) {
  return <mesh geometry={unit} material={mat} position={b.pos} scale={b.size} onClick={code && onPick ? (e) => onPick(e, code) : undefined} />;
}

function Ghost({ boxes }: { boxes: Box[] }) {
  const edges = useMemo(() => new THREE.EdgesGeometry(unit), []);
  return (
    <group>
      {boxes.map((b, i) => (
        <group key={i} position={b.pos} scale={b.size}>
          <mesh geometry={unit} material={ghostMat} raycast={() => null} />
          <lineSegments geometry={edges} material={edgeMat} raycast={() => null} />
        </group>
      ))}
    </group>
  );
}

function place(camera: THREE.PerspectiveCamera, controls: OrbitControlsImpl | null, view: View, c: [number, number, number], span: number) {
  const d = span * 1.35;
  const [cx, cy, cz] = c;
  const pos: Record<View, [number, number, number]> = {
    iso: [cx + d * 0.75, cy + d * 0.8, cz + d * 0.95],
    top: [cx, cy + d * 1.6, cz + 0.001],
    front: [cx, cy + span * 0.15, cz - d * 1.25],
    back: [cx, cy + span * 0.15, cz + d * 1.25],
  };
  camera.position.set(...pos[view]);
  camera.near = 0.05;
  camera.far = span * 40;
  camera.updateProjectionMatrix();
  if (controls) {
    controls.target.set(cx, cy, cz);
    controls.update();
  } else camera.lookAt(cx, cy, cz);
}

function Rig({ view, viewKey, center, span }: { view: View; viewKey: number; center: [number, number, number]; span: number }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  useEffect(() => place(camera, controls, view, center, span), [camera, controls, view, viewKey, center, span]);
  return null;
}

export function TakeoffScene(p: TakeoffSceneProps) {
  const pick = (e: ThreeEvent<MouseEvent>, code: string) => {
    if (e.delta > 4) return;
    e.stopPropagation();
    p.onSelect(code === p.selected ? null : code);
  };
  const sel = p.items.find((x) => x.code === p.selected);
  return (
    <Canvas dpr={[1, 2]} camera={{ fov: 38, position: [20, 16, 20] }} gl={{ antialias: true, preserveDrawingBuffer: true }} onPointerMissed={() => p.onSelect(null)}>
      <color attach="background" args={["#eef0ec"]} />
      <hemisphereLight args={["#ffffff", "#a9a395", 1.15]} />
      <directionalLight position={[p.span, p.span * 1.5, p.span * 0.7]} intensity={1.3} />
      <mesh rotation-x={-Math.PI / 2} position={[p.center[0], -0.21, p.center[2]]} raycast={() => null}>
        <planeGeometry args={[p.span * 3, p.span * 3]} />
        <meshStandardMaterial color="#6f7d55" roughness={1} />
      </mesh>
      {p.floors.map((b, i) => (
        <BoxMesh key={`f${i}`} b={b} mat={slabMat} />
      ))}
      <Ghost boxes={p.ghost} />
      {p.items.map((it) =>
        it.code === p.selected ? null : it.shapes.map((b, i) => <BoxMesh key={`${it.code}-${i}`} b={b} mat={catMat(p.cat)} code={it.code} onPick={pick} />),
      )}
      {sel?.shapes.map((b, i) => <BoxMesh key={`sel-${i}`} b={{ pos: b.pos, size: [b.size[0] + 0.02, b.size[1] + 0.02, b.size[2] + 0.02] }} mat={selMat} code={sel.code} onPick={pick} />)}
      <OrbitControls makeDefault enableDamping dampingFactor={0.12} maxPolarAngle={Math.PI * 0.5} />
      <Rig view={p.view} viewKey={p.viewKey} center={p.center} span={p.span} />
    </Canvas>
  );
}
