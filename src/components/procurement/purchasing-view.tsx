"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Check, FilePlus2, Plus, Search, X } from "lucide-react";
import { Card, cx, inputCls } from "@/components/ui";
import { Btn, Empty, FilterField, I, Pill, Select } from "@/components/ops/bits";
import { COST_CODES } from "@/lib/biz";
import { getProject, thDate, TODAY } from "@/lib/data";
import {
  addDays as add,
  approveBill,
  asProcBill,
  billOfGR,
  billTotals,
  goodsReceipts,
  PO_STATUS_LABEL,
  poTotals,
  PR_STATUS_LABEL,
  purchaseOrders,
  purchaseRequests,
  quoteTotal,
  receivedValue,
  supplierBills,
  suppliers,
} from "@/lib/procurement";
import { Amt, BILL_LABEL, BILL_TONE, DocLink, POStatusPill, PRStatusPill, td, th, useProcPerms, useProjects } from "./bits";
import { ClaimForm, PRForm } from "./forms";

type Tab = "pr" | "po" | "gr" | "bill";
const TABS: { key: Tab; label: string }[] = [
  { key: "pr", label: "ใบขอซื้อ (PR)" },
  { key: "po", label: "ใบสั่งซื้อ (PO)" },
  { key: "gr", label: "รับสินค้า" },
  { key: "bill", label: "ใบแจ้งหนี้" },
];

type Stage = { key: string; label: string; tab: Tab; status: string; count: number; tone?: "warn" | "neg" };

export function PurchasingView() {
  const sp = useSearchParams();
  return <Inner key={sp.toString()} initTab={(sp.get("tab") as Tab) || "po"} initProject={sp.get("project") ?? ""} openNew={sp.has("new")} />;
}

