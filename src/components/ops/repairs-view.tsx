"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Columns3, FileCheck2, List, Plus, Search, Send, Trash2, X } from "lucide-react";
import { AssetTag, Card, cx, inputCls } from "@/components/ui";
import { daysBetween, getProject, projects, REPAIR_STATUS_LABEL, SEVERITY_LABEL, slaText, SOURCE_LABEL, SYSTEM_LABEL, thDate, TODAY, WO_STATUS_LABEL, type RepairSource, type RepairStatus } from "@/lib/data";
import { assetOf, modelForProject } from "@/lib/house";
import { createWorkOrderFromRepair, deleteRepair, setRepairStatus, useRepairs, useWorkOrders, type OpsRepair, type OpsWorkOrder } from "@/lib/ops-store";
import { addDays } from "./seed";
import { Btn, Empty, FilterField, I, IconBtn, KV, Modal, Pill, Segmented, Select, SEV_TONE, StatCard, type Tone } from "./bits";
import { ASSIGNEES, RepairForm, type RepairPreset } from "./repair-form";
import { requestSurvey, surveyRequests } from "@/lib/field/store";
import { useMe } from "@/lib/use-me";

const STATUSES: RepairStatus[] = ["open", "fixing", "waiting", "closed"];
export const STATUS_TONE: Record<RepairStatus, Tone> = { open: "neutral", fixing: "warn", waiting: "accent", closed: "pos" };
const TABS: { key: RepairSource | "all"; label: string }[] = [
  { key: "all", label: "ทั้งหมด" },
  { key: "inspection", label: "จากการตรวจ" },
  { key: "customer", label: "ลูกค้าแจ้งซ่อม" },
  { key: "warranty", label: "ประกัน" },
  { key: "internal", label: "ภายใน" },
];

const isOverdue = (r: OpsRepair) => r.status !== "closed" && r.slaHours < 0;
function categoryOf(r: OpsRepair) {
  const p = getProject(r.projectId);
  return p ? assetOf(modelForProject(p), r.asset)?.category : undefined;
}

export function RepairsView() {
  const sp = useSearchParams();
  return <Inner key={sp.toString()} initQ={sp.get("q") ?? ""} preset={sp.has("new") || sp.get("project") ? { asset: sp.get("new") || undefined, project: sp.get("project") || undefined } : undefined} />;
}

type Filters = { q: string; project: string; system: string; severity: string; status: string; assignee: string; flag: "" | "overdue" | "fixing" | "open" };
const NO_FILTER: Filters = { q: "", project: "", system: "", severity: "", status: "active", assignee: "", flag: "" };

