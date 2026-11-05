"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { AssetTag, Card, cx, inputCls, PageHeader } from "@/components/ui";
import { Btn, Empty, FilterField, I, Pill, Select, StatCard } from "@/components/ops/bits";
import { tableCls, td, tdR, th, thR } from "@/components/accounting/bits";
import { SubTabs } from "@/components/hr/bits";
import { baht0 } from "@/lib/biz";
import { TODAY } from "@/lib/data";
import { ACTIVE_SITES } from "@/lib/hr/seed";
import { CERT_SHORT } from "@/lib/hr/labour-types";
import { certStates, doubleBookings, monthCosts } from "@/lib/plant/calc";
import { plantBookings, plantCerts, plants, plantUsage, usePlantSettings } from "@/lib/plant/store";
import { BASIS_LABEL, OPERATOR_CERT, PLANT_STATUS_LABEL, PLANT_TYPE_LABEL, type PlantStatus, type PlantType } from "@/lib/plant/types";
import { CertPill, fmtNum, PlantForm, siteName, STATUS_TONE, STATUSES, TYPES, usePlantAccess } from "./bits";
import { BookingsTab } from "./bookings";
import { UsageTab } from "./usage";
import { CertsTab, MaintTab } from "./maint-certs";

type Tab = "register" | "bookings" | "usage" | "maint" | "certs";

