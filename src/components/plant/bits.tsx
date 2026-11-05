"use client";

import { useState } from "react";
import { Card, cx, Field, inputCls } from "@/components/ui";
import { areaCls, Btn, Modal, Pill, type Tone } from "@/components/ops/bits";
import { MediaField } from "@/components/media/media-field";
import { COST_CODES, type CostCode } from "@/lib/biz";
import { getProject, TODAY } from "@/lib/data";
import { ACTIVE_SITES } from "@/lib/hr/seed";
import type { TrainingRecord } from "@/lib/hr/labour-types";
import { CERT_LABEL } from "@/lib/hr/labour-types";
import { canEdit } from "@/lib/permissions";
import { useMe } from "@/lib/use-me";
import type { CertState } from "@/lib/plant/calc";
import { plants } from "@/lib/plant/store";
import {
  BASIS_LABEL,
  CERT_KIND_LABEL,
  DEFAULT_COST_CODE,
  OPERATOR_CERT,
  PLANT_STATUS_LABEL,
  PLANT_TYPE_LABEL,
  type Plant,
  type PlantStatus,
  type PlantType,
  type PlantUsage,
  type RateBasis,
} from "@/lib/plant/types";

export const siteName = (id?: string) => (id ? (getProject(id)?.name ?? id) : "-");
export const fmtNum = (n: number, d = 0) => n.toLocaleString("th-TH", { minimumFractionDigits: d, maximumFractionDigits: d });

export const STATUS_TONE: Record<PlantStatus, Tone> = { available: "neutral", on_site: "pos", maintenance: "warn", breakdown: "neg", off_hired: "neutral" };
export const CERT_TONE: Record<CertState["state"], Tone> = { ok: "pos", expiring: "warn", expired: "neg", missing: "neg" };
export const CERT_STATE_LABEL: Record<CertState["state"], string> = { ok: "ใบรับรองปกติ", expiring: "ใกล้หมดอายุ", expired: "หมดอายุ", missing: "ไม่มีใบรับรอง" };

export function usePlantAccess() {
  const me = useMe();
  return { me, edit: canEdit(me.role, "plant") };
}

/** Worst certificate state of a plant item, as one pill (nothing when none required) */
export function CertPill({ states }: { states: CertState[] }) {
  if (!states.length) return <span className="text-[12px] text-ink-3">ไม่ต้องมี</span>;
  const order: CertState["state"][] = ["missing", "expired", "expiring", "ok"];
  const worst = order.find((s) => states.some((x) => x.state === s))!;
  const st = states.find((x) => x.state === worst)!;
  return (
    <span title={states.map((s) => `${CERT_KIND_LABEL[s.kind]}: ${CERT_STATE_LABEL[s.state]}${s.cert ? ` (ถึง ${s.cert.expiry})` : ""}`).join("\n")}>
      <Pill tone={CERT_TONE[worst]}>
        {CERT_STATE_LABEL[worst]}
        {st.daysLeft !== undefined && worst !== "ok" && <span className="ml-1 font-mono">{st.daysLeft < 0 ? `${-st.daysLeft} วัน` : `${st.daysLeft} วัน`}</span>}
      </Pill>
    </span>
  );
}

/** Operator holds a valid certificate of the key the plant type requires on that date. */
export function operatorOk(p: Pick<Plant, "type">, operatorId: string | undefined, date: string, trn: TrainingRecord[]) {
  const key = OPERATOR_CERT[p.type];
  if (!key) return true;
  if (!operatorId) return false;
  return trn.some((t) => t.employeeId === operatorId && t.cert === key && t.issuedAt <= date && (!t.expiry || t.expiry >= date));
}
export const operatorWarn = (p: Pick<Plant, "type">) => {
  const key = OPERATOR_CERT[p.type];
  return key ? `ผู้ควบคุมไม่มีใบรับรอง${CERT_LABEL[key]}ที่ยังไม่หมดอายุ` : "";
};
/** company worker operating plant that needs a certificate without a valid one (outside operators of rented plant are checked on paper) */
export const usageFlagged = (u: PlantUsage, p: Plant | undefined, trn: TrainingRecord[]) => !!p && !!OPERATOR_CERT[p.type] && !!u.operatorId && !operatorOk(p, u.operatorId, u.date, trn);

