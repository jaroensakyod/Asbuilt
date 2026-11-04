"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Ban, Box, Check, Pause, Play, Printer, Trash2 } from "lucide-react";
import { AssetTag, Card, CardHead, cx, inputCls } from "@/components/ui";
import { getProject, REPAIR_STATUS_LABEL, SEVERITY_LABEL, SOURCE_LABEL, SYSTEM_LABEL, team, thDate, TODAY, WO_STATUS_LABEL, type WorkOrderStatus } from "@/lib/data";
import { assetOf, modelForProject } from "@/lib/house";
import { deleteWorkOrder, updateWorkOrder, useInspections, useRepairs, useWorkOrders, type OpsWorkOrder } from "@/lib/ops-store";
import { assetLocation } from "./seed";
import { areaCls, Btn, Empty, I, Initials, Pill, PrintStyle, SEV_TONE, useHydrated } from "./bits";
import { DocHeader, DocRow, DocSection, Signatures } from "./doc";
import { FloorPlan } from "./floor-plan";
import { BILLING_LABEL, WO_TONE } from "./work-orders-view";

const baht = (n: number) => `฿${n.toLocaleString("th-TH")}`;

export function WorkOrderDetail({ id }: { id: string }) {
  const all = useWorkOrders();
  const hydrated = useHydrated();
  const wo = all.find((w) => w.id === id);
  if (!wo) {
    return (
      <Card>
        <Empty>{hydrated ? `ไม่พบใบสั่งงาน ${id}` : "กำลังโหลด"}</Empty>
      </Card>
    );
  }
  return <Sheet key={wo.id} wo={wo} />;
}

