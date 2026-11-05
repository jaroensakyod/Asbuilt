"use client";

import { useState } from "react";
import { Field, inputCls } from "@/components/ui";
import { Btn, Modal } from "@/components/ops/bits";
import { team, TODAY } from "@/lib/data";
import { NO_ALLOWANCES } from "@/lib/hr/calc";
import { ACTIVE_SITES } from "@/lib/hr/seed";
import { employees } from "@/lib/hr/store";
import { BANKS, DEPARTMENTS, EMP_STATUS_LABEL, EMP_TYPE_LABEL, NATIONALITY_LABEL, SKILLS, type EmpStatus, type EmpType, type Employee, type Nationality } from "@/lib/hr/types";

const blank = (type: EmpType): Employee => ({
  id: "",
  type,
  name: "",
  nationality: "TH",
  idNo: "",
  startDate: TODAY,
  position: type === "daily" ? "คนงานรายวัน" : "",
  department: type === "monthly" ? "ธุรการ/บุคคล" : "ก่อสร้าง",
  skill: type === "daily" ? "กรรมกร" : undefined,
  dailyRate: type === "daily" ? 400 : undefined,
  salary: type === "monthly" ? 15000 : undefined,
  ssoRegistered: type !== "subcontract",
  allowances: { ...NO_ALLOWANCES },
  status: type === "monthly" ? "probation" : "active",
});