function Inner({ initTab, initProject, openNew }: { initTab: Tab; initProject: string; openNew: boolean }) {
  const router = useRouter();
  const perms = useProcPerms();
  const projectsAll = useProjects();
  const prs = purchaseRequests.use();
  const pos = purchaseOrders.use();
  const grs = goodsReceipts.use();
  const bills = supplierBills.use();
  const sups = suppliers.use();
  const supName = (id: string) => sups.find((s) => s.id === id)?.name ?? id;

  const [tab, setTab] = useState<Tab>(initTab);
  const [q, setQ] = useState("");
  const [project, setProject] = useState(initProject);
  const [supplier, setSupplier] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [prOpen, setPrOpen] = useState(openNew);
  const [claimOpen, setClaimOpen] = useState(false);

  const unbilled = useMemo(() => grs.filter((g) => !billOfGR(bills, g.id)), [grs, bills]);
  const stages: Stage[] = [
    { key: "prs", label: "ใบขอซื้อรอจัดซื้อ", tab: "pr", status: "submitted", count: prs.filter((p) => p.status === "submitted").length },
    { key: "rfq", label: "เปรียบเทียบราคา", tab: "pr", status: "rfq", count: prs.filter((p) => p.status === "rfq").length },
    { key: "pend", label: "PO รออนุมัติ", tab: "po", status: "pending", count: pos.filter((p) => p.status === "pending").length, tone: "warn" },
    { key: "appr", label: "รอรับของ", tab: "po", status: "approved", count: pos.filter((p) => p.status === "approved").length },
    { key: "part", label: "รับบางส่วน", tab: "po", status: "partial", count: pos.filter((p) => p.status === "partial").length },
    { key: "unb", label: "รับแล้วรอวางบิล", tab: "gr", status: "unbilled", count: unbilled.length },
    { key: "open", label: "บิลรออนุมัติจ่าย", tab: "bill", status: "open", count: bills.filter((b) => b.status === "open").length, tone: "warn" },
    { key: "due", label: "เลยกำหนดชำระ", tab: "bill", status: "overdue", count: bills.filter((b) => b.status !== "paid" && b.dueDate < TODAY).length, tone: "neg" },
  ];

  const inRange = (d: string) => (!from || d >= from) && (!to || d <= to);
  const needle = q.trim().toLowerCase();

  const prRows = useMemo(
    () =>
      prs
        .filter((p) => !project || (project === "WH" ? !p.projectId : p.projectId === project))
        .filter((p) => !status || p.status === status)
        .filter((p) => !supplier || p.rfq?.quotes.some((x) => x.supplierId === supplier))
        .filter((p) => inRange(p.date))
        .filter((p) => !needle || `${p.id} ${p.rfq?.id ?? ""} ${p.projectId ?? ""} ${p.requestedBy} ${p.lines.map((l) => l.description).join(" ")}`.toLowerCase().includes(needle))
        .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prs, project, status, supplier, from, to, needle],
  );
  const poRows = useMemo(
    () =>
      pos
        .filter((p) => !project || (project === "WH" ? !p.projectId : p.projectId === project))
        .filter((p) => !status || p.status === status)
        .filter((p) => !supplier || p.supplierId === supplier)
        .filter((p) => inRange(p.date))
        .filter((p) => !needle || `${p.id} ${p.prId ?? ""} ${p.projectId ?? ""} ${supName(p.supplierId)} ${p.lines.map((l) => l.description).join(" ")}`.toLowerCase().includes(needle))
        .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pos, project, status, supplier, from, to, needle, sups],
  );
  const grRows = useMemo(
    () =>
      grs
        .filter((g) => !project || (project === "WH" ? !g.projectId : g.projectId === project))
        .filter((g) => status !== "unbilled" || !billOfGR(bills, g.id))
        .filter((g) => !supplier || pos.find((p) => p.id === g.poId)?.supplierId === supplier)
        .filter((g) => inRange(g.date))
        .filter((g) => !needle || `${g.id} ${g.poId} ${g.receiver} ${g.projectId ?? ""}`.toLowerCase().includes(needle))
        .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [grs, bills, pos, project, status, supplier, from, to, needle],
  );
  const billRows = useMemo(
    () =>
      bills
        .filter((b) => !project || (project === "WH" ? !b.projectId : b.projectId === project))
        .filter((b) => !status || (status === "overdue" ? b.status !== "paid" && b.dueDate < TODAY : status === "claim" ? !b.poId : b.status === status))
        .filter((b) => !supplier || b.supplierId === supplier)
        .filter((b) => inRange(b.date))
        .filter((b) => !needle || `${b.id} ${b.poId ?? ""} ${b.supplierName} ${asProcBill(b).invoiceNo ?? ""} ${b.projectId ?? ""}`.toLowerCase().includes(needle))
        .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bills, project, status, supplier, from, to, needle],
  );

  const STATUS_OPTIONS: Record<Tab, [string, string][]> = {
    pr: Object.entries(PR_STATUS_LABEL),
    po: Object.entries(PO_STATUS_LABEL),
    gr: [["unbilled", "ยังไม่วางบิล"]],
    bill: [...Object.entries(BILL_LABEL), ["overdue", "เลยกำหนดชำระ"], ["claim", "งวดงานผู้รับเหมา (ไม่มี PO)"]],
  };
  const count = { pr: prRows.length, po: poRows.length, gr: grRows.length, bill: billRows.length }[tab];
  const filtered = q || project || supplier || status || from || to;
  const clear = () => (setQ(""), setProject(""), setSupplier(""), setStatus(""), setFrom(""), setTo(""));

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
        <div>
          <p className="mb-1 text-[13px] text-ink-3">จัดซื้อ/คลัง</p>
          <h1 className="text-[30px] font-normal leading-[1.15]">จัดซื้อ</h1>
          <p className="mt-2 max-w-[48rem] text-ink-2">ใบขอซื้อจากหน้างาน เปรียบเทียบราคา ใบสั่งซื้อพร้อมอนุมัติตามวงเงิน รับสินค้าที่ไซต์ และใบแจ้งหนี้ที่ส่งต่อให้บัญชี</p>
        </div>
        <div className="flex items-center gap-2">
          {perms.edit && (
            <Btn onClick={() => setClaimOpen(true)}>
              <FilePlus2 {...I} />
              งวดงานผู้รับเหมา
            </Btn>
          )}
          {perms.request && (
            <Btn primary onClick={() => setPrOpen(true)}>
              <Plus {...I} />
              สร้างใบขอซื้อ
            </Btn>
          )}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
        {stages.map((s, i) => {
          const active = tab === s.tab && status === s.status;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => {
                setTab(s.tab);
                setStatus(active ? "" : s.status);
              }}
              aria-pressed={active}
              className={cx("relative rounded-[12px] border bg-card px-3.5 py-3 text-left transition-colors duration-150 hover:border-line-strong", active ? "border-ink-3" : "border-line")}
            >
              <span className="flex items-center justify-between text-[12px] text-ink-3">
                <span className="font-mono">{i + 1}</span>
                {i < stages.length - 1 && <ArrowRight size={12} strokeWidth={1.5} />}
              </span>
              <span className={cx("num mt-1 block text-[24px] font-medium leading-none", s.tone === "neg" && s.count > 0 && "text-neg", s.tone === "warn" && s.count > 0 && "text-warn")}>{s.count}</span>
              <span className="mt-1 block text-[12px] leading-tight text-ink-2">{s.label}</span>
            </button>
          );
        })}
      </div>

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-0.5 border-b border-line px-3 py-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setTab(t.key);
                setStatus("");
              }}
              className={cx("flex h-8 items-center gap-2 rounded-[8px] px-3 text-[13px] transition-colors duration-150", tab === t.key ? "bg-raised text-ink" : "text-ink-2 hover:text-ink")}
            >
              {t.label}
              <span className="num font-mono text-[11px] text-ink-3">{{ pr: prs.length, po: pos.length, gr: grs.length, bill: bills.length }[t.key]}</span>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 px-4 py-3 lg:grid-cols-7">
          <FilterField label="ค้นหา" className="col-span-2">
            <div className="relative">
              <Search {...I} className="pointer-events-none absolute left-2.5 top-2.5 text-ink-3" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="เลขที่เอกสาร รายการ ผู้ขาย" className={cx(inputCls, "w-full pl-8")} />
            </div>
          </FilterField>
          <FilterField label="โครงการ">
            <Select label="โครงการ" value={project} onChange={setProject}>
              <option value="">ทุกโครงการ</option>
              <option value="WH">คลังกลาง</option>
              {projectsAll
                .filter((p) => p.status !== "delivered")
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id} · {p.name}
                  </option>
                ))}
            </Select>
          </FilterField>
          <FilterField label="ผู้ขาย">
            <Select label="ผู้ขาย" value={supplier} onChange={setSupplier}>
              <option value="">ทุกราย</option>
              {sups.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="สถานะ">
            <Select label="สถานะ" value={status} onChange={setStatus}>
              <option value="">ทุกสถานะ</option>
              {STATUS_OPTIONS[tab].map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="ตั้งแต่วันที่">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={cx(inputCls, "font-mono")} />
          </FilterField>
          <FilterField label="ถึงวันที่">
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={cx(inputCls, "font-mono")} />
          </FilterField>
        </div>
        <div className="flex items-center gap-3 border-t border-line px-4 py-2 text-[13px] text-ink-3">
          <span className="num font-mono text-[12px]">{count} รายการ</span>
          {filtered && (
            <button type="button" onClick={clear} className="inline-flex items-center gap-1 text-ink-2 hover:text-ink">
              <X {...I} />
              ล้างตัวกรอง
            </button>
          )}
          <span className="ml-auto flex gap-3">
            <button type="button" onClick={() => (setFrom(add(TODAY, -30)), setTo(""))} className="hover:text-ink">
              30 วัน
            </button>
            <button type="button" onClick={() => (setFrom(add(TODAY, -90)), setTo(""))} className="hover:text-ink">
              90 วัน
            </button>
            <button type="button" onClick={() => (setFrom(`${TODAY.slice(0, 4)}-01-01`), setTo(""))} className="hover:text-ink">
              ปีนี้
            </button>
          </span>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          {tab === "pr" && (
            <table className="w-full min-w-[980px] text-left">
              <thead>
                <tr>
                  <th className={cx(th, "px-5")}>ใบขอซื้อ</th>
                  <th className={th}>โครงการ · รหัสต้นทุน</th>
                  <th className={th}>รายการ</th>
                  <th className={th}>ใบเสนอราคา</th>
                  <th className={th}>ต้องการใช้</th>
                  <th className={cx(th, "pr-5")}>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {prRows.map((p) => {
                  const need = p.lines.map((l) => l.neededBy).sort()[0];
                  const best = p.rfq?.quotes.length ? Math.min(...p.rfq.quotes.map((x) => quoteTotal(p, x))) : undefined;
                  return (
                    <tr key={p.id} onClick={() => router.push(`/purchasing/${p.id}`)} className="cursor-pointer border-t border-line transition-colors duration-150 hover:bg-raised/60">
                      <td className={cx(td, "px-5")}>
                        <DocLink id={p.id} />
                        <span className="block text-[12px] text-ink-3">
                          {thDate(p.date)} · {p.requestedBy}
                        </span>
                      </td>
                      <td className={td}>
                        <span className="block max-w-[220px] truncate">{p.projectId ? getProject(p.projectId)?.name ?? p.projectId : "คลังกลาง"}</span>
                        <span className="block text-[12px] text-ink-3">
                          {p.costCode} · {COST_CODES[p.costCode]}
                        </span>
                      </td>
                      <td className={cx(td, "text-[13px]")}>
                        <span className="block max-w-[300px] truncate">{p.lines.map((l) => l.description).join(", ")}</span>
                        <span className="block text-[12px] text-ink-3">{p.lines.length} รายการ</span>
                      </td>
                      <td className={cx(td, "text-[13px]")}>
                        {p.rfq ? (
                          <>
                            <span className="font-mono text-[12px] text-ink-2">{p.rfq.id}</span>
                            <span className="block text-[12px] text-ink-3">
                              {p.rfq.quotes.length} ราย{best !== undefined && perms.money ? ` · ต่ำสุด ${Math.round(best).toLocaleString("th-TH")}` : ""}
                            </span>
                          </>
                        ) : (
                          <span className="text-ink-3">–</span>
                        )}
                      </td>
                      <td className={cx(td, "text-[13px]", need && need < TODAY && p.status !== "ordered" && "text-neg")}>{need ? thDate(need) : "–"}</td>
                      <td className={cx(td, "pr-5")}>
                        <PRStatusPill s={p.status} />
                        {p.poId && (
                          <span className="mt-1 block">
                            <DocLink id={p.poId} />
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {tab === "po" && (
            <table className="w-full min-w-[1040px] text-left">
              <thead>
                <tr>
                  <th className={cx(th, "px-5")}>ใบสั่งซื้อ</th>
                  <th className={th}>ผู้ขาย</th>
                  <th className={th}>ส่งที่ · รหัสต้นทุน</th>
                  <th className={th}>กำหนดส่ง</th>
                  <th className={cx(th, "text-right")}>มูลค่ารวม VAT</th>
                  <th className={cx(th, "text-right")}>รับแล้ว</th>
                  <th className={cx(th, "pr-5")}>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {poRows.map((p) => {
                  const t = poTotals(p);
                  const recv = receivedValue(p, grs);
                  const late = (p.status === "approved" || p.status === "partial") && p.deliveryDate < TODAY;
                  return (
                    <tr key={p.id} onClick={() => router.push(`/purchasing/${p.id}`)} className="cursor-pointer border-t border-line transition-colors duration-150 hover:bg-raised/60">
                      <td className={cx(td, "px-5")}>
                        <DocLink id={p.id} />
                        <span className="block text-[12px] text-ink-3">{thDate(p.date)}</span>
                      </td>
                      <td className={td}>
                        <span className="block max-w-[240px] truncate">{supName(p.supplierId)}</span>
                        <span className="block max-w-[240px] truncate text-[12px] text-ink-3">{p.lines.map((l) => l.description).join(", ")}</span>
                      </td>
                      <td className={td}>
                        <span className="block max-w-[200px] truncate">{p.projectId ? getProject(p.projectId)?.name ?? p.projectId : "คลังกลาง"}</span>
                        <span className="block text-[12px] text-ink-3">
                          {p.costCode} · {COST_CODES[p.costCode]}
                        </span>
                      </td>
                      <td className={cx(td, "text-[13px]", late && "text-neg")}>
                        {thDate(p.deliveryDate)}
                        {late && <span className="block text-[12px]">เลยกำหนด</span>}
                      </td>
                      <td className={cx(td, "text-right text-[13px]")}>
                        <Amt n={t.total} show={perms.money} />
                        {t.total > 200000 && p.status === "pending" && <span className="block text-[12px] text-warn">ต้องผู้บริหารอนุมัติ</span>}
                      </td>
                      <td className={cx(td, "num text-right font-mono text-[13px] text-ink-2")}>{t.subtotal > 0 ? `${Math.round((recv / t.subtotal) * 100)}%` : "–"}</td>
                      <td className={cx(td, "pr-5")}>
                        <POStatusPill s={p.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {tab === "gr" && (
            <table className="w-full min-w-[900px] text-left">
              <thead>
                <tr>
                  <th className={cx(th, "px-5")}>ใบรับสินค้า</th>
                  <th className={th}>ใบสั่งซื้อ · ผู้ขาย</th>
                  <th className={th}>สถานที่รับ</th>
                  <th className={th}>ผู้รับ</th>
                  <th className={cx(th, "text-right")}>มูลค่า</th>
                  <th className={cx(th, "pr-5")}>ใบแจ้งหนี้</th>
                </tr>
              </thead>
              <tbody>
                {grRows.map((g) => {
                  const po = pos.find((p) => p.id === g.poId);
                  const bill = billOfGR(bills, g.id);
                  const val = po ? g.lines.reduce((t, x) => t + x.qty * (po.lines[x.line]?.unitPrice ?? 0), 0) : 0;
                  return (
                    <tr key={g.id} onClick={() => router.push(`/purchasing/${g.poId}`)} className="cursor-pointer border-t border-line transition-colors duration-150 hover:bg-raised/60">
                      <td className={cx(td, "px-5")}>
                        <span className="font-mono text-[12px] text-ink-2">{g.id}</span>
                        <span className="block text-[12px] text-ink-3">{thDate(g.date)}</span>
                      </td>
                      <td className={td}>
                        <DocLink id={g.poId} />
                        <span className="block max-w-[260px] truncate text-[12px] text-ink-3">{po ? supName(po.supplierId) : ""}</span>
                      </td>
                      <td className={cx(td, "text-[13px]")}>{g.projectId ? getProject(g.projectId)?.name ?? g.projectId : "คลังกลาง"}</td>
                      <td className={cx(td, "text-[13px]")}>
                        {g.receiver}
                        <span className="block text-[12px] text-ink-3">{g.lines.length} รายการ · รูป {g.photos}</span>
                      </td>
                      <td className={cx(td, "text-right text-[13px]")}>
                        <Amt n={val} show={perms.money} />
                      </td>
                      <td className={cx(td, "pr-5")}>{bill ? <Pill tone={BILL_TONE[bill.status]}>{bill.id}</Pill> : <Pill tone="warn">รอวางบิล</Pill>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {tab === "bill" && (
            <table className="w-full min-w-[1080px] text-left">
              <thead>
                <tr>
                  <th className={cx(th, "px-5")}>ใบแจ้งหนี้</th>
                  <th className={th}>ผู้ขาย</th>
                  <th className={th}>อ้างอิง</th>
                  <th className={th}>ครบกำหนด</th>
                  <th className={cx(th, "text-right")}>ก่อน VAT</th>
                  <th className={cx(th, "text-right")}>VAT</th>
                  <th className={cx(th, "text-right")}>หัก ณ ที่จ่าย</th>
                  <th className={cx(th, "text-right")}>ยอดจ่ายสุทธิ</th>
                  <th className={cx(th, "pr-5")}>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {billRows.slice(0, 300).map((b) => {
                  const t = billTotals(b);
                  const overdue = b.status !== "paid" && b.dueDate < TODAY;
                  return (
                    <tr key={b.id} className="border-t border-line">
                      <td className={cx(td, "px-5")}>
                        <span className="font-mono text-[12px] text-ink-2">{b.id}</span>
                        <span className="block text-[12px] text-ink-3">
                          {thDate(b.date)}
                          {asProcBill(b).invoiceNo ? ` · ${asProcBill(b).invoiceNo}` : ""}
                        </span>
                      </td>
                      <td className={td}>
                        <Link href={`/suppliers?id=${b.supplierId}`} className="block max-w-[240px] truncate hover:underline">
                          {b.supplierName}
                        </Link>
                        <span className="block max-w-[240px] truncate text-[12px] text-ink-3">{b.lines[0]?.description}</span>
                      </td>
                      <td className={cx(td, "text-[13px]")}>
                        {b.poId ? <DocLink id={b.poId} /> : <span className="text-ink-2">งวดงาน</span>}
                        <span className="block text-[12px] text-ink-3">{b.projectId ?? "คลังกลาง"}</span>
                      </td>
                      <td className={cx(td, "text-[13px]", overdue && "text-neg")}>
                        {thDate(b.dueDate)}
                        {b.paidDate && <span className="block text-[12px] text-ink-3">จ่าย {thDate(b.paidDate)}</span>}
                        {overdue && <span className="block text-[12px]">เลยกำหนด</span>}
                      </td>
                      <td className={cx(td, "text-right text-[13px]")}>
                        <Amt n={b.subtotal} show={perms.money} />
                      </td>
                      <td className={cx(td, "text-right text-[13px]")}>
                        <Amt n={b.vat} show={perms.money} />
                      </td>
                      <td className={cx(td, "text-right text-[13px]")}>
                        {perms.money ? <Amt n={-t.wht} show /> : <Amt n={0} show={false} />}
                        <span className="block text-[12px] text-ink-3">{b.whtRate}%</span>
                      </td>
                      <td className={cx(td, "text-right text-[13px]")}>
                        <Amt n={t.payable} show={perms.money} />
                      </td>
                      <td className={cx(td, "pr-5")}>
                        <Pill tone={BILL_TONE[b.status]}>{BILL_LABEL[b.status]}</Pill>
                        {b.status === "open" && perms.approve && (
                          <span className="mt-1.5 block">
                            <Btn small onClick={() => approveBill(b.id, perms.me.name)}>
                              <Check {...I} />
                              อนุมัติจ่าย
                            </Btn>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        {count === 0 && <Empty>ไม่พบเอกสารตามตัวกรอง</Empty>}
        {tab === "bill" && billRows.length > 300 && <p className="border-t border-line px-5 py-3 text-[13px] text-ink-3">แสดง 300 รายการล่าสุด ใช้ตัวกรองเพื่อดูเพิ่มเติม</p>}
      </Card>

      {prOpen && <PRForm onClose={() => setPrOpen(false)} preset={{ projectId: initProject || undefined }} onSaved={(pr) => router.push(`/purchasing/${pr.id}`)} />}
      {claimOpen && <ClaimForm onClose={() => setClaimOpen(false)} />}
    </>
  );
}
