"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, FileText, Plus, Printer, Save, Trash2, Trophy } from "lucide-react";
import { Card, CardHead, cx, Field, inputCls } from "@/components/ui";
import { areaCls, Btn, Empty, I, IconBtn, KV, Pill, Segmented, Select, StatCard, useHydrated } from "@/components/ops/bits";
import { PrintSheet } from "@/components/accounting/bits";
import { DocHeader, DocRow, DocSection } from "@/components/ops/doc";
import { MediaField } from "@/components/media/media-field";
import { thDate, TODAY } from "@/lib/data";
import { bidFromMarkup, bidPriceOf, bondAmount, boqTotals, daysLate, groupTotals, kAdjustment, kClaimDeadline, kValue, lineCost, medianPrice, penalty, vsPct } from "@/lib/tender/calc";
import { boqTemplate, saveTender, tenders, useTenderSettings } from "@/lib/tender/store";
import { BOND_TYPE_LABEL, INDEX_LABEL, METHOD_LABEL, SOURCE_LABEL, TENDER_STATUS_LABEL, type Award, type BoqLine, type Bond, type BondType, type Tender, type TenderStatus } from "@/lib/tender/types";
import { canEdit } from "@/lib/permissions";
import { useMe } from "@/lib/use-me";
import { TENDER_TONE, mb } from "./tenders-view";
import { TenderSettingsButton, VERIFY } from "./tender-settings";

type Tab = "overview" | "boq" | "result" | "contract" | "k";
const baht = (n: number) => `฿${Math.round(n).toLocaleString("th-TH")}`;
const money2 = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const toNum = (v: string) => Number(v.replace(/[^\d.-]/g, "")) || 0;
const numCls = cx(inputCls, "num h-8 px-2 text-right font-mono text-[13px]");
const DAY = 86400000;
const left = (iso: string) => Math.round((Date.parse(iso) - Date.parse(TODAY)) / DAY);

export function TenderDetail({ id }: { id: string }) {
  const list = tenders.use();
  const hydrated = useHydrated();
  const t = list.find((x) => x.id === id);
  if (!t)
    return (
      <Card>
        <Empty>{hydrated ? `ไม่พบงานประมูล ${id}` : "กำลังโหลด"}</Empty>
      </Card>
    );
  return (
    <Suspense fallback={<div className="h-[60vh]" />}>
      <Sheet key={t.id} saved={t} />
    </Suspense>
  );
}

function Sheet({ saved }: { saved: Tender }) {
  const sp = useSearchParams();
  const router = useRouter();
  const me = useMe();
  const editable = canEdit(me.role, "tender");
  const [t, setT] = useState<Tender>(saved);
  const [tab, setTab] = useState<Tab>((sp.get("tab") as Tab) || "overview");
  const dirty = JSON.stringify(t) !== JSON.stringify(saved);
  const set = <K extends keyof Tender>(k: K, v: Tender[K]) => setT((x) => ({ ...x, [k]: v }));
  const bid = bidPriceOf(t);
  const egp = t.source === "egp";

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "ข้อมูลและเอกสาร" },
    { key: "boq", label: egp ? "BOQ / ราคากลาง" : "BOQ / ราคา" },
    { key: "result", label: "ผลการประมูล" },
    ...(t.status === "won" ? ([{ key: "contract", label: "สัญญา/ค่าปรับ" }, ...(egp ? [{ key: "k", label: "ค่า K" }] : [])] as { key: Tab; label: string }[]) : []),
  ];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/tenders" className="mr-1 inline-flex h-8 items-center gap-1.5 rounded-[8px] px-2 text-[13px] text-ink-2 hover:bg-raised hover:text-ink">
            <ArrowLeft {...I} />
            กลับ
          </Link>
          <Pill mono>{t.id}</Pill>
          <Pill tone={egp ? "accent" : "neutral"}>{SOURCE_LABEL[t.source]}</Pill>
          <Pill tone={TENDER_TONE[t.status]}>{TENDER_STATUS_LABEL[t.status]}</Pill>
        </div>
        <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
          <TenderSettingsButton label="ตั้งค่า" />
          {editable && (
            <>
              <Select label="สถานะ" value={t.status} onChange={(v) => set("status", v as TenderStatus)} className="w-[180px]">
                {Object.entries(TENDER_STATUS_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
              <Btn primary disabled={!dirty} onClick={() => saveTender(t)}>
                <Save {...I} />
                {dirty ? "บันทึก" : "บันทึกแล้ว"}
              </Btn>
              <Btn
                danger
                onClick={() => {
                  if (window.confirm(`ลบ ${t.id}`)) {
                    tenders.remove(t.id);
                    router.push("/tenders");
                  }
                }}
              >
                <Trash2 {...I} />
              </Btn>
            </>
          )}
        </div>
      </div>
      <h1 className="text-[26px] font-normal leading-tight">{t.title}</h1>
      <p className="mb-5 mt-1 text-ink-2">
        {t.client} · {t.province} · {METHOD_LABEL[t.method]}
      </p>

      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="วงเงินงบประมาณ" value={t.budget ? mb(t.budget) : "–"} unit={t.budget ? "บาท" : undefined} note={t.medianPrice ? `ราคากลาง ${baht(t.medianPrice)}` : "ยังไม่ประกาศราคากลาง"} />
        <StatCard label="ราคาที่เสนอ" value={bid ? mb(bid) : "–"} unit={bid ? "บาท" : undefined} note={t.medianPrice && bid ? `${vsPct(bid, t.medianPrice) <= 0 ? "ต่ำกว่า" : "สูงกว่า"}ราคากลาง ${Math.abs(vsPct(bid, t.medianPrice)).toFixed(2)}%` : `กำไรบวก ${t.markupPct}%`} />
        <StatCard label="ยื่นซอง" value={thDate(t.submitDue)} note={["prospect", "preparing"].includes(t.status) ? (left(t.submitDue) >= 0 ? `อีก ${left(t.submitDue)} วัน` : `เลยกำหนด ${-left(t.submitDue)} วัน`) : t.openDate ? `เปิดซอง ${thDate(t.openDate)}` : undefined} tone={["prospect", "preparing"].includes(t.status) && left(t.submitDue) <= 7 ? "neg" : undefined} />
        <StatCard label="หลักประกันซอง" value={t.bidBond ? baht(t.bidBond.amount) : "–"} note={t.bidBond ? `${BOND_TYPE_LABEL[t.bidBond.type]}${t.bidBond.returned ? " · คืนแล้ว" : t.bidBond.expiry ? ` · หมด ${thDate(t.bidBond.expiry)}` : ""}` : "ยังไม่บันทึก"} />
      </div>

      <div className="mb-4">
        <Segmented value={tab} onChange={setTab} options={tabs} />
      </div>

      {tab === "overview" && <Overview t={t} set={set} editable={editable} />}
      {tab === "boq" && <Boq t={t} set={set} editable={editable} />}
      {tab === "result" && <Result t={t} setT={setT} editable={editable} />}
      {tab === "contract" && <Contract t={t} set={set} editable={editable} />}
      {tab === "k" && <KTab t={t} set={set} editable={editable} />}

      {dirty && editable && (
        <div className="sticky bottom-4 z-10 mt-4 flex items-center justify-between gap-3 rounded-[12px] border border-line-strong bg-card px-4 py-2 shadow-[0_4px_16px_rgba(31,27,22,0.12)]">
          <span className="text-[13px] text-ink-2">มีการแก้ไขที่ยังไม่บันทึก</span>
          <div className="flex gap-2">
            <Btn small onClick={() => setT(saved)}>
              ยกเลิก
            </Btn>
            <Btn small primary onClick={() => saveTender(t)}>
              บันทึก
            </Btn>
          </div>
        </div>
      )}
    </>
  );
}

