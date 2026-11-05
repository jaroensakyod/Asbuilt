"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { Card, CardHead, cx, Field, inputCls } from "@/components/ui";
import { Btn, Empty, FilterField, I, Modal, Pill, Select, StatCard, type Tone } from "@/components/ops/bits";
import { PROVINCES } from "@/lib/projects-store";
import { thDate, TODAY } from "@/lib/data";
import { bidPriceOf, vsPct, winStats } from "@/lib/tender/calc";
import { newTender, tenders } from "@/lib/tender/store";
import { TenderAiButton } from "@/components/ai-docs/tender-ai";
import { METHOD_LABEL, SOURCE_LABEL, TENDER_STATUS_LABEL, type Tender, type TenderMethod, type TenderSource, type TenderStatus } from "@/lib/tender/types";
import { canEdit } from "@/lib/permissions";
import { useMe } from "@/lib/use-me";
import { TenderSettingsButton } from "./tender-settings";

export const TENDER_TONE: Record<TenderStatus, Tone> = { prospect: "neutral", preparing: "accent", submitted: "warn", won: "pos", lost: "neg", nobid: "neutral", cancelled: "neutral" };
const STAGES: TenderStatus[] = ["prospect", "preparing", "submitted", "won", "lost"];
const DAY = 86400000;
const left = (iso: string) => Math.round((Date.parse(iso) - Date.parse(TODAY)) / DAY);
export const mb = (n: number) => `${(n / 1_000_000).toLocaleString("th-TH", { maximumFractionDigits: 2 })} ล้าน`;

