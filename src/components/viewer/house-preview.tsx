"use client";

import dynamic from "next/dynamic";
import { getModel } from "@/lib/house";

const Scene = dynamic(() => import("./scene").then((m) => m.Scene), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-raised" />,
});

const PREVIEW_DISPLAY = { furniture: false, ceiling: false, site: false, labels: false };

export function HousePreview({ pins, code = "HM-17" }: { pins: string[]; code?: string }) {
  return <Scene model={getModel(code)} compact look="real" pins={pins} display={PREVIEW_DISPLAY} />;
}
