import { AccFrame } from "@/components/accounting/frame";
import { CashView } from "@/components/accounting/cash";

export default function CashPage() {
  return (
    <AccFrame title="เงินสด/ธนาคาร" sub="สมุดเงินฝาก เงินสดย่อย และกระทบยอดกับ statement ธนาคาร">
      <CashView />
    </AccFrame>
  );
}
