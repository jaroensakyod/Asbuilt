"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CalendarCheck, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { Card, CardHead, cx, Field, inputCls } from "@/components/ui";
import { Btn, Empty, FilterField, I, IconBtn, Modal, Pill, Segmented, Select, StatCard, SystemPill, useHydrated, type Tone } from "@/components/ops/bits";
import { getProject, projects, REPAIR_STATUS_LABEL, SYSTEM_LABEL, team, thDate, TODAY, type SystemKey } from "@/lib/data";
import { useRepairs, type OpsRepair } from "@/lib/ops-store";
import { addDays, covers, daysDiff, warrantyEnd, warrantyState, type WarrantyState } from "@/lib/field/calc";
import { bookPreExpiryInspection, generateWarranty, nextWarrantyId, setClaim, useFieldSettings, warrantyClaims, warrantyItems } from "@/lib/field/store";
import { WARRANTY_CAT_LABEL, type WarrantyCategory, type WarrantyClaim, type WarrantyItem } from "@/lib/field/types";
import { canEdit } from "@/lib/permissions";
import { useMe } from "@/lib/use-me";
import { ServiceSettingsButton } from "./service-settings";

const STATE_LABEL: Record<WarrantyState, string> = { active: "คุ้มครอง", expiring: "ใกล้หมด", expired: "หมดแล้ว" };
const STATE_TONE: Record<WarrantyState, Tone> = { active: "pos", expiring: "warn", expired: "neutral" };
const DECISION_LABEL: Record<WarrantyClaim["decision"], string> = { in: "ในประกัน (ไม่คิดเงิน)", chargeable: "นอกประกัน (คิดค่าบริการ)", supplier: "เคลมผู้ผลิต/ผู้ขาย" };
const CAT_OF_SYSTEM: Record<SystemKey, WarrantyCategory[]> = { struct: ["structure"], arch: ["roof", "general"], ext: ["general"], elec: ["system", "equipment"], plumb: ["system", "equipment"], hvac: ["equipment", "system"] };

/** the warranty item a repair falls under (same system, covering the report date) */
export function matchWarranty(r: Pick<OpsRepair, "projectId" | "system" | "reported">, items: WarrantyItem[]) {
  const cats = CAT_OF_SYSTEM[r.system];
  const mine = items.filter((w) => w.projectId === r.projectId && (w.system === r.system || cats.includes(w.category)));
  return mine.find((w) => covers(w, r.reported)) ?? mine[0];
}

