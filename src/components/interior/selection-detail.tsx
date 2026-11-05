"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Lock, Pencil, Plus, ShoppingCart, Trash2, Unlock } from "lucide-react";
import { Card, CardHead, cx, Field, inputCls } from "@/components/ui";
import { Btn, Empty, I, Modal, Pill, Select, StatCard, areaCls } from "@/components/ops/bits";
import { MediaField } from "@/components/media/media-field";
import { TODAY, getProject } from "@/lib/data";
import { variations } from "@/lib/biz";
import { suppliers } from "@/lib/procurement/store";
import { portalTokenFor } from "@/lib/portal";
import {
  SEL_CATEGORY_LABEL,
  SEL_STATUS_LABEL,
  addDays,
  allowanceTotal,
  approveSelection,
  chooseOption,
  daysBetween,
  isSelectionLate,
  linkSelectionPR,
  optionTotal,
  products,
  raiseSelectionVariation,
  reopenSelection,
  selectionDiff,
  selectionSummary,
  selections,
  type SelCategory,
  type Selection,
  type SelectionOption,
  type Product,
} from "@/lib/interior";
import { Amt, Check, Header, NumInput, Swatch, dateOr, usePerms } from "@/components/design/bits";
import { AiSelectionSuggest } from "@/components/ai-sales/selection-suggest";

const ST_TONE = { pending: "warn", chosen: "accent", approved: "pos" } as const;
const VO_LABEL: Record<string, string> = { draft: "ร่าง", priced: "ตีราคาแล้ว", submitted: "รอลูกค้าอนุมัติ", approved: "ลูกค้าอนุมัติแล้ว", rejected: "ลูกค้าไม่อนุมัติ", void: "ยกเลิก" };

