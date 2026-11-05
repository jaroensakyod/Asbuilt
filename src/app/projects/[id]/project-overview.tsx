"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Box, Download, FileText, Package, PencilRuler, Map as MapIcon, Phone, Plus, Ruler, Trash2, Zap } from "lucide-react";
import { Card, CardHead, cx, PlanBar, Status } from "@/components/ui";
import { HouseThumb } from "@/components/house-thumb";
import { HousePreview } from "@/components/viewer/house-preview";
import { PortalLinkCard } from "@/components/portal/portal-link-card";
import { ModelFilesCard } from "@/components/model3d/model-files-card";
import { ProjectMessages } from "@/components/portal/project-messages";
import { baht, phaseSegments, STATUS_TEXT, STATUS_TONE } from "@/components/dashboard/metrics";
import { PhaseBar } from "@/components/dashboard/phase-bar";
import {
  daysBetween,
  getHouseModel,
  inspections,
  REPAIR_STATUS_LABEL,
  repairs,
  ROLE_LABEL,
  SEVERITY_LABEL,
  slaText,
  SOURCE_LABEL,
  SYSTEM_LABEL,
  team,
  thDate,
  TODAY,
  WO_STATUS_LABEL,
  workOrders,
  type Project,
} from "@/lib/data";
import { DOC_CATEGORY_LABEL, docSize, projectDocs } from "@/lib/docs-data";
import { removeLocalProject } from "@/lib/projects-store";

type Tab = "overview" | "repairs" | "inspections" | "workorders" | "docs" | "team";

const btn =
  "inline-flex h-9 items-center gap-2 rounded-[8px] border border-line-strong bg-card px-3.5 text-[14px] font-medium text-ink transition-[background-color,transform] duration-150 hover:bg-raised active:scale-[0.98]";

