"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ClipboardCheck, Link2, Pencil, Plus, Search, X } from "lucide-react";
import { Card, CardHead, cx, inputCls } from "@/components/ui";
import { suppliers } from "@/lib/procurement";
import { thDate, TODAY } from "@/lib/data";
import { fmt, sum } from "@/lib/accounting/money";
import {
  addDaysIso,
  certCol,
  ensureSupplier,
  PREQUAL_CRITERIA,
  PREQUAL_LABEL,
  PREQUAL_TONE,
  prequalResult,
  prequalTotal,
  ratingScore,
  scCol,
  subCol,
  TRADES,
  useAccess,
  useContractSettings,
  type Prequal,
  type SubcontractorX,
} from "@/lib/contracts";
import { areaCls, Baht, Btn, CheckNote, Empty, FilterField, Header, I, KV, Labeled, Mini, Modal, numInput, Pill, Select, StatCard, StatusPill, tableCls, td, tdR, th, thR, useHydrated } from "./bits";
import { SubcontractForm, SubcontractPanel, SubcontractTable } from "./subcontracts";

const avgRating = (s: SubcontractorX) => (s.ratings?.length ? s.ratings.reduce((t, r) => t + ratingScore(r), 0) / s.ratings.length : undefined);

function insTone(d: string | undefined, warn: number) {
  if (!d) return { tone: "neutral" as const, text: "ไม่มีข้อมูล" };
  if (d < TODAY) return { tone: "neg" as const, text: `หมดอายุ ${thDate(d)}` };
  if (d <= addDaysIso(TODAY, warn)) return { tone: "warn" as const, text: `หมด ${thDate(d)}` };
  return { tone: "neutral" as const, text: thDate(d) };
}

