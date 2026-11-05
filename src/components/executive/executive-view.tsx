"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { Page } from "@/components/shell/topbar";
import { Card, CardHead, PageHeader, Status, cx } from "@/components/ui";
import { Kpi, Meter, MoreLink } from "@/components/dashboard/kpi";
import { projects, team, TODAY, ROLE_LABEL, type Role } from "@/lib/data";
import { budgets, costEntries, installments, payrollRuns, supplierBills } from "@/lib/biz";
import { collections } from "@/lib/collection";
import { useInspections, useRepairs } from "@/lib/ops-store";
import { useMe } from "@/lib/use-me";
import { canView } from "@/lib/permissions";
import { thLongDate } from "@/components/dashboard/metrics";
import { CashflowChart, CashflowLegend } from "./cashflow-chart";
import {
  actualCosts,
  apAging,
  arAging,
  cashFlow,
  contractValueOf,
  isOpenProject,
  isWon,
  margins,
  mb,
  pipeline,
  quality,
  quoteDate,
  quoteStatus,
  quoteValue,
  type AgingBucket,
  type Rec,
} from "./metrics";

const NO_RECS: Rec[] = [];
const EMPTY_COL = { use: () => NO_RECS };
/** Sales collections belong to the sales module; read them if registered, else empty */
function useKind(kind: string): Rec[] {
  const col = (collections().find((c) => c.kind === kind) as unknown as { use: () => Rec[] } | undefined) ?? EMPTY_COL;
  return col.use();
}

const pct = (v: number | null, d = 0) => (v == null ? "–" : `${(v * 100).toFixed(d)}%`);
const year = Number(TODAY.slice(0, 4));

