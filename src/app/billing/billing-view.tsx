"use client";

import { useState } from "react";
import { Check, CreditCard, Info } from "lucide-react";
import { Page } from "@/components/shell/topbar";
import { Card, CardHead, PageHeader, Status, cx } from "@/components/ui";
import { Meter } from "@/components/dashboard/kpi";
import { projects, team, thDate } from "@/lib/data";
import { allDocs } from "@/lib/docs-data";
import { uploads } from "@/lib/docs-store";
import { money } from "@/lib/biz";
import { useMe } from "@/lib/use-me";
import { canEdit } from "@/lib/permissions";
import { LIVE } from "@/lib/supabase/env";
import {
  changePlan,
  demoInvoices,
  limitText,
  overLimits,
  planOf,
  planRank,
  PLANS,
  PRICE_NOTE,
  priceFor,
  useCurrentPlan,
  VAT_RATE,
  YEARLY_DISCOUNT,
  type BillingCycle,
  type Plan,
  type PlanId,
  type Usage,
} from "@/lib/billing";

const thb = (n: number) => `฿${n.toLocaleString("th-TH")}`;

function useUsage(): Usage {
  const up = uploads.use();
  const kb = allDocs.reduce((s, d) => s + d.sizeKb, 0) + up.reduce((s, d) => s + d.sizeKb, 0);
  return {
    seats: team.filter((m) => m.active).length,
    projects: projects.filter((p) => p.status !== "delivered").length,
    storageGb: kb / 1024 / 1024,
  };
}

