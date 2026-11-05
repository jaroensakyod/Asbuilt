import { AccFrame } from "@/components/accounting/frame";
import { CloseView } from "@/components/accounting/setup";

export default function ClosePage() {
  return (
    <AccFrame title="ปิดงวดบัญชี" sub="ปิดงวดรายเดือนเพื่อล็อกเอกสารและยอดบัญชีของเดือนนั้น">
      <CloseView />
    </AccFrame>
  );
}
