"use client";

import { useEffect, useId, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Line } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { stateAt, type BuildingModel, type Element, type Vec3 } from "@/lib/house";
import { ALL_SYSTEMS, assetPlans, assetSys, cutoffAt, elementSys, heatColor, runSys, type HeatValue, type SysKey } from "@/lib/viewer-data";
import { buildingHeight, ceilings, furniture, type Item } from "@/lib/viewer-props";
import { BoxEdges, Instances, Polylines, type Poly } from "./instanced";
import { RoomLabels, type Label } from "./labels";
import { Construction, Site } from "./site";

export type Mode = "real" | "xray" | "compare" | "heat";
/** How the building is drawn in one canvas */
export type Look = "real" | "xray" | "heat" | "overlay" | "state" | "actual";
export type Selection = { type: "element"; id: string } | { type: "asset"; code: string } | { type: "room"; id: string } | null;
export type Layers = Record<"elec" | "water" | "drain" | "hvac", boolean>;
export type Display = { furniture: boolean; ceiling: boolean; site: boolean; labels: boolean };
export type CamPreset = "iso" | "front" | "back" | "left" | "right" | "top";
export type CamRequest = { seq: number; preset?: CamPreset; focus?: { target: Vec3; dist: number } };
export type Orbit = { damping: number; rotate: number };

/** Shared camera state so several canvases (split / slider compare) move together */
export class CamSync {
  pos = new THREE.Vector3();
  target = new THREE.Vector3();
  ver = 0;
  owner = "";
  write(owner: string, pos: THREE.Vector3, target: THREE.Vector3) {
    this.pos.copy(pos);
    this.target.copy(target);
    this.owner = owner;
    this.ver++;
    return this.ver;
  }
}

export type SceneProps = {
  model: BuildingModel;
  look: Look;
  t?: number;
  today?: number;
  lag?: number;
  selection?: Selection;
  onSelect?: (s: Selection) => void;
  circuit?: string | null;
  layers?: Layers;
  pins?: string[];
  compact?: boolean;
  floor?: number | null;
  explode?: boolean;
  systems?: Record<SysKey, boolean>;
  display?: Display;
  heat?: Map<string, HeatValue>;
  evening?: boolean;
  orbit?: Orbit;
  cam?: CamRequest;
  sync?: CamSync;
  onCanvas?: (c: HTMLCanvasElement | null) => void;
};

export const RUN_COLOR = { elec: "#d29a1c", water: "#3c9aa6", drain: "#9a7552", hvac: "#8a83c4" } as const;
const ACCENT = "#c2410c";
const MAT = { concrete: "#b8b0a3", wall: "#e6dfd4", wallExt: "#f2ede4", glass: "#8fa6ab", roof: "#4b4540", wood: "#8a6a4a", frame: "#3b3631" } as const;
const ALL_LAYERS: Layers = { elec: true, water: true, drain: true, hvac: true };
const DISPLAY: Display = { furniture: true, ceiling: false, site: true, labels: false };
const NO_PINS: string[] = [];

type ElItem = Item & { el: Element };
type AssetItem = Item & { code: string };
type RoomItem = Item & { id: string };

export function cameraPresets(m: BuildingModel) {
  const H = buildingHeight(m);
  const R = Math.max(m.W, m.D, H);
  const dist = R * 1.45 + 9;
  const c = new THREE.Vector3(m.W / 2, Math.min(H * 0.38, 6), m.D / 2);
  const y = H * 0.55 + dist * 0.28;
  const at = (x: number, yy: number, z: number) => new THREE.Vector3(x, yy, z);
  const iso = at(-0.5, 0.52, -0.69).normalize().multiplyScalar(dist * 1.05).add(c);
  return {
    center: c,
    dist,
    R,
    presets: {
      iso,
      front: at(c.x, y, c.z - dist),
      back: at(c.x, y, c.z + dist),
      left: at(c.x + dist, y, c.z),
      right: at(c.x - dist, y, c.z),
      top: at(c.x, dist * 1.25, c.z + 0.01),
    } satisfies Record<CamPreset, THREE.Vector3>,
  };
}

