import { Suspense } from "react";
import { Page } from "@/components/shell/topbar";
import { PurchaseDoc } from "@/components/procurement/purchase-doc";

// documents live in the browser (demo) or the company records (live), so every id
// renders on request; two ids are listed because Cache Components needs at least one
export function generateStaticParams() {
  return [{ id: "PO-2026-0001" }, { id: "PR-2026-0001" }];
}

export default function PurchaseDocPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="h-screen bg-page" />}>
      <Body params={params} />
    </Suspense>
  );
}

async function Body({ params }: { params: Promise<{ id: string }> }) {
  const id = decodeURIComponent((await params).id);
  return (
    <Page trail={[{ label: "จัดซื้อ", href: "/purchasing" }, { label: id.startsWith("PR-") ? `ใบขอซื้อ ${id}` : `ใบสั่งซื้อ ${id}` }]}>
      <PurchaseDoc id={id} />
    </Page>
  );
}
