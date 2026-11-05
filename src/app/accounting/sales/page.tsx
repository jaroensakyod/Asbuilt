import { AccFrame } from "@/components/accounting/frame";
import { SalesView } from "@/components/accounting/sales";

export default function SalesPage() {
  return (
    <AccFrame title="ขาย & ลูกหนี้" sub="ออกใบแจ้งหนี้/ใบกำกับภาษีตามงวดเงิน รับชำระ และติดตามอายุลูกหนี้">
      <SalesView />
    </AccFrame>
  );
}
