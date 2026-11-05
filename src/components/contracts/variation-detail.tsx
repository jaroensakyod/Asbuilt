"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Ban, Check, Pencil, Printer, Send, Trash2, X } from "lucide-react";
import { Card, CardHead } from "@/components/ui";
import { MediaField, MediaStrip } from "@/components/media/media-field";
import { SignaturePad } from "@/components/media/signature-pad";
import { COST_CODES, budgets, installments } from "@/lib/biz";
import { getProject, thDate, TODAY } from "@/lib/data";
import { fmt, r2 } from "@/lib/accounting/money";
import { applyVariation, baseContractValue, contractValueOf, contractTerms, isMeasured, lineAmount, lineCost, ORIGIN_LABEL, useAccess, voCol, VO_STATUS_LABEL, VO_STATUS_TONE, type VariationX } from "@/lib/contracts";
import { useMediaUrl } from "@/lib/media";
import { areaCls, Btn, Empty, Header, I, KV, Labeled, Mini, Modal, Pill, PrintSheet, StatusPill, tableCls, td, tdR, th, thR, useHydrated } from "./bits";
import { VariationDoc } from "./docs";
import { VoForm } from "./vo-form";

export function VariationDetail({ id }: { id: string }) {
  const vo = voCol.use().find((v) => v.id === id);
  const hydrated = useHydrated();
  if (!vo) return <Card>{hydrated ? <Empty>ไม่พบงานเปลี่ยนแปลง {id}</Empty> : <div className="h-[40vh]" />}</Card>;
  return <Body vo={vo} />;
}

