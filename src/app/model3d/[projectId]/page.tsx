import { Suspense } from "react";
import { projects } from "@/lib/data";
import { Model3dBody } from "./model3d-body";

// demo ids are prerendered; other ids (a live company's projects) render on request
export function generateStaticParams() {
  return projects.map((p) => ({ projectId: p.id }));
}

export default function Model3dPage({ params }: { params: Promise<{ projectId: string }> }) {
  return (
    <Suspense fallback={<div className="h-screen bg-page" />}>
      <Body params={params} />
    </Suspense>
  );
}

async function Body({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <Model3dBody id={decodeURIComponent(projectId)} />;
}