export function TendersView() {
  const router = useRouter();
  const me = useMe();
  const list = tenders.use();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [adding, setAdding] = useState(false);
  const stats = useMemo(() => winStats(list), [list]);
  const live = useMemo(() => list.filter((t) => ["prospect", "preparing", "submitted"].includes(t.status)), [list]);
  const due7 = live.filter((t) => [t.siteVisit, t.questionsDue, t.submitDue].some((d) => d && left(d) >= 0 && left(d) <= 7));
  const pipeline = live.reduce((s, t) => s + (t.bidPrice ?? t.budget ?? bidPriceOf(t)), 0);

  const rows = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return list
      .filter((t) => !status || t.status === status)
      .filter((t) => !source || t.source === source)
      .filter((t) => !qq || `${t.id} ${t.title} ${t.client} ${t.egpNo ?? ""} ${t.province}`.toLowerCase().includes(qq))
      .sort((a, b) => Number(!live.includes(a)) - Number(!live.includes(b)) || (live.includes(a) ? a.submitDue.localeCompare(b.submitDue) : b.submitDue.localeCompare(a.submitDue)));
  }, [list, q, status, source, live]);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
        <div>
          <p className="mb-1 text-[13px] text-ink-3">ประมูลงาน</p>
          <h1 className="text-[30px] font-normal leading-[1.15]">งานประมูล</h1>
          <p className="mt-2 max-w-[48rem] text-ink-2">ติดตามงานประกวดราคาเอกชนและภาครัฐ (e-GP) ตั้งแต่ประกาศ ดูสถานที่ ยื่นซอง หลักประกันซอง จัดทำราคา BOQ เทียบราคากลางด้วย Factor F ผลการประมูล ไปจนถึงหลักประกันสัญญา ค่าปรับ และค่า K</p>
        </div>
        <div className="flex items-center gap-2">
          <TenderSettingsButton />
          {canEdit(me.role, "tender") && (
            <Btn primary onClick={() => setAdding(true)}>
              <Plus {...I} />
              เพิ่มงานประมูล
            </Btn>
          )}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="งานที่กำลังประมูล" value={live.length} unit="งาน" note={`มูลค่ารวมประมาณ ${mb(pipeline)} บาท`} />
        <StatCard label="กำหนดการใน 7 วัน" value={due7.length} unit="งาน" tone={due7.length ? "neg" : undefined} note="ดูสถานที่ ส่งคำถาม ยื่นซอง" />
        <StatCard label="อัตราชนะ" value={stats.rate.toFixed(0)} unit="%" note={`${stats.won} จาก ${stats.decided} งานที่ประกาศผล · ${stats.bySource.map((s) => `${s.source === "egp" ? "รัฐ" : "เอกชน"} ${s.rate.toFixed(0)}%`).join(" · ")}`} />
        <StatCard label="มูลค่างานที่ได้" value={mb(stats.valueWon)} unit="บาท" note="รวม VAT" />
      </div>

      <Card className="mb-4">
        <CardHead title="สถานะงานประมูล" />
        <div className="grid grid-cols-2 gap-px bg-line md:grid-cols-5">
          {STAGES.map((s) => {
            const xs = list.filter((t) => t.status === s);
            return (
              <button key={s} type="button" onClick={() => setStatus(status === s ? "" : s)} aria-pressed={status === s} className={cx("bg-card px-5 py-3 text-left hover:bg-raised", status === s && "bg-raised")}>
                <p className="text-[13px] text-ink-2">{TENDER_STATUS_LABEL[s]}</p>
                <p className="num mt-1 font-mono text-[22px]">{xs.length}</p>
                <p className="text-[12px] text-ink-3">{mb(xs.reduce((n, t) => n + (t.award?.value ?? t.bidPrice ?? t.budget ?? 0), 0))}</p>
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="mb-4 px-4 py-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <FilterField label="ค้นหา" className="col-span-2">
            <div className="relative">
              <Search {...I} className="pointer-events-none absolute left-2.5 top-2.5 text-ink-3" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ชื่องาน หน่วยงาน เลขโครงการ e-GP" className={cx(inputCls, "w-full pl-8")} />
            </div>
          </FilterField>
          <FilterField label="ประเภท">
            <Select label="ประเภท" value={source} onChange={setSource}>
              <option value="">ทั้งหมด</option>
              {Object.entries(SOURCE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="สถานะ">
            <Select label="สถานะ" value={status} onChange={setStatus}>
              <option value="">ทุกสถานะ</option>
              {Object.entries(TENDER_STATUS_LABEL).map(([k, v]) => (
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
          <Empty>ไม่พบงานประมูล</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="text-ink-3">
                  <th className="px-5 py-3 font-normal">งาน</th>
                  <th className="py-3 pr-4 font-normal">ประเภท</th>
                  <th className="py-3 pr-4 text-right font-normal">งบประมาณ / ราคากลาง</th>
                  <th className="py-3 pr-4 text-right font-normal">ราคาเสนอ</th>
                  <th className="py-3 pr-4 font-normal">ยื่นซอง</th>
                  <th className="py-3 pr-5 font-normal">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => {
                  const bid = bidPriceOf(t);
                  const ref = t.medianPrice ?? t.budget;
                  const d = left(t.submitDue);
                  const isLive = live.includes(t);
                  return (
                    <tr key={t.id} onClick={() => router.push(`/tenders/${t.id}`)} className="cursor-pointer border-t border-line hover:bg-raised/50">
                      <td className="max-w-[420px] px-5 py-2.5">
                        <span className="block">{t.title}</span>
                        <span className="text-[12px] text-ink-3">
                          <span className="font-mono">{t.id}</span> · {t.client} · {t.province}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4">
                        <Pill tone={t.source === "egp" ? "accent" : "neutral"}>{t.source === "egp" ? "e-GP" : "เอกชน"}</Pill>
                        {t.egpNo && <span className="block font-mono text-[11px] text-ink-3">{t.egpNo}</span>}
                      </td>
                      <td className="py-2.5 pr-4 text-right">
                        <span className="num block font-mono">{t.budget ? t.budget.toLocaleString("th-TH") : "–"}</span>
                        {t.medianPrice && <span className="num font-mono text-[12px] text-ink-3">{t.medianPrice.toLocaleString("th-TH")}</span>}
                      </td>
                      <td className="py-2.5 pr-4 text-right">
                        <span className="num block font-mono">{bid ? Math.round(bid).toLocaleString("th-TH") : "–"}</span>
                        {ref && bid > 0 && <span className={cx("num font-mono text-[12px]", vsPct(bid, ref) > 0 ? "text-neg" : "text-ink-3")}>{vsPct(bid, ref).toFixed(2)}%</span>}
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className="num font-mono">{thDate(t.submitDue)}</span>
                        {isLive && t.status !== "submitted" && <span className={cx("block text-[12px]", d < 0 ? "text-neg" : d <= 7 ? "text-warn" : "text-ink-3")}>{d < 0 ? `เลย ${-d} วัน` : d === 0 ? "วันนี้" : `อีก ${d} วัน`}</span>}
                      </td>
                      <td className="py-2.5 pr-5">
                        <Pill tone={TENDER_TONE[t.status]}>{TENDER_STATUS_LABEL[t.status]}</Pill>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {adding && <NewTender onClose={() => setAdding(false)} onSaved={(t) => router.push(`/tenders/${t.id}`)} owner={me.name} />}
    </>
  );
}

function NewTender({ onClose, onSaved, owner }: { onClose: () => void; onSaved: (t: Tender) => void; owner: string }) {
  const [f, setF] = useState({ title: "", client: "", source: "egp" as TenderSource, method: "e-bidding" as TenderMethod, province: PROVINCES[0], budget: "", egpNo: "", submitDue: new Date(Date.parse(TODAY) + 14 * DAY).toISOString().slice(0, 10), siteVisit: "" });
  // what the AI read from the TOR beyond the fields of this form (kept and saved with the tender)
  const [extra, setExtra] = useState<Partial<Tender>>({});
  const provinces = PROVINCES.includes(f.province) ? PROVINCES : [f.province, ...PROVINCES];
  const fromDoc = (fn: (t: Tender) => Tender, refs: Tender["docs"]) => {
    const base: Tender = { id: "", title: f.title, client: f.client, source: f.source, method: f.method, province: f.province, budget: Number(f.budget) || undefined, egpNo: f.egpNo || undefined, submitDue: f.submitDue, siteVisit: f.siteVisit || undefined, status: "prospect", owner, docs: [], lines: [], markupPct: 0, vatPct: 7, createdAt: TODAY };
    const t = fn(base);
    setF({ title: t.title, client: t.client, source: t.source, method: t.method, province: t.province, budget: t.budget ? String(Math.round(t.budget)) : "", egpNo: t.egpNo ?? "", submitDue: t.submitDue, siteVisit: t.siteVisit ?? "" });
    setExtra({ medianPrice: t.medianPrice, announced: t.announced, questionsDue: t.questionsDue, openDate: t.openDate, torNote: t.torNote, bidBond: t.bidBond, lines: t.lines, docs: refs });
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="เพิ่มงานประมูล"
      width={640}
      footer={
        <>
          <span className="mr-auto">
            <TenderAiButton label="กรอกจาก TOR ด้วย AI" onApply={fromDoc} />
          </span>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn
            primary
            disabled={!f.title.trim() || !f.client.trim()}
            onClick={() => {
              const t = newTender({ ...extra, title: f.title.trim(), client: f.client.trim(), source: f.source, method: f.method, province: f.province, submitDue: f.submitDue, owner, budget: Number(f.budget) || undefined, egpNo: f.egpNo.trim() || undefined, siteVisit: f.siteVisit || undefined, announced: extra.announced ?? TODAY });
              onSaved(t);
              onClose();
            }}
          >
            บันทึก
          </Btn>
        </>
      }
    >
      {extra.docs?.length ? (
        <p className="mb-3 rounded-[8px] bg-accent-soft/50 px-3 py-2 text-[13px] text-ink-2">
          AI กรอกจากเอกสาร {extra.docs.map((d) => d.name).join(", ")} แล้ว{extra.lines?.length ? ` · BOQ ${extra.lines.length} รายการ` : ""}{extra.torNote ? " · สรุป TOR" : ""} ตรวจทุกช่องก่อนบันทึก
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Field label="ชื่องาน">
            <input className={inputCls} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          </Field>
        </div>
        <div className="col-span-2">
          <Field label="ผู้ว่าจ้าง / หน่วยงาน">
            <input className={inputCls} value={f.client} onChange={(e) => setF({ ...f, client: e.target.value })} />
          </Field>
        </div>
        <Field label="ประเภท">
          <Select label="ประเภท" value={f.source} onChange={(v) => setF({ ...f, source: v as TenderSource, method: v === "egp" ? "e-bidding" : "invitation" })}>
            {Object.entries(SOURCE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="วิธีจัดจ้าง">
          <Select label="วิธีจัดจ้าง" value={f.method} onChange={(v) => setF({ ...f, method: v as TenderMethod })}>
            {Object.entries(METHOD_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="จังหวัด">
          <Select label="จังหวัด" value={f.province} onChange={(v) => setF({ ...f, province: v })}>
            {provinces.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </Select>
        </Field>
        <Field label="วงเงินงบประมาณ (บาท)">
          <input className={cx(inputCls, "num font-mono")} inputMode="numeric" value={f.budget} onChange={(e) => setF({ ...f, budget: e.target.value.replace(/[^\d]/g, "") })} />
        </Field>
        {f.source === "egp" && (
          <Field label="เลขที่โครงการ e-GP">
            <input className={cx(inputCls, "font-mono")} value={f.egpNo} onChange={(e) => setF({ ...f, egpNo: e.target.value })} />
          </Field>
        )}
        <Field label="วันดูสถานที่">
          <input type="date" className={inputCls} value={f.siteVisit} onChange={(e) => setF({ ...f, siteVisit: e.target.value })} />
        </Field>
        <Field label="กำหนดยื่นซอง">
          <input type="date" className={inputCls} value={f.submitDue} onChange={(e) => setF({ ...f, submitDue: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}
