"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { Card, CardHead, cx, Field, inputCls } from "@/components/ui";
import { Btn, Empty, FilterField, I, IconBtn, Modal, Pill, Select } from "@/components/ops/bits";
import { tableCls, td, th } from "@/components/accounting/bits";
import { thDate, TODAY } from "@/lib/data";
import { addDays } from "@/lib/hr/payroll";
import { ACTIVE_SITES } from "@/lib/hr/seed";
import { clashes, doubleBookings } from "@/lib/plant/calc";
import { plantBookings, plants } from "@/lib/plant/store";
import type { PlantBooking } from "@/lib/plant/types";
import { siteName, usePlantAccess } from "./bits";

const WD = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const shiftMonth = (p: string, n: number) => {
  const [y, m] = p.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
};
const monthDays = (p: string) => {
  const [y, m] = p.split("-").map(Number);
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => `${p}-${String(i + 1).padStart(2, "0")}`);
};
const TH_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export function BookingsTab({ focusPlant }: { focusPlant?: string }) {
  const list = plants.use();
  const bookings = plantBookings.use();
  const { edit, me } = usePlantAccess();
  const [month, setMonth] = useState(TODAY.slice(0, 7));
  const [site, setSite] = useState("");
  const [plantF, setPlantF] = useState(focusPlant ?? "");
  const [form, setForm] = useState<Partial<PlantBooking> | null>(null);

  const days = monthDays(month);
  const first = days[0];
  const last = days[days.length - 1];
  const live = bookings.filter((b) => b.status === "booked");
  const inMonth = live.filter((b) => b.from <= last && b.to >= first && (!site || b.projectId === site) && (!plantF || b.plantId === plantF));
  const rows = list.filter((p) => (plantF ? p.id === plantF : inMonth.some((b) => b.plantId === p.id)));
  const dups = doubleBookings(bookings).filter(([a, b]) => a.to >= addDays(TODAY, -30) || b.to >= addDays(TODAY, -30));
  const pname = (id: string) => list.find((p) => p.id === id)?.name ?? id;
  const cancel = (b: PlantBooking) => plantBookings.upsert({ ...b, status: "cancelled" });

  return (
    <div className="flex flex-col gap-6">
      {dups.length > 0 && (
        <Card>
          <CardHead title="การจองซ้อนกัน" meta={`${dups.length} คู่`} />
          <ul>
            {dups.map(([a, b]) => (
              <li key={a.id + b.id} className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3 text-[13px] last:border-0">
                <Pill tone="neg">ซ้อน</Pill>
                <span className="font-medium">{pname(a.plantId)}</span>
                <span className="min-w-0 flex-1 text-ink-2">
                  {[a, b].map((x) => `${siteName(x.projectId)} ${thDate(x.from)}${x.to !== x.from ? `–${thDate(x.to)}` : ""} (${x.id})`).join(" กับ ")}
                </span>
                {edit && (
                  <div className="flex gap-2">
                    {[a, b].map((x) => (
                      <Btn key={x.id} small onClick={() => cancel(x)}>
                        ยกเลิก {x.id}
                      </Btn>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <div className="flex flex-wrap items-end gap-3 border-b border-line px-5 py-4">
          <FilterField label="เดือน" className="w-[220px]">
            <div className="flex items-center gap-1">
              <IconBtn label="เดือนก่อน" onClick={() => setMonth(shiftMonth(month, -1))}>
                <ChevronLeft {...I} />
              </IconBtn>
              <span className="flex-1 text-center text-[14px]">
                {TH_MONTH[Number(month.slice(5)) - 1]} {Number(month.slice(0, 4)) + 543}
              </span>
              <IconBtn label="เดือนถัดไป" onClick={() => setMonth(shiftMonth(month, 1))}>
                <ChevronRight {...I} />
              </IconBtn>
            </div>
          </FilterField>
          <FilterField label="หน้างาน" className="min-w-[200px] flex-1">
            <Select label="หน้างาน" value={site} onChange={setSite}>
              <option value="">ทุกหน้างาน</option>
              {ACTIVE_SITES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id} · {p.name}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="เครื่องจักร" className="min-w-[200px] flex-1">
            <Select label="เครื่องจักร" value={plantF} onChange={setPlantF}>
              <option value="">ทุกเครื่องที่มีการจอง</option>
              {list.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id} · {p.name}
                </option>
              ))}
            </Select>
          </FilterField>
          {edit && (
            <Btn primary onClick={() => setForm({ plantId: plantF || list[0]?.id, projectId: site || ACTIVE_SITES[0]?.id, from: TODAY, to: TODAY })}>
              <Plus {...I} />
              จองเครื่องจักร
            </Btn>
          )}
        </div>
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse text-[12px]">
              <thead>
                <tr className="border-b border-line text-ink-3">
                  <th className="sticky left-0 z-10 w-[200px] bg-card px-5 py-2 text-left font-normal">เครื่องจักร</th>
                  {days.map((d) => {
                    const wd = new Date(d + "T00:00:00Z").getUTCDay();
                    return (
                      <th key={d} className={cx("px-0 py-1.5 text-center font-normal", wd === 0 && "text-ink-3/60", d === TODAY && "text-accent-text")}>
                        <span className="block text-[10px]">{WD[wd]}</span>
                        <span className="font-mono">{Number(d.slice(8))}</span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-b border-line last:border-0">
                    <td className="sticky left-0 z-10 bg-card px-5 py-1.5">
                      <span className="block truncate text-[13px]">{p.name}</span>
                      <span className="font-mono text-[11px] text-ink-3">{p.id}</span>
                    </td>
                    {days.map((d) => {
                      const on = inMonth.filter((b) => b.plantId === p.id && b.from <= d && b.to >= d);
                      const start = on.find((b) => b.from === d || d === first);
                      return (
                        <td key={d} className={cx("h-9 px-px py-1", d === TODAY && "bg-accent-soft/40")}>
                          {on.length > 0 && (
                            <button
                              type="button"
                              title={on.map((b) => `${b.id} · ${siteName(b.projectId)} · ${b.purpose}`).join("\n")}
                              onClick={() => edit && setForm(on[0])}
                              className={cx("flex h-6 w-full items-center overflow-hidden rounded-[3px] px-0.5 text-left font-mono text-[10px] leading-none", on.length > 1 ? "bg-neg text-card" : "bg-ink/80 text-card")}
                            >
                              {start && <span className="whitespace-nowrap">{start.projectId.slice(3)}</span>}
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>ไม่มีการจองในเดือนนี้</Empty>
        )}
        <p className="border-t border-line px-5 py-2.5 text-[12px] text-ink-3">แถบทึบ = จองแล้ว (ตัวเลขคือรหัสโครงการ) · สีแดง = จองซ้อนกันวันเดียวกัน · คลิกแถบเพื่อแก้ไข</p>
      </Card>

      <Card>
        <CardHead title="รายการจองในเดือน" meta={`${inMonth.length} รายการ`} />
        {inMonth.length ? (
          <div className="overflow-x-auto">
            <table className={cx(tableCls, "min-w-[760px]")}>
              <thead>
                <tr>
                  <th className={cx(th, "pl-5")}>เลขที่</th>
                  <th className={th}>เครื่องจักร</th>
                  <th className={th}>หน้างาน</th>
                  <th className={th}>ช่วงวันที่</th>
                  <th className={th}>งาน</th>
                  <th className={cx(th, "pr-5")}></th>
                </tr>
              </thead>
              <tbody>
                {[...inMonth]
                  .sort((a, b) => a.from.localeCompare(b.from))
                  .map((b) => {
                    const c = clashes(b, bookings);
                    return (
                      <tr key={b.id}>
                        <td className={cx(td, "pl-5 font-mono text-[12px]")}>{b.id}</td>
                        <td className={td}>{pname(b.plantId)}</td>
                        <td className={td}>{siteName(b.projectId)}</td>
                        <td className={cx(td, "whitespace-nowrap")}>
                          {thDate(b.from)}
                          {b.to !== b.from && ` – ${thDate(b.to)}`}
                          {c.length > 0 && (
                            <span className="ml-2">
                              <Pill tone="neg">ซ้อน {c.map((x) => x.id).join(", ")}</Pill>
                            </span>
                          )}
                        </td>
                        <td className={cx(td, "text-ink-2")}>
                          {b.purpose}
                          <span className="block text-[12px] text-ink-3">จองโดย {b.by}</span>
                        </td>
                        <td className={cx(td, "pr-5 text-right")}>
                          {edit && (
                            <IconBtn label={`ยกเลิก ${b.id}`} danger onClick={() => cancel(b)}>
                              <X {...I} />
                            </IconBtn>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>ยังไม่มีการจอง</Empty>
        )}
      </Card>
      {form && <BookingForm init={form} by={me.name} onClose={() => setForm(null)} />}
    </div>
  );
}

function BookingForm({ init, by, onClose }: { init: Partial<PlantBooking>; by: string; onClose: () => void }) {
  const list = plants.use();
  const all = plantBookings.use();
  const [f, setF] = useState<Partial<PlantBooking>>(init);
  const [force, setForce] = useState(false);
  const set = (p: Partial<PlantBooking>) => {
    setF((x) => ({ ...x, ...p }));
    setForce(false);
  };
  const c = f.plantId && f.from && f.to ? clashes({ id: f.id ?? "", plantId: f.plantId, from: f.from, to: f.to }, all) : [];
  const valid = !!(f.plantId && f.projectId && f.from && f.to && f.to >= f.from && f.purpose?.trim());
  const ok = valid && (!c.length || force);
  const save = () => {
    if (!ok) return;
    plantBookings.upsert({ id: f.id || plantBookings.nextId(`PB-${TODAY.slice(0, 4)}-`), plantId: f.plantId!, projectId: f.projectId!, from: f.from!, to: f.to!, purpose: f.purpose!.trim(), by: f.by ?? by, status: "booked" });
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={f.id ? `แก้ไขการจอง ${f.id}` : "จองเครื่องจักร"}
      width={560}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!ok} onClick={save}>
            บันทึกการจอง
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="เครื่องจักร">
          <select className={inputCls} value={f.plantId ?? ""} onChange={(e) => set({ plantId: e.target.value })}>
            {list
              .filter((p) => p.status !== "off_hired")
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id} · {p.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="หน้างาน">
          <select className={inputCls} value={f.projectId ?? ""} onChange={(e) => set({ projectId: e.target.value })}>
            {ACTIVE_SITES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} · {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="ตั้งแต่">
          <input type="date" className={inputCls} value={f.from ?? ""} onChange={(e) => set({ from: e.target.value, to: f.to && f.to < e.target.value ? e.target.value : f.to })} />
        </Field>
        <Field label="ถึง">
          <input type="date" className={inputCls} min={f.from} value={f.to ?? ""} onChange={(e) => set({ to: e.target.value })} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="ใช้ทำงาน">
            <input className={inputCls} value={f.purpose ?? ""} onChange={(e) => set({ purpose: e.target.value })} placeholder="เช่น เทพื้นชั้น 2" />
          </Field>
        </div>
      </div>
      {c.length > 0 && (
        <div className="mt-3 rounded-[8px] bg-neg-soft px-3 py-2 text-[13px] text-neg">
          <p>เครื่องนี้ถูกจองในช่วงเดียวกันแล้ว:</p>
          <ul className="mt-1 list-disc pl-5">
            {c.map((x) => (
              <li key={x.id}>
                {x.id} · {siteName(x.projectId)} · {thDate(x.from)}
                {x.to !== x.from && `–${thDate(x.to)}`} · {x.purpose}
              </li>
            ))}
          </ul>
          <label className="mt-2 flex items-center gap-2 text-ink">
            <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
            ยืนยันจองซ้อน (ประสานงานกับหน้างานอื่นแล้ว)
          </label>
        </div>
      )}
    </Modal>
  );
}
