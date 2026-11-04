"use client";

// Client page: in live mode it renders the signed-in company's data.
import Link from "next/link";
import { ArrowRight, Box, MapPin, Plus, TriangleAlert, UserRound } from "lucide-react";
import { Page } from "@/components/shell/topbar";
import { Button, Card, CardHead, PlanBar, Status, cx } from "@/components/ui";
import { HouseThumb } from "@/components/house-thumb";
import { PrintButton, PrintStyles } from "@/components/dashboard/print";
import { Kpi, Meter, MoreLink } from "@/components/dashboard/kpi";
import { ContractChart, ChartLegend, type ChartPoint } from "@/components/dashboard/contract-chart";
import { ProjectMap, type MapPoint } from "@/components/dashboard/project-map";
import { PhaseBar, PhaseLegend } from "@/components/dashboard/phase-bar";
import {
  baht,
  behindBy,
  byUrgency,
  isActive,
  openRepairsOf,
  phaseSegments,
  relDays,
  STATUS_HEX,
  STATUS_TEXT,
  STATUS_TONE,
  statusCounts,
  thLongDate,
  TH_MONTH_SHORT,
} from "@/components/dashboard/metrics";
import {
  COMPANY_INFO,
  daysBetween,
  getProject,
  inspections,
  maintenance,
  monthlySeries,
  projects,
  repairs,
  SEVERITY_LABEL,
  slaText,
  thDate,
  TODAY,
} from "@/lib/data";

// Customer satisfaction comes from post-handover surveys, which are not in the demo data set
const SURVEY = { score: 4.54, n: 26, prev: 4.47 };

function chartData(): ChartPoint[] {
  const long = monthlySeries(35);
  return long.slice(11).map((m, i) => {
    const win = long.slice(i, i + 12);
    return { ...m, ma: win.reduce((s, x) => s + x.contract, 0) / win.length };
  });
}

