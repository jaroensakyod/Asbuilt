"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Banknote, Check, ClipboardCheck, FileText, Plus, Printer, Receipt, Save, Trash2, X } from "lucide-react";
import { Card, CardHead, cx, Field, inputCls, PageHeader, Status } from "@/components/ui";
import { areaCls, Btn, Empty, FilterField, I, IconBtn, Meter, Modal, Pill, Select, StatCard, useHydrated } from "@/components/ops/bits";
import { PrintSheet } from "@/components/accounting/bits";
import { MediaField, MediaStrip } from "@/components/media/media-field";
import { COMPANY_INFO, getProject, thDate, TODAY } from "@/lib/data";
import { COST_CODES, costEntries, wbsTasks, type CostCode, type CostEntry } from "@/lib/biz";
import { addDays, HOLIDAYS } from "@/lib/hr/payroll";
import { ACTIVE_SITES } from "@/lib/hr/seed";
import { attendance, employees, useRuns } from "@/lib/hr/store";
import { advances, labourSettings, pieceClaims, pieceContracts, useLabourSettings } from "@/lib/hr/labour-store";
import { CLAIM_STATUS_LABEL, type Advance, type ClaimStatus, type LabourSettings, type PieceRateClaim, type PieceRateContract } from "@/lib/hr/labour-types";
import { advanceBalance, advanceInstalment, claimAmount, claimOf, holidayOtIssues, minWageIssues, otCapIssues, qtyToDate, type ClaimAmount, type Issue } from "@/lib/hr/labour";
import type { AttendanceSheet, Employee } from "@/lib/hr/types";
import { bahtText, fmt, fmt0, HrTabs, siteName, SubTabs, useHrAccess } from "./bits";

type Tab = "piece" | "advances" | "compliance";

const CLAIM_TONE: Record<ClaimStatus, "warn" | "accent" | "pos" | "neutral" | "neg"> = { submitted: "warn", foreman: "warn", approved: "accent", paid: "pos", rejected: "neg" };

export function CrewView() {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const q = params.get("q") ?? "";
  const tab = (params.get("tab") as Tab | null) ?? (q.startsWith("ADV") ? "advances" : "piece");
  const claims = pieceClaims.use();
  const advs = advances.use();
  const setTab = (t: Tab) => router.push(t === "piece" ? path : `${path}?tab=${t}`);
  return (
    <>
      <div className="hr-noprint">
        <PageHeader eyebrow="บุคคล" title="ค่าแรงเหมา & เบิกล่วงหน้า" sub="สัญญาค่าแรงเหมากับทีมช่าง วัดผลงานรายงวด โฟร์แมนและวิศวกรอนุมัติก่อนจ่าย เงินเบิกล่วงหน้าหักคืนอัตโนมัติในรอบค่าแรง และตรวจสอบค่าจ้างขั้นต่ำ/OT ตามกฎหมายแรงงาน" />
        <HrTabs />
        <div className="mb-5">
          <SubTabs
            value={tab}
            onChange={setTab}
            options={[
              { key: "piece", label: "ค่าแรงเหมา", count: claims.filter((c) => c.status === "submitted" || c.status === "foreman").length || undefined },
              { key: "advances", label: "เบิกล่วงหน้า", count: advs.filter((a) => a.status === "pending").length || undefined },
              { key: "compliance", label: "ตรวจสอบกฎหมายแรงงาน" },
            ]}
          />
        </div>
      </div>
      {tab === "piece" && <PieceRate q={q} />}
      {tab === "advances" && <Advances q={q} />}
      {tab === "compliance" && <Compliance />}
    </>
  );
}

// ---------------- piece-rate ----------------

const costOf = (c: PieceRateClaim, k: PieceRateContract): CostEntry => ({
  id: `CE-PRQ-${c.id}`,
  projectId: c.projectId,
  costCode: k.costCode,
  date: c.paidAt ?? TODAY,
  source: "piecerate",
  ref: c.id,
  description: `ค่าแรงเหมา ${k.trade} · ${k.crewName} · ${c.qty} ${k.unit}`,
  amount: claimOf(c, k).gross,
});

