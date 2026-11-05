"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { MapPoint } from "./project-map";

const VIEWS = {
  bkk: { center: [13.82, 100.58] as [number, number], zoom: 9 },
  all: { center: [15.6, 100.9] as [number, number], zoom: 6 },
};

export default function LeafletMap({ points, view }: { points: MapPoint[]; view: keyof typeof VIEWS }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    let map: import("leaflet").Map | undefined;
    // Own the map and its layers in the same effect. Cached route reactivation
    // must create fresh panes instead of reusing a React Leaflet context whose
    // map was removed when the route became inactive.
    void import("leaflet").then((L) => {
      if (cancelled || !host.current) return;
      map = L.map(host.current, { center: VIEWS[view].center, zoom: VIEWS[view].zoom, scrollWheelZoom: false });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      for (const p of points) {
        const popup = document.createElement("div");
        popup.className = "min-w-[180px] font-sans text-[13px] leading-[20px] text-ink";
        for (const [text, cls] of [[p.id, "font-mono text-[11px] text-ink-3"], [p.name, "font-medium"], [p.model + " · " + p.province, "text-ink-2"], [p.statusLabel + (p.active ? " · " + p.actual + "%" : ""), "mt-1 text-ink-2"]]) {
          const line = document.createElement("p");
          line.textContent = text;
          line.className = cls;
          popup.append(line);
        }
        const link = document.createElement("a");
        link.href = "/projects/" + encodeURIComponent(p.id);
        link.textContent = "เปิดโครงการ";
        link.className = "mt-1.5 inline-block text-accent-text underline-offset-2 hover:underline";
        popup.append(link);
        L.circleMarker([p.lat, p.lng], { radius: p.active ? 7 : 5, color: "#ffffff", weight: 1.5, fillColor: p.color, fillOpacity: .95 }).bindPopup(popup).addTo(map);
      }
      map.invalidateSize();
    });
    return () => { cancelled = true; map?.remove(); };
  }, [points, view]);
  return <div ref={host} role="region" aria-label="แผนที่ตำแหน่งโครงการ" className="h-full w-full" style={{ background: "var(--raised)" }} />;
}
