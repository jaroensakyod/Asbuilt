import { Suspense } from "react";
import { Page } from "@/components/shell/topbar";
import { AssetsView } from "./assets-view";

export default function AssetsPage() {
  return (
    <Page trail={[{ label: "งานระบบ & อุปกรณ์" }, { label: "อุปกรณ์อาคาร" }]}>
      <Suspense fallback={<div className="h-[60vh]" />}>
        <AssetsView />
      </Suspense>
    </Page>
  );
}
