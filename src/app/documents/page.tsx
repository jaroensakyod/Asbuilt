import { Suspense } from "react";
import { Page } from "@/components/shell/topbar";
import { DocumentsView } from "./documents-view";

export default function Documents() {
  return (
    <Page trail={[{ label: "ข้อมูล" }, { label: "เอกสาร" }]}>
      <Suspense fallback={<div className="h-[60vh]" />}>
        <DocumentsView />
      </Suspense>
    </Page>
  );
}
