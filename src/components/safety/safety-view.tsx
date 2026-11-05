"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { StatCard } from "@/components/ops/bits";
import { SubTabs } from "@/components/hr/bits";
import { thDate, TODAY } from "@/lib/data";
import { attendance } from "@/lib/hr/store";
import { addDays } from "@/lib/hr/payroll";
import { ACTIVE_SITES } from "@/lib/hr/seed";
import { daysWithoutLti, incidentFollowUp, isLti, ltifr, manHours, permitOverdue } from "@/lib/safety/calc";
import { useNow } from "@/lib/safety/now";
import { incidents, permits, toolboxTalks, useSafetySettings, useSiteSafety } from "@/lib/safety/store";
import { n0 } from "./bits";
import { EnvTab } from "./env";
import { IncidentsTab } from "./incidents";
import { InspectionsTab } from "./inspections";
import { KpiTab } from "./kpi";
import { PermitsTab } from "./permits";
import { PpeTab } from "./ppe";
import { ToolboxTab } from "./toolbox";

type Tab = "toolbox" | "permits" | "inspections" | "incidents" | "ppe" | "env" | "kpi";
const TABS: { key: Tab; label: string }[] = [
  { key: "toolbox", label: "Toolbox talk" },
  { key: "permits", label: "ใบอนุญาตทำงาน" },
  { key: "inspections", label: "ตรวจความปลอดภัย" },
  { key: "incidents", label: "อุบัติเหตุ" },
  { key: "ppe", label: "เบิก PPE" },
  { key: "env", label: "ฝุ่น & สิ่งแวดล้อม" },
  { key: "kpi", label: "KPI & จป." },
];

export function SafetyView() {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const raw = params.get("tab") as Tab | null;
  const tab: Tab = raw && TABS.some((t) => t.key === raw) ? raw : "toolbox";
  const q = params.get("q") ?? undefined;
  const go = (t: Tab) => router.replace(t === "toolbox" ? path : `${path}?tab=${t}`, { scroll: false });

  const ptw = permits.use();
  const inc = incidents.use();
  const talks = toolboxTalks.use();
  const sheets = attendance.use();
  const sites = useSiteSafety();
  const settings = useSafetySettings();
  const now = useNow();

  // LTIFR only over the window that has attendance (man-hours) in the system, at most 12 months
  const first = sheets.reduce((m, x) => (x.date < m ? x.date : m), TODAY);
  const yearAgo = first > addDays(TODAY, -365) ? addDays(first, -1) : addDays(TODAY, -365);
  const hours = manHours(sheets, settings.hoursPerDay, (s) => s.date > yearAgo && s.date <= TODAY);
  const lti = inc.filter((i) => isLti(i) && i.date > yearAgo).length;
  const active = ptw.filter((p) => p.status === "active").length;
  const overdue = ptw.filter((p) => permitOverdue(p, now)).length;
  const follow = inc.filter((i) => incidentFollowUp(i, TODAY).needs).length;
  const minDays = Math.min(...ACTIVE_SITES.map((p) => daysWithoutLti(inc, p.id, p.start, TODAY)));
  const companyDays = daysWithoutLti(inc.map((i) => ({ ...i, projectId: "*" })), "*", "2025-01-01", TODAY);
  const weekTalks = talks.filter((t) => t.date > addDays(TODAY, -7)).length;
  const short = sites.filter((s) => !s.check.ok).length;

  return (
    <>
      <PageHeader eyebrow="หน้างาน" title="ความปลอดภัย" sub="Toolbox talk ใบอนุญาตทำงาน ตรวจนั่งร้านและเดินตรวจ รายงานอุบัติเหตุ การเบิก PPE ฝุ่น PM2.5 และตัวชี้วัดความปลอดภัยทุกหน้างาน" />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="ไม่มีอุบัติเหตุหยุดงาน" value={n0(companyDays)} unit="วัน" note={`หน้างานที่น้อยที่สุด ${n0(minDays)} วัน`} onClick={() => go("kpi")} />
        <StatCard label={yearAgo > addDays(TODAY, -365) ? `LTIFR ตั้งแต่ ${thDate(addDays(yearAgo, 1))}` : "LTIFR 12 เดือน"} value={ltifr(lti, hours, settings.ltifrBase).toFixed(2)} note={`${lti} ครั้ง · ${n0(hours)} ชม.-คน`} onClick={() => go("kpi")} />
        <StatCard label="ใบอนุญาตทำงาน" value={active} unit="เปิดอยู่" note={overdue ? `เกินเวลา ${overdue} ใบ` : "ไม่มีใบเกินเวลา"} tone={overdue ? "neg" : undefined} onClick={() => go("permits")} />
        <StatCard label="อุบัติเหตุรอติดตาม" value={follow} unit="เรื่อง" tone={follow ? "neg" : undefined} onClick={() => go("incidents")} />
        <StatCard label="Toolbox talk 7 วัน" value={weekTalks} unit="ครั้ง" onClick={() => go("toolbox")} />
        <StatCard label="หน้างาน จป. ไม่ครบ" value={short} unit={`จาก ${sites.length}`} tone={short ? "neg" : undefined} onClick={() => go("kpi")} />
      </div>
      <div className="mb-5 overflow-x-auto">
        <SubTabs value={tab} onChange={go} options={TABS} />
      </div>
      {tab === "toolbox" && <ToolboxTab q={q} />}
      {tab === "permits" && <PermitsTab q={q} />}
      {tab === "inspections" && <InspectionsTab q={q} />}
      {tab === "incidents" && <IncidentsTab q={q} />}
      {tab === "ppe" && <PpeTab />}
      {tab === "env" && <EnvTab />}
      {tab === "kpi" && <KpiTab />}
    </>
  );
}
