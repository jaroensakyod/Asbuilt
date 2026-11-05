"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Pencil, Plus, Printer } from "lucide-react";
import { Card, cx, Field, inputCls } from "@/components/ui";
import { Btn, Empty, FilterField, I, Modal, Pill, Select, areaCls } from "@/components/ops/bits";
import { PrintSheet } from "@/components/accounting/bits";
import { MediaField, MediaStrip } from "@/components/media/media-field";
import { COMPANY_INFO, TODAY } from "@/lib/data";
import { suppliers } from "@/lib/procurement/store";
import {
  FFE_STATUSES,
  FFE_STATUS_LABEL,
  daysBetween,
  expectedDelivery,
  ffeCost,
  ffeItems,
  ffeRank,
  ffeSell,
  isFfeLate,
  nextFfeId,
  products,
  setFfeStatus,
  type FfeItem,
  type FfeStatus,
  type InteriorProject,
  type Product,
} from "@/lib/interior";
import { Amt, NumInput, Swatch, dateOr, td, th, thR, usePerms } from "@/components/design/bits";

const TONE: Record<FfeStatus, "neutral" | "accent" | "warn" | "pos"> = { specified: "neutral", ordered: "accent", confirmed: "accent", shipped: "warn", received: "pos", installed: "pos" };