function Sheet({ wo }: { wo: OpsWorkOrder }) {
  const router = useRouter();
  const repairs = useRepairs();
  const inspections = useInspections();
  const p = getProject(wo.projectId);
  const model = useMemo(() => (p ? modelForProject(p) : undefined), [p]);
  const asset = model ? assetOf(model, wo.asset) : undefined;
  const repair = repairs.find((r) => r.id === wo.repairId);
  const tech = team.find((m) => m.name === wo.technician);
  const issuer = team.find((m) => m.name === wo.issuedBy);
  const closed = wo.status === "done" || wo.status === "cancelled";

  const [hours, setHours] = useState(wo.hours !== undefined ? String(wo.hours) : "");
  const [cost, setCost] = useState(wo.cost !== undefined ? String(wo.cost) : "");
  const [summary, setSummary] = useState(wo.summary ?? "");
  const [parts, setParts] = useState(wo.parts ?? "");

  const patch = () => ({
    hours: hours ? Number(hours) : undefined,
    cost: cost ? Number(cost) : undefined,
    summary: summary.trim() || undefined,
    parts: parts.trim() || undefined,
  });
  const move = (status: WorkOrderStatus, text: string) => updateWorkOrder(wo.id, { ...patch(), status }, text);

  const { projectId, asset: assetCode } = wo;
  const history = useMemo(() => {
    const out: { at: string; text: string; href?: string }[] = [];
    for (const r of repairs.filter((x) => x.projectId === projectId && x.asset === assetCode)) {
      out.push({ at: r.reported, text: `${r.id} · แจ้งซ่อม ${r.title} · ${REPAIR_STATUS_LABEL[r.status]}`, href: `/repairs?q=${r.id}` });
      if (r.closed) out.push({ at: r.closed, text: `${r.id} · ปิดงานซ่อม` });
    }
    if (asset) {
      const floorTag = `ชั้น ${asset.floor}`;
      for (const i of inspections.filter((x) => x.projectId === projectId && x.result !== "scheduled" && x.systems.includes(asset.system) && (x.location === floorTag || x.location === "ทั้งหลัง")))
        out.push({ at: i.date, text: `${i.id} · ${i.title} · ${i.result === "pass" ? "ผ่าน" : "ไม่ผ่าน"}${i.score !== undefined ? ` (คะแนน ${i.score.toFixed(0)})` : ""}`, href: `/inspections/${i.id}` });
      out.push({ at: asset.installed, text: `ติดตั้ง ${asset.name} · ${asset.brand}` });
      if (p?.handedOver) out.push({ at: p.handedOver, text: "ส่งมอบบ้านให้ลูกค้า" });
    }
    return out.sort((a, b) => b.at.localeCompare(a.at));
  }, [repairs, inspections, projectId, assetCode, asset, p]);

  return (
    <>
      <PrintStyle />
      <div className="ops-noprint flex flex-wrap items-center justify-between gap-3 pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/work-orders" className="mr-1 inline-flex h-8 items-center gap-1.5 rounded-[8px] px-2 text-[13px] text-ink-2 transition-colors duration-150 hover:bg-raised hover:text-ink">
            <ArrowLeft {...I} />
            กลับ
          </Link>
          <Pill mono>{wo.id}</Pill>
          <Pill tone={SEV_TONE[wo.severity]}>{SEVERITY_LABEL[wo.severity]}</Pill>
          <Pill tone={WO_TONE[wo.status]}>{WO_STATUS_LABEL[wo.status]}</Pill>
          <Link href={`/repairs?q=${wo.repairId}`} className="text-[13px] text-accent-text hover:underline">
            อ้างอิง {wo.repairId}
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Btn primary onClick={() => window.print()}>
            <Printer {...I} />
            พิมพ์ใบงาน
          </Btn>
          <Btn
            danger
            onClick={() => {
              if (window.confirm(`ลบใบสั่งงาน ${wo.id}`)) {
                deleteWorkOrder(wo.id);
                router.push("/work-orders");
              }
            }}
          >
            <Trash2 {...I} />
          </Btn>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[1fr_360px]">
        {/* A4 job sheet */}
        <article className="ops-print mx-auto w-full max-w-[860px] rounded-[4px] border border-line bg-white px-12 py-10 text-ink shadow-[0_2px_12px_rgba(31,27,22,0.08)]">
          <DocHeader
            title="ใบสั่งงานซ่อม / บริการ"
            titleEn="WORK ORDER · JOB SHEET"
            code={wo.id}
            meta={
              <>
                <p>วันที่ออก {thDate(wo.issued)}</p>
                <p>นัดเข้างาน {thDate(wo.scheduled)}</p>
                <p>ความสำคัญ {SEVERITY_LABEL[wo.severity]}</p>
                <p>สถานะ {WO_STATUS_LABEL[wo.status]}</p>
              </>
            }
          />

          <DocSection n={1} title="ลูกค้าและสถานที่" en="CUSTOMER & SITE">
            <div className="grid grid-cols-2 gap-x-6">
              <DocRow k="ลูกค้า / เจ้าของบ้าน">{p?.owner ?? "–"}</DocRow>
              <DocRow k="โทรศัพท์">
                <span className="font-mono">{p?.phone ?? "–"}</span>
              </DocRow>
              <div className="col-span-2">
                <DocRow k="ที่อยู่หน้างาน">{p?.address ?? "–"}</DocRow>
              </div>
              <DocRow k="โครงการ">
                {wo.projectId} · {p?.name}
              </DocRow>
              <DocRow k="แบบบ้าน">
                {p?.modelCode} {p?.model}
              </DocRow>
              <DocRow k="วันส่งมอบบ้าน">{p?.handedOver ? thDate(p.handedOver) : "ยังไม่ส่งมอบ"}</DocRow>
              <DocRow k="ประกันบ้านถึง">{p?.warrantyUntil ? thDate(p.warrantyUntil) : "–"}</DocRow>
            </div>
          </DocSection>

          <DocSection n={2} title="งานที่ต้องดำเนินการ" en="SCOPE OF WORK">
            <p className="py-1.5 text-[14px] font-medium">
              ซ่อม: {repair?.title ?? wo.title} — {wo.asset} {asset ? assetLocation(model!, asset) : ""}
            </p>
            <div className="grid grid-cols-2 gap-x-6">
              <DocRow k="ระบบงาน">{repair ? SYSTEM_LABEL[repair.system] : asset ? SYSTEM_LABEL[asset.system] : "–"}</DocRow>
              <DocRow k="อ้างอิงแจ้งซ่อม">
                {wo.repairId}
                {repair ? ` (${thDate(repair.reported)})` : ""}
              </DocRow>
              <DocRow k="อาการที่แจ้ง">{repair?.title ?? "–"}</DocRow>
              <DocRow k="แหล่งที่มา">{repair ? SOURCE_LABEL[repair.source] : "–"}</DocRow>
              <DocRow k="ผู้แจ้ง">
                {repair?.reporter ?? p?.owner ?? "–"}
                {p?.phone && repair?.source !== "inspection" ? ` · ${p.phone}` : ""}
              </DocRow>
              <DocRow k="ประเภทงาน">{BILLING_LABEL[wo.billing]}</DocRow>
            </div>
            {repair?.detail && <p className="mt-2 rounded-[6px] border border-line-strong px-3 py-2 text-[13px]">{repair.detail}</p>}
          </DocSection>

          <DocSection n={3} title="ตำแหน่งอุปกรณ์" en="EQUIPMENT LOCATION">
            <div className="grid grid-cols-[1fr_280px] gap-5">
              <div>
                <DocRow k="รหัสอุปกรณ์">
                  <span className="font-mono">{wo.asset}</span>
                </DocRow>
                <DocRow k="รายการ">{asset?.name ?? repair?.assetName ?? "–"}</DocRow>
                <DocRow k="หมวด">{asset?.category ?? "–"}</DocRow>
                <DocRow k="ยี่ห้อ / รุ่น">{asset?.brand ?? "–"}</DocRow>
                <DocRow k="ตำแหน่ง">{asset && model ? assetLocation(model, asset) : (repair?.location ?? "–")}</DocRow>
                <DocRow k="ติดตั้งเมื่อ">{asset ? thDate(asset.installed) : "–"}</DocRow>
                <DocRow k="การรับประกัน">{asset ? (asset.warrantyUntil >= TODAY ? `อยู่ในประกัน ถึง ${thDate(asset.warrantyUntil)}` : `หมดประกัน ${thDate(asset.warrantyUntil)}`) : "–"}</DocRow>
                {asset?.circuit && <DocRow k="วงจร">{asset.circuit}</DocRow>}
              </div>
              <div className="overflow-hidden rounded-[6px] border border-line-strong">{model && <FloorPlan model={model} asset={asset} className="block h-auto w-full" />}</div>
            </div>
          </DocSection>

          <DocSection n={4} title="บันทึกการซ่อม / อะไหล่" en="SERVICE REPORT & PARTS">
            <div className="grid grid-cols-3 gap-x-6">
              <DocRow k="ชั่วโมงทำงาน">{wo.hours !== undefined ? `${wo.hours} ชม.` : "................"}</DocRow>
              <DocRow k="ค่าใช้จ่าย">{wo.cost !== undefined ? baht(wo.cost) : "................"}</DocRow>
              <DocRow k="ช่าง">{wo.technician}</DocRow>
            </div>
            <DocRow k="สรุปการซ่อม">{wo.summary ?? <span className="block h-10 border-b border-dashed border-line-strong" />}</DocRow>
            <DocRow k="อะไหล่ที่เปลี่ยน">{wo.parts ?? <span className="block h-10 border-b border-dashed border-line-strong" />}</DocRow>
            <div className="mt-2 text-[12px] text-ink-2">
              {wo.log.slice(0, 5).map((l, i) => (
                <p key={i}>
                  <span className="num mr-2 font-mono text-ink-3">{l.at}</span>
                  {l.text}
                </p>
              ))}
            </div>
          </DocSection>

          <Signatures roles={[{ role: "ลูกค้า / ผู้รับงาน", name: p?.owner }, { role: "ช่างผู้ปฏิบัติงาน", name: wo.technician }, { role: "หัวหน้างาน / ผู้ตรวจรับ", name: wo.issuedBy }]} />
        </article>

        {/* side panel */}
        <div className="ops-noprint flex flex-col gap-4">
          <Card>
            <CardHead title="อัปเดตสถานะงาน" action={<Pill tone={WO_TONE[wo.status]}>{WO_STATUS_LABEL[wo.status]}</Pill>} />
            <div className="flex flex-col gap-3 px-5 py-4">
              <div className="grid grid-cols-2 gap-2">
                <input value={hours} onChange={(e) => setHours(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="ชม. จริง" aria-label="ชั่วโมงทำงานจริง" className={inputCls} disabled={closed} />
                <input value={cost} onChange={(e) => setCost(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" placeholder="ค่าใช้จ่าย ฿" aria-label="ค่าใช้จ่าย" className={inputCls} disabled={closed} />
              </div>
              <textarea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="สรุปการซ่อม" aria-label="สรุปการซ่อม" className={cx(areaCls, "min-h-[64px]")} disabled={closed} />
              <textarea value={parts} onChange={(e) => setParts(e.target.value)} placeholder="อะไหล่ที่เปลี่ยน" aria-label="อะไหล่ที่เปลี่ยน" className={cx(areaCls, "min-h-[52px]")} disabled={closed} />
              {!closed ? (
                <>
                  {wo.status !== "in_progress" && (
                    <Btn onClick={() => move("in_progress", wo.status === "on_hold" ? "กลับมาดำเนินการต่อ" : "ช่างเข้าดำเนินการ")}>
                      <Play {...I} />
                      {wo.status === "on_hold" ? "ดำเนินการต่อ" : "เริ่มงาน"}
                    </Btn>
                  )}
                  <Btn primary onClick={() => move("done", `ปิดงาน${summary.trim() ? ` · ${summary.trim()}` : ""}`)}>
                    <Check {...I} />
                    ปิดงาน (เสร็จสิ้น)
                  </Btn>
                  <div className="grid grid-cols-2 gap-2">
                    <Btn onClick={() => wo.status !== "on_hold" && move("on_hold", "พักงาน")} disabled={wo.status === "on_hold"}>
                      <Pause {...I} />
                      พักงาน
                    </Btn>
                    <Btn danger onClick={() => window.confirm("ยกเลิกใบสั่งงานนี้") && move("cancelled", "ยกเลิกใบสั่งงาน")}>
                      <Ban {...I} />
                      ยกเลิก
                    </Btn>
                  </div>
                  <Btn small onClick={() => updateWorkOrder(wo.id, patch(), "บันทึกข้อมูลการซ่อม")}>
                    บันทึกข้อมูล
                  </Btn>
                </>
              ) : (
                <Btn onClick={() => updateWorkOrder(wo.id, { status: "in_progress" }, "เปิดงานอีกครั้ง")}>เปิดงานอีกครั้ง</Btn>
              )}
            </div>
            <ul className="border-t border-line px-5 py-3">
              {wo.log.map((l, i) => (
                <li key={i} className="py-1.5 text-[13px]">
                  <span className="num block font-mono text-[12px] text-ink-3">{l.at}</span>
                  {l.text}
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHead
              title={wo.asset}
              action={
                <Link href={`/projects/${wo.projectId}`} className="inline-flex items-center gap-1.5 text-[13px] text-ink-2 hover:text-ink">
                  <Box {...I} />
                  ดูใน 3D
                </Link>
              }
            />
            <div className="px-5 py-3">
              <AssetTag code={wo.asset} />
              <p className="mt-2">{asset?.name ?? repair?.assetName}</p>
              <p className="text-[13px] text-ink-3">
                {asset?.category} · {asset && model ? assetLocation(model, asset) : repair?.location}
              </p>
              {asset && <p className="mt-1 text-[13px] text-ink-3">ติดตั้ง {thDate(asset.installed)} · ประกันถึง {thDate(asset.warrantyUntil)}</p>}
            </div>
            <div className="border-t border-line px-5 py-3">
              <p className="mb-2 text-[13px] text-ink-2">ประวัติอุปกรณ์</p>
              <ul className="flex flex-col gap-2">
                {history.map((h, i) => (
                  <li key={i} className="text-[13px]">
                    <span className="num block font-mono text-[12px] text-ink-3">{thDate(h.at)}</span>
                    {h.href ? (
                      <Link href={h.href} className="hover:underline">
                        {h.text}
                      </Link>
                    ) : (
                      h.text
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </Card>

          <Card className="px-5 py-4">
            <div className="flex items-center gap-3">
              <Initials name={wo.technician} />
              <div>
                <p>{wo.technician}</p>
                <p className="text-[13px] text-ink-3">{tech?.skill ?? "ช่างบริการ"}</p>
              </div>
            </div>
            {tech && <p className="num mt-3 font-mono text-[13px] text-ink-2">{tech.phone}</p>}
            <p className="mt-2 text-[13px] text-ink-3">
              ออกโดย {wo.issuedBy}
              {issuer ? ` · ${issuer.phone}` : ""} · {thDate(wo.issued)}
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
