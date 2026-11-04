"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Columns3, List, Phone, Plus, Search, X } from "lucide-react";
import { Card, CardHead, cx, Field, inputCls, PageHeader } from "@/components/ui";
import { Btn, Empty, Initials, Modal, Pill, Segmented, StatCard } from "@/components/ops/bits";
import { daysBetween, houseModels, thDate, TODAY } from "@/lib/data";
import { canEdit } from "@/lib/permissions";
import { PROVINCES } from "@/lib/projects-store";
import { relDays } from "@/components/dashboard/metrics";
import { LEAD_SOURCES, leads, newLeadId, quotes, quoteTotals, SALES_PEOPLE, setStage, SOURCE_LABEL, STAGE_LABEL, STAGE_WEIGHT, STAGES, type Lead, type LeadSource, type LeadStage } from "@/lib/sales/crm";
import { I, mb, STAGE_TONE, Td, Th, theadCls, useCostAccess } from "./common";

const OPEN: LeadStage[] = ["new", "contacted", "viewing", "quoted", "negotiating"];

export function LeadsView() {
  const router = useRouter();
  const list = leads.use();
  const qs = quotes.use();
  const { me } = useCostAccess();
  const editable = canEdit(me.role, "sales");
  const [view, setView] = useState<"board" | "list">("board");
  const [q, setQ] = useState("");
  const [owner, setOwner] = useState("");
  const [source, setSource] = useState<"" | LeadSource>("");
  const [stage, setStageF] = useState<"" | LeadStage>("");
  const [adding, setAdding] = useState(false);
  const [drag, setDrag] = useState<string | null>(null);

  const needle = q.trim().toLowerCase();
  const shown = list
    .filter((l) => !owner || l.owner === owner)
    .filter((l) => !source || l.source === source)
    .filter((l) => !stage || l.stage === stage)
    .filter((l) => !needle || [l.id, l.name, l.phone, l.lineId ?? "", l.province, ...l.models].some((s) => s.toLowerCase().includes(needle)));

  const year = TODAY.slice(0, 4);
  const kpi = (() => {
    const new30 = list.filter((l) => daysBetween(l.created, TODAY) <= 30).length;
    const prev30 = list.filter((l) => {
      const d = daysBetween(l.created, TODAY);
      return d > 30 && d <= 60;
    }).length;
    const closed = list.filter((l) => (l.stage === "won" || l.stage === "lost") && l.updated.startsWith(year));
    const wonYear = qs.filter((x) => x.status === "approved" && (x.signedDate ?? x.date).startsWith(year));
    const open = list.filter((l) => OPEN.includes(l.stage));
    const pipeline = open.reduce((s, l) => s + l.budget * 1e6, 0);
    const weighted = open.reduce((s, l) => s + l.budget * 1e6 * STAGE_WEIGHT[l.stage], 0);
    return {
      new30,
      prev30,
      conversion: closed.length ? closed.filter((l) => l.stage === "won").length / closed.length : 0,
      closed: closed.length,
      wonYear: wonYear.length,
      wonValue: wonYear.reduce((s, x) => s + quoteTotals(x).subtotal, 0),
      pipeline,
      weighted,
      open: open.length,
    };
  })();

  const due = list
    .filter((l) => OPEN.includes(l.stage) && l.nextFollowUp && l.nextFollowUp <= TODAY)
    .sort((a, b) => (a.nextFollowUp ?? "").localeCompare(b.nextFollowUp ?? ""));
  const sources = LEAD_SOURCES.map((s) => {
    const xs = list.filter((l) => l.source === s);
    const won = xs.filter((l) => l.stage === "won").length;
    return { s, n: xs.length, won, open: xs.filter((l) => OPEN.includes(l.stage)).length };
  }).sort((a, b) => b.n - a.n);
  const maxSrc = Math.max(1, ...sources.map((s) => s.n));
  const owners = Array.from(new Set([...SALES_PEOPLE, ...list.map((l) => l.owner)]));
  const move = (l: Lead, dir: 1 | -1) => {
    const order: LeadStage[] = [...OPEN, "won"];
    const i = order.indexOf(l.stage);
    const next = order[i + dir];
    if (next) setStage(l, next, me.name);
  };

  return (
    <>
      <PageHeader
        title="ลูกค้า & ลีด"
        sub={`${list.length} ลีด · กำลังติดตาม ${kpi.open} ราย · นัดติดตามวันนี้ ${due.length} ราย`}
        actions={
          editable && (
            <Btn primary onClick={() => setAdding(true)}>
              <Plus {...I} />
              เพิ่มลีด
            </Btn>
          )
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="ลีดใหม่ 30 วัน" value={kpi.new30} unit="ราย" note={`30 วันก่อนหน้า ${kpi.prev30} ราย`} onClick={() => setStageF(stage === "new" ? "" : "new")} active={stage === "new"} />
        <StatCard label="อัตราปิดการขาย" value={kpi.closed ? `${Math.round(kpi.conversion * 100)}%` : "–"} note={`ลีดที่ปิดแล้วปีนี้ ${kpi.closed} ราย`} />
        <StatCard label="มูลค่าไปป์ไลน์" value={mb(kpi.pipeline, 1)} note={`ถ่วงน้ำหนักตามขั้น ${mb(kpi.weighted, 1)}`} />
        <StatCard label={`เซ็นสัญญาปี ${Number(year) + 543}`} value={kpi.wonYear} unit="หลัง" note={`มูลค่า ${mb(kpi.wonValue, 1)} ก่อน VAT`} onClick={() => setStageF(stage === "won" ? "" : "won")} active={stage === "won"} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_340px]">
        <Card>
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
            <label className="relative min-w-[220px] flex-1">
              <Search {...I} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อ เบอร์โทร LINE จังหวัด แบบบ้าน" className={cx(inputCls, "w-full pl-9")} aria-label="ค้นหาลีด" />
            </label>
            <select aria-label="ผู้ดูแล" className={inputCls} value={owner} onChange={(e) => setOwner(e.target.value)}>
              <option value="">ทุกผู้ดูแล</option>
              {owners.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
            <select aria-label="แหล่งที่มา" className={inputCls} value={source} onChange={(e) => setSource(e.target.value as LeadSource | "")}>
              <option value="">ทุกแหล่งที่มา</option>
              {LEAD_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {SOURCE_LABEL[s]}
                </option>
              ))}
            </select>
            {view === "list" && (
              <select aria-label="ขั้นการขาย" className={inputCls} value={stage} onChange={(e) => setStageF(e.target.value as LeadStage | "")}>
                <option value="">ทุกขั้น</option>
                {STAGES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            )}
            {(q || owner || source || stage) && (
              <button
                type="button"
                onClick={() => {
                  setQ("");
                  setOwner("");
                  setSource("");
                  setStageF("");
                }}
                className="inline-flex h-9 items-center gap-1 rounded-[8px] px-2 text-[13px] text-ink-2 hover:bg-raised"
              >
                <X size={14} strokeWidth={1.5} />
                ล้างตัวกรอง
              </button>
            )}
            <span className="ml-auto">
              <Segmented
                value={view}
                onChange={setView}
                options={[
                  { key: "board", label: "บอร์ด", icon: <Columns3 size={14} strokeWidth={1.5} /> },
                  { key: "list", label: "รายการ", icon: <List size={14} strokeWidth={1.5} /> },
                ]}
              />
            </span>
          </div>

          {view === "board" ? (
            <div className="flex gap-3 overflow-x-auto p-3">
              {STAGES.filter((s) => !stage || s.key === stage).map((s) => {
                const items = shown.filter((l) => l.stage === s.key).sort((a, b) => (a.nextFollowUp ?? "9").localeCompare(b.nextFollowUp ?? "9") || b.updated.localeCompare(a.updated));
                const closedCol = s.key === "won" || s.key === "lost";
                const visible = closedCol ? items.slice(0, 6) : items;
                return (
                  <section
                    key={s.key}
                    onDragOver={(e) => editable && e.preventDefault()}
                    onDrop={() => {
                      const l = drag ? list.find((x) => x.id === drag) : undefined;
                      if (l && editable) setStage(l, s.key, me.name, s.key === "lost" ? "ปิดจากบอร์ด" : undefined);
                      setDrag(null);
                    }}
                    className={cx("flex w-[236px] shrink-0 flex-col rounded-[12px] border border-line bg-raised/40", drag && "border-dashed border-line-strong")}
                  >
                    <header className="flex items-center justify-between px-3 py-2.5">
                      <span className="flex items-center gap-2 text-[13px] font-medium">
                        <Pill tone={STAGE_TONE[s.key]}>{s.label}</Pill>
                      </span>
                      <span className="font-mono text-[12px] text-ink-3">{items.length}</span>
                    </header>
                    <ul className="flex min-h-[80px] flex-col gap-2 px-2 pb-2">
                      {visible.map((l) => (
                        <li
                          key={l.id}
                          draggable={editable}
                          onDragStart={() => setDrag(l.id)}
                          onDragEnd={() => setDrag(null)}
                          className={cx("group rounded-[10px] border border-line bg-card px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]", editable && "cursor-grab active:cursor-grabbing", drag === l.id && "opacity-50")}
                        >
                          <Link href={`/sales/${l.id}`} className="block">
                            <p className="truncate text-[13px] text-ink">{l.name}</p>
                            <p className="mt-0.5 truncate text-[12px] text-ink-3">
                              {l.models.join(", ")} · {l.budget.toFixed(1)} ล้าน · {l.province}
                            </p>
                          </Link>
                          <div className="mt-2 flex items-center justify-between gap-2 text-[12px]">
                            <span className="text-ink-3">{SOURCE_LABEL[l.source]}</span>
                            {l.nextFollowUp && !closedCol ? (
                              <span className={cx(l.nextFollowUp < TODAY ? "text-neg" : l.nextFollowUp === TODAY ? "text-accent-text" : "text-ink-2")}>{relDays(l.nextFollowUp)}</span>
                            ) : (
                              <span className="font-mono text-ink-3">{l.projectId ?? thDate(l.updated)}</span>
                            )}
                          </div>
                          {editable && !closedCol && (
                            <div className="mt-2 flex justify-between border-t border-line pt-1.5 opacity-60 transition-opacity duration-150 group-hover:opacity-100">
                              <button type="button" aria-label="ย้ายกลับ" disabled={l.stage === "new"} onClick={() => move(l, -1)} className="inline-flex size-6 items-center justify-center rounded-[6px] text-ink-3 hover:bg-raised hover:text-ink disabled:opacity-30">
                                <ChevronLeft size={14} strokeWidth={1.5} />
                              </button>
                              <span className="text-[11px] text-ink-3">{l.owner.split(" ")[0]}</span>
                              <button type="button" aria-label="ย้ายไปขั้นถัดไป" onClick={() => move(l, 1)} className="inline-flex size-6 items-center justify-center rounded-[6px] text-ink-3 hover:bg-raised hover:text-ink">
                                <ChevronRight size={14} strokeWidth={1.5} />
                              </button>
                            </div>
                          )}
                        </li>
                      ))}
                      {items.length > visible.length && (
                        <li>
                          <button type="button" onClick={() => setStageF(s.key)} className="w-full rounded-[8px] py-1.5 text-[12px] text-ink-2 hover:bg-raised">
                            ดูอีก {items.length - visible.length} ราย
                          </button>
                        </li>
                      )}
                    </ul>
                  </section>
                );
              })}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-[13px]">
                <thead>
                  <tr className={theadCls}>
                    <Th>ลีด</Th>
                    <Th>ติดต่อ</Th>
                    <Th>แบบที่สนใจ</Th>
                    <Th right>งบ (ล้าน)</Th>
                    <Th>ที่ดิน</Th>
                    <Th>ขั้น</Th>
                    <Th>ติดตามครั้งถัดไป</Th>
                    <Th>ผู้ดูแล</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {[...shown]
                    .sort((a, b) => b.created.localeCompare(a.created))
                    .map((l) => (
                      <tr key={l.id} onClick={() => router.push(`/sales/${l.id}`)} className="cursor-pointer transition-colors duration-150 hover:bg-raised/60">
                        <Td>
                          <span className="text-ink">{l.name}</span>
                          <span className="block font-mono text-[12px] text-ink-3">
                            {l.id} · {SOURCE_LABEL[l.source]}
                          </span>
                        </Td>
                        <Td className="whitespace-nowrap text-[12px] text-ink-2">
                          {l.phone}
                          {l.lineId && <span className="block text-ink-3">LINE {l.lineId}</span>}
                        </Td>
                        <Td className="font-mono text-[12px] text-ink-2">{l.models.join(", ")}</Td>
                        <Td right mono>
                          {l.budget.toFixed(1)}
                        </Td>
                        <Td className="text-[12px] text-ink-2">
                          {l.province}
                          {l.landSize ? ` · ${l.landSize} ตร.ว.` : ""}
                        </Td>
                        <Td>
                          <Pill tone={STAGE_TONE[l.stage]}>{STAGE_LABEL[l.stage]}</Pill>
                        </Td>
                        <Td className={cx("whitespace-nowrap text-[12px]", l.nextFollowUp && l.nextFollowUp < TODAY ? "text-neg" : "text-ink-2")}>{l.nextFollowUp && OPEN.includes(l.stage) ? `${thDate(l.nextFollowUp)} · ${relDays(l.nextFollowUp)}` : "–"}</Td>
                        <Td className="text-[12px] text-ink-2">{l.owner}</Td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {!shown.length && <Empty>ไม่พบลีดที่ตรงกับตัวกรอง</Empty>}
            </div>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHead title="ต้องติดตามวันนี้" meta={`${due.length} ราย`} />
            {due.length ? (
              <ul className="divide-y divide-line">
                {due.slice(0, 8).map((l) => (
                  <li key={l.id}>
                    <Link href={`/sales/${l.id}`} className="flex items-center gap-3 px-5 py-2.5 transition-colors duration-150 hover:bg-raised/60">
                      <Initials name={l.name} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] text-ink">{l.name}</span>
                        <span className="flex items-center gap-1 text-[12px] text-ink-3">
                          <Phone size={12} strokeWidth={1.5} />
                          {l.phone} · {STAGE_LABEL[l.stage]}
                        </span>
                      </span>
                      <span className={cx("text-[12px]", l.nextFollowUp! < TODAY ? "text-neg" : "text-accent-text")}>{relDays(l.nextFollowUp!)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>ไม่มีนัดติดตามค้าง</Empty>
            )}
          </Card>
          <Card>
            <CardHead title="แหล่งที่มาของลีด" meta="ทั้งหมด / เซ็นสัญญา" />
            <ul className="space-y-2.5 px-5 py-4">
              {sources.map((s) => (
                <li key={s.s}>
                  <button type="button" onClick={() => setSource(source === s.s ? "" : s.s)} className="w-full text-left">
                    <div className="flex items-baseline justify-between text-[13px]">
                      <span className={source === s.s ? "text-ink" : "text-ink-2"}>{SOURCE_LABEL[s.s]}</span>
                      <span className="num font-mono text-[12px] text-ink-3">
                        {s.n} / {s.won} · {s.n ? Math.round((s.won / s.n) * 100) : 0}%
                      </span>
                    </div>
                    <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-raised">
                      <div className="h-full bg-ink" style={{ width: `${(s.won / maxSrc) * 100}%` }} />
                      <div className="h-full bg-deep" style={{ width: `${((s.n - s.won) / maxSrc) * 100}%` }} />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      {adding && <NewLead onClose={() => setAdding(false)} owner={me.name} onCreated={(id) => router.push(`/sales/${id}`)} />}
    </>
  );
}

function NewLead({ onClose, owner, onCreated }: { onClose: () => void; owner: string; onCreated: (id: string) => void }) {
  const [f, setF] = useState({ name: "", phone: "", lineId: "", source: "facebook" as LeadSource, budget: "", province: "กรุงเทพฯ", landSize: "", model: "HM-17", owner: SALES_PEOPLE.includes(owner) ? owner : (SALES_PEOPLE[0] ?? owner), notes: "" });
  const ok = f.name.trim() && f.phone.trim();
  const save = () => {
    if (!ok) return;
    const id = newLeadId();
    leads.upsert({
      id,
      name: f.name.trim(),
      phone: f.phone.trim(),
      lineId: f.lineId.trim() || undefined,
      source: f.source,
      budget: Number(f.budget) || 0,
      province: f.province,
      landSize: Number(f.landSize) || undefined,
      models: [f.model],
      owner: f.owner,
      stage: "new",
      nextFollowUp: TODAY,
      created: TODAY,
      updated: TODAY,
      notes: f.notes.trim() || undefined,
      activities: [{ id: "A1", date: TODAY, kind: "note", text: `ลีดเข้ามาจาก ${SOURCE_LABEL[f.source]}`, by: owner }],
    });
    onCreated(id);
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="เพิ่มลีด"
      width={640}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!ok} onClick={save}>
            บันทึก
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="ชื่อลูกค้า">
          <input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus />
        </Field>
        <Field label="โทรศัพท์">
          <input className={inputCls} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        </Field>
        <Field label="LINE ID">
          <input className={inputCls} value={f.lineId} onChange={(e) => setF({ ...f, lineId: e.target.value })} />
        </Field>
        <Field label="แหล่งที่มา">
          <select className={inputCls} value={f.source} onChange={(e) => setF({ ...f, source: e.target.value as LeadSource })}>
            {LEAD_SOURCES.map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="งบประมาณ (ล้านบาท)">
          <input className={inputCls} inputMode="decimal" value={f.budget} onChange={(e) => setF({ ...f, budget: e.target.value })} />
        </Field>
        <Field label="แบบที่สนใจ">
          <select className={inputCls} value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })}>
            {houseModels.map((m) => (
              <option key={m.code} value={m.code}>
                {m.code} · {m.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="จังหวัดที่ดิน">
          <select className={inputCls} value={f.province} onChange={(e) => setF({ ...f, province: e.target.value })}>
            {PROVINCES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </Field>
        <Field label="ขนาดที่ดิน (ตร.ว.)">
          <input className={inputCls} inputMode="numeric" value={f.landSize} onChange={(e) => setF({ ...f, landSize: e.target.value })} />
        </Field>
        <Field label="ผู้ดูแล">
          <select className={inputCls} value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })}>
            {Array.from(new Set([f.owner, ...SALES_PEOPLE])).map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </Field>
        <div className="col-span-2">
          <Field label="บันทึก">
            <input className={inputCls} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
