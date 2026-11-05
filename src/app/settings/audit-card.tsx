"use client";

import { useMemo, useState } from "react";
import { Card, CardHead, cx, inputCls } from "@/components/ui";
import { Empty, useHydrated } from "@/components/ops/bits";
import { auditLog, type AuditEntry } from "@/lib/collection";

const ACTION: Record<AuditEntry["action"], { label: string; cls: string }> = {
  create: { label: "สร้าง", cls: "text-pos" },
  update: { label: "แก้ไข", cls: "text-ink-2" },
  delete: { label: "ลบ", cls: "text-neg" },
};

/** Who changed what, when — every change made through a data collection. */
export function AuditCard() {
  const hydrated = useHydrated();
  const all = auditLog.use();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const [limit, setLimit] = useState(50);

  const kinds = useMemo(() => [...new Set(all.map((a) => a.kind))].sort(), [all]);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return [...all]
      .filter((a) => (!kind || a.kind === kind) && (!s || [a.label, a.recId, a.by, a.projectId ?? ""].some((v) => v.toLowerCase().includes(s))))
      .sort((a, b) => b.at.localeCompare(a.at));
  }, [all, q, kind]);

  return (
    <Card>
      <CardHead title="ประวัติการแก้ไข" meta={hydrated ? `${all.length} รายการ` : undefined} />
      <div className="flex flex-wrap gap-2 px-5 pt-4">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาเลขเอกสาร ชื่อ ผู้แก้ไข โครงการ" aria-label="ค้นหาประวัติ" className={cx(inputCls, "min-w-[240px] flex-1")} />
        <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="ชนิดข้อมูล" className={cx(inputCls, "w-[220px]")}>
          <option value="">ทุกชนิดข้อมูล</option>
          {kinds.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>
      {hydrated && rows.length === 0 ? (
        <Empty>ยังไม่มีการแก้ไขข้อมูล ทุกครั้งที่มีคนสร้าง แก้ หรือลบข้อมูล จะบันทึกไว้ที่นี่</Empty>
      ) : (
        <div className="overflow-x-auto px-5 py-3">
          <table className="w-full border-collapse text-[13px] [&_tbody_tr]:border-t [&_tbody_tr]:border-line">
            <thead>
              <tr className="text-left text-[12px] text-ink-3">
                <th className="py-2 pr-3 font-normal">เวลา</th>
                <th className="py-2 pr-3 font-normal">ผู้แก้ไข</th>
                <th className="py-2 pr-3 font-normal">การกระทำ</th>
                <th className="py-2 pr-3 font-normal">ข้อมูล</th>
                <th className="py-2 font-normal">รายการ</th>
              </tr>
            </thead>
            <tbody>
              {hydrated &&
                rows.slice(0, limit).map((a) => (
                  <tr key={a.id}>
                    <td className="whitespace-nowrap py-2 pr-3 font-mono text-[12px] text-ink-3">{new Date(a.at).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}</td>
                    <td className="py-2 pr-3">{a.by}</td>
                    <td className={cx("py-2 pr-3", ACTION[a.action].cls)}>{ACTION[a.action].label}</td>
                    <td className="py-2 pr-3 font-mono text-[12px] text-ink-3">{a.kind}</td>
                    <td className="py-2">
                      <span className="font-mono text-[12px] text-ink-3">{a.recId}</span> {a.label !== a.recId && a.label}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {rows.length > limit && (
            <button type="button" onClick={() => setLimit((n) => n + 100)} className="mt-3 text-[13px] text-ink-2 hover:text-ink">
              แสดงเพิ่ม ({rows.length - limit} รายการ)
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
