"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { Vec3 } from "@/lib/house";

export type Label = { id: string; text: string; pos: Vec3 };

function makeTexture(text: string, font: string, dark: boolean) {
  const scale = 2;
  const px = 22 * scale;
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d")!;
  ctx.font = `500 ${px}px ${font}`;
  const w = Math.ceil(ctx.measureText(text).width) + 24 * scale;
  const h = px + 16 * scale;
  c.width = w;
  c.height = h;
  ctx.font = `500 ${px}px ${font}`;
  ctx.fillStyle = dark ? "rgba(31,27,22,0.86)" : "rgba(253,251,247,0.92)";
  const r = 8 * scale;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, r);
  ctx.fill();
  ctx.strokeStyle = dark ? "rgba(239,233,222,0.18)" : "rgba(31,27,22,0.14)";
  ctx.lineWidth = scale;
  ctx.stroke();
  ctx.fillStyle = dark ? "#efe9de" : "#1f1b16";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 12 * scale, h / 2 + scale);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { tex, aspect: w / h };
}

/** Room name tags as camera-facing sprites drawn on a canvas (no DOM overlay, so nothing to unmount) */
export function RoomLabels({ labels, dark, offset }: { labels: Label[]; dark: boolean; offset?: (l: Label) => number }) {
  const sprites = useMemo(() => {
    if (typeof document === "undefined") return [];
    const font = getComputedStyle(document.body).fontFamily || "sans-serif";
    return labels.map((l) => {
      const { tex, aspect } = makeTexture(l.text, font, dark);
      const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, transparent: true });
      return { l, mat, tex, aspect };
    });
  }, [labels, dark]);
  useEffect(
    () => () => {
      for (const s of sprites) {
        s.tex.dispose();
        s.mat.dispose();
      }
    },
    [sprites],
  );
  return (
    <group>
      {sprites.map((s) => (
        <sprite key={s.l.id} material={s.mat} position={[s.l.pos[0], s.l.pos[1] + (offset ? offset(s.l) : 0), s.l.pos[2]]} scale={[0.42 * s.aspect, 0.42, 1]} renderOrder={20} raycast={() => null} />
      ))}
    </group>
  );
}