function Body({ vo }: { vo: VariationX }) {
  const router = useRouter();
  const { me, edit, approve } = useAccess();
  const all = voCol.use();
  const terms = contractTerms.use();
  const budgetList = budgets.use();
  const inst = installments.use();
  const p = getProject(vo.projectId);
  const base = baseContractValue(vo.projectId, budgetList, p);
  const cv = contractValueOf(base, all, vo.projectId);
  const [form, setForm] = useState(false);
  const [sign, setSign] = useState(false);
  const [reject, setReject] = useState(false);
  const [print, setPrint] = useState(false);
  const measured = isMeasured(terms, vo.projectId);
  const margin = vo.amount ? r2(((vo.amount - vo.cost) / Math.abs(vo.amount)) * 100) : 0;
  const open = vo.status === "draft" || vo.status === "priced";
  const set = (patch: Partial<VariationX>) => voCol.upsert({ ...vo, ...patch });

  return (
    <>
      <Link href="/contracts/variations" className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-ink-2 hover:text-ink">
        <ArrowLeft {...I} />
        งานเปลี่ยนแปลงทั้งหมด
      </Link>
      <Header
        eyebrow={`${vo.id} · ${p?.name ?? vo.projectId}`}
        title={vo.title}
        sub={
          <span className="flex flex-wrap items-center gap-2">
            <StatusPill k={vo.status} labels={VO_STATUS_LABEL} tones={VO_STATUS_TONE} />
            <Pill>{ORIGIN_LABEL[vo.origin]}</Pill>
            <span className="text-[13px] text-ink-3">
              เสนอโดย {vo.raisedBy} · {thDate(vo.raisedAt)}
            </span>
          </span>
        }
        actions={
          <>
            <Btn onClick={() => setPrint(true)}>
              <Printer {...I} />
              พิมพ์ใบสั่งงาน
            </Btn>
            {edit && open && (
              <Btn onClick={() => setForm(true)}>
                <Pencil {...I} />
                แก้ไข
              </Btn>
            )}
            {edit && vo.status === "draft" && (
              <Btn onClick={() => set({ status: "priced" })}>
                <Check {...I} />
                ประเมินราคาแล้ว
              </Btn>
            )}
            {edit && open && (
              <Btn primary onClick={() => set({ status: "submitted", submittedAt: TODAY })}>
                <Send {...I} />
                ส่งให้ลูกค้าอนุมัติ
              </Btn>
            )}
            {approve && vo.status === "submitted" && (
              <>
                <Btn onClick={() => setReject(true)}>
                  <X {...I} />
                  ไม่อนุมัติ
                </Btn>
                <Btn primary onClick={() => setSign(true)}>
                  <Check {...I} />
                  ลูกค้าอนุมัติ
                </Btn>
              </>
            )}
            {edit && (open || vo.status === "submitted") && (
              <Btn danger onClick={() => set({ status: "void" })}>
                <Ban {...I} />
                ยกเลิก
              </Btn>
            )}
            {edit && vo.status === "draft" && (
              <Btn
                danger
                onClick={() => {
                  voCol.remove(vo.id);
                  router.push("/contracts/variations");
                }}
              >
                <Trash2 {...I} />
                ลบร่าง
              </Btn>
            )}
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Mini label={vo.amount < 0 ? "งานลด (ก่อน VAT)" : "ราคาขาย (ก่อน VAT)"} value={fmt(vo.amount)} tone={vo.amount < 0 ? "neg" : undefined} />
        <Mini label="ต้นทุน" value={fmt(vo.cost)} />
        <Mini label="กำไรขั้นต้น" value={`${margin}%`} sub={fmt(r2(vo.amount - vo.cost))} />
        <Mini label="ขยายเวลา" value={`${vo.days} วัน`} />
        <Mini label="มูลค่าสัญญาหลังงานนี้" value={fmt(vo.status === "approved" ? cv : r2(cv + vo.amount))} sub={`เดิม ${fmt(base)}`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHead title="รายการ" meta={`${vo.lines.length} รายการ`} />
            <div className="overflow-x-auto">
              <table className={tableCls}>
                <thead>
                  <tr>
                    <th className={th}>รายการ</th>
                    <th className={th}>หมวด</th>
                    <th className={thR}>ปริมาณ</th>
                    <th className={thR}>ราคาขาย/หน่วย</th>
                    <th className={thR}>ต้นทุน/หน่วย</th>
                    <th className={thR}>ราคาขาย</th>
                    <th className={thR}>ต้นทุน</th>
                  </tr>
                </thead>
                <tbody>
                  {vo.lines.map((l, i) => (
                    <tr key={i}>
                      <td className={td}>{l.description}</td>
                      <td className={td}>
                        <span className="font-mono text-[12px]">{l.costCode}</span> <span className="text-[12px] text-ink-3">{l.costCode ? COST_CODES[l.costCode] : ""}</span>
                      </td>
                      <td className={tdR}>
                        <span className="num font-mono">{l.qty.toLocaleString("th-TH")}</span> {l.unit}
                      </td>
                      <td className={tdR}>
                        <span className="num font-mono">{fmt(l.unitPrice)}</span>
                      </td>
                      <td className={tdR}>
                        <span className="num font-mono">{fmt(l.unitCost)}</span>
                      </td>
                      <td className={tdR}>
                        <span className="num font-mono">{fmt(lineAmount(l))}</span>
                      </td>
                      <td className={tdR}>
                        <span className="num font-mono">{fmt(lineCost(l))}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td className={td} colSpan={5}>
                      รวม
                    </td>
                    <td className={tdR}>
                      <span className="num font-mono font-medium">{fmt(vo.amount)}</span>
                    </td>
                    <td className={tdR}>
                      <span className="num font-mono">{fmt(vo.cost)}</span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
          <Card>
            <CardHead title="เหตุผล" />
            <p className="px-5 py-4 text-[14px] text-ink-2">{vo.reason || "–"}</p>
          </Card>
          <Card>
            <CardHead title="ไฟล์แนบ" meta={vo.attachments?.length ?? 0} />
            <div className="px-5 py-4">{edit ? <MediaField value={vo.attachments ?? []} onChange={(attachments) => set({ attachments })} label="แบบ รูปหน้างาน ใบเสนอราคาผู้ขาย" /> : vo.attachments?.length ? <MediaStrip refs={vo.attachments} /> : <p className="text-[13px] text-ink-3">ไม่มีไฟล์แนบ</p>}</div>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHead title="การอนุมัติ" />
            <div className="px-5 py-3">
              <KV k="ส่งลูกค้า">{vo.submittedAt ? thDate(vo.submittedAt) : "–"}</KV>
              <KV k="ผู้อนุมัติ">{vo.approvedBy ?? "–"}</KV>
              <KV k="วันที่อนุมัติ">{vo.approvedAt ? thDate(vo.approvedAt) : "–"}</KV>
              {vo.rejectedReason && <KV k="เหตุผลไม่อนุมัติ">{vo.rejectedReason}</KV>}
              {vo.rfiId && <KV k="อ้างอิง">{vo.rfiId}</KV>}
              {vo.signature && <SignatureView v={vo} />}
            </div>
          </Card>
          {vo.status === "approved" && (
            <Card>
              <CardHead title="ผลของการอนุมัติ" />
              <div className="px-5 py-3 text-[13px] text-ink-2">
                {vo.appliedAt ? (
                  <>
                    <p>มูลค่าสัญญาเพิ่มเป็น {fmt(cv)} บาท (รวมงานเปลี่ยนแปลงที่อนุมัติทั้งหมด)</p>
                    {(vo.budgetApplied ?? []).length > 0 && (
                      <p className="mt-2">
                        งบประมาณ: {(vo.budgetApplied ?? []).map((b) => `หมวด ${b.costCode} ${b.amount >= 0 ? "+" : ""}${fmt(b.amount)}`).join(" · ")}
                      </p>
                    )}
                    {measured ? (
                      <p className="mt-2">โครงการเบิกตามผลงาน: มูลค่างานเพิ่มรวมในการเบิกงวดถัดไปตามความคืบหน้า</p>
                    ) : (
                      (vo.installmentApplied ?? []).map((a) => {
                        const i = inst.find((x) => x.id === a.id);
                        return (
                          <p key={a.id} className="mt-2">
                            งวดเงิน: {i?.title ?? a.id} {a.delta >= 0 ? "+" : ""}
                            {fmt(a.delta)} บาท
                          </p>
                        );
                      })
                    )}
                  </>
                ) : (
                  <p>กำลังปรับงบประมาณและงวดเงิน…</p>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>

      {form && <VoForm initial={vo} onClose={() => setForm(false)} />}
      {sign && (
        <Modal open onClose={() => setSign(false)} title={`ลูกค้าอนุมัติ ${vo.id}`} width={560}>
          <p className="mb-3 text-[13px] text-ink-2">
            ลูกค้าเซ็นอนุมัติงาน{vo.amount < 0 ? "ลด" : "เพิ่ม"} {fmt(Math.abs(vo.amount))} บาท (ก่อน VAT) ขยายเวลา {vo.days} วัน เมื่อบันทึก ระบบจะปรับมูลค่าสัญญา งบประมาณ{measured ? "" : " และงวดเงิน"}ให้อัตโนมัติ
          </p>
          <SignaturePad
            nameLabel="ชื่อลูกค้า / ผู้มีอำนาจอนุมัติ"
            onSave={(signature, signer) => {
              const next: VariationX = { ...vo, status: "approved", approvedAt: TODAY, approvedBy: signer || me.name, signature };
              voCol.upsert(next);
              applyVariation(next);
              setSign(false);
            }}
          />
        </Modal>
      )}
      {reject && <RejectModal onClose={() => setReject(false)} onSave={(rejectedReason) => (set({ status: "rejected", rejectedReason }), setReject(false))} />}
      <PrintSheet open={print} onClose={() => setPrint(false)} title="ใบสั่งงานเปลี่ยนแปลง">
        <VariationDoc vo={vo} projectName={p?.name ?? vo.projectId} owner={p?.owner ?? ""} contractValue={cv} />
      </PrintSheet>
    </>
  );
}

function SignatureView({ v }: { v: VariationX }) {
  const url = useMediaUrl(v.signature);
  return (
    <div className="mt-3 rounded-[8px] border border-line px-3 py-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url ? <img src={url} alt={`ลายมือชื่อ ${v.approvedBy ?? ""}`} className="max-h-20" /> : <p className="text-[12px] text-ink-3">ลายมือชื่อ (บันทึกไว้ในเครื่องที่เซ็น)</p>}
    </div>
  );
}

function RejectModal({ onClose, onSave }: { onClose: () => void; onSave: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <Modal
      open
      onClose={onClose}
      title="ลูกค้าไม่อนุมัติ"
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!reason.trim()} onClick={() => onSave(reason.trim())}>
            บันทึก
          </Btn>
        </>
      }
    >
      <Labeled label="เหตุผล">
        <textarea className={areaCls} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Labeled>
    </Modal>
  );
}
