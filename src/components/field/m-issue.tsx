"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, MapPin } from "lucide-react";
import { cx } from "@/components/ui";
import { MediaField } from "@/components/media/media-field";
import { getProject, projects, SEVERITY_LABEL, SYSTEM_LABEL, type Severity, type SystemKey } from "@/lib/data";
import { reportIssue } from "@/lib/field/store";
import type { FieldIssue } from "@/lib/field/types";
import type { MediaRef } from "@/lib/media";
import { useMe } from "@/lib/use-me";
import { getPosition, MBtn, mArea, mInput, MLabel, MShell } from "./bits";
import { useSite } from "./m-hub";

const SYSTEMS = Object.keys(SYSTEM_LABEL) as SystemKey[];

function Chips<T extends string>({ value, options, onChange, label }: { value: T; options: { key: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o.key} type="button" role="radio" aria-checked={value === o.key} onClick={() => onChange(o.key)} className={cx("h-11 rounded-[12px] border px-4 text-[14px]", value === o.key ? "border-ink bg-ink text-card" : "border-line-strong bg-card text-ink-2")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function MIssue() {
  const me = useMe();
  const site = useSite();
  const [pid, setPid] = useState("");
  const projectId = pid || site.id;
  const [kind, setKind] = useState<FieldIssue["kind"]>("defect");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [detail, setDetail] = useState("");
  const [system, setSystem] = useState<SystemKey>("arch");
  const [severity, setSeverity] = useState<Severity>("medium");
  const [photos, setPhotos] = useState<MediaRef[]>([]);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [done, setDone] = useState<FieldIssue | null>(null);
  const choices = projects.filter((p) => p.status !== "planning");

  if (done)
    return (
      <MShell title="แจ้งปัญหา/แจ้งซ่อม">
        <div className="rounded-[14px] border border-line bg-card p-5 text-center">
          <Check size={32} strokeWidth={1.5} className="mx-auto text-pos" />
          <p className="mt-2 text-[16px] font-medium">{done.kind === "repair" ? `เปิดเรื่องแจ้งซ่อม ${done.repairId}` : `เพิ่มรายการแก้ไข ${done.punchId}`}</p>
          <p className="mt-1 text-[13px] text-ink-2">{getProject(done.projectId)?.name}</p>
          <div className="mt-4 flex flex-col gap-2">
            <Link href={done.kind === "repair" ? `/repairs?q=${done.repairId}` : "/m/punch"} className="inline-flex h-12 items-center justify-center rounded-[12px] border border-line-strong bg-card text-[15px] font-medium">
              ดูรายการ
            </Link>
            <MBtn
              primary
              onClick={() => {
                setDone(null);
                setTitle("");
                setDetail("");
                setLocation("");
                setPhotos([]);
                setPin(null);
              }}
            >
              แจ้งเรื่องถัดไป
            </MBtn>
          </div>
        </div>
      </MShell>
    );

  return (
    <MShell title="แจ้งปัญหา/แจ้งซ่อม">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim() || !projectId) return;
          setDone(reportIssue({ projectId, kind, title: title.trim(), detail: detail.trim() || undefined, system, photos, lat: pin?.lat, lng: pin?.lng, by: me.name, location: location.trim() || "ไม่ระบุ", severity }));
        }}
      >
        <MLabel label="โครงการ">
          <select value={projectId} onChange={(e) => setPid(e.target.value)} className={mInput}>
            {choices.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.id}
              </option>
            ))}
          </select>
        </MLabel>
        <div>
          <p className="mb-1.5 text-[14px] text-ink-2">ประเภท</p>
          <Chips
            label="ประเภท"
            value={kind}
            onChange={setKind}
            options={[
              { key: "defect", label: "งานต้องแก้ (ระหว่างก่อสร้าง)" },
              { key: "repair", label: "แจ้งซ่อม" },
            ]}
          />
        </div>
        <MLabel label="เรื่อง">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น ผนังร้าว น้ำรั่วใต้ซิงค์" className={mInput} required />
        </MLabel>
        <MLabel label="ตำแหน่ง">
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="เช่น ชั้น 2 · ห้องน้ำ 1" className={mInput} />
        </MLabel>
        <div>
          <p className="mb-1.5 text-[14px] text-ink-2">ระบบงาน</p>
          <Chips label="ระบบงาน" value={system} onChange={setSystem} options={SYSTEMS.map((s) => ({ key: s, label: SYSTEM_LABEL[s] }))} />
        </div>
        {kind === "repair" && (
          <div>
            <p className="mb-1.5 text-[14px] text-ink-2">ความรุนแรง</p>
            <Chips label="ความรุนแรง" value={severity} onChange={setSeverity} options={(["high", "medium", "low"] as Severity[]).map((s) => ({ key: s, label: SEVERITY_LABEL[s] }))} />
          </div>
        )}
        <MLabel label="รายละเอียด">
          <textarea value={detail} onChange={(e) => setDetail(e.target.value)} className={mArea} />
        </MLabel>
        <MediaField value={photos} onChange={setPhotos} label="รูปถ่าย" photosOnly />
        <div className="rounded-[14px] border border-line bg-card p-3">
          <p className="text-[14px]">ปักหมุดตำแหน่ง</p>
          <p className="mt-0.5 text-[13px] text-ink-3">{pin ? `${pin.lat}, ${pin.lng}` : "ยังไม่ได้ปักหมุด (ไม่บังคับ)"}</p>
          <div className="mt-2">
            <MBtn
              disabled={locating}
              onClick={async () => {
                setLocating(true);
                const p = await getPosition();
                setPin(p ?? null);
                setLocating(false);
                if (!p) window.alert("อ่านพิกัดไม่ได้ ตรวจสอบสิทธิ์ตำแหน่งของเบราว์เซอร์");
              }}
            >
              <MapPin size={18} strokeWidth={1.5} />
              {locating ? "กำลังหาพิกัด" : pin ? "ปักหมุดใหม่" : "ใช้ตำแหน่งปัจจุบัน"}
            </MBtn>
          </div>
        </div>
        <MBtn primary type="submit" disabled={!title.trim()}>
          ส่งเรื่อง
        </MBtn>
      </form>
    </MShell>
  );
}
