"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Pencil, Plus, Search, X } from "lucide-react";
import { Card, cx, inputCls } from "@/components/ui";
import { Btn, Empty, FilterField, I, KV, Modal, Pill, Select, StatCard } from "@/components/ops/bits";
import { getProject, thDate } from "@/lib/data";
import {
  asProcBill,
  CATEGORIES,
  goodsReceipts,
  isSubCategory,
  poTotals,
  purchaseOrders,
  purchaseRequests,
  supplierBills,
  supplierStats,
  suppliers,
  SUPPLIER_STATUS_LABEL,
  type Category,
  type Supplier,
  type SupplierStats,
} from "@/lib/procurement";
import { Amt, baht, BILL_LABEL, BILL_TONE, DocLink, POStatusPill, Stars, td, th, useProcPerms } from "./bits";
import { SupplierForm } from "./supplier-form";

const STATUS_TONE = { active: "pos", hold: "warn", inactive: "neutral" } as const;

export function SuppliersView() {
  const sp = useSearchParams();
  return <Inner initOpen={sp.get("id") ?? undefined} />;
}

function Inner({ initOpen }: { initOpen?: string }) {
  const perms = useProcPerms();
  const list = suppliers.use();
  const pos = purchaseOrders.use();
  const grs = goodsReceipts.use();
  const bills = supplierBills.use();
  const prs = purchaseRequests.use();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState("");
  const [openId, setOpenId] = useState<string | undefined>(initOpen);
  const [form, setForm] = useState<{ s?: Supplier } | null>(null);

  const stats = useMemo(() => new Map(list.map((s) => [s.id, supplierStats(s, pos, grs, bills, prs)])), [list, pos, grs, bills, prs]);

  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    return list
      .filter((s) => !cat || s.categories.includes(cat as Category))
      .filter((s) => !kind || (kind === "sub" ? s.categories.some(isSubCategory) : !s.categories.every(isSubCategory)))
      .filter((s) => !status || s.status === status)
      .filter((s) => !n || `${s.id} ${s.name} ${s.taxId} ${s.contact} ${s.phone}`.toLowerCase().includes(n))
      .sort((a, b) => (stats.get(b.id)?.spend12 ?? 0) - (stats.get(a.id)?.spend12 ?? 0));
  }, [list, q, cat, kind, status, stats]);

  const all = [...stats.values()];
  const spend = all.reduce((t, s) => t + s.spend12, 0);
  const measured = all.filter((s) => s.onTimePct !== undefined);
  const onTime = measured.length ? measured.reduce((t, s) => t + s.onTimePct!, 0) / measured.length : 0;
  const open = list.find((s) => s.id === openId);
  const filtered = q || cat || kind || status;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
        <div>
          <p className="mb-1 text-[13px] text-ink-3">จัดซื้อ/คลัง</p>
          <h1 className="text-[30px] font-normal leading-[1.15]">ผู้ขายและผู้รับเหมาช่วง</h1>
          <p className="mt-2 max-w-[44rem] text-ink-2">ทะเบียนผู้ขายวัสดุและผู้รับเหมาช่วง พร้อมเงื่อนไขชำระเงิน อัตราหัก ณ ที่จ่าย และผลการประเมินจากใบสั่งซื้อจริง</p>
        </div>
        {perms.edit && (
          <Btn primary onClick={() => setForm({})}>
            <Plus {...I} />
            เพิ่มผู้ขาย
          </Btn>
        )}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="ผู้ขายที่ใช้งาน" value={list.filter((s) => s.status === "active").length} unit="ราย" note={`ผู้รับเหมาช่วง ${list.filter((s) => s.categories.some(isSubCategory)).length} ราย`} />
        <StatCard label="ยอดซื้อ 12 เดือน" value={perms.money ? `${(spend / 1e6).toFixed(1)}` : "•••"} unit="ล้านบาท" note="ก่อน VAT ตามใบแจ้งหนี้" />
        <StatCard label="ส่งของตรงเวลาเฉลี่ย" value={onTime.toFixed(0)} unit="%" note={`จาก ${measured.length} รายที่มีการรับของ`} />
        <StatCard label="ระงับชั่วคราว" value={list.filter((s) => s.status === "hold").length} unit="ราย" tone={list.some((s) => s.status === "hold") ? "neg" : undefined} note="ไม่สามารถออกใบสั่งซื้อใหม่" onClick={() => setStatus(status === "hold" ? "" : "hold")} active={status === "hold"} />
      </div>

      <Card className="mb-4">
        <div className="grid grid-cols-2 gap-3 px-4 py-3 lg:grid-cols-6">
          <FilterField label="ค้นหา" className="col-span-2">
            <div className="relative">
              <Search {...I} className="pointer-events-none absolute left-2.5 top-2.5 text-ink-3" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ชื่อ เลขผู้เสียภาษี ผู้ติดต่อ" className={cx(inputCls, "w-full pl-8")} />
            </div>
          </FilterField>
          <FilterField label="ประเภท">
            <Select label="ประเภท" value={kind} onChange={setKind}>
              <option value="">ทั้งหมด</option>
              <option value="goods">ผู้ขายวัสดุ</option>
              <option value="sub">ผู้รับเหมาช่วง/ช่าง</option>
            </Select>
          </FilterField>
          <FilterField label="หมวด" className="col-span-2">
            <Select label="หมวด" value={cat} onChange={setCat}>
              <option value="">ทุกหมวด</option>
              {Object.entries(CATEGORIES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="สถานะ">
            <Select label="สถานะ" value={status} onChange={setStatus}>
              <option value="">ทุกสถานะ</option>
              {Object.entries(SUPPLIER_STATUS_LABEL).map(([k, v]) => (
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
            <button type="button" onClick={() => (setQ(""), setCat(""), setKind(""), setStatus(""))} className="inline-flex items-center gap-1 text-ink-2 hover:text-ink">
              <X {...I} />
              ล้างตัวกรอง
            </button>
          )}
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left">
            <thead>
              <tr>
                <th className={cx(th, "px-5")}>ผู้ขาย</th>
                <th className={th}>หมวด</th>
                <th className={cx(th, "text-right")}>เครดิต</th>
                <th className={cx(th, "text-right")}>หัก ณ ที่จ่าย</th>
                <th className={th}>คะแนน</th>
                <th className={cx(th, "text-right")}>ตรงเวลา</th>
                <th className={cx(th, "text-right")}>ยอดซื้อ 12 เดือน</th>
                <th className={cx(th, "pr-5")}>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const st = stats.get(s.id)!;
                return (
                  <tr key={s.id} onClick={() => setOpenId(s.id)} className="cursor-pointer border-t border-line transition-colors duration-150 hover:bg-raised/60">
                    <td className={cx(td, "px-5")}>
                      <span className="block">{s.name}</span>
                      <span className="block font-mono text-[12px] text-ink-3">
                        {s.id} · {s.taxId}
                        {s.juristic ? "" : " · บุคคลธรรมดา"}
                      </span>
                    </td>
                    <td className={td}>
                      <div className="flex max-w-[280px] flex-wrap gap-1">
                        {s.categories.slice(0, 3).map((c) => (
                          <Pill key={c}>{CATEGORIES[c]}</Pill>
                        ))}
                        {s.categories.length > 3 && <Pill>+{s.categories.length - 3}</Pill>}
                      </div>
                    </td>
                    <td className={cx(td, "num text-right font-mono text-[13px]")}>{s.paymentTerms} วัน</td>
                    <td className={cx(td, "num text-right font-mono text-[13px]")}>{s.whtRate}%</td>
                    <td className={td}>
                      <Stars v={st.score} />
                    </td>
                    <td className={cx(td, "num text-right font-mono text-[13px]")}>{st.onTimePct !== undefined ? `${st.onTimePct.toFixed(0)}%` : "–"}</td>
                    <td className={cx(td, "text-right text-[13px]")}>
                      <Amt n={st.spend12} show={perms.money} />
                      <span className="block text-[12px] text-ink-3">{st.pos} ใบสั่งซื้อ</span>
                    </td>
                    <td className={cx(td, "pr-5")}>
                      <Pill tone={STATUS_TONE[s.status]}>{SUPPLIER_STATUS_LABEL[s.status]}</Pill>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <Empty>ไม่พบผู้ขายตามตัวกรอง</Empty>}
      </Card>

      {open && <SupplierDrawer s={open} st={stats.get(open.id)!} onClose={() => setOpenId(undefined)} onEdit={perms.edit ? () => setForm({ s: open }) : undefined} />}
      {form && (
        <SupplierForm
          initial={form.s}
          onClose={() => setForm(null)}
          onSaved={(s) => {
            setForm(null);
            setOpenId(s.id);
          }}
        />
      )}
    </>
  );
}

function SupplierDrawer({ s, st, onClose, onEdit }: { s: Supplier; st: SupplierStats; onClose: () => void; onEdit?: () => void }) {
  const perms = useProcPerms();
  const pos = purchaseOrders.use();
  const grs = goodsReceipts.use();
  const bills = supplierBills.use();
  const mine = pos.filter((p) => p.supplierId === s.id).sort((a, b) => b.date.localeCompare(a.date));
  const myBills = bills.filter((b) => b.supplierId === s.id).sort((a, b) => b.date.localeCompare(a.date));
  const outstanding = myBills.filter((b) => b.status !== "paid").reduce((t, b) => t + b.subtotal + b.vat, 0);
  const claims = myBills.filter((b) => !b.poId);

  return (
    <Modal
      open
      onClose={onClose}
      width={880}
      title={s.name}
      footer={
        <>
          <span className="mr-auto font-mono text-[12px] text-ink-3">ขึ้นทะเบียน {thDate(s.since)}</span>
          {onEdit && (
            <Btn onClick={onEdit}>
              <Pencil {...I} />
              แก้ไข
            </Btn>
          )}
          <Btn primary onClick={onClose}>
            ปิด
          </Btn>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Pill tone={STATUS_TONE[s.status]}>{SUPPLIER_STATUS_LABEL[s.status]}</Pill>
        <Pill>{s.juristic ? "นิติบุคคล" : "บุคคลธรรมดา"}</Pill>
        <Pill>{s.vatRegistered ? "จด VAT" : "ไม่จด VAT"}</Pill>
        {s.categories.map((c) => (
          <Pill key={c}>{CATEGORIES[c]}</Pill>
        ))}
      </div>
      {s.note && <p className="mt-3 text-[14px] text-ink-2">{s.note}</p>}

      <div className="mt-4 grid grid-cols-4 gap-3">
        <Mini label="ยอดซื้อ 12 เดือน" value={perms.money ? baht(st.spend12) : "•••"} />
        <Mini label="ค้างจ่าย (รวม VAT)" value={perms.money ? baht(outstanding) : "•••"} />
        <Mini label="ส่งตรงเวลา" value={st.onTimePct !== undefined ? `${st.onTimePct.toFixed(0)}%` : "–"} />
        <Mini label="คะแนนรวม" value={st.score.toFixed(1)} sub={`คุณภาพ ${(st.quality ?? s.rating.quality).toFixed(1)} · ราคา ${(st.priceScore ?? s.rating.price).toFixed(1)}`} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-6">
        <KV k="เลขผู้เสียภาษี">
          <span className="font-mono">{s.taxId}</span> · {s.branch}
        </KV>
        <KV k="ผู้ติดต่อ">
          {s.contact} · <span className="font-mono">{s.phone}</span>
        </KV>
        <KV k="ที่อยู่" wide>
          {s.address}
        </KV>
        <KV k="เครดิต">{s.paymentTerms} วัน</KV>
        <KV k="หัก ณ ที่จ่าย">{s.whtRate}%</KV>
        <KV k="บัญชีรับเงิน" wide>
          {s.bank.bank} <span className="font-mono">{s.bank.account}</span> · {s.bank.name}
        </KV>
        {s.email && <KV k="อีเมล">{s.email}</KV>}
      </div>

      <h3 className="mb-2 mt-5 text-[14px] font-medium">
        ประวัติใบสั่งซื้อ <span className="font-mono text-[12px] text-ink-3">{mine.length}</span>
      </h3>
      {mine.length ? (
        <div className="max-h-[260px] overflow-y-auto rounded-[10px] border border-line">
          <table className="w-full text-left text-[13px]">
            <tbody>
              {mine.map((p) => {
                const first = grs.filter((g) => g.poId === p.id).sort((a, b) => a.date.localeCompare(b.date))[0];
                const late = first && first.date > p.deliveryDate;
                return (
                  <tr key={p.id} className="border-t border-line first:border-t-0">
                    <td className="px-3 py-2">
                      <DocLink id={p.id} />
                      <span className="block text-[12px] text-ink-3">{thDate(p.date)}</span>
                    </td>
                    <td className="py-2 pr-3">
                      <span className="block max-w-[260px] truncate">{p.projectId ? getProject(p.projectId)?.name ?? p.projectId : "คลังกลาง"}</span>
                      <span className="block max-w-[260px] truncate text-[12px] text-ink-3">{p.lines.map((l) => l.description).join(", ")}</span>
                    </td>
                    <td className="py-2 pr-3">
                      <POStatusPill s={p.status} />
                    </td>
                    <td className="py-2 pr-3 text-[12px]">{first ? <span className={late ? "text-neg" : "text-ink-3"}>{late ? `ส่งช้า ${Math.round((Date.parse(first.date) - Date.parse(p.deliveryDate)) / 86400000)} วัน` : "ตรงเวลา"}</span> : <span className="text-ink-3">กำหนด {thDate(p.deliveryDate)}</span>}</td>
                    <td className="py-2 pr-3 text-right">
                      <Amt n={poTotals(p).total} show={perms.money} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-[13px] text-ink-3">ยังไม่มีใบสั่งซื้อ</p>
      )}

      {claims.length > 0 && (
        <>
          <h3 className="mb-2 mt-5 text-[14px] font-medium">
            งวดงานผู้รับเหมาช่วง <span className="font-mono text-[12px] text-ink-3">{claims.length}</span>
          </h3>
          <div className="max-h-[220px] overflow-y-auto rounded-[10px] border border-line">
            <table className="w-full text-left text-[13px]">
              <tbody>
                {claims.slice(0, 40).map((b) => (
                  <tr key={b.id} className="border-t border-line first:border-t-0">
                    <td className="px-3 py-2 font-mono text-[12px] text-ink-3">
                      {b.id}
                      <span className="block font-sans">{thDate(b.date)}</span>
                    </td>
                    <td className="py-2 pr-3">
                      <Link href={`/costs/${b.projectId}`} className="hover:underline">
                        {b.projectId}
                      </Link>{" "}
                      · {b.lines[0]?.description}
                    </td>
                    <td className="py-2 pr-3">
                      <Pill tone={BILL_TONE[b.status]}>{BILL_LABEL[b.status]}</Pill>
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <Amt n={b.subtotal} show={perms.money} />
                      {asProcBill(b).invoiceNo && <span className="block font-mono text-[11px] text-ink-3">{asProcBill(b).invoiceNo}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}

function Mini({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-[10px] border border-line bg-raised/40 px-3 py-2.5">
      <p className="text-[12px] text-ink-3">{label}</p>
      <p className="num mt-1 font-mono text-[16px]">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-ink-3">{sub}</p>}
    </div>
  );
}
