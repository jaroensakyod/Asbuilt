"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, CheckCheck, FilePlus2, Pencil, Plus, Printer, Send, Star, Trash2, Undo2 } from "lucide-react";
import { Card, CardHead, cx, inputCls } from "@/components/ui";
import { COST_CODES, supplierBills, wbsTasks, type CostCode } from "@/lib/biz";
import { thDate, TODAY } from "@/lib/data";
import { fmt, r2, sum } from "@/lib/accounting/money";
import {
  CERT_STATUS_LABEL,
  CERT_STATUS_TONE,
  certCol,
  certifySubCert,
  computeSubCert,
  postSubAdvance,
  projectName,
  ratingScore,
  releaseSubRetention,
  scCol,
  SC_STATUS_LABEL,
  SC_STATUS_TONE,
  subCertState,
  subCertsOf,
  subCol,
  subcontractValue,
  subRetentionDue,
  subRetentionHeld,
  useAccess,
  useAllProjects,
  useContractSettings,
  type BackCharge,
  type CertX,
  type SubcontractX,
  type SubRating,
} from "@/lib/contracts";
import { areaCls, Btn, CheckNote, COST_CODE_OPTIONS, Empty, I, IconBtn, Labeled, Meter, Mini, Modal, numInput, Pill, PrintSheet, StatusPill, tableCls, td, tdR, th, thR } from "./bits";
import { SubcontractDoc, SubCertDoc } from "./docs";

type Line = SubcontractX["lines"][number];

