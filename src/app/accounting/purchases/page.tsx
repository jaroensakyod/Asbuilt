import { AccFrame } from "@/components/accounting/frame";
import { PurchasesView } from "@/components/accounting/purchases";

export default function PurchasesPage() {
  return (
    <AccFrame title="ซื้อ & เจ้าหนี้" sub="อนุมัติและจ่ายชำระใบแจ้งหนี้ผู้ขาย หัก ณ ที่จ่าย และออกใบสำคัญจ่าย">
      <PurchasesView />
    </AccFrame>
  );
}
