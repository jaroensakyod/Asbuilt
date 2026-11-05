"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarPlus, Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { Card, CardHead, cx, Field, inputCls } from "@/components/ui";
import { Btn, Empty, FilterField, I, IconBtn, KV, Modal, Pill, Select, StatCard, SystemPill, type Tone } from "@/components/ops/bits";
import { getProject, projects, SYSTEM_LABEL, thDate, TODAY, type SystemKey } from "@/lib/data";
import { maintState, useMaintenance } from "@/lib/ops-store";
import { addDays, addMonths, billingSchedule, contractRevenue, daysDiff, renewalDue, visitsPerYear } from "@/lib/field/calc";
import { generateVisits, renewContract, saveContract, serviceContracts, technicians } from "@/lib/field/store";
import { BILLING_FREQ_LABEL, type BillingFreq, type ServiceContract, type ServiceScope } from "@/lib/field/types";
import { canEdit } from "@/lib/permissions";
import { useMe } from "@/lib/use-me";

const STATUS_LABEL: Record<ServiceContract["status"], string> = { draft: "ร่าง/เสนอ", active: "มีผล", expired: "หมดอายุ", cancelled: "ยกเลิก" };
const STATUS_TONE: Record<ServiceContract["status"], Tone> = { draft: "neutral", active: "pos", expired: "warn", cancelled: "neutral" };
const baht = (n: number) => `฿${Math.round(n).toLocaleString("th-TH")}`;

const PRESETS: ServiceScope[] = [
  { key: "ac", label: "ล้างแอร์", system: "hvac", cycleMonths: 6, units: 4 },
  { key: "pump", label: "ตรวจปั๊มน้ำและถังแรงดัน", system: "plumb", cycleMonths: 6 },
  { key: "grease", label: "ตักไขมันถังดักไขมัน", system: "plumb", cycleMonths: 3 },
  { key: "tank", label: "ล้างถังเก็บน้ำ", system: "plumb", cycleMonths: 12 },
  { key: "septic", label: "สูบถังบำบัดน้ำเสีย", system: "plumb", cycleMonths: 24 },
  { key: "roof", label: "ตรวจหลังคาและรางน้ำ", system: "arch", cycleMonths: 12 },
  { key: "elcb", label: "ทดสอบเบรกเกอร์กันดูด", system: "elec", cycleMonths: 12 },
  { key: "pool", label: "ตรวจเครื่องกรองสระว่ายน้ำ", system: "ext", cycleMonths: 3 },
  { key: "termite", label: "ฉีดกันปลวก", system: "ext", cycleMonths: 6 },
];