export function SelectionDetail({ projectId }: { projectId: string }) {
  const { edit, approve, me } = usePerms("interior");
  const all = selections.use();
  const p = getProject(projectId);
  const list = useMemo(() => all.filter((s) => s.projectId === projectId), [all, projectId]);
  const [form, setForm] = useState<{ s?: Selection } | null>(null);
  const [approving, setApproving] = useState<Selection | null>(null);
  const [filter, setFilter] = useState("");
  const sum = selectionSummary(list, TODAY);
  const rooms = [...new Set(list.map((s) => s.room))];
  const shown = list.filter((s) => !filter || (filter === "late" ? isSelectionLate(s, TODAY) : s.status === filter));

  return (
    <>
      <Header
        eyebrow={`ลูกค้าเลือกวัสดุ · ${projectId}`}
        title={p?.name ?? projectId}
        sub={`${p?.owner ?? ""} · ${p?.phase ?? ""} · ลูกค้าเลือกได้เองในพอร์ทัลเจ้าของบ้าน`}
        actions={
          <>
            <a href={`/portal/${portalTokenFor(projectId)}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-[8px] border border-line-strong bg-card px-4 text-[14px] font-medium hover:bg-raised">
              <ArrowUpRight {...I} />
              มุมมองลูกค้า
            </a>
            {edit && (
              <Btn primary onClick={() => setForm({})}>
                <Plus {...I} />
                เพิ่มรายการ
              </Btn>
            )}
          </>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="อนุมัติและล็อกแล้ว" value={`${sum.approved}/${sum.total}`} unit="รายการ" onClick={() => setFilter(filter === "approved" ? "" : "approved")} active={filter === "approved"} />
        <StatCard label="รอลูกค้าเลือก" value={sum.pending} unit="รายการ" note={sum.late ? `เลยกำหนด ${sum.late} รายการ` : "ไม่มีรายการเลยกำหนด"} tone={sum.late ? "neg" : undefined} onClick={() => setFilter(filter === "late" ? "" : "late")} active={filter === "late"} />
        <StatCard label="เลือกแล้ว รออนุมัติ" value={sum.chosen} unit="รายการ" onClick={() => setFilter(filter === "chosen" ? "" : "chosen")} active={filter === "chosen"} />
        <StatCard label="ส่วนต่างจากงบมาตรฐาน" value={<Amt n={sum.diff} signed />} note={`งบมาตรฐาน ${Math.round(sum.allowance).toLocaleString("th-TH")} บาท`} />
      </div>
      {list.length === 0 && (
        <Card>
          <Empty>ยังไม่มีรายการให้ลูกค้าเลือก{edit ? " กด “เพิ่มรายการ”" : ""}</Empty>
        </Card>
      )}
      <div className="flex flex-col gap-6">
        {rooms.map((room) => {
          const rows = shown.filter((s) => s.room === room);
          if (!rows.length) return null;
          return (
            <section key={room}>
              <h2 className="mb-2 text-[16px] font-medium">{room}</h2>
              <div className="grid gap-4 xl:grid-cols-2">
                {rows.map((s) => (
                  <SelectionCard key={s.id} s={s} edit={edit} approve={approve} me={me.name} onEdit={() => setForm({ s })} onApprove={() => setApproving(s)} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
      {form && <SelectionForm projectId={projectId} initial={form.s} rooms={rooms} onClose={() => setForm(null)} />}
      {approving && <ApproveModal s={approving} me={me.name} onClose={() => setApproving(null)} />}
    </>
  );
}

function SelectionCard({ s, edit, approve, me, onEdit, onApprove }: { s: Selection; edit: boolean; approve: boolean; me: string; onEdit: () => void; onApprove: () => void }) {
  const vos = variations.use();
  const vo = s.variationId ? vos.find((v) => v.id === s.variationId) : undefined;
  const late = isSelectionLate(s, TODAY);
  const left = daysBetween(TODAY, s.deadline);
  const diff = selectionDiff(s);
  const locked = s.status === "approved";
  return (
    <Card>
      <CardHead
        title={s.item}
        meta={`${SEL_CATEGORY_LABEL[s.category]} · ${s.qty.toLocaleString("th-TH")} ${s.unit}`}
        action={
          <div className="flex items-center gap-2">
            <Pill tone={ST_TONE[s.status]}>
              {locked && <Lock size={12} strokeWidth={1.5} className="mr-1" />}
              {SEL_STATUS_LABEL[s.status]}
            </Pill>
            {edit && !locked && (
              <button type="button" aria-label="แก้ไข" onClick={onEdit} className="inline-flex size-8 items-center justify-center rounded-[8px] text-ink-3 hover:bg-raised hover:text-ink">
                <Pencil {...I} />
              </button>
            )}
          </div>
        }
      />
      <div className="flex flex-wrap gap-x-6 gap-y-1 px-5 pt-3 text-[13px]">
        <span>
          <span className="text-ink-3">งบมาตรฐาน</span> <Amt n={s.allowanceUnit} />/{s.unit} · รวม <Amt n={allowanceTotal(s)} />
        </span>
        <span className={cx(late ? "text-neg" : s.status === "pending" && left <= 7 ? "text-warn" : "text-ink-2")}>
          <span className="text-ink-3">เลือกภายใน</span> {dateOr(s.deadline)}
          {s.status === "pending" && (late ? ` · เลยกำหนด ${-left} วัน` : ` · อีก ${left} วัน`)}
        </span>
        {s.blocks && (
          <span className="text-ink-2">
            <span className="text-ink-3">รองาน</span> {s.blocks}
            {s.blocksDate && ` (${dateOr(s.blocksDate)})`}
          </span>
        )}
      </div>
      <ul className="grid gap-2 px-5 py-3 sm:grid-cols-3">
        {s.options.map((o) => {
          const chosen = s.chosenId === o.id;
          const d = optionTotal(s, o) - allowanceTotal(s);
          const canPick = edit && !locked;
          return (
            <li key={o.id}>
              <button
                type="button"
                disabled={!canPick}
                onClick={() => chooseOption(s, o.id, `${me} (แทนลูกค้า)`)}
                className={cx("flex h-full w-full flex-col gap-1.5 rounded-[10px] border p-2 text-left transition-colors duration-150", chosen ? "border-ink bg-raised" : "border-line", canPick && !chosen && "hover:border-line-strong")}
                title={canPick ? "เลือกตัวเลือกนี้แทนลูกค้า" : undefined}
              >
                <Swatch image={o.images[0]} color={o.swatch} label={o.name} className="aspect-[4/3] w-full" />
                <span className="text-[13px] leading-snug">{o.name}</span>
                <span className="text-[12px] text-ink-3">{[o.brand, o.model].filter(Boolean).join(" · ")}</span>
                <span className="mt-auto flex items-baseline justify-between gap-1 text-[12px]">
                  <Amt n={o.price} />
                  <Amt n={d} signed />
                </span>
                {chosen && <span className="text-[12px] font-medium text-ink">ที่เลือก{s.chosenBy ? ` · ${s.chosenBy}` : ""}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {s.clientNote && <p className="mx-5 mb-3 rounded-[8px] bg-raised px-3 py-2 text-[13px] text-ink-2">ลูกค้า: {s.clientNote}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-3 text-[13px]">
        <span>
          ส่วนต่าง <Amt n={diff} signed />
          {vo && (
            <span className="ml-2">
              ·{" "}
              <Link href="/contracts" className="font-mono hover:underline">
                {vo.id}
              </Link>{" "}
              <Pill tone={vo.status === "approved" ? "pos" : vo.status === "rejected" ? "neg" : "warn"}>{VO_LABEL[vo.status] ?? vo.status}</Pill>
            </span>
          )}
          {s.prId && <span className="ml-2 font-mono text-ink-3">· ขอซื้อ {s.prId}</span>}
        </span>
        <div className="flex flex-wrap gap-2">
          {s.status === "chosen" && (approve || edit) && (
            <Btn small primary onClick={onApprove}>
              <Lock {...I} />
              อนุมัติและล็อก
            </Btn>
          )}
          {locked && edit && (
            <>
              {diff !== 0 && !s.variationId && (
                <Btn small onClick={() => raiseSelectionVariation(s, me)}>
                  สร้างงานเปลี่ยนแปลง
                </Btn>
              )}
              {!s.prId && (
                <Btn small onClick={() => linkSelectionPR(s, me)}>
                  <ShoppingCart {...I} />
                  ส่งขอซื้อ
                </Btn>
              )}
              {vo?.status !== "approved" && (
                <Btn small onClick={() => reopenSelection(s)} title="ปลดล็อกเพื่อให้ลูกค้าเลือกใหม่ งานเปลี่ยนแปลงที่ยังไม่อนุมัติจะถูกยกเลิก">
                  <Unlock {...I} />
                  ปลดล็อก
                </Btn>
              )}
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

function ApproveModal({ s, me, onClose }: { s: Selection; me: string; onClose: () => void }) {
  const [purchase, setPurchase] = useState(true);
  const o = s.options.find((x) => x.id === s.chosenId);
  const diff = selectionDiff(s);
  return (
    <Modal
      open
      onClose={onClose}
      title="อนุมัติและล็อกรายการ"
      width={520}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary onClick={() => (approveSelection(s, me, { purchase }), onClose())}>
            อนุมัติ
          </Btn>
        </>
      }
    >
      <p className="text-[14px]">
        {s.item}: <span className="font-medium">{o?.name}</span>
      </p>
      <p className="mt-1 text-[13px] text-ink-2">
        {s.qty} {s.unit} × <Amt n={o?.price ?? 0} /> = <Amt n={o ? optionTotal(s, o) : 0} /> · งบมาตรฐาน <Amt n={allowanceTotal(s)} />
      </p>
      <div className={cx("mt-3 rounded-[10px] px-3 py-2 text-[13px]", diff === 0 ? "bg-raised text-ink-2" : "bg-warn-soft text-warn")}>
        {diff === 0 ? "ไม่มีส่วนต่างจากงบมาตรฐาน" : <>ส่วนต่าง <Amt n={diff} signed /> ระบบจะสร้างงานเปลี่ยนแปลง (origin: ลูกค้าเลือกวัสดุ) ส่งให้ลูกค้าอนุมัติและลงนามในพอร์ทัล</>}
      </div>
      <div className="mt-3">
        <Check checked={purchase} onChange={setPurchase} label="ส่งใบขอซื้อให้ฝ่ายจัดซื้อทันที" />
      </div>
    </Modal>
  );
}

const blankOption = (i: number): SelectionOption => ({ id: `O${Date.now().toString(36)}${i}`, name: "", price: 0, images: [] });

function SelectionForm({ projectId, initial, rooms, onClose }: { projectId: string; initial?: Selection; rooms: string[]; onClose: () => void }) {
  const sups = suppliers.use();
  const prods = products.use();
  const [v, setV] = useState<Selection>(
    initial ?? {
      id: selections.nextId(`SEL-${projectId}-`, 2),
      projectId,
      room: rooms[0] ?? "ห้องนั่งเล่น",
      category: "floor",
      item: "",
      qty: 1,
      unit: "ตร.ม.",
      allowanceUnit: 0,
      options: [blankOption(0), blankOption(1)],
      deadline: addDays(TODAY, 14),
      status: "pending",
    },
  );
  const setOpt = (id: string, patch: Partial<SelectionOption>) => setV({ ...v, options: v.options.map((o) => (o.id === id ? { ...o, ...patch } : o)) });
  const fromProduct = (id: string, pid: string) => {
    const pr = prods.find((x) => x.id === pid);
    if (pr) setOpt(id, { productId: pid, name: pr.name, price: pr.clientPrice, cost: pr.tradeCost, swatch: pr.swatch, supplierId: pr.supplierId, images: pr.images });
  };
  const addFromAi = (picks: { product: Product; reason: string }[]) => {
    const opts = [...v.options];
    for (const { product: pr, reason } of picks) {
      const o: Partial<SelectionOption> = { productId: pr.id, name: pr.name, price: pr.clientPrice, cost: pr.tradeCost, swatch: pr.swatch, supplierId: pr.supplierId, images: pr.images, note: reason };
      const blank = opts.findIndex((x) => !x.name.trim());
      if (blank >= 0) opts[blank] = { ...opts[blank], ...o };
      else opts.push({ ...blankOption(opts.length), ...o });
    }
    setV({ ...v, options: opts });
  };
  const valid = v.item.trim() && v.qty > 0 && v.options.filter((o) => o.name.trim()).length >= 1;
  const save = () => {
    selections.upsert({ ...v, item: v.item.trim(), options: v.options.filter((o) => o.name.trim()) });
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? "แก้ไขรายการให้ลูกค้าเลือก" : "เพิ่มรายการให้ลูกค้าเลือก"}
      width={820}
      footer={
        <>
          {initial && initial.status === "pending" && (
            <Btn danger onClick={() => (selections.remove(initial.id), onClose())}>
              ลบ
            </Btn>
          )}
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!valid} onClick={save}>
            บันทึก
          </Btn>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <Field label="รายการ">
            <input value={v.item} onChange={(e) => setV({ ...v, item: e.target.value })} placeholder="เช่น กระเบื้องพื้นห้องนอน 2" className={inputCls} />
          </Field>
        </div>
        <Field label="ห้อง/พื้นที่">
          <input list="sel-rooms" value={v.room} onChange={(e) => setV({ ...v, room: e.target.value })} className={inputCls} />
          <datalist id="sel-rooms">
            {[...new Set([...rooms, "ห้องนั่งเล่น", "ห้องครัว", "ห้องนอนใหญ่", "ห้องน้ำ 1", "ทั้งบ้าน", "ภายนอก"])].map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </Field>
        <Field label="หมวด">
          <Select label="หมวด" value={v.category} onChange={(c) => setV({ ...v, category: c as SelCategory })}>
            {Object.entries(SEL_CATEGORY_LABEL).map(([k, x]) => (
              <option key={k} value={k}>
                {x}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="จำนวน">
          <NumInput value={v.qty} onChange={(qty) => setV({ ...v, qty })} step={0.1} />
        </Field>
        <Field label="หน่วย">
          <input value={v.unit} onChange={(e) => setV({ ...v, unit: e.target.value })} className={inputCls} />
        </Field>
        <Field label="งบมาตรฐาน/หน่วย (บาท)">
          <NumInput value={v.allowanceUnit} onChange={(allowanceUnit) => setV({ ...v, allowanceUnit })} />
        </Field>
        <Field label="ต้องเลือกภายใน">
          <input type="date" value={v.deadline} onChange={(e) => setV({ ...v, deadline: e.target.value })} className={inputCls} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="งานที่รอรายการนี้">
            <input value={v.blocks ?? ""} onChange={(e) => setV({ ...v, blocks: e.target.value || undefined })} placeholder="เช่น งานปูกระเบื้องชั้น 2" className={inputCls} />
          </Field>
        </div>
        <Field label="วันเริ่มงานนั้น">
          <input type="date" value={v.blocksDate ?? ""} onChange={(e) => setV({ ...v, blocksDate: e.target.value || undefined })} className={inputCls} />
        </Field>
      </div>

      <div className="mt-4 flex items-baseline justify-between">
        <p className="text-[14px] font-medium">ตัวเลือก</p>
        <Btn small onClick={() => setV({ ...v, options: [...v.options, blankOption(v.options.length)] })}>
          <Plus {...I} />
          เพิ่มตัวเลือก
        </Btn>
      </div>
      <AiSelectionSuggest sel={v} onAdd={addFromAi} />
      <div className="mt-2 flex flex-col gap-3">
        {v.options.map((o, i) => (
          <div key={o.id} className="rounded-[10px] border border-line p-3">
            <div className="grid gap-2 sm:grid-cols-6">
              <div className="sm:col-span-3">
                <Field label={`ตัวเลือก ${i + 1}`}>
                  <input value={o.name} onChange={(e) => setOpt(o.id, { name: e.target.value })} className={inputCls} />
                </Field>
              </div>
              <div className="sm:col-span-3">
                <Field label="จากแคตตาล็อก (ถ้ามี)">
                  <Select label="สินค้า" value={o.productId ?? ""} onChange={(pid) => fromProduct(o.id, pid)}>
                    <option value="">–</option>
                    {prods.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.sku} · {x.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="ยี่ห้อ">
                <input value={o.brand ?? ""} onChange={(e) => setOpt(o.id, { brand: e.target.value || undefined })} className={inputCls} />
              </Field>
              <Field label="รุ่น">
                <input value={o.model ?? ""} onChange={(e) => setOpt(o.id, { model: e.target.value || undefined })} className={inputCls} />
              </Field>
              <Field label="ราคาขาย/หน่วย">
                <NumInput value={o.price} onChange={(price) => setOpt(o.id, { price })} />
              </Field>
              <Field label="ต้นทุน/หน่วย">
                <NumInput value={o.cost ?? 0} onChange={(cost) => setOpt(o.id, { cost: cost || undefined })} />
              </Field>
              <Field label="ผู้ขาย">
                <Select label="ผู้ขาย" value={o.supplierId ?? ""} onChange={(supplierId) => setOpt(o.id, { supplierId: supplierId || undefined })}>
                  <option value="">–</option>
                  {sups.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="สีตัวอย่าง">
                <input type="color" value={o.swatch ?? "#e6e1d8"} onChange={(e) => setOpt(o.id, { swatch: e.target.value })} className={cx(inputCls, "w-full px-1")} />
              </Field>
            </div>
            <div className="mt-2 flex items-start justify-between gap-3">
              <div className="flex-1">
                <MediaField value={o.images} onChange={(images) => setOpt(o.id, { images })} label="รูปตัวเลือก" photosOnly geotag={false} max={6} />
              </div>
              {v.options.length > 1 && (
                <button type="button" aria-label="ลบตัวเลือก" onClick={() => setV({ ...v, options: v.options.filter((x) => x.id !== o.id), chosenId: v.chosenId === o.id ? undefined : v.chosenId })} className="inline-flex size-8 items-center justify-center rounded-[8px] text-ink-3 hover:bg-raised hover:text-neg">
                  <Trash2 {...I} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3">
        <Field label="หมายเหตุถึงลูกค้า">
          <textarea value={v.clientNote ?? ""} onChange={(e) => setV({ ...v, clientNote: e.target.value || undefined })} className={areaCls} />
        </Field>
      </div>
    </Modal>
  );
}
