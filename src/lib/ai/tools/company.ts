// Read-only company tools for the AI assistant.
// Every tool runs in the browser on the same collections the user already sees, returns
// compact aggregated results with ids + href, and only covers modules the role may view.

import type { ClientTool } from "@/lib/ai/client";
import type { JsonSchema } from "@/lib/ai/types";
import { canView, type ModuleKey } from "@/lib/permissions";
import { STATUS_LABEL, TODAY, REPAIR_STATUS_LABEL, WO_STATUS_LABEL, SEVERITY_LABEL, type Project, type Role } from "@/lib/data";
import { COST_CODES, budgets, costEntries, installments, payrollRuns, siteDiaries, supplierBills, wbsTasks, WEATHER_LABEL, type CostCode } from "@/lib/biz";
import { projectProgress, scheduleCtxNow, summaryOf, leavesOf, taskState, isLateState, TASK_STATE_LABEL, getScheduleSettings } from "@/lib/schedule";
import { contractValueWithVariations, baseContractValue, certCol, voCol, scCol, contractTerms, getContractSettings, termsFor } from "@/lib/contracts";
import { purchaseOrders, purchaseRequests, goodsReceipts, stockItems, stockMoves, suppliers, poTotals, stockState, isOpenPO } from "@/lib/procurement/store";
import { PO_STATUS_LABEL, PR_STATUS_LABEL, WAREHOUSE } from "@/lib/procurement/types";
import { balKey } from "@/lib/procurement/stock";
import { projectCost } from "@/lib/procurement/costs";
import { leads, quotes, quoteTotals, quoteStatus, validUntil, STAGES, STAGE_LABEL, STAGE_WEIGHT, QUOTE_STATUS_LABEL } from "@/lib/sales/crm";
import { priceItems, priceObs, latestOf, PRICE_SOURCES, SOURCE_LABEL as PRICE_SOURCE_LABEL } from "@/lib/sales/prices";
import { employees, attendance, leaves } from "@/lib/hr/store";
import { EMP_TYPE_LABEL, LEAVE_LABEL } from "@/lib/hr/types";
import { incidents, permits, safetyInspections } from "@/lib/safety/store";
import { INC_LABEL, PERMIT_SHORT, PERMIT_STATUS_LABEL } from "@/lib/safety/types";
import { permitOverdue, incidentFollowUp, isLti } from "@/lib/safety/calc";
import { rfis, submittals, ncrs, concreteTests, ENG_DEFAULTS } from "@/lib/engineering/store";
import { submittalState, latestRev, concreteVerdict } from "@/lib/engineering/calc";
import { RFI_STATUS_LABEL, NCR_STATUS_LABEL, NCR_SEVERITY_LABEL, SUBMITTAL_STATE_LABEL, DISC_LABEL } from "@/lib/engineering/types";
import { maintState, type OpsInspection, type OpsMaint, type OpsRepair, type OpsWorkOrder } from "@/lib/ops-store";
import type { Note } from "@/lib/notifications";
import { aging, addDaysIso, burnGap, countBy, daysDiff, latestOnOrBefore, numArg, pipeline, r0, r1, rankLate, searchRank, strArg, sum, textMatch, topN, type MoneyRow, type SearchItem } from "./agg";

export type ToolCtx = {
  role: Role;
  userName: string;
  demo: boolean;
  projects: Project[];
  repairs: OpsRepair[];
  inspections: OpsInspection[];
  workOrders: OpsWorkOrder[];
  maintenance: OpsMaint[];
  notes: Note[];
};

type Def = ClientTool & { modules: ModuleKey[] };

const obj = (properties: Record<string, JsonSchema>, required: string[] = []): JsonSchema => ({ type: "object", properties, required });
const S = (description: string, e?: string[]): JsonSchema => ({ type: "string", description, ...(e ? { enum: e } : {}) });
const N = (description: string): JsonSchema => ({ type: "integer", description });

const LIMIT = N("จำนวนรายการสูงสุด (ค่าเริ่มต้น 10, ไม่เกิน 50)");
const PROJECT_ID = S("รหัสโครงการ เช่น HC-2026-02 (ไม่ระบุ = ทุกโครงการที่ดูได้)");

const href = {
  project: (id: string) => `/projects/${id}`,
  schedule: (id: string) => `/schedule/${id}`,
  costs: (id: string) => `/costs/${id}`,
  contract: (id: string) => `/contracts/${id}`,
};

