"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  ChevronsLeftRight,
  Columns2,
  Flame,
  Focus,
  Gauge,
  GitCompareArrows,
  House,
  Layers,
  Layers2,
  Maximize,
  Minimize,
  Moon,
  PanelLeftOpen,
  Rows3,
  ScanEye,
  Sun,
  Video,
} from "lucide-react";
import { Keycap, cx } from "@/components/ui";
import { getModel, assetOf, roomOf, type Vec3 } from "@/lib/house";
import { type Project, type Repair } from "@/lib/data";
import { ALL_SYSTEMS, heatValues, scheduleFor, siteStats, type HeatMetric, type SysKey } from "@/lib/viewer-data";
import { CamSync, type CamPreset, type CamRequest, type Display, type Layers as LayerState, type Look, type Mode, type Selection } from "./scene";
import { ComparePanel, HeatPanel, ModelTree, RealPanel, SelectionCard, XrayPanel } from "./panels";
import { Timeline } from "./timeline";

const Scene = dynamic(() => import("./scene").then((m) => m.Scene), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-raised" />,
});

export type CompareView = "overlay" | "split" | "slider" | "state";

export const MODES: { key: Mode; label: string; icon: typeof House }[] = [
  { key: "real", label: "สมจริง", icon: House },
  { key: "xray", label: "X-Ray", icon: ScanEye },
  { key: "compare", label: "เปรียบเทียบ", icon: Columns2 },
  { key: "heat", label: "Heatmap", icon: Flame },
];

const VIEWS: { key: CompareView; label: string; icon: typeof House }[] = [
  { key: "overlay", label: "ซ้อนทับ", icon: Layers2 },
  { key: "split", label: "แบ่งจอ", icon: Columns2 },
  { key: "slider", label: "สไลด์เทียบ", icon: ChevronsLeftRight },
  { key: "state", label: "แผน vs จริง", icon: GitCompareArrows },
];

const PRESETS: { key: CamPreset; label: string }[] = [
  { key: "iso", label: "มุมสามมิติ" },
  { key: "front", label: "ด้านหน้า" },
  { key: "back", label: "ด้านหลัง" },
  { key: "left", label: "ด้านซ้าย" },
  { key: "right", label: "ด้านขวา" },
  { key: "top", label: "มุมบน" },
];

const ORBIT = [
  { label: "ช้า", damping: 0.04, rotate: 0.45 },
  { label: "ปกติ", damping: 0.08, rotate: 0.8 },
  { label: "เร็ว", damping: 0.16, rotate: 1.3 },
];

const ALL_LAYERS: LayerState = { elec: true, water: true, drain: true, hvac: true };

