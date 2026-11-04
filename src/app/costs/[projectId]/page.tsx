import { Suspense } from "react";
import { Page } from "@/components/shell/topbar";
import { CostDetail } from "@/components/procurement/cost-detail";
import { projects } from "@/lib/data";

// demo projects are prerendered; a live company's projects render on request
export function generateStaticParams() {
  return projects.map((p) => ({ projectId: p.id }));
}

export default function ProjectCostPage({ params }: { params: Promise<{ projectId: string }> }) {
  return (
    <Suspense fallback={<div className="h-screen bg-page" />}>
      <Body params={params} />
    </Suspense>
  );
}

async function Body({ params }: { params: Promise<{ projectId: string }> }) {
  const id = decodeURIComponent((await params).projectId);
  return (
    <Page trail={[{ label: "ต้นทุนโครงการ", href: "/costs" }, { label: id }]}>
      <CostDetail projectId={id} />
    </Page>
  );
}
