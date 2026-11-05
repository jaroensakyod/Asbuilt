"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { Card, CardHead, cx, inputCls } from "@/components/ui";
import { Empty, FilterField, I, Meter, Pill, Select, StatCard } from "@/components/ops/bits";
import { TODAY } from "@/lib/data";
import { variations } from "@/lib/biz";
import { SEL_CATEGORY_LABEL, daysBetween, isSelectionLate, selectionDiff, selectionSummary, selections, type Selection } from "@/lib/interior";
import { Amt, Header, dateOr, projectName, rowCls, td, th, thR } from "@/components/design/bits";

export function SelectionsView() {
  const list = selections.use();
  const vos = variations.use();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [cat, setCat] = useState("");

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return list.filter((s) => {
      if (cat && s.category !== cat) return false;
      if (status === "late" && !isSelectionLate(s, TODAY)) return false;
      if (status && status !== "late" && s.status !== status) return false;
      if (n && !`${s.projectId} ${projectName(s.projectId)} ${s.item} ${s.room}`.toLowerCase().includes(n)) return false;
      return true;
    });
  }, [list, q, status, cat]);

  const byProject = useMemo(() => {
    const m = new Map<string, Selection[]>();
    for (const s of filtered) m.set(s.projectId, [...(m.get(s.projectId) ?? []), s]);
    return [...m.entries()]
      .map(([projectId, rows]) => {
        const sum = selectionSummary(rows, TODAY);
        const next = rows.filter((s) => s.status === "pending").sort((a, b) => a.deadline.localeCompare(b.deadline))[0];
        const pendingVo = vos.filter((v) => v.projectId === projectId && v.origin === "selection" && v.status === "submitted").length;
        return { projectId, rows, sum, next, pendingVo };
      })
      .sort((a, b) => b.sum.late - a.sum.late || b.sum.pending - a.sum.pending || a.projectId.localeCompare(b.projectId));
  }, [filtered, vos]);

  const all = selectionSummary(list, TODAY);
  const late = list.filter((s) => isSelectionLate(s, TODAY)).sort((a, b) => a.deadline.localeCompare(b.deadline));
  const voWaiting = vos.filter((v) => v.origin === "selection" && v.status === "submitted");

  return (
    <>
      <Header
        eyebrow="ตกแต่งภายใน"
        title="ลูกค้าเลือกวัสดุ"
        sub="รายการวัสดุและอุปกรณ์ที่ลูกค้าต้องเลือกในแต่ละห้อง เทียบงบมาตรฐานกับราคาที่เลือก กำหนดวันเลือก (เลยกำหนดจะกระทบแผนงาน) ลูกค้าเลือกได้เองในพอร์ทัล อนุมัติแล้วล็อกและสร้างงานเปลี่ยนแปลงอัตโนมัติ"
      />
      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="รอลูกค้าเลือก" value={all.pending} unit="รายการ" note={`จากทั้งหมด ${all.total} รายการ`} onClick={() => setStatus(status === "pending" ? "" : "pending")} active={status === "pending"} />
        <StatCard label="เลยกำหนดเลือก" value={all.late} unit="รายการ" tone={all.late ? "neg" : undefined} note="กระทบแผนงานก่อสร้าง" onClick={() => setStatus(status === "late" ? "" : "late")} active={status === "late"} />
        <StatCard label="เลือกแล้ว รออนุมัติ" value={all.chosen} unit="รายการ" note={`งานเปลี่ยนแปลงรอลูกค้าอนุมัติ ${voWaiting.length}`} onClick={() => setStatus(status === "chosen" ? "" : "chosen")} active={status === "chosen"} />
        <StatCard label="ส่วนต่างจากงบมาตรฐาน" value={<Amt n={all.diff} signed />} note={`งบมาตรฐานรวม ${Math.round(all.allowance / 1000).toLocaleString("th-TH")}k บาท`} />
      </div>

      <Card className="mb-4">
        <div className="grid grid-cols-2 items-end gap-3 px-4 py-3 lg:grid-cols-5">
          <FilterField label="ค้นหา" className="col-span-2">
            <div className="relative">
              <Search {...I} className="pointer-events-none absolute left-2.5 top-2.5 text-ink-3" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="โครงการ รายการ ห้อง" className={cx(inputCls, "w-full pl-8")} />
            </div>
          </FilterField>
          <FilterField label="สถานะ">
            <Select label="สถานะ" value={status} onChange={setStatus}>
              <option value="">ทั้งหมด</option>
              <option value="pending">รอลูกค้าเลือก</option>
              <option value="late">เลยกำหนด</option>
              <option value="chosen">เลือกแล้ว รออนุมัติ</option>
              <option value="approved">อนุมัติแล้ว</option>
            </Select>
          </FilterField>
          <FilterField label="หมวด">
            <Select label="หมวด" value={cat} onChange={setCat}>
              <option value="">ทุกหมวด</option>
              {Object.entries(SEL_CATEGORY_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </FilterField>
          <div>
            {(q || status || cat) && (
              <button type="button" onClick={() => (setQ(""), setStatus(""), setCat(""))} className="inline-flex h-9 items-center gap-1 text-[13px] text-ink-2 hover:text-ink">
                <X {...I} />
                ล้างตัวกรอง
              </button>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left">
              <thead>
                <tr>
                  <th className={cx(th, "px-5")}>โครงการ</th>
                  <th className={cx(th, "w-[160px]")}>อนุมัติแล้ว</th>
                  <th className={thR}>รอเลือก</th>
                  <th className={thR}>เลยกำหนด</th>
                  <th className={th}>กำหนดถัดไป</th>
                  <th className={thR}>ส่วนต่าง</th>
                  <th className={cx(th, "pr-5")}>งานเปลี่ยนแปลง</th>
                </tr>
              </thead>
              <tbody>
                {byProject.map(({ projectId, sum, next, pendingVo }) => (
                  <tr key={projectId} className={rowCls}>
                    <td className={cx(td, "px-5")}>
                      <Link href={`/selections/${projectId}`} className="block hover:underline">
                        {projectName(projectId)}
                      </Link>
                      <span className="font-mono text-[12px] text-ink-3">{projectId}</span>
                    </td>
                    <td className={td}>
                      <div className="flex items-center gap-2">
                        <Meter value={sum.total ? (sum.approved / sum.total) * 100 : 0} />
                        <span className="num shrink-0 font-mono text-[12px] text-ink-2">
                          {sum.approved}/{sum.total}
                        </span>
                      </div>
                    </td>
                    <td className={cx(td, "num text-right font-mono")}>{sum.pending}</td>
                    <td className={cx(td, "num text-right font-mono", sum.late > 0 && "text-neg")}>{sum.late}</td>
                    <td className={td}>{next ? <span className={cx(next.deadline < TODAY && "text-neg")}>{dateOr(next.deadline)} · {next.item}</span> : "–"}</td>
                    <td className={cx(td, "text-right")}>
                      <Amt n={sum.diff} signed />
                    </td>
                    <td className={cx(td, "pr-5")}>{pendingVo ? <Pill tone="warn">รอลูกค้าอนุมัติ {pendingVo}</Pill> : <span className="text-ink-3">–</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {byProject.length === 0 && <Empty>{list.length ? "ไม่พบรายการตามตัวกรอง" : "ยังไม่มีรายการให้ลูกค้าเลือก เปิดโครงการเพื่อเพิ่มรายการ"}</Empty>}
        </Card>

        <Card>
          <CardHead title="เลยกำหนดเลือก" meta={late.length ? `${late.length} รายการ` : undefined} />
          {late.length === 0 ? (
            <Empty>ไม่มีรายการที่เลยกำหนด</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {late.map((s) => (
                <li key={s.id} className="px-5 py-3 text-[13px]">
                  <Link href={`/selections/${s.projectId}`} className="hover:underline">
                    {s.item}
                  </Link>
                  <p className="text-ink-3">
                    {projectName(s.projectId)} · {s.room}
                  </p>
                  <p className="mt-0.5 text-neg">
                    เลยกำหนด {daysBetween(s.deadline, TODAY)} วัน{s.blocks ? ` · รอ${s.blocks}` : ""}
                    {s.blocksDate ? ` (${dateOr(s.blocksDate)})` : ""}
                  </p>
                  {selectionDiff(s) !== 0 && <Amt n={selectionDiff(s)} signed />}
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-line px-5 py-3">
            <Link href="/notifications" className="text-[13px] text-ink-2 underline-offset-2 hover:text-ink hover:underline">
              ดูการแจ้งเตือนทั้งหมด
            </Link>
          </div>
        </Card>
      </div>
    </>
  );
}
