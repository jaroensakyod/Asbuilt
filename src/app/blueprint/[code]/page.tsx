import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Page } from "@/components/shell/topbar";
import { BlueprintViewer } from "@/components/drawing/blueprint-viewer";
import { getHouseModel, houseModels } from "@/lib/data";

export function generateStaticParams() {
  return houseModels.map((m) => ({ code: m.code }));
}

export default function BlueprintSetPage({ params }: { params: Promise<{ code: string }> }) {
  return (
    <Suspense fallback={<div className="h-screen bg-page" />}>
      <BlueprintSet params={params} />
    </Suspense>
  );
}

async function BlueprintSet({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const spec = getHouseModel(code);
  if (!spec) notFound();
  return (
    <Page wide trail={[{ label: "แบบก่อสร้าง", href: "/blueprint" }, { label: `${spec.code} ${spec.name}`, href: "/blueprint" }, { label: `ชุดแบบ ${spec.code} · ${spec.name}` }]}>
      <Suspense fallback={<div className="h-[calc(100vh-88px)] rounded-[14px] border border-line bg-card" />}>
        <BlueprintViewer code={spec.code} />
      </Suspense>
    </Page>
  );
}
