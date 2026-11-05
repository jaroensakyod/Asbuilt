"use client";

import { Fragment, useMemo, useState } from "react";
import { Plus, Upload } from "lucide-react";
import { Card, CardHead, cx, Field, inputCls } from "@/components/ui";
import { Btn, Empty, FilterField, I, Modal, Pill, Select, useHydrated } from "@/components/ops/bits";
import { tableCls, td, tdR, th, thR } from "@/components/accounting/bits";
import { baht0, costEntries, money, type CostEntry } from "@/lib/biz";
import { thDate, TODAY } from "@/lib/data";
import { ACTIVE_SITES } from "@/lib/hr/seed";
import { employees } from "@/lib/hr/store";
import { trainings } from "@/lib/hr/labour-store";
import { monthCosts, plantCostId, type UsageCost } from "@/lib/plant/calc";
import { plants, plantUsage, usePlantSettings } from "@/lib/plant/store";
import { BASIS_LABEL, OPERATOR_CERT, type Plant, type PlantUsage } from "@/lib/plant/types";
import { fmtNum, lastPeriods, operatorOk, operatorWarn, periodEnd, periodLabel, siteName, usageFlagged, usePlantAccess } from "./bits";

export const costEntryFor = (c: UsageCost, p: Plant): CostEntry => ({
  id: plantCostId(c),
  projectId: c.projectId,
  costCode: p.costCode,
  date: periodEnd(c.period),
  source: "plant",
  ref: p.id,
  description: `ค่าเครื่องจักร ${p.name} ${c.period} (${fmtNum(c.hours, c.hours % 1 ? 1 : 0)} ชม./${c.days} วัน + น้ำมัน ${fmtNum(c.fuelL)} ลิตร)`,
  amount: c.total,
});

export function UsageTab() {
  return (
    <div className="flex flex-col gap-6">
      <MonthCost />
      <UsageLog />
    </div>
  );
}

