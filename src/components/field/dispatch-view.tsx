"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, Plus, Wrench } from "lucide-react";
import { Card, CardHead, cx, Field, inputCls } from "@/components/ui";
import { Btn, Empty, I, Initials, Modal, Pill, Segmented, SEV_TONE, StatCard, SystemPill, useHydrated } from "@/components/ops/bits";
import { getProject, SEVERITY_LABEL, slaText, SYSTEM_LABEL, thDate, TODAY, type SystemKey } from "@/lib/data";
import { useRepairs, useWorkOrders, type OpsRepair, type OpsWorkOrder } from "@/lib/ops-store";
import { addDays, dateRange, lowStock, skillMatch, suggestTech, workload } from "@/lib/field/calc";
import { ServiceSettingsButton } from "./service-settings";
import { addVanItem, assignRepair, assignWorkOrder, replenish, technicians, useFieldSettings, vanMoves, vanStock, woService } from "@/lib/field/store";

const OPEN = ["assigned", "in_progress", "on_hold"];
type Drag = { kind: "repair"; id: string; system: SystemKey } | { kind: "wo"; id: string; system: SystemKey };

export function DispatchView() {
  return (
    <Suspense fallback={<div className="h-[60vh]" />}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const sp = useSearchParams();
  const [tab, setTab] = useState<"board" | "van">(sp.get("tab") === "van" ? "van" : "board");
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
        <div>
          <p className="mb-1 text-[13px] text-ink-3">งานบริการ</p>
          <h1 className="text-[30px] font-normal leading-[1.15]">จัดคิวช่าง</h1>
          <p className="mt-2 max-w-[44rem] text-ink-2">ลากงานแจ้งซ่อมไปวางที่ช่างและช่วงเวลา หรือคลิกงานแล้วคลิกช่อง ระบบเทียบทักษะกับระบบงาน นับงานต่อวัน และแสดง SLA ที่เหลือ</p>
        </div>
        <div className="flex items-center gap-2">
        <ServiceSettingsButton />
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { key: "board", label: "ตารางงานช่าง" },
            { key: "van", label: "สต็อกอะไหล่ในรถ" },
          ]}
        />
        </div>
      </div>
      {tab === "board" ? <Board /> : <VanStockView />}
    </>
  );
}