export function WarrantyView() {
  return (
    <Suspense fallback={<div className="h-[60vh]" />}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const sp = useSearchParams();
  const me = useMe();
  const editable = canEdit(me.role, "service");
  const hydrated = useHydrated();
  const items = warrantyItems.use();
  const claims = warrantyClaims.use();
  const repairs = useRepairs();
  const s = useFieldSettings();
  const [project, setProject] = useState(sp.get("project") ?? "");
  const [cat, setCat] = useState("");
  const [state, setState] = useState("");
  const [tab, setTab] = useState<"items" | "timeline" | "claims">("items");
  const [adding, setAdding] = useState(false);
  const [gen, setGen] = useState(false);
  const [book, setBook] = useState<WarrantyItem[] | null>(null);

  const delivered = useMemo(() => projects.filter((p) => p.handedOver), []);
  const withState = useMemo(() => items.map((w) => ({ w, end: warrantyEnd(w), st: warrantyState(warrantyEnd(w), TODAY, s.preExpiryDays) })), [items, s.preExpiryDays]);
  const rows = withState
    .filter((x) => !project || x.w.projectId === project)
    .filter((x) => !cat || x.w.category === cat)
    .filter((x) => !state || x.st === state)
    .sort((a, b) => Number(a.st === "expired") - Number(b.st === "expired") || (a.st === "expired" ? b.end.localeCompare(a.end) : a.end.localeCompare(b.end)));
  const covered = useMemo(() => new Set(items.map((w) => w.projectId)), [items]);
  const projClaims = useMemo(() => repairs.filter((r) => covered.has(r.projectId) && (!project || r.projectId === project)).sort((a, b) => b.reported.localeCompare(a.reported)), [repairs, covered, project]);
  const claimOf = (r: OpsRepair) => {
    const c = claims.find((x) => x.repairId === r.id);
    const item = c?.itemId ? items.find((w) => w.id === c.itemId) : matchWarranty(r, items);
    const auto: WarrantyClaim["decision"] = item && covers(item, r.reported) ? (item.source === "manufacturer" ? "supplier" : "in") : "chargeable";
    return { c, item, decision: c?.decision ?? auto, auto: !c };
  };
  const year = TODAY.slice(0, 4);
  const yearClaims = projClaims.filter((r) => r.reported.startsWith(year)).map(claimOf);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
        <div>
          <p className="mb-1 text-[13px] text-ink-3">งานบริการ</p>
          <h1 className="text-[30px] font-normal leading-[1.15]">ทะเบียนการรับประกัน</h1>
          <p className="mt-2 max-w-[48rem] text-ink-2">การรับประกันของบริษัทตามหมวดงาน และการรับประกันของผู้ผลิตอุปกรณ์ ต่อบ้านที่ส่งมอบแล้ว เชื่อมกับแจ้งซ่อมเพื่อแยกงานในประกันกับงานคิดเงิน</p>
          <p className="mt-1 text-[12px] text-ink-3">ระยะเริ่มต้น โครงสร้าง 5 ปี งานทั่วไป/ระบบ 1 ปี ตาม ป.พ.พ. ม.600 หรือสัญญา ตรวจสอบสัญญาจริง</p>
        </div>
        <div className="flex items-center gap-2">
          <ServiceSettingsButton />
          {editable && (
            <>
              <Btn onClick={() => setGen(true)}>
                <ShieldCheck {...I} />
                สร้างประกันมาตรฐาน
              </Btn>
              <Btn primary onClick={() => setAdding(true)}>
                <Plus {...I} />
                เพิ่มรายการ
              </Btn>
            </>
          )}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="บ้านที่มีทะเบียนประกัน" value={covered.size} unit={`/ ${delivered.length} หลัง`} note="ส่งมอบแล้ว" />
        <StatCard label="รายการที่คุ้มครองอยู่" value={withState.filter((x) => x.st !== "expired").length} unit="รายการ" active={state === "active"} onClick={() => setState(state === "active" ? "" : "active")} />
        <StatCard label={`ใกล้หมดใน ${s.preExpiryDays} วัน`} value={withState.filter((x) => x.st === "expiring").length} unit="รายการ" tone={withState.some((x) => x.st === "expiring") ? "neg" : undefined} note="นัดตรวจก่อนหมดประกัน" active={state === "expiring"} onClick={() => setState(state === "expiring" ? "" : "expiring")} />
        <StatCard label={`เคลมปี ${Number(year) + 543}`} value={yearClaims.length} unit="เรื่อง" note={`ในประกัน ${yearClaims.filter((x) => x.decision !== "chargeable").length} · คิดเงิน ${yearClaims.filter((x) => x.decision === "chargeable").length}`} />
      </div>

      <Card className="mb-4 px-4 py-4">
        <div className="flex flex-wrap items-end gap-3">
          <FilterField label="บ้าน/โครงการ" className="min-w-[260px]">
            <Select label="โครงการ" value={project} onChange={setProject}>
              <option value="">ทุกหลัง</option>
              {delivered.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id} · {p.name}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="หมวด" className="min-w-[180px]">
            <Select label="หมวด" value={cat} onChange={setCat}>
              <option value="">ทุกหมวด</option>
              {Object.entries(WARRANTY_CAT_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="สถานะ" className="min-w-[140px]">
            <Select label="สถานะ" value={state} onChange={setState}>
              <option value="">ทั้งหมด</option>
              {Object.entries(STATE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </FilterField>
          <span className="ml-auto" />
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { key: "items", label: "รายการประกัน" },
              { key: "timeline", label: "ไทม์ไลน์หมดอายุ" },
              { key: "claims", label: "การเคลม" },
            ]}
          />
        </div>
      </Card>

      {tab === "items" && (
        <Card>
          {rows.length === 0 ? (
            <Empty>ไม่มีรายการประกันตามตัวกรอง</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="text-ink-3">
                    <th className="px-5 py-3 font-normal">รายการ</th>
                    <th className="py-3 pr-4 font-normal">บ้าน</th>
                    <th className="py-3 pr-4 font-normal">ผู้รับประกัน</th>
                    <th className="py-3 pr-4 text-right font-normal">ระยะ</th>
                    <th className="py-3 pr-4 font-normal">หมดประกัน</th>
                    <th className="py-3 pr-5 font-normal">สถานะ</th>
                    <th className="py-3 pr-5" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ w, end, st }) => {
                    const d = daysDiff(TODAY, end);
                    return (
                      <tr key={w.id} className="border-t border-line">
                        <td className="px-5 py-2.5">
                          <span className="block">{w.label}</span>
                          <span className="text-[12px] text-ink-3">
                            {WARRANTY_CAT_LABEL[w.category]}
                            {w.note ? ` · ${w.note}` : ""}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4">
                          <span className="block">{getProject(w.projectId)?.name}</span>
                          <span className="font-mono text-[12px] text-ink-3">{w.projectId}</span>
                        </td>
                        <td className="py-2.5 pr-4">{w.source === "company" ? "บริษัท" : (w.supplier ?? "ผู้ผลิต")}</td>
                        <td className="num py-2.5 pr-4 text-right font-mono">{w.months % 12 === 0 ? `${w.months / 12} ปี` : `${w.months} ด.`}</td>
                        <td className="py-2.5 pr-4">
                          <span className="num font-mono">{thDate(end)}</span>
                          {st !== "expired" && <span className={cx("block text-[12px]", st === "expiring" ? "text-warn" : "text-ink-3")}>อีก {d} วัน</span>}
                        </td>
                        <td className="py-2.5 pr-5">
                          <Pill tone={STATE_TONE[st]}>{STATE_LABEL[st]}</Pill>
                          {w.inspectionId && (
                            <Link href={`/inspections/${w.inspectionId}`} className="ml-1 font-mono text-[12px] text-accent-text hover:underline">
                              {w.inspectionId}
                            </Link>
                          )}
                        </td>
                        <td className="whitespace-nowrap py-2.5 pr-5 text-right">
                          {editable && st === "expiring" && !w.inspectionId && (
                            <Btn small onClick={() => setBook(rows.filter((x) => x.w.projectId === w.projectId && x.st === "expiring" && !x.w.inspectionId).map((x) => x.w))}>
                              <CalendarCheck {...I} />
                              นัดตรวจ
                            </Btn>
                          )}
                          {editable && (
                            <IconBtn label="ลบรายการ" danger onClick={() => window.confirm(`ลบ ${w.label}`) && warrantyItems.remove(w.id)}>
                              <Trash2 {...I} />
                            </IconBtn>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === "timeline" && <Timeline rows={rows} />}

      {tab === "claims" && (
        <Card>
          <CardHead title="แจ้งซ่อมของบ้านที่มีทะเบียนประกัน" meta={`${projClaims.length} เรื่อง`} />
          {projClaims.length === 0 ? (
            <Empty>ไม่มีเรื่องแจ้งซ่อม</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="text-ink-3">
                    <th className="px-5 py-3 font-normal">แจ้งซ่อม</th>
                    <th className="py-3 pr-4 font-normal">บ้าน</th>
                    <th className="py-3 pr-4 font-normal">รายการประกันที่เกี่ยวข้อง</th>
                    <th className="py-3 pr-5 font-normal">การพิจารณา</th>
                  </tr>
                </thead>
                <tbody>
                  {projClaims.map((r) => {
                    const x = claimOf(r);
                    return (
                      <tr key={r.id} className="border-t border-line align-top">
                        <td className="px-5 py-2.5">
                          <Link href={`/repairs?q=${r.id}`} className="block hover:underline">
                            {r.title}
                          </Link>
                          <span className="font-mono text-[12px] text-ink-3">
                            {r.id} · {thDate(r.reported)} · {REPAIR_STATUS_LABEL[r.status]}
                          </span>
                          <div className="mt-1">
                            <SystemPill s={r.system} />
                          </div>
                        </td>
                        <td className="py-2.5 pr-4">{getProject(r.projectId)?.name}</td>
                        <td className="py-2.5 pr-4">
                          {x.item ? (
                            <>
                              <span className="block">{x.item.label}</span>
                              <span className="text-[12px] text-ink-3">ถึง {thDate(warrantyEnd(x.item))}</span>
                            </>
                          ) : (
                            <span className="text-ink-3">ไม่พบรายการ</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-5">
                          {hydrated && editable ? (
                            <Select label="การพิจารณา" value={x.decision} onChange={(v) => setClaim({ repairId: r.id, projectId: r.projectId, itemId: x.item?.id, decision: v as WarrantyClaim["decision"], by: me.name, note: x.c?.note })} className="h-8 text-[13px]">
                              {Object.entries(DECISION_LABEL).map(([k, v]) => (
                                <option key={k} value={k}>
                                  {v}
                                </option>
                              ))}
                            </Select>
                          ) : (
                            <Pill tone={x.decision === "chargeable" ? "warn" : "pos"}>{DECISION_LABEL[x.decision]}</Pill>
                          )}
                          <span className="mt-1 block text-[12px] text-ink-3">{x.auto ? "ระบบเสนอจากวันที่แจ้งและระยะประกัน" : `${x.c?.by} · ${x.c?.date}${x.c?.note ? ` · ${x.c.note}` : ""}`}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {adding && <AddItem onClose={() => setAdding(false)} defaultProject={project || delivered[0]?.id || ""} />}
      {gen && <Generate onClose={() => setGen(false)} defaultProject={project || delivered.find((p) => !covered.has(p.id))?.id || delivered[0]?.id || ""} />}
      {book && <Book items={book} onClose={() => setBook(null)} />}
    </>
  );
}

function Timeline({ rows }: { rows: { w: WarrantyItem; end: string; st: WarrantyState }[] }) {
  const shown = rows.filter((x) => x.end >= addDays(TODAY, -365)).slice(0, 60);
  if (!shown.length)
    return (
      <Card>
        <Empty>ไม่มีรายการในช่วงนี้</Empty>
      </Card>
    );
  const from = shown.reduce((m, x) => (x.w.start < m ? x.w.start : m), TODAY);
  const to = shown.reduce((m, x) => (x.end > m ? x.end : m), TODAY);
  const span = Math.max(1, daysDiff(from, to));
  const pct = (d: string) => (daysDiff(from, d) / span) * 100;
  const years: string[] = [];
  for (let y = Number(from.slice(0, 4)) + 1; y <= Number(to.slice(0, 4)); y++) years.push(`${y}-01-01`);
  return (
    <Card>
      <CardHead title="ไทม์ไลน์การรับประกัน" meta="เรียงตามวันหมดอายุ" />
      <div className="px-5 py-4">
        <div className="relative mb-2 ml-[280px] h-4 text-[11px] text-ink-3">
          {years.map((y) => (
            <span key={y} className="absolute -translate-x-1/2 font-mono" style={{ left: `${pct(y)}%` }}>
              {Number(y.slice(0, 4)) + 543}
            </span>
          ))}
        </div>
        <ul className="flex flex-col gap-1.5">
          {shown.map(({ w, end, st }) => (
            <li key={w.id} className="grid grid-cols-[280px_1fr] items-center text-[12px]">
              <span className="truncate pr-3">
                <span className="font-mono text-ink-3">{w.projectId}</span> {w.label}
              </span>
              <div className="relative h-4 rounded-[3px] bg-raised">
                {years.map((y) => (
                  <span key={y} className="absolute inset-y-0 w-px bg-line" style={{ left: `${pct(y)}%` }} />
                ))}
                <span className={cx("absolute inset-y-0.5 rounded-[3px]", st === "expired" ? "bg-deep" : st === "expiring" ? "bg-warn" : "bg-ink")} style={{ left: `${pct(w.start)}%`, width: `${Math.max(0.5, pct(end) - pct(w.start))}%` }} title={`${thDate(w.start)} – ${thDate(end)}`} />
                <span className="absolute -inset-y-0.5 w-px bg-accent" style={{ left: `${pct(TODAY)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

function AddItem({ onClose, defaultProject }: { onClose: () => void; defaultProject: string }) {
  const delivered = projects.filter((p) => p.handedOver);
  const [f, setF] = useState({ projectId: defaultProject, category: "equipment" as WarrantyCategory, label: "", months: "12", start: getProject(defaultProject)?.handedOver ?? TODAY, source: "manufacturer" as WarrantyItem["source"], supplier: "", serial: "", system: "hvac" as SystemKey, note: "" });
  return (
    <Modal
      open
      onClose={onClose}
      title="เพิ่มรายการรับประกัน"
      width={620}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn
            primary
            disabled={!f.label.trim() || !f.projectId}
            onClick={() => {
              warrantyItems.upsert({ id: nextWarrantyId(f.projectId), projectId: f.projectId, category: f.category, label: f.label.trim(), months: Number(f.months) || 12, start: f.start, source: f.source, supplier: f.supplier.trim() || undefined, serial: f.serial.trim() || undefined, system: f.system, note: f.note.trim() || undefined });
              onClose();
            }}
          >
            บันทึก
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="บ้าน">
          <Select label="บ้าน" value={f.projectId} onChange={(v) => setF({ ...f, projectId: v, start: getProject(v)?.handedOver ?? f.start })}>
            {delivered.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} · {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="หมวด">
          <Select label="หมวด" value={f.category} onChange={(v) => setF({ ...f, category: v as WarrantyCategory, source: v === "equipment" ? "manufacturer" : "company" })}>
            {Object.entries(WARRANTY_CAT_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <div className="col-span-2">
          <Field label="รายการ">
            <input className={inputCls} value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="เช่น เครื่องปรับอากาศ · คอมเพรสเซอร์" />
          </Field>
        </div>
        <Field label="ผู้รับประกัน">
          <Select label="ผู้รับประกัน" value={f.source} onChange={(v) => setF({ ...f, source: v as WarrantyItem["source"] })}>
            <option value="company">บริษัท</option>
            <option value="manufacturer">ผู้ผลิต/ผู้ขาย</option>
          </Select>
        </Field>
        <Field label="ชื่อผู้ผลิต/ตัวแทน">
          <input className={inputCls} value={f.supplier} onChange={(e) => setF({ ...f, supplier: e.target.value })} disabled={f.source === "company"} />
        </Field>
        <Field label="เริ่มคุ้มครอง">
          <input type="date" className={inputCls} value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} />
        </Field>
        <Field label="ระยะ (เดือน)">
          <input className={cx(inputCls, "num font-mono")} inputMode="numeric" value={f.months} onChange={(e) => setF({ ...f, months: e.target.value.replace(/[^\d]/g, "") })} />
        </Field>
        <Field label="ระบบงาน">
          <Select label="ระบบงาน" value={f.system} onChange={(v) => setF({ ...f, system: v as SystemKey })}>
            {(Object.keys(SYSTEM_LABEL) as SystemKey[]).map((k) => (
              <option key={k} value={k}>
                {SYSTEM_LABEL[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="หมายเลขเครื่อง (ถ้ามี)">
          <input className={cx(inputCls, "font-mono")} value={f.serial} onChange={(e) => setF({ ...f, serial: e.target.value })} />
        </Field>
        <div className="col-span-2">
          <Field label="หมายเหตุ / เงื่อนไข">
            <input className={inputCls} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

function Generate({ onClose, defaultProject }: { onClose: () => void; defaultProject: string }) {
  const s = useFieldSettings();
  const delivered = projects.filter((p) => p.handedOver);
  const [pid, setPid] = useState(defaultProject);
  const [start, setStart] = useState(getProject(defaultProject)?.handedOver ?? TODAY);
  const [months, setMonths] = useState<Record<string, string>>(Object.fromEntries(Object.entries(s.warrantyMonths).map(([k, v]) => [k, String(v)])));
  const cats = ["structure", "roof", "general", "system"] as const;
  return (
    <Modal
      open
      onClose={onClose}
      title="สร้างรายการประกันมาตรฐานของบริษัท"
      width={560}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn
            primary
            onClick={() => {
              const n = generateWarranty(pid, start, Object.fromEntries(cats.map((c) => [c, Number(months[c]) || s.warrantyMonths[c]])));
              window.alert(n ? `เพิ่ม ${n} รายการ` : "บ้านหลังนี้มีรายการครบทุกหมวดแล้ว");
              onClose();
            }}
          >
            สร้างรายการ
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="บ้าน">
          <Select
            label="บ้าน"
            value={pid}
            onChange={(v) => {
              setPid(v);
              setStart(getProject(v)?.handedOver ?? start);
            }}
          >
            {delivered.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} · {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="วันส่งมอบ (เริ่มประกัน)">
          <input type="date" className={inputCls} value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        {cats.map((c) => (
          <Field key={c} label={`${WARRANTY_CAT_LABEL[c]} (เดือน)`}>
            <input className={cx(inputCls, "num font-mono")} inputMode="numeric" value={months[c]} onChange={(e) => setMonths({ ...months, [c]: e.target.value.replace(/[^\d]/g, "") })} />
          </Field>
        ))}
      </div>
      <p className="mt-3 text-[12px] text-ink-3">ระยะตามสัญญาของบ้านหลังนี้ ตั้งต่างจากค่าเริ่มต้นได้ · ตาม ป.พ.พ. ม.600 หรือสัญญา ตรวจสอบสัญญาจริง</p>
    </Modal>
  );
}

function Book({ items, onClose }: { items: WarrantyItem[]; onClose: () => void }) {
  const qcs = team.filter((m) => m.role === "qc" && m.active);
  const first = items.reduce((m, w) => (warrantyEnd(w) < m ? warrantyEnd(w) : m), "9999-12-31");
  const [date, setDate] = useState(addDays(TODAY, 7) < first ? addDays(TODAY, 7) : TODAY);
  const [who, setWho] = useState(qcs[0]?.name ?? "");
  const p = getProject(items[0]?.projectId ?? "");
  return (
    <Modal
      open
      onClose={onClose}
      title={`นัดตรวจก่อนหมดประกัน · ${p?.name ?? ""}`}
      width={520}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn
            primary
            onClick={() => {
              const ins = bookPreExpiryInspection(items[0].projectId, items, date, who);
              window.alert(`สร้างนัดตรวจ ${ins.id} แล้ว`);
              onClose();
            }}
          >
            สร้างนัดตรวจ
          </Btn>
        </>
      }
    >
      <ul className="mb-3 text-[13px]">
        {items.map((w) => (
          <li key={w.id} className="flex justify-between border-b border-line py-1">
            <span>{w.label}</span>
            <span className="num font-mono text-warn">{thDate(warrantyEnd(w))}</span>
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-2 gap-3">
        <Field label="วันที่นัด">
          <input type="date" className={inputCls} value={date} max={first} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="ผู้ตรวจ">
          <Select label="ผู้ตรวจ" value={who} onChange={setWho}>
            {qcs.map((m) => (
              <option key={m.id}>{m.name}</option>
            ))}
          </Select>
        </Field>
      </div>
      <p className="mt-3 text-[12px] text-ink-3">ตรวจพร้อมลูกค้า บันทึกข้อบกพร่องเป็นแจ้งซ่อมในประกันก่อนวันหมดอายุ</p>
    </Modal>
  );
}
