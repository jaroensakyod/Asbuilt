"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, Pencil, Plus, Undo2 } from "lucide-react";
import { Card, CardHead, cx, inputCls } from "@/components/ui";
import { installments } from "@/lib/biz";
import { getProject, thDate, TODAY, STATUS_LABEL } from "@/lib/data";
import { fmt, r2, sum } from "@/lib/accounting/money";
import {
  advanceAmount,
  BILLING_LABEL,
  certCol,
  contractTerms,
  invoiceAdvance,
  releaseClientRetention,
  retentionReleaseVat,
  scCol,
  subCertsOf,
  subRetentionDue,
  subRetentionHeld,
  summarize,
  termsFor,
  useAccess,
  useAllProjects,
  useContractSettings,
  voCol,
  type Billing,
  type ContractSummary,
  type ContractTerms,
  type SubcontractX,
} from "@/lib/contracts";
import { budgets } from "@/lib/biz";
import { Btn, CheckNote, Empty, Header, I, KV, Labeled, Mini, Modal, numInput, Pill, Segmented, StatCard, millions, tableCls, td, tdR, th, thR, useHydrated } from "./bits";
import { ClientCerts } from "./ipc";
import { SubcontractForm, SubcontractPanel, SubcontractTable } from "./subcontracts";
import { VariationsList } from "./variations-view";

type Tab = "summary" | "vo" | "billing" | "subs" | "retention";

export function ContractLedger({ projectId }: { projectId: string }) {
  const projects = useAllProjects();
  const hydrated = useHydrated();
  const p = projects.find((x) => x.id === projectId) ?? getProject(projectId);
  const terms = contractTerms.use();
  const settings = useContractSettings();
  const vos = voCol.use();
  const certs = certCol.use();
  const inst = installments.use();
  const budgetList = budgets.use();
  const s = useMemo(() => (p ? summarize(p, { terms, settings, vos, certs, inst, budgetList }) : undefined), [p, terms, settings, vos, certs, inst, budgetList]);
  const [tab, setTab] = useState<Tab>("summary");
  const [editTerms, setEditTerms] = useState(false);
  const { edit } = useAccess();
  if (!p || !s) return <Card>{hydrated ? <Empty>ไม่พบโครงการ {projectId}</Empty> : <div className="h-[40vh]" />}</Card>;

  return (
    <>
      <Link href="/contracts" className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-ink-2 hover:text-ink">
        <ArrowLeft {...I} />
        สัญญาทั้งหมด
      </Link>
      <Header
        eyebrow={`${p.id} · ${STATUS_LABEL[p.status]} · ${BILLING_LABEL[s.terms.billing]}`}
        title={p.name}
        sub={`${s.terms.customerName ?? p.owner}${s.terms.contractNo ? ` · สัญญาเลขที่ ${s.terms.contractNo}` : ""} · ${thDate(p.start)} – ${thDate(p.finish)}`}
        actions={
          edit && (
            <Btn onClick={() => setEditTerms(true)}>
              <Pencil {...I} />
              เงื่อนไขสัญญา
            </Btn>
          )
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-5">
        <StatCard label="มูลค่าสัญญารวม" value={millions(s.contractValue)} unit="ล้านบาท" note={`เดิม ${millions(s.base)} · งานเปลี่ยนแปลง ${s.approvedVo >= 0 ? "+" : ""}${millions(s.approvedVo)}`} />
        <StatCard label={s.terms.billing === "measured" ? "ผลงานรับรองสะสม" : "เรียกเก็บแล้ว"} value={`${s.certifiedPct.toFixed(1)}`} unit="%" note={`${fmt(s.certified)} บาท · หน้างาน ${p.actual}%`} />
        <StatCard label="เงินประกันผลงานถูกหัก" value={millions(r2(s.retentionHeld - s.retentionReleased))} unit="ล้านบาท" note={s.retentionDue ? `คืนได้ ${thDate(s.retentionDue)}` : `${s.terms.retentionPct}% เพดาน ${s.terms.retentionCapPct}%`} />
        <StatCard label="เงินล่วงหน้าคงเหลือ" value={millions(s.advanceOutstanding)} unit="ล้านบาท" note={s.advance ? `จาก ${millions(s.advance)} (${s.terms.advancePct}%)` : "ไม่มีเงินล่วงหน้า"} />
        <StatCard label="รับเงินแล้ว" value={millions(s.received)} unit="ล้านบาท" note={`ค้างรับ ${millions(s.receivable)} ล้าน${s.lastCert?.status === "certified" && s.lastCert.dueDate && s.lastCert.dueDate < TODAY ? " · เลยกำหนด" : ""}`} />
      </div>
      <div className="mb-4 overflow-x-auto">
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { key: "summary", label: "สรุปสัญญา" },
            { key: "vo", label: `งานเปลี่ยนแปลง ${s.voCount}` },
            { key: "billing", label: s.terms.billing === "measured" ? "เบิกงวด (IPC)" : "งวดเงิน" },
            { key: "subs", label: "ผู้รับเหมาช่วง" },
            { key: "retention", label: "เงินประกัน" },
          ]}
        />
      </div>
      {tab === "summary" && <SummaryTab s={s} />}
      {tab === "vo" && <VariationsList projectId={p.id} embedded />}
      {tab === "billing" && (s.terms.billing === "measured" ? <ClientCerts s={s} /> : <InstallmentsTab s={s} />)}
      {tab === "subs" && <SubsTab projectId={p.id} />}
      {tab === "retention" && <RetentionTab s={s} />}
      {editTerms && <TermsForm s={s} onClose={() => setEditTerms(false)} />}
    </>
  );
}

