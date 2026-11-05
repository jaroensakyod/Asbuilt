"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Card, cx } from "@/components/ui";
import { Btn, Empty, FilterField, I, Pill, Select, StatCard, type Tone } from "@/components/ops/bits";
import { thDate, TODAY } from "@/lib/data";
import { diffDays, DISC_LABEL, DISCS, PRIORITY_LABEL, RFI_STATUS_LABEL, rfis, useEngSettings, type Priority, type Rfi, type RfiStatus } from "@/lib/engineering";
import { DocId, Due, Heading, pname, ProjectSelect, rowCls, SearchBox, td, th, useEngPerms } from "./bits";
import { RfiForm } from "./rfi-form";

export const RFI_TONE: Record<RfiStatus, Tone> = { open: "warn", answered: "accent", closed: "neutral" };
export const PRIORITY_TONE: Record<Priority, Tone> = { low: "neutral", normal: "neutral", high: "warn", urgent: "neg" };

type Quick = "" | "open" | "overdue" | "soon" | "answered" | "impact";

export function RfiView() {
  const sp = useSearchParams();
  return <Inner key={sp.toString()} initProject={sp.get("project") ?? ""} initQ={sp.get("q") ?? ""} openNew={sp.has("new")} />;
}

function Inner({ initProject, initQ, openNew }: { initProject: string; initQ: string; openNew: boolean }) {
  const router = useRouter();
  const perms = useEngPerms();
  const s = useEngSettings();
  const all = rfis.use();
  const [q, setQ] = useState(initQ);
  const [project, setProject] = useState(initProject);
  const [status, setStatus] = useState("");
  const [disc, setDisc] = useState("");
  const [who, setWho] = useState("");
  const [quick, setQuick] = useState<Quick>("");
  const [formOpen, setFormOpen] = useState(openNew);

  const inProject = useMemo(() => all.filter((r) => !project || r.projectId === project), [all, project]);
  const late = (r: Rfi) => r.status === "open" && r.due < TODAY;
  const soon = (r: Rfi) => r.status === "open" && r.due >= TODAY && diffDays(TODAY, r.due) <= s.rfiWarnDays;
  const stats = {
    open: inProject.filter((r) => r.status === "open").length,
    overdue: inProject.filter(late).length,
    soon: inProject.filter(soon).length,
    answered: inProject.filter((r) => r.status === "answered").length,
    impact: inProject.filter((r) => r.status !== "closed" && (r.costImpact || r.timeImpact)).length,
  };
  const assignees = useMemo(() => [...new Set(all.map((r) => r.assignedTo))].sort(), [all]);
  const needle = q.trim().toLowerCase();
  const rows = inProject
    .filter((r) => !status || r.status === status)
    .filter((r) => !disc || r.disc === disc)
    .filter((r) => !who || r.assignedTo === who)
    .filter((r) => (quick === "open" ? r.status === "open" : quick === "overdue" ? late(r) : quick === "soon" ? soon(r) : quick === "answered" ? r.status === "answered" : quick === "impact" ? r.status !== "closed" && (r.costImpact || r.timeImpact) : true))
    .filter((r) => !needle || `${r.id} ${r.subject} ${r.question} ${r.location ?? ""} ${r.sheet ?? ""} ${r.assignedTo} ${r.raisedBy} ${pname(r.projectId)}`.toLowerCase().includes(needle))
    .sort((a, b) => {
      const rank = (r: Rfi) => (r.status === "open" ? 0 : r.status === "answered" ? 1 : 2);
      return rank(a) - rank(b) || (a.status === "closed" ? b.raisedAt.localeCompare(a.raisedAt) : a.due.localeCompare(b.due));
    });
  const filtered = q || status || disc || who || quick;
  const clear = () => (setQ(""), setStatus(""), setDisc(""), setWho(""), setQuick(""));
  const toggle = (k: Quick) => setQuick((x) => (x === k ? "" : k));

  return (
    <>
      <Heading
        title="RFI ถาม-ตอบแบบ"
        sub="คำถามจากหน้างานถึงผู้ออกแบบ ติดตามว่าอยู่ที่ใคร (ball in court) กำหนดตอบ และผลกระทบต่อค่าใช้จ่ายหรือเวลา คำตอบที่กระทบต้นทุนสร้างเป็นงานเปลี่ยนแปลงได้ทันที"
        actions={
          perms.edit && (
            <Btn primary onClick={() => setFormOpen(true)}>
              <Plus {...I} />
              สร้าง RFI
            </Btn>
          )
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="รอตอบ" value={stats.open} unit="เรื่อง" active={quick === "open"} onClick={() => toggle("open")} />
        <StatCard label="เลยกำหนดตอบ" value={stats.overdue} unit="เรื่อง" tone={stats.overdue ? "neg" : undefined} active={quick === "overdue"} onClick={() => toggle("overdue")} />
        <StatCard label={`ครบกำหนดใน ${s.rfiWarnDays} วัน`} value={stats.soon} unit="เรื่อง" active={quick === "soon"} onClick={() => toggle("soon")} />
        <StatCard label="ตอบแล้ว รอปิด" value={stats.answered} unit="เรื่อง" active={quick === "answered"} onClick={() => toggle("answered")} />
        <StatCard label="กระทบต้นทุน/เวลา" value={stats.impact} unit="เรื่อง" note="ยังไม่ปิด" active={quick === "impact"} onClick={() => toggle("impact")} />
      </div>

      <Card className="mb-4">
        <div className="grid grid-cols-2 gap-3 px-4 py-3 lg:grid-cols-6">
          <SearchBox value={q} onChange={setQ} placeholder="เลขที่ เรื่อง ตำแหน่ง แผ่นแบบ" className="col-span-2" />
          <FilterField label="โครงการ">
            <ProjectSelect value={project} onChange={setProject} />
          </FilterField>
          <FilterField label="สถานะ">
            <Select label="สถานะ" value={status} onChange={setStatus}>
              <option value="">ทุกสถานะ</option>
              {(Object.keys(RFI_STATUS_LABEL) as RfiStatus[]).map((k) => (
                <option key={k} value={k}>
                  {RFI_STATUS_LABEL[k]}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="หมวดงาน">
            <Select label="หมวดงาน" value={disc} onChange={setDisc}>
              <option value="">ทุกหมวด</option>
              {DISCS.map((k) => (
                <option key={k} value={k}>
                  {DISC_LABEL[k]}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="รอใคร (ball in court)">
            <Select label="รอใคร" value={who} onChange={setWho}>
              <option value="">ทุกคน</option>
              {assignees.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </FilterField>
        </div>
        <div className="flex items-center gap-3 border-t border-line px-4 py-2 text-[13px] text-ink-3">
          <span className="num font-mono text-[12px]">{rows.length} รายการ</span>
          {filtered && (
            <button type="button" onClick={clear} className="inline-flex items-center gap-1 text-ink-2 hover:text-ink">
              <X {...I} />
              ล้างตัวกรอง
            </button>
          )}
        </div>
      </Card>

      <Card>
        {rows.length === 0 ? (
          <Empty>{all.length ? "ไม่พบ RFI ตามตัวกรอง" : "ยังไม่มี RFI กด “สร้าง RFI” เมื่อแบบไม่ชัดเจนหรือขัดแย้งกัน"}</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left">
              <thead>
                <tr>
                  <th className={th}>RFI</th>
                  <th className={th}>เรื่อง</th>
                  <th className={th}>หมวด · แบบ</th>
                  <th className={th}>รอใคร</th>
                  <th className={th}>กำหนดตอบ</th>
                  <th className={th}>ผลกระทบ</th>
                  <th className={th}>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} onClick={() => router.push(`/rfi/${r.id}`)} className={rowCls}>
                    <td className={td}>
                      <DocId id={r.id} href={`/rfi/${r.id}`} />
                      <span className="block text-[12px] text-ink-3">{thDate(r.raisedAt)}</span>
                    </td>
                    <td className={td}>
                      <span className="block max-w-[340px] truncate">{r.subject}</span>
                      <span className="block max-w-[340px] truncate text-[12px] text-ink-3">
                        {pname(r.projectId)}
                        {r.location && ` · ${r.location}`}
                      </span>
                    </td>
                    <td className={cx(td, "text-[13px]")}>
                      {DISC_LABEL[r.disc]}
                      {r.sheet && <span className="block font-mono text-[12px] text-ink-3">{r.sheet}</span>}
                    </td>
                    <td className={cx(td, "text-[13px]")}>
                      <span className="block max-w-[200px] truncate">{r.assignedTo}</span>
                      {r.priority !== "normal" && (
                        <span className="mt-1 block">
                          <Pill tone={PRIORITY_TONE[r.priority]}>{PRIORITY_LABEL[r.priority]}</Pill>
                        </span>
                      )}
                    </td>
                    <td className={td}>
                      <Due date={r.due} done={r.status !== "open"} warnDays={s.rfiWarnDays} />
                    </td>
                    <td className={cx(td, "text-[13px] text-ink-2")}>
                      {r.costImpact || r.timeImpact ? [r.costImpact && "ค่าใช้จ่าย", r.timeImpact && "เวลา"].filter(Boolean).join(" · ") : <span className="text-ink-3">–</span>}
                      {r.variationId && <span className="block font-mono text-[12px] text-accent-text">{r.variationId}</span>}
                    </td>
                    <td className={td}>
                      <Pill tone={late(r) ? "neg" : RFI_TONE[r.status]}>{late(r) ? "เลยกำหนด" : RFI_STATUS_LABEL[r.status]}</Pill>
                      <span className="mt-1 block font-mono text-[12px] text-ink-3">{r.thread.length} ข้อความ</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <RfiForm open={formOpen} onClose={() => setFormOpen(false)} initProject={project} onSaved={(r) => router.push(`/rfi/${r.id}`)} />
    </>
  );
}
