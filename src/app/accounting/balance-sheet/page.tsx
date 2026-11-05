import { AccFrame } from "@/components/accounting/frame";
import { BalanceSheetView } from "@/components/accounting/statements";

export default function BalanceSheetPage() {
  return (
    <AccFrame title="งบแสดงฐานะการเงิน">
      <BalanceSheetView />
    </AccFrame>
  );
}
