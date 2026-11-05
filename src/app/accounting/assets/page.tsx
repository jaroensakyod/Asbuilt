import { AccFrame } from "@/components/accounting/frame";
import { AssetsView } from "@/components/accounting/assets-view";

export default function AssetsPage() {
  return (
    <AccFrame title="สินทรัพย์ถาวร" sub="ทะเบียนสินทรัพย์และตารางค่าเสื่อมราคาแบบเส้นตรง">
      <AssetsView />
    </AccFrame>
  );
}
