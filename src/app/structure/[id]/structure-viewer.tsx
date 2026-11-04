"use client";

import { useSearchParams } from "next/navigation";
import { HouseViewer, type CompareView } from "@/components/viewer/house-viewer";
import type { Mode } from "@/components/viewer/scene";
import type { Project, Repair } from "@/lib/data";

const MODES: Mode[] = ["real", "xray", "compare", "heat"];
const VIEWS: CompareView[] = ["overlay", "split", "slider", "state"];

/** Reads ?mode= and ?view= so gallery buttons can open the viewer in a given mode */
export function StructureViewer({ project, repairs }: { project: Project; repairs: Repair[] }) {
  const sp = useSearchParams();
  const m = sp.get("mode");
  const v = sp.get("view");
  const mode = MODES.includes(m as Mode) ? (m as Mode) : "real";
  const view = VIEWS.includes(v as CompareView) ? (v as CompareView) : "overlay";
  return <HouseViewer key={`${project.id}:${mode}:${view}`} project={project} repairs={repairs} initialMode={mode} initialView={view} variant="full" className="h-[calc(100vh-160px)] min-h-[560px]" />;
}
