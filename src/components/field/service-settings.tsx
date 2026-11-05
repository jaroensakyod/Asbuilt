"use client";

import { useState } from "react";
import { Settings } from "lucide-react";
import { cx, Field, inputCls } from "@/components/ui";
import { Btn, I, Modal } from "@/components/ops/bits";
import { promptPayKind } from "@/lib/field/promptpay";
import { FIELD_DEFAULTS, WARRANTY_CAT_LABEL, type FieldSettings, type WarrantyCategory } from "@/lib/field/types";
import { saveFieldSettings, useFieldSettings } from "@/lib/field/store";
import { canEdit } from "@/lib/permissions";
import { useMe } from "@/lib/use-me";

const DAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

/** Field/service settings: PromptPay id, diary days, technician load, warranty periods */
export function ServiceSettingsButton() {
  const me = useMe();
  const [open, setOpen] = useState(false);
  if (!canEdit(me.role, "service") && !canEdit(me.role, "field")) return null;
  return (
    <>
      <Btn onClick={() => setOpen(true)}>
        <Settings {...I} />
        ตั้งค่า
      </Btn>
      {open && <SettingsModal onClose={() => setOpen(false)} />}
    </>
  );
}

function SettingsModal({ onClose }: { onClose: () => void }) {
  const cur = useFieldSettings();
  const [s, setS] = useState<FieldSettings>(cur);
  const n = (v: string) => Math.max(0, Number(v.replace(/[^\d]/g, "")) || 0);
  const ppOk = !!promptPayKind(s.promptPayId);
  return (
    <Modal
      open
      onClose={onClose}
      width={640}
      title="ตั้งค่างานหน้างานและงานบริการ"
      footer={
        <>
          <Btn onClick={() => setS(FIELD_DEFAULTS)}>ค่าเริ่มต้น</Btn>
          <span className="mr-auto" />
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn
            primary
            disabled={!ppOk}
            onClick={() => {
              saveFieldSettings(s);
              onClose();
            }}
          >
            บันทึก
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="พร้อมเพย์ของบริษัท (เลขผู้เสียภาษี 13 หลัก หรือเบอร์ 10 หลัก)">
          <input className={cx(inputCls, "font-mono", !ppOk && "border-neg")} value={s.promptPayId} onChange={(e) => setS({ ...s, promptPayId: e.target.value })} />
        </Field>
        <Field label="ชื่อบัญชีที่แสดงใต้ QR">
          <input className={inputCls} value={s.promptPayName} onChange={(e) => setS({ ...s, promptPayName: e.target.value })} />
        </Field>
        <Field label="งานสูงสุดต่อช่างต่อวัน">
          <input className={cx(inputCls, "num font-mono")} inputMode="numeric" value={s.maxJobsPerDay} onChange={(e) => setS({ ...s, maxJobsPerDay: n(e.target.value) || 1 })} />
        </Field>
        <Field label="เตือนก่อนประกันหมด (วัน)">
          <input className={cx(inputCls, "num font-mono")} inputMode="numeric" value={s.preExpiryDays} onChange={(e) => setS({ ...s, preExpiryDays: n(e.target.value) })} />
        </Field>
      </div>
      <p className="mb-1.5 mt-4 text-[13px] text-ink-2">วันที่ต้องส่งรายงานประจำวัน</p>
      <div className="flex gap-1.5">
        {DAYS.map((d, i) => (
          <button key={d} type="button" aria-pressed={s.diaryDays.includes(i)} onClick={() => setS({ ...s, diaryDays: s.diaryDays.includes(i) ? s.diaryDays.filter((x) => x !== i) : [...s.diaryDays, i].sort() })} className={cx("h-8 w-10 rounded-[8px] border text-[13px]", s.diaryDays.includes(i) ? "border-ink bg-ink text-card" : "border-line-strong text-ink-2")}>
            {d}
          </button>
        ))}
      </div>
      <p className="mb-1.5 mt-4 text-[13px] text-ink-2">ระยะประกันเริ่มต้นของบริษัท (เดือน)</p>
      <div className="grid grid-cols-2 gap-3">
        {(Object.keys(WARRANTY_CAT_LABEL) as WarrantyCategory[]).map((k) => (
          <Field key={k} label={WARRANTY_CAT_LABEL[k]}>
            <input className={cx(inputCls, "num font-mono")} inputMode="numeric" value={s.warrantyMonths[k]} onChange={(e) => setS({ ...s, warrantyMonths: { ...s.warrantyMonths, [k]: n(e.target.value) } })} />
          </Field>
        ))}
      </div>
      <p className="mt-3 text-[12px] text-ink-3">ค่าเริ่มต้น โครงสร้าง 5 ปี งานทั่วไป/ระบบ 1 ปี ตาม ป.พ.พ. ม.600 หรือสัญญา ตรวจสอบสัญญาจริงของแต่ละโครงการ (กำหนดต่อสัญญาได้ที่หน้าทะเบียนประกัน)</p>
    </Modal>
  );
}
