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
  /** part kinds switched off (AI labels) */
  kindOn?: Partial<Record<string, boolean>>;
  /** changes whenever part labels were re-applied */
  labelKey?: unknown;
  /** receives a function that renders fixed views to images */
  onShooter?: (s: Shooter | null) => void;
};

export type ShotView = "iso" | "front" | "side" | "top";
/** Render the given views off-screen at w×h and return them as JPEG data URLs. */
export type Shooter = (views: ShotView[], w: number, h: number) => string[];

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

function applyLook(model: LoadedModel, visible: Record<SysKey, boolean>, xray: boolean, selected: THREE.Mesh | null, flagged: Set<string>, kindOn: Partial<Record<string, boolean>> = {}) {
  for (const m of model.parts) {
    const part = partOf(m)!;
    m.visible = visible[part.sys] && (!part.kind || kindOn[part.kind] !== false);
    m.material = m === selected ? HILITE : part.asset && flagged.has(part.asset) ? FLAG : xray ? GHOST[part.sys] : (m.userData.baseMaterial as THREE.Material);
  }
}

/**
 * Render one fixed view. Elevations and plan use an orthographic camera (true proportions, like a
 * drawing); the 3D view uses perspective from the front-right corner. Canvas size, camera and
 * pixel ratio are put back afterwards, so the live view is untouched.
 */
function shoot(gl: THREE.WebGLRenderer, scene: THREE.Scene, persp: THREE.PerspectiveCamera, s: THREE.Vector3, view: ShotView, w: number, h: number) {
  const aspect = w / h;
  const c = new THREE.Vector3(0, s.y / 2, 0);
  const pad = 1.08;
  let cam: THREE.Camera;
  if (view === "iso") {
    const p = persp.clone();
    p.aspect = aspect;
    const dir = new THREE.Vector3(0.62, 0.42, 0.66).normalize();
    const corners = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => new THREE.Vector3(((i & 1) - 0.5) * s.x, (i & 2 ? 1 : 0) * s.y, (((i >> 2) & 1) - 0.5) * s.z));
    // start from the bounding sphere, then pull in until the box corners just fill the frame
    let d = s.length() / 2 / Math.sin((p.fov * Math.PI) / 360);
    for (let k = 0; k < 4; k++) {
      p.near = d / 100;
      p.far = d * 10;
      p.position.copy(c).addScaledVector(dir, d);
      p.up.set(0, 1, 0);
      p.lookAt(c);
      p.updateProjectionMatrix();
      p.updateMatrixWorld();
      const m = Math.max(...corners.map((v) => v.clone().project(p)).map((v) => Math.max(Math.abs(v.x), Math.abs(v.y))));
      d *= m * pad;
    }
    p.position.copy(c).addScaledVector(dir, d);
    p.updateMatrixWorld();
    cam = p;
  } else {
    // half extents seen on screen (a across, b up) and the depth behind
    const [a, b, depth] = view === "front" ? [s.x / 2, s.y / 2, s.z] : view === "side" ? [s.z / 2, s.y / 2, s.x] : [s.x / 2, s.z / 2, s.y];
    const half = Math.max(a, b * aspect) * pad;
    const o = new THREE.OrthographicCamera(-half, half, half / aspect, -half / aspect, 0.01, depth * 4 + 10);
    const far = depth * 2 + 5;
    if (view === "front") o.position.set(0, c.y, far);
    else if (view === "side") o.position.set(far, c.y, 0);
    else {
      o.position.set(0, s.y + far, 0);
      o.up.set(0, 0, -1);
    }
    o.lookAt(view === "top" ? new THREE.Vector3(0, 0, 0) : c);
    o.updateProjectionMatrix();
    cam = o;
  }
  const size = gl.getSize(new THREE.Vector2());
  const ratio = gl.getPixelRatio();
  const clear = gl.getClearColor(new THREE.Color());
  const alpha = gl.getClearAlpha();
  // a clean picture: no grid, and a paper-white background (the live canvas is transparent → black in JPEG)
  const grids: THREE.Object3D[] = [];
  scene.traverse((o) => {
    if (o.visible && o.type === "GridHelper") grids.push(o);
  });
  for (const g of grids) g.visible = false;
  gl.setClearColor("#ffffff", 1);
  gl.setPixelRatio(1);
  gl.setSize(w, h, false);
  gl.render(scene, cam);
  const url = gl.domElement.toDataURL("image/jpeg", 0.9);
  gl.setPixelRatio(ratio);
  gl.setSize(size.x, size.y, false);
  gl.setClearColor(clear, alpha);
  for (const g of grids) g.visible = true;
  return url;
}

function ShooterHandle({ model, onShooter }: { model: LoadedModel; onShooter?: (s: Shooter | null) => void }) {
  const gl = useThree((st) => st.gl);
  const scene = useThree((st) => st.scene);
  const camera = useThree((st) => st.camera) as THREE.PerspectiveCamera;
  const invalidate = useThree((st) => st.invalidate);
  useEffect(() => {
    if (!onShooter) return;
    onShooter((views, w, h) => {
      const out = views.map((v) => shoot(gl, scene, camera, model.size, v, w, h));
      invalidate();
      return out;
    });
    return () => onShooter(null);
  }, [gl, scene, camera, model, onShooter, invalidate]);
  return null;
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
  const { model, visible, xray, selected, flagged, kindOn, labelKey } = p;

  // visibility + materials (labelKey: part systems/kinds were re-labelled)
  useEffect(() => applyLook(model, visible, xray, selected, flagged, kindOn), [model, visible, xray, selected, flagged, kindOn, labelKey]);

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
      <ShooterHandle model={model} onShooter={p.onShooter} />
    </Canvas>
  );
}
