import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getHouseModel, houseModels } from "@/lib/data";
import { ModelDetail } from "./model-detail";

export function generateStaticParams() {
  return houseModels.map((m) => ({ code: m.code }));
}

export default function ModelRoute({ params }: { params: Promise<{ code: string }> }) {
  return (
    <Suspense fallback={<div className="h-screen bg-page" />}>
      <Body params={params} />
    </Suspense>
  );
}

async function Body({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!getHouseModel(code)) notFound();
  return <ModelDetail code={code} />;
}
