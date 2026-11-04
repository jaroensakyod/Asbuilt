import type { AssetCategory } from "@/lib/house";

/** Short prefix of an asset code, e.g. "W-105" → "W5" style tag text used on doors and windows */
export function shortTag(code: string) {
  const [p, n] = code.split("-");
  return `${p}${Number(n?.slice(1) ?? 0)}`;
}

type SymProps = {
  cat: AssetCategory;
  x: number;
  y: number;
  r: number;
  stroke: string;
  fill: string;
  sw: number;
  horizontal?: boolean;
  code?: string;
};

/** Plan symbol per equipment category, drawn in plan units (metres) */
export function MarkerSymbol({ cat, x, y, r, stroke, fill, sw, horizontal = true, code }: SymProps) {
  const common = { stroke, strokeWidth: sw, fill };
  const line = { stroke, strokeWidth: sw * 0.8, fill: "none" };
  switch (cat) {
    case "ตู้ควบคุมไฟฟ้า":
      return (
        <g>
          <rect x={x - r * 1.2} y={y - r * 0.75} width={r * 2.4} height={r * 1.5} {...common} />
          <path d={`M ${x - r * 1.2} ${y + r * 0.75} L ${x + r * 1.2} ${y - r * 0.75} L ${x + r * 1.2} ${y + r * 0.75} Z`} fill={stroke} />
        </g>
      );
    case "เบรกเกอร์ลูกย่อย":
      return (
        <g>
          <rect x={x - r * 0.6} y={y - r * 0.6} width={r * 1.2} height={r * 1.2} {...common} />
          <line x1={x - r * 0.6} y1={y + r * 0.6} x2={x + r * 0.6} y2={y - r * 0.6} {...line} />
        </g>
      );
    case "โคมดาวน์ไลท์ LED":
      return (
        <g>
          <circle cx={x} cy={y} r={r * 0.8} {...common} />
          <path d={`M ${x - r * 0.56} ${y - r * 0.56} L ${x + r * 0.56} ${y + r * 0.56} M ${x + r * 0.56} ${y - r * 0.56} L ${x - r * 0.56} ${y + r * 0.56}`} {...line} />
        </g>
      );
    case "เต้ารับคู่มีกราวด์":
      return (
        <g>
          <circle cx={x} cy={y} r={r * 0.8} {...common} />
          <path d={`M ${x - r * 0.25} ${y - r * 0.45} V ${y + r * 0.45} M ${x + r * 0.25} ${y - r * 0.45} V ${y + r * 0.45}`} {...line} />
        </g>
      );
    case "สวิตช์ไฟ":
      return (
        <g>
          <line x1={x} y1={y} x2={x + r * 0.9} y2={y - r * 0.9} {...line} />
          <line x1={x + r * 0.9} y1={y - r * 0.9} x2={x + r * 1.2} y2={y - r * 0.6} {...line} />
          <circle cx={x} cy={y} r={r * 0.45} {...common} fill={stroke} />
        </g>
      );
    case "เครื่องทำน้ำอุ่น":
      return (
        <g>
          <rect x={x - r * 0.8} y={y - r} width={r * 1.6} height={r * 2} {...common} />
          <path d={`M ${x - r * 0.4} ${y + r * 0.4} Q ${x} ${y - r * 0.6} ${x + r * 0.4} ${y + r * 0.4}`} {...line} />
        </g>
      );
    case "สุขภัณฑ์ (ชักโครก)":
      return (
        <g>
          <rect x={x - r * 0.8} y={y - r * 1.3} width={r * 1.6} height={r * 0.6} {...common} />
          <ellipse cx={x} cy={y + r * 0.2} rx={r * 0.7} ry={r * 0.95} {...common} />
        </g>
      );
    case "อ่างล้างหน้า":
      return (
        <g>
          <rect x={x - r * 1.1} y={y - r * 0.8} width={r * 2.2} height={r * 1.6} rx={r * 0.3} {...common} />
          <ellipse cx={x} cy={y} rx={r * 0.7} ry={r * 0.45} {...line} />
        </g>
      );
    case "ซิงค์ล้างจาน":
      return (
        <g>
          <rect x={x - r * 1.1} y={y - r * 0.9} width={r * 2.2} height={r * 1.8} {...common} />
          <rect x={x - r * 0.7} y={y - r * 0.55} width={r * 1.4} height={r * 1.1} rx={r * 0.2} {...line} />
        </g>
      );
    case "ปั๊มน้ำอัตโนมัติ":
      return (
        <g>
          <circle cx={x} cy={y} r={r} {...common} />
          <path d={`M ${x - r * 0.45} ${y + r * 0.4} L ${x} ${y - r * 0.5} L ${x + r * 0.45} ${y + r * 0.4} Z`} {...line} />
        </g>
      );
    case "ถังเก็บน้ำ":
      return (
        <g>
          <circle cx={x} cy={y} r={r * 1.5} {...common} />
          <circle cx={x} cy={y} r={r * 0.9} {...line} />
        </g>
      );
    case "ถังบำบัดน้ำเสีย":
      return (
        <g>
          <circle cx={x} cy={y} r={r * 1.5} {...common} />
          <path d={`M ${x - r * 1.5} ${y} H ${x + r * 1.5} M ${x} ${y - r * 1.5} V ${y + r * 1.5}`} {...line} />
        </g>
      );
    case "เครื่องปรับอากาศติดผนัง (Fan Coil)": {
      const w = horizontal ? r * 2.8 : r * 1;
      const h = horizontal ? r * 1 : r * 2.8;
      return (
        <g>
          <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={r * 0.15} {...common} />
          {horizontal ? <line x1={x - w / 2 + r * 0.3} x2={x + w / 2 - r * 0.3} y1={y} y2={y} {...line} /> : <line y1={y - h / 2 + r * 0.3} y2={y + h / 2 - r * 0.3} x1={x} x2={x} {...line} />}
        </g>
      );
    }
    case "คอยล์ร้อน (Condensing Unit)": {
      const w = horizontal ? r * 2.4 : r * 1.6;
      const h = horizontal ? r * 1.6 : r * 2.4;
      return (
        <g>
          <rect x={x - w / 2} y={y - h / 2} width={w} height={h} {...common} />
          <circle cx={x} cy={y} r={r * 0.6} {...line} />
          <path d={`M ${x - r * 0.6} ${y} H ${x + r * 0.6} M ${x} ${y - r * 0.6} V ${y + r * 0.6}`} {...line} />
        </g>
      );
    }
    case "ประตู": {
      const pts = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i;
        return `${(x + Math.cos(a) * r * 1.25).toFixed(3)},${(y + Math.sin(a) * r * 1.25).toFixed(3)}`;
      }).join(" ");
      return (
        <g>
          <polygon points={pts} {...common} />
          {code && (
            <text x={x} y={y + r * 0.38} textAnchor="middle" fontSize={r * 1.05} fill={stroke} stroke="none" fontFamily="var(--font-mono)">
              {shortTag(code)}
            </text>
          )}
        </g>
      );
    }
    case "หน้าต่าง":
      return (
        <g>
          <circle cx={x} cy={y} r={r * 1.25} {...common} />
          {code && (
            <text x={x} y={y + r * 0.38} textAnchor="middle" fontSize={r * 1.05} fill={stroke} stroke="none" fontFamily="var(--font-mono)">
              {shortTag(code)}
            </text>
          )}
        </g>
      );
    case "พื้น/กระเบื้อง":
      return <path d={`M ${x} ${y - r} L ${x + r} ${y} L ${x} ${y + r} L ${x - r} ${y} Z`} {...common} />;
    case "หลังคา/กันซึม":
      return <path d={`M ${x - r * 1.1} ${y + r * 0.8} L ${x} ${y - r} L ${x + r * 1.1} ${y + r * 0.8} Z`} {...common} />;
    default:
      return <circle cx={x} cy={y} r={r * 0.8} {...common} />;
  }
}

/** Legend swatch: the same symbol in a small standalone SVG */
export function SymbolSwatch({ cat }: { cat: AssetCategory }) {
  return (
    <svg viewBox="-1 -1 2 2" className="size-4 shrink-0" aria-hidden>
      <MarkerSymbol cat={cat} x={0} y={0} r={0.52} stroke="var(--text-2)" fill="var(--card)" sw={0.09} />
    </svg>
  );
}
