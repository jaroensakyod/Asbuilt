"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarPlus, Gauge, Pencil, Plus, ShieldCheck, Wrench } from "lucide-react";
import { AssetTag, Card, CardHead, cx } from "@/components/ui";
import { Btn, Empty, I, KV, Pill, StatCard, useHydrated } from "@/components/ops/bits";
import { tableCls, td, tdR, th, thR } from "@/components/accounting/bits";
import { MediaField } from "@/components/media/media-field";
import { baht0, COST_CODES, costEntries, money } from "@/lib/biz";
import { thDate, TODAY } from "@/lib/data";
import { trainings } from "@/lib/hr/labour-store";
import { CERT_LABEL } from "@/lib/hr/labour-types";
import { certStates, clashes, hoursToService, plantCostId, usageCost } from "@/lib/plant/calc";
import { plantBookings, plantCerts, plantMaint, plants, plantUsage, usePlantSettings } from "@/lib/plant/store";
import { BASIS_LABEL, CERT_KIND_LABEL, MAINT_LABEL, OPERATOR_CERT, PLANT_STATUS_LABEL, PLANT_TYPE_LABEL } from "@/lib/plant/types";
import { CERT_STATE_LABEL, CERT_TONE, fmtNum, operatorWarn, PlantForm, siteName, STATUS_TONE, usageFlagged, usePlantAccess } from "./bits";
import { CertForm, CertTable, lastServiceHours, MaintForm } from "./maint-certs";
import { costEntryFor, UsageForm } from "./usage";

export function PlantDetail({ id }: { id: string }) {
  const list = plants.use();
  const hydrated = useHydrated();
  const p = list.find((x) => x.id === id);
  if (!p)
    return (
      <Card>
        <Empty>{hydrated ? `ไม่พบเครื่องจักร ${id}` : "กำลังโหลด"}</Empty>
        <div className="flex justify-center pb-8">
          <Link href="/plant" className="text-[13px] text-ink-2 underline underline-offset-2 hover:text-ink">
            กลับไปทะเบียนเครื่องจักร
          </Link>
        </div>
      </Card>
    );
  return <Detail id={p.id} />;
}

