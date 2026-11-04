"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** x, y: SVG user coordinates at the container's top-left; s: screen px per unit */
export type View = { x: number; y: number; s: number; w: number; h: number };

type Opts = {
  /** whether a left-button drag pans (middle button always pans) */
  leftPans?: () => boolean;
  onClick?: (wx: number, wy: number, e: PointerEvent) => void;
  onMove?: (wx: number, wy: number, e: PointerEvent) => void;
  minS?: number;
  maxS?: number;
};

/**
 * Pan/zoom by writing the SVG viewBox directly. React state is updated at
 * most once per frame for overlays (zoom %, scale bar, minimap), so the
 * heavy drawing markup never re-renders while the user navigates.
 */
const INIT: View = { x: 0, y: 0, s: 1, w: 1, h: 1 };

export function useViewport(opts: Opts = {}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const v = useRef<View>(INIT);
  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  });
  const [view, setView] = useState<View>(INIT);
  const raf = useRef(0);

  const apply = useCallback(() => {
    const box = boxRef.current;
    const svg = svgRef.current;
    if (!box || !svg) return;
    const cur = { ...v.current, w: box.clientWidth || 1, h: box.clientHeight || 1 };
    v.current = cur;
    svg.setAttribute("viewBox", `${cur.x} ${cur.y} ${cur.w / cur.s} ${cur.h / cur.s}`);
    if (!raf.current)
      raf.current = requestAnimationFrame(() => {
        raf.current = 0;
        setView({ ...v.current });
      });
  }, []);

  const fit = useCallback(
    (bb: [number, number, number, number], pad = 0.04) => {
      const box = boxRef.current;
      if (!box) return;
      const w = box.clientWidth || 1;
      const h = box.clientHeight || 1;
      const bw = (bb[2] - bb[0]) * (1 + pad * 2);
      const bh = (bb[3] - bb[1]) * (1 + pad * 2);
      const s = Math.min(w / bw, h / bh);
      v.current = { ...v.current, s, x: (bb[0] + bb[2]) / 2 - w / s / 2, y: (bb[1] + bb[3]) / 2 - h / s / 2 };
      apply();
    },
    [apply],
  );

  const zoomAt = useCallback(
    (px: number, py: number, f: number) => {
      const cur = v.current;
      const min = optsRef.current.minS ?? 1e-4;
      const max = optsRef.current.maxS ?? 1e5;
      const s = Math.max(min, Math.min(max, cur.s * f));
      const wx = cur.x + px / cur.s;
      const wy = cur.y + py / cur.s;
      v.current = { ...cur, s, x: wx - px / s, y: wy - py / s };
      apply();
    },
    [apply],
  );

  const zoom = useCallback((f: number) => zoomAt(v.current.w / 2, v.current.h / 2, f), [zoomAt]);

  const panBy = useCallback(
    (dx: number, dy: number) => {
      const cur = v.current;
      v.current = { ...cur, x: cur.x - dx / cur.s, y: cur.y - dy / cur.s };
      apply();
    },
    [apply],
  );

  const centerOn = useCallback(
    (wx: number, wy: number, s?: number) => {
      const cur = v.current;
      const ns = s ?? cur.s;
      v.current = { ...cur, s: ns, x: wx - cur.w / ns / 2, y: wy - cur.h / ns / 2 };
      apply();
    },
    [apply],
  );

  const toWorld = useCallback((clientX: number, clientY: number): [number, number] => {
    const box = boxRef.current;
    const r = box?.getBoundingClientRect();
    const cur = v.current;
    return [cur.x + (clientX - (r?.left ?? 0)) / cur.s, cur.y + (clientY - (r?.top ?? 0)) / cur.s];
  }, []);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = box.getBoundingClientRect();
      const f = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0018));
      zoomAt(e.clientX - r.left, e.clientY - r.top, f);
    };
    let drag: { id: number; x: number; y: number; moved: boolean; pan: boolean } | null = null;
    const down = (e: PointerEvent) => {
      if (e.button !== 0 && e.button !== 1) return;
      const pan = e.button === 1 || (optsRef.current.leftPans?.() ?? true);
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, pan };
      if (e.button === 1) e.preventDefault();
    };
    const move = (e: PointerEvent) => {
      if (drag && drag.id === e.pointerId) {
        const dx = e.clientX - drag.x;
        const dy = e.clientY - drag.y;
        if (!drag.moved && Math.hypot(dx, dy) > 4) {
          drag.moved = true;
          if (drag.pan) box.setPointerCapture(e.pointerId);
        }
        if (drag.moved && drag.pan) {
          panBy(dx, dy);
          drag.x = e.clientX;
          drag.y = e.clientY;
        }
      }
      const [wx, wy] = toWorld(e.clientX, e.clientY);
      optsRef.current.onMove?.(wx, wy, e);
    };
    const up = (e: PointerEvent) => {
      if (!drag || drag.id !== e.pointerId) return;
      const wasClick = !drag.moved;
      const btn = e.button;
      drag = null;
      if (box.hasPointerCapture(e.pointerId)) box.releasePointerCapture(e.pointerId);
      if (wasClick && btn === 0) {
        const [wx, wy] = toWorld(e.clientX, e.clientY);
        optsRef.current.onClick?.(wx, wy, e);
      }
    };
    const aux = (e: MouseEvent) => e.button === 1 && e.preventDefault();
    box.addEventListener("wheel", wheel, { passive: false });
    box.addEventListener("pointerdown", down);
    box.addEventListener("pointermove", move);
    box.addEventListener("pointerup", up);
    box.addEventListener("pointercancel", up);
    box.addEventListener("auxclick", aux);
    box.addEventListener("mousedown", aux);
    const ro = new ResizeObserver(() => apply());
    ro.observe(box);
    return () => {
      box.removeEventListener("wheel", wheel);
      box.removeEventListener("pointerdown", down);
      box.removeEventListener("pointermove", move);
      box.removeEventListener("pointerup", up);
      box.removeEventListener("pointercancel", up);
      box.removeEventListener("auxclick", aux);
      box.removeEventListener("mousedown", aux);
      ro.disconnect();
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = 0;
    };
  }, [apply, panBy, toWorld, zoomAt]);

  const get = useCallback(() => v.current, []);

  return { boxRef, svgRef, view, fit, zoom, zoomAt, panBy, centerOn, toWorld, get };
}

export function niceLength(target: number) {
  const p = Math.pow(10, Math.floor(Math.log10(target)));
  for (const k of [1, 2, 5, 10]) if (k * p >= target) return k * p;
  return 10 * p;
}
