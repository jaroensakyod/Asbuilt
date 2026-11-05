"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Plus, Settings2, Trash2 } from "lucide-react";
import { Card, CardHead, cx, Field, inputCls } from "@/components/ui";
import { Btn, Empty, I, IconBtn, Modal, Pill } from "@/components/ops/bits";
import { tableCls, td, tdR, th, thR } from "@/components/accounting/bits";
import { MediaField, MediaStrip } from "@/components/media/media-field";
import { money } from "@/lib/biz";
import { daysBetween, thDate, TODAY } from "@/lib/data";
import { certExpiry, certStates, craneIntervalMonths, DEFAULT_PLANT, hoursToService, requiredCerts } from "@/lib/plant/calc";
import { plantCerts, plantMaint, plants, plantSettings, usePlantSettings } from "@/lib/plant/store";
import { CERT_KIND_LABEL, MAINT_LABEL, PLANT_TYPE_LABEL, type CertKind, type MaintKind, type Plant, type PlantCert, type PlantMaint, type PlantSettings } from "@/lib/plant/types";
import { CERT_STATE_LABEL, CERT_TONE, fmtNum, siteName, usePlantAccess } from "./bits";

const due = (d: number) => (d < 0 ? `เลยกำหนด ${-d} วัน` : d === 0 ? "วันนี้" : `อีก ${d} วัน`);

/** engine hours at the last completed service of a plant */
export const lastServiceHours = (p: Plant, maint: PlantMaint[]) =>
  maint
    .filter((m) => m.plantId === p.id && m.kind === "service" && m.doneAt && m.meterHours !== undefined)
    .reduce<number | undefined>((mx, m) => (mx === undefined || m.meterHours! > mx ? m.meterHours : mx), undefined);

// ---------------- maintenance ----------------

