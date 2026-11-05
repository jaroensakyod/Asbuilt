"use client";

import { useMemo, useState } from "react";
import { Check, Plus, RotateCcw } from "lucide-react";
import { cx } from "@/components/ui";
import { Pill, type Tone } from "@/components/ops/bits";
import { MediaField, MediaStrip } from "@/components/media/media-field";
import { thDate, TODAY } from "@/lib/data";
import { addDays } from "@/lib/field/calc";
import { addPunch, punchItems, setPunchStatus } from "@/lib/field/store";
import { PUNCH_STATUS_LABEL, type PunchItem, type PunchStatus } from "@/lib/field/types";
import type { MediaRef } from "@/lib/media";
import { useMe } from "@/lib/use-me";
import { getPosition, MBtn, mInput, MLabel, MShell } from "./bits";
import { SitePicker, useSite } from "./m-hub";

export const PUNCH_TONE: Record<PunchStatus, Tone> = { open: "warn", fixed: "accent", verified: "pos" };
const TRADES = ["โครงสร้าง", "ก่ออิฐ/ฉาบ", "กระเบื้อง", "สี", "ฝ้า", "ประตู/หน้าต่าง", "ไฟฟ้า", "ประปา", "สุขภัณฑ์", "งานไม้", "หลังคา"];

export function MPunch() {
  const site = useSite();
  const all = punchItems.use();
  const me = useMe();
  const [tab, setTab] = useState<PunchStatus | "all">("open");
  const [adding, setAdding] = useState(false);
  const [fixing, setFixing] = useState<PunchItem | null>(null);
  const list = useMemo(() => all.filter((p) => p.projectId === site.id).sort((a, b) => b.date.localeCompare(a.date)), [all, site.id]);
  const shown = list.filter((p) => tab === "all" || p.status === tab);
  const count = (s: PunchStatus) => list.filter((p) => p.status === s).length;

  return (
    <MShell title="ตรวจงาน / รายการแก้ไข">
      <div className="mb-3">
        <SitePicker />
      </div>
      <div className="mb-3 grid grid-cols-4 gap-1 rounded-[12px] border border-line bg-raised p-1">
        {(["open", "fixed", "verified", "all"] as const).map((k) => (
          <button key={k} type="button" onClick={() => setTab(k)} aria-pressed={tab === k} className={cx("h-10 rounded-[9px] text-[13px]", tab === k ? "bg-card text-ink shadow-[0_1px_2px_rgba(0,0,0,0.06)]" : "text-ink-2")}>
            {k === "all" ? `ทั้งหมด ${list.length}` : `${k === "open" ? "ต้องแก้" : k === "fixed" ? "รอตรวจ" : "ผ่าน"} ${count(k)}`}
          </button>
        ))}
      </div>
      {adding ? (
        <AddForm projectId={site.id} by={me.name} onDone={() => setAdding(false)} />
      ) : (
        <div className="mb-4">
          <MBtn primary onClick={() => setAdding(true)}>
            <Plus size={18} strokeWidth={1.5} />
            เพิ่มรายการที่ต้องแก้
          </MBtn>
        </div>
      )}
      {shown.length === 0 ? (
        <p className="py-10 text-center text-[14px] text-ink-3">ไม่มีรายการ</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((p) => (
            <li key={p.id} className="rounded-[14px] border border-line bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[15px] font-medium">{p.title}</p>
                  <p className="text-[13px] text-ink-3">
                    {p.location} · {p.trade}
                  </p>
                  <p className="mt-0.5 font-mono text-[12px] text-ink-3">
                    {p.id} · {thDate(p.date)}
                    {p.due && p.status === "open" && <span className={cx(p.due < TODAY && "text-neg")}> · กำหนด {thDate(p.due)}</span>}
                  </p>
                </div>
                <Pill tone={PUNCH_TONE[p.status]}>{PUNCH_STATUS_LABEL[p.status]}</Pill>
              </div>
              {(p.photos.length > 0 || (p.fixPhotos?.length ?? 0) > 0) && (
                <div className="mt-2 flex gap-2 overflow-x-auto">
                  <MediaStrip refs={p.photos} size={64} />
                  {p.fixPhotos && <MediaStrip refs={p.fixPhotos} size={64} />}
                </div>
              )}
              <div className="mt-3 grid grid-cols-2 gap-2">
                {p.status === "open" && (
                  <div className="col-span-2">
                    <MBtn onClick={() => setFixing(p)}>
                      <Check size={18} strokeWidth={1.5} />
                      แก้แล้ว (ถ่ายรูปหลังแก้)
                    </MBtn>
                  </div>
                )}
                {p.status === "fixed" && (
                  <>
                    <MBtn primary onClick={() => setPunchStatus(p.id, "verified")}>
                      ตรวจผ่าน
                    </MBtn>
                    <MBtn onClick={() => setPunchStatus(p.id, "open")}>
                      <RotateCcw size={18} strokeWidth={1.5} />
                      ยังไม่ผ่าน
                    </MBtn>
                  </>
                )}
              </div>
              {fixing?.id === p.id && <FixForm item={p} onDone={() => setFixing(null)} />}
            </li>
          ))}
        </ul>
      )}
    </MShell>
  );
}

function AddForm({ projectId, by, onDone }: { projectId: string; by: string; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [trade, setTrade] = useState(TRADES[0]);
  const [photos, setPhotos] = useState<MediaRef[]>([]);
  return (
    <form
      className="mb-4 flex flex-col gap-3 rounded-[14px] border border-line bg-card p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!title.trim()) return;
        const pos = await getPosition(4000);
        addPunch({ projectId, title: title.trim(), location: location.trim() || "ไม่ระบุ", trade, photos, by, lat: pos?.lat, lng: pos?.lng, due: addDays(TODAY, 7) });
        onDone();
      }}
    >
      <MLabel label="สิ่งที่ต้องแก้">
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={mInput} required autoFocus />
      </MLabel>
      <MLabel label="ตำแหน่ง">
        <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="ชั้น / ห้อง" className={mInput} />
      </MLabel>
      <MLabel label="หมวดงาน">
        <select value={trade} onChange={(e) => setTrade(e.target.value)} className={mInput}>
          {TRADES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </MLabel>
      <MediaField value={photos} onChange={setPhotos} label="รูปจุดที่ต้องแก้" photosOnly />
      <div className="grid grid-cols-2 gap-2">
        <MBtn onClick={onDone}>ยกเลิก</MBtn>
        <MBtn primary type="submit" disabled={!title.trim()}>
          บันทึก
        </MBtn>
      </div>
    </form>
  );
}

function FixForm({ item, onDone }: { item: PunchItem; onDone: () => void }) {
  const [photos, setPhotos] = useState<MediaRef[]>(item.fixPhotos ?? []);
  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
      <MediaField value={photos} onChange={setPhotos} label="รูปหลังแก้" photosOnly />
      <div className="grid grid-cols-2 gap-2">
        <MBtn onClick={onDone}>ยกเลิก</MBtn>
        <MBtn
          primary
          onClick={() => {
            setPunchStatus(item.id, "fixed", photos);
            onDone();
          }}
        >
          ยืนยันแก้แล้ว
        </MBtn>
      </div>
    </div>
  );
}
