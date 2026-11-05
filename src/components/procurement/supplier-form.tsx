"use client";

import { useState } from "react";
import { cx, Field, inputCls } from "@/components/ui";
import { areaCls, Btn, Modal } from "@/components/ops/bits";
import { CATEGORIES, isValidTaxId, nextSupplierId, SUPPLIER_STATUS_LABEL, suppliers, type Category, type Supplier, type SupplierStatus } from "@/lib/procurement";
import { TODAY } from "@/lib/data";

const BANKS = ["กสิกรไทย", "กรุงเทพ", "ไทยพาณิชย์", "กรุงไทย", "กรุงศรีอยุธยา", "ทหารไทยธนชาต", "ออมสิน"];

function suggestWht(cats: Category[]) {
  if (cats.some((c) => c.startsWith("sub_"))) return 3;
  if (cats.includes("rental")) return 5;
  if (cats.includes("transport")) return 1;
  return 0;
}

const EMPTY: Supplier = {
  id: "",
  name: "",
  taxId: "",
  branch: "สำนักงานใหญ่",
  juristic: true,
  vatRegistered: true,
  address: "",
  contact: "",
  phone: "",
  categories: [],
  paymentTerms: 30,
  whtRate: 0,
  bank: { bank: "กสิกรไทย", account: "", name: "" },
  rating: { quality: 4, onTime: 4, price: 4 },
  status: "active",
  since: TODAY,
};

export function SupplierForm({ initial, onClose, onSaved }: { initial?: Supplier; onClose: () => void; onSaved: (s: Supplier) => void }) {
  const [s, setS] = useState<Supplier>(initial ?? EMPTY);
  const [tried, setTried] = useState(false);
  const set = <K extends keyof Supplier>(k: K, v: Supplier[K]) => setS((x) => ({ ...x, [k]: v }));
  const taxOk = isValidTaxId(s.taxId);
  const ok = s.name.trim() && taxOk && s.categories.length > 0;

  const toggleCat = (c: Category) => {
    const cats = s.categories.includes(c) ? s.categories.filter((x) => x !== c) : [...s.categories, c];
    setS((x) => ({ ...x, categories: cats, whtRate: initial ? x.whtRate : suggestWht(cats) }));
  };

  const save = () => {
    setTried(true);
    if (!ok) return;
    const out: Supplier = { ...s, id: s.id || nextSupplierId(), name: s.name.trim(), juristic: s.taxId.startsWith("0"), bank: { ...s.bank, name: s.bank.name || s.name.trim() } };
    suppliers.upsert(out);
    onSaved(out);
  };

  return (
    <Modal
      open
      onClose={onClose}
      width={760}
      title={initial?.id ? `แก้ไขผู้ขาย ${initial.id}` : "เพิ่มผู้ขาย / ผู้รับเหมาช่วง"}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary onClick={save}>
            บันทึก
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Field label="ชื่อ (ตามหนังสือรับรอง / บัตรประชาชน)">
            <input value={s.name} onChange={(e) => set("name", e.target.value)} className={inputCls} placeholder="บริษัท ... จำกัด" />
          </Field>
        </div>
        <Field label="เลขประจำตัวผู้เสียภาษี 13 หลัก">
          <input
            value={s.taxId}
            onChange={(e) => set("taxId", e.target.value.replace(/\D/g, "").slice(0, 13))}
            inputMode="numeric"
            className={cx(inputCls, "font-mono", tried && !taxOk && "border-neg")}
            placeholder="0105xxxxxxxxx"
          />
          <span className={cx("text-[12px]", s.taxId.length === 13 && !taxOk ? "text-neg" : "text-ink-3")}>
            {s.taxId.length < 13 ? `${s.taxId.length}/13 หลัก · นิติบุคคลขึ้นต้นด้วย 0` : taxOk ? (s.taxId.startsWith("0") ? "นิติบุคคล" : "บุคคลธรรมดา") : "เลขตรวจสอบไม่ถูกต้อง"}
          </span>
        </Field>
        <Field label="สาขา">
          <input value={s.branch} onChange={(e) => set("branch", e.target.value)} className={inputCls} placeholder="สำนักงานใหญ่ / สาขา 00001" />
        </Field>
        <div className="col-span-2">
          <Field label="ที่อยู่">
            <textarea value={s.address} onChange={(e) => set("address", e.target.value)} className={cx(areaCls, "min-h-[60px]")} />
          </Field>
        </div>
        <Field label="ผู้ติดต่อ">
          <input value={s.contact} onChange={(e) => set("contact", e.target.value)} className={inputCls} />
        </Field>
        <Field label="โทรศัพท์">
          <input value={s.phone} onChange={(e) => set("phone", e.target.value)} className={cx(inputCls, "font-mono")} />
        </Field>
        <Field label="อีเมล">
          <input value={s.email ?? ""} onChange={(e) => set("email", e.target.value || undefined)} className={inputCls} />
        </Field>
        <Field label="สถานะ">
          <select value={s.status} onChange={(e) => set("status", e.target.value as SupplierStatus)} className={inputCls}>
            {Object.entries(SUPPLIER_STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <div className="col-span-2">
          <p className={cx("mb-1.5 text-[13px]", tried && !s.categories.length ? "text-neg" : "text-ink-2")}>หมวดสินค้า / งานที่รับ</p>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(CATEGORIES) as Category[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => toggleCat(c)}
                aria-pressed={s.categories.includes(c)}
                className={cx("h-7 rounded-[8px] border px-2.5 text-[13px] transition-colors duration-150", s.categories.includes(c) ? "border-ink bg-ink text-card" : "border-line-strong bg-card text-ink-2 hover:bg-raised")}
              >
                {CATEGORIES[c]}
              </button>
            ))}
          </div>
        </div>
        <Field label="เครดิต (วัน)">
          <input type="number" min={0} value={s.paymentTerms} onChange={(e) => set("paymentTerms", Number(e.target.value) || 0)} className={cx(inputCls, "font-mono")} />
        </Field>
        <Field label="หัก ณ ที่จ่าย ค่าเริ่มต้น">
          <select value={s.whtRate} onChange={(e) => set("whtRate", Number(e.target.value))} className={inputCls}>
            <option value={0}>0% · ซื้อสินค้า</option>
            <option value={1}>1% · ค่าขนส่ง</option>
            <option value={3}>3% · ค่าบริการ/รับเหมา</option>
            <option value={5}>5% · ค่าเช่า</option>
          </select>
        </Field>
        <label className="col-span-2 flex items-center gap-2 text-[14px]">
          <input type="checkbox" checked={s.vatRegistered} onChange={(e) => set("vatRegistered", e.target.checked)} className="size-4 accent-[var(--accent)]" />
          จดทะเบียนภาษีมูลค่าเพิ่ม (ออกใบกำกับภาษี VAT 7%)
        </label>
        <Field label="ธนาคาร">
          <select value={s.bank.bank} onChange={(e) => set("bank", { ...s.bank, bank: e.target.value })} className={inputCls}>
            {BANKS.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </Field>
        <Field label="เลขที่บัญชี">
          <input value={s.bank.account} onChange={(e) => set("bank", { ...s.bank, account: e.target.value })} className={cx(inputCls, "font-mono")} placeholder="xxx-x-xxxxx-x" />
        </Field>
        <div className="col-span-2">
          <Field label="หมายเหตุ">
            <input value={s.note ?? ""} onChange={(e) => set("note", e.target.value || undefined)} className={inputCls} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
