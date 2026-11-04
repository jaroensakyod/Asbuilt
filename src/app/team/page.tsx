import { Page } from "@/components/shell/topbar";
import { PageHeader } from "@/components/ui";
import { team } from "@/lib/data";
import { TeamView } from "./team-view";
import { Permissions } from "./permissions";
import { CompanyCard } from "./company-card";

export default function TeamPage() {
  const active = team.filter((m) => m.active).length;
  return (
    <Page trail={[{ label: "ผู้ดูแลระบบ" }, { label: "ผู้ใช้/ทีมงาน" }]}>
      <PageHeader title="ผู้ใช้และทีมงาน" sub={`${team.length} บัญชี · ใช้งาน ${active} คน · กำหนดบทบาทและสิทธิ์การเข้าถึงแต่ละโมดูล`} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-4">
          <TeamView />
          <Permissions />
        </div>
        <CompanyCard />
      </div>
    </Page>
  );
}
