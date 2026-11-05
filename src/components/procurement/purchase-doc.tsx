"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, Check, FileText, PackageCheck, Pencil, Plus, Printer, Trash2, X } from "lucide-react";
import { cx, Field, inputCls } from "@/components/ui";
import { areaCls, Btn, Empty, I, IconBtn, KV, Modal, Pill, PrintStyle, useHydrated } from "@/components/ops/bits";
import { DocHeader, DocRow, DocSection, Signatures } from "@/components/ops/doc";
import { COST_CODES } from "@/lib/biz";
import { getProject, thDate, TODAY } from "@/lib/data";
import {
  addDays,
  APPROVAL_LIMIT,
  approveBill,
  approvePO,
  asProcBill,
  billOfGR,
  billTotals,
  canApproveAmount,
  chooseWinner,
  createBillFromGR,
  createPOFromPR,
  goodsReceipts,
  isOpenPO,
  poTotals,
  purchaseOrders,
  purchaseRequests,
  quoteTotal,
  receivedByLine,
  receivePO,
  rejectPR,
  saveQuotes,
  setPOStatus,
  supplierBills,
  suppliers,
  VAT_RATE,
  type GoodsReceipt,
  type PurchaseOrder,
  type PurchaseRequest,
  type Quote,
  type Supplier,
} from "@/lib/procurement";
import { Amt, BILL_LABEL, BILL_TONE, fmt, POStatusPill, PRStatusPill, Section, useProcPerms } from "./bits";
import { AiBanner, AiPill, IssueList } from "@/components/ai-docs/bits";
import { DeliveryNoteAi, GrInvoiceAi, QuoteAi, type AiResult } from "@/components/ai-docs/po-doc-ai";
import type { MediaRef } from "@/lib/media";

export function PurchaseDoc({ id }: { id: string }) {
  const hydrated = useHydrated();
  const prs = purchaseRequests.use();
  const pos = purchaseOrders.use();
  const pr = prs.find((p) => p.id === id);
  const po = pos.find((p) => p.id === id);
  if (pr) return <PRDoc pr={pr} />;
  if (po) return <PODoc po={po} />;
  if (!hydrated) return <div className="h-[60vh]" />;
  return (
    <div className="py-20 text-center">
      <p className="text-ink-2">ไม่พบเอกสาร {id}</p>
      <Link href="/purchasing" className="mt-3 inline-block text-accent-text hover:underline">
        กลับไปหน้าจัดซื้อ
      </Link>
    </div>
  );
}

function Toolbar({ children, back = "/purchasing" }: { children?: React.ReactNode; back?: string }) {
  return (
    <div className="ops-noprint flex flex-wrap items-center justify-between gap-3 pb-5">
      <Link href={back} className="inline-flex items-center gap-1.5 text-[14px] text-ink-2 hover:text-ink">
        <ArrowLeft {...I} />
        จัดซื้อ
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        <Btn onClick={() => window.print()}>
          <Printer {...I} />
          พิมพ์ / PDF
        </Btn>
      </div>
    </div>
  );
}

const Paper = ({ children }: { children: React.ReactNode }) => (
  <article className="ops-print mx-auto w-full max-w-[860px] rounded-[4px] border border-line bg-white px-12 py-10 text-ink shadow-[0_2px_12px_rgba(31,27,22,0.08)]">{children}</article>
);

const siteText = (projectId?: string) => {
  if (!projectId) return { name: "คลังกลาง บริษัทฯ", address: "168/9 ถนนประเสริฐมนูกิจ แขวงจรเข้บัว เขตลาดพร้าว กรุงเทพฯ 10230" };
  const p = getProject(projectId);
  return { name: p ? `${p.id} · ${p.name}` : projectId, address: p?.address ?? p?.province ?? "" };
};

// =====================================================================
// PR + RFQ
// =====================================================================

