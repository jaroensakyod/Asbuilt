import { AccFrame } from "@/components/accounting/frame";
import { ExpensesView } from "@/components/accounting/expenses";

export default function ExpensesPage() {
  return (
    <AccFrame title="ค่าใช้จ่าย" sub="บันทึกใบเสร็จค่าใช้จ่ายหน้างานและสำนักงาน พร้อมรายการบัญชีก่อนบันทึก">
      <ExpensesView />
    </AccFrame>
  );
}
