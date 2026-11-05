"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Pencil, Plus, Search } from "lucide-react";
import { Card, CardHead, cx, inputCls, PageHeader, Status } from "@/components/ui";
import { Btn, Empty, FilterField, I, KV, Pill, Select, StatCard } from "@/components/ops/bits";
import { daysBetween, thDate, TODAY } from "@/lib/data";
import { annualPit, monthlyWht, ssoMonthly } from "@/lib/hr/calc";
import { ACTIVE_SITES } from "@/lib/hr/seed";
import { attendance, employees, useHrSettings, useRuns } from "@/lib/hr/store";
import { EMP_STATUS_LABEL, EMP_TYPE_LABEL, NATIONALITY_LABEL, type EmpStatus, type EmpType, type Employee, type Nationality } from "@/lib/hr/types";
import { Drawer, fmt, fmt0, HrTabs, maskAccount, maskId, Section, siteName, STATUS_TONE, useHrAccess } from "./bits";
import { EmployeeForm } from "./employee-form";

const PERMIT_ALERT_DAYS = 60;

export function EmployeesView() {
  const list = employees.use();
  const { showPay, edit } = useHrAccess();
  const [q, setQ] = useState("");
  const [type, setType] = useState<"" | EmpType>("");
  const [site, setSite] = useState("");
  const [status, setStatus] = useState<"" | EmpStatus | "current">("current");
  const [nat, setNat] = useState<"" | Nationality>("");
  const [permitOnly, setPermitOnly] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState<{ initial?: Employee; type?: EmpType } | null>(null);

  const current = list.filter((e) => e.status !== "resigned");
  const permitDue = list
    .filter((e) => e.status !== "resigned" && e.workPermitExpiry && daysBetween(TODAY, e.workPermitExpiry) <= PERMIT_ALERT_DAYS)
    .sort((a, b) => a.workPermitExpiry!.localeCompare(b.workPermitExpiry!));

  const needle = q.trim().toLowerCase();
  const rows = list.filter(
      (e) =>
        (!type || e.type === type) &&
        (!site || (site === "office" ? !e.projectId : e.projectId === site)) &&
        (!status || (status === "current" ? e.status !== "resigned" : e.status === status)) &&
        (!nat || e.nationality === nat) &&
        (!permitOnly || permitDue.includes(e)) &&
      (!needle || [e.id, e.name, e.position, e.skill ?? "", e.idNo.slice(-4)].some((s) => s.toLowerCase().includes(needle))),
  );

  const monthlyCount = current.filter((e) => e.type === "monthly").length;
  const daily = current.filter((e) => e.type === "daily");
  const crews = current.filter((e) => e.type === "subcontract");
  const payroll = current.filter((e) => e.type === "monthly").reduce((s, e) => s + (e.salary ?? 0) + (e.allowance ?? 0), 0);
  const dailyBill = daily.reduce((s, e) => s + (e.dailyRate ?? 0), 0);

  const open = list.find((e) => e.id === openId);

  return (
    <>
      <PageHeader
        eyebrow="บุคคล"
        title="พนักงาน"
        sub="พนักงานรายเดือน คนงานรายวันประจำหน้างาน และทีมผู้รับเหมาค่าแรง พร้อมใบอนุญาตทำงานของแรงงานต่างด้าว"
        actions={
          edit && (
            <Btn primary onClick={() => setForm({ type: "daily" })}>
              <Plus {...I} />
              เพิ่มพนักงาน
            </Btn>
          )
        }
      />
      <HrTabs />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="พนักงานรายเดือน" value={monthlyCount} unit="คน" note={showPay ? `เงินเดือนรวม ฿${fmt0(payroll)}/เดือน` : undefined} active={type === "monthly"} onClick={() => setType(type === "monthly" ? "" : "monthly")} />
        <StatCard label="คนงานรายวัน" value={daily.length} unit="คน" note={showPay ? `ค่าแรงรวม ฿${fmt0(dailyBill)}/วัน` : `${ACTIVE_SITES.length} หน้างาน`} active={type === "daily"} onClick={() => setType(type === "daily" ? "" : "daily")} />
        <StatCard label="แรงงานต่างด้าว" value={daily.filter((e) => e.nationality !== "TH").length} unit="คน" note="เมียนมา กัมพูชา ลาว" active={nat === "MM"} onClick={() => setNat(nat ? "" : "MM")} />
        <StatCard label="ทีมผู้รับเหมาค่าแรง" value={crews.length} unit="ทีม" note={`${crews.reduce((s, c) => s + (c.crewSize ?? 0), 0)} คน · ไม่ใช่ลูกจ้าง`} active={type === "subcontract"} onClick={() => setType(type === "subcontract" ? "" : "subcontract")} />
        <StatCard label="ใบอนุญาตทำงานใกล้หมด" value={permitDue.length} unit="คน" note={`ภายใน ${PERMIT_ALERT_DAYS} วัน`} tone={permitDue.length ? "neg" : undefined} active={permitOnly} onClick={() => setPermitOnly((v) => !v)} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_380px]">
        <Card>
          <div className="flex flex-wrap items-end gap-3 border-b border-line px-5 py-4">
            <FilterField label="ค้นหา" className="min-w-[200px] flex-1">
              <div className="relative">
                <Search {...I} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
                <input className={cx(inputCls, "w-full pl-9")} placeholder="ชื่อ รหัส ตำแหน่ง" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
            </FilterField>
            <FilterField label="ประเภท" className="w-[170px]">
              <Select label="ประเภท" value={type} onChange={(v) => setType(v as EmpType | "")}>
                <option value="">ทั้งหมด</option>
                {(Object.keys(EMP_TYPE_LABEL) as EmpType[]).map((t) => (
                  <option key={t} value={t}>
                    {EMP_TYPE_LABEL[t]}
                  </option>
                ))}
              </Select>
            </FilterField>
            <FilterField label="โครงการ" className="w-[220px]">
              <Select label="โครงการ" value={site} onChange={setSite}>
                <option value="">ทุกโครงการ</option>
                <option value="office">สำนักงาน</option>
                {ACTIVE_SITES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id} · {p.name}
                  </option>
                ))}
              </Select>
            </FilterField>
            <FilterField label="สถานะ" className="w-[150px]">
              <Select label="สถานะ" value={status} onChange={(v) => setStatus(v as EmpStatus | "current" | "")}>
                <option value="current">ปัจจุบัน</option>
                <option value="">ทั้งหมด</option>
                {(Object.keys(EMP_STATUS_LABEL) as EmpStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {EMP_STATUS_LABEL[s]}
                  </option>
                ))}
              </Select>
            </FilterField>
            <FilterField label="สัญชาติ" className="w-[120px]">
              <Select label="สัญชาติ" value={nat} onChange={(v) => setNat(v as Nationality | "")}>
                <option value="">ทั้งหมด</option>
                {(Object.keys(NATIONALITY_LABEL) as Nationality[]).map((n) => (
                  <option key={n} value={n}>
                    {NATIONALITY_LABEL[n]}
                  </option>
                ))}
              </Select>
            </FilterField>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-ink-3">
                  <th className="px-5 py-2.5 font-normal">รหัส</th>
                  <th className="px-3 py-2.5 font-normal">ชื่อ</th>
                  <th className="px-3 py-2.5 font-normal">ตำแหน่ง/ทักษะ</th>
                  <th className="px-3 py-2.5 font-normal">หน้างาน</th>
                  <th className="px-3 py-2.5 font-normal">เลขประจำตัว</th>
                  <th className="px-3 py-2.5 font-normal">สัญชาติ</th>
                  {showPay && <th className="px-3 py-2.5 text-right font-normal">อัตรา</th>}
                  <th className="px-3 py-2.5 font-normal">ประกันสังคม</th>
                  <th className="px-5 py-2.5 font-normal">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 200).map((e) => {
                  const permitDays = e.workPermitExpiry ? daysBetween(TODAY, e.workPermitExpiry) : undefined;
                  return (
                    <tr key={e.id} onClick={() => setOpenId(e.id)} className="cursor-pointer border-b border-line transition-colors duration-150 last:border-0 hover:bg-raised/60">
                      <td className="px-5 py-2.5 font-mono text-[12px] text-ink-2">{e.id}</td>
                      <td className="px-3 py-2.5">
                        <span className="text-ink">{e.name}</span>
                        <span className="block text-[12px] text-ink-3">{EMP_TYPE_LABEL[e.type]}</span>
                      </td>
                      <td className="px-3 py-2.5 text-ink-2">{e.type === "daily" ? e.skill : e.position}</td>
                      <td className="px-3 py-2.5 text-ink-2">{e.projectId ? <span className="font-mono text-[12px]">{e.projectId}</span> : "สำนักงาน"}</td>
                      <td className="px-3 py-2.5 font-mono text-[12px] text-ink-2">{maskId(e.idNo)}</td>
                      <td className="px-3 py-2.5 text-ink-2">
                        {NATIONALITY_LABEL[e.nationality]}
                        {permitDays !== undefined && permitDays <= PERMIT_ALERT_DAYS && e.status !== "resigned" && (
                          <span className="ml-2">
                            <Pill tone={permitDays < 0 ? "neg" : "warn"}>{permitDays < 0 ? "ใบอนุญาตหมดอายุ" : `เหลือ ${permitDays} วัน`}</Pill>
                          </span>
                        )}
                      </td>
                      {showPay && (
                        <td className="num px-3 py-2.5 text-right font-mono text-[12px]">
                          {e.type === "monthly" ? `${fmt0(e.salary ?? 0)}/ด.` : e.type === "daily" ? `${fmt0(e.dailyRate ?? 0)}/วัน` : `${e.crewSize ?? "-"} คน`}
                        </td>
                      )}
                      <td className="px-3 py-2.5 text-ink-2">{e.type === "subcontract" ? "-" : e.ssoRegistered ? "ขึ้นทะเบียน" : <span className="text-warn">ยังไม่ขึ้นทะเบียน</span>}</td>
                      <td className="px-5 py-2.5">
                        <Status tone={STATUS_TONE[e.status]}>{EMP_STATUS_LABEL[e.status]}</Status>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!rows.length && <Empty>ไม่พบพนักงานตามเงื่อนไข</Empty>}
            {rows.length > 200 && <p className="px-5 py-3 text-[13px] text-ink-3">แสดง 200 จาก {rows.length} รายการ ใช้ตัวกรองเพื่อจำกัดผล</p>}
          </div>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHead title="ใบอนุญาตทำงานใกล้หมดอายุ" meta={`≤ ${PERMIT_ALERT_DAYS} วัน`} />
            {permitDue.length ? (
              <ul>
                {permitDue.map((e) => {
                  const d = daysBetween(TODAY, e.workPermitExpiry!);
                  return (
                    <li key={e.id}>
                      <button type="button" onClick={() => setOpenId(e.id)} className="flex w-full items-center gap-3 border-b border-line px-5 py-2.5 text-left transition-colors duration-150 last:border-0 hover:bg-raised/60">
                        <AlertTriangle {...I} className={d < 0 ? "text-neg" : "text-warn"} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px]">{e.name}</span>
                          <span className="block text-[12px] text-ink-3">
                            {NATIONALITY_LABEL[e.nationality]} · {e.projectId} · หมดอายุ {thDate(e.workPermitExpiry!)}
                          </span>
                        </span>
                        <span className={cx("num font-mono text-[12px]", d < 0 ? "text-neg" : "text-warn")}>{d < 0 ? `เกิน ${-d} วัน` : `${d} วัน`}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Empty>ไม่มีใบอนุญาตที่ใกล้หมดอายุ</Empty>
            )}
          </Card>
          <Headcount list={current} onPick={(id) => setSite(site === id ? "" : id)} active={site} />
        </div>
      </div>

      {open && <EmployeeDrawer e={open} showPay={showPay} edit={edit} onClose={() => setOpenId(null)} onEdit={() => setForm({ initial: open })} />}
      {form && (
        <EmployeeForm
          initial={form.initial}
          type={form.type}
          onClose={() => setForm(null)}
          onSaved={(e) => {
            setForm(null);
            setOpenId(e.id);
          }}
        />
      )}
    </>
  );
}

function Headcount({ list, onPick, active }: { list: Employee[]; onPick: (id: string) => void; active: string }) {
  const rows = ACTIVE_SITES.map((p) => {
    const here = list.filter((e) => e.projectId === p.id);
    const daily = here.filter((e) => e.type === "daily");
    return {
      p,
      staff: here.filter((e) => e.type === "monthly").length,
      th: daily.filter((e) => e.nationality === "TH").length,
      foreign: daily.filter((e) => e.nationality !== "TH").length,
      crew: here.filter((e) => e.type === "subcontract").reduce((s, c) => s + (c.crewSize ?? 0), 0),
    };
  });
  const max = Math.max(1, ...rows.map((r) => r.staff + r.th + r.foreign + r.crew));
  return (
    <Card>
      <CardHead title="กำลังคนตามหน้างาน" meta={`${rows.reduce((s, r) => s + r.th + r.foreign, 0)} คนงานรายวัน`} />
      <ul className="px-5 py-2">
        {rows.map((r) => {
          const total = r.staff + r.th + r.foreign + r.crew;
          return (
            <li key={r.p.id}>
              <button type="button" onClick={() => onPick(r.p.id)} aria-pressed={active === r.p.id} className={cx("w-full rounded-[8px] px-2 py-2 text-left transition-colors duration-150 hover:bg-raised/60", active === r.p.id && "bg-raised")}>
                <span className="flex items-baseline justify-between gap-2 text-[13px]">
                  <span className="truncate">
                    <span className="font-mono text-[12px] text-ink-3">{r.p.id}</span> {r.p.name}
                  </span>
                  <span className="num font-mono text-[12px]">{total}</span>
                </span>
                <span className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-raised" style={{ width: `${(total / max) * 100}%` }} aria-hidden>
                  <span className="bg-ink" style={{ flex: r.staff }} />
                  <span className="bg-ink-3" style={{ flex: r.th }} />
                  <span className="bg-accent" style={{ flex: r.foreign }} />
                  <span className="bg-deep" style={{ flex: r.crew }} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line px-5 py-3 text-[12px] text-ink-3">
        <Legend cls="bg-ink" label="รายเดือน" />
        <Legend cls="bg-ink-3" label="รายวัน ไทย" />
        <Legend cls="bg-accent" label="รายวัน ต่างด้าว" />
        <Legend cls="bg-deep" label="ทีมผู้รับเหมา" />
      </div>
    </Card>
  );
}

const Legend = ({ cls, label }: { cls: string; label: string }) => (
  <span className="inline-flex items-center gap-1.5">
    <span className={cx("size-2 rounded-[2px]", cls)} />
    {label}
  </span>
);

function EmployeeDrawer({ e, showPay, edit, onClose, onEdit }: { e: Employee; showPay: boolean; edit: boolean; onClose: () => void; onEdit: () => void }) {
  const settings = useHrSettings();
  const runs = useRuns();
  const sheets = attendance.use();
  const recent = useMemo(() => {
    const lines = runs
      .filter((r) => r.lines.some((l) => l.employeeId === e.id))
      .sort((a, b) => b.payDate.localeCompare(a.payDate))
      .slice(0, 6)
      .map((r) => ({ r, l: r.lines.filter((l) => l.employeeId === e.id) }));
    return lines;
  }, [runs, e.id]);
  const last30 = useMemo(() => {
    let days = 0;
    let ot = 0;
    for (const s of sheets) {
      if (daysBetween(s.date, TODAY) > 30) continue;
      const en = s.entries.find((x) => x.employeeId === e.id);
      if (!en) continue;
      days += en.mark === "present" ? 1 : en.mark === "half" ? 0.5 : 0;
      ot += en.ot;
    }
    return { days, ot };
  }, [sheets, e.id]);

  const gross = (e.salary ?? 0) + (e.allowance ?? 0);
  const sso = e.ssoRegistered ? ssoMonthly(gross, settings.sso) : 0;
  const year = e.type === "monthly" ? annualPit(gross * 12, e.allowances, sso * 12) : undefined;

  return (
    <Drawer
      open
      onClose={onClose}
      title={
        <>
          <p className="font-mono text-[12px] text-ink-3">{e.id}</p>
          <p className="text-[17px] font-medium">{e.name}</p>
          <p className="text-[13px] text-ink-2">
            {EMP_TYPE_LABEL[e.type]} · {e.type === "daily" ? e.skill : e.position}
          </p>
        </>
      }
      footer={
        edit && (
          <Btn onClick={onEdit}>
            <Pencil {...I} />
            แก้ไขข้อมูล
          </Btn>
        )
      }
    >
      <Section title="ข้อมูลทั่วไป">
        <KV k="สถานะ">
          <Status tone={STATUS_TONE[e.status]}>{EMP_STATUS_LABEL[e.status]}</Status>
        </KV>
        <KV k={e.nationality === "TH" ? "เลขบัตรประชาชน" : "หนังสือเดินทาง"}>
          <span className="font-mono">{showPay ? e.idNo : maskId(e.idNo)}</span>
        </KV>
        <KV k="สัญชาติ">{NATIONALITY_LABEL[e.nationality]}</KV>
        {e.workPermitNo && (
          <KV k="ใบอนุญาตทำงาน">
            <span className="font-mono">{e.workPermitNo}</span> · หมดอายุ {e.workPermitExpiry ? thDate(e.workPermitExpiry) : "-"}
            {e.workPermitExpiry && daysBetween(TODAY, e.workPermitExpiry) <= PERMIT_ALERT_DAYS && (
              <span className="ml-2">
                <Pill tone={daysBetween(TODAY, e.workPermitExpiry) < 0 ? "neg" : "warn"}>ต้องต่ออายุ</Pill>
              </span>
            )}
          </KV>
        )}
        <KV k="โทรศัพท์">{e.phone ?? "-"}</KV>
        <KV k="ฝ่าย">{e.department}</KV>
        <KV k="หน้างาน">{e.projectId ? <Link href={`/projects/${e.projectId}`} className="underline decoration-line-strong underline-offset-2 hover:decoration-ink">{`${e.projectId} · ${siteName(e.projectId)}`}</Link> : "สำนักงาน"}</KV>
        <KV k="วันเริ่มงาน">
          {thDate(e.startDate)}
          {e.endDate && ` · สิ้นสุด ${thDate(e.endDate)}`}
        </KV>
        {e.memberId && <KV k="ผู้ใช้ในระบบ">{e.memberId}</KV>}
        {e.type === "subcontract" && (
          <>
            <KV k="จำนวนคน">{e.crewSize} คน</KV>
            <KV k="เงื่อนไขค่าจ้าง">{e.contractNote}</KV>
            <p className="mt-2 text-[12px] text-ink-3">ทีมผู้รับเหมาค่าแรงไม่ใช่ลูกจ้าง จ่ายผ่านใบแจ้งหนี้/งานจัดซื้อ หัก ณ ที่จ่าย 3% (ภ.ง.ด.3/53)</p>
          </>
        )}
      </Section>

      {e.type !== "subcontract" && showPay && (
        <Section title="ค่าจ้างและการจ่ายเงิน">
          {e.type === "monthly" ? (
            <>
              <KV k="เงินเดือน">{fmt(e.salary ?? 0)} บาท</KV>
              <KV k="ค่าตำแหน่ง/เดินทาง">{fmt(e.allowance ?? 0)} บาท</KV>
            </>
          ) : (
            <>
              <KV k="ค่าแรงต่อวัน">{fmt(e.dailyRate ?? 0)} บาท · OT ชม.ละ {fmt(((e.dailyRate ?? 0) / 8) * 1.5)} บาท</KV>
              <KV k="30 วันล่าสุด">
                {last30.days} วัน · OT {last30.ot} ชม.
              </KV>
            </>
          )}
          <KV k="บัญชีรับเงิน">{e.bank ? `${e.bank} ${maskAccount(e.bankAccount)}` : "รับเงินสด"}</KV>
          <KV k="ประกันสังคม">{e.ssoRegistered ? `ขึ้นทะเบียนแล้ว${e.type === "monthly" ? ` · หัก ${fmt0(sso)} บาท/เดือน` : ""}` : "ยังไม่ขึ้นทะเบียน"}</KV>
        </Section>
      )}

      {year && showPay && (
        <Section title="ภาษี ภ.ง.ด.1 (ประมาณทั้งปี)">
          <KV k="เงินได้ทั้งปี">{fmt(year.income)}</KV>
          <KV k="หักค่าใช้จ่าย">{fmt(year.expense)}</KV>
          <KV k="ค่าลดหย่อน">{fmt(year.allowances)}</KV>
          <KV k="เงินได้สุทธิ">{fmt(year.taxable)}</KV>
          <KV k="ภาษีทั้งปี">{fmt(year.tax)}</KV>
          <KV k="หักต่อเดือน">
            <span className="font-medium">{fmt(monthlyWht(gross, e.allowances, sso))} บาท</span>
          </KV>
        </Section>
      )}

      {showPay && recent.length > 0 && (
        <Section title="การจ่ายล่าสุด" action={<Link href="/hr/payroll" className="text-[13px] text-ink-2 hover:text-ink">ทั้งหมด</Link>}>
          <table className="w-full text-[13px]">
            <tbody>
              {recent.map(({ r, l }) => (
                <tr key={r.id} className="border-b border-line last:border-0">
                  <td className="py-1.5">
                    <Link href={`/hr/payroll?run=${r.id}`} className="font-mono text-[12px] text-ink-2 hover:text-ink">
                      {r.id}
                    </Link>
                  </td>
                  <td className="py-1.5 text-ink-3">{thDate(r.payDate)}</td>
                  <td className="num py-1.5 text-right font-mono text-[12px]">{fmt(l.reduce((s, x) => s + x.net, 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
    </Drawer>
  );
}
