"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import Link from "next/link";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import type { MapPoint } from "./project-map";

const VIEWS = {
  bkk: { center: [13.82, 100.58] as [number, number], zoom: 9 },
  all: { center: [15.6, 100.9] as [number, number], zoom: 6 },
};

function View({ view }: { view: keyof typeof VIEWS }) {
  const map = useMap();
  useEffect(() => {
    map.setView(VIEWS[view].center, VIEWS[view].zoom, { animate: true });
  }, [map, view]);
  return null;
}

export default function LeafletMap({ points, view }: { points: MapPoint[]; view: keyof typeof VIEWS }) {
  return (
    <MapContainer center={VIEWS[view].center} zoom={VIEWS[view].zoom} scrollWheelZoom={false} className="h-full w-full" style={{ background: "var(--raised)" }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <View view={view} />
      {points.map((p) => (
        <CircleMarker
          key={p.id}
          center={[p.lat, p.lng]}
          radius={p.active ? 7 : 5}
          pathOptions={{ color: "#fdfbf7", weight: 1.5, fillColor: p.color, fillOpacity: 0.95 }}
        >
          <Popup>
            <div className="min-w-[180px] font-sans text-[13px] leading-[20px] text-ink">
              <p className="font-mono text-[11px] text-ink-3">{p.id}</p>
              <p className="font-medium">{p.name}</p>
              <p className="text-ink-2">
                {p.model} · {p.province}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-ink-2">
                <span className="inline-block size-1.5 rounded-full" style={{ background: p.color }} />
                {p.statusLabel}
                {p.active && <span className="num font-mono text-[12px]">· {p.actual}%</span>}
              </p>
              <Link href={`/projects/${p.id}`} className="mt-1.5 inline-block text-accent-text underline-offset-2 hover:underline">
                เปิดโครงการ
              </Link>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
