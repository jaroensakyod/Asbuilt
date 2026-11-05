"use client";

// /m/clock — phone time clock. Check-ins/outs go straight into the site's attendance sheet
// (attendance collection), so daily-wage payroll keeps working from the same records.

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, LogIn, LogOut, MapPin, ScanLine, Search, Trash2, X } from "lucide-react";
import { cx } from "@/components/ui";
import { Pill, Segmented, useHydrated, type Tone } from "@/components/ops/bits";
import { MediaField } from "@/components/media/media-field";
import { getProject, TODAY } from "@/lib/data";
import type { MediaRef } from "@/lib/media";
import { checkFence, clockIn, clockOut, fenceFor, verification, workedHours, type Verified } from "@/lib/hr/clock";
import { useClockSettings } from "@/lib/hr/labour-store";
import { attendance, employees } from "@/lib/hr/store";
import type { AttendanceEntry, ClockStamp, Employee } from "@/lib/hr/types";
import { timeOfDay } from "@/lib/safety/now";
import { useMe } from "@/lib/use-me";
import { getFix, PhoneBtn, PhoneCard, PhoneLabel, PhoneShell, PhoneSiteSelect, phoneInput, useRememberedSite } from "@/components/safety/phone-bits";

type Mode = "self" | "crew";
type Result = { kind: "in" | "out"; at: string; names: string[]; skipped: string[]; dist?: number; inside?: boolean; noGps: boolean };

export const VERIFY_LABEL: Record<Verified, string> = { gps: "GPS ในเขต", outside: "นอกเขต", qr: "QR/รหัส", manual: "ป้อนเอง" };
export const VERIFY_TONE: Record<Verified, Tone> = { gps: "pos", outside: "warn", qr: "accent", manual: "neutral" };

/** "31" → EMP-0031, "emp-31" → EMP-0031, "sc-1" → SC-001 */
export function normalizeCode(raw: string) {
  const s = raw.trim().toUpperCase().replace(/\s+/g, "");
  if (!s) return "";
  const sc = s.match(/^SC-?(\d+)$/);
  if (sc) return `SC-${sc[1].padStart(3, "0")}`;
  const emp = s.match(/^(?:EMP-?)?(\d+)$/);
  if (emp) return `EMP-${emp[1].padStart(4, "0")}`;
  return s;
}

export function ClockPhone() {
  const me = useMe();
  const hydrated = useHydrated();
  const [site, setSite] = useRememberedSite();
  const [mode, setMode] = useState<Mode>("self");
  const emps = employees.use();
  const sheets = attendance.use();
  const clock = useClockSettings();
  const fence = fenceFor(site, getProject(site), clock);
  const sheetId = `ATT-${site}-${TODAY}`;
  const sheet = sheets.find((s) => s.id === sheetId);

  const crew = useMemo(() => emps.filter((e) => e.projectId === site && e.status !== "resigned" && (e.type === "daily" || e.type === "monthly")), [emps, site]);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);

  /** stamp a list of employees in or out with one GPS fix */
  const stamp = async (kind: "in" | "out", ids: string[], method: "gps" | "qr", selfie?: MediaRef) => {
    if (!ids.length) return;
    setBusy(true);
    const fix = await getFix();
    const at = timeOfDay();
    const f = fix ? checkFence(fix, fence) : {};
    const base: ClockStamp = fix ? { at, method, lat: fix.lat, lng: fix.lng, acc: fix.acc, ...f } : { at, method: method === "qr" ? "qr" : "manual" };
    if (method === "qr") base.by = me.name;
    let s = attendance.get(sheetId);
    const done: string[] = [];
    const skipped: string[] = [];
    const nameOf = (id: string) => emps.find((e) => e.id === id)?.name ?? id;
    for (const id of ids) {
      const st: ClockStamp = selfie ? { ...base, selfie } : base;
      if (kind === "in") {
        s = clockIn(s, { projectId: site, date: TODAY, by: me.name }, id, st);
        done.push(nameOf(id));
      } else if (s && s.entries.some((e) => e.employeeId === id && e.in)) {
        s = clockOut(s, id, st, clock);
        done.push(nameOf(id));
      } else skipped.push(nameOf(id));
    }
    if (s && done.length) attendance.upsert(s);
    setResult({ kind, at, names: done, skipped, dist: f.dist, inside: f.inside, noGps: !fix });
    setBusy(false);
  };

  const present = sheet?.entries.filter((e) => e.in || e.mark !== "absent").length ?? 0;

  return (
    <PhoneShell title="ลงเวลาเข้า-ออกงาน">
      <PhoneSiteSelect
        value={site}
        onChange={(v) => {
          setSite(v);
          setResult(null);
        }}
      />
      <p className="-mt-2 flex items-center gap-1.5 text-[13px] text-ink-3">
        <MapPin size={14} strokeWidth={1.5} />
        {fence.lat !== undefined ? `รัศมีหน้างาน ${fence.radius} ม. ตั้งค่าได้ที่ /hr/attendance` : "หน้างานนี้ยังไม่มีพิกัด ระบบจะบันทึกพิกัดไว้แต่ตรวจเขตไม่ได้"}
      </p>

      <Segmented
        value={mode}
        onChange={(m) => {
          setMode(m);
          setResult(null);
        }}
        options={[
          { key: "self", label: "ลงเวลาตัวเอง" },
          { key: "crew", label: "ทั้งทีม (QR/รหัส)" },
        ]}
      />

      {mode === "self" ? <SelfMode key={site} crew={crew} meName={me.name} sheet={hydrated ? (sheet?.entries ?? []) : []} busy={busy} onStamp={(kind, id, selfie) => void stamp(kind, [id], "gps", selfie)} /> : <CrewMode key={site} emps={emps} busy={busy} onStamp={(kind, ids) => void stamp(kind, ids, "qr")} />}

      {result && <ResultCard r={result} radius={fence.radius} onClose={() => setResult(null)} />}

      <PhoneCard className="p-0">
        <div className="flex items-baseline justify-between border-b border-line px-4 py-3">
          <h2 className="text-[16px] font-medium">วันนี้ที่หน้างาน</h2>
          <span className="num font-mono text-[13px] text-ink-3">
            {hydrated ? present : 0}/{crew.length} คน
          </span>
        </div>
        {hydrated && sheet?.entries.length ? (
          <ul>
            {sheet.entries.map((e) => (
              <TodayRow key={e.employeeId} e={e} emp={emps.find((x) => x.id === e.employeeId)} clock={clock} />
            ))}
          </ul>
        ) : (
          <p className="px-4 py-8 text-center text-[14px] text-ink-3">ยังไม่มีใครลงเวลาวันนี้</p>
        )}
      </PhoneCard>
    </PhoneShell>
  );
}