export function ProjectOverview({ project: p, local }: { project: Project; local?: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const model = getHouseModel(p.modelCode);

  const data = useMemo(() => {
    const rep = repairs.filter((r) => r.projectId === p.id);
    const ins = inspections.filter((i) => i.projectId === p.id).sort((a, b) => b.date.localeCompare(a.date));
    const wos = workOrders.filter((w) => w.projectId === p.id).sort((a, b) => b.issued.localeCompare(a.issued));
    const docs = projectDocs(p.id);
    const names = new Map<string, string>();
    const add = (name: string | undefined, what: string) => {
      if (!name) return;
      names.set(name, names.has(name) ? `${names.get(name)}, ${what}` : what);
    };
    add(p.pm, "ดูแลโครงการ");
    ins.forEach((i) => add(i.inspector, "ตรวจงาน"));
    rep.forEach((r) => add(r.assignee, "รับแจ้งซ่อม"));
    wos.forEach((w) => {
      add(w.technician, "ช่างตามใบสั่งงาน");
      add(w.issuedBy, "ออกใบสั่งงาน");
    });
    docs.slice(0, 40).forEach((d) => add(d.by, "เอกสาร"));
    const people = Array.from(names.entries()).map(([name, work]) => ({
      name,
      work: Array.from(new Set(work.split(", "))).join(", "),
      member: team.find((m) => m.name === name),
    }));
    return { rep, ins, wos, docs, people };
  }, [p]);

  const openRep = data.rep.filter((r) => r.status !== "closed");
  const segs = phaseSegments(p);
  const delta = Math.round((p.actual - p.plan) * 10) / 10;
  const left = daysBetween(TODAY, p.finish);
  const warrantyLeft = p.warrantyUntil ? daysBetween(TODAY, p.warrantyUntil) : null;

  const tabs: { k: Tab; label: string; n?: number }[] = [
    { k: "overview", label: "ภาพรวม" },
    { k: "repairs", label: "แจ้งซ่อม", n: data.rep.length },
    { k: "inspections", label: "การตรวจ", n: data.ins.length },
    { k: "workorders", label: "ใบสั่งงาน", n: data.wos.length },
    { k: "docs", label: "เอกสาร", n: data.docs.length },
    { k: "team", label: "ทีมงาน", n: data.people.length },
  ];

  return (
    <>
      {/* header */}
      <div className="grid gap-6 pb-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="relative overflow-hidden rounded-[12px] border border-line">
          <HouseThumb code={p.modelCode} className="block h-[150px] w-full" />
          <span className="absolute bottom-2 left-2 rounded-[4px] bg-ink/80 px-1.5 font-mono text-[11px] leading-5 text-card">{p.modelCode}</span>
        </div>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-[13px] text-ink-3">{p.id}</span>
            <Status tone={STATUS_TONE[p.status]}>{STATUS_TEXT[p.status]}</Status>
            {local && <span className="rounded-[6px] bg-accent-soft px-1.5 text-[12px] leading-5 text-accent-text">สร้างในเบราว์เซอร์นี้</span>}
          </p>
          <h1 className="mt-1 text-[28px] font-normal leading-[1.2]">
            {p.name} <span className="text-ink-3">· {p.model}</span>
          </h1>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-3 xl:grid-cols-6">
            <Info k="เจ้าของบ้าน" v={p.owner} />
            <Info
              k="ติดต่อ"
              v={
                p.phone ? (
                  <a href={`tel:${p.phone}`} className="inline-flex items-center gap-1 font-mono hover:underline">
                    <Phone size={12} strokeWidth={1.5} />
                    {p.phone}
                  </a>
                ) : (
                  "–"
                )
              }
            />
            <Info k="แบบบ้าน" v={<Link href={`/models/${p.modelCode}`} className="hover:underline">{`${p.modelCode} · ${p.floors} ชั้น · ${p.area} ตร.ม.`}</Link>} />
            <Info k="ผู้จัดการโครงการ" v={p.pm} />
            <Info k="มูลค่าสัญญา" v={<span className="num font-mono">{baht(p.value)}</span>} />
            <Info k="ที่ตั้ง" v={p.address || p.province} />
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={`/structure/${p.id}`} className={btn}>
              <Box size={16} strokeWidth={1.5} />
              โมเดล 3D
            </Link>
            <Link href={`/blueprint/${p.modelCode}`} className={btn}>
              <MapIcon size={16} strokeWidth={1.5} />
              แบบ 2D
            </Link>
            <Link href={`/takeoff/${encodeURIComponent(p.id)}`} className={btn}>
              <Ruler size={16} strokeWidth={1.5} />
              ถอดปริมาณ
            </Link>
            <Link href={`/cad/${p.modelCode}`} className={btn}>
              <PencilRuler size={16} strokeWidth={1.5} />
              CAD
            </Link>
            <Link href={`/systems/elec?project=${p.id}`} className={btn}>
              <Zap size={16} strokeWidth={1.5} />
              ระบบไฟฟ้า
            </Link>
            <Link href={`/assets?project=${p.id}`} className={btn}>
              <Package size={16} strokeWidth={1.5} />
              อุปกรณ์
            </Link>
            {local && (
              <button
                type="button"
                className={cx(btn, "text-neg")}
                onClick={() => {
                  if (window.confirm(`ลบโครงการ ${p.id} ออกจากเบราว์เซอร์นี้`)) {
                    removeLocalProject(p.id);
                    router.push("/projects");
                  }
                }}
              >
                <Trash2 size={16} strokeWidth={1.5} />
                ลบโครงการ
              </button>
            )}
          </div>
        </div>
      </div>

      {/* tabs */}
      <div role="tablist" aria-label="ข้อมูลโครงการ" className="mb-4 flex gap-1 overflow-x-auto border-b border-line [scrollbar-width:none]">
        {tabs.map((t) => (
          <button
            key={t.k}
            type="button"
            role="tab"
            aria-selected={tab === t.k}
            onClick={() => setTab(t.k)}
            className={cx(
              "-mb-px flex h-10 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-[14px] transition-colors duration-150",
              tab === t.k ? "border-ink text-ink" : "border-transparent text-ink-2 hover:text-ink",
            )}
          >
            {t.label}
            {t.n != null && <span className="num font-mono text-[12px] text-ink-3">{t.n}</span>}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="grid content-start gap-4">
            <Card>
              <CardHead title="ความคืบหน้า" meta={`ณ ${thDate(TODAY)}`} />
              <div className="px-5 py-4">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <p className="flex items-baseline gap-2">
                    <span className="num text-[34px] font-medium leading-none">{p.actual}%</span>
                    <span className="text-[13px] text-ink-3">แผน {p.plan}%</span>
                    {p.status !== "planning" && p.status !== "delivered" && (
                      <span className={cx("num ml-1 font-mono text-[13px]", delta >= 0 ? "text-pos" : delta <= -3 ? "text-neg" : "text-ink-2")}>
                        {delta > 0 ? "+" : ""}
                        {delta}%
                      </span>
                    )}
                  </p>
                  <p className="text-[13px] text-ink-2">
                    งานปัจจุบัน <span className="text-ink">{p.phase}</span>
                  </p>
                </div>
                <div className="mt-3">
                  <PlanBar actual={p.actual} plan={p.plan} />
                </div>
                <PhaseBar segs={segs} className="mt-4" />
                <table className="mt-4 w-full text-[13px]">
                  <thead>
                    <tr className="text-left text-[12px] text-ink-3">
                      <th className="py-1.5 font-normal">หมวดงาน</th>
                      <th className="w-[45%] py-1.5 font-normal">จริง / แผน</th>
                      <th className="py-1.5 text-right font-normal">จริง</th>
                      <th className="py-1.5 text-right font-normal">แผน</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {segs.map((s) => (
                      <tr key={s.phase}>
                        <td className="py-2">{s.label}</td>
                        <td className="py-2 pr-4">
                          <PlanBar actual={s.actual} plan={s.plan} />
                        </td>
                        <td className="num py-2 text-right font-mono">{Math.round(s.actual)}%</td>
                        <td className="num py-2 text-right font-mono text-ink-3">{Math.round(s.plan)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card>
              <CardHead title="แจ้งซ่อมที่เปิดอยู่" meta={`${openRep.length} เรื่อง`} action={<TabLink onClick={() => setTab("repairs")} />} />
              {openRep.length === 0 ? (
                <Empty>ไม่มีแจ้งซ่อมที่เปิดอยู่</Empty>
              ) : (
                <ul className="divide-y divide-line">
                  {openRep.map((r) => (
                    <RepairRow key={r.id} r={r} />
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="grid content-start gap-4">
            <Card>
              <CardHead title="วันสำคัญ" />
              <dl className="divide-y divide-line text-[13px]">
                <DateRow k="เซ็นสัญญา" v={p.contractDate} />
                <DateRow k="เริ่มงาน" v={p.start} />
                <DateRow k="กำหนดเสร็จ" v={p.finish} note={p.status === "delivered" ? undefined : left < 0 ? `เลย ${-left} วัน` : `อีก ${left} วัน`} tone={left < 0 && p.status !== "delivered" ? "neg" : undefined} />
                <DateRow k="ส่งมอบ" v={p.handedOver} />
                <DateRow
                  k="ประกันถึง"
                  v={p.warrantyUntil}
                  note={warrantyLeft == null ? undefined : warrantyLeft < 0 ? "หมดประกันแล้ว" : `อีก ${warrantyLeft} วัน`}
                  tone={warrantyLeft != null && warrantyLeft <= 180 ? "warn" : undefined}
                />
              </dl>
            </Card>

            <Card className="overflow-hidden">
              <CardHead title="โมเดล 3 มิติ" meta={openRep.length ? `${openRep.length} จุดแจ้งซ่อม` : undefined} action={<Link href={`/structure/${p.id}`} className="flex items-center gap-1 text-[13px] text-ink-2 hover:text-ink">เปิดเต็มจอ <ArrowRight size={14} strokeWidth={1.5} /></Link>} />
              <div className="h-[260px] bg-raised">
                <HousePreview code={p.modelCode} pins={openRep.map((r) => r.asset)} />
              </div>
            </Card>

            <ModelFilesCard projectId={p.id} />

            <PortalLinkCard projectId={p.id} />

            <div id="messages" className="scroll-mt-20">
              <ProjectMessages projectId={p.id} />
            </div>

            {model && (
              <Card>
                <CardHead title="ข้อมูลแบบบ้าน" action={<Link href={`/models/${p.modelCode}`} className="flex items-center gap-1 text-[13px] text-ink-2 hover:text-ink">แคตตาล็อก <ArrowRight size={14} strokeWidth={1.5} /></Link>} />
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 px-5 py-4 text-[13px]">
                  <Info k="รุ่น" v={`${model.name}`} />
                  <Info k="สไตล์" v={model.style} />
                  <Info k="ห้องนอน / ห้องน้ำ" v={<span className="num font-mono">{`${model.beds} / ${model.baths}`}</span>} />
                  <Info k="ที่จอดรถ" v={<span className="num font-mono">{model.parking}</span>} />
                  <Info k="ที่ดินแนะนำ" v={<span className="font-mono">{model.land}</span>} />
                  <Info k="ชุดแบบ" v={<span className="num font-mono">{model.sheets} แผ่น</span>} />
                </dl>
              </Card>
            )}
          </div>
        </div>
      )}

      {tab === "repairs" && (
        <Card>
          <CardHead
            title="แจ้งซ่อม"
            meta={`${data.rep.length} เรื่อง · เปิดอยู่ ${openRep.length}`}
            action={
              <Link href={`/repairs?new=&project=${p.id}`} className="flex items-center gap-1 text-[13px] text-ink-2 hover:text-ink">
                <Plus size={14} strokeWidth={1.5} /> แจ้งซ่อมใหม่
              </Link>
            }
          />
          {data.rep.length === 0 ? (
            <Empty>ยังไม่มีแจ้งซ่อมของโครงการนี้</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {data.rep.map((r) => (
                <RepairRow key={r.id} r={r} />
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === "inspections" && (
        <Card>
          <CardHead title="การตรวจงาน" meta={`${data.ins.length} รายการ`} />
          {data.ins.length === 0 ? (
            <Empty>ยังไม่มีการตรวจของโครงการนี้</Empty>
          ) : (
            <Table head={["รหัส", "รายการตรวจ", "หมวดงาน", "ผู้ตรวจ", "วันที่", "ผล"]}>
              {data.ins.map((i) => (
                <tr key={i.id} className="hover:bg-raised/50">
                  <td className="px-5 py-2.5">
                    <Link href={`/inspections/${i.id}`} className="font-mono text-[12px] hover:underline">
                      {i.id}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <Link href={`/inspections/${i.id}`} className="hover:underline">
                      {i.title}
                    </Link>
                    <span className="block text-[12px] text-ink-3">
                      {i.location} · {i.items} รายการ
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-ink-2">{i.phase}</td>
                  <td className="px-3 py-2.5 text-ink-2">{i.inspector}</td>
                  <td className="num px-3 py-2.5 font-mono text-[12px]">
                    {thDate(i.date)} {i.time}
                  </td>
                  <td className="px-5 py-2.5">
                    {i.result === "scheduled" ? (
                      <Status tone="accent">นัดไว้</Status>
                    ) : (
                      <Status tone={i.result === "pass" ? "pos" : "neg"}>
                        {i.result === "pass" ? "ผ่าน" : "ไม่ผ่าน"} <span className="num font-mono">{i.score}</span>
                      </Status>
                    )}
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      )}

      {tab === "workorders" && (
        <Card>
          <CardHead title="ใบสั่งงาน" meta={`${data.wos.length} ใบ`} />
          {data.wos.length === 0 ? (
            <Empty>ยังไม่มีใบสั่งงานของโครงการนี้</Empty>
          ) : (
            <Table head={["เลขที่", "งาน", "ช่าง", "นัดเข้างาน", "การคิดเงิน", "สถานะ"]}>
              {data.wos.map((w) => (
                <tr key={w.id} className="hover:bg-raised/50">
                  <td className="px-5 py-2.5">
                    <Link href={`/work-orders/${w.id}`} className="font-mono text-[12px] hover:underline">
                      {w.id}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <Link href={`/work-orders/${w.id}`} className="hover:underline">
                      {w.title}
                    </Link>
                    <span className="block font-mono text-[12px] text-ink-3">
                      {w.asset} · {w.repairId}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-ink-2">{w.technician}</td>
                  <td className="num px-3 py-2.5 font-mono text-[12px]">{thDate(w.scheduled)}</td>
                  <td className="px-3 py-2.5 text-ink-2">{w.billing === "warranty" ? "ในประกัน" : "คิดค่าบริการ"}</td>
                  <td className="px-5 py-2.5">
                    <Status tone={w.status === "done" ? "pos" : w.status === "on_hold" ? "warn" : w.status === "cancelled" ? "neutral" : "accent"}>{WO_STATUS_LABEL[w.status]}</Status>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      )}

      {tab === "docs" && (
        <Card>
          <CardHead
            title="เอกสาร"
            meta={`${data.docs.length} ไฟล์ · ${docSize(data.docs.reduce((s, d) => s + d.sizeKb, 0))}`}
            action={
              <Link href={`/documents?project=${p.id}`} className="flex items-center gap-1 text-[13px] text-ink-2 hover:text-ink">
                เปิดในศูนย์เอกสาร <ArrowRight size={14} strokeWidth={1.5} />
              </Link>
            }
          />
          {data.docs.length === 0 ? (
            <Empty>ยังไม่มีเอกสาร</Empty>
          ) : (
            <Table head={["เอกสาร", "หมวด", "ขนาด", "ผู้อัปโหลด", "วันที่", ""]}>
              {data.docs.map((d) => (
                <tr key={d.id} className="hover:bg-raised/50">
                  <td className="px-5 py-2.5">
                    <span className="flex items-center gap-2.5">
                      <FileText size={16} strokeWidth={1.5} className="shrink-0 text-ink-3" />
                      <span className="min-w-0">
                        <span className="block truncate">{d.title}</span>
                        <span className="block truncate font-mono text-[12px] text-ink-3">{d.file}</span>
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-ink-2">{DOC_CATEGORY_LABEL[d.category]}</td>
                  <td className="num px-3 py-2.5 font-mono text-[12px]">{docSize(d.sizeKb)}</td>
                  <td className="px-3 py-2.5 text-ink-2">{d.by}</td>
                  <td className="num px-3 py-2.5 font-mono text-[12px]">{thDate(d.date)}</td>
                  <td className="px-5 py-2.5 text-right">
                    <Link href={`/documents?project=${p.id}&q=${encodeURIComponent(d.file)}`} aria-label={`เปิด ${d.title}`} className="inline-flex size-7 items-center justify-center rounded-[6px] text-ink-3 hover:bg-raised hover:text-ink">
                      <Download size={16} strokeWidth={1.5} />
                    </Link>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      )}

      {tab === "team" && (
        <Card>
          <CardHead title="ทีมงานโครงการ" meta={`${data.people.length} คน`} action={<Link href="/team" className="flex items-center gap-1 text-[13px] text-ink-2 hover:text-ink">ผู้ใช้ทั้งหมด <ArrowRight size={14} strokeWidth={1.5} /></Link>} />
          <ul className="divide-y divide-line">
            <li className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3 px-5 py-3">
              <Avatar name={p.owner} tone="accent" />
              <span className="min-w-0">
                <span className="block truncate">{p.owner}</span>
                <span className="block text-[12px] text-ink-3">เจ้าของบ้าน · ลูกค้า</span>
              </span>
              <span className="font-mono text-[12px] text-ink-2">{p.phone}</span>
            </li>
            {data.people.map((x) => (
              <li key={x.name} className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3 px-5 py-3">
                <Avatar name={x.name} />
                <span className="min-w-0">
                  <span className="block truncate">{x.name}</span>
                  <span className="block truncate text-[12px] text-ink-3">
                    {x.member ? ROLE_LABEL[x.member.role] : "ผู้รับเหมาช่วง"} · {x.work}
                  </span>
                </span>
                <span className="text-right font-mono text-[12px] text-ink-2">
                  {x.member?.phone ?? "–"}
                  {x.member && <span className="block text-ink-3">{x.member.email}</span>}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

function Info({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-ink-3">{k}</dt>
      <dd className="truncate text-ink">{v}</dd>
    </div>
  );
}

function DateRow({ k, v, note, tone }: { k: string; v?: string; note?: string; tone?: "neg" | "warn" }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-5 py-2.5">
      <dt className="text-ink-2">{k}</dt>
      <dd className="text-right">
        <span className="num font-mono">{v ? thDate(v) : "–"}</span>
        {note && v && <span className={cx("ml-2 text-[12px]", tone === "neg" ? "text-neg" : tone === "warn" ? "text-warn" : "text-ink-3")}>{note}</span>}
      </dd>
    </div>
  );
}

function RepairRow({ r }: { r: (typeof repairs)[number] }) {
  const closed = r.status === "closed";
  return (
    <li>
      <Link href={`/repairs?q=${r.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-5 py-3 transition-colors duration-150 hover:bg-raised/60">
        <span className="min-w-0">
          <span className="block truncate text-[14px]">
            {r.title} <span className="text-ink-3">— {r.assetName}</span>
          </span>
          <span className="block truncate text-[12px] text-ink-3">
            <span className="font-mono">{r.id}</span> · <span className="font-mono">{r.asset}</span> · {r.location} · {SYSTEM_LABEL[r.system]} · {SOURCE_LABEL[r.source]} · {r.assignee}
          </span>
        </span>
        <span className="flex flex-col items-end gap-0.5">
          <Status tone={closed ? "pos" : r.severity === "high" ? "neg" : r.severity === "medium" ? "warn" : "neutral"}>
            {closed ? REPAIR_STATUS_LABEL[r.status] : `${SEVERITY_LABEL[r.severity]} · ${REPAIR_STATUS_LABEL[r.status]}`}
          </Status>
          {!closed && <span className={cx("num font-mono text-[12px]", r.slaHours < 0 ? "text-neg" : "text-ink-3")}>{slaText(r.slaHours)}</span>}
        </span>
      </Link>
    </li>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-[13px]">
        <thead>
          <tr className="border-b border-line text-left text-[12px] text-ink-3">
            {head.map((h, i) => (
              <th key={i} className={cx("py-2.5 font-normal", i === 0 ? "px-5" : i === head.length - 1 ? "px-5" : "px-3")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-10 text-center text-[13px] text-ink-3">{children}</p>;
}

function TabLink({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-1 text-[13px] text-ink-2 hover:text-ink">
      ทั้งหมด <ArrowRight size={14} strokeWidth={1.5} />
    </button>
  );
}

function Avatar({ name, tone }: { name: string; tone?: "accent" }) {
  const parts = name.replace(/^(คุณ|บริษัท|นิติบุคคล)/, "").trim().split(/\s+/);
  const ini = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  return (
    <span className={cx("inline-flex size-9 items-center justify-center rounded-full text-[12px]", tone === "accent" ? "bg-accent-soft text-accent-text" : "bg-raised text-ink-2")} aria-hidden>
      {ini}
    </span>
  );
}
