import { Suspense } from "react";
import { InviteAccept } from "./invite-accept";

export const metadata = { title: "คำเชิญเข้าร่วมทีม · Asbuilt" };

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <Suspense fallback={null}>
      <Token params={params} />
    </Suspense>
  );
}

async function Token({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <InviteAccept token={token} />;
}