export function ServiceContractsView() {
  const list = serviceContracts.use();
  const me = useMe();
  const editable = canEdit(me.role, "service");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [form, setForm] = useState<ServiceContract | "new" | null>(null);

  const rev = useMemo(() => contractRevenue(list, TODAY), [list]);
  const renewing = list.filter((c) => renewalDue(c, TODAY, 30));
  const rows = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return list
      .filter((c) => !status || c.status === status)
      .filter((c) => !qq || `${c.id} ${c.title} ${c.customer} ${getProject(c.projectId)?.name ?? ""}`.toLowerCase().includes(qq))
      .sort((a, b) => (a.status === "active" ? 0 : 1) - (b.status === "active" ? 0 : 1) || a.end.localeCompare(b.end));
  }, [list, q, status]);

  const months = useMemo(() => {
    const y = TODAY.slice(0, 4);
    const out = Array.from({ length: 12 }, (_, i) => ({ m: `${y}-${String(i + 1).padStart(2, "0")}`, v: 0 }));
    for (const c of list) {
      if (c.status === "cancelled" || c.status === "draft") continue;
      for (const b of billingSchedule(c)) {
        const hit = out.find((x) => b.date.startsWith(x.m));
        if (hit) hit.v += b.amount;
      }
    }
    return out;
  }, [list]);
  const maxV = Math.max(1, ...months.map((x) => x.v));
  const cur = list.find((c) => c.id === open);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
        <div>
          <p className="mb-1 text-[13px] text-ink-3">งานบริการ</p>
          <h1 className="text-[30px] font-normal leading-[1.15]">สัญญาบริการบำรุงรักษา</h1>
          <p className="mt-2 max-w-[44rem] text-ink-2">สัญญารายปีกับลูกค้าที่ส่งมอบบ้านแล้ว ขอบเขตงานบำรุงรักษา รอบเรียกเก็บเงิน สร้างนัดเข้าแผนบำรุงรักษาอัตโนมัติ และเตือนต่ออายุ</p>
        </div>
        {editable && (
          <Btn primary onClick={() => setForm("new")}>
            <Plus {...I} />
            สร้างสัญญา
          </Btn>
        )}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="สัญญาที่มีผล" value={list.filter((c) => c.status === "active").length} unit="ฉบับ" note={`มูลค่าต่อปี ${baht(rev.runRate)}`} active={status === "active"} onClick={() => setStatus(status === "active" ? "" : "active")} />
        <StatCard label={`เรียกเก็บแล้วปี ${Number(TODAY.slice(0, 4)) + 543}`} value={baht(rev.billedYtd)} note={`ที่เหลือในปีนี้ ${baht(rev.toBill)}`} />
        <StatCard label="ต่ออายุใน 30 วัน" value={renewing.length} unit="ฉบับ" tone={renewing.length ? "neg" : undefined} note={renewing.map((c) => c.id).join(", ") || "ไม่มี"} />
        <StatCard label="ข้อเสนอที่รอลูกค้า" value={list.filter((c) => c.status === "draft").length} unit="ฉบับ" active={status === "draft"} onClick={() => setStatus(status === "draft" ? "" : "draft")} />
      </div>

      <Card className="mb-4">
        <CardHead title="รายได้ตามรอบเรียกเก็บ" meta={`ปี ${Number(TODAY.slice(0, 4)) + 543}`} />
        <div className="px-5 py-4">
          <svg viewBox="0 0 600 140" className="h-[140px] w-full" role="img" aria-label="รายได้สัญญาบริการรายเดือน">
            {months.map((x, i) => {
              const h = (x.v / maxV) * 100;
              const past = `${x.m}-31` <= TODAY || x.m === TODAY.slice(0, 7);
              return (
                <g key={x.m}>
                  <rect x={i * 50 + 10} y={110 - h} width={30} height={h} rx={3} className={past ? "fill-ink" : "fill-deep"} />
                  <text x={i * 50 + 25} y={128} textAnchor="middle" className="fill-ink-3 text-[10px]">
                    {Number(x.m.slice(5))}
                  </text>
                  {x.v > 0 && (
                    <text x={i * 50 + 25} y={104 - h} textAnchor="middle" className="fill-ink-2 font-mono text-[9px]">
                      {(x.v / 1000).toFixed(1)}k
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </Card>

      <Card className="mb-4 px-4 py-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <FilterField label="ค้นหา" className="col-span-2">
            <div className="relative">
              <Search {...I} className="pointer-events-none absolute left-2.5 top-2.5 text-ink-3" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="เลขสัญญา ลูกค้า โครงการ" className={cx(inputCls, "w-full pl-8")} />
            </div>
          </FilterField>
          <FilterField label="สถานะ">
            <Select label="สถานะ" value={status} onChange={setStatus}>
              <option value="">ทุกสถานะ</option>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </FilterField>
        </div>
      </Card>

      <Card>
        {rows.length === 0 ? (
          <Empty>ยังไม่มีสัญญาบริการ</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="text-ink-3">
                  <th className="px-5 py-3 font-normal">สัญญา</th>
                  <th className="py-3 pr-4 font-normal">ลูกค้า / บ้าน</th>
                  <th className="py-3 pr-4 font-normal">ขอบเขต</th>
                  <th className="py-3 pr-4 text-right font-normal">ราคา/ปี</th>
                  <th className="py-3 pr-4 font-normal">ระยะสัญญา</th>
                  <th className="py-3 pr-5 font-normal">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const d = daysDiff(TODAY, c.end);
                  return (
                    <tr key={c.id} onClick={() => setOpen(c.id)} className="cursor-pointer border-t border-line hover:bg-raised/50">
                      <td className="px-5 py-2.5">
                        <span className="block">{c.title}</span>
                        <span className="font-mono text-[12px] text-ink-3">{c.id}</span>
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className="block">{c.customer}</span>
                        <span className="text-[12px] text-ink-3">
                          {getProject(c.projectId)?.name} · {c.projectId}
                        </span>
                      </td>
                      <td className="max-w-[300px] py-2.5 pr-4">
                        <span className="line-clamp-2">{c.scopes.map((s) => s.label).join(" · ")}</span>
                        <span className="text-[12px] text-ink-3">{visitsPerYear(c)} ครั้ง/ปี</span>
                      </td>
                      <td className="py-2.5 pr-4 text-right">
                        <span className="num block font-mono">{c.price.toLocaleString("th-TH")}</span>
                        <span className="text-[12px] text-ink-3">{BILLING_FREQ_LABEL[c.billing]}</span>
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className="num font-mono">
                          {thDate(c.start)} – {thDate(c.end)}
                        </span>
                        {c.status === "active" && <span className={cx("block text-[12px]", d <= 30 ? "text-neg" : "text-ink-3")}>{d >= 0 ? `เหลือ ${d} วัน` : `หมดแล้ว ${-d} วัน`}</span>}
                      </td>
                      <td className="py-2.5 pr-5">
                        <Pill tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Pill>
                        {c.autoRenew && <span className="ml-1 text-[12px] text-ink-3">ต่ออัตโนมัติ</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {cur && <Detail c={cur} editable={editable} onClose={() => setOpen(null)} onEdit={() => setForm(cur)} />}
      {form && <ContractForm initial={form === "new" ? undefined : form} onClose={() => setForm(null)} onSaved={(c) => setOpen(c.id)} />}
    </>
  );
}

function Detail({ c, editable, onClose, onEdit }: { c: ServiceContract; editable: boolean; onClose: () => void; onEdit: () => void }) {
  const maint = useMaintenance();
  const visits = maint.filter((m) => m.task.includes(`(${c.id})`) || (c.planIds ?? []).includes(m.planId ?? "")).sort((a, b) => a.date.localeCompare(b.date));
  const [pct, setPct] = useState("3");
  const bills = billingSchedule(c);
  return (
    <Modal
      open
      onClose={onClose}
      width={760}
      title={`${c.id} · ${c.title}`}
      footer={
        editable ? (
          <>
            <Btn danger onClick={() => window.confirm("ยกเลิกสัญญานี้") && saveContract({ ...c, status: "cancelled" })} disabled={c.status === "cancelled"}>
              <Trash2 {...I} />
              ยกเลิกสัญญา
            </Btn>
            <span className="mr-auto" />
            <Btn onClick={onEdit}>
              <Pencil {...I} />
              แก้ไข
            </Btn>
            {c.status === "draft" && (
              <Btn primary onClick={() => saveContract({ ...c, status: "active" })}>
                ลูกค้าตกลง เริ่มสัญญา
              </Btn>
            )}
            {c.status === "active" && (
              <Btn primary onClick={() => window.alert(`สร้างนัด ${generateVisits(c)} แผน เข้าแผนบำรุงรักษาแล้ว`)}>
                <CalendarPlus {...I} />
                สร้างนัดบำรุงรักษา
              </Btn>
            )}
          </>
        ) : undefined
      }
    >
      <div className="grid grid-cols-2 gap-x-6">
        <KV k="ลูกค้า">{c.customer}</KV>
        <KV k="บ้าน/อาคาร">
          <Link href={`/projects/${c.projectId}`} className="hover:underline">
            {getProject(c.projectId)?.name} · {c.projectId}
          </Link>
        </KV>
        <KV k="ระยะสัญญา">
          {thDate(c.start)} – {thDate(c.end)}
        </KV>
        <KV k="สถานะ">
          <Pill tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Pill>
        </KV>
        <KV k="ราคา/ปี">{baht(c.price)} (ไม่รวม VAT)</KV>
        <KV k="เรียกเก็บ">{BILLING_FREQ_LABEL[c.billing]}</KV>
        <KV k="ช่างประจำ">{c.assignee}</KV>
        <KV k="เตือนต่ออายุ">ล่วงหน้า {c.remindDays} วัน{c.autoRenew ? " · ต่ออัตโนมัติ" : ""}</KV>
        {c.renewedFrom && <KV k="ต่อจากสัญญา">{c.renewedFrom}</KV>}
      </div>

      <h3 className="mb-2 mt-5 text-[14px] font-medium">ขอบเขตงาน</h3>
      <ul className="flex flex-col gap-1 text-[13px]">
        {c.scopes.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <SystemPill s={s.system} />
            <span className="flex-1">{s.label}</span>
            <span className="text-ink-3">ทุก {s.cycleMonths} เดือน</span>
          </li>
        ))}
      </ul>

      <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
        <div>
          <h3 className="mb-2 text-[14px] font-medium">รอบเรียกเก็บเงิน</h3>
          <ul className="text-[13px]">
            {bills.map((b) => (
              <li key={b.date} className="flex justify-between border-b border-line py-1">
                <span className={cx("num font-mono", b.date <= TODAY ? "text-ink-3" : "")}>{thDate(b.date)}</span>
                <span className="num font-mono">{b.amount.toLocaleString("th-TH")}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-2 text-[14px] font-medium">นัดบำรุงรักษา {visits.length ? `(${visits.length})` : ""}</h3>
          {visits.length === 0 ? (
            <p className="text-[13px] text-ink-3">ยังไม่ได้สร้างนัดเข้าแผนบำรุงรักษา</p>
          ) : (
            <ul className="max-h-[220px] overflow-y-auto text-[13px]">
              {visits.slice(0, 20).map((m) => (
                <li key={m.id} className="flex justify-between gap-2 border-b border-line py-1">
                  <span className="truncate">{m.task.replace(` (${c.id})`, "")}</span>
                  <span className={cx("num shrink-0 font-mono", maintState(m) === "overdue" ? "text-neg" : "text-ink-3")}>{thDate(m.date)}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/maintenance" className="mt-1 inline-block text-[13px] text-accent-text hover:underline">
            เปิดแผนบำรุงรักษา
          </Link>
        </div>
      </div>

      {editable && (c.status === "active" || c.status === "expired") && (
        <div className="mt-5 flex flex-wrap items-end gap-2 rounded-[10px] border border-line bg-raised p-3">
          <Field label="ปรับราคาต่ออายุ (%)">
            <input value={pct} onChange={(e) => setPct(e.target.value.replace(/[^\d.-]/g, ""))} className={cx(inputCls, "num w-24 font-mono")} />
          </Field>
          <Btn
            onClick={() => {
              const n = renewContract(c, Number(pct) || 0);
              window.alert(`สร้างสัญญาต่ออายุ ${n.id} (${thDate(n.start)} – ${thDate(n.end)}) ราคา ${baht(n.price)}`);
              onClose();
            }}
          >
            <RefreshCw {...I} />
            ต่ออายุสัญญาอีก 1 ปี
          </Btn>
          <span className="text-[12px] text-ink-3">สัญญาเดิมจะเปลี่ยนเป็นหมดอายุ</span>
        </div>
      )}
    </Modal>
  );
}

function ContractForm({ initial, onClose, onSaved }: { initial?: ServiceContract; onClose: () => void; onSaved: (c: ServiceContract) => void }) {
  const techs = technicians();
  const delivered = projects.filter((p) => p.status === "delivered" || p.status === "handover");
  const [c, setC] = useState<ServiceContract>(
    () =>
      initial ?? {
        id: serviceContracts.nextId(`SVC-${TODAY.slice(0, 4)}-`),
        projectId: delivered[0]?.id ?? "",
        customer: delivered[0]?.owner ?? "",
        title: "สัญญาบำรุงรักษารายปี",
        scopes: [PRESETS[0]],
        price: 12000,
        billing: "annual",
        start: addDays(TODAY, 1),
        end: addDays(addMonths(addDays(TODAY, 1), 12), -1),
        status: "draft",
        autoRenew: false,
        remindDays: 30,
        assignee: techs[0]?.name ?? "",
      },
  );
  const set = <K extends keyof ServiceContract>(k: K, v: ServiceContract[K]) => setC((x) => ({ ...x, [k]: v }));
  const has = (k: string) => c.scopes.find((s) => s.key === k);
  const toggle = (p: ServiceScope) => set("scopes", has(p.key) ? c.scopes.filter((s) => s.key !== p.key) : [...c.scopes, { ...p }]);
  const setScope = (k: string, patch: Partial<ServiceScope>) => set("scopes", c.scopes.map((s) => (s.key === k ? { ...s, ...patch } : s)));
  const [custom, setCustom] = useState({ label: "", system: "arch" as SystemKey, cycle: "12" });

  return (
    <Modal
      open
      onClose={onClose}
      width={760}
      title={initial ? `แก้ไข ${c.id}` : "สร้างสัญญาบริการ"}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn
            primary
            disabled={!c.projectId || !c.scopes.length || c.end <= c.start}
            onClick={() => {
              saveContract(c);
              onSaved(c);
              onClose();
            }}
          >
            บันทึก
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="บ้าน/อาคารที่ส่งมอบแล้ว">
          <Select
            label="โครงการ"
            value={c.projectId}
            onChange={(v) => {
              set("projectId", v);
              set("customer", getProject(v)?.owner ?? "");
            }}
          >
            {delivered.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} · {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="ลูกค้า">
          <input className={inputCls} value={c.customer} onChange={(e) => set("customer", e.target.value)} />
        </Field>
        <div className="col-span-2">
          <Field label="ชื่อสัญญา">
            <input className={inputCls} value={c.title} onChange={(e) => set("title", e.target.value)} />
          </Field>
        </div>
        <Field label="เริ่ม">
          <input type="date" className={inputCls} value={c.start} onChange={(e) => setC((x) => ({ ...x, start: e.target.value, end: addDays(addMonths(e.target.value, 12), -1) }))} />
        </Field>
        <Field label="สิ้นสุด">
          <input type="date" className={inputCls} value={c.end} onChange={(e) => set("end", e.target.value)} />
        </Field>
        <Field label="ราคาต่อปี (บาท ไม่รวม VAT)">
          <input className={cx(inputCls, "num font-mono")} inputMode="numeric" value={c.price} onChange={(e) => set("price", Number(e.target.value.replace(/[^\d]/g, "")) || 0)} />
        </Field>
        <Field label="รอบเรียกเก็บ">
          <Select label="รอบเรียกเก็บ" value={c.billing} onChange={(v) => set("billing", v as BillingFreq)}>
            {Object.entries(BILLING_FREQ_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="ช่างประจำสัญญา">
          <Select label="ช่าง" value={c.assignee} onChange={(v) => set("assignee", v)}>
            {techs.map((t) => (
              <option key={t.id}>{t.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="เตือนต่ออายุล่วงหน้า (วัน)">
          <input className={cx(inputCls, "num font-mono")} inputMode="numeric" value={c.remindDays} onChange={(e) => set("remindDays", Number(e.target.value.replace(/[^\d]/g, "")) || 0)} />
        </Field>
        <label className="col-span-2 flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={c.autoRenew} onChange={(e) => set("autoRenew", e.target.checked)} />
          ต่ออายุอัตโนมัติเมื่อครบกำหนด (ยังต้องแจ้งลูกค้าก่อน)
        </label>
      </div>

      <h3 className="mb-2 mt-5 text-[14px] font-medium">ขอบเขตงาน</h3>
      <div className="flex flex-col gap-1.5">
        {[...PRESETS, ...c.scopes.filter((s) => !PRESETS.some((p) => p.key === s.key))].map((p) => {
          const s = has(p.key);
          return (
            <div key={p.key} className="grid grid-cols-[24px_1fr_120px_90px] items-center gap-2 text-[13px]">
              <input type="checkbox" checked={!!s} onChange={() => toggle(p)} aria-label={p.label} />
              <span>
                {s?.label ?? p.label} <span className="text-ink-3">· {SYSTEM_LABEL[p.system]}</span>
              </span>
              <span className="flex items-center gap-1 text-ink-3">
                ทุก
                <input disabled={!s} className={cx(inputCls, "num h-8 w-14 px-2 font-mono")} inputMode="numeric" value={s?.cycleMonths ?? p.cycleMonths} onChange={(e) => setScope(p.key, { cycleMonths: Math.max(1, Number(e.target.value.replace(/[^\d]/g, "")) || 1) })} aria-label="รอบเดือน" />
                เดือน
              </span>
              {p.key === "ac" ? (
                <span className="flex items-center gap-1 text-ink-3">
                  <input disabled={!s} className={cx(inputCls, "num h-8 w-12 px-2 font-mono")} inputMode="numeric" value={s?.units ?? p.units ?? 1} onChange={(e) => setScope("ac", { units: Number(e.target.value.replace(/[^\d]/g, "")) || 1, label: `ล้างแอร์ ${Number(e.target.value.replace(/[^\d]/g, "")) || 1} เครื่อง` })} aria-label="จำนวนเครื่อง" />
                  เครื่อง
                </span>
              ) : (
                <span />
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3 grid grid-cols-[1fr_140px_80px_auto] gap-2">
        <input className={inputCls} value={custom.label} onChange={(e) => setCustom((x) => ({ ...x, label: e.target.value }))} placeholder="งานอื่น ๆ" aria-label="งานอื่น" />
        <Select label="ระบบ" value={custom.system} onChange={(v) => setCustom((x) => ({ ...x, system: v as SystemKey }))}>
          {(Object.keys(SYSTEM_LABEL) as SystemKey[]).map((k) => (
            <option key={k} value={k}>
              {SYSTEM_LABEL[k]}
            </option>
          ))}
        </Select>
        <input className={cx(inputCls, "num font-mono")} value={custom.cycle} onChange={(e) => setCustom((x) => ({ ...x, cycle: e.target.value.replace(/[^\d]/g, "") }))} aria-label="รอบ (เดือน)" />
        <IconBtn
          label="เพิ่มขอบเขต"
          onClick={() => {
            if (!custom.label.trim()) return;
            set("scopes", [...c.scopes, { key: `x${Date.now().toString(36)}`, label: custom.label.trim(), system: custom.system, cycleMonths: Math.max(1, Number(custom.cycle) || 12) }]);
            setCustom({ label: "", system: "arch", cycle: "12" });
          }}
        >
          <Plus {...I} />
        </IconBtn>
      </div>
      <p className="mt-3 text-[13px] text-ink-3">
        {visitsPerYear(c)} ครั้ง/ปี · เรียกเก็บ {BILLING_FREQ_LABEL[c.billing]} ครั้งละ {baht(billingSchedule(c)[0]?.amount ?? 0)}
      </p>
    </Modal>
  );
}
