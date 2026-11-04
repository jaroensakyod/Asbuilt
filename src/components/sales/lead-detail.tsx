"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Calculator, FilePlus2, MessageCircle, Phone, Trash2 } from "lucide-react";
import { Card, CardHead, cx, Field, inputCls } from "@/components/ui";
import { Btn, Empty, IconBtn, Pill, useHydrated } from "@/components/ops/bits";
import { getHouseModel, houseModels, thDate, TODAY } from "@/lib/data";
import { canEdit } from "@/lib/permissions";
import { PROVINCES } from "@/lib/projects-store";
import { relDays } from "@/components/dashboard/metrics";
import {
  ACTIVITY_LABEL,
  addActivity,
  createQuote,
  estimates,
  LEAD_SOURCES,
  leads,
  QUOTE_STATUS_LABEL,
  quotes,
  quoteStatus,
  quoteTotals,
  SALES_PEOPLE,
  setStage,
  SOURCE_LABEL,
  STAGE_LABEL,
  STAGES,
  type ActivityKind,
  type Lead,
  type LeadSource,
} from "@/lib/sales/crm";
import { I, n0, QUOTE_TONE, STAGE_TONE, Td, Th, theadCls, useCostAccess } from "./common";

export function LeadDetail({ id }: { id: string }) {
  const hydrated = useHydrated();
  const all = leads.use();
  const lead = all.find((l) => l.id === id);
  if (!lead) return hydrated ? <Empty>ไม่พบลีด {id}</Empty> : <div className="h-[60vh]" />;
  return <Detail lead={lead} />;
}

