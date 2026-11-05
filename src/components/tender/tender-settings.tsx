"use client";

import { useState } from "react";
import { Plus, Settings, Trash2 } from "lucide-react";
import { cx, Field, inputCls } from "@/components/ui";
import { Btn, I, IconBtn, Modal, Segmented } from "@/components/ops/bits";
import { formulaWeight } from "@/lib/tender/calc";
import { saveTenderSettings, TENDER_DEFAULTS, useTenderSettings } from "@/lib/tender/store";
import { INDEX_LABEL, type TenderSettings } from "@/lib/tender/types";
import { canEdit } from "@/lib/permissions";
import { useMe } from "@/lib/use-me";
import { IndexImportButtons } from "./index-import";

export const VERIFY = "ตรวจสอบกับประกาศล่าสุด";
const numCls = cx(inputCls, "num h-8 px-2 text-right font-mono text-[13px]");
const toNum = (v: string) => Number(v.replace(/[^\d.-]/g, "")) || 0;

export function TenderSettingsButton({ label = "ตั้งค่าราคากลาง/ค่า K" }: { label?: string }) {
  const me = useMe();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Btn onClick={() => setOpen(true)}>
        <Settings {...I} />
        {label}
      </Btn>
      {open && <SettingsModal onClose={() => setOpen(false)} readOnly={!canEdit(me.role, "tender")} />}
    </>
  );
}

