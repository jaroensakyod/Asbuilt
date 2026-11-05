"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarRange, Plus, Search, X } from "lucide-react";
import { AssetTag, Card, Field, cx, inputCls } from "@/components/ui";
import { getProject, projects, SEVERITY_LABEL, thDate, TODAY, WO_STATUS_LABEL, type WorkOrderStatus } from "@/lib/data";
import { createWorkOrderFromRepair, useRepairs, useWorkOrders, type OpsWorkOrder } from "@/lib/ops-store";
import { addDays } from "./seed";
import { Btn, Empty, FilterField, I, Initials, Modal, Pill, Select, SEV_TONE, StatCard, type Tone } from "./bits";
import { TECHNICIANS } from "./repair-form";

export const WO_TONE: Record<WorkOrderStatus, Tone> = { assigned: "neutral", in_progress: "warn", on_hold: "accent", done: "pos", cancelled: "neutral" };
export const BILLING_LABEL: Record<OpsWorkOrder["billing"], string> = { warranty: "ประกัน (ไม่คิดค่าใช้จ่าย)", charge: "คิดค่าบริการ" };
const baht = (n: number) => `฿${n.toLocaleString("th-TH")}`;

type Filters = { q: string; status: string; technician: string; project: string; billing: string };
const NO_FILTER: Filters = { q: "", status: "open", technician: "", project: "", billing: "" };
const OPEN: WorkOrderStatus[] = ["assigned", "in_progress", "on_hold"];

