import { AccFrame } from "@/components/accounting/frame";
import { AccountingOverview } from "@/components/accounting/overview";

export default function AccountingPage() {
  return (
    <AccFrame title="ภาพรวมบัญชี" sub="เงินสด ลูกหนี้ เจ้าหนี้ ภาษีที่ต้องยื่น และผลการดำเนินงาน">
      <AccountingOverview />
    </AccFrame>
  );
}
