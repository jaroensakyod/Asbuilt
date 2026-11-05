"use client";

// Client page: in live mode it renders the signed-in company's data.
import { Page } from "@/components/shell/topbar";
import { Card, CardHead, PageHeader } from "@/components/ui";
import { team } from "@/lib/data";
import { TeamView } from "./team-view";
import { Permissions } from "./permissions";
import Link from "next/link";
import { PlanSeatsCard } from "./company-card";

export function TeamPageView() {
  const active = team.filter((m) => m.active).length;
  return (
    <Page trail={[{ label: "ผู้ดูแลระบบ" }, { label: "ผู้ใช้/ทีมงาน" }]}>
      <PageHeader title="ผู้ใช้และทีมงาน" sub={`${team.length} บัญชี · ใช้งาน ${active} คน · กำหนดบทบาทและสิทธิ์การเข้าถึงแต่ละโมดูล`} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-4">
          <TeamView />
          <Permissions />
        </div>
        <div className="flex flex-col gap-4">
          <PlanSeatsCard />
          <Card>
            <CardHead title="ข้อมูลบริษัทและการตั้งค่า" />
            <p className="px-5 pt-3 text-[13px] text-ink-2">ชื่อบริษัท ที่อยู่ เลขผู้เสียภาษี การแจ้งเตือน และข้อมูลตัวอย่าง ย้ายไปอยู่ในหน้าตั้งค่าแล้ว</p>
            <div className="px-5 pb-4 pt-3">
              <Link href="/settings" className="inline-flex h-9 items-center rounded-[8px] border border-line-strong bg-card px-4 text-[14px] font-medium transition-colors duration-150 hover:bg-raised">
                ไปที่ตั้งค่า
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </Page>
  );
}