function Board() {
  const repairs = useRepairs();
  const wos = useWorkOrders();
  const svc = woService.use();
  const s = useFieldSettings();
  const hydrated = useHydrated();
  const techs = useMemo(() => technicians(), []);
  const days = useMemo(() => dateRange(TODAY, addDays(TODAY, 6)), []);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [over, setOver] = useState<string>("");

  const withWo = useMemo(() => new Set(wos.filter((w) => w.status !== "cancelled").map((w) => w.repairId)), [wos]);
  const queue = useMemo(() => repairs.filter((r) => r.status !== "closed" && !withWo.has(r.id)).sort((a, b) => a.slaHours - b.slaHours), [repairs, withWo]);
  const open = useMemo(() => wos.filter((w) => OPEN.includes(w.status)), [wos]);
  const late = open.filter((w) => w.scheduled < TODAY);
  const load = useMemo(() => workload(open.map((w) => ({ id: w.id, tech: w.technician, date: w.scheduled }))), [open]);
  const slotOf = (w: OpsWorkOrder) => svc.find((x) => x.id === w.id)?.slot ?? "am";
  const repairOf = (w: OpsWorkOrder) => repairs.find((r) => r.id === w.repairId);
  const sysOf = (w: OpsWorkOrder): SystemKey => repairOf(w)?.system ?? "arch";
  const overloaded = Object.entries(load).flatMap(([t, d]) => Object.entries(d).filter(([day, n]) => day >= TODAY && n > s.maxJobsPerDay).map(([day]) => `${t} ${day}`));

  const drop = (tech: string, date: string, slot: "am" | "pm", d: Drag | null) => {
    if (!d) return;
    const t = techs.find((x) => x.name === tech);
    if (!skillMatch(d.system, t?.skill) && !window.confirm(`${tech} (${t?.skill ?? "-"}) ไม่ตรงกับงาน${SYSTEM_LABEL[d.system]} ยืนยันมอบหมาย`)) return;
    if (d.kind === "repair") assignRepair(d.id, tech, date, slot);
    else {
      const w = wos.find((x) => x.id === d.id);
      if (w) assignWorkOrder(w, tech, date, slot);
    }
    setDrag(null);
    setOver("");
  };

  const stats = {
    queue: queue.length,
    urgent: queue.filter((r) => r.severity === "high").length,
    today: open.filter((w) => w.scheduled === TODAY).length,
    late: late.length,
    sla: repairs.filter((r) => r.status !== "closed" && r.slaHours < 0).length,
  };

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="งานรอจัดช่าง" value={stats.queue} unit="เรื่อง" note={`ด่วน ${stats.urgent} เรื่อง`} tone={stats.urgent ? "neg" : undefined} />
        <StatCard label="งานวันนี้" value={stats.today} unit="ใบ" note={`ช่าง ${techs.length} คน · สูงสุด ${s.maxJobsPerDay} งาน/คน/วัน`} />
        <StatCard label="เลยวันนัด" value={stats.late} unit="ใบ" note="ยังไม่ปิดงาน ควรนัดใหม่" tone={stats.late ? "neg" : undefined} />
        <StatCard label="เกิน SLA" value={stats.sla} unit="เรื่อง" note={overloaded.length ? `ช่างงานล้น ${overloaded.length} วัน` : "ไม่มีช่างงานล้น"} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[300px_1fr]">
        <Card className="self-start">
          <CardHead title="งานรอจัดช่าง" meta={`${queue.length}`} />
          {queue.length === 0 ? (
            <Empty>ไม่มีงานค้างจัดช่าง</Empty>
          ) : (
            <ul className="flex max-h-[720px] flex-col gap-2 overflow-y-auto p-3">
              {queue.map((r) => (
                <QueueCard key={r.id} r={r} active={drag?.kind === "repair" && drag.id === r.id} onPick={() => setDrag(drag?.id === r.id ? null : { kind: "repair", id: r.id, system: r.system })} onDragStart={() => setDrag({ kind: "repair", id: r.id, system: r.system })} suggest={suggestTech(r.system, addDays(TODAY, r.severity === "high" ? 0 : 1), techs, open.map((w) => ({ id: w.id, tech: w.technician, date: w.scheduled })))} onAssign={(t) => assignRepair(r.id, t, addDays(TODAY, r.severity === "high" ? 0 : 1), "am")} />
              ))}
            </ul>
          )}
          {late.length > 0 && (
            <div className="border-t border-line p-3">
              <p className="mb-2 text-[13px] text-neg">เลยวันนัด · ลากไปวันใหม่</p>
              <ul className="flex flex-col gap-2">
                {late.map((w) => (
                  <WoChip key={w.id} w={w} sys={sysOf(w)} active={drag?.id === w.id} onPick={() => setDrag(drag?.id === w.id ? null : { kind: "wo", id: w.id, system: sysOf(w) })} onDragStart={() => setDrag({ kind: "wo", id: w.id, system: sysOf(w) })} showDate />
                ))}
              </ul>
            </div>
          )}
        </Card>

        <Card className="min-w-0">
          <CardHead title="ตารางช่าง 7 วัน" meta={drag ? "คลิกช่องเพื่อมอบหมาย" : "ลากหรือคลิกงานเพื่อเลือก"} action={drag && <Btn small onClick={() => setDrag(null)}>ยกเลิกการเลือก</Btn>} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] table-fixed border-collapse text-[12px]">
              <thead>
                <tr className="text-ink-3">
                  <th className="w-[180px] px-3 py-2 text-left font-normal">ช่าง</th>
                  {days.map((d) => (
                    <th key={d} className={cx("px-1 py-2 text-left font-normal", d === TODAY && "text-ink")}>
                      {d === TODAY ? "วันนี้" : thDate(d)}
                      <span className="ml-1 font-mono">({open.filter((w) => w.scheduled === d).length})</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {techs.map((t) => {
                  const match = drag ? skillMatch(drag.system, t.skill) : true;
                  return (
                    <tr key={t.id} className="border-t border-line align-top">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Initials name={t.name} />
                          <div className="min-w-0">
                            <p className="truncate text-[13px]">{t.name}</p>
                            <p className={cx("truncate", drag && !match ? "text-warn" : "text-ink-3")}>{t.skill}</p>
                          </div>
                        </div>
                      </td>
                      {days.map((d) => {
                        const n = load[t.name]?.[d] ?? 0;
                        const heavy = n > s.maxJobsPerDay;
                        return (
                          <td key={d} className={cx("px-1 py-1", heavy && "bg-neg-soft/50")}>
                            {(["am", "pm"] as const).map((slot) => {
                              const key = `${t.name}|${d}|${slot}`;
                              const jobs = open.filter((w) => w.technician === t.name && w.scheduled === d && slotOf(w) === slot);
                              return (
                                <div
                                  key={slot}
                                  onDragOver={(e) => {
                                    e.preventDefault();
                                    if (over !== key) setOver(key);
                                  }}
                                  onDragLeave={() => over === key && setOver("")}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    drop(t.name, d, slot, drag);
                                  }}
                                  onClick={() => drag && drop(t.name, d, slot, drag)}
                                  className={cx(
                                    "mb-1 min-h-[52px] rounded-[6px] border p-1 transition-colors",
                                    over === key ? "border-ink bg-raised" : drag ? (match ? "cursor-pointer border-dashed border-ink-3 hover:bg-raised" : "cursor-pointer border-dashed border-warn/60") : "border-line",
                                  )}
                                >
                                  <p className="mb-0.5 text-[11px] text-ink-3">{slot === "am" ? "เช้า" : "บ่าย"}</p>
                                  <div className="flex flex-col gap-1">
                                    {hydrated && jobs.map((w) => <WoChip key={w.id} w={w} sys={sysOf(w)} active={drag?.id === w.id} onPick={() => setDrag(drag?.id === w.id ? null : { kind: "wo", id: w.id, system: sysOf(w) })} onDragStart={() => setDrag({ kind: "wo", id: w.id, system: sysOf(w) })} />)}
                                  </div>
                                </div>
                              );
                            })}
                            {heavy && <p className="px-1 text-[11px] text-neg">{n} งาน เกินกำหนด</p>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <ProvinceList repairs={queue} wos={open} />
    </>
  );
}

function QueueCard({ r, active, onPick, onDragStart, suggest, onAssign }: { r: OpsRepair; active: boolean; onPick: () => void; onDragStart: () => void; suggest?: string; onAssign: (tech: string) => void }) {
  const p = getProject(r.projectId);
  return (
    <li
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", r.id);
        onDragStart();
      }}
      onClick={onPick}
      className={cx("cursor-grab rounded-[10px] border bg-card p-2.5 text-[13px] active:cursor-grabbing", active ? "border-ink" : "border-line hover:border-line-strong")}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium leading-snug">{r.title}</p>
        <Pill tone={SEV_TONE[r.severity]}>{SEVERITY_LABEL[r.severity]}</Pill>
      </div>
      <p className="mt-0.5 text-[12px] text-ink-3">
        {p?.name ?? r.projectId} · {p?.province}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <SystemPill s={r.system} />
        <span className={cx("num font-mono text-[12px]", r.slaHours < 0 ? "text-neg" : r.slaHours <= 24 ? "text-warn" : "text-ink-3")}>SLA {slaText(r.slaHours)}</span>
      </div>
      {suggest && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAssign(suggest);
          }}
          className="mt-2 inline-flex h-7 items-center gap-1 rounded-[6px] border border-line-strong px-2 text-[12px] text-ink-2 hover:bg-raised"
        >
          <Wrench size={12} strokeWidth={1.5} />
          ให้ {suggest} · {r.severity === "high" ? "วันนี้" : "พรุ่งนี้"}
        </button>
      )}
    </li>
  );
}

function WoChip({ w, sys, active, onPick, onDragStart, showDate }: { w: OpsWorkOrder; sys: SystemKey; active: boolean; onPick: () => void; onDragStart: () => void; showDate?: boolean }) {
  const p = getProject(w.projectId);
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.stopPropagation();
        e.dataTransfer.setData("text/plain", w.id);
        onDragStart();
      }}
      onClick={(e) => {
        e.stopPropagation();
        onPick();
      }}
      title={`${w.id} · ${w.title} · ${p?.name ?? ""}`}
      className={cx("cursor-grab rounded-[5px] border px-1.5 py-1 leading-tight", active ? "border-ink bg-raised" : "border-line bg-card", w.status === "in_progress" && "border-l-2 border-l-warn", w.status === "on_hold" && "border-l-2 border-l-accent")}
    >
      <Link href={`/work-orders/${w.id}`} onClick={(e) => e.stopPropagation()} className="block truncate hover:underline">
        {w.title}
      </Link>
      <span className="block truncate text-[11px] text-ink-3">
        {showDate ? `${thDate(w.scheduled)} · ${w.technician} · ` : ""}
        {SYSTEM_LABEL[sys]} · {p?.province}
      </span>
    </div>
  );
}