function MonthCost() {
  const list = plants.use();
  const usage = plantUsage.use();
  const entries = costEntries.use();
  const s = usePlantSettings();
  const { edit } = usePlantAccess();
  const hydrated = useHydrated();
  const periods = lastPeriods(4);
  const [period, setPeriod] = useState(periods[1]);
  const rows = useMemo(() => monthCosts(list, usage, period, s), [list, usage, period, s]);
  const byProject = useMemo(() => {
    const m = new Map<string, UsageCost[]>();
    for (const r of rows) m.set(r.projectId, [...(m.get(r.projectId) ?? []), r]);
    return [...m];
  }, [rows]);
  const state = (c: UsageCost) => {
    const e = entries.find((x) => x.id === plantCostId(c));
    if (!e) return "none" as const;
    return Math.abs(e.amount - c.total) < 0.01 ? ("posted" as const) : ("changed" as const);
  };
  const post = (cs: UsageCost[]) => {
    const out = cs.map((c) => costEntryFor(c, list.find((p) => p.id === c.plantId)!)).filter((e) => e.amount > 0);
    if (out.length) costEntries.upsertMany(out);
  };
  const pending = hydrated ? rows.filter((r) => state(r) !== "posted" && r.total > 0) : [];
  const total = rows.reduce((t, r) => t + r.total, 0);

  return (
    <Card>
      <CardHead
        title="ต้นทุนเครื่องจักรรายเดือน"
        meta={`${periodLabel(period)} · ${baht0(total)}`}
        action={
          <div className="flex items-center gap-2">
            <Select label="งวด" value={period} onChange={setPeriod} className="w-[170px]">
              {periods.map((p) => (
                <option key={p} value={p}>
                  {periodLabel(p)}
                  {p === TODAY.slice(0, 7) ? " (ถึงวันนี้)" : ""}
                </option>
              ))}
            </Select>
            {edit && (
              <Btn small primary disabled={!pending.length} onClick={() => post(pending)}>
                <Upload {...I} />
                ลงทั้งหมด {pending.length || ""}
              </Btn>
            )}
          </div>
        }
      />
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className={cx(tableCls, "min-w-[900px]")}>
            <thead>
              <tr>
                <th className={cx(th, "pl-5")}>เครื่องจักร</th>
                <th className={thR}>ชม.</th>
                <th className={thR}>วันใช้งาน</th>
                <th className={thR}>อัตรา</th>
                <th className={thR}>ค่าเช่า/อัตราภายใน</th>
                <th className={thR}>น้ำมัน (ลิตร)</th>
                <th className={thR}>ค่าน้ำมัน</th>
                <th className={thR}>รวม</th>
                <th className={cx(th, "pr-5")}>ต้นทุนโครงการ</th>
              </tr>
            </thead>
            <tbody>
              {byProject.map(([pid, cs]) => (
                <Fragment key={pid}>
                  <tr className="bg-raised/50">
                    <td className={cx(td, "pl-5 font-medium")} colSpan={7}>
                      {siteName(pid)} <span className="font-mono text-[12px] text-ink-3">{pid}</span>
                    </td>
                    <td className={cx(tdR, "font-medium")}>
                      <span className="num font-mono">{money(cs.reduce((t, c) => t + c.total, 0))}</span>
                    </td>
                    <td className={cx(td, "pr-5")} />
                  </tr>
                  {cs.map((c) => {
                    const p = list.find((x) => x.id === c.plantId)!;
                    const st = hydrated ? state(c) : "none";
                    return (
                      <tr key={c.plantId + pid}>
                        <td className={cx(td, "pl-5")}>
                          {p.name} <span className="font-mono text-[12px] text-ink-3">{p.id}</span>
                        </td>
                        <td className={tdR}>
                          <span className="num font-mono">{fmtNum(c.hours, c.hours % 1 ? 1 : 0)}</span>
                        </td>
                        <td className={tdR}>
                          <span className="num font-mono">{c.days}</span>
                        </td>
                        <td className={cx(tdR, "text-[12px] text-ink-2")}>
                          <span className="num font-mono">{fmtNum(p.rate)}</span>/{BASIS_LABEL[p.rateBasis]}
                        </td>
                        <td className={tdR}>
                          <span className="num font-mono">{money(c.hire)}</span>
                        </td>
                        <td className={tdR}>
                          <span className="num font-mono">{fmtNum(c.fuelL)}</span>
                        </td>
                        <td className={tdR}>
                          <span className="num font-mono">{money(c.fuel)}</span>
                        </td>
                        <td className={tdR}>
                          <span className="num font-mono">{money(c.total)}</span>
                        </td>
                        <td className={cx(td, "pr-5")}>
                          {c.total <= 0 ? (
                            <span className="text-[12px] text-ink-3">ไม่มีค่าใช้จ่าย</span>
                          ) : st === "posted" ? (
                            <Pill tone="pos">ลงแล้ว</Pill>
                          ) : edit ? (
                            <Btn small onClick={() => post([c])}>
                              {st === "changed" ? "ยอดเปลี่ยน ลงใหม่" : "ลงต้นทุนโครงการ"}
                            </Btn>
                          ) : (
                            <Pill tone="warn">{st === "changed" ? "ยอดเปลี่ยน" : "ยังไม่ลง"}</Pill>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>ไม่มีการใช้งานเครื่องจักรในงวดนี้</Empty>
      )}
      <p className="border-t border-line px-5 py-2.5 text-[12px] text-ink-3">
        รายชั่วโมง = ชม. × อัตรา · รายวัน = วันที่ใช้งาน × อัตรา · รายเดือน = อัตรา × วันใช้งาน / {s.daysPerMonth} วัน (ไม่เกิน 1 เดือน) · น้ำมัน {s.fuelPrice} บาท/ลิตร · ลงเป็นต้นทุนโครงการ (แหล่ง &quot;เครื่องจักร&quot;) ตามรหัสต้นทุนของเครื่อง
      </p>
    </Card>
  );
}

function UsageLog() {
  const list = plants.use();
  const usage = plantUsage.use();
  const trn = trainings.use();
  const { edit } = usePlantAccess();
  const periods = lastPeriods(4);
  const [period, setPeriod] = useState(periods[0]);
  const [site, setSite] = useState("");
  const [plantF, setPlantF] = useState("");
  const [flagOnly, setFlagOnly] = useState(false);
  const [form, setForm] = useState(false);
  const [limit, setLimit] = useState(60);
  const rows = usage
    .filter((u) => u.date.startsWith(period) && (!site || u.projectId === site) && (!plantF || u.plantId === plantF))
    .filter((u) => !flagOnly || usageFlagged(u, list.find((p) => p.id === u.plantId), trn))
    .sort((a, b) => b.date.localeCompare(a.date) || a.plantId.localeCompare(b.plantId));
  const flagged = usage.filter((u) => u.date.startsWith(period) && usageFlagged(u, list.find((p) => p.id === u.plantId), trn)).length;

  return (
    <Card>
      <CardHead
        title="บันทึกการใช้งาน"
        meta={`${rows.length} รายการ · ${fmtNum(rows.reduce((t, u) => t + u.hours, 0))} ชม. · น้ำมัน ${fmtNum(rows.reduce((t, u) => t + u.fuelL, 0))} ลิตร`}
        action={
          edit && (
            <Btn small primary onClick={() => setForm(true)}>
              <Plus {...I} />
              บันทึกการใช้งาน
            </Btn>
          )
        }
      />
      <div className="grid grid-cols-2 gap-3 border-b border-line px-5 py-4 md:grid-cols-4">
        <FilterField label="งวด">
          <Select label="งวด" value={period} onChange={setPeriod}>
            {periods.map((p) => (
              <option key={p} value={p}>
                {periodLabel(p)}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="หน้างาน">
          <Select label="หน้างาน" value={site} onChange={setSite}>
            <option value="">ทุกหน้างาน</option>
            {ACTIVE_SITES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} · {p.name}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="เครื่องจักร">
          <Select label="เครื่องจักร" value={plantF} onChange={setPlantF}>
            <option value="">ทุกเครื่อง</option>
            {list.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} · {p.name}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="ผู้ควบคุม">
          <label className="flex h-9 items-center gap-2 text-[13px] text-ink-2">
            <input type="checkbox" checked={flagOnly} onChange={(e) => setFlagOnly(e.target.checked)} />
            เฉพาะไม่มีใบรับรอง {flagged > 0 && <Pill tone="neg">{flagged}</Pill>}
          </label>
        </FilterField>
      </div>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className={cx(tableCls, "min-w-[820px]")}>
            <thead>
              <tr>
                <th className={cx(th, "pl-5")}>วันที่</th>
                <th className={th}>เครื่องจักร</th>
                <th className={th}>หน้างาน</th>
                <th className={thR}>ชม.</th>
                <th className={thR}>น้ำมัน (ลิตร)</th>
                <th className={cx(th, "pr-5")}>ผู้ควบคุม</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limit).map((u) => {
                const p = list.find((x) => x.id === u.plantId);
                const bad = usageFlagged(u, p, trn);
                return (
                  <tr key={u.id}>
                    <td className={cx(td, "pl-5 whitespace-nowrap")}>{thDate(u.date)}</td>
                    <td className={td}>
                      {p?.name ?? u.plantId} <span className="font-mono text-[12px] text-ink-3">{u.plantId}</span>
                    </td>
                    <td className={td}>{siteName(u.projectId)}</td>
                    <td className={tdR}>
                      <span className="num font-mono">{u.hours}</span>
                    </td>
                    <td className={tdR}>
                      <span className="num font-mono">{u.fuelL || ""}</span>
                    </td>
                    <td className={cx(td, "pr-5")}>
                      {u.operatorName}
                      {bad && p && (
                        <span className="mt-0.5 block">
                          <Pill tone="neg">{operatorWarn(p)}</Pill>
                        </span>
                      )}
                      {u.note && <span className="block text-[12px] text-ink-3">{u.note}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length > limit && (
            <div className="flex justify-center border-t border-line py-3">
              <Btn small onClick={() => setLimit((n) => n + 100)}>
                แสดงเพิ่ม ({rows.length - limit})
              </Btn>
            </div>
          )}
        </div>
      ) : (
        <Empty>ไม่มีบันทึกการใช้งาน</Empty>
      )}
      {form && <UsageForm onClose={() => setForm(false)} />}
    </Card>
  );
}

export function UsageForm({ onClose, plantId }: { onClose: () => void; plantId?: string }) {
  const list = plants.use();
  const emps = employees.use();
  const trn = trainings.use();
  const usage = plantUsage.use();
  const usable = list.filter((p) => p.status !== "off_hired");
  const [pid, setPid] = useState(plantId ?? usable.find((p) => p.projectId)?.id ?? usable[0]?.id ?? "");
  const plant = list.find((p) => p.id === pid);
  const [projectId, setProjectId] = useState(plant?.projectId ?? ACTIVE_SITES[0]?.id ?? "");
  const [date, setDate] = useState(TODAY);
  const [hours, setHours] = useState(8);
  const [fuelL, setFuelL] = useState(0);
  const [op, setOp] = useState("");
  const [opName, setOpName] = useState("");
  const [note, setNote] = useState("");
  const crew = emps.filter((e) => e.projectId === projectId && e.status !== "resigned" && e.type !== "subcontract");
  const needsCert = !!plant && !!OPERATOR_CERT[plant.type];
  const certOk = !plant || operatorOk(plant, op || undefined, date, trn);
  const opLabel = op ? (emps.find((e) => e.id === op)?.name ?? op) : opName.trim();
  const ok = !!plant && !!projectId && hours >= 0 && hours <= 24 && !!date && (!!opLabel || plant.type === "scaffold");

  const save = () => {
    if (!ok || !plant) return;
    let id = `PU-${plant.id}-${date}`;
    for (let n = 2; usage.some((u) => u.id === id); n++) id = `PU-${plant.id}-${date}-${n}`;
    const rec: PlantUsage = { id, plantId: plant.id, projectId, date, hours, fuelL, operatorId: op || undefined, operatorName: opLabel || "-", note: note.trim() || undefined };
    plantUsage.upsert(rec);
    if (plant.meterHours !== undefined) plants.upsert({ ...plant, meterHours: Math.round((plant.meterHours + hours) * 10) / 10 });
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="บันทึกการใช้งานเครื่องจักร"
      width={560}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!ok} onClick={save}>
            บันทึก
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="เครื่องจักร">
          <select
            className={inputCls}
            value={pid}
            onChange={(e) => {
              setPid(e.target.value);
              const np = list.find((p) => p.id === e.target.value);
              if (np?.projectId) setProjectId(np.projectId);
            }}
          >
            {usable.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} · {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="หน้างาน">
          <select className={inputCls} value={projectId} onChange={(e) => (setProjectId(e.target.value), setOp(""))}>
            {ACTIVE_SITES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} · {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="วันที่">
          <input type="date" max={TODAY} className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="ชั่วโมงใช้งาน">
          <input type="number" min={0} max={24} step={0.5} className={cx(inputCls, "font-mono")} value={hours} onChange={(e) => setHours(Math.max(0, Number(e.target.value) || 0))} />
        </Field>
        <Field label="น้ำมันที่เติม (ลิตร)">
          <input type="number" min={0} className={cx(inputCls, "font-mono")} value={fuelL || ""} onChange={(e) => setFuelL(Math.max(0, Number(e.target.value) || 0))} />
        </Field>
        <Field label="ผู้ควบคุม (คนงานในหน้างาน)">
          <select className={inputCls} value={op} onChange={(e) => setOp(e.target.value)}>
            <option value="">คนนอก/คนขับของผู้ให้เช่า</option>
            {crew.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} · {e.skill ?? e.position}
                {needsCert && plant && !operatorOk(plant, e.id, date, trn) ? " (ไม่มีใบรับรอง)" : ""}
              </option>
            ))}
          </select>
        </Field>
        {!op && (
          <div className="sm:col-span-2">
            <Field label="ชื่อผู้ควบคุม (คนนอก)">
              <input className={inputCls} value={opName} onChange={(e) => setOpName(e.target.value)} placeholder="เช่น คนขับของผู้ให้เช่า" />
            </Field>
          </div>
        )}
        <div className="sm:col-span-2">
          <Field label="หมายเหตุ">
            <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
      </div>
      {needsCert && plant && !certOk && (
        <p className="mt-3 rounded-[8px] bg-warn-soft px-3 py-2 text-[13px] text-warn">
          {operatorWarn(plant)} {op ? "ในวันที่เลือก" : "(คนนอก ตรวจสอบสำเนาใบรับรองก่อนให้ทำงาน)"} บันทึกได้แต่จะถูกแจ้งเตือนในรายการ
        </p>
      )}
    </Modal>
  );
}
