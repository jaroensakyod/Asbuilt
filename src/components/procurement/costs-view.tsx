"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Card, cx, inputCls, PlanBar } from "@/components/ui";
import { Empty, FilterField, I, Pill, Select, StatCard } from "@/components/ops/bits";
import { budgets, costEntries, payrollRuns } from "@/lib/biz";
import { STATUS_LABEL } from "@/lib/data";
import { goodsReceipts, isActiveProject, projectCost, purchaseOrders, supplierBills, type CostCtx } from "@/lib/procurement";
import { Amt, fmtM, td, th, useProcPerms, useProjects } from "./bits";

export function useCostCtx(): CostCtx {
  const b = budgets.use();
  const costs = costEntries.use();
  const pos = purchaseOrders.use();
  const receipts = goodsReceipts.use();
  const bills = supplierBills.use();
  const payroll = payrollRuns.use();
  return useMemo(() => ({ budgets: b, costs, pos, receipts, bills, payroll }), [b, costs, pos, receipts, bills, payroll]);
}

/** % used bar with a tick at the project progress */
export function UseBar({ used, progress }: { used: number; progress: number }) {
  return (
    <div className="relative h-1.5 w-full rounded-full bg-raised">
      <div className={cx("absolute inset-y-0 left-0 rounded-full", used > 100 ? "bg-neg" : used > progress + 10 ? "bg-warn" : "bg-ink")} style={{ width: `${Math.min(100, used)}%` }} />
      <div className="absolute -top-1 h-3.5 w-px bg-accent" style={{ left: `${Math.min(100, progress)}%` }} />
    </div>
  );
}

