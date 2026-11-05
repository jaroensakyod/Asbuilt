import { AccFrame } from "@/components/accounting/frame";
import { TaxView } from "@/components/accounting/tax";

export default function TaxPage() {
  return (
    <AccFrame title="ภาษี" sub="ภ.พ.30 ภ.ง.ด.1 ภ.ง.ด.3 ภ.ง.ด.53 ประกันสังคม และหนังสือรับรอง 50 ทวิ">
      <TaxView />
    </AccFrame>
  );
}
