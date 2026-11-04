import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Page } from "@/components/shell/topbar";
import { CadViewer } from "@/components/drawing/cad-viewer";
import { getHouseModel, houseModels } from "@/lib/data";

export function generateStaticParams() {
  return houseModels.map((m) => ({ code: m.code }));
}

export default function CadDrawingPage({ params }: { params: Promise<{ code: string }> }) {
  return (
    <Suspense fallback={<div className="h-screen bg-page" />}>
      <CadDrawing params={params} />
    </Suspense>
  );
}

async function CadDrawing({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const spec = getHouseModel(code);
  if (!spec) notFound();
  const file = `${spec.code}_${spec.name.replace(/\s+/g, "-")}.dwg`;
  return (
    <Page wide trail={[{ label: "CAD Viewer", href: "/cad" }, { label: `${spec.code} ${spec.name}`, href: "/cad" }, { label: `${file} — CAD Viewer` }]}>
      <Suspense fallback={<div className="h-[calc(100vh-88px)] rounded-[12px] border border-[#2e2e31] bg-[#141415]" />}>
        <CadViewer code={spec.code} />
      </Suspense>
    </Page>
  );
}
