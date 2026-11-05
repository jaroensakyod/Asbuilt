import { Suspense } from "react";
import { Page } from "@/components/shell/topbar";
import { SkillsView } from "@/components/hr/skills-view";

export default function SkillsPage() {
  return (
    <Page trail={[{ label: "บัญชี & บุคคล" }, { label: "พนักงาน", href: "/hr" }, { label: "ทักษะ & ใบรับรอง" }]}>
      <Suspense fallback={<div className="h-[60vh]" />}>
        <SkillsView />
      </Suspense>
    </Page>
  );
}
