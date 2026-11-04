import { Page } from "@/components/shell/topbar";
import { CadLibrary } from "@/components/drawing/cad-library";

export default function CadPage() {
  return (
    <Page wide trail={[{ label: "แบบก่อสร้าง", href: "/blueprint" }, { label: "CAD Viewer (DWG/DXF)" }]}>
      <CadLibrary />
    </Page>
  );
}
