import { Suspense } from "react";
import { projects } from "@/lib/data";
import { PortalView } from "@/components/portal/portal-view";

// demo tokens are prerendered; live tokens (random, from public.portal_links) render on request
export function generateStaticParams() {
  return projects.map((p) => ({ token: "demo-" + p.id.toLowerCase() }));
}

export default function PortalPage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-page" />}>
      <Body params={params} />
    </Suspense>
  );
}

async function Body({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PortalView token={decodeURIComponent(token)} />;
}
