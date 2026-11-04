"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, X } from "lucide-react";
import { Card, cx, inputCls, PageHeader } from "@/components/ui";
import { Btn, Empty, Pill, StatCard } from "@/components/ops/bits";
import { daysBetween, getHouseModel, thDate, TODAY } from "@/lib/data";
import { canEdit } from "@/lib/permissions";
import { createQuote, QUOTE_STATUS_LABEL, quotes, quoteStatus, quoteTotals, SALES_PEOPLE, validUntil, type QuoteStatus } from "@/lib/sales/crm";
import { I, mb, n0, QUOTE_TONE, Td, Th, theadCls, useCostAccess } from "./common";

export function QuotesView() {
  const router = useRouter();
  const list = quotes.use();
  const { canSeeCost, me } = useCostAccess();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | QuoteStatus>("");
  const [owner, setOwner] = useState("");

  const rows = useMemo(
    () =>
      list
        .map((x) => ({ x, st: quoteStatus(x), t: quoteTotals(x), until: validUntil(x) }))
        .sort((a, b) => b.x.date.localeCompare(a.x.date) || b.x.id.localeCompare(a.x.id)),
    [list],
  );
  const needle = q.trim().toLowerCase();
  const shown = rows
    .filter((r) => !status || r.st === status)
    .filter((r) => !owner || r.x.owner === owner)
    .filter((r) => !needle || [r.x.id, r.x.customer.name, r.x.modelCode, r.x.customer.phone, r.x.projectId ?? ""].some((s) => s.toLowerCase().includes(needle)));

  const open = rows.filter((r) => r.st === "sent" || r.st === "draft");
  const year = TODAY.slice(0, 4);
  const decided = rows.filter((r) => r.x.date.startsWith(year) && (r.st === "approved" || r.st === "lost" || r.st === "expired"));
  const won = decided.filter((r) => r.st === "approved");
  const expiring = rows.filter((r) => r.st === "sent" && daysBetween(TODAY, r.until) <= 7);
  const owners = Array.from(new Set([...SALES_PEOPLE, ...list.map((x) => x.owner)]));

  const add = () => {
    const nq = createQuote({ modelCode: "HM-17", owner: me.name });
    router.push(`/quotes/${nq.id}`);
  };

  return (
    <>
      <PageHeader
        title="ใบเสนอราคา"
        sub={`${list.length} ฉบับ · รอผลอยู่ ${open.length} ฉบับ`}
        actions={
          canEdit(me.role, "sales") && (
            <Btn primary onClick={add}>
              <Plus {...I} />
              สร้างใบเสนอราคา
            </Btn>
          )
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="รอผล (ร่าง/ส่งแล้ว)" value={open.length} unit="ฉบับ" note={`มูลค่า ${mb(open.reduce((s, r) => s + r.t.subtotal, 0))} ก่อน VAT`} onClick={() => setStatus(status === "sent" ? "" : "sent")} active={status === "sent"} />
        <StatCard label={`อนุมัติปี ${Number(year) + 543}`} value={won.length} unit="ฉบับ" note={`มูลค่า ${mb(won.reduce((s, r) => s + r.t.subtotal, 0))}`} onClick={() => setStatus(status === "approved" ? "" : "approved")} active={status === "approved"} />
        <StatCard label="อัตราปิดการขาย" value={decided.length ? `${Math.round((won.length / decided.length) * 100)}%` : "–"} note={`จากใบที่ได้ผลแล้ว ${decided.length} ฉบับ`} />
        <StatCard label="หมดอายุภายใน 7 วัน" value={expiring.length} unit="ฉบับ" note="ควรติดตามหรือออกฉบับแก้ไข" tone={expiring.length ? "neg" : undefined} />
      </div>

      <Card className="mt-4">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <label className="relative min-w-[240px] flex-1">
            <Search {...I} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาเลขที่ ลูกค้า แบบบ้าน" className={cx(inputCls, "w-full pl-9")} aria-label="ค้นหาใบเสนอราคา" />
          </label>
          <select aria-label="สถานะ" className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as QuoteStatus | "")}>
            <option value="">ทุกสถานะ</option>
            {(Object.keys(QUOTE_STATUS_LABEL) as QuoteStatus[]).map((s) => (
              <option key={s} value={s}>
                {QUOTE_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <select aria-label="ผู้ดูแล" className={inputCls} value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="">ทุกผู้ดูแล</option>
            {owners.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
          {(q || status || owner) && (
            <button
              type="button"
              onClick={() => {
                setQ("");
                setStatus("");
                setOwner("");
              }}
              className="inline-flex h-9 items-center gap-1 rounded-[8px] px-2 text-[13px] text-ink-2 hover:bg-raised"
            >
              <X size={14} strokeWidth={1.5} />
              ล้างตัวกรอง
            </button>
          )}
          <span className="ml-auto font-mono text-[12px] text-ink-3">{shown.length} รายการ</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-[13px]">
            <thead>
              <tr className={theadCls}>
                <Th>เลขที่</Th>
                <Th>ลูกค้า</Th>
                <Th>แบบบ้าน</Th>
                <Th right>ก่อน VAT</Th>
                <Th right>รวม VAT</Th>
                {canSeeCost && <Th right>กำไรขั้นต้น</Th>}
                <Th>สถานะ</Th>
                <Th>วันที่ · ใช้ได้ถึง</Th>
                <Th>ผู้ดูแล</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map(({ x, st, t, until }) => (
                <tr key={x.id} onClick={() => router.push(`/quotes/${x.id}`)} className="cursor-pointer transition-colors duration-150 hover:bg-raised/60">
                  <Td mono className="whitespace-nowrap">
                    <Link href={`/quotes/${x.id}`} className="text-ink hover:underline" onClick={(e) => e.stopPropagation()}>
                      {x.id}
                    </Link>
                    {x.rev > 1 && <span className="ml-1 text-ink-3">rev.{x.rev}</span>}
                  </Td>
                  <Td>
                    {x.customer.name || <span className="text-ink-3">ยังไม่ระบุลูกค้า</span>}
                    {x.projectId && <span className="block font-mono text-[12px] text-ink-3">{x.projectId}</span>}
                  </Td>
                  <Td className="text-ink-2">
                    <span className="font-mono text-[12px] text-ink-3">{x.modelCode}</span> {getHouseModel(x.modelCode)?.name}
                  </Td>
                  <Td right mono>
                    {n0(t.subtotal)}
                  </Td>
                  <Td right mono className="text-ink">
                    {n0(t.total)}
                  </Td>
                  {canSeeCost && (
                    <Td right mono className={t.margin !== undefined && t.margin < 0.12 ? "text-neg" : "text-ink-2"}>
                      {t.margin !== undefined ? `${(t.margin * 100).toFixed(1)}%` : "–"}
                    </Td>
                  )}
                  <Td>
                    <Pill tone={QUOTE_TONE[st]}>{QUOTE_STATUS_LABEL[st]}</Pill>
                  </Td>
                  <Td className="whitespace-nowrap text-[12px] text-ink-2">
                    {thDate(x.date)}
                    <span className="block text-ink-3">ถึง {thDate(until)}</span>
                  </Td>
                  <Td className="text-[12px] text-ink-2">{x.owner}</Td>
                </tr>
              ))}
            </tbody>
          </table>
          {!shown.length && <Empty>ไม่พบใบเสนอราคาที่ตรงกับตัวกรอง</Empty>}
        </div>
      </Card>
    </>
  );
}
