import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Page } from "@/components/shell/topbar";
import { SystemView } from "./system-view";
import { KINDS } from "./kinds";

export function generateStaticParams() {
  return Object.keys(KINDS).map((kind) => ({ kind }));
}

export default function SystemRoute({ params }: { params: Promise<{ kind: string }> }) {
  return (
    <Suspense fallback={<div className="h-screen bg-page" />}>
      <SystemPage params={params} />
    </Suspense>
  );
}

async function SystemPage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const k = KINDS[kind as keyof typeof KINDS];
  if (!k) notFound();
  return (
    <Page trail={[{ label: "งานระบบ & อุปกรณ์" }, { label: k.title }]}>
      <Suspense fallback={<div className="h-[60vh]" />}>
        <SystemView kind={kind as keyof typeof KINDS} />
      </Suspense>
    </Page>
  );
}
