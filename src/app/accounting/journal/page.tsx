import { AccFrame } from "@/components/accounting/frame";
import { JournalView } from "@/components/accounting/journal-view";

export default function JournalPage() {
  return (
    <AccFrame title="สมุดรายวัน" sub="ทุกรายการบัญชีที่เกิดจากเอกสาร และรายการปรับปรุงที่บันทึกเอง">
      <JournalView />
    </AccFrame>
  );
}