function Detail({ lead }: { lead: Lead }) {
  const router = useRouter();
  const { me, canSeeCost } = useCostAccess();
  const editable = canEdit(me.role, "sales");
  const qs = quotes.use().filter((q) => q.leadId === lead.id);
  const ests = estimates.use().filter((e) => e.leadId === lead.id);
  const [kind, setKind] = useState<ActivityKind>("call");
  const [text, setText] = useState("");
  const [date, setDate] = useState(TODAY);
  const [lostReason, setLostReason] = useState("");
  const [askLost, setAskLost] = useState(false);
  const save = (patch: Partial<Lead>) => leads.upsert({ ...lead, ...patch, updated: TODAY });

  const newQuote = () => {
    const est = [...ests].sort((a, b) => b.date.localeCompare(a.date))[0];
    const q = createQuote({ lead, modelCode: est?.modelCode ?? lead.models[0] ?? "HM-17", estimate: est, owner: lead.owner });
    router.push(`/quotes/${q.id}`);
  };
  const acts = [...lead.activities].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const closed = lead.stage === "won" || lead.stage === "lost";

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/sales" className="mr-1 inline-flex h-8 items-center gap-1.5 rounded-[8px] px-2 text-[13px] text-ink-2 transition-colors duration-150 hover:bg-raised hover:text-ink">
            <ArrowLeft {...I} />
            ลูกค้า & ลีด
          </Link>
          <Pill mono>{lead.id}</Pill>
          <Pill tone={STAGE_TONE[lead.stage]}>{STAGE_LABEL[lead.stage]}</Pill>
          {lead.projectId && (
            <Link href={`/projects/${lead.projectId}`} className="text-[13px] text-accent-text hover:underline">
              โครงการ {lead.projectId}
            </Link>
          )}
        </div>
        {editable && (
          <div className="flex flex-wrap items-center gap-2">
            {canSeeCost && (
              <Btn onClick={() => router.push(`/estimating?lead=${lead.id}&model=${lead.models[0] ?? ""}`)}>
                <Calculator {...I} />
                ประเมินราคา
              </Btn>
            )}
            <Btn primary onClick={newQuote}>
              <FilePlus2 {...I} />
              สร้างใบเสนอราคา
            </Btn>
            {lead.stage !== "won" && (
              <IconBtn
                label="ลบลีด"
                danger
                onClick={() => {
                  if (window.confirm(`ลบลีด ${lead.name}`)) {
                    leads.remove(lead.id);
                    router.push("/sales");
                  }
                }}
              >
                <Trash2 {...I} />
              </IconBtn>
            )}
          </div>
        )}
      </div>

      <h1 className="text-[28px] font-normal leading-[1.15]">{lead.name}</h1>
      <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-2">
        <span className="inline-flex items-center gap-1.5">
          <Phone size={14} strokeWidth={1.5} />
          {lead.phone}
        </span>
        {lead.lineId && (
          <span className="inline-flex items-center gap-1.5">
            <MessageCircle size={14} strokeWidth={1.5} />
            LINE {lead.lineId}
          </span>
        )}
        <span>
          {SOURCE_LABEL[lead.source]} · สร้างเมื่อ {thDate(lead.created)} · ผู้ดูแล {lead.owner}
        </span>
      </p>

      {/* stage stepper */}
      <div className="mt-5 flex flex-wrap gap-1.5">
        {STAGES.map((s) => (
          <button
            key={s.key}
            type="button"
            disabled={!editable || lead.stage === s.key}
            onClick={() => (s.key === "lost" ? setAskLost(true) : setStage(lead, s.key, me.name))}
            className={cx(
              "h-8 rounded-[8px] border px-3 text-[13px] transition-colors duration-150 disabled:cursor-default",
              lead.stage === s.key ? "border-ink bg-ink text-card" : "border-line-strong bg-card text-ink-2 hover:bg-raised enabled:hover:text-ink",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      {askLost && (
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-[10px] border border-line bg-card px-4 py-3">
          <Field label="เหตุผลที่แพ้">
            <input className={cx(inputCls, "w-[320px]")} value={lostReason} onChange={(e) => setLostReason(e.target.value)} placeholder="เช่น ราคาสูงกว่าคู่แข่ง" />
          </Field>
          <Btn
            danger
            onClick={() => {
              setStage(lead, "lost", me.name, lostReason || "ไม่ระบุ");
              setAskLost(false);
            }}
          >
            ยืนยัน
          </Btn>
          <Btn onClick={() => setAskLost(false)}>ยกเลิก</Btn>
        </div>
      )}

      <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHead title="ใบเสนอราคา" meta={`${qs.length} ฉบับ`} />
            {qs.length ? (
              <table className="w-full text-[13px]">
                <thead>
                  <tr className={theadCls}>
                    <Th>เลขที่</Th>
                    <Th>แบบบ้าน</Th>
                    <Th right>รวม VAT</Th>
                    {canSeeCost && <Th right>กำไร</Th>}
                    <Th>สถานะ</Th>
                    <Th>วันที่</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {qs.map((q) => {
                    const t = quoteTotals(q);
                    const st = quoteStatus(q);
                    return (
                      <tr key={q.id} onClick={() => router.push(`/quotes/${q.id}`)} className="cursor-pointer hover:bg-raised/60">
                        <Td mono>
                          {q.id}
                          {q.rev > 1 && <span className="ml-1 text-ink-3">rev.{q.rev}</span>}
                        </Td>
                        <Td className="text-ink-2">
                          <span className="font-mono text-[12px]">{q.modelCode}</span> {getHouseModel(q.modelCode)?.name}
                        </Td>
                        <Td right mono>
                          {n0(t.total)}
                        </Td>
                        {canSeeCost && (
                          <Td right mono className="text-ink-2">
                            {t.margin !== undefined ? `${(t.margin * 100).toFixed(1)}%` : "–"}
                          </Td>
                        )}
                        <Td>
                          <Pill tone={QUOTE_TONE[st]}>{QUOTE_STATUS_LABEL[st]}</Pill>
                        </Td>
                        <Td className="text-[12px] text-ink-2">{thDate(q.date)}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <Empty>ยังไม่มีใบเสนอราคา</Empty>
            )}
            {canSeeCost && ests.length > 0 && (
              <p className="border-t border-line px-5 py-2.5 text-[12px] text-ink-3">
                ประมาณการของลีดนี้ {ests.map((e) => `${e.id} (${(e.selling / 1e6).toFixed(2)} ล้าน)`).join(", ")}
              </p>
            )}
          </Card>

          <Card>
            <CardHead title="กิจกรรม" meta={`${lead.activities.length} รายการ`} />
            {editable && !closed && (
              <div className="flex flex-wrap items-end gap-2 border-b border-line px-5 py-3">
                <select className={cx(inputCls, "w-[150px]")} value={kind} onChange={(e) => setKind(e.target.value as ActivityKind)} aria-label="ประเภทกิจกรรม">
                  {(["call", "line", "meeting", "visit", "note"] as ActivityKind[]).map((k) => (
                    <option key={k} value={k}>
                      {ACTIVITY_LABEL[k]}
                    </option>
                  ))}
                </select>
                <input type="date" className={cx(inputCls, "w-[150px]")} value={date} max={TODAY} onChange={(e) => setDate(e.target.value)} aria-label="วันที่" />
                <input className={cx(inputCls, "min-w-[220px] flex-1")} value={text} onChange={(e) => setText(e.target.value)} placeholder="รายละเอียด เช่น นัดดูที่ดินวันเสาร์" aria-label="รายละเอียด" />
                <Btn
                  primary
                  disabled={!text.trim()}
                  onClick={() => {
                    addActivity(lead, { date, kind, text: text.trim(), by: me.name });
                    setText("");
                  }}
                >
                  บันทึก
                </Btn>
              </div>
            )}
            <ol className="px-5 py-4">
              {acts.map((a, i) => (
                <li key={a.id} className="relative flex gap-3 pb-4 last:pb-0">
                  {i < acts.length - 1 && <span aria-hidden className="absolute left-[5px] top-4 h-full w-px bg-line" />}
                  <span aria-hidden className={cx("mt-1.5 size-[11px] shrink-0 rounded-full border-2 bg-card", a.kind === "stage" ? "border-accent" : a.kind === "quote" ? "border-ink" : "border-line-strong")} />
                  <div className="min-w-0">
                    <p className="text-[13px] text-ink">{a.text}</p>
                    <p className="text-[12px] text-ink-3">
                      {thDate(a.date)} · {ACTIVITY_LABEL[a.kind]} · {a.by}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHead title="ติดตามครั้งถัดไป" />
            <div className="flex items-end gap-3 px-5 py-4">
              <Field label="วันที่">
                <input type="date" disabled={!editable || closed} className={inputCls} value={lead.nextFollowUp ?? ""} onChange={(e) => save({ nextFollowUp: e.target.value || undefined })} />
              </Field>
              {lead.nextFollowUp && !closed && <span className={cx("pb-2 text-[13px]", lead.nextFollowUp < TODAY ? "text-neg" : "text-ink-2")}>{relDays(lead.nextFollowUp)}</span>}
            </div>
          </Card>
          <Card>
            <CardHead title="ข้อมูลลูกค้า" />
            <fieldset disabled={!editable} className="grid grid-cols-2 gap-3 px-5 py-4">
              <Field label="ชื่อ">
                <input className={inputCls} value={lead.name} onChange={(e) => save({ name: e.target.value })} />
              </Field>
              <Field label="โทรศัพท์">
                <input className={inputCls} value={lead.phone} onChange={(e) => save({ phone: e.target.value })} />
              </Field>
              <Field label="LINE ID">
                <input className={inputCls} value={lead.lineId ?? ""} onChange={(e) => save({ lineId: e.target.value || undefined })} />
              </Field>
              <Field label="อีเมล">
                <input className={inputCls} value={lead.email ?? ""} onChange={(e) => save({ email: e.target.value || undefined })} />
              </Field>
              <Field label="แหล่งที่มา">
                <select className={inputCls} value={lead.source} onChange={(e) => save({ source: e.target.value as LeadSource })}>
                  {LEAD_SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {SOURCE_LABEL[s]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="งบประมาณ (ล้านบาท)">
                <input className={cx(inputCls, "font-mono")} type="number" step={0.1} min={0} value={lead.budget} onChange={(e) => save({ budget: Math.max(0, Number(e.target.value) || 0) })} />
              </Field>
              <Field label="จังหวัดที่ดิน">
                <select className={inputCls} value={lead.province} onChange={(e) => save({ province: e.target.value })}>
                  {Array.from(new Set([lead.province, ...PROVINCES])).map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </Field>
              <Field label="ขนาดที่ดิน (ตร.ว.)">
                <input className={cx(inputCls, "font-mono")} type="number" min={0} value={lead.landSize ?? ""} onChange={(e) => save({ landSize: Number(e.target.value) || undefined })} />
              </Field>
              <Field label="ผู้ดูแล">
                <select className={inputCls} value={lead.owner} onChange={(e) => save({ owner: e.target.value })}>
                  {Array.from(new Set([lead.owner, ...SALES_PEOPLE])).map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </Field>
              <div className="col-span-2">
                <Field label="บันทึก">
                  <input className={inputCls} value={lead.notes ?? ""} onChange={(e) => save({ notes: e.target.value || undefined })} />
                </Field>
              </div>
            </fieldset>
          </Card>
          <Card>
            <CardHead title="แบบที่สนใจ" meta={`${lead.models.length} แบบ`} />
            <ul className="divide-y divide-line">
              {lead.models.map((c) => {
                const m = getHouseModel(c);
                return (
                  <li key={c} className="flex items-center gap-3 px-5 py-2.5 text-[13px]">
                    <span className="font-mono text-[12px] text-ink-3">{c}</span>
                    <span className="min-w-0 flex-1 truncate">{m?.name}</span>
                    <span className="num font-mono text-[12px] text-ink-2">{m ? `${m.priceMin}–${m.priceMax} ล้าน` : ""}</span>
                    {editable && lead.models.length > 1 && (
                      <button type="button" className="text-[12px] text-ink-3 hover:text-neg" onClick={() => save({ models: lead.models.filter((x) => x !== c) })}>
                        เอาออก
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            {editable && (
              <div className="border-t border-line px-5 py-3">
                <select className={cx(inputCls, "w-full")} value="" onChange={(e) => e.target.value && save({ models: [...lead.models, e.target.value] })} aria-label="เพิ่มแบบที่สนใจ">
                  <option value="">เพิ่มแบบบ้าน</option>
                  {houseModels
                    .filter((m) => !lead.models.includes(m.code))
                    .map((m) => (
                      <option key={m.code} value={m.code}>
                        {m.code} · {m.name}
                      </option>
                    ))}
                </select>
              </div>
            )}
          </Card>
          {lead.lostReason && lead.stage === "lost" && <p className="rounded-[10px] border border-line bg-card px-4 py-3 text-[13px] text-neg">เหตุผลที่แพ้: {lead.lostReason}</p>}
        </div>
      </div>
    </>
  );
}
