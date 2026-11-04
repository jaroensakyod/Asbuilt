"use client";

import { useEffect, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import { ExternalLink, Maximize, Minus, Plus } from "lucide-react";
import { cx } from "@/components/ui";
import type { SystemKey } from "@/lib/data";
import type { AssetCategory, BuildingModel, Run, Vec3 } from "@/lib/house";
import { MarkerSymbol, SymbolSwatch } from "./symbols";

export type Overlay = "arch" | "elec" | "plumb" | "hvac";
export type PlanFloor = number | "ext";

export type PlanMarker = {
  code: string;
  name?: string;
  category: AssetCategory;
  system: SystemKey;
  floor: number;
  room: string;
  pos: Vec3;
  size: Vec3;
  circuit?: string;
  state?: "normal" | "watch" | "fault" | "service";
};

export const OVERLAY_LABEL: Record<Overlay, string> = {
  arch: "สถาปัตย์",
  elec: "ไฟฟ้า",
  plumb: "สุขาภิบาล",
  hvac: "แอร์",
};

const RUN_STYLE: Record<Run["system"], { stroke: string; dash?: string; w: number; label: string }> = {
  elec: { stroke: "#b07d12", w: 0.035, label: "สายไฟ/วงจร" },
  water: { stroke: "#3f6f8f", w: 0.045, label: "ท่อน้ำดี" },
  drain: { stroke: "#7b7266", dash: "0.18 0.1", w: 0.06, label: "ท่อน้ำทิ้ง" },
  hvac: { stroke: "#4f7a6b", w: 0.05, label: "ท่อน้ำยาแอร์" },
};

const OVERLAY_RUNS: Record<Overlay, Run["system"][]> = {
  arch: [],
  elec: ["elec"],
  plumb: ["water", "drain"],
  hvac: ["hvac"],
};

const isExt = (m: { room: string; floor: number }, floors: number) => m.room === "ภายนอก" || m.room === "หลังคา" || m.floor > floors;

export const markerOnFloor = (m: { room: string; floor: number }, floor: PlanFloor, floors: number) =>
  floor === "ext" ? isExt(m, floors) : !isExt(m, floors) && m.floor === floor;

const uniq = (vals: number[]) => {
  const s = [...vals].sort((a, b) => a - b);
  return s.filter((v, i) => i === 0 || v - s[i - 1] > 0.05);
};

const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const fmt = (v: number) => v.toFixed(2);

type View = { k: number; tx: number; ty: number };

export type PlanViewProps = {
  model: BuildingModel;
  floor: PlanFloor;
  overlay: Overlay;
  markers?: PlanMarker[];
  selected?: string | null;
  onSelect?: (code: string | null) => void;
  /** px height of the drawing area */
  height?: number;
  title?: string;
  legend?: boolean;
};

export function PlanView(props: PlanViewProps) {
  return <PlanCanvas key={`${props.model.code}-${props.floor}-${props.overlay}`} {...props} />;
}

function PlanCanvas({ model, floor, overlay, markers = [], selected, onSelect, height = 560, title, legend = true }: PlanViewProps) {
  const { W, D, floors } = model;
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<View>({ k: 1, tx: 0, ty: 0 });
  const drag = useRef<{ x: number; y: number; tx: number; ty: number; moved: boolean } | null>(null);

  const s = Math.min(2.4, Math.max(1, Math.max(W, D) / 13)); // symbol/text scale for big buildings
  const Y = (z: number) => D - z;
  const planFloor = floor === "ext" ? 1 : floor;

  const rooms = model.rooms.filter((r) => r.floor === planFloor);
  const walls = model.elements.filter((e) => e.kind === "wall" && e.floor === planFloor && e.size[1] > 2);
  const glass = model.elements.filter((e) => e.kind === "glass" && e.floor === planFloor);
  const doors = model.assets.filter((a) => a.category === "ประตู" && a.floor === planFloor);
  const visible = markers.filter((m) => markerOnFloor(m, floor, floors));
  const sel = selected ? markers.find((m) => m.code === selected) : undefined;
  const selRoom = sel && !isExt(sel, floors) ? sel.room : undefined;

  const runSystems = OVERLAY_RUNS[overlay];
  const runs = model.runs.filter((r) => runSystems.includes(r.system) && (floor === "ext" ? r.floor === 1 : r.floor === floor));

  // drawing extents
  const ext = (() => {
    let x0 = -3.4 * s;
    let x1 = W + 2.4 * s;
    let y0 = -3.4 * s;
    let y1 = D + 2.4 * s;
    if (floor === "ext") {
      for (const m of markers.filter((q) => isExt(q, floors))) {
        x0 = Math.min(x0, m.pos[0] - 1.5);
        x1 = Math.max(x1, m.pos[0] + 1.5);
        y0 = Math.min(y0, Y(m.pos[2]) - 1.5);
        y1 = Math.max(y1, Y(m.pos[2]) + 1.5);
      }
      for (const r of runs) for (const p of r.points) {
        x0 = Math.min(x0, p[0] - 1);
        x1 = Math.max(x1, p[0] + 1);
        y1 = Math.max(y1, Y(p[2]) + 1);
      }
    }
    return { x0, y0, w: x1 - x0, h: y1 - y0 };
  })();

  // grid lines from room boundaries
  const gx = uniq(rooms.flatMap((r) => [r.x0, r.x1]));
  const gz = uniq(rooms.flatMap((r) => [r.z0, r.z1]));

  const toSvg = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return { x: 0, y: 0 };
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  const zoomAt = (factor: number, c?: { x: number; y: number }) => {
    setView((v) => {
      const k = Math.min(8, Math.max(0.6, v.k * factor));
      const f = k / v.k;
      const cc = c ?? { x: ext.x0 + ext.w / 2, y: ext.y0 + ext.h / 2 };
      return { k, tx: cc.x - (cc.x - v.tx) * f, ty: cc.y - (cc.y - v.ty) * f };
    });
  };

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const ctm = el.getScreenCTM();
      if (!ctm) return;
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      setView((v) => {
        const k = Math.min(8, Math.max(0.6, v.k * factor));
        const f = k / v.k;
        return { k, tx: p.x - (p.x - v.tx) * f, ty: p.y - (p.y - v.ty) * f };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = (e: RPointerEvent<SVGSVGElement>) => {
    const p = toSvg(e.clientX, e.clientY);
    drag.current = { x: p.x, y: p.y, tx: view.tx, ty: view.ty, moved: false };
  };
  const onPointerMove = (e: RPointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d || e.buttons === 0) return;
    const p = toSvg(e.clientX, e.clientY);
    const dx = p.x - d.x;
    const dy = p.y - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 0.15) return;
    if (!d.moved) e.currentTarget.setPointerCapture(e.pointerId);
    d.moved = true;
    setView((v) => ({ ...v, tx: d.tx + dx, ty: d.ty + dy }));
  };
  const onPointerUp = () => {
    setTimeout(() => (drag.current = null), 0);
  };
  const clickMarker = (code: string) => {
    if (drag.current?.moved) return;
    onSelect?.(code === selected ? null : code);
  };

  const openInTab = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const cs = getComputedStyle(document.documentElement);
    const body = getComputedStyle(document.body);
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.querySelector("[data-view]")?.setAttribute("transform", "");
    clone.setAttribute("width", "100%");
    clone.setAttribute("height", "100%");
    const html = clone.outerHTML.replace(/var\((--[a-z0-9-]+)\)/g, (_, v: string) => {
      const val = (cs.getPropertyValue(v) || body.getPropertyValue(v)).trim();
      if (val) return val;
      return v === "--font-mono" ? "ui-monospace, monospace" : "#1f1b16";
    });
    const doc = `<!DOCTYPE html><html lang="th"><head><meta charset="utf-8"><title>${title ?? "แบบแปลน"}</title><style>html,body{margin:0;height:100%;background:#fdfbf7;font-family:${body.fontFamily}}svg{display:block}</style></head><body>${html}</body></html>`;
    const url = URL.createObjectURL(new Blob([doc], { type: "text/html" }));
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const r = 0.17 * s;
  const fs = 0.26 * s;
  const tick = 0.12 * s;
  const legendCats = [...new Set(visible.map((m) => m.category))];
  const legendRuns = [...new Set(runs.map((q) => q.system))];
  const dimTop = -1.0 * s;
  const dimTop2 = -1.6 * s;
  const bubTop = -2.55 * s;
  const dimLeft = -1.0 * s;
  const dimLeft2 = -1.6 * s;
  const bubLeft = -2.55 * s;

  return (
    <div className="relative overflow-hidden rounded-[10px] border border-line bg-card" style={{ height }}>
      <svg
        ref={svgRef}
        viewBox={`${ext.x0} ${ext.y0} ${ext.w} ${ext.h}`}
        className="size-full cursor-grab touch-none select-none active:cursor-grabbing"
        role="img"
        aria-label={title ?? "แบบแปลน"}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x={ext.x0} y={ext.y0} width={ext.w} height={ext.h} fill="var(--card)" />
        <g data-view transform={`translate(${view.tx} ${view.ty}) scale(${view.k})`}>
          {/* site boundary on the exterior view */}
          {floor === "ext" && (
            <rect x={-2} y={-2} width={W + 4.5} height={D + 4.5} fill="none" stroke="var(--text-3)" strokeWidth={0.03} strokeDasharray="0.4 0.15 0.08 0.15" />
          )}

          {/* grid lines and bubbles */}
          {floor !== "ext" && (
            <g>
              {gx.map((x, i) => (
                <g key={`gx${i}`}>
                  <line x1={x} x2={x} y1={bubTop + 0.3 * s} y2={D + 0.6 * s} stroke="var(--text-3)" strokeWidth={0.012 * s} strokeDasharray={`${0.25 * s} ${0.12 * s}`} />
                  <circle cx={x} cy={bubTop} r={0.3 * s} fill="var(--card)" stroke="var(--accent)" strokeWidth={0.025 * s} />
                  <text x={x} y={bubTop + 0.1 * s} textAnchor="middle" fontSize={0.28 * s} fill="var(--accent-text)">
                    {i + 1}
                  </text>
                </g>
              ))}
              {gz.map((z, i) => (
                <g key={`gz${i}`}>
                  <line y1={Y(z)} y2={Y(z)} x1={bubLeft + 0.3 * s} x2={W + 0.6 * s} stroke="var(--text-3)" strokeWidth={0.012 * s} strokeDasharray={`${0.25 * s} ${0.12 * s}`} />
                  <circle cx={bubLeft} cy={Y(z)} r={0.3 * s} fill="var(--card)" stroke="var(--accent)" strokeWidth={0.025 * s} />
                  <text x={bubLeft} y={Y(z) + 0.1 * s} textAnchor="middle" fontSize={0.28 * s} fill="var(--accent-text)">
                    {LETTERS[i] ?? i + 1}
                  </text>
                </g>
              ))}
              {/* dimension strings */}
              <g stroke="var(--text-2)" strokeWidth={0.014 * s} fill="none">
                <line x1={0} x2={W} y1={dimTop2} y2={dimTop2} />
                <line x1={gx[0]} x2={gx[gx.length - 1]} y1={dimTop} y2={dimTop} />
                <line y1={Y(0)} y2={Y(D)} x1={dimLeft2} x2={dimLeft2} />
                <line y1={Y(gz[0])} y2={Y(gz[gz.length - 1])} x1={dimLeft} x2={dimLeft} />
                {[0, W].map((x) => (
                  <line key={`t2${x}`} x1={x - tick} x2={x + tick} y1={dimTop2 + tick} y2={dimTop2 - tick} />
                ))}
                {gx.map((x, i) => (
                  <line key={`t${i}`} x1={x - tick} x2={x + tick} y1={dimTop + tick} y2={dimTop - tick} />
                ))}
                {[0, D].map((z) => (
                  <line key={`l2${z}`} x1={dimLeft2 - tick} x2={dimLeft2 + tick} y1={Y(z) + tick} y2={Y(z) - tick} />
                ))}
                {gz.map((z, i) => (
                  <line key={`l${i}`} x1={dimLeft - tick} x2={dimLeft + tick} y1={Y(z) + tick} y2={Y(z) - tick} />
                ))}
              </g>
              <g fontSize={0.2 * s} fill="var(--text-2)" fontFamily="var(--font-mono)">
                <text x={W / 2} y={dimTop2 - 0.08 * s} textAnchor="middle">
                  {fmt(W)}
                </text>
                {gx.slice(1).map((x, i) =>
                  x - gx[i] > 0.6 * s ? (
                    <text key={`dx${i}`} x={(x + gx[i]) / 2} y={dimTop - 0.08 * s} textAnchor="middle">
                      {fmt(x - gx[i])}
                    </text>
                  ) : null,
                )}
                <text x={dimLeft2 - 0.08 * s} y={Y(D / 2)} textAnchor="middle" transform={`rotate(-90 ${dimLeft2 - 0.08 * s} ${Y(D / 2)})`}>
                  {fmt(D)}
                </text>
                {gz.slice(1).map((z, i) =>
                  z - gz[i] > 0.6 * s ? (
                    <text key={`dz${i}`} x={dimLeft - 0.08 * s} y={Y((z + gz[i]) / 2)} textAnchor="middle" transform={`rotate(-90 ${dimLeft - 0.08 * s} ${Y((z + gz[i]) / 2)})`}>
                      {fmt(z - gz[i])}
                    </text>
                  ) : null,
                )}
              </g>
            </g>
          )}

          {/* rooms */}
          <g opacity={floor === "ext" ? 0.45 : 1}>
            {rooms.map((rm) => (
              <rect
                key={rm.id}
                x={rm.x0}
                y={Y(rm.z1)}
                width={rm.x1 - rm.x0}
                height={rm.z1 - rm.z0}
                fill={rm.id === selRoom ? "var(--raised)" : rm.kind === "bath" ? "var(--page)" : "var(--card)"}
              />
            ))}
            {/* walls: exterior thick, interior thin, gaps are left by the model */}
            {walls.map((e) => (
              <rect key={e.id} x={e.pos[0] - e.size[0] / 2} y={Y(e.pos[2]) - e.size[2] / 2} width={e.size[0]} height={e.size[2]} fill="var(--text)" />
            ))}
            {glass.map((e) => {
              const horiz = e.size[0] >= e.size[2];
              const w = horiz ? e.size[0] : 0.2;
              const h = horiz ? 0.2 : e.size[2];
              const x = e.pos[0] - w / 2;
              const y = Y(e.pos[2]) - h / 2;
              return (
                <g key={e.id}>
                  <rect x={x} y={y} width={w} height={h} fill="var(--card)" stroke="var(--text)" strokeWidth={0.02} />
                  {horiz ? (
                    <line x1={x} x2={x + w} y1={y + h / 2} y2={y + h / 2} stroke="var(--text)" strokeWidth={0.015} />
                  ) : (
                    <line y1={y} y2={y + h} x1={x + w / 2} x2={x + w / 2} stroke="var(--text)" strokeWidth={0.015} />
                  )}
                </g>
              );
            })}
            {doors.map((a) => {
              const horiz = a.size[0] >= a.size[2];
              const w = horiz ? a.size[0] : a.size[2];
              const leaves = w > 1.2 ? 2 : 1;
              const lw = w / leaves;
              const cxp = a.pos[0];
              const cyp = Y(a.pos[2]);
              const paths: string[] = [];
              for (let i = 0; i < leaves; i++) {
                if (horiz) {
                  const hx = i === 0 ? cxp - w / 2 : cxp + w / 2;
                  const dir = i === 0 ? 1 : -1;
                  paths.push(`M ${hx} ${cyp} L ${hx} ${cyp - lw} A ${lw} ${lw} 0 0 ${dir > 0 ? 1 : 0} ${hx + dir * lw} ${cyp}`);
                } else {
                  const hy = i === 0 ? cyp + w / 2 : cyp - w / 2;
                  const dir = i === 0 ? -1 : 1;
                  paths.push(`M ${cxp} ${hy} L ${cxp + lw} ${hy} A ${lw} ${lw} 0 0 ${dir > 0 ? 1 : 0} ${cxp} ${hy + dir * lw}`);
                }
              }
              return <path key={a.code} d={paths.join(" ")} fill="none" stroke="var(--text-2)" strokeWidth={0.018} />;
            })}
            {/* room labels */}
            {floor !== "ext" &&
              rooms.map((rm) => {
                const w = rm.x1 - rm.x0;
                const h = rm.z1 - rm.z0;
                const cxp = (rm.x0 + rm.x1) / 2;
                const cyp = Y((rm.z0 + rm.z1) / 2);
                const showName = w >= 1.6 * s && h >= 1.1 * s;
                const f = Math.min(fs, w / Math.max(6, rm.name.length * 0.9));
                return (
                  <g key={`lb${rm.id}`} pointerEvents="none">
                    {showName && (
                      <text x={cxp} y={cyp - 0.06 * s} textAnchor="middle" fontSize={Math.max(0.16, f)} fill="var(--text)">
                        {rm.name}
                      </text>
                    )}
                    <text x={cxp} y={cyp + (showName ? 0.26 : 0.08) * s} textAnchor="middle" fontSize={0.17 * s} fill="var(--text-3)" fontFamily="var(--font-mono)">
                      {rm.id}
                      {showName ? ` · ${(w * h).toFixed(1)} ม²` : ""}
                    </text>
                  </g>
                );
              })}
          </g>

          {/* system lines */}
          {runs.map((run) => {
            const st = RUN_STYLE[run.system];
            const pts: [number, number][] = [];
            for (const p of run.points) {
              const q: [number, number] = [p[0], Y(p[2])];
              const last = pts[pts.length - 1];
              if (!last || Math.abs(last[0] - q[0]) > 1e-3 || Math.abs(last[1] - q[1]) > 1e-3) pts.push(q);
            }
            if (pts.length < 2) return null;
            const onSel = !!sel?.circuit && run.circuit === sel.circuit;
            return (
              <polyline
                key={run.id}
                points={pts.map((p) => p.join(",")).join(" ")}
                fill="none"
                stroke={onSel ? "var(--text)" : st.stroke}
                strokeWidth={onSel ? st.w * 2.2 : st.w}
                strokeDasharray={st.dash}
                strokeLinejoin="round"
                opacity={sel?.circuit && !onSel && run.system === "elec" ? 0.45 : 0.9}
                pointerEvents="none"
              />
            );
          })}

          {/* equipment markers */}
          {visible.map((m) => {
            const bad = m.state === "fault" || m.state === "service";
            const watch = m.state === "watch";
            const isSel = m.code === selected;
            if (m.category === "เบรกเกอร์ลูกย่อย" && !bad && !watch && !isSel) return null;
            let x = m.pos[0];
            let y = Y(m.pos[2]);
            if (m.category === "พื้น/กระเบื้อง") {
              const rm = model.rooms.find((q) => q.id === m.room);
              if (rm) {
                x = rm.x0 + 0.4 * s;
                y = Y(rm.z1) + 0.4 * s;
              }
            }
            if (m.category === "หลังคา/กันซึม") x += (m.code.endsWith("2") ? 1 : -1) * 0.8 * s;
            if (m.category === "เบรกเกอร์ลูกย่อย") x += 0.55 * s;
            const stroke = bad ? "var(--accent)" : watch ? "var(--warn)" : isSel ? "var(--text)" : "var(--text-2)";
            const fill = bad ? "var(--accent-soft)" : watch ? "var(--warn-soft)" : "var(--card)";
            const label = isSel || bad || watch;
            return (
              <g key={m.code} className="cursor-pointer" onClick={() => clickMarker(m.code)}>
                <title>{`${m.code}${m.name ? ` ${m.name}` : ""}`}</title>
                {isSel && <circle cx={x} cy={y} r={r * 2.6} fill="none" stroke="var(--text)" strokeWidth={0.035 * s} />}
                {isSel && <circle cx={x} cy={y} r={r * 3.4} fill="none" stroke="var(--text)" strokeWidth={0.012 * s} strokeDasharray={`${0.08 * s} ${0.06 * s}`} />}
                <circle cx={x} cy={y} r={r * 1.8} fill="transparent" />
                <MarkerSymbol cat={m.category} x={x} y={y} r={r} stroke={stroke} fill={fill} sw={0.03 * s} horizontal={m.size[0] >= m.size[2]} code={m.code} />
                {label && (
                  <g pointerEvents="none">
                    <rect x={x + r * 2} y={y - 0.2 * s} width={m.code.length * 0.15 * s + 0.16 * s} height={0.32 * s} rx={0.05 * s} fill={isSel ? "var(--text)" : "var(--card)"} stroke={stroke} strokeWidth={0.015 * s} />
                    <text x={x + r * 2 + 0.08 * s} y={y + 0.05 * s} fontSize={0.21 * s} fill={isSel ? "var(--card)" : bad ? "var(--accent-text)" : "var(--text)"} fontFamily="var(--font-mono)">
                      {m.code}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* north arrow */}
          <g transform={`translate(${W + 1.3 * s} ${-2.4 * s})`} pointerEvents="none">
            <circle r={0.42 * s} fill="none" stroke="var(--text)" strokeWidth={0.025 * s} />
            <path d={`M 0 ${-0.38 * s} L ${0.17 * s} ${0.3 * s} L 0 ${0.16 * s} L ${-0.17 * s} ${0.3 * s} Z`} fill="var(--text)" />
            <text y={-0.55 * s} textAnchor="middle" fontSize={0.26 * s} fill="var(--text)">
              N
            </text>
          </g>
          {floor === "ext" && (
            <text x={W / 2} y={D + 1.4 * s} textAnchor="middle" fontSize={0.28 * s} fill="var(--text-3)">
              ด้านถนน
            </text>
          )}
        </g>
      </svg>

      {/* controls */}
      <div className="absolute right-3 top-3 flex flex-col gap-1">
        <CtrlButton label="ขยาย" onClick={() => zoomAt(1.3)}>
          <Plus size={16} strokeWidth={1.5} />
        </CtrlButton>
        <CtrlButton label="ย่อ" onClick={() => zoomAt(1 / 1.3)}>
          <Minus size={16} strokeWidth={1.5} />
        </CtrlButton>
        <CtrlButton label="พอดีหน้าจอ" onClick={() => setView({ k: 1, tx: 0, ty: 0 })}>
          <Maximize size={16} strokeWidth={1.5} />
        </CtrlButton>
        <CtrlButton label="เปิดในแท็บใหม่" onClick={() => openInTab()}>
          <ExternalLink size={16} strokeWidth={1.5} />
        </CtrlButton>
      </div>

      {legend && (legendCats.length > 0 || legendRuns.length > 0) && (
        <div className="pointer-events-none absolute bottom-3 left-3 flex max-w-[60%] flex-wrap gap-x-3 gap-y-1 rounded-[8px] border border-line bg-card/95 px-3 py-2 text-[12px] text-ink-2">
          {legendRuns.map((k) => (
            <span key={k} className="flex items-center gap-1.5">
              <svg viewBox="0 0 16 4" className="h-1 w-4" aria-hidden>
                <line x1={0} x2={16} y1={2} y2={2} stroke={RUN_STYLE[k].stroke} strokeWidth={2} strokeDasharray={RUN_STYLE[k].dash ? "4 2" : undefined} />
              </svg>
              {RUN_STYLE[k].label}
            </span>
          ))}
          {legendCats.map((c) => (
            <span key={c} className="flex items-center gap-1.5">
              <SymbolSwatch cat={c} />
              {c}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function CtrlButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-[8px] border border-line-strong bg-card text-ink-2 transition-colors duration-150 hover:bg-raised hover:text-ink"
    >
      {children}
    </button>
  );
}

/** Floor tabs: ชั้น 1..N with counts and a dot when something on that floor needs attention, plus the site */
export function FloorTabs({
  floors,
  value,
  onChange,
  counts,
  problems,
}: {
  floors: number;
  value: PlanFloor;
  onChange: (f: PlanFloor) => void;
  counts?: Partial<Record<string, number>>;
  problems?: Set<string>;
}) {
  const tabs: { key: PlanFloor; label: string }[] = [...Array.from({ length: floors }, (_, i) => ({ key: i + 1, label: `ชั้น ${i + 1}` })), { key: "ext", label: "ภายนอกอาคาร" }];
  return (
    <div role="tablist" className="flex flex-wrap items-center gap-0.5 rounded-[10px] bg-raised p-0.5 text-[13px]">
      {tabs.map((t) => {
        const on = value === t.key;
        const n = counts?.[String(t.key)];
        return (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={on}
            onClick={() => onChange(t.key)}
            className={cx("flex h-7 items-center gap-1.5 rounded-[8px] px-2.5 transition-colors duration-150", on ? "bg-card text-ink shadow-[0_1px_2px_rgba(0,0,0,0.06)]" : "text-ink-2 hover:text-ink")}
          >
            {t.label}
            {n !== undefined && <span className="num font-mono text-[11px] text-ink-3">{n}</span>}
            {problems?.has(String(t.key)) && <span aria-label="มีปัญหา" className="size-1.5 rounded-full bg-accent" />}
          </button>
        );
      })}
    </div>
  );
}

/** Small segmented control used for the discipline toggle */
export function Segmented<T extends string>({ options, value, onChange }: { options: { key: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex items-center gap-0.5 rounded-[10px] bg-raised p-0.5 text-[13px]">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={value === o.key}
          onClick={() => onChange(o.key)}
          className={cx("h-7 rounded-[8px] px-2.5 transition-colors duration-150", value === o.key ? "bg-card text-ink shadow-[0_1px_2px_rgba(0,0,0,0.06)]" : "text-ink-2 hover:text-ink")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
