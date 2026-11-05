"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Copy, FileSignature, Plus, Printer, Send, Trash2, XCircle } from "lucide-react";
import { Card, CardHead, cx, Field, inputCls } from "@/components/ui";
import { Btn, Empty, IconBtn, Modal, Pill, PrintStyle, useHydrated } from "@/components/ops/bits";
import { DocHeader, Signatures } from "@/components/ops/doc";
import { COST_CODES, type CostCode } from "@/lib/biz";
import { getHouseModel, houseModels, team, thDate, TODAY } from "@/lib/data";
import { canEdit } from "@/lib/permissions";
import { PROVINCES } from "@/lib/projects-store";
import { estimates, leads, QUOTE_STATUS_LABEL, quotes, quoteStatus, quoteTotals, reviseQuote, signQuote, validUntil, type Quote, type QuoteLine } from "@/lib/sales/crm";
import { modelBoq } from "@/lib/sales/seed-biz";
import { dueDateOf, MILESTONE_LABEL, TERM_TEMPLATES, type PayTerm } from "@/lib/sales/terms";
import { I, mb, n0, n2, QUOTE_TONE, Td, Th, theadCls, useCostAccess } from "./common";
import { QuoteFollowUpButton } from "@/components/ai-sales/quote-followup";

const addDays = (iso: string, d: number) => new Date(Date.parse(iso) + d * 86400000).toISOString().slice(0, 10);

export function QuoteDetail({ id }: { id: string }) {
  const hydrated = useHydrated();
  const all = quotes.use();
  const q = all.find((x) => x.id === id);
  if (!q) return hydrated ? <Empty>ไม่พบใบเสนอราคา {id}</Empty> : <div className="h-[60vh]" />;
  return <Editor key={q.id} q={q} />;
}

