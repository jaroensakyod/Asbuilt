import { Suspense } from "react";
import { MJob } from "@/components/field/m-jobs";

export default function PhoneJobPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-page" />}>
      <Body params={params} />
    </Suspense>
  );
}

async function Body({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MJob id={decodeURIComponent(id)} />;
}
