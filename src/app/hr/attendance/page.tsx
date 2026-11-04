import { Page } from "@/components/shell/topbar";
import { AttendanceView } from "@/components/hr/attendance-view";

export default function AttendancePage() {
  return (
    <Page trail={[{ label: "บัญชี & บุคคล" }, { label: "พนักงาน", href: "/hr" }, { label: "ลงเวลา & การลา" }]}>
      <AttendanceView />
    </Page>
  );
}