export function EmployeeForm({ initial, type, onClose, onSaved }: { initial?: Employee; type?: EmpType; onClose: () => void; onSaved: (e: Employee) => void }) {
  const [e, setE] = useState<Employee>(() => initial ?? blank(type ?? "monthly"));
  const set = <K extends keyof Employee>(k: K, v: Employee[K]) => setE((x) => ({ ...x, [k]: v }));
  const setA = <K extends keyof Employee["allowances"]>(k: K, v: Employee["allowances"][K]) => setE((x) => ({ ...x, allowances: { ...x.allowances, [k]: v } }));
  const num = (v: string) => (v === "" ? undefined : Number(v));
  const foreign = e.nationality !== "TH";
  const valid = e.name.trim() && e.idNo.trim() && e.startDate && (e.type !== "monthly" || (e.salary ?? 0) > 0) && (e.type !== "daily" || (e.dailyRate ?? 0) > 0);

  const save = () => {
    if (!valid) return;
    const id = e.id || employees.nextId(e.type === "subcontract" ? "SC-" : "EMP-", e.type === "subcontract" ? 3 : 4);
    const out: Employee = { ...e, id, name: e.name.trim(), idNo: e.idNo.trim(), endDate: e.status === "resigned" ? (e.endDate ?? TODAY) : e.endDate };
    employees.upsert(out);
    onSaved(out);
  };

  return (
    <Modal
      open
      onClose={onClose}
      width={760}
      title={initial ? `แก้ไข ${initial.id}` : `เพิ่ม${EMP_TYPE_LABEL[e.type]}`}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!valid} onClick={save}>
            บันทึก
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        {!initial && (
          <Field label="ประเภท">
            <select className={inputCls} value={e.type} onChange={(v) => setE({ ...blank(v.target.value as EmpType), name: e.name })}>
              {(Object.keys(EMP_TYPE_LABEL) as EmpType[]).map((t) => (
                <option key={t} value={t}>
                  {EMP_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label={e.type === "subcontract" ? "ชื่อทีม/ผู้รับเหมา" : "ชื่อ-สกุล"}>
          <input className={inputCls} value={e.name} onChange={(v) => set("name", v.target.value)} />
        </Field>
        {e.type === "monthly" && (
          <Field label="ผู้ใช้ในระบบ">
            <select className={inputCls} value={e.memberId ?? ""} onChange={(v) => set("memberId", v.target.value || undefined)}>
              <option value="">ไม่เชื่อม</option>
              {team.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        {e.type !== "subcontract" && (
          <Field label="สัญชาติ">
            <select className={inputCls} value={e.nationality} onChange={(v) => set("nationality", v.target.value as Nationality)}>
              {(Object.keys(NATIONALITY_LABEL) as Nationality[]).map((n) => (
                <option key={n} value={n}>
                  {NATIONALITY_LABEL[n]}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label={e.type === "subcontract" ? "เลขผู้เสียภาษี/บัตรประชาชน" : foreign ? "เลขหนังสือเดินทาง" : "เลขบัตรประชาชน"}>
          <input className={`${inputCls} font-mono`} value={e.idNo} onChange={(v) => set("idNo", v.target.value)} />
        </Field>
        {foreign && e.type !== "subcontract" && (
          <>
            <Field label="เลขใบอนุญาตทำงาน">
              <input className={`${inputCls} font-mono`} value={e.workPermitNo ?? ""} onChange={(v) => set("workPermitNo", v.target.value || undefined)} />
            </Field>
            <Field label="ใบอนุญาตหมดอายุ">
              <input type="date" className={inputCls} value={e.workPermitExpiry ?? ""} onChange={(v) => set("workPermitExpiry", v.target.value || undefined)} />
            </Field>
          </>
        )}
        <Field label="โทรศัพท์">
          <input className={inputCls} value={e.phone ?? ""} onChange={(v) => set("phone", v.target.value || undefined)} />
        </Field>
        <Field label={e.type === "subcontract" ? "เริ่มงาน" : "วันเริ่มงาน"}>
          <input type="date" className={inputCls} value={e.startDate} onChange={(v) => set("startDate", v.target.value)} />
        </Field>
        <Field label={e.type === "subcontract" ? "หมวดงาน" : "ตำแหน่ง"}>
          <input className={inputCls} value={e.position} onChange={(v) => set("position", v.target.value)} />
        </Field>
        {e.type === "monthly" && (
          <Field label="ฝ่าย">
            <select className={inputCls} value={e.department} onChange={(v) => set("department", v.target.value)}>
              {DEPARTMENTS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </Field>
        )}
        {e.type === "daily" && (
          <Field label="ทักษะ">
            <select className={inputCls} value={e.skill ?? ""} onChange={(v) => set("skill", v.target.value)}>
              {SKILLS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
        )}
        <Field label="โครงการ/หน้างาน">
          <select className={inputCls} value={e.projectId ?? ""} onChange={(v) => set("projectId", v.target.value || undefined)}>
            <option value="">สำนักงาน / ไม่ระบุ</option>
            {ACTIVE_SITES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} · {p.name}
              </option>
            ))}
          </select>
        </Field>
        {e.type === "monthly" && (
          <>
            <Field label="เงินเดือน (บาท)">
              <input type="number" min={0} className={`${inputCls} font-mono`} value={e.salary ?? ""} onChange={(v) => set("salary", num(v.target.value))} />
            </Field>
            <Field label="ค่าตำแหน่ง/ค่าเดินทาง ต่อเดือน">
              <input type="number" min={0} className={`${inputCls} font-mono`} value={e.allowance ?? ""} onChange={(v) => set("allowance", num(v.target.value))} />
            </Field>
          </>
        )}
        {e.type === "daily" && (
          <Field label="ค่าแรงต่อวัน (บาท)">
            <input type="number" min={0} className={`${inputCls} font-mono`} value={e.dailyRate ?? ""} onChange={(v) => set("dailyRate", num(v.target.value))} />
          </Field>
        )}
        {e.type === "subcontract" && (
          <>
            <Field label="จำนวนคนในทีม">
              <input type="number" min={1} className={`${inputCls} font-mono`} value={e.crewSize ?? ""} onChange={(v) => set("crewSize", num(v.target.value))} />
            </Field>
            <Field label="เงื่อนไขค่าจ้าง">
              <input className={inputCls} value={e.contractNote ?? ""} onChange={(v) => set("contractNote", v.target.value || undefined)} />
            </Field>
          </>
        )}
        {e.type !== "subcontract" && (
          <>
            <Field label="ธนาคาร">
              <select className={inputCls} value={e.bank ?? ""} onChange={(v) => set("bank", v.target.value || undefined)}>
                <option value="">จ่ายเงินสด</option>
                {BANKS.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            </Field>
            <Field label="เลขที่บัญชี">
              <input className={`${inputCls} font-mono`} value={e.bankAccount ?? ""} disabled={!e.bank} onChange={(v) => set("bankAccount", v.target.value || undefined)} />
            </Field>
            <label className="flex items-center gap-2 self-end pb-2 text-[13px] text-ink-2">
              <input type="checkbox" checked={e.ssoRegistered} onChange={(v) => set("ssoRegistered", v.target.checked)} />
              ขึ้นทะเบียนประกันสังคมแล้ว
            </label>
          </>
        )}
        <Field label="สถานะ">
          <select className={inputCls} value={e.status} onChange={(v) => set("status", v.target.value as EmpStatus)}>
            {(Object.keys(EMP_STATUS_LABEL) as EmpStatus[]).map((s) => (
              <option key={s} value={s}>
                {EMP_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
        {e.status === "resigned" && (
          <Field label="วันสิ้นสุดการจ้าง">
            <input type="date" className={inputCls} value={e.endDate ?? TODAY} onChange={(v) => set("endDate", v.target.value)} />
          </Field>
        )}
      </div>

      {e.type === "monthly" && (
        <div className="mt-5 border-t border-line pt-4">
          <p className="mb-3 text-[14px] font-medium">ค่าลดหย่อนภาษี (ใช้คำนวณ ภ.ง.ด.1 แบบประมาณทั้งปี)</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            <label className="flex items-center gap-2 self-end pb-2 text-[13px] text-ink-2">
              <input type="checkbox" checked={e.allowances.spouse} onChange={(v) => setA("spouse", v.target.checked)} />
              คู่สมรสไม่มีเงินได้ (60,000)
            </label>
            <NumField label="บุตร (คนละ 30,000)" value={e.allowances.children} onChange={(n) => setA("children", n)} />
            <NumField label="บุตรคนที่ 2 ขึ้นไป เกิดปี 2561+ (60,000)" value={e.allowances.childrenExtra} onChange={(n) => setA("childrenExtra", n)} />
            <NumField label="บิดามารดา (คนละ 30,000)" value={e.allowances.parents} onChange={(n) => setA("parents", n)} />
            <NumField label="เบี้ยประกันชีวิต/ปี" value={e.allowances.lifeInsurance} onChange={(n) => setA("lifeInsurance", n)} />
            <NumField label="เบี้ยประกันสุขภาพ/ปี" value={e.allowances.healthInsurance} onChange={(n) => setA("healthInsurance", n)} />
            <NumField label="กองทุนสำรองเลี้ยงชีพ/ปี" value={e.allowances.providentFund} onChange={(n) => setA("providentFund", n)} />
            <NumField label="ดอกเบี้ยเงินกู้บ้าน/ปี" value={e.allowances.homeLoanInterest} onChange={(n) => setA("homeLoanInterest", n)} />
            <NumField label="ลดหย่อนอื่น/ปี" value={e.allowances.other} onChange={(n) => setA("other", n)} />
          </div>
          <p className="mt-2 text-[12px] text-ink-3">ค่าลดหย่อนส่วนตัว 60,000 และเงินสมทบประกันสังคมที่จ่ายจริงนับให้อัตโนมัติ</p>
        </div>
      )}
    </Modal>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <Field label={label}>
      <input type="number" min={0} className={`${inputCls} font-mono`} value={value || ""} onChange={(v) => onChange(Number(v.target.value) || 0)} />
    </Field>
  );
}