function TodayRow({ e, emp, clock }: { e: AttendanceEntry; emp?: Employee; clock: Parameters<typeof workedHours>[2] }) {
  const v = verification(e);
  const hours = e.in && e.out ? workedHours(e.in.at, e.out.at, clock) : undefined;
  return (
    <li className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px]">{emp?.name ?? e.employeeId}</p>
        <p className="font-mono text-[12px] text-ink-3">
          {e.employeeId}
          {emp?.skill ? ` · ${emp.skill}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="num font-mono text-[14px]">
          {e.in?.at ?? "–"} → {e.out?.at ?? "…"}
        </span>
        <span className="flex items-center gap-1.5">
          {hours !== undefined && <span className="num font-mono text-[12px] text-ink-3">{hours} ชม.</span>}
          <Pill tone={VERIFY_TONE[v]}>
            {VERIFY_LABEL[v]}
            {v === "outside" && e.in?.dist !== undefined ? ` ${e.in.dist} ม.` : ""}
          </Pill>
        </span>
      </div>
    </li>
  );
}

function ResultCard({ r, radius, onClose }: { r: Result; radius: number; onClose: () => void }) {
  const outside = r.inside === false;
  return (
    <section className={cx("relative rounded-[14px] border p-4", outside ? "border-warn/40 bg-warn-soft" : "border-line bg-card")} aria-live="polite">
      <button type="button" onClick={onClose} aria-label="ปิด" className="absolute right-2 top-2 inline-flex size-9 items-center justify-center rounded-[8px] text-ink-3 hover:bg-raised">
        <X size={18} strokeWidth={1.5} />
      </button>
      <p className="text-[13px] text-ink-2">{r.kind === "in" ? "บันทึกเข้างานแล้ว" : "บันทึกออกงานแล้ว"}</p>
      <p className="num mt-1 font-mono text-[34px] leading-none">{r.at}</p>
      {r.names.length > 0 && <p className="mt-2 text-[14px]">{r.names.length > 3 ? `${r.names.slice(0, 3).join(", ")} และอีก ${r.names.length - 3} คน` : r.names.join(", ")}</p>}
      <div className="mt-3 flex flex-wrap gap-2 text-[13px]">
        {r.noGps ? (
          <Pill tone="neutral">ไม่ได้รับพิกัด บันทึกแบบป้อนเอง</Pill>
        ) : r.dist !== undefined ? (
          <Pill tone={outside ? "warn" : "pos"}>
            {outside ? "นอกเขตหน้างาน" : "ในเขตหน้างาน"} · <span className="font-mono">{r.dist} ม.</span>
          </Pill>
        ) : (
          <Pill tone="neutral">บันทึกพิกัดแล้ว (หน้างานไม่มีพิกัด)</Pill>
        )}
      </div>
      {outside && <p className="mt-2 text-[13px] text-warn">อยู่นอกเขตหน้างาน {r.dist} ม. (รัศมี {radius} ม.) บันทึกได้ แต่จะถูกทำเครื่องหมายให้โฟร์แมนตรวจสอบ</p>}
      {r.skipped.length > 0 && <p className="mt-2 text-[13px] text-neg">ยังไม่ได้ลงเวลาเข้า: {r.skipped.join(", ")}</p>}
    </section>
  );
}

// ---------- self mode ----------

function SelfMode({ crew, meName, sheet, busy, onStamp }: { crew: Employee[]; meName: string; sheet: AttendanceEntry[]; busy: boolean; onStamp: (kind: "in" | "out", id: string, selfie?: MediaRef) => void }) {
  const [picked, setPicked] = useState("");
  const [q, setQ] = useState("");
  const [selfie, setSelfie] = useState<MediaRef[]>([]);
  const mine = crew.find((e) => e.name === meName);
  const id = picked || mine?.id || "";
  const emp = crew.find((e) => e.id === id);
  const entry = sheet.find((e) => e.employeeId === id);
  const shown = crew.filter((e) => !q.trim() || e.name.includes(q.trim()) || e.id.toLowerCase().includes(q.trim().toLowerCase()) || (e.nickname ?? "").includes(q.trim()));

  return (
    <>
      <PhoneCard>
        <PhoneLabel label="ผู้ลงเวลา">
          <div className="relative">
            <Search size={18} strokeWidth={1.5} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
            <input className={cx(phoneInput, "pl-10")} placeholder="ค้นหาชื่อหรือรหัส" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </PhoneLabel>
        <ul className="mt-2 max-h-[260px] overflow-y-auto">
          {shown.map((e) => {
            const en = sheet.find((x) => x.employeeId === e.id);
            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => setPicked(e.id)}
                  aria-pressed={e.id === id}
                  className={cx("flex min-h-12 w-full items-center gap-3 rounded-[10px] px-3 py-2 text-left", e.id === id ? "bg-ink text-card" : "hover:bg-raised")}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px]">{e.name}</span>
                    <span className={cx("block font-mono text-[12px]", e.id === id ? "text-card/70" : "text-ink-3")}>
                      {e.id} · {e.skill ?? e.position}
                    </span>
                  </span>
                  {en?.in && <span className="num font-mono text-[12px]">{en.out ? `ออก ${en.out.at}` : `เข้า ${en.in.at}`}</span>}
                </button>
              </li>
            );
          })}
          {!shown.length && <li className="px-3 py-6 text-center text-[14px] text-ink-3">ไม่พบคนงานที่หน้างานนี้</li>}
        </ul>
      </PhoneCard>

      {emp && (
        <PhoneCard>
          <p className="text-[13px] text-ink-3">ลงเวลาให้</p>
          <p className="text-[18px]">{emp.name}</p>
          <p className="mb-3 text-[13px] text-ink-2">{entry?.in ? `เข้างาน ${entry.in.at}${entry.out ? ` · ออกงาน ${entry.out.at}` : ""}` : "ยังไม่ได้ลงเวลาวันนี้"}</p>
          <MediaField value={selfie} onChange={setSelfie} label="รูปยืนยันตัวตน (ไม่บังคับ)" photosOnly max={1} />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <PhoneBtn primary disabled={busy || !!entry?.in} onClick={() => (onStamp("in", emp.id, selfie[0]), setSelfie([]))} className="h-16 text-[17px]">
              <LogIn size={20} strokeWidth={1.5} />
              เข้างาน
            </PhoneBtn>
            <PhoneBtn disabled={busy || !entry?.in || !!entry?.out} onClick={() => (onStamp("out", emp.id, selfie[0]), setSelfie([]))} className="h-16 text-[17px]">
              <LogOut size={20} strokeWidth={1.5} />
              ออกงาน
            </PhoneBtn>
          </div>
          {busy && <p className="mt-2 text-center text-[13px] text-ink-3">กำลังอ่านพิกัด GPS</p>}
        </PhoneCard>
      )}
    </>
  );
}

// ---------- crew / QR mode ----------

function CrewMode({ emps, busy, onStamp }: { emps: Employee[]; busy: boolean; onStamp: (kind: "in" | "out", ids: string[]) => void }) {
  const [code, setCode] = useState("");
  const [queue, setQueue] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [scan, setScan] = useState(false);
  const hydrated = useHydrated();
  const canScan = hydrated && typeof window !== "undefined" && "BarcodeDetector" in window && !!navigator.mediaDevices?.getUserMedia;

  const add = (raw: string) => {
    const id = normalizeCode(raw);
    if (!id) return;
    const e = emps.find((x) => x.id === id);
    if (!e) {
      setError(`ไม่พบรหัส ${id}`);
      return;
    }
    setError("");
    setQueue((q) => (q.includes(id) ? q : [...q, id]));
  };

  return (
    <PhoneCard>
      <PhoneLabel label="สแกน QR หรือพิมพ์รหัสคนงาน">
        <input
          className={cx(phoneInput, "font-mono text-[18px]")}
          inputMode="text"
          autoCapitalize="characters"
          placeholder="EMP-0031 หรือ 31"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              code.split(/[\s,]+/).forEach(add);
              setCode("");
            }
          }}
        />
      </PhoneLabel>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <PhoneBtn
          onClick={() => {
            code.split(/[\s,]+/).forEach(add);
            setCode("");
          }}
          disabled={!code.trim()}
        >
          เพิ่มในรายการ
        </PhoneBtn>
        {canScan && (
          <PhoneBtn onClick={() => setScan(true)}>
            <Camera size={20} strokeWidth={1.5} />
            สแกน QR
          </PhoneBtn>
        )}
      </div>
      {error && <p className="mt-2 text-[13px] text-neg">{error}</p>}
      {scan && <Scanner onCode={add} onClose={() => setScan(false)} />}

      <ul className="mt-3">
        {queue.map((id) => {
          const e = emps.find((x) => x.id === id);
          return (
            <li key={id} className="flex min-h-12 items-center gap-3 border-b border-line py-1 last:border-0">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px]">{e?.name ?? id}</span>
                <span className="block font-mono text-[12px] text-ink-3">
                  {id}
                  {e?.projectId ? ` · ${e.projectId}` : ""}
                </span>
              </span>
              <button type="button" aria-label={`เอา ${e?.name ?? id} ออก`} onClick={() => setQueue((q) => q.filter((x) => x !== id))} className="inline-flex size-11 items-center justify-center rounded-[10px] text-ink-3 hover:bg-raised hover:text-neg">
                <Trash2 size={18} strokeWidth={1.5} />
              </button>
            </li>
          );
        })}
        {!queue.length && <li className="py-4 text-center text-[14px] text-ink-3">ยังไม่มีคนในรายการ</li>}
      </ul>

      <div className="mt-3 grid gap-2">
        <PhoneBtn
          primary
          disabled={busy || !queue.length}
          onClick={() => {
            onStamp("in", queue);
            setQueue([]);
          }}
        >
          <LogIn size={20} strokeWidth={1.5} />
          เข้างานทั้งหมด {queue.length} คน
        </PhoneBtn>
        <PhoneBtn
          disabled={busy || !queue.length}
          onClick={() => {
            onStamp("out", queue);
            setQueue([]);
          }}
        >
          <LogOut size={20} strokeWidth={1.5} />
          ออกงานทั้งหมด
        </PhoneBtn>
      </div>
      <p className="mt-2 text-[12px] text-ink-3">ใช้พิกัด GPS ของโฟร์แมนครั้งเดียวสำหรับทุกคน และบันทึกชื่อผู้ลงเวลาแทน</p>
    </PhoneCard>
  );
}

type Detector = { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
type DetectorCtor = new (o: { formats: string[] }) => Detector;

/** rear-camera QR scanner using the browser BarcodeDetector (Chrome / Android) */
function Scanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const cb = useRef(onCode);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    cb.current = onCode;
  }, [onCode]);
  useEffect(() => {
    let stream: MediaStream | undefined;
    let timer: number | undefined;
    let stopped = false;
    const seen = new Set<string>();
    const Ctor = (window as unknown as { BarcodeDetector: DetectorCtor }).BarcodeDetector;
    const detector = new Ctor({ formats: ["qr_code", "code_128"] });
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((s) => {
        if (stopped) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        const v = video.current;
        if (!v) return;
        v.srcObject = s;
        void v.play();
        timer = window.setInterval(async () => {
          if (!v.videoWidth) return;
          try {
            for (const c of await detector.detect(v)) {
              const val = c.rawValue.trim();
              if (val && !seen.has(val)) {
                seen.add(val);
                cb.current(val);
              }
            }
          } catch {
            // frame not ready
          }
        }, 400);
      })
      .catch(() => setFailed(true));
    return () => {
      stopped = true;
      window.clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  return (
    <div className="mt-3 overflow-hidden rounded-[12px] border border-line bg-ink">
      <div className="relative aspect-[4/3]">
        <video ref={video} muted playsInline className="size-full object-cover" />
        <ScanLine size={64} strokeWidth={1} className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-card/70" />
      </div>
      {failed && <p className="bg-card px-3 py-2 text-[13px] text-neg">เปิดกล้องไม่ได้ พิมพ์รหัสแทน</p>}
      <button type="button" onClick={onClose} className="h-12 w-full bg-card text-[15px]">
        ปิดกล้อง
      </button>
    </div>
  );
}
