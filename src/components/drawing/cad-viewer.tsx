"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Box,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleQuestionMark,
  Circle,
  Copy,
  Crosshair,
  Download,
  DraftingCompass,
  Expand,
  Eye,
  FileText,
  Folder,
  FolderOpen,
  Hand,
  Hash,
  Info,
  Layers,
  LayoutGrid,
  List,
  Maximize,
  Minimize,
  Move,
  PenLine,
  Pentagon,
  Plus,
  Printer,
  Redo2,
  RotateCw,
  Ruler,
  Save,
  Scaling,
  ScanSearch,
  Scissors,
  Search,
  Share2,
  Slash,
  Spline,
  Square,
  Table,
  Type,
  Undo2,
  Wrench,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { AssetTag, cx } from "@/components/ui";
import { projects, thDate, TODAY } from "@/lib/data";
import { assetOf, roomOf } from "@/lib/house";
import {
  ACI_HEX,
  clearDrawingCache,
  DISCIPLINES,
  getDrawingSet,
  layerDef,
  pointInPoly,
  polyArea,
  polyPerimeter,
  primBBox,
  renderPrims,
  THEME,
  themeCss,
  type BBox,
  type Pt,
} from "@/lib/drawing";
import { describe, extents, modelLayout, pickPrim, placementAt, snapPoint, TYPE_NAME, type Pick, type Placement } from "./cad-model";
import { Col, LayerManager, LayerRow, Panel, PropHead, PropRow, RB, type LayerState } from "./cad-ui";
import { dwgName } from "./cad-library";
import { downloadDxf, downloadSetDxf, downloadSvg, fileBase, printSheets } from "./export";
import { SheetMarkup, useIsClient } from "./shared";
import { niceLength, useViewport } from "./use-viewport";

type Mode =
  | { k: "DIST"; pts: Pt[] }
  | { k: "AREA"; pts: Pt[]; room?: boolean }
  | { k: "ID" }
  | { k: "ZOOMW"; pts: Pt[] }
  | { k: "LIST" }
  | { k: "PAN" }
  | { k: "ZOOM?" }
  | null;

const TABS = ["หน้าแรก / Home", "Annotate", "View", "Output", "Insert", "Manage", "Collaborate"] as const;
const SCOPE = "cadc";
const I = { size: 16, strokeWidth: 1.5 } as const;
const IB = { size: 22, strokeWidth: 1.3 } as const;

const HELP = [
  "ZOOM (Z)    E = Extents · W = Window · IN · OUT · <factor>[X] · P = Previous",
  "PAN (P)     ลากเมาส์เพื่อเลื่อน · Esc/Enter ออก",
  "LAYER (LA)  LIST · ON|OFF|FREEZE|THAW|ISOLATE <ชื่อ|*> · UNISOLATE",
  "DIST (DI)   คลิกสองจุด (จับจุดปลายเมื่อเปิด OSNAP) หรือพิมพ์ x,y",
  "AREA (AA)   คลิกจุดมุมแล้วกด Enter · R = เลือกห้อง · O = เลือกวัตถุปิด",
  "ID          คลิกจุดเพื่ออ่านพิกัด",
  "LIST (LI)   แสดงข้อมูลวัตถุที่เลือก",
  "FIND <ข้อความ|รหัสอุปกรณ์>   ค้นหาและซูมไปยังตำแหน่ง",
  "REGEN (RE)  สร้างแบบใหม่จากโมเดล · MODEL · LAYOUT <แผ่น> · PLOT · DXFOUT · STATUS",
];