function PRDoc({ pr }: { pr: PurchaseRequest }) {
  const router = useRouter();
  const perms = useProcPerms();
  const sups = suppliers.use();
  const [editRfq, setEditRfq] = useState(false);
  const [pick, setPick] = useState<string | null>(null);
  const site = siteText(pr.projectId);
  const quotes = pr.rfq?.quotes ?? [];
  const totals = quotes.map((q) => quoteTotal(pr, q));
  const min = totals.length ? Math.min(...totals) : 0;
  const sup = (id: string) => sups.find((s) => s.id === id);
  const winner = pr.rfq?.winner;
  const canWork = perms.edit && (pr.status === "submitted" || pr.status === "rfq");

  return (
    <>
      <PrintStyle />
      <Toolbar>
        {pr.poId && (
          <Btn onClick={() => router.push(`/purchasing/${pr.poId}`)}>
            <FileText {...I} />
            ใบสั่งซื้อ {pr.poId}
          </Btn>
        )}
        {canWork && (
          <Btn
            danger
            onClick={() => {
              const why = window.prompt("เหตุผลที่ไม่อนุมัติใบขอซื้อ");
              if (why !== null) rejectPR(pr.id, why);
            }}
          >
            <X {...I} />
            ไม่อนุมัติ
          </Btn>
        )}
        {canWork && (
          <Btn onClick={() => setEditRfq(true)}>
            <Pencil {...I} />
            {quotes.length ? "แก้ไขใบเสนอราคา" : "เปรียบเทียบราคา"}
          </Btn>
        )}
        {canWork && winner && (
          <Btn
            primary
            onClick={() => {
              const po = createPOFromPR(pr.id, perms.me.name);
              if (po) router.push(`/purchasing/${po.id}`);
            }}
          >
            <Check {...I} />
            ออกใบสั่งซื้อจากผู้ชนะ
          </Btn>
        )}
      </Toolbar>

      <Paper>
        <DocHeader
          title="ใบขอซื้อ"
          titleEn="Purchase Requisition"
          code={pr.id}
          meta={
            <>
              <p>วันที่ {thDate(pr.date)}</p>
              <p className="ops-noprint mt-1">
                <PRStatusPill s={pr.status} />
              </p>
            </>
          }
        />
        <DocSection n={1} title="ข้อมูลการขอซื้อ" en="Request">
          <div className="grid grid-cols-2 gap-x-6">
            <DocRow k="ส่งที่">{site.name}</DocRow>
            <DocRow k="รหัสต้นทุน">
              {pr.costCode} · {COST_CODES[pr.costCode]}
            </DocRow>
            <DocRow k="ผู้ขอซื้อ">{pr.requestedBy}</DocRow>
            <DocRow k="ที่อยู่หน้างาน">{site.address}</DocRow>
            {pr.note && (
              <div className="col-span-2">
                <DocRow k="หมายเหตุ">{pr.note}</DocRow>
              </div>
            )}
          </div>
        </DocSection>
        <DocSection n={2} title="รายการที่ต้องการ" en="Items">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-ink text-ink-3">
                <th className="w-8 py-1.5 font-normal">#</th>
                <th className="py-1.5 font-normal">รายการ</th>
                <th className="py-1.5 pr-3 text-right font-normal">จำนวน</th>
                <th className="py-1.5 pr-3 font-normal">หน่วย</th>
                <th className="py-1.5 text-right font-normal">ต้องการใช้</th>
              </tr>
            </thead>
            <tbody>
              {pr.lines.map((l, i) => (
                <tr key={i} className="border-b border-line">
                  <td className="py-1.5 font-mono text-ink-3">{i + 1}</td>
                  <td className="py-1.5">
                    {l.description}
                    {l.itemId && <span className="ml-2 font-mono text-[11px] text-ink-3">{l.itemId}</span>}
                  </td>
                  <td className="num py-1.5 pr-3 text-right font-mono">{l.qty.toLocaleString("th-TH")}</td>
                  <td className="py-1.5 pr-3">{l.unit}</td>
                  <td className="py-1.5 text-right">{thDate(l.neededBy)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DocSection>

        <DocSection n={3} title={`เปรียบเทียบราคา${pr.rfq ? ` ${pr.rfq.id}` : ""}`} en="Quotation comparison">
          {!quotes.length ? (
            <p className="py-2 text-[13px] text-ink-3">ยังไม่มีใบเสนอราคา</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-ink align-bottom">
                    <th className="py-1.5 pr-3 font-normal text-ink-3">รายการ</th>
                    {quotes.map((q, i) => (
                      <th key={q.supplierId} className={cx("py-1.5 pr-3 text-right font-normal", q.supplierId === winner && "bg-raised/70")}>
                        <span className="block text-[12px] text-ink-3">ราย {i + 1}</span>
                        <span className="block max-w-[180px] truncate text-ink">{sup(q.supplierId)?.name ?? q.supplierId}</span>
                        <span className="block text-[11px] text-ink-3">
                          ส่งใน {q.leadDays} วัน · ยืนราคาถึง {thDate(q.validUntil)}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pr.lines.map((l, li) => {
                    const prices = quotes.map((q) => q.prices[li] ?? 0);
                    const lo = Math.min(...prices);
                    return (
                      <tr key={li} className="border-b border-line">
                        <td className="py-1.5 pr-3">
                          {l.description}
                          <span className="block text-[11px] text-ink-3">
                            {l.qty.toLocaleString("th-TH")} {l.unit}
                          </span>
                        </td>
                        {quotes.map((q, qi) => (
                          <td key={q.supplierId} className={cx("num py-1.5 pr-3 text-right font-mono", q.supplierId === winner && "bg-raised/70")}>
                            {perms.money ? (
                              <>
                                <span className={cx(prices[qi] === lo && quotes.length > 1 && "text-pos")}>{fmt(prices[qi])}</span>
                                <span className="block text-[11px] text-ink-3">{fmt(prices[qi] * l.qty)}</span>
                              </>
                            ) : (
                              "•••"
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                  <tr className="border-b border-ink">
                    <td className="py-1.5 pr-3 font-medium">รวมก่อน VAT</td>
                    {quotes.map((q, qi) => (
                      <td key={q.supplierId} className={cx("num py-1.5 pr-3 text-right font-mono font-medium", q.supplierId === winner && "bg-raised/70", totals[qi] === min && quotes.length > 1 && "text-pos")}>
                        {perms.money ? fmt(totals[qi]) : "•••"}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-1.5 pr-3 text-ink-3">ส่วนต่างจากราคาต่ำสุด</td>
                    {quotes.map((q, qi) => (
                      <td key={q.supplierId} className={cx("num py-1.5 pr-3 text-right font-mono text-ink-3", q.supplierId === winner && "bg-raised/70")}>
                        {min > 0 ? (totals[qi] === min ? "ต่ำสุด" : `+${(((totals[qi] - min) / min) * 100).toFixed(1)}%`) : "–"}
                      </td>
                    ))}
                  </tr>
                  {quotes.some((q) => q.note) && (
                    <tr>
                      <td className="py-1.5 pr-3 text-ink-3">หมายเหตุ</td>
                      {quotes.map((q) => (
                        <td key={q.supplierId} className={cx("py-1.5 pr-3 text-right text-[12px] text-ink-2", q.supplierId === winner && "bg-raised/70")}>
                          {q.note ?? ""}
                        </td>
                      ))}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          {winner && (
            <p className="mt-3 text-[13px]">
              <span className="text-ink-3">ผู้ได้รับคัดเลือก </span>
              {sup(winner)?.name}
              {pr.rfq?.reason && <span className="text-ink-2"> · เหตุผล: {pr.rfq.reason}</span>}
            </p>
          )}
          {canWork && quotes.length > 0 && (
            <div className="ops-noprint mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[13px] text-ink-3">เลือกผู้ชนะ</span>
              {quotes.map((q) => (
                <Btn key={q.supplierId} small primary={q.supplierId === winner} onClick={() => setPick(q.supplierId)}>
                  {sup(q.supplierId)?.name.replace(/^(บริษัท|ห้างหุ้นส่วนจำกัด) /, "").slice(0, 26)}
                </Btn>
              ))}
            </div>
          )}
        </DocSection>

        <Signatures roles={[{ role: "ผู้ขอซื้อ", name: pr.requestedBy }, { role: "ผู้จัดการโครงการ", name: pr.projectId ? getProject(pr.projectId)?.pm : undefined }, { role: "ฝ่ายจัดซื้อ" }]} />
      </Paper>

      {editRfq && <RFQEditor pr={pr} onClose={() => setEditRfq(false)} />}
      {pick && <WinnerForm pr={pr} supplierId={pick} cheapest={totals[quotes.findIndex((q) => q.supplierId === pick)] === min} onClose={() => setPick(null)} />}
    </>
  );
}

function WinnerForm({ pr, supplierId, cheapest, onClose }: { pr: PurchaseRequest; supplierId: string; cheapest: boolean; onClose: () => void }) {
  const s = suppliers.get(supplierId);
  const [reason, setReason] = useState(pr.rfq?.winner === supplierId ? (pr.rfq?.reason ?? "") : cheapest ? "ราคารวมต่ำสุด ส่งของได้ตามกำหนด" : "");
  return (
    <Modal
      open
      onClose={onClose}
      width={560}
      title="เลือกผู้ชนะการเสนอราคา"
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn
            primary
            disabled={!reason.trim()}
            onClick={() => {
              chooseWinner(pr.id, supplierId, reason.trim());
              onClose();
            }}
          >
            ยืนยันผู้ชนะ
          </Btn>
        </>
      }
    >
      <p className="text-[14px]">{s?.name}</p>
      {!cheapest && <p className="mt-1 text-[13px] text-warn">ผู้ขายรายนี้ไม่ใช่ราคาต่ำสุด กรุณาระบุเหตุผล</p>}
      <div className="mt-3">
        <Field label="เหตุผลการคัดเลือก">
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} className={cx(areaCls, "min-h-[72px]")} />
        </Field>
      </div>
    </Modal>
  );
}

function RFQEditor({ pr, onClose }: { pr: PurchaseRequest; onClose: () => void }) {
  const list = suppliers.use().filter((s) => s.status === "active");
  const [quotes, setQuotes] = useState<Quote[]>(pr.rfq?.quotes ?? []);
  const setQ = (i: number, patch: Partial<Quote>) => setQuotes((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const used = new Set(quotes.map((q) => q.supplierId));
  const add = () => {
    const s = list.find((x) => !used.has(x.id));
    if (s) setQuotes((qs) => [...qs, { supplierId: s.id, prices: pr.lines.map(() => 0), leadDays: 7, validUntil: addDays(TODAY, 30) }]);
  };
  const ok = quotes.every((q) => q.prices.every((p) => p > 0));
  // cells the AI filled: "supplierId:line"
  const [aiCells, setAiCells] = useState<Set<string>>(new Set());
  return (
    <Modal
      open
      onClose={onClose}
      width={1000}
      title={`ใบเสนอราคา ${pr.rfq?.id ?? "(ใหม่)"} · ${pr.id}`}
      footer={
        <>
          <span className="mr-auto flex flex-wrap items-center gap-3 text-[13px] text-ink-3">
            <QuoteAi
              pr={pr}
              quotes={quotes}
              onApply={(q, lines) => {
                setQuotes((qs) => (qs.some((x) => x.supplierId === q.supplierId) ? qs.map((x) => (x.supplierId === q.supplierId ? q : x)) : [...qs, q]));
                setAiCells((c) => new Set([...[...c].filter((k) => !k.startsWith(q.supplierId + ":")), ...lines.map((i) => `${q.supplierId}:${i}`)]));
              }}
            />
            เปรียบเทียบได้สูงสุด 3 ราย ราคาต่อหน่วยไม่รวม VAT
          </span>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn
            primary
            disabled={!ok || !quotes.length}
            onClick={() => {
              saveQuotes(pr.id, quotes);
              onClose();
            }}
          >
            บันทึกใบเสนอราคา
          </Btn>
        </>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-[13px]">
          <thead>
            <tr className="align-bottom">
              <th className="py-2 pr-3 font-normal text-ink-3">รายการ</th>
              {quotes.map((q, i) => (
                <th key={i} className="w-[230px] py-2 pr-3 font-normal">
                  <div className="flex items-center gap-1">
                    <select value={q.supplierId} onChange={(e) => setQ(i, { supplierId: e.target.value })} className={cx(inputCls, "w-full")} aria-label={`ผู้ขายรายที่ ${i + 1}`}>
                      {list
                        .filter((s) => s.id === q.supplierId || !used.has(s.id))
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                    </select>
                    <IconBtn label="ลบผู้เสนอราคา" danger onClick={() => setQuotes((qs) => qs.filter((_, j) => j !== i))}>
                      <Trash2 {...I} />
                    </IconBtn>
                  </div>
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                    <label className="text-[12px] text-ink-3">
                      ส่งใน (วัน)
                      <input type="number" min={0} value={q.leadDays} onChange={(e) => setQ(i, { leadDays: Number(e.target.value) })} className={cx(inputCls, "mt-0.5 h-8 w-full font-mono")} />
                    </label>
                    <label className="text-[12px] text-ink-3">
                      ยืนราคาถึง
                      <input type="date" value={q.validUntil} onChange={(e) => setQ(i, { validUntil: e.target.value })} className={cx(inputCls, "mt-0.5 h-8 w-full px-2 font-mono text-[12px]")} />
                    </label>
                  </div>
                </th>
              ))}
              {quotes.length < 3 && (
                <th className="py-2 font-normal">
                  <Btn small onClick={add}>
                    <Plus {...I} />
                    เพิ่มผู้เสนอราคา
                  </Btn>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {pr.lines.map((l, li) => (
              <tr key={li} className="border-t border-line">
                <td className="py-2 pr-3">
                  {l.description}
                  <span className="block text-[12px] text-ink-3">
                    {l.qty.toLocaleString("th-TH")} {l.unit}
                  </span>
                </td>
                {quotes.map((q, qi) => (
                  <td key={qi} className="relative py-2 pr-3">
                    {aiCells.has(`${q.supplierId}:${li}`) && (
                      <span className="pointer-events-none absolute left-1 top-1/2 -translate-y-1/2">
                        <AiPill />
                      </span>
                    )}
                    <input
                      type="number"
                      min={0}
                      value={q.prices[li] || ""}
                      onChange={(e) => setQ(qi, { prices: q.prices.map((p, k) => (k === li ? Number(e.target.value) : p)) })}
                      className={cx(inputCls, "w-full text-right font-mono")}
                      aria-label="ราคาต่อหน่วย"
                    />
                  </td>
                ))}
              </tr>
            ))}
            <tr className="border-t border-line">
              <td className="py-2 pr-3 font-medium">รวมก่อน VAT</td>
              {quotes.map((q, qi) => (
                <td key={qi} className="num py-2 pr-3 text-right font-mono">
                  {fmt(quoteTotal(pr, q))}
                </td>
              ))}
            </tr>
            <tr>
              <td className="py-2 pr-3 text-ink-3">หมายเหตุ</td>
              {quotes.map((q, qi) => (
                <td key={qi} className="py-2 pr-3">
                  <input value={q.note ?? ""} onChange={(e) => setQ(qi, { note: e.target.value || undefined })} className={cx(inputCls, "w-full")} />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      {!quotes.length && <Empty>เพิ่มใบเสนอราคาจากผู้ขายอย่างน้อย 1 ราย</Empty>}
    </Modal>
  );
}

// =====================================================================
// PO
// =====================================================================

function PODoc({ po }: { po: PurchaseOrder }) {
  const perms = useProcPerms();
  const sups = suppliers.use();
  const grsAll = goodsReceipts.use();
  const bills = supplierBills.use();
  const [receiving, setReceiving] = useState(false);
  const [billFor, setBillFor] = useState<GoodsReceipt | null>(null);
  const s = sups.find((x) => x.id === po.supplierId);
  const t = poTotals(po);
  const grs = grsAll.filter((g) => g.poId === po.id).sort((a, b) => a.date.localeCompare(b.date));
  const got = receivedByLine(po, grs);
  const myBills = bills.filter((b) => b.poId === po.id);
  const site = siteText(po.projectId);
  const p = po.projectId ? getProject(po.projectId) : undefined;
  const mayApprove = perms.approve && canApproveAmount(perms.me.role, t.total);
  const show = perms.money;

  return (
    <>
      <PrintStyle />
      <Toolbar>
        {po.prId && (
          <Link href={`/purchasing/${po.prId}`} className="font-mono text-[13px] text-ink-2 hover:text-ink">
            จาก {po.prId}
          </Link>
        )}
      </Toolbar>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Paper>
          <DocHeader
            title={po.kind === "service" ? "ใบสั่งจ้าง" : "ใบสั่งซื้อ"}
            titleEn={po.kind === "service" ? "Service Order" : "Purchase Order"}
            code={po.id}
            meta={
              <>
                <p>วันที่ {thDate(po.date)}</p>
                {po.prId && <p>อ้างอิง {po.prId}</p>}
                <p className="ops-noprint mt-1">
                  <POStatusPill s={po.status} />
                </p>
              </>
            }
          />
          <div className="mt-5 grid grid-cols-2 gap-6 text-[13px]">
            <div className="avoid-break rounded-[8px] border border-line px-4 py-3">
              <p className="text-[12px] text-ink-3">ผู้ขาย</p>
              <p className="mt-1 font-medium">{s?.name ?? po.supplierId}</p>
              <p className="text-ink-2">{s?.address}</p>
              <p className="mt-1 text-ink-2">
                เลขผู้เสียภาษี <span className="font-mono">{s?.taxId}</span> · {s?.branch}
              </p>
              <p className="text-ink-2">
                ติดต่อ {s?.contact} · <span className="font-mono">{s?.phone}</span>
              </p>
            </div>
            <div className="avoid-break rounded-[8px] border border-line px-4 py-3">
              <p className="text-[12px] text-ink-3">สถานที่ส่งของ</p>
              <p className="mt-1 font-medium">{site.name}</p>
              <p className="text-ink-2">{site.address}</p>
              <p className="mt-1 text-ink-2">กำหนดส่ง {thDate(po.deliveryDate)}</p>
              <p className="text-ink-2">{p ? `ผู้รับ ${p.pm} / โฟร์แมนหน้างาน` : "ผู้รับ เจ้าหน้าที่คลัง"}</p>
            </div>
          </div>
          <DocSection n={1} title="รายการสั่งซื้อ" en="Order lines">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-ink text-ink-3">
                  <th className="w-8 py-1.5 font-normal">#</th>
                  <th className="py-1.5 font-normal">รายการ</th>
                  <th className="py-1.5 pr-3 text-right font-normal">จำนวน</th>
                  <th className="py-1.5 pr-3 font-normal">หน่วย</th>
                  <th className="py-1.5 pr-3 text-right font-normal">ราคา/หน่วย</th>
                  <th className="py-1.5 text-right font-normal">จำนวนเงิน</th>
                </tr>
              </thead>
              <tbody>
                {po.lines.map((l, i) => (
                  <tr key={i} className="border-b border-line">
                    <td className="py-1.5 font-mono text-ink-3">{i + 1}</td>
                    <td className="py-1.5">
                      {l.description}
                      {l.itemId && <span className="ml-2 font-mono text-[11px] text-ink-3">{l.itemId}</span>}
                    </td>
                    <td className="num py-1.5 pr-3 text-right font-mono">{l.qty.toLocaleString("th-TH")}</td>
                    <td className="py-1.5 pr-3">{l.unit}</td>
                    <td className="py-1.5 pr-3 text-right">
                      <Amt n={l.unitPrice} show={show} />
                    </td>
                    <td className="py-1.5 text-right">
                      <Amt n={l.qty * l.unitPrice} show={show} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="avoid-break ml-auto mt-3 w-[300px] text-[13px]">
              <TotalRow k="รวมเป็นเงิน" v={t.subtotal} show={show} />
              <TotalRow k={`ภาษีมูลค่าเพิ่ม ${po.vatRate}%`} v={t.vat} show={show} />
              <TotalRow k="รวมทั้งสิ้น" v={t.total} show={show} strong />
              {po.whtRate > 0 && (
                <>
                  <TotalRow k={`หัก ณ ที่จ่าย ${po.whtRate}% (เมื่อชำระ)`} v={-t.wht} show={show} />
                  <TotalRow k="ยอดชำระสุทธิ" v={t.payable} show={show} />
                </>
              )}
            </div>
          </DocSection>
          <DocSection n={2} title="เงื่อนไข" en="Terms">
            <ul className="list-disc pl-5 text-[13px] leading-6 text-ink-2">
              <li>
                เครดิต {po.paymentTerms} วันนับจากวันที่รับใบแจ้งหนี้/ใบกำกับภาษี{po.vatRate === 0 ? " (ผู้ขายไม่ได้จดทะเบียนภาษีมูลค่าเพิ่ม)" : ""}
              </li>
              <li>ส่งของภายในวันที่ {thDate(po.deliveryDate)} ณ สถานที่ส่งของข้างต้น ส่งบางส่วนได้ โปรดแนบสำเนาใบสั่งซื้อกับใบส่งของทุกครั้ง</li>
              <li>สินค้าต้องตรงตามรายการและมาตรฐาน มอก. ที่เกี่ยวข้อง บริษัทฯ สงวนสิทธิ์คืนสินค้าที่ไม่ผ่านการตรวจรับ</li>
              {po.note && <li>{po.note}</li>}
            </ul>
          </DocSection>
          <Signatures roles={[{ role: "ผู้จัดทำ", name: po.requestedBy }, { role: "ผู้อนุมัติ", name: po.approvedBy }, { role: "ผู้ขายยืนยันรับคำสั่งซื้อ" }]} />
        </Paper>

        <div className="ops-noprint flex flex-col gap-4">
          <Section title="การอนุมัติ">
            <div className="px-5 py-4 text-[14px]">
              <div className="flex items-center justify-between">
                <POStatusPill s={po.status} />
                <span className="text-[13px] text-ink-3">{t.total > APPROVAL_LIMIT ? `เกินวงเงิน ฿${APPROVAL_LIMIT.toLocaleString("th-TH")} · ผู้บริหารอนุมัติ` : "อยู่ในวงเงินจัดซื้อ"}</span>
              </div>
              {po.approvedBy && (
                <p className="mt-3 text-[13px] text-ink-2">
                  อนุมัติโดย {po.approvedBy} · {po.approvedDate ? thDate(po.approvedDate) : ""}
                </p>
              )}
              {po.status === "pending" &&
                (mayApprove ? (
                  <div className="mt-3 flex gap-2">
                    <Btn primary onClick={() => approvePO(po.id, perms.me)}>
                      <Check {...I} />
                      อนุมัติใบสั่งซื้อ
                    </Btn>
                    <Btn
                      danger
                      onClick={() => {
                        const why = window.prompt("เหตุผลที่ไม่อนุมัติ");
                        if (why !== null) setPOStatus(po.id, "rejected", why);
                      }}
                    >
                      ไม่อนุมัติ
                    </Btn>
                  </div>
                ) : (
                  <p className="mt-3 text-[13px] text-ink-3">{perms.approve ? "ยอดเกินวงเงินที่บทบาทของคุณอนุมัติได้ รอผู้บริหาร" : "รอผู้มีสิทธิ์อนุมัติ (จัดซื้อ/ผู้บริหาร)"}</p>
                ))}
              {po.status === "approved" && grs.length === 0 && perms.edit && (
                <div className="mt-3">
                  <Btn
                    small
                    danger
                    onClick={() => {
                      if (window.confirm(`ยกเลิกใบสั่งซื้อ ${po.id}`)) setPOStatus(po.id, "cancelled");
                    }}
                  >
                    ยกเลิกใบสั่งซื้อ
                  </Btn>
                </div>
              )}
            </div>
          </Section>

          <Section
            title={po.kind === "service" ? "ตรวจรับงาน" : "รับสินค้า"}
            meta={`${grs.length} ครั้ง`}
            action={
              isOpenPO(po) && perms.request ? (
                <Btn small primary onClick={() => setReceiving(true)}>
                  <PackageCheck {...I} />
                  บันทึกรับ
                </Btn>
              ) : undefined
            }
          >
            <div className="px-5 py-3">
              {po.lines.map((l, i) => (
                <div key={i} className="py-1.5 text-[13px]">
                  <div className="flex justify-between gap-3">
                    <span className="truncate">{l.description}</span>
                    <span className="num shrink-0 font-mono text-ink-2">
                      {got[i].toLocaleString("th-TH")}/{l.qty.toLocaleString("th-TH")} {l.unit}
                    </span>
                  </div>
                  <div className="mt-1 h-1 rounded-full bg-raised">
                    <div className={cx("h-full rounded-full", got[i] >= l.qty ? "bg-pos" : "bg-ink")} style={{ width: `${Math.min(100, (got[i] / Math.max(1, l.qty)) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
            {grs.map((g) => {
              const bill = billOfGR(bills, g.id);
              const late = g.date > po.deliveryDate;
              return (
                <div key={g.id} className="border-t border-line px-5 py-3 text-[13px]">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[12px] text-ink-2">{g.id}</span>
                    <span className={cx("text-[12px]", late ? "text-neg" : "text-ink-3")}>
                      {thDate(g.date)}
                      {late ? " · ช้ากว่ากำหนด" : ""}
                    </span>
                  </div>
                  <p className="mt-1 text-ink-2">
                    ผู้รับ {g.receiver}
                    {g.quality ? ` · คุณภาพ ${g.quality}/5` : ""}
                  </p>
                  <p className="text-[12px] text-ink-3">{g.lines.map((x) => `${po.lines[x.line]?.description} ${x.qty.toLocaleString("th-TH")}`).join(" · ")}</p>
                  {g.note && <p className="text-[12px] text-ink-3">{g.note}</p>}
                  <div className="mt-2 flex gap-1.5">
                    {Array.from({ length: g.photos }, (_, k) => (
                      <span key={k} className="flex size-10 items-center justify-center rounded-[6px] border border-line bg-raised/60 text-ink-3" title="รูปถ่ายการรับของ">
                        <Camera size={14} strokeWidth={1.5} />
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    {bill ? (
                      <span className="flex items-center gap-2">
                        <Pill tone={BILL_TONE[bill.status]}>
                          {bill.id} · {BILL_LABEL[bill.status]}
                        </Pill>
                      </span>
                    ) : (
                      <Pill tone="warn">รอวางบิล</Pill>
                    )}
                    {!bill && perms.edit && (
                      <Btn small onClick={() => setBillFor(g)}>
                        <FileText {...I} />
                        บันทึกใบแจ้งหนี้
                      </Btn>
                    )}
                    {bill?.status === "open" && perms.approve && (
                      <Btn small onClick={() => approveBill(bill.id, perms.me.name)}>
                        <Check {...I} />
                        อนุมัติจ่าย
                      </Btn>
                    )}
                  </div>
                </div>
              );
            })}
          </Section>

          {myBills.length > 0 && (
            <Section title="ใบแจ้งหนี้" meta={`${myBills.length} ใบ`}>
              <div className="px-5 py-2">
                {myBills.map((b) => {
                  const bt = billTotals(b);
                  return (
                    <div key={b.id} className="flex items-start justify-between gap-3 border-b border-line py-2 text-[13px] last:border-b-0">
                      <div>
                        <span className="font-mono text-[12px]">{b.id}</span>
                        <span className="block text-[12px] text-ink-3">
                          {thDate(b.date)} · ครบกำหนด {thDate(b.dueDate)}
                          {asProcBill(b).invoiceNo ? ` · ${asProcBill(b).invoiceNo}` : ""}
                        </span>
                      </div>
                      <div className="text-right">
                        <Amt n={bt.total} show={show} />
                        <span className="block">
                          <Pill tone={BILL_TONE[b.status]}>{BILL_LABEL[b.status]}</Pill>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {po.projectId && (
            <Section title="ต้นทุนโครงการ">
              <div className="px-5 py-3 text-[13px] text-ink-2">
                <KV k="รหัสต้นทุน">
                  {po.costCode} · {COST_CODES[po.costCode]}
                </KV>
                <p className="mt-2 text-[12px] text-ink-3">{po.kind === "goods" ? "บันทึกต้นทุนเข้าโครงการเมื่อรับของที่หน้างาน" : "บันทึกต้นทุนเมื่ออนุมัติใบแจ้งหนี้"}</p>
                <Link href={`/costs/${po.projectId}`} className="mt-2 inline-block text-accent-text hover:underline">
                  ดูต้นทุน {po.projectId}
                </Link>
              </div>
            </Section>
          )}
        </div>
      </div>

      {receiving && <ReceiveForm po={po} got={got} onClose={() => setReceiving(false)} />}
      {billFor && s && <BillForm gr={billFor} po={po} s={s} onClose={() => setBillFor(null)} />}
    </>
  );
}

function TotalRow({ k, v, show, strong }: { k: string; v: number; show: boolean; strong?: boolean }) {
  return (
    <div className={cx("flex justify-between border-b border-line py-1", strong && "border-ink font-medium")}>
      <span className={strong ? "" : "text-ink-2"}>{k}</span>
      <Amt n={v} show={show} zero="0.00" />
    </div>
  );
}

function ReceiveForm({ po, got, onClose }: { po: PurchaseOrder; got: number[]; onClose: () => void }) {
  const { me } = useProcPerms();
  const remain = po.lines.map((l, i) => Math.max(0, l.qty - got[i]));
  const [qty, setQty] = useState<number[]>(remain);
  const [date, setDate] = useState(TODAY);
  const [receiver, setReceiver] = useState(me.name);
  const [quality, setQuality] = useState(4);
  const [photos, setPhotos] = useState(0);
  const [note, setNote] = useState("");
  const [ai, setAi] = useState<(AiResult & { qty: number[] }) | null>(null);
  const [docs, setDocs] = useState<MediaRef[]>([]);
  const ok = qty.some((q) => q > 0) && qty.every((q, i) => q >= 0 && q <= remain[i]) && receiver.trim();
  return (
    <Modal
      open
      onClose={onClose}
      width={720}
      title={`${po.kind === "service" ? "ตรวจรับงาน" : "รับสินค้า"} · ${po.id}`}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn
            primary
            disabled={!ok}
            onClick={() => {
              const gr = receivePO(po.id, { date, receiver: receiver.trim(), qty, photos: photos + docs.length, quality, note: note || undefined });
              if (gr && docs.length) goodsReceipts.upsert({ ...gr, docs } as GoodsReceipt & { docs: MediaRef[] });
              onClose();
            }}
          >
            บันทึกการรับ
          </Btn>
        </>
      }
    >
      {po.kind === "goods" && (
        <div className="mb-3 flex justify-end">
          <DeliveryNoteAi
            po={po}
            remain={remain}
            onApply={(r) => {
              setAi(r);
              setQty(r.qty);
              setDocs(r.refs);
              if (r.date && r.date <= TODAY) setDate(r.date);
              if (r.docNo) setNote((n) => n || `ใบส่งของเลขที่ ${r.docNo}`);
            }}
          />
        </div>
      )}
      {ai && (
        <AiBanner confidence={ai.confidence} refs={docs} note={ai.note}>
          <IssueList issues={ai.issues} />
        </AiBanner>
      )}
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="text-ink-3">
            <th className="py-2 font-normal">รายการ</th>
            <th className="py-2 pr-3 text-right font-normal">สั่ง</th>
            <th className="py-2 pr-3 text-right font-normal">รับแล้ว</th>
            <th className="w-[130px] py-2 text-right font-normal">รับครั้งนี้</th>
          </tr>
        </thead>
        <tbody>
          {po.lines.map((l, i) => (
            <tr key={i} className="border-t border-line">
              <td className="py-2">
                {l.description}
                <span className="block text-[12px] text-ink-3">{l.unit}</span>
              </td>
              <td className="num py-2 pr-3 text-right font-mono">{l.qty.toLocaleString("th-TH")}</td>
              <td className="num py-2 pr-3 text-right font-mono text-ink-3">{got[i].toLocaleString("th-TH")}</td>
              <td className="relative py-2">
                {ai && ai.qty[i] === qty[i] && qty[i] > 0 && (
                  <span className="pointer-events-none absolute left-1 top-1/2 -translate-y-1/2">
                    <AiPill />
                  </span>
                )}
                <input
                  type="number"
                  min={0}
                  max={remain[i]}
                  value={qty[i]}
                  disabled={remain[i] === 0}
                  onChange={(e) => setQty((q) => q.map((x, j) => (j === i ? Number(e.target.value) : x)))}
                  className={cx(inputCls, "w-full text-right font-mono", qty[i] > remain[i] && "border-neg")}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 grid grid-cols-3 gap-4">
        <Field label="วันที่รับ">
          <input type="date" value={date} max={TODAY} onChange={(e) => setDate(e.target.value)} className={cx(inputCls, "font-mono")} />
        </Field>
        <Field label="ผู้รับของ">
          <input value={receiver} onChange={(e) => setReceiver(e.target.value)} className={inputCls} />
        </Field>
        <Field label="คุณภาพสินค้า">
          <select value={quality} onChange={(e) => setQuality(Number(e.target.value))} className={inputCls}>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {n} · {["", "ไม่ผ่าน", "ต่ำกว่ามาตรฐาน", "พอใช้", "ดี", "ดีมาก"][n]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="mt-4">
        <p className="mb-1.5 text-[13px] text-ink-2">รูปถ่ายใบส่งของ / สินค้า</p>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: photos }, (_, k) => (
            <span key={k} className="flex size-14 items-center justify-center rounded-[8px] border border-line bg-raised/60 text-ink-3">
              <Camera {...I} />
            </span>
          ))}
          <button type="button" onClick={() => setPhotos((n) => Math.min(6, n + 1))} className="flex size-14 items-center justify-center rounded-[8px] border border-dashed border-line-strong text-ink-3 hover:text-ink" aria-label="แนบรูป">
            <Plus {...I} />
          </button>
        </div>
      </div>
      <div className="mt-4">
        <Field label="หมายเหตุ">
          <input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} placeholder="เช่น ส่งบางส่วน ที่เหลือส่งสัปดาห์หน้า" />
        </Field>
      </div>
    </Modal>
  );
}

function BillForm({ gr, po, s, onClose }: { gr: GoodsReceipt; po: PurchaseOrder; s: Supplier; onClose: () => void }) {
  const [date, setDate] = useState(TODAY < gr.date ? gr.date : TODAY);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [ai, setAi] = useState<(AiResult & { invoiceNo: string; date: string }) | null>(null);
  const subtotal = gr.lines.reduce((t, x) => t + x.qty * po.lines[x.line].unitPrice, 0);
  const vat = (subtotal * po.vatRate) / 100;
  return (
    <Modal
      open
      onClose={onClose}
      width={520}
      title={`บันทึกใบแจ้งหนี้ · ${gr.id}`}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn
            primary
            onClick={() => {
              const bill = createBillFromGR(gr.id, { date, invoiceNo: invoiceNo || undefined });
              if (bill && ai) supplierBills.upsert({ ...bill, docs: ai.refs, aiRead: { at: TODAY, confidence: ai.confidence } } as typeof bill);
              onClose();
            }}
          >
            บันทึก
          </Btn>
        </>
      }
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[14px]">{s.name}</p>
        <GrInvoiceAi
          po={po}
          gr={gr}
          onApply={(r) => {
            setAi(r);
            if (r.invoiceNo) setInvoiceNo(r.invoiceNo);
            if (r.date && r.date >= gr.date && r.date <= TODAY) setDate(r.date);
          }}
        />
      </div>
      {ai && (
        <div className="mt-3">
          <AiBanner confidence={ai.confidence} refs={ai.refs} note={ai.note}>
            {ai.issues.length ? <IssueList issues={ai.issues} /> : <p className="text-pos">รายการและยอดเงินตรงกับที่รับสินค้า</p>}
          </AiBanner>
        </div>
      )}
      <div className="mt-3 grid grid-cols-2 gap-4">
        <Field label="วันที่ใบแจ้งหนี้">
          <input type="date" value={date} min={gr.date} max={TODAY} onChange={(e) => setDate(e.target.value)} className={cx(inputCls, "font-mono")} />
        </Field>
        <Field label="เลขที่ใบกำกับ/ใบแจ้งหนี้">
          <input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} className={cx(inputCls, "font-mono")} />
        </Field>
      </div>
      <div className="mt-4 text-[13px]">
        <KV k="ก่อน VAT">{fmt(subtotal)}</KV>
        <KV k={`VAT ${po.vatRate || 0}%`}>{fmt(vat)}</KV>
        <KV k="รวม">{fmt(subtotal + vat)}</KV>
        <KV k="หัก ณ ที่จ่าย">
          {po.whtRate}% · {fmt((subtotal * po.whtRate) / 100)}
        </KV>
        <KV k="ครบกำหนด">{thDate(addDays(date, po.paymentTerms))}</KV>
      </div>
      <p className="mt-3 text-[12px] text-ink-3">ใบแจ้งหนี้จะส่งให้ฝ่ายบัญชีตั้งเจ้าหนี้หลังอนุมัติจ่าย {VAT_RATE === po.vatRate ? "" : "· ผู้ขายไม่จด VAT"}</p>
    </Modal>
  );
}