export function BillingView() {
  const me = useMe();
  const editable = canEdit(me.role, "admin");
  const { plan, sub } = useCurrentPlan();
  const usage = useUsage();
  const [pick, setPick] = useState<{ id: PlanId; cycle: BillingCycle } | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const cycle = sub?.cycle ?? "monthly";
  const invoices = LIVE ? [] : demoInvoices(sub);

  const pct = (used: number, limit: number) => (Number.isFinite(limit) ? (used / limit) * 100 : Math.min(100, used));

  return (
    <Page trail={[{ label: "ตั้งค่า" }, { label: "แพ็กเกจ & การชำระเงิน" }]}>
      <PageHeader
        title="แพ็กเกจ & การชำระเงิน"
        sub="เลือกแพ็กเกจตามขนาดบริษัท การเปลี่ยนแพ็กเกจจะบันทึกไว้ในระบบ ยังไม่มีการเรียกเก็บเงินจริง"
      />

      {done && (
        <Card className="mb-4 flex items-center gap-2 px-5 py-3 text-[14px]">
          <Check size={16} strokeWidth={1.5} className="text-pos" />
          {done}
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHead title="แพ็กเกจปัจจุบัน" meta={sub ? `ตั้งแต่ ${thDate(sub.since)}` : "ยังไม่ได้เลือก"} />
          <div className="px-5 py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <p className="text-[26px] font-normal leading-none">{plan.name}</p>
              <p className="text-[14px] text-ink-2">
                <span className="num font-mono text-ink">{thb(priceFor(plan, cycle))}</span> / {cycle === "yearly" ? "ปี" : "เดือน"} ไม่รวม VAT
                <span className="ml-2 text-[12px] text-ink-3">{PRICE_NOTE}</span>
              </p>
            </div>
            <p className="mt-1 text-[13px] text-ink-3">{plan.tagline}</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <UsageMeter label="ผู้ใช้" used={`${usage.seats}`} limit={limitText(plan.seats)} unit="คน" value={pct(usage.seats, plan.seats)} />
              <UsageMeter label="โครงการที่ดำเนินอยู่" used={`${usage.projects}`} limit={limitText(plan.projects)} unit="" value={pct(usage.projects, plan.projects)} />
              <UsageMeter label="พื้นที่เอกสาร" used={usage.storageGb.toFixed(1)} limit={limitText(plan.storageGb)} unit="GB" value={pct(usage.storageGb, plan.storageGb)} />
            </div>
          </div>
        </Card>

        <Card>
          <CardHead title="วิธีชำระเงิน" />
          <div className="flex gap-3 px-5 py-4">
            <CreditCard size={16} strokeWidth={1.5} className="mt-0.5 shrink-0 text-ink-3" />
            <div className="text-[14px] text-ink-2">
              <p className="text-ink">ยังไม่ได้เชื่อมต่อการชำระเงินออนไลน์</p>
              <p className="mt-1">ระบบยังไม่รับบัตรหรือพร้อมเพย์ในหน้านี้ ช่วงนี้ชำระด้วยการโอนตามใบแจ้งหนี้ที่ทีมงานส่งให้ทางอีเมล</p>
              <p className="mt-2 text-[13px] text-ink-3">เมื่อเชื่อมต่อผู้ให้บริการชำระเงินแล้ว จะเพิ่มบัตรและตั้งตัดเงินอัตโนมัติได้ที่นี่</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-8 flex flex-wrap items-baseline justify-between gap-3 pb-3">
        <h2 className="text-[18px] font-normal">เลือกแพ็กเกจ</h2>
        <p className="flex items-center gap-1.5 text-[13px] text-ink-3">
          <Info size={16} strokeWidth={1.5} />
          {PRICE_NOTE} · รายปีลด {Math.round(YEARLY_DISCOUNT * 100)}%
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((p) => (
          <PlanCard
            key={p.id}
            plan={p}
            current={p.id === plan.id}
            currentRank={planRank(plan.id)}
            editable={editable}
            onPick={() => {
              setDone(null);
              setPick({ id: p.id, cycle });
            }}
          />
        ))}
      </div>

      {pick && (
        <ChangePanel
          from={plan}
          fromCycle={cycle}
          to={planOf(pick.id)}
          cycle={pick.cycle}
          usage={usage}
          setCycle={(c) => setPick({ ...pick, cycle: c })}
          onCancel={() => setPick(null)}
          onConfirm={() => {
            const to = planOf(pick.id);
            changePlan(to.id, pick.cycle, me.name);
            setPick(null);
            setDone(`เปลี่ยนเป็นแพ็กเกจ ${to.name} (${pick.cycle === "yearly" ? "รายปี" : "รายเดือน"}) แล้ว ไม่มีการเรียกเก็บเงิน`);
          }}
        />
      )}

      <div className="mt-8 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHead title="ใบแจ้งหนี้" meta={LIVE ? undefined : "ข้อมูลตัวอย่าง"} />
          {invoices.length === 0 ? (
            <p className="px-5 py-5 text-[14px] text-ink-3">ยังไม่มีใบแจ้งหนี้ ใบแจ้งหนี้จะแสดงที่นี่เมื่อเปิดการเรียกเก็บเงิน</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="border-b border-line text-left text-[13px] text-ink-3">
                    <th className="px-5 py-2.5 font-normal">เลขที่</th>
                    <th className="px-3 py-2.5 font-normal">วันที่</th>
                    <th className="px-3 py-2.5 font-normal">แพ็กเกจ</th>
                    <th className="px-3 py-2.5 text-right font-normal">รวม VAT</th>
                    <th className="px-5 py-2.5 font-normal">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {invoices.slice(0, 12).map((i) => (
                    <tr key={i.no}>
                      <td className="px-5 py-2.5 font-mono text-[13px]">{i.no}</td>
                      <td className="px-3 py-2.5">{thDate(i.date)}</td>
                      <td className="px-3 py-2.5">
                        {planOf(i.plan).name} <span className="text-ink-3">· {i.cycle === "yearly" ? "รายปี" : "รายเดือน"}</span>
                      </td>
                      <td className="num px-3 py-2.5 text-right font-mono">{money(i.amount + i.vat)}</td>
                      <td className="px-5 py-2.5">{i.status === "paid" ? <Status tone="pos">ชำระแล้ว</Status> : <Status tone="warn">รอชำระ</Status>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <CardHead title="ประวัติการเปลี่ยนแพ็กเกจ" />
          {!sub?.history.length ? (
            <p className="px-5 py-5 text-[14px] text-ink-3">ยังไม่มีประวัติ</p>
          ) : (
            <ul className="divide-y divide-line">
              {[...sub.history].reverse().map((h, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3 px-5 py-2.5 text-[14px]">
                  <span>
                    {h.from ? `${planOf(h.from).name} → ` : "เริ่มใช้ "}
                    {planOf(h.to).name}
                    <span className="text-ink-3"> · {h.cycle === "yearly" ? "รายปี" : "รายเดือน"} · {h.by}</span>
                  </span>
                  <span className="shrink-0 text-[13px] text-ink-3">{thDate(h.date)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </Page>
  );
}

function UsageMeter({ label, used, limit, unit, value }: { label: string; used: string; limit: string; unit: string; value: number }) {
  return (
    <div>
      <p className="text-[13px] text-ink-2">{label}</p>
      <p className="mt-1 flex items-baseline gap-1">
        <span className="num text-[22px] font-medium leading-none">{used}</span>
        <span className="text-[13px] text-ink-3">
          / {limit} {unit}
        </span>
      </p>
      <div className="mt-2">
        <Meter value={value} label="ใช้ไป" tone={value >= 90 ? "warn" : "ink"} />
      </div>
    </div>
  );
}

function PlanCard({ plan, current, currentRank, editable, onPick }: { plan: Plan; current: boolean; currentRank: number; editable: boolean; onPick: () => void }) {
  const up = planRank(plan.id) > currentRank;
  return (
    <Card className={cx("flex flex-col px-5 py-5", current && "border-ink")}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[18px] font-medium">{plan.name}</p>
        {current && <Status tone="accent">แพ็กเกจปัจจุบัน</Status>}
      </div>
      <p className="mt-1 text-[13px] text-ink-3">{plan.tagline}</p>
      <p className="mt-4 flex items-baseline gap-1.5">
        <span className="num text-[28px] font-medium leading-none">{thb(plan.price)}</span>
        <span className="text-[13px] text-ink-3">/ เดือน</span>
      </p>
      <p className="mt-1 text-[12px] text-ink-3">{PRICE_NOTE}</p>
      <dl className="mt-4 grid grid-cols-[1fr_auto] gap-y-1 text-[14px]">
        <dt className="text-ink-2">ผู้ใช้</dt>
        <dd className="num text-right font-mono">{limitText(plan.seats)}</dd>
        <dt className="text-ink-2">โครงการที่ดำเนินอยู่</dt>
        <dd className="num text-right font-mono">{limitText(plan.projects)}</dd>
        <dt className="text-ink-2">พื้นที่เอกสาร</dt>
        <dd className="num text-right font-mono">{limitText(plan.storageGb)} GB</dd>
      </dl>
      <ul className="mt-4 flex flex-col gap-1.5 border-t border-line pt-4 text-[14px] text-ink-2">
        {plan.features.map((f) => (
          <li key={f} className="flex gap-2">
            <Check size={16} strokeWidth={1.5} className="mt-0.5 shrink-0 text-ink-3" />
            {f}
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-5">
        {current ? (
          <button type="button" onClick={onPick} disabled={!editable} className="h-9 w-full rounded-[8px] border border-line-strong bg-card text-[14px] transition-colors duration-150 hover:bg-raised disabled:opacity-40">
            เปลี่ยนรอบชำระ
          </button>
        ) : (
          <button
            type="button"
            onClick={onPick}
            disabled={!editable}
            className={cx(
              "h-9 w-full rounded-[8px] text-[14px] font-medium transition-[background-color,transform] duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40",
              up ? "bg-ink text-card hover:bg-[#253d5c]" : "border border-line-strong bg-card text-ink hover:bg-raised",
            )}
          >
            {up ? `อัปเกรดเป็น ${plan.name}` : `ลดเป็น ${plan.name}`}
          </button>
        )}
        {!editable && <p className="mt-2 text-center text-[12px] text-ink-3">เฉพาะผู้ดูแลระบบเปลี่ยนแพ็กเกจได้</p>}
      </div>
    </Card>
  );
}

function ChangePanel({
  from,
  fromCycle,
  to,
  cycle,
  usage,
  setCycle,
  onCancel,
  onConfirm,
}: {
  from: Plan;
  fromCycle: BillingCycle;
  to: Plan;
  cycle: BillingCycle;
  usage: Usage;
  setCycle: (c: BillingCycle) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const blocks = overLimits(to, usage);
  const same = from.id === to.id && fromCycle === cycle;
  const price = priceFor(to, cycle);
  const vat = Math.round(price * VAT_RATE * 100) / 100;
  return (
    <Card className="mt-4">
      <CardHead title={from.id === to.id ? `เปลี่ยนรอบชำระ ${to.name}` : `เปลี่ยนจาก ${from.name} เป็น ${to.name}`} />
      <div className="grid gap-5 px-5 py-4 md:grid-cols-[1fr_auto]">
        <div className="text-[14px]">
          <div className="flex gap-1.5">
            {(["monthly", "yearly"] as const).map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={cycle === c}
                onClick={() => setCycle(c)}
                className={cx("h-8 rounded-[8px] border px-3 text-[13px] transition-colors duration-150", cycle === c ? "border-ink bg-ink text-card" : "border-line-strong bg-card hover:bg-raised")}
              >
                {c === "monthly" ? "รายเดือน" : `รายปี (ลด ${Math.round(YEARLY_DISCOUNT * 100)}%)`}
              </button>
            ))}
          </div>
          <dl className="mt-4 grid max-w-[360px] grid-cols-[1fr_auto] gap-y-1">
            <dt className="text-ink-2">ค่าแพ็กเกจ / {cycle === "yearly" ? "ปี" : "เดือน"}</dt>
            <dd className="num text-right font-mono">{money(price)}</dd>
            <dt className="text-ink-2">VAT 7%</dt>
            <dd className="num text-right font-mono">{money(vat)}</dd>
            <dt className="text-ink">รวม</dt>
            <dd className="num text-right font-mono text-ink">{money(price + vat)}</dd>
          </dl>
          <p className="mt-3 text-[13px] text-ink-3">{PRICE_NOTE} การยืนยันจะบันทึกแพ็กเกจที่เลือกเท่านั้น ไม่มีการตัดเงิน</p>
          {blocks.length > 0 && (
            <div className="mt-3 rounded-[8px] border border-warn/40 bg-warn-soft px-3 py-2 text-[13px] text-ink">
              <p>ลดแพ็กเกจไม่ได้ เพราะการใช้งานตอนนี้เกินสิทธิ์ของ {to.name}</p>
              <ul className="mt-1 list-disc pl-5 text-ink-2">
                {blocks.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="flex items-end gap-2">
          <button type="button" onClick={onCancel} className="h-9 rounded-[8px] border border-line-strong bg-card px-4 text-[14px] transition-colors duration-150 hover:bg-raised">
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={blocks.length > 0 || same}
            className="h-9 rounded-[8px] bg-ink px-4 text-[14px] font-medium text-card transition-[background-color,transform] duration-150 hover:bg-[#253d5c] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            ยืนยันเปลี่ยนแพ็กเกจ
          </button>
        </div>
      </div>
    </Card>
  );
}
