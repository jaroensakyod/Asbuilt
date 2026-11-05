"use client";

import { useState, type FormEvent } from "react";
import { Card, CardHead, Field, inputCls } from "@/components/ui";
import { COMPANY_INFO, team } from "@/lib/data";
import { companyOverrides, invites, seatLimit, type CompanySettings } from "./team-store";

const FIELDS: { key: keyof CompanySettings; label: string; mono?: boolean; wide?: boolean }[] = [
  { key: "name", label: "ชื่อบริษัท", wide: true },
  { key: "nameEn", label: "ชื่อภาษาอังกฤษ", wide: true },
  { key: "address", label: "ที่อยู่", wide: true },
  { key: "taxId", label: "เลขประจำตัวผู้เสียภาษี", mono: true },
  { key: "since", label: "เริ่มดำเนินงาน (พ.ศ.)", mono: true },
  { key: "phone", label: "โทรศัพท์", mono: true },
  { key: "hotline", label: "สายด่วนบริการ", mono: true },
  { key: "line", label: "LINE Official", mono: true },
];

/** Company details used on document headers and reports (shown on /settings). */
export function CompanyInfoCard() {
  const overrides = companyOverrides.use();
  const [saved, setSaved] = useState(false);
  const values: CompanySettings = { ...COMPANY_INFO, ...overrides };

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const next: Partial<CompanySettings> = {};
    for (const { key } of FIELDS) {
      const v = String(f.get(key) ?? "").trim();
      if (key === "since") {
        const n = Number(v);
        if (n && n !== COMPANY_INFO.since) next.since = n;
      } else if (v && v !== COMPANY_INFO[key]) {
        next[key] = v;
      }
    }
    companyOverrides.set(next);
    setSaved(true);
  };

  return (
      <Card>
        <CardHead title="ข้อมูลบริษัท" meta={COMPANY_INFO.id} />
        <form key={JSON.stringify(overrides)} onSubmit={submit} onChange={() => setSaved(false)} className="grid grid-cols-2 gap-3 px-5 py-4">
          {FIELDS.map((f) => (
            <div key={f.key} className={f.wide ? "col-span-2" : undefined}>
              <Field label={f.label}>
                <input name={f.key} defaultValue={String(values[f.key])} className={`${inputCls} w-full ${f.mono ? "font-mono text-[13px]" : ""}`} />
              </Field>
            </div>
          ))}
          <div className="col-span-2 flex items-center justify-between gap-3 pt-1">
            <p className="text-[12px] text-ink-3">{saved ? "บันทึกแล้ว" : "บันทึกในเบราว์เซอร์นี้ ใช้กับหัวเอกสารและรายงาน"}</p>
            <div className="flex gap-2">
              {Object.keys(overrides).length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    companyOverrides.set({});
                    setSaved(false);
                  }}
                  className="h-9 rounded-[8px] border border-line-strong bg-card px-4 text-[14px] text-ink transition-colors duration-150 hover:bg-raised"
                >
                  คืนค่าเดิม
                </button>
              )}
              <button type="submit" className="h-9 rounded-[8px] bg-ink px-4 text-[14px] font-medium text-card transition-colors duration-150 hover:bg-[#253d5c]">
                บันทึก
              </button>
            </div>
          </div>
        </form>
      </Card>
  );
}

/** Plan and seat usage (shown on /team). */
export function PlanSeatsCard() {
  const local = invites.use();
  const used = team.filter((m) => m.active).length + local.length;
  return (
      <Card>
        <CardHead title="แพ็กเกจ" meta="SaaS" />
        <div className="px-5 py-4">
          <div className="flex items-baseline justify-between">
            <p className="text-[15px] font-medium">แพ็กเกจ Pro · 25 ผู้ใช้</p>
            <p className="font-mono text-[12px] text-ink-3">ต่ออายุ 1 ม.ค. 70</p>
          </div>
          <div className="mt-3 flex items-baseline justify-between text-[13px] text-ink-2">
            <span>ที่นั่งที่ใช้</span>
            <span className="num font-mono">
              {used}/{seatLimit()}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 rounded-full bg-raised">
            <div className={`h-full rounded-full ${used / seatLimit() > 0.9 ? "bg-accent" : "bg-ink/70"}`} style={{ width: `${Math.min(100, (used / seatLimit()) * 100)}%` }} />
          </div>
          <ul className="mt-4 flex flex-col gap-1.5 text-[13px] text-ink-2">
            <li className="flex justify-between">
              <span>โครงการ</span>
              <span className="text-ink-3">ไม่จำกัด</span>
            </li>
            <li className="flex justify-between">
              <span>พื้นที่เก็บเอกสาร</span>
              <span className="font-mono text-[12px] text-ink-3">100 GB</span>
            </li>
            <li className="flex justify-between">
              <span>โมเดล 3D / แบบ CAD</span>
              <span className="text-ink-3">รวมในแพ็กเกจ</span>
            </li>
          </ul>
          <p className="mt-4 text-[12px] text-ink-3">การชำระเงินและการเปลี่ยนแพ็กเกจยังไม่เปิดใช้งานในเวอร์ชันตัวอย่าง</p>
        </div>
      </Card>
  );
}