export function CostsView() {
  const { money } = useProcPerms();
  const ctx = useCostCtx();
  const projects = useProjects();
  const [scope, setScope] = useState("active");
  const [q, setQ] = useState("");

  const list = useMemo(
    () =>
      projects
        .filter((p) => (scope === "active" ? isActiveProject(p) : scope === "all" ? true : p.status === scope))
        .filter((p) => !q.trim() || `${p.id} ${p.name} ${p.pm} ${p.province}`.toLowerCase().includes(q.trim().toLowerCase()))
        .map((p) => projectCost(p, ctx))
        .sort((a, b) => b.risk - a.risk),
    [projects, ctx, scope, q],
  );
  const active = useMemo(() => projects.filter(isActiveProject).map((p) => projectCost(p, ctx)), [projects, ctx]);
  const sum = (k: "budget" | "actual" | "committed" | "forecast" | "contract") => active.reduce((t, x) => t + x[k], 0);
  const margin = sum("contract") - sum("forecast");
  const overrun = active.filter((x) => x.forecast > x.budget * 1.005).length;
  const hidden = !money;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
        <div>
          <p className="mb-1 text-[13px] text-ink-3">มูลค่าสัญญา/ต้นทุน</p>
          <h1 className="text-[30px] font-normal leading-[1.15]">ต้นทุนโครงการ</h1>
          <p className="mt-2 max-w-[48rem] text-ink-2">งบประมาณเทียบภาระผูกพันและต้นทุนจริงตามรหัสต้นทุน คาดการณ์ต้นทุนเมื่อแล้วเสร็จจากความคืบหน้า เรียงตามความเสี่ยง</p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="งบประมาณโครงการที่ดำเนินการ" value={hidden ? "•••" : fmtM(sum("budget"))} unit="ล้านบาท" note={`${active.length} โครงการ · มูลค่าสัญญา ${hidden ? "•••" : fmtM(sum("contract"))} ล้าน`} />
        <StatCard label="ต้นทุนจริงถึงวันนี้" value={hidden ? "•••" : fmtM(sum("actual"))} unit="ล้านบาท" note={`ผูกพันรอรับของ/รออนุมัติ ${hidden ? "•••" : fmtM(sum("committed"))} ล้าน`} />
        <StatCard label="คาดการณ์เกินงบ" value={overrun} unit="โครงการ" tone={overrun ? "neg" : undefined} note={`คาดการณ์รวมเมื่อแล้วเสร็จ ${hidden ? "•••" : fmtM(sum("forecast"))} ล้าน`} />
        <StatCard label="กำไรขั้นต้นคาดการณ์" value={hidden ? "•••" : fmtM(margin)} unit="ล้านบาท" note={sum("contract") > 0 ? `${((margin / sum("contract")) * 100).toFixed(1)}% ของมูลค่าสัญญา` : ""} />
      </div>

      <Card className="mb-4">
        <div className="grid grid-cols-2 gap-3 px-4 py-3 lg:grid-cols-6">
          <FilterField label="ค้นหา" className="col-span-2">
            <div className="relative">
              <Search {...I} className="pointer-events-none absolute left-2.5 top-2.5 text-ink-3" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="รหัส ชื่อโครงการ ผู้จัดการโครงการ" className={cx(inputCls, "w-full pl-8")} />
            </div>
          </FilterField>
          <FilterField label="สถานะโครงการ">
            <Select label="สถานะโครงการ" value={scope} onChange={setScope}>
              <option value="active">กำลังก่อสร้าง/ตรวจรับ</option>
              <option value="planning">{STATUS_LABEL.planning}</option>
              <option value="delivered">{STATUS_LABEL.delivered}</option>
              <option value="all">ทั้งหมด</option>
            </Select>
          </FilterField>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-left">
            <thead>
              <tr>
                <th className={cx(th, "px-5")}>#</th>
                <th className={th}>โครงการ</th>
                <th className={cx(th, "w-[140px]")}>ความคืบหน้า</th>
                <th className={cx(th, "text-right")}>งบประมาณ</th>
                <th className={cx(th, "text-right")}>ผูกพัน</th>
                <th className={cx(th, "text-right")}>ต้นทุนจริง</th>
                <th className={cx(th, "w-[140px]")}>ใช้งบ vs งาน</th>
                <th className={cx(th, "text-right")}>คาดการณ์เมื่อเสร็จ</th>
                <th className={cx(th, "text-right")}>กำไรขั้นต้น</th>
                <th className={cx(th, "pr-5")}>การแจ้งเตือน</th>
              </tr>
            </thead>
            <tbody>
              {list.map((x, i) => {
                const p = x.project;
                const neg = x.alerts.filter((a) => a.tone === "neg").length;
                const warn = x.alerts.length - neg;
                return (
                  <tr key={p.id} className="border-t border-line transition-colors duration-150 hover:bg-raised/60">
                    <td className={cx(td, "num px-5 font-mono text-[12px] text-ink-3")}>{i + 1}</td>
                    <td className={td}>
                      <Link href={`/costs/${p.id}`} className="block max-w-[240px] truncate hover:underline">
                        {p.name}
                      </Link>
                      <span className="block text-[12px] text-ink-3">
                        <span className="font-mono">{p.id}</span> · {p.pm}
                      </span>
                    </td>
                    <td className={td}>
                      <PlanBar actual={p.actual} plan={p.plan} />
                      <span className="mt-1 block font-mono text-[12px] text-ink-3">
                        {p.actual}% · แผน {p.plan}%
                      </span>
                    </td>
                    <td className={cx(td, "text-right text-[13px]")}>
                      <Amt n={x.budget} show={money} />
                      {x.budgetSource === "fallback" && <span className="block text-[11px] text-ink-3">งบเบื้องต้น</span>}
                    </td>
                    <td className={cx(td, "text-right text-[13px]")}>
                      <Amt n={x.committed} show={money} />
                    </td>
                    <td className={cx(td, "text-right text-[13px]")}>
                      <Amt n={x.actual} show={money} />
                    </td>
                    <td className={td}>
                      <UseBar used={x.usedPct} progress={p.actual} />
                      <span className="mt-1 block font-mono text-[12px] text-ink-3">{x.usedPct.toFixed(0)}%</span>
                    </td>
                    <td className={cx(td, "text-right text-[13px]")}>
                      <Amt n={x.forecast} show={money} className={x.forecast > x.budget * 1.005 ? "text-neg" : undefined} />
                      {money && x.budget > 0 && <span className={cx("block font-mono text-[11px]", x.variance < 0 ? "text-neg" : "text-ink-3")}>{x.variance < 0 ? `เกิน ${(-x.variance / 1e6).toFixed(2)} ล้าน` : `ต่ำกว่างบ ${(x.variance / 1e6).toFixed(2)} ล้าน`}</span>}
                    </td>
                    <td className={cx(td, "text-right text-[13px]")}>
                      {money ? <span className={cx("num font-mono", x.marginPct < 8 && "text-neg")}>{x.marginPct.toFixed(1)}%</span> : "•••"}
                      {money && <span className="block font-mono text-[11px] text-ink-3">{fmtM(x.margin)} ล้าน</span>}
                    </td>
                    <td className={cx(td, "pr-5")}>
                      <div className="flex flex-wrap gap-1">
                        {neg > 0 && <Pill tone="neg">เกินงบ {neg}</Pill>}
                        {warn > 0 && <Pill tone="warn">เฝ้าระวัง {warn}</Pill>}
                        {!x.alerts.length && <Pill tone="pos">ปกติ</Pill>}
                      </div>
                      {x.alerts[0] && <span className="mt-1 block max-w-[220px] truncate text-[12px] text-ink-3">{x.alerts[0].text}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {list.length === 0 && <Empty>ไม่พบโครงการ</Empty>}
      </Card>
    </>
  );
}
