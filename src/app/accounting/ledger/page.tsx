import { AccFrame } from "@/components/accounting/frame";
import { LedgerView } from "@/components/accounting/journal-view";

export default function LedgerPage() {
  return (
    <AccFrame title="บัญชีแยกประเภท" sub="รายการเคลื่อนไหวและยอดคงเหลือของแต่ละบัญชี">
      <LedgerView />
    </AccFrame>
  );
}
