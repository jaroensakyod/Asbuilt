"use client";

// three.js scene for an uploaded model: orbit, system visibility, X-ray, section cut by height,
// click-to-select, and red marking of parts whose asset has an open repair.

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { SYSTEMS } from "@/lib/viewer-data";
import type { SysKey } from "@/lib/model3d/classify";
import { partOf, type LoadedModel } from "./load";

export type SceneProps = {
  model: LoadedModel;
  visible: Record<SysKey, boolean>;
  xray: boolean;
  /** section height in metres (parts above are cut away), null = no cut */
  cut: number | null;
  selected: THREE.Mesh | null;
  onSelect: (m: THREE.Mesh | null) => void;
  /** asset codes with an open repair */
  flagged: Set<string>;
  /** bump to re-frame the camera */
  fitKey: number;
  onCanvas?: (c: HTMLCanvasElement | null) => void;
};

const HILITE = new THREE.MeshStandardMaterial({ color: "#f2a23a", emissive: "#f2a23a", emissiveIntensity: 0.45, side: THREE.DoubleSide });
const FLAG = new THREE.MeshStandardMaterial({ color: "#d9483b", emissive: "#d9483b", emissiveIntensity: 0.35, side: THREE.DoubleSide });
const GHOST = Object.fromEntries(
  SYSTEMS.map((s) => [s.key, new THREE.MeshBasicMaterial({ color: s.color, transparent: true, opacity: s.key === "arch" || s.key === "ext" ? 0.06 : 0.35, depthWrite: false, side: THREE.DoubleSide })]),
) as Record<SysKey, THREE.MeshBasicMaterial>;

const shown = (o: THREE.Object3D | null) => {
  for (let p = o; p; p = p.parent) if (!p.visible) return false;
  return true;
};

// three.js objects are mutated outside components (plain functions), as the scene graph is external state.

function frameCamera(camera: THREE.PerspectiveCamera, controls: OrbitControlsImpl | null, s: THREE.Vector3) {
  const r = Math.max(s.x, s.y, s.z, 1);
  const d = (r / (2 * Math.tan((camera.fov * Math.PI) / 360))) * 1.15;
  camera.near = Math.max(0.01, r / 1000);
  camera.far = r * 50;
  camera.position.set(d * 0.75, s.y * 0.5 + d * 0.55, d * 0.85);
  camera.updateProjectionMatrix();
  if (controls) {
    controls.target.set(0, s.y * 0.4, 0);
    controls.maxDistance = r * 8;
    controls.update();
  } else camera.lookAt(0, s.y * 0.4, 0);
}

function setClip(gl: THREE.WebGLRenderer, cut: number | null) {
  gl.clippingPlanes = cut == null ? [] : [new THREE.Plane(new THREE.Vector3(0, -1, 0), cut)];
}

function applyLook(model: LoadedModel, visible: Record<SysKey, boolean>, xray: boolean, selected: THREE.Mesh | null, flagged: Set<string>) {
  for (const m of model.parts) {
    const part = partOf(m)!;
    m.visible = visible[part.sys];
    m.material = m === selected ? HILITE : part.asset && flagged.has(part.asset) ? FLAG : xray ? GHOST[part.sys] : (m.userData.baseMaterial as THREE.Material);
  }
}

function Fit({ model, fitKey }: { model: LoadedModel; fitKey: number }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  useEffect(() => frameCamera(camera, controls, model.size), [model, fitKey, camera, controls]);
  return null;
}

function Clip({ cut }: { cut: number | null }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    setClip(gl, cut);
    return () => setClip(gl, null);
  }, [gl, cut]);
  return null;
}

function CanvasHandle({ onCanvas }: { onCanvas?: (c: HTMLCanvasElement | null) => void }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    onCanvas?.(gl.domElement);
    return () => onCanvas?.(null);
  }, [gl, onCanvas]);
  return null;
}

export function ModelScene(p: SceneProps) {
  const { model, visible, xray, selected, flagged } = p;

  // visibility + materials
  useEffect(() => applyLook(model, visible, xray, selected, flagged), [model, visible, xray, selected, flagged]);

  const span = Math.max(model.size.x, model.size.z, 4);
  const grid = useMemo(() => Math.ceil((span * 1.6) / 2) * 2, [span]);
  const shadowCam = span * 0.9;

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 4) return; // it was a drag (orbit), not a click
    e.stopPropagation();
    const cut = p.cut;
    const hits = e.intersections.filter((i) => (i.object as THREE.Mesh).isMesh && shown(i.object) && (cut == null || i.point.y <= cut + 1e-3));
    // in X-Ray the walls are see-through, so a click goes to the equipment behind them
    const ghost = (o: THREE.Object3D) => ["arch", "ext"].includes(partOf(o)?.sys ?? "");
    const hit = (xray && hits.find((i) => !ghost(i.object))) || hits[0];
    p.onSelect(hit ? (hit.object as THREE.Mesh) : null);
  };

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ fov: 40, position: [20, 14, 20] }}
      gl={{ antialias: true, preserveDrawingBuffer: true, localClippingEnabled: true }}
      onPointerMissed={() => p.onSelect(null)}
    >
      <hemisphereLight args={["#ffffff", "#b9b2a6", 1.1]} />
      <directionalLight
        position={[span * 0.8, span * 1.4, span * 0.6]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-shadowCam}
        shadow-camera-right={shadowCam}
        shadow-camera-top={shadowCam}
        shadow-camera-bottom={-shadowCam}
        shadow-camera-far={span * 6}
        shadow-bias={-0.0005}
      />
      <primitive object={model.root} onClick={onClick} />
      <mesh rotation-x={-Math.PI / 2} position-y={-0.01} receiveShadow>
        <planeGeometry args={[grid, grid]} />
        <shadowMaterial opacity={0.18} />
      </mesh>
      <gridHelper args={[grid, grid, "#9a958c", "#cfcac0"]} position-y={-0.005} />
      <OrbitControls makeDefault enableDamping dampingFactor={0.12} maxPolarAngle={Math.PI * 0.495} />
      <Fit model={model} fitKey={p.fitKey} />
      <Clip cut={p.cut} />
      <CanvasHandle onCanvas={p.onCanvas} />
    </Canvas>
  );
}