export function PlantView() {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const tab = (params.get("tab") as Tab | null) ?? "register";
  const focusPlant = params.get("plant") ?? "";
  const setTab = (t: Tab) => router.replace(t === "register" ? path : `${path}?tab=${t}`, { scroll: false });

  const list = plants.use();
  const certs = plantCerts.use();
  const bookings = plantBookings.use();
  const usage = plantUsage.use();
  const s = usePlantSettings();
  const { edit } = usePlantAccess();
  const [creating, setCreating] = useState(false);

  const stats = useMemo(() => {
    const live = list.filter((p) => p.status !== "off_hired");
    const states = live.flatMap((p) => certStates(p, certs, TODAY, s));
    const dup = doubleBookings(bookings).filter(([a, b]) => a.to >= TODAY || b.to >= TODAY);
    const month = monthCosts(list, usage, TODAY.slice(0, 7), s).reduce((t, c) => t + c.total, 0);
    return {
      onSite: live.filter((p) => p.status === "on_site").length,
      total: live.length,
      rented: live.filter((p) => p.ownership === "rented").length,
      expiring: states.filter((x) => x.state === "expiring").length,
      bad: states.filter((x) => x.state === "expired" || x.state === "missing").length,
      dup: dup.length,
      down: live.filter((p) => p.status === "breakdown" || p.status === "maintenance").length,
      month,
    };
  }, [list, certs, bookings, usage, s]);

  return (
    <>
      <PageHeader
        eyebrow="หน้างาน"
        title="เครื่องจักร & อุปกรณ์"
        sub="ทะเบียนเครื่องจักรของบริษัทและที่เช่า ตารางจองตามหน้างาน บันทึกชั่วโมงใช้งานและน้ำมัน ต้นทุนเครื่องจักรรายเดือนลงโครงการ การซ่อมบำรุง และใบรับรองปั้นจั่น/นั่งร้าน"
        actions={
          edit && (
            <Btn primary onClick={() => setCreating(true)}>
              <Plus {...I} />
              เพิ่มเครื่องจักร
            </Btn>
          )
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="อยู่หน้างาน" value={stats.onSite} unit={`/ ${stats.total}`} note={`เช่า ${stats.rented} · ของบริษัท ${stats.total - stats.rented}`} onClick={() => setTab("register")} active={tab === "register"} />
        <StatCard label="ใบรับรองใกล้หมด" value={stats.expiring} unit="ฉบับ" note={stats.bad ? `หมดอายุ/ไม่มี ${stats.bad}` : "ภายใน 30 วัน"} tone={stats.bad ? "neg" : undefined} onClick={() => setTab("certs")} active={tab === "certs"} />
        <StatCard label="จองซ้อนกัน" value={stats.dup} unit="คู่" note="เครื่องเดียวกัน วันทับกัน" tone={stats.dup ? "neg" : undefined} onClick={() => setTab("bookings")} active={tab === "bookings"} />
        <StatCard label="เสีย/ซ่อมบำรุง" value={stats.down} unit="เครื่อง" onClick={() => setTab("maint")} active={tab === "maint"} />
        <StatCard label="ต้นทุนเดือนนี้" value={baht0(stats.month)} note="ค่าเช่า/อัตราภายใน + น้ำมัน" onClick={() => setTab("usage")} active={tab === "usage"} />
      </div>
      <div className="mb-5">
        <SubTabs
          value={tab}
          onChange={setTab}
          options={[
            { key: "register", label: "ทะเบียน", count: list.length },
            { key: "bookings", label: "ปฏิทินจอง", count: stats.dup || undefined },
            { key: "usage", label: "บันทึกการใช้งาน & ต้นทุน" },
            { key: "maint", label: "ซ่อมบำรุง", count: stats.down || undefined },
            { key: "certs", label: "ใบรับรอง", count: stats.expiring + stats.bad || undefined },
          ]}
        />
      </div>
      {tab === "register" && <Register />}
      {tab === "bookings" && <BookingsTab focusPlant={focusPlant} />}
      {tab === "usage" && <UsageTab />}
      {tab === "maint" && <MaintTab />}
      {tab === "certs" && <CertsTab />}
      {creating && <PlantForm onClose={() => setCreating(false)} onSaved={(id) => router.push(`/plant/${id}`)} />}
    </>
  );
}

function Register() {
  const list = plants.use();
  const certs = plantCerts.use();
  const s = usePlantSettings();
  const [type, setType] = useState("");
  const [site, setSite] = useState("");
  const [own, setOwn] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const rows = list.filter(
    (p) =>
      (!type || p.type === type) &&
      (!site || (site === "-" ? !p.projectId : p.projectId === site)) &&
      (!own || p.ownership === own) &&
      (!status || p.status === status) &&
      (!q || `${p.id} ${p.name} ${p.make ?? ""} ${p.model ?? ""} ${p.serial ?? ""} ${p.supplier ?? ""}`.toLowerCase().includes(q.toLowerCase())),
  );
  return (
    <Card>
      <div className="grid grid-cols-2 gap-3 border-b border-line px-5 py-4 md:grid-cols-5">
        <FilterField label="ค้นหา" className="col-span-2 md:col-span-1">
          <div className="relative">
            <Search {...I} className="pointer-events-none absolute left-2.5 top-2.5 text-ink-3" />
            <input className={cx(inputCls, "w-full pl-8")} value={q} onChange={(e) => setQ(e.target.value)} placeholder="รหัส ชื่อ ยี่ห้อ" />
          </div>
        </FilterField>
        <FilterField label="ประเภท">
          <Select label="ประเภท" value={type} onChange={setType}>
            <option value="">ทุกประเภท</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {PLANT_TYPE_LABEL[t as PlantType]}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="หน้างาน">
          <Select label="หน้างาน" value={site} onChange={setSite}>
            <option value="">ทุกหน้างาน</option>
            <option value="-">ไม่อยู่หน้างาน</option>
            {ACTIVE_SITES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} · {p.name}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="กรรมสิทธิ์">
          <Select label="กรรมสิทธิ์" value={own} onChange={setOwn}>
            <option value="">ทั้งหมด</option>
            <option value="owned">ของบริษัท</option>
            <option value="rented">เช่า</option>
          </Select>
        </FilterField>
        <FilterField label="สถานะ">
          <Select label="สถานะ" value={status} onChange={setStatus}>
            <option value="">ทุกสถานะ</option>
            {STATUSES.map((x) => (
              <option key={x} value={x}>
                {PLANT_STATUS_LABEL[x as PlantStatus]}
              </option>
            ))}
          </Select>
        </FilterField>
      </div>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className={cx(tableCls, "min-w-[980px]")}>
            <thead>
              <tr>
                <th className={cx(th, "pl-5")}>รหัส</th>
                <th className={th}>เครื่องจักร</th>
                <th className={th}>กรรมสิทธิ์</th>
                <th className={th}>หน้างาน</th>
                <th className={thR}>อัตรา</th>
                <th className={th}>สถานะ</th>
                <th className={th}>ใบรับรอง</th>
                <th className={cx(th, "pr-5")}>ผู้ควบคุม</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className={cx(td, "pl-5")}>
                    <AssetTag code={p.id} href={`/plant/${p.id}`} />
                  </td>
                  <td className={td}>
                    <span className="block">{p.name}</span>
                    <span className="text-[12px] text-ink-3">
                      {PLANT_TYPE_LABEL[p.type]}
                      {p.capacityT ? ` · ${p.capacityT} ตัน` : ""}
                      {p.heightM ? ` · สูง ${p.heightM} ม.` : ""}
                      {p.make ? ` · ${p.make} ${p.model ?? ""}` : ""}
                    </span>
                  </td>
                  <td className={td}>
                    {p.ownership === "rented" ? <Pill tone="accent">เช่า</Pill> : <Pill>ของบริษัท</Pill>}
                    {p.supplier && <span className="mt-0.5 block text-[12px] text-ink-3">{p.supplier}</span>}
                  </td>
                  <td className={td}>
                    {p.projectId ? (
                      <>
                        <span className="block">{siteName(p.projectId)}</span>
                        <span className="font-mono text-[12px] text-ink-3">{p.projectId}</span>
                      </>
                    ) : (
                      <span className="text-ink-3">-</span>
                    )}
                  </td>
                  <td className={tdR}>
                    <span className="num font-mono">{fmtNum(p.rate)}</span>
                    <span className="block text-[12px] text-ink-3">บาท/{BASIS_LABEL[p.rateBasis]}</span>
                  </td>
                  <td className={td}>
                    <Pill tone={STATUS_TONE[p.status]}>{PLANT_STATUS_LABEL[p.status]}</Pill>
                  </td>
                  <td className={td}>
                    <CertPill states={certStates(p, certs, TODAY, s)} />
                  </td>
                  <td className={cx(td, "pr-5 text-[12px] text-ink-2")}>{OPERATOR_CERT[p.type] ? `ต้องมี ${CERT_SHORT[OPERATOR_CERT[p.type]!]}` : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>ไม่พบเครื่องจักรตามเงื่อนไข</Empty>
      )}
      <p className="border-t border-line px-5 py-2.5 text-[12px] text-ink-3">{rows.length} รายการ · อัตราไม่รวม VAT · เครื่องที่ต้องมีผู้ควบคุมมีใบรับรองตรวจจาก ทักษะ & ใบรับรอง</p>
    </Card>
  );
}
