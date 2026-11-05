"use client";

import { useMemo, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { Card, CardHead, cx, Dot, Field, inputCls } from "@/components/ui";
import { Btn, Empty, FilterField, I, IconBtn, Modal, Pill, StatCard } from "@/components/ops/bits";
import { tableCls, td, th } from "@/components/accounting/bits";
import { MediaField, MediaStrip } from "@/components/media/media-field";
import { thDate, TODAY } from "@/lib/data";
import { ACTIVE_SITES } from "@/lib/hr/seed";
import type { MediaRef } from "@/lib/media";
import { pm25Band } from "@/lib/safety/calc";
import { envLogs, useSafetySettings } from "@/lib/safety/store";
import type { EnvLog } from "@/lib/safety/types";
import { siteName, useSafetyAccess } from "./bits";

const addDays = (iso: string, n: number) => new Date(Date.parse(iso + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);

export function EnvTab() {
  const logs = envLogs.use();
  const settings = useSafetySettings();
  const { edit } = useSafetyAccess();
  const withLogs = useMemo(() => new Set(logs.map((l) => l.projectId)), [logs]);
  const sites = useMemo(() => [...ACTIVE_SITES].sort((a, b) => Number(withLogs.has(b.id)) - Number(withLogs.has(a.id))), [withLogs]);
  const [site, setSite] = useState(sites[0]?.id ?? "");
  const [editing, setEditing] = useState<string | null>(null);

  const mine = useMemo(() => logs.filter((l) => l.projectId === site).sort((a, b) => b.date.localeCompare(a.date)), [logs, site]);
  const last7 = mine.filter((l) => l.date > addDays(TODAY, -7));
  const last30 = mine.filter((l) => l.date > addDays(TODAY, -30));
  const avg7 = last7.length ? last7.reduce((s, l) => s + l.pm25, 0) / last7.length : 0;
  const over = last30.filter((l) => l.pm25 > settings.pm25Limit).length;
  const openComplaints = mine.reduce((s, l) => s + l.complaints.filter((c) => !c.resolved).length, 0);
  const share = (f: (l: EnvLog) => boolean) => (last30.length ? Math.round((last30.filter(f).length / last30.length) * 100) : 0);
  const band = pm25Band(avg7);

  const resolve = (l: EnvLog, k: number) => envLogs.upsert({ ...l, complaints: l.complaints.map((c, j) => (j === k ? { ...c, resolved: !c.resolved } : c)) });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <FilterField label="หน้างาน" className="min-w-[260px] flex-1 sm:max-w-[420px]">
          <select className={cx(inputCls, "w-full")} aria-label="หน้างาน" value={site} onChange={(e) => setSite(e.target.value)}>
            {sites.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} · {p.name}
                {withLogs.has(p.id) ? "" : " (ยังไม่มีบันทึก)"}
              </option>
            ))}
          </select>
        </FilterField>
        {edit && (
          <Btn primary onClick={() => setEditing(TODAY)}>
            <Plus {...I} />
            บันทึกประจำวัน
          </Btn>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="PM2.5 เฉลี่ย 7 วัน" value={last7.length ? avg7.toFixed(1) : "-"} unit="มคก./ลบ.ม." note={last7.length ? <Pill tone={band.tone}>{band.label}</Pill> : "ไม่มีข้อมูล"} />
        <StatCard label="วันเกินเกณฑ์ (30 วัน)" value={over} unit="วัน" tone={over ? "neg" : undefined} note={`เกณฑ์ ${settings.pm25Limit} มคก./ลบ.ม.`} />
        <StatCard label="เรื่องร้องเรียนค้าง" value={openComplaints} unit="เรื่อง" tone={openComplaints ? "neg" : undefined} />
        <StatCard label="มาตรการป้องกันฝุ่น (30 วัน)" value={`${share((l) => l.dustScreen)}%`} note={`ล้างล้อ ${share((l) => l.wheelWash)}% · ฉีดน้ำ ${share((l) => l.waterSprayTimes > 0)}%`} />
      </div>

      <Card>
        <CardHead title="PM2.5 รายวัน" meta={`${siteName(site)} · ${Math.min(30, mine.length)} วันล่าสุด`} />
        <div className="px-5 py-4">{mine.length ? <PmChart logs={mine.slice(0, 30).reverse()} limit={settings.pm25Limit} /> : <Empty>ยังไม่มีบันทึกคุณภาพอากาศของหน้างานนี้</Empty>}</div>
      </Card>

      <Card>
        <CardHead title="บันทึกสิ่งแวดล้อมและฝุ่น" meta={`${mine.length} วัน`} />
        {mine.length ? (
          <div className="overflow-x-auto">
            <table className={cx(tableCls, "min-w-[900px]")}>
              <thead>
                <tr>
                  <th className={cx(th, "pl-5")}>วันที่</th>
                  <th className={th}>PM2.5</th>
                  <th className={cx(th, "text-right")}>เสียง dB</th>
                  <th className={th}>ผ้าใบกันฝุ่น</th>
                  <th className={th}>ล้างล้อ</th>
                  <th className={cx(th, "text-right")}>ฉีดน้ำ (ครั้ง)</th>
                  <th className={th}>ร้องเรียน</th>
                  <th className={cx(th, "pr-5")}>รูป</th>
                </tr>
              </thead>
              <tbody>
                {mine.map((l) => {
                  const b = pm25Band(l.pm25);
                  return (
                    <tr key={l.id}>
                      <td className={cx(td, "pl-5 whitespace-nowrap")}>
                        {edit ? (
                          <button type="button" className="underline decoration-line-strong underline-offset-2 hover:text-ink" onClick={() => setEditing(l.date)}>
                            {thDate(l.date)}
                          </button>
                        ) : (
                          thDate(l.date)
                        )}
                        <span className="block text-[12px] text-ink-3">{l.by}</span>
                      </td>
                      <td className={td}>
                        <span className={cx("num mr-2 font-mono", l.pm25 > settings.pm25Limit && "text-warn")}>{l.pm25}</span>
                        <Pill tone={b.tone}>{b.label}</Pill>
                      </td>
                      <td className={cx(td, "num text-right font-mono")}>{l.noiseDb ?? ""}</td>
                      <td className={td}>
                        <YesNo v={l.dustScreen} />
                      </td>
                      <td className={td}>
                        <YesNo v={l.wheelWash} />
                      </td>
                      <td className={cx(td, "num text-right font-mono")}>{l.waterSprayTimes}</td>
                      <td className={td}>
                        {l.complaints.length ? (
                          <ul className="flex flex-col gap-1">
                            {l.complaints.map((c, k) => (
                              <li key={k} className="flex flex-wrap items-center gap-2 text-[12px]">
                                <span>
                                  {c.text} <span className="text-ink-3">· {c.from}</span>
                                </span>
                                {edit ? (
                                  <button type="button" onClick={() => resolve(l, k)} className={cx("h-6 rounded-[6px] px-2 text-[12px]", c.resolved ? "bg-pos-soft text-pos" : "bg-neg-soft text-neg")}>
                                    {c.resolved ? "แก้ไขแล้ว" : "ค้าง"}
                                  </button>
                                ) : (
                                  <Pill tone={c.resolved ? "pos" : "neg"}>{c.resolved ? "แก้ไขแล้ว" : "ค้าง"}</Pill>
                                )}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-ink-3">-</span>
                        )}
                      </td>
                      <td className={cx(td, "pr-5")}>
                        <MediaStrip refs={l.photos} size={36} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>ยังไม่มีบันทึก กด “บันทึกประจำวัน” เพื่อเริ่ม</Empty>
        )}
        <p className="border-t border-line px-5 py-2.5 text-[12px] text-ink-3">ระดับ PM2.5 ตามเกณฑ์กรมควบคุมมลพิษ (ค่าเฉลี่ย 24 ชม.) · เกณฑ์เพิ่มมาตรการตั้งได้ในการตั้งค่าความปลอดภัย ตรวจสอบกับประกาศล่าสุด</p>
      </Card>

      {editing && <EnvForm key={`${site}|${editing}`} projectId={site} date={editing} existing={logs.find((l) => l.id === `ENV-${site}-${editing}`)} onClose={() => setEditing(null)} />}
    </div>
  );
}

function YesNo({ v }: { v: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-2">
      <Dot tone={v ? "pos" : "neg"} />
      {v ? "มี" : "ไม่มี"}
    </span>
  );
}

function PmChart({ logs, limit }: { logs: EnvLog[]; limit: number }) {
  const W = 720;
  const H = 200;
  const pad = { l: 32, r: 8, t: 10, b: 24 };
  const max = Math.max(limit * 1.3, ...logs.map((l) => l.pm25)) * 1.05;
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const bw = iw / logs.length;
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const ticks = [0, Math.round(max / 3), Math.round((2 * max) / 3)];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="กราฟ PM2.5 รายวัน">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" />
          <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" className="fill-ink-3" fontSize={11}>
            {t}
          </text>
        </g>
      ))}
      {logs.map((l, i) => {
        const x = pad.l + i * bw + bw * 0.15;
        return (
          <g key={l.id}>
            <rect x={x} y={y(l.pm25)} width={bw * 0.7} height={Math.max(1, pad.t + ih - y(l.pm25))} rx={2} fill={l.pm25 > limit ? "var(--warn)" : "var(--deep)"}>
              <title>{`${thDate(l.date)} · ${l.pm25} มคก./ลบ.ม.`}</title>
            </rect>
            {(i % 5 === 0 || i === logs.length - 1) && (
              <text x={x + bw * 0.35} y={H - 6} textAnchor="middle" className="fill-ink-3" fontSize={11}>
                {Number(l.date.slice(8))}/{Number(l.date.slice(5, 7))}
              </text>
            )}
          </g>
        );
      })}
      <line x1={pad.l} x2={W - pad.r} y1={y(limit)} y2={y(limit)} stroke="var(--accent)" strokeDasharray="4 4" />
      <text x={W - pad.r} y={y(limit) - 4} textAnchor="end" fill="var(--accent-text)" fontSize={11}>
        เกณฑ์ {limit}
      </text>
    </svg>
  );
}

function EnvForm({ projectId, date: initialDate, existing, onClose }: { projectId: string; date: string; existing?: EnvLog; onClose: () => void }) {
  const { me } = useSafetyAccess();
  const settings = useSafetySettings();
  const [date, setDate] = useState(initialDate);
  const [pm25, setPm25] = useState(existing?.pm25 ?? 0);
  const [noise, setNoise] = useState<number | undefined>(existing?.noiseDb);
  const [dustScreen, setDustScreen] = useState(existing?.dustScreen ?? true);
  const [wheelWash, setWheelWash] = useState(existing?.wheelWash ?? false);
  const [spray, setSpray] = useState(existing?.waterSprayTimes ?? 0);
  const [complaints, setComplaints] = useState(existing?.complaints ?? []);
  const [photos, setPhotos] = useState<MediaRef[]>(existing?.photos ?? []);
  const [note, setNote] = useState(existing?.note ?? "");
  const id = `ENV-${projectId}-${date}`;
  const clash = date !== initialDate && envLogs.get(id);
  const ok = pm25 > 0;

  const submit = () => {
    if (!ok) return;
    envLogs.upsert({ id, projectId, date, pm25, noiseDb: noise || undefined, dustScreen, wheelWash, waterSprayTimes: spray, complaints: complaints.filter((c) => c.text.trim()), by: existing?.by ?? me.name, photos, note: note.trim() || undefined });
    onClose();
  };
  const toggle = (on: boolean, set: (v: boolean) => void, label: string) => (
    <button type="button" aria-pressed={on} onClick={() => set(!on)} className={cx("flex h-9 items-center gap-2 rounded-[8px] border px-3 text-[13px] transition-colors duration-150", on ? "border-ink-3 bg-raised text-ink" : "border-line-strong text-ink-2 hover:bg-raised")}>
      {on ? <Check {...I} /> : <span className="inline-block size-4" />}
      {label}
    </button>
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={`บันทึกสิ่งแวดล้อม · ${siteName(projectId)}`}
      width={620}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!ok} onClick={submit}>
            บันทึก
          </Btn>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="วันที่">
          <input type="date" max={TODAY} className={inputCls} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </Field>
        <Field label="PM2.5 (มคก./ลบ.ม.)">
          <input type="number" min={0} className={cx(inputCls, "font-mono")} value={pm25 || ""} onChange={(e) => setPm25(Math.max(0, Number(e.target.value) || 0))} />
        </Field>
        <Field label="ระดับเสียง dB(A)">
          <input type="number" min={0} className={cx(inputCls, "font-mono")} value={noise ?? ""} onChange={(e) => setNoise(Number(e.target.value) || undefined)} />
        </Field>
      </div>
      {pm25 > 0 && (
        <p className={cx("mt-2 text-[13px]", pm25 > settings.pm25Limit ? "text-warn" : "text-ink-2")}>
          ระดับ {pm25Band(pm25).label}
          {pm25 > settings.pm25Limit && " · เกินเกณฑ์ ควรเพิ่มการฉีดน้ำและคลุมกองวัสดุ"}
        </p>
      )}
      {clash && <p className="mt-2 text-[13px] text-warn">มีบันทึกของวันนี้อยู่แล้ว การบันทึกจะเขียนทับ</p>}
      <div className="mt-3 flex flex-wrap items-end gap-2">
        {toggle(dustScreen, setDustScreen, "ผ้าใบกันฝุ่น")}
        {toggle(wheelWash, setWheelWash, "ล้างล้อรถ")}
        <Field label="ฉีดน้ำ (ครั้ง/วัน)">
          <input type="number" min={0} className={cx(inputCls, "w-28 font-mono")} value={spray} onChange={(e) => setSpray(Math.max(0, Number(e.target.value) || 0))} />
        </Field>
      </div>
      <div className="mt-4">
        <p className="mb-1.5 text-[13px] text-ink-2">เรื่องร้องเรียนจากเพื่อนบ้าน</p>
        <div className="flex flex-col gap-2">
          {complaints.map((c, k) => (
            <div key={k} className="grid grid-cols-[1fr_160px_32px] items-center gap-2">
              <input className={inputCls} placeholder="เรื่อง" value={c.text} onChange={(e) => setComplaints((cs) => cs.map((x, j) => (j === k ? { ...x, text: e.target.value } : x)))} />
              <input className={inputCls} placeholder="ผู้ร้องเรียน" value={c.from} onChange={(e) => setComplaints((cs) => cs.map((x, j) => (j === k ? { ...x, from: e.target.value } : x)))} />
              <IconBtn label="ลบเรื่องร้องเรียน" danger onClick={() => setComplaints((cs) => cs.filter((_, j) => j !== k))}>
                <Trash2 {...I} />
              </IconBtn>
            </div>
          ))}
        </div>
        <div className="mt-2">
          <Btn small onClick={() => setComplaints((cs) => [...cs, { text: "", from: "", resolved: false }])}>
            <Plus {...I} />
            เพิ่มเรื่องร้องเรียน
          </Btn>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-3">
        <MediaField value={photos} onChange={setPhotos} photosOnly label="รูปมาตรการ/เครื่องวัด" />
        <Field label="หมายเหตุ">
          <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