function Editor({ q }: { q: Quote }) {
  const router = useRouter();
  const { canSeeCost, me } = useCostAccess();
  const allEst = estimates.use();
  const lead = q.leadId ? leads.get(q.leadId) : undefined;
  const [signing, setSigning] = useState(false);
  const [losing, setLosing] = useState(false);
  const st = quoteStatus(q);
  const editable = q.status === "draft" && canEdit(me.role, "sales");
  const t = quoteTotals(q);
  const m = getHouseModel(q.modelCode);
  const modelEstimates = allEst.filter((e) => e.modelCode === q.modelCode).sort((a, b) => b.date.localeCompare(a.date));
  const est = q.estimateId ? allEst.find((e) => e.id === q.estimateId) : undefined;
  const until = validUntil(q);

  const save = (patch: Partial<Quote>) => quotes.upsert({ ...q, ...patch });
  const setLine = (lid: string, patch: Partial<QuoteLine>) => save({ options: q.options.map((l) => (l.id === lid ? { ...l, ...patch } : l)) });
  const setTerm = (no: number, patch: Partial<PayTerm>) => save({ terms: q.terms.map((x) => (x.no === no ? { ...x, ...patch } : x)) });
  const termSum = q.terms.reduce((s, x) => s + x.percent, 0);
  const months = m?.months ?? 10;
  const planStart = addDays(TODAY, 45);
  const planFinish = addDays(planStart, Math.round(months * 30.4));

  return (
    <>
      <PrintStyle />
      <div className="ops-noprint flex flex-wrap items-center justify-between gap-3 pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/quotes" className="mr-1 inline-flex h-8 items-center gap-1.5 rounded-[8px] px-2 text-[13px] text-ink-2 transition-colors duration-150 hover:bg-raised hover:text-ink">
            <ArrowLeft {...I} />
            ใบเสนอราคา
          </Link>
          <Pill mono>{q.id}</Pill>
          <Pill mono>rev.{q.rev}</Pill>
          <Pill tone={QUOTE_TONE[st]}>{QUOTE_STATUS_LABEL[st]}</Pill>
          {lead && (
            <Link href={`/sales/${lead.id}`} className="text-[13px] text-accent-text hover:underline">
              ลีด {lead.id} · {lead.name}
            </Link>
          )}
          {q.projectId && (
            <Link href={`/projects/${q.projectId}`} className="text-[13px] text-accent-text hover:underline">
              โครงการ {q.projectId}
            </Link>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit(me.role, "sales") && q.customer.name && <QuoteFollowUpButton q={q} />}
          <Btn onClick={() => window.print()}>
            <Printer {...I} />
            พิมพ์
          </Btn>
          {canEdit(me.role, "sales") && (
            <>
              {q.status === "draft" && (
                <Btn onClick={() => save({ status: "sent", date: TODAY })} disabled={!q.customer.name}>
                  <Send {...I} />
                  ส่งให้ลูกค้าแล้ว
                </Btn>
              )}
              {(st === "sent" || st === "expired" || st === "lost") && (
                <Btn onClick={() => reviseQuote(q, st === "expired" ? "หมดอายุ ออกฉบับใหม่" : "ปรับราคา/รายการตามที่ลูกค้าขอ")}>
                  <Copy {...I} />
                  ออกฉบับแก้ไข
                </Btn>
              )}
              {(st === "sent" || st === "expired") && (
                <Btn onClick={() => setLosing(true)}>
                  <XCircle {...I} />
                  แพ้
                </Btn>
              )}
              {(q.status === "sent" || q.status === "draft") && (
                <Btn primary onClick={() => setSigning(true)} disabled={!q.customer.name || termSum !== 100}>
                  <FileSignature {...I} />
                  เซ็นสัญญา
                </Btn>
              )}
              {q.status === "draft" && (
                <IconBtn
                  label="ลบ"
                  danger
                  onClick={() => {
                    if (window.confirm(`ลบใบเสนอราคา ${q.id}`)) {
                      quotes.remove(q.id);
                      router.push("/quotes");
                    }
                  }}
                >
                  <Trash2 {...I} />
                </IconBtn>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[1fr_420px]">
        {/* A4 quotation */}
        <article className="ops-print mx-auto w-full max-w-[860px] rounded-[4px] border border-line bg-white px-12 py-10 text-ink shadow-[0_2px_12px_rgba(31,27,22,0.08)]">
          <DocHeader
            title="ใบเสนอราคา"
            titleEn="QUOTATION"
            code={`${q.id}${q.rev > 1 ? ` R${q.rev}` : ""}`}
            meta={
              <>
                <p>วันที่ {thDate(q.date)}</p>
                <p>ยืนราคาถึง {thDate(until)}</p>
                <p>ผู้เสนอราคา {q.owner}</p>
              </>
            }
          />
          <div className="mt-5 grid grid-cols-2 gap-6 text-[13px]">
            <div className="rounded-[6px] border border-line px-3 py-2">
              <p className="text-[12px] text-ink-3">เสนอราคาแก่</p>
              <p className="text-[14px] text-ink">{q.customer.name || "................................................"}</p>
              <p className="text-ink-2">{q.customer.address || "–"}</p>
              <p className="text-ink-2">
                โทร {q.customer.phone || "–"}
                {q.customer.email ? ` · ${q.customer.email}` : ""}
              </p>
            </div>
            <div className="rounded-[6px] border border-line px-3 py-2">
              <p className="text-[12px] text-ink-3">งาน</p>
              <p className="text-ink">{m ? `${m.nameTh}` : q.modelCode}</p>
              <p className="text-ink-2">
                แบบ {m?.name} ({q.modelCode}) · {m?.area} ตร.ม. · {m?.floors} ชั้น · {m?.beds} ห้องนอน {m?.baths} ห้องน้ำ
              </p>
              <p className="text-ink-2">สถานที่ก่อสร้าง จ.{q.province} · ระยะเวลาก่อสร้างประมาณ {months} เดือน</p>
            </div>
          </div>

          <table className="mt-5 w-full text-[13px]">
            <thead>
              <tr className="border-b-2 border-ink text-left text-[12px]">
                <th className="w-8 py-1.5 font-medium">ที่</th>
                <th className="py-1.5 font-medium">รายการ</th>
                <th className="py-1.5 text-right font-medium">จำนวน</th>
                <th className="py-1.5 pl-2 font-medium">หน่วย</th>
                <th className="py-1.5 text-right font-medium">ราคา/หน่วย</th>
                <th className="py-1.5 text-right font-medium">ส่วนลด</th>
                <th className="py-1.5 text-right font-medium">จำนวนเงิน</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-line align-top">
                <td className="py-2 font-mono text-[12px]">1</td>
                <td className="py-2 pr-3">{q.baseLabel}</td>
                <td className="py-2 text-right font-mono">1</td>
                <td className="py-2 pl-2">หลัง</td>
                <td className="py-2 text-right font-mono">{n2(q.basePrice)}</td>
                <td className="py-2 text-right font-mono">–</td>
                <td className="py-2 text-right font-mono">{n2(q.basePrice)}</td>
              </tr>
              {q.options.map((l, i) => (
                <tr key={l.id} className="border-b border-line align-top">
                  <td className="py-2 font-mono text-[12px]">{i + 2}</td>
                  <td className="py-2 pr-3">{l.name}</td>
                  <td className="py-2 text-right font-mono">{l.qty.toLocaleString("th-TH")}</td>
                  <td className="py-2 pl-2">{l.unit}</td>
                  <td className="py-2 text-right font-mono">{n2(l.unitPrice)}</td>
                  <td className="py-2 text-right font-mono">{l.discount ? n2(l.discount) : "–"}</td>
                  <td className="py-2 text-right font-mono">{n2(l.qty * l.unitPrice - l.discount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="avoid-break mt-3 flex justify-end">
            <table className="w-[320px] text-[13px]">
              <tbody>
                <SumRow k="รวมเป็นเงิน" v={n2(t.gross)} />
                {q.billDiscount > 0 && <SumRow k="หักส่วนลดพิเศษ" v={`-${n2(q.billDiscount)}`} />}
                <SumRow k="ราคาก่อนภาษีมูลค่าเพิ่ม" v={n2(t.subtotal)} />
                <SumRow k={`ภาษีมูลค่าเพิ่ม ${q.vatRate}%`} v={n2(t.vat)} />
                <tr className="border-y-2 border-ink">
                  <td className="py-1.5 font-medium">รวมทั้งสิ้น</td>
                  <td className="py-1.5 text-right font-mono text-[15px] font-medium">{n2(t.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <section className="avoid-break mt-6">
            <p className="text-[13px] font-medium">กำหนดการชำระเงิน</p>
            <table className="mt-2 w-full text-[12px]">
              <thead>
                <tr className="border-b border-ink text-left">
                  <th className="py-1 font-medium">งวด</th>
                  <th className="py-1 font-medium">เงื่อนไข</th>
                  <th className="py-1 text-right font-medium">%</th>
                  <th className="py-1 text-right font-medium">ก่อน VAT</th>
                  <th className="py-1 text-right font-medium">รวม VAT</th>
                  <th className="py-1 pl-3 font-medium">ประมาณการ</th>
                </tr>
              </thead>
              <tbody>
                {q.terms.map((x) => {
                  const amt = (t.subtotal * x.percent) / 100;
                  return (
                    <tr key={x.no} className="border-b border-line">
                      <td className="py-1 font-mono">{x.no}</td>
                      <td className="py-1">{x.title}</td>
                      <td className="py-1 text-right font-mono">{x.percent}</td>
                      <td className="py-1 text-right font-mono">{n2(amt)}</td>
                      <td className="py-1 text-right font-mono">{n2(amt * (1 + q.vatRate / 100))}</td>
                      <td className="py-1 pl-3 text-ink-2">{x.milestone === "contract" ? "วันทำสัญญา" : `เดือนที่ ${Math.max(1, Math.round((Date.parse(dueDateOf(x, planStart, planStart, planFinish)) - Date.parse(planStart)) / (30.4 * 86400000)))} หลังเริ่มงาน`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section className="avoid-break mt-5 text-[12px] leading-[19px] text-ink-2">
            <p className="text-[13px] font-medium text-ink">เงื่อนไข</p>
            <ol className="mt-1 list-decimal pl-5">
              <li>ราคานี้ยืนราคา {q.validDays} วัน นับจากวันที่ในใบเสนอราคา</li>
              <li>ราคารวมค่าวัสดุ ค่าแรง ค่าขออนุญาตปลูกสร้าง และการควบคุมงานตามรายการวัสดุมาตรฐานของบริษัท</li>
              <li>ไม่รวมค่าถมดินเกินระดับที่กำหนด ค่ารื้อถอนสิ่งปลูกสร้างเดิม และค่าธรรมเนียมขอมิเตอร์ไฟฟ้า/ประปาถาวร</li>
              <li>งวดสุดท้าย 5% เป็นเงินประกันผลงาน ชำระเมื่อส่งมอบบ้านและแก้ไขรายการตรวจรับครบถ้วน</li>
              <li>รับประกันโครงสร้าง 10 ปี งานระบบและงานตกแต่ง 2 ปี นับจากวันส่งมอบ</li>
              {q.note && <li>{q.note}</li>}
            </ol>
          </section>

          <Signatures roles={[{ role: "ผู้เสนอราคา", name: q.owner }, { role: "ผู้อนุมัติ" }, { role: "ลูกค้าผู้ยอมรับข้อเสนอ", name: q.customer.name || undefined }]} />
        </article>

        {/* editor */}
        <div className="ops-noprint flex flex-col gap-4">
          {!editable && (
            <p className="rounded-[10px] border border-line bg-card px-4 py-3 text-[13px] text-ink-2">
              {q.status === "approved"
                ? `เซ็นสัญญาแล้ว${q.signedDate ? ` เมื่อ ${thDate(q.signedDate)}` : ""} แก้ไขไม่ได้`
                : q.status === "draft"
                  ? "บทบาทของคุณดูได้อย่างเดียว"
                  : "ใบเสนอราคาที่ส่งแล้วแก้ไขไม่ได้ ใช้ปุ่มออกฉบับแก้ไขเพื่อปรับราคา"}
            </p>
          )}

          {canSeeCost && (
            <Card>
              <CardHead title="ต้นทุนและกำไร" meta="เห็นเฉพาะผู้มีสิทธิ์ดูต้นทุน" />
              <dl className="px-5 py-3 text-[13px]">
                <KV k="ราคาขายก่อน VAT" v={n0(t.subtotal)} />
                <KV k="ต้นทุนตามประมาณการ" v={t.cost !== undefined ? n0(t.cost) : "–"} />
                <KV k="กำไรขั้นต้น" v={t.cost !== undefined ? `${n0(t.subtotal - t.cost)} · ${((t.margin ?? 0) * 100).toFixed(1)}%` : "–"} tone={t.margin !== undefined && t.margin < 0.12 ? "neg" : undefined} />
                <KV k="ราคาต่อ ตร.ม." v={m ? `${n0(t.subtotal / m.area)} บ.` : "–"} />
                <KV k="แค็ตตาล็อก" v={m ? `${mb(m.priceMin * 1e6)} – ${mb(m.priceMax * 1e6)}` : "–"} />
              </dl>
              <p className="border-t border-line px-5 py-2.5 text-[12px] text-ink-3">
                {est ? (
                  <>
                    อ้างอิงประมาณการ{" "}
                    <Link href={`/estimating?model=${est.modelCode}&source=${est.choice}&oh=${est.overheadPct}&margin=${est.marginPct}&grade=${est.grade}`} className="font-mono text-ink-2 hover:text-ink">
                      {est.id}
                    </Link>{" "}
                    · รายการเสริมคิดต้นทุน 72% ของราคา
                  </>
                ) : (
                  "ยังไม่ผูกกับประมาณการ ต้นทุนใช้ค่ามาตรฐานของแบบ"
                )}
              </p>
            </Card>
          )}

          <Card>
            <CardHead title="ลูกค้า" />
            <fieldset disabled={!editable} className="grid grid-cols-2 gap-3 px-5 py-4">
              <Field label="ชื่อลูกค้า">
                <input className={inputCls} value={q.customer.name} onChange={(e) => save({ customer: { ...q.customer, name: e.target.value } })} />
              </Field>
              <Field label="โทรศัพท์">
                <input className={inputCls} value={q.customer.phone} onChange={(e) => save({ customer: { ...q.customer, phone: e.target.value } })} />
              </Field>
              <Field label="อีเมล">
                <input className={inputCls} value={q.customer.email ?? ""} onChange={(e) => save({ customer: { ...q.customer, email: e.target.value || undefined } })} />
              </Field>
              <Field label="จังหวัดที่ก่อสร้าง">
                <select className={inputCls} value={q.province} onChange={(e) => save({ province: e.target.value })}>
                  {Array.from(new Set([q.province, ...PROVINCES])).map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </Field>
              <div className="col-span-2">
                <Field label="ที่อยู่ / ที่ตั้งที่ดิน">
                  <input className={inputCls} value={q.customer.address ?? ""} onChange={(e) => save({ customer: { ...q.customer, address: e.target.value } })} />
                </Field>
              </div>
            </fieldset>
          </Card>

          <Card>
            <CardHead title="แบบบ้านและราคาฐาน" />
            <fieldset disabled={!editable} className="grid grid-cols-2 gap-3 px-5 py-4">
              <Field label="แบบบ้าน">
                <select
                  className={inputCls}
                  value={q.modelCode}
                  onChange={(e) => {
                    const nm = getHouseModel(e.target.value)!;
                    save({
                      modelCode: nm.code,
                      estimateId: undefined,
                      basePrice: Math.round(((nm.priceMin + nm.priceMax) / 2) * 1e6),
                      baseCost: Math.round(modelBoq(nm.code).cost),
                      baseLabel: `ก่อสร้างบ้านแบบ ${nm.name} (${nm.code}) พื้นที่ใช้สอย ${nm.area} ตร.ม. ตามรายการวัสดุมาตรฐาน`,
                    });
                  }}
                >
                  {houseModels.map((x) => (
                    <option key={x.code} value={x.code}>
                      {x.code} · {x.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="ราคาฐานจาก">
                <select
                  className={inputCls}
                  value={q.estimateId ?? ""}
                  onChange={(e) => {
                    const es = allEst.find((x) => x.id === e.target.value);
                    if (es) save({ estimateId: es.id, basePrice: Math.round(es.selling / 1000) * 1000, baseCost: es.cost });
                    else if (m) save({ estimateId: undefined, basePrice: Math.round(((m.priceMin + m.priceMax) / 2) * 1e6), baseCost: Math.round(modelBoq(m.code).cost) });
                  }}
                >
                  <option value="">ราคาแค็ตตาล็อก (กลาง)</option>
                  {modelEstimates.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.id} · {(x.selling / 1e6).toFixed(2)} ล้าน
                    </option>
                  ))}
                </select>
              </Field>
              <div className="col-span-2">
                <Field label="รายละเอียดงาน">
                  <input className={inputCls} value={q.baseLabel} onChange={(e) => save({ baseLabel: e.target.value })} />
                </Field>
              </div>
              <Field label="ราคาฐาน (บาท ก่อน VAT)">
                <NumInput value={q.basePrice} onChange={(v) => save({ basePrice: v })} />
              </Field>
              <Field label="ส่วนลดพิเศษท้ายบิล (บาท)">
                <NumInput value={q.billDiscount} onChange={(v) => save({ billDiscount: v })} />
              </Field>
              <Field label="ยืนราคา (วัน)">
                <NumInput value={q.validDays} onChange={(v) => save({ validDays: Math.max(1, v) })} />
              </Field>
              <Field label="ผู้เสนอราคา">
                <select className={inputCls} value={q.owner} onChange={(e) => save({ owner: e.target.value })}>
                  {Array.from(new Set([q.owner, ...team.filter((x) => x.active && ["sales", "exec", "admin"].includes(x.role)).map((x) => x.name)])).map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </Field>
              {editable && (
                <p className="col-span-2 text-[12px] text-ink-3">
                  <Link href={`/estimating?model=${q.modelCode}${q.leadId ? `&lead=${q.leadId}` : ""}`} className="text-accent-text hover:underline">
                    ประเมินราคาใหม่จาก BOQ
                  </Link>{" "}
                  แล้วบันทึก จะเลือกเป็นราคาฐานได้ที่ช่องด้านบน
                </p>
              )}
            </fieldset>
          </Card>

          <Card>
            <CardHead
              title="รายการเสริม/ตัวเลือก"
              meta={`${q.options.length} รายการ`}
              action={
                editable && (
                  <Btn small onClick={() => save({ options: [...q.options, { id: `${q.id}-L${Date.now().toString(36)}`, name: "รายการเพิ่มเติม", qty: 1, unit: "ชุด", unitPrice: 0, discount: 0, costCode: "10" }] })}>
                    <Plus {...I} />
                    เพิ่ม
                  </Btn>
                )
              }
            />
            {q.options.length ? (
              <ul className="divide-y divide-line">
                {q.options.map((l) => (
                  <li key={l.id} className="px-5 py-3">
                    <fieldset disabled={!editable} className="grid grid-cols-[1fr_auto] gap-2">
                      <input className={cx(inputCls, "h-8")} value={l.name} onChange={(e) => setLine(l.id, { name: e.target.value })} aria-label="รายการ" />
                      <IconBtn label="ลบรายการ" danger onClick={() => editable && save({ options: q.options.filter((x) => x.id !== l.id) })}>
                        <Trash2 {...I} />
                      </IconBtn>
                      <div className="col-span-2 grid grid-cols-[64px_64px_1fr_1fr] gap-2">
                        <NumInput small value={l.qty} onChange={(v) => setLine(l.id, { qty: v })} label="จำนวน" />
                        <input className={cx(inputCls, "h-8")} value={l.unit} onChange={(e) => setLine(l.id, { unit: e.target.value })} aria-label="หน่วย" />
                        <NumInput small value={l.unitPrice} onChange={(v) => setLine(l.id, { unitPrice: v })} label="ราคา/หน่วย" />
                        <NumInput small value={l.discount} onChange={(v) => setLine(l.id, { discount: v })} label="ส่วนลด (บาท)" />
                      </div>
                      <div className="col-span-2 flex items-center justify-between text-[12px] text-ink-3">
                        <select className="bg-transparent text-[12px] text-ink-3 outline-none" value={l.costCode ?? "10"} onChange={(e) => setLine(l.id, { costCode: e.target.value as CostCode })} aria-label="หมวดต้นทุน">
                          {(Object.keys(COST_CODES) as CostCode[]).map((c) => (
                            <option key={c} value={c}>
                              {c} {COST_CODES[c]}
                            </option>
                          ))}
                        </select>
                        <span className="num font-mono text-ink-2">{n0(l.qty * l.unitPrice - l.discount)}</span>
                      </div>
                    </fieldset>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>ยังไม่มีรายการเสริม</Empty>
            )}
          </Card>

          <Card>
            <CardHead
              title="งวดชำระเงิน"
              meta={termSum === 100 ? `${q.terms.length} งวด` : `รวม ${termSum}% ต้องเท่ากับ 100%`}
              action={
                editable && (
                  <select className={cx(inputCls, "h-8 text-[13px]")} value="" onChange={(e) => e.target.value && save({ terms: TERM_TEMPLATES.find((x) => x.key === e.target.value)!.terms })} aria-label="แม่แบบงวดชำระ">
                    <option value="">ใช้แม่แบบ</option>
                    {TERM_TEMPLATES.map((x) => (
                      <option key={x.key} value={x.key}>
                        {x.label}
                      </option>
                    ))}
                  </select>
                )
              }
            />
            <table className="w-full text-[13px]">
              <thead>
                <tr className={theadCls}>
                  <Th>งวด</Th>
                  <Th>เงื่อนไข</Th>
                  <Th right>%</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {q.terms.map((x) => (
                  <tr key={x.no}>
                    <Td mono>{x.no}</Td>
                    <Td>
                      {editable ? <input className={cx(inputCls, "h-8 w-full")} value={x.title} onChange={(e) => setTerm(x.no, { title: e.target.value })} aria-label={`เงื่อนไขงวด ${x.no}`} /> : x.title}
                      <span className="mt-0.5 block text-[12px] text-ink-3">เมื่อ {MILESTONE_LABEL[x.milestone]}</span>
                    </Td>
                    <Td right>{editable ? <NumInput small value={x.percent} onChange={(v) => setTerm(x.no, { percent: v })} label={`% งวด ${x.no}`} /> : <span className="font-mono">{x.percent}</span>}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
            {termSum !== 100 && <p className="border-t border-line px-5 py-2.5 text-[12px] text-neg">รวมทุกงวดต้องเท่ากับ 100% ก่อนเซ็นสัญญา</p>}
          </Card>

          <Card>
            <CardHead title="หมายเหตุและประวัติการแก้ไข" />
            <div className="px-5 py-4">
              <textarea
                disabled={!editable}
                value={q.note ?? ""}
                onChange={(e) => save({ note: e.target.value || undefined })}
                placeholder="เงื่อนไขเพิ่มเติมที่จะพิมพ์ในใบเสนอราคา"
                className="min-h-[64px] w-full rounded-[8px] border border-line-strong bg-card px-3 py-2 text-[13px] outline-none placeholder:text-ink-3 focus:border-ink-3 disabled:opacity-60"
              />
              <ul className="mt-3 space-y-1.5 text-[12px] text-ink-2">
                {q.revisions.map((r) => (
                  <li key={r.rev} className="flex justify-between gap-3">
                    <span>
                      rev.{r.rev} · {thDate(r.date)} · {r.note}
                    </span>
                    <span className="num font-mono">{n0(r.total)}</span>
                  </li>
                ))}
                <li className="flex justify-between gap-3 text-ink">
                  <span>
                    rev.{q.rev} · {thDate(q.date)} · ฉบับปัจจุบัน
                  </span>
                  <span className="num font-mono">{n0(t.total)}</span>
                </li>
              </ul>
              {q.lostReason && <p className="mt-3 text-[12px] text-neg">เหตุผลที่แพ้: {q.lostReason}</p>}
            </div>
          </Card>
        </div>
      </div>

      {signing && <SignModal q={q} onClose={() => setSigning(false)} by={me.name} />}
      {losing && <LostModal q={q} onClose={() => setLosing(false)} by={me.name} />}
    </>
  );
}

function SignModal({ q, onClose, by }: { q: Quote; onClose: () => void; by: string }) {
  const router = useRouter();
  const pms = team.filter((x) => x.active && (x.role === "pm" || x.role === "engineer"));
  const [start, setStart] = useState(addDays(TODAY, 30));
  const [pm, setPm] = useState(pms[0]?.name ?? "");
  const [done, setDone] = useState<string | null>(null);
  const t = quoteTotals(q);
  return (
    <Modal
      open
      onClose={onClose}
      title="เซ็นสัญญาก่อสร้าง"
      width={560}
      footer={
        done ? (
          <>
            <Btn onClick={onClose}>ปิด</Btn>
            <Btn primary onClick={() => router.push(`/projects/${done}`)}>
              เปิดโครงการ {done}
            </Btn>
          </>
        ) : (
          <>
            <Btn onClick={onClose}>ยกเลิก</Btn>
            <Btn primary disabled={!start || !pm} onClick={() => setDone(signQuote(q, { start, pm, by }).id)}>
              ยืนยันเซ็นสัญญา
            </Btn>
          </>
        )
      }
    >
      {done ? (
        <p className="text-[14px] text-ink-2">
          สร้างโครงการ <span className="font-mono text-ink">{done}</span> สถานะวางแผนแล้ว พร้อมงวดเงิน {q.terms.length} งวดและงบประมาณตามหมวดต้นทุน ใบเสนอราคาถูกอนุมัติและลีดเปลี่ยนเป็นเซ็นสัญญา
        </p>
      ) : (
        <div className="space-y-4">
          <p className="text-[13px] text-ink-2">
            {q.customer.name} · แบบ {q.modelCode} · มูลค่าสัญญา <span className="num font-mono text-ink">{n0(t.subtotal)}</span> บาท (ก่อน VAT)
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="วันเริ่มก่อสร้าง">
              <input type="date" className={inputCls} value={start} min={TODAY} onChange={(e) => setStart(e.target.value)} />
            </Field>
            <Field label="ผู้จัดการโครงการ">
              <select className={inputCls} value={pm} onChange={(e) => setPm(e.target.value)}>
                {pms.map((x) => (
                  <option key={x.id}>{x.name}</option>
                ))}
              </select>
            </Field>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-[12px] text-ink-3">
            <li>สร้างโครงการใหม่สถานะวางแผน ระยะเวลาตามแบบบ้าน</li>
            <li>ตั้งงวดเงินลูกค้า {q.terms.length} งวด กระจายตามระยะเวลาก่อสร้าง (ฝ่ายบัญชีออกใบแจ้งหนี้ต่อ)</li>
            <li>ตั้งงบประมาณโครงการตามหมวดต้นทุนจากประมาณการ</li>
          </ul>
        </div>
      )}
    </Modal>
  );
}

function LostModal({ q, onClose, by }: { q: Quote; onClose: () => void; by: string }) {
  const [reason, setReason] = useState("ราคาสูงกว่าคู่แข่ง");
  return (
    <Modal
      open
      onClose={onClose}
      title="บันทึกว่าแพ้"
      width={480}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn
            danger
            onClick={() => {
              quotes.upsert({ ...q, status: "lost", lostReason: reason });
              const lead = q.leadId ? leads.get(q.leadId) : undefined;
              if (lead && lead.stage !== "won") leads.upsert({ ...lead, stage: "lost", lostReason: reason, nextFollowUp: undefined, updated: TODAY, activities: [...lead.activities, { id: `A${Date.now().toString(36)}`, date: TODAY, kind: "stage", text: `แพ้ ${q.id} · ${reason}`, by }] });
              onClose();
            }}
          >
            บันทึก
          </Btn>
        </>
      }
    >
      <Field label="เหตุผล">
        <input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
    </Modal>
  );
}

function NumInput({ value, onChange, small, label }: { value: number; onChange: (v: number) => void; small?: boolean; label?: string }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      aria-label={label}
      className={cx(inputCls, "w-full text-right font-mono", small && "h-8 px-2 text-[13px]")}
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
    />
  );
}
function SumRow({ k, v }: { k: string; v: string }) {
  return (
    <tr className="border-b border-line">
      <td className="py-1 text-ink-2">{k}</td>
      <td className="py-1 text-right font-mono">{v}</td>
    </tr>
  );
}
function KV({ k, v, tone }: { k: string; v: string; tone?: "neg" }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <dt className="text-ink-2">{k}</dt>
      <dd className={cx("num font-mono", tone === "neg" ? "text-neg" : "text-ink")}>{v}</dd>
    </div>
  );
}
