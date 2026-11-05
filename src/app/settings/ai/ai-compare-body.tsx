"use client";

import { Page } from "@/components/shell/topbar";
import { AiCompareView } from "@/components/ai/compare-view";

export function AiCompareBody() {
  return (
    <Page trail={[{ label: "ตั้งค่า", href: "/settings" }, { label: "เทียบ AI และต้นทุน" }]}>
      <AiCompareView />
    </Page>
  );
}