function SummaryTab({ s }: { s: ContractSummary }) {
  const { edit } = useAccess();
  const vos = voCol.use().filter((v) => v.projectId === s.project.id);
  const [msg, setMsg] = useState("");
  const t = s.terms;
  const adv = advanceAmount(t, s.base);
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
      <Card>
        <CardHead title="เงื่อนไขสัญญา" />
        <div className="grid grid-cols-1 gap-x-6 px-5 py-3 sm:grid-cols-2">
          <KV k="รูปแบบการเบิก">{BILLING_LABEL[t.billing]}</KV>
          <KV k="ลงนาม">{t.signedAt ? thDate(t.signedAt) : "–"}</KV>
          <KV k="เงินประกันผลงาน">
            {t.retentionPct}% เพดาน {t.retentionCapPct}% ของมูลค่าสัญญา
          </KV>
          <KV k="เงินล่วงหน้า">{t.advancePct ? `${t.advancePct}% (${fmt(adv)} บาท)` : "ไม่มี"}</KV>
          <KV k="ลูกค้าหัก ณ ที่จ่าย">{t.whtRate}%</KV>
          <KV k="กำหนดชำระ">{t.certPayDays} วันหลังรับรอง</KV>
          <KV k="ระยะประกันผลงาน">{t.defectsMonths} เดือนหลังส่งมอบ</KV>
          <KV k="ค่าปรับล่าช้า">{t.ldPerDay ? `${fmt(t.ldPerDay)} บาท/วัน` : "–"}</KV>
          <KV k="เลขผู้เสียภาษีลูกค้า">
            <span className="font-mono">{t.customerTaxId ?? "–"}</span>
          </KV>
          <KV k="ที่อยู่ออกใบกำกับ">{t.customerAddress ?? s.project.address ?? "–"}</KV>
        </div>
        <div className="border-t border-line px-5 py-2">
          <CheckNote>อัตราเงินประกัน ค่าปรับ และภาษีหัก ณ ที่จ่ายตามสัญญาและประกาศกรมสรรพากร · ตรวจสอบกับประกาศล่าสุด</CheckNote>
        </div>
      </Card>
      <div className="flex flex-col gap-4">
        <Card>
          <CardHead title="มูลค่าสัญญา" />
          <div className="grid grid-cols-2 gap-3 px-5 py-4">
            <Mini label="สัญญาเดิม" value={fmt(s.base)} />
            <Mini label="งานเปลี่ยนแปลงอนุมัติ" value={fmt(s.approvedVo)} sub={`${vos.filter((v) => v.status === "approved").length} รายการ · ขยายเวลา ${sum(vos.filter((v) => v.status === "approved").map((v) => v.days))} วัน`} />
            <Mini label="รออนุมัติ" value={fmt(s.pendingVo)} sub={`${vos.filter((v) => v.status === "submitted" || v.status === "priced").length} รายการ`} />
            <Mini label="มูลค่าสัญญารวม (ก่อน VAT)" value={fmt(s.contractValue)} sub={`รวม VAT ${fmt(r2(s.contractValue * 1.07))}`} />
          </div>
        </Card>
        {t.billing === "measured" && (
          <Card>
            <CardHead title="เงินล่วงหน้า" />
            <div className="px-5 py-4 text-[13px] text-ink-2">
              {!t.advancePct ? (
                <p>สัญญานี้ไม่มีเงินล่วงหน้า</p>
              ) : t.advanceDate ? (
                <>
                  <p>
                    ออกใบแจ้งหนี้ {thDate(t.advanceDate)} {t.advanceInvoiceNo ? <span className="font-mono">{t.advanceInvoiceNo}</span> : null} · {t.advancePaidDate ? `รับเงินแล้ว ${thDate(t.advancePaidDate)}` : "รอรับเงิน"}
                  </p>
                  <p className="mt-1">
                    หักคืนแล้ว {fmt(s.advanceRecovered)} บาท · คงเหลือ {fmt(s.advanceOutstanding)} บาท (หักคืนตามสัดส่วนผลงานทุกงวด)
                  </p>
                </>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <p>
                    เงินล่วงหน้า {t.advancePct}% = {fmt(adv)} บาท ยังไม่ได้เรียกเก็บ
                  </p>
                  {edit && (
                    <Btn small onClick={() => setMsg(invoiceAdvance(t, s.base) ?? "ออกใบแจ้งหนี้เงินล่วงหน้าแล้ว")}>
                      <FileText {...I} />
                      ออกใบแจ้งหนี้
                    </Btn>
                  )}
                </div>
              )}
              {msg && <p className="mt-2 text-ink">{msg}</p>}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function InstallmentsTab({ s }: { s: ContractSummary }) {
  const list = installments
    .use()
    .filter((i) => i.projectId === s.project.id)
    .sort((a, b) => a.no - b.no);
  const LABEL: Record<string, [string, "neutral" | "accent" | "pos" | "warn" | "neg"]> = { scheduled: ["ตามแผน", "neutral"], due: ["ถึงกำหนด", "accent"], invoiced: ["ออกใบแจ้งหนี้", "warn"], paid: ["ชำระแล้ว", "pos"], overdue: ["เกินกำหนด", "neg"] };
  return (
    <Card>
      <CardHead title="งวดเงินตามสัญญา" meta={`${list.length} งวด · รวม ${fmt(sum(list.map((i) => i.amount)))} บาท`} action={<Link href="/accounting/sales" className="text-[13px] text-ink-2 hover:text-ink">ออกใบแจ้งหนี้/รับชำระที่บัญชี</Link>} />
      {list.length ? (
        <table className={tableCls}>
          <thead>
            <tr>
              <th className={cx(th, "pl-5")}>งวด</th>
              <th className={th}>กำหนด</th>
              <th className={thR}>%</th>
              <th className={thR}>มูลค่า</th>
              <th className={thR}>VAT</th>
              <th className={cx(th, "pr-5")}>สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {list.map((i) => (
              <tr key={i.id}>
                <td className={cx(td, "pl-5")}>
                  {i.title}
                  {i.id.startsWith("INS-VO-") && <span className="block text-[12px] text-ink-3">จากงานเปลี่ยนแปลงที่อนุมัติ</span>}
                </td>
                <td className={td}>{thDate(i.dueDate)}</td>
                <td className={tdR}>
                  <span className="num font-mono">{i.percent}</span>
                </td>
                <td className={tdR}>
                  <span className="num font-mono">{fmt(i.amount)}</span>
                </td>
                <td className={tdR}>
                  <span className="num font-mono">{fmt(i.vat)}</span>
                </td>
                <td className={cx(td, "pr-5")}>
                  <Pill tone={LABEL[i.status]?.[1]}>{LABEL[i.status]?.[0] ?? i.status}</Pill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <Empty>ยังไม่มีงวดเงิน (สร้างจากใบเสนอราคาที่เซ็นสัญญาแล้ว)</Empty>
      )}
    </Card>
  );
}

function SubsTab({ projectId }: { projectId: string }) {
  const list = scCol.use().filter((sc) => sc.projectId === projectId);
  const { edit } = useAccess();
  const [open, setOpen] = useState<string | undefined>(list[0]?.id);
  const [form, setForm] = useState(false);
  const sel = list.find((x) => x.id === open);
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHead
          title="สัญญาจ้างเหมาช่วงของโครงการ"
          meta={`${list.length} สัญญา · ${fmt(sum(list.map((x) => x.value)))} บาท`}
          action={
            edit && (
              <Btn small onClick={() => setForm(true)}>
                <Plus {...I} />
                สัญญาใหม่
              </Btn>
            )
          }
        />
        <SubcontractTable list={list} showSub onOpen={(sc) => setOpen(sc.id)} selected={open} />
      </Card>
      {sel && <SubcontractPanel sc={sel} />}
      {form && <SubcontractForm projectId={projectId} onClose={() => setForm(false)} onSaved={(sc) => setOpen(sc.id)} />}
    </div>
  );
}

function RetentionTab({ s }: { s: ContractSummary }) {
  const { me, edit } = useAccess();
  const certs = certCol.use();
  const subs = scCol.use().filter((sc) => sc.projectId === s.project.id);
  const [msg, setMsg] = useState("");
  const t = s.terms;
  const held = r2(s.retentionHeld - s.retentionReleased);
  const due = s.retentionDue;
  const vat = retentionReleaseVat(certs, s.project.id);
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHead title="เงินประกันผลงานที่ลูกค้าหักไว้" />
        <div className="grid grid-cols-2 gap-3 px-5 py-4 lg:grid-cols-4">
          <Mini label="หักไว้สะสม" value={fmt(s.retentionHeld)} sub={`${t.retentionPct}% ของงวด เพดาน ${t.retentionCapPct}%`} />
          <Mini label="ภาษีขายรอถึงกำหนด" value={fmt(vat)} sub="ถึงกำหนดเมื่อรับเงินคืน" />
          <Mini label="ครบกำหนดคืน" value={due ? thDate(due) : "–"} sub={s.project.handedOver ? `ส่งมอบ ${thDate(s.project.handedOver)} + ${t.defectsMonths} เดือน` : "ยังไม่ส่งมอบงาน"} tone={due && due <= TODAY ? "pos" : undefined} />
          <Mini label="สถานะ" value={t.retentionRelease ? (t.retentionRelease.paidDate ? "รับคืนแล้ว" : "ขอคืนแล้ว") : held > 0 ? "ถือไว้" : "–"} sub={t.retentionRelease ? `${thDate(t.retentionRelease.date)} ${t.retentionRelease.invoiceNo ?? ""}` : undefined} />
        </div>
        {t.billing === "measured" && !t.retentionRelease && held > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3 text-[13px]">
            <p className="text-ink-2">{due && due <= TODAY ? "พ้นระยะประกันความชำรุดบกพร่องแล้ว ขอคืนเงินประกันได้" : "ยังไม่ครบระยะประกัน ขอคืนก่อนกำหนดได้เมื่อลูกค้าตกลง"}</p>
            {edit && (
              <Btn primary={!!due && due <= TODAY} onClick={() => setMsg(releaseClientRetention(t, me.name) ?? "ออกใบแจ้งหนี้ขอคืนเงินประกันผลงานแล้ว (ลูกหนี้เงินประกัน 1135 → ลูกหนี้การค้า 1130)")}>
                <Undo2 {...I} />
                ขอคืนเงินประกัน
              </Btn>
            )}
          </div>
        )}
        {msg && <p className="border-t border-line px-5 py-2 text-[13px] text-ink">{msg}</p>}
        <div className="border-t border-line px-5 py-2">
          <CheckNote>ป.พ.พ. ม.600: ผู้รับจ้างรับผิดในความชำรุดบกพร่องที่ปรากฏภายใน 1 ปีหลังส่งมอบ (5 ปีสำหรับสิ่งปลูกสร้างกับพื้นดิน) ระยะคืนเงินประกันตามสัญญา · ตรวจสอบกับประกาศล่าสุด</CheckNote>
        </div>
      </Card>
      <Card>
        <CardHead title="เงินประกันผลงานที่เราหักผู้รับเหมาช่วง" />
        {subs.length ? (
          <table className={tableCls}>
            <thead>
              <tr>
                <th className={cx(th, "pl-5")}>สัญญา</th>
                <th className={thR}>หักไว้</th>
                <th className={th}>ครบกำหนดคืน</th>
                <th className={cx(th, "pr-5")}>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((sc: SubcontractX) => {
                const h = subRetentionHeld(certs, sc.id);
                const d = subRetentionDue(sc);
                return (
                  <tr key={sc.id}>
                    <td className={cx(td, "pl-5")}>
                      <Link href={`/subcontractors/${sc.subcontractorId}?sc=${sc.id}`} className="hover:underline">
                        {sc.title}
                      </Link>
                      <span className="block font-mono text-[12px] text-ink-3">
                        {sc.id} · {subCertsOf(certs, sc.id).length} งวด
                      </span>
                    </td>
                    <td className={tdR}>
                      <span className="num font-mono">{fmt(h)}</span>
                    </td>
                    <td className={td}>{d ? thDate(d) : "หลังปิดงาน"}</td>
                    <td className={cx(td, "pr-5")}>{sc.retentionReleaseBillId ? <Pill tone="pos">คืนแล้ว</Pill> : h > 0 ? <Pill tone={d && d <= TODAY ? "warn" : "neutral"}>{d && d <= TODAY ? "ครบกำหนดคืน" : "ถือไว้"}</Pill> : <Pill>–</Pill>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <Empty>ไม่มีสัญญาจ้างเหมาช่วง</Empty>
        )}
      </Card>
    </div>
  );
}

function TermsForm({ s, onClose }: { s: ContractSummary; onClose: () => void }) {
  const settings = useContractSettings();
  const t0 = termsFor(contractTerms.all(), s.project.id, settings);
  const [t, setT] = useState<ContractTerms>({ ...t0, customerName: t0.customerName ?? s.project.owner });
  const locked = !!t0.advanceDate || certCol.all().some((c) => c.projectId === s.project.id && c.side === "client" && c.status !== "draft");
  const num = (k: keyof ContractTerms) => <input className={numInput} inputMode="decimal" value={String(t[k] ?? "")} onChange={(e) => setT({ ...t, [k]: Number(e.target.value) || 0 })} />;
  const text = (k: keyof ContractTerms, ph?: string) => <input className={inputCls} value={String(t[k] ?? "")} placeholder={ph} onChange={(e) => setT({ ...t, [k]: e.target.value || undefined })} />;
  return (
    <Modal
      open
      onClose={onClose}
      title={`เงื่อนไขสัญญา · ${s.project.name}`}
      width={720}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn
            primary
            onClick={() => {
              contractTerms.upsert({ ...t, id: `CT-${s.project.id}`, projectId: s.project.id });
              onClose();
            }}
          >
            บันทึก
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Labeled label="รูปแบบการเบิก">
          <select className={inputCls} value={t.billing} disabled={locked} onChange={(e) => setT({ ...t, billing: e.target.value as Billing, whtRate: e.target.value === "measured" && !t.whtRate && /^(บริษัท|นิติบุคคล|หจก|ห้างหุ้นส่วน)/.test(t.customerName ?? "") ? settings.clientWhtRate : t.whtRate })}>
            <option value="installments">{BILLING_LABEL.installments}</option>
            <option value="measured">{BILLING_LABEL.measured}</option>
          </select>
        </Labeled>
        <Labeled label="เลขที่สัญญา">{text("contractNo")}</Labeled>
        <Labeled label="เงินประกันผลงาน (% ของงวด)">{num("retentionPct")}</Labeled>
        <Labeled label="เพดานเงินประกัน (% ของสัญญา)">{num("retentionCapPct")}</Labeled>
        <Labeled label="เงินล่วงหน้า (% ของสัญญา)">{num("advancePct")}</Labeled>
        <Labeled label="ลูกค้าหัก ณ ที่จ่าย (%)">{num("whtRate")}</Labeled>
        <Labeled label="กำหนดชำระหลังรับรอง (วัน)">{num("certPayDays")}</Labeled>
        <Labeled label="ระยะประกันผลงาน (เดือน)">{num("defectsMonths")}</Labeled>
        <Labeled label="ค่าปรับล่าช้า (บาท/วัน)">{num("ldPerDay")}</Labeled>
        <Labeled label="ลงนามสัญญา">
          <input type="date" className={inputCls} value={t.signedAt ?? ""} onChange={(e) => setT({ ...t, signedAt: e.target.value || undefined })} />
        </Labeled>
        <Labeled label="ชื่อลูกค้าในใบกำกับภาษี" className="col-span-2">
          {text("customerName")}
        </Labeled>
        <Labeled label="เลขประจำตัวผู้เสียภาษีลูกค้า">{text("customerTaxId", "13 หลัก")}</Labeled>
        <Labeled label="สาขา">{text("customerBranch", "สำนักงานใหญ่")}</Labeled>
        <Labeled label="ที่อยู่ลูกค้า" className="col-span-2">
          {text("customerAddress")}
        </Labeled>
      </div>
      {locked && <p className="mt-2 text-[12px] text-ink-3">มีการเรียกเก็บเงินแล้ว จึงเปลี่ยนรูปแบบการเบิกไม่ได้</p>}
      <p className="mt-2 text-[12px] text-ink-3">เบิกตามผลงาน: งวดเงินตามสัญญาจากโมดูลขายของโครงการนี้จะถูกแทนด้วยหนังสือรับรองผลงาน (IPC) ในระบบบัญชี</p>
      <div className="mt-2">
        <CheckNote />
      </div>
    </Modal>
  );
}
