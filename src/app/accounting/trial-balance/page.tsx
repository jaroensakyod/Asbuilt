import { AccFrame } from "@/components/accounting/frame";
import { TrialBalanceView } from "@/components/accounting/statements";

export default function TrialBalancePage() {
  return (
    <AccFrame title="งบทดลอง">
      <TrialBalanceView />
    </AccFrame>
  );
}
