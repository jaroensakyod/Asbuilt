"use client";

import { useMemo } from "react";
import type { BuildingModel } from "@/lib/house";
import { fence, lotOf, parkingStripes, scaffold, siteGear, village, type Item } from "@/lib/viewer-props";
import { Instances } from "./instanced";

function Plane({ x0, x1, z0, z1, y, color }: { x0: number; x1: number; z0: number; z1: number; y: number; color: string }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(x0 + x1) / 2, y, (z0 + z1) / 2]} receiveShadow raycast={() => null}>
      <planeGeometry args={[x1 - x0, z1 - z0]} />
      <meshStandardMaterial color={color} roughness={1} />
    </mesh>
  );
}

/** Ground, plot, neighbouring village. `building` swaps the finished garden for a construction site. */
export function Site({ model, dark, building, showVillage, evening }: { model: BuildingModel; dark: boolean; building: boolean; showVillage: boolean; evening: boolean }) {
  const { W, D } = model;
  const lot = useMemo(() => lotOf(model), [model]);
  const v = useMemo(() => village(model), [model]);
  const cx = (lot.x0 + lot.x1) / 2;
  const gate: [number, number] = lot.parking ? [0.5, 8] : [1, 6.5];
  const fenceItems = useMemo(() => fence(lot, building ? 2.2 : 1.4, building ? 0.08 : 0.16, building ? "#3e5c7e" : "#e9e5dc", gate), [lot, building, gate[0], gate[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  const stripes = useMemo(() => (lot.parking ? parkingStripes(model, lot) : []), [lot, model]);

  if (dark) {
    const size = Math.ceil(Math.max(W, D) * 2.4 + 20);
    return <gridHelper args={[size, size, "#3a3631", "#26231f"]} position={[W / 2, -0.21, D / 2]} raycast={() => null} />;
  }

  const grass = evening ? "#8f977c" : "#b7bf9f";
  return (
    <group>
      <Plane x0={cx - 160} x1={cx + 160} z0={-160} z1={160} y={-0.26} color={grass} />
      {showVillage && (
        <>
          <Plane x0={cx - 160} x1={cx + 160} z0={v.roadZ - v.roadW / 2} z1={v.roadZ + v.roadW / 2} y={-0.24} color={evening ? "#4a4946" : "#6a6965"} />
          <Plane x0={cx - 160} x1={cx + 160} z0={v.roadZ + v.roadW / 2} z1={v.roadZ + v.roadW / 2 + 1.5} y={-0.235} color="#cfc9bd" />
          <Instances items={v.stripes} shadows={false} />
          <Instances items={v.poles} />
          <Instances items={v.bodies} />
          <Instances items={v.roofs} shape="cone4" flat />
          <Instances items={v.windows} shadows={false} roughness={0.3} />
        </>
      )}
      <Instances items={v.trunks} shape="cyl" />
      <Instances items={v.crowns} shape="ico" flat roughness={1} />
      {/* plot */}
      <Plane x0={lot.x0} x1={lot.x1} z0={lot.z0} z1={lot.z1} y={-0.245} color={building ? "#b39d80" : "#a9b48f"} />
      {!building && (
        <>
          {lot.parking ? (
            <Plane x0={0} x1={W} z0={lot.z0 + 0.6} z1={-0.8} y={-0.23} color="#9c9a95" />
          ) : (
            <Plane x0={gate[0]} x1={gate[1]} z0={lot.z0} z1={0} y={-0.23} color="#d2ccc0" />
          )}
          <Plane x0={-0.6} x1={W + 0.6} z0={-0.6} z1={D + 0.6} y={-0.215} color="#cfc8bb" />
          {lot.pool && (
            <>
              <Plane x0={lot.pool.x0 - 1.2} x1={lot.pool.x1 + 1.2} z0={lot.pool.z0 - 1.2} z1={lot.pool.z1 + 1.2} y={-0.225} color="#e4ddcf" />
              <Plane x0={lot.pool.x0} x1={lot.pool.x1} z0={lot.pool.z0} z1={lot.pool.z1} y={-0.205} color="#6f9fa8" />
              <Instances
                items={[
                  { pos: [lot.pool.x0 + 1, 0.15, lot.pool.z1 + 0.7], size: [0.7, 0.3, 1.8], color: "#f1eee8" },
                  { pos: [lot.pool.x0 + 2.2, 0.15, lot.pool.z1 + 0.7], size: [0.7, 0.3, 1.8], color: "#f1eee8" },
                ]}
              />
            </>
          )}
          <Instances items={stripes} shadows={false} />
          <Instances items={fenceItems} />
        </>
      )}
      {building && <Instances items={fenceItems} roughness={0.6} />}
    </group>
  );
}

/** Scaffolding, crane, site office and mixer for an in-progress date */
export function Construction({ model, floors, crane }: { model: BuildingModel; floors: number[]; crane: boolean }) {
  const lot = useMemo(() => lotOf(model), [model]);
  const pipes = useMemo(() => scaffold(model, floors), [model, floors]);
  const gear = useMemo(() => siteGear(model, lot, crane), [model, lot, crane]);
  const drum: Item[] = useMemo(() => [{ pos: gear.drum, size: [1, 1.1, 1], rot: [0, 0, 0.9], color: "#9aa0a3" }], [gear]);
  const pile: Item[] = useMemo(() => [{ pos: [gear.pile[0], 0.4, gear.pile[2]], size: [2.2, 1, 2.2], color: "#c9b28a" }], [gear]);
  return (
    <group>
      <Instances items={pipes} roughness={0.5} metalness={0.3} />
      <Instances items={gear.boxes} roughness={0.6} />
      <Instances items={drum} shape="cyl" roughness={0.5} metalness={0.3} />
      <Instances items={pile} shape="cone4" flat roughness={1} />
    </group>
  );
}