function CameraRig({ model, cam, sync }: { model: BuildingModel; cam?: CamRequest; sync?: CamSync }) {
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const camera = useThree((s) => s.camera);
  const id = useId();
  const state = useRef({ ver: -1, seq: cam?.seq ?? 0, applying: false, goal: null as null | { pos: THREE.Vector3; target: THREE.Vector3 }, init: false });
  const frame = useMemo(() => cameraPresets(model), [model]);

  // initial placement: adopt the shared camera if another canvas already set it
  useEffect(() => {
    if (!controls || state.current.init) return;
    const s = state.current;
    s.init = true;
    s.applying = true;
    if (sync && sync.ver > 0) {
      camera.position.copy(sync.pos);
      controls.target.copy(sync.target);
      s.ver = sync.ver;
    } else {
      camera.position.copy(frame.presets.iso);
      controls.target.copy(frame.center);
    }
    controls.update();
    s.applying = false;
    if (sync && sync.ver === 0) s.ver = sync.write(id, camera.position, controls.target);
  }, [controls, camera, sync, frame, id]);

  useEffect(() => {
    if (!controls || !sync) return;
    const s = state.current;
    const onChange = () => {
      if (s.applying) return;
      s.ver = sync.write(id, camera.position, controls.target);
    };
    controls.addEventListener("change", onChange);
    return () => controls.removeEventListener("change", onChange);
  }, [controls, camera, sync, id]);

  useEffect(() => {
    const s = state.current;
    if (!cam || cam.seq === s.seq) return;
    s.seq = cam.seq;
    if (cam.preset) s.goal = { pos: frame.presets[cam.preset].clone(), target: frame.center.clone() };
    else if (cam.focus) {
      const target = new THREE.Vector3(...cam.focus.target);
      const dir = camera.position.clone().sub(controls?.target ?? frame.center).normalize();
      s.goal = { pos: target.clone().add(dir.multiplyScalar(cam.focus.dist)), target };
    }
  }, [cam, frame, camera, controls]);

  useFrame((_, dt) => {
    if (!controls) return;
    const s = state.current;
    if (sync && sync.ver !== s.ver && sync.owner !== id) {
      s.applying = true;
      camera.position.copy(sync.pos);
      controls.target.copy(sync.target);
      controls.update();
      s.applying = false;
      s.ver = sync.ver;
    }
    if (s.goal) {
      const k = 1 - Math.exp(-dt * 7);
      camera.position.lerp(s.goal.pos, k);
      controls.target.lerp(s.goal.target, k);
      controls.update();
      if (camera.position.distanceTo(s.goal.pos) < 0.02 && controls.target.distanceTo(s.goal.target) < 0.02) s.goal = null;
    }
  });
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

export function Scene(p: SceneProps) {
  const { model } = p;
  const { elements, assets, runs, rooms, FH, floors } = model;
  const look = p.look;
  const t = p.t ?? 1;
  const today = p.today ?? 1;
  const lag = p.lag ?? 0;
  const selection = p.selection ?? null;
  const layers = p.layers ?? ALL_LAYERS;
  const systems = p.systems ?? ALL_SYSTEMS;
  const display = p.display ?? DISPLAY;
  const pins = p.pins ?? NO_PINS;
  const floor = p.floor ?? null;
  const explode = !!p.explode;
  const evening = !!p.evening && look !== "xray" && look !== "heat";
  const dark = look === "xray" || look === "heat";
  const timeLook = look === "overlay" || look === "state" || look === "actual";
  const onSelect = p.onSelect;
  const compact = !!p.compact;
  const pick = compact ? undefined : onSelect;

  const gap = explode ? FH * 0.75 : 0;
  const off = (f: number) => (f <= 0 ? 0 : Math.min(f, floors + 1) - 1) * gap;
  // a slab belongs to the floor it carries; the roof slab moves with the roof
  const keyOf = (e: Element) => (e.kind === "slab" ? Math.round((e.pos[1] + 0.1) / FH) + 1 : e.floor);
  const onFloor = (f: number) => floor === null || f === floor;

  const cut = cutoffAt(t, today, lag);
  const plans = assetPlans(model);
  const builtAt = (plan: number) => !timeLook || plan <= cut + 1e-9;

  // ---------- building elements ----------
  const els = useMemo(() => {
    const solid: ElItem[] = [];
    const glass: ElItem[] = [];
    const ghost: ElItem[] = [];
    const xray: ElItem[] = [];
    const selCode = selection?.type === "asset" ? selection.code : null;
    for (const el of elements) {
      const k = keyOf(el);
      if (!onFloor(k) || (floor !== null && el.floor === 0)) continue;
      if (!systems[elementSys(el)]) continue;
      const raw = timeLook ? stateAt(el.plan, t, today, lag) : "built";
      // past today nothing more is known to be built; work planned after today is not late yet
      const st = raw === "late" && el.plan > today ? "future" : raw;
      const y = off(k);
      const base = { pos: [el.pos[0], el.pos[1] + y, el.pos[2]] as Vec3, size: el.size, rot: el.rot, el, floor: k };
      const selected = (selection?.type === "element" && selection.id === el.id) || (!!selCode && el.code === selCode);
      if (selected) {
        solid.push({ ...base, color: ACCENT });
        continue;
      }
      if (dark) {
        xray.push({ ...base, color: el.kind === "slab" ? "#d8d1c4" : "#efe9de" });
        continue;
      }
      if (look === "actual" && st !== "built") continue;
      if (look === "overlay" && st !== "built") {
        ghost.push({ ...base, color: "#7d93ab" });
        continue;
      }
      if (look === "state" && st === "future") {
        ghost.push({ ...base, color: "#c9c1b4" });
        continue;
      }
      if (look === "state" && st === "late") {
        solid.push({ ...base, color: ACCENT });
        continue;
      }
      const color = el.material === "wallExt" ? model.spec.palette.wall : el.material === "roof" ? model.spec.palette.roof : MAT[el.material];
      (el.material === "glass" ? glass : solid).push({ ...base, color });
    }
    return { solid, glass, ghost, xray };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elements, model, look, t, today, lag, floor, explode, systems, selection]);

  // ---------- equipment ----------
  const eq = useMemo(() => {
    const box: AssetItem[] = [];
    const cyl: AssetItem[] = [];
    const glow: AssetItem[] = [];
    if (look === "heat") return { box, cyl, glow };
    for (const a of assets) {
      if (!a.render || !onFloor(a.floor) || !systems[assetSys(a)]) continue;
      if (timeLook && !builtAt(plans.get(a.code) ?? 1)) continue;
      const selected = (selection?.type === "asset" && selection.code === a.code) || (!!p.circuit && a.circuit === p.circuit);
      if (look === "xray") {
        const layer = a.system === "elec" ? "elec" : a.system === "hvac" ? "hvac" : "water";
        if (!layers[layer]) continue;
      } else {
        if (a.code.startsWith("OU") || a.code.startsWith("DB")) continue;
        if (a.shape === "disc" && !evening && !selected) continue;
      }
      const y = off(a.floor);
      const pos: Vec3 = [a.pos[0], a.pos[1] + y, a.pos[2]];
      const size: Vec3 = a.shape === "box" ? a.size : [a.size[0] * 2, a.size[1], a.size[2] * 2];
      let color: string;
      if (selected) color = ACCENT;
      else if (look === "xray") color = a.system === "elec" ? RUN_COLOR.elec : a.system === "hvac" ? RUN_COLOR.hvac : /^(WC|LV|SK)-/.test(a.code) ? "#4f9a8b" : RUN_COLOR.water;
      else if (a.shape === "disc") color = "#fff1cf";
      else color = a.system === "hvac" ? "#ece8e0" : a.shape === "cyl" ? "#5b6a6e" : "#f4f1ea";
      const it = { pos, size, color, code: a.code, floor: a.floor };
      if (a.shape === "disc" && look !== "xray") glow.push(it);
      else (a.shape === "box" ? box : cyl).push(it);
    }
    return { box, cyl, glow };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets, look, t, today, lag, floor, explode, systems, selection, p.circuit, layers, evening]);

  // ---------- pipes and wires ----------
  const wires = useMemo(() => {
    const rest: Poly[] = [];
    const traced: Poly[] = [];
    if (look !== "xray") return { rest, traced };
    for (const r of runs) {
      if (!layers[r.system] || !systems[runSys(r)] || !onFloor(r.floor)) continue;
      const y = off(r.floor);
      const points = y ? r.points.map((q) => [q[0], q[1] + y, q[2]] as Vec3) : r.points;
      const line = { points, color: RUN_COLOR[r.system], floor: r.floor };
      if (p.circuit && r.circuit === p.circuit) traced.push(line);
      else rest.push(line);
    }
    return { rest, traced };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runs, look, layers, systems, floor, explode, p.circuit]);

  // ---------- rooms (heat boxes, selection outline, labels) ----------
  const roomItems = useMemo(() => {
    const heat: RoomItem[] = [];
    const sel: RoomItem[] = [];
    for (const r of rooms) {
      if (!onFloor(r.floor)) continue;
      const y0 = (r.floor - 1) * FH + off(r.floor);
      const it: RoomItem = { id: r.id, pos: [(r.x0 + r.x1) / 2, y0 + (FH - 0.5) / 2 + 0.05, (r.z0 + r.z1) / 2], size: [r.x1 - r.x0 - 0.3, FH - 0.6, r.z1 - r.z0 - 0.3], color: "#6f6a63", floor: r.floor };
      const isSel = selection?.type === "room" && selection.id === r.id;
      if (look === "heat") {
        const v = p.heat?.get(r.id);
        heat.push({ ...it, color: isSel ? ACCENT : v ? heatColor(v.good) : "#5e5953" });
      }
      if (isSel) sel.push({ ...it, color: ACCENT });
    }
    return { heat, sel };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms, look, floor, explode, selection, p.heat, FH]);

  const labels = useMemo<Label[]>(() => {
    if (!display.labels) return [];
    return rooms.filter((r) => onFloor(r.floor)).map((r) => ({ id: r.id, text: r.name, pos: [(r.x0 + r.x1) / 2, (r.floor - 1) * FH + 1.5 + off(r.floor), (r.z0 + r.z1) / 2] }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms, display.labels, floor, explode, FH]);

  // ---------- furniture and ceilings ----------
  const fixturesDone = !timeLook || plans.size === 0 || elements.every((e) => e.phase !== "finish" || e.plan <= cut);
  const furn = useMemo(() => {
    if (!display.furniture || dark || !fixturesDone) return [];
    return furniture(model)
      .filter((f) => onFloor(f.floor ?? 1))
      .map((f) => (gap ? { ...f, pos: [f.pos[0], f.pos[1] + off(f.floor ?? 1), f.pos[2]] as Vec3 } : f));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, display.furniture, dark, fixturesDone, floor, explode]);
  const ceil = useMemo(() => {
    if (!display.ceiling || dark || !fixturesDone) return [];
    return ceilings(model)
      .filter((f) => onFloor(f.floor ?? 1))
      .map((f) => (gap ? { ...f, pos: [f.pos[0], f.pos[1] + off(f.floor ?? 1), f.pos[2]] as Vec3 } : f));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, display.ceiling, dark, fixturesDone, floor, explode]);

  // ---------- construction site ----------
  const site = useMemo(() => {
    if (!timeLook) return { building: false, scaffold: [] as number[], crane: false };
    let built = 0;
    const colStarted = new Set<number>();
    const envOpen = new Set<number>();
    let frameOpen = false;
    for (const e of elements) {
      const b = e.plan <= cut;
      if (b) built++;
      if (e.kind === "column" && b) colStarted.add(e.floor);
      if (!b && (e.kind === "wall" || e.kind === "glass" || e.kind === "door") && e.floor >= 1 && e.floor <= floors) envOpen.add(e.floor);
      if (!b && (e.phase === "structure" || e.phase === "roof")) frameOpen = true;
    }
    const building = built > 0 && built < elements.length;
    const scaffold = building && !explode && floor === null ? [...colStarted].filter((f) => envOpen.has(f)).sort((a, b) => a - b) : [];
    return { building, scaffold, crane: building && frameOpen && built > elements.length * 0.06 };
  }, [timeLook, elements, cut, floors, explode, floor]);

  const frame = useMemo(() => cameraPresets(model), [model]);
  const bg = dark ? "#161513" : evening ? "#3d3a35" : "#e4e2da";
  const R = frame.R;
  const sh = R * 0.9 + 12;

  useEffect(() => () => void (document.body.style.cursor = ""), []);

  const pickEl = pick ? (it: ElItem) => pick(it.el.code ? { type: "asset", code: it.el.code } : { type: "element", id: it.el.id }) : undefined;
  const pickAsset = pick ? (it: AssetItem) => pick({ type: "asset", code: it.code }) : undefined;
  const pickRoom = pick ? (it: RoomItem) => pick({ type: "room", id: it.id }) : undefined;
  const cap = elements.length + 8;

  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      gl={{ preserveDrawingBuffer: true, antialias: true }}
      camera={{ position: frame.presets.iso.toArray(), fov: 35, near: 0.1, far: 1200 }}
      onPointerMissed={() => !compact && onSelect?.(null)}
      style={{ background: bg }}
    >
      <color attach="background" args={[bg]} />
      {!dark && <fog attach="fog" args={[bg, frame.dist * 1.8, frame.dist * 5]} />}
      <hemisphereLight args={evening ? ["#c9b8a6", "#3a3530", 0.45] : ["#fbf7ef", "#8b8070", dark ? 0.9 : 0.7]} />
      <directionalLight
        position={evening ? [-R * 1.2, R * 0.35, -R * 0.4] : [-R * 0.7, R * 1.2, -R * 0.5]}
        intensity={dark ? 0.6 : evening ? 0.9 : 2.1}
        color={evening ? "#ffb98a" : "#ffffff"}
        castShadow={!dark}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-sh}
        shadow-camera-right={sh}
        shadow-camera-top={sh}
        shadow-camera-bottom={-sh}
        shadow-camera-far={R * 6}
        shadow-bias={-0.0004}
      />
      {evening && <ambientLight intensity={0.25} color="#ffd9b0" />}

      <Site model={model} dark={dark} building={site.building} showVillage={display.site && !compact} evening={evening} />
      {site.building && <Construction model={model} floors={site.scaffold} crane={site.crane} />}

      <Instances items={els.solid} cap={cap} onPick={pickEl} />
      <Instances items={els.glass} cap={cap} opacity={0.45} roughness={0.15} metalness={0.2} onPick={pickEl} />
      {els.ghost.length > 0 && (
        <>
          <Instances items={els.ghost} cap={cap} opacity={look === "overlay" ? 0.2 : 0.1} shadows={false} onPick={pickEl} />
          <BoxEdges items={els.ghost} color={look === "overlay" ? "#7d93ab" : "#a39b8f"} opacity={look === "overlay" ? 0.55 : 0.6} />
        </>
      )}
      {els.xray.length > 0 && (
        <>
          <Instances items={els.xray} cap={cap} opacity={0.05} shadows={false} onPick={look === "xray" ? pickEl : undefined} />
          <BoxEdges items={els.xray} color="#8a847a" opacity={0.5} />
        </>
      )}

      <Instances items={eq.box} material={dark ? "basic" : "standard"} roughness={0.6} onPick={pickAsset} />
      <Instances items={eq.cyl} shape="cyl" material={dark ? "basic" : "standard"} roughness={0.6} onPick={pickAsset} />
      <Instances items={eq.glow} shape="cyl" material="basic" shadows={false} onPick={pickAsset} />

      {furn.length > 0 && <Instances items={furn} />}
      {ceil.length > 0 && <Instances items={ceil} />}

      {look === "xray" && (
        <>
          <Polylines lines={wires.rest} opacity={p.circuit ? 0.16 : 0.95} />
          {wires.traced.map((l, i) => (
            <Line key={i} points={l.points} color={ACCENT} lineWidth={3} />
          ))}
        </>
      )}

      {look === "heat" && (
        <>
          <Instances items={roomItems.heat} opacity={0.55} shadows={false} onPick={pickRoom} />
          <BoxEdges items={roomItems.heat} color="#efe9de" opacity={0.22} />
        </>
      )}
      {roomItems.sel.length > 0 && look !== "heat" && (
        <>
          <Instances items={roomItems.sel} opacity={0.14} shadows={false} />
          <BoxEdges items={roomItems.sel} color={ACCENT} />
        </>
      )}
      {roomItems.sel.length > 0 && look === "heat" && <BoxEdges items={roomItems.sel} color="#efe9de" />}

      {labels.length > 0 && <RoomLabels labels={labels} dark={dark || evening} />}

      {look === "real" &&
        pins.map((code) => {
          const a = assets.find((x) => x.code === code);
          if (!a || !onFloor(a.floor)) return null;
          const y = off(a.floor);
          const top = a.pos[1] + y + 1.6;
          return (
            <group key={code}>
              <Line points={[[a.pos[0], a.pos[1] + y, a.pos[2]], [a.pos[0], top, a.pos[2]]]} color={ACCENT} lineWidth={1.5} />
              <mesh
                position={[a.pos[0], top, a.pos[2]]}
                onClick={(e) => {
                  if (!pick) return;
                  e.stopPropagation();
                  pick({ type: "asset", code });
                }}
              >
                <sphereGeometry args={[0.22, 20, 20]} />
                <meshStandardMaterial color={ACCENT} />
              </mesh>
            </group>
          );
        })}

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={p.orbit?.damping ?? 0.08}
        rotateSpeed={p.orbit?.rotate ?? 0.8}
        zoomSpeed={p.orbit ? p.orbit.rotate * 1.1 : 0.9}
        maxPolarAngle={Math.PI / 2.04}
        minDistance={2}
        maxDistance={frame.dist * 3.2}
        enableZoom={!compact}
        enablePan={!compact}
      />
      <CameraRig model={model} cam={p.cam} sync={p.sync} />
      <CanvasHandle onCanvas={p.onCanvas} />
    </Canvas>
  );
}