export function FfeTab({ p }: { p: InteriorProject }) {
  const { edit } = usePerms("interior");
  const all = ffeItems.use();
  const prods = products.use();
  const items = useMemo(() => all.filter((i) => i.interiorId === p.id), [all, p.id]);
  const [room, setRoom] = useState("");
  const [status, setStatus] = useState("");
  const [form, setForm] = useState<{ f?: FfeItem } | null>(null);
  const [receiving, setReceiving] = useState<FfeItem | null>(null);
  const [print, setPrint] = useState(false);
  const rooms = [...new Set([...p.rooms.map((r) => r.name), ...items.map((i) => i.room)])];
  const rows = items.filter((i) => (!room || i.room === room) && (!status || (status === "late" ? isFfeLate(i, TODAY) : i.status === status)));
  const advance = (f: FfeItem) => {
    const next = FFE_STATUSES[ffeRank(f.status) + 1];
    if (!next) return;
    if (next === "received") setReceiving(f);
    else setFfeStatus(f, next);
  };
  const prod = (id?: string) => (id ? prods.find((x) => x.id === id) : undefined);
  return (
    <>
      <Card className="mb-4">
        <div className="grid grid-cols-2 items-end gap-3 px-4 py-3 lg:grid-cols-5">
          <FilterField label="ห้อง">
            <Select label="ห้อง" value={room} onChange={setRoom}>
              <option value="">ทุกห้อง</option>
              {rooms.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="สถานะ">
            <Select label="สถานะ" value={status} onChange={setStatus}>
              <option value="">ทั้งหมด</option>
              <option value="late">ส่งช้ากว่ากำหนด</option>
              {FFE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {FFE_STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </FilterField>
          <div className="col-span-2 flex flex-wrap justify-end gap-2 lg:col-span-3">
            <Btn onClick={() => setPrint(true)}>
              <Printer {...I} />
              พิมพ์ตาราง FF&E
            </Btn>
            {edit && (
              <Btn primary onClick={() => setForm({})}>
                <Plus {...I} />
                เพิ่มรายการ
              </Btn>
            )}
          </div>
        </div>
      </Card>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left">
            <thead>
              <tr>
                <th className={cx(th, "px-5")}>รหัส</th>
                <th className={th}>ห้อง</th>
                <th className={th}>รายการ</th>
                <th className={thR}>จำนวน</th>
                <th className={thR}>ต้นทุน</th>
                <th className={thR}>ราคาขาย</th>
                <th className={th}>สถานะ</th>
                <th className={th}>กำหนดส่ง</th>
                <th className={cx(th, "pr-5")} />
              </tr>
            </thead>
            <tbody>
              {rows.map((f) => {
                const pr = prod(f.productId);
                const late = isFfeLate(f, TODAY);
                const next = FFE_STATUSES[ffeRank(f.status) + 1];
                return (
                  <tr key={f.id} className="border-t border-line">
                    <td className={cx(td, "px-5 font-mono")}>{f.code}</td>
                    <td className={td}>{f.room}</td>
                    <td className={td}>
                      <div className="flex items-center gap-3">
                        <Swatch image={pr?.images[0]} color={pr?.swatch} label={f.description} className="size-9 shrink-0" />
                        <div>
                          <p>{f.description}</p>
                          <p className="text-[12px] text-ink-3">{[pr?.sku, pr?.dims, pr?.finish].filter(Boolean).join(" · ")}</p>
                          {f.damage && !f.damage.ok && <p className="text-[12px] text-neg">ของเสียหาย: {f.damage.note}</p>}
                          {f.damage?.photos.length ? <MediaStrip refs={f.damage.photos} size={36} className="mt-1" /> : null}
                        </div>
                      </div>
                    </td>
                    <td className={cx(td, "num text-right font-mono")}>
                      {f.qty} {f.unit}
                    </td>
                    <td className={cx(td, "text-right")}>
                      <Amt n={ffeCost(f)} />
                    </td>
                    <td className={cx(td, "text-right")}>
                      <Amt n={ffeSell(f)} />
                    </td>
                    <td className={td}>
                      <Pill tone={TONE[f.status]}>{FFE_STATUS_LABEL[f.status]}</Pill>
                    </td>
                    <td className={cx(td, late && "text-neg")}>
                      {dateOr(f.status === "received" || f.status === "installed" ? (f.installedAt ?? f.receivedAt) : f.expectedAt)}
                      {late && <span className="block text-[12px]">ช้า {daysBetween(f.expectedAt!, TODAY)} วัน</span>}
                    </td>
                    <td className={cx(td, "pr-5")}>
                      {edit && (
                        <div className="flex items-center justify-end gap-1">
                          {next && (
                            <Btn small onClick={() => advance(f)} title={`เปลี่ยนเป็น ${FFE_STATUS_LABEL[next]}`}>
                              {FFE_STATUS_LABEL[next]}
                              <ChevronRight {...I} />
                            </Btn>
                          )}
                          <button type="button" aria-label="แก้ไข" onClick={() => setForm({ f })} className="inline-flex size-8 items-center justify-center rounded-[8px] text-ink-3 hover:bg-raised hover:text-ink">
                            <Pencil {...I} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <Empty>{items.length ? "ไม่พบรายการตามตัวกรอง" : "ยังไม่มีรายการเฟอร์นิเจอร์และของตกแต่ง"}</Empty>}
      </Card>
      {form && <FfeForm p={p} initial={form.f} rooms={rooms} prods={prods} onClose={() => setForm(null)} />}
      {receiving && <ReceiveModal f={receiving} onClose={() => setReceiving(null)} />}
      <PrintSheet open={print} onClose={() => setPrint(false)} title="ตาราง FF&E">
        <FfeSchedule p={p} items={items} prods={prods} />
      </PrintSheet>
    </>
  );
}

function ReceiveModal({ f, onClose }: { f: FfeItem; onClose: () => void }) {
  const [ok, setOk] = useState(true);
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState(f.damage?.photos ?? []);
  return (
    <Modal
      open
      onClose={onClose}
      title={`รับของ · ${f.code} ${f.description}`}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!ok && !note.trim()} onClick={() => (setFfeStatus(f, "received", { damage: { ok, note: note.trim() || undefined, photos } }), onClose())}>
            บันทึกรับของ
          </Btn>
        </>
      }
    >
      <p className="mb-2 text-[13px] text-ink-2">ตรวจสภาพก่อนเซ็นรับ ถ่ายรูปกล่องและตัวสินค้าทุกด้าน</p>
      <div className="mb-3 flex gap-4 text-[14px]">
        <label className="flex items-center gap-2">
          <input type="radio" checked={ok} onChange={() => setOk(true)} className="accent-[var(--accent)]" />
          สภาพสมบูรณ์
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" checked={!ok} onChange={() => setOk(false)} className="accent-[var(--accent)]" />
          พบความเสียหาย
        </label>
      </div>
      {!ok && (
        <Field label="รายละเอียดความเสียหาย">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} className={areaCls} placeholder="เช่น ขอบหินบิ่น 1 จุด แจ้งผู้ขายเคลม" />
        </Field>
      )}
      <div className="mt-3">
        <MediaField value={photos} onChange={setPhotos} label="รูปตอนรับของ" photosOnly />
      </div>
    </Modal>
  );
}

function FfeForm({ p, initial, rooms, prods, onClose }: { p: InteriorProject; initial?: FfeItem; rooms: string[]; prods: Product[]; onClose: () => void }) {
  const [v, setV] = useState<FfeItem>(initial ?? { id: nextFfeId(p.id), interiorId: p.id, projectId: p.projectId, room: rooms[0] ?? "", code: "", description: "", qty: 1, unit: "ชิ้น", unitCost: 0, unitSell: 0, status: "specified" });
  const pick = (id: string) => {
    const pr = prods.find((x) => x.id === id);
    if (pr) setV({ ...v, productId: id, description: pr.name, unit: pr.unit, unitCost: pr.tradeCost, unitSell: pr.clientPrice, expectedAt: v.orderedAt ? expectedDelivery(v.orderedAt, pr.leadDays) : v.expectedAt });
    else setV({ ...v, productId: undefined });
  };
  const valid = v.code.trim() && v.description.trim() && v.room && v.qty > 0;
  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? `แก้ไข ${initial.code}` : "เพิ่มรายการ FF&E"}
      width={720}
      footer={
        <>
          {initial && initial.status === "specified" && (
            <Btn danger onClick={() => (ffeItems.remove(initial.id), onClose())}>
              ลบ
            </Btn>
          )}
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!valid} onClick={() => (ffeItems.upsert({ ...v, code: v.code.trim(), description: v.description.trim() }), onClose())}>
            บันทึก
          </Btn>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="รหัสรายการ">
          <input value={v.code} onChange={(e) => setV({ ...v, code: e.target.value })} placeholder="FF-01" className={cx(inputCls, "font-mono")} />
        </Field>
        <Field label="ห้อง">
          <Select label="ห้อง" value={v.room} onChange={(room) => setV({ ...v, room })}>
            {rooms.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="สินค้าจากแคตตาล็อก">
            <Select label="สินค้า" value={v.productId ?? ""} onChange={pick}>
              <option value="">– ระบุเอง –</option>
              {prods.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.sku} · {x.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="sm:col-span-4">
          <Field label="รายการ">
            <input value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} className={inputCls} />
          </Field>
        </div>
        <Field label="จำนวน">
          <NumInput value={v.qty} onChange={(qty) => setV({ ...v, qty })} step={0.1} />
        </Field>
        <Field label="หน่วย">
          <input value={v.unit} onChange={(e) => setV({ ...v, unit: e.target.value })} className={inputCls} />
        </Field>
        <Field label="ต้นทุน/หน่วย">
          <NumInput value={v.unitCost} onChange={(unitCost) => setV({ ...v, unitCost })} />
        </Field>
        <Field label="ราคาขาย/หน่วย">
          <NumInput value={v.unitSell} onChange={(unitSell) => setV({ ...v, unitSell })} />
        </Field>
        <Field label="สถานะ">
          <Select label="สถานะ" value={v.status} onChange={(s) => setV({ ...v, status: s as FfeStatus })}>
            {FFE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {FFE_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="วันที่สั่ง">
          <input type="date" value={v.orderedAt ?? ""} onChange={(e) => setV({ ...v, orderedAt: e.target.value || undefined, expectedAt: e.target.value ? expectedDelivery(e.target.value, prods.find((x) => x.id === v.productId)?.leadDays ?? 30) : v.expectedAt })} className={inputCls} />
        </Field>
        <Field label="กำหนดส่ง">
          <input type="date" value={v.expectedAt ?? ""} onChange={(e) => setV({ ...v, expectedAt: e.target.value || undefined })} className={inputCls} />
        </Field>
      </div>
      <p className="mt-2 text-[12px] text-ink-3">กำหนดส่ง = วันที่สั่ง + ระยะรอของของสินค้าในแคตตาล็อก (แก้ไขได้)</p>
    </Modal>
  );
}

function FfeSchedule({ p, items, prods }: { p: InteriorProject; items: FfeItem[]; prods: Product[] }) {
  const sups = suppliers.use();
  const rooms = [...new Set(items.map((i) => i.room))];
  const total = items.reduce((t, i) => t + ffeSell(i), 0);
  return (
    <div className="text-[12px]">
      <div className="flex items-start justify-between border-b border-ink pb-3">
        <div>
          <p className="text-[15px] font-medium">{COMPANY_INFO.name}</p>
          <p className="text-ink-2">{COMPANY_INFO.address}</p>
        </div>
        <div className="text-right">
          <p className="text-[18px] font-medium">ตารางเฟอร์นิเจอร์และของตกแต่ง</p>
          <p className="text-ink-2">FF&E schedule · {dateOr(TODAY)}</p>
        </div>
      </div>
      <p className="mt-2">
        <span className="text-ink-3">งาน</span> {p.name} · <span className="text-ink-3">ลูกค้า</span> {p.client} · <span className="text-ink-3">มัณฑนากร</span> {p.designer}
      </p>
      {rooms.map((r) => {
        const rows = items.filter((i) => i.room === r);
        return (
          <section key={r} className="avoid-break mt-4">
            <h3 className="mb-1 text-[13px] font-medium">{r}</h3>
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-line-strong text-ink-3">
                  <th className="py-1 pr-2 font-normal">รหัส</th>
                  <th className="py-1 pr-2 font-normal">รายการ</th>
                  <th className="py-1 pr-2 font-normal">ขนาด / วัสดุ</th>
                  <th className="py-1 pr-2 font-normal">ผู้ขาย</th>
                  <th className="py-1 pr-2 text-right font-normal">จำนวน</th>
                  <th className="py-1 pr-2 text-right font-normal">ราคา/หน่วย</th>
                  <th className="py-1 pr-2 text-right font-normal">รวม</th>
                  <th className="py-1 font-normal">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((f) => {
                  const pr = prods.find((x) => x.id === f.productId);
                  const sup = pr?.supplierId ? sups.find((s) => s.id === pr.supplierId)?.name : pr?.supplierName;
                  return (
                    <tr key={f.id} className="border-b border-line">
                      <td className="py-1 pr-2 font-mono">{f.code}</td>
                      <td className="py-1 pr-2">{f.description}</td>
                      <td className="py-1 pr-2">{[pr?.dims, pr?.finish, pr?.colour].filter(Boolean).join(" · ")}</td>
                      <td className="py-1 pr-2">{sup ?? "–"}</td>
                      <td className="num py-1 pr-2 text-right font-mono">
                        {f.qty} {f.unit}
                      </td>
                      <td className="num py-1 pr-2 text-right font-mono">{Math.round(f.unitSell).toLocaleString("th-TH")}</td>
                      <td className="num py-1 pr-2 text-right font-mono">{Math.round(ffeSell(f)).toLocaleString("th-TH")}</td>
                      <td className="py-1">
                        {FFE_STATUS_LABEL[f.status]}
                        {f.expectedAt && ffeRank(f.status) < ffeRank("received") ? ` · ส่ง ${dateOr(f.expectedAt)}` : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        );
      })}
      <p className="mt-4 text-right text-[13px]">
        รวมราคาขาย (ก่อน VAT) <span className="num font-mono font-medium">{Math.round(total).toLocaleString("th-TH")}</span> บาท
      </p>
    </div>
  );
}
