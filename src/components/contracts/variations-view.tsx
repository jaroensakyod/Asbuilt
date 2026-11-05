"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search, X } from "lucide-react";
import { Card, cx, inputCls } from "@/components/ui";
import { TODAY } from "@/lib/data";
import { sum, thDateSlash } from "@/lib/accounting/money";
import { ORIGIN_LABEL, projectName, useAccess, useAllProjects, useContractSettings, voCol, VO_STATUS_LABEL, VO_STATUS_TONE, type VariationX } from "@/lib/contracts";
import { Baht, Btn, CsvButton, Empty, FilterField, Header, I, millions, Pill, Select, StatCard, StatusPill, tableCls, td, tdR, th, thR } from "./bits";
import { VoForm } from "./vo-form";

const waited = (v: VariationX) => Math.round((Date.parse(TODAY) - Date.parse(v.submittedAt ?? v.raisedAt)) / 86400000);

/** Variations list; `projectId` limits it to one project (used inside the project ledger). */
export function VariationsList({ projectId, embedded }: { projectId?: string; embedded?: boolean }) {
  const all = voCol.use();
  const projects = useAllProjects();
  const s = useContractSettings();
  const { edit } = useAccess();
  const [q, setQ] = useState("");
  const [pid, setPid] = useState(projectId ?? "");
  const [status, setStatus] = useState("");
  const [origin, setOrigin] = useState("");
  const [form, setForm] = useState(false);

  const scope = useMemo(() => all.filter((v) => !pid || v.projectId === pid), [all, pid]);
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return scope
      .filter((v) => !status || (status === "waiting" ? v.status === "submitted" && waited(v) > s.voApprovalDays : v.status === status))
      .filter((v) => !origin || v.origin === origin)
      .filter((v) => !n || `${v.id} ${v.title} ${v.reason} ${projectName(v.projectId, projects)}`.toLowerCase().includes(n))
      .sort((a, b) => (b.submittedAt ?? b.raisedAt).localeCompare(a.submittedAt ?? a.raisedAt));
  }, [scope, q, status, origin, s.voApprovalDays, projects]);

  const approved = scope.filter((v) => v.status === "approved");
  const pending = scope.filter((v) => v.status === "submitted" || v.status === "priced");
  const late = scope.filter((v) => v.status === "submitted" && waited(v) > s.voApprovalDays);
  const filtered = q || (!projectId && pid) || status || origin;

  return (
    <>
      {!embedded && (
        <Header
          eyebrow="สัญญา & เงินในสัญญา"
          title="งานเปลี่ยนแปลง"
          sub="งานเพิ่ม-ลดจากลูกค้า การแก้แบบ สภาพหน้างาน RFI และการเปลี่ยนวัสดุ ตั้งราคาขายและต้นทุน ขอลูกค้าอนุมัติพร้อมลายเซ็น แล้วปรับมูลค่าสัญญา งบประมาณ และงวดเงินให้อัตโนมัติ"
          actions={
            edit && (
              <Btn primary onClick={() => setForm(true)}>
                <Plus {...I} />
                สร้างงานเปลี่ยนแปลง
              </Btn>
            )
          }
        />
      )}
      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="อนุมัติแล้ว" value={millions(sum(approved.map((v) => v.amount)))} unit="ล้านบาท" note={`${approved.length} รายการ · ขยายเวลา ${sum(approved.map((v) => v.days))} วัน`} onClick={() => setStatus(status === "approved" ? "" : "approved")} active={status === "approved"} />
        <StatCard label="รออนุมัติ / ประเมินราคา" value={millions(sum(pending.map((v) => v.amount)))} unit="ล้านบาท" note={`${pending.length} รายการ`} onClick={() => setStatus(status === "submitted" ? "" : "submitted")} active={status === "submitted"} />
        <StatCard label={`รอลูกค้าเกิน ${s.voApprovalDays} วัน`} value={late.length} unit="รายการ" tone={late.length ? "neg" : undefined} note="ติดตามการอนุมัติ" onClick={() => setStatus(status === "waiting" ? "" : "waiting")} active={status === "waiting"} />
        <StatCard label="กำไรขั้นต้นงานที่อนุมัติ" value={millions(sum(approved.map((v) => v.amount - v.cost)))} unit="ล้านบาท" note={sum(approved.map((v) => v.amount)) ? `${((sum(approved.map((v) => v.amount - v.cost)) / Math.abs(sum(approved.map((v) => v.amount)))) * 100).toFixed(1)}% ของราคาขาย` : "–"} />
      </div>

      <Card className="mb-4">
        <div className="grid grid-cols-2 gap-3 px-4 py-3 lg:grid-cols-6">
          <FilterField label="ค้นหา" className="col-span-2">
            <div className="relative">
              <Search {...I} className="pointer-events-none absolute left-2.5 top-2.5 text-ink-3" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="เลขที่ ชื่องาน เหตุผล" className={cx(inputCls, "w-full pl-8")} />
            </div>
          </FilterField>
          {!projectId && (
            <FilterField label="โครงการ">
              <Select label="โครงการ" value={pid} onChange={setPid}>
                <option value="">ทุกโครงการ</option>
                {[...new Set(all.map((v) => v.projectId))].map((id) => (
                  <option key={id} value={id}>
                    {id} {projectName(id, projects)}
                  </option>
                ))}
              </Select>
            </FilterField>
          )}
          <FilterField label="สถานะ">
            <Select label="สถานะ" value={status} onChange={setStatus}>
              <option value="">ทุกสถานะ</option>
              <option value="waiting">รอลูกค้าเกินกำหนด</option>
              {Object.entries(VO_STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="ที่มา">
            <Select label="ที่มา" value={origin} onChange={setOrigin}>
              <option value="">ทุกที่มา</option>
              {Object.entries(ORIGIN_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </FilterField>
          <div className="flex items-end justify-end gap-2">
            {embedded && edit && (
              <Btn small onClick={() => setForm(true)}>
                <Plus {...I} />
                สร้าง VO
              </Btn>
            )}
            <CsvButton name={`variations-${TODAY}`} rows={() => [["เลขที่", "โครงการ", "ชื่องาน", "ที่มา", "สถานะ", "ราคาขาย", "ต้นทุน", "ขยายเวลา (วัน)", "เสนอ", "ส่งลูกค้า", "อนุมัติ"], ...shown.map((v) => [v.id, v.projectId, v.title, ORIGIN_LABEL[v.origin], VO_STATUS_LABEL[v.status], v.amount, v.cost, v.days, v.raisedAt, v.submittedAt ?? "", v.approvedAt ?? ""])]} />
          </div>
        </div>
        <div className="flex items-center gap-3 border-t border-line px-4 py-2 text-[13px] text-ink-3">
          <span className="num font-mono text-[12px]">{shown.length} รายการ</span>
          {filtered && (
            <button type="button" onClick={() => (setQ(""), setPid(projectId ?? ""), setStatus(""), setOrigin(""))} className="inline-flex items-center gap-1 text-ink-2 hover:text-ink">
              <X {...I} />
              ล้างตัวกรอง
            </button>
          )}
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className={cx(tableCls, "min-w-[900px]")}>
            <thead>
              <tr>
                <th className={cx(th, "pl-5")}>เลขที่ / งาน</th>
                {!projectId && <th className={th}>โครงการ</th>}
                <th className={th}>ที่มา</th>
                <th className={thR}>ราคาขาย</th>
                <th className={thR}>ต้นทุน</th>
                <th className={thR}>ขยายเวลา</th>
                <th className={th}>วันที่</th>
                <th className={cx(th, "pr-5")}>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((v) => (
                <tr key={v.id} className="hover:bg-raised/60">
                  <td className={cx(td, "pl-5")}>
                    <Link href={`/contracts/variations/${v.id}`} className="hover:underline">
                      {v.title}
                      <span className="block font-mono text-[12px] text-ink-3">{v.id}</span>
                    </Link>
                  </td>
                  {!projectId && (
                    <td className={td}>
                      {projectName(v.projectId, projects)}
                      <span className="block font-mono text-[12px] text-ink-3">{v.projectId}</span>
                    </td>
                  )}
                  <td className={td}>
                    <Pill>{ORIGIN_LABEL[v.origin]}</Pill>
                  </td>
                  <td className={tdR}>
                    <Baht v={v.amount} strong />
                  </td>
                  <td className={tdR}>
                    <Baht v={v.cost} />
                  </td>
                  <td className={tdR}>
                    <span className="num font-mono">{v.days}</span> วัน
                  </td>
                  <td className={td}>
                    <span className="num font-mono text-[13px]">{thDateSlash(v.approvedAt ?? v.submittedAt ?? v.raisedAt)}</span>
                    <span className="block text-[12px] text-ink-3">{v.approvedAt ? "อนุมัติ" : v.submittedAt ? "ส่งลูกค้า" : "เสนอ"}</span>
                  </td>
                  <td className={cx(td, "pr-5")}>
                    <StatusPill k={v.status} labels={VO_STATUS_LABEL} tones={VO_STATUS_TONE} />
                    {v.status === "submitted" && <span className={cx("mt-1 block text-[12px]", waited(v) > s.voApprovalDays ? "text-neg" : "text-ink-3")}>รอ {waited(v)} วัน</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {shown.length === 0 && <Empty>{scope.length ? "ไม่พบงานเปลี่ยนแปลงตามตัวกรอง" : "ยังไม่มีงานเปลี่ยนแปลง"}</Empty>}
      </Card>
      {form && <VoForm projectId={projectId} onClose={() => setForm(false)} />}
    </>
  );
}
