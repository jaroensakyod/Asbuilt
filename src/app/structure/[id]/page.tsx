import { Suspense } from "react";
import { projects } from "@/lib/data";
import { StructureModel } from "./structure-model";

// demo ids are prerendered; other ids (a live company's projects) render on request
export function generateStaticParams() {
  return projects.map((p) => ({ id: p.id }));
}

export default function StructureModelPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="h-screen bg-page" />}>
      <Body params={params} />
    </Suspense>
  );
}

async function Body({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StructureModel id={decodeURIComponent(id)} />;
}
