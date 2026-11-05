"use client";

import { useMemo } from "react";
import Link from "next/link";
import { MapPin, Phone } from "lucide-react";
import { cx } from "@/components/ui";
import { Pill, SEV_TONE, useHydrated } from "@/components/ops/bits";
import { WO_TONE } from "@/components/ops/work-orders-view";
import { getProject, SEVERITY_LABEL, team, thDate, TODAY, WO_STATUS_LABEL } from "@/lib/data";
import { useRepairs, useWorkOrders, type OpsWorkOrder } from "@/lib/ops-store";
import { mTech } from "@/lib/field/site";
import { technicians, woService } from "@/lib/field/store";
import { useMe } from "@/lib/use-me";
import { mapsUrl, MShell } from "./bits";
import { ChargeBox, CheckInBox, ChecklistBox, CloseBox, NotesBox, PartsBox, PhotosBox, SignBox } from "./wo-service";

const OPEN = ["assigned", "in_progress", "on_hold"];

export function useMyTech() {
  const me = useMe();
  const saved = mTech.use();
  const techs = technicians();
  return saved || (me.role === "technician" ? me.name : (techs[0]?.name ?? ""));
}

export function MJobs() {
  const tech = useMyTech();
  const hydrated = useHydrated();
  const wos = useWorkOrders();
  const svc = woService.use();
  const mine = useMemo(() => wos.filter((w) => w.technician === tech).sort((a, b) => Number(!OPEN.includes(a.status)) - Number(!OPEN.includes(b.status)) || a.scheduled.localeCompare(b.scheduled)), [wos, tech]);
  const open = mine.filter((w) => OPEN.includes(w.status));
  const done = mine.filter((w) => !OPEN.includes(w.status)).slice(0, 10);
  const slot = (w: OpsWorkOrder) => svc.find((s) => s.id === w.id)?.slot;

  return (
    <MShell title="งานของฉัน">
      <label className="mb-4 flex flex-col gap-1.5 text-[13px] text-ink-3">
        ช่าง
        <select value={tech} onChange={(e) => mTech.set(e.target.value)} className="h-12 rounded-[12px] border border-line-strong bg-card px-3 text-[16px] text-ink">
          {technicians().map((t) => (
            <option key={t.id} value={t.name}>
              {t.name} · {t.skill}
            </option>
          ))}
        </select>
      </label>
      {!hydrated ? (
        <p className="py-10 text-center text-ink-3">กำลังโหลด</p>
      ) : (
        <>
          <h2 className="mb-2 text-[15px] font-medium">งานเปิดอยู่ {open.length}</h2>
          {open.length === 0 && <p className="mb-4 rounded-[14px] border border-line bg-card p-4 text-center text-[14px] text-ink-3">ไม่มีงานค้าง</p>}
          <ul className="mb-6 flex flex-col gap-3">
            {open.map((w) => {
              const p = getProject(w.projectId);
              const s = slot(w);
              return (
                <li key={w.id} className={cx("rounded-[14px] border bg-card", w.scheduled <= TODAY ? "border-ink-3" : "border-line")}>
                  <Link href={`/m/jobs/${w.id}`} className="block p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[15px] font-medium leading-snug">{w.title}</p>
                      <Pill tone={WO_TONE[w.status]}>{WO_STATUS_LABEL[w.status]}</Pill>
                    </div>
                    <p className="mt-1 text-[13px] text-ink-2">
                      {p?.owner} · {p?.province}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-[13px]">
                      <span className={cx("num font-mono", w.scheduled < TODAY ? "text-neg" : w.scheduled === TODAY ? "text-ink" : "text-ink-3")}>
                        {w.scheduled === TODAY ? "วันนี้" : thDate(w.scheduled)}
                        {s ? (s === "am" ? " เช้า" : " บ่าย") : ""}
                      </span>
                      <Pill tone={SEV_TONE[w.severity]}>{SEVERITY_LABEL[w.severity]}</Pill>
                      {w.billing === "charge" && <Pill>คิดค่าบริการ</Pill>}
                    </p>
                  </Link>
                  <div className="grid grid-cols-2 border-t border-line">
                    <a href={mapsUrl(p?.lat, p?.lng, p?.address)} target="_blank" rel="noreferrer" className="inline-flex h-12 items-center justify-center gap-2 text-[14px] text-ink-2">
                      <MapPin size={18} strokeWidth={1.5} />
                      นำทาง
                    </a>
                    <a href={`tel:${p?.phone ?? ""}`} className="inline-flex h-12 items-center justify-center gap-2 border-l border-line text-[14px] text-ink-2">
                      <Phone size={18} strokeWidth={1.5} />
                      โทรลูกค้า
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
          {done.length > 0 && (
            <>
              <h2 className="mb-2 text-[15px] font-medium text-ink-2">ปิดแล้วล่าสุด</h2>
              <ul className="flex flex-col divide-y divide-line rounded-[14px] border border-line bg-card">
                {done.map((w) => (
                  <li key={w.id}>
                    <Link href={`/m/jobs/${w.id}`} className="flex items-center justify-between gap-2 px-4 py-3 text-[14px]">
                      <span className="min-w-0 truncate">{w.title}</span>
                      <span className="shrink-0 font-mono text-[12px] text-ink-3">{w.id}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </MShell>
  );
}

export function MJob({ id }: { id: string }) {
  const wos = useWorkOrders();
  const repairs = useRepairs();
  const hydrated = useHydrated();
  const wo = wos.find((w) => w.id === id);
  if (!wo)
    return (
      <MShell title="งาน" back="/m/jobs">
        <p className="py-10 text-center text-ink-3">{hydrated ? `ไม่พบใบสั่งงาน ${id}` : "กำลังโหลด"}</p>
      </MShell>
    );
  const p = getProject(wo.projectId);
  const r = repairs.find((x) => x.id === wo.repairId);
  const tech = team.find((m) => m.name === wo.technician);
  return (
    <MShell title={wo.id} back="/m/jobs">
      <div className="overflow-hidden rounded-[14px] border border-line bg-card">
        <div className="px-4 py-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <Pill tone={WO_TONE[wo.status]}>{WO_STATUS_LABEL[wo.status]}</Pill>
            <Pill tone={SEV_TONE[wo.severity]}>{SEVERITY_LABEL[wo.severity]}</Pill>
            <Pill>{wo.billing === "charge" ? "คิดค่าบริการ" : "ในประกัน"}</Pill>
          </div>
          <p className="mt-2 text-[17px] font-medium leading-snug">{wo.title}</p>
          {r?.detail && <p className="mt-1 text-[14px] text-ink-2">{r.detail}</p>}
          <p className="mt-2 text-[14px]">
            {p?.owner} · <span className="font-mono">{p?.phone}</span>
          </p>
          <p className="text-[13px] text-ink-3">{p?.address}</p>
          <p className="mt-1 text-[13px] text-ink-3">
            นัด {thDate(wo.scheduled)} · ช่าง {wo.technician}
            {tech ? ` (${tech.skill})` : ""}
          </p>
          <a href={`tel:${p?.phone ?? ""}`} className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[12px] border border-line-strong text-[15px] font-medium">
            <Phone size={18} strokeWidth={1.5} />
            โทรหาลูกค้า
          </a>
        </div>
        <CheckInBox wo={wo} big />
        <ChecklistBox wo={wo} big />
        <PhotosBox wo={wo} big />
        <PartsBox wo={wo} big />
        <NotesBox wo={wo} big />
        <ChargeBox wo={wo} big />
        <SignBox wo={wo} big />
        <CloseBox wo={wo} big />
      </div>
    </MShell>
  );
}