/** jobs grouped by province with a dot plot of site coordinates */
function ProvinceList({ repairs, wos }: { repairs: OpsRepair[]; wos: OpsWorkOrder[] }) {
  const items = useMemo(() => {
    const all = [
      ...repairs.map((r) => ({ id: r.id, title: r.title, projectId: r.projectId, kind: "รอจัดช่าง", tech: "" })),
      ...wos.map((w) => ({ id: w.id, title: w.title, projectId: w.projectId, kind: thDate(w.scheduled), tech: w.technician })),
    ];
    const by = new Map<string, typeof all>();
    for (const x of all) {
      const prov = getProject(x.projectId)?.province ?? "ไม่ระบุ";
      by.set(prov, [...(by.get(prov) ?? []), x]);
    }
    return [...by.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], "th"));
  }, [repairs, wos]);
  const pts = [...repairs.map((r) => ({ p: getProject(r.projectId), q: true })), ...wos.map((w) => ({ p: getProject(w.projectId), q: false }))].filter((x) => x.p?.lat !== undefined);
  const lats = pts.map((x) => x.p!.lat!);
  const lngs = pts.map((x) => x.p!.lng!);
  const [minLa, maxLa, minLo, maxLo] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const W = 260;
  const H = 300;
  const x = (lng: number) => 12 + ((lng - minLo) / Math.max(0.01, maxLo - minLo)) * (W - 24);
  const y = (lat: number) => 12 + (1 - (lat - minLa) / Math.max(0.01, maxLa - minLa)) * (H - 24);
  return (
    <Card className="mt-4">
      <CardHead title="งานตามจังหวัด" meta="เรียงตามจำนวนงาน เพื่อจัดเส้นทาง" />
      <div className="grid grid-cols-1 gap-4 p-5 lg:grid-cols-[280px_1fr]">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-[10px] border border-line bg-raised" role="img" aria-label="ตำแหน่งงานโดยประมาณ">
          {pts.map((pt, i) => (
            <circle key={i} cx={x(pt.p!.lng!)} cy={y(pt.p!.lat!)} r={4} className={pt.q ? "fill-neg" : "fill-ink"} opacity={0.75} />
          ))}
        </svg>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {items.map(([prov, list]) => (
            <div key={prov}>
              <p className="mb-1 text-[13px] font-medium">
                {prov} <span className="font-mono text-ink-3">{list.length}</span>
              </p>
              <ul className="flex flex-col gap-1 text-[13px]">
                {list.map((j) => (
                  <li key={j.id} className="flex justify-between gap-2 border-b border-line pb-1">
                    <span className="min-w-0 truncate">
                      {j.title}
                      <span className="text-ink-3"> · {getProject(j.projectId)?.name}</span>
                    </span>
                    <span className={cx("shrink-0 text-[12px]", j.tech ? "text-ink-3" : "text-neg")}>{j.tech ? `${j.tech.split(" ")[0]} ${j.kind}` : j.kind}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ---------- van stock ----------

function VanStockView() {
  const stock = vanStock.use();
  const moves = vanMoves.use();
  const techs = useMemo(() => technicians(), []);
  const low = lowStock(stock);
  const [adding, setAdding] = useState<string | null>(null);
  const value = stock.reduce((s, x) => s + x.qty * x.unitPrice, 0);
  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="รายการในรถทั้งหมด" value={stock.length} unit="รายการ" note={`ช่าง ${techs.length} คัน`} />
        <StatCard label="ต่ำกว่าขั้นต่ำ" value={low.length} unit="รายการ" tone={low.length ? "neg" : undefined} note="ควรเติมก่อนออกงาน" />
        <StatCard label="มูลค่าอะไหล่ในรถ" value={`฿${Math.round(value).toLocaleString("th-TH")}`} note="ตามราคาขาย" />
        <StatCard label="เบิกใช้ 30 วัน" value={moves.filter((m) => m.qty < 0 && m.date >= addDays(TODAY, -30)).length} unit="ครั้ง" />
      </div>
      {low.length > 0 && (
        <Card className="mb-4">
          <CardHead title="ต้องเติมสต็อก" meta={`${low.length} รายการ`} />
          <ul className="divide-y divide-line">
            {low.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-2 text-[13px]">
                <AlertTriangle {...I} className="text-warn" />
                <span className="min-w-0 flex-1">
                  {s.name} <span className="text-ink-3">· {s.tech}</span>
                </span>
                <span className="num font-mono">
                  เหลือ {s.qty} / ขั้นต่ำ {s.min} {s.unit}
                </span>
                <Btn small onClick={() => replenish(s.id, Math.max(1, s.min * 2 - s.qty))}>
                  เติม {Math.max(1, s.min * 2 - s.qty)} {s.unit}
                </Btn>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {techs.map((t) => {
          const mine = stock.filter((s) => s.tech === t.name);
          return (
            <Card key={t.id}>
              <CardHead
                title={t.name}
                meta={t.skill}
                action={
                  <Btn small onClick={() => setAdding(t.name)}>
                    <Plus {...I} />
                    เพิ่มรายการ
                  </Btn>
                }
              />
              {mine.length === 0 ? (
                <Empty>ยังไม่มีอะไหล่ในรถ</Empty>
              ) : (
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-left text-ink-3">
                      <th className="px-5 py-2 font-normal">รายการ</th>
                      <th className="py-2 pr-3 text-right font-normal">คงเหลือ</th>
                      <th className="py-2 pr-3 text-right font-normal">ขั้นต่ำ</th>
                      <th className="py-2 pr-3 text-right font-normal">ราคา</th>
                      <th className="py-2 pr-5 text-right font-normal">เติม</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mine.map((s) => (
                      <tr key={s.id} className="border-t border-line">
                        <td className="px-5 py-2">
                          {s.name}
                          <span className="block font-mono text-[11px] text-ink-3">{s.code}</span>
                        </td>
                        <td className={cx("num py-2 pr-3 text-right font-mono", s.qty <= s.min && "text-neg")}>
                          {s.qty} {s.unit}
                        </td>
                        <td className="num py-2 pr-3 text-right font-mono text-ink-3">{s.min}</td>
                        <td className="num py-2 pr-3 text-right font-mono">{s.unitPrice.toLocaleString("th-TH")}</td>
                        <td className="py-2 pr-5 text-right">
                          <ReplenishBtn id={s.id} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="border-t border-line px-5 py-3">
                <p className="mb-1 text-[12px] text-ink-3">ความเคลื่อนไหวล่าสุด</p>
                <ul className="flex flex-col gap-0.5 text-[12px]">
                  {moves
                    .filter((m) => m.tech === t.name)
                    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
                    .slice(0, 4)
                    .map((m) => (
                      <li key={m.id} className="flex justify-between gap-2">
                        <span className="min-w-0 truncate">
                          <span className="font-mono text-ink-3">{m.date}</span> {stock.find((s) => s.id === m.stockId)?.name ?? m.stockId} · {m.note}
                          {m.woId && <span className="font-mono text-ink-3"> {m.woId}</span>}
                        </span>
                        <span className={cx("num font-mono", m.qty < 0 ? "text-ink-2" : "text-pos")}>{m.qty > 0 ? `+${m.qty}` : m.qty}</span>
                      </li>
                    ))}
                </ul>
              </div>
            </Card>
          );
        })}
      </div>
      {adding && <AddVanItem tech={adding} onClose={() => setAdding(null)} />}
    </>
  );
}

function ReplenishBtn({ id }: { id: string }) {
  const [q, setQ] = useState("");
  return (
    <span className="inline-flex items-center gap-1">
      <input value={q} onChange={(e) => setQ(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" aria-label="จำนวนที่เติม" className={cx(inputCls, "num h-7 w-14 px-2 text-right font-mono text-[12px]")} />
      <Btn
        small
        disabled={!Number(q)}
        onClick={() => {
          replenish(id, Number(q));
          setQ("");
        }}
      >
        +
      </Btn>
    </span>
  );
}

function AddVanItem({ tech, onClose }: { tech: string; onClose: () => void }) {
  const [f, setF] = useState({ code: "", name: "", unit: "ชิ้น", qty: "0", min: "1", unitPrice: "0" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const ok = f.code.trim() && f.name.trim();
  return (
    <Modal
      open
      onClose={onClose}
      title={`เพิ่มอะไหล่ในรถ · ${tech}`}
      width={520}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn
            primary
            disabled={!ok}
            onClick={() => {
              addVanItem({ tech, code: f.code.trim(), name: f.name.trim(), unit: f.unit.trim() || "ชิ้น", qty: Number(f.qty) || 0, min: Number(f.min) || 0, unitPrice: Number(f.unitPrice) || 0 });
              onClose();
            }}
          >
            บันทึก
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="รหัส">
          <input className={inputCls} value={f.code} onChange={set("code")} />
        </Field>
        <Field label="หน่วย">
          <input className={inputCls} value={f.unit} onChange={set("unit")} />
        </Field>
        <div className="col-span-2">
          <Field label="ชื่ออะไหล่">
            <input className={inputCls} value={f.name} onChange={set("name")} />
          </Field>
        </div>
        <Field label="จำนวนเริ่มต้น">
          <input className={inputCls} inputMode="numeric" value={f.qty} onChange={set("qty")} />
        </Field>
        <Field label="ขั้นต่ำ">
          <input className={inputCls} inputMode="numeric" value={f.min} onChange={set("min")} />
        </Field>
        <Field label="ราคาขาย/หน่วย">
          <input className={inputCls} inputMode="decimal" value={f.unitPrice} onChange={set("unitPrice")} />
        </Field>
      </div>
    </Modal>
  );
}

