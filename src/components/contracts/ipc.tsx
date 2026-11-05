"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, FilePlus2, Printer, Send, Trash2 } from "lucide-react";
import { Card, CardHead, cx, inputCls } from "@/components/ui";
import { wbsTasks } from "@/lib/biz";
import { getProject, TODAY } from "@/lib/data";
import { fmt, r2 } from "@/lib/accounting/money";
import {
  CERT_STATUS_LABEL,
  CERT_STATUS_TONE,
  certCol,
  certifyClientCert,
  clientCertsOf,
  computeClientCert,
  progressOf,
  useAccess,
  useContractSettings,
  type CertX,
  type ContractSummary,
} from "@/lib/contracts";
import { Btn, CheckNote, Empty, I, Labeled, Mini, Modal, numInput, PrintSheet, StatusPill, tableCls, td, tdR, th, thR } from "./bits";
import { ClientCertDoc } from "./docs";

/** Client interim payment certificates of a project billed by measured progress. */
export function ClientCerts({ s }: { s: ContractSummary }) {
  const all = certCol.use();
  const { me, edit, approve } = useAccess();
  const certs = useMemo(() => clientCertsOf(all, s.project.id), [all, s.project.id]);
  const [form, setForm] = useState<CertX | "new" | null>(null);
  const [print, setPrint] = useState<CertX | null>(null);
  const [msg, setMsg] = useState("");
  const open = certs.find((c) => c.status === "draft" || c.status === "submitted");

  const certify = (c: CertX) => {
    const err = certifyClientCert(c, me.name);
    setMsg(err ?? `รับรองงวดที่ ${c.no} แล้ว ออกใบแจ้งหนี้ในระบบบัญชีลูกหนี้`);
  };

  return (
    <Card>
      <CardHead
        title="หนังสือรับรองผลงานและขอเบิกเงินงวด (IPC)"
        meta={`${certs.length} งวด`}
        action={
          edit &&
          !open && (
            <Btn small primary onClick={() => setForm("new")}>
              <FilePlus2 {...I} />
              เบิกงวดใหม่
            </Btn>
          )
        }
      />
      {msg && <p className="border-b border-line bg-raised px-5 py-2 text-[13px] text-ink-2">{msg}</p>}
      {certs.length ? (
        <div className="overflow-x-auto">
          <table className={cx(tableCls, "min-w-[1080px]")}>
            <thead>
              <tr>
                <th className={cx(th, "pl-5")}>งวด</th>
                <th className={thR}>ผลงานสะสม</th>
                <th className={thR}>งวดนี้</th>
                <th className={thR}>คืนเงินล่วงหน้า</th>
                <th className={thR}>VAT</th>
                <th className={thR}>เงินประกัน</th>
                <th className={thR}>หัก ณ ที่จ่าย</th>
                <th className={thR}>สุทธิ</th>
                <th className={th}>สถานะ</th>
                <th className={cx(th, "pr-5")} />
              </tr>
            </thead>
            <tbody>
              {[...certs].reverse().map((c) => (
                <tr key={c.id}>
                  <td className={cx(td, "pl-5")}>
                    งวดที่ {c.no}
                    <span className="block font-mono text-[12px] text-ink-3">ถึง {c.periodTo}</span>
                  </td>
                  <td className={tdR}>
                    <span className="num font-mono">{fmt(c.grossToDate)}</span>
                    <span className="block text-[12px] text-ink-3">{c.pctToDate ?? "–"}%</span>
                  </td>
                  <td className={tdR}>
                    <span className="num font-mono">{fmt(c.thisPeriod)}</span>
                  </td>
                  <td className={tdR}>
                    <span className="num font-mono">{fmt(c.advanceRecovery)}</span>
                  </td>
                  <td className={tdR}>
                    <span className="num font-mono">{fmt(c.vat)}</span>
                  </td>
                  <td className={tdR}>
                    <span className="num font-mono">{fmt(c.retention)}</span>
                  </td>
                  <td className={tdR}>
                    <span className="num font-mono">{fmt(c.wht)}</span>
                  </td>
                  <td className={tdR}>
                    <span className="num font-mono font-medium">{fmt(c.net)}</span>
                  </td>
                  <td className={td}>
                    <StatusPill k={c.status} labels={CERT_STATUS_LABEL} tones={CERT_STATUS_TONE} />
                    {c.status === "certified" && c.dueDate && <span className={cx("mt-1 block text-[12px]", c.dueDate < TODAY ? "text-neg" : "text-ink-3")}>ครบกำหนด {c.dueDate}</span>}
                    {c.invoiceNo && <span className="block font-mono text-[12px] text-ink-3">{c.invoiceNo}</span>}
                  </td>
                  <td className={cx(tdR, "pr-5")}>
                    <div className="flex justify-end gap-1.5">
                      <Btn small title="พิมพ์" onClick={() => setPrint(c)}>
                        <Printer {...I} />
                      </Btn>
                      {edit && c.status === "draft" && (
                        <>
                          <Btn small onClick={() => setForm(c)}>
                            แก้ไข
                          </Btn>
                          <Btn small onClick={() => certCol.upsert({ ...c, status: "submitted", submittedAt: TODAY })}>
                            <Send {...I} />
                            ส่งขอเบิก
                          </Btn>
                        </>
                      )}
                      {approve && c.status === "submitted" && (
                        <Btn small primary onClick={() => certify(c)}>
                          <Check {...I} />
                          รับรอง
                        </Btn>
                      )}
                      {c.status === "certified" && (
                        <Link href="/accounting/sales" className="inline-flex h-8 items-center rounded-[8px] border border-line-strong px-3 text-[13px] hover:bg-raised">
                          รับชำระ
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>ยังไม่มีการเบิกงวด</Empty>
      )}
      <p className="border-t border-line px-5 py-2 text-[12px] text-ink-3">
        เมื่อรับรอง ระบบออกใบแจ้งหนี้ให้ลูกค้า: ลูกหนี้ (1130) เงินประกันผลงาน (1135) ลดเงินรับล่วงหน้า (2120) รายได้ค่าก่อสร้าง (4110) และภาษีขายยังไม่ถึงกำหนด (2136) · รับชำระที่บัญชี &gt; ขาย
      </p>
      {form && <CertForm s={s} cert={form === "new" ? undefined : form} certs={certs} onClose={() => setForm(null)} />}
      <PrintSheet open={!!print} onClose={() => setPrint(null)} title="หนังสือรับรองผลงานและขอเบิกเงินงวด">
        {print && <ClientCertDoc c={print} projectName={s.project.name} owner={s.project.owner} terms={s.terms} contractValue={s.contractValue} />}
      </PrintSheet>
    </Card>
  );
}

function CertForm({ s, cert, certs, onClose }: { s: ContractSummary; cert?: CertX; certs: CertX[]; onClose: () => void }) {
  const settings = useContractSettings();
  const tasks = wbsTasks.use();
  const prog = progressOf(s.project.id, tasks, getProject(s.project.id) ?? s.project);
  const no = cert?.no ?? Math.max(0, ...certs.map((c) => c.no)) + 1;
  const [pctText, setPctText] = useState(String(cert?.pctToDate ?? prog.pct));
  const [periodTo, setPeriodTo] = useState(cert?.periodTo ?? TODAY);
  const [note, setNote] = useState(cert?.note ?? "");
  const pct = Math.min(100, Math.max(0, Number(pctText) || 0));
  const calc = computeClientCert(s.project.id, no, pct, { certs: certs.filter((c) => c.id !== cert?.id), terms: s.terms, settings, base: s.base, contractValue: s.contractValue });
  const prev = certs.filter((c) => c.no < no).at(-1);
  const err = !(pct > 0) ? "กรอก % ผลงานสะสม" : calc.thisPeriod < 0 ? "ผลงานสะสมน้อยกว่างวดก่อน" : periodTo < (prev?.periodTo ?? "") ? "วันที่ผลงานก่อนงวดที่แล้ว" : "";
  const basis = cert?.basis === "manual" || Math.abs(pct - prog.pct) > 0.001 ? "manual" : prog.basis;

  const save = () => {
    if (err) return;
    const c: CertX = {
      ...(cert ?? {}),
      id: cert?.id ?? `IPC-${s.project.id}-${no}`,
      projectId: s.project.id,
      side: "client",
      no,
      periodTo,
      date: TODAY,
      grossToDate: r2(calc.thisPeriod + (prev?.grossToDate ?? 0)),
      previous: prev?.grossToDate ?? 0,
      thisPeriod: calc.thisPeriod,
      retention: calc.retention,
      advanceRecovery: calc.advanceRecovery,
      backCharges: 0,
      vat: calc.vat,
      wht: calc.wht,
      net: calc.net,
      status: "draft",
      pctToDate: pct,
      basis,
      contractValue: s.contractValue,
      retentionPct: s.terms.retentionPct,
      whtRate: s.terms.whtRate,
      vatRate: settings.vatRate,
      note: note.trim() || undefined,
    };
    certCol.upsert(c);
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`เบิกเงินงวดที่ ${no} · ${s.project.name}`}
      width={720}
      footer={
        <>
          {err && <span className="mr-auto text-[13px] text-neg">{err}</span>}
          {cert && (
            <Btn
              danger
              onClick={() => {
                certCol.remove(cert.id);
                onClose();
              }}
            >
              <Trash2 {...I} />
              ลบร่าง
            </Btn>
          )}
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!!err} onClick={save}>
            บันทึกร่าง
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Labeled label="ผลงานสะสม (%)">
          <input className={numInput} inputMode="decimal" value={pctText} onChange={(e) => setPctText(e.target.value)} />
        </Labeled>
        <Labeled label="ผลงานถึงวันที่">
          <input type="date" className={inputCls} value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} />
        </Labeled>
        <Labeled label="หมายเหตุ" className="col-span-2">
          <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
        </Labeled>
      </div>
      <p className="mt-2 text-[12px] text-ink-3">
        {prog.basis === "wbs" ? `ความคืบหน้าจากแผนงาน (WBS) ถ่วงตามมูลค่างาน ${prog.pct}%` : `ยังไม่มีแผนงาน WBS ใช้ความคืบหน้าจริงของโครงการ ${prog.pct}%`}
        {basis === "manual" ? " · แก้ไขด้วยมือ" : ""} · มูลค่าสัญญารวมงานเปลี่ยนแปลง {fmt(s.contractValue)} บาท
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Mini label="ผลงานสะสม" value={fmt(r2(calc.thisPeriod + (prev?.grossToDate ?? 0)))} sub={`งวดก่อน ${fmt(prev?.grossToDate ?? 0)}`} />
        <Mini label="งวดนี้" value={fmt(calc.thisPeriod)} />
        <Mini label={`เงินประกัน ${s.terms.retentionPct}%`} value={fmt(calc.retention)} sub={`สะสม ${fmt(calc.retentionToDate)} / เพดาน ${fmt(calc.retentionCap)}`} />
        <Mini label="คืนเงินล่วงหน้า" value={fmt(calc.advanceRecovery)} sub={`สะสม ${fmt(calc.advanceToDate)}`} />
        <Mini label="ก่อน VAT" value={fmt(calc.base)} />
        <Mini label={`VAT ${settings.vatRate}%`} value={fmt(calc.vat)} />
        <Mini label={`หัก ณ ที่จ่าย ${s.terms.whtRate}%`} value={fmt(calc.wht)} />
        <Mini label="ขอเบิกสุทธิ" value={fmt(calc.net)} />
      </div>
      <div className="mt-3">
        <CheckNote>อัตราเงินประกัน เพดาน และอัตราหัก ณ ที่จ่ายตามเงื่อนไขสัญญาโครงการ · ตรวจสอบกับประกาศล่าสุด</CheckNote>
      </div>
    </Modal>
  );
}