export function buildCompanyTools(ctx: ToolCtx): ClientTool[] {
  const can = (m: ModuleKey) => canView(ctx.role, m);
  const byId = new Map(ctx.projects.map((p) => [p.id, p]));
  const pname = (id?: string) => (id ? (byId.get(id)?.name ?? id) : "คลังกลาง");
  const findProject = (q?: string) => {
    if (!q) return undefined;
    const exact = byId.get(q) ?? byId.get(q.toUpperCase());
    if (exact) return exact;
    return ctx.projects.find((p) => textMatch(q, p.id, p.name, p.owner));
  };
  const projectFilter = (a: Record<string, unknown>) => {
    const pid = strArg(a.projectId);
    const p = pid ? findProject(pid) : undefined;
    return { pid: p?.id ?? pid, p, ok: (id?: string) => !pid || id === (p?.id ?? pid) };
  };
  const nowIso = () => {
    const d = new Date();
    return `${TODAY}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  // ---------- projects ----------

  const listProjects: Def = {
    modules: ["projects"],
    name: "list_projects",
    description: "รายการโครงการของบริษัท กรองตามสถานะ จังหวัด PM หรือคำค้น และเรียงตามความล่าช้า/มูลค่า/ความคืบหน้า คืนจำนวนแยกสถานะด้วย",
    parameters: obj({
      status: S("สถานะโครงการ", ["planning", "building", "handover", "delivered"]),
      province: S("จังหวัด"),
      pm: S("ชื่อผู้จัดการโครงการ (บางส่วนได้)"),
      q: S("คำค้นชื่อโครงการ/เจ้าของ/รหัส"),
      sort: S("เรียงตาม: behind = ล่าช้ากว่าแผนมากสุด, value = มูลค่าสูงสุด, progress = คืบหน้าน้อยสุด, finish = ใกล้กำหนดเสร็จ", ["behind", "value", "progress", "finish"]),
      limit: LIMIT,
    }),
    run: (a) => {
      const tasks = wbsTasks.all();
      let rows = ctx.projects
        .filter((p) => !a.status || p.status === a.status)
        .filter((p) => textMatch(strArg(a.province), p.province))
        .filter((p) => textMatch(strArg(a.pm), p.pm))
        .filter((p) => textMatch(strArg(a.q), p.id, p.name, p.owner, p.model))
        .map((p) => {
          const progress = projectProgress(p.id, tasks);
          return { id: p.id, name: p.name, owner: p.owner, status: STATUS_LABEL[p.status], province: p.province, pm: p.pm, progressPct: progress, planPct: p.plan, behindPts: r1(p.plan - progress), valueMB: p.value, start: p.start, finish: p.finish, href: href.project(p.id) };
        });
      const sort = strArg(a.sort);
      if (sort === "behind") rows = rows.sort((x, y) => y.behindPts - x.behindPts);
      else if (sort === "value") rows = rows.sort((x, y) => y.valueMB - x.valueMB);
      else if (sort === "progress") rows = rows.sort((x, y) => x.progressPct - y.progressPct);
      else if (sort === "finish") rows = rows.sort((x, y) => x.finish.localeCompare(y.finish));
      const all = ctx.projects;
      return {
        countsByStatus: Object.fromEntries(Object.entries(countBy(all, (p) => p.status)).map(([k, v]) => [STATUS_LABEL[k as Project["status"]], v])),
        totalValueMB: r1(sum(all.map((p) => p.value))),
        note: "valueMB = มูลค่าโครงการ (ล้านบาท), behindPts = จุด % ที่ช้ากว่าแผน",
        ...topN(rows, numArg(a.limit, 10)),
      };
    },
  };

  const projectOverview: Def = {
    modules: ["projects"],
    name: "project_overview",
    description: "ภาพรวมโครงการเดียว: ข้อมูลหลัก ความคืบหน้า แผนงาน (SPI/CPI วันล่าช้า) มูลค่าสัญญารวมงานเปลี่ยนแปลง ต้นทุนเทียบงบ ลูกหนี้ งานค้าง (แจ้งซ่อม RFI NCR อุบัติเหตุ) และรายงานประจำวันล่าสุด เฉพาะส่วนที่บทบาทนี้ดูได้",
    parameters: obj({ projectId: S("รหัสหรือชื่อโครงการ") }, ["projectId"]),
    run: (a) => {
      const p = findProject(strArg(a.projectId));
      if (!p) return { error: `ไม่พบโครงการ ${String(a.projectId ?? "")}` };
      const out: Record<string, unknown> = {
        id: p.id,
        name: p.name,
        owner: p.owner,
        model: p.model,
        status: STATUS_LABEL[p.status],
        phase: p.phase,
        province: p.province,
        pm: p.pm,
        start: p.start,
        finish: p.finish,
        handedOver: p.handedOver,
        warrantyUntil: p.warrantyUntil,
        floors: p.floors,
        areaM2: p.area,
        projectValueMB: p.value,
        progressPct: projectProgress(p.id),
        planPct: p.plan,
        href: href.project(p.id),
      };
      if (can("schedule")) {
        const s = summaryOf(p, scheduleCtxNow());
        out.schedule = s.hasWbs
          ? { pct: s.pct, planPct: s.planPct, spi: s.spi && r1(s.spi * 100) / 100, cpi: s.cpi && r1(s.cpi * 100) / 100, daysLate: s.daysLate, forecastFinish: s.forecastFinish, contractFinish: s.contractFinish, tasks: s.tasks, done: s.done, lateTasks: s.late, criticalLate: s.criticalLate, currentPhase: s.currentPhase, nextMilestone: s.nextMilestone, href: href.schedule(p.id) }
          : { hasWbs: false, note: "ยังไม่มีแผนงาน WBS ใช้ % จากข้อมูลโครงการ" };
      }
      if (can("contracts") || can("costs")) {
        const vos = voCol.all().filter((v) => v.projectId === p.id);
        const approved = vos.filter((v) => v.status === "approved");
        out.contract = {
          baseValue: r0(baseContractValue(p.id)),
          valueWithVariations: r0(contractValueWithVariations(p.id)),
          approvedVariations: { count: approved.length, amount: r0(sum(approved.map((v) => v.amount))), days: sum(approved.map((v) => v.days)) },
          pendingVariations: vos.filter((v) => v.status === "submitted" || v.status === "priced").length,
          note: "บาท ไม่รวม VAT",
          href: href.contract(p.id),
        };
      }
      if (can("costs")) {
        const pc = projectCost(p, costCtx());
        out.cost = { budget: r0(pc.budget), actual: r0(pc.actual), committed: r0(pc.committed), forecastAtCompletion: r0(pc.forecast), variance: r0(pc.variance), marginPct: r1(pc.marginPct), usedPct: r1(pc.usedPct), alerts: pc.alerts.slice(0, 4).map((x) => x.text), href: href.costs(p.id) };
      }
      if (can("accounting")) {
        const ar = aging(arRows().filter((r) => r.projectId === p.id), TODAY, 30, 3);
        out.receivable = { outstanding: ar.outstanding, overdue: ar.overdue, next: ar.upcomingItems[0] };
      }
      const open: Record<string, number> = {};
      if (can("repairs")) open.repairs = ctx.repairs.filter((r) => r.projectId === p.id && r.status !== "closed").length;
      if (can("engineering")) {
        open.rfis = rfis.all().filter((r) => r.projectId === p.id && r.status === "open").length;
        open.ncrs = ncrs.all().filter((r) => r.projectId === p.id && r.status !== "closed").length;
      }
      if (can("safety")) open.incidents = incidents.all().filter((r) => r.projectId === p.id && r.status !== "closed").length;
      if (can("purchasing")) open.purchaseOrders = purchaseOrders.all().filter((x) => x.projectId === p.id && (isOpenPO(x) || x.status === "pending")).length;
      if (Object.keys(open).length) out.openItems = open;
      if (can("field")) {
        const d = siteDiaries
          .all()
          .filter((x) => x.projectId === p.id)
          .sort((x, y) => y.date.localeCompare(x.date))[0];
        if (d) out.latestDiary = { id: d.id, date: d.date, manpower: sum(d.manpower.map((m) => m.count)), weather: WEATHER_LABEL[d.weatherAm], issues: d.issues, href: `/diary/${d.id}` };
      }
      return out;
    },
  };

  // ---------- schedule ----------

  const schedule: Def = {
    modules: ["schedule"],
    name: "schedule_status",
    description:
      "แผนงาน/ความคืบหน้า. mode=projects: จัดอันดับโครงการที่ล่าช้า (วันล่าช้า, % ช้ากว่าแผน, SPI, CPI). mode=late_tasks: งานที่ล่าช้า/งานวิกฤต. mode=lookahead: งานที่กำลังทำหรือต้องเริ่มภายใน N วัน (days=0 คือวันนี้)",
    parameters: obj({
      mode: S("โหมด", ["projects", "late_tasks", "lookahead"]),
      projectId: PROJECT_ID,
      pm: S("กรองตามชื่อ PM"),
      days: N("สำหรับ lookahead: จำนวนวันข้างหน้า (ค่าเริ่มต้น 7)"),
      limit: LIMIT,
    }),
    run: (a) => {
      const sctx = scheduleCtxNow();
      const { pid, ok } = projectFilter(a);
      const pm = strArg(a.pm);
      const scope = ctx.projects.filter((p) => ok(p.id) && textMatch(pm, p.pm) && (pid || p.status === "building" || p.status === "handover"));
      const lim = numArg(a.limit, 10);
      const mode = strArg(a.mode) ?? "projects";
      const behind = getScheduleSettings().behindPts;
      if (mode === "projects") {
        const rows = scope
          .map((p) => ({ p, s: summaryOf(p, sctx) }))
          .filter((x) => x.s.hasWbs)
          .map(({ p, s }) => ({ id: p.id, name: p.name, pm: p.pm, pct: s.pct, planPct: s.planPct, daysLate: s.daysLate, spi: s.spi === undefined ? undefined : Math.round(s.spi * 100) / 100, cpi: s.cpi === undefined ? undefined : Math.round(s.cpi * 100) / 100, late: s.late, criticalLate: s.criticalLate, forecastFinish: s.forecastFinish, contractFinish: s.contractFinish, href: href.schedule(p.id) }));
        const ranked = rankLate(rows);
        return { today: TODAY, projects: scope.length, withWbs: rows.length, lateProjects: rows.filter((r) => r.daysLate > 0).length, spiBelow09: rows.filter((r) => (r.spi ?? 1) < 0.9).length, note: "daysLate = วันที่คาดว่าเสร็จช้ากว่าสัญญา, behindPts = จุด % ที่ช้ากว่าแผน", ...topN(ranked, lim) };
      }
      const tasks = sctx.tasks.filter((t) => scope.some((p) => p.id === t.projectId));
      const leaves = leavesOf(tasks);
      if (mode === "late_tasks") {
        const crit = new Set<string>();
        for (const p of scope) if (sctx.tasks.some((t) => t.projectId === p.id)) summaryOf(p, sctx).criticalIds.forEach((id) => crit.add(id));
        const rows = leaves
          .map((t) => ({ t, st: taskState(t, TODAY, behind) }))
          .filter((x) => isLateState(x.st))
          .map(({ t, st }) => ({ id: t.id, projectId: t.projectId, project: pname(t.projectId), code: t.code, name: t.name, start: t.start, finish: t.finish, pct: t.pct, state: TASK_STATE_LABEL[st], critical: crit.has(t.id), daysPastFinish: t.finish < TODAY ? daysDiff(t.finish, TODAY) : 0, crew: t.crew, href: href.schedule(t.projectId) }))
          .sort((x, y) => Number(y.critical) - Number(x.critical) || y.daysPastFinish - x.daysPastFinish);
        return { today: TODAY, lateTasks: rows.length, criticalLate: rows.filter((r) => r.critical).length, ...topN(rows, lim) };
      }
      const days = numArg(a.days, 7, 0, 60);
      const until = addDaysIso(TODAY, days);
      const rows = leaves
        .filter((t) => (t.pct ?? 0) < 100 && t.start <= until && t.finish >= TODAY)
        .map((t) => ({ id: t.id, projectId: t.projectId, project: pname(t.projectId), code: t.code, name: t.name, start: t.start, finish: t.finish, pct: t.pct, state: TASK_STATE_LABEL[taskState(t, TODAY, behind)], crew: t.crew, qty: t.qty, unit: t.unit, href: href.schedule(t.projectId) }))
        .sort((x, y) => x.start.localeCompare(y.start) || x.projectId.localeCompare(y.projectId));
      return { today: TODAY, until, tasks: rows.length, byProject: countBy(rows, (r) => r.projectId), ...topN(rows, numArg(a.limit, 20)) };
    },
  };

  // ---------- costs ----------

  const costCtx = () => ({ budgets: budgets.all(), costs: costEntries.all(), pos: purchaseOrders.all(), receipts: goodsReceipts.all(), bills: supplierBills.all(), payroll: payrollRuns.all() });

  const costs: Def = {
    modules: ["costs"],
    name: "cost_vs_budget",
    description: "ต้นทุนเทียบงบประมาณ. ระบุ projectId เพื่อดูรายหมวดต้นทุน (cost code) ของโครงการ หรือไม่ระบุเพื่อดูทุกโครงการที่กำลังดำเนินการเรียงตามความเสี่ยงเกินงบ",
    parameters: obj({ projectId: PROJECT_ID, limit: LIMIT }),
    run: (a) => {
      const cc = costCtx();
      const { pid, p } = projectFilter(a);
      if (pid) {
        if (!p) return { error: `ไม่พบโครงการ ${pid}` };
        const pc = projectCost(p, cc);
        const prog = projectProgress(p.id);
        return {
          projectId: p.id,
          name: p.name,
          progressPct: prog,
          contract: r0(pc.contract),
          budget: r0(pc.budget),
          budgetSource: pc.budgetSource === "estimate" ? "งบจากประมาณการ" : "งบประมาณมาตรฐาน (ยังไม่มีประมาณการ)",
          actual: r0(pc.actual),
          labourInActual: r0(pc.labour),
          committed: r0(pc.committed),
          forecastAtCompletion: r0(pc.forecast),
          variance: r0(pc.variance),
          marginPct: r1(pc.marginPct),
          usedPct: r1(pc.usedPct),
          spendAheadOfProgressPts: burnGap(r1(pc.usedPct), prog),
          alerts: pc.alerts.map((x) => x.text),
          byCostCode: pc.rows.map((r) => ({ code: r.code, name: COST_CODES[r.code as CostCode], budget: r0(r.budget), actual: r0(r.actual), committed: r0(r.committed), usedPct: r1(r.usedPct), expectedPct: r1(r.expectedPct), flag: r.flag === "over" ? "เกินงบ" : r.flag === "warn" ? "เฝ้าระวัง" : undefined })),
          note: "บาท ไม่รวม VAT; usedPct = (จริง + ผูกพัน) ÷ งบ",
          href: href.costs(p.id),
        };
      }
      const rows = ctx.projects
        .filter((x) => x.status === "building" || x.status === "handover")
        .map((x) => {
          const pc = projectCost(x, cc);
          return { id: x.id, name: x.name, progressPct: x.actual, budget: r0(pc.budget), actual: r0(pc.actual), committed: r0(pc.committed), forecast: r0(pc.forecast), variance: r0(pc.variance), marginPct: r1(pc.marginPct), usedPct: r1(pc.usedPct), overCodes: pc.rows.filter((r) => r.flag === "over").length, risk: r1(pc.risk), topAlert: pc.alerts[0]?.text, href: href.costs(x.id) };
        })
        .sort((x, y) => y.risk - x.risk);
      return {
        projects: rows.length,
        totals: { budget: r0(sum(rows.map((r) => r.budget))), actual: r0(sum(rows.map((r) => r.actual))), committed: r0(sum(rows.map((r) => r.committed))), forecast: r0(sum(rows.map((r) => r.forecast))) },
        forecastOverBudget: rows.filter((r) => r.variance < 0).length,
        note: "บาท ไม่รวม VAT; variance = งบ − คาดการณ์ (ติดลบ = เกินงบ); เรียงตามคะแนนความเสี่ยง",
        ...topN(rows, numArg(a.limit, 10)),
      };
    },
  };

  // ---------- cash ----------

  const arRows = (): MoneyRow[] =>
    installments
      .all()
      .filter((i) => i.status === "due" || i.status === "invoiced" || i.status === "overdue")
      .map((i) => ({ id: i.id, projectId: i.projectId, party: pname(i.projectId), label: `งวดที่ ${i.no} ${i.title}`, due: i.dueDate, amount: i.amount + i.vat, status: i.status, href: "/accounting/sales" }));
  // client certificates fall due `certPayDays` after the certificate date (contract terms)
  const certAr = (): MoneyRow[] => {
    const terms = contractTerms.all();
    const settings = getContractSettings();
    return certCol
      .all()
      .filter((c) => c.side === "client" && (c.status === "certified" || c.status === "submitted"))
      .map((c) => ({
        id: c.id,
        projectId: c.projectId,
        party: pname(c.projectId),
        label: `เบิกงวดผลงานที่ ${c.no} (${c.status === "certified" ? "รับรองแล้ว" : "รอผู้ว่าจ้างรับรอง"})`,
        due: addDaysIso(c.date, termsFor(terms, c.projectId, settings).certPayDays || 0),
        amount: c.net,
        status: c.status,
        href: href.contract(c.projectId),
      }));
  };
  const apRows = (): MoneyRow[] =>
    supplierBills
      .all()
      .filter((b) => b.status !== "paid")
      .map((b) => ({ id: b.id, projectId: b.projectId, party: b.supplierName, label: b.status === "approved" ? "อนุมัติจ่ายแล้ว รอจ่าย" : "รอตรวจ/อนุมัติ", due: b.dueDate, amount: b.subtotal + b.vat, status: b.status, href: "/accounting/purchases" }));
  const subAp = (): MoneyRow[] => {
    const scs = new Map(scCol.all().map((s) => [s.id, s]));
    return certCol
      .all()
      .filter((c) => c.side === "sub" && c.status === "certified")
      .map((c) => ({ id: c.id, projectId: c.projectId, party: scs.get(c.subcontractId ?? "")?.title ?? "ผู้รับเหมาช่วง", label: `เบิกงวดผู้รับเหมาช่วงที่ ${c.no}`, due: c.date, amount: c.net, status: c.status, href: c.subcontractId ? `/subcontractors/${scs.get(c.subcontractId)?.subcontractorId ?? ""}` : "/subcontractors" }));
  };

  const cash: Def = {
    modules: ["accounting", "contracts"],
    name: "cash_position",
    description: "ลูกหนี้ (งวดเงินลูกค้า + ใบเบิกงวดผลงานที่ยังไม่ได้รับเงิน) และเจ้าหนี้ (บิลผู้ขาย + งวดผู้รับเหมาช่วง) ที่ค้าง: ยอดค้างรวม เกินกำหนด ถึงกำหนดเดือนนี้ และภายใน N วัน พร้อมรายการเกินกำหนด",
    parameters: obj({ side: S("ar = ลูกหนี้, ap = เจ้าหนี้, both = ทั้งสอง", ["ar", "ap", "both"]), projectId: PROJECT_ID, horizonDays: N("ช่วงวันข้างหน้าที่นับว่าใกล้ถึงกำหนด (ค่าเริ่มต้น 30)"), limit: LIMIT }),
    run: (a) => {
      const side = strArg(a.side) ?? "both";
      const { ok } = projectFilter(a);
      const h = numArg(a.horizonDays, 30, 1, 365);
      const lim = numArg(a.limit, 10);
      const out: Record<string, unknown> = { today: TODAY, note: "บาท รวม VAT (ใบเบิกงวดเป็นยอดสุทธิหลังหักประกันผลงาน/ภาษี ณ ที่จ่าย); เจ้าหนี้ยังไม่หักภาษี ณ ที่จ่าย" };
      if (side !== "ap") {
        const rows = [...(can("accounting") ? arRows() : []), ...(can("contracts") ? certAr() : [])].filter((r) => ok(r.projectId));
        out.receivable = aging(rows, TODAY, h, lim);
        if (can("accounting")) {
          const sched = installments.all().filter((i) => i.status === "scheduled" && ok(i.projectId) && i.dueDate >= TODAY && i.dueDate <= addDaysIso(TODAY, h));
          out.scheduledNotYetBilled = { note: "งวดที่ยังไม่ถึงขั้นเรียกเก็บ (ตามแผน)", count: sched.length, amount: r0(sum(sched.map((i) => i.amount + i.vat))) };
        }
        if (!can("accounting")) out.receivableNote = "บทบาทนี้ไม่เห็นงวดเงินลูกค้า (บัญชี) เห็นเฉพาะใบเบิกงวดผลงาน";
      }
      if (side !== "ar") {
        const rows = [...(can("accounting") ? apRows() : []), ...(can("contracts") ? subAp() : [])].filter((r) => ok(r.projectId));
        out.payable = aging(rows, TODAY, h, lim);
      }
      return out;
    },
  };

  // ---------- sales ----------

  const sales: Def = {
    modules: ["sales"],
    name: "sales_pipeline",
    description: "ยอดขายในท่อ: ลูกค้ามุ่งหวังแยกตามขั้นการขาย มูลค่า มูลค่าถ่วงน้ำหนัก อัตราปิดการขาย ลูกค้าที่ต้องติดตาม และใบเสนอราคาแยกสถานะ/ใกล้หมดอายุ",
    parameters: obj({ owner: S("กรองตามชื่อพนักงานขาย"), province: S("จังหวัด"), limit: LIMIT }),
    run: (a) => {
      const owner = strArg(a.owner);
      const prov = strArg(a.province);
      const ls = leads.all().filter((l) => textMatch(owner, l.owner) && textMatch(prov, l.province));
      const pipe = pipeline(
        ls.map((l) => ({ id: l.id, stage: l.stage, budget: l.budget * 1e6, owner: l.owner, nextFollowUp: l.nextFollowUp })),
        STAGE_WEIGHT,
        TODAY,
        STAGES.map((s) => s.key),
      );
      const lim = numArg(a.limit, 10);
      const nameOf = new Map(ls.map((l) => [l.id, l.name]));
      const qs = quotes
        .all()
        .filter((q) => textMatch(owner, q.owner) && textMatch(prov, q.province))
        .map((q) => ({ q, st: quoteStatus(q), total: quoteTotals(q).total }));
      const expiring = qs
        .filter((x) => x.st === "sent" && daysDiff(TODAY, validUntil(x.q)) <= 14)
        .map((x) => ({ id: x.q.id, customer: x.q.customer.name, total: r0(x.total), validUntil: validUntil(x.q), href: `/quotes/${x.q.id}` }));
      return {
        today: TODAY,
        note: "มูลค่าเป็นบาท (งบลูกค้าโดยประมาณ); weighted = มูลค่า × โอกาสปิดตามขั้น",
        stages: pipe.stages.map((s) => ({ ...s, label: STAGE_LABEL[s.stage as keyof typeof STAGE_LABEL] })),
        open: pipe.open,
        winRatePct: pipe.winRate,
        byOwner: pipe.byOwner,
        followUpsDue: topN(
          pipe.followUpsDue.map((f) => ({ ...f, name: nameOf.get(f.id), stage: STAGE_LABEL[f.stage as keyof typeof STAGE_LABEL], href: `/sales/${f.id}` })),
          lim,
        ),
        quotes: Object.fromEntries(
          Object.entries(countBy(qs, (x) => x.st)).map(([k, n]) => [QUOTE_STATUS_LABEL[k as keyof typeof QUOTE_STATUS_LABEL], { count: n, total: r0(sum(qs.filter((x) => x.st === k).map((x) => x.total))) }]),
        ),
        quotesExpiringIn14Days: topN(expiring, lim),
      };
    },
  };

  // ---------- procurement ----------

  const procurement: Def = {
    modules: ["purchasing"],
    name: "procurement_status",
    description: "จัดซื้อ/คลัง: ใบสั่งซื้อรออนุมัติ ใบสั่งซื้อที่เปิดอยู่และส่งของเลยกำหนด ใบขอซื้อที่รอดำเนินการ และวัสดุในคลังกลางที่ต่ำกว่าจุดสั่งซื้อ",
    parameters: obj({ projectId: PROJECT_ID, limit: LIMIT }),
    run: (a) => {
      const { ok } = projectFilter(a);
      const lim = numArg(a.limit, 10);
      const sup = new Map(suppliers.all().map((s) => [s.id, s.name]));
      const pos = purchaseOrders.all().filter((p) => ok(p.projectId));
      const row = (p: (typeof pos)[number]) => ({ id: p.id, supplier: sup.get(p.supplierId) ?? p.supplierId, project: pname(p.projectId), date: p.date, deliveryDate: p.deliveryDate, total: r0(poTotals(p).total), status: PO_STATUS_LABEL[p.status], href: `/purchasing/${p.id}` });
      const pending = pos.filter((p) => p.status === "pending").sort((x, y) => x.date.localeCompare(y.date));
      const open = pos.filter(isOpenPO);
      const late = open.filter((p) => p.deliveryDate < TODAY).sort((x, y) => x.deliveryDate.localeCompare(y.deliveryDate));
      const prs = purchaseRequests.all().filter((r) => ok(r.projectId) && (r.status === "submitted" || r.status === "rfq"));
      const bal = stockState(stockMoves.all());
      const low = stockItems
        .all()
        .filter((i) => i.stock && i.min && (bal.get(balKey(WAREHOUSE, i.id))?.qty ?? 0) < i.min)
        .map((i) => ({ id: i.id, name: i.name, onHand: bal.get(balKey(WAREHOUSE, i.id))?.qty ?? 0, min: i.min, unit: i.unit, href: "/inventory" }));
      return {
        today: TODAY,
        note: "บาท รวม VAT",
        pendingApproval: { count: pending.length, amount: r0(sum(pending.map((p) => poTotals(p).total))), ...topN(pending.map(row), lim) },
        openOrders: { count: open.length, amount: r0(sum(open.map((p) => poTotals(p).total))) },
        lateDeliveries: { count: late.length, ...topN(late.map((p) => ({ ...row(p), daysLate: daysDiff(p.deliveryDate, TODAY) })), lim) },
        requestsWaiting: { count: prs.length, ...topN(prs.map((r) => ({ id: r.id, project: pname(r.projectId), date: r.date, by: r.requestedBy, lines: r.lines.length, status: PR_STATUS_LABEL[r.status], href: `/purchasing/${r.id}` })), lim) },
        lowStock: { count: low.length, ...topN(low, lim) },
      };
    },
  };

  // ---------- service (repairs / work orders / maintenance / inspections) ----------

  const service: Def = {
    modules: ["repairs", "workorders", "maintenance", "inspections"],
    name: "service_status",
    description: "งานบริการและหน้างาน: แจ้งซ่อมที่เปิดอยู่ (เกิน SLA) ใบสั่งงานที่ยังไม่ปิด บำรุงรักษาที่เลย/ใกล้กำหนด และนัดตรวจ/ผลตรวจไม่ผ่าน กรองตามคน (ช่าง/ผู้รับผิดชอบ) หรือโครงการได้",
    parameters: obj({ person: S("ชื่อช่างหรือผู้รับผิดชอบ (บางส่วนได้)"), projectId: PROJECT_ID, limit: LIMIT }),
    run: (a) => {
      const person = strArg(a.person);
      const { ok } = projectFilter(a);
      const lim = numArg(a.limit, 10);
      const out: Record<string, unknown> = { today: TODAY };
      if (can("repairs")) {
        const open = ctx.repairs.filter((r) => r.status !== "closed" && ok(r.projectId) && textMatch(person, r.assignee));
        out.repairs = {
          open: open.length,
          overSla: open.filter((r) => r.slaHours < 0).length,
          bySeverity: Object.fromEntries(Object.entries(countBy(open, (r) => r.severity)).map(([k, v]) => [SEVERITY_LABEL[k as keyof typeof SEVERITY_LABEL], v])),
          ...topN(
            open
              .sort((x, y) => x.slaHours - y.slaHours)
              .map((r) => ({ id: r.id, title: r.title, project: pname(r.projectId), assignee: r.assignee, severity: SEVERITY_LABEL[r.severity], status: REPAIR_STATUS_LABEL[r.status], slaHoursLeft: r.slaHours, reported: r.reported, href: `/repairs?q=${r.id}` })),
            lim,
          ),
        };
      }
      if (can("workorders")) {
        const open = ctx.workOrders.filter((w) => (w.status === "assigned" || w.status === "in_progress" || w.status === "on_hold") && ok(w.projectId) && textMatch(person, w.technician));
        out.workOrders = {
          open: open.length,
          byTechnician: countBy(open, (w) => w.technician),
          ...topN(
            open.sort((x, y) => x.scheduled.localeCompare(y.scheduled)).map((w) => ({ id: w.id, title: w.title, project: pname(w.projectId), technician: w.technician, scheduled: w.scheduled, status: WO_STATUS_LABEL[w.status], severity: SEVERITY_LABEL[w.severity], href: `/work-orders/${w.id}` })),
            lim,
          ),
        };
      }
      if (can("maintenance")) {
        const due = ctx.maintenance
          .filter((m) => ok(m.projectId) && textMatch(person, m.assignee, m.owner))
          .map((m) => ({ m, st: maintState(m) }))
          .filter((x) => x.st === "overdue" || x.st === "soon");
        out.maintenance = {
          overdue: due.filter((x) => x.st === "overdue").length,
          soon: due.filter((x) => x.st === "soon").length,
          ...topN(
            due.sort((x, y) => x.m.date.localeCompare(y.m.date)).map(({ m, st }) => ({ id: m.id, task: m.task, project: pname(m.projectId), owner: m.owner, assignee: m.assignee, date: m.date, state: st === "overdue" ? "เลยกำหนด" : "ใกล้ถึงกำหนด", href: "/maintenance" })),
            lim,
          ),
        };
      }
      if (can("inspections")) {
        const ins = ctx.inspections.filter((i) => ok(i.projectId) && textMatch(person, i.inspector));
        const upcoming = ins.filter((i) => i.result === "scheduled" && i.date >= TODAY).sort((x, y) => (x.date + x.time).localeCompare(y.date + y.time));
        const failed = ins.filter((i) => i.result === "fail" && daysDiff(i.date, TODAY) <= 30);
        const row = (i: OpsInspection) => ({ id: i.id, title: i.title, project: pname(i.projectId), inspector: i.inspector, date: i.date, time: i.time, score: i.score, href: `/inspections/${i.id}` });
        out.inspections = { today: upcoming.filter((i) => i.date === TODAY).length, upcoming: topN(upcoming.map(row), lim), failedLast30Days: topN(failed.map(row), lim) };
      }
      return out;
    },
  };

  // ---------- HR ----------

  const hr: Def = {
    modules: ["hr"],
    name: "hr_summary",
    description: "บุคคล/แรงงาน: จำนวนพนักงานแยกประเภท/แผนก/ไซต์ การมาทำงานของวันล่าสุด (ต่อไซต์) ใบลารออนุมัติและคนที่ลาวันนี้ ใบอนุญาตทำงานต่างด้าวใกล้หมดอายุ (ไม่มีข้อมูลเงินเดือนหรือเลขบัตร)",
    parameters: obj({ projectId: PROJECT_ID, limit: LIMIT }),
    run: (a) => {
      const { ok, pid } = projectFilter(a);
      const lim = numArg(a.limit, 10);
      const emps = employees.all().filter((e) => (e.status === "active" || e.status === "probation") && (!pid || e.projectId === pid));
      const empName = new Map(employees.all().map((e) => [e.id, e.name]));
      const sheets = attendance.all().filter((s) => ok(s.projectId));
      const day = latestOnOrBefore(
        sheets.map((s) => s.date),
        TODAY,
      );
      const daySheets = sheets.filter((s) => s.date === day);
      const lvs = leaves.all();
      const onLeave = lvs.filter((l) => l.status === "approved" && l.from <= TODAY && l.to >= TODAY);
      const pending = lvs.filter((l) => l.status === "pending");
      const permitsExp = emps
        .filter((e) => e.workPermitExpiry && daysDiff(TODAY, e.workPermitExpiry) <= 60)
        .map((e) => ({ id: e.id, name: e.name, project: e.projectId ? pname(e.projectId) : undefined, expiry: e.workPermitExpiry, inDays: daysDiff(TODAY, e.workPermitExpiry!), href: `/hr?q=${e.id}` }))
        .sort((x, y) => x.inDays - y.inDays);
      return {
        today: TODAY,
        headcount: emps.length,
        crewWorkersInSubcontractCrews: sum(emps.filter((e) => e.type === "subcontract").map((e) => e.crewSize ?? 0)),
        byType: Object.fromEntries(Object.entries(countBy(emps, (e) => e.type)).map(([k, v]) => [EMP_TYPE_LABEL[k as keyof typeof EMP_TYPE_LABEL], v])),
        byDepartment: countBy(emps, (e) => e.department),
        bySite: Object.entries(countBy(emps, (e) => e.projectId))
          .map(([id, n]) => ({ projectId: id, project: pname(id), count: n }))
          .sort((x, y) => y.count - x.count)
          .slice(0, lim),
        attendance: day
          ? {
              date: day,
              sites: daySheets.map((s) => ({ projectId: s.projectId, project: pname(s.projectId), present: s.entries.filter((e) => e.mark === "present").length, half: s.entries.filter((e) => e.mark === "half").length, absent: s.entries.filter((e) => e.mark === "absent").length, otHours: sum(s.entries.map((e) => e.ot)), href: "/hr/attendance" })),
            }
          : { note: "ไม่มีบันทึกการมาทำงาน" },
        leave: {
          pendingApproval: topN(pending.map((l) => ({ id: l.id, name: empName.get(l.employeeId) ?? l.employeeId, type: LEAVE_LABEL[l.type], from: l.from, to: l.to, days: l.days, href: "/hr" })), lim),
          onLeaveToday: onLeave.map((l) => ({ name: empName.get(l.employeeId) ?? l.employeeId, type: LEAVE_LABEL[l.type], to: l.to })),
        },
        workPermitsExpiring60Days: topN(permitsExp, lim),
      };
    },
  };

  // ---------- safety ----------

  const safety: Def = {
    modules: ["safety"],
    name: "safety_summary",
    description: "ความปลอดภัย: อุบัติเหตุ (90 วันล่าสุดแยกประเภท, ที่ยังไม่ปิด, วันที่ไม่มีอุบัติเหตุหยุดงาน) ใบอนุญาตทำงาน (กำลังทำงาน/รออนุมัติ/เกินเวลา) และผลตรวจความปลอดภัยที่รอแก้ไข",
    parameters: obj({ projectId: PROJECT_ID, limit: LIMIT }),
    run: (a) => {
      const { ok } = projectFilter(a);
      const lim = numArg(a.limit, 10);
      const inc = incidents.all().filter((i) => ok(i.projectId));
      const recent = inc.filter((i) => daysDiff(i.date, TODAY) <= 90);
      const lastLti = inc
        .filter(isLti)
        .map((i) => i.date)
        .sort()
        .pop();
      const open = inc.filter((i) => i.status !== "closed");
      const now = nowIso();
      const ptw = permits.all().filter((p) => ok(p.projectId));
      const prow = (p: (typeof ptw)[number]) => ({ id: p.id, type: PERMIT_SHORT[p.type], title: p.title, project: pname(p.projectId), validFrom: p.validFrom, validTo: p.validTo, status: PERMIT_STATUS_LABEL[p.status], href: `/safety?tab=permits&q=${p.id}` });
      const sin = safetyInspections.all().filter((x) => ok(x.projectId) && !x.closed && x.followUpDue);
      return {
        today: TODAY,
        incidents: {
          last90DaysByClass: Object.fromEntries(Object.entries(countBy(recent, (i) => i.cls)).map(([k, v]) => [INC_LABEL[k as keyof typeof INC_LABEL], v])),
          daysSinceLastLostTime: lastLti ? daysDiff(lastLti, TODAY) : null,
          open: open.length,
          ...topN(
            open.map((i) => {
              const f = incidentFollowUp(i, TODAY);
              return { id: i.id, date: i.date, class: INC_LABEL[i.cls], project: pname(i.projectId), place: i.place, openActions: f.open, overdueActions: f.overdue, kt16Missing: f.kt16Missing, href: `/safety?tab=incidents&q=${i.id}` };
            }),
            lim,
          ),
        },
        permits: {
          activeNow: ptw.filter((p) => p.status === "active" && p.validFrom <= now && p.validTo >= now).length,
          waiting: topN(ptw.filter((p) => p.status === "requested" || p.status === "issued").map(prow), lim),
          overrun: topN(ptw.filter((p) => permitOverdue(p, now)).map(prow), lim),
        },
        inspectionsAwaitingFix: topN(
          sin.sort((x, y) => (x.followUpDue ?? "").localeCompare(y.followUpDue ?? "")).map((x) => ({ id: x.id, project: pname(x.projectId), location: x.scaffoldNo ?? x.location, due: x.followUpDue, actions: x.actions, href: `/safety?tab=inspections&q=${x.id}` })),
          lim,
        ),
      };
    },
  };

  // ---------- engineering ----------

  const engineering: Def = {
    modules: ["engineering"],
    name: "engineering_status",
    description: "วิศวกรรม/คุณภาพ: RFI ที่รอตอบ (เลยกำหนด/ใกล้กำหนด) เอกสารส่งอนุมัติที่รอพิจารณา NCR ที่เปิดค้าง และผลทดสอบคอนกรีตที่ไม่ผ่านหรือถึงกำหนดทดสอบ",
    parameters: obj({ projectId: PROJECT_ID, limit: LIMIT }),
    run: (a) => {
      const { ok } = projectFilter(a);
      const lim = numArg(a.limit, 10);
      const openRfi = rfis.all().filter((r) => ok(r.projectId) && r.status === "open");
      const sbm = submittals
        .all()
        .filter((s) => ok(s.projectId))
        .map((s) => ({ s, st: submittalState(s, TODAY) }));
      const waiting = sbm.filter((x) => x.st === "review" || x.st === "overdue");
      const openNcr = ncrs.all().filter((n) => ok(n.projectId) && n.status !== "closed");
      const tests = concreteTests.all().filter((t) => ok(t.projectId));
      const failed = tests.filter((t) => concreteVerdict(t, ENG_DEFAULTS.concrete) === "fail");
      const dueTests = tests.filter((t) => t.sets.some((s) => !s.results.length && s.due <= TODAY));
      return {
        today: TODAY,
        rfis: {
          open: openRfi.length,
          overdue: openRfi.filter((r) => r.due < TODAY).length,
          ...topN(
            openRfi.sort((x, y) => x.due.localeCompare(y.due)).map((r) => ({ id: r.id, subject: r.subject, project: pname(r.projectId), discipline: DISC_LABEL[r.disc], assignedTo: r.assignedTo, due: r.due, daysOverdue: r.due < TODAY ? daysDiff(r.due, TODAY) : 0, status: RFI_STATUS_LABEL[r.status], href: `/rfi/${r.id}` })),
            lim,
          ),
        },
        submittals: {
          byState: Object.fromEntries(Object.entries(countBy(sbm, (x) => x.st)).map(([k, v]) => [SUBMITTAL_STATE_LABEL[k as keyof typeof SUBMITTAL_STATE_LABEL], v])),
          waiting: topN(
            waiting.map(({ s, st }) => ({ id: s.id, title: s.title, project: pname(s.projectId), reviewer: s.reviewer, rev: latestRev(s).rev, due: latestRev(s).due, state: SUBMITTAL_STATE_LABEL[st], href: `/submittals/${s.id}` })),
            lim,
          ),
        },
        ncrs: {
          open: openNcr.length,
          bySeverity: Object.fromEntries(Object.entries(countBy(openNcr, (n) => n.severity)).map(([k, v]) => [NCR_SEVERITY_LABEL[k as keyof typeof NCR_SEVERITY_LABEL], v])),
          ...topN(
            openNcr.sort((x, y) => x.raisedAt.localeCompare(y.raisedAt)).map((n) => ({ id: n.id, title: n.title, project: pname(n.projectId), severity: NCR_SEVERITY_LABEL[n.severity], status: NCR_STATUS_LABEL[n.status], responsible: n.responsible, raisedAt: n.raisedAt, due: n.due, href: `/quality?tab=ncr&q=${n.id}` })),
            lim,
          ),
        },
        concreteTests: {
          failed: topN(failed.map((t) => ({ id: t.id, element: t.element, project: pname(t.projectId), fcKsc: t.fc, pourDate: t.pourDate, href: `/quality?tab=tests&q=${t.id}` })), lim),
          testsDue: dueTests.length,
        },
      };
    },
  };

  // ---------- field diaries ----------

  const diaries: Def = {
    modules: ["field"],
    name: "site_diaries",
    description: "รายงานประจำวันหน้างาน: รายการล่าสุด (วันที่ สภาพอากาศ จำนวนคน งานที่ทำ ปัญหา) และไซต์ก่อสร้างที่ยังไม่มีรายงานของวันนี้",
    parameters: obj({ projectId: PROJECT_ID, days: N("ย้อนหลังกี่วัน (ค่าเริ่มต้น 7)"), limit: LIMIT }),
    run: (a) => {
      const { ok } = projectFilter(a);
      const since = addDaysIso(TODAY, -numArg(a.days, 7, 0, 90));
      const ds = siteDiaries
        .all()
        .filter((d) => ok(d.projectId) && d.date >= since && d.date <= TODAY)
        .sort((x, y) => y.date.localeCompare(x.date));
      const building = ctx.projects.filter((p) => p.status === "building" && ok(p.id));
      const todayIds = new Set(
        siteDiaries
          .all()
          .filter((d) => d.date === TODAY)
          .map((d) => d.projectId),
      );
      return {
        today: TODAY,
        since,
        count: ds.length,
        waitingApproval: ds.filter((d) => d.status === "submitted").length,
        ...topN(
          ds.map((d) => ({
            id: d.id,
            project: pname(d.projectId),
            date: d.date,
            weather: `${WEATHER_LABEL[d.weatherAm]}/${WEATHER_LABEL[d.weatherPm]}`,
            rainHours: d.rainHours,
            manpower: sum(d.manpower.map((m) => m.count)),
            work: d.work.slice(0, 4).map((w) => w.text.slice(0, 120)),
            issues: d.issues?.slice(0, 200),
            safety: d.safety?.slice(0, 120),
            status: d.status,
            by: d.by,
            href: `/diary/${d.id}`,
          })),
          numArg(a.limit, 10),
        ),
        buildingSitesWithoutDiaryToday: building.filter((p) => !todayIds.has(p.id)).map((p) => ({ id: p.id, name: p.name, href: `/diary?project=${p.id}` })),
      };
    },
  };

  // ---------- material prices ----------

  const prices: Def = {
    modules: ["costs", "purchasing"],
    name: "material_prices",
    description: "ราคาวัสดุล่าสุดจากฐานราคา (พาณิชย์จังหวัด/กรมบัญชีกลาง/ผู้ขาย) พร้อม % เปลี่ยนจากเดือนก่อน ค้นด้วยชื่อหรือรหัสวัสดุ หรือ movers=true เพื่อดูรายการที่ราคาขึ้น/ลงมากที่สุด",
    parameters: obj({ q: S("ชื่อหรือรหัสวัสดุ เช่น เหล็ก DB12, ปูน, คอนกรีต"), movers: { type: "boolean", description: "แสดงรายการที่ราคาเปลี่ยนมากที่สุด" }, limit: LIMIT }),
    run: (a) => {
      const obs = priceObs.all();
      const q = strArg(a.q);
      const items = priceItems.all().filter((i) => textMatch(q, i.code, i.name, i.category, i.spec));
      const rows = items.map((i) => {
        const bySource = PRICE_SOURCES.map((s) => ({ s, l: latestOf(i, s, obs) })).filter((x) => x.l);
        const main = bySource[0]?.l;
        return {
          code: i.code,
          name: i.name,
          unit: i.unit,
          labourPerUnit: i.labour,
          prices: bySource.map(({ s, l }) => ({ source: PRICE_SOURCE_LABEL[s], price: r1(l!.price), changePct: l!.change === undefined ? undefined : r1(l!.change * 100), month: l!.date.slice(0, 7), sample: l!.sample })),
          maxAbsChange: main?.change === undefined ? 0 : Math.abs(main.change),
        };
      });
      const list = a.movers ? rows.sort((x, y) => y.maxAbsChange - x.maxAbsChange) : rows;
      return {
        note: "บาทต่อหน่วย ไม่รวม VAT; sample=true คือราคาตัวอย่างที่ระบบสร้าง ไม่ใช่ราคาจริง",
        ...topN(
          list.map((r) => ({ code: r.code, name: r.name, unit: r.unit, labourPerUnit: r.labourPerUnit, prices: r.prices })),
          numArg(a.limit, 10),
        ),
        href: "/prices",
      };
    },
  };

  // ---------- notifications ----------

  const notifications: Def = {
    modules: [],
    name: "notifications",
    description: "สรุปการแจ้งเตือนที่ผู้ใช้คนนี้เห็น (ทุกหมวดที่มีสิทธิ์) จำนวนตามหมวดและความเร่งด่วน และรายการเร่งด่วนที่สุด",
    parameters: obj({ cat: S("หมวด เช่น repairs, receivables, payables, purchasing, safety, rfi (ไม่ระบุ = ทั้งหมด)"), limit: LIMIT }),
    run: (a) => {
      const cat = strArg(a.cat);
      const ns = ctx.notes.filter((n) => !cat || n.cat === cat);
      return {
        count: ns.length,
        urgent: ns.filter((n) => n.tone === "neg").length,
        byCategory: countBy(ns, (n) => n.cat),
        ...topN(
          ns.map((n) => ({ title: n.title, sub: n.sub, date: n.date, urgency: n.tone === "neg" ? "ด่วน" : n.tone === "warn" ? "เฝ้าระวัง" : "ทั่วไป", href: n.href })),
          numArg(a.limit, 12),
        ),
      };
    },
  };

  // ---------- search ----------

  const search: Def = {
    modules: [],
    name: "search",
    description: "ค้นหาเอกสาร/รายการจากรหัสหรือชื่อ ทุกส่วนที่บทบาทนี้ดูได้: โครงการ ลูกค้า ใบเสนอราคา PO/PR ผู้ขาย ผู้รับเหมาช่วง RFI เอกสารส่งอนุมัติ NCR แจ้งซ่อม ใบสั่งงาน การตรวจ พนักงาน อุบัติเหตุ ใบอนุญาตทำงาน รายงานประจำวัน งานเปลี่ยนแปลง ใช้เมื่อผู้ใช้อ้างรหัสหรือชื่อที่ไม่รู้ว่าเป็นอะไร",
    parameters: obj({ q: S("รหัสหรือคำค้น"), limit: LIMIT }, ["q"]),
    run: (a) => {
      const q = strArg(a.q) ?? "";
      const items: SearchItem[] = [];
      const add = (kind: string, id: string, title: string, url: string, sub?: string, extra?: string) => items.push({ kind, id, title, href: url, sub, extra });
      if (can("projects")) for (const p of ctx.projects) add("โครงการ", p.id, p.name, href.project(p.id), `${STATUS_LABEL[p.status]} · ${p.province} · PM ${p.pm}`, `${p.owner} ${p.model}`);
      if (can("sales")) {
        for (const l of leads.all()) add("ลูกค้ามุ่งหวัง", l.id, l.name, `/sales/${l.id}`, `${STAGE_LABEL[l.stage]} · ${l.province} · ${l.owner}`, l.phone);
        for (const x of quotes.all()) add("ใบเสนอราคา", x.id, x.customer.name, `/quotes/${x.id}`, `${QUOTE_STATUS_LABEL[quoteStatus(x)]} · ${x.modelCode} · ${r0(quoteTotals(x).total).toLocaleString("th-TH")} บาท`);
      }
      if (can("purchasing")) {
        const sup = new Map(suppliers.all().map((s) => [s.id, s.name]));
        for (const p of purchaseOrders.all()) add("ใบสั่งซื้อ", p.id, sup.get(p.supplierId) ?? p.supplierId, `/purchasing/${p.id}`, `${PO_STATUS_LABEL[p.status]} · ${pname(p.projectId)} · ${r0(poTotals(p).total).toLocaleString("th-TH")} บาท`);
        for (const r of purchaseRequests.all()) add("ใบขอซื้อ", r.id, r.lines.map((l) => l.description).join(", ").slice(0, 80), `/purchasing/${r.id}`, `${PR_STATUS_LABEL[r.status]} · ${pname(r.projectId)}`);
        for (const s of suppliers.all()) add("ผู้ขาย", s.id, s.name, `/suppliers?q=${s.id}`);
      }
      if (can("contracts")) {
        for (const v of voCol.all()) add("งานเปลี่ยนแปลง", v.id, v.title, `/contracts/variations/${v.id}`, `${v.status} · ${pname(v.projectId)} · ${r0(v.amount).toLocaleString("th-TH")} บาท`);
        for (const s of scCol.all()) add("สัญญาจ้างช่วง", s.id, s.title, `/contracts/${s.projectId}`, `${s.status} · ${pname(s.projectId)}`);
      }
      if (can("engineering")) {
        for (const r of rfis.all()) add("RFI", r.id, r.subject, `/rfi/${r.id}`, `${RFI_STATUS_LABEL[r.status]} · ${pname(r.projectId)} · กำหนด ${r.due}`);
        for (const s of submittals.all()) add("เอกสารส่งอนุมัติ", s.id, s.title, `/submittals/${s.id}`, `${SUBMITTAL_STATE_LABEL[submittalState(s, TODAY)]} · ${pname(s.projectId)}`);
        for (const n of ncrs.all()) add("NCR", n.id, n.title, `/quality?tab=ncr&q=${n.id}`, `${NCR_STATUS_LABEL[n.status]} · ${NCR_SEVERITY_LABEL[n.severity]} · ${pname(n.projectId)}`);
      }
      if (can("repairs")) for (const r of ctx.repairs) add("แจ้งซ่อม", r.id, r.title, `/repairs?q=${r.id}`, `${REPAIR_STATUS_LABEL[r.status]} · ${pname(r.projectId)} · ${r.assignee}`, r.asset);
      if (can("workorders")) for (const w of ctx.workOrders) add("ใบสั่งงาน", w.id, w.title, `/work-orders/${w.id}`, `${WO_STATUS_LABEL[w.status]} · ${w.technician} · ${pname(w.projectId)}`);
      if (can("inspections")) for (const i of ctx.inspections) add("การตรวจ", i.id, i.title, `/inspections/${i.id}`, `${i.date} · ${pname(i.projectId)} · ${i.inspector}`);
      if (can("hr")) for (const e of employees.all()) add("พนักงาน", e.id, e.name, `/hr?q=${e.id}`, `${e.position} · ${e.department}${e.projectId ? ` · ${pname(e.projectId)}` : ""}`, e.nickname);
      if (can("safety")) {
        for (const i of incidents.all()) add("อุบัติเหตุ", i.id, `${INC_LABEL[i.cls]} · ${i.place}`, `/safety?tab=incidents&q=${i.id}`, `${i.date} · ${pname(i.projectId)}`);
        for (const p of permits.all()) add("ใบอนุญาตทำงาน", p.id, p.title, `/safety?tab=permits&q=${p.id}`, `${PERMIT_STATUS_LABEL[p.status]} · ${pname(p.projectId)}`);
      }
      if (can("field")) for (const d of siteDiaries.all()) add("รายงานประจำวัน", d.id, `${pname(d.projectId)} ${d.date}`, `/diary/${d.id}`, `${d.status} · ${d.by}`);
      const hits = searchRank(items, q, numArg(a.limit, 12, 1, 30));
      return { q, count: hits.length, items: hits.map((h) => ({ kind: h.kind, id: h.id, title: h.title, sub: h.sub, href: h.href })) };
    },
  };

  const defs: Def[] = [listProjects, projectOverview, schedule, costs, cash, sales, procurement, service, hr, safety, engineering, diaries, prices, notifications, search];
  return defs.filter((d) => !d.modules.length || d.modules.some(can)).map((d): ClientTool => ({ name: d.name, description: d.description, parameters: d.parameters, run: d.run }));
}

/** names of the tools with a short Thai label, for the "กำลังค้นข้อมูล: …" step indicator */
export const TOOL_LABEL: Record<string, string> = {
  list_projects: "รายการโครงการ",
  project_overview: "ภาพรวมโครงการ",
  schedule_status: "แผนงาน/ความคืบหน้า",
  cost_vs_budget: "ต้นทุนเทียบงบ",
  cash_position: "ลูกหนี้/เจ้าหนี้",
  sales_pipeline: "การขาย",
  procurement_status: "จัดซื้อ/คลัง",
  service_status: "งานซ่อม/ใบสั่งงาน/ตรวจ",
  hr_summary: "บุคคล/แรงงาน",
  safety_summary: "ความปลอดภัย",
  engineering_status: "RFI/NCR/คุณภาพ",
  site_diaries: "รายงานประจำวัน",
  material_prices: "ราคาวัสดุ",
  notifications: "การแจ้งเตือน",
  search: "ค้นหา",
};