export function SubcontractorsView() {
  const list = subCol.use();
  const scs = scCol.use();
  const s = useContractSettings();
  const { edit } = useAccess();
  const hydrated = useHydrated();
  const [q, setQ] = useState("");
  const [trade, setTrade] = useState("");
  const [status, setStatus] = useState("");
  const [ins, setIns] = useState(false);
  const [form, setForm] = useState(false);

  const expiring = (x: SubcontractorX) => [x.insuranceExpiry, x.compFundExpiry].some((d) => d && d <= addDaysIso(TODAY, s.insuranceWarnDays));
  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    return list
      .filter((x) => !trade || x.trades.includes(trade))
      .filter((x) => !status || x.prequal === status)
      .filter((x) => !ins || expiring(x))
      .filter((x) => !n || `${x.id} ${x.name} ${x.taxId ?? ""} ${x.contact} ${x.phone}`.toLowerCase().includes(n));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, q, trade, status, ins, s.insuranceWarnDays]);
  const filtered = q || trade || status || ins;

  return (
    <>
      <Header
        eyebrow="สัญญา & เงินในสัญญา"
        title="ผู้รับเหมาช่วง"
        sub="ทะเบียนผู้รับเหมาช่วงตามประเภทงาน ผลการคัดเลือกก่อนจ้าง ประกันภัยและกองทุนเงินทดแทน คะแนนหลังจบงาน และสัญญาจ้างที่ผูกกับผู้ขายในระบบจัดซื้อเพื่อจ่ายเงิน"
        actions={
          edit && (
            <Btn primary onClick={() => setForm(true)}>
              <Plus {...I} />
              เพิ่มผู้รับเหมาช่วง
            </Btn>
          )
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="ผ่านการคัดเลือก" value={list.filter((x) => x.prequal === "approved").length} unit="ราย" note={`ทั้งหมด ${list.length} ราย`} onClick={() => setStatus(status === "approved" ? "" : "approved")} active={status === "approved"} />
        <StatCard label="รอประเมิน" value={list.filter((x) => x.prequal === "pending").length} unit="ราย" onClick={() => setStatus(status === "pending" ? "" : "pending")} active={status === "pending"} />
        <StatCard label={`ประกันภัยหมด/ใกล้หมด ${s.insuranceWarnDays} วัน`} value={hydrated ? list.filter(expiring).length : "–"} unit="ราย" tone={list.some(expiring) ? "neg" : undefined} onClick={() => setIns(!ins)} active={ins} />
        <StatCard label="สัญญาที่ดำเนินการ" value={scs.filter((x) => x.status === "active").length} unit="สัญญา" note={`มูลค่า ${(sum(scs.filter((x) => x.status === "active").map((x) => x.value)) / 1e6).toFixed(2)} ล้านบาท`} />
      </div>

      <Card className="mb-4">
        <div className="grid grid-cols-2 gap-3 px-4 py-3 lg:grid-cols-5">
          <FilterField label="ค้นหา" className="col-span-2">
            <div className="relative">
              <Search {...I} className="pointer-events-none absolute left-2.5 top-2.5 text-ink-3" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ชื่อ เลขผู้เสียภาษี ผู้ติดต่อ" className={cx(inputCls, "w-full pl-8")} />
            </div>
          </FilterField>
          <FilterField label="ประเภทงาน">
            <Select label="ประเภทงาน" value={trade} onChange={setTrade}>
              <option value="">ทุกประเภท</option>
              {TRADES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="ผลการคัดเลือก">
            <Select label="ผลการคัดเลือก" value={status} onChange={setStatus}>
              <option value="">ทั้งหมด</option>
              {Object.entries(PREQUAL_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </FilterField>
        </div>
        <div className="flex items-center gap-3 border-t border-line px-4 py-2 text-[13px] text-ink-3">
          <span className="num font-mono text-[12px]">{rows.length} ราย</span>
          {filtered && (
            <button type="button" onClick={() => (setQ(""), setTrade(""), setStatus(""), setIns(false))} className="inline-flex items-center gap-1 text-ink-2 hover:text-ink">
              <X {...I} />
              ล้างตัวกรอง
            </button>
          )}
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className={cx(tableCls, "min-w-[980px]")}>
            <thead>
              <tr>
                <th className={cx(th, "pl-5")}>ผู้รับเหมาช่วง</th>
                <th className={th}>ประเภทงาน</th>
                <th className={thR}>คะแนนคัดเลือก</th>
                <th className={thR}>คะแนนงาน</th>
                <th className={th}>ประกันภัย</th>
                <th className={thR}>คนงาน</th>
                <th className={thR}>สัญญา</th>
                <th className={cx(th, "pr-5")}>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((x) => {
                const mine = scs.filter((sc) => sc.subcontractorId === x.id);
                const it = insTone(x.insuranceExpiry, s.insuranceWarnDays);
                const r = avgRating(x);
                return (
                  <tr key={x.id} className="hover:bg-raised/60">
                    <td className={cx(td, "pl-5")}>
                      <Link href={`/subcontractors/${x.id}`} className="hover:underline">
                        {x.name}
                        <span className="block font-mono text-[12px] text-ink-3">
                          {x.id} · {x.taxId ?? "ไม่มีเลขผู้เสียภาษี"}
                        </span>
                      </Link>
                    </td>
                    <td className={td}>
                      <div className="flex max-w-[260px] flex-wrap gap-1">
                        {x.trades.map((t) => (
                          <Pill key={t}>{t}</Pill>
                        ))}
                      </div>
                    </td>
                    <td className={tdR}>
                      <span className="num font-mono">{x.prequalScore ?? "–"}</span>
                    </td>
                    <td className={tdR}>
                      <span className="num font-mono">{r !== undefined ? r.toFixed(1) : "–"}</span>
                    </td>
                    <td className={td}>{hydrated ? <Pill tone={it.tone}>{it.text}</Pill> : null}</td>
                    <td className={tdR}>
                      <span className="num font-mono">{x.workers ?? "–"}</span>
                    </td>
                    <td className={tdR}>
                      <span className="num font-mono">{mine.length}</span>
                      {mine.length > 0 && (
                        <span className="block text-[12px] text-ink-3">
                          <Baht v={sum(mine.map((m) => m.value))} />
                        </span>
                      )}
                    </td>
                    <td className={cx(td, "pr-5")}>
                      <StatusPill k={x.prequal} labels={PREQUAL_LABEL} tones={PREQUAL_TONE} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <Empty>{list.length ? "ไม่พบผู้รับเหมาช่วงตามตัวกรอง" : "ยังไม่มีผู้รับเหมาช่วง"}</Empty>}
      </Card>
      {form && <SubForm onClose={() => setForm(false)} />}
    </>
  );
}

export function SubcontractorDetail({ id }: { id: string }) {
  const sp = useSearchParams();
  const x = subCol.use().find((s) => s.id === id);
  const hydrated = useHydrated();
  if (!x) return <Card>{hydrated ? <Empty>ไม่พบผู้รับเหมาช่วง {id}</Empty> : <div className="h-[40vh]" />}</Card>;
  return <DetailBody x={x} initSc={sp.get("sc") ?? undefined} />;
}

function DetailBody({ x, initSc }: { x: SubcontractorX; initSc?: string }) {
  const { edit, approve } = useAccess();
  const s = useContractSettings();
  const hydrated = useHydrated();
  const scs = scCol.use().filter((sc) => sc.subcontractorId === x.id);
  const certs = certCol.use();
  const sups = suppliers.use();
  const [open, setOpen] = useState<string | undefined>(initSc ?? scs[0]?.id);
  const [form, setForm] = useState(false);
  const [pq, setPq] = useState(false);
  const [newSc, setNewSc] = useState(false);
  const sel = scs.find((sc) => sc.id === open);
  const sup = sups.find((v) => v.id === x.supplierId);
  const paid = sum(certs.filter((c) => c.side === "sub" && scs.some((sc) => sc.id === c.subcontractId) && (c.status === "certified" || c.status === "paid")).map((c) => c.net));
  const r = avgRating(x);
  const ins = insTone(x.insuranceExpiry, s.insuranceWarnDays);
  const comp = insTone(x.compFundExpiry, s.insuranceWarnDays);

  return (
    <>
      <Link href="/subcontractors" className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-ink-2 hover:text-ink">
        <ArrowLeft {...I} />
        ผู้รับเหมาช่วงทั้งหมด
      </Link>
      <Header
        eyebrow={`${x.id} · ${x.trades.join(" · ")}`}
        title={x.name}
        sub={
          <span className="flex flex-wrap items-center gap-2">
            <StatusPill k={x.prequal} labels={PREQUAL_LABEL} tones={PREQUAL_TONE} />
            {x.note && <span className="text-[13px] text-ink-2">{x.note}</span>}
          </span>
        }
        actions={
          <>
            {edit && (
              <Btn onClick={() => setForm(true)}>
                <Pencil {...I} />
                แก้ไข
              </Btn>
            )}
            {approve && (
              <Btn onClick={() => setPq(true)}>
                <ClipboardCheck {...I} />
                ประเมินคัดเลือก
              </Btn>
            )}
            {edit && !sup && (
              <Btn onClick={() => ensureSupplier(x)}>
                <Link2 {...I} />
                สร้างผู้ขายในระบบจัดซื้อ
              </Btn>
            )}
            {edit && x.prequal !== "blacklisted" && (
              <Btn primary onClick={() => setNewSc(true)}>
                <Plus {...I} />
                สัญญาจ้างใหม่
              </Btn>
            )}
          </>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Mini label="คะแนนคัดเลือก" value={`${x.prequalScore ?? "–"} / 100`} sub={x.prequalDate ? `ประเมิน ${thDate(x.prequalDate)}` : undefined} />
        <Mini label="คะแนนหลังจบงาน" value={r !== undefined ? `${r.toFixed(1)} / 5` : "–"} sub={`${x.ratings?.length ?? 0} งาน`} />
        <Mini label="สัญญา" value={`${scs.length}`} sub={`มูลค่า ${fmt(sum(scs.map((sc) => sc.value)))}`} />
        <Mini label="รับรองจ่ายแล้ว (สุทธิ)" value={fmt(paid)} />
        <Mini label="คนงาน" value={`${x.workers ?? "–"} คน`} />
      </div>
      <div className="mb-4 grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHead title="ข้อมูลผู้รับเหมาช่วง" />
          <div className="px-5 py-3">
            <KV k="เลขผู้เสียภาษี">
              <span className="font-mono">{x.taxId ?? "–"}</span>
            </KV>
            <KV k="ผู้ติดต่อ">
              {x.contact} · {x.phone}
            </KV>
            {x.email && <KV k="อีเมล">{x.email}</KV>}
            {x.address && <KV k="ที่อยู่">{x.address}</KV>}
            <KV k="ผู้ขายในจัดซื้อ">
              {sup ? (
                <Link href={`/suppliers?id=${sup.id}`} className="hover:underline">
                  {sup.id} · หัก ณ ที่จ่าย {sup.whtRate}% · เครดิต {sup.paymentTerms} วัน
                </Link>
              ) : (
                <span className="text-ink-3">ยังไม่ผูก (สร้างอัตโนมัติเมื่อรับรองงวดแรก)</span>
              )}
            </KV>
            {x.since && <KV k="ขึ้นทะเบียน">{thDate(x.since)}</KV>}
          </div>
        </Card>
        <Card>
          <CardHead title="การคัดเลือก (prequalification)" meta={x.prequalScore !== undefined ? `${x.prequalScore} คะแนน` : undefined} />
          <div className="px-5 py-3">
            {PREQUAL_CRITERIA.map((c) => {
              const v = x.prequalChecklist?.[c.key] ?? 0;
              return (
                <div key={c.key} className="border-b border-line py-1.5 text-[13px]">
                  <div className="flex justify-between">
                    <span className="text-ink-2">{c.label}</span>
                    <span className="num font-mono">
                      {v} / {c.max}
                    </span>
                  </div>
                  <div className="mt-1 h-1 rounded-full bg-raised">
                    <div className="h-1 rounded-full bg-ink" style={{ width: `${(v / c.max) * 100}%` }} />
                  </div>
                </div>
              );
            })}
            <p className="mt-2 text-[12px] text-ink-3">ผ่านเกณฑ์ 70 คะแนนขึ้นไป · 50–69 ต้องทบทวน</p>
          </div>
        </Card>
        <Card>
          <CardHead title="ประกันภัยและกองทุน" />
          <div className="px-5 py-3">
            <KV k="ประกันภัยความรับผิด">{hydrated ? <Pill tone={ins.tone}>{ins.text}</Pill> : null}</KV>
            <KV k="กองทุนเงินทดแทน">{hydrated ? <Pill tone={comp.tone}>{comp.text}</Pill> : null}</KV>
            <p className="mt-2">
              <CheckNote>ผู้รับเหมาช่วงที่มีลูกจ้างต้องขึ้นทะเบียนกองทุนเงินทดแทน · ตรวจสอบกับประกาศล่าสุด</CheckNote>
            </p>
          </div>
          {(x.ratings ?? []).length > 0 && (
            <div className="border-t border-line px-5 py-3 text-[13px]">
              <p className="mb-1 font-medium">คะแนนหลังจบงาน</p>
              {(x.ratings ?? []).map((rt) => (
                <p key={rt.subcontractId} className="text-ink-2">
                  <span className="num font-mono text-ink">{ratingScore(rt).toFixed(1)}</span> · {rt.subcontractId} · {rt.note}
                </p>
              ))}
            </div>
          )}
        </Card>
      </div>
      <Card className="mb-4">
        <CardHead title="สัญญาจ้างเหมาช่วง" meta={`${scs.length} สัญญา`} />
        <SubcontractTable list={scs} showProject onOpen={(sc) => setOpen(sc.id)} selected={open} />
      </Card>
      {sel && <SubcontractPanel sc={sel} />}
      {form && <SubForm initial={x} onClose={() => setForm(false)} />}
      {pq && <PrequalForm x={x} onClose={() => setPq(false)} />}
      {newSc && <SubcontractForm subcontractorId={x.id} onClose={() => setNewSc(false)} onSaved={(sc) => setOpen(sc.id)} />}
    </>
  );
}

function SubForm({ initial, onClose }: { initial?: SubcontractorX; onClose: () => void }) {
  const [f, setF] = useState<SubcontractorX>(
    initial ?? { id: "", name: "", contact: "", phone: "", trades: [], prequal: "pending", since: TODAY, ratings: [] },
  );
  const sups = suppliers.use();
  const err = !f.name.trim() ? "กรอกชื่อ" : !f.trades.length ? "เลือกประเภทงานอย่างน้อย 1 ประเภท" : f.taxId && !/^\d{13}$/.test(f.taxId) ? "เลขผู้เสียภาษี 13 หลัก" : "";
  const text = (k: keyof SubcontractorX, label: string, cls = "") => (
    <Labeled label={label} className={cls}>
      <input className={inputCls} value={String(f[k] ?? "")} onChange={(e) => setF({ ...f, [k]: e.target.value || undefined })} />
    </Labeled>
  );
  const date = (k: "insuranceExpiry" | "compFundExpiry", label: string) => (
    <Labeled label={label}>
      <input type="date" className={inputCls} value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value || undefined })} />
    </Labeled>
  );
  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? `แก้ไข ${initial.name}` : "เพิ่มผู้รับเหมาช่วง"}
      width={760}
      footer={
        <>
          {err && <span className="mr-auto text-[13px] text-neg">{err}</span>}
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn
            primary
            disabled={!!err}
            onClick={() => {
              subCol.upsert({ ...f, id: f.id || subCol.nextId("SUB-", 4), name: f.name.trim(), contact: f.contact ?? "", phone: f.phone ?? "" });
              onClose();
            }}
          >
            บันทึก
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {text("name", "ชื่อบริษัท / ชื่อช่าง", "sm:col-span-2")}
        {text("taxId", "เลขประจำตัวผู้เสียภาษี")}
        <Labeled label="จำนวนคนงาน">
          <input className={numInput} inputMode="numeric" value={String(f.workers ?? "")} onChange={(e) => setF({ ...f, workers: Number(e.target.value) || undefined })} />
        </Labeled>
        {text("contact", "ผู้ติดต่อ")}
        {text("phone", "โทรศัพท์")}
        {text("email", "อีเมล")}
        <Labeled label="ผูกกับผู้ขายในระบบจัดซื้อ">
          <select className={inputCls} value={f.supplierId ?? ""} onChange={(e) => setF({ ...f, supplierId: e.target.value || undefined })}>
            <option value="">ไม่ผูก (สร้างให้อัตโนมัติเมื่อตั้งหนี้)</option>
            {sups.map((v) => (
              <option key={v.id} value={v.id}>
                {v.id} {v.name}
              </option>
            ))}
          </select>
        </Labeled>
        {text("address", "ที่อยู่", "sm:col-span-2")}
        {date("insuranceExpiry", "ประกันภัยความรับผิดหมดอายุ")}
        {date("compFundExpiry", "กองทุนเงินทดแทนหมดอายุ")}
        <Labeled label="หมายเหตุ" className="sm:col-span-2">
          <textarea className={areaCls} value={f.note ?? ""} onChange={(e) => setF({ ...f, note: e.target.value || undefined })} />
        </Labeled>
      </div>
      <p className="mb-1.5 mt-3 text-[13px] text-ink-2">ประเภทงาน</p>
      <div className="flex flex-wrap gap-1.5">
        {TRADES.map((t) => {
          const on = f.trades.includes(t);
          return (
            <button key={t} type="button" aria-pressed={on} onClick={() => setF({ ...f, trades: on ? f.trades.filter((x) => x !== t) : [...f.trades, t] })} className={cx("h-7 rounded-[6px] border px-2 text-[12px]", on ? "border-ink bg-ink text-card" : "border-line-strong text-ink-2 hover:bg-raised")}>
              {t}
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

function PrequalForm({ x, onClose }: { x: SubcontractorX; onClose: () => void }) {
  const [p, setP] = useState<Prequal>(x.prequalChecklist ?? { experience: 0, financial: 0, safety: 0, references: 0 });
  const total = prequalTotal(p);
  const [status, setStatus] = useState<SubcontractorX["prequal"]>(x.prequal);
  const [note, setNote] = useState(x.note ?? "");
  const suggested = prequalResult(total);
  return (
    <Modal
      open
      onClose={onClose}
      title={`ประเมินคัดเลือก · ${x.name}`}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn
            primary
            onClick={() => {
              subCol.upsert({ ...x, prequalChecklist: p, prequalScore: total, prequal: status, prequalDate: TODAY, note: note.trim() || undefined });
              onClose();
            }}
          >
            บันทึกผลประเมิน
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        {PREQUAL_CRITERIA.map((c) => (
          <Labeled key={c.key} label={`${c.label} (เต็ม ${c.max})`}>
            <input className={numInput} inputMode="numeric" value={String(p[c.key])} onChange={(e) => setP({ ...p, [c.key]: Math.min(c.max, Math.max(0, Number(e.target.value) || 0)) })} />
          </Labeled>
        ))}
        <Labeled label="ผลการคัดเลือก">
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as SubcontractorX["prequal"])}>
            {Object.entries(PREQUAL_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Labeled>
        <div className="flex flex-col justify-end text-[13px]">
          <p>
            รวม <span className="num font-mono font-medium">{total}</span> / 100
          </p>
          <p className="text-ink-3">ระบบแนะนำ: {PREQUAL_LABEL[suggested]}</p>
        </div>
        <Labeled label="บันทึก/เหตุผล" className="col-span-2">
          <textarea className={areaCls} value={note} onChange={(e) => setNote(e.target.value)} />
        </Labeled>
      </div>
    </Modal>
  );
}