export default function Dashboard() {
  const year = Number(TODAY.slice(0, 4));
  const active = projects.filter(isActive);
  const planning = projects.filter((p) => p.status === "planning");
  const delivered = projects.filter((p) => p.status === "delivered");
  const inWarranty = delivered.filter((p) => p.warrantyUntil && p.warrantyUntil >= TODAY);
  const activeValue = active.reduce((s, p) => s + p.value, 0);

  const valueOf = (y: number) => projects.filter((p) => p.contractDate?.startsWith(String(y))).reduce((s, p) => s + p.value, 0);
  const countOf = (y: number) => projects.filter((p) => p.contractDate?.startsWith(String(y))).length;
  const vNow = valueOf(year);
  const vPrev = valueOf(year - 1);
  const vChange = vPrev ? ((vNow - vPrev) / vPrev) * 100 : 0;

  const avgActual = active.reduce((s, p) => s + p.actual, 0) / (active.length || 1);
  const avgPlan = active.reduce((s, p) => s + p.plan, 0) / (active.length || 1);
  const behind = active.filter((p) => p.plan - p.actual >= 3);

  const deliveredThisYear = delivered.filter((p) => p.handedOver?.startsWith(String(year))).length;
  const deliveredPrevYear = delivered.filter((p) => p.handedOver?.startsWith(String(year - 1))).length;
  const nextHandover = [...active].filter((p) => p.finish >= TODAY).sort((a, b) => a.finish.localeCompare(b.finish))[0];

  const open = repairs.filter((r) => r.status !== "closed");
  const urgent = open.filter((r) => r.severity === "high");
  const overSla = open.filter((r) => r.slaHours < 0);
  const avgAge = open.reduce((s, r) => s + daysBetween(r.reported, TODAY), 0) / (open.length || 1);
  const withinSla = open.length ? ((open.length - overSla.length) / open.length) * 100 : 100;

  const done30 = inspections.filter((i) => i.result !== "scheduled" && daysBetween(i.date, TODAY) >= 0 && daysBetween(i.date, TODAY) <= 30);
  const passRate = done30.length ? (done30.filter((i) => i.result === "pass").length / done30.length) * 100 : 0;
  const avgScore = done30.reduce((s, i) => s + (i.score ?? 0), 0) / (done30.length || 1);
  const upcoming = inspections.filter((i) => i.result === "scheduled" && i.date >= TODAY).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  const backlogList = projects.filter((p) => p.status !== "delivered");
  const backlog = backlogList.reduce((s, p) => s + p.value * (1 - p.actual / 100), 0);

  const series = chartData();
  const s24 = {
    value: series.reduce((s, m) => s + m.contract, 0),
    contracts: series.reduce((s, m) => s + m.contracts, 0),
    handovers: series.reduce((s, m) => s + m.handovers, 0),
  };

  const counts = statusCounts();
  const listed = [...active].sort((a, b) => b.actual - a.actual);
  const urgentList = [...open].sort(byUrgency).slice(0, 6);
  const expiring = projects
    .filter((p) => p.warrantyUntil && daysBetween(TODAY, p.warrantyUntil) >= 0 && daysBetween(TODAY, p.warrantyUntil) <= 180)
    .sort((a, b) => a.warrantyUntil!.localeCompare(b.warrantyUntil!));
  const overdue = maintenance.filter((m) => m.state === "overdue").sort((a, b) => a.date.localeCompare(b.date));
  const soon = maintenance.filter((m) => m.state === "soon").length;

  const points: MapPoint[] = projects
    .filter((p) => p.lat != null && p.lng != null)
    .map((p) => ({
      id: p.id,
      name: p.name,
      model: p.model,
      province: p.province,
      lat: p.lat!,
      lng: p.lng!,
      color: STATUS_HEX[p.status],
      statusLabel: STATUS_TEXT[p.status],
      active: isActive(p),
      actual: p.actual,
    }));
  const provinces = new Set(projects.map((p) => p.province)).size;

  return (
    <Page trail={[{ label: "ภาพรวม" }]}>
      <PrintStyles />
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
        <div>
          <p className="text-[13px] text-ink-3">{thLongDate(TODAY)}</p>
          <h1 className="mt-1 text-[30px] font-normal leading-[1.15]">ภาพรวมบริษัท</h1>
          <p className="mt-2 text-[13px] text-ink-2">
            {COMPANY_INFO.name} · ดำเนินงานมา {year + 543 - COMPANY_INFO.since} ปี · กำลังก่อสร้าง {active.length} โครงการ · อยู่ในระยะรับประกัน {inWarranty.length} หลัง
          </p>
        </div>
        <div className="flex items-center gap-2" data-noprint>
          <PrintButton />
          <Button href="/repairs?new=">
            <TriangleAlert size={16} strokeWidth={1.5} />
            แจ้งซ่อม
          </Button>
          <Button primary href="/projects?new=1">
            <Plus size={16} strokeWidth={1.5} />
            สร้างโครงการ
          </Button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="โครงการที่กำลังก่อสร้าง"
          value={active.length}
          unit="โครงการ"
          href="/projects?status=building"
          note={
            <>
              มูลค่ารวม <span className="num font-mono text-ink-2">{baht(activeValue)}</span> · วางแผน {planning.length} โครงการ
            </>
          }
        />
        <Kpi
          label={`มูลค่าสัญญาปี ${year + 543}`}
          value={`฿${vNow.toFixed(1)}`}
          unit="ล้านบาท"
          change={{ text: `${vChange > 0 ? "+" : ""}${vChange.toFixed(0)}%`, tone: vChange >= 0 ? "pos" : "neg", dir: vChange >= 0 ? "up" : "down" }}
          note={
            <>
              {countOf(year)} สัญญา · ปี {year + 542} <span className="num font-mono">฿{vPrev.toFixed(1)} ล้าน</span> ({countOf(year - 1)} สัญญา)
            </>
          }
        />
        <Kpi
          label="ความคืบหน้าเฉลี่ย vs แผน"
          value={`${avgActual.toFixed(0)}%`}
          unit={`แผน ${avgPlan.toFixed(0)}%`}
          change={{ text: `${(avgActual - avgPlan).toFixed(1)}%`, tone: avgActual >= avgPlan ? "pos" : "neg" }}
          note={`ช้ากว่าแผนเกิน 3% · ${behind.length} โครงการ`}
        >
          <PlanBar actual={avgActual} plan={avgPlan} />
        </Kpi>
        <Kpi
          label="บ้านที่ส่งมอบแล้ว"
          value={delivered.length}
          unit="หลัง"
          change={{ text: `ปีนี้ ${deliveredThisYear}`, tone: "neutral" }}
          note={
            <>
              ปี {year + 542} ส่งมอบ {deliveredPrevYear} หลัง{nextHandover ? ` · ถัดไป ${thDate(nextHandover.finish)} (${nextHandover.id})` : ""}
            </>
          }
        />
        <Kpi
          label="แจ้งซ่อมที่เปิดอยู่"
          value={open.length}
          unit="เรื่อง"
          href="/repairs"
          change={overSla.length ? { text: `เกิน SLA ${overSla.length}`, tone: "neg" } : undefined}
          note={`ด่วน ${urgent.length} · อายุเฉลี่ย ${avgAge.toFixed(1)} วัน`}
        >
          <Meter label="อยู่ในกำหนด SLA" value={withinSla} tone={withinSla < 80 ? "warn" : "ink"} />
        </Kpi>
        <Kpi
          label="การตรวจ 30 วันล่าสุด"
          value={done30.length}
          unit="ครั้ง"
          href="/inspections"
          note={
            <>
              อัตราผ่าน <span className="num font-mono text-ink-2">{passRate.toFixed(0)}%</span> · คะแนนเฉลี่ย{" "}
              <span className="num font-mono text-ink-2">{avgScore.toFixed(0)}</span> · นัดไว้ {upcoming.length}
            </>
          }
        />
        <Kpi
          label="ความพึงพอใจลูกค้า"
          value={SURVEY.score.toFixed(2)}
          unit="/ 5"
          change={{ text: `+${(SURVEY.score - SURVEY.prev).toFixed(2)}`, tone: "pos", dir: "up" }}
          note={`จาก ${SURVEY.n} แบบสอบถามหลังส่งมอบ · ปีก่อน ${SURVEY.prev.toFixed(2)}`}
        >
          <Meter label="คะแนนเต็ม 5" value={(SURVEY.score / 5) * 100} />
        </Kpi>
        <Kpi
          label="มูลค่างานในมือ (Backlog)"
          value={`฿${backlog.toFixed(1)}`}
          unit="ล้านบาท"
          note={`งานที่ยังไม่ส่งมอบ ${backlogList.length} โครงการ คิดจากส่วนที่เหลือตามความคืบหน้า`}
        />
      </div>

      {/* main chart + status */}
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHead title="มูลค่าสัญญา & การส่งมอบบ้าน" meta="24 เดือนล่าสุด · ล้านบาท" />
          <dl className="grid grid-cols-2 gap-4 px-5 pt-4 sm:grid-cols-4">
            {[
              ["มูลค่าสัญญา 24 เดือน", baht(s24.value)],
              ["จำนวนสัญญา", `${s24.contracts} โครงการ`],
              ["เฉลี่ยต่อสัญญา", baht(s24.contracts ? s24.value / s24.contracts : 0, 2)],
              ["ส่งมอบ 24 เดือน", `${s24.handovers} หลัง`],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-[12px] text-ink-3">{k}</dt>
                <dd className="num mt-0.5 font-mono text-[18px] font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4">
            <p className="text-[12px] text-ink-3">นับตามเดือนที่เซ็นสัญญา · เลื่อนเมาส์บนกราฟเพื่อดูรายละเอียด</p>
            <ChartLegend />
          </div>
          <div className="px-3 pb-3 pt-1">
            <ContractChart data={series} />
          </div>
        </Card>

        <Card>
          <CardHead title="สถานะโครงการ" meta={`${projects.length} โครงการ`} action={<MoreLink href="/projects" />} />
          <div className="px-5 py-4">
            <div className="flex h-3 overflow-hidden rounded-full bg-raised" role="img" aria-label="สัดส่วนสถานะโครงการ">
              {counts
                .filter((c) => c.n > 0)
                .map((c) => (
                  <div key={c.status} style={{ width: `${c.pct}%`, background: STATUS_HEX[c.status] }} className="border-r-2 border-card last:border-r-0" />
                ))}
            </div>
            <ul className="mt-4 divide-y divide-line">
              {counts.map((c) => (
                <li key={c.status}>
                  <Link
                    href={c.status === "paused" ? "/projects" : `/projects?status=${c.status}`}
                    className="grid grid-cols-[1fr_auto_44px] items-center gap-3 py-2.5 transition-colors duration-150 hover:text-ink"
                  >
                    <span className="flex items-center gap-2 text-[14px]">
                      <span className="inline-block size-2 rounded-full" style={{ background: STATUS_HEX[c.status] }} />
                      {c.label}
                    </span>
                    <span className="num font-mono text-[15px] font-medium">{c.n}</span>
                    <span className="num text-right font-mono text-[12px] text-ink-3">{c.pct.toFixed(0)}%</span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[12px] leading-[18px] text-ink-3">
              ส่งมอบเฉลี่ย {(delivered.length / Math.max(1, year + 543 - COMPANY_INFO.since)).toFixed(1)} หลังต่อปี · อยู่ในประกัน {inWarranty.length} จาก {delivered.length} หลัง
            </p>
          </div>
        </Card>
      </div>

      {/* active projects */}
      <Card className="mt-4">
        <CardHead
          title="โครงการที่กำลังก่อสร้าง"
          meta={`${active.length} โครงการ · ความคืบหน้าจริงเทียบแผน ณ ${thDate(TODAY)}`}
          action={
            <div className="flex items-center gap-5">
              <span className="hidden lg:block">
                <PhaseLegend />
              </span>
              <MoreLink href="/projects">ดูทั้งหมด</MoreLink>
            </div>
          }
        />
        <ul className="divide-y divide-line">
          {listed.map((p) => {
            const issues = openRepairsOf(p.id).length;
            const left = daysBetween(TODAY, p.finish);
            const delta = behindBy(p);
            const segs = phaseSegments(p);
            const late = p.plan - p.actual >= 3;
            return (
              <li key={p.id} className="grid grid-cols-[112px_minmax(0,1.5fr)_minmax(0,1.3fr)_minmax(0,1fr)_auto] items-center gap-5 px-5 py-3.5 max-lg:grid-cols-[96px_minmax(0,1fr)] max-lg:gap-y-3">
                <Link href={`/projects/${p.id}`} className="relative block overflow-hidden rounded-[8px] border border-line">
                  <HouseThumb code={p.modelCode} className="block h-[68px] w-full" />
                  <span className="absolute bottom-1 left-1 rounded-[4px] bg-ink/80 px-1 font-mono text-[10px] leading-4 text-card">{p.modelCode}</span>
                </Link>
                <div className="min-w-0">
                  <p className="flex items-center gap-2">
                    <span className="font-mono text-[12px] text-ink-3">{p.id}</span>
                    <Status tone={STATUS_TONE[p.status]}>{STATUS_TEXT[p.status]}</Status>
                  </p>
                  <Link href={`/projects/${p.id}`} className="mt-0.5 block truncate text-[15px] font-medium hover:underline hover:underline-offset-2">
                    {p.name} <span className="font-normal text-ink-2">– {p.model}</span>
                  </Link>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[12px] text-ink-3">
                    <span className="flex items-center gap-1">
                      <MapPin size={12} strokeWidth={1.5} />
                      {p.province}
                    </span>
                    <span className="flex items-center gap-1">
                      <UserRound size={12} strokeWidth={1.5} />
                      PM {p.pm}
                    </span>
                    {issues > 0 && (
                      <Link href={`/repairs?q=${p.id}`} className="flex items-center gap-1 text-neg hover:underline">
                        <TriangleAlert size={12} strokeWidth={1.5} />
                        {issues} ปัญหาเปิด
                      </Link>
                    )}
                  </p>
                </div>
                <div className="min-w-0 max-lg:col-span-2">
                  <p className="flex items-center gap-2 text-[13px]">
                    {p.phase}
                    {late && <span className="rounded-[6px] bg-neg-soft px-1.5 text-[11px] leading-5 text-neg">ช้ากว่าแผน</span>}
                  </p>
                  <PhaseBar segs={segs} className="mt-1.5" />
                  <p className="mt-1.5 text-[12px] text-ink-3">
                    กำหนดเสร็จ {thDate(p.finish)} · <span className={cx("num font-mono", left < 0 ? "text-neg" : left <= 14 ? "text-warn" : "")}>{left < 0 ? `เลย ${-left} วัน` : `อีก ${left} วัน`}</span>
                  </p>
                </div>
                <div className="max-lg:col-span-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="flex items-baseline gap-1.5">
                      <span className="num text-[20px] font-medium leading-none">{p.actual}%</span>
                      <span className="text-[12px] text-ink-3">แผน {p.plan}%</span>
                    </p>
                    <span className={cx("num font-mono text-[12px]", delta >= 0 ? "text-pos" : delta <= -3 ? "text-neg" : "text-ink-2")}>
                      {delta > 0 ? "+" : ""}
                      {delta.toFixed(1)}%
                    </span>
                  </div>
                  <div className="mt-2">
                    <PlanBar actual={p.actual} plan={p.plan} />
                  </div>
                </div>
                <div className="flex items-center gap-2 max-lg:col-span-2" data-noprint>
                  <Link
                    href={`/structure/${p.id}?mode=compare`}
                    className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-line-strong bg-card px-3 text-[13px] text-ink transition-colors duration-150 hover:bg-raised"
                  >
                    <Box size={16} strokeWidth={1.5} />
                    3D Compare
                  </Link>
                  <Link
                    href={`/projects/${p.id}`}
                    aria-label={`เปิด ${p.name}`}
                    className="inline-flex size-8 items-center justify-center rounded-[8px] border border-line-strong bg-card text-ink transition-colors duration-150 hover:bg-raised"
                  >
                    <ArrowRight size={16} strokeWidth={1.5} />
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      {/* map + inspections */}
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Card className="flex min-h-[480px] flex-col">
          <CardHead title="แผนที่โครงการ" meta={`${projects.length} โครงการใน ${provinces} จังหวัด`} />
          <div className="flex-1">
            <ProjectMap
              points={points}
              legend={counts.filter((c) => c.status !== "paused").map((c) => ({ label: c.label, color: STATUS_HEX[c.status], n: c.n }))}
            />
          </div>
        </Card>

        <Card>
          <CardHead title="นัดตรวจงานที่จะถึง" meta={`${upcoming.length} รายการ`} action={<MoreLink href="/inspections" />} />
          {upcoming.length === 0 ? (
            <p className="px-5 py-8 text-center text-[13px] text-ink-3">ไม่มีนัดตรวจที่จะถึง</p>
          ) : (
            <ul className="divide-y divide-line">
              {upcoming.slice(0, 7).map((i) => {
                const [, m, d] = i.date.split("-").map(Number);
                const today = i.date === TODAY;
                const pj = getProject(i.projectId);
                return (
                  <li key={i.id}>
                    <Link href={`/inspections/${i.id}`} className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 px-5 py-3 transition-colors duration-150 hover:bg-raised/60">
                      <span className={cx("flex h-11 flex-col items-center justify-center rounded-[8px] border leading-none", today ? "border-accent/40 bg-accent-soft" : "border-line-strong bg-card")}>
                        <span className={cx("text-[10px]", today ? "text-accent-text" : "text-ink-3")}>{TH_MONTH_SHORT[m - 1]}</span>
                        <span className="num mt-1 font-mono text-[16px] font-medium">{d}</span>
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[14px]">{i.title}</span>
                        <span className="block truncate text-[12px] text-ink-3">
                          <span className="font-mono">{i.projectId}</span> · {pj?.name ?? ""} · {i.inspector}
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="num block font-mono text-[13px]">{i.time} น.</span>
                        <span className={cx("block text-[12px]", today ? "text-accent-text" : "text-ink-3")}>{relDays(i.date)}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* after-sales */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHead title="แจ้งซ่อมเร่งด่วน" meta={`${urgentList.length} จาก ${open.length}`} action={<MoreLink href="/repairs" />} />
          <ul className="divide-y divide-line">
            {urgentList.map((r) => {
              const pj = getProject(r.projectId);
              return (
                <li key={r.id}>
                  <Link href={`/repairs?q=${r.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-5 py-3 transition-colors duration-150 hover:bg-raised/60">
                    <span className="min-w-0">
                      <span className="block truncate text-[14px]">
                        {r.title} <span className="text-ink-3">— {r.assetName}</span>
                      </span>
                      <span className="block truncate text-[12px] text-ink-3">
                        <span className="font-mono">{r.id}</span> · {pj ? `${pj.name} – ${pj.model}` : r.projectId}
                      </span>
                    </span>
                    <span className="flex flex-col items-end gap-0.5">
                      <Status tone={r.severity === "high" ? "neg" : r.severity === "medium" ? "warn" : "neutral"}>{SEVERITY_LABEL[r.severity]}</Status>
                      <span className={cx("num font-mono text-[12px]", r.slaHours < 0 ? "text-neg" : "text-ink-3")}>{slaText(r.slaHours)}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <CardHead title="ประกันใกล้หมดอายุ" meta="ภายใน 180 วัน" action={<MoreLink href="/projects?status=delivered" />} />
          {expiring.length === 0 ? (
            <p className="px-5 py-8 text-center text-[13px] text-ink-3">ไม่มีบ้านที่ประกันจะหมดใน 180 วัน</p>
          ) : (
            <ul className="divide-y divide-line">
              {expiring.map((p) => {
                const left = daysBetween(TODAY, p.warrantyUntil!);
                const n = openRepairsOf(p.id).length;
                return (
                  <li key={p.id}>
                    <Link href={`/projects/${p.id}`} className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 px-5 py-3 transition-colors duration-150 hover:bg-raised/60">
                      <DaysRing days={left} />
                      <span className="min-w-0">
                        <span className="block truncate text-[14px]">
                          {p.name} <span className="text-ink-3">– {p.model}</span>
                        </span>
                        <span className="block truncate text-[12px] text-ink-3">
                          หมดประกัน {thDate(p.warrantyUntil!)} · ส่งมอบ {thDate(p.handedOver ?? p.finish)}
                        </span>
                      </span>
                      <span className="flex flex-col items-end gap-0.5 text-[12px]">
                        <span className={cx("num font-mono", left <= 30 ? "text-neg" : "text-ink-2")}>อีก {left} วัน</span>
                        <span className={n ? "text-warn" : "text-ink-3"}>{n ? `${n} งานซ่อม` : "ไม่มีงานซ่อม"}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardHead title="บำรุงรักษาเลยกำหนด" meta={`${overdue.length} รายการ`} action={<MoreLink href="/maintenance" />} />
          {overdue.length === 0 ? (
            <p className="px-5 py-8 text-center text-[13px] text-ink-3">ไม่มีงานเลยกำหนด</p>
          ) : (
            <ul className="divide-y divide-line">
              {overdue.map((m) => {
                const late = daysBetween(m.date, TODAY);
                return (
                  <li key={m.id}>
                    <Link href="/maintenance" className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-3 transition-colors duration-150 hover:bg-raised/60">
                      <span className="min-w-0">
                        <span className="block truncate text-[14px]">
                          {m.task} <span className="text-ink-3">({m.cycle})</span>
                        </span>
                        <span className="block truncate text-[12px] text-ink-3">
                          <span className="font-mono">{m.projectId}</span> · {m.owner} · กำหนด {thDate(m.date)}
                        </span>
                      </span>
                      <span className="num font-mono text-[12px] text-neg">เลย {late} วัน</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="border-t border-line px-5 py-2.5 text-[12px] text-ink-3">ใกล้ถึงกำหนด {soon} รายการ · ดูตารางทั้งหมดในหน้าบำรุงรักษา</p>
        </Card>
      </div>
    </Page>
  );
}

function DaysRing({ days, total = 180 }: { days: number; total?: number }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, days / total));
  return (
    <svg viewBox="0 0 44 44" className="size-11" role="img" aria-label={`เหลือ ${days} วัน`}>
      <circle cx="22" cy="22" r={r} fill="none" stroke="var(--raised)" strokeWidth="3" />
      <circle
        cx="22"
        cy="22"
        r={r}
        fill="none"
        stroke={days <= 30 ? "var(--neg)" : "var(--text-2)"}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={`${c * f} ${c}`}
        transform="rotate(-90 22 22)"
      />
      <text x="22" y="26" textAnchor="middle" className="fill-ink font-mono text-[11px]">
        {days}
      </text>
    </svg>
  );
}