type SetFn = <K extends keyof Tender>(k: K, v: Tender[K]) => void;

// ---------- overview ----------

function Overview({ t, set, editable }: { t: Tender; set: SetFn; editable: boolean }) {
  const s = useTenderSettings();
  const dates: [keyof Tender, string][] = [
    ["announced", "ประกาศ/ได้รับเชิญ"],
    ["siteVisit", "ดูสถานที่"],
    ["questionsDue", "ส่งคำถาม/ขอคำชี้แจง"],
    ["submitDue", "ยื่นซอง"],
    ["openDate", "เปิดซอง/พิจารณาผล"],
  ];
  const bondBase = t.medianPrice ?? t.budget ?? 0;
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card>
        <CardHead title="ข้อมูลงาน" />
        <div className="grid grid-cols-2 gap-3 px-5 py-4">
          <div className="col-span-2">
            <Field label="ชื่องาน">
              <input className={inputCls} value={t.title} disabled={!editable} onChange={(e) => set("title", e.target.value)} />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="ผู้ว่าจ้าง / หน่วยงาน">
              <input className={inputCls} value={t.client} disabled={!editable} onChange={(e) => set("client", e.target.value)} />
            </Field>
          </div>
          <Field label="วงเงินงบประมาณ (บาท)">
            <input className={cx(inputCls, "num font-mono")} value={t.budget ?? ""} disabled={!editable} onChange={(e) => set("budget", toNum(e.target.value) || undefined)} />
          </Field>
          <Field label="ราคากลางที่ประกาศ (รวม VAT)">
            <input className={cx(inputCls, "num font-mono")} value={t.medianPrice ?? ""} disabled={!editable} onChange={(e) => set("medianPrice", toNum(e.target.value) || undefined)} />
          </Field>
          {t.source === "egp" && (
            <Field label="เลขที่โครงการ e-GP">
              <input className={cx(inputCls, "font-mono")} value={t.egpNo ?? ""} disabled={!editable} onChange={(e) => set("egpNo", e.target.value || undefined)} />
            </Field>
          )}
          <Field label="ผู้รับผิดชอบจัดทำราคา">
            <input className={inputCls} value={t.owner} disabled={!editable} onChange={(e) => set("owner", e.target.value)} />
          </Field>
        </div>
        <div className="border-t border-line px-5 py-4">
          <p className="mb-2 text-[13px] font-medium">กำหนดการ</p>
          <div className="grid grid-cols-1 gap-2">
            {dates.map(([k, label]) => {
              const v = t[k] as string | undefined;
              const d = v ? left(v) : undefined;
              return (
                <div key={k} className="grid grid-cols-[160px_160px_1fr] items-center gap-3 text-[13px]">
                  <span className="text-ink-2">{label}</span>
                  <input type="date" className={cx(inputCls, "h-8 text-[13px]")} value={v ?? ""} disabled={!editable} onChange={(e) => set(k, (e.target.value || undefined) as never)} />
                  {d !== undefined && <span className={cx(d < 0 ? "text-ink-3" : d <= 7 ? "text-warn" : "text-ink-3")}>{d < 0 ? "ผ่านแล้ว" : d === 0 ? "วันนี้" : `อีก ${d} วัน`}</span>}
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHead title="TOR และเอกสารประกวดราคา" />
          <div className="flex flex-col gap-3 px-5 py-4">
            <textarea className={areaCls} value={t.torNote ?? ""} disabled={!editable} onChange={(e) => set("torNote", e.target.value || undefined)} placeholder="สรุป TOR: คุณสมบัติผู้เสนอราคา ผลงาน ระยะเวลา เงื่อนไขพิเศษ" />
            <MediaField value={t.docs} onChange={(docs) => set("docs", docs)} label="TOR แบบ BOQ ประกาศ และเอกสารยื่นซอง" />
          </div>
        </Card>
        <Card>
          <CardHead title="หลักประกันการเสนอราคา (หลักประกันซอง)" meta={`${s.bidBondPct}% ของ${t.medianPrice ? "ราคากลาง" : "วงเงิน"}`} />
          <BondForm bond={t.bidBond} base={bondBase} pct={s.bidBondPct} editable={editable} onChange={(b) => set("bidBond", b)} showReturned />
        </Card>
      </div>
    </div>
  );
}

function BondForm({ bond, base, pct, editable, onChange, showReturned }: { bond?: Bond; base: number; pct: number; editable: boolean; onChange: (b: Bond | undefined) => void; showReturned?: boolean }) {
  if (!bond)
    return (
      <div className="px-5 py-4">
        <p className="mb-2 text-[13px] text-ink-3">ยังไม่บันทึก · ยอดที่ต้องวาง {baht(bondAmount(base, pct))}</p>
        {editable && (
          <Btn small onClick={() => onChange({ type: "bank", amount: bondAmount(base, pct) })}>
            <Plus {...I} />
            บันทึกหลักประกัน
          </Btn>
        )}
      </div>
    );
  const b = bond;
  const up = (patch: Partial<Bond>) => onChange({ ...b, ...patch });
  return (
    <div className="grid grid-cols-2 gap-3 px-5 py-4">
      <Field label="ประเภท">
        <Select label="ประเภทหลักประกัน" value={b.type} onChange={(v) => up({ type: v as BondType })}>
          {Object.entries(BOND_TYPE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={`จำนวนเงิน (ควรเป็น ${baht(bondAmount(base, pct))})`}>
        <input className={cx(inputCls, "num font-mono", base > 0 && b.amount < bondAmount(base, pct) && "border-neg")} value={b.amount} disabled={!editable} onChange={(e) => up({ amount: toNum(e.target.value) })} />
      </Field>
      <Field label="ธนาคาร/สาขา">
        <input className={inputCls} value={b.bank ?? ""} disabled={!editable} onChange={(e) => up({ bank: e.target.value || undefined })} />
      </Field>
      <Field label="เลขที่หนังสือค้ำ">
        <input className={cx(inputCls, "font-mono")} value={b.ref ?? ""} disabled={!editable} onChange={(e) => up({ ref: e.target.value || undefined })} />
      </Field>
      <Field label="วันที่ออก">
        <input type="date" className={inputCls} value={b.issue ?? ""} disabled={!editable} onChange={(e) => up({ issue: e.target.value || undefined })} />
      </Field>
      <Field label="วันหมดอายุ">
        <input type="date" className={inputCls} value={b.expiry ?? ""} disabled={!editable} onChange={(e) => up({ expiry: e.target.value || undefined })} />
      </Field>
      {showReturned && (
        <Field label="วันที่ได้รับคืน">
          <input type="date" className={inputCls} value={b.returned ?? ""} disabled={!editable} onChange={(e) => up({ returned: e.target.value || undefined })} />
        </Field>
      )}
      {editable && (
        <div className="flex items-end">
          <Btn small danger onClick={() => onChange(undefined)}>
            ลบหลักประกัน
          </Btn>
        </div>
      )}
    </div>
  );
}

// ---------- BOQ & pricing ----------

function Boq({ t, set, editable }: { t: Tender; set: SetFn; editable: boolean }) {
  const s = useTenderSettings();
  const egp = t.source === "egp";
  const tot = boqTotals(t.lines);
  const groups = groupTotals(t.lines);
  const est = medianPrice(t.lines, s.factorTable, t.vatPct);
  const ours = bidFromMarkup(t.lines, t.markupPct, t.vatPct);
  const bid = bidPriceOf(t);
  const [target, setTarget] = useState(String(Math.round((t.budget ?? 5_000_000) / 1.3)));
  const setLine = (i: number, patch: Partial<BoqLine>) => set("lines", t.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const nextId = () => `L${t.lines.reduce((m, l) => Math.max(m, Number(l.id.slice(1)) || 0), 0) + 1}`;

  return (
    <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[1fr_380px]">
      <Card className="min-w-0">
        <CardHead
          title="ใบแจ้งปริมาณงานและราคา (BOQ)"
          meta={`${t.lines.length} รายการ`}
          action={
            editable && (
              <div className="flex items-center gap-2">
                <input className={cx(numCls, "w-32")} value={target} onChange={(e) => setTarget(e.target.value.replace(/[^\d]/g, ""))} aria-label="ค่างานต้นทุนเป้าหมาย" title="ค่างานต้นทุนเป้าหมาย (บาท)" />
                <Btn small onClick={() => (!t.lines.length || window.confirm("แทนที่รายการ BOQ ทั้งหมดด้วยแม่แบบ")) && set("lines", boqTemplate(Number(target) || 1_000_000, egp))}>
                  ใช้แม่แบบ
                </Btn>
              </div>
            )
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-[13px]">
            <thead>
              <tr className="text-left text-ink-3">
                <th className="px-3 py-2 font-normal">หมวด</th>
                <th className="py-2 pr-2 font-normal">รายการ</th>
                <th className="py-2 pr-2 text-right font-normal">ปริมาณ</th>
                <th className="py-2 pr-2 font-normal">หน่วย</th>
                <th className="py-2 pr-2 text-right font-normal">ค่าวัสดุ/หน่วย</th>
                <th className="py-2 pr-2 text-right font-normal">ค่าแรง/หน่วย</th>
                {egp && <th className="py-2 pr-2 text-center font-normal">ไม่คูณ F</th>}
                <th className="py-2 pr-2 text-right font-normal">รวม</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {t.lines.map((l, i) => (
                <tr key={l.id} className="border-t border-line">
                  <td className="px-3 py-1">
                    <input className={cx(inputCls, "h-8 w-36 px-2 text-[13px]")} value={l.group} disabled={!editable} onChange={(e) => setLine(i, { group: e.target.value })} aria-label="หมวด" />
                  </td>
                  <td className="py-1 pr-2">
                    <input className={cx(inputCls, "h-8 w-full min-w-[220px] px-2 text-[13px]")} value={l.description} disabled={!editable} onChange={(e) => setLine(i, { description: e.target.value })} aria-label="รายการ" />
                  </td>
                  <td className="py-1 pr-2">
                    <input className={cx(numCls, "w-20")} value={l.qty} disabled={!editable} onChange={(e) => setLine(i, { qty: toNum(e.target.value) })} aria-label="ปริมาณ" />
                  </td>
                  <td className="py-1 pr-2">
                    <input className={cx(inputCls, "h-8 w-16 px-2 text-[13px]")} value={l.unit} disabled={!editable} onChange={(e) => setLine(i, { unit: e.target.value })} aria-label="หน่วย" />
                  </td>
                  <td className="py-1 pr-2">
                    <input className={cx(numCls, "w-24")} value={l.material} disabled={!editable} onChange={(e) => setLine(i, { material: toNum(e.target.value) })} aria-label="ค่าวัสดุ" />
                  </td>
                  <td className="py-1 pr-2">
                    <input className={cx(numCls, "w-24")} value={l.labour} disabled={!editable} onChange={(e) => setLine(i, { labour: toNum(e.target.value) })} aria-label="ค่าแรง" />
                  </td>
                  {egp && (
                    <td className="py-1 pr-2 text-center">
                      <input type="checkbox" checked={!!l.noF} disabled={!editable} onChange={(e) => setLine(i, { noF: e.target.checked || undefined })} aria-label="ไม่คูณ Factor F" />
                    </td>
                  )}
                  <td className="num py-1 pr-2 text-right font-mono">{money2(lineCost(l))}</td>
                  <td className="pr-2">
                    {editable && (
                      <IconBtn label="ลบรายการ" danger onClick={() => set("lines", t.lines.filter((_, j) => j !== i))}>
                        <Trash2 {...I} />
                      </IconBtn>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-line-strong">
                <td colSpan={egp ? 7 : 6} className="px-3 py-2 text-right text-ink-2">
                  ค่างานต้นทุน (วัสดุ {money2(tot.material)} · แรง {money2(tot.labour)}
                  {tot.noF ? ` · นอก F ${money2(tot.noF)}` : ""})
                </td>
                <td className="num py-2 pr-2 text-right font-mono font-medium">{money2(tot.total)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        {editable && (
          <div className="border-t border-line px-3 py-2">
            <Btn small onClick={() => set("lines", [...t.lines, { id: nextId(), group: t.lines[t.lines.length - 1]?.group ?? "งานทั่วไป", description: "", qty: 1, unit: "งาน", material: 0, labour: 0 }])}>
              <Plus {...I} />
              เพิ่มรายการ
            </Btn>
          </div>
        )}
      </Card>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHead title="สรุปตามหมวด" />
          <ul className="px-5 py-3 text-[13px]">
            {groups.map((g) => (
              <li key={g.group} className="flex justify-between border-b border-line py-1">
                <span>{g.group}</span>
                <span className="num font-mono">{money2(g.cost)}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHead title="ราคาเสนอของเรา" />
          <div className="flex flex-col gap-3 px-5 py-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="กำไร + ค่าดำเนินการ (%)">
                <input className={cx(inputCls, "num font-mono")} value={t.markupPct} disabled={!editable} onChange={(e) => set("markupPct", toNum(e.target.value))} />
              </Field>
              <Field label="VAT (%)">
                <input className={cx(inputCls, "num font-mono")} value={t.vatPct} disabled={!editable} onChange={(e) => set("vatPct", toNum(e.target.value))} />
              </Field>
            </div>
            <KV k="ต้นทุน">{money2(ours.cost)}</KV>
            <KV k="ก่อน VAT">{money2(ours.beforeVat)}</KV>
            <KV k="รวม VAT">{money2(ours.total)}</KV>
            <Field label="ราคาที่ยื่นจริง (รวม VAT) · เว้นว่างเพื่อใช้ราคาคำนวณ">
              <input className={cx(inputCls, "num font-mono")} value={t.bidPrice ?? ""} disabled={!editable} onChange={(e) => set("bidPrice", toNum(e.target.value) || undefined)} placeholder={String(Math.round(ours.total))} />
            </Field>
            <p className="text-[13px]">
              ราคาเสนอ <span className="num font-mono font-medium">{money2(bid)}</span> · กำไรขั้นต้นประมาณ <span className="num font-mono">{bid ? ((1 - (ours.cost * (1 + t.vatPct / 100)) / bid) * 100).toFixed(1) : "0"}%</span>
            </p>
          </div>
        </Card>
        {egp && (
          <Card>
            <CardHead title="เทียบราคากลาง (Factor F)" />
            <div className="flex flex-col gap-1 px-5 py-4">
              <p className="mb-1 text-[12px] text-ink-3">{s.factorBasis}</p>
              <KV k="ค่างานต้นทุน">{money2(est.direct)}</KV>
              <KV k="Factor F">
                <span className="num font-mono">{est.factor.toFixed(4)}</span>
              </KV>
              <KV k="ต้นทุน × F">{money2(est.withF)}</KV>
              {est.outside > 0 && <KV k="รายการนอก F + VAT">{money2(est.outside)}</KV>}
              <KV k="ราคากลางที่ประเมิน">
                <span className="num font-mono font-medium">{money2(est.total)}</span>
              </KV>
              {t.medianPrice && (
                <KV k="ราคากลางที่ประกาศ">
                  {money2(t.medianPrice)} <span className="text-ink-3">({vsPct(est.total, t.medianPrice).toFixed(2)}% จากที่ประเมิน)</span>
                </KV>
              )}
              {bid > 0 && (t.medianPrice ?? est.total) > 0 && (
                <p className={cx("mt-2 rounded-[8px] px-3 py-2 text-[13px]", bid > (t.medianPrice ?? est.total) ? "bg-neg-soft text-neg" : "bg-raised text-ink-2")}>
                  ราคาเสนอ{bid > (t.medianPrice ?? est.total) ? "สูงกว่า" : "ต่ำกว่า"}ราคากลาง {Math.abs(vsPct(bid, t.medianPrice ?? est.total)).toFixed(2)}%
                  {t.budget && bid > t.budget ? " · เกินวงเงินงบประมาณ" : ""}
                </p>
              )}
              <p className="mt-2 text-[12px] text-ink-3">ตาราง Factor F ตั้งค่าได้ — {VERIFY}</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

// ---------- result ----------

function Result({ t, setT, editable }: { t: Tender; setT: (f: (x: Tender) => Tender) => void; editable: boolean }) {
  const r = t.result ?? { date: TODAY, competitors: [{ name: "บริษัทของเรา", price: Math.round(bidPriceOf(t)) }] };
  const setR = (patch: Partial<NonNullable<Tender["result"]>>) => setT((x) => ({ ...x, result: { ...r, ...patch } }));
  const sorted = [...r.competitors].sort((a, b) => a.price - b.price);
  const winner = r.competitors.find((c) => c.winner) ?? sorted[0];
  const ours = r.competitors.find((c) => c.name === "บริษัทของเรา");
  const rank = ours ? sorted.indexOf(ours) + 1 : 0;
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
      <Card>
        <CardHead title="ราคาผู้เสนอราคา" meta={`${r.competitors.length} ราย`} />
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-ink-3">
              <th className="px-5 py-2 font-normal">อันดับ</th>
              <th className="py-2 pr-2 font-normal">ผู้เสนอราคา</th>
              <th className="py-2 pr-2 text-right font-normal">ราคา (รวม VAT)</th>
              <th className="py-2 pr-2 text-right font-normal">ต่างจากเรา</th>
              <th className="py-2 pr-2 text-center font-normal">ผู้ชนะ</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {r.competitors.map((c, i) => (
              <tr key={i} className="border-t border-line">
                <td className="num px-5 py-1 font-mono text-ink-3">{sorted.indexOf(c) + 1}</td>
                <td className="py-1 pr-2">
                  <input className={cx(inputCls, "h-8 w-full px-2 text-[13px]", c.name === "บริษัทของเรา" && "font-medium")} value={c.name} disabled={!editable} onChange={(e) => setR({ competitors: r.competitors.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} aria-label="ชื่อ" />
                </td>
                <td className="py-1 pr-2">
                  <input className={cx(numCls, "w-36")} value={c.price} disabled={!editable} onChange={(e) => setR({ competitors: r.competitors.map((x, j) => (j === i ? { ...x, price: toNum(e.target.value) } : x)) })} aria-label="ราคา" />
                </td>
                <td className={cx("num py-1 pr-2 text-right font-mono", ours && c !== ours && c.price < ours.price ? "text-neg" : "text-ink-3")}>{ours && c !== ours ? `${vsPct(c.price, ours.price).toFixed(2)}%` : "–"}</td>
                <td className="py-1 pr-2 text-center">
                  <input type="radio" name="winner" checked={!!c.winner} disabled={!editable} onChange={() => setR({ competitors: r.competitors.map((x, j) => ({ ...x, winner: j === i || undefined })) })} aria-label="ผู้ชนะ" />
                </td>
                <td className="pr-3">
                  {editable && (
                    <IconBtn label="ลบ" danger onClick={() => setR({ competitors: r.competitors.filter((_, j) => j !== i) })}>
                      <Trash2 {...I} />
                    </IconBtn>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {editable && (
          <div className="border-t border-line px-5 py-2">
            <Btn small onClick={() => setR({ competitors: [...r.competitors, { name: "", price: 0 }] })}>
              <Plus {...I} />
              เพิ่มคู่แข่ง
            </Btn>
          </div>
        )}
      </Card>
      <Card>
        <CardHead title="ผลการพิจารณา" />
        <div className="flex flex-col gap-3 px-5 py-4">
          <Field label="วันประกาศผล">
            <input type="date" className={inputCls} value={r.date} disabled={!editable} onChange={(e) => setR({ date: e.target.value })} />
          </Field>
          <Field label="เหตุผล/บันทึก">
            <textarea className={areaCls} value={r.reason ?? ""} disabled={!editable} onChange={(e) => setR({ reason: e.target.value || undefined })} />
          </Field>
          {winner && (
            <p className="text-[13px]">
              <Trophy {...I} className="mr-1 inline text-ink-3" />
              {winner.name} · {baht(winner.price)}
              {rank > 0 && <span className="text-ink-3"> · เราอันดับ {rank}</span>}
            </p>
          )}
          {editable && (
            <div className="grid grid-cols-2 gap-2">
              <Btn
                primary
                onClick={() =>
                  setT((x) => ({
                    ...x,
                    status: "won",
                    result: { ...r, competitors: r.competitors.map((c) => ({ ...c, winner: c.name === "บริษัทของเรา" || undefined })) },
                    award: x.award ?? newAward(x),
                  }))
                }
              >
                เราชนะ
              </Btn>
              <Btn onClick={() => setT((x) => ({ ...x, status: "lost", result: r }))}>ไม่ได้งาน</Btn>
            </div>
          )}
          <p className="text-[12px] text-ink-3">กดบันทึกด้านบนเพื่อเก็บผล</p>
        </div>
      </Card>
    </div>
  );
}

function newAward(t: Tender): Award {
  const value = Math.round(bidPriceOf(t));
  const start = new Date(Date.parse(TODAY) + 14 * DAY).toISOString().slice(0, 10);
  return {
    contractNo: "",
    value,
    signDate: TODAY,
    start,
    finish: new Date(Date.parse(start) + 240 * DAY).toISOString().slice(0, 10),
    penaltyRatePct: 0.1,
    penaltyMinPerDay: 100,
    adjustable: t.source === "egp",
    kFormulaId: "K-BLD",
    kBaseMonth: (t.openDate ?? t.submitDue).slice(0, 7),
    installments: [],
  };
}

// ---------- contract & penalty ----------

function Contract({ t, set, editable }: { t: Tender; set: SetFn; editable: boolean }) {
  const s = useTenderSettings();
  const a = t.award ?? newAward(t);
  const up = (patch: Partial<Award>) => set("award", { ...a, ...patch });
  const autoDays = daysLate(a.finish, a.actualFinish ?? TODAY);
  const [days, setDays] = useState("");
  const d = days === "" ? autoDays : Number(days) || 0;
  const pen = penalty(a.value, a.penaltyRatePct, d, a.penaltyMinPerDay);
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card>
        <CardHead title="สัญญาจ้าง" />
        <div className="grid grid-cols-2 gap-3 px-5 py-4">
          <Field label="เลขที่สัญญา">
            <input className={inputCls} value={a.contractNo} disabled={!editable} onChange={(e) => up({ contractNo: e.target.value })} />
          </Field>
          <Field label="ค่าจ้างตามสัญญา (รวม VAT)">
            <input className={cx(inputCls, "num font-mono")} value={a.value} disabled={!editable} onChange={(e) => up({ value: toNum(e.target.value) })} />
          </Field>
          <Field label="วันลงนาม">
            <input type="date" className={inputCls} value={a.signDate} disabled={!editable} onChange={(e) => up({ signDate: e.target.value })} />
          </Field>
          <Field label="เริ่มงาน">
            <input type="date" className={inputCls} value={a.start} disabled={!editable} onChange={(e) => up({ start: e.target.value })} />
          </Field>
          <Field label="ครบกำหนดสัญญา">
            <input type="date" className={inputCls} value={a.finish} disabled={!editable} onChange={(e) => up({ finish: e.target.value })} />
          </Field>
          <Field label="ส่งมอบงานจริง">
            <input type="date" className={inputCls} value={a.actualFinish ?? ""} disabled={!editable} onChange={(e) => up({ actualFinish: e.target.value || undefined })} />
          </Field>
          <Field label="โครงการในระบบ (ถ้ามี)">
            <input className={cx(inputCls, "font-mono")} value={a.projectId ?? ""} disabled={!editable} onChange={(e) => up({ projectId: e.target.value || undefined })} placeholder="HC-2026-xx" />
          </Field>
        </div>
        <div className="border-t border-line">
          <CardHead title="หลักประกันสัญญา" meta={`${s.perfBondPct}% ของค่าจ้าง`} />
          <BondForm bond={a.perfBond} base={a.value} pct={s.perfBondPct} editable={editable} onChange={(b) => up({ perfBond: b })} />
          <p className="px-5 pb-4 text-[12px] text-ink-3">หลักประกันสัญญาคืนเมื่อพ้นข้อผูกพันตามสัญญา (รวมระยะรับประกันความชำรุดบกพร่อง) — {VERIFY}</p>
        </div>
      </Card>
      <Card>
        <CardHead title="คำนวณค่าปรับรายวัน" />
        <div className="flex flex-col gap-3 px-5 py-4">
          <div className="grid grid-cols-3 gap-3">
            <Field label="อัตรา (% ต่อวัน)">
              <input className={cx(inputCls, "num font-mono")} value={a.penaltyRatePct} disabled={!editable} onChange={(e) => up({ penaltyRatePct: toNum(e.target.value) })} />
            </Field>
            <Field label="ขั้นต่ำ (บาท/วัน)">
              <input className={cx(inputCls, "num font-mono")} value={a.penaltyMinPerDay} disabled={!editable} onChange={(e) => up({ penaltyMinPerDay: toNum(e.target.value) })} />
            </Field>
            <Field label={`วันที่ล่าช้า (ระบบนับ ${autoDays})`}>
              <input className={cx(inputCls, "num font-mono")} value={days} placeholder={String(autoDays)} onChange={(e) => setDays(e.target.value.replace(/[^\d]/g, ""))} />
            </Field>
          </div>
          <KV k="ค่าปรับต่อวัน">{money2(pen.perDay)} บาท</KV>
          <KV k={`ค่าปรับ ${d} วัน`}>
            <span className="num font-mono font-medium">{money2(pen.total)}</span> บาท
          </KV>
          <KV k="คิดเป็น">{pen.pct.toFixed(2)}% ของค่าจ้าง</KV>
          {pen.overTen && <p className="rounded-[8px] bg-neg-soft px-3 py-2 text-[13px] text-neg">ค่าปรับเกินร้อยละ 10 ของค่าจ้าง ผู้ว่าจ้างอาจพิจารณาบอกเลิกสัญญา</p>}
          {!a.actualFinish && a.finish < TODAY && <p className="rounded-[8px] bg-warn-soft px-3 py-2 text-[13px] text-warn">เลยกำหนดสัญญาแล้ว {autoDays} วัน · ตรวจสอบสิทธิ์ขอขยายเวลา/งดลดค่าปรับ (เหตุสุดวิสัย ผู้ว่าจ้างผิดนัด) ให้ยื่นภายในเวลาที่สัญญากำหนด</p>}
          <p className="text-[12px] text-ink-3">ค่าเริ่มต้นงานก่อสร้างร้อยละ 0.1 ต่อวัน ไม่ต่ำกว่าวันละ 100 บาท ตามที่ระบุในสัญญา — {VERIFY}</p>
        </div>
      </Card>
    </div>
  );
}

// ---------- ค่า K ----------

function KTab({ t, set, editable }: { t: Tender; set: SetFn; editable: boolean }) {
  const s = useTenderSettings();
  const a = t.award ?? newAward(t);
  const up = (patch: Partial<Award>) => set("award", { ...a, ...patch });
  const f = s.kFormulas.find((x) => x.id === a.kFormulaId) ?? s.kFormulas[0];
  const months = Object.keys(s.indices).sort();
  const [doc, setDoc] = useState(false);
  const rows = useMemo(
    () =>
      a.installments.map((i) => {
        const k = f ? kValue(f, s.indices[i.month], s.indices[a.kBaseMonth], s.kDecimals) : undefined;
        const adj = k && !k.missing.length ? kAdjustment(k.k, i.amount, s.kThresholdPct) : undefined;
        return { i, k, adj };
      }),
    [a, f, s],
  );
  const payable = rows.filter((r) => r.adj?.applies);
  const total = payable.reduce((n, r) => n + (r.adj?.amount ?? 0), 0);
  const last = a.installments[a.installments.length - 1];
  const deadline = last?.paidDate ? kClaimDeadline(last.paidDate, s.kClaimDays) : undefined;
  const setInst = (n: number, patch: Partial<Award["installments"][number]>) => up({ installments: a.installments.map((x) => (x.no === n ? { ...x, ...patch } : x)) });

  return (
    <>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[340px_1fr]">
        <Card className="self-start">
          <CardHead title="เงื่อนไขค่า K" />
          <div className="flex flex-col gap-3 px-5 py-4">
            <label className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" checked={a.adjustable} disabled={!editable} onChange={(e) => up({ adjustable: e.target.checked })} />
              สัญญาแบบปรับราคาได้ (มีค่า K)
            </label>
            <Field label="สูตร">
              <Select label="สูตรค่า K" value={f?.id ?? ""} onChange={(v) => up({ kFormulaId: v })}>
                {s.kFormulas.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </Select>
            </Field>
            {f && (
              <p className="rounded-[8px] bg-raised px-3 py-2 font-mono text-[13px]">
                K = {f.constant}
                {f.terms.map((x) => ` + ${x.coef}·${x.sym}t/${x.sym}o`).join("")}
              </p>
            )}
            <Field label="เดือนฐาน (เดือนเปิดซอง, Io)">
              <Select label="เดือนฐาน" value={a.kBaseMonth} onChange={(v) => up({ kBaseMonth: v })}>
                {[...new Set([a.kBaseMonth, ...months])].sort().map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </Select>
            </Field>
            <KV k="เกณฑ์">ไม่จ่าย/ไม่หัก เมื่อ K อยู่ใน ±{s.kThresholdPct}% · ทศนิยม {s.kDecimals} ตำแหน่ง</KV>
            <KV k="ยื่นคำขอ">ภายใน {s.kClaimDays} วันหลังรับเงินงวดสุดท้าย{deadline ? ` · ถึง ${thDate(deadline)}` : ""}</KV>
            <p className="rounded-[8px] bg-warn-soft px-3 py-2 text-[13px] text-warn">ผู้รับจ้างต้องยื่นคำขอรับเงินเพิ่มค่า K เป็นหนังสือเอง หากไม่ยื่นภายในกำหนดอาจเสียสิทธิ์ — {VERIFY}</p>
          </div>
        </Card>
        <Card className="min-w-0">
          <CardHead
            title="ค่า K รายงวด"
            meta={payable.length ? `ขอรับได้ ${payable.filter((r) => (r.adj?.amount ?? 0) > 0).length} งวด · สุทธิ ${money2(total)}` : undefined}
            action={
              <Btn small onClick={() => setDoc(true)} disabled={!payable.length}>
                <FileText {...I} />
                หนังสือขอรับเงินค่า K
              </Btn>
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-[13px]">
              <thead>
                <tr className="text-left text-ink-3">
                  <th className="px-3 py-2 font-normal">งวด</th>
                  <th className="py-2 pr-2 font-normal">เดือนส่งงาน (t)</th>
                  <th className="py-2 pr-2 text-right font-normal">ค่างาน (ไม่รวม VAT)</th>
                  <th className="py-2 pr-2 font-normal">รับเงิน</th>
                  <th className="py-2 pr-2 text-right font-normal">K</th>
                  <th className="py-2 pr-2 text-right font-normal">เงินเพิ่ม/ลด</th>
                  <th className="py-2 pr-2 font-normal">ยื่นขอแล้ว</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map(({ i, k, adj }) => (
                  <tr key={i.no} className="border-t border-line align-top">
                    <td className="num px-3 py-1.5 font-mono">{i.no}</td>
                    <td className="py-1 pr-2">
                      <input type="month" className={cx(inputCls, "h-8 w-36 px-2 text-[13px]")} value={i.month} disabled={!editable} onChange={(e) => setInst(i.no, { month: e.target.value })} />
                    </td>
                    <td className="py-1 pr-2">
                      <input className={cx(numCls, "w-32")} value={i.amount} disabled={!editable} onChange={(e) => setInst(i.no, { amount: toNum(e.target.value) })} />
                    </td>
                    <td className="py-1 pr-2">
                      <input type="date" className={cx(inputCls, "h-8 w-36 px-2 text-[13px]")} value={i.paidDate ?? ""} disabled={!editable} onChange={(e) => setInst(i.no, { paidDate: e.target.value || undefined })} />
                    </td>
                    <td className="num py-1.5 pr-2 text-right font-mono" title={k?.ratios.map((r) => `${r.sym}t/${r.sym}o = ${r.ratio}`).join(" · ")}>
                      {k && !k.missing.length ? k.k.toFixed(s.kDecimals) : <span className="text-ink-3">ขาดดัชนี {k?.missing.join(",")}</span>}
                    </td>
                    <td className={cx("num py-1.5 pr-2 text-right font-mono", adj?.applies ? (adj.amount > 0 ? "text-pos" : "text-neg") : "text-ink-3")}>{adj ? (adj.applies ? money2(adj.amount) : `ใน ±${s.kThresholdPct}%`) : "–"}</td>
                    <td className="py-1 pr-2">
                      <input type="date" className={cx(inputCls, "h-8 w-36 px-2 text-[13px]")} value={i.claimedDate ?? ""} disabled={!editable || !i.paidDate} onChange={(e) => setInst(i.no, { claimedDate: e.target.value || undefined })} />
                    </td>
                    <td className="pr-2">
                      {editable && (
                        <IconBtn label="ลบงวด" danger onClick={() => up({ installments: a.installments.filter((x) => x.no !== i.no) })}>
                          <Trash2 {...I} />
                        </IconBtn>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {editable && (
            <div className="border-t border-line px-3 py-2">
              <Btn small onClick={() => up({ installments: [...a.installments, { no: (last?.no ?? 0) + 1, month: TODAY.slice(0, 7), amount: 0 }] })}>
                <Plus {...I} />
                เพิ่มงวด
              </Btn>
            </div>
          )}
          {f && rows[0]?.k && (
            <div className="border-t border-line px-5 py-3 text-[12px] text-ink-3">
              ดัชนีเดือนฐาน {a.kBaseMonth}: {f.terms.map((x) => `${x.sym} ${s.indices[a.kBaseMonth]?.[x.sym] ?? "–"}`).join(" · ")} ({f.terms.map((x) => INDEX_LABEL[x.sym] ?? x.sym).join(", ")})
            </div>
          )}
        </Card>
      </div>
      <PrintSheet open={doc} onClose={() => setDoc(false)} title="หนังสือขอรับเงินเพิ่มค่างานตามสูตรค่า K">
        <DocHeader
          title="หนังสือขอรับเงินค่า K"
          titleEn="PRICE ADJUSTMENT (K) CLAIM"
          code={a.contractNo || t.id}
          meta={
            <>
              <p>วันที่ {thDate(TODAY)}</p>
              <p>{t.egpNo ? `e-GP ${t.egpNo}` : ""}</p>
            </>
          }
        />
        <p className="mt-5 text-[13px]">เรียน {t.client}</p>
        <p className="mt-2 text-[13px] leading-6">
          ตามที่บริษัทได้ทำสัญญาจ้าง {t.title} {a.contractNo} ลงวันที่ {thDate(a.signDate)} ค่าจ้าง {money2(a.value)} บาท ซึ่งเป็นสัญญาแบบปรับราคาได้ ใช้สูตร{f?.name} บริษัทขอยื่นคำขอรับเงินเพิ่มค่างานตามสูตรค่า K สำหรับงวดงานที่ได้รับเงินแล้ว ดังนี้
        </p>
        <DocSection n={1} title="การคำนวณค่า K" en="K CALCULATION">
          <p className="py-1 font-mono text-[12px]">
            K = {f?.constant}
            {f?.terms.map((x) => ` + ${x.coef}(${x.sym}t/${x.sym}o)`).join("")} · เดือนฐาน (o) {a.kBaseMonth}
          </p>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-ink-3">
                <th className="py-1 font-normal">งวด</th>
                <th className="py-1 font-normal">เดือน t</th>
                <th className="py-1 text-right font-normal">ค่างาน</th>
                <th className="py-1 text-right font-normal">K</th>
                <th className="py-1 text-right font-normal">ส่วนเกิน ±{s.kThresholdPct}%</th>
                <th className="py-1 text-right font-normal">เงินเพิ่ม/(ลด)</th>
              </tr>
            </thead>
            <tbody>
              {payable.map(({ i, k, adj }) => (
                <tr key={i.no} className="border-t border-line">
                  <td className="py-1">{i.no}</td>
                  <td className="py-1 font-mono">{i.month}</td>
                  <td className="py-1 text-right font-mono">{money2(i.amount)}</td>
                  <td className="py-1 text-right font-mono">{k?.k.toFixed(s.kDecimals)}</td>
                  <td className="py-1 text-right font-mono">{adj?.kNet.toFixed(4)}</td>
                  <td className="py-1 text-right font-mono">{money2(adj?.amount ?? 0)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-ink-3">
                <td colSpan={5} className="py-1 text-right">
                  รวม (ไม่รวม VAT)
                </td>
                <td className="py-1 text-right font-mono font-medium">{money2(total)}</td>
              </tr>
            </tfoot>
          </table>
        </DocSection>
        <DocSection n={2} title="ดัชนีราคาที่ใช้" en="INDICES">
          {payable.map(({ i, k }) => (
            <DocRow key={i.no} k={`งวด ${i.no}`}>
              <span className="font-mono text-[12px]">{k?.ratios.map((r) => `${r.sym} ${s.indices[i.month]?.[r.sym]}/${s.indices[a.kBaseMonth]?.[r.sym]} = ${r.ratio}`).join(" · ")}</span>
            </DocRow>
          ))}
        </DocSection>
        <p className="mt-4 text-[12px] leading-5 text-ink-2">
          จึงเรียนมาเพื่อโปรดพิจารณาจ่ายเงินเพิ่มค่างานดังกล่าว ทั้งนี้บริษัทยื่นคำขอภายใน {s.kClaimDays} วันนับแต่วันที่ได้รับเงินงวดสุดท้ายตามเงื่อนไขสัญญา ดัชนีราคาตามที่สำนักงานนโยบายและยุทธศาสตร์การค้าประกาศ (ตัวเลขในเอกสารนี้ต้องตรวจสอบกับประกาศจริงก่อนยื่น)
        </p>
        <div className="avoid-break mt-12 grid grid-cols-2 gap-8 text-center text-[12px] text-ink-2">
          <div />
          <div>
            <div className="h-12 border-b border-ink-3" />
            <p className="mt-2">ผู้มีอำนาจลงนามแทนบริษัท</p>
          </div>
        </div>
        <p className="ops-noprint mt-6 text-center text-[12px] text-ink-3">
          <Printer {...I} className="mr-1 inline" />
          พิมพ์แล้วยื่นเป็นหนังสือต่อหน่วยงาน แล้วบันทึกวันที่ยื่นในช่อง “ยื่นขอแล้ว”
        </p>
      </PrintSheet>
    </>
  );
}
