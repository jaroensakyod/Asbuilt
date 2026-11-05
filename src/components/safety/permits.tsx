"use client";

import { useState } from "react";
import { AlertTriangle, Ban, Lock, PenLine, Plus, Printer } from "lucide-react";
import { Card, cx, Field, inputCls } from "@/components/ui";
import { areaCls, Btn, Empty, FilterField, I, KV, Modal, Pill, PrintStyle, Segmented, Select, StatCard, type Tone } from "@/components/ops/bits";
import { tableCls, td, th } from "@/components/accounting/bits";
import { MediaField, MediaStrip } from "@/components/media/media-field";
import { SignaturePad } from "@/components/media/signature-pad";
import { COMPANY_INFO, TODAY } from "@/lib/data";
import { ACTIVE_SITES } from "@/lib/hr/seed";
import { permitHours, permitOverdue } from "@/lib/safety/calc";
import { useNow } from "@/lib/safety/now";
import { permits } from "@/lib/safety/store";
import { PERMIT_CONTROLS, PERMIT_HAZARDS, PERMIT_LABEL, PERMIT_SHORT, PERMIT_STATUS_LABEL, type Permit, type PermitStatus, type PermitType, type SignOff } from "@/lib/safety/types";
import { CheckRow, siteName, SiteSelect, thDateTime, useSafetyAccess, VerifyNote } from "./bits";

const STATUS_TONE: Record<PermitStatus, Tone> = { requested: "warn", issued: "accent", active: "pos", closed: "neutral", cancelled: "neutral" };
/** acceptable atmosphere for entry (defaults; verify against the current regulation) */
const GAS = { o2: [19.5, 23.5], lel: 10, h2s: 10, co: 25 } as const;
const gasOk = (g?: Permit["gas"]) => !!g && g.o2 >= GAS.o2[0] && g.o2 <= GAS.o2[1] && g.lel < GAS.lel && g.h2s < GAS.h2s && g.co < GAS.co;

