import { Suspense } from "react";
import { Page } from "@/components/shell/topbar";
import { ContractLedger } from "@/components/contracts/ledger";

export default function ContractLedgerPage({ params }: { params: Promise<{ projectId: string }> }) {
  return (
    <Page trail={[{ label: "สัญญา & เงินในสัญญา" }, { label: "สัญญาและการเบิกเงิน", href: "/contracts" }, { label: "สัญญาโครงการ" }]}>
      <Suspense fallback={<div className="h-[60vh]" />}>
        <Body params={params} />
      </Suspense>
    </Page>
  );
}

async function Body({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <ContractLedger projectId={decodeURIComponent(projectId)} />;
}
