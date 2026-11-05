"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, List, Plus, Search, X } from "lucide-react";
import { Card, cx, inputCls, PageHeader, PlanBar, Status } from "@/components/ui";
import { HouseThumb } from "@/components/house-thumb";
import { Kpi } from "@/components/dashboard/kpi";
import { baht, isActive, openRepairsOf, STATUS_TEXT, STATUS_TONE } from "@/components/dashboard/metrics";
import { daysBetween, houseModels, projects as seed, STATUS_LABEL, thDate, TODAY, type Project, type ProjectStatus } from "@/lib/data";
import { useLocalProjects } from "@/lib/projects-store";
import { NewProjectForm } from "./new-project-form";

const ORDER: Record<ProjectStatus, number> = { handover: 0, building: 1, planning: 2, delivered: 3 };

export function ProjectsView() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const local = useLocalProjects();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [status, setStatus] = useState<string>(sp.get("status") ?? "");
  const [province, setProvince] = useState("");
  const [pm, setPm] = useState("");
  const [model, setModel] = useState("");
  const [view, setView] = useState<"table" | "cards">("cards");
  const [formOpen, setFormOpen] = useState(sp.get("new") === "1");
  const [created, setCreated] = useState<string | null>(null);

  const localIds = useMemo(() => new Set(local.map((p) => p.id)), [local]);
  const all = useMemo(() => [...local, ...seed], [local]);
  const provinces = useMemo(() => Array.from(new Set(all.map((p) => p.province))).sort((a, b) => a.localeCompare(b, "th")), [all]);
  const pms = useMemo(() => Array.from(new Set(all.map((p) => p.pm))), [all]);
  const models = useMemo(() => houseModels.filter((m) => all.some((p) => p.modelCode === m.code)), [all]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all
      .filter((p) => !status || p.status === status)
      .filter((p) => !province || p.province === province)
      .filter((p) => !pm || p.pm === pm)
      .filter((p) => !model || p.modelCode === model)
      .filter((p) => !needle || [p.id, p.name, p.owner, p.model, p.modelCode, p.province, p.pm].some((s) => s.toLowerCase().includes(needle)))
      .sort((a, b) => ORDER[a.status] - ORDER[b.status] || b.start.localeCompare(a.start));
  }, [all, q, status, province, pm, model]);

  const active = all.filter(isActive);
  const planning = all.filter((p) => p.status === "planning");
  const delivered = all.filter((p) => p.status === "delivered");
  const behind = active.filter((p) => p.plan - p.actual >= 3).length;
  const filtered = Boolean(q || status || province || pm || model);

  const closeForm = () => {
    setFormOpen(false);
    if (sp.get("new")) router.replace(pathname, { scroll: false });
  };

  return (
    <>
      <PageHeader
        title="โครงการ"
        sub={`${all.length} โครงการ · ${active.length} กำลังก่อสร้าง · ${planning.length} วางแผน · ${delivered.length} ส่งมอบแล้ว`}
        actions={
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="inline-flex h-9 items-center gap-2 rounded-[8px] bg-ink px-4 text-[14px] font-medium text-card transition-[background-color,transform] duration-150 hover:bg-[#253d5c] active:scale-[0.98]"
          >
            <Plus size={16} strokeWidth={1.5} />
            สร้างโครงการ
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="กำลังก่อสร้าง" value={active.length} unit="โครงการ" note={`มูลค่ารวม ${baht(active.reduce((s, p) => s + p.value, 0))}`} />
        <Kpi label="ช้ากว่าแผนเกิน 3%" value={behind} unit={`จาก ${active.length}`} change={behind ? { text: "ต้องติดตาม", tone: "neg" } : { text: "ตามแผน", tone: "pos" }} note="เทียบความคืบหน้าจริงกับแผน ณ วันนี้" />
        <Kpi label="วางแผน / รอเริ่มงาน" value={planning.length} unit="โครงการ" note={`มูลค่า ${baht(planning.reduce((s, p) => s + p.value, 0))}${local.length ? ` · สร้างในเบราว์เซอร์ ${local.length}` : ""}`} />
        <Kpi label="ส่งมอบแล้ว" value={delivered.length} unit="หลัง" note={`อยู่ในประกัน ${delivered.filter((p) => p.warrantyUntil && p.warrantyUntil >= TODAY).length} หลัง`} />
      </div>

      <Card className="mt-4">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <label className="relative min-w-[240px] flex-1">
            <Search size={16} strokeWidth={1.5} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหารหัส ชื่อโครงการ ลูกค้า แบบบ้าน" className={cx(inputCls, "w-full pl-9")} aria-label="ค้นหาโครงการ" />
          </label>
          <select aria-label="สถานะ" className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">ทุกสถานะ</option>
            {(Object.keys(STATUS_LABEL) as ProjectStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <select aria-label="จังหวัด" className={inputCls} value={province} onChange={(e) => setProvince(e.target.value)}>
            <option value="">ทุกจังหวัด</option>
            {provinces.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <select aria-label="ผู้จัดการโครงการ" className={inputCls} value={pm} onChange={(e) => setPm(e.target.value)}>
            <option value="">ทุก PM</option>
            {pms.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <select aria-label="แบบบ้าน" className={inputCls} value={model} onChange={(e) => setModel(e.target.value)}>
            <option value="">ทุกแบบบ้าน</option>
            {models.map((m) => (
              <option key={m.code} value={m.code}>
                {m.code} · {m.name}
              </option>
            ))}
          </select>
          {filtered && (
            <button
              type="button"
              onClick={() => {
                setQ("");
                setStatus("");
                setProvince("");
                setPm("");
                setModel("");
              }}
              className="inline-flex h-9 items-center gap-1 rounded-[8px] px-2 text-[13px] text-ink-2 hover:bg-raised"
            >
              <X size={14} strokeWidth={1.5} />
              ล้างตัวกรอง
            </button>
          )}
          <span className="ml-auto flex items-center gap-3">
            <span className="num font-mono text-[12px] text-ink-3">{list.length} รายการ</span>
            <span className="inline-flex rounded-[8px] border border-line-strong bg-raised p-0.5" role="tablist" aria-label="มุมมอง">
              {(
                [
                  ["table", List, "ตาราง"],
                  ["cards", LayoutGrid, "การ์ด"],
                ] as const
              ).map(([k, Icon, label]) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={view === k}
                  aria-label={label}
                  title={label}
                  onClick={() => setView(k)}
                  className={cx("inline-flex size-7 items-center justify-center rounded-[6px] transition-colors duration-150", view === k ? "bg-card text-ink shadow-[0_1px_2px_rgba(0,0,0,0.06)]" : "text-ink-3 hover:text-ink")}
                >
                  <Icon size={16} strokeWidth={1.5} />
                </button>
              ))}
            </span>
          </span>
        </div>

        {list.length === 0 ? (
          <p className="px-5 py-16 text-center text-[13px] text-ink-3">ไม่พบโครงการที่ตรงกับตัวกรอง</p>
        ) : view === "table" ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-[13px]">
              <thead>
                <tr className="whitespace-nowrap border-b border-line text-left text-[12px] text-ink-3">
                  <th className="px-4 py-2.5 font-normal">โครงการ</th>
                  <th className="px-3 py-2.5 font-normal">แบบบ้าน</th>
                  <th className="px-3 py-2.5 font-normal">จังหวัด</th>
                  <th className="px-3 py-2.5 font-normal">PM</th>
                  <th className="px-3 py-2.5 font-normal">สถานะ</th>
                  <th className="w-[180px] px-3 py-2.5 font-normal">จริง / แผน</th>
                  <th className="px-3 py-2.5 text-right font-normal">มูลค่า</th>
                  <th className="px-3 py-2.5 font-normal">กำหนดเสร็จ / ส่งมอบ</th>
                  <th className="px-4 py-2.5 text-right font-normal">ปัญหาเปิด</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.map((p) => (
                  <Row key={p.id} p={p} isLocal={localIds.has(p.id)} highlight={created === p.id} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <ul className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
            {list.map((p) => (
              <ProjectCard key={p.id} p={p} isLocal={localIds.has(p.id)} highlight={created === p.id} />
            ))}
          </ul>
        )}
      </Card>

      {formOpen && (
        <NewProjectForm
          existingIds={seed.map((p) => p.id)}
          onClose={closeForm}
          onCreated={(p) => {
            setCreated(p.id);
            setQ("");
            setStatus("");
            closeForm();
          }}
        />
      )}
    </>
  );
}

function dueText(p: Project) {
  if (p.status === "delivered") return `ส่งมอบ ${thDate(p.handedOver ?? p.finish)}`;
  const left = daysBetween(TODAY, p.finish);
  return `${thDate(p.finish)} · ${left < 0 ? `เลย ${-left} วัน` : `อีก ${left} วัน`}`;
}

function Row({ p, isLocal, highlight }: { p: Project; isLocal: boolean; highlight: boolean }) {
  const issues = isLocal ? 0 : openRepairsOf(p.id).length;
  const delta = p.actual - p.plan;
  return (
    <tr className={cx("transition-colors duration-150 hover:bg-raised/50", highlight && "bg-accent-soft/50")}>
      <td className="px-4 py-2.5">
        <Link href={`/projects/${p.id}`} className="flex items-center gap-3">
          <HouseThumb code={p.modelCode} className="h-9 w-14 shrink-0 rounded-[6px] border border-line" />
          <span className="min-w-0">
            <span className="block truncate text-[14px] text-ink hover:underline hover:underline-offset-2">{p.name}</span>
            <span className="block truncate text-[12px] text-ink-3">
              <span className="font-mono">{p.id}</span> · {p.owner}
              {isLocal && <span className="ml-1.5 text-accent-text">ใหม่</span>}
            </span>
          </span>
        </Link>
      </td>
      <td className="px-3 py-2.5">
        <span className="block truncate">{p.model}</span>
        <span className="font-mono text-[12px] text-ink-3">{p.modelCode}</span>
      </td>
      <td className="px-3 py-2.5 text-ink-2">{p.province}</td>
      <td className="whitespace-nowrap px-3 py-2.5 text-ink-2">{p.pm}</td>
      <td className="px-3 py-2.5">
        <Status tone={STATUS_TONE[p.status]}>{STATUS_TEXT[p.status]}</Status>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-baseline justify-between gap-2 whitespace-nowrap font-mono text-[12px]">
          <span className="num">
            {p.actual}% <span className="text-ink-3">/ {p.plan}%</span>
          </span>
          {p.status !== "delivered" && p.status !== "planning" && (
            <span className={cx("num", delta >= 0 ? "text-pos" : delta <= -3 ? "text-neg" : "text-ink-3")}>
              {delta > 0 ? "+" : ""}
              {delta}
            </span>
          )}
        </div>
        <div className="mt-1.5">
          <PlanBar actual={p.actual} plan={p.plan} />
        </div>
      </td>
      <td className="num whitespace-nowrap px-3 py-2.5 text-right font-mono">฿{p.value.toFixed(1)} ล.</td>
      <td className="whitespace-nowrap px-3 py-2.5 text-[12px] text-ink-2">{dueText(p)}</td>
      <td className={cx("num px-4 py-2.5 text-right font-mono", issues ? "text-neg" : "text-ink-3")}>{issues || "–"}</td>
    </tr>
  );
}

function ProjectCard({ p, isLocal, highlight }: { p: Project; isLocal: boolean; highlight: boolean }) {
  const issues = isLocal ? 0 : openRepairsOf(p.id).length;
  return (
    <li>
      <Link
        href={`/projects/${p.id}`}
        className={cx("block overflow-hidden rounded-[12px] border bg-card transition-colors duration-150 hover:border-line-strong", highlight ? "border-accent/50" : "border-line")}
      >
        <div className="relative">
          <HouseThumb code={p.modelCode} className="block h-[132px] w-full" />
          <span className="absolute bottom-2 left-2 rounded-[4px] bg-ink/80 px-1.5 font-mono text-[11px] leading-5 text-card">{p.modelCode}</span>
        </div>
        <div className="px-4 py-3">
          <p className="flex items-center justify-between gap-2">
            <span className="font-mono text-[12px] text-ink-3">{p.id}</span>
            <Status tone={STATUS_TONE[p.status]}>{STATUS_TEXT[p.status]}</Status>
          </p>
          <p className="mt-0.5 truncate text-[15px] font-medium">{p.name}</p>
          <p className="truncate text-[12px] text-ink-3">
            {p.model} · {p.province} · PM {p.pm}
          </p>
          <div className="mt-3 flex items-baseline justify-between text-[12px]">
            <span className="num font-mono">
              {p.actual}% <span className="text-ink-3">แผน {p.plan}%</span>
            </span>
            <span className="num font-mono text-ink-2">฿{p.value.toFixed(1)} ล.</span>
          </div>
          <div className="mt-1.5">
            <PlanBar actual={p.actual} plan={p.plan} />
          </div>
          <p className="mt-2.5 flex items-center justify-between text-[12px] text-ink-3">
            <span>{dueText(p)}</span>
            {issues > 0 && <span className="text-neg">{issues} ปัญหาเปิด</span>}
          </p>
        </div>
      </Link>
    </li>
  );
}