export function MaintTab() {
  const list = plants.use();
  const maint = plantMaint.use();
  const { edit } = usePlantAccess();
  const [form, setForm] = useState<Partial<PlantMaint> | null>(null);
  const open = maint.filter((m) => !m.doneAt).sort((a, b) => a.date.localeCompare(b.date));
  const done = maint.filter((m) => m.doneAt).sort((a, b) => b.doneAt!.localeCompare(a.doneAt!));
  const byHours = list
    .map((p) => ({ p, left: hoursToService(p, lastServiceHours(p, maint)) }))
    .filter((x): x is { p: Plant; left: number } => x.left !== undefined && x.p.status !== "off_hired")
    .sort((a, b) => a.left - b.left);
  const pname = (id: string) => list.find((p) => p.id === id)?.name ?? id;

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <div className="flex min-w-0 flex-col gap-6">
        <Card>
          <CardHead
            title="รอดำเนินการ"
            meta={`${open.length} รายการ`}
            action={
              edit && (
                <Btn small primary onClick={() => setForm({ kind: "breakdown", date: TODAY, plantId: list[0]?.id })}>
                  <Plus {...I} />
                  แจ้งเสีย/นัดซ่อมบำรุง
                </Btn>
              )
            }
          />
          {open.length ? (
            <ul>
              {open.map((m) => {
                const d = daysBetween(TODAY, m.date);
                return (
                  <li key={m.id} className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3 last:border-0">
                    <Pill tone={m.kind === "service" ? (d < 0 ? "warn" : "neutral") : "neg"}>{MAINT_LABEL[m.kind]}</Pill>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px]">
                        <Link href={`/plant/${m.plantId}`} className="font-medium hover:underline">
                          {pname(m.plantId)}
                        </Link>{" "}
                        · {m.title}
                      </p>
                      <p className="text-[12px] text-ink-3">
                        {thDate(m.date)} · {m.kind === "service" ? due(d) : `แจ้งมาแล้ว ${-d} วัน`} · <span className="font-mono">{m.id}</span>
                      </p>
                    </div>
                    {edit && (
                      <Btn small onClick={() => setForm({ ...m, doneAt: TODAY })}>
                        <Check {...I} />
                        เสร็จแล้ว
                      </Btn>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty>ไม่มีงานซ่อมบำรุงค้าง</Empty>
          )}
        </Card>
        <Card>
          <CardHead title="ประวัติซ่อมบำรุง" meta={`${done.length} รายการ`} />
          {done.length ? (
            <div className="overflow-x-auto">
              <table className={cx(tableCls, "min-w-[700px]")}>
                <thead>
                  <tr>
                    <th className={cx(th, "pl-5")}>วันที่</th>
                    <th className={th}>เครื่องจักร</th>
                    <th className={th}>รายการ</th>
                    <th className={thR}>ชม.เครื่อง</th>
                    <th className={thR}>หยุด (วัน)</th>
                    <th className={cx(thR, "pr-5")}>ค่าใช้จ่าย</th>
                  </tr>
                </thead>
                <tbody>
                  {done.map((m) => (
                    <tr key={m.id}>
                      <td className={cx(td, "pl-5 whitespace-nowrap")}>{thDate(m.doneAt!)}</td>
                      <td className={td}>{pname(m.plantId)}</td>
                      <td className={td}>
                        <span className="text-ink-3">{MAINT_LABEL[m.kind]} · </span>
                        {m.title}
                        <MediaStrip refs={m.photos} size={40} className="mt-1" />
                      </td>
                      <td className={tdR}>
                        <span className="num font-mono">{m.meterHours !== undefined ? fmtNum(m.meterHours) : ""}</span>
                      </td>
                      <td className={tdR}>
                        <span className="num font-mono">{m.downtimeDays ?? ""}</span>
                      </td>
                      <td className={cx(tdR, "pr-5")}>
                        <span className="num font-mono">{m.cost ? money(m.cost) : ""}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>ยังไม่มีประวัติ</Empty>
          )}
        </Card>
      </div>
      <Card className="self-start">
        <CardHead title="รอบบำรุงตามชั่วโมงเครื่อง" />
        {byHours.length ? (
          <ul>
            {byHours.map(({ p, left }) => (
              <li key={p.id} className="flex items-center gap-3 border-b border-line px-5 py-2.5 last:border-0">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px]">{p.name}</span>
                  <span className="font-mono text-[12px] text-ink-3">
                    {fmtNum(p.meterHours ?? 0)} ชม. · ทุก {fmtNum(p.serviceEveryHours ?? 0)} ชม.
                  </span>
                </span>
                <Pill tone={left <= 0 ? "neg" : left <= 50 ? "warn" : "neutral"} mono>
                  {left <= 0 ? `เกิน ${fmtNum(-left)} ชม.` : `อีก ${fmtNum(left)} ชม.`}
                </Pill>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>ไม่มีเครื่องที่บำรุงตามชั่วโมง</Empty>
        )}
      </Card>
      {form && <MaintForm init={form} onClose={() => setForm(null)} />}
    </div>
  );
}

export function MaintForm({ init, onClose }: { init: Partial<PlantMaint>; onClose: () => void }) {
  const list = plants.use();
  const { me } = usePlantAccess();
  const [f, setF] = useState<Partial<PlantMaint>>(init);
  const [isDone, setIsDone] = useState(!!init.doneAt);
  const set = (p: Partial<PlantMaint>) => setF((x) => ({ ...x, ...p }));
  const plant = list.find((p) => p.id === f.plantId);
  const ok = !!(plant && f.kind && f.title?.trim() && f.date);
  const save = () => {
    if (!ok || !plant) return;
    const rec: PlantMaint = {
      id: f.id || plantMaint.nextId(`PMT-${TODAY.slice(0, 4)}-`),
      plantId: plant.id,
      kind: f.kind!,
      title: f.title!.trim(),
      date: f.date!,
      doneAt: isDone ? (f.doneAt ?? TODAY) : undefined,
      meterHours: f.meterHours,
      cost: f.cost,
      downtimeDays: f.downtimeDays,
      by: f.by ?? me.name,
      photos: f.photos ?? [],
    };
    plantMaint.upsert(rec);
    // plant status follows the job: broken down / in the workshop → back to work when done
    const back = plant.projectId ? "on_site" : "available";
    if (!isDone && rec.kind === "breakdown") plants.upsert({ ...plant, status: "breakdown" });
    else if (!isDone && rec.kind === "repair" && rec.date <= TODAY) plants.upsert({ ...plant, status: "maintenance" });
    else if (isDone && (plant.status === "breakdown" || plant.status === "maintenance")) plants.upsert({ ...plant, status: back, meterHours: rec.meterHours ?? plant.meterHours });
    else if (isDone && rec.meterHours !== undefined && (plant.meterHours ?? 0) < rec.meterHours) plants.upsert({ ...plant, meterHours: rec.meterHours });
    onClose();
  };
  const n = (v: string) => (v === "" ? undefined : Math.max(0, Number(v) || 0));
  return (
    <Modal
      open
      onClose={onClose}
      title={f.id ? `${MAINT_LABEL[f.kind ?? "service"]} ${f.id}` : "แจ้งเสีย / นัดซ่อมบำรุง"}
      width={560}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!ok} onClick={save}>
            บันทึก
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="เครื่องจักร">
          <select className={inputCls} value={f.plantId ?? ""} disabled={!!f.id} onChange={(e) => set({ plantId: e.target.value })}>
            {list.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} · {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="ประเภท">
          <select className={inputCls} value={f.kind} onChange={(e) => set({ kind: e.target.value as MaintKind })}>
            {(Object.keys(MAINT_LABEL) as MaintKind[]).map((k) => (
              <option key={k} value={k}>
                {MAINT_LABEL[k]}
              </option>
            ))}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="รายการ/อาการ">
            <input className={inputCls} value={f.title ?? ""} onChange={(e) => set({ title: e.target.value })} placeholder="เช่น เปลี่ยนน้ำมันเครื่อง / สายไฮดรอลิกแตก" />
          </Field>
        </div>
        <Field label={f.kind === "service" ? "วันนัด" : "วันที่แจ้ง"}>
          <input type="date" className={inputCls} value={f.date ?? ""} onChange={(e) => set({ date: e.target.value })} />
        </Field>
        <Field label="ชั่วโมงเครื่อง">
          <input type="number" min={0} className={cx(inputCls, "font-mono")} value={f.meterHours ?? ""} placeholder={plant?.meterHours !== undefined ? String(plant.meterHours) : ""} onChange={(e) => set({ meterHours: n(e.target.value) })} />
        </Field>
        <Field label="ค่าใช้จ่าย (บาท)">
          <input type="number" min={0} className={cx(inputCls, "font-mono")} value={f.cost ?? ""} onChange={(e) => set({ cost: n(e.target.value) })} />
        </Field>
        <Field label="หยุดใช้งาน (วัน)">
          <input type="number" min={0} className={cx(inputCls, "font-mono")} value={f.downtimeDays ?? ""} onChange={(e) => set({ downtimeDays: n(e.target.value) })} />
        </Field>
        <label className="flex items-center gap-2 text-[13px] sm:col-span-2">
          <input type="checkbox" checked={isDone} onChange={(e) => setIsDone(e.target.checked)} />
          ดำเนินการเสร็จแล้ว {isDone && <span className="text-ink-3">({thDate(f.doneAt ?? TODAY)})</span>}
        </label>
        <div className="sm:col-span-2">
          <MediaField value={f.photos ?? []} onChange={(photos) => set({ photos })} label="รูป/ใบเสร็จ" />
        </div>
        {plant && <p className="text-[12px] text-ink-3 sm:col-span-2">{f.kind === "breakdown" && !isDone ? "เครื่องจะถูกตั้งสถานะ เสีย จนกว่าจะบันทึกว่าซ่อมเสร็จ" : isDone ? "เมื่อเสร็จ สถานะเครื่องกลับเป็น อยู่หน้างาน/ว่าง" : ""}</p>}
      </div>
    </Modal>
  );
}

// ---------------- certificates ----------------

export function CertsTab() {
  const list = plants.use();
  const certs = plantCerts.use();
  const s = usePlantSettings();
  const { edit } = usePlantAccess();
  const [form, setForm] = useState<{ plantId: string; kind?: CertKind } | null>(null);
  const [settings, setSettings] = useState(false);
  const rows = useMemo(
    () =>
      list
        .filter((p) => p.status !== "off_hired")
        .flatMap((p) => certStates(p, certs, TODAY, s).map((c) => ({ p, c })))
        .sort((a, b) => (a.c.daysLeft ?? -9999) - (b.c.daysLeft ?? -9999)),
    [list, certs, s],
  );
  const history = [...certs].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  const pname = (id: string) => list.find((p) => p.id === id)?.name ?? id;

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <div className="flex min-w-0 flex-col gap-6">
        <Card>
          <CardHead
            title="ใบรับรองที่ต้องมี"
            meta={`${rows.length} รายการ`}
            action={
              edit && (
                <Btn small primary onClick={() => setForm({ plantId: rows[0]?.p.id ?? list[0]?.id })}>
                  <Plus {...I} />
                  บันทึกใบรับรอง
                </Btn>
              )
            }
          />
          {rows.length ? (
            <div className="overflow-x-auto">
              <table className={cx(tableCls, "min-w-[760px]")}>
                <thead>
                  <tr>
                    <th className={cx(th, "pl-5")}>เครื่องจักร</th>
                    <th className={th}>ใบรับรอง</th>
                    <th className={th}>รอบ</th>
                    <th className={th}>หมดอายุ</th>
                    <th className={th}>สถานะ</th>
                    <th className={cx(th, "pr-5")}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ p, c }) => (
                    <tr key={p.id + c.kind}>
                      <td className={cx(td, "pl-5")}>
                        <Link href={`/plant/${p.id}`} className="hover:underline">
                          {p.name}
                        </Link>
                        <span className="block text-[12px] text-ink-3">
                          {PLANT_TYPE_LABEL[p.type]}
                          {p.capacityT ? ` · ${p.capacityT} ตัน` : ""}
                          {p.heightM ? ` · ${p.heightM} ม.` : ""} · {siteName(p.projectId)}
                        </span>
                      </td>
                      <td className={td}>{CERT_KIND_LABEL[c.kind]}</td>
                      <td className={cx(td, "text-ink-2")}>{c.kind === "crane_periodic" ? `ทุก ${craneIntervalMonths(p.capacityT, s)} เดือน` : c.kind === "scaffold_engineer" ? `ทุก ${s.scaffoldCertMonths} เดือน` : "ปีละครั้ง"}</td>
                      <td className={cx(td, "whitespace-nowrap")}>{c.cert ? thDate(c.cert.expiry) : "-"}</td>
                      <td className={td}>
                        <Pill tone={CERT_TONE[c.state]}>
                          {CERT_STATE_LABEL[c.state]}
                          {c.daysLeft !== undefined && <span className="ml-1 font-mono">{c.daysLeft < 0 ? `-${-c.daysLeft}` : c.daysLeft} วัน</span>}
                        </Pill>
                      </td>
                      <td className={cx(td, "pr-5 text-right")}>
                        {edit && (
                          <Btn small onClick={() => setForm({ plantId: p.id, kind: c.kind })}>
                            ต่ออายุ
                          </Btn>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>ไม่มีเครื่องจักรที่ต้องมีใบรับรอง</Empty>
          )}
        </Card>
        <Card>
          <CardHead title="ประวัติใบรับรอง" meta={`${history.length} ฉบับ`} />
          {history.length ? (
            <CertTable certs={history} pname={pname} />
          ) : (
            <Empty>ยังไม่มีใบรับรอง</Empty>
          )}
        </Card>
      </div>
      <Card className="self-start">
        <CardHead
          title="เกณฑ์การตรวจ"
          action={
            edit && (
              <IconBtn label="ตั้งค่าเกณฑ์" onClick={() => setSettings(true)}>
                <Settings2 {...I} />
              </IconBtn>
            )
          }
        />
        <div className="px-5 py-3 text-[13px]">
          <p className="mb-1 text-ink-3">ตรวจปั้นจั่นตามระยะ (ตามพิกัดยก)</p>
          <ul className="mb-3">
            {[...s.craneIntervals]
              .sort((a, b) => a.maxT - b.maxT)
              .map((r, i, arr) => (
                <li key={i} className="flex justify-between border-b border-line py-1.5">
                  <span>{i === 0 ? `ไม่เกิน ${r.maxT} ตัน` : r.maxT >= 9999 ? `เกิน ${arr[i - 1].maxT} ตัน` : `${arr[i - 1].maxT}–${r.maxT} ตัน`}</span>
                  <span className="num font-mono">ทุก {r.months} เดือน</span>
                </li>
              ))}
          </ul>
          <p className="flex justify-between border-b border-line py-1.5">
            <span>นั่งร้านต้องมีวิศวกรรับรองเมื่อสูงเกิน</span>
            <span className="num font-mono">{s.scaffoldCertHeightM} ม.</span>
          </p>
          <p className="flex justify-between border-b border-line py-1.5">
            <span>อายุใบรับรองนั่งร้าน</span>
            <span className="num font-mono">{s.scaffoldCertMonths} เดือน</span>
          </p>
          <p className="flex justify-between py-1.5">
            <span>แจ้งเตือนก่อนหมดอายุ</span>
            <span className="num font-mono">{s.warnDays} วัน</span>
          </p>
          <p className="mt-2 text-[12px] text-warn">ตรวจสอบกับกฎกระทรวงปั้นจั่น 2564 ล่าสุด และประกาศเรื่องนั่งร้านล่าสุด ค่าเหล่านี้แก้ไขได้</p>
        </div>
      </Card>
      {form && <CertForm plantId={form.plantId} kind={form.kind} onClose={() => setForm(null)} />}
      {settings && <SettingsForm onClose={() => setSettings(false)} />}
    </div>
  );
}

export function CertTable({ certs, pname }: { certs: PlantCert[]; pname?: (id: string) => string }) {
  const { edit } = usePlantAccess();
  return (
    <div className="overflow-x-auto">
      <table className={cx(tableCls, "min-w-[720px]")}>
        <thead>
          <tr>
            {pname && <th className={cx(th, "pl-5")}>เครื่องจักร</th>}
            <th className={cx(th, !pname && "pl-5")}>ประเภท</th>
            <th className={th}>วันที่ตรวจ</th>
            <th className={th}>หมดอายุ</th>
            <th className={th}>ผู้ตรวจ</th>
            <th className={th}>ผล</th>
            <th className={cx(th, "pr-5")}></th>
          </tr>
        </thead>
        <tbody>
          {certs.map((c) => (
            <tr key={c.id}>
              {pname && <td className={cx(td, "pl-5")}>{pname(c.plantId)}</td>}
              <td className={cx(td, !pname && "pl-5")}>
                {CERT_KIND_LABEL[c.kind]}
                <span className="block font-mono text-[12px] text-ink-3">
                  {c.id}
                  {c.ref ? ` · ${c.ref}` : ""}
                  {c.loadTestT ? ` · ทดสอบ ${c.loadTestT} ตัน` : ""}
                </span>
                <MediaStrip refs={c.attachments} size={40} className="mt-1" />
              </td>
              <td className={cx(td, "whitespace-nowrap")}>{thDate(c.issuedAt)}</td>
              <td className={cx(td, "whitespace-nowrap")}>{thDate(c.expiry)}</td>
              <td className={td}>
                {c.inspector}
                {c.licenseNo && <span className="block font-mono text-[12px] text-ink-3">{c.licenseNo}</span>}
              </td>
              <td className={td}>{c.result === "pass" ? <Pill tone="pos">ผ่าน</Pill> : <Pill tone="neg">ไม่ผ่าน</Pill>}</td>
              <td className={cx(td, "pr-5 text-right")}>
                {edit && (
                  <IconBtn label={`ลบ ${c.id}`} danger onClick={() => plantCerts.remove(c.id)}>
                    <Trash2 {...I} />
                  </IconBtn>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CertForm({ plantId, kind, onClose }: { plantId: string; kind?: CertKind; onClose: () => void }) {
  const list = plants.use();
  const s = usePlantSettings();
  const [pid, setPid] = useState(plantId);
  const plant = list.find((p) => p.id === pid);
  const kinds = plant ? [...new Set([...requiredCerts(plant, s), "electrical" as CertKind, "pressure" as CertKind])] : [];
  const [k, setK] = useState<CertKind>(kind ?? kinds[0] ?? "crane_periodic");
  const [issuedAt, setIssuedAt] = useState(TODAY);
  const [expiry, setExpiry] = useState(() => (plant ? certExpiry(kind ?? kinds[0] ?? "crane_periodic", TODAY, plant, s) : TODAY));
  const [inspector, setInspector] = useState("");
  const [licenseNo, setLicenseNo] = useState("");
  const [ref, setRef] = useState("");
  const [loadTestT, setLoadTestT] = useState<number | undefined>(undefined);
  const [result, setResult] = useState<PlantCert["result"]>("pass");
  const [attachments, setAttachments] = useState<PlantCert["attachments"]>([]);
  const suggest = (kk: CertKind, iss: string, p = plant) => p && setExpiry(certExpiry(kk, iss, p, s));
  const ok = !!plant && !!inspector.trim() && expiry > issuedAt;
  const save = () => {
    if (!ok || !plant) return;
    plantCerts.upsert({ id: plantCerts.nextId(`PCT-${TODAY.slice(0, 4)}-`), plantId: plant.id, kind: k, issuedAt, expiry, inspector: inspector.trim(), licenseNo: licenseNo.trim() || undefined, ref: ref.trim() || undefined, loadTestT, result, attachments });
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="บันทึกใบรับรอง/ผลตรวจ"
      width={600}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!ok} onClick={save}>
            บันทึก
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="เครื่องจักร">
          <select
            className={inputCls}
            value={pid}
            onChange={(e) => {
              setPid(e.target.value);
              const np = list.find((p) => p.id === e.target.value);
              const nk = np ? (requiredCerts(np, s)[0] ?? "electrical") : k;
              setK(nk);
              suggest(nk, issuedAt, np);
            }}
          >
            {list.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} · {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="ประเภทใบรับรอง">
          <select
            className={inputCls}
            value={k}
            onChange={(e) => {
              setK(e.target.value as CertKind);
              suggest(e.target.value as CertKind, issuedAt);
            }}
          >
            {kinds.map((x) => (
              <option key={x} value={x}>
                {CERT_KIND_LABEL[x]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="วันที่ตรวจ/ออกใบ">
          <input
            type="date"
            className={inputCls}
            value={issuedAt}
            onChange={(e) => {
              setIssuedAt(e.target.value);
              suggest(k, e.target.value);
            }}
          />
        </Field>
        <Field label="หมดอายุ (คำนวณจากเกณฑ์ แก้ได้)">
          <input type="date" className={inputCls} min={issuedAt} value={expiry} onChange={(e) => setExpiry(e.target.value)} />
        </Field>
        <Field label="วิศวกรผู้ตรวจ">
          <input className={inputCls} value={inspector} onChange={(e) => setInspector(e.target.value)} placeholder="ชื่อ-สกุล" />
        </Field>
        <Field label="เลขใบอนุญาตประกอบวิชาชีพ">
          <input className={cx(inputCls, "font-mono")} value={licenseNo} onChange={(e) => setLicenseNo(e.target.value)} placeholder="สก. / สย." />
        </Field>
        <Field label="เลขที่เอกสาร">
          <input className={cx(inputCls, "font-mono")} value={ref} onChange={(e) => setRef(e.target.value)} placeholder="ปจ.2-xxxx" />
        </Field>
        {k === "crane_load_test" ? (
          <Field label="น้ำหนักทดสอบ (ตัน)">
            <input type="number" min={0} step={0.25} className={cx(inputCls, "font-mono")} value={loadTestT ?? ""} onChange={(e) => setLoadTestT(e.target.value === "" ? undefined : Number(e.target.value))} />
          </Field>
        ) : (
          <div />
        )}
        <Field label="ผลการตรวจ">
          <select className={inputCls} value={result} onChange={(e) => setResult(e.target.value as PlantCert["result"])}>
            <option value="pass">ผ่าน ใช้งานได้</option>
            <option value="fail">ไม่ผ่าน ห้ามใช้งาน</option>
          </select>
        </Field>
        <div className="sm:col-span-2">
          <MediaField value={attachments} onChange={setAttachments} label="สำเนาใบรับรอง/รายงานผลตรวจ" />
        </div>
        {plant && k === "crane_periodic" && (
          <p className="text-[12px] text-ink-3 sm:col-span-2">
            พิกัดยก {plant.capacityT ?? "-"} ตัน → ตรวจทุก {craneIntervalMonths(plant.capacityT, s)} เดือน (ตรวจสอบกับกฎกระทรวงปั้นจั่น 2564 ล่าสุด)
          </p>
        )}
      </div>
    </Modal>
  );
}

function SettingsForm({ onClose }: { onClose: () => void }) {
  const cur = usePlantSettings();
  const [f, setF] = useState<PlantSettings>(() => ({ ...cur, craneIntervals: cur.craneIntervals.map((r) => ({ ...r })) }));
  const set = (p: Partial<PlantSettings>) => setF((x) => ({ ...x, ...p }));
  const row = (i: number, p: Partial<PlantSettings["craneIntervals"][number]>) => set({ craneIntervals: f.craneIntervals.map((r, k) => (k === i ? { ...r, ...p } : r)) });
  const n = (v: string) => Math.max(0, Number(v) || 0);
  const save = () => {
    plantSettings.upsert({ ...f, craneIntervals: [...f.craneIntervals].filter((r) => r.months > 0).sort((a, b) => a.maxT - b.maxT) });
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="ตั้งค่าเกณฑ์เครื่องจักร"
      width={560}
      footer={
        <>
          <Btn onClick={() => setF({ ...DEFAULT_PLANT, craneIntervals: DEFAULT_PLANT.craneIntervals.map((r) => ({ ...r })) })}>ค่าเริ่มต้น</Btn>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary onClick={save}>
            บันทึก
          </Btn>
        </>
      }
    >
      <p className="mb-2 text-[13px] text-ink-2">ช่วงตรวจปั้นจั่นตามพิกัดยก</p>
      <table className={cx(tableCls, "mb-2")}>
        <thead>
          <tr>
            <th className={th}>พิกัดยกไม่เกิน (ตัน)</th>
            <th className={th}>ตรวจทุก (เดือน)</th>
            <th className={th}></th>
          </tr>
        </thead>
        <tbody>
          {f.craneIntervals.map((r, i) => (
            <tr key={i}>
              <td className={td}>
                <input type="number" min={0} className={cx(inputCls, "h-8 w-28 font-mono")} value={r.maxT} onChange={(e) => row(i, { maxT: n(e.target.value) })} />
              </td>
              <td className={td}>
                <input type="number" min={1} className={cx(inputCls, "h-8 w-24 font-mono")} value={r.months} onChange={(e) => row(i, { months: n(e.target.value) })} />
              </td>
              <td className={cx(td, "text-right")}>
                <IconBtn label="ลบแถว" danger onClick={() => set({ craneIntervals: f.craneIntervals.filter((_, k) => k !== i) })}>
                  <Trash2 {...I} />
                </IconBtn>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Btn small onClick={() => set({ craneIntervals: [...f.craneIntervals, { maxT: 9999, months: 3 }] })}>
        <Plus {...I} />
        เพิ่มช่วง
      </Btn>
      <p className="mt-1 text-[12px] text-warn">ตรวจสอบกับกฎกระทรวงปั้นจั่น 2564 ล่าสุด (ใส่ 9999 = ทุกขนาดที่เหลือ)</p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="นั่งร้านสูงเกิน (ม.) ต้องมีวิศวกรรับรอง">
          <input type="number" min={0} className={cx(inputCls, "font-mono")} value={f.scaffoldCertHeightM} onChange={(e) => set({ scaffoldCertHeightM: n(e.target.value) })} />
        </Field>
        <Field label="อายุใบรับรองนั่งร้าน (เดือน)">
          <input type="number" min={1} className={cx(inputCls, "font-mono")} value={f.scaffoldCertMonths} onChange={(e) => set({ scaffoldCertMonths: n(e.target.value) })} />
        </Field>
        <Field label="ราคาน้ำมันดีเซล (บาท/ลิตร)">
          <input type="number" min={0} step={0.1} className={cx(inputCls, "font-mono")} value={f.fuelPrice} onChange={(e) => set({ fuelPrice: n(e.target.value) })} />
        </Field>
        <Field label="วันทำงานต่อเดือน (เฉลี่ยค่าเช่ารายเดือน)">
          <input type="number" min={1} className={cx(inputCls, "font-mono")} value={f.daysPerMonth} onChange={(e) => set({ daysPerMonth: n(e.target.value) || 26 })} />
        </Field>
        <Field label="แจ้งเตือนก่อนหมดอายุ (วัน)">
          <input type="number" min={0} className={cx(inputCls, "font-mono")} value={f.warnDays} onChange={(e) => set({ warnDays: n(e.target.value) })} />
        </Field>
      </div>
      <p className="mt-3 text-[12px] text-ink-3">ตรวจสอบกับประกาศล่าสุด ค่าความสูงนั่งร้านและอายุใบรับรองเป็นค่าเริ่มต้นของระบบ</p>
    </Modal>
  );
}