export function ExecutiveView() {
  const me = useMe();
  const showMoney = canView(me.role, "reports") && canView(me.role, "costs");

  const inst = installments.use();
  const bills = supplierBills.use();
  const costs = costEntries.use();
  const buds = budgets.use();
  const runs = payrollRuns.use();
  const ins = useInspections();
  const reps = useRepairs();
  const leads = useKind("leads");
  const quotes = useKind("quotes");

  const open = projects.filter(isOpenProject);
  const active = projects.filter((p) => p.status === "building" || p.status === "handover");

  // ---- sales ----
  const wonQuotes = quotes.filter((q) => isWon(quoteStatus(q)));
  const salesFromQuotes = wonQuotes.length > 0;
  const yearSales = (y: number) =>
    salesFromQuotes
      ? wonQuotes.filter((q) => quoteDate(q).startsWith(String(y))).reduce((s, q) => s + quoteValue(q), 0)
      : projects.filter((p) => p.contractDate?.startsWith(String(y))).reduce((s, p) => s + contractValueOf(p, buds), 0);
  const salesNow = yearSales(year);
  const salesPrev = yearSales(year - 1);
  const target = Math.ceil((salesPrev * 1.1) / 1e6) * 1e6;
  const yearFrac = (Date.parse(TODAY) - Date.parse(`${year}-01-01`)) / (365 * 86400000);
  const pipe = pipeline(leads, quotes);

  // ---- backlog / revenue ----
  const backlog = open.reduce((s, p) => s + contractValueOf(p, buds) * (1 - p.actual / 100), 0);
  const recognised = active.reduce((s, p) => s + contractValueOf(p, buds) * (p.actual / 100), 0);
  const activeIds = new Set(active.map((p) => p.id));
  const activeInst = inst.filter((i) => activeIds.has(i.projectId));
  const collected = activeInst.filter((i) => i.status === "paid").reduce((s, i) => s + i.amount, 0);
  const billed = activeInst.filter((i) => i.status !== "scheduled").reduce((s, i) => s + i.amount, 0);

  // ---- cost & margin ----
  const costMap = actualCosts(costs, runs);
  const rows = margins(projects, buds, costMap);
  const withCost = rows.filter((r) => r.cost > 0);
  const avgMargin = withCost.length ? withCost.reduce((s, r) => s + r.margin * r.contract, 0) / withCost.reduce((s, r) => s + r.contract, 0) : null;

  // ---- cash ----
  const flow = cashFlow(inst, bills, runs);
  const ahead = flow.months.filter((m) => m.forecast);
  const netAhead = ahead.reduce((s, m) => s + m.net, 0);
  const ar = arAging(inst);
  const ap = apAging(bills);

  // ---- risk ----
  const risk = active
    .map((p) => {
      const r = rows.find((x) => x.project.id === p.id);
      const behind = p.plan - p.actual;
      const over = r && r.cost > 0 ? r.overrun : 0;
      return { p, behind, over, score: Math.max(0, behind) + Math.max(0, over * 100) / 2 };
    })
    .filter((x) => x.behind >= 3 || x.over > 0.05)
    .sort((a, b) => b.score - a.score);

  // ---- quality / people ----
  const q = quality(ins, reps);
  const activeTeam = team.filter((m) => m.active);
  const byRole = Object.entries(
    activeTeam.reduce<Record<string, number>>((m, t) => ((m[t.role] = (m[t.role] ?? 0) + 1), m), {}),
  ).sort((a, b) => b[1] - a[1]);
  const periods = [...new Set(runs.filter((r) => r.status !== "draft").map((r) => r.period))].sort();
  const lastPeriod = periods[periods.length - 1];
  const lastRuns = runs.filter((r) => r.period === lastPeriod && r.status !== "draft");
  const lastCost = lastRuns.reduce((s, r) => s + r.lines.reduce((a, l) => a + l.gross + l.ot, 0) + r.employerSso, 0);
  const dailyWorkers = new Set(lastRuns.filter((r) => r.kind === "daily").flatMap((r) => r.lines.map((l) => l.employeeId))).size;
  const ytdLabour = runs.filter((r) => r.period.startsWith(String(year)) && r.status !== "draft").reduce((s, r) => s + r.lines.reduce((a, l) => a + l.gross + l.ot, 0) + r.employerSso, 0);

  return (
    <Page trail={[{ label: "ภาพรวม" }, { label: "ผู้บริหาร" }]}>
      <PageHeader
        title="ภาพรวมผู้บริหาร"
        sub={`ยอดขาย งานในมือ กระแสเงินสด กำไรรายโครงการ และคุณภาพงาน ข้อมูล ณ ${thLongDate(TODAY)}`}
      />

      {!showMoney && (
        <Card className="mb-4 flex items-center gap-2 px-5 py-3 text-[14px] text-ink-2">
          <Lock size={16} strokeWidth={1.5} className="text-ink-3" />
          บทบาท {me.roleLabel} ดูตัวเลขการเงินไม่ได้ แสดงเฉพาะความคืบหน้าและคุณภาพงาน
        </Card>
      )}

      {/* KPI row */}
      <div className={cx("grid grid-cols-2 gap-3", showMoney ? "lg:grid-cols-3 xl:grid-cols-6" : "lg:grid-cols-4")}>
        {showMoney && (
          <>
            <Kpi
              label={`ยอดขายปี ${year + 543}`}
              value={mb(salesNow)}
              change={salesPrev ? { text: `${(((salesNow - salesPrev) / salesPrev) * 100).toFixed(0)}%`, tone: salesNow >= salesPrev ? "pos" : "neg", dir: salesNow >= salesPrev ? "up" : "down" } : undefined}
              note={`${salesFromQuotes ? "จากใบเสนอราคาที่ปิดได้" : "จากสัญญาที่เซ็นในปี"} · เป้า ${mb(target)}`}
            >
              <Meter value={target ? (salesNow / target) * 100 : 0} label={`ของเป้า · ผ่านไป ${Math.round(yearFrac * 100)}% ของปี`} tone="accent" />
            </Kpi>
            <Kpi label="Pipeline" value={mb(pipe.total)} note={pipe.source === "none" ? "ยังไม่มีลีดหรือใบเสนอราคา" : `${pipe.rows.reduce((s, r) => s + r.n, 0)} รายการที่ยังเปิดอยู่`} href="/sales" />
            <Kpi label="งานในมือ (Backlog)" value={mb(backlog)} note={`มูลค่าที่ยังไม่ได้สร้าง ${open.length} โครงการ`} />
            <Kpi label="รายได้รับรู้ vs เงินรับ" value={mb(recognised)} note={inst.length ? `รับเงินแล้ว ${mb(collected)} · วางบิล ${mb(billed)}` : "ยังไม่มีงวดเงินในระบบ"}>
              {recognised > 0 && inst.length > 0 && <Meter value={(collected / recognised) * 100} label="เงินรับ / รายได้รับรู้" />}
            </Kpi>
            <Kpi label="กำไรขั้นต้นคาดการณ์" value={pct(avgMargin, 1)} note={withCost.length ? `ถ่วงน้ำหนักจาก ${withCost.length} โครงการที่มีต้นทุนจริง` : "ยังไม่มีต้นทุนจริง"} href="/costs" />
          </>
        )}
        <Kpi label="ผ่านการตรวจ" value={pct(q.passRate)} note={`${q.inspected} การตรวจที่มีผล`} href="/inspections" />
        {!showMoney && (
          <>
            <Kpi label="โครงการที่ดำเนินอยู่" value={active.length} note={`ล่าช้ากว่าแผน ${active.filter((p) => p.plan - p.actual >= 3).length} โครงการ`} href="/projects" />
            <Kpi label="แจ้งซ่อมที่เปิดอยู่" value={q.open} note={`เกิน SLA ${q.overSla} รายการ`} href="/repairs" />
            <Kpi label="พนักงาน" value={activeTeam.length} unit="คน" note="ผู้ใช้ที่ใช้งานอยู่" />
          </>
        )}
      </div>

      {/* main chart */}
      {showMoney && (
        <Card className="mt-4">
          <CardHead title="กระแสเงินสด" meta="6 เดือนที่ผ่านมา + คาดการณ์ 6 เดือน" action={<CashflowLegend />} />
          <div className="px-5 pb-4 pt-3">
            {inst.length || bills.length || runs.length ? (
              <>
                <CashflowChart data={flow.months} />
                <div className="mt-3 flex flex-wrap gap-x-8 gap-y-1 text-[13px] text-ink-2">
                  <span>
                    เงินเข้าคาดการณ์ <span className="num font-mono text-ink">{mb(ahead.reduce((s, m) => s + m.inflow, 0))}</span>
                  </span>
                  <span>
                    เงินออกคาดการณ์ <span className="num font-mono text-ink">{mb(ahead.reduce((s, m) => s + m.outflow, 0))}</span>
                  </span>
                  <span>
                    สุทธิ 6 เดือน <span className={cx("num font-mono", netAhead < 0 ? "text-neg" : "text-ink")}>{mb(netAhead)}</span>
                  </span>
                  <span className="text-ink-3">เงินเดือนคาดการณ์จากค่าเฉลี่ย 3 งวดล่าสุด {mb(flow.payrollAvg, 2)} / เดือน · งวดที่ค้างชำระรวมไว้ในเดือนนี้</span>
                </div>
              </>
            ) : (
              <p className="py-16 text-center text-[14px] text-ink-3">ยังไม่มีงวดเงินลูกค้า ใบแจ้งหนี้ผู้ขาย หรือเงินเดือนในระบบ</p>
            )}
          </div>
        </Card>
      )}

      {showMoney && (
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHead title="Pipeline ตามขั้น" meta={mb(pipe.total)} action={<MoreLink href="/sales" />} />
            {pipe.rows.length === 0 ? (
              <p className="px-5 py-5 text-[14px] text-ink-3">ยังไม่มีลีดหรือใบเสนอราคาที่เปิดอยู่</p>
            ) : (
              <ul className="flex flex-col gap-3 px-5 py-4">
                {pipe.rows.slice(0, 7).map((r) => (
                  <li key={r.stage}>
                    <div className="flex items-baseline justify-between gap-3 text-[13px]">
                      <span className="truncate text-ink">{r.label}</span>
                      <span className="num shrink-0 font-mono text-ink-2">
                        {mb(r.value)} <span className="text-ink-3">· {r.n}</span>
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-raised">
                      <div className="h-full rounded-full bg-ink-2/70" style={{ width: `${pipe.rows[0].value ? (r.value / pipe.rows[0].value) * 100 : 0}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <AgingCard title="ลูกหนี้ค้างรับ (AR)" data={ar} href="/accounting" empty="ไม่มีงวดที่ค้างรับ" />
          <AgingCard title="เจ้าหนี้ค้างจ่าย (AP)" data={ap} href="/accounting" empty="ไม่มีใบแจ้งหนี้ผู้ขายที่ค้างจ่าย" />
        </div>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        {showMoney ? (
          <Card>
            <CardHead title="กำไรขั้นต้นรายโครงการ" meta="คาดการณ์ ณ วันสิ้นสุดโครงการ" action={<MoreLink href="/costs" />} />
            {rows.length === 0 ? (
              <p className="px-5 py-5 text-[14px] text-ink-3">ยังไม่มีงบประมาณหรือต้นทุนจริงของโครงการ</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-line text-left text-ink-3">
                      <th className="px-5 py-2.5 font-normal">โครงการ</th>
                      <th className="px-3 py-2.5 text-right font-normal">มูลค่าสัญญา</th>
                      <th className="px-3 py-2.5 text-right font-normal">งบ</th>
                      <th className="px-3 py-2.5 text-right font-normal">ต้นทุนจริง</th>
                      <th className="px-3 py-2.5 text-right font-normal">คืบหน้า</th>
                      <th className="px-5 py-2.5 text-right font-normal">กำไรคาดการณ์</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {[...rows]
                      .sort((a, b) => a.margin - b.margin)
                      .slice(0, 10)
                      .map((r) => (
                        <tr key={r.project.id}>
                          <td className="px-5 py-2.5">
                            <Link href={`/projects/${r.project.id}`} className="hover:underline">
                              {r.project.name}
                            </Link>
                            <span className="ml-2 font-mono text-[12px] text-ink-3">{r.project.id}</span>
                          </td>
                          <td className="num px-3 py-2.5 text-right font-mono">{mb(r.contract, 2)}</td>
                          <td className="num px-3 py-2.5 text-right font-mono text-ink-2">{r.budget ? mb(r.budget, 2) : "–"}</td>
                          <td className={cx("num px-3 py-2.5 text-right font-mono", r.overrun > 0.05 && "text-neg")}>{r.cost ? mb(r.cost, 2) : "–"}</td>
                          <td className="num px-3 py-2.5 text-right font-mono text-ink-2">{r.project.actual}%</td>
                          <td className={cx("num px-5 py-2.5 text-right font-mono", r.margin < 0.08 ? "text-neg" : "text-ink")}>
                            {pct(r.margin, 1)}
                            {r.budgetMargin != null && <span className="ml-1.5 text-ink-3">/ {pct(r.budgetMargin, 0)}</span>}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                <p className="border-t border-line px-5 py-2.5 text-[12px] text-ink-3">
                  กำไรคาดการณ์ = (มูลค่าสัญญา − ต้นทุนจริง ÷ % คืบหน้า) ÷ มูลค่าสัญญา · ตัวเลขหลัง / คือกำไรตามงบ · ต้นทุนรวมค่าแรงหน้างานจากเงินเดือน
                </p>
              </div>
            )}
          </Card>
        ) : (
          <div />
        )}

        <Card>
          <CardHead title="โครงการที่ต้องจับตา" meta={`${risk.length} โครงการ`} action={<MoreLink href="/projects" />} />
          {risk.length === 0 ? (
            <p className="px-5 py-5 text-[14px] text-ink-3">ไม่มีโครงการที่ล่าช้าหรือเกินงบอย่างมีนัย</p>
          ) : (
            <ol className="divide-y divide-line">
              {risk.slice(0, 7).map(({ p, behind, over }, i) => (
                <li key={p.id} className="flex items-start gap-3 px-5 py-2.5">
                  <span className="num w-4 shrink-0 font-mono text-[12px] text-ink-3">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/projects/${p.id}`} className="block truncate text-[14px] hover:underline">
                      {p.name}
                    </Link>
                    <p className="text-[12px] text-ink-3">
                      {p.phase} · PM {p.pm}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    {behind >= 3 && <Status tone="warn">ช้า {behind.toFixed(0)}%</Status>}
                    {showMoney && over > 0.05 && <Status tone="neg">เกินงบ {(over * 100).toFixed(0)}%</Status>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHead title="คุณภาพงาน" action={<MoreLink href="/repairs" />} />
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 px-5 py-4 sm:grid-cols-4">
            <QStat label="ผ่านการตรวจ" value={pct(q.passRate)} note={`${q.inspected} ครั้ง`} />
            <QStat label="แจ้งซ่อมเปิดอยู่" value={String(q.open)} note={`เกิน SLA ${q.overSla}`} tone={q.overSla ? "neg" : undefined} />
            <QStat label="อยู่ใน SLA" value={pct(q.withinSla)} note="ของงานที่เปิดอยู่" />
            <QStat label="ปิดทันกำหนด" value={pct(q.closedOnTime)} note={`${q.closedN} งานที่ปิดแล้ว`} />
          </dl>
        </Card>
        <Card>
          <CardHead title="กำลังคน" meta={`${activeTeam.length} ผู้ใช้`} action={<MoreLink href="/hr" />} />
          <div className="grid gap-4 px-5 py-4 sm:grid-cols-[1fr_auto]">
            <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-[13px]">
              {byRole.slice(0, 8).map(([role, n]) => (
                <li key={role} className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-ink-2">{ROLE_LABEL[role as Role] ?? role}</span>
                  <span className="num font-mono">{n}</span>
                </li>
              ))}
            </ul>
            <dl className="grid grid-cols-[auto_auto] content-start gap-x-4 gap-y-1 text-[13px] sm:border-l sm:border-line sm:pl-5">
              <dt className="text-ink-3">ช่างรายวันงวดล่าสุด</dt>
              <dd className="num text-right font-mono">{lastPeriod ? dailyWorkers : "–"}</dd>
              {showMoney && (
                <>
                  <dt className="text-ink-3">ค่าแรงงวด {lastPeriod ?? "–"}</dt>
                  <dd className="num text-right font-mono">{lastPeriod ? mb(lastCost, 2) : "–"}</dd>
                  <dt className="text-ink-3">ค่าแรงสะสมปีนี้</dt>
                  <dd className="num text-right font-mono">{ytdLabour ? mb(ytdLabour, 2) : "–"}</dd>
                </>
              )}
            </dl>
          </div>
        </Card>
      </div>
    </Page>
  );
}

function QStat({ label, value, note, tone }: { label: string; value: string; note: string; tone?: "neg" }) {
  return (
    <div>
      <dt className="text-[13px] text-ink-2">{label}</dt>
      <dd className={cx("num mt-1 text-[22px] font-medium leading-none", tone === "neg" && "text-neg")}>{value}</dd>
      <dd className="mt-1 text-[12px] text-ink-3">{note}</dd>
    </div>
  );
}

function AgingCard({ title, data, href, empty }: { title: string; data: { buckets: AgingBucket[]; total: number; overdue: number }; href: string; empty: string }) {
  const max = Math.max(...data.buckets.map((b) => b.amount), 1);
  return (
    <Card>
      <CardHead title={title} meta={mb(data.total)} action={<MoreLink href={href} />} />
      {data.total === 0 ? (
        <p className="px-5 py-5 text-[14px] text-ink-3">{empty}</p>
      ) : (
        <div className="px-5 py-4">
          <ul className="flex flex-col gap-2.5">
            {data.buckets.map((b, i) => (
              <li key={b.label} className="grid grid-cols-[92px_1fr_auto] items-center gap-3 text-[13px]">
                <span className="text-ink-2">{b.label}</span>
                <div className="h-1.5 rounded-full bg-raised">
                  <div className={cx("h-full rounded-full", i === 0 ? "bg-ink-3/50" : i >= 3 ? "bg-neg/70" : "bg-ink-2/70")} style={{ width: `${(b.amount / max) * 100}%` }} />
                </div>
                <span className="num w-[68px] text-right font-mono">{b.amount ? mb(b.amount, 2) : "–"}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12px] text-ink-3">เลยกำหนดแล้ว {mb(data.overdue, 2)}</p>
        </div>
      )}
    </Card>
  );
}