export function WorkOrdersView() {
  const router = useRouter();
  const all = useWorkOrders();
  const [f, setF] = useState<Filters>(NO_FILTER);
  const [createOpen, setCreateOpen] = useState(false);
  const set = (k: keyof Filters) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  const stats = useMemo(() => {
    const month = TODAY.slice(0, 7);
    const doneMonth = all.filter((w) => w.status === "done" && (w.log[0]?.at ?? w.scheduled).startsWith(month));
    const done = all.filter((w) => w.status === "done");
    return {
      open: all.filter((w) => OPEN.includes(w.status)).length,
      today: all.filter((w) => OPEN.includes(w.status) && w.scheduled <= TODAY).length,
      progress: all.filter((w) => w.status === "in_progress").length,
      hold: all.filter((w) => w.status === "on_hold").length,
      doneMonth: doneMonth.length,
      hours: done.reduce((s, w) => s + (w.hours ?? 0), 0) / Math.max(1, done.filter((w) => w.hours).length),
      revenue: done.filter((w) => w.billing === "charge").reduce((s, w) => s + (w.cost ?? 0), 0),
    };
  }, [all]);

  const list = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    return all
      .filter((w) => (f.status === "open" ? OPEN.includes(w.status) : !f.status || w.status === f.status))
      .filter((w) => !f.technician || w.technician === f.technician)
      .filter((w) => !f.project || w.projectId === f.project)
      .filter((w) => !f.billing || w.billing === f.billing)
      .filter((w) => {
        if (!q) return true;
        const p = getProject(w.projectId);
        return `${w.id} ${w.repairId} ${w.title} ${w.asset} ${p?.name ?? ""} ${p?.owner ?? ""}`.toLowerCase().includes(q);
      })
      .sort((a, b) => (OPEN.includes(a.status) === OPEN.includes(b.status) ? (OPEN.includes(a.status) ? a.scheduled.localeCompare(b.scheduled) : b.issued.localeCompare(a.issued)) : OPEN.includes(a.status) ? -1 : 1));
  }, [all, f]);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
        <div>
          <p className="mb-1 text-[13px] text-ink-3">บริการหลังการขาย</p>
          <h1 className="text-[30px] font-normal leading-[1.15]">ใบสั่งงาน</h1>
          <p className="mt-2 max-w-[44rem] text-ink-2">มอบหมายช่างจากเรื่องแจ้งซ่อม ติดตามสถานะ ชั่วโมงงาน อะไหล่ และพิมพ์ใบงานให้ลูกค้าเซ็นรับ</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dispatch" className="inline-flex h-9 items-center gap-2 rounded-[8px] border border-line-strong bg-card px-4 text-[14px] font-medium hover:bg-raised">
            <CalendarRange {...I} />
            จัดคิวช่าง
          </Link>
          <Btn primary onClick={() => setCreateOpen(true)}>
            <Plus {...I} />
            สร้างใบสั่งงานจากแจ้งซ่อม
          </Btn>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="งานเปิดอยู่" value={stats.open} unit="ใบ" note={`ถึงกำหนดเข้างานแล้ว ${stats.today} ใบ`} active={f.status === "open"} onClick={() => setF({ ...NO_FILTER })} />
        <StatCard label="กำลังดำเนินการ" value={stats.progress} unit="ใบ" note="ช่างเข้าหน้างานแล้ว" active={f.status === "in_progress"} onClick={() => setF({ ...NO_FILTER, status: f.status === "in_progress" ? "open" : "in_progress" })} />
        <StatCard label="พักงาน" value={stats.hold} unit="ใบ" note="รออะไหล่หรือสภาพอากาศ" active={f.status === "on_hold"} onClick={() => setF({ ...NO_FILTER, status: f.status === "on_hold" ? "open" : "on_hold" })} />
        <StatCard label="ปิดงานเดือนนี้" value={stats.doneMonth} unit="ใบ" note={`เฉลี่ย ${stats.hours.toFixed(1)} ชม./งาน · ค่าบริการรวม ${baht(stats.revenue)}`} active={f.status === "done"} onClick={() => setF({ ...NO_FILTER, status: f.status === "done" ? "open" : "done" })} />
      </div>

      <Card className="mb-4 px-4 py-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <FilterField label="ค้นหา" className="col-span-2">
            <div className="relative">
              <Search {...I} className="pointer-events-none absolute left-2.5 top-2.5 text-ink-3" />
              <input value={f.q} onChange={(e) => set("q")(e.target.value)} placeholder="รหัส WO / REP งาน อุปกรณ์ ลูกค้า" className={cx(inputCls, "w-full pl-8")} />
            </div>
          </FilterField>
          <FilterField label="สถานะ">
            <Select label="สถานะ" value={f.status} onChange={set("status")}>
              <option value="open">งานที่เปิดอยู่</option>
              <option value="">ทุกสถานะ</option>
              {(Object.keys(WO_STATUS_LABEL) as WorkOrderStatus[]).map((s) => (
                <option key={s} value={s}>
                  {WO_STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="ช่าง">
            <Select label="ช่าง" value={f.technician} onChange={set("technician")}>
              <option value="">ทุกคน</option>
              {TECHNICIANS.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="โครงการ">
            <Select label="โครงการ" value={f.project} onChange={set("project")}>
              <option value="">ทุกโครงการ</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id} · {p.name}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="การคิดค่าใช้จ่าย">
            <Select label="การคิดค่าใช้จ่าย" value={f.billing} onChange={set("billing")}>
              <option value="">ทั้งหมด</option>
              <option value="warranty">ประกัน</option>
              <option value="charge">คิดค่าบริการ</option>
            </Select>
          </FilterField>
        </div>
        <div className="mt-3 flex items-center gap-3 text-[13px] text-ink-3">
          <span className="num font-mono text-[12px]">{list.length} ใบ</span>
          {JSON.stringify(f) !== JSON.stringify(NO_FILTER) && (
            <button type="button" onClick={() => setF(NO_FILTER)} className="inline-flex items-center gap-1 text-ink-2 hover:text-ink">
              <X {...I} />
              ล้างตัวกรอง
            </button>
          )}
        </div>
      </Card>

      <Card>
        <table className="w-full text-left">
          <thead>
            <tr className="text-[13px] text-ink-3">
              <th className="px-5 py-3 font-normal">ใบสั่งงาน</th>
              <th className="py-3 pr-4 font-normal">อุปกรณ์</th>
              <th className="py-3 pr-4 font-normal">โครงการ</th>
              <th className="py-3 pr-4 font-normal">ช่าง</th>
              <th className="py-3 pr-4 font-normal">นัดเข้างาน</th>
              <th className="py-3 pr-4 font-normal">สถานะ</th>
              <th className="py-3 pr-5 text-right font-normal">ค่าใช้จ่าย</th>
            </tr>
          </thead>
          <tbody>
            {list.map((w) => {
              const late = OPEN.includes(w.status) && w.scheduled < TODAY;
              return (
                <tr key={w.id} onClick={() => router.push(`/work-orders/${w.id}`)} className="cursor-pointer border-t border-line align-top transition-colors duration-150 hover:bg-raised/60">
                  <td className="px-5 py-3">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <Pill mono>{w.id}</Pill>
                      <Pill tone={SEV_TONE[w.severity]}>{SEVERITY_LABEL[w.severity]}</Pill>
                      <span className="font-mono text-[12px] text-ink-3">{w.repairId}</span>
                    </span>
                    <span className="mt-1 block max-w-[380px]">{w.title}</span>
                  </td>
                  <td className="py-3 pr-4">
                    <AssetTag code={w.asset} />
                  </td>
                  <td className="py-3 pr-4">
                    <span className="block max-w-[220px] truncate">{getProject(w.projectId)?.name ?? w.projectId}</span>
                    <span className="font-mono text-[12px] text-ink-3">{w.projectId}</span>
                  </td>
                  <td className="py-3 pr-4">
                    <span className="flex items-center gap-2 whitespace-nowrap text-[13px]">
                      <Initials name={w.technician} />
                      {w.technician}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    <span className={cx("num block font-mono text-[13px]", late && "text-neg")}>{thDate(w.scheduled)}</span>
                    <span className="block text-[12px] text-ink-3">ออก {thDate(w.issued)}</span>
                  </td>
                  <td className="py-3 pr-4">
                    <Pill tone={WO_TONE[w.status]}>{WO_STATUS_LABEL[w.status]}</Pill>
                  </td>
                  <td className="py-3 pr-5 text-right">
                    <span className="num block font-mono text-[13px]">{w.cost !== undefined ? baht(w.cost) : "–"}</span>
                    <span className="block text-[12px] text-ink-3">{w.billing === "warranty" ? "ประกัน" : "คิดค่าบริการ"}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {list.length === 0 && <Empty>ไม่พบใบสั่งงานตามตัวกรอง</Empty>}
      </Card>

      {createOpen && <CreateFromRepair onClose={() => setCreateOpen(false)} onCreated={(id) => router.push(`/work-orders/${id}`)} />}
    </>
  );
}

function CreateFromRepair({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const repairs = useRepairs();
  const wos = useWorkOrders();
  const candidates = repairs.filter((r) => r.status !== "closed" && !wos.some((w) => w.repairId === r.id && w.status !== "cancelled"));
  const [repairId, setRepairId] = useState(candidates[0]?.id ?? "");
  const r = candidates.find((x) => x.id === repairId);
  const [technician, setTechnician] = useState(r?.assignee ?? TECHNICIANS[0] ?? "");
  const [scheduled, setScheduled] = useState(addDays(TODAY, 1));
  const [billing, setBilling] = useState<OpsWorkOrder["billing"]>(r?.source === "customer" ? "charge" : "warranty");
  const choose = (id: string) => {
    setRepairId(id);
    const x = candidates.find((c) => c.id === id);
    if (x) {
      setTechnician(TECHNICIANS.includes(x.assignee) ? x.assignee : TECHNICIANS[0] ?? "");
      setBilling(x.source === "customer" ? "charge" : "warranty");
    }
  };
  const save = () => {
    const w = createWorkOrderFromRepair(repairId, { technician, scheduled, billing });
    if (w) onCreated(w.id);
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="สร้างใบสั่งงานจากแจ้งซ่อม"
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary onClick={save} disabled={!r}>
            ออกใบสั่งงาน
          </Btn>
        </>
      }
    >
      {candidates.length === 0 ? (
        <p className="text-ink-3">ทุกเรื่องที่ยังไม่ปิดมีใบสั่งงานแล้ว</p>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Field label="เรื่องแจ้งซ่อม">
              <select value={repairId} onChange={(e) => choose(e.target.value)} className={inputCls}>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id} · {c.title} · {c.asset} · {getProject(c.projectId)?.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {r && <p className="col-span-2 text-[13px] text-ink-2">{r.detail || r.title} · {r.location}</p>}
          <Field label="ช่างผู้รับผิดชอบ">
            <select value={technician} onChange={(e) => setTechnician(e.target.value)} className={inputCls}>
              {TECHNICIANS.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </Field>
          <Field label="วันนัดเข้างาน">
            <input type="date" value={scheduled} onChange={(e) => setScheduled(e.target.value)} className={inputCls} />
          </Field>
          <Field label="การคิดค่าใช้จ่าย">
            <select value={billing} onChange={(e) => setBilling(e.target.value as OpsWorkOrder["billing"])} className={inputCls}>
              <option value="warranty">{BILLING_LABEL.warranty}</option>
              <option value="charge">{BILLING_LABEL.charge}</option>
            </select>
          </Field>
        </div>
      )}
    </Modal>
  );
}
