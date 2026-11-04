import { getHouseModel } from "@/lib/data";
import { getModel } from "@/lib/house";

/**
 * Front elevation drawn from the generated model: floors, windows from the
 * street-side openings, door and roof shape. Used on cards and lists.
 */
export function HouseThumb({ code, className, label }: { code: string; className?: string; label?: string }) {
  const spec = getHouseModel(code);
  if (!spec) return null;
  const m = getModel(code);
  const pad = 2;
  const roofH = spec.roof === "flat" ? 0.9 : spec.roof === "hip" ? 1.8 : 2.2;
  const H = m.floors * m.FH + roofH;
  const vw = m.W + pad * 2;
  const vh = H + 2.4;
  const ground = H + 1.2;
  const x = (v: number) => pad + v;
  const y = (v: number) => ground - v;
  const front = m.elements.filter((e) => (e.kind === "glass" || e.kind === "door") && Math.abs(e.pos[2]) < 0.05);
  const top = m.floors * m.FH;

  return (
    <svg viewBox={`0 0 ${vw} ${vh}`} className={className} role="img" aria-label={label ?? `รูปด้านหน้า ${spec.name}`} preserveAspectRatio="xMidYMax meet">
      <rect x={0} y={0} width={vw} height={vh} fill="#ebe6dc" />
      <rect x={0} y={ground} width={vw} height={vh - ground} fill="#c9cdb6" />
      {/* body */}
      <rect x={x(0)} y={y(top)} width={m.W} height={top} fill={spec.palette.wall} stroke="#3b3631" strokeWidth={0.06} />
      {Array.from({ length: m.floors - 1 }, (_, i) => (
        <line key={i} x1={x(0)} x2={x(m.W)} y1={y((i + 1) * m.FH)} y2={y((i + 1) * m.FH)} stroke="#3b3631" strokeWidth={0.04} opacity={0.5} />
      ))}
      {/* roof */}
      {spec.roof === "flat" ? (
        <rect x={x(-0.1)} y={y(top + roofH)} width={m.W + 0.2} height={roofH} fill={spec.palette.wall} stroke="#3b3631" strokeWidth={0.06} />
      ) : spec.roof === "gable" ? (
        <polygon points={`${x(-0.6)},${y(top)} ${x(m.W / 2)},${y(top + roofH)} ${x(m.W + 0.6)},${y(top)}`} fill={spec.palette.roof} stroke="#2b2724" strokeWidth={0.06} />
      ) : (
        <polygon points={`${x(-0.6)},${y(top)} ${x(m.W * 0.22)},${y(top + roofH)} ${x(m.W * 0.78)},${y(top + roofH)} ${x(m.W + 0.6)},${y(top)}`} fill={spec.palette.roof} stroke="#2b2724" strokeWidth={0.06} />
      )}
      {/* openings */}
      {front.map((e) => {
        const w = e.size[0];
        const h = e.size[1];
        const cx = e.pos[0];
        const cy = e.pos[1];
        return e.kind === "door" ? (
          <rect key={e.id} x={x(cx - w / 2)} y={y(cy + h / 2)} width={w} height={h} fill={spec.palette.accent} stroke="#2b2724" strokeWidth={0.05} />
        ) : (
          <g key={e.id}>
            <rect x={x(cx - w / 2)} y={y(cy + h / 2)} width={w} height={h} fill="#8fa6ab" stroke="#2b2724" strokeWidth={0.05} />
            <line x1={x(cx)} x2={x(cx)} y1={y(cy + h / 2)} y2={y(cy - h / 2)} stroke="#2b2724" strokeWidth={0.04} />
          </g>
        );
      })}
    </svg>
  );
}
