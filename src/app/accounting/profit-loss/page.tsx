import { AccFrame } from "@/components/accounting/frame";
import { ProfitLossView } from "@/components/accounting/statements";

export default function ProfitLossPage() {
  return (
    <AccFrame title="งบกำไรขาดทุน" sub="รายเดือนและกำไรขั้นต้นรายโครงการ">
      <ProfitLossView />
    </AccFrame>
  );
}
