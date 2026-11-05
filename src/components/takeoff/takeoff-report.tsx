"use client";

// Printable takeoff report: company header, project, snapshot of the 3D, totals per category
// (material / labour), the detail lines, and two signature boxes. Print → PDF from the browser.

import { Printer, X } from "lucide-react";
import { PrintStyle } from "@/components/ops/bits";
import { DocHeader, Signatures } from "@/components/ops/doc";
import { thDate, TODAY, type Project } from "@/lib/data";
import { CAT_OF, type Cat, type CatSummary, type TakeoffItem } from "@/lib/takeoff/types";

const nf = (n: number, d = 2) => n.toLocaleString("th-TH", { minimumFractionDigits: d, maximumFractionDigits: d });
const n0 = (n: number) => Math.round(n).toLocaleString("th-TH");
const btn = "inline-flex h-9 items-center gap-2 rounded-[8px] border border-line-strong bg-card px-3.5 text-[14px] text-ink transition-colors hover:bg-raised";
const STATUS: Record<CatSummary["priceStatus"], string> = { book: "บัญชีราคา", partial: "วัสดุจากบัญชีราคา", sample: "ราคาตัวอย่าง" };

export type ReportScope = "cat" | "all" | "summary";

export function TakeoffReport(p: {
  project: Project;
  sourceLabel: string;
  filterLabel: string;
  summary: CatSummary[];
  items: TakeoffItem[];
  cat: Cat;
  scope: ReportScope;
  onScope: (s: ReportScope) => void;
  snapshot: string | null;
  bookLabel: string;
  onClose: () => void;
}) {
  const code = `RPT-${p.scope === "cat" ? CAT_OF[p.cat].prefix : "TO"}-${p.project.id}-${TODAY.replaceAll("-", "")}`;
  const cats: Cat[] = p.scope === "cat" ? [p.cat] : p.scope === "all" ? p.summary.filter((x) => x.lines).map((x) => x.cat) : [];
  const total = p.summary.reduce((a, x) => a + x.cost, 0);
  const labour = p.summary.reduce((a, x) => a + x.labourCost, 0);

  return (
    <div className="takeoff-report-overlay fixed inset-0 z-[200] overflow-auto bg-black/40 p-4 sm:p-8" role="dialog" aria-modal="true" aria-label="รายงานถอดปริมาณงาน">
      <PrintStyle />
      <style>{`@media print { .takeoff-report-overlay { position: static !important; overflow: visible !important; background: none !important; padding: 0 !important; } .takeoff-report-overlay .ops-print { position: static !important; max-width: none !important; } }`}</style>
      <div className="ops-noprint mx-auto mb-3 flex max-w-[900px] flex-wrap items-center gap-2 rounded-[12px] bg-card px-3 py-2.5 shadow">
        <span className="text-[14px] font-medium">รายงานถอดปริมาณ</span>
        <select className="h-9 rounded-[8px] border border-line-strong bg-card px-2 text-[13px]" value={p.scope} onChange={(e) => p.onScope(e.target.value as ReportScope)} aria-label="เนื้อหารายงาน">
          <option value="cat">สรุป + รายละเอียดหมวด{CAT_OF[p.cat].label}</option>
          <option value="all">สรุป + รายละเอียดทุกหมวด</option>
          <option value="summary">สรุปอย่างเดียว</option>
        </select>
        <div className="ml-auto flex gap-2">
          <button type="button" className={btn} onClick={() => window.print()}>
            <Printer size={16} strokeWidth={1.5} /> พิมพ์ / บันทึก PDF
          </button>
          <button type="button" className={btn} onClick={p.onClose} aria-label="ปิดรายงาน">
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <article className="ops-print mx-auto max-w-[900px] rounded-[12px] bg-white p-8 text-ink shadow-xl">
        <DocHeader
          title="รายงานถอดปริมาณงานสถาปัตย์"
          titleEn="Architectural Quantity Takeoff"
          code={code}
          meta={<p>วันที่ {thDate(TODAY)}</p>}
        />

        <section className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-[12px]">
          <p>
            <span className="text-ink-3">โครงการ</span> {p.project.id} · {p.project.name}
          </p>
          <p>
            <span className="text-ink-3">แบบบ้าน</span> {p.project.model} ({p.project.modelCode})
          </p>
          <p>
            <span className="text-ink-3">แหล่งข้อมูล</span> {p.sourceLabel}
          </p>
          <p>
            <span className="text-ink-3">ขอบเขต</span> {p.filterLabel}
          </p>
          <p>
            <span className="text-ink-3">ราคา</span> {p.bookLabel}
          </p>
          <p>
            <span className="text-ink-3">ที่ตั้ง</span> {p.project.province}
          </p>
        </section>

        {p.snapshot && (
          <figure className="avoid-break mt-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.snapshot} alt="ภาพโมเดลที่ใช้ถอดปริมาณ" className="max-h-[300px] w-full rounded-[8px] border border-line object-contain" />
          </figure>
        )}

        <h2 className="mt-5 text-[14px] font-medium">สรุปตามหมวดงาน</h2>
        <table className="mt-2 w-full border-collapse text-[11.5px]">
          <thead>
            <tr className="border-y border-ink text-left">
              <th className="py-1.5 pr-2 font-medium">หมวด</th>
              <th className="py-1.5 pr-2 text-right font-medium">รายการ</th>
              <th className="py-1.5 pr-2 text-right font-medium">ปริมาณ</th>
              <th className="py-1.5 pr-2 text-right font-medium">เผื่อ</th>
              <th className="py-1.5 pr-2 text-right font-medium">สั่งซื้อ</th>
              <th className="py-1.5 pr-2 text-right font-medium">วัสดุ/หน่วย</th>
              <th className="py-1.5 pr-2 text-right font-medium">ค่าแรง/หน่วย</th>
              <th className="py-1.5 pr-2 text-right font-medium">ค่าแรงรวม</th>
              <th className="py-1.5 text-right font-medium">รวม (บาท)</th>
            </tr>
          </thead>
          <tbody>
            {p.summary.map((x) => (
              <tr key={x.cat} className="border-b border-line">
                <td className="py-1 pr-2">
                  {CAT_OF[x.cat].prefix} {CAT_OF[x.cat].label}
                  <span className="block text-[10px] text-ink-3">{STATUS[x.priceStatus]}</span>
                </td>
                <td className="py-1 pr-2 text-right font-mono">{x.lines}</td>
                <td className="py-1 pr-2 text-right font-mono">
                  {nf(x.qty, x.cat === "ties" ? 3 : 2)} {CAT_OF[x.cat].unit}
                </td>
                <td className="py-1 pr-2 text-right font-mono">{x.waste}%</td>
                <td className="py-1 pr-2 text-right font-mono">
                  {x.purchase.toLocaleString("th-TH")} {x.purchaseUnit}
                </td>
                <td className="py-1 pr-2 text-right font-mono">{nf(x.unitMaterial)}</td>
                <td className="py-1 pr-2 text-right font-mono">{nf(x.unitLabour)}</td>
                <td className="py-1 pr-2 text-right font-mono">{n0(x.labourCost)}</td>
                <td className="py-1 text-right font-mono">{n0(x.cost)}</td>
              </tr>
            ))}
            <tr className="border-b-2 border-ink font-medium">
              <td className="py-1.5" colSpan={7}>
                รวมทั้งหมด
              </td>
              <td className="py-1.5 pr-2 text-right font-mono">{n0(labour)}</td>
              <td className="py-1.5 text-right font-mono">{n0(total)}</td>
            </tr>
          </tbody>
        </table>

        {cats.map((c) => {
          const lines = p.items.filter((x) => x.cat === c);
          const s = p.summary.find((x) => x.cat === c)!;
          return (
            <section key={c} className="mt-6">
              <h2 className="text-[14px] font-medium">
                {CAT_OF[c].prefix} {CAT_OF[c].label} · {lines.length} รายการ
              </h2>
              <table className="mt-2 w-full border-collapse text-[11px]">
                <thead>
                  <tr className="border-y border-ink text-left">
                    <th className="py-1 pr-2 font-medium">รหัส</th>
                    <th className="py-1 pr-2 font-medium">ชั้น</th>
                    <th className="py-1 pr-2 font-medium">ห้อง / ด้าน</th>
                    <th className="py-1 pr-2 font-medium">รายละเอียด</th>
                    <th className="py-1 pr-2 text-right font-medium">ปริมาณ</th>
                    <th className="py-1 text-right font-medium">ซื้อ</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((x) => (
                    <tr key={x.code} className="avoid-break border-b border-line align-top">
                      <td className="py-0.5 pr-2 font-mono">{x.code}</td>
                      <td className="py-0.5 pr-2 font-mono">{x.floor}</td>
                      <td className="py-0.5 pr-2">{x.rooms.join(" / ")}</td>
                      <td className="py-0.5 pr-2">{x.detail}</td>
                      <td className="whitespace-nowrap py-0.5 pr-2 text-right font-mono">
                        {nf(x.qty, c === "ties" ? 3 : 2)} {CAT_OF[c].unit}
                      </td>
                      <td className="whitespace-nowrap py-0.5 text-right font-mono">{x.count != null ? `${x.count} ${x.countUnit}` : ""}</td>
                    </tr>
                  ))}
                  <tr className="font-medium">
                    <td className="py-1" colSpan={4}>
                      รวม {lines.length} รายการ · เผื่อ {s.waste}% = {nf(s.qtyWithWaste, c === "ties" ? 3 : 2)} {CAT_OF[c].unit} · {s.purchaseNote}
                    </td>
                    <td className="py-1 pr-2 text-right font-mono">{nf(s.qty, c === "ties" ? 3 : 2)}</td>
                    <td className="py-1 text-right font-mono">
                      {s.purchase.toLocaleString("th-TH")} {s.purchaseUnit}
                    </td>
                  </tr>
                </tbody>
              </table>
            </section>
          );
        })}

        <p className="mt-5 text-[11px] leading-relaxed text-ink-3">
          ปริมาณคำนวณจากโมเดลตามกฎที่ระบุในแต่ละรายการ ราคาเป็นราคาประมาณจากบัญชีราคาบริษัท/ราคาตัวอย่าง ณ วันที่ออกรายงาน ผู้รับเหมาและผู้ควบคุมงานควรตรวจกับแบบก่อสร้างและหน้างานก่อนสั่งซื้อหรือตกลงค่าแรง
        </p>

        <Signatures roles={[{ role: "ผู้จัดทำรายงาน (สถาปนิก/ผู้ประมาณราคา)" }, { role: "ผู้ควบคุมงาน / ผู้รับเหมา" }]} />
        <p className="mt-6 text-right font-mono text-[10px] text-ink-3">{code} v1</p>
      </article>
    </div>
  );
}