function Inner({ initQ, preset }: { initQ: string; preset?: RepairPreset }) {
  const router = useRouter();
  const all = useRepairs();
  const wos = useWorkOrders();
  const [tab, setTab] = useState<RepairSource | "all">("all");
  const [f, setF] = useState<Filters>({ ...NO_FILTER, q: initQ, status: initQ ? "" : "active" });
  const [view, setView] = useState<"list" | "kanban">("list");
  const [formOpen, setFormOpen] = useState(!!preset);
  const [openId, setOpenId] = useState<string | undefined>(() => (initQ && /^REP-/.test(initQ) ? initQ : undefined));
  const set = (k: keyof Filters) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const woOf = (id: string) => wos.find((w) => w.repairId === id && w.status !== "cancelled");

  const stats = useMemo(() => {
    const open = all.filter((r) => r.status === "open");
    const fixing = all.filter((r) => r.status === "fixing" || r.status === "waiting");
    const closed = all.filter((r) => r.status === "closed" && r.closed);
    const days = closed.map((r) => daysBetween(r.reported, r.closed!));
    const onTime = closed.filter((r) => daysBetween(r.reported, r.closed!) * 24 <= r.slaTotal).length;
    return {
      open: open.length,
      new30: all.filter((r) => r.reported >= addDays(TODAY, -30)).length,
      urgent: open.filter((r) => r.severity === "high").length,
      fixing: fixing.length,
      waiting: all.filter((r) => r.status === "waiting").length,
      overdue: all.filter(isOverdue).length,
      overdueHigh: all.filter((r) => isOverdue(r) && r.severity === "high").length,
      avg: days.length ? days.reduce((s, d) => s + d, 0) / days.length : 0,
      onTime: closed.length ? (onTime / closed.length) * 100 : 0,
      closed: closed.length,
    };
  }, [all]);

  const base = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    return all
      .filter((r) => !f.project || r.projectId === f.project)
      .filter((r) => !f.system || r.system === f.system)
      .filter((r) => !f.severity || r.severity === f.severity)
      .filter((r) => !f.assignee || r.assignee === f.assignee)
      .filter((r) => (f.status === "active" ? r.status !== "closed" || (view === "kanban" && (r.closed ?? "") >= addDays(TODAY, -14)) : !f.status || r.status === f.status))
      .filter((r) => (f.flag === "overdue" ? isOverdue(r) : f.flag === "fixing" ? r.status === "fixing" || r.status === "waiting" : f.flag === "open" ? r.status === "open" : true))
      .filter((r) => {
        if (!q) return true;
        const p = getProject(r.projectId);
        return `${r.id} ${r.title} ${r.detail} ${r.asset} ${r.assetName} ${r.reporter ?? ""} ${r.projectId} ${p?.name ?? ""} ${p?.owner ?? ""}`.toLowerCase().includes(q);
      });
  }, [all, f, view]);

  const list = useMemo(
    () =>
      base
        .filter((r) => tab === "all" || r.source === tab)
        .sort((a, b) => {
          if ((a.status === "closed") !== (b.status === "closed")) return a.status === "closed" ? 1 : -1;
          return a.status === "closed" ? b.reported.localeCompare(a.reported) : a.slaHours - b.slaHours;
        }),
    [base, tab],
  );

  const openRepair = all.find((r) => r.id === openId);
  const filtered = JSON.stringify({ ...f }) !== JSON.stringify(NO_FILTER);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
        <div>
          <p className="mb-1 text-[13px] text-ink-3">บริการหลังการขาย</p>
          <h1 className="text-[30px] font-normal leading-[1.15]">แจ้งซ่อม / ปัญหา</h1>
          <p className="mt-2 max-w-[44rem] text-ink-2">ข้อบกพร่องจากการตรวจ งานที่ลูกค้าแจ้ง และงานในระยะประกัน ผูกกับอุปกรณ์รายชิ้นและตำแหน่งในบ้าน</p>
        </div>
        <div className="flex items-center gap-2">
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { key: "list", label: "รายการ", icon: <List {...I} /> },
              { key: "kanban", label: "บอร์ด", icon: <Columns3 {...I} /> },
            ]}
          />
          <Btn primary onClick={() => setFormOpen(true)}>
            <Plus {...I} />
            แจ้งซ่อม / บันทึกปัญหา
          </Btn>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="รอดำเนินการ" value={stats.open} unit="เรื่อง" note={`ใหม่ใน 30 วัน ${stats.new30} · ด่วน ${stats.urgent}`} active={f.flag === "open"} onClick={() => setF({ ...NO_FILTER, status: "", flag: f.flag === "open" ? "" : "open" })} />
        <StatCard label="กำลังแก้ไข" value={stats.fixing} unit="เรื่อง" note={`รออะไหล่ ${stats.waiting} เรื่อง`} active={f.flag === "fixing"} onClick={() => setF({ ...NO_FILTER, status: "", flag: f.flag === "fixing" ? "" : "fixing" })} />
        <StatCard label="เลยกำหนด SLA" value={stats.overdue} unit="เรื่อง" tone={stats.overdue ? "neg" : undefined} note={`ความรุนแรงสูง ${stats.overdueHigh} เรื่อง · คลิกเพื่อกรอง`} active={f.flag === "overdue"} onClick={() => setF({ ...NO_FILTER, flag: f.flag === "overdue" ? "" : "overdue" })} />
        <StatCard label="เวลาแก้ไขเฉลี่ย" value={stats.avg.toFixed(1)} unit="วัน" note={`ปิดตรงเวลา ${stats.onTime.toFixed(0)}% จาก ${stats.closed} เรื่อง`} />
      </div>

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-0.5 border-b border-line px-3 py-2">
          {TABS.map((t) => {
            const inTab = base.filter((r) => t.key === "all" || r.source === t.key);
            const od = inTab.filter(isOverdue).length;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cx("flex h-8 items-center gap-2 rounded-[8px] px-3 text-[13px] transition-colors duration-150", tab === t.key ? "bg-raised text-ink" : "text-ink-2 hover:text-ink")}
              >
                {t.label}
                <span className="num font-mono text-[11px] text-ink-3">{inTab.length}</span>
                {od > 0 && <span className="num rounded-[4px] bg-neg-soft px-1 font-mono text-[11px] text-neg">{od}</span>}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-3 px-4 py-3 lg:grid-cols-7">
          <FilterField label="ค้นหา" className="col-span-2">
            <div className="relative">
              <Search {...I} className="pointer-events-none absolute left-2.5 top-2.5 text-ink-3" />
              <input value={f.q} onChange={(e) => set("q")(e.target.value)} placeholder="รหัส หัวข้อ รหัสอุปกรณ์ เช่น WC-201 ผู้แจ้ง" className={cx(inputCls, "w-full pl-8")} />
            </div>
          </FilterField>
          <FilterField label="โครงการ">
            <Select label="โครงการ" value={f.project} onChange={set("project")}>
              <option value="">ทุกโครงการ</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id} · {p.name}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="ระบบงาน">
            <Select label="ระบบงาน" value={f.system} onChange={set("system")}>
              <option value="">ทุกระบบ</option>
              {Object.entries(SYSTEM_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="ความรุนแรง">
            <Select label="ความรุนแรง" value={f.severity} onChange={set("severity")}>
              <option value="">ทุกระดับ</option>
              {Object.entries(SEVERITY_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="สถานะ">
            <Select label="สถานะ" value={f.status} onChange={set("status")}>
              <option value="active">ยังไม่ปิดงาน</option>
              <option value="">ทุกสถานะ</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {REPAIR_STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="ผู้รับผิดชอบ">
            <Select label="ผู้รับผิดชอบ" value={f.assignee} onChange={set("assignee")}>
              <option value="">ทุกคน</option>
              {ASSIGNEES.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </Select>
          </FilterField>
        </div>
        <div className="flex items-center gap-3 border-t border-line px-4 py-2 text-[13px] text-ink-3">
          <span className="num font-mono text-[12px]">{list.length} เรื่อง</span>
          {filtered && (
            <button type="button" onClick={() => setF(NO_FILTER)} className="inline-flex items-center gap-1 text-ink-2 hover:text-ink">
              <X {...I} />
              ล้างตัวกรอง
            </button>
          )}
        </div>
      </Card>

      {view === "list" ? (
        <Card>
          <table className="w-full text-left">
            <thead>
              <tr className="text-[13px] text-ink-3">
                <th className="px-5 py-3 font-normal">เรื่อง</th>
                <th className="py-3 pr-4 font-normal">อุปกรณ์ / ชิ้นงาน</th>
                <th className="py-3 pr-4 font-normal">ตำแหน่ง</th>
                <th className="py-3 pr-4 font-normal">สถานะ</th>
                <th className="py-3 pr-4 font-normal">ผู้รับผิดชอบ</th>
                <th className="py-3 pr-5 text-right font-normal">อายุ · SLA</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => {
                const wo = woOf(r.id);
                const age = daysBetween(r.reported, r.closed ?? TODAY);
                return (
                  <tr key={r.id} onClick={() => setOpenId(r.id)} className="cursor-pointer border-t border-line align-top transition-colors duration-150 hover:bg-raised/60">
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-[12px] text-ink-3">{r.id}</span>
                        <Pill tone={SEV_TONE[r.severity]}>{SEVERITY_LABEL[r.severity]}</Pill>
                        <Pill>{SOURCE_LABEL[r.source]}</Pill>
                        {isOverdue(r) && <Pill tone="neg">เกิน SLA</Pill>}
                      </div>
                      <span className="mt-1 block">{r.title}</span>
                      <span className="block max-w-[360px] truncate text-[13px] text-ink-3">{r.detail}</span>
                    </td>
                    <td className="py-3 pr-4" onClick={(e) => e.stopPropagation()}>
                      <AssetTag code={r.asset} href={`/projects/${r.projectId}`} />
                      <span className="mt-1 block max-w-[220px] truncate text-[13px] text-ink-2">{r.assetName}</span>
                      <span className="block text-[12px] text-ink-3">{categoryOf(r) ?? SYSTEM_LABEL[r.system]}</span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="block max-w-[220px] truncate">{getProject(r.projectId)?.name ?? r.projectId}</span>
                      <span className="block text-[13px] text-ink-3">{r.location}</span>
                    </td>
                    <td className="py-3 pr-4">
                      <Pill tone={STATUS_TONE[r.status]}>{REPAIR_STATUS_LABEL[r.status]}</Pill>
                      {wo && (
                        <Link href={`/work-orders/${wo.id}`} onClick={(e) => e.stopPropagation()} className="mt-1 block font-mono text-[12px] text-accent-text hover:underline">
                          {wo.id}
                        </Link>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-[13px]">
                      {r.assignee}
                      {r.reporter && <span className="block text-ink-3">แจ้งโดย {r.reporter}</span>}
                    </td>
                    <td className="py-3 pr-5 text-right">
                      <span className="num block font-mono text-[12px] text-ink-2">{age} วัน</span>
                      {r.status === "closed" ? (
                        <span className="block text-[12px] text-ink-3">ปิด {r.closed ? thDate(r.closed) : ""}</span>
                      ) : (
                        <span className={cx("num block font-mono text-[12px]", r.slaHours < 0 ? "text-neg" : "text-ink-3")}>{slaText(r.slaHours)}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {list.length === 0 && <Empty>ไม่พบเรื่องแจ้งซ่อมตามตัวกรอง</Empty>}
        </Card>
      ) : (
        <Kanban list={list} woOf={woOf} onOpen={setOpenId} />
      )}

      <RepairForm open={formOpen} onClose={() => setFormOpen(false)} preset={preset} onSaved={(r, wo) => (wo ? router.push(`/work-orders/${wo.id}`) : setOpenId(r.id))} />
      {openRepair && <RepairDrawer r={openRepair} wo={woOf(openRepair.id)} onClose={() => setOpenId(undefined)} />}
    </>
  );
}

function Kanban({ list, woOf, onOpen }: { list: OpsRepair[]; woOf: (id: string) => OpsWorkOrder | undefined; onOpen: (id: string) => void }) {
  const [over, setOver] = useState<RepairStatus | null>(null);
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {STATUSES.map((s, si) => {
        const col = list.filter((r) => r.status === s).sort((a, b) => a.slaHours - b.slaHours);
        return (
          <div
            key={s}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(s);
            }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => {
              const id = e.dataTransfer.getData("text/plain");
              if (id) setRepairStatus(id, s);
              setOver(null);
            }}
            className={cx("flex min-h-[320px] flex-col rounded-[14px] border bg-raised/50 transition-colors duration-150", over === s ? "border-ink-3" : "border-line")}
          >
            <div className="flex items-center justify-between px-4 py-3">
              <Pill tone={STATUS_TONE[s]}>{REPAIR_STATUS_LABEL[s]}</Pill>
              <span className="num font-mono text-[12px] text-ink-3">{col.length}</span>
            </div>
            <div className="flex flex-col gap-2 px-2 pb-2">
              {col.map((r) => {
                const wo = woOf(r.id);
                return (
                  <article
                    key={r.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", r.id)}
                    className="cursor-grab rounded-[10px] border border-line bg-card px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] active:cursor-grabbing"
                  >
                    <button type="button" onClick={() => onOpen(r.id)} className="block w-full text-left">
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] text-ink-3">{r.id}</span>
                        <Pill tone={SEV_TONE[r.severity]}>{SEVERITY_LABEL[r.severity]}</Pill>
                      </span>
                      <span className="mt-1 block text-[14px]">{r.title}</span>
                      <span className="mt-1 flex items-center gap-2">
                        <AssetTag code={r.asset} />
                        <span className="truncate text-[12px] text-ink-3">{getProject(r.projectId)?.name}</span>
                      </span>
                    </button>
                    <div className="mt-2 flex items-center justify-between text-[12px]">
                      <span className={cx("num font-mono", isOverdue(r) ? "text-neg" : "text-ink-3")}>{r.status === "closed" ? `ปิด ${r.closed ? thDate(r.closed) : ""}` : slaText(r.slaHours)}</span>
                      <span className="flex items-center">
                        {wo && <span className="mr-1 font-mono text-[11px] text-ink-3">{wo.id}</span>}
                        <IconBtn label="ย้ายไปสถานะก่อนหน้า" onClick={() => si > 0 && setRepairStatus(r.id, STATUSES[si - 1])}>
                          <ChevronLeft {...I} />
                        </IconBtn>
                        <IconBtn label="ย้ายไปสถานะถัดไป" onClick={() => si < STATUSES.length - 1 && setRepairStatus(r.id, STATUSES[si + 1])}>
                          <ChevronRight {...I} />
                        </IconBtn>
                      </span>
                    </div>
                  </article>
                );
              })}
              {col.length === 0 && <p className="px-2 py-6 text-center text-[13px] text-ink-3">ลากการ์ดมาวางที่นี่</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RepairDrawer({ r, wo, onClose }: { r: OpsRepair; wo?: OpsWorkOrder; onClose: () => void }) {
  const router = useRouter();
  const me = useMe();
  const survey = surveyRequests.use().find((s) => s.repairId === r.id);
  const p = getProject(r.projectId);
  const asset = p ? assetOf(modelForProject(p), r.asset) : undefined;
  return (
    <Modal
      open
      onClose={onClose}
      width={680}
      title={`${r.id} · ${r.title}`}
      footer={
        <>
          <Btn
            danger
            onClick={() => {
              if (window.confirm(`ลบเรื่อง ${r.id}`)) {
                deleteRepair(r.id);
                onClose();
              }
            }}
          >
            <Trash2 {...I} />
            ลบ
          </Btn>
          <span className="mr-auto" />
          {r.status === "closed" &&
            (survey ? (
              <span className="text-[13px] text-ink-3">แบบประเมิน: {survey.status === "pending" ? "รอส่ง" : survey.status === "sent" ? "ส่งแล้ว" : "ตอบแล้ว"}</span>
            ) : (
              <Btn onClick={() => requestSurvey({ repairId: r.id, woId: wo?.id, projectId: r.projectId, by: me.name })}>
                <Send {...I} />
                ส่งแบบประเมิน
              </Btn>
            ))}
          {wo ? (
            <Btn primary onClick={() => router.push(`/work-orders/${wo.id}`)}>
              <FileCheck2 {...I} />
              เปิดใบสั่งงาน {wo.id}
            </Btn>
          ) : (
            r.status !== "closed" && (
              <Btn
                primary
                onClick={() => {
                  const w = createWorkOrderFromRepair(r.id);
                  if (w) router.push(`/work-orders/${w.id}`);
                }}
              >
                <FileCheck2 {...I} />
                สร้างใบสั่งงาน
              </Btn>
            )
          )}
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Pill tone={STATUS_TONE[r.status]}>{REPAIR_STATUS_LABEL[r.status]}</Pill>
        <Pill tone={SEV_TONE[r.severity]}>ความรุนแรง{SEVERITY_LABEL[r.severity]}</Pill>
        <Pill>{SOURCE_LABEL[r.source]}</Pill>
        {isOverdue(r) && <Pill tone="neg">{slaText(r.slaHours)}</Pill>}
      </div>
      {r.detail && <p className="mt-3 text-ink-2">{r.detail}</p>}
      <div className="mt-4 grid grid-cols-2 gap-x-6">
        <KV k="อุปกรณ์">
          <AssetTag code={r.asset} href={`/projects/${r.projectId}`} /> <span className="ml-1">{r.assetName}</span>
        </KV>
        <KV k="หมวด">{asset?.category ?? SYSTEM_LABEL[r.system]}</KV>
        <KV k="โครงการ">
          <Link href={`/projects/${r.projectId}`} className="hover:underline">
            {p?.name ?? r.projectId}
          </Link>
        </KV>
        <KV k="ตำแหน่ง">{r.location}</KV>
        <KV k="ผู้แจ้ง">{r.reporter ?? "–"}</KV>
        <KV k="ผู้รับผิดชอบ">{r.assignee}</KV>
        <KV k="วันที่แจ้ง">{thDate(r.reported)}</KV>
        <KV k="SLA">{r.status === "closed" ? `ปิดงาน ${r.closed ? thDate(r.closed) : ""}` : `${r.slaTotal} ชม. · ${slaText(r.slaHours)}`}</KV>
        {asset && <KV k="ประกันอุปกรณ์">{asset.warrantyUntil >= TODAY ? `ถึง ${thDate(asset.warrantyUntil)}` : `หมดเมื่อ ${thDate(asset.warrantyUntil)}`}</KV>}
        {r.inspectionId && (
          <KV k="จากการตรวจ">
            <Link href={`/inspections/${r.inspectionId}`} className="font-mono text-[12px] text-accent-text hover:underline">
              {r.inspectionId}
            </Link>
          </KV>
        )}
        {wo && (
          <KV k="ใบสั่งงาน">
            <Link href={`/work-orders/${wo.id}`} className="font-mono text-[12px] text-accent-text hover:underline">
              {wo.id}
            </Link>{" "}
            · {WO_STATUS_LABEL[wo.status]}
          </KV>
        )}
      </div>
      <div className="mt-5">
        <p className="mb-2 text-[13px] text-ink-3">เปลี่ยนสถานะ</p>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <Btn key={s} small primary={r.status === s} onClick={() => setRepairStatus(r.id, s)}>
              {REPAIR_STATUS_LABEL[s]}
            </Btn>
          ))}
        </div>
      </div>
    </Modal>
  );
}
