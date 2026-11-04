import { Page } from "@/components/shell/topbar";
import { EmployeesView } from "@/components/hr/employees-view";

export default function HrPage() {
  return (
    <Page trail={[{ label: "บัญชี & บุคคล" }, { label: "พนักงาน" }]}>
      <EmployeesView />
    </Page>
  );
}