function SettingsModal({ onClose, readOnly }: { onClose: () => void; readOnly: boolean }) {
  const cur = useTenderSettings();
  const [s, setS] = useState<TenderSettings>(cur);
  const [tab, setTab] = useState<"rules" | "factor" | "k" | "index">("rules");
  const months = Object.keys(s.indices).sort();
  const syms = [...new Set([...Object.keys(INDEX_LABEL), ...s.kFormulas.flatMap((f) => f.terms.map((t) => t.sym))])];
  const setIdx = (m: string, sym: string, v: number) => setS({ ...s, indices: { ...s.indices, [m]: { ...s.indices[m], [sym]: v } } });

  return (
    <Modal
      open
      onClose={onClose}
      width={980}
      title="ตั้งค่าราคากลาง Factor F ค่า K และค่าปรับ"
      footer={
        <>
          <Btn onClick={() => setS(TENDER_DEFAULTS)} disabled={readOnly}>
            ค่าเริ่มต้น
          </Btn>
          <span className="mr-auto text-[12px] text-ink-3">ตัวเลขทั้งหมดเป็นค่าตัวอย่าง {VERIFY}</span>
          <Btn onClick={onClose}>ปิด</Btn>
          {!readOnly && (
            <Btn
              primary
              onClick={() => {
                saveTenderSettings(s);
                onClose();
              }}
            >
              บันทึก
            </Btn>
          )}
        </>
      }
    >
      <div className="mb-4">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { key: "rules", label: "เกณฑ์/อัตรา" },
            { key: "factor", label: "ตาราง Factor F" },
            { key: "k", label: "สูตรค่า K" },
            { key: "index", label: "ดัชนีราคารายเดือน" },
          ]}
        />
      </div>

      {tab === "rules" && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {(
            [
              ["kThresholdPct", "ค่า K ไม่จ่าย/ไม่หัก ภายใน ± (%)"],
              ["kDecimals", "ทศนิยมค่า K (ตัดทิ้ง)"],
              ["kClaimDays", "ยื่นขอค่า K ภายใน (วันหลังรับเงินงวดสุดท้าย)"],
              ["penaltyRatePct", "ค่าปรับรายวัน (% ของค่าจ้าง)"],
              ["penaltyMinPerDay", "ค่าปรับขั้นต่ำต่อวัน (บาท)"],
              ["bidBondPct", "หลักประกันซอง (% ของวงเงิน/ราคากลาง)"],
              ["perfBondPct", "หลักประกันสัญญา (% ของค่าจ้าง)"],
            ] as const
          ).map(([k, label]) => (
            <Field key={k} label={label}>
              <input className={cx(inputCls, "num font-mono")} value={s[k]} disabled={readOnly} onChange={(e) => setS({ ...s, [k]: toNum(e.target.value) })} />
            </Field>
          ))}
          <p className="col-span-full text-[12px] text-ink-3">
            ค่าเริ่มต้น: ค่า K ±4% ทศนิยม 3 ตำแหน่ง ยื่นภายใน 90 วัน · ค่าปรับงานก่อสร้างร้อยละ 0.1 ต่อวัน ขั้นต่ำ 100 บาท · หลักประกันซองและสัญญา 5% — {VERIFY}และเงื่อนไขในสัญญาจริง
          </p>
        </div>
      )}

      {tab === "factor" && (
        <div>
          <Field label="เงื่อนไขของตาราง">
            <input className={inputCls} value={s.factorBasis} disabled={readOnly} onChange={(e) => setS({ ...s, factorBasis: e.target.value })} />
          </Field>
          <table className="mt-3 w-full max-w-[520px] text-[13px]">
            <thead>
              <tr className="text-left text-ink-3">
                <th className="py-1 font-normal">ค่างานต้นทุน (บาท)</th>
                <th className="py-1 font-normal">Factor F</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {s.factorTable.map((r, i) => (
                <tr key={i}>
                  <td className="py-0.5 pr-2">
                    <input className={numCls} value={r.cost} disabled={readOnly} onChange={(e) => setS({ ...s, factorTable: s.factorTable.map((x, j) => (j === i ? { ...x, cost: toNum(e.target.value) } : x)) })} />
                  </td>
                  <td className="py-0.5 pr-2">
                    <input className={numCls} value={r.factor} disabled={readOnly} onChange={(e) => setS({ ...s, factorTable: s.factorTable.map((x, j) => (j === i ? { ...x, factor: toNum(e.target.value) } : x)) })} />
                  </td>
                  <td>
                    {!readOnly && (
                      <IconBtn label="ลบแถว" danger onClick={() => setS({ ...s, factorTable: s.factorTable.filter((_, j) => j !== i) })}>
                        <Trash2 {...I} />
                      </IconBtn>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!readOnly && (
            <Btn small onClick={() => setS({ ...s, factorTable: [...s.factorTable, { cost: (s.factorTable[s.factorTable.length - 1]?.cost ?? 0) * 2 || 1_000_000, factor: s.factorTable[s.factorTable.length - 1]?.factor ?? 1.2 }] })}>
              <Plus {...I} />
              เพิ่มแถว
            </Btn>
          )}
          <p className="mt-2 text-[12px] text-ink-3">ค่าที่อยู่ระหว่างแถวคำนวณแบบเทียบสัดส่วน (interpolation) · ใช้ตาราง Factor F ของกรมบัญชีกลางตามประเภทงาน เงินล่วงหน้า เงินประกันผลงาน และอัตราดอกเบี้ยที่ประกาศ — {VERIFY}</p>
        </div>
      )}

      {tab === "k" && (
        <div className="flex flex-col gap-4">
          {s.kFormulas.map((f, i) => {
            const setF = (patch: Partial<typeof f>) => setS({ ...s, kFormulas: s.kFormulas.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
            const w = formulaWeight(f);
            return (
              <div key={f.id} className="rounded-[10px] border border-line p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <input className={cx(inputCls, "h-8 w-56 text-[13px]")} value={f.name} disabled={readOnly} onChange={(e) => setF({ name: e.target.value })} aria-label="ชื่อสูตร" />
                  <span className="font-mono text-[12px] text-ink-3">{f.id}</span>
                  <span className={cx("ml-auto text-[12px]", w === 1 ? "text-ink-3" : "text-neg")}>ผลรวมสัมประสิทธิ์ {w.toFixed(2)}</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[13px]">
                  K =
                  <input className={cx(numCls, "w-16")} value={f.constant} disabled={readOnly} onChange={(e) => setF({ constant: toNum(e.target.value) })} aria-label="ค่าคงที่" />
                  {f.terms.map((t, k) => (
                    <span key={k} className="inline-flex items-center gap-1">
                      +
                      <input className={cx(numCls, "w-16")} value={t.coef} disabled={readOnly} onChange={(e) => setF({ terms: f.terms.map((x, j) => (j === k ? { ...x, coef: toNum(e.target.value) } : x)) })} aria-label={`สัมประสิทธิ์ ${t.sym}`} />
                      <select className={cx(inputCls, "h-8 px-1 text-[13px]")} value={t.sym} disabled={readOnly} onChange={(e) => setF({ terms: f.terms.map((x, j) => (j === k ? { ...x, sym: e.target.value } : x)) })} aria-label="ดัชนี">
                        {syms.map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                      <span className="text-ink-3">
                        t/{t.sym}o
                      </span>
                      {!readOnly && (
                        <button type="button" aria-label="ลบพจน์" className="text-ink-3 hover:text-neg" onClick={() => setF({ terms: f.terms.filter((_, j) => j !== k) })}>
                          ×
                        </button>
                      )}
                    </span>
                  ))}
                  {!readOnly && (
                    <Btn small onClick={() => setF({ terms: [...f.terms, { sym: "I", coef: 0 }] })}>
                      <Plus {...I} />
                    </Btn>
                  )}
                </div>
              </div>
            );
          })}
          {!readOnly && (
            <Btn small onClick={() => setS({ ...s, kFormulas: [...s.kFormulas, { id: `K-${s.kFormulas.length + 1}`, name: "สูตรใหม่", constant: 0.3, terms: [{ sym: "I", coef: 0.7 }] }] })}>
              <Plus {...I} />
              เพิ่มสูตร
            </Btn>
          )}
          <p className="text-[12px] text-ink-3">สูตรตามประเภทงานในเงื่อนไขสัญญาแบบปรับราคาได้ (ค่า K) · It/Io ดัชนีเดือนที่ส่งงานงวดนั้นเทียบเดือนที่เปิดซอง — {VERIFY}</p>
        </div>
      )}

      {tab === "index" && (
        <div className="overflow-x-auto">
          {!readOnly && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <IndexImportButtons settings={s} onApply={(patch) => setS({ ...s, ...patch })} />
              {s.indexLog?.[0] && (
                <span className="text-[12px] text-ink-3">
                  นำเข้าล่าสุด {s.indexLog[0].at.slice(0, 10)} · {s.indexLog[0].via === "moc-api" ? "API กระทรวงพาณิชย์" : `ไฟล์ ${s.indexLog[0].file ?? ""}`} · {s.indexLog[0].cells} ค่า
                </span>
              )}
            </div>
          )}
          <table className="text-[12px]">
            <thead>
              <tr className="text-ink-3">
                <th className="pr-2 text-left font-normal">เดือน</th>
                {syms.map((x) => (
                  <th key={x} className="px-1 text-right font-normal" title={INDEX_LABEL[x]}>
                    {x}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {months.map((m) => (
                <tr key={m}>
                  <td className="pr-2 font-mono">{m}</td>
                  {syms.map((x) => (
                    <td key={x} className="px-0.5 py-0.5">
                      <input className={cx(numCls, "h-7 w-[72px]")} value={s.indices[m]?.[x] ?? ""} disabled={readOnly} onChange={(e) => setIdx(m, x, toNum(e.target.value))} aria-label={`${x} ${m}`} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {!readOnly && (
            <Btn
              small
              onClick={() => {
                const last = months[months.length - 1] ?? "2026-01";
                const [y, mo] = last.split("-").map(Number);
                const next = new Date(Date.UTC(y, mo, 1)).toISOString().slice(0, 7);
                setS({ ...s, indices: { ...s.indices, [next]: { ...s.indices[last] } } });
              }}
            >
              <Plus {...I} />
              เพิ่มเดือนถัดไป
            </Btn>
          )}
          <ul className="mt-3 grid grid-cols-2 gap-1 text-[12px] text-ink-3">
            {syms.map((x) => (
              <li key={x}>
                <span className="font-mono">{x}</span> {INDEX_LABEL[x] ?? ""}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[12px] text-ink-3">{s.indexLog?.length ? "มีดัชนีที่นำเข้าจากแหล่งทางการแล้วบางส่วน เดือนอื่นยังเป็นดัชนีตัวอย่าง" : "ดัชนีตัวอย่างสำหรับทดลอง"} ให้ใช้ดัชนีราคาที่สำนักงานนโยบายและยุทธศาสตร์การค้าประกาศ (ดึงจาก API หรืออ่านไฟล์ประกาศ) และใช้ชุดเดียวกันทั้งเดือนเปิดซองและเดือนส่งงาน — {VERIFY}</p>
        </div>
      )}
    </Modal>
  );
}
