import type { Asset, BuildingModel } from "@/lib/house";

const S = 22; // px per metre

/** Small plan of one floor with the asset marked; drawn from the model's rooms and asset positions */
export function FloorPlan({ model, asset, className }: { model: BuildingModel; asset?: Asset; className?: string }) {
  const floor = Math.min(Math.max(1, asset?.floor ?? 1), model.floors);
  const rooms = model.rooms.filter((r) => r.floor === floor);
  const others = model.assets.filter((a) => a.floor === floor && a.render && a.code !== asset?.code);
  const ax = asset?.pos[0] ?? 0;
  const az = asset?.pos[2] ?? 0;
  const minX = Math.min(0, ax) - 1.2;
  const minZ = Math.min(0, az) - 1.2;
  const maxX = Math.max(model.W, ax) + 1.2;
  const maxZ = Math.max(model.D, az) + 1.2;
  const w = (maxX - minX) * S;
  const h = (maxZ - minZ) * S;
  const X = (x: number) => (x - minX) * S;
  const Z = (z: number) => (z - minZ) * S;
  const label = asset ? (asset.floor > model.floors ? "หลังคา" : `ชั้น ${floor}`) : `ชั้น ${floor}`;
  const grid: number[] = [];
  for (let x = Math.ceil(minX); x <= maxX; x++) grid.push(x);
  const gridZ: number[] = [];
  for (let z = Math.ceil(minZ); z <= maxZ; z++) gridZ.push(z);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} role="img" aria-label={`ผังพื้น${label}${asset ? ` ตำแหน่ง ${asset.code}` : ""}`}>
      <rect x={0} y={0} width={w} height={h} fill="var(--card)" />
      {grid.map((x) => (
        <line key={`x${x}`} x1={X(x)} x2={X(x)} y1={0} y2={h} stroke="var(--line)" strokeWidth={0.6} />
      ))}
      {gridZ.map((z) => (
        <line key={`z${z}`} x1={0} x2={w} y1={Z(z)} y2={Z(z)} stroke="var(--line)" strokeWidth={0.6} />
      ))}
      <rect x={X(0)} y={Z(0)} width={model.W * S} height={model.D * S} fill="none" stroke="var(--text)" strokeWidth={3} />
      {rooms.map((r) => {
        const hit = asset?.room === r.id;
        return (
          <g key={r.id}>
            <rect x={X(r.x0)} y={Z(r.z0)} width={(r.x1 - r.x0) * S} height={(r.z1 - r.z0) * S} fill={hit ? "var(--accent-soft)" : "transparent"} stroke="var(--text)" strokeWidth={1.2} />
            <text x={X((r.x0 + r.x1) / 2)} y={Z((r.z0 + r.z1) / 2)} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill="var(--text-3)">
              {r.name}
            </text>
          </g>
        );
      })}
      {others.map((a) => (
        <circle key={a.code} cx={X(a.pos[0])} cy={Z(a.pos[2])} r={1.8} fill="var(--text-3)" opacity={0.5} />
      ))}
      {asset && (
        <g>
          <circle cx={X(ax)} cy={Z(az)} r={11} fill="none" stroke="var(--accent)" strokeWidth={1.5} />
          <circle cx={X(ax)} cy={Z(az)} r={4} fill="var(--accent)" />
          <g transform={`translate(${Math.min(X(ax) + 14, w - 74)} ${Math.max(Z(az) - 22, 4)})`}>
            <rect width={70} height={18} rx={4} fill="var(--text)" />
            <text x={35} y={12.5} textAnchor="middle" fontSize={10} fontFamily="var(--font-plex-mono), monospace" fill="var(--card)">
              {asset.code}
            </text>
          </g>
        </g>
      )}
      <text x={8} y={h - 8} fontSize={10} fill="var(--text-2)" fontFamily="var(--font-plex-mono), monospace">
        {model.code} · {label}
      </text>
    </svg>
  );
}
