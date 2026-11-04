"use client";

// Copies the bundled sample data into a new company (live mode, "ใส่ข้อมูลตัวอย่าง").
// The demo arrays are snapshotted when this module loads (AppFrame imports it before
// any company is hydrated), so seeding always uses the original sample data.

import { projects } from "./data";
import { SEED } from "@/components/ops/seed";
import { allDocs } from "./docs-data";
import { supabase } from "./supabase/client";

const DEMO = {
  projects: projects.map((p) => ({ ...p })),
  repairs: SEED.repairs.map((x) => ({ ...x })),
  inspections: SEED.inspections.map((x) => ({ ...x })),
  workOrders: SEED.workOrders.map((x) => ({ ...x })),
  maintenance: SEED.maintenance.map((x) => ({ ...x })),
  documents: allDocs.map((x) => ({ ...x })),
};

type Row = Record<string, unknown>;

export async function seedDemoData(companyId: string, onStep?: (label: string) => void) {
  const sb = supabase();
  if (!sb) throw new Error("ยังไม่ได้ตั้งค่า Supabase");
  const put = async (table: string, rows: Row[], label: string) => {
    onStep?.(label);
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200).map((r) => ({ ...r, company_id: companyId }));
      const { error } = await sb.from(table).upsert(chunk);
      if (error) throw new Error(`${label}: ${error.message}`);
    }
  };
  await put("projects", DEMO.projects.map((p) => ({ id: p.id, status: p.status, model_code: p.modelCode, data: p })), "โครงการ");
  await put("repairs", DEMO.repairs.map((r) => ({ id: r.id, project_id: r.projectId, asset: r.asset, status: r.status, severity: r.severity, data: r })), "แจ้งซ่อม");
  await put("inspections", DEMO.inspections.map((r) => ({ id: r.id, project_id: r.projectId, date: r.date, result: r.result, data: r })), "การตรวจสอบ");
  await put("work_orders", DEMO.workOrders.map((r) => ({ id: r.id, project_id: r.projectId, repair_id: r.repairId, status: r.status, data: r })), "ใบสั่งงาน");
  await put("maintenance", DEMO.maintenance.map((r) => ({ id: r.id, project_id: r.projectId, date: r.date, data: r })), "บำรุงรักษา");
  await put("documents", DEMO.documents.map((d) => ({ id: d.id, project_id: d.projectId, kind: d.category, data: d })), "เอกสาร");
}
