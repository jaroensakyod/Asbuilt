"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Presentation, Printer } from "lucide-react";
import { Card, CardHead, cx, Field, inputCls } from "@/components/ui";
import { Btn, Empty, I, KV, Pill, Select, StatCard } from "@/components/ops/bits";
import { TODAY } from "@/lib/data";
import { installments, type Installment } from "@/lib/biz";
import {
  INT_STATUS_LABEL,
  feeToInstallment,
  ffeItems,
  interiorProjects,
  isFfeLate,
  isSampleOverdue,
  marginPct,
  moodBoards,
  punchItems,
  roomBudgets,
  samples,
  useInteriorSettings,
  type FeeMilestone,
  type InteriorProject,
  type InteriorStatus,
} from "@/lib/interior";
import { Amt, Header, NumInput, Tabs, dateOr, projectName, td, th, thR, usePerms } from "@/components/design/bits";
import { BoardsTab } from "./boards";
import { FfeTab } from "./ffe";
import { InstallTab, PunchTab, SamplesTab } from "./site";
import { PresentationSheet } from "./presentation";

type Tab = "overview" | "boards" | "ffe" | "samples" | "install" | "punch";
const TABS: Tab[] = ["overview", "boards", "ffe", "samples", "install", "punch"];

export function InteriorDetail({ id }: { id: string }) {
  const list = interiorProjects.use();
  const p = list.find((x) => x.id === id) ?? list.find((x) => x.projectId === id);
  const sp = useSearchParams();
  const router = useRouter();
  const raw = sp.get("tab") as Tab | null;
  const tab: Tab = raw && TABS.includes(raw) ? raw : "overview";
  const items = ffeItems.use();
  const smp = samples.use();
  const punch = punchItems.use();
  const boards = moodBoards.use();
  const st = useInteriorSettings();
  const [present, setPresent] = useState(false);
  if (!p)
    return (
      <Card>
        <Empty>
          ไม่พบโครงการตกแต่ง {id} ·{" "}
          <Link href="/interior" className="underline-offset-2 hover:underline">
            กลับไปรายการ
          </Link>
        </Empty>
      </Card>
    );
  const its = items.filter((i) => i.interiorId === p.id);
  const go = (t: Tab) => router.replace(t === "overview" ? `/interior/${p.id}` : `/interior/${p.id}?tab=${t}`);
  return (
    <>
      <Header
        eyebrow={`งานตกแต่งภายใน · ${p.id}`}
        title={p.name}
        sub={`${p.client}${p.projectId ? ` · ${projectName(p.projectId)} (${p.projectId})` : " · ลูกค้าภายนอก"} · มัณฑนากร ${p.designer} · กำหนดเสร็จ ${dateOr(p.due)}`}
        actions={
          <Btn onClick={() => setPresent(true)}>
            <Presentation {...I} />
            พรีเซนต์ลูกค้า
          </Btn>
        }
      />
      <Tabs
        value={tab}
        onChange={go}
        tabs={[
          { key: "overview", label: "ภาพรวมและงบ" },
          { key: "boards", label: "บอร์ดห้อง", count: boards.filter((b) => b.interiorId === p.id).length },
          { key: "ffe", label: "ตาราง FF&E", count: its.filter((i) => isFfeLate(i, TODAY)).length },
          { key: "samples", label: "ตัวอย่างวัสดุ", count: smp.filter((s) => s.interiorId === p.id && isSampleOverdue(s, TODAY, st.sampleReturnDays)).length },
          { key: "install", label: "ติดตั้ง" },
          { key: "punch", label: "แก้ไขก่อนส่งมอบ", count: punch.filter((x) => x.interiorId === p.id && x.status !== "verified").length },
        ]}
      />
      {tab === "overview" && <Overview p={p} />}
      {tab === "boards" && <BoardsTab p={p} />}
      {tab === "ffe" && <FfeTab p={p} />}
      {tab === "samples" && <SamplesTab p={p} />}
      {tab === "install" && <InstallTab p={p} />}
      {tab === "punch" && <PunchTab p={p} />}
      <PresentationSheet p={p} open={present} onClose={() => setPresent(false)} />
    </>
  );
}

const feeState = (f: FeeMilestone, list: Installment[]): FeeMilestone["status"] => {
  const inst = f.installmentId ? list.find((i) => i.id === f.installmentId) : undefined;
  if (!inst) return f.status;
  return inst.status === "paid" ? "paid" : inst.invoiceNo || inst.status === "invoiced" || inst.status === "overdue" ? "invoiced" : "scheduled";
};
const FEE_LABEL = { scheduled: "ยังไม่เรียกเก็บ", invoiced: "ออกใบแจ้งหนี้แล้ว", paid: "รับชำระแล้ว" } as const;