function Detail({ id }: { id: string }) {
  const p = plants.use().find((x) => x.id === id)!;
  const certs = plantCerts.use();
  const bookings = plantBookings.use();
  const usage = plantUsage.use();
  const maint = plantMaint.use();
  const trn = trainings.use();
  const entries = costEntries.use();
  const s = usePlantSettings();
  const { edit } = usePlantAccess();
  const hydrated = useHydrated();
  const [editing, setEditing] = useState(false);
  const [modal, setModal] = useState<"usage" | "maint" | "cert" | null>(null);

  const states = certStates(p, certs, TODAY, s);
  const myCerts = certs.filter((c) => c.plantId === p.id).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  const myBookings = bookings.filter((b) => b.plantId === p.id && b.status === "booked").sort((a, b) => b.from.localeCompare(a.from));
  const myUsage = usage.filter((u) => u.plantId === p.id).sort((a, b) => b.date.localeCompare(a.date));
  const myMaint = maint.filter((m) => m.plantId === p.id).sort((a, b) => b.date.localeCompare(a.date));
  const period = TODAY.slice(0, 7);
  const projectsThisMonth = [...new Set(myUsage.filter((u) => u.date.startsWith(period)).map((u) => u.projectId))];
  const monthCost = projectsThisMonth.map((pid) => usageCost(p, usage, pid, period, s));
  const flagged = myUsage.filter((u) => usageFlagged(u, p, trn));
  const toService = hoursToService(p, lastServiceHours(p, maint));

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4 pb-6">
        <div>
          <Link href="/plant" className="mb-2 inline-flex items-center gap-1.5 text-[13px] text-ink-2 hover:text-ink">
            <ArrowLeft {...I} />
            ทะเบียนเครื่องจักร
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <AssetTag code={p.id} />
            <h1 className="text-[28px] font-normal leading-tight">{p.name}</h1>
            <Pill tone={STATUS_TONE[p.status]}>{PLANT_STATUS_LABEL[p.status]}</Pill>
            {p.ownership === "rented" ? <Pill tone="accent">เช่า</Pill> : <Pill>ของบริษัท</Pill>}
          </div>
          <p className="mt-1 text-ink-2">
            {PLANT_TYPE_LABEL[p.type]}
            {p.make ? ` · ${p.make} ${p.model ?? ""}` : ""} · {p.projectId ? `อยู่ที่ ${siteName(p.projectId)}` : "ไม่อยู่หน้างาน"}
          </p>
        </div>
        {edit && (
          <div className="flex flex-wrap gap-2">
            <Btn small onClick={() => setModal("usage")}>
              <Gauge {...I} />
              บันทึกการใช้งาน
            </Btn>
            <Btn small onClick={() => setModal("maint")}>
              <Wrench {...I} />
              แจ้งเสีย/ซ่อมบำรุง
            </Btn>
            <Btn small onClick={() => setModal("cert")}>
              <ShieldCheck {...I} />
              บันทึกใบรับรอง
            </Btn>
            <Btn small primary onClick={() => setEditing(true)}>
              <Pencil {...I} />
              แก้ไข
            </Btn>
          </div>
        )}
      </div>

      {flagged.length > 0 && (
        <p className="mb-4 rounded-[10px] bg-neg-soft px-4 py-2.5 text-[13px] text-neg">
          {operatorWarn(p)} {flagged.length} วัน ล่าสุด {thDate(flagged[0].date)} ({flagged[0].operatorName}) ตรวจสอบใน ทักษะ & ใบรับรอง
        </p>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="ใช้งานเดือนนี้" value={fmtNum(monthCost.reduce((t, c) => t + c.hours, 0))} unit="ชม." note={`${monthCost.reduce((t, c) => t + c.days, 0)} วัน · น้ำมัน ${fmtNum(monthCost.reduce((t, c) => t + c.fuelL, 0))} ลิตร`} />
        <StatCard label="ต้นทุนเดือนนี้" value={baht0(monthCost.reduce((t, c) => t + c.total, 0))} note={`${fmtNum(p.rate)} บาท/${BASIS_LABEL[p.rateBasis]}`} />
        <StatCard label="ชั่วโมงเครื่อง" value={p.meterHours !== undefined ? fmtNum(p.meterHours) : "-"} note={toService !== undefined ? (toService <= 0 ? `เกินรอบบำรุง ${fmtNum(-toService)} ชม.` : `อีก ${fmtNum(toService)} ชม. ถึงรอบบำรุง`) : "บำรุงตามวันนัด"} tone={toService !== undefined && toService <= 0 ? "neg" : undefined} />
        <StatCard label="การจอง" value={myBookings.filter((b) => b.to >= TODAY).length} unit="รายการ" note="ปัจจุบันและล่วงหน้า" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHead title="ใบรับรอง" meta={states.length ? `${states.length} ประเภทที่ต้องมี` : "ไม่ต้องมีใบรับรอง"} />
            {states.length > 0 && (
              <ul className="border-b border-line">
                {states.map((c) => (
                  <li key={c.kind} className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-2.5 text-[13px] last:border-0">
                    <span className="min-w-0 flex-1">{CERT_KIND_LABEL[c.kind]}</span>
                    {c.cert && <span className="text-ink-3">ถึง {thDate(c.cert.expiry)}</span>}
                    <Pill tone={CERT_TONE[c.state]}>
                      {CERT_STATE_LABEL[c.state]}
                      {c.daysLeft !== undefined && <span className="ml-1 font-mono">{c.daysLeft} วัน</span>}
                    </Pill>
                  </li>
                ))}
              </ul>
            )}
            {myCerts.length ? <CertTable certs={myCerts} /> : <Empty>ยังไม่มีประวัติใบรับรอง</Empty>}
          </Card>

          <Card>
            <CardHead title="การใช้งานล่าสุด" meta={`${Math.min(30, myUsage.length)} จาก ${myUsage.length} วัน`} />
            {myUsage.length ? (
              <div className="overflow-x-auto">
                <table className={cx(tableCls, "min-w-[640px]")}>
                  <thead>
                    <tr>
                      <th className={cx(th, "pl-5")}>วันที่</th>
                      <th className={th}>หน้างาน</th>
                      <th className={thR}>ชม.</th>
                      <th className={thR}>น้ำมัน</th>
                      <th className={cx(th, "pr-5")}>ผู้ควบคุม</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myUsage.slice(0, 30).map((u) => (
                      <tr key={u.id}>
                        <td className={cx(td, "pl-5 whitespace-nowrap")}>{thDate(u.date)}</td>
                        <td className={td}>{siteName(u.projectId)}</td>
                        <td className={tdR}>
                          <span className="num font-mono">{u.hours}</span>
                        </td>
                        <td className={tdR}>
                          <span className="num font-mono">{u.fuelL || ""}</span>
                        </td>
                        <td className={cx(td, "pr-5")}>
                          {u.operatorName}
                          {usageFlagged(u, p, trn) && (
                            <span className="ml-2">
                              <Pill tone="neg">ไม่มีใบรับรอง</Pill>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>ยังไม่มีบันทึกการใช้งาน</Empty>
            )}
          </Card>

          <Card>
            <CardHead title="ซ่อมบำรุง" meta={`${myMaint.length} รายการ`} />
            {myMaint.length ? (
              <ul>
                {myMaint.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-2.5 text-[13px] last:border-0">
                    <Pill tone={m.doneAt ? "neutral" : m.kind === "service" ? "warn" : "neg"}>{MAINT_LABEL[m.kind]}</Pill>
                    <span className="min-w-0 flex-1">
                      {m.title}
                      <span className="block text-[12px] text-ink-3">
                        {thDate(m.date)}
                        {m.doneAt ? ` · เสร็จ ${thDate(m.doneAt)}` : " · ยังไม่เสร็จ"}
                        {m.meterHours !== undefined ? ` · ${fmtNum(m.meterHours)} ชม.` : ""}
                      </span>
                    </span>
                    {m.cost ? <span className="num font-mono">{money(m.cost)}</span> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>ไม่มีประวัติซ่อมบำรุง</Empty>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHead title="ข้อมูลเครื่องจักร" />
            <div className="px-5 py-3">
              <KV k="ประเภท">{PLANT_TYPE_LABEL[p.type]}</KV>
              <KV k="ยี่ห้อ/รุ่น">{[p.make, p.model].filter(Boolean).join(" ") || "-"}</KV>
              <KV k="หมายเลขเครื่อง">
                <span className="font-mono">{p.serial ?? "-"}</span>
              </KV>
              {p.capacityT !== undefined && <KV k="พิกัดยก">{p.capacityT} ตัน</KV>}
              {p.heightM !== undefined && <KV k="ความสูง">{p.heightM} ม.</KV>}
              <KV k="กรรมสิทธิ์">{p.ownership === "rented" ? `เช่าจาก ${p.supplier ?? "-"}` : "ของบริษัท"}</KV>
              {p.onHire && <KV k="ช่วงเช่า">{`${thDate(p.onHire)}${p.offHire ? ` – ${thDate(p.offHire)}` : ""}`}</KV>}
              <KV k="อัตรา">
                <span className="num font-mono">{fmtNum(p.rate)}</span> บาท/{BASIS_LABEL[p.rateBasis]} (ไม่รวม VAT)
              </KV>
              <KV k="รหัสต้นทุน">
                {p.costCode} · {COST_CODES[p.costCode]}
              </KV>
              <KV k="ผู้ควบคุม">{OPERATOR_CERT[p.type] ? `ต้องมี ${CERT_LABEL[OPERATOR_CERT[p.type]!]}` : "ไม่ต้องมีใบรับรองเฉพาะ"}</KV>
              {p.note && <KV k="หมายเหตุ">{p.note}</KV>}
            </div>
            <div className="border-t border-line px-5 py-3">
              {edit ? <MediaField value={p.photos} onChange={(photos) => plants.upsert({ ...p, photos })} label="รูปเครื่องจักร" photosOnly /> : <p className="text-[13px] text-ink-3">{p.photos.length} รูป</p>}
            </div>
          </Card>

          <Card>
            <CardHead title="ต้นทุนเดือนนี้" meta={TODAY.slice(0, 7)} />
            {monthCost.length ? (
              <ul>
                {monthCost.map((c) => {
                  const e = hydrated ? entries.find((x) => x.id === plantCostId(c)) : undefined;
                  const posted = e && Math.abs(e.amount - c.total) < 0.01;
                  return (
                    <li key={c.projectId} className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-2.5 text-[13px] last:border-0">
                      <span className="min-w-0 flex-1">
                        {siteName(c.projectId)}
                        <span className="block font-mono text-[12px] text-ink-3">
                          {fmtNum(c.hours)} ชม. · {c.days} วัน · {money(c.hire)} + น้ำมัน {money(c.fuel)}
                        </span>
                      </span>
                      <span className="num font-mono">{money(c.total)}</span>
                      {posted ? (
                        <Pill tone="pos">ลงแล้ว</Pill>
                      ) : (
                        edit &&
                        c.total > 0 && (
                          <Btn small onClick={() => costEntries.upsert(costEntryFor(c, p))}>
                            {e ? "ลงใหม่" : "ลงต้นทุน"}
                          </Btn>
                        )
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Empty>ยังไม่มีการใช้งานเดือนนี้</Empty>
            )}
          </Card>

          <Card>
            <CardHead
              title="การจอง"
              action={
                <Link href={`/plant?tab=bookings&plant=${p.id}`} className="inline-flex items-center gap-1.5 text-[13px] text-ink-2 hover:text-ink">
                  <CalendarPlus {...I} />
                  ปฏิทิน
                </Link>
              }
            />
            {myBookings.length ? (
              <ul>
                {myBookings.slice(0, 10).map((b) => {
                  const c = clashes(b, bookings);
                  return (
                    <li key={b.id} className="border-b border-line px-5 py-2.5 text-[13px] last:border-0">
                      <span className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate">{siteName(b.projectId)}</span>
                        {c.length > 0 && <Pill tone="neg">ซ้อน</Pill>}
                        {b.to < TODAY && <span className="text-[12px] text-ink-3">ผ่านแล้ว</span>}
                      </span>
                      <span className="block text-[12px] text-ink-3">
                        {thDate(b.from)}
                        {b.to !== b.from && ` – ${thDate(b.to)}`} · {b.purpose}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Empty>ไม่มีการจอง</Empty>
            )}
            {edit && (
              <div className="border-t border-line px-5 py-2.5">
                <Link href={`/plant?tab=bookings&plant=${p.id}`} className="inline-flex items-center gap-1.5 text-[13px] text-ink-2 hover:text-ink">
                  <Plus {...I} />
                  จองเพิ่มในปฏิทิน
                </Link>
              </div>
            )}
          </Card>
        </div>
      </div>

      {editing && <PlantForm plant={p} onClose={() => setEditing(false)} />}
      {modal === "usage" && <UsageForm plantId={p.id} onClose={() => setModal(null)} />}
      {modal === "maint" && <MaintForm init={{ plantId: p.id, kind: "breakdown", date: TODAY, meterHours: p.meterHours }} onClose={() => setModal(null)} />}
      {modal === "cert" && <CertForm plantId={p.id} onClose={() => setModal(null)} />}
    </>
  );
}
