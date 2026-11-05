"use client";

// Field-service sections of a work order, used on the desktop job sheet and on the phone (/m/jobs/[id]):
// GPS check-in/out, checklist, before/after photos, parts from van stock, on-site charge with
// PromptPay QR, customer signature, close job and the satisfaction-survey request.

import { useMemo, useState } from "react";
import { Check, CreditCard, MapPin, Navigation, Package, Plus, Send, Undo2, X } from "lucide-react";
import { cx, inputCls } from "@/components/ui";
import { Btn, I, Pill, Select } from "@/components/ops/bits";
import { MediaField, MediaStrip } from "@/components/media/media-field";
import { SignaturePad } from "@/components/media/signature-pad";
import { getProject } from "@/lib/data";
import { updateWorkOrder, type OpsWorkOrder } from "@/lib/ops-store";
import { checkIn, checkOut, geoFor, issuePart, nowStamp, requestSurvey, returnPart, saveSvc, surveyRequests, svcOf, useFieldSettings, vanStock, woService } from "@/lib/field/store";
import type { WoService } from "@/lib/field/types";
import { useMe } from "@/lib/use-me";
import { getPosition, mapsUrl, PromptPayQr } from "./bits";

const baht = (n: number) => `฿${n.toLocaleString("th-TH")}`;

export function useSvc(wo: OpsWorkOrder): WoService {
  const all = woService.use();
  return all.find((s) => s.id === wo.id) ?? svcOf(wo);
}

