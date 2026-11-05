"use client";

import { onTenantLoad } from "@/lib/workspace";
import { useState } from "react";
import { X } from "lucide-react";
import { Field, inputCls } from "@/components/ui";
import { HouseThumb } from "@/components/house-thumb";
import { getHouseModel, houseModels, MODEL_TYPE_LABEL, projects, TODAY, type Project, team } from "@/lib/data";
import { addProject, PROVINCES } from "@/lib/projects-store";

// recomputed when a company is loaded, so live mode lists that company's PMs
const PMS: string[] = [];
const fillPms = () => {
  const fromTeam = team.filter((m) => m.active && (m.role === "pm" || m.role === "engineer" || m.role === "admin")).map((m) => m.name);
  PMS.splice(0, PMS.length, ...new Set([...projects.map((p) => p.pm), ...fromTeam].filter(Boolean)));
};
fillPms();
onTenantLoad(fillPms);

export function NewProjectForm({ onClose, onCreated, existingIds }: { onClose: () => void; onCreated: (p: Project) => void; existingIds: string[] }) {
  const first = houseModels.find((m) => m.code === "HM-01") ?? houseModels[0];
  const [f, setF] = useState({
    owner: "",
    phone: "",
    modelCode: first.code,
    province: PROVINCES[0],
    address: "",
    start: "2026-12-01",
    value: String(Math.round(((first.priceMin + first.priceMax) / 2) * 10) / 10),
    pm: PMS[0] ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const m = getHouseModel(f.modelCode);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  const pickModel = (code: string) => {
    const hm = getHouseModel(code);
    setF((s) => ({ ...s, modelCode: code, value: hm ? String(Math.round(((hm.priceMin + hm.priceMax) / 2) * 10) / 10) : s.value }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(f.value);
    if (f.owner.trim().length < 2) return setError("กรอกชื่อลูกค้า");
    if (!/^0\d{1,2}-?\d{3}-?\d{3,4}$/.test(f.phone.trim())) return setError("เบอร์โทรไม่ถูกต้อง เช่น 081-234-5678");
    if (!f.start) return setError("เลือกวันเริ่มงาน");
    if (!(value > 0)) return setError("มูลค่าสัญญาต้องมากกว่า 0");
    const p = addProject({ owner: f.owner, phone: f.phone.trim(), modelCode: f.modelCode, province: f.province, address: f.address.trim(), start: f.start, value, pm: f.pm }, existingIds);
    onCreated(p);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/25 p-6 pt-[8vh]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-project-title"
        onSubmit={submit}
        className="enter w-full max-w-[760px] rounded-[16px] border border-line-strong bg-card shadow-[0_12px_40px_rgba(31,27,22,0.16)]"
      >
        <header className="flex items-center justify-between border-b border-line px-6 py-4">
          <div>
            <h2 id="new-project-title" className="text-[17px] font-medium">
              สร้างโครงการ
            </h2>
            <p className="text-[13px] text-ink-3">บันทึกในเบราว์เซอร์นี้ · สถานะเริ่มต้น วางแผน</p>
          </div>
          <button type="button" onClick={onClose} aria-label="ปิด" className="inline-flex size-8 items-center justify-center rounded-[8px] text-ink-2 hover:bg-raised">
            <X size={16} strokeWidth={1.5} />
          </button>
        </header>

        <div className="grid gap-6 px-6 py-5 md:grid-cols-[minmax(0,1fr)_240px]">
          <div className="grid grid-cols-2 gap-4">
            <Field label="ชื่อลูกค้า">
              <input autoFocus className={inputCls} value={f.owner} onChange={set("owner")} placeholder="ชื่อ นามสกุล" />
            </Field>
            <Field label="เบอร์โทร">
              <input className={inputCls + " font-mono"} value={f.phone} onChange={set("phone")} placeholder="08x-xxx-xxxx" inputMode="tel" />
            </Field>
            <div className="col-span-2">
              <Field label="แบบบ้านจากแคตตาล็อก">
                <select className={inputCls} value={f.modelCode} onChange={(e) => pickModel(e.target.value)}>
                  {houseModels.map((hm) => (
                    <option key={hm.code} value={hm.code}>
                      {hm.code} · {hm.name} · {MODEL_TYPE_LABEL[hm.type]} {hm.floors} ชั้น
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="จังหวัด">
              <select className={inputCls} value={f.province} onChange={set("province")}>
                {PROVINCES.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </Field>
            <Field label="ผู้จัดการโครงการ (PM)">
              <select className={inputCls} value={f.pm} onChange={set("pm")}>
                {PMS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </Field>
            <div className="col-span-2">
              <Field label="ที่อยู่ไซต์ก่อสร้าง">
                <input className={inputCls} value={f.address} onChange={set("address")} placeholder="เลขที่ ถนน ตำบล อำเภอ" />
              </Field>
            </div>
            <Field label="วันเริ่มงาน">
              <input type="date" min={TODAY} className={inputCls + " font-mono"} value={f.start} onChange={set("start")} />
            </Field>
            <Field label="มูลค่าสัญญา (ล้านบาท)">
              <input type="number" step="0.1" min="0" className={inputCls + " font-mono"} value={f.value} onChange={set("value")} />
            </Field>
          </div>

          {m && (
            <aside className="rounded-[12px] border border-line bg-raised/50 p-3">
              <HouseThumb code={m.code} className="block h-[120px] w-full rounded-[8px]" />
              <p className="mt-3 text-[14px] font-medium">{m.name}</p>
              <p className="text-[12px] text-ink-3">{m.nameTh}</p>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
                <dt className="text-ink-3">ช่วงราคา</dt>
                <dd className="num text-right font-mono">
                  ฿{m.priceMin}–{m.priceMax} ล.
                </dd>
                <dt className="text-ink-3">ระยะเวลา</dt>
                <dd className="num text-right font-mono">{m.months} เดือน</dd>
                <dt className="text-ink-3">พื้นที่ใช้สอย</dt>
                <dd className="num text-right font-mono">{m.area} ตร.ม.</dd>
                <dt className="text-ink-3">ห้องนอน/น้ำ</dt>
                <dd className="num text-right font-mono">
                  {m.beds}/{m.baths}
                </dd>
                <dt className="text-ink-3">ที่ดินแนะนำ</dt>
                <dd className="num text-right font-mono">{m.land}</dd>
              </dl>
              {Number(f.value) > 0 && (Number(f.value) < m.priceMin || Number(f.value) > m.priceMax) && (
                <p className="mt-3 text-[12px] text-warn">มูลค่าอยู่นอกช่วงราคาของแบบนี้</p>
              )}
            </aside>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-line px-6 py-4">
          <p className="text-[13px] text-neg" role="alert">
            {error}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="inline-flex h-9 items-center rounded-[8px] border border-line-strong bg-card px-4 text-[14px] font-medium hover:bg-raised">
              ยกเลิก
            </button>
            <button type="submit" className="inline-flex h-9 items-center rounded-[8px] bg-ink px-4 text-[14px] font-medium text-card hover:bg-[#253d5c]">
              บันทึกโครงการ
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}
