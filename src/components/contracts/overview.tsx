"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Banknote, FileDiff, Search, Settings2, UsersRound, X } from "lucide-react";
import { Card, cx, inputCls } from "@/components/ui";
import { STATUS_LABEL, TODAY } from "@/lib/data";
import { r2, sum, thDateSlash } from "@/lib/accounting/money";
import { BILLING_LABEL, contractSettings, useAccess, useContractSettings, useContractSummaries, type ContractSettings } from "@/lib/contracts";
import { Baht, Btn, CheckNote, CsvButton, Empty, FilterField, Header, I, Labeled, Meter, millions, Modal, numInput, Pill, ProjectLink, Select, StatCard, tableCls, td, tdR, th, thR, useHydrated } from "./bits";

export function ContractsOverview() {
  const rows = useContractSummaries();
  const { edit } = useAccess();
  const hydrated = useHydrated();
  const [q, setQ] = useState("");
  const [billing, setBilling] = useState("");
  const [status, setStatus] = useState("active");
  const [settings, setSettings] = useState(false);

  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return rows
      .filter((r) => !billing || r.terms.billing === billing)
      .filter((r) => (status === "active" ? r.project.status === "building" || r.project.status === "handover" || r.retentionHeld > r.retentionReleased : !status || r.project.status === status))
      .filter((r) => !n || `${r.project.id} ${r.project.name} ${r.project.owner}`.toLowerCase().includes(n))
      .sort((a, b) => b.contractValue - a.contractValue);
  }, [rows, q, billing, status]);

  const tot = (f: (r: (typeof rows)[number]) => number) => sum(shown.map(f));
  const contract = tot((r) => r.contractValue);
  const certified = tot((r) => r.certified);
  const retention = tot((r) => r.retentionHeld - r.retentionReleased);
  const advance = tot((r) => r.advanceOutstanding);
  const received = tot((r) => r.received);
  const pendingVo = shown.filter((r) => r.pendingVo).length;
  const filtered = q || billing || status !== "active";

  return (
    <>
      <Header
        eyebrow="สัญญา & เงินในสัญญา"
        title="สัญญาและการเบิกเงิน"
        sub="มูลค่าสัญญารวมงานเปลี่ยนแปลงที่อนุมัติ ผลงานที่รับรองแล้ว เงินประกันผลงานที่ลูกค้าหักไว้ เงินล่วงหน้าคงเหลือ และเงินที่รับแล้วของทุกโครงการ"
        actions={
          <>
            <Link href="/contracts/variations" className="inline-flex h-9 items-center gap-2 rounded-[8px] border border-line-strong bg-card px-4 text-[14px] font-medium hover:bg-raised">
              <FileDiff {...I} />
              งานเปลี่ยนแปลง
            </Link>
            <Link href="/subcontractors" className="inline-flex h-9 items-center gap-2 rounded-[8px] border border-line-strong bg-card px-4 text-[14px] font-medium hover:bg-raised">
              <UsersRound {...I} />
              ผู้รับเหมาช่วง
            </Link>
            <Link href="/cashflow" className="inline-flex h-9 items-center gap-2 rounded-[8px] border border-line-strong bg-card px-4 text-[14px] font-medium hover:bg-raised">
              <Banknote {...I} />
              กระแสเงินสด
            </Link>
            {edit && (
              <Btn onClick={() => setSettings(true)}>
                <Settings2 {...I} />
                ตั้งค่า
              </Btn>
            )}
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-5">
        <StatCard label="มูลค่าสัญญารวม" value={millions(contract)} unit="ล้านบาท" note={`${shown.length} โครงการ · งานเปลี่ยนแปลงรออนุมัติ ${pendingVo}`} />
        <StatCard label="ผลงานรับรอง/เรียกเก็บสะสม" value={millions(certified)} unit="ล้านบาท" note={contract ? `${r2((certified / contract) * 100)}% ของมูลค่าสัญญา` : "–"} />
        <StatCard label="เงินประกันผลงานถูกหัก" value={millions(retention)} unit="ล้านบาท" note="ลูกค้าหักไว้ รอคืนหลังพ้นระยะประกัน" />
        <StatCard label="เงินล่วงหน้าคงเหลือ" value={millions(advance)} unit="ล้านบาท" note="ยังต้องหักคืนจากการเบิกงวดถัดไป" />
        <StatCard label="รับเงินแล้ว" value={millions(received)} unit="ล้านบาท" note="รวม VAT หลังลูกค้าหัก ณ ที่จ่าย" />
      </div>

      <Card className="mb-4">
        <div className="grid grid-cols-2 gap-3 px-4 py-3 lg:grid-cols-5">
          <FilterField label="ค้นหา" className="col-span-2">
            <div className="relative">
              <Search {...I} className="pointer-events-none absolute left-2.5 top-2.5 text-ink-3" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="รหัส ชื่อโครงการ ลูกค้า" className={cx(inputCls, "w-full pl-8")} />
            </div>
          </FilterField>
          <FilterField label="รูปแบบการเบิก">
            <Select label="รูปแบบการเบิก" value={billing} onChange={setBilling}>
              <option value="">ทั้งหมด</option>
              <option value="installments">{BILLING_LABEL.installments}</option>
              <option value="measured">{BILLING_LABEL.measured}</option>
            </Select>
          </FilterField>
          <FilterField label="สถานะโครงการ">
            <Select label="สถานะโครงการ" value={status} onChange={setStatus}>
              <option value="active">กำลังดำเนินการ / มีเงินประกันค้าง</option>
              <option value="">ทุกสถานะ</option>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </FilterField>
          <div className="flex items-end justify-end">
            <CsvButton
              name={`contracts-${TODAY}`}
              rows={() => [["โครงการ", "ชื่อ", "รูปแบบการเบิก", "มูลค่าสัญญาเดิม", "งานเปลี่ยนแปลงอนุมัติ", "มูลค่าสัญญารวม", "ผลงานสะสม", "%", "เงินประกันคงค้าง", "เงินล่วงหน้าคงเหลือ", "รับเงินแล้ว", "ค้างรับ"], ...shown.map((r) => [r.project.id, r.project.name, BILLING_LABEL[r.terms.billing], r.base, r.approvedVo, r.contractValue, r.certified, r.certifiedPct, r2(r.retentionHeld - r.retentionReleased), r.advanceOutstanding, r.received, r.receivable])]}
            />
          </div>
        </div>
        <div className="flex items-center gap-3 border-t border-line px-4 py-2 text-[13px] text-ink-3">
          <span className="num font-mono text-[12px]">{shown.length} โครงการ</span>
          {filtered && (
            <button type="button" onClick={() => (setQ(""), setBilling(""), setStatus("active"))} className="inline-flex items-center gap-1 text-ink-2 hover:text-ink">
              <X {...I} />
              ล้างตัวกรอง
            </button>
          )}
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className={cx(tableCls, "min-w-[1100px]")}>
            <thead>
              <tr>
                <th className={cx(th, "pl-5")}>โครงการ</th>
                <th className={th}>การเบิก</th>
                <th className={thR}>สัญญาเดิม</th>
                <th className={thR}>งานเปลี่ยนแปลง</th>
                <th className={thR}>มูลค่าสัญญารวม</th>
                <th className={cx(th, "w-44")}>ผลงานสะสม</th>
                <th className={thR}>เงินประกันคงค้าง</th>
                <th className={thR}>เงินล่วงหน้าคงเหลือ</th>
                <th className={thR}>รับเงินแล้ว</th>
                <th className={cx(thR, "pr-5")}>ค้างรับ</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.project.id} className="hover:bg-raised/60">
                  <td className={cx(td, "pl-5")}>
                    <ProjectLink id={r.project.id} name={r.project.name} />
                  </td>
                  <td className={td}>
                    <Pill tone={r.terms.billing === "measured" ? "accent" : "neutral"}>{r.terms.billing === "measured" ? "IPC" : "งวด"}</Pill>
                    {r.openCert && <span className="mt-1 block text-[12px] text-ink-3">งวดที่ {r.openCert.no} {r.openCert.status === "draft" ? "ร่าง" : "รอรับรอง"}</span>}
                  </td>
                  <td className={tdR}>
                    <Baht v={r.base} />
                  </td>
                  <td className={tdR}>
                    <Baht v={r.approvedVo} />
                    {r.pendingVo !== 0 && (
                      <span className="block text-[12px] text-ink-3">
                        รออนุมัติ <Baht v={r.pendingVo} />
                      </span>
                    )}
                  </td>
                  <td className={tdR}>
                    <Baht v={r.contractValue} strong />
                  </td>
                  <td className={td}>
                    <div className="flex items-center justify-between gap-2 text-[12px]">
                      <Baht v={r.certified} />
                      <span className="num font-mono text-ink-3">{r.certifiedPct.toFixed(0)}%</span>
                    </div>
                    <div className="mt-1.5">
                      <Meter value={r.certifiedPct} mark={r.project.actual} />
                    </div>
                  </td>
                  <td className={tdR}>
                    <Baht v={r2(r.retentionHeld - r.retentionReleased)} />
                    {hydrated && r.retentionDue && r.retentionHeld > r.retentionReleased && (
                      <span className={cx("block text-[12px]", r.retentionDue <= TODAY ? "text-warn" : "text-ink-3")}>คืนได้ {thDateSlash(r.retentionDue)}</span>
                    )}
                  </td>
                  <td className={tdR}>
                    <Baht v={r.advanceOutstanding} />
                  </td>
                  <td className={tdR}>
                    <Baht v={r.received} />
                  </td>
                  <td className={cx(tdR, "pr-5")}>
                    <Baht v={r.receivable} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {shown.length === 0 && <Empty>ไม่พบโครงการตามตัวกรอง</Empty>}
      </Card>
      <p className="mt-3 text-[12px] text-ink-3">ขีดบนแถบผลงานคือความคืบหน้าจริงหน้างาน · โครงการแบบงวดแสดงยอดงวดที่ออกใบแจ้งหนี้แล้ว · ตัวเลขไม่รวม VAT ยกเว้นช่องรับเงิน/ค้างรับ</p>

      {settings && <SettingsModal onClose={() => setSettings(false)} />}
    </>
  );
}

