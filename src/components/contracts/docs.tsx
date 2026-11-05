"use client";
// Printable A4 documents of the contracts module: ใบสั่งงานเปลี่ยนแปลง (VO), หนังสือรับรองผลงานและขอเบิกเงินงวด (IPC),
// ใบรับรองผลงานผู้รับเหมาช่วง, สรุปสัญญาจ้างเหมาช่วง.

import type { ReactNode } from "react";
import { COMPANY_INFO, thDate } from "@/lib/data";
import type { Subcontract } from "@/lib/biz";
import { Signatures } from "@/components/ops/doc";
import { bahtText, fmt, r2, thDateFull } from "@/lib/accounting/money";
import { useMediaUrl, type MediaRef } from "@/lib/media";
import { certBase, lineAmount, ORIGIN_LABEL, VO_STATUS_LABEL, type CertX, type ContractTerms, type SubcontractorX, type SubcontractX, type VariationX } from "@/lib/contracts";

function Head({ title, titleEn, no, meta }: { title: string; titleEn: string; no: string; meta: ReactNode }) {
  return (
    <header className="flex items-start justify-between gap-6 border-b-2 border-ink pb-4">
      <div className="text-[12px] leading-[18px] text-ink-2">
        <p className="text-[16px] font-medium leading-[22px] text-ink">{COMPANY_INFO.name}</p>
        <p>{COMPANY_INFO.address}</p>
        <p>
          โทร {COMPANY_INFO.phone} · เลขประจำตัวผู้เสียภาษีอากร <span className="font-mono">{COMPANY_INFO.taxId}</span>
        </p>
      </div>
      <div className="shrink-0 text-right text-[12px] leading-[18px] text-ink-2">
        <p className="text-[18px] font-medium leading-[26px] text-ink">{title}</p>
        <p className="text-ink-3">{titleEn}</p>
        <p className="mt-2 inline-block rounded-[6px] border border-ink px-2 py-0.5 font-mono text-[13px] text-ink">{no}</p>
        <div className="mt-2">{meta}</div>
      </div>
    </header>
  );
}

function Box({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-[6px] border border-line-strong px-3 py-2 text-[13px]">
      <p className="text-[12px] text-ink-3">{label}</p>
      {children}
    </div>
  );
}

function Rows({ rows }: { rows: [string, number, boolean?][] }) {
  return (
    <div className="text-[13px]">
      {rows.map(([k, v, strong], i) => (
        <div key={i} className={`flex justify-between border-b border-line py-1.5 ${strong ? "font-medium" : ""}`}>
          <span className={strong ? "" : "text-ink-2"}>{k}</span>
          <span className="num font-mono">{fmt(v)}</span>
        </div>
      ))}
    </div>
  );
}

function SignatureImage({ sig, name, date }: { sig?: MediaRef; name?: string; date?: string }) {
  const url = useMediaUrl(sig);
  return (
    <div className="text-center text-[12px] text-ink-2">
      <div className="flex h-12 items-end justify-center border-b border-ink-3">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="ลายมือชื่อ" className="max-h-12" />
        ) : null}
      </div>
      <p className="mt-2 text-ink">({name ?? "................................................"})</p>
      <p>ผู้ว่าจ้าง / ผู้มีอำนาจอนุมัติ</p>
      <p className="mt-1 text-ink-3">{date ? `วันที่ ${thDateFull(date)}` : "วันที่ ........../........../.........."}</p>
    </div>
  );
}