export function HouseViewer({
  project,
  repairs,
  initialMode = "real",
  initialView = "overlay",
  variant = "embed",
  className,
}: {
  project: Project;
  repairs: Repair[];
  initialMode?: Mode;
  initialView?: CompareView;
  variant?: "embed" | "full";
  className?: string;
}) {
  const model = useMemo(() => getModel(project.modelCode), [project.modelCode]);
  const sched = useMemo(() => scheduleFor(project, model.elements), [project, model]);
  const delivered = project.status === "delivered";

  const [mode, setMode] = useState<Mode>(initialMode);
  const [view, setView] = useState<CompareView>(initialView);
  const [t, setT] = useState(sched.today);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [selection, setSelection] = useState<Selection>(null);
  const [circuit, setCircuit] = useState<string | null>(null);
  const [layers, setLayers] = useState<LayerState>(ALL_LAYERS);
  const [floor, setFloor] = useState<number | null>(null);
  const [explode, setExplode] = useState(false);
  const [systems, setSystems] = useState<Record<SysKey, boolean>>(ALL_SYSTEMS);
  const [display, setDisplay] = useState<Display>({ furniture: true, ceiling: false, site: true, labels: false });
  const [metric, setMetric] = useState<HeatMetric>("score");
  const [evening, setEvening] = useState(false);
  const [orbit, setOrbit] = useState(1);
  const [cam, setCam] = useState<CamRequest>({ seq: 0 });
  const [camMenu, setCamMenu] = useState(false);
  const [leftOpen, setLeftOpen] = useState(variant === "full");
  const [rightOpen, setRightOpen] = useState(true);
  const [slider, setSlider] = useState(50);
  const [full, setFull] = useState(false);
  const [sync] = useState(() => new CamSync());

  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvases = useRef<Record<string, HTMLCanvasElement | null>>({});
  const onMain = useCallback((c: HTMLCanvasElement | null) => void (canvases.current.main = c), []);
  const onA = useCallback((c: HTMLCanvasElement | null) => void (canvases.current.a = c), []);
  const onB = useCallback((c: HTMLCanvasElement | null) => void (canvases.current.b = c), []);

  const pins = useMemo(() => repairs.filter((r) => r.status !== "closed").map((r) => r.asset).filter((c) => assetOf(model, c)?.render), [repairs, model]);
  const heat = useMemo(() => heatValues(model, metric, sched, repairs, delivered), [model, metric, sched, repairs, delivered]);
  const stats = useMemo(() => siteStats(model, t, sched), [model, t, sched]);

  // ---------- camera helpers ----------
  const gap = explode ? model.FH * 0.75 : 0;
  const offAt = useCallback((f: number) => (f <= 0 ? 0 : Math.min(f, model.floors + 1) - 1) * gap, [gap, model.floors]);

  const focusOf = useCallback(
    (s: Selection): { target: Vec3; dist: number; floor: number } | null => {
      if (!s) return null;
      if (s.type === "asset") {
        const a = assetOf(model, s.code);
        if (!a) return null;
        return { target: [a.pos[0], a.pos[1] + offAt(a.floor), a.pos[2]], dist: 5, floor: a.floor };
      }
      if (s.type === "element") {
        const e = model.elements.find((x) => x.id === s.id);
        if (!e) return null;
        return { target: [e.pos[0], e.pos[1] + offAt(e.floor), e.pos[2]], dist: Math.max(...e.size) * 1.4 + 4, floor: e.floor };
      }
      const r = roomOf(model, s.id);
      if (!r) return null;
      return { target: [(r.x0 + r.x1) / 2, (r.floor - 1) * model.FH + 1.2 + offAt(r.floor), (r.z0 + r.z1) / 2], dist: Math.max(r.x1 - r.x0, r.z1 - r.z0) * 1.3 + 5, floor: r.floor };
    },
    [model, offAt],
  );

  const focus = useCallback(() => {
    const f = focusOf(selection);
    setCam((c) => (f ? { seq: c.seq + 1, focus: { target: f.target, dist: f.dist } } : { seq: c.seq + 1, preset: "iso" }));
  }, [focusOf, selection]);

  const pickAndFocus = useCallback(
    (s: NonNullable<Selection>) => {
      setSelection(s);
      const f = focusOf(s);
      if (!f) return;
      if (floor !== null && f.floor >= 1 && f.floor <= model.floors && f.floor !== floor) setFloor(f.floor);
      setCam((c) => ({ seq: c.seq + 1, focus: { target: f.target, dist: f.dist } }));
    },
    [focusOf, floor, model.floors],
  );

  const preset = (p: CamPreset) => {
    setCam((c) => ({ seq: c.seq + 1, preset: p }));
    setCamMenu(false);
  };

  // ---------- keyboard ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const i = Number(e.key);
      if (i >= 1 && i <= 4) setMode(MODES[i - 1].key);
      const k = e.key.toLowerCase();
      if (k === "l") setFloor((f) => (f === null ? 1 : f >= model.floors ? null : f + 1));
      if (k === "e") setExplode((v) => !v);
      if (k === "f") focus();
      if (e.key === "Escape") {
        setCamMenu(false);
        if (selection || circuit) {
          setSelection(null);
          setCircuit(null);
        } else setFloor(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [model.floors, focus, selection, circuit]);

  // ---------- playback ----------
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setT((v) => {
        const nv = Math.min(1, v + 0.004 * speed);
        if (nv >= 1) setPlaying(false);
        return nv;
      });
    }, 80);
    return () => window.clearInterval(id);
  }, [playing, speed]);

  // ---------- fullscreen ----------
  useEffect(() => {
    const on = () => setFull(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current?.requestFullscreen?.();
  };

  // ---------- screenshot ----------
  const shoot = () => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const out = document.createElement("canvas");
    out.width = Math.round(rect.width * dpr);
    out.height = Math.round(rect.height * dpr);
    const ctx = out.getContext("2d");
    if (!ctx) return;
    const order = mode === "compare" && (view === "split" || view === "slider") ? ["b", "a"] : ["main"];
    for (const slot of order) {
      const c = canvases.current[slot];
      if (!c) continue;
      const r = c.getBoundingClientRect();
      ctx.save();
      if (slot === "a" && view === "slider") {
        ctx.beginPath();
        ctx.rect(0, 0, (rect.width * slider * dpr) / 100, out.height);
        ctx.clip();
      }
      ctx.drawImage(c, (r.left - rect.left) * dpr, (r.top - rect.top) * dpr, r.width * dpr, r.height * dpr);
      ctx.restore();
    }
    const a = document.createElement("a");
    a.href = out.toDataURL("image/png");
    a.download = `${project.id}-${project.modelCode}-${mode}.png`;
    a.click();
  };

  // ---------- slider drag ----------
  const dragSlider = (e: React.PointerEvent<HTMLDivElement>) => {
    const stage = stageRef.current;
    if (!stage) return;
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const r = stage.getBoundingClientRect();
      setSlider(Math.max(4, Math.min(96, ((ev.clientX - r.left) / r.width) * 100)));
    };
    const up = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
  };

  const togglePlay = () => {
    if (t >= 1) setT(0);
    setPlaying((v) => !v);
  };

  const mainLook: Look = mode === "compare" ? (view === "state" ? "state" : "overlay") : mode;
  const common = {
    model,
    today: sched.today,
    lag: sched.lag,
    selection,
    onSelect: setSelection,
    circuit,
    layers,
    pins,
    floor,
    explode,
    systems,
    display,
    heat,
    evening,
    orbit: ORBIT[orbit],
    cam,
    sync,
  };
  const twoUp = mode === "compare" && (view === "split" || view === "slider");
  const unbuilt = stats.total - stats.built;

  const chip = "pointer-events-auto rounded-[12px] border border-line bg-card/95 shadow-[0_1px_2px_rgba(0,0,0,0.06)]";
  const tool = "flex h-8 items-center gap-1.5 rounded-[8px] px-2 text-[13px] text-ink-2 transition-colors duration-150 hover:bg-raised hover:text-ink";

  return (
    <div ref={rootRef} className={cx("flex overflow-hidden rounded-[14px] border border-line bg-page", full ? "h-screen rounded-none" : (className ?? "h-[calc(100vh-168px)] min-h-[620px]"))}>
      {leftOpen && (
        <ModelTree
          model={model}
          floor={floor}
          onFloor={setFloor}
          selection={selection}
          onPick={pickAndFocus}
          systems={systems}
          onSystems={setSystems}
          display={display}
          onDisplay={setDisplay}
          onClose={() => setLeftOpen(false)}
        />
      )}

      <div className="relative flex min-w-0 flex-1 flex-col">
        <div ref={stageRef} className="relative min-h-0 flex-1 overflow-hidden bg-raised">
          {/* canvases */}
          {!twoUp && (
            <div className="absolute inset-0">
              <Scene key="main" {...common} look={mainLook} t={mode === "compare" ? t : 1} onCanvas={onMain} />
            </div>
          )}
          {twoUp && view === "split" && (
            <div className="absolute inset-0 grid grid-cols-2 gap-px bg-line-strong">
              <div className="relative min-w-0">
                <Scene key="a" {...common} look="real" t={1} onCanvas={onA} />
              </div>
              <div className="relative min-w-0">
                <Scene key="b" {...common} look="actual" t={t} onCanvas={onB} />
              </div>
            </div>
          )}
          {twoUp && view === "slider" && (
            <>
              <div className="absolute inset-0">
                <Scene key="b" {...common} look="actual" t={t} onCanvas={onB} />
              </div>
              <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - slider}% 0 0)` }}>
                <Scene key="a" {...common} look="real" t={1} onCanvas={onA} />
              </div>
              <div className="pointer-events-none absolute inset-y-0 w-px bg-card" style={{ left: `${slider}%` }} />
              <div
                role="slider"
                aria-label="เลื่อนเส้นแบ่ง แบบ / หน้างาน"
                aria-valuenow={Math.round(slider)}
                aria-valuemin={0}
                aria-valuemax={100}
                tabIndex={0}
                onPointerDown={dragSlider}
                onKeyDown={(e) => {
                  if (e.key === "ArrowLeft") setSlider((v) => Math.max(4, v - 4));
                  if (e.key === "ArrowRight") setSlider((v) => Math.min(96, v + 4));
                }}
                className="absolute top-1/2 flex size-10 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none items-center justify-center rounded-full border border-line-strong bg-card text-ink shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
                style={{ left: `${slider}%` }}
              >
                <ChevronsLeftRight size={16} strokeWidth={1.5} />
              </div>
            </>
          )}
          {twoUp && (
            <>
              <span className="pointer-events-none absolute bottom-3 left-16 flex items-center gap-1.5 rounded-[8px] bg-ink/85 px-2.5 py-1 text-[12px] text-card">
                <House size={16} strokeWidth={1.5} /> แบบที่ออกแบบ 100%
              </span>
              <span className={cx("pointer-events-none absolute bottom-3 right-6 flex items-center gap-1.5 rounded-[8px] bg-ink/85 px-2.5 py-1 text-[12px] text-card")}>
                <Columns2 size={16} strokeWidth={1.5} /> หน้างานจริง · <span className="num">{stats.actual.toFixed(1)}%</span>
              </span>
            </>
          )}

          {/* overlays */}
          <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-col items-start gap-2">
            <div className={cx(chip, "flex items-center gap-0.5 p-1")} role="tablist" aria-label="โหมดการแสดงผล">
              {MODES.map((m, i) => {
                const Icon = m.icon;
                const on = mode === m.key;
                return (
                  <button
                    key={m.key}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => setMode(m.key)}
                    className={cx("flex h-8 items-center gap-2 rounded-[8px] px-2.5 text-[13px] transition-colors duration-150", on ? "bg-ink text-card" : "text-ink-2 hover:bg-raised hover:text-ink")}
                  >
                    <Icon size={16} strokeWidth={1.5} />
                    <span className="whitespace-nowrap">{m.label}</span>
                    <span className={cx("font-mono text-[11px]", on ? "text-card/60" : "text-ink-3")}>{i + 1}</span>
                  </button>
                );
              })}
            </div>
            {mode === "compare" && (
              <div className={cx(chip, "flex flex-wrap items-center justify-center gap-0.5 p-1")}>
                {VIEWS.map((v) => {
                  const Icon = v.icon;
                  return (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => setView(v.key)}
                      aria-pressed={view === v.key}
                      className={cx("flex h-7 items-center gap-1.5 rounded-[7px] px-2.5 text-[13px] transition-colors duration-150", view === v.key ? "bg-raised text-ink" : "text-ink-2 hover:text-ink")}
                    >
                      <Icon size={16} strokeWidth={1.5} />
                      {v.label}
                    </button>
                  );
                })}
                <span className="mx-1 h-5 w-px bg-line-strong" />
                <span className="flex items-center gap-1.5 px-2 text-[12px] text-ink-2">
                  {view === "overlay" && (
                    <>
                      <span className="size-2.5 rounded-[3px] border border-[#7d93ab] bg-[#7d93ab]/40" /> ส่วนที่ยังไม่สร้าง (ตามแบบ) <span className="num font-mono text-ink">{unbuilt.toLocaleString("th-TH")}</span>
                    </>
                  )}
                  {(view === "split" || view === "slider") && <>ซ้าย = แบบ 100% · ขวา = หน้างานจริง</>}
                  {view === "state" && (
                    <>
                      <span className="size-2.5 rounded-[3px] border border-line-strong bg-[#e6dfd4]" /> สร้างแล้ว
                      <span className="ml-2 size-2.5 rounded-[3px] bg-accent" /> ช้ากว่าแผน <span className="num font-mono text-ink">{stats.late}</span>
                      <span className="ml-2 size-2.5 rounded-[3px] border border-ink-3" /> ยังไม่ถึงกำหนด
                    </>
                  )}
                </span>
              </div>
            )}
            {mode === "real" && !delivered && (
              <div className={cx(chip, "flex items-center gap-2 py-1 pl-3 pr-1 text-[13px]")}>
                <House size={16} strokeWidth={1.5} className="text-ink-3" />
                แบบที่ออกแบบ (100%)
                <button type="button" onClick={() => setMode("compare")} className="h-7 rounded-[8px] border border-line-strong bg-card px-2.5 text-[13px] text-ink transition-colors duration-150 hover:bg-raised">
                  ดูหน้างานจริง
                </button>
              </div>
            )}
          </div>

          {/* tools */}
          <div className="flex items-start gap-2">
            <div className={cx(chip, "relative flex items-center gap-0.5 p-1")}>
              <button type="button" onClick={() => setCamMenu((v) => !v)} className={tool} aria-expanded={camMenu} aria-haspopup="menu">
                <Video size={16} strokeWidth={1.5} /> มุมมอง
              </button>
              <button type="button" onClick={() => setEvening((v) => !v)} className={tool} title={evening ? "แสงกลางวัน" : "แสงยามเย็น"} aria-label={evening ? "แสงกลางวัน" : "แสงยามเย็น"}>
                {evening ? <Moon size={16} strokeWidth={1.5} /> : <Sun size={16} strokeWidth={1.5} />}
              </button>
              <button type="button" onClick={() => setOrbit((v) => (v + 1) % ORBIT.length)} className={tool} title="ความเร็วการหมุนกล้อง">
                <Gauge size={16} strokeWidth={1.5} /> {ORBIT[orbit].label}
              </button>
              <span className="mx-0.5 h-5 w-px bg-line-strong" />
              <button type="button" onClick={focus} className={tool} title="โฟกัสสิ่งที่เลือก (F)" aria-label="โฟกัสสิ่งที่เลือก">
                <Focus size={16} strokeWidth={1.5} />
              </button>
              <button type="button" onClick={shoot} className={tool} title="บันทึกภาพหน้าจอ" aria-label="บันทึกภาพหน้าจอ">
                <Camera size={16} strokeWidth={1.5} />
              </button>
              <button type="button" onClick={toggleFull} className={tool} title={full ? "ออกจากเต็มจอ" : "เต็มจอ"} aria-label={full ? "ออกจากเต็มจอ" : "เต็มจอ"}>
                {full ? <Minimize size={16} strokeWidth={1.5} /> : <Maximize size={16} strokeWidth={1.5} />}
              </button>
              {camMenu && (
                <div role="menu" className="absolute left-0 top-[calc(100%+6px)] z-10 w-44 rounded-[10px] border border-line bg-card p-1 shadow-[0_4px_16px_rgba(31,27,22,0.08)]">
                  {PRESETS.map((p) => (
                    <button key={p.key} role="menuitem" type="button" onClick={() => preset(p.key)} className="flex h-8 w-full items-center rounded-[6px] px-2.5 text-left text-[13px] transition-colors duration-150 hover:bg-raised">
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          </div>

          {/* floor rail */}
          <div className="pointer-events-none absolute bottom-14 left-3 top-[132px] flex flex-col justify-end gap-2">
            {!leftOpen && (
              <button type="button" onClick={() => setLeftOpen(true)} className={cx(chip, "flex size-10 items-center justify-center text-ink-2 transition-colors duration-150 hover:text-ink")} aria-label="แสดงแผงโครงสร้างโมเดล" title="โครงสร้างโมเดล">
                <PanelLeftOpen size={16} strokeWidth={1.5} />
              </button>
            )}
            <div className={cx(chip, "flex w-10 flex-col items-center gap-0.5 p-1")} aria-label="เลือกชั้น">
              <Layers size={16} strokeWidth={1.5} className="my-1.5 text-ink-3" />
              <div className="flex max-h-[40vh] flex-col gap-0.5 overflow-y-auto">
                {Array.from({ length: model.floors }, (_, i) => model.floors - i).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFloor(floor === f ? null : f)}
                    aria-pressed={floor === f}
                    title={`แสดงเฉพาะชั้น ${f}`}
                    className={cx("flex h-8 w-8 items-center justify-center rounded-[8px] font-mono text-[13px] transition-colors duration-150", floor === f ? "bg-ink text-card" : "text-ink-2 hover:bg-raised")}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setFloor(null)}
                aria-pressed={floor === null}
                className={cx("flex h-8 w-8 items-center justify-center rounded-[8px] text-[11px] transition-colors duration-150", floor === null ? "bg-ink text-card" : "text-ink-2 hover:bg-raised")}
              >
                ทั้งหมด
              </button>
              <span className="my-1 h-px w-6 bg-line-strong" />
              <button
                type="button"
                onClick={() => setExplode((v) => !v)}
                aria-pressed={explode}
                title="แยกชั้น (E)"
                aria-label="แยกชั้น"
                className={cx("flex h-8 w-8 items-center justify-center rounded-[8px] transition-colors duration-150", explode ? "bg-accent-soft text-accent-text" : "text-ink-2 hover:bg-raised")}
              >
                <Rows3 size={16} strokeWidth={1.5} />
              </button>
            </div>
          </div>

          <div className={cx("pointer-events-none absolute bottom-3 left-3 flex items-center gap-3 rounded-[8px] bg-card/90 px-2.5 py-1.5 text-[12px] text-ink-3", twoUp && "hidden")}>
            <span>ลากเพื่อหมุน · เลื่อนเพื่อซูม</span>
            <span className="flex items-center gap-1">
              <Keycap>L</Keycap> ชั้น
            </span>
            <span className="flex items-center gap-1">
              <Keycap>E</Keycap> แยกชั้น
            </span>
            <span className="flex items-center gap-1">
              <Keycap>Esc</Keycap> ยกเลิก
            </span>
          </div>

          <button
            type="button"
            onClick={() => setRightOpen((v) => !v)}
            className="absolute right-0 top-1/2 flex h-10 w-5 -translate-y-1/2 items-center justify-center rounded-l-[8px] border border-r-0 border-line bg-card/95 text-ink-3 transition-colors duration-150 hover:text-ink"
            aria-label={rightOpen ? "ซ่อนแผงข้อมูล" : "แสดงแผงข้อมูล"}
          >
            {rightOpen ? <ChevronRight size={16} strokeWidth={1.5} /> : <ChevronLeft size={16} strokeWidth={1.5} />}
          </button>
        </div>

        {mode === "compare" && (
          <Timeline
            t={t}
            onT={(v) => {
              setPlaying(false);
              setT(v);
            }}
            playing={playing}
            onPlay={togglePlay}
            speed={speed}
            onSpeed={setSpeed}
            sched={sched}
            start={project.start}
            finish={project.finish}
            elements={model.elements}
          />
        )}
      </div>

      {rightOpen && (
        <aside className="flex w-[340px] shrink-0 flex-col gap-3 overflow-y-auto border-l border-line bg-page p-3">
          {selection && <SelectionCard key={JSON.stringify(selection)} model={model} selection={selection} repairs={repairs} onClose={() => setSelection(null)} projectId={project.id} />}
          {mode === "real" && <RealPanel project={project} model={model} repairs={repairs} onCompare={() => setMode("compare")} onPick={pickAndFocus} />}
          {mode === "xray" && <XrayPanel model={model} layers={layers} onLayers={setLayers} circuit={circuit} onCircuit={setCircuit} />}
          {mode === "compare" && <ComparePanel model={model} t={t} sched={sched} stats={stats} />}
          {mode === "heat" && <HeatPanel model={model} metric={metric} onMetric={setMetric} values={heat} selection={selection} onPick={pickAndFocus} />}
        </aside>
      )}
    </div>
  );
}