function SettingsModal({ onClose }: { onClose: () => void }) {
  const cur = useContractSettings();
  const [f, setF] = useState<ContractSettings>(cur);
  const num = (k: keyof ContractSettings) => (
    <input className={numInput} inputMode="decimal" value={String(f[k])} onChange={(e) => setF({ ...f, [k]: Number(e.target.value) || 0 })} />
  );
  return (
    <Modal
      open
      onClose={onClose}
      title="ตั้งค่าสัญญาและการเบิกเงิน"
      width={640}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn
            primary
            onClick={() => {
              contractSettings.upsert({ ...f, id: "settings" });
              onClose();
            }}
          >
            บันทึก
          </Btn>
        </>
      }
    >
      <p className="mb-3 text-[13px] text-ink-2">ค่าเริ่มต้นสำหรับสัญญาใหม่ แต่ละโครงการกำหนดเองได้ในหน้าสัญญาโครงการ</p>
      <div className="grid grid-cols-2 gap-3">
        <Labeled label="เงินประกันผลงาน (% ของแต่ละงวด)">{num("retentionPct")}</Labeled>
        <Labeled label="เพดานเงินประกัน (% ของมูลค่าสัญญา)">{num("retentionCapPct")}</Labeled>
        <Labeled label="ลูกค้านิติบุคคลหัก ณ ที่จ่าย (%)">{num("clientWhtRate")}</Labeled>
        <Labeled label="หัก ณ ที่จ่ายผู้รับเหมาช่วง (%)">{num("subWhtRate")}</Labeled>
        <Labeled label="ภาษีมูลค่าเพิ่ม (%)">{num("vatRate")}</Labeled>
        <Labeled label="ระยะประกันความชำรุดบกพร่อง (เดือน)">{num("defectsMonths")}</Labeled>
        <Labeled label="กำหนดชำระเงินงวด (วัน)">{num("certPayDays")}</Labeled>
        <Labeled label="แจ้งเตือนงานเปลี่ยนแปลงรออนุมัติเกิน (วัน)">{num("voApprovalDays")}</Labeled>
        <Labeled label="แจ้งเตือนประกันภัยผู้รับเหมาช่วงก่อนหมด (วัน)">{num("insuranceWarnDays")}</Labeled>
      </div>
      <div className="mt-3 flex flex-col gap-1">
        <CheckNote>อัตราหัก ณ ที่จ่ายค่าจ้างทำของ: นิติบุคคลผู้จ่ายโดยทั่วไป 3% ส่วนราชการ 1% · ตรวจสอบกับประกาศล่าสุด</CheckNote>
        <CheckNote>ระยะรับผิดความชำรุดบกพร่องตาม ป.พ.พ. ม.600 (1 ปี / 5 ปีสำหรับสิ่งปลูกสร้างกับพื้นดิน) และตามสัญญา · ตรวจสอบกับประกาศล่าสุด</CheckNote>
      </div>
    </Modal>
  );
}