export const TYPES = Object.keys(PLANT_TYPE_LABEL) as PlantType[];
export const STATUSES = Object.keys(PLANT_STATUS_LABEL) as PlantStatus[];

export function Tag({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-[12px] text-ink-3">{children}</span>;
}

export function Notice({ children, tone = "warn" }: { children: React.ReactNode; tone?: "warn" | "neg" }) {
  return <p className={cx("rounded-[8px] px-3 py-2 text-[13px]", tone === "neg" ? "bg-neg-soft text-neg" : "bg-warn-soft text-warn")}>{children}</p>;
}

export function Section({ children, className }: { children: React.ReactNode; className?: string }) {
  return <Card className={className}>{children}</Card>;
}

// ---------- plant form ----------

const blank = (): Plant => ({ id: "", name: "", type: "excavator", ownership: "owned", rateBasis: "hour", rate: 0, costCode: DEFAULT_COST_CODE.excavator, status: "available", photos: [] });

export function PlantForm({ plant, onClose, onSaved }: { plant?: Plant; onClose: () => void; onSaved?: (id: string) => void }) {
  const [f, setF] = useState<Plant>(() => plant ?? blank());
  const set = (p: Partial<Plant>) => setF((x) => ({ ...x, ...p }));
  const ok = f.name.trim() && f.rate >= 0;
  const save = () => {
    if (!ok) return;
    const id = f.id || plants.nextId("PL-", 3);
    const rec: Plant = { ...f, id, name: f.name.trim(), projectId: f.projectId || undefined, supplier: f.ownership === "rented" ? f.supplier : undefined };
    plants.upsert(rec);
    onSaved?.(id);
    onClose();
  };
  const num = (v: string) => (v === "" ? undefined : Math.max(0, Number(v) || 0));
  return (
    <Modal
      open
      onClose={onClose}
      title={plant ? `แก้ไข ${plant.id}` : "เพิ่มเครื่องจักร"}
      width={720}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!ok} onClick={save}>
            บันทึก
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="ชื่อเรียก">
          <input className={inputCls} value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="เช่น รถขุด PC70" />
        </Field>
        <Field label="ประเภท">
          <select className={inputCls} value={f.type} onChange={(e) => set({ type: e.target.value as PlantType, costCode: DEFAULT_COST_CODE[e.target.value as PlantType] })}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {PLANT_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="กรรมสิทธิ์">
          <select className={inputCls} value={f.ownership} onChange={(e) => set({ ownership: e.target.value as Plant["ownership"] })}>
            <option value="owned">ของบริษัท</option>
            <option value="rented">เช่า</option>
          </select>
        </Field>
        <Field label={f.ownership === "rented" ? "ผู้ให้เช่า" : "ผู้จำหน่าย/หมายเหตุที่มา"}>
          <input className={inputCls} value={f.supplier ?? ""} disabled={f.ownership !== "rented"} onChange={(e) => set({ supplier: e.target.value })} />
        </Field>
        <Field label="ยี่ห้อ">
          <input className={inputCls} value={f.make ?? ""} onChange={(e) => set({ make: e.target.value || undefined })} />
        </Field>
        <Field label="รุ่น">
          <input className={inputCls} value={f.model ?? ""} onChange={(e) => set({ model: e.target.value || undefined })} />
        </Field>
        <Field label="หมายเลขเครื่อง">
          <input className={cx(inputCls, "font-mono")} value={f.serial ?? ""} onChange={(e) => set({ serial: e.target.value || undefined })} />
        </Field>
        {(f.type === "tower_crane" || f.type === "mobile_crane" || f.type === "hoist" || f.type === "forklift") && (
          <Field label="พิกัดยก (ตัน)">
            <input type="number" min={0} step={0.5} className={cx(inputCls, "font-mono")} value={f.capacityT ?? ""} onChange={(e) => set({ capacityT: num(e.target.value) })} />
          </Field>
        )}
        {f.type === "scaffold" && (
          <Field label="ความสูงนั่งร้าน (ม.)">
            <input type="number" min={0} className={cx(inputCls, "font-mono")} value={f.heightM ?? ""} onChange={(e) => set({ heightM: num(e.target.value) })} />
          </Field>
        )}
        <Field label="คิดค่าใช้ต่อ">
          <select className={inputCls} value={f.rateBasis} onChange={(e) => set({ rateBasis: e.target.value as RateBasis })}>
            {(Object.keys(BASIS_LABEL) as RateBasis[]).map((b) => (
              <option key={b} value={b}>
                {BASIS_LABEL[b]}
              </option>
            ))}
          </select>
        </Field>
        <Field label={f.ownership === "rented" ? "ค่าเช่า (บาท ไม่รวม VAT)" : "อัตราภายใน (บาท)"}>
          <input type="number" min={0} className={cx(inputCls, "font-mono")} value={f.rate || ""} onChange={(e) => set({ rate: Math.max(0, Number(e.target.value) || 0) })} />
        </Field>
        <Field label="รหัสต้นทุน">
          <select className={inputCls} value={f.costCode} onChange={(e) => set({ costCode: e.target.value as CostCode })}>
            {(Object.keys(COST_CODES) as CostCode[]).map((c) => (
              <option key={c} value={c}>
                {c} · {COST_CODES[c]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="หน้างานปัจจุบัน">
          <select className={inputCls} value={f.projectId ?? ""} onChange={(e) => set({ projectId: e.target.value || undefined })}>
            <option value="">ไม่อยู่หน้างาน (คลัง/ลานเก็บ)</option>
            {ACTIVE_SITES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} · {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="สถานะ">
          <select className={inputCls} value={f.status} onChange={(e) => set({ status: e.target.value as PlantStatus })}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {PLANT_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="ชั่วโมงเครื่อง">
          <input type="number" min={0} className={cx(inputCls, "font-mono")} value={f.meterHours ?? ""} onChange={(e) => set({ meterHours: num(e.target.value) })} />
        </Field>
        <Field label="บำรุงรักษาทุก (ชม.)">
          <input type="number" min={0} className={cx(inputCls, "font-mono")} value={f.serviceEveryHours ?? ""} onChange={(e) => set({ serviceEveryHours: num(e.target.value) })} />
        </Field>
        {f.ownership === "rented" && (
          <>
            <Field label="วันเริ่มเช่า">
              <input type="date" className={inputCls} value={f.onHire ?? ""} onChange={(e) => set({ onHire: e.target.value || undefined })} />
            </Field>
            <Field label="วันคืน">
              <input type="date" className={inputCls} value={f.offHire ?? ""} onChange={(e) => set({ offHire: e.target.value || undefined })} />
            </Field>
          </>
        )}
        <div className="sm:col-span-2">
          <Field label="หมายเหตุ">
            <textarea className={areaCls} value={f.note ?? ""} onChange={(e) => set({ note: e.target.value || undefined })} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <MediaField value={f.photos} onChange={(photos) => set({ photos })} label="รูปเครื่องจักร" photosOnly />
        </div>
        {OPERATOR_CERT[f.type] && <p className="text-[12px] text-ink-3 sm:col-span-2">ผู้ควบคุมต้องมีใบรับรอง {CERT_LABEL[OPERATOR_CERT[f.type]!]} (ทักษะ & ใบรับรอง)</p>}
      </div>
    </Modal>
  );
}

/** last day of a "YYYY-MM" period, or today for the current month */
export function periodEnd(period: string) {
  if (period === TODAY.slice(0, 7)) return TODAY;
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}
export function lastPeriods(n: number) {
  const [y, m] = TODAY.slice(0, 7).split("-").map(Number);
  return Array.from({ length: n }, (_, i) => new Date(Date.UTC(y, m - 1 - i, 1)).toISOString().slice(0, 7));
}
const TH_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
export const periodLabel = (p: string) => `${TH_MONTHS[Number(p.slice(5, 7)) - 1]} ${Number(p.slice(0, 4)) + 543}`;