/** Table of subcontracts (of a project or of a subcontractor). */
export function SubcontractTable({ list, showProject, showSub, onOpen, selected }: { list: SubcontractX[]; showProject?: boolean; showSub?: boolean; onOpen?: (sc: SubcontractX) => void; selected?: string }) {
  const certs = certCol.use();
  const subs = subCol.use();
  const projects = useAllProjects();
  if (!list.length) return <Empty>ยังไม่มีสัญญาจ้างเหมาช่วง</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className={cx(tableCls, "min-w-[860px]")}>
        <thead>
          <tr>
            <th className={cx(th, "pl-5")}>สัญญา</th>
            {showSub && <th className={th}>ผู้รับเหมาช่วง</th>}
            {showProject && <th className={th}>โครงการ</th>}
            <th className={thR}>มูลค่า</th>
            <th className={cx(th, "w-40")}>เบิกสะสม</th>
            <th className={thR}>เงินประกันที่หักไว้</th>
            <th className={th}>ระยะเวลา</th>
            <th className={cx(th, "pr-5")}>สถานะ</th>
          </tr>
        </thead>
        <tbody>
          {list.map((sc) => {
            const mine = subCertsOf(certs, sc.id).filter((c) => c.status === "certified" || c.status === "paid");
            const gross = mine.at(-1)?.grossToDate ?? 0;
            const pct = sc.value ? (gross / sc.value) * 100 : 0;
            const sub = subs.find((s) => s.id === sc.subcontractorId);
            return (
              <tr key={sc.id} onClick={() => onOpen?.(sc)} className={cx("cursor-pointer hover:bg-raised/60", selected === sc.id && "bg-raised/60")}>
                <td className={cx(td, "pl-5")}>
                  {sc.title}
                  <span className="block font-mono text-[12px] text-ink-3">{sc.id}</span>
                </td>
                {showSub && <td className={td}>{sub?.name ?? sc.subcontractorId}</td>}
                {showProject && (
                  <td className={td}>
                    {projectName(sc.projectId, projects)}
                    <span className="block font-mono text-[12px] text-ink-3">{sc.projectId}</span>
                  </td>
                )}
                <td className={tdR}>
                  <span className="num font-mono">{fmt(sc.value)}</span>
                </td>
                <td className={td}>
                  <div className="flex justify-between text-[12px]">
                    <span className="num font-mono">{fmt(gross)}</span>
                    <span className={cx("num font-mono", pct > 100 ? "text-neg" : "text-ink-3")}>{pct.toFixed(0)}%</span>
                  </div>
                  <div className="mt-1.5">
                    <Meter value={pct} />
                  </div>
                </td>
                <td className={tdR}>
                  <span className="num font-mono">{fmt(subRetentionHeld(certs, sc.id))}</span>
                </td>
                <td className={td}>
                  <span className="text-[13px]">
                    {thDate(sc.start)} – {thDate(sc.finish)}
                  </span>
                </td>
                <td className={cx(td, "pr-5")}>
                  <StatusPill k={sc.status} labels={SC_STATUS_LABEL} tones={SC_STATUS_TONE} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** One subcontract: terms, BOQ lines with quantities measured to date, certificates and back-charges. */
export function SubcontractPanel({ sc }: { sc: SubcontractX }) {
  const { me, edit, approve } = useAccess();
  const all = certCol.use();
  const subs = subCol.use();
  const bills = supplierBills.use();
  const projects = useAllProjects();
  const certs = useMemo(() => subCertsOf(all, sc.id), [all, sc.id]);
  const sub = subs.find((s) => s.id === sc.subcontractorId);
  const [form, setForm] = useState(false);
  const [certForm, setCertForm] = useState<CertX | "new" | null>(null);
  const [bc, setBc] = useState(false);
  const [rate, setRate] = useState(false);
  const [print, setPrint] = useState<CertX | "sc" | null>(null);
  const [msg, setMsg] = useState("");
  const billed = certs.filter((c) => c.status === "certified" || c.status === "paid");
  const last = billed.at(-1);
  const latest = certs.at(-1);
  const gross = last?.grossToDate ?? 0;
  const held = subRetentionHeld(all, sc.id);
  const due = subRetentionDue(sc);
  const advanceLeft = r2(sc.advance - sum(billed.map((c) => c.advanceRecovery)));
  const pendingBc = (sc.backCharges ?? []).filter((b) => !b.certId);
  const openCert = certs.find((c) => c.status === "draft" || c.status === "submitted");
  const rated = sub?.ratings?.find((r) => r.subcontractId === sc.id);
  const pname = projectName(sc.projectId, projects);
  const measuredOf = (l: Line) => latest?.lines?.find((m) => m.lineId === l.id)?.qtyToDate ?? 0;

  return (
    <Card>
      <CardHead
        title={sc.title}
        meta={`${sc.id} · ${pname}`}
        action={
          <div className="flex flex-wrap justify-end gap-1.5">
            <Btn small onClick={() => setPrint("sc")}>
              <Printer {...I} />
              สรุปสัญญา
            </Btn>
            {edit && sc.status === "draft" && (
              <>
                <Btn small onClick={() => setForm(true)}>
                  <Pencil {...I} />
                  แก้ไข
                </Btn>
                <Btn
                  small
                  primary
                  disabled={sub?.prequal === "blacklisted" || sub?.prequal === "suspended"}
                  title={sub?.prequal === "blacklisted" || sub?.prequal === "suspended" ? "ผู้รับเหมาช่วงถูกระงับ/ห้ามใช้" : undefined}
                  onClick={() => {
                    const next: SubcontractX = { ...sc, status: "active", signedAt: TODAY };
                    scCol.upsert(next);
                    postSubAdvance(next);
                  }}
                >
                  <Check {...I} />
                  ลงนามสัญญา
                </Btn>
              </>
            )}
            {edit && sc.status === "active" && !openCert && (
              <Btn small primary onClick={() => setCertForm("new")}>
                <FilePlus2 {...I} />
                เบิกงวด
              </Btn>
            )}
            {edit && sc.status === "active" && (
              <Btn small onClick={() => scCol.upsert({ ...sc, status: "completed", completedAt: TODAY })}>
                <CheckCheck {...I} />
                ปิดงาน
              </Btn>
            )}
            {edit && sc.status === "completed" && !rated && (
              <Btn small onClick={() => setRate(true)}>
                <Star {...I} />
                ให้คะแนน
              </Btn>
            )}
            {edit && sc.status === "completed" && held > 0 && !sc.retentionReleaseBillId && (
              <Btn small onClick={() => setMsg(releaseSubRetention(sc) ?? "ตั้งหนี้คืนเงินประกันผลงานแล้ว (รอจ่ายที่บัญชีเจ้าหนี้)")}>
                <Undo2 {...I} />
                คืนเงินประกัน
              </Btn>
            )}
          </div>
        }
      />
      {msg && <p className="border-b border-line bg-raised px-5 py-2 text-[13px] text-ink-2">{msg}</p>}
      <div className="grid grid-cols-2 gap-3 px-5 py-4 lg:grid-cols-6">
        <Mini label="มูลค่าสัญญา" value={fmt(sc.value)} sub={sc.vat ? "ไม่รวม VAT 7%" : "ไม่จด VAT"} />
        <Mini label="เบิกสะสม (รับรองแล้ว)" value={fmt(gross)} sub={`${sc.value ? ((gross / sc.value) * 100).toFixed(0) : 0}% · คงเหลือ ${fmt(r2(sc.value - gross))}`} tone={gross > sc.value ? "neg" : undefined} />
        <Mini label={`เงินประกัน ${sc.retentionPct}%`} value={fmt(held)} sub={due ? `คืนได้ ${thDate(due)}` : "คืนหลังส่งมอบ + ระยะประกัน"} />
        <Mini label="เงินล่วงหน้าคงเหลือ" value={fmt(advanceLeft)} sub={`จ่ายไป ${fmt(sc.advance)}`} />
        <Mini label="หักค่าใช้จ่ายสะสม" value={fmt(sum((sc.backCharges ?? []).map((b) => b.amount)))} sub={`รอหักงวดถัดไป ${fmt(sum(pendingBc.map((b) => b.amount)))}`} />
        <Mini label="หัก ณ ที่จ่าย" value={`${sc.whtRate}%`} sub={sub ? sub.name : ""} />
      </div>

      <div className="border-t border-line">
        <p className="px-5 pt-3 text-[13px] font-medium">รายการงาน (BOQ)</p>
        <div className="overflow-x-auto">
          <table className={cx(tableCls, "min-w-[760px]")}>
            <thead>
              <tr>
                <th className={cx(th, "pl-5")}>รายการ</th>
                <th className={thR}>ปริมาณ</th>
                <th className={thR}>ค่าจ้าง/หน่วย</th>
                <th className={thR}>มูลค่า</th>
                <th className={thR}>วัดได้สะสม</th>
                <th className={cx(thR, "pr-5")}>%</th>
              </tr>
            </thead>
            <tbody>
              {sc.lines.map((l) => {
                const q = measuredOf(l);
                const over = q > l.qty + 1e-9;
                return (
                  <tr key={l.id}>
                    <td className={cx(td, "pl-5")}>
                      {l.description}
                      {l.taskId && <span className="block font-mono text-[12px] text-ink-3">{l.taskId}</span>}
                    </td>
                    <td className={tdR}>
                      <span className="num font-mono">{l.qty.toLocaleString("th-TH")}</span> {l.unit}
                    </td>
                    <td className={tdR}>
                      <span className="num font-mono">{fmt(l.rate)}</span>
                    </td>
                    <td className={tdR}>
                      <span className="num font-mono">{fmt(l.qty * l.rate)}</span>
                    </td>
                    <td className={tdR}>
                      <span className={cx("num font-mono", over && "text-neg")}>{q.toLocaleString("th-TH")}</span>
                    </td>
                    <td className={cx(tdR, "pr-5")}>
                      <span className={cx("num font-mono", over && "text-neg")}>{l.qty ? ((q / l.qty) * 100).toFixed(0) : 0}%</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="border-t border-line">
        <p className="px-5 pt-3 text-[13px] font-medium">ใบรับรองผลงาน / เบิกงวด</p>
        {certs.length ? (
          <div className="overflow-x-auto">
            <table className={cx(tableCls, "min-w-[980px]")}>
              <thead>
                <tr>
                  <th className={cx(th, "pl-5")}>งวด</th>
                  <th className={thR}>สะสม</th>
                  <th className={thR}>งวดนี้</th>
                  <th className={thR}>ประกัน</th>
                  <th className={thR}>ล่วงหน้า</th>
                  <th className={thR}>หักค่าใช้จ่าย</th>
                  <th className={thR}>VAT</th>
                  <th className={thR}>หัก 3%</th>
                  <th className={thR}>จ่ายสุทธิ</th>
                  <th className={th}>สถานะ</th>
                  <th className={cx(th, "pr-5")} />
                </tr>
              </thead>
              <tbody>
                {[...certs].reverse().map((c) => {
                  const st = subCertState(c);
                  const bill = c.billId ? bills.find((b) => b.id === c.billId) : undefined;
                  return (
                    <tr key={c.id}>
                      <td className={cx(td, "pl-5")}>
                        งวดที่ {c.no}
                        <span className="block font-mono text-[12px] text-ink-3">ถึง {c.periodTo}</span>
                      </td>
                      {[c.grossToDate, c.thisPeriod, c.retention, c.advanceRecovery, c.backCharges, c.vat, c.wht].map((v, i) => (
                        <td key={i} className={tdR}>
                          <span className="num font-mono">{fmt(v)}</span>
                        </td>
                      ))}
                      <td className={tdR}>
                        <span className="num font-mono font-medium">{fmt(c.net)}</span>
                      </td>
                      <td className={td}>
                        <StatusPill k={st} labels={CERT_STATUS_LABEL} tones={CERT_STATUS_TONE} />
                        {bill && (
                          <Link href="/accounting/purchases" className="block font-mono text-[12px] text-ink-3 hover:underline">
                            {bill.id}
                          </Link>
                        )}
                      </td>
                      <td className={cx(tdR, "pr-5")}>
                        <div className="flex justify-end gap-1.5">
                          <Btn small title="พิมพ์" onClick={() => setPrint(c)}>
                            <Printer {...I} />
                          </Btn>
                          {edit && c.status === "draft" && (
                            <>
                              <Btn small onClick={() => setCertForm(c)}>
                                แก้ไข
                              </Btn>
                              <Btn small onClick={() => certCol.upsert({ ...c, status: "submitted", submittedAt: TODAY })}>
                                <Send {...I} />
                                ส่งตรวจ
                              </Btn>
                            </>
                          )}
                          {approve && c.status === "submitted" && (
                            <Btn small primary onClick={() => setMsg(certifySubCert(c, me.name) ?? `รับรองงวดที่ ${c.no} แล้ว ตั้งหนี้ ${`BILL-${c.id}`} และบันทึกต้นทุนโครงการ`)}>
                              <Check {...I} />
                              รับรอง
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
          <Empty>ยังไม่มีการเบิกงวด</Empty>
        )}
      </div>

      <div className="border-t border-line">
        <div className="flex items-center justify-between px-5 pt-3">
          <p className="text-[13px] font-medium">รายการหักค่าใช้จ่าย (back-charge)</p>
          {edit && sc.status !== "draft" && (
            <Btn small onClick={() => setBc(true)}>
              <Plus {...I} />
              เพิ่ม
            </Btn>
          )}
        </div>
        {(sc.backCharges ?? []).length ? (
          <table className={tableCls}>
            <thead>
              <tr>
                <th className={cx(th, "pl-5")}>วันที่</th>
                <th className={th}>เหตุผล</th>
                <th className={thR}>จำนวนเงิน</th>
                <th className={cx(th, "pr-5")}>หักในงวด</th>
              </tr>
            </thead>
            <tbody>
              {(sc.backCharges ?? []).map((b) => (
                <tr key={b.id}>
                  <td className={cx(td, "pl-5")}>{thDate(b.date)}</td>
                  <td className={td}>{b.reason}</td>
                  <td className={tdR}>
                    <span className="num font-mono">{fmt(b.amount)}</span>
                  </td>
                  <td className={cx(td, "pr-5")}>
                    {b.certId ? (
                      <span className="font-mono text-[12px]">{b.certId}</span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Pill tone="warn">รอหัก</Pill>
                        {edit && (
                          <IconBtn label="ลบ" danger onClick={() => scCol.upsert({ ...sc, backCharges: (sc.backCharges ?? []).filter((x) => x.id !== b.id) })}>
                            <Trash2 {...I} />
                          </IconBtn>
                        )}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="px-5 pb-4 pt-2 text-[13px] text-ink-3">ไม่มีรายการหักค่าใช้จ่าย</p>
        )}
      </div>
      {rated && (
        <div className="border-t border-line px-5 py-3 text-[13px] text-ink-2">
          คะแนนหลังจบงาน <span className="num font-mono text-ink">{ratingScore(rated).toFixed(1)}</span> / 5 · {rated.note} · {rated.by}
        </div>
      )}

      {form && <SubcontractForm initial={sc} onClose={() => setForm(false)} />}
      {certForm && <SubCertForm sc={sc} cert={certForm === "new" ? undefined : certForm} certs={certs} onClose={() => setCertForm(null)} />}
      {bc && <BackChargeForm sc={sc} onClose={() => setBc(false)} />}
      {rate && sub && <RateForm sc={sc} onClose={() => setRate(false)} by={me.name} />}
      <PrintSheet open={!!print} onClose={() => setPrint(null)} title={print === "sc" ? "สรุปสัญญาจ้างเหมาช่วง" : "ใบรับรองผลงานผู้รับเหมาช่วง"}>
        {print === "sc" ? <SubcontractDoc sc={sc} sub={sub} projectName={pname} /> : print ? <SubCertDoc c={print} sc={sc} sub={sub} projectName={pname} /> : null}
      </PrintSheet>
    </Card>
  );
}

function SubCertForm({ sc, cert, certs, onClose }: { sc: SubcontractX; cert?: CertX; certs: CertX[]; onClose: () => void }) {
  const no = cert?.no ?? Math.max(0, ...certs.map((c) => c.no)) + 1;
  const prev = certs.filter((c) => c.no < no).at(-1);
  const start = (l: Line) => cert?.lines?.find((m) => m.lineId === l.id)?.qtyToDate ?? prev?.lines?.find((m) => m.lineId === l.id)?.qtyToDate ?? 0;
  const [qty, setQty] = useState<Record<string, string>>(() => Object.fromEntries(sc.lines.map((l) => [l.id, String(start(l))])));
  const [periodTo, setPeriodTo] = useState(cert?.periodTo ?? TODAY);
  const open = (sc.backCharges ?? []).filter((b) => !b.certId || b.certId === cert?.id);
  const [pick, setPick] = useState<Set<string>>(() => new Set(open.map((b) => b.id)));
  const measured = sc.lines.map((l) => ({ lineId: l.id, qtyToDate: Number(qty[l.id]) || 0 }));
  const bcs = open.filter((b) => pick.has(b.id));
  const calc = computeSubCert(sc, no, measured, sum(bcs.map((b) => b.amount)), certs.filter((c) => c.id !== cert?.id));
  const over = sc.lines.filter((l) => (Number(qty[l.id]) || 0) > l.qty);
  const err = calc.thisPeriod <= 0 && !bcs.length ? "ปริมาณสะสมต้องมากกว่างวดก่อน" : calc.net < 0 ? "ยอดหักมากกว่ามูลค่างานงวดนี้" : "";
  const save = () => {
    if (err) return;
    const id = cert?.id ?? `SPC-${sc.id}-${no}`;
    const c: CertX = {
      ...(cert ?? {}),
      id,
      projectId: sc.projectId,
      side: "sub",
      subcontractId: sc.id,
      no,
      periodTo,
      date: TODAY,
      grossToDate: r2(calc.thisPeriod + (prev?.grossToDate ?? 0)),
      previous: prev?.grossToDate ?? 0,
      thisPeriod: calc.thisPeriod,
      retention: calc.retention,
      advanceRecovery: calc.advanceRecovery,
      backCharges: calc.backCharges,
      vat: calc.vat,
      wht: calc.wht,
      net: calc.net,
      status: "draft",
      lines: measured,
      backChargeItems: bcs.map((b) => ({ ...b, certId: id })),
      retentionPct: sc.retentionPct,
      whtRate: sc.whtRate,
      vatRate: sc.vat ? 7 : 0,
      contractValue: sc.value,
    };
    certCol.upsert(c);
    scCol.upsert({ ...sc, backCharges: (sc.backCharges ?? []).map((b) => (pick.has(b.id) && (!b.certId || b.certId === id) ? { ...b, certId: id } : b.certId === id ? { ...b, certId: undefined } : b)) });
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`เบิกงวดที่ ${no} · ${sc.title}`}
      width={860}
      footer={
        <>
          {err && <span className="mr-auto text-[13px] text-neg">{err}</span>}
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!!err} onClick={save}>
            บันทึกร่าง
          </Btn>
        </>
      }
    >
      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Labeled label="ผลงานถึงวันที่">
          <input type="date" className={inputCls} value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} />
        </Labeled>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-[13px]">
          <thead>
            <tr className="text-left text-[12px] text-ink-3">
              <th className="py-1.5 font-normal">รายการ</th>
              <th className="w-24 py-1.5 text-right font-normal">ตามสัญญา</th>
              <th className="w-24 py-1.5 text-right font-normal">งวดก่อน</th>
              <th className="w-32 py-1.5 text-right font-normal">สะสมถึงงวดนี้</th>
              <th className="w-28 py-1.5 text-right font-normal">มูลค่าสะสม</th>
            </tr>
          </thead>
          <tbody>
            {sc.lines.map((l) => {
              const q = Number(qty[l.id]) || 0;
              return (
                <tr key={l.id} className="border-t border-line">
                  <td className="py-1.5">
                    {l.description}
                    <span className="block text-[12px] text-ink-3">
                      {fmt(l.rate)} / {l.unit}
                    </span>
                  </td>
                  <td className="num py-1.5 text-right font-mono">{l.qty.toLocaleString("th-TH")}</td>
                  <td className="num py-1.5 text-right font-mono text-ink-3">{(prev?.lines?.find((m) => m.lineId === l.id)?.qtyToDate ?? 0).toLocaleString("th-TH")}</td>
                  <td className="py-1.5 pl-2">
                    <input className={cx(numInput, "w-full", q > l.qty && "border-neg text-neg")} inputMode="decimal" value={qty[l.id]} onChange={(e) => setQty({ ...qty, [l.id]: e.target.value })} />
                  </td>
                  <td className="num py-1.5 text-right font-mono">{fmt(q * l.rate)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {over.length > 0 && <p className="mt-2 text-[12px] text-warn">วัดเกินปริมาณตามสัญญา {over.length} รายการ ต้องทำงานเปลี่ยนแปลงกับผู้รับเหมาช่วงก่อนจ่าย</p>}
      {open.length > 0 && (
        <div className="mt-3">
          <p className="text-[13px] text-ink-2">หักค่าใช้จ่ายในงวดนี้</p>
          {open.map((b) => (
            <label key={b.id} className="mt-1 flex items-center gap-2 text-[13px]">
              <input type="checkbox" checked={pick.has(b.id)} onChange={(e) => setPick((s) => (e.target.checked ? new Set([...s, b.id]) : new Set([...s].filter((x) => x !== b.id))))} />
              {b.reason} · <span className="num font-mono">{fmt(b.amount)}</span>
            </label>
          ))}
        </div>
      )}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Mini label="งวดนี้" value={fmt(calc.thisPeriod)} sub={`สะสม ${fmt(r2(calc.thisPeriod + (prev?.grossToDate ?? 0)))}`} />
        <Mini label={`เงินประกัน ${sc.retentionPct}%`} value={fmt(calc.retention)} />
        <Mini label="คืนเงินล่วงหน้า" value={fmt(calc.advanceRecovery)} />
        <Mini label="หักค่าใช้จ่าย" value={fmt(calc.backCharges)} />
        <Mini label="ก่อน VAT" value={fmt(calc.base)} />
        <Mini label="VAT" value={fmt(calc.vat)} />
        <Mini label={`หัก ณ ที่จ่าย ${sc.whtRate}%`} value={fmt(calc.wht)} />
        <Mini label="จ่ายสุทธิ" value={fmt(calc.net)} />
      </div>
      <p className="mt-3 text-[12px] text-ink-3">เมื่อรับรอง ระบบตั้งหนี้ผู้ขาย (หัก ณ ที่จ่าย {sc.whtRate}%, เงินประกันเข้า 2150) และบันทึกต้นทุนโครงการหมวด {sc.costCode ?? sc.lines[0]?.costCode}</p>
    </Modal>
  );
}

function BackChargeForm({ sc, onClose }: { sc: SubcontractX; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(TODAY);
  const n = r2(Number(amount) || 0);
  return (
    <Modal
      open
      onClose={onClose}
      title="หักค่าใช้จ่ายผู้รับเหมาช่วง"
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn
            primary
            disabled={!reason.trim() || !(n > 0)}
            onClick={() => {
              const list = sc.backCharges ?? [];
              const b: BackCharge = { id: `BC-${sc.id}-${list.length + 1}-${Date.now() % 10000}`, date, reason: reason.trim(), amount: n };
              scCol.upsert({ ...sc, backCharges: [...list, b] });
              onClose();
            }}
          >
            บันทึก
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Labeled label="วันที่">
          <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
        </Labeled>
        <Labeled label="จำนวนเงิน (ก่อน VAT)">
          <input className={numInput} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Labeled>
        <Labeled label="เหตุผล" className="col-span-2">
          <textarea className={areaCls} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="เช่น ค่าวัสดุที่บริษัทจ่ายแทน ค่าทำความสะอาด ค่าแก้ไขงานที่ไม่ได้มาตรฐาน" />
        </Labeled>
      </div>
      <p className="mt-2 text-[12px] text-ink-3">หักออกจากการเบิกงวดถัดไปของผู้รับเหมาช่วง และลดต้นทุนโครงการ</p>
    </Modal>
  );
}

function RateForm({ sc, onClose, by }: { sc: SubcontractX; onClose: () => void; by: string }) {
  const [r, setR] = useState({ quality: 4, time: 4, safety: 4, cooperation: 4 });
  const [note, setNote] = useState("");
  const LABEL = { quality: "คุณภาพงาน", time: "ตรงเวลา", safety: "ความปลอดภัย", cooperation: "การประสานงาน" } as const;
  return (
    <Modal
      open
      onClose={onClose}
      title="ประเมินผู้รับเหมาช่วงหลังจบงาน"
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn
            primary
            onClick={() => {
              const s = subCol.get(sc.subcontractorId);
              if (s) {
                const rating: SubRating = { subcontractId: sc.id, date: TODAY, ...r, note: note.trim() || undefined, by };
                subCol.upsert({ ...s, ratings: [...(s.ratings ?? []).filter((x) => x.subcontractId !== sc.id), rating] });
              }
              onClose();
            }}
          >
            บันทึกคะแนน
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        {(Object.keys(LABEL) as (keyof typeof LABEL)[]).map((k) => (
          <Labeled key={k} label={`${LABEL[k]} (1–5)`}>
            <select className={inputCls} value={r[k]} onChange={(e) => setR({ ...r, [k]: Number(e.target.value) })}>
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Labeled>
        ))}
        <Labeled label="ความเห็น" className="col-span-2">
          <textarea className={areaCls} value={note} onChange={(e) => setNote(e.target.value)} />
        </Labeled>
      </div>
      <p className="mt-2 text-[13px] text-ink-2">คะแนนเฉลี่ย {ratingScore(r).toFixed(1)}</p>
    </Modal>
  );
}

const blankLine = (id: string, costCode: CostCode): Line => ({ id, description: "", qty: 1, unit: "งาน", rate: 0, costCode });

/** Create or edit a subcontract (draft). */
export function SubcontractForm({ initial, projectId, subcontractorId, onClose, onSaved }: { initial?: SubcontractX; projectId?: string; subcontractorId?: string; onClose: () => void; onSaved?: (sc: SubcontractX) => void }) {
  const s = useContractSettings();
  const subs = subCol.use().filter((x) => x.prequal !== "blacklisted" || x.id === initial?.subcontractorId);
  const projects = useAllProjects().filter((p) => p.status === "building" || p.status === "planning" || p.status === "handover" || p.id === initial?.projectId);
  const tasks = wbsTasks.use();
  const [pid, setPid] = useState(initial?.projectId ?? projectId ?? projects[0]?.id ?? "");
  const [sid, setSid] = useState(initial?.subcontractorId ?? subcontractorId ?? subs.find((x) => x.prequal === "approved")?.id ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [costCode, setCostCode] = useState<CostCode>(initial?.costCode ?? "03");
  const [lines, setLines] = useState<Line[]>(initial?.lines.length ? initial.lines : [blankLine("L1", "03")]);
  const [retention, setRetention] = useState(String(initial?.retentionPct ?? s.retentionPct));
  const [advance, setAdvance] = useState(String(initial?.advance ?? 0));
  const [wht, setWht] = useState(String(initial?.whtRate ?? s.subWhtRate));
  const [vat, setVat] = useState(initial?.vat ?? true);
  const [start, setStart] = useState(initial?.start ?? TODAY);
  const [finish, setFinish] = useState(initial?.finish ?? TODAY);
  const projectTasks = tasks.filter((t) => t.projectId === pid);
  const value = subcontractValue(lines.map((l) => ({ qty: Number(l.qty) || 0, rate: Number(l.rate) || 0 })));
  const sub = subs.find((x) => x.id === sid);
  const err = !pid ? "เลือกโครงการ" : !sid ? "เลือกผู้รับเหมาช่วง" : !title.trim() ? "กรอกขอบเขตงาน" : !(value > 0) ? "เพิ่มรายการงานที่มีมูลค่า" : finish < start ? "วันสิ้นสุดก่อนวันเริ่ม" : "";
  const set = (i: number, patch: Partial<Line>) => setLines(lines.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  const save = () => {
    if (err) return;
    const id = initial?.id ?? scCol.nextId(`SC-${TODAY.slice(0, 4)}-`);
    const clean = lines.filter((l) => l.description.trim()).map((l, k) => ({ ...l, id: l.id || `${id}-L${k + 1}`, description: l.description.trim(), qty: Number(l.qty) || 0, rate: Number(l.rate) || 0, costCode: l.costCode ?? costCode }));
    const sc: SubcontractX = {
      ...(initial ?? {}),
      id,
      projectId: pid,
      subcontractorId: sid,
      title: title.trim(),
      lines: clean.map((l) => ({ ...l, id: l.id.startsWith("L") ? `${id}-${l.id}` : l.id })),
      value: subcontractValue(clean),
      retentionPct: Number(retention) || 0,
      advance: r2(Number(advance) || 0),
      whtRate: Number(wht) || 0,
      vat,
      start,
      finish,
      status: initial?.status ?? "draft",
      costCode,
      defectsMonths: initial?.defectsMonths ?? s.defectsMonths,
    };
    scCol.upsert(sc);
    onSaved?.(sc);
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? `แก้ไขสัญญา ${initial.id}` : "สัญญาจ้างเหมาช่วงใหม่"}
      width={960}
      footer={
        <>
          {err && <span className="mr-auto text-[13px] text-neg">{err}</span>}
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!!err} onClick={save}>
            บันทึกร่างสัญญา
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Labeled label="โครงการ" className="sm:col-span-2">
          <select className={inputCls} value={pid} onChange={(e) => setPid(e.target.value)}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} {p.name}
              </option>
            ))}
          </select>
        </Labeled>
        <Labeled label="ผู้รับเหมาช่วง" className="sm:col-span-2">
          <select className={inputCls} value={sid} onChange={(e) => setSid(e.target.value)}>
            <option value="">เลือก</option>
            {subs.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name} {x.prequal !== "approved" ? `(${x.prequal === "pending" ? "รอประเมิน" : "ระงับ"})` : ""}
              </option>
            ))}
          </select>
        </Labeled>
        <Labeled label="ขอบเขตงาน" className="sm:col-span-3">
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Labeled>
        <Labeled label="หมวดต้นทุน">
          <select className={inputCls} value={costCode} onChange={(e) => setCostCode(e.target.value as CostCode)}>
            {COST_CODE_OPTIONS(COST_CODES)}
          </select>
        </Labeled>
        <Labeled label="เงินประกันผลงาน (%)">
          <input className={numInput} inputMode="decimal" value={retention} onChange={(e) => setRetention(e.target.value)} />
        </Labeled>
        <Labeled label="เงินล่วงหน้า (บาท)">
          <input className={numInput} inputMode="decimal" value={advance} onChange={(e) => setAdvance(e.target.value)} />
        </Labeled>
        <Labeled label="หัก ณ ที่จ่าย (%)">
          <input className={numInput} inputMode="decimal" value={wht} onChange={(e) => setWht(e.target.value)} />
        </Labeled>
        <Labeled label="ภาษีมูลค่าเพิ่ม">
          <select className={inputCls} value={vat ? "1" : "0"} onChange={(e) => setVat(e.target.value === "1")}>
            <option value="1">ผู้รับเหมาจด VAT (7%)</option>
            <option value="0">ไม่จด VAT</option>
          </select>
        </Labeled>
        <Labeled label="เริ่มงาน">
          <input type="date" className={inputCls} value={start} onChange={(e) => setStart(e.target.value)} />
        </Labeled>
        <Labeled label="สิ้นสุด">
          <input type="date" className={inputCls} value={finish} onChange={(e) => setFinish(e.target.value)} />
        </Labeled>
      </div>
      {sub && sub.prequal !== "approved" && <p className="mt-2 text-[12px] text-warn">ผู้รับเหมาช่วงรายนี้ยังไม่ผ่านการคัดเลือก ลงนามสัญญาได้เมื่อผ่านการประเมินแล้ว</p>}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-[13px]">
          <thead>
            <tr className="text-left text-[12px] text-ink-3">
              <th className="py-1.5 font-normal">รายการ</th>
              <th className="w-24 py-1.5 text-right font-normal">ปริมาณ</th>
              <th className="w-20 py-1.5 pl-2 font-normal">หน่วย</th>
              <th className="w-28 py-1.5 text-right font-normal">ค่าจ้าง/หน่วย</th>
              <th className="w-44 py-1.5 pl-2 font-normal">งานในแผน (WBS)</th>
              <th className="w-28 py-1.5 text-right font-normal">มูลค่า</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-t border-line">
                <td className="py-1.5 pr-2">
                  <input className={cx(inputCls, "w-full")} value={l.description} onChange={(e) => set(i, { description: e.target.value })} />
                </td>
                <td className="py-1.5">
                  <input className={cx(numInput, "w-full")} inputMode="decimal" value={String(l.qty)} onChange={(e) => set(i, { qty: e.target.value as unknown as number })} />
                </td>
                <td className="py-1.5 pl-2">
                  <input className={cx(inputCls, "w-full")} value={l.unit} onChange={(e) => set(i, { unit: e.target.value })} />
                </td>
                <td className="py-1.5 pl-2">
                  <input className={cx(numInput, "w-full")} inputMode="decimal" value={String(l.rate)} onChange={(e) => set(i, { rate: e.target.value as unknown as number })} />
                </td>
                <td className="py-1.5 pl-2">
                  <select className={cx(inputCls, "w-full")} value={l.taskId ?? ""} onChange={(e) => set(i, { taskId: e.target.value || undefined })}>
                    <option value="">{projectTasks.length ? "ไม่ผูก" : "ยังไม่มีแผนงาน"}</option>
                    {projectTasks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.code} {t.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="num py-1.5 text-right font-mono">{fmt((Number(l.qty) || 0) * (Number(l.rate) || 0))}</td>
                <td className="py-1.5 text-right">
                  <IconBtn label="ลบรายการ" danger onClick={() => setLines(lines.length > 1 ? lines.filter((_, k) => k !== i) : [blankLine("L1", costCode)])}>
                    <Trash2 {...I} />
                  </IconBtn>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <Btn small onClick={() => setLines([...lines, blankLine(`L${lines.length + 1}-${Date.now() % 1000}`, costCode)])}>
          <Plus {...I} />
          เพิ่มรายการ
        </Btn>
        <p className="text-[13px]">
          มูลค่าสัญญา <span className="num font-mono font-medium">{fmt(value)}</span> บาท
        </p>
      </div>
      <div className="mt-2">
        <CheckNote>อัตราหัก ณ ที่จ่ายค่าจ้างทำของ 3% และเงินประกันผลงานตามสัญญา · ตรวจสอบกับประกาศล่าสุด</CheckNote>
      </div>
    </Modal>
  );
}

