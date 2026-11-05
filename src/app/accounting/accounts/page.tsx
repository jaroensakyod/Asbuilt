import { AccFrame } from "@/components/accounting/frame";
import { AccountsView } from "@/components/accounting/setup";

export default function AccountsPage() {
  return (
    <AccFrame title="ผังบัญชี" sub="รหัสบัญชีสำหรับบริษัทรับสร้างบ้าน เพิ่มหรือปิดใช้บัญชีได้">
      <AccountsView />
    </AccFrame>
  );
}