function PieceRate({ q }: { q: string }) {
  const contracts = pieceContracts.use();
  const claims = pieceClaims.use();
  const costs = costEntries.use();
  const { me, edit, approve } = useHrAccess();
  const [site, setSite] = useState("");
  const [status, setStatus] = useState<"" | "open" | ClaimStatus>(q ? "" : "open");
  const [newContract, setNewContract] = useState(false);
  const [claimFor, setClaimFor] = useState<string | null>(null);
  const [paying, setPaying] = useState<PieceRateClaim | null>(null);
  const [rejecting, setRejecting] = useState<PieceRateClaim | null>(null);
  const [voucher, setVoucher] = useState<PieceRateClaim | null>(null);

  const canForeman = approve || ["foreman", "pm", "engineer"].includes(me.role);
  const canEngineer = ["engineer", "pm", "admin", "exec"].includes(me.role);
  const canPay = approve || edit;
  const canCreate = edit || ["foreman", "pm", "engineer"].includes(me.role);

  const byId = useMemo(() => new Map(contracts.map((k) => [k.id, k])), [contracts]);
  const costIds = useMemo(() => new Set(costs.map((c) => c.id)), [costs]);
  const period = TODAY.slice(0, 7);
  const amt = (c: PieceRateClaim) => {
    const k = byId.get(c.contractId);
    return k ? claimOf(c, k) : claimAmount(0, 0, 0);
  };
  const unposted = claims.filter((c) => c.status === "paid" && !costIds.has(`CE-PRQ-${c.id}`) && byId.has(c.contractId));

  const shownContracts = contracts.filter((k) => !site || k.projectId === site);
  const shownClaims = claims
    .filter((c) => !site || c.projectId === site)
    .filter((c) => (status === "open" ? c.status === "submitted" || c.status === "foreman" || c.status === "approved" : !status || c.status === status))
    .sort((a, b) => b.periodTo.localeCompare(a.periodTo) || b.id.localeCompare(a.id));

  const step = (c: PieceRateClaim, to: ClaimStatus) => {
    if (to === "foreman") pieceClaims.upsert({ ...c, status: "foreman", foreman: { by: me.name, at: TODAY } });
    if (to === "approved") pieceClaims.upsert({ ...c, status: "approved", engineer: { by: me.name, at: TODAY } });
  };
  const postMissing = () => costEntries.upsertMany(unposted.map((c) => costOf(c, byId.get(c.contractId)!)));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="สัญญาเหมาที่ใช้งาน" value={contracts.filter((k) => k.status === "active").length} unit="สัญญา" />
        <StatCard label="รอโฟร์แมนรับรอง" value={claims.filter((c) => c.status === "submitted").length} unit="งวด" active={status === "submitted"} onClick={() => setStatus(status === "submitted" ? "open" : "submitted")} />
        <StatCard label="รอวิศวกรอนุมัติ" value={claims.filter((c) => c.status === "foreman").length} unit="งวด" active={status === "foreman"} onClick={() => setStatus(status === "foreman" ? "open" : "foreman")} />
        <StatCard label="อนุมัติแล้ว รอจ่าย" value={fmt0(claims.filter((c) => c.status === "approved").reduce((s, c) => s + amt(c).net, 0))} unit="บาท" active={status === "approved"} onClick={() => setStatus(status === "approved" ? "open" : "approved")} />
        <StatCard label="จ่ายแล้วเดือนนี้" value={fmt0(claims.filter((c) => c.status === "paid" && c.paidAt?.startsWith(period)).reduce((s, c) => s + amt(c).gross, 0))} unit="บาท" note="มูลค่างานก่อนหัก" />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <FilterField label="หน้างาน" className="w-full sm:w-[300px]">
          <Select label="หน้างาน" value={site} onChange={setSite}>
            <option value="">ทุกหน้างาน</option>
            {ACTIVE_SITES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} · {p.name}
              </option>
            ))}
          </Select>
        </FilterField>
        <div className="flex flex-wrap gap-2">
          {unposted.length > 0 && canPay && (
            <Btn onClick={postMissing} title="สร้างรายการต้นทุนโครงการ (source piecerate) ของงวดที่จ่ายแล้ว">
              <Receipt {...I} />
              ลงต้นทุนที่ค้าง ({unposted.length})
            </Btn>
          )}
          {canCreate && (
            <Btn onClick={() => setClaimFor("")}>
              <ClipboardCheck {...I} />
              ส่งผลงาน
            </Btn>
          )}
          {canCreate && (
            <Btn primary onClick={() => setNewContract(true)}>
              <Plus {...I} />
              สัญญาเหมาใหม่
            </Btn>
          )}
        </div>
      </div>

      <Card>
        <CardHead title="สัญญาค่าแรงเหมา" meta={`${shownContracts.length} สัญญา`} />
        {shownContracts.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-ink-3">
                  <th className="px-5 py-2 font-normal">สัญญา / ทีม</th>
                  <th className="px-3 py-2 font-normal">หน้างาน</th>
                  <th className="px-3 py-2 font-normal">งาน</th>
                  <th className="px-3 py-2 text-right font-normal">อัตรา</th>
                  <th className="w-[200px] px-3 py-2 font-normal">ผลงานสะสม</th>
                  <th className="px-3 py-2 text-right font-normal">มูลค่าสะสม</th>
                  <th className="px-5 py-2 font-normal" />
                </tr>
              </thead>
              <tbody>
                {shownContracts.map((k) => {
                  const done = qtyToDate(claims, k.id);
                  const pct = k.estQty ? (done / k.estQty) * 100 : 0;
                  return (
                    <tr key={k.id} className="border-b border-line last:border-0">
                      <td className="px-5 py-2">
                        <span className="block">{k.crewName}</span>
                        <span className="font-mono text-[12px] text-ink-3">
                          {k.id} · {k.crewId}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="block truncate">{siteName(k.projectId)}</span>
                        <span className="font-mono text-[12px] text-ink-3">{k.projectId}</span>
                      </td>
                      <td className="max-w-[260px] px-3 py-2">
                        <span className="block">{k.trade}</span>
                        <span className="block truncate text-[12px] text-ink-3" title={k.description}>
                          {k.description}
                        </span>
                      </td>
                      <td className="num whitespace-nowrap px-3 py-2 text-right font-mono">
                        {fmt(k.rate, k.rate % 1 ? 2 : 0)}
                        <span className="text-ink-3"> /{k.unit}</span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="mb-1 flex justify-between font-mono text-[12px]">
                          <span>
                            {fmt(done, done % 1 ? 1 : 0)}
                            {k.estQty ? ` / ${fmt(k.estQty, 0)}` : ""} {k.unit}
                          </span>
                          {k.estQty ? <span className={cx(pct > 100 ? "text-neg" : "text-ink-3")}>{Math.round(pct)}%</span> : null}
                        </div>
                        <Meter value={pct} />
                      </td>
                      <td className="num px-3 py-2 text-right font-mono">{fmt(done * k.rate, 0)}</td>
                      <td className="px-5 py-2 text-right">
                        {canCreate && k.status === "active" && (
                          <Btn small onClick={() => setClaimFor(k.id)}>
                            ส่งผลงาน
                          </Btn>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>ยังไม่มีสัญญาค่าแรงเหมาในหน้างานนี้</Empty>
        )}
      </Card>

      <Card>
        <CardHead
          title="งวดผลงาน"
          meta={`${shownClaims.length} งวด`}
          action={
            <Select label="สถานะ" value={status} onChange={(v) => setStatus(v as typeof status)} className="h-8 w-[200px] text-[13px]">
              <option value="open">ค้างดำเนินการ</option>
              <option value="">ทั้งหมด</option>
              {(Object.keys(CLAIM_STATUS_LABEL) as ClaimStatus[]).map((s) => (
                <option key={s} value={s}>
                  {CLAIM_STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          }
        />
        {shownClaims.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-ink-3">
                  <th className="px-5 py-2 font-normal">งวด</th>
                  <th className="px-3 py-2 font-normal">สัญญา</th>
                  <th className="px-3 py-2 font-normal">ช่วงผลงาน</th>
                  <th className="px-3 py-2 text-right font-normal">ปริมาณ</th>
                  <th className="px-3 py-2 text-right font-normal">มูลค่างาน</th>
                  <th className="px-3 py-2 text-right font-normal">สุทธิ</th>
                  <th className="px-3 py-2 font-normal">สถานะ</th>
                  <th className="px-5 py-2 text-right font-normal" />
                </tr>
              </thead>
              <tbody>
                {shownClaims.map((c) => {
                  const k = byId.get(c.contractId);
                  const a = amt(c);
                  return (
                    <tr key={c.id} className={cx("border-b border-line last:border-0", q === c.id && "bg-accent-soft/40")}>
                      <td className="px-5 py-2">
                        <span className="font-mono text-[12px]">{c.id}</span>
                        <span className="block text-[12px] text-ink-3">วัดโดย {c.measuredBy}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="block">{k?.trade ?? c.contractId}</span>
                        <span className="block text-[12px] text-ink-3">
                          {k?.crewName} · {c.projectId}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-ink-2">
                        {thDate(c.periodFrom)} – {thDate(c.periodTo)}
                      </td>
                      <td className="num whitespace-nowrap px-3 py-2 text-right font-mono">
                        {fmt(c.qty, c.qty % 1 ? 1 : 0)} <span className="text-ink-3">{k?.unit}</span>
                      </td>
                      <td className="num px-3 py-2 text-right font-mono">{fmt(a.gross)}</td>
                      <td className="num px-3 py-2 text-right font-mono">{fmt(a.net)}</td>
                      <td className="px-3 py-2">
                        <Pill tone={CLAIM_TONE[c.status]}>{CLAIM_STATUS_LABEL[c.status]}</Pill>
                        <span className="mt-0.5 block text-[12px] text-ink-3">
                          {c.status === "rejected" ? c.rejectedBy?.reason : [c.foreman && `โฟร์แมน ${c.foreman.by.split(" ")[0]}`, c.engineer && `วิศวกร ${c.engineer.by.split(" ")[0]}`].filter(Boolean).join(" · ")}
                        </span>
                        {c.status === "paid" && !costIds.has(`CE-PRQ-${c.id}`) && <span className="block text-[12px] text-warn">ยังไม่ลงต้นทุน</span>}
                      </td>
                      <td className="px-5 py-2">
                        <div className="flex justify-end gap-1.5">
                          {c.photos.length > 0 && <MediaStrip refs={c.photos} size={28} />}
                          {c.status === "submitted" && canForeman && (
                            <Btn small onClick={() => step(c, "foreman")}>
                              <Check {...I} />
                              โฟร์แมนรับรอง
                            </Btn>
                          )}
                          {c.status === "foreman" && canEngineer && (
                            <Btn small primary onClick={() => step(c, "approved")}>
                              <Check {...I} />
                              วิศวกรอนุมัติ
                            </Btn>
                          )}
                          {(c.status === "submitted" || c.status === "foreman") && (canForeman || canEngineer) && (
                            <IconBtn label="ไม่อนุมัติ" danger onClick={() => setRejecting(c)}>
                              <X {...I} />
                            </IconBtn>
                          )}
                          {c.status === "approved" && canPay && (
                            <Btn small primary onClick={() => setPaying(c)}>
                              <Banknote {...I} />
                              บันทึกจ่าย
                            </Btn>
                          )}
                          {(c.status === "paid" || c.status === "approved") && (
                            <IconBtn label="ใบสำคัญจ่าย" onClick={() => setVoucher(c)}>
                              <Printer {...I} />
                            </IconBtn>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>ไม่มีงวดผลงานตามตัวกรอง</Empty>
        )}
        <p className="border-t border-line px-5 py-2.5 text-[12px] text-ink-3">
          ขั้นตอน: ส่งผลงาน → โฟร์แมนรับรองปริมาณ → วิศวกรอนุมัติ → จ่าย (หักเงินประกันผลงาน ภาษีหัก ณ ที่จ่ายค่าจ้างทำของ และเงินเบิกล่วงหน้า) และลงต้นทุนโครงการอัตโนมัติ
        </p>
      </Card>

      {newContract && <ContractForm onClose={() => setNewContract(false)} />}
      {claimFor !== null && <ClaimForm contractId={claimFor} contracts={contracts.filter((k) => k.status === "active")} onClose={() => setClaimFor(null)} />}
      {paying && byId.get(paying.contractId) && <PayForm claim={paying} contract={byId.get(paying.contractId)!} onClose={() => setPaying(null)} />}
      {rejecting && <RejectForm claim={rejecting} onClose={() => setRejecting(null)} />}
      {voucher && byId.get(voucher.contractId) && <Voucher claim={voucher} contract={byId.get(voucher.contractId)!} onClose={() => setVoucher(null)} />}
    </div>
  );
}

function ContractForm({ onClose }: { onClose: () => void }) {
  const emps = employees.use();
  const tasks = wbsTasks.use();
  const settings = useLabourSettings();
  const { me } = useHrAccess();
  const crews = emps.filter((e) => e.status !== "resigned" && (e.type === "subcontract" || (e.type === "daily" && e.skill === "หัวหน้าช่าง")));
  const [crewId, setCrewId] = useState(crews[0]?.id ?? "");
  const crew = crews.find((e) => e.id === crewId);
  const [projectId, setProjectId] = useState(crew?.projectId ?? ACTIVE_SITES[0]?.id ?? "");
  const [trade, setTrade] = useState(crew?.type === "subcontract" ? crew.position : "");
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState("ตร.ม.");
  const [rate, setRate] = useState(0);
  const [estQty, setEstQty] = useState(0);
  const [taskId, setTaskId] = useState("");
  const [costCode, setCostCode] = useState<CostCode>("04");
  const [whtRate, setWhtRate] = useState(settings.crewWhtRate);
  const [retentionPct, setRetention] = useState(5);
  const siteTasks = tasks.filter((t) => t.projectId === projectId && !t.milestone);
  const ok = crew && projectId && trade.trim() && unit.trim() && rate > 0;

  const pickCrew = (id: string) => {
    setCrewId(id);
    const e = crews.find((x) => x.id === id);
    if (e?.projectId) setProjectId(e.projectId);
    if (e?.type === "subcontract") setTrade(e.position);
  };
  const pickTask = (id: string) => {
    setTaskId(id);
    const t = tasks.find((x) => x.id === id);
    if (t?.unit) setUnit(t.unit);
    if (t?.qty) setEstQty(t.qty);
    if (t?.costCode) setCostCode(t.costCode);
    if (t && !description) setDescription(t.name);
  };
  const save = () => {
    if (!ok) return;
    pieceContracts.upsert({
      id: pieceContracts.nextId(`PRC-${TODAY.slice(0, 4)}-`),
      projectId,
      crewId,
      crewName: crew!.name,
      trade: trade.trim(),
      description: description.trim(),
      unit: unit.trim(),
      rate,
      estQty: estQty || undefined,
      taskId: taskId || undefined,
      costCode,
      whtRate,
      retentionPct,
      start: TODAY,
      status: "active",
      createdBy: me.name,
    });
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="สัญญาค่าแรงเหมาใหม่"
      width={640}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!ok} onClick={save}>
            <Save {...I} />
            บันทึกสัญญา
          </Btn>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ทีมช่าง / หัวหน้าทีม">
          <select className={inputCls} value={crewId} onChange={(e) => pickCrew(e.target.value)}>
            {crews.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} · {e.type === "subcontract" ? `ทีม ${e.crewSize ?? ""} คน` : "หัวหน้าช่าง"} · {e.projectId}
              </option>
            ))}
          </select>
        </Field>
        <Field label="หน้างาน">
          <select className={inputCls} value={projectId} onChange={(e) => (setProjectId(e.target.value), setTaskId(""))}>
            {ACTIVE_SITES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} · {p.name}
              </option>
            ))}
          </select>
        </Field>
        {siteTasks.length > 0 && (
          <div className="sm:col-span-2">
            <Field label="งานในแผนงาน (WBS) ไม่บังคับ">
              <select className={inputCls} value={taskId} onChange={(e) => pickTask(e.target.value)}>
                <option value="">ไม่ผูกกับงานในแผน</option>
                {siteTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.code} {t.name}
                    {t.qty ? ` · ${t.qty} ${t.unit ?? ""}` : ""}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}
        <Field label="ประเภทงาน">
          <input className={inputCls} value={trade} onChange={(e) => setTrade(e.target.value)} placeholder="เช่น งานฉาบ งานกระเบื้อง งานเหล็กเสริม" />
        </Field>
        <Field label="รหัสต้นทุน">
          <select className={inputCls} value={costCode} onChange={(e) => setCostCode(e.target.value as CostCode)}>
            {(Object.keys(COST_CODES) as CostCode[]).map((c) => (
              <option key={c} value={c}>
                {c} · {COST_CODES[c]}
              </option>
            ))}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="รายละเอียดงาน">
            <input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="เช่น ฉาบปูนผนังภายใน หนาเฉลี่ย 1.5 ซม." />
          </Field>
        </div>
        <Field label="หน่วย">
          <input className={inputCls} value={unit} onChange={(e) => setUnit(e.target.value)} list="pr-units" />
        </Field>
        <datalist id="pr-units">
          {["ตร.ม.", "ม.", "ลบ.ม.", "ตัน", "ต้น", "จุด", "ชุด", "เหมา"].map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
        <Field label="อัตราต่อหน่วย (บาท)">
          <input type="number" min={0} className={cx(inputCls, "text-right font-mono")} value={rate || ""} onChange={(e) => setRate(Math.max(0, Number(e.target.value) || 0))} />
        </Field>
        <Field label="ปริมาณประมาณการ">
          <input type="number" min={0} className={cx(inputCls, "text-right font-mono")} value={estQty || ""} onChange={(e) => setEstQty(Math.max(0, Number(e.target.value) || 0))} />
        </Field>
        <Field label="มูลค่าสัญญาประมาณ">
          <input readOnly className={cx(inputCls, "text-right font-mono text-ink-2")} value={fmt(rate * estQty)} />
        </Field>
        <Field label="ภาษีหัก ณ ที่จ่าย (%)">
          <input type="number" min={0} max={15} step={0.5} className={cx(inputCls, "text-right font-mono")} value={whtRate} onChange={(e) => setWhtRate(Math.max(0, Number(e.target.value) || 0))} />
        </Field>
        <Field label="เงินประกันผลงาน (%)">
          <input type="number" min={0} max={20} step={0.5} className={cx(inputCls, "text-right font-mono")} value={retentionPct} onChange={(e) => setRetention(Math.max(0, Number(e.target.value) || 0))} />
        </Field>
      </div>
      <p className="mt-3 text-[12px] text-ink-3">ค่าจ้างทำของจ่ายให้บุคคลธรรมดาหักภาษี ณ ที่จ่าย 3% (ภ.ง.ด.3) ค่าเริ่มต้นตั้งได้ที่แท็บตรวจสอบกฎหมายแรงงาน</p>
    </Modal>
  );
}

function ClaimForm({ contractId, contracts, onClose }: { contractId: string; contracts: PieceRateContract[]; onClose: () => void }) {
  const claims = pieceClaims.use();
  const tasks = wbsTasks.use();
  const { me } = useHrAccess();
  const [cid, setCid] = useState(contractId || contracts[0]?.id || "");
  const k = contracts.find((x) => x.id === cid);
  const last = claims.filter((c) => c.contractId === cid && c.status !== "rejected").reduce((m, c) => (c.periodTo > m ? c.periodTo : m), "");
  const [from, setFrom] = useState(last ? addDays(last, 1) : addDays(TODAY, -14));
  const [to, setTo] = useState(TODAY);
  const [qty, setQty] = useState(0);
  const [taskId, setTaskId] = useState(k?.taskId ?? "");
  const [photos, setPhotos] = useState<PieceRateClaim["photos"]>([]);
  const [note, setNote] = useState("");
  const done = k ? qtyToDate(claims, k.id) : 0;
  const over = k?.estQty && done + qty > k.estQty;
  const a = k ? claimAmount(qty, k.rate, k.whtRate, k.retentionPct) : null;
  const siteTasks = tasks.filter((t) => t.projectId === k?.projectId && !t.milestone);
  const ok = k && qty > 0 && to >= from;
  const save = () => {
    if (!ok) return;
    pieceClaims.upsert({ id: pieceClaims.nextId(`PRQ-${TODAY.slice(0, 4)}-`), contractId: k!.id, projectId: k!.projectId, periodFrom: from, periodTo: to, qty, taskId: taskId || undefined, measuredBy: me.name, photos, note: note.trim() || undefined, status: "submitted" });
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="ส่งผลงานค่าแรงเหมา"
      width={600}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!ok} onClick={save}>
            ส่งให้โฟร์แมนรับรอง
          </Btn>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="สัญญา">
            <select className={inputCls} value={cid} onChange={(e) => setCid(e.target.value)}>
              {contracts.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.id} · {x.trade} · {x.crewName} · {x.projectId}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="ผลงานตั้งแต่">
          <input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="ถึง">
          <input type="date" className={inputCls} value={to} min={from} max={TODAY} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <Field label={`ปริมาณงวดนี้ (${k?.unit ?? ""})`}>
          <input type="number" min={0} step={0.1} className={cx(inputCls, "text-right font-mono")} value={qty || ""} onChange={(e) => setQty(Math.max(0, Number(e.target.value) || 0))} />
        </Field>
        {siteTasks.length > 0 ? (
          <Field label="งานในแผนงาน (WBS)">
            <select className={inputCls} value={taskId} onChange={(e) => setTaskId(e.target.value)}>
              <option value="">ไม่ระบุ</option>
              {siteTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code} {t.name}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <div />
        )}
        <div className="sm:col-span-2">
          <MediaField value={photos} onChange={setPhotos} label="รูปผลงาน" photosOnly />
        </div>
        <div className="sm:col-span-2">
          <Field label="หมายเหตุ">
            <textarea className={areaCls} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
      </div>
      {k && (
        <div className="mt-3 flex flex-col gap-1 text-[13px]">
          <p className="text-ink-2">
            สะสมก่อนงวดนี้ <span className="num font-mono">{fmt(done, done % 1 ? 1 : 0)}</span>
            {k.estQty ? ` จาก ${fmt(k.estQty, 0)}` : ""} {k.unit} · อัตรา <span className="num font-mono">{fmt(k.rate, 0)}</span> บาท/{k.unit}
            {a && (
              <>
                {" "}
                · มูลค่างวดนี้ <span className="num font-mono">{fmt(a.gross)}</span> บาท
              </>
            )}
          </p>
          {over && <p className="text-warn">ปริมาณสะสมจะเกินประมาณการของสัญญา ({fmt(done + qty, 1)} / {fmt(k.estQty!, 0)} {k.unit}) ตรวจสอบการวัดผลงานก่อนส่ง</p>}
        </div>
      )}
    </Modal>
  );
}

function Breakdown({ a, whtRate, retentionPct }: { a: ClaimAmount; whtRate: number; retentionPct: number }) {
  const row = (label: string, v: number, strong?: boolean) => (
    <div className={cx("flex justify-between py-1", strong && "border-t border-line-strong pt-2 font-medium")}>
      <span className={strong ? "" : "text-ink-2"}>{label}</span>
      <span className="num font-mono">{fmt(v)}</span>
    </div>
  );
  return (
    <div className="text-[13px]">
      {row("มูลค่างานงวดนี้", a.gross)}
      {retentionPct > 0 && row(`หักเงินประกันผลงาน ${retentionPct}%`, -a.retention)}
      {row(`หักภาษี ณ ที่จ่าย ${whtRate}%`, -a.wht)}
      {a.advance > 0 && row("หักเงินเบิกล่วงหน้า", -a.advance)}
      {row("จ่ายสุทธิ", a.net, true)}
    </div>
  );
}

function PayForm({ claim, contract, onClose }: { claim: PieceRateClaim; contract: PieceRateContract; onClose: () => void }) {
  const advs = advances.use();
  const claims = pieceClaims.use();
  const runs = useRuns();
  const open = advs.filter((a) => a.employeeId === contract.crewId && a.status === "approved").map((a) => ({ a, left: advanceBalance(a, runs, claims.filter((c) => c.id !== claim.id)).outstanding })).filter((x) => x.left > 0);
  const [advId, setAdvId] = useState(open[0]?.a.id ?? "");
  const pick = open.find((x) => x.a.id === advId);
  const [deduct, setDeduct] = useState(pick ? Math.min(advanceInstalment(pick.a), pick.left) : 0);
  const a = claimAmount(claim.qty, contract.rate, contract.whtRate, contract.retentionPct, advId ? deduct : 0);
  const pay = () => {
    const paid: PieceRateClaim = { ...claim, status: "paid", paidAt: TODAY, advanceId: advId && a.advance > 0 ? advId : undefined, advanceDeduct: advId && a.advance > 0 ? a.advance : undefined, costEntryId: `CE-PRQ-${claim.id}` };
    pieceClaims.upsert(paid);
    costEntries.upsert(costOf(paid, contract));
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`บันทึกจ่ายค่าแรงเหมา ${claim.id}`}
      width={520}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary onClick={pay}>
            <Banknote {...I} />
            บันทึกจ่าย {fmt(a.net)} บาท
          </Btn>
        </>
      }
    >
      <p className="mb-3 text-[13px] text-ink-2">
        {contract.crewName} · {contract.trade} · {fmt(claim.qty, claim.qty % 1 ? 1 : 0)} {contract.unit} × {fmt(contract.rate, 0)} บาท
      </p>
      {open.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-3">
          <Field label="หักเงินเบิกล่วงหน้า">
            <select
              className={inputCls}
              value={advId}
              onChange={(e) => {
                setAdvId(e.target.value);
                const x = open.find((o) => o.a.id === e.target.value);
                setDeduct(x ? Math.min(advanceInstalment(x.a), x.left) : 0);
              }}
            >
              <option value="">ไม่หัก</option>
              {open.map(({ a: x, left }) => (
                <option key={x.id} value={x.id}>
                  {x.id} · ค้าง {fmt0(left)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="จำนวนที่หัก">
            <input type="number" min={0} max={pick?.left} disabled={!advId} className={cx(inputCls, "text-right font-mono")} value={advId ? deduct || "" : ""} onChange={(e) => setDeduct(Math.max(0, Math.min(pick?.left ?? 0, Number(e.target.value) || 0)))} />
          </Field>
        </div>
      )}
      <Breakdown a={a} whtRate={contract.whtRate} retentionPct={contract.retentionPct} />
      <p className="mt-3 text-[12px] text-ink-3">
        เมื่อบันทึกจ่าย ระบบลงต้นทุนโครงการ {contract.projectId} รหัสต้นทุน {contract.costCode} มูลค่า {fmt(a.gross)} บาท (ก่อนหัก) และออกหนังสือรับรองการหักภาษี ณ ที่จ่ายได้จากใบสำคัญจ่าย
      </p>
    </Modal>
  );
}

function RejectForm({ claim, onClose }: { claim: PieceRateClaim; onClose: () => void }) {
  const { me } = useHrAccess();
  const [reason, setReason] = useState("");
  return (
    <Modal
      open
      onClose={onClose}
      title={`ไม่อนุมัติผลงาน ${claim.id}`}
      width={460}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn danger disabled={!reason.trim()} onClick={() => (pieceClaims.upsert({ ...claim, status: "rejected", rejectedBy: { by: me.name, at: TODAY, reason: reason.trim() } }), onClose())}>
            ไม่อนุมัติ
          </Btn>
        </>
      }
    >
      <Field label="เหตุผล">
        <textarea className={areaCls} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="เช่น ปริมาณไม่ตรงกับที่วัดจริง งานยังไม่ผ่าน QC" />
      </Field>
    </Modal>
  );
}

function Voucher({ claim, contract, onClose }: { claim: PieceRateClaim; contract: PieceRateContract; onClose: () => void }) {
  const crew = employees.use().find((e) => e.id === contract.crewId);
  const a = claimOf(claim, contract);
  const p = getProject(claim.projectId);
  return (
    <PrintSheet open onClose={onClose} title={`ใบสำคัญจ่ายค่าแรงเหมา ${claim.id}`}>
      <div className="flex items-start justify-between gap-6 border-b border-line pb-4">
        <div>
          <p className="text-[16px] font-medium">{COMPANY_INFO.name}</p>
          <p className="text-[12px] text-ink-2">{COMPANY_INFO.address}</p>
          <p className="text-[12px] text-ink-2">เลขประจำตัวผู้เสียภาษี {COMPANY_INFO.taxId}</p>
        </div>
        <div className="text-right">
          <p className="text-[18px] font-medium">ใบสำคัญจ่ายค่าแรงเหมา</p>
          <p className="font-mono text-[12px]">{claim.id}</p>
          <p className="text-[12px] text-ink-2">วันที่ {thDate(claim.paidAt ?? TODAY)}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-8 gap-y-1 py-4 text-[13px]">
        <p>
          <span className="text-ink-3">จ่ายให้ </span>
          {contract.crewName}
        </p>
        <p>
          <span className="text-ink-3">เลขประจำตัว </span>
          <span className="font-mono">{crew?.idNo ?? "-"}</span>
        </p>
        <p>
          <span className="text-ink-3">โครงการ </span>
          {claim.projectId} · {p?.name}
        </p>
        <p>
          <span className="text-ink-3">สัญญา </span>
          <span className="font-mono">{contract.id}</span>
        </p>
        <p className="col-span-2">
          <span className="text-ink-3">ผลงานงวด </span>
          {thDate(claim.periodFrom)} – {thDate(claim.periodTo)}
        </p>
      </div>
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-y border-line text-left text-ink-3">
            <th className="py-2 font-normal">รายการ</th>
            <th className="py-2 text-right font-normal">ปริมาณ</th>
            <th className="py-2 text-right font-normal">อัตรา</th>
            <th className="py-2 text-right font-normal">จำนวนเงิน</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-line">
            <td className="py-2">
              {contract.trade} · {contract.description}
            </td>
            <td className="num py-2 text-right font-mono">
              {fmt(claim.qty, claim.qty % 1 ? 2 : 0)} {contract.unit}
            </td>
            <td className="num py-2 text-right font-mono">{fmt(contract.rate)}</td>
            <td className="num py-2 text-right font-mono">{fmt(a.gross)}</td>
          </tr>
        </tbody>
      </table>
      <div className="ml-auto mt-3 w-full max-w-[320px]">
        <Breakdown a={a} whtRate={contract.whtRate} retentionPct={contract.retentionPct} />
      </div>
      <p className="mt-3 text-[13px]">({bahtText(a.net)})</p>
      <p className="mt-1 text-[12px] text-ink-3">ภาษีหัก ณ ที่จ่าย {contract.whtRate}% ค่าจ้างทำของ (มาตรา 3 เตรส) ยื่นแบบ ภ.ง.ด.3 · เงินประกันผลงานคืนเมื่อส่งมอบงานครบ</p>
      <div className="mt-12 grid grid-cols-3 gap-6 text-center text-[12px] text-ink-2">
        {["ผู้รับเงิน", "ผู้ตรวจสอบ (วิศวกร)", "ผู้อนุมัติจ่าย"].map((r, i) => (
          <div key={r}>
            <div className="mb-1 h-10 border-b border-line-strong" />
            {r}
            <p className="text-ink-3">{i === 1 ? claim.engineer?.by : i === 0 ? contract.crewName : ""}</p>
          </div>
        ))}
      </div>
    </PrintSheet>
  );
}

// ---------------- advances ----------------

function Advances({ q }: { q: string }) {
  const advs = advances.use();
  const claims = pieceClaims.use();
  const emps = employees.use();
  const runs = useRuns();
  const hydrated = useHydrated();
  const { me, approve, edit } = useHrAccess();
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [creating, setCreating] = useState(false);
  const [cash, setCash] = useState<Advance | null>(null);
  const name = (id: string) => emps.find((e) => e.id === id)?.name ?? id;
  const rows = useMemo(() => advs.map((a) => ({ a, b: advanceBalance(a, runs, claims) })), [advs, runs, claims]);
  const shown = rows.filter(({ a, b }) => filter === "all" || a.id === q || a.status === "pending" || (a.status === "approved" && b.outstanding > 0)).sort((x, y) => y.a.date.localeCompare(x.a.date));
  const outstanding = rows.filter((r) => r.a.status === "approved").reduce((s, r) => s + r.b.outstanding, 0);
  const decide = (a: Advance, status: "approved" | "rejected") => advances.upsert({ ...a, status, approvedBy: me.name });

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="รออนุมัติ" value={advs.filter((a) => a.status === "pending").length} unit="รายการ" />
        <StatCard label="ยอดคงค้างทั้งหมด" value={fmt0(outstanding)} unit="บาท" note={hydrated ? "หลังหักในรอบค่าแรงที่อนุมัติแล้ว" : undefined} />
        <StatCard label="ผู้มียอดค้าง" value={new Set(rows.filter((r) => r.a.status === "approved" && r.b.outstanding > 0).map((r) => r.a.employeeId)).size} unit="คน/ทีม" />
        <StatCard label="รออยู่ในร่างรอบค่าแรง" value={fmt0(rows.reduce((s, r) => s + r.b.inDraft, 0))} unit="บาท" />
      </div>
      <Card>
        <CardHead
          title="เงินเบิกล่วงหน้า"
          meta={`${shown.length} รายการ`}
          action={
            <div className="flex items-center gap-2">
              <SubTabs
                value={filter}
                onChange={setFilter}
                options={[
                  { key: "open", label: "ค้าง/รออนุมัติ" },
                  { key: "all", label: "ทั้งหมด" },
                ]}
              />
              {(edit || ["foreman", "pm"].includes(me.role)) && (
                <Btn small onClick={() => setCreating(true)}>
                  <Plus {...I} />
                  ขอเบิก
                </Btn>
              )}
            </div>
          }
        />
        {shown.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-ink-3">
                  <th className="px-5 py-2 font-normal">ผู้เบิก</th>
                  <th className="px-3 py-2 font-normal">เหตุผล</th>
                  <th className="px-3 py-2 text-right font-normal">จำนวน</th>
                  <th className="px-3 py-2 text-right font-normal">หักต่องวด</th>
                  <th className="px-3 py-2 text-right font-normal">คืนแล้ว</th>
                  <th className="w-[160px] px-3 py-2 font-normal">คงค้าง</th>
                  <th className="px-3 py-2 font-normal">สถานะ</th>
                  <th className="px-5 py-2" />
                </tr>
              </thead>
              <tbody>
                {shown.map(({ a, b }) => {
                  const back = b.recovered + b.payroll + b.crew;
                  return (
                    <tr key={a.id} className={cx("border-b border-line last:border-0", q === a.id && "bg-accent-soft/40")}>
                      <td className="px-5 py-2">
                        <span className="block">{name(a.employeeId)}</span>
                        <span className="font-mono text-[12px] text-ink-3">
                          {a.id} · {thDate(a.date)} · {a.projectId ?? "-"}
                        </span>
                      </td>
                      <td className="max-w-[220px] truncate px-3 py-2 text-ink-2" title={a.reason}>
                        {a.reason}
                      </td>
                      <td className="num px-3 py-2 text-right font-mono">{fmt0(a.amount)}</td>
                      <td className="num whitespace-nowrap px-3 py-2 text-right font-mono">
                        {fmt0(advanceInstalment(a))} <span className="text-ink-3">× {a.installments}</span>
                      </td>
                      <td className="num px-3 py-2 text-right font-mono" title={`เงินสด ${fmt0(b.recovered)} · รอบค่าแรง ${fmt0(b.payroll)} · ค่าเหมา ${fmt0(b.crew)}${b.inDraft ? ` · ในร่าง ${fmt0(b.inDraft)}` : ""}`}>
                        {fmt0(back)}
                        {b.inDraft > 0 && <span className="block text-[11px] text-ink-3">+ร่าง {fmt0(b.inDraft)}</span>}
                      </td>
                      <td className="px-3 py-2">
                        <div className="mb-1 flex justify-between font-mono text-[12px]">
                          <span className={cx(b.outstanding > 0 && a.status === "approved" ? "text-ink" : "text-ink-3")}>{fmt0(b.outstanding)}</span>
                          <span className="text-ink-3">{Math.round((back / a.amount) * 100)}%</span>
                        </div>
                        <Meter value={(back / a.amount) * 100} />
                      </td>
                      <td className="px-3 py-2">
                        {a.status === "pending" ? <Pill tone="warn">รออนุมัติ</Pill> : a.status === "rejected" ? <Pill tone="neg">ไม่อนุมัติ</Pill> : b.outstanding > 0 ? <Pill tone="accent">กำลังหักคืน</Pill> : <Pill tone="pos">คืนครบ</Pill>}
                      </td>
                      <td className="px-5 py-2">
                        <div className="flex justify-end gap-1.5">
                          {a.status === "pending" && approve && (
                            <>
                              <Btn small onClick={() => decide(a, "rejected")}>
                                <X {...I} />
                                ไม่อนุมัติ
                              </Btn>
                              <Btn small primary onClick={() => decide(a, "approved")}>
                                <Check {...I} />
                                อนุมัติ
                              </Btn>
                            </>
                          )}
                          {a.status === "approved" && b.outstanding > 0 && edit && (
                            <Btn small onClick={() => setCash(a)}>
                              รับเงินสด
                            </Btn>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>ไม่มีเงินเบิกล่วงหน้าค้าง</Empty>
        )}
        <p className="border-t border-line px-5 py-2.5 text-[12px] text-ink-3">
          เงินเบิกที่อนุมัติแล้วถูกหักในรอบเงินเดือน/ค่าแรงถัดไปตามจำนวนงวด (ไม่เกินสัดส่วนที่กำหนดของรายได้ต่องวด) หรือหักจากค่าแรงเหมาของทีมเมื่อบันทึกจ่าย
        </p>
      </Card>
      {creating && <AdvanceForm onClose={() => setCreating(false)} />}
      {cash && <CashForm adv={cash} left={rows.find((r) => r.a.id === cash.id)?.b.outstanding ?? 0} onClose={() => setCash(null)} />}
    </div>
  );
}

function AdvanceForm({ onClose }: { onClose: () => void }) {
  const emps = employees.use();
  const { me } = useHrAccess();
  const people = emps.filter((e) => e.status !== "resigned" && (e.type === "daily" || e.type === "subcontract" || e.type === "monthly"));
  const [employeeId, setEmployeeId] = useState(people.find((e) => e.type === "daily")?.id ?? "");
  const [amount, setAmount] = useState(0);
  const [installments, setInstallments] = useState(2);
  const [reason, setReason] = useState("");
  const e = people.find((x) => x.id === employeeId);
  const ok = e && amount > 0 && installments >= 1 && reason.trim();
  const save = () => {
    if (!ok) return;
    advances.upsert({ id: advances.nextId(`ADV-${TODAY.slice(0, 4)}-`), employeeId, projectId: e!.projectId, date: TODAY, amount, installments, reason: reason.trim(), status: "pending", requestedBy: me.name, recovered: [] });
    onClose();
  };
  const group = (t: Employee["type"]) => people.filter((x) => x.type === t);
  return (
    <Modal
      open
      onClose={onClose}
      title="ขอเบิกเงินล่วงหน้า"
      width={520}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!ok} onClick={save}>
            ส่งขออนุมัติ
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Field label="ผู้เบิก">
            <select className={inputCls} value={employeeId} onChange={(ev) => setEmployeeId(ev.target.value)}>
              {(["daily", "subcontract", "monthly"] as const).map((t) => (
                <optgroup key={t} label={t === "daily" ? "คนงานรายวัน" : t === "subcontract" ? "ทีมผู้รับเหมาค่าแรง" : "พนักงานรายเดือน"}>
                  {group(t).map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name} · {x.projectId ?? x.department}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>
        </div>
        <Field label="จำนวนเงิน (บาท)">
          <input type="number" min={0} step={100} className={cx(inputCls, "text-right font-mono")} value={amount || ""} onChange={(ev) => setAmount(Math.max(0, Number(ev.target.value) || 0))} />
        </Field>
        <Field label="ผ่อนหักกี่งวด">
          <input type="number" min={1} max={12} className={cx(inputCls, "text-right font-mono")} value={installments} onChange={(ev) => setInstallments(Math.max(1, Math.min(12, Number(ev.target.value) || 1)))} />
        </Field>
        <div className="col-span-2">
          <Field label="เหตุผล">
            <textarea className={areaCls} value={reason} onChange={(ev) => setReason(ev.target.value)} />
          </Field>
        </div>
      </div>
      <p className="mt-3 text-[13px] text-ink-2">
        หักงวดละ <span className="num font-mono">{fmt0(advanceInstalment({ amount, installments }))}</span> บาท{" "}
        {e?.type === "daily" && e.dailyRate ? `(ค่าแรงรายสัปดาห์ประมาณ ${fmt0(e.dailyRate * 6)} บาท)` : e?.type === "subcontract" ? "หักจากค่าแรงเหมาเมื่อบันทึกจ่าย" : ""}
      </p>
    </Modal>
  );
}

function CashForm({ adv, left, onClose }: { adv: Advance; left: number; onClose: () => void }) {
  const [amount, setAmount] = useState(left);
  const [date, setDate] = useState(TODAY);
  const [ref, setRef] = useState("เงินสด");
  return (
    <Modal
      open
      onClose={onClose}
      title={`รับชำระคืน ${adv.id}`}
      width={440}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={amount <= 0} onClick={() => (advances.upsert({ ...adv, recovered: [...adv.recovered, { date, amount: Math.min(amount, left), ref: ref.trim() || "เงินสด" }] }), onClose())}>
            บันทึก
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label={`จำนวน (ค้าง ${fmt0(left)})`}>
          <input type="number" min={0} max={left} className={cx(inputCls, "text-right font-mono")} value={amount || ""} onChange={(e) => setAmount(Math.max(0, Math.min(left, Number(e.target.value) || 0)))} />
        </Field>
        <Field label="วันที่">
          <input type="date" className={inputCls} value={date} max={TODAY} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <div className="col-span-2">
          <Field label="อ้างอิง">
            <input className={inputCls} value={ref} onChange={(e) => setRef(e.target.value)} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

// ---------------- compliance ----------------

const ISSUE_LABEL: Record<Issue["kind"], string> = { min_wage: "ค่าจ้างขั้นต่ำ", ot_cap: "OT เกินเพดาน", holiday_ot: "OT วันหยุด", deduct_cap: "หักเกินสัดส่วน" };

export function IssueList({ issues, empty = "ไม่พบประเด็น" }: { issues: Issue[]; empty?: string }) {
  if (!issues.length)
    return (
      <p className="px-5 py-6 text-[13px] text-ink-2">
        <Status tone="pos">{empty}</Status>
      </p>
    );
  return (
    <ul>
      {issues.map((i, k) => (
        <li key={`${i.kind}-${i.employeeId}-${k}`} className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-2.5 text-[13px] last:border-0">
          <Pill tone={i.tone}>{ISSUE_LABEL[i.kind]}</Pill>
          <span className="min-w-0 flex-1">
            <span className="font-medium">{i.name}</span> <span className="font-mono text-[12px] text-ink-3">{i.employeeId}</span>
            <span className="block text-ink-2">{i.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** min wage, weekly OT cap and holiday OT checks for a date window */
export function complianceIssues(emps: Employee[], sheets: AttendanceSheet[], from: string, to: string, settings: LabourSettings, only?: Set<string>): Issue[] {
  const byId = new Map(emps.map((e) => [e.id, e]));
  const nameOf = (id: string) => byId.get(id)?.name ?? id;
  const rateOf = (id: string) => byId.get(id)?.dailyRate;
  const keep = (i: Issue) => !only || only.has(i.employeeId);
  return [
    ...minWageIssues(emps, (pid) => (pid ? getProject(pid)?.province : undefined), settings),
    ...otCapIssues(sheets, from, to, nameOf, settings),
    ...holidayOtIssues(sheets, from, to, HOLIDAYS, rateOf, nameOf, settings),
  ].filter(keep);
}

function Compliance() {
  const emps = employees.use();
  const sheets = attendance.use();
  const settings = useLabourSettings();
  const { edit } = useHrAccess();
  const [from, setFrom] = useState(addDays(TODAY, -28));
  const [to, setTo] = useState(TODAY);
  const [editing, setEditing] = useState(false);
  const issues = useMemo(() => complianceIssues(emps, sheets, from, to, settings), [emps, sheets, from, to, settings]);
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
      <Card className="self-start">
        <CardHead title="ผลตรวจสอบค่าจ้างและเวลาทำงาน" meta={`${issues.length} ประเด็น`} />
        <div className="flex flex-wrap items-end gap-3 border-b border-line px-5 py-3">
          <FilterField label="ตั้งแต่" className="w-[170px]">
            <input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} />
          </FilterField>
          <FilterField label="ถึง" className="w-[170px]">
            <input type="date" className={inputCls} value={to} max={TODAY} onChange={(e) => setTo(e.target.value)} />
          </FilterField>
          <p className="pb-2 text-[12px] text-ink-3">จากอัตราค่าแรงพนักงานและใบลงเวลาหน้างาน</p>
        </div>
        <IssueList issues={issues} empty="ไม่พบประเด็น ค่าแรงไม่ต่ำกว่าขั้นต่ำ OT ไม่เกินเพดาน และไม่มี OT วันหยุดค้างจ่าย" />
      </Card>
      <Card className="self-start">
        <CardHead
          title="ตัวเลขตามกฎหมายแรงงาน"
          action={
            edit && (
              <Btn small onClick={() => setEditing(true)}>
                แก้ไข
              </Btn>
            )
          }
        />
        <div className="px-5 py-3 text-[13px]">
          {[
            ["OT วันทำงาน", `${settings.otMultiplier}× ค่าจ้างต่อชั่วโมง`],
            ["OT วันหยุด", `${settings.holidayOtMultiplier}× ค่าจ้างต่อชั่วโมง`],
            ["เพดาน OT รวมต่อสัปดาห์", `${settings.weeklyOtCap} ชม.`],
            ["ภาษีหัก ณ ที่จ่ายค่าแรงเหมา", `${settings.crewWhtRate}%`],
            ["หักรายได้ได้ไม่เกิน", `${Math.round(settings.maxDeductShare * 100)}% ของรายได้ต่องวด`],
            ["ค่าจ้างขั้นต่ำจังหวัดอื่น", `${settings.defaultMinWage} บาท/วัน`],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b border-line py-1.5">
              <span className="text-ink-3">{k}</span>
              <span className="num font-mono">{v}</span>
            </div>
          ))}
          <p className="mb-1 mt-3 text-ink-2">ค่าจ้างขั้นต่ำรายวันตามจังหวัด</p>
          {settings.minWage.map((m) => (
            <div key={m.province} className="flex justify-between border-b border-line py-1 last:border-0">
              <span>{m.province}</span>
              <span className="num font-mono">{m.rate}</span>
            </div>
          ))}
          <p className="mt-3 text-[12px] text-warn">ตรวจสอบกับประกาศคณะกรรมการค่าจ้างและพระราชบัญญัติคุ้มครองแรงงานฉบับล่าสุด ค่าเริ่มต้นเป็นค่าโดยประมาณ</p>
        </div>
      </Card>
      {editing && <SettingsForm value={settings} onClose={() => setEditing(false)} />}
    </div>
  );
}

function SettingsForm({ value, onClose }: { value: LabourSettings; onClose: () => void }) {
  const [s, setS] = useState<LabourSettings>(() => ({ ...value, minWage: value.minWage.map((m) => ({ ...m })) }));
  const num = (k: keyof LabourSettings, v: string) => setS((x) => ({ ...x, [k]: Math.max(0, Number(v) || 0) }));
  const save = () => {
    labourSettings.upsert({ ...s, minWage: s.minWage.filter((m) => m.province.trim() && m.rate > 0).map((m) => ({ province: m.province.trim(), rate: m.rate })) });
    onClose();
  };
  const field = (label: string, k: keyof LabourSettings, step = 1) => (
    <Field label={label}>
      <input type="number" min={0} step={step} className={cx(inputCls, "text-right font-mono")} value={String(s[k])} onChange={(e) => num(k, e.target.value)} />
    </Field>
  );
  return (
    <Modal
      open
      onClose={onClose}
      title="ตั้งค่าตัวเลขกฎหมายแรงงาน"
      width={620}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary onClick={save}>
            <Save {...I} />
            บันทึก
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {field("OT วันทำงาน (เท่า)", "otMultiplier", 0.5)}
        {field("OT วันหยุด (เท่า)", "holidayOtMultiplier", 0.5)}
        {field("เพดาน OT/สัปดาห์ (ชม.)", "weeklyOtCap")}
        {field("หัก ณ ที่จ่ายค่าเหมา (%)", "crewWhtRate", 0.5)}
        {field("หักได้ไม่เกิน (สัดส่วน 0–1)", "maxDeductShare", 0.05)}
        {field("ขั้นต่ำจังหวัดอื่น (บาท/วัน)", "defaultMinWage")}
      </div>
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[13px] text-ink-2">ค่าจ้างขั้นต่ำรายวันตามจังหวัด</p>
          <Btn small onClick={() => setS((x) => ({ ...x, minWage: [...x.minWage, { province: "", rate: x.defaultMinWage }] }))}>
            <Plus {...I} />
            เพิ่มจังหวัด
          </Btn>
        </div>
        <div className="flex flex-col gap-1.5">
          {s.minWage.map((m, i) => (
            <div key={i} className="flex items-center gap-2">
              <input className={cx(inputCls, "flex-1")} value={m.province} placeholder="จังหวัด" aria-label="จังหวัด" onChange={(e) => setS((x) => ({ ...x, minWage: x.minWage.map((y, j) => (j === i ? { ...y, province: e.target.value } : y)) }))} />
              <input type="number" min={0} className={cx(inputCls, "w-28 text-right font-mono")} value={m.rate || ""} aria-label={`ค่าจ้างขั้นต่ำ ${m.province}`} onChange={(e) => setS((x) => ({ ...x, minWage: x.minWage.map((y, j) => (j === i ? { ...y, rate: Math.max(0, Number(e.target.value) || 0) } : y)) }))} />
              <IconBtn label="ลบ" danger onClick={() => setS((x) => ({ ...x, minWage: x.minWage.filter((_, j) => j !== i) }))}>
                <Trash2 {...I} />
              </IconBtn>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-[12px] text-warn">
        <FileText {...I} />
        ตรวจสอบกับประกาศคณะกรรมการค่าจ้างล่าสุดก่อนใช้งาน
      </p>
    </Modal>
  );
}