function Box({ title, children, meta, big }: { title: string; children: React.ReactNode; meta?: React.ReactNode; big?: boolean }) {
  return (
    <section className={cx("border-t border-line", big ? "px-4 py-4" : "px-5 py-3")}>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className={cx("font-medium", big ? "text-[15px]" : "text-[13px]")}>{title}</h3>
        {meta && <span className="text-[12px] text-ink-3">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

export function CheckInBox({ wo, big }: { wo: OpsWorkOrder; big?: boolean }) {
  const svc = useSvc(wo);
  const p = getProject(wo.projectId);
  const [busy, setBusy] = useState(false);
  const closed = wo.status === "done" || wo.status === "cancelled";
  const run = async (kind: "in" | "out") => {
    setBusy(true);
    const pos = await getPosition();
    const g = geoFor(wo.projectId, pos?.lat, pos?.lng);
    if (kind === "in") checkIn(wo, g);
    else checkOut(wo, g);
    setBusy(false);
  };
  const line = (label: string, g?: WoService["checkIn"]) => (
    <p className="text-[13px]">
      <span className="text-ink-3">{label} </span>
      {g ? (
        <>
          <span className="num font-mono">{g.at}</span>
          {g.dist !== undefined ? <span className={cx("ml-1", g.dist > 300 ? "text-warn" : "text-ink-3")}>· ห่างหมุด {g.dist.toLocaleString("th-TH")} ม.</span> : <span className="ml-1 text-ink-3">· ไม่มีพิกัด</span>}
        </>
      ) : (
        "–"
      )}
    </p>
  );
  return (
    <Box title="เข้า-ออกหน้างาน (GPS)" big={big} meta={p?.lat !== undefined ? `หมุด ${p.lat}, ${p.lng}` : undefined}>
      <div className="flex flex-col gap-1">
        {line("เช็กอิน", svc.checkIn)}
        {line("เช็กเอาต์", svc.checkOut)}
      </div>
      <div className={cx("mt-2 grid gap-2", big ? "grid-cols-1" : "grid-cols-3")}>
        <a href={mapsUrl(p?.lat, p?.lng, p?.address)} target="_blank" rel="noreferrer" className={cx("inline-flex items-center justify-center gap-2 rounded-[8px] border border-line-strong bg-card font-medium hover:bg-raised", big ? "h-12 text-[15px]" : "h-8 text-[13px]")}>
          <Navigation {...I} />
          นำทาง
        </a>
        {!closed && (
          <>
            <BigOr big={big} onClick={() => void run("in")} disabled={busy || !!svc.checkIn} primary={!svc.checkIn}>
              <MapPin {...I} />
              {svc.checkIn ? "เช็กอินแล้ว" : "เช็กอินถึงหน้างาน"}
            </BigOr>
            <BigOr big={big} onClick={() => void run("out")} disabled={busy || !svc.checkIn || !!svc.checkOut}>
              <MapPin {...I} />
              เช็กเอาต์
            </BigOr>
          </>
        )}
      </div>
    </Box>
  );
}

function BigOr({ big, children, onClick, disabled, primary }: { big?: boolean; children: React.ReactNode; onClick: () => void; disabled?: boolean; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-[8px] font-medium transition-transform active:scale-[0.98] disabled:opacity-40",
        big ? "h-12 rounded-[12px] text-[15px]" : "h-8 text-[13px]",
        primary ? "bg-ink text-card" : "border border-line-strong bg-card text-ink hover:bg-raised",
      )}
    >
      {children}
    </button>
  );
}

export function ChecklistBox({ wo, big }: { wo: OpsWorkOrder; big?: boolean }) {
  const svc = useSvc(wo);
  const [text, setText] = useState("");
  const done = svc.checklist.filter((c) => c.done).length;
  const save = (checklist: WoService["checklist"]) => saveSvc({ ...svc, checklist });
  return (
    <Box title="เช็กลิสต์งาน" big={big} meta={`${done}/${svc.checklist.length}`}>
      <ul className="flex flex-col">
        {svc.checklist.map((c, i) => (
          <li key={i} className="flex items-center gap-2">
            <label className={cx("flex flex-1 cursor-pointer items-center gap-2", big ? "min-h-11 text-[15px]" : "min-h-8 text-[13px]")}>
              <input type="checkbox" checked={c.done} onChange={() => save(svc.checklist.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))} className={big ? "size-5" : "size-4"} />
              <span className={cx(c.done && "text-ink-3 line-through")}>{c.text}</span>
            </label>
            <button type="button" aria-label="ลบรายการ" onClick={() => save(svc.checklist.filter((_, j) => j !== i))} className="text-ink-3 hover:text-neg">
              <X {...I} />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          save([...svc.checklist, { text: text.trim(), done: false }]);
          setText("");
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="เพิ่มขั้นตอน" aria-label="เพิ่มขั้นตอน" className={cx(inputCls, "min-w-0 flex-1", big && "h-11 text-[16px]")} />
        <Btn type="submit" small={!big}>
          <Plus {...I} />
        </Btn>
      </form>
    </Box>
  );
}

export function PhotosBox({ wo, big }: { wo: OpsWorkOrder; big?: boolean }) {
  const svc = useSvc(wo);
  return (
    <Box title="รูปก่อน / หลังซ่อม" big={big}>
      <div className="flex flex-col gap-3">
        <MediaField value={svc.before} onChange={(before) => saveSvc({ ...svc, before })} label="ก่อนซ่อม" photosOnly />
        <MediaField value={svc.after} onChange={(after) => saveSvc({ ...svc, after })} label="หลังซ่อม" photosOnly />
      </div>
    </Box>
  );
}

export function PartsBox({ wo, big }: { wo: OpsWorkOrder; big?: boolean }) {
  const svc = useSvc(wo);
  const stock = vanStock.use();
  const mine = useMemo(() => stock.filter((s) => s.tech === wo.technician), [stock, wo.technician]);
  const [pick, setPick] = useState("");
  const [qty, setQty] = useState("1");
  const closed = wo.status === "done" || wo.status === "cancelled";
  const total = svc.parts.reduce((s, p) => s + p.qty * p.unitPrice, 0);
  const sel = mine.find((s) => s.id === pick);
  return (
    <Box title="อะไหล่ที่ใช้ (จากสต็อกรถ)" big={big} meta={svc.parts.length ? `มูลค่า ${baht(total)}` : `รถของ ${wo.technician}`}>
      {svc.parts.length > 0 && (
        <ul className="mb-2 flex flex-col gap-1">
          {svc.parts.map((p) => (
            <li key={p.stockId} className={cx("flex items-center gap-2", big ? "text-[15px]" : "text-[13px]")}>
              <Package {...I} className="shrink-0 text-ink-3" />
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              <span className="num font-mono">
                {p.qty} {p.unit}
              </span>
              {!closed && (
                <button type="button" aria-label={`คืน ${p.name}`} title="คืนเข้ารถ" onClick={() => returnPart(wo, p.stockId)} className="text-ink-3 hover:text-ink">
                  <Undo2 {...I} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!closed &&
        (mine.length === 0 ? (
          <p className="text-[13px] text-ink-3">ยังไม่มีสต็อกในรถของช่างคนนี้ (ตั้งค่าที่หน้าจัดคิวช่าง)</p>
        ) : (
          <div className="grid grid-cols-[1fr_64px_auto] gap-2">
            <Select label="เลือกอะไหล่" value={pick} onChange={setPick} className={big ? "h-11 text-[16px]" : undefined}>
              <option value="">เลือกอะไหล่</option>
              {mine.map((s) => (
                <option key={s.id} value={s.id} disabled={s.qty <= 0}>
                  {s.name} · เหลือ {s.qty} {s.unit}
                </option>
              ))}
            </Select>
            <input value={qty} onChange={(e) => setQty(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" aria-label="จำนวน" className={cx(inputCls, "num text-right font-mono", big && "h-11 text-[16px]")} />
            <Btn
              small={!big}
              disabled={!sel || !Number(qty) || Number(qty) > (sel?.qty ?? 0)}
              onClick={() => {
                issuePart(wo, pick, Number(qty));
                setPick("");
                setQty("1");
              }}
            >
              เบิก
            </Btn>
          </div>
        ))}
    </Box>
  );
}

export function ChargeBox({ wo, big }: { wo: OpsWorkOrder; big?: boolean }) {
  const svc = useSvc(wo);
  const s = useFieldSettings();
  const parts = svc.parts.reduce((t, p) => t + p.qty * p.unitPrice, 0);
  const [amount, setAmount] = useState(String(svc.charge?.amount ?? (wo.cost || parts || "")));
  const [qr, setQr] = useState(false);
  if (wo.billing !== "charge" && !svc.charge) {
    return (
      <Box title="ค่าบริการหน้างาน" big={big}>
        <p className="text-[13px] text-ink-3">งานในประกัน ไม่เก็บเงินลูกค้า</p>
        <Btn small onClick={() => updateWorkOrder(wo.id, { billing: "charge" }, "เปลี่ยนเป็นงานคิดค่าบริการ")}>
          เปลี่ยนเป็นงานคิดค่าบริการ
        </Btn>
      </Box>
    );
  }
  const amt = Number(amount) || 0;
  const paid = svc.charge?.paid;
  return (
    <Box title="ค่าบริการหน้างาน" big={big} meta={paid ? <Pill tone="pos">ชำระแล้ว</Pill> : undefined}>
      {paid ? (
        <p className="text-[13px]">
          รับชำระ {baht(svc.charge!.amount)} · {svc.charge!.method === "promptpay" ? "พร้อมเพย์" : svc.charge!.method === "cash" ? "เงินสด" : "โอน"} · {svc.charge!.paidAt}
        </p>
      ) : (
        <>
          <div className="flex gap-2">
            <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="จำนวนเงิน (บาท)" aria-label="ค่าบริการ" className={cx(inputCls, "num min-w-0 flex-1 text-right font-mono", big && "h-11 text-[16px]")} />
            <Btn small={!big} disabled={!amt} onClick={() => {
                saveSvc({ ...svc, charge: { amount: amt } });
                setQr(true);
              }}
            >
              <CreditCard {...I} />
              QR
            </Btn>
          </div>
          {parts > 0 && <p className="mt-1 text-[12px] text-ink-3">ค่าอะไหล่จากสต็อกรถ {baht(parts)}</p>}
          {qr && amt > 0 && (
            <div className="mt-3 rounded-[12px] border border-line bg-white p-4">
              <PromptPayQr id={s.promptPayId} name={s.promptPayName} amount={amt} size={big ? 240 : 180} />
              <p className="mt-2 text-center text-[12px] text-ink-3">ให้ลูกค้าสแกนด้วยแอปธนาคาร แล้วตรวจยอดเข้าก่อนกดยืนยัน</p>
            </div>
          )}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Btn small={!big} disabled={!amt} onClick={() => saveSvc({ ...svc, charge: { amount: amt, paid: true, paidAt: nowStamp(), method: "promptpay" } })}>
              รับเงินพร้อมเพย์แล้ว
            </Btn>
            <Btn small={!big} disabled={!amt} onClick={() => saveSvc({ ...svc, charge: { amount: amt, paid: true, paidAt: nowStamp(), method: "cash" } })}>
              รับเงินสดแล้ว
            </Btn>
          </div>
        </>
      )}
    </Box>
  );
}

export function NotesBox({ wo, big }: { wo: OpsWorkOrder; big?: boolean }) {
  const [text, setText] = useState(wo.summary ?? "");
  const [hours, setHours] = useState(wo.hours !== undefined ? String(wo.hours) : "");
  const dirty = text !== (wo.summary ?? "") || hours !== (wo.hours !== undefined ? String(wo.hours) : "");
  return (
    <Box title="บันทึกการซ่อม" big={big}>
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="สาเหตุ สิ่งที่แก้ไข คำแนะนำลูกค้า" aria-label="บันทึกการซ่อม" className={cx("w-full rounded-[8px] border border-line-strong bg-card px-3 py-2 outline-none focus:border-ink-3", big ? "min-h-[96px] text-[16px]" : "min-h-[64px] text-[14px]")} />
      <div className="mt-2 flex gap-2">
        <input value={hours} onChange={(e) => setHours(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="ชั่วโมงทำงาน" aria-label="ชั่วโมงทำงาน" className={cx(inputCls, "num min-w-0 flex-1 font-mono", big && "h-11 text-[16px]")} />
        <Btn small={!big} disabled={!dirty} onClick={() => updateWorkOrder(wo.id, { summary: text.trim() || undefined, hours: hours ? Number(hours) : undefined }, "บันทึกการซ่อมจากหน้างาน")}>
          บันทึก
        </Btn>
      </div>
    </Box>
  );
}

export function SignBox({ wo, big }: { wo: OpsWorkOrder; big?: boolean }) {
  const svc = useSvc(wo);
  return (
    <Box title="ลายมือชื่อลูกค้า" big={big} meta={svc.signedAt}>
      {svc.signature || svc.signer ? (
        <div className="flex items-center gap-3">
          {svc.signature && <MediaStrip refs={[svc.signature]} size={big ? 120 : 80} />}
          <div className="text-[13px]">
            <p>{svc.signer}</p>
            <button type="button" onClick={() => saveSvc({ ...svc, signature: undefined, signer: undefined, signedAt: undefined })} className="text-ink-3 hover:text-ink">
              เซ็นใหม่
            </button>
          </div>
        </div>
      ) : (
        <SignaturePad height={big ? 200 : 140} nameLabel="ชื่อลูกค้า / ผู้รับงาน" onSave={(ref, signer) => saveSvc({ ...svc, signature: ref, signer, signedAt: nowStamp() })} />
      )}
    </Box>
  );
}

/** close the job (needs signature unless overridden) and offer the satisfaction survey */
export function CloseBox({ wo, big, summary, surveyOnly }: { wo: OpsWorkOrder; big?: boolean; summary?: string; surveyOnly?: boolean }) {
  const svc = useSvc(wo);
  const me = useMe();
  const surveys = surveyRequests.use();
  const survey = surveys.find((s) => s.repairId === wo.repairId);
  const closed = wo.status === "done";
  const unpaid = wo.billing === "charge" && svc.charge && !svc.charge.paid;
  if (surveyOnly && !closed) return null;
  return (
    <Box title={closed ? "ปิดงานแล้ว" : "ปิดงาน"} big={big}>
      {!closed ? (
        <div className="flex flex-col gap-2">
          {!svc.signature && <p className="text-[12px] text-warn">ยังไม่มีลายมือชื่อลูกค้า</p>}
          {unpaid && <p className="text-[12px] text-warn">ยังไม่ได้รับชำระค่าบริการ</p>}
          <BigOr
            big={big}
            primary
            onClick={() => {
              if (!svc.signature && !window.confirm("ปิดงานโดยไม่มีลายมือชื่อลูกค้า")) return;
              if (svc.checkIn && !svc.checkOut) checkOut(wo, geoFor(wo.projectId));
              updateWorkOrder(wo.id, { status: "done", summary: summary ?? wo.summary }, `ปิดงาน${svc.signer ? ` ลูกค้า ${svc.signer} เซ็นรับ` : ""}`);
            }}
          >
            <Check {...I} />
            ปิดงาน (ซ่อมเสร็จ)
          </BigOr>
        </div>
      ) : survey ? (
        <p className="text-[13px] text-ink-2">
          แบบประเมินความพึงพอใจ: {survey.status === "pending" ? "รอส่งให้ลูกค้า" : survey.status === "sent" ? "ส่งแล้ว" : "ลูกค้าตอบแล้ว"} · {survey.requestedAt}
        </p>
      ) : (
        <BigOr big={big} onClick={() => requestSurvey({ repairId: wo.repairId, woId: wo.id, projectId: wo.projectId, by: me.name })}>
          <Send {...I} />
          ส่งแบบประเมิน
        </BigOr>
      )}
    </Box>
  );
}