/** ใบสั่งงานเปลี่ยนแปลง (Variation Order) */
export function VariationDoc({ vo, projectName, owner, contractValue }: { vo: VariationX; projectName: string; owner: string; contractValue: number }) {
  return (
    <>
      <Head title="ใบสั่งงานเปลี่ยนแปลง" titleEn="VARIATION ORDER" no={vo.id} meta={<><p>วันที่ {thDateFull(vo.raisedAt)}</p><p>สถานะ {VO_STATUS_LABEL[vo.status]}</p></>} />
      <div className="mt-4 grid grid-cols-2 gap-4">
        <Box label="โครงการ / ผู้ว่าจ้าง">
          <p>{projectName}</p>
          <p className="text-ink-2">{owner}</p>
          <p className="font-mono text-ink-2">{vo.projectId}</p>
        </Box>
        <Box label="ที่มาของงานเปลี่ยนแปลง">
          <p>{ORIGIN_LABEL[vo.origin]}</p>
          <p className="text-ink-2">ผู้เสนอ {vo.raisedBy}</p>
          {vo.rfiId && <p className="font-mono text-ink-2">อ้างอิง {vo.rfiId}</p>}
        </Box>
      </div>
      <p className="mt-4 text-[14px] font-medium">{vo.title}</p>
      <p className="mt-1 text-[13px] text-ink-2">{vo.reason}</p>
      <table className="mt-4 w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-y border-ink">
            <th className="w-10 py-1.5 text-left font-normal text-ink-3">ลำดับ</th>
            <th className="py-1.5 text-left font-normal text-ink-3">รายการ</th>
            <th className="w-20 py-1.5 text-right font-normal text-ink-3">ปริมาณ</th>
            <th className="w-16 py-1.5 text-left font-normal text-ink-3">หน่วย</th>
            <th className="w-28 py-1.5 text-right font-normal text-ink-3">ราคา/หน่วย</th>
            <th className="w-32 py-1.5 text-right font-normal text-ink-3">จำนวนเงิน</th>
          </tr>
        </thead>
        <tbody>
          {vo.lines.map((l, i) => (
            <tr key={i} className="border-b border-line">
              <td className="py-1.5 align-top">{i + 1}</td>
              <td className="py-1.5">{l.description}</td>
              <td className="num py-1.5 text-right font-mono">{l.qty.toLocaleString("th-TH")}</td>
              <td className="py-1.5 pl-2">{l.unit}</td>
              <td className="num py-1.5 text-right font-mono">{fmt(l.unitPrice)}</td>
              <td className="num py-1.5 text-right font-mono">{fmt(lineAmount(l))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="avoid-break mt-3 grid grid-cols-[1fr_300px] gap-6">
        <div className="self-end text-[13px]">
          <p className="rounded-[6px] bg-raised px-3 py-2">({bahtText(Math.abs(vo.amount))}{vo.amount < 0 ? " · งานลด" : ""})</p>
          <p className="mt-2 text-ink-2">ขยายระยะเวลาก่อสร้าง {vo.days} วัน · ราคานี้ยังไม่รวมภาษีมูลค่าเพิ่ม 7%</p>
        </div>
        <Rows
          rows={[
            ["มูลค่าสัญญาก่อนงานนี้", r2(contractValue - (vo.status === "approved" ? vo.amount : 0))],
            [vo.amount < 0 ? "งานลด" : "งานเพิ่ม", vo.amount],
            ["ภาษีมูลค่าเพิ่ม 7%", r2(vo.amount * 0.07)],
            ["มูลค่าสัญญาใหม่ (ก่อน VAT)", r2(contractValue + (vo.status === "approved" ? 0 : vo.amount)), true],
          ]}
        />
      </div>
      <p className="mt-4 text-[12px] text-ink-2">ผู้ว่าจ้างตกลงให้ดำเนินงานเปลี่ยนแปลงตามรายการข้างต้น โดยถือเป็นส่วนหนึ่งของสัญญาจ้างเดิม เงื่อนไขอื่นคงเดิมทุกประการ</p>
      <div className="avoid-break mt-10 grid grid-cols-3 gap-8">
        <div className="text-center text-[12px] text-ink-2">
          <div className="h-12 border-b border-ink-3" />
          <p className="mt-2 text-ink">({vo.raisedBy})</p>
          <p>ผู้เสนอ</p>
        </div>
        <div className="text-center text-[12px] text-ink-2">
          <div className="h-12 border-b border-ink-3" />
          <p className="mt-2 text-ink">(................................................)</p>
          <p>ผู้มีอำนาจลงนามฝ่ายผู้รับจ้าง</p>
        </div>
        <SignatureImage sig={vo.signature} name={vo.approvedBy} date={vo.approvedAt} />
      </div>
    </>
  );
}

/** หนังสือรับรองผลงานและขอเบิกเงินงวด (Interim Payment Certificate) */
export function ClientCertDoc({ c, projectName, terms, owner, contractValue }: { c: CertX; projectName: string; terms: ContractTerms; owner: string; contractValue: number }) {
  const base = certBase(c);
  return (
    <>
      <Head
        title="หนังสือรับรองผลงานและขอเบิกเงินงวด"
        titleEn="INTERIM PAYMENT CERTIFICATE"
        no={`งวดที่ ${c.no}`}
        meta={
          <>
            <p>วันที่ {thDateFull(c.date)}</p>
            <p>ผลงานถึงวันที่ {thDateFull(c.periodTo)}</p>
            {terms.contractNo && <p>สัญญาเลขที่ {terms.contractNo}</p>}
          </>
        }
      />
      <div className="mt-4 grid grid-cols-2 gap-4">
        <Box label="ผู้ว่าจ้าง">
          <p>{terms.customerName ?? owner}</p>
          {terms.customerAddress && <p className="text-ink-2">{terms.customerAddress}</p>}
          <p className="text-ink-2">
            เลขประจำตัวผู้เสียภาษี <span className="font-mono">{terms.customerTaxId ?? "–"}</span>
            {terms.customerBranch ? ` · ${terms.customerBranch}` : ""}
          </p>
        </Box>
        <Box label="โครงการ">
          <p>{projectName}</p>
          <p className="font-mono text-ink-2">{c.projectId}</p>
          <p className="text-ink-2">
            ผลงานสะสม {c.pctToDate ?? "–"}% · มูลค่าสัญญารวมงานเปลี่ยนแปลง {fmt(c.contractValue ?? contractValue)} บาท
          </p>
        </Box>
      </div>
      <table className="mt-5 w-full border-collapse text-[13px]">
        <tbody>
          {(
            [
              ["1", "มูลค่างานที่ทำได้สะสมถึงงวดนี้ (รวมงานเปลี่ยนแปลงที่อนุมัติ)", c.grossToDate],
              ["2", "หัก มูลค่างานสะสมที่เบิกแล้วถึงงวดก่อน", -c.previous],
              ["3", "มูลค่างานงวดนี้ (1) − (2)", c.thisPeriod, true],
              ["4", "หัก คืนเงินล่วงหน้าตามสัดส่วนผลงาน", -c.advanceRecovery],
              ["5", "มูลค่าที่เรียกเก็บงวดนี้ก่อนภาษีมูลค่าเพิ่ม (3) − (4)", base, true],
              ["6", `ภาษีมูลค่าเพิ่ม ${c.vatRate ?? 7}%`, c.vat],
              ["7", "รวมเงินงวดนี้ (5) + (6)", r2(base + c.vat), true],
              ["8", `หัก เงินประกันผลงาน ${c.retentionPct ?? terms.retentionPct}% (เพดาน ${terms.retentionCapPct}% ของมูลค่าสัญญา)`, -c.retention],
              ["9", `หัก ภาษีหัก ณ ที่จ่าย ${c.whtRate ?? terms.whtRate}%`, -c.wht],
              ["10", "จำนวนเงินที่ขอเบิกสุทธิ", c.net, true],
            ] as [string, string, number, boolean?][]
          ).map(([n, k, v, strong]) => (
            <tr key={n} className={`border-b border-line ${strong ? "font-medium" : ""}`}>
              <td className="w-10 py-1.5 text-ink-3">{n}</td>
              <td className="py-1.5">{k}</td>
              <td className="num w-40 py-1.5 text-right font-mono">{fmt(v)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 rounded-[6px] bg-raised px-3 py-2 text-[13px]">({bahtText(c.net)})</p>
      <p className="mt-3 text-[12px] text-ink-2">
        ผู้รับจ้างขอรับรองว่าผลงานข้างต้นได้ดำเนินการแล้วจริงตามแบบและข้อกำหนดของสัญญา ผู้ควบคุมงานได้ตรวจวัดปริมาณงานแล้ว · เงินประกันผลงานจะคืนเมื่อพ้นระยะเวลารับประกันความชำรุดบกพร่อง {terms.defectsMonths} เดือนนับแต่วันส่งมอบงาน (ป.พ.พ. มาตรา 600)
      </p>
      <Signatures roles={[{ role: "ผู้จัดการโครงการ (ผู้รับจ้าง)" }, { role: "ผู้ควบคุมงาน (ผู้ว่าจ้าง)", name: c.certifiedBy }, { role: "ผู้มีอำนาจอนุมัติ (ผู้ว่าจ้าง)" }]} />
    </>
  );
}

/** ใบรับรองผลงานผู้รับเหมาช่วง (Subcontract Payment Certificate) */
export function SubCertDoc({ c, sc, sub, projectName }: { c: CertX; sc: SubcontractX; sub?: SubcontractorX; projectName: string }) {
  const base = certBase(c);
  return (
    <>
      <Head title="ใบรับรองผลงานผู้รับเหมาช่วง" titleEn="SUBCONTRACT PAYMENT CERTIFICATE" no={c.id} meta={<><p>วันที่ {thDateFull(c.date)}</p><p>ผลงานถึงวันที่ {thDateFull(c.periodTo)}</p><p>สัญญา {sc.id}</p></>} />
      <div className="mt-4 grid grid-cols-2 gap-4">
        <Box label="ผู้รับเหมาช่วง">
          <p>{sub?.name ?? sc.subcontractorId}</p>
          <p className="text-ink-2">
            เลขประจำตัวผู้เสียภาษี <span className="font-mono">{sub?.taxId ?? "–"}</span>
          </p>
        </Box>
        <Box label="โครงการ / ขอบเขตงาน">
          <p>{projectName}</p>
          <p className="text-ink-2">{sc.title}</p>
        </Box>
      </div>
      <table className="mt-4 w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-y border-ink">
            <th className="py-1.5 text-left font-normal text-ink-3">รายการ</th>
            <th className="w-20 py-1.5 text-right font-normal text-ink-3">ตามสัญญา</th>
            <th className="w-20 py-1.5 text-right font-normal text-ink-3">สะสม</th>
            <th className="w-12 py-1.5 pl-2 text-left font-normal text-ink-3">หน่วย</th>
            <th className="w-24 py-1.5 text-right font-normal text-ink-3">ราคา/หน่วย</th>
            <th className="w-28 py-1.5 text-right font-normal text-ink-3">มูลค่าสะสม</th>
          </tr>
        </thead>
        <tbody>
          {sc.lines.map((l) => {
            const q = c.lines?.find((m) => m.lineId === l.id)?.qtyToDate ?? 0;
            return (
              <tr key={l.id} className="border-b border-line">
                <td className="py-1.5">{l.description}</td>
                <td className="num py-1.5 text-right font-mono">{l.qty.toLocaleString("th-TH")}</td>
                <td className={`num py-1.5 text-right font-mono ${q > l.qty ? "text-neg" : ""}`}>{q.toLocaleString("th-TH")}</td>
                <td className="py-1.5 pl-2">{l.unit}</td>
                <td className="num py-1.5 text-right font-mono">{fmt(l.rate)}</td>
                <td className="num py-1.5 text-right font-mono">{fmt(q * l.rate)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="avoid-break mt-4 grid grid-cols-[1fr_320px] gap-6">
        <div className="text-[12px] text-ink-2">
          {(c.backChargeItems ?? []).length > 0 && (
            <>
              <p className="font-medium text-ink">รายการหักค่าใช้จ่าย (back-charge)</p>
              {(c.backChargeItems ?? []).map((b) => (
                <p key={b.id}>
                  {thDate(b.date)} · {b.reason} · <span className="num font-mono">{fmt(b.amount)}</span>
                </p>
              ))}
            </>
          )}
          <p className="mt-2 rounded-[6px] bg-raised px-3 py-2 text-[13px] text-ink">({bahtText(c.net)})</p>
        </div>
        <Rows
          rows={[
            ["มูลค่างานสะสม", c.grossToDate],
            ["หัก เบิกแล้วงวดก่อน", -c.previous],
            ["มูลค่างานงวดนี้", c.thisPeriod, true],
            ["หัก คืนเงินล่วงหน้า", -c.advanceRecovery],
            ["หัก ค่าใช้จ่ายที่เรียกเก็บ", -c.backCharges],
            ["มูลค่าก่อน VAT", base, true],
            [`ภาษีมูลค่าเพิ่ม ${c.vatRate ?? 0}%`, c.vat],
            [`หัก เงินประกันผลงาน ${sc.retentionPct}%`, -c.retention],
            [`หัก ภาษี ณ ที่จ่าย ${sc.whtRate}%`, -c.wht],
            ["จ่ายสุทธิ", c.net, true],
          ]}
        />
      </div>
      <Signatures roles={[{ role: "ผู้รับเหมาช่วง" }, { role: "วิศวกร/โฟร์แมนผู้ตรวจวัด" }, { role: "ผู้จัดการโครงการ", name: c.certifiedBy }]} />
    </>
  );
}

/** สรุปสัญญาจ้างเหมาช่วง */
export function SubcontractDoc({ sc, sub, projectName }: { sc: SubcontractX; sub?: SubcontractorX; projectName: string }) {
  const STATUS: Record<Subcontract["status"], string> = { draft: "ร่าง", active: "ดำเนินการ", completed: "แล้วเสร็จ", terminated: "บอกเลิก" };
  return (
    <>
      <Head title="สรุปสัญญาจ้างเหมาช่วง" titleEn="SUBCONTRACT SUMMARY" no={sc.id} meta={<><p>ลงนาม {sc.signedAt ? thDateFull(sc.signedAt) : "ยังไม่ลงนาม"}</p><p>สถานะ {STATUS[sc.status]}</p></>} />
      <div className="mt-4 grid grid-cols-2 gap-4">
        <Box label="ผู้รับจ้างช่วง">
          <p>{sub?.name ?? sc.subcontractorId}</p>
          <p className="text-ink-2">
            เลขประจำตัวผู้เสียภาษี <span className="font-mono">{sub?.taxId ?? "–"}</span> · {sub?.contact} {sub?.phone}
          </p>
        </Box>
        <Box label="โครงการ">
          <p>{projectName}</p>
          <p className="font-mono text-ink-2">{sc.projectId}</p>
          <p className="text-ink-2">
            ระยะเวลา {thDate(sc.start)} – {thDate(sc.finish)}
          </p>
        </Box>
      </div>
      <p className="mt-4 text-[14px] font-medium">{sc.title}</p>
      <table className="mt-3 w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-y border-ink">
            <th className="w-10 py-1.5 text-left font-normal text-ink-3">ลำดับ</th>
            <th className="py-1.5 text-left font-normal text-ink-3">รายการ</th>
            <th className="w-16 py-1.5 text-left font-normal text-ink-3">หมวด</th>
            <th className="w-20 py-1.5 text-right font-normal text-ink-3">ปริมาณ</th>
            <th className="w-14 py-1.5 pl-2 text-left font-normal text-ink-3">หน่วย</th>
            <th className="w-24 py-1.5 text-right font-normal text-ink-3">ค่าจ้าง/หน่วย</th>
            <th className="w-28 py-1.5 text-right font-normal text-ink-3">จำนวนเงิน</th>
          </tr>
        </thead>
        <tbody>
          {sc.lines.map((l, i) => (
            <tr key={l.id} className="border-b border-line">
              <td className="py-1.5">{i + 1}</td>
              <td className="py-1.5">{l.description}</td>
              <td className="py-1.5 font-mono text-[12px]">{l.costCode ?? sc.costCode ?? ""}</td>
              <td className="num py-1.5 text-right font-mono">{l.qty.toLocaleString("th-TH")}</td>
              <td className="py-1.5 pl-2">{l.unit}</td>
              <td className="num py-1.5 text-right font-mono">{fmt(l.rate)}</td>
              <td className="num py-1.5 text-right font-mono">{fmt(l.qty * l.rate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="avoid-break mt-3 grid grid-cols-[1fr_300px] gap-6">
        <div className="text-[12px] text-ink-2">
          <p>เงื่อนไขการจ่ายเงิน: เบิกตามผลงานที่ตรวจวัดจริงรายงวด หักเงินประกันผลงาน {sc.retentionPct}% คืนเมื่อพ้นระยะประกันผลงาน {sc.defectsMonths ?? 12} เดือนหลังส่งมอบ</p>
          <p className="mt-1">หักภาษี ณ ที่จ่าย {sc.whtRate}% (ค่าจ้างทำของ) · {sc.vat ? "ผู้รับจ้างจดทะเบียนภาษีมูลค่าเพิ่ม" : "ผู้รับจ้างไม่จดทะเบียนภาษีมูลค่าเพิ่ม"}</p>
          {sc.advance > 0 && <p className="mt-1">เงินล่วงหน้า {fmt(sc.advance)} บาท หักคืนตามสัดส่วนผลงานทุกงวด</p>}
          <p className="mt-1">ผู้รับจ้างต้องมีประกันภัยความรับผิดต่อบุคคลภายนอกและขึ้นทะเบียนกองทุนเงินทดแทนตลอดระยะสัญญา (ตรวจสอบกับประกาศล่าสุด)</p>
        </div>
        <Rows rows={[["มูลค่าสัญญา (ก่อน VAT)", sc.value, true], ["ภาษีมูลค่าเพิ่ม", sc.vat ? r2(sc.value * 0.07) : 0], ["รวม", sc.vat ? r2(sc.value * 1.07) : sc.value, true]]} />
      </div>
      <Signatures roles={[{ role: "ผู้ว่าจ้าง" }, { role: "ผู้รับจ้างช่วง", name: sub?.contact }, { role: "พยาน" }]} />
    </>
  );
}