export function CadViewer({ code }: { code: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const client = useIsClient();
  const [regen, setRegen] = useState(0);
  const set = useMemo(() => {
    void regen;
    return getDrawingSet(code);
  }, [code, regen]);
  const { model, sheets } = set;
  const spec = model.spec;
  const file = dwgName(spec.code, spec.name);
  const project = projects.find((p) => p.id === params.get("project"));
  const modelPl = useMemo(() => modelLayout(sheets), [sheets]);
  const [layout, setLayout] = useState<string>(() => {
    const s = params.get("layout");
    return s && sheets.some((q) => q.id === s) ? s : "Model";
  });
  const paperSheet = layout === "Model" ? undefined : sheets.find((s) => s.id === layout);
  const pl: Placement[] = useMemo(() => (paperSheet ? [{ sheet: paperSheet, x: 0, y: 0, i: sheets.indexOf(paperSheet) }] : modelPl), [paperSheet, modelPl, sheets]);
  const ext = useMemo(() => extents(pl), [pl]);

  const [ls, setLs] = useState<LayerState>(() => ({ off: new Set(), frozen: new Set(), locked: new Set(), current: "0" }));
  const prevOff = useRef<Set<string> | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>(TABS[0]);
  const [workspace, setWorkspace] = useState("Drafting & Annotation");
  const [mode, setMode] = useState<Mode>(null);
  const [sel, setSel] = useState<Pick | null>(null);
  const [found, setFound] = useState<{ q: string; hits: { p: Placement; bb: BBox }[]; i: number } | null>(null);
  const [ghost, setGhost] = useState<{ cur: Pt; snap: boolean } | null>(null);
  const [hist, setHist] = useState<string[]>([]);
  const [cmd, setCmd] = useState("");
  const [histOpen, setHistOpen] = useState(false);
  const [tog, setTog] = useState({ grid: true, snap: false, ortho: false, osnap: true, lwt: false, cube: true, nav: true, ucs: true, props: true, ssm: true, cmdline: true });
  const [layMgr, setLayMgr] = useState(false);
  const [layDrop, setLayDrop] = useState(false);
  const [ssmTab, setSsmTab] = useState<"list" | "views" | "model">("list");
  const [ssmClosed, setSsmClosed] = useState<Set<string>>(() => new Set());
  const [full, setFull] = useState(false);
  const [extS, setExtS] = useState(1);
  const [settled, setSettled] = useState<{ x: number; y: number; s: number; w: number; h: number } | null>(null);
  const lastCmd = useRef("");
  const runRef = useRef<(s: string) => void>(() => {});
  const prevView = useRef<{ cx: number; cy: number; s: number } | null>(null);
  const cmdRef = useRef<HTMLInputElement>(null);
  const coordRef = useRef<HTMLSpanElement>(null);
  const crossRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  const hiddenSet = useMemo(() => new Set([...ls.off, ...ls.frozen]), [ls]);
  const skip = useCallback((l: string) => hiddenSet.has(l) || ls.locked.has(l), [hiddenSet, ls.locked]);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of sheets) for (const p of s.prims) m.set(p.l, (m.get(p.l) ?? 0) + 1);
    return m;
  }, [sheets]);

  const log = useCallback((...lines: string[]) => setHist((h) => [...h, ...lines].slice(-300)), []);

  // ---------- viewport ----------
  const modeRef = useRef<Mode>(null);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  const clickRef = useRef<(wx: number, wy: number) => void>(() => {});
  const moveRef = useRef<(wx: number, wy: number) => void>(() => {});
  const vp = useViewport({
    leftPans: () => modeRef.current?.k !== "ZOOMW",
    onClick: (x, y) => clickRef.current(x, -y),
    onMove: (x, y, e) => {
      const el = coordRef.current;
      if (el) el.textContent = `${x.toFixed(4)}, ${(-y).toFixed(4)}, 0.0000`;
      const ch = crossRef.current;
      const box = vp.boxRef.current;
      if (ch && box) {
        const r = box.getBoundingClientRect();
        ch.style.transform = `translate(${e.clientX - r.left}px, ${e.clientY - r.top}px)`;
        ch.style.opacity = "1";
      }
      moveRef.current(x, -y);
    },
    minS: 0.005,
    maxS: 20000,
  });
  const { fit, zoom, centerOn, get: getView, boxRef, svgRef, view } = vp;

  const fitWorld = useCallback(
    (bb: BBox, pad = 0.03) => {
      const v = getView();
      prevView.current = { cx: v.x + v.w / v.s / 2, cy: v.y + v.h / v.s / 2, s: v.s };
      fit([bb[0], -bb[3], bb[2], -bb[1]], pad);
    },
    [fit, getView],
  );
  const zoomExtents = useCallback(() => {
    fitWorld(ext, 0.03);
    setExtS(getView().s);
  }, [ext, fitWorld, getView]);

  useEffect(() => {
    if (!client) return;
    const id = requestAnimationFrame(zoomExtents);
    return () => cancelAnimationFrame(id);
  }, [client, zoomExtents]);

  useEffect(() => {
    const t = window.setTimeout(() => setSettled(view), 140);
    return () => window.clearTimeout(t);
  }, [view]);

  const intro = useMemo(
    () => [
      `CAD Viewer (DWG/DXF) — ${file}${project ? ` · As-built ${project.id} ${project.name}` : ""}`,
      `Loaded ${set.entities.toLocaleString()} objects · ${sheets.length} layouts · ${set.layers.length} layers · units: Meters (${client ? set.ms.toFixed(1) : "…"} ms)`,
      "พิมพ์คำสั่ง (เช่น ZOOM, LAYER, DIST, AREA, FIND WC-201) หรือ HELP เพื่อดูรายการคำสั่ง",
    ],
    [file, project, set, sheets.length, client],
  );

  // ---------- point resolution ----------
  const resolve = useCallback(
    (wx: number, wy: number, from?: Pt): { p: Pt; snap: boolean } => {
      const s = getView().s;
      if (tog.osnap) {
        const sp = snapPoint(pl, wx, wy, 10 / s, skip);
        if (sp) return { p: sp, snap: true };
      }
      let p: Pt = [wx, wy];
      if (tog.snap) p = [Math.round(wx * 10) / 10, Math.round(wy * 10) / 10];
      if (tog.ortho && from) p = Math.abs(p[0] - from[0]) > Math.abs(p[1] - from[1]) ? [p[0], from[1]] : [from[0], p[1]];
      return { p, snap: false };
    },
    [getView, tog.osnap, tog.snap, tog.ortho, pl, skip],
  );

  const f4 = (v: number) => v.toFixed(4);

  const finishDist = useCallback(
    (a: Pt, b: Pt) => {
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const ang = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
      log(`Distance = ${f4(Math.hypot(dx, dy))},  Angle in XY Plane = ${ang.toFixed(2)},  Angle from XY Plane = 0`, `Delta X = ${f4(dx)},  Delta Y = ${f4(dy)},  Delta Z = 0.0000`);
      setMode(null);
      setGhost(null);
    },
    [log],
  );

  const finishArea = useCallback(
    (pts: Pt[]) => {
      if (pts.length < 3) {
        log("ต้องมีอย่างน้อย 3 จุด");
        return;
      }
      log(`Area = ${f4(polyArea(pts))} ตร.ม.,  Perimeter = ${f4(polyPerimeter(pts))} ม.`);
      setMode(null);
      setGhost(null);
    },
    [log],
  );

  const roomAt = useCallback(
    (wx: number, wy: number) => {
      const p = placementAt(pl, wx, wy);
      if (!p) return null;
      const q: Pt = [wx - p.x, wy - p.y];
      const r = p.sheet.rooms.find((rm) => pointInPoly(q, rm.pts));
      return r ? { r, p } : null;
    },
    [pl],
  );

  const listPick = useCallback(
    (pk: Pick) => {
      const d = layerDef(pk.prim.l);
      const rows = describe(pk.prim, pk.p.x, pk.p.y);
      const lines = [`                  ${TYPE_NAME[pk.prim.t].toUpperCase()}       Layer: "${pk.prim.l}"`, `                            Space: ${paperSheet ? "Paper space" : "Model space"} · Sheet ${pk.p.sheet.id}`, `                   Color: BYLAYER (${d.aci})   Linetype: ${"lt" in pk.prim && pk.prim.lt ? pk.prim.lt : "BYLAYER"}`, ...rows.map(([k, v]) => `                   ${k} = ${v}`)];
      if (pk.prim.ref) {
        const a = assetOf(model, pk.prim.ref);
        if (a) lines.push(`                   Asset = ${a.code} · ${a.name} · ประกันถึง ${thDate(a.warrantyUntil)}`);
      }
      log(...lines);
    },
    [log, model, paperSheet],
  );

  useEffect(() => {
    clickRef.current = (wx, wy) => {
      const m = modeRef.current;
      if (!m || m.k === "PAN") {
        const pk = pickPrim(pl, wx, wy, 6 / getView().s, skip);
        setSel(pk);
        return;
      }
      if (m.k === "ID") {
        const { p } = resolve(wx, wy);
        log(`X = ${f4(p[0])}     Y = ${f4(p[1])}     Z = 0.0000`);
        setMode(null);
        setGhost(null);
        return;
      }
      if (m.k === "LIST") {
        const pk = pickPrim(pl, wx, wy, 6 / getView().s, skip);
        if (!pk) {
          log("ไม่พบวัตถุ เลือกใหม่");
          return;
        }
        setSel(pk);
        listPick(pk);
        setMode(null);
        return;
      }
      if (m.k === "DIST" || m.k === "ZOOMW") {
        const { p } = resolve(wx, wy, m.pts[0]);
        const pts = [...m.pts, p];
        if (pts.length < 2) {
          setMode({ ...m, pts });
          return;
        }
        if (m.k === "DIST") finishDist(pts[0], pts[1]);
        else {
          fitWorld([Math.min(pts[0][0], pts[1][0]), Math.min(pts[0][1], pts[1][1]), Math.max(pts[0][0], pts[1][0]), Math.max(pts[0][1], pts[1][1])], 0);
          setMode(null);
          setGhost(null);
        }
        return;
      }
      if (m.k === "AREA") {
        if (m.room) {
          const hit = roomAt(wx, wy);
          if (hit) {
            log(`Room ${hit.r.id} ${hit.r.name}  Area = ${f4(hit.r.area)} ตร.ม.,  Perimeter = ${f4(polyPerimeter(hit.r.pts))} ม.`);
            setMode(null);
            setGhost(null);
          } else {
            const pk = pickPrim(pl, wx, wy, 6 / getView().s, skip);
            if (pk && (pk.prim.t === "hatch" || (pk.prim.t === "pline" && pk.prim.closed))) {
              log(`${TYPE_NAME[pk.prim.t]} on ${pk.prim.l}  Area = ${f4(polyArea(pk.prim.pts))} ตร.ม.,  Perimeter = ${f4(polyPerimeter(pk.prim.pts))} ม.`);
              setSel(pk);
              setMode(null);
              setGhost(null);
            } else log("ไม่พบห้องหรือวัตถุปิด ณ จุดนี้");
          }
          return;
        }
        const { p } = resolve(wx, wy, m.pts[m.pts.length - 1]);
        setMode({ ...m, pts: [...m.pts, p] });
      }
    };
    moveRef.current = (wx, wy) => {
      const m = modeRef.current;
      if (!m || m.k === "PAN" || m.k === "LIST" || m.k === "ZOOM?") {
        setGhost((g) => (g ? null : g));
        return;
      }
      const from = "pts" in m ? m.pts[m.pts.length - 1] : undefined;
      const r = m.k === "AREA" && m.room ? { p: [wx, wy] as Pt, snap: false } : resolve(wx, wy, from);
      setGhost({ cur: r.p, snap: r.snap });
    };
  });

  // ---------- layers ----------
  const toggleLayer = useCallback((k: "off" | "frozen" | "locked", name: string) => {
    setLs((s) => {
      const n = new Set(s[k]);
      if (n.has(name)) n.delete(name);
      else n.add(name);
      return { ...s, [k]: n };
    });
  }, []);
  const matchLayers = useCallback(
    (pat: string) => {
      const re = new RegExp("^" + pat.toUpperCase().replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$");
      return set.layers.filter((l) => re.test(l));
    },
    [set.layers],
  );
  const isolate = useCallback(
    (names: string[]) => {
      prevOff.current = ls.off;
      setLs((s) => ({ ...s, off: new Set(set.layers.filter((l) => !names.includes(l))), current: names[0] ?? s.current }));
    },
    [ls.off, set.layers],
  );
  const unisolate = useCallback(() => {
    const p = prevOff.current;
    setLs((s) => ({ ...s, off: p ?? new Set() }));
    prevOff.current = null;
  }, []);

  // ---------- commands ----------
  const switchLayout = useCallback(
    (id: string) => {
      setLayout(id);
      setSel(null);
      setFound(null);
      setMode(null);
      const url = new URL(window.location.href);
      if (id === "Model") url.searchParams.delete("layout");
      else url.searchParams.set("layout", id);
      window.history.replaceState(null, "", url.toString());
    },
    [],
  );

  const plot = useCallback(() => {
    const list = paperSheet ? [paperSheet] : sheets;
    if (!printSheets(list, paperSheet ? paperSheet.code : file, hiddenSet)) log("เบราว์เซอร์บล็อกหน้าต่างพิมพ์");
    else log(`PLOT ${list.length} layout(s) · A3 landscape · monochrome.ctb`);
  }, [paperSheet, sheets, file, hiddenSet, log]);

  const exportAll = useCallback(() => {
    downloadSetDxf(fileBase(spec.code, spec.name), modelPl.map((p) => ({ sheet: p.sheet, x: p.x, y: p.y })), ls.off, ls.frozen);
    log(`DXFOUT ${fileBase(spec.code, spec.name)}.dxf · R12/LT2 · ${set.entities.toLocaleString()} objects`);
  }, [spec, modelPl, ls.off, ls.frozen, log, set.entities]);

  const find = useCallback(
    (q: string) => {
      const t = q.trim().toLowerCase();
      if (!t) {
        log("FIND ต้องระบุข้อความ เช่น FIND WC-201");
        return;
      }
      if (found && found.q === t && found.hits.length) {
        const i = (found.i + 1) % found.hits.length;
        setFound({ ...found, i });
        const h = found.hits[i];
        fitWorld([h.bb[0] + h.p.x - 1.5, h.bb[1] + h.p.y - 1.5, h.bb[2] + h.p.x + 1.5, h.bb[3] + h.p.y + 1.5], 0.1);
        log(`แสดงรายการที่ ${i + 1} / ${found.hits.length} · แผ่น ${h.p.sheet.id}`);
        return;
      }
      const search = (places: Placement[]) => {
        const hits: { p: Placement; bb: BBox }[] = [];
        for (const p of places) {
          const seen = new Set<string>();
          for (const h of p.sheet.hits)
            if (h.code.toLowerCase() === t || h.code.toLowerCase().startsWith(t)) {
              hits.push({ p, bb: h.bb });
              seen.add(h.code);
            }
          for (const prim of p.sheet.prims)
            if (prim.t === "text" && prim.s.toLowerCase().includes(t) && !(prim.ref && seen.has(prim.ref)) && !hiddenSet.has(prim.l)) hits.push({ p, bb: primBBox(prim) });
        }
        return hits;
      };
      let hits = search(pl);
      if (!hits.length && paperSheet) {
        hits = search(modelPl);
        if (hits.length) {
          setLayout("Model");
          log("ไม่พบใน Layout นี้ · สลับไป Model space");
        }
      }
      if (!hits.length) {
        log(`FIND “${q}” · ไม่พบ`);
        setFound(null);
        return;
      }
      setFound({ q: t, hits, i: 0 });
      const h = hits[0];
      log(`FIND “${q}” · พบ ${hits.length} รายการใน ${new Set(hits.map((x) => x.p.sheet.id)).size} แผ่น · พิมพ์ FIND ${q} อีกครั้งเพื่อไปรายการถัดไป`);
      requestAnimationFrame(() => fitWorld([h.bb[0] + h.p.x - 1.5, h.bb[1] + h.p.y - 1.5, h.bb[2] + h.p.x + 1.5, h.bb[3] + h.p.y + 1.5], 0.1));
    },
    [found, pl, paperSheet, modelPl, hiddenSet, fitWorld, log],
  );

  const run = useCallback(
    (input: string) => {
      const raw = input.trim();
      const m = modeRef.current;
      // point entry "x,y" while picking
      const pt = raw.match(/^(-?[\d.]+)\s*,\s*(-?[\d.]+)$/);
      if (pt && m && m.k !== "PAN" && m.k !== "ZOOM?") {
        log(`Command: ${raw}`);
        const p: Pt = [Number(pt[1]), Number(pt[2])];
        if (m.k === "ID") {
          log(`X = ${f4(p[0])}     Y = ${f4(p[1])}     Z = 0.0000`);
          setMode(null);
        } else if (m.k === "DIST") {
          if (m.pts.length) finishDist(m.pts[0], p);
          else setMode({ ...m, pts: [p] });
        } else if (m.k === "AREA") setMode({ ...m, pts: [...m.pts, p] });
        return;
      }
      if (!raw) {
        if (m?.k === "AREA") {
          if (!m.pts.length && !m.room) {
            setMode({ k: "AREA", pts: [], room: true });
            log("เลือกห้องหรือวัตถุปิดเพื่อวัดพื้นที่:");
          } else finishArea(m.pts);
          return;
        }
        if (m) {
          setMode(null);
          setGhost(null);
          return;
        }
        if (lastCmd.current) runRef.current(lastCmd.current);
        return;
      }
      log(`Command: ${raw}`);
      if (m?.k === "ZOOM?") {
        setMode(null);
        runRef.current(`ZOOM ${raw}`);
        return;
      }
      if (m?.k === "AREA" && /^(R|ROOM|O|OBJECT)$/i.test(raw)) {
        setMode({ k: "AREA", pts: [], room: true });
        log("เลือกห้องหรือวัตถุปิดเพื่อวัดพื้นที่:");
        return;
      }
      const [c0, ...rest] = raw.split(/\s+/);
      const c = c0.toUpperCase();
      const arg = rest.join(" ");
      const A = arg.toUpperCase();
      const alias: Record<string, string> = { Z: "ZOOM", P: "PAN", LA: "LAYER", DI: "DIST", AA: "AREA", LI: "LIST", "?": "HELP", RE: "REGEN", REGENALL: "REGEN", FI: "FIND", PRINT: "PLOT", EXPORT: "DXFOUT", SAVEAS: "DXFOUT" };
      const C = alias[c] ?? c;
      if (!["HELP"].includes(C)) lastCmd.current = C;
      setSel((s) => (C === "LIST" ? s : s));
      switch (C) {
        case "ZOOM": {
          if (!A) {
            setMode({ k: "ZOOM?" });
            log("Specify corner of window, enter a scale factor (nX or nXP), or [All/Extents/Previous/Window/In/Out] <real time>:");
            return;
          }
          const v = getView();
          const keep = () => (prevView.current = { cx: v.x + v.w / v.s / 2, cy: v.y + v.h / v.s / 2, s: v.s });
          if (A === "E" || A === "EXTENTS" || A === "A" || A === "ALL") {
            zoomExtents();
            log("Regenerating model.");
          } else if (A === "W" || A === "WINDOW") {
            setMode({ k: "ZOOMW", pts: [] });
            log("Specify first corner:");
          } else if (A === "IN") {
            keep();
            zoom(2);
          } else if (A === "OUT") {
            keep();
            zoom(0.5);
          } else if (A === "P" || A === "PREVIOUS") {
            const p = prevView.current;
            if (p) {
              keep();
              centerOn(p.cx, p.cy, p.s);
            } else log("No previous view saved.");
          } else {
            const fm = A.match(/^([\d.]+)\s*X?P?$/);
            if (fm && Number(fm[1]) > 0) {
              keep();
              zoom(Number(fm[1]));
            } else log(`Unknown ZOOM option “${arg}”`);
          }
          return;
        }
        case "PAN":
          setMode({ k: "PAN" });
          log("Press ESC or ENTER to exit, or drag to pan.");
          return;
        case "LAYER":
        case "LAYON":
        case "LAYOFF":
        case "LAYFRZ":
        case "LAYTHW":
        case "LAYISO":
        case "LAYUNISO": {
          let op = C === "LAYER" ? (rest[0] ?? "").toUpperCase() : { LAYON: "ON", LAYOFF: "OFF", LAYFRZ: "FREEZE", LAYTHW: "THAW", LAYISO: "ISOLATE", LAYUNISO: "UNISOLATE" }[C]!;
          const target = C === "LAYER" ? rest.slice(1).join(" ") : arg;
          if (op === "ISO") op = "ISOLATE";
          if (op === "UNISO") op = "UNISOLATE";
          if (!op) {
            setLayMgr(true);
            log(`Layer Properties Manager · ${set.layers.length} layers · current “${ls.current}”`);
            return;
          }
          if (op === "LIST" || op === "?") {
            log("Layer name     State    Color  Linetype    Objects  Description");
            for (const l of set.layers) {
              const d = layerDef(l);
              const st = ls.frozen.has(l) ? "Frozen" : ls.off.has(l) ? "Off" : "On";
              log(`${l.padEnd(14)} ${st.padEnd(8)} ${String(d.aci).padEnd(6)} ${d.lt.padEnd(11)} ${String(counts.get(l) ?? 0).padStart(7)}  ${d.desc}`);
            }
            return;
          }
          if (op === "UNISOLATE") {
            unisolate();
            log("Layers restored.");
            return;
          }
          const names = target ? matchLayers(target) : op === "ISOLATE" && sel ? [sel.prim.l] : [];
          if (!names.length) {
            log(target ? `ไม่พบเลเยอร์ “${target}”` : `ระบุชื่อเลเยอร์ เช่น LAYER ${op} E-*`);
            return;
          }
          if (op === "ON") setLs((s) => ({ ...s, off: new Set([...s.off].filter((l) => !names.includes(l))) }));
          else if (op === "OFF") setLs((s) => ({ ...s, off: new Set([...s.off, ...names]) }));
          else if (op === "FREEZE" || op === "F") setLs((s) => ({ ...s, frozen: new Set([...s.frozen, ...names]) }));
          else if (op === "THAW" || op === "T") setLs((s) => ({ ...s, frozen: new Set([...s.frozen].filter((l) => !names.includes(l))) }));
          else if (op === "ISOLATE") isolate(names);
          else if (op === "SET" || op === "S") setLs((s) => ({ ...s, current: names[0] }));
          else {
            log(`Unknown LAYER option “${op}”`);
            return;
          }
          log(`${op} · ${names.join(", ")}`);
          return;
        }
        case "DIST":
          setMode({ k: "DIST", pts: [] });
          log("Specify first point:");
          return;
        case "AREA":
          setMode({ k: "AREA", pts: [] });
          log("Specify first corner point or [Object/Room] <Room>:");
          return;
        case "ID":
          setMode({ k: "ID" });
          log("Specify point:");
          return;
        case "LIST":
          if (sel) listPick(sel);
          else {
            setMode({ k: "LIST" });
            log("Select objects:");
          }
          return;
        case "FIND":
          find(arg);
          return;
        case "REGEN": {
          const t0 = performance.now();
          clearDrawingCache(code);
          const s = getDrawingSet(code);
          setRegen((r) => r + 1);
          setSel(null);
          log(`Regenerating model. ${s.entities.toLocaleString()} objects · ${(performance.now() - t0).toFixed(1)} ms`);
          return;
        }
        case "HELP":
          log("คำสั่งที่รองรับ (Read-only viewer):", ...HELP);
          return;
        case "MODEL":
        case "MS":
          switchLayout("Model");
          return;
        case "LAYOUT": {
          const s = sheets.find((q) => q.id.toUpperCase() === A);
          if (s) switchLayout(s.id);
          else log(`Layouts: ${sheets.map((q) => q.id).join(", ")}`);
          return;
        }
        case "PLOT":
          plot();
          return;
        case "DXFOUT":
          exportAll();
          return;
        case "GRID":
        case "SNAP":
        case "ORTHO":
        case "OSNAP": {
          const k = C.toLowerCase() as "grid" | "snap" | "ortho" | "osnap";
          const v = A === "ON" ? true : A === "OFF" ? false : !tog[k];
          setTog((t) => ({ ...t, [k]: v }));
          log(`<${C} ${v ? "on" : "off"}>`);
          return;
        }
        case "UNITS":
          log("Length type: Decimal · Precision 0.0000 · Insertion scale: Meters · Angle: Decimal degrees, counter-clockwise");
          return;
        case "STATUS":
          log(
            `${set.entities.toLocaleString()} objects in ${file}`,
            `Model space limits  X: ${f4(extents(modelPl)[0])}  Y: ${f4(extents(modelPl)[1])}  to  X: ${f4(extents(modelPl)[2])}  Y: ${f4(extents(modelPl)[3])}`,
            `Layouts ${sheets.length} · Layers ${set.layers.length} · Current layer ${ls.current} · Units Meters`,
          );
          return;
        case "OPEN":
          router.push("/cad");
          return;
        case "LINE":
        case "L":
        case "CIRCLE":
        case "C":
        case "MOVE":
        case "M":
        case "ERASE":
        case "E":
        case "COPY":
        case "CO":
        case "TRIM":
        case "TR":
        case "PLINE":
        case "PL":
        case "HATCH":
        case "H":
          log(`${C}: แบบนี้เปิดแบบอ่านอย่างเดียว (Read-only) · ใช้คำสั่งวัดและค้นหาได้`);
          return;
        default:
          log(`Unknown command “${c}”. Press F1 or type HELP for help.`);
      }
    },
    [log, finishDist, finishArea, getView, zoomExtents, zoom, centerOn, set, ls, counts, matchLayers, unisolate, isolate, sel, listPick, find, code, switchLayout, sheets, plot, exportAll, tog, file, modelPl, router],
  );

  useEffect(() => {
    runRef.current = run;
  }, [run]);

  const cancel = useCallback(() => {
    if (modeRef.current) log("*Cancel*");
    setMode(null);
    setGhost(null);
    setSel(null);
    setFound(null);
    setLayDrop(false);
  }, [log]);

  // keyboard: printable keys go to the command line, like AutoCAD
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const inCmd = t === cmdRef.current;
      if (!inCmd && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
      if (e.key === "Escape") {
        cancel();
        if (inCmd) setCmd("");
        return;
      }
      if (e.key === "F2") {
        e.preventDefault();
        setHistOpen((o) => !o);
        return;
      }
      const fk: Record<string, "grid" | "osnap" | "ortho" | "snap"> = { F7: "grid", F3: "osnap", F8: "ortho", F9: "snap" };
      if (fk[e.key]) {
        e.preventDefault();
        const k = fk[e.key];
        setTog((s) => ({ ...s, [k]: !s[k] }));
        return;
      }
      if (inCmd || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Enter") {
        e.preventDefault();
        run("");
        return;
      }
      if (e.key.length === 1) {
        e.preventDefault();
        setCmd((c) => c + e.key);
        cmdRef.current?.focus();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [cancel, run]);

  useEffect(() => {
    const onFs = () => setFull(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      log("คัดลอกลิงก์ของแบบนี้แล้ว");
    } catch {
      log(window.location.href);
    }
  };

  // ---------- render helpers ----------
  const theme = THEME.cad;
  const css = useMemo(
    () =>
      themeCss(theme, `.${SCOPE}`, hiddenSet, { lwOff: !tog.lwt, paper: paperSheet ? "#19191b" : "none" }) +
      `.${SCOPE} .sel .s,.${SCOPE} .sel .f{stroke:#4da3ff;stroke-width:3px;vector-effect:non-scaling-stroke;stroke-dasharray:6 3;fill:none}.${SCOPE} .sel text{fill:#4da3ff}.${SCOPE} .gh{fill:none;stroke:#4da3ff;stroke-width:1px;vector-effect:non-scaling-stroke}.${SCOPE} .gh.fl{fill:rgba(77,163,255,0.12)}.${SCOPE} .sn{fill:none;stroke:#ffe14d;stroke-width:2px;vector-effect:non-scaling-stroke}.${SCOPE} .fd{fill:rgba(255,225,77,0.12);stroke:#ffe14d;stroke-width:2px;vector-effect:non-scaling-stroke}.${SCOPE} .fr{fill:none;stroke:#3a3a3f;stroke-width:1px;vector-effect:non-scaling-stroke}`,
    [theme, hiddenSet, tog.lwt, paperSheet],
  );

  const vs = settled ?? view;
  const vx0 = vs.x;
  const vx1 = vs.x + vs.w / vs.s;
  const vy0 = -(vs.y + vs.h / vs.s);
  const vy1 = -vs.y;
  const lod = (p: Placement) => {
    const visible = p.x < vx1 && p.x + p.sheet.w > vx0 && p.y < vy1 && p.y + p.sheet.h > vy0;
    return !visible || p.sheet.w * vs.s < 520;
  };

  const selMarkup = useMemo(() => {
    if (!sel) return null;
    const s = sel.p.sheet;
    return { html: renderPrims([sel.prim], { scale: s.scale, h: s.h }), t: `translate(${sel.p.x} ${-(sel.p.y + s.h)})` };
  }, [sel]);

  const gridStep = niceLength(24 / Math.max(view.s, 1e-6));
  const zoomPct = Math.round((view.s / extS) * 100);
  const curScale = paperSheet ? (paperSheet.nts ? "NTS" : `1:${paperSheet.scale}`) : "1:100";
  const m = mode;
  const prompt =
    m?.k === "DIST"
      ? m.pts.length
        ? "DIST Specify second point:"
        : "DIST Specify first point:"
      : m?.k === "AREA"
        ? m.room
          ? "AREA Select room or closed object:"
          : m.pts.length
            ? `AREA Specify next point or press ENTER for total (${m.pts.length} points):`
            : "AREA Specify first corner point or [Object/Room] <Room>:"
        : m?.k === "ID"
          ? "ID Specify point:"
          : m?.k === "ZOOMW"
            ? m.pts.length
              ? "ZOOM Specify opposite corner:"
              : "ZOOM Specify first corner:"
            : m?.k === "LIST"
              ? "LIST Select objects:"
              : m?.k === "PAN"
                ? "PAN Press ESC or ENTER to exit"
                : m?.k === "ZOOM?"
                  ? "ZOOM [All/Extents/Previous/Window/In/Out] or factor:"
                  : "Type a command";

  const selAsset = sel?.prim.ref ? assetOf(model, sel.prim.ref) : undefined;
  const selLayer = sel ? layerDef(sel.prim.l) : undefined;
  const ghostPts: Pt[] = m && "pts" in m ? [...m.pts, ...(ghost ? [ghost.cur] : [])] : ghost ? [ghost.cur] : [];
  const sv = (p: Pt) => `${p[0]},${-p[1]}`;
  const snapSize = 5 / Math.max(view.s, 1e-6);
  const toggleFull = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else rootRef.current?.requestFullscreen?.();
  };
  const curLayerDef = layerDef(ls.current);

  // ---------- ribbon ----------
  const ribbon = () => {
    switch (tab) {
      case "หน้าแรก / Home":
        return (
          <>
            <Panel title="Draw" disabled>
              <RB big disabled icon={<Slash {...IB} />} label="Line" />
              <RB big disabled icon={<Spline {...IB} />} label="Polyline" />
              <RB big disabled icon={<Circle {...IB} />} label="Circle" />
              <Col>
                <RB disabled icon={<Square {...I} />} label="Rectangle" />
                <RB disabled icon={<Hash {...I} />} label="Hatch" />
                <RB disabled icon={<Pentagon {...I} />} label="Polygon" />
              </Col>
            </Panel>
            <Panel title="Modify" disabled>
              <Col>
                <RB disabled icon={<Move {...I} />} label="Move" />
                <RB disabled icon={<Copy {...I} />} label="Copy" />
                <RB disabled icon={<Scaling {...I} />} label="Stretch" />
              </Col>
              <Col>
                <RB disabled icon={<RotateCw {...I} />} label="Rotate" />
                <RB disabled icon={<Scissors {...I} />} label="Trim" />
                <RB disabled icon={<LayoutGrid {...I} />} label="Array" />
              </Col>
            </Panel>
            <Panel title="Annotation">
              <RB big active={!hiddenSet.has("A-ANNO")} icon={<Type {...IB} />} label="Text" title="แสดง/ซ่อนข้อความ (A-ANNO)" onClick={() => toggleLayer("off", "A-ANNO")} />
              <RB big active={!hiddenSet.has("A-DIMS")} icon={<Ruler {...IB} />} label="Dimension" title="แสดง/ซ่อนเส้นบอกระยะ (A-DIMS)" onClick={() => toggleLayer("off", "A-DIMS")} />
              <Col>
                <RB disabled icon={<PenLine {...I} />} label="Leader" />
                <RB disabled icon={<Table {...I} />} label="Table" />
                <RB icon={<Type {...I} />} label="Text style: THAI" onClick={() => log("Text style THAI · IBM Plex Sans Thai · height by annotation scale")} />
              </Col>
            </Panel>
            <Panel title="Layers">
              <RB big icon={<Layers {...IB} />} label="Layer Properties" onClick={() => setLayMgr(true)} />
              <div className="flex flex-col gap-0.5">
                <div className="relative">
                  <button type="button" onClick={() => setLayDrop((o) => !o)} className="flex h-[22px] w-[230px] items-center gap-2 rounded-[4px] border border-[#3a3a3f] bg-[#141415] px-1.5 text-[12px]">
                    <span className="size-3 border border-[#4a4a4f]" style={{ background: ACI_HEX[curLayerDef.aci] ?? "#ededed" }} />
                    <span className="whitespace-nowrap font-mono">{ls.current}</span>
                    <span className="truncate text-[#7c7c82]">{ls.current === "0" ? "" : curLayerDef.desc}</span>
                    <ChevronDown size={14} strokeWidth={1.5} className="ml-auto text-[#7c7c82]" />
                  </button>
                  {layDrop && (
                    <div className="absolute left-0 top-6 z-50 max-h-[360px] w-[340px] overflow-auto rounded-[6px] border border-[#3a3a3f] bg-[#19191b] p-1 shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
                      {set.layers.map((l) => (
                        <LayerRow
                          key={l}
                          name={l}
                          ls={ls}
                          count={counts.get(l)}
                          onToggle={toggleLayer}
                          onCurrent={(n) => {
                            setLs((s) => ({ ...s, current: n }));
                            setLayDrop(false);
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-0.5">
                  <RB icon={<Eye {...I} />} label="Isolate" onClick={() => (sel ? (isolate([sel.prim.l]), log(`LAYISO ${sel.prim.l}`)) : run(`LAYER ISOLATE ${ls.current === "0" ? "" : ls.current}`))} />
                  <RB icon={<Layers {...I} />} label="Unisolate" onClick={() => run("LAYUNISO")} />
                  <RB icon={<X {...I} />} label="Off" onClick={() => (sel ? run(`LAYOFF ${sel.prim.l}`) : log("เลือกวัตถุก่อนเพื่อปิดเลเยอร์"))} />
                </div>
                <div className="flex gap-0.5">
                  <RB icon={<Plus {...I} />} label="All On" onClick={() => setLs((s) => ({ ...s, off: new Set(), frozen: new Set() }))} />
                  <RB icon={<Box {...I} />} label="Freeze" onClick={() => (sel ? run(`LAYFRZ ${sel.prim.l}`) : log("เลือกวัตถุก่อนเพื่อ Freeze เลเยอร์"))} />
                  <RB icon={<Copy {...I} />} label="Match Layer" disabled />
                </div>
              </div>
            </Panel>
            <Panel title="Utilities">
              <RB big icon={<Ruler {...IB} />} label="Measure" active={m?.k === "DIST"} onClick={() => run("DIST")} />
              <Col>
                <RB icon={<Square {...I} />} label="Area" active={m?.k === "AREA"} onClick={() => run("AREA")} />
                <RB icon={<Crosshair {...I} />} label="ID Point" active={m?.k === "ID"} onClick={() => run("ID")} />
                <RB icon={<List {...I} />} label="List" onClick={() => run("LIST")} />
              </Col>
              <Col>
                <RB
                  icon={<Search {...I} />}
                  label="Find…"
                  onClick={() => {
                    setCmd("FIND ");
                    cmdRef.current?.focus();
                  }}
                />
                <RB icon={<Info {...I} />} label="Status" onClick={() => run("STATUS")} />
              </Col>
            </Panel>
            <Panel title="Properties">
              <RB big disabled icon={<Wrench {...IB} />} label="Match Properties" />
              <Col>
                {[
                  ["Color", selLayer ? `ByLayer (${selLayer.aci})` : "ByLayer"],
                  ["Linetype", sel && "lt" in sel.prim && sel.prim.lt ? sel.prim.lt : "ByLayer"],
                  ["Lineweight", sel && "w" in sel.prim && sel.prim.w ? `${sel.prim.w.toFixed(2)} mm` : "ByLayer"],
                ].map(([k, v]) => (
                  <span key={k} title={k} className="flex h-[22px] w-[140px] items-center gap-1.5 rounded-[4px] border border-[#3a3a3f] bg-[#141415] px-1.5 text-[12px]">
                    {k === "Color" && <span className="size-3 border border-[#4a4a4f]" style={{ background: selLayer ? ACI_HEX[selLayer.aci] : "#ededed" }} />}
                    {k !== "Color" && <span className="h-px w-4 bg-[#ededed]" />}
                    {v}
                  </span>
                ))}
              </Col>
            </Panel>
          </>
        );
      case "Annotate":
        return (
          <>
            <Panel title="Text">
              <RB big active={!hiddenSet.has("A-ANNO")} icon={<Type {...IB} />} label="Text" onClick={() => toggleLayer("off", "A-ANNO")} />
              <RB big active={!hiddenSet.has("TITLE")} icon={<FileText {...IB} />} label="Title blocks" onClick={() => toggleLayer("off", "TITLE")} />
            </Panel>
            <Panel title="Dimensions">
              <RB big active={!hiddenSet.has("A-DIMS")} icon={<Ruler {...IB} />} label="Dimension" onClick={() => toggleLayer("off", "A-DIMS")} />
              <RB big active={!hiddenSet.has("S-GRID")} icon={<Hash {...IB} />} label="Grid lines" onClick={() => toggleLayer("off", "S-GRID")} />
            </Panel>
            <Panel title="Leaders" disabled>
              <RB big disabled icon={<PenLine {...IB} />} label="Multileader" />
            </Panel>
            <Panel title="Tables" disabled>
              <RB big disabled icon={<Table {...IB} />} label="Table" />
            </Panel>
          </>
        );
      case "View":
        return (
          <>
            <Panel title="Navigate">
              <RB big icon={<Expand {...IB} />} label="Extents" onClick={() => run("ZOOM E")} />
              <Col>
                <RB icon={<ScanSearch {...I} />} label="Window" active={m?.k === "ZOOMW"} onClick={() => run("ZOOM W")} />
                <RB icon={<ZoomIn {...I} />} label="Zoom in" onClick={() => run("ZOOM IN")} />
                <RB icon={<ZoomOut {...I} />} label="Zoom out" onClick={() => run("ZOOM OUT")} />
              </Col>
              <Col>
                <RB icon={<Hand {...I} />} label="Pan" active={m?.k === "PAN"} onClick={() => run("PAN")} />
                <RB icon={<Undo2 {...I} />} label="Previous" onClick={() => run("ZOOM P")} />
              </Col>
            </Panel>
            <Panel title="Viewport tools">
              <Col>
                <RB icon={<Crosshair {...I} />} label="UCS icon" active={tog.ucs} onClick={() => setTog((t) => ({ ...t, ucs: !t.ucs }))} />
                <RB icon={<Box {...I} />} label="View cube" active={tog.cube} onClick={() => setTog((t) => ({ ...t, cube: !t.cube }))} />
                <RB icon={<Hand {...I} />} label="Navigation bar" active={tog.nav} onClick={() => setTog((t) => ({ ...t, nav: !t.nav }))} />
              </Col>
            </Panel>
            <Panel title="Palettes">
              <Col>
                <RB icon={<List {...I} />} label="Properties" active={tog.props} onClick={() => setTog((t) => ({ ...t, props: !t.props }))} />
                <RB icon={<Folder {...I} />} label="Sheet Set Manager" active={tog.ssm} onClick={() => setTog((t) => ({ ...t, ssm: !t.ssm }))} />
                <RB icon={<Type {...I} />} label="Command line" active={tog.cmdline} onClick={() => setTog((t) => ({ ...t, cmdline: !t.cmdline }))} />
              </Col>
              <RB big icon={<Layers {...IB} />} label="Layer Manager" onClick={() => setLayMgr(true)} />
            </Panel>
            <Panel title="Display">
              <Col>
                <RB icon={<Hash {...I} />} label="Grid" active={tog.grid} onClick={() => setTog((t) => ({ ...t, grid: !t.grid }))} />
                <RB icon={<PenLine {...I} />} label="Lineweight" active={tog.lwt} onClick={() => setTog((t) => ({ ...t, lwt: !t.lwt }))} />
              </Col>
            </Panel>
          </>
        );
      case "Output":
        return (
          <>
            <Panel title="Plot">
              <RB big icon={<Printer {...IB} />} label="Plot" onClick={plot} />
              <RB
                big
                icon={<FileText {...IB} />}
                label="Batch Plot"
                onClick={() => {
                  printSheets(sheets, file, hiddenSet);
                  log(`PUBLISH ${sheets.length} layouts`);
                }}
              />
            </Panel>
            <Panel title="Export">
              <RB big icon={<Download {...IB} />} label="DXF (ทั้งไฟล์)" onClick={exportAll} />
              <Col>
                <RB icon={<Download {...I} />} label="DXF layout นี้" disabled={!paperSheet} onClick={() => paperSheet && (downloadDxf(paperSheet, hiddenSet), log(`DXFOUT ${paperSheet.code}.dxf`))} />
                <RB icon={<Download {...I} />} label="SVG layout นี้" disabled={!paperSheet} onClick={() => paperSheet && (downloadSvg(paperSheet, hiddenSet), log(`EXPORT ${paperSheet.code}.svg`))} />
              </Col>
            </Panel>
          </>
        );
      case "Insert":
        return (
          <>
            <Panel title="Block" disabled>
              <RB big disabled icon={<Box {...IB} />} label="Insert" />
              <RB big disabled icon={<Pentagon {...IB} />} label="Create" />
            </Panel>
            <Panel title="Reference" disabled>
              <RB big disabled icon={<Plus {...IB} />} label="Attach" />
              <RB big disabled icon={<FileText {...IB} />} label="PDF Import" />
            </Panel>
            <div className="self-center px-3 text-[12px] text-[#7c7c82]">ไฟล์เปิดแบบอ่านอย่างเดียว ไม่รองรับการแทรกวัตถุ</div>
          </>
        );
      case "Manage":
        return (
          <>
            <Panel title="Drawing">
              <RB big icon={<RotateCw {...IB} />} label="Regen" onClick={() => run("REGEN")} />
              <RB big icon={<Info {...IB} />} label="Status" onClick={() => run("STATUS")} />
              <Col>
                <RB icon={<Ruler {...I} />} label="Units" onClick={() => run("UNITS")} />
                <RB icon={<Layers {...I} />} label="Layer list" onClick={() => run("LAYER LIST")} />
                <RB disabled icon={<Scissors {...I} />} label="Purge" />
              </Col>
            </Panel>
          </>
        );
      case "Collaborate":
        return (
          <>
            <Panel title="Share">
              <RB big icon={<Share2 {...IB} />} label="Share link" onClick={share} />
              <Link href={`/blueprint/${spec.code}${paperSheet ? `?sheet=${paperSheet.id}` : ""}`} className="flex h-[58px] w-[72px] flex-col items-center justify-center gap-1 rounded-[6px] text-center text-[12px] leading-tight text-[#d6d6da] transition-colors duration-150 hover:bg-[#2b2b2e]">
                <FileText {...IB} />
                Blueprint viewer
              </Link>
            </Panel>
            <Panel title="Markup" disabled>
              <RB big disabled icon={<PenLine {...IB} />} label="Markup" />
              <RB big disabled icon={<Copy {...IB} />} label="Compare" />
            </Panel>
          </>
        );
    }
  };

  // ---------- JSX ----------
  return (
    <div ref={rootRef} className="flex h-[calc(100vh-88px)] min-h-[600px] flex-col overflow-hidden rounded-[12px] border border-[#2e2e31] bg-[#141415] text-[#ededed]">
      {/* title bar with quick access */}
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-[#2e2e31] bg-[#19191b] px-2">
        <span className="mr-1 grid size-7 place-items-center rounded-[6px] bg-[#232325]">
          <DraftingCompass size={16} strokeWidth={1.5} />
        </span>
        {(
          [
            [<FolderOpen key="o" {...I} />, "Open", () => router.push("/cad"), false],
            [<Save key="s" {...I} />, "Save (read-only)", undefined, true],
            [<Download key="d" {...I} />, "Save as DXF", exportAll, false],
            [<Printer key="p" {...I} />, "Plot", plot, false],
            [<Undo2 key="u" {...I} />, "Undo", undefined, true],
            [<Redo2 key="r" {...I} />, "Redo", undefined, true],
          ] as [React.ReactNode, string, (() => void) | undefined, boolean][]
        ).map(([ic, label, fn, dis]) => (
          <button key={label} type="button" title={label} aria-label={label} disabled={dis} onClick={fn} className={cx("grid size-7 place-items-center rounded-[6px]", dis ? "text-[#5a5a60]" : "text-[#d6d6da] hover:bg-[#2b2b2e]")}>
            {ic}
          </button>
        ))}
        <select
          value={workspace}
          onChange={(e) => {
            setWorkspace(e.target.value);
            log(`Workspace: ${e.target.value}`);
          }}
          aria-label="Workspace"
          className="ml-2 h-6 rounded-[4px] border border-[#3a3a3f] bg-[#141415] px-1.5 text-[12px] text-[#ededed] outline-none"
        >
          <option>Drafting & Annotation</option>
          <option>Review (read-only)</option>
          <option disabled>3D Modeling (ไม่รองรับ)</option>
        </select>
        <span className="mx-auto truncate px-3 text-[13px] text-[#c9c9ce]">
          {file} — CAD Viewer (DWG/DXF){project ? ` · ${project.id}` : ""}
        </span>
        <label className="flex h-6 w-[220px] items-center gap-1.5 rounded-[4px] border border-[#3a3a3f] bg-[#141415] px-1.5 text-[#7c7c82]">
          <Search size={14} strokeWidth={1.5} />
          <input
            placeholder="Type a keyword or phrase"
            className="w-full bg-transparent text-[12px] text-[#ededed] outline-none placeholder:text-[#7c7c82]"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const v = (e.target as HTMLInputElement).value;
                log(`Command: FIND ${v}`);
                find(v);
              }
            }}
          />
        </label>
        <button type="button" title="Help" aria-label="Help" onClick={() => run("HELP")} className="grid size-7 place-items-center rounded-[6px] text-[#d6d6da] hover:bg-[#2b2b2e]">
          <CircleQuestionMark {...I} />
        </button>
      </div>

      {/* ribbon */}
      <div className="shrink-0 border-b border-[#2e2e31] bg-[#1d1d20]">
        <div className="flex h-7 items-end gap-0.5 px-2">
          {TABS.map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} className={cx("h-6 rounded-t-[6px] px-3 text-[12px] transition-colors duration-150", tab === t ? "bg-[#26262a] text-[#ededed]" : t === "Insert" ? "text-[#5a5a60] hover:text-[#a8a8ad]" : "text-[#a8a8ad] hover:text-[#ededed]")}>
              {t}
            </button>
          ))}
          <span className="ml-auto pb-1 text-[11px] text-[#7c7c82]">{workspace} · Read-only</span>
        </div>
        <div className="flex h-[92px] items-stretch overflow-x-auto bg-[#26262a]">{ribbon()}</div>
      </div>

      {/* file tabs */}
      <div className="flex h-8 shrink-0 items-end gap-0.5 border-b border-[#2e2e31] bg-[#19191b] px-2">
        <Link href="/cad" className="flex h-7 items-center rounded-t-[6px] px-3 text-[12px] text-[#a8a8ad] hover:bg-[#232325] hover:text-[#ededed]">
          Start
        </Link>
        <span className="flex h-7 items-center gap-2 rounded-t-[6px] bg-[#232325] px-3 text-[12px]">
          <DraftingCompass size={14} strokeWidth={1.5} className="text-[#a8a8ad]" />
          {file.replace(/\.dwg$/, "")}
          <Link href="/cad" aria-label="ปิดไฟล์" className="grid size-4 place-items-center rounded-[3px] text-[#7c7c82] hover:bg-[#3a3a3f] hover:text-[#ededed]">
            <X size={12} strokeWidth={1.5} />
          </Link>
        </span>
        <span className="grid h-7 w-7 place-items-center text-[#5a5a60]" title="New drawing (read-only)">
          <Plus size={14} strokeWidth={1.5} />
        </span>
      </div>

      {/* work area */}
      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1" style={{ background: paperSheet ? "#2b2b2e" : "#1b1b1d" }}>
          <style>{css}</style>
          <div
            ref={boxRef}
            className={cx("absolute inset-0 touch-none select-none", m?.k === "PAN" ? "cursor-grab active:cursor-grabbing" : "cursor-none")}
            onPointerLeave={() => {
              if (crossRef.current) crossRef.current.style.opacity = "0";
            }}
          >
            <svg ref={svgRef} className={cx(SCOPE, "block h-full w-full")} role="img" aria-label={paperSheet ? `Layout ${paperSheet.id}` : "Model space"}>
              {client && (
                <>
                  <defs>
                    <pattern id="cadgrid" width={gridStep} height={gridStep} patternUnits="userSpaceOnUse">
                      <path d={`M ${gridStep} 0 L 0 0 0 ${gridStep}`} fill="none" stroke="#26262a" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                    </pattern>
                    <pattern id="cadgrid5" width={gridStep * 5} height={gridStep * 5} patternUnits="userSpaceOnUse">
                      <rect width={gridStep * 5} height={gridStep * 5} fill="url(#cadgrid)" />
                      <path d={`M ${gridStep * 5} 0 L 0 0 0 ${gridStep * 5}`} fill="none" stroke="#2f2f34" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                    </pattern>
                  </defs>
                  {tog.grid && !paperSheet && <rect x={view.x} y={view.y} width={view.w / view.s} height={view.h / view.s} fill="url(#cadgrid5)" />}
                  {!paperSheet && (
                    <>
                      <line x1={view.x} x2={view.x + view.w / view.s} y1={0} y2={0} stroke="#5a2a2a" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                      <line y1={view.y} y2={view.y + view.h / view.s} x1={0} x2={0} stroke="#2a5a2a" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                    </>
                  )}
                  {paperSheet && <rect x={paperSheet.w * 0.006} y={-paperSheet.h + paperSheet.h * 0.008} width={paperSheet.w} height={paperSheet.h} fill="rgba(0,0,0,0.45)" />}
                  {pl.map((p) => (
                    <SheetMarkup key={p.sheet.id} sheet={p.sheet} lite={paperSheet ? false : lod(p)} transform={`translate(${p.x} ${-(p.y + p.sheet.h)})`} />
                  ))}
                  {selMarkup && <g className="sel" transform={selMarkup.t} dangerouslySetInnerHTML={{ __html: selMarkup.html }} />}
                  {found &&
                    found.hits.map((h, i) => (
                      <rect key={i} className="fd" x={h.p.x + h.bb[0] - 0.2} y={-(h.p.y + h.bb[3]) - 0.2} width={h.bb[2] - h.bb[0] + 0.4} height={h.bb[3] - h.bb[1] + 0.4} opacity={i === found.i ? 1 : 0.45} />
                    ))}
                  {m?.k === "ZOOMW" && ghostPts.length === 2 && (
                    <rect className="gh fl" x={Math.min(ghostPts[0][0], ghostPts[1][0])} y={-Math.max(ghostPts[0][1], ghostPts[1][1])} width={Math.abs(ghostPts[1][0] - ghostPts[0][0])} height={Math.abs(ghostPts[1][1] - ghostPts[0][1])} strokeDasharray="4 3" />
                  )}
                  {(m?.k === "DIST" || m?.k === "AREA") && ghostPts.length >= 2 && <polyline className={cx("gh", m.k === "AREA" && "fl")} points={(m.k === "AREA" ? [...ghostPts, ghostPts[0]] : ghostPts).map(sv).join(" ")} />}
                  {m && "pts" in m && m.pts.map((p, i) => <rect key={i} className="gh" x={p[0] - snapSize * 0.6} y={-p[1] - snapSize * 0.6} width={snapSize * 1.2} height={snapSize * 1.2} />)}
                  {ghost?.snap && <rect className="sn" x={ghost.cur[0] - snapSize} y={-ghost.cur[1] - snapSize} width={snapSize * 2} height={snapSize * 2} />}
                </>
              )}
            </svg>
          </div>

          {/* crosshair */}
          {m?.k !== "PAN" && (
            <div ref={crossRef} className="pointer-events-none absolute left-0 top-0 z-[5] opacity-0">
              <span className="absolute -left-[60px] top-0 h-px w-[120px] bg-[#d6d6da]/80" />
              <span className="absolute -top-[60px] left-0 h-[120px] w-px bg-[#d6d6da]/80" />
              <span className="absolute -left-[5px] -top-[5px] size-[11px] border border-[#d6d6da]" />
            </div>
          )}

          <span className="pointer-events-none absolute left-2 top-1.5 z-10 text-[12px] text-[#a8a8ad]">[-][Top][2D Wireframe]{paperSheet ? ` · Layout ${paperSheet.id} ${paperSheet.titleTh}` : ""}</span>

          {/* UCS icon */}
          {tog.ucs && (
            <svg className="pointer-events-none absolute bottom-[132px] left-4 z-10" width="64" height="64" viewBox="0 0 64 64" aria-hidden>
              <path d="M8 56 H56" stroke="#ff4d4d" strokeWidth="1.5" />
              <path d="M56 56 l-7 -3 v6z" fill="#ff4d4d" />
              <path d="M8 56 V8" stroke="#5ee85e" strokeWidth="1.5" />
              <path d="M8 8 l-3 7 h6z" fill="#5ee85e" />
              <rect x="4" y="52" width="8" height="8" fill="none" stroke="#ededed" strokeWidth="1" />
              <text x="58" y="52" fill="#ff4d4d" fontSize="10" fontFamily="monospace">
                X
              </text>
              <text x="12" y="10" fill="#5ee85e" fontSize="10" fontFamily="monospace">
                Y
              </text>
            </svg>
          )}

          {/* view cube */}
          {tog.cube && (
            <div className="absolute right-4 top-4 z-10 flex flex-col items-center">
              <button type="button" onClick={() => run("ZOOM E")} title="Top · Zoom extents" className="relative grid size-[92px] place-items-center rounded-full border-[6px] border-[#3a3a3f]/80">
                <span className="grid h-9 w-11 place-items-center border border-[#6a6a70] bg-[#2b2b2e] text-[11px] text-[#ededed]">TOP</span>
                <span className="absolute -top-[13px] text-[10px] text-[#ededed]">N</span>
                <span className="absolute -bottom-[13px] text-[10px] text-[#a8a8ad]">S</span>
                <span className="absolute -left-[12px] text-[10px] text-[#a8a8ad]">W</span>
                <span className="absolute -right-[11px] text-[10px] text-[#a8a8ad]">E</span>
              </button>
              <span className="mt-3 rounded-[4px] border border-[#3a3a3f] bg-[#19191b] px-1.5 text-[11px] text-[#a8a8ad]">WCS</span>
            </div>
          )}

          {/* navigation bar */}
          {tog.nav && (
            <div className="absolute right-6 top-[150px] z-10 flex flex-col gap-0.5 rounded-[8px] border border-[#3a3a3f] bg-[#19191b]/95 p-1">
              <NavBtn label="Pan" active={m?.k === "PAN"} onClick={() => run("PAN")}>
                <Hand {...I} />
              </NavBtn>
              <NavBtn label="Zoom extents" onClick={() => run("ZOOM E")}>
                <Expand {...I} />
              </NavBtn>
              <NavBtn label="Zoom window" active={m?.k === "ZOOMW"} onClick={() => run("ZOOM W")}>
                <ScanSearch {...I} />
              </NavBtn>
              <NavBtn label="Zoom in" onClick={() => run("ZOOM IN")}>
                <ZoomIn {...I} />
              </NavBtn>
              <NavBtn label="Zoom out" onClick={() => run("ZOOM OUT")}>
                <ZoomOut {...I} />
              </NavBtn>
            </div>
          )}

          {/* command line */}
          {tog.cmdline && (
            <div className="absolute bottom-3 left-1/2 z-20 w-[min(760px,calc(100%-180px))] -translate-x-1/2 overflow-hidden rounded-[6px] border border-[#3a3a3f] bg-[#19191b]/95 shadow-[0_6px_18px_rgba(0,0,0,0.4)]">
              <div className={cx("overflow-y-auto px-3 py-1.5 font-mono text-[12px] leading-[18px] text-[#c9c9ce]", histOpen ? "max-h-[300px]" : "max-h-[74px]")} ref={(el) => el?.scrollTo(0, el.scrollHeight)}>
                {[...intro, ...hist].slice(histOpen ? -300 : -4).map((h, i) => (
                  <div key={i} className="whitespace-pre-wrap">
                    {h}
                  </div>
                ))}
              </div>
              <form
                className="flex h-8 items-center gap-2 border-t border-[#2e2e31] bg-[#ededed] px-2 text-[#141415]"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(cmd);
                  setCmd("");
                }}
              >
                <button type="button" aria-label="ยกเลิกคำสั่ง" onClick={cancel} className="text-[#5a5a60] hover:text-[#141415]">
                  <X size={14} strokeWidth={1.5} />
                </button>
                <span className="font-mono text-[12px] text-[#5a5a60]">{">_"}</span>
                <input ref={cmdRef} value={cmd} onChange={(e) => setCmd(e.target.value)} placeholder={prompt} aria-label="Command line" className="min-w-0 flex-1 bg-transparent font-mono text-[13px] outline-none placeholder:text-[#5a5a60]" spellCheck={false} autoComplete="off" />
                <button type="button" aria-label="ประวัติคำสั่ง (F2)" title="ประวัติคำสั่ง (F2)" onClick={() => setHistOpen((o) => !o)} className="text-[#5a5a60] hover:text-[#141415]">
                  <ChevronDown size={14} strokeWidth={1.5} className={cx("transition-transform duration-150", !histOpen && "rotate-180")} />
                </button>
              </form>
            </div>
          )}
          {layMgr && <LayerManager ls={ls} counts={counts} onToggle={toggleLayer} onCurrent={(n) => setLs((s) => ({ ...s, current: n }))} onAll={() => setLs((s) => ({ ...s, off: new Set(), frozen: new Set() }))} onClose={() => setLayMgr(false)} />}
        </div>

        {/* palettes */}
        {(tog.props || tog.ssm) && (
          <aside className="flex w-[300px] shrink-0 flex-col border-l border-[#2e2e31] bg-[#19191b]">
            {tog.props && (
              <section className={cx("flex min-h-0 flex-col", tog.ssm ? "h-[55%]" : "flex-1")}>
                <div className="flex h-7 items-center justify-between bg-[#232325] px-2 text-[11px] text-[#a8a8ad]">
                  PROPERTIES
                  <button type="button" aria-label="ปิด Properties" onClick={() => setTog((t) => ({ ...t, props: false }))}>
                    <X size={12} strokeWidth={1.5} />
                  </button>
                </div>
                <div className="border-b border-[#2e2e31] p-1.5">
                  <div className="flex h-6 items-center rounded-[4px] border border-[#3a3a3f] bg-[#141415] px-1.5 text-[12px]">{sel ? `${TYPE_NAME[sel.prim.t]} (1)` : "No selection"}</div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <PropHead>General</PropHead>
                  <PropRow k="Color" v={<span className="inline-flex items-center gap-1.5"><span className="size-2.5 border border-[#4a4a4f]" style={{ background: selLayer ? ACI_HEX[selLayer.aci] : "#ededed" }} />ByLayer</span>} />
                  <PropRow k="Layer" v={sel ? sel.prim.l : ls.current} />
                  <PropRow k="Linetype" v={sel && "lt" in sel.prim && sel.prim.lt ? sel.prim.lt : "ByLayer"} />
                  <PropRow k="Linetype scale" v="1.0000" />
                  <PropRow k="Lineweight" v={sel && "w" in sel.prim && sel.prim.w ? `${sel.prim.w.toFixed(2)} mm` : selLayer ? `ByLayer (${selLayer.lw.toFixed(2)})` : "ByLayer"} />
                  <PropRow k="Transparency" v={sel?.prim.o ? `${Math.round((1 - sel.prim.o) * 100)}` : "ByLayer"} />
                  <PropRow k="Thickness" v="0.0000" />
                  {sel ? (
                    <>
                      <PropHead>Geometry · {sel.p.sheet.id}</PropHead>
                      {describe(sel.prim, sel.p.x, sel.p.y).map(([k, v]) => (
                        <PropRow key={k} k={k} v={v} mono={k !== "Contents"} />
                      ))}
                      {selAsset && (
                        <>
                          <PropHead>Equipment · อุปกรณ์</PropHead>
                          <div className="space-y-1.5 px-2 py-2 text-[12px]">
                            <AssetTag code={selAsset.code} />
                            <p className="text-[13px] text-[#ededed]">{selAsset.name}</p>
                            <p className="text-[#a8a8ad]">
                              {roomOf(model, selAsset.room)?.name ?? selAsset.room} · ชั้น {selAsset.floor} · {selAsset.brand}
                            </p>
                            <p className="text-[#a8a8ad]">
                              ประกันถึง {thDate(selAsset.warrantyUntil)} · <span className={selAsset.warrantyUntil >= TODAY ? "text-[#5ee85e]" : "text-[#ff4d4d]"}>{selAsset.warrantyUntil >= TODAY ? "อยู่ในประกัน" : "หมดประกัน"}</span>
                            </p>
                            <Link href={`/repairs?new=${encodeURIComponent(selAsset.code)}`} className="mt-1 inline-flex h-7 items-center gap-1.5 rounded-[6px] bg-[#ededed] px-2.5 text-[12px] font-medium text-[#141415] hover:bg-white">
                              <Wrench size={14} strokeWidth={1.5} /> แจ้งซ่อม
                            </Link>
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <PropHead>Plot style</PropHead>
                      <PropRow k="Plot style" v="ByColor" />
                      <PropRow k="Plot style table" v="monochrome.ctb" />
                      <PropRow k="Plotted attached to" v={paperSheet ? "Layout" : "Model"} />
                      <PropHead>View</PropHead>
                      <PropRow k="Center X" v={(view.x + view.w / view.s / 2).toFixed(4)} />
                      <PropRow k="Center Y" v={(-(view.y + view.h / view.s / 2)).toFixed(4)} />
                      <PropRow k="Height" v={(view.h / view.s).toFixed(4)} />
                      <PropRow k="Width" v={(view.w / view.s).toFixed(4)} />
                      <PropHead>Misc</PropHead>
                      <PropRow k="Annotation scale" v={curScale} />
                      <PropRow k="UCS name" v="WCS" />
                      <PropRow k="Units" v="Meters" />
                    </>
                  )}
                </div>
              </section>
            )}
            {tog.ssm && (
              <section className="flex min-h-0 flex-1 flex-col border-t border-[#2e2e31]">
                <div className="flex h-7 items-center justify-between bg-[#232325] px-2 text-[11px] text-[#a8a8ad]">
                  SHEET SET MANAGER
                  <button type="button" aria-label="ปิด Sheet Set Manager" onClick={() => setTog((t) => ({ ...t, ssm: false }))}>
                    <X size={12} strokeWidth={1.5} />
                  </button>
                </div>
                <div className="border-b border-[#2e2e31] p-1.5">
                  <div className="flex h-6 items-center gap-1.5 rounded-[4px] border border-[#3a3a3f] bg-[#141415] px-1.5 text-[12px]">
                    <FileText size={14} strokeWidth={1.5} className="text-[#a8a8ad]" />
                    {spec.code} {spec.name}
                  </div>
                  <div className="mt-1.5 flex gap-3 px-1 text-[12px]">
                    {(
                      [
                        ["list", "Sheet List"],
                        ["views", "Sheet Views"],
                        ["model", "Model Views"],
                      ] as const
                    ).map(([k, l]) => (
                      <button key={k} type="button" onClick={() => setSsmTab(k)} className={cx("border-b pb-0.5", ssmTab === k ? "border-[#ededed] text-[#ededed]" : "border-transparent text-[#7c7c82] hover:text-[#c9c9ce]")}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto py-1 text-[12px]">
                  {ssmTab === "model" ? (
                    <>
                      <button type="button" onClick={() => (switchLayout("Model"), requestAnimationFrame(() => fitWorld(extents(modelPl))))} className="flex w-full items-center gap-2 px-2 py-1 text-left hover:bg-[#232325]">
                        <LayoutGrid size={14} strokeWidth={1.5} className="text-[#a8a8ad]" /> Model space · ทุกแผ่น
                      </button>
                      {DISCIPLINES.map((d) => {
                        const row = modelPl.filter((p) => p.sheet.disc === d.key);
                        if (!row.length) return null;
                        return (
                          <button key={d.key} type="button" onClick={() => (switchLayout("Model"), requestAnimationFrame(() => fitWorld(extents(row))))} className="flex w-full items-center gap-2 px-2 py-1 pl-6 text-left hover:bg-[#232325]">
                            <Eye size={14} strokeWidth={1.5} className="text-[#7c7c82]" /> {d.key} — {d.th} <span className="ml-auto pr-1 font-mono text-[#7c7c82]">{row.length}</span>
                          </button>
                        );
                      })}
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 px-2 py-1 font-medium">
                        <FileText size={14} strokeWidth={1.5} className="text-[#a8a8ad]" /> {spec.code} {spec.name}
                        <span className="ml-auto font-mono text-[#7c7c82]">{sheets.length}</span>
                      </div>
                      {DISCIPLINES.map((d) => {
                        const row = sheets.filter((s) => s.disc === d.key);
                        if (!row.length) return null;
                        const open = !ssmClosed.has(d.key);
                        return (
                          <div key={d.key}>
                            <button
                              type="button"
                              onClick={() =>
                                setSsmClosed((c) => {
                                  const n = new Set(c);
                                  if (n.has(d.key)) n.delete(d.key);
                                  else n.add(d.key);
                                  return n;
                                })
                              }
                              className="flex w-full items-center gap-1.5 px-2 py-1 pl-3 text-left hover:bg-[#232325]"
                            >
                              <ChevronDown size={12} strokeWidth={1.5} className={cx("text-[#7c7c82] transition-transform duration-150", !open && "-rotate-90")} />
                              <Folder size={14} strokeWidth={1.5} className="text-[#ffe14d]" />
                              <span>
                                {d.key} — {d.th} <span className="text-[#7c7c82]">{d.en}</span>
                              </span>
                              <span className="ml-auto pr-1 font-mono text-[#7c7c82]">{row.length}</span>
                            </button>
                            {open &&
                              row.map((s) => (
                                <button key={s.id} type="button" onClick={() => switchLayout(s.id)} className={cx("flex w-full items-center gap-2 py-[3px] pl-10 pr-2 text-left hover:bg-[#232325]", layout === s.id && "bg-[#2b2b2e]")}>
                                  <FileText size={12} strokeWidth={1.5} className="shrink-0 text-[#a8a8ad]" />
                                  <span className="font-mono text-[#ededed]">{s.id}</span>
                                  <span className="truncate text-[#a8a8ad]">{ssmTab === "views" ? `1 - ${s.titleEn}` : `- ${s.titleTh}`}</span>
                                </button>
                              ))}
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              </section>
            )}
          </aside>
        )}
      </div>

      {/* layout tabs */}
      <div className="flex h-7 shrink-0 items-center border-t border-[#2e2e31] bg-[#19191b]">
        <button type="button" aria-label="เลื่อนแท็บซ้าย" onClick={() => tabsRef.current?.scrollBy({ left: -240, behavior: "smooth" })} className="grid h-full w-6 place-items-center text-[#a8a8ad] hover:text-[#ededed]">
          <ChevronLeft size={14} strokeWidth={1.5} />
        </button>
        <button type="button" aria-label="เลื่อนแท็บขวา" onClick={() => tabsRef.current?.scrollBy({ left: 240, behavior: "smooth" })} className="grid h-full w-6 place-items-center text-[#a8a8ad] hover:text-[#ededed]">
          <ChevronRight size={14} strokeWidth={1.5} />
        </button>
        <div ref={tabsRef} className="flex h-full min-w-0 flex-1 items-stretch overflow-x-auto [scrollbar-width:none]">
          {["Model", ...sheets.map((s) => s.id)].map((id) => (
            <button key={id} type="button" onClick={() => switchLayout(id)} title={id === "Model" ? "Model space" : sheets.find((s) => s.id === id)?.titleTh} className={cx("shrink-0 border-r border-[#2e2e31] px-3 font-mono text-[12px]", layout === id ? "bg-[#2e2e33] text-[#ededed]" : "text-[#a8a8ad] hover:bg-[#232325]")}>
              {id}
            </button>
          ))}
          <span className="grid w-7 shrink-0 place-items-center text-[#5a5a60]" title="New layout (read-only)">
            <Plus size={12} strokeWidth={1.5} />
          </span>
        </div>
      </div>

      {/* status bar */}
      <div className="flex h-7 shrink-0 items-center gap-1 border-t border-[#2e2e31] bg-[#141415] px-2 text-[12px] text-[#a8a8ad]">
        <span ref={coordRef} className="w-[230px] font-mono text-[#c9c9ce]">
          0.0000, 0.0000, 0.0000
        </span>
        <button type="button" onClick={() => switchLayout(paperSheet ? "Model" : sheets[1]?.id ?? sheets[0].id)} className="rounded-[4px] px-2 font-mono text-[#ededed] hover:bg-[#232325]" title="สลับ Model / Paper space">
          {paperSheet ? "PAPER" : "MODEL"}
        </button>
        {(
          [
            ["grid", "GRID", "F7"],
            ["snap", "SNAP", "F9"],
            ["ortho", "ORTHO", "F8"],
            ["osnap", "OSNAP", "F3"],
            ["lwt", "LWT", ""],
          ] as const
        ).map(([k, l, fk]) => (
          <button key={k} type="button" aria-pressed={tog[k]} title={`${l}${fk ? ` (${fk})` : ""}`} onClick={() => setTog((t) => ({ ...t, [k]: !t[k] }))} className={cx("rounded-[4px] px-1.5 font-mono text-[11px]", tog[k] ? "bg-[#2b3a52] text-[#8ab4ff]" : "text-[#7c7c82] hover:bg-[#232325]")}>
            {l}
          </button>
        ))}
        <span className="ml-auto truncate text-[#7c7c82]">
          Loaded {set.entities.toLocaleString()} objects · {sheets.length} layouts · {set.layers.length} layers
        </span>
        <span className="ml-3 font-mono">{client ? set.ms.toFixed(1) : "…"} ms</span>
        <span className="ml-3 font-mono text-[#ededed]">{curScale}</span>
        <span className="ml-3">Meters</span>
        <span className="ml-3 w-14 text-right font-mono">{zoomPct}%</span>
        <button type="button" onClick={toggleFull} aria-label={full ? "ออกจากเต็มจอ" : "เต็มจอ"} className="ml-2 grid size-6 place-items-center rounded-[4px] hover:bg-[#232325]">
          {full ? <Minimize size={14} strokeWidth={1.5} /> : <Maximize size={14} strokeWidth={1.5} />}
        </button>
      </div>
    </div>
  );
}


function NavBtn({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" title={label} aria-label={label} onClick={onClick} className={cx("grid size-8 place-items-center rounded-[6px]", active ? "bg-[#33363d] text-[#ededed]" : "text-[#d6d6da] hover:bg-[#2b2b2e]")}>
      {children}
    </button>
  );
}
