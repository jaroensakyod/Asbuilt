"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { Button, cx, PlanBar } from "@/components/ui";
import { Empty, I, Pill, StatCard, useHydrated } from "@/components/ops/bits";
import { COST_CODES, type CostEntry } from "@/lib/biz";
import { STATUS_LABEL, thDate } from "@/lib/data";
import { BUDGET_RATIO, isOpenPO, poTotals, projectCost, receivedValue, sCurve, suppliers } from "@/lib/procurement";
import { Amt, DocLink, fmtM, POStatusPill, Section, td, th, useProcPerms, useProjects } from "./bits";
import { UseBar, useCostCtx } from "./costs-view";
import { SCurve } from "./s-curve";

const SOURCE_LABEL: Record<CostEntry["source"], string> = { po: "วัสดุ", bill: "ใบแจ้งหนี้", labour: "ค่าแรง", petty: "เงินสดย่อย/ค่าดำเนินการ", subcontract: "ผู้รับเหมาช่วง", plant: "เครื่องจักร", piecerate: "ค่าแรงเหมา" };

export function CostDetail({ projectId }: { projectId: string }) {
  const hydrated = useHydrated();
  const { money } = useProcPerms();
  const ctx = useCostCtx();
  const sups = suppliers.use();
  const p = useProjects().find((x) => x.id === projectId);
  const pc = useMemo(() => (p ? projectCost(p, ctx) : undefined), [p, ctx]);
  const curve = useMemo(() => (pc ? sCurve(pc) : []), [pc]);

  if (!p || !pc) {
    if (!hydrated) return <div className="h-[60vh]" />;
    return (
      <div className="py-20 text-center">
        <p className="text-ink-2">ไม่พบโครงการ {projectId}</p>
        <Link href="/costs" className="mt-3 inline-block text-accent-text hover:underline">
          กลับไปหน้าต้นทุนโครงการ
        </Link>
      </div>
    );
  }

  const openPOs = ctx.pos.filter((x) => x.projectId === p.id && (isOpenPO(x) || x.status === "pending")).sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate));
  const recent = [...pc.entries.map((e) => ({ ...e })), ...pc.labourLines.map((l) => ({ id: `LAB-${l.ref}`, projectId: p.id, costCode: "90" as const, date: l.date, source: "labour" as const, ref: l.ref, description: `ค่าแรงรายวันหน้างาน${l.days ? ` ${l.days} แรง` : ""}`, amount: l.amount }))].sort((a, b) => b.date.localeCompare(a.date));
  const bySource = new Map<string, number>();
  for (const e of recent) bySource.set(e.source, (bySource.get(e.source) ?? 0) + e.amount);
  const totalRow = { budget: pc.budget, committed: pc.committed, actual: pc.actual - pc.labour };
  const show = money;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 pb-5">
        <Link href="/costs" className="inline-flex items-center gap-1.5 text-[14px] text-ink-2 hover:text-ink">
          <ArrowLeft {...I} />
          ต้นทุนโครงการ
        </Link>
        <div className="flex items-center gap-2">
          <Button href={`/projects/${p.id}`}>ข้อมูลโครงการ</Button>
          <Link href={`/purchasing?new=1&project=${p.id}`} className="inline-flex h-9 items-center gap-2 rounded-[8px] bg-ink px-4 text-[14px] font-medium text-card transition-colors duration-150 hover:bg-[#3a332b]">
            <Plus {...I} />
            ใบขอซื้อสำหรับโครงการนี้
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
        <div>
          <p className="mb-1 font-mono text-[13px] text-ink-3">
            {p.id} · {p.model}
          </p>
          <h1 className="text-[30px] font-normal leading-[1.15]">{p.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
            <Pill>{STATUS_LABEL[p.status]}</Pill>
            <Pill tone={pc.budgetSource === "estimate" ? "pos" : "neutral"}>{pc.budgetSource === "estimate" ? "งบจากใบประเมินราคาที่อนุมัติ" : `งบเบื้องต้น ${Math.round(BUDGET_RATIO * 100)}% ของมูลค่าสัญญา`}</Pill>
            <span>
              {thDate(p.start)} – {thDate(p.finish)} · {p.pm}
            </span>
          </div>
        </div>
        <div className="w-[260px]">
          <PlanBar actual={p.actual} plan={p.plan} />
          <p className="mt-1.5 flex justify-between font-mono text-[12px] text-ink-3">
            <span>ทำได้ {p.actual}%</span>
            <span>แผน {p.plan}%</span>
          </p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-5">
        <StatCard label="งบประมาณ" value={show ? fmtM(pc.budget) : "•••"} unit="ล้าน" note={`มูลค่าสัญญา ${show ? fmtM(pc.contract) : "•••"} ล้าน`} />
        <StatCard label="ต้นทุนจริง" value={show ? fmtM(pc.actual) : "•••"} unit="ล้าน" note={`ค่าแรงรายวัน ${show ? fmtM(pc.labour) : "•••"} ล้าน`} />
        <StatCard label="ผูกพัน" value={show ? fmtM(pc.committed) : "•••"} unit="ล้าน" note={`ใช้งบแล้ว ${pc.usedPct.toFixed(0)}% · งาน ${p.actual}%`} />
        <StatCard label="คาดการณ์เมื่อแล้วเสร็จ" value={show ? fmtM(pc.forecast) : "•••"} unit="ล้าน" tone={pc.variance < 0 ? "neg" : undefined} note={show ? `${pc.variance < 0 ? `เกินงบ ${fmtM(-pc.variance)}` : `ต่ำกว่างบ ${fmtM(pc.variance)}`} ล้าน${pc.runRate ? ` · ต้นทุนจริง/ความคืบหน้า ${fmtM(pc.runRate)}` : ""}` : ""} />
        <StatCard label="กำไรขั้นต้นคาดการณ์" value={pc.marginPct.toFixed(1)} unit="%" tone={pc.marginPct < 8 ? "neg" : undefined} note={show ? `${fmtM(pc.margin)} ล้านบาท` : ""} />
      </div>

      {pc.alerts.length > 0 && (
        <Section title="การแจ้งเตือนต้นทุน" meta={pc.alerts.length} className="mb-4">
          <ul className="px-5 py-2">
            {pc.alerts.map((a, i) => (
              <li key={i} className="flex items-center gap-2 border-b border-line py-2 text-[14px] last:border-b-0">
                <Pill tone={a.tone}>{a.tone === "neg" ? "เกินงบ" : "เฝ้าระวัง"}</Pill>
                {a.text}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="S-curve ต้นทุนเทียบความคืบหน้า" meta="สะสมรายเดือน · ล้านบาท" className="mb-4">
        {show ? <SCurve points={curve} budget={pc.budget} /> : <Empty>บทบาทของคุณไม่มีสิทธิ์ดูข้อมูลต้นทุน</Empty>}
      </Section>

      <Section title="งบประมาณ ผูกพัน และต้นทุนจริง ตามรหัสต้นทุน" className="mb-4">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left">
            <thead>
              <tr>
                <th className={cx(th, "px-5")}>รหัสต้นทุน</th>
                <th className={cx(th, "text-right")}>งบประมาณ</th>
                <th className={cx(th, "text-right")}>ผูกพัน</th>
                <th className={cx(th, "text-right")}>ต้นทุนจริง</th>
                <th className={cx(th, "text-right")}>คงเหลือ</th>
                <th className={cx(th, "w-[180px]")}>ใช้งบ · งานที่ควรเสร็จ</th>
                <th className={cx(th, "pr-5")} />
              </tr>
            </thead>
            <tbody>
              {pc.rows.map((r) => (
                <tr key={r.code} className="border-t border-line">
                  <td className={cx(td, "px-5")}>
                    <span className="font-mono text-[12px] text-ink-3">{r.code}</span> <span className="text-[14px]">{COST_CODES[r.code]}</span>
                  </td>
                  <td className={cx(td, "text-right text-[13px]")}>
                    <Amt n={r.budget} show={show} />
                  </td>
                  <td className={cx(td, "text-right text-[13px]")}>
                    <Amt n={r.committed} show={show} />
                  </td>
                  <td className={cx(td, "text-right text-[13px]")}>
                    <Amt n={r.actual} show={show} />
                  </td>
                  <td className={cx(td, "text-right text-[13px]")}>
                    <Amt n={r.budget - r.actual - r.committed} show={show} zero="0.00" />
                  </td>
                  <td className={td}>
                    <UseBar used={r.usedPct} progress={r.expectedPct} />
                    <span className="mt-1 block font-mono text-[12px] text-ink-3">
                      {r.usedPct.toFixed(0)}% · {r.expectedPct.toFixed(0)}%
                    </span>
                  </td>
                  <td className={cx(td, "pr-5")}>{r.flag === "over" ? <Pill tone="neg">เกินงบ</Pill> : r.flag === "warn" ? <Pill tone="warn">เฝ้าระวัง</Pill> : null}</td>
                </tr>
              ))}
              <tr className="border-t border-line">
                <td className={cx(td, "px-5 text-[14px]")}>
                  ค่าแรงรายวันหน้างาน <span className="text-[12px] text-ink-3">จากระบบเงินเดือน</span>
                </td>
                <td className={cx(td, "text-right text-[13px] text-ink-3")}>รวมในงบแต่ละหมวด</td>
                <td className={td} />
                <td className={cx(td, "text-right text-[13px]")}>
                  <Amt n={pc.labour} show={show} />
                </td>
                <td colSpan={3} className={cx(td, "pr-5 text-[12px] text-ink-3")}>
                  {pc.labourLines.length ? `${pc.labourLines.length} งวดจ่าย` : "ยังไม่มีข้อมูลค่าแรงรายวันของโครงการนี้"}
                </td>
              </tr>
              <tr className="border-t border-line-strong font-medium">
                <td className={cx(td, "px-5")}>รวม</td>
                <td className={cx(td, "text-right text-[13px]")}>
                  <Amt n={totalRow.budget} show={show} />
                </td>
                <td className={cx(td, "text-right text-[13px]")}>
                  <Amt n={totalRow.committed} show={show} />
                </td>
                <td className={cx(td, "text-right text-[13px]")}>
                  <Amt n={pc.actual} show={show} />
                </td>
                <td className={cx(td, "text-right text-[13px]")}>
                  <Amt n={pc.budget - pc.actual - pc.committed} show={show} zero="0.00" />
                </td>
                <td className={td}>
                  <UseBar used={pc.usedPct} progress={p.actual} />
                </td>
                <td className={cx(td, "pr-5")} />
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="ใบสั่งซื้อที่ยังเปิดอยู่" meta={openPOs.length}>
          {openPOs.length ? (
            <table className="w-full text-left text-[13px]">
              <tbody>
                {openPOs.map((po) => (
                  <tr key={po.id} className="border-b border-line last:border-b-0">
                    <td className="px-5 py-2.5">
                      <DocLink id={po.id} />
                      <span className="block text-[12px] text-ink-3">กำหนดส่ง {thDate(po.deliveryDate)}</span>
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className="block max-w-[220px] truncate">{sups.find((s) => s.id === po.supplierId)?.name}</span>
                      <span className="block text-[12px] text-ink-3">
                        {po.costCode} · {COST_CODES[po.costCode]}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3">
                      <POStatusPill s={po.status} />
                    </td>
                    <td className="py-2.5 pr-5 text-right">
                      <Amt n={poTotals(po).subtotal - receivedValue(po, ctx.receipts)} show={show} />
                      <span className="block text-[11px] text-ink-3">คงค้าง</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty>ไม่มีใบสั่งซื้อค้างรับ</Empty>
          )}
        </Section>

        <Section title="รายการต้นทุนล่าสุด" meta={`${recent.length} รายการ`}>
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-line px-5 py-2.5 text-[12px] text-ink-3">
            {[...bySource.entries()].map(([k, v]) => (
              <span key={k}>
                {SOURCE_LABEL[k as CostEntry["source"]]} <span className="font-mono text-ink-2">{show ? fmtM(v) : "•••"}</span>
              </span>
            ))}
          </div>
          {recent.length ? (
            <div className="max-h-[420px] overflow-y-auto">
              <table className="w-full text-left text-[13px]">
                <tbody>
                  {recent.slice(0, 60).map((e) => (
                    <tr key={e.id} className="border-b border-line last:border-b-0">
                      <td className="px-5 py-2 text-[12px] text-ink-3">
                        {thDate(e.date)}
                        <span className="block font-mono">{e.ref ?? ""}</span>
                      </td>
                      <td className="py-2 pr-3">
                        <span className="block max-w-[300px] truncate">{e.description}</span>
                        <span className="block text-[12px] text-ink-3">
                          {SOURCE_LABEL[e.source]}
                          {e.source !== "labour" ? ` · ${e.costCode}` : ""}
                        </span>
                      </td>
                      <td className="py-2 pr-5 text-right">
                        <Amt n={e.amount} show={show} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>ยังไม่มีต้นทุน</Empty>
          )}
        </Section>
      </div>
    </>
  );
}
