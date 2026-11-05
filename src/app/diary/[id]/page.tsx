import { Suspense } from "react";
import { Page } from "@/components/shell/topbar";
import { DiaryDetail } from "@/components/field/diary-detail";

export default function DiaryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Page trail={[{ label: "หน้างาน" }, { label: "รายงานประจำวัน", href: "/diary" }, { label: "รายละเอียด" }]}>
      <Suspense fallback={<div className="h-[60vh]" />}>
        <Body params={params} />
      </Suspense>
    </Page>
  );
}

async function Body({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DiaryDetail id={decodeURIComponent(id)} />;
}