export function PermitsTab({ q }: { q?: string }) {
  const list = permits.use();
  const now = useNow();
  const { edit } = useSafetyAccess();
  const [scope, setScope] = useState<"open" | "all">("open");
  const [type, setType] = useState("");
  const [site, setSite] = useState("");
  const [openId, setOpenId] = useState<string | null>(q && list.some((p) => p.id === q) ? q : null);
  const [creating, setCreating] = useState(false);

  const isOpen = (p: Permit) => p.status === "requested" || p.status === "issued" || p.status === "active";
  const shown = list
    .filter((p) => (scope === "all" || isOpen(p)) && (!type || p.type === type) && (!site || p.projectId === site))
    .sort((a, b) => b.validFrom.localeCompare(a.validFrom));
  const overdue = list.filter((p) => permitOverdue(p, now));
  const current = openId ? list.find((p) => p.id === openId) : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="ทำงานได้ตอนนี้" value={list.filter((p) => p.status === "active" && !permitOverdue(p, now)).length} unit="ใบ" />
        <StatCard label="รอลงนาม/อนุมัติ" value={list.filter((p) => p.status === "requested" || p.status === "issued").length} unit="ใบ" />
        <StatCard label="เกินเวลาที่อนุญาต" value={overdue.length} unit="ใบ" tone={overdue.length ? "neg" : undefined} note={overdue.length ? "ต้องปิดงานหรือออกใบใหม่" : "ไม่มี"} />
        <StatCard label="ปิดงานแล้ว 30 วัน" value={list.filter((p) => p.status === "closed" && p.validTo.slice(0, 10) > addDaysIso(TODAY, -30)).length} unit="ใบ" />
      </div>

      <Card>
        <div className="flex flex-wrap items-end gap-3 border-b border-line px-5 py-4">
          <Segmented
            value={scope}
            onChange={setScope}
            options={[
              { key: "open", label: "เปิดอยู่" },
              { key: "all", label: "ทั้งหมด" },
            ]}
          />
          <FilterField label="ประเภทงาน" className="w-[220px]">
            <Select label="ประเภทงาน" value={type} onChange={setType}>
              <option value="">ทุกประเภท</option>
              {(Object.keys(PERMIT_LABEL) as PermitType[]).map((t) => (
                <option key={t} value={t}>
                  {PERMIT_LABEL[t]}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="หน้างาน" className="min-w-[220px] flex-1">
            <SiteSelect value={site} onChange={setSite} />
          </FilterField>
          {edit && (
            <Btn primary onClick={() => setCreating(true)}>
              <Plus {...I} />
              ขอใบอนุญาตทำงาน
            </Btn>
          )}
        </div>
        {shown.length ? (
          <div className="overflow-x-auto">
            <table className={cx(tableCls, "min-w-[880px]")}>
              <thead>
                <tr>
                  <th className={cx(th, "pl-5")}>เลขที่</th>
                  <th className={th}>ประเภท</th>
                  <th className={th}>งาน / จุดทำงาน</th>
                  <th className={th}>หน้างาน</th>
                  <th className={th}>ช่วงเวลาที่อนุญาต</th>
                  <th className={th}>มาตรการ</th>
                  <th className={cx(th, "pr-5")}>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => {
                  const over = permitOverdue(p, now);
                  const done = p.controls.filter((c) => c.done).length;
                  return (
                    <tr key={p.id} className="cursor-pointer hover:bg-raised/50" onClick={() => setOpenId(p.id)}>
                      <td className={cx(td, "pl-5 font-mono text-[12px]")}>{p.id}</td>
                      <td className={td}>
                        <Pill>{PERMIT_SHORT[p.type]}</Pill>
                      </td>
                      <td className={cx(td, "max-w-[300px]")}>
                        <span className="block">{p.title}</span>
                        <span className="text-[12px] text-ink-3">
                          {p.location} · {p.crew} {p.workers} คน
                        </span>
                      </td>
                      <td className={td}>
                        <span className="block max-w-[160px] truncate">{siteName(p.projectId)}</span>
                        <span className="font-mono text-[12px] text-ink-3">{p.projectId}</span>
                      </td>
                      <td className={cx(td, "font-mono text-[12px]")}>
                        {thDateTime(p.validFrom)} – {p.validTo.slice(11, 16)}
                      </td>
                      <td className={cx(td, "font-mono text-[12px]")}>
                        <span className={done < p.controls.length ? "text-warn" : "text-ink-2"}>
                          {done}/{p.controls.length}
                        </span>
                      </td>
                      <td className={cx(td, "pr-5")}>
                        <span className="flex flex-wrap gap-1">
                          <Pill tone={STATUS_TONE[p.status]}>{PERMIT_STATUS_LABEL[p.status]}</Pill>
                          {over && <Pill tone="neg">เกินเวลา</Pill>}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>{scope === "open" ? "ไม่มีใบอนุญาตที่เปิดอยู่" : "ไม่มีใบอนุญาตตามตัวกรอง"}</Empty>
        )}
        <p className="border-t border-line px-5 py-2.5 text-[12px] text-ink-3">ขั้นตอน: ผู้ขอระบุอันตรายและมาตรการ → ผู้ออกใบ (หัวหน้างาน/จป.) ตรวจหน้างานและลงนาม → ผู้อนุมัติ (ผู้จัดการโครงการ/จป.วิชาชีพ) ลงนาม → ปิดงานเมื่อเสร็จหรือหมดเวลา</p>
      </Card>

      {current && <PermitDetail permit={current} onClose={() => setOpenId(null)} />}
      {creating && <PermitForm onClose={() => setCreating(false)} onCreated={(id) => (setCreating(false), setOpenId(id))} />}
    </div>
  );
}

const addDaysIso = (iso: string, n: number) => new Date(Date.parse(iso + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);

function PermitForm({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { me } = useSafetyAccess();
  const [type, setType] = useState<PermitType>("hot");
  const [projectId, setProjectId] = useState(ACTIVE_SITES[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [crew, setCrew] = useState("");
  const [workers, setWorkers] = useState(2);
  const [date, setDate] = useState(TODAY);
  const [from, setFrom] = useState("08:00");
  const [to, setTo] = useState("17:00");
  const [hazards, setHazards] = useState<string[]>(PERMIT_HAZARDS.hot);
  const [extra, setExtra] = useState("");
  const changeType = (t: PermitType) => {
    setType(t);
    setHazards(PERMIT_HAZARDS[t]);
  };
  const ok = title.trim() && location.trim() && to > from && hazards.length > 0;
  const save = () => {
    if (!ok) return;
    const id = permits.nextId(`PTW-${date.slice(0, 4)}-`);
    permits.upsert({
      id,
      projectId,
      type,
      title: title.trim(),
      location: location.trim(),
      crew: crew.trim() || "ทีมช่างบริษัท",
      workers,
      validFrom: `${date}T${from}`,
      validTo: `${date}T${to}`,
      hazards,
      controls: PERMIT_CONTROLS[type].map((text) => ({ text, done: false })),
      requestedBy: me.name,
      requestedAt: `${TODAY}T${from}`,
      status: "requested",
      photos: [],
    });
    onCreated(id);
  };
  const all = [...new Set([...PERMIT_HAZARDS[type], ...hazards])];
  return (
    <Modal
      open
      onClose={onClose}
      title="ขอใบอนุญาตทำงาน (Permit to work)"
      width={720}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!ok} onClick={save}>
            ส่งขออนุญาต
          </Btn>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ประเภทงาน">
          <select className={inputCls} value={type} onChange={(e) => changeType(e.target.value as PermitType)}>
            {(Object.keys(PERMIT_LABEL) as PermitType[]).map((t) => (
              <option key={t} value={t}>
                {PERMIT_LABEL[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="หน้างาน">
          <SiteSelect value={projectId} onChange={setProjectId} all={false} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="ลักษณะงาน">
            <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น เชื่อมโครงหลังคาเหล็ก" />
          </Field>
        </div>
        <Field label="จุดทำงาน">
          <input className={inputCls} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="ชั้น / โซน / กริดไลน์" />
        </Field>
        <div className="grid grid-cols-[1fr_90px] gap-2">
          <Field label="ทีมผู้ปฏิบัติงาน">
            <input className={inputCls} value={crew} onChange={(e) => setCrew(e.target.value)} placeholder="ชื่อทีม/ผู้รับเหมา" />
          </Field>
          <Field label="จำนวนคน">
            <input type="number" min={1} className={cx(inputCls, "font-mono")} value={workers} onChange={(e) => setWorkers(Math.max(1, Number(e.target.value) || 1))} />
          </Field>
        </div>
        <Field label="วันที่ทำงาน">
          <input type="date" className={inputCls} value={date} min={TODAY} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="ตั้งแต่">
            <input type="time" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="ถึง">
            <input type="time" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
      </div>
      <h3 className="mb-1 mt-4 text-[14px] font-medium">อันตรายที่ระบุ</h3>
      <div className="rounded-[8px] border border-line px-3">
        {all.map((h) => (
          <CheckRow key={h} checked={hazards.includes(h)} onChange={(v) => setHazards(v ? [...hazards, h] : hazards.filter((x) => x !== h))}>
            {h}
          </CheckRow>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input className={cx(inputCls, "flex-1")} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="อันตรายอื่นที่พบหน้างาน" />
        <Btn
          disabled={!extra.trim()}
          onClick={() => {
            setHazards([...hazards, extra.trim()]);
            setExtra("");
          }}
        >
          เพิ่ม
        </Btn>
      </div>
      <p className="mt-3 text-[12px] text-ink-3">มาตรการควบคุมตามประเภทงานจะถูกใส่ให้ ผู้ออกใบตรวจและติ๊กที่หน้างานก่อนลงนาม</p>
    </Modal>
  );
}

function PermitDetail({ permit: p, onClose }: { permit: Permit; onClose: () => void }) {
  const { me, edit, approve } = useSafetyAccess();
  const now = useNow();
  const [signing, setSigning] = useState<"issuer" | "approver" | "close" | null>(null);
  const [closeNote, setCloseNote] = useState("");
  const [areaSafe, setAreaSafe] = useState(true);
  const over = permitOverdue(p, now);
  const save = (patch: Partial<Permit>) => permits.upsert({ ...p, ...patch });
  const locked = p.status === "closed" || p.status === "cancelled";
  const allControls = p.controls.every((c) => c.done);
  const needGas = p.type === "confined";
  const gasReady = !needGas || gasOk(p.gas);

  const sign = (ref: SignOff["signature"], signer: string) => {
    const s: SignOff = { name: signer || me.name, at: `${TODAY}T${now.slice(11, 16)}`, signature: ref };
    if (signing === "issuer") save({ issuer: s, status: "issued" });
    if (signing === "approver") save({ approver: s, status: "active" });
    if (signing === "close") save({ closeOut: { ...s, note: closeNote.trim() || "ปิดงานเรียบร้อย", areaSafe }, status: "closed" });
    setSigning(null);
  };

  return (
    <>
      <PrintStyle />
      <Modal
        open
        onClose={onClose}
        title={`${p.id} · ${PERMIT_LABEL[p.type]}`}
        width={800}
        footer={
          <>
            <Btn onClick={() => window.print()}>
              <Printer {...I} />
              พิมพ์
            </Btn>
            {!locked && edit && (
              <Btn danger onClick={() => save({ status: "cancelled" })}>
                <Ban {...I} />
                ยกเลิกใบอนุญาต
              </Btn>
            )}
            <span className="flex-1" />
            {p.status === "requested" && edit && (
              <Btn primary disabled={!allControls || !gasReady} onClick={() => setSigning("issuer")} title={!allControls ? "ตรวจมาตรการให้ครบก่อน" : undefined}>
                <PenLine {...I} />
                ผู้ออกใบลงนาม
              </Btn>
            )}
            {p.status === "issued" && approve && (
              <Btn primary onClick={() => setSigning("approver")}>
                <PenLine {...I} />
                อนุมัติให้ทำงาน
              </Btn>
            )}
            {p.status === "active" && edit && (
              <Btn primary onClick={() => setSigning("close")}>
                <Lock {...I} />
                ปิดงาน
              </Btn>
            )}
          </>
        }
      >
        {over && (
          <p className="mb-3 flex items-center gap-2 rounded-[8px] bg-neg-soft px-3 py-2 text-[13px] text-neg">
            <AlertTriangle {...I} />
            เกินเวลาที่อนุญาต ({p.validTo.slice(11, 16)} น.) หยุดงานและปิดใบ หรือขอใบใหม่
          </p>
        )}
        <div className="grid gap-x-6 sm:grid-cols-2">
          <KV k="สถานะ">
            <Pill tone={STATUS_TONE[p.status]}>{PERMIT_STATUS_LABEL[p.status]}</Pill>
          </KV>
          <KV k="หน้างาน">{siteName(p.projectId)}</KV>
          <KV k="งาน" wide>
            {p.title}
          </KV>
          <KV k="จุดทำงาน">{p.location}</KV>
          <KV k="ผู้ปฏิบัติงาน">
            {p.crew} · <span className="font-mono">{p.workers}</span> คน
          </KV>
          <KV k="ช่วงเวลา">
            <span className="font-mono text-[12px]">
              {thDateTime(p.validFrom)} – {p.validTo.slice(11, 16)}
            </span>{" "}
            ({permitHours(p)} ชม.)
          </KV>
          <KV k="ผู้ขอ">
            {p.requestedBy} <span className="font-mono text-[12px] text-ink-3">{thDateTime(p.requestedAt)}</span>
          </KV>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="mb-1 text-[14px] font-medium">อันตราย</h3>
            <ul className="text-[13px] text-ink-2">
              {p.hazards.map((h) => (
                <li key={h} className="border-b border-line py-1.5 last:border-0">
                  {h}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-1 text-[14px] font-medium">
              มาตรการควบคุม{" "}
              <span className="font-mono text-[12px] text-ink-3">
                {p.controls.filter((c) => c.done).length}/{p.controls.length}
              </span>
            </h3>
            <div>
              {p.controls.map((c, i) => (
                <CheckRow key={c.text} checked={c.done} disabled={locked || !edit || p.status === "active"} onChange={(v) => save({ controls: p.controls.map((x, k) => (k === i ? { ...x, done: v } : x)) })}>
                  {c.text}
                </CheckRow>
              ))}
            </div>
          </div>
        </div>

        {needGas && (
          <div className="mt-4">
            <h3 className="mb-1 text-[14px] font-medium">ผลตรวจวัดบรรยากาศ</h3>
            <GasForm gas={p.gas} disabled={locked || !edit} onSave={(gas) => save({ gas })} />
            <VerifyNote>
              เกณฑ์ที่ใช้: ออกซิเจน {GAS.o2[0]}–{GAS.o2[1]}% · ก๊าซไวไฟ &lt; {GAS.lel}% LEL · H2S &lt; {GAS.h2s} ppm · CO &lt; {GAS.co} ppm (ตรวจสอบกับประกาศล่าสุด)
            </VerifyNote>
          </div>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <SignBox label="ผู้ออกใบอนุญาต" s={p.issuer} />
          <SignBox label="ผู้อนุมัติ" s={p.approver} />
          <SignBox label="ปิดงาน" s={p.closeOut} note={p.closeOut ? `${p.closeOut.areaSafe ? "พื้นที่ปลอดภัย" : "มีความเสี่ยงค้าง"} · ${p.closeOut.note}` : undefined} />
        </div>

        {signing && (
          <div className="mt-4 rounded-[10px] border border-line-strong p-3">
            <p className="mb-2 text-[13px] font-medium">{signing === "issuer" ? "ผู้ออกใบลงนาม: ตรวจหน้างานและมาตรการครบแล้ว" : signing === "approver" ? "ผู้อนุมัติลงนาม: อนุญาตให้ทำงานตามช่วงเวลา" : "ปิดงาน: งานเสร็จ เก็บอุปกรณ์ ตรวจพื้นที่แล้ว"}</p>
            {signing === "close" && (
              <div className="mb-2 flex flex-col gap-2">
                <textarea className={areaCls} value={closeNote} onChange={(e) => setCloseNote(e.target.value)} placeholder="สภาพพื้นที่หลังเลิกงาน" />
                <CheckRow checked={areaSafe} onChange={setAreaSafe}>
                  พื้นที่ปลอดภัย ไม่มีไฟ/ก๊าซ/ช่องเปิดค้าง
                </CheckRow>
              </div>
            )}
            <SignaturePad height={120} onSave={sign} />
            <div className="mt-2 text-right">
              <Btn small onClick={() => setSigning(null)}>
                ยกเลิก
              </Btn>
            </div>
          </div>
        )}

        <div className="mt-4">
          <MediaField value={p.photos} onChange={(photos) => save({ photos })} label="รูปหน้างาน" photosOnly />
        </div>
      </Modal>
      <PermitPrint p={p} />
    </>
  );
}

function GasForm({ gas, disabled, onSave }: { gas?: Permit["gas"]; disabled: boolean; onSave: (g: NonNullable<Permit["gas"]>) => void }) {
  const [g, setG] = useState(gas ?? { o2: 20.9, lel: 0, h2s: 0, co: 0, at: "08:00" });
  const f = (k: "o2" | "lel" | "h2s" | "co", label: string) => (
    <Field label={label}>
      <input type="number" step={0.1} disabled={disabled} className={cx(inputCls, "font-mono")} value={g[k]} onChange={(e) => setG({ ...g, [k]: Number(e.target.value) || 0 })} />
    </Field>
  );
  return (
    <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-6">
      {f("o2", "O2 (%)")}
      {f("lel", "LEL (%)")}
      {f("h2s", "H2S (ppm)")}
      {f("co", "CO (ppm)")}
      <Field label="เวลาวัด">
        <input type="time" disabled={disabled} className={inputCls} value={g.at} onChange={(e) => setG({ ...g, at: e.target.value })} />
      </Field>
      <div className="flex items-center gap-2 pb-0.5">
        {!disabled && (
          <Btn small onClick={() => onSave(g)}>
            บันทึกผลวัด
          </Btn>
        )}
        {gas && <Pill tone={gasOk(gas) ? "pos" : "neg"}>{gasOk(gas) ? "ผ่าน" : "ไม่ผ่าน"}</Pill>}
      </div>
    </div>
  );
}

function SignBox({ label, s, note }: { label: string; s?: SignOff; note?: string }) {
  return (
    <div className="rounded-[10px] border border-line p-3">
      <p className="text-[12px] text-ink-3">{label}</p>
      {s ? (
        <>
          {s.signature && <MediaStrip refs={[s.signature]} size={64} className="my-1" />}
          <p className="text-[13px]">{s.name}</p>
          <p className="font-mono text-[12px] text-ink-3">{thDateTime(s.at)}</p>
          {note && <p className="mt-1 text-[12px] text-ink-2">{note}</p>}
        </>
      ) : (
        <p className="mt-1 text-[13px] text-ink-3">ยังไม่ลงนาม</p>
      )}
    </div>
  );
}

function PermitPrint({ p }: { p: Permit }) {
  return (
    <div className="ops-print hidden bg-white p-8 text-[12px] text-black print:block">
      <div className="flex items-start justify-between border-b border-black/30 pb-3">
        <div>
          <p className="text-[16px] font-medium">ใบอนุญาตทำงาน (Permit to work)</p>
          <p>{PERMIT_LABEL[p.type]}</p>
        </div>
        <div className="text-right">
          <p className="font-mono">{p.id}</p>
          <p>{COMPANY_INFO.name}</p>
        </div>
      </div>
      <table className="mt-3 w-full">
        <tbody>
          {[
            ["หน้างาน", `${p.projectId} ${siteName(p.projectId)}`],
            ["งาน", p.title],
            ["จุดทำงาน", p.location],
            ["ผู้ปฏิบัติงาน", `${p.crew} ${p.workers} คน`],
            ["ช่วงเวลาที่อนุญาต", `${thDateTime(p.validFrom)} ถึง ${p.validTo.slice(11, 16)} น.`],
            ["ผู้ขอ", p.requestedBy],
          ].map(([k, v]) => (
            <tr key={k}>
              <td className="w-[150px] py-0.5 align-top text-black/60">{k}</td>
              <td className="py-0.5">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 grid grid-cols-2 gap-6">
        <div>
          <p className="mb-1 font-medium">อันตราย</p>
          {p.hazards.map((h) => (
            <p key={h}>☐ {h}</p>
          ))}
        </div>
        <div>
          <p className="mb-1 font-medium">มาตรการควบคุม</p>
          {p.controls.map((c) => (
            <p key={c.text}>
              {c.done ? "☑" : "☐"} {c.text}
            </p>
          ))}
        </div>
      </div>
      {p.gas && (
        <p className="mt-3">
          ผลวัดบรรยากาศ {p.gas.at} น.: O2 {p.gas.o2}% · LEL {p.gas.lel}% · H2S {p.gas.h2s} ppm · CO {p.gas.co} ppm
        </p>
      )}
      <div className="avoid-break mt-8 grid grid-cols-3 gap-6 text-center">
        {[
          ["ผู้ออกใบอนุญาต", p.issuer],
          ["ผู้อนุมัติ", p.approver],
          ["ผู้ปิดงาน", p.closeOut],
        ].map(([k, s]) => (
          <div key={k as string}>
            <div className="h-12 border-b border-black/40" />
            <p className="mt-1">{(s as SignOff | undefined)?.name ?? "(.................................)"}</p>
            <p className="text-black/60">{k as string}</p>
            {(s as SignOff | undefined)?.at && <p className="text-black/60">{thDateTime((s as SignOff).at)}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