function Overview({ p }: { p: InteriorProject }) {
  const { edit } = usePerms("interior");
  const items = ffeItems.use();
  const inst = installments.use();
  const its = items.filter((i) => i.interiorId === p.id);
  const budget = useMemo(() => roomBudgets(p.rooms, its), [p.rooms, its]);
  const tot = budget.reduce((t, r) => ({ allowance: t.allowance + r.allowance, specified: t.specified + r.specified, committed: t.committed + r.committed, actual: t.actual + r.actual, cost: t.cost + r.cost }), { allowance: 0, specified: 0, committed: 0, actual: 0, cost: 0 });
  const fees = p.fees.map((f) => ({ f, s: feeState(f, inst) }));
  const paid = fees.filter((x) => x.s === "paid").reduce((t, x) => t + x.f.amount, 0);
  const save = (patch: Partial<InteriorProject>) => interiorProjects.upsert({ ...p, ...patch });
  const [newRoom, setNewRoom] = useState("");
  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="งบตกแต่งที่ตกลงกับลูกค้า" value={<Amt n={tot.allowance} />} note={`${p.rooms.length} ห้อง`} />
        <StatCard label="สั่งซื้อแล้ว (ราคาขาย)" value={<Amt n={tot.committed} />} note={`ระบุในตาราง ${Math.round(tot.specified).toLocaleString("th-TH")} บาท`} tone={tot.committed > tot.allowance ? "neg" : undefined} />
        <StatCard label="รับของ/ติดตั้งแล้ว" value={<Amt n={tot.actual} />} note={`กำไรขั้นต้นตามตาราง ${marginPct(tot.cost, tot.specified)}%`} />
        <StatCard label="ค่าออกแบบรับแล้ว" value={<Amt n={paid} />} note={`จาก ${Math.round(p.designFee).toLocaleString("th-TH")} บาท`} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHead title="งบรายห้อง" meta="ราคาขายก่อน VAT" />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left">
                <thead>
                  <tr>
                    <th className={cx(th, "px-5")}>ห้อง</th>
                    <th className={thR}>งบ</th>
                    <th className={thR}>ระบุแล้ว</th>
                    <th className={thR}>สั่งแล้ว</th>
                    <th className={thR}>รับ/ติดตั้ง</th>
                    <th className={cx(thR, "pr-5")}>คงเหลือ</th>
                  </tr>
                </thead>
                <tbody>
                  {budget.map((r) => (
                    <tr key={r.room} className="border-t border-line">
                      <td className={cx(td, "px-5")}>{r.room}</td>
                      <td className={cx(td, "w-[140px] text-right")}>
                        {edit && p.rooms.some((x) => x.name === r.room) ? (
                          <NumInput value={r.allowance} step={5000} onChange={(n) => save({ rooms: p.rooms.map((x) => (x.name === r.room ? { ...x, budget: n } : x)) })} className="h-8 text-right" />
                        ) : (
                          <Amt n={r.allowance} />
                        )}
                      </td>
                      <td className={cx(td, "text-right")}>
                        <Amt n={r.specified} />
                      </td>
                      <td className={cx(td, "text-right")}>
                        <Amt n={r.committed} />
                      </td>
                      <td className={cx(td, "text-right")}>
                        <Amt n={r.actual} />
                      </td>
                      <td className={cx(td, "pr-5 text-right")}>
                        <Amt n={r.variance} className={r.variance < 0 ? "text-neg" : undefined} />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-line-strong">
                    <td className={cx(td, "px-5 font-medium")}>รวม</td>
                    <td className={cx(td, "text-right font-medium")}>
                      <Amt n={tot.allowance} />
                    </td>
                    <td className={cx(td, "text-right")}>
                      <Amt n={tot.specified} />
                    </td>
                    <td className={cx(td, "text-right")}>
                      <Amt n={tot.committed} />
                    </td>
                    <td className={cx(td, "text-right")}>
                      <Amt n={tot.actual} />
                    </td>
                    <td className={cx(td, "pr-5 text-right")}>
                      <Amt n={tot.allowance - Math.max(tot.committed, tot.specified)} />
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {edit && (
              <div className="flex gap-2 border-t border-line px-5 py-3">
                <input value={newRoom} onChange={(e) => setNewRoom(e.target.value)} placeholder="เพิ่มห้อง" className={cx(inputCls, "flex-1")} />
                <Btn small disabled={!newRoom.trim() || p.rooms.some((r) => r.name === newRoom.trim())} onClick={() => (save({ rooms: [...p.rooms, { name: newRoom.trim(), budget: 0 }] }), setNewRoom(""))}>
                  เพิ่ม
                </Btn>
              </div>
            )}
          </Card>
          <Card>
            <CardHead title="งวดค่าออกแบบและมัดจำ" meta={p.projectId ? "ส่งเข้าลูกหนี้ของโครงการได้" : "ลูกค้าภายนอก บันทึกสถานะที่นี่"} />
            <table className="w-full text-left">
              <thead>
                <tr>
                  <th className={cx(th, "px-5")}>งวด</th>
                  <th className={thR}>%</th>
                  <th className={thR}>จำนวนเงิน</th>
                  <th className={th}>กำหนด</th>
                  <th className={cx(th, "pr-5")}>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {fees.map(({ f, s }) => (
                  <tr key={f.id} className="border-t border-line">
                    <td className={cx(td, "px-5")}>{f.title}</td>
                    <td className={cx(td, "num text-right font-mono")}>{f.pct}</td>
                    <td className={cx(td, "text-right")}>
                      <Amt n={f.amount} />
                    </td>
                    <td className={cx(td, f.due < TODAY && s === "scheduled" && "text-warn")}>{dateOr(f.due)}</td>
                    <td className={cx(td, "pr-5")}>
                      <div className="flex flex-wrap items-center gap-2">
                        <Pill tone={s === "paid" ? "pos" : s === "invoiced" ? "accent" : "neutral"}>{FEE_LABEL[s]}</Pill>
                        {edit && s === "scheduled" && p.projectId && !f.installmentId && (
                          <button type="button" className="text-[12px] text-accent-text hover:underline" onClick={() => feeToInstallment(p, f)}>
                            ส่งเข้าลูกหนี้
                          </button>
                        )}
                        {f.installmentId && s === "scheduled" && <span className="font-mono text-[12px] text-ink-3">{f.installmentId}</span>}
                        {edit && !p.projectId && s !== "paid" && (
                          <button type="button" className="text-[12px] text-accent-text hover:underline" onClick={() => save({ fees: p.fees.map((x) => (x.id === f.id ? { ...x, status: s === "scheduled" ? "invoiced" : "paid", paidAt: s === "invoiced" ? TODAY : x.paidAt } : x)) })}>
                            {s === "scheduled" ? "ออกใบแจ้งหนี้แล้ว" : "รับชำระแล้ว"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
        <Card>
          <CardHead title="ข้อมูลงาน" />
          <div className="px-5 py-3">
            <KV k="สถานะ">
              {edit ? (
                <Select label="สถานะ" value={p.status} onChange={(s) => save({ status: s as InteriorStatus })} className="h-8">
                  {Object.entries(INT_STATUS_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              ) : (
                INT_STATUS_LABEL[p.status]
              )}
            </KV>
            <KV k="ลูกค้า">{p.client}</KV>
            <KV k="โทร">{p.phone ? <a href={`tel:${p.phone}`} className="num font-mono hover:underline">{p.phone}</a> : "–"}</KV>
            <KV k="สถานที่">{p.address ?? "–"}</KV>
            <KV k="บ้าน">
              {p.projectId ? (
                <Link href={`/projects/${p.projectId}`} className="hover:underline">
                  {projectName(p.projectId)}
                </Link>
              ) : (
                "ลูกค้าภายนอก"
              )}
            </KV>
            <KV k="มัณฑนากร">{p.designer}</KV>
            <KV k="ช่วงงาน">
              {dateOr(p.start)} – {dateOr(p.due)}
            </KV>
            <KV k="ส่งมอบ">{p.handover ? `${dateOr(p.handover.signedAt)} · ${p.handover.signedBy}` : "–"}</KV>
          </div>
          {edit && (
            <div className="px-5 pb-4">
              <Field label="หมายเหตุ">
                <textarea defaultValue={p.note ?? ""} onBlur={(e) => e.target.value !== (p.note ?? "") && save({ note: e.target.value || undefined })} className="min-h-[80px] rounded-[8px] border border-line-strong bg-card px-3 py-2 text-[14px] outline-none focus:border-ink-3" />
              </Field>
            </div>
          )}
          <div className="border-t border-line px-5 py-3">
            <Link href={`/interior/${p.id}?tab=ffe`} className="inline-flex items-center gap-1.5 text-[13px] text-ink-2 hover:text-ink">
              <Printer {...I} />
              พิมพ์ตาราง FF&E ได้จากแท็บตาราง FF&E
            </Link>
          </div>
        </Card>
      </div>
    </>
  );
}
