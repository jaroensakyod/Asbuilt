"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Plus, Trash2 } from "lucide-react";
import { cx } from "@/components/ui";
import { I, useHydrated } from "@/components/ops/bits";
import { MediaField } from "@/components/media/media-field";
import { subcontractors, wbsTasks, WEATHER_LABEL, type Weather } from "@/lib/biz";
import { thDate, TODAY } from "@/lib/data";
import { diaryId, diaryTotals } from "@/lib/field/calc";
import { diaries, newDiary, saveDiary, submitDiary } from "@/lib/field/store";
import { DIARY_STATUS_LABEL, type Diary } from "@/lib/field/types";
import { useMe } from "@/lib/use-me";
import { MBtn, mArea, mInput, MLabel, MShell, Stepper, WEATHERS, WeatherIcon } from "./bits";
import { SitePicker, useSite } from "./m-hub";

export function MDiary() {
  const site = useSite();
  const hydrated = useHydrated();
  const list = diaries.use();
  const me = useMe();
  const existing = list.find((d) => d.id === diaryId(site.id, TODAY));
  return (
    <MShell title="รายงานประจำวัน">
      <div className="mb-4">
        <SitePicker />
      </div>
      {!hydrated || !site.id ? (
        <p className="py-10 text-center text-ink-3">กำลังโหลด</p>
      ) : existing && existing.status !== "draft" ? (
        <div className="rounded-[14px] border border-line bg-card p-4">
          <p className="text-[15px] font-medium">ส่งรายงานวันนี้แล้ว</p>
          <p className="mt-1 text-[13px] text-ink-2">
            {DIARY_STATUS_LABEL[existing.status]} · คนงาน {diaryTotals(existing).headcount} คน · ส่งเมื่อ {existing.submittedAt}
          </p>
          <Link href={`/diary/${existing.id}`} className="mt-3 inline-flex h-11 items-center rounded-[12px] border border-line-strong bg-card px-4 text-[14px] font-medium">
            ดูรายงาน
          </Link>
        </div>
      ) : (
        <Form key={`${site.id}-${existing?.id ?? "new"}`} initial={existing ?? newDiary(site.id, TODAY, me.name)} />
      )}
    </MShell>
  );
}

function Form({ initial }: { initial: Diary }) {
  const [d, setD] = useState<Diary>(initial);
  const [saved, setSaved] = useState<"" | "draft" | "sent">("");
  const subs = subcontractors.use();
  const allTasks = wbsTasks.use();
  const tasks = useMemo(() => allTasks.filter((t) => t.projectId === d.projectId && !t.milestone && t.pct < 100 && !allTasks.some((c) => c.parentId === t.id)), [allTasks, d.projectId]);
  const [crew, setCrew] = useState("");
  const set = <K extends keyof Diary>(k: K, v: Diary[K]) => setD((x) => ({ ...x, [k]: v }));
  const tot = diaryTotals(d);

  if (saved === "sent")
    return (
      <div className="rounded-[14px] border border-line bg-card p-5 text-center">
        <Check size={32} strokeWidth={1.5} className="mx-auto text-pos" />
        <p className="mt-2 text-[16px] font-medium">ส่งรายงาน {thDate(d.date)} แล้ว</p>
        <p className="mt-1 text-[13px] text-ink-2">ผู้จัดการโครงการจะได้รับแจ้งเพื่ออนุมัติ หากยังไม่มีสัญญาณ ระบบจะส่งให้เองเมื่อออนไลน์</p>
        <Link href="/m" className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-[12px] bg-ink text-[15px] font-medium text-card">
          กลับหน้าหลัก
        </Link>
      </div>
    );

  return (
    <div className="flex flex-col gap-5">
      {d.comment && <p className="rounded-[12px] bg-warn-soft px-3 py-2 text-[14px] text-warn">ความเห็นผู้ตรวจ: {d.comment}</p>}
      <section>
        <h2 className="mb-2 text-[15px] font-medium">สภาพอากาศ</h2>
        {(["weatherAm", "weatherPm"] as const).map((k) => (
          <div key={k} className="mb-2">
            <p className="mb-1 text-[13px] text-ink-3">{k === "weatherAm" ? "ช่วงเช้า" : "ช่วงบ่าย"}</p>
            <div className="grid grid-cols-4 gap-2">
              {WEATHERS.map((w) => (
                <button key={w} type="button" onClick={() => set(k, w as Weather)} aria-pressed={d[k] === w} className={cx("flex h-14 flex-col items-center justify-center gap-0.5 rounded-[12px] border text-[12px]", d[k] === w ? "border-ink bg-ink text-card" : "border-line-strong bg-card text-ink-2")}>
                  <WeatherIcon w={w} size={20} />
                  {WEATHER_LABEL[w]}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[14px] text-ink-2">ฝนตก (ชม.)</span>
          <Stepper big label="ชั่วโมงฝนตก" value={d.rainHours ?? 0} onChange={(v) => set("rainHours", v)} />
        </div>
      </section>

      <section>
        <h2 className="mb-2 flex items-baseline justify-between text-[15px] font-medium">
          กำลังคน <span className="num font-mono text-[14px] text-ink-2">{tot.headcount} คน</span>
        </h2>
        <ul className="flex flex-col divide-y divide-line rounded-[14px] border border-line bg-card">
          {d.manpower.map((m, i) => (
            <li key={i} className="flex items-center gap-2 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px]">{m.trade || "ไม่ระบุประเภท"}</p>
                <p className="truncate text-[12px] text-ink-3">{m.group}</p>
              </div>
              <Stepper big label={`จำนวน ${m.trade}`} value={m.count} onChange={(v) => set("manpower", d.manpower.map((x, j) => (j === i ? { ...x, count: v } : x)))} />
              <button type="button" aria-label="ลบแถว" onClick={() => set("manpower", d.manpower.filter((_, j) => j !== i))} className="inline-flex size-10 items-center justify-center text-ink-3">
                <Trash2 {...I} />
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex gap-2">
          <input list="m-crews" value={crew} onChange={(e) => setCrew(e.target.value)} placeholder="เพิ่มทีม/ประเภทช่าง" className={cx(mInput, "min-w-0 flex-1")} />
          <datalist id="m-crews">
            <option value="ทีมบริษัท · กรรมกร" />
            <option value="ทีมบริษัท · ช่างไม้/ช่างทั่วไป" />
            {subs.map((s) => (
              <option key={s.id} value={`${s.name} · ${s.trades[0] ?? ""}`} />
            ))}
          </datalist>
          <button
            type="button"
            aria-label="เพิ่มทีม"
            disabled={!crew.trim()}
            onClick={() => {
              const [g, t] = crew.split("·").map((x) => x.trim());
              const sub = subs.find((s) => s.name === g);
              set("manpower", [...d.manpower, { group: t ? g : "ทีมบริษัท", trade: t ?? g, count: 1, subcontractorId: sub?.id }]);
              setCrew("");
            }}
            className="inline-flex size-12 shrink-0 items-center justify-center rounded-[12px] border border-line-strong bg-card disabled:opacity-40"
          >
            <Plus size={20} strokeWidth={1.5} />
          </button>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-[15px] font-medium">งานที่ทำวันนี้</h2>
        <div className="flex flex-col gap-3">
          {d.work.map((w, i) => (
            <div key={i} className="rounded-[14px] border border-line bg-card p-3">
              <textarea value={w.text} onChange={(e) => set("work", d.work.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} placeholder="งานที่ทำ เช่น ก่ออิฐผนังชั้น 2 ด้านทิศเหนือ" className={cx(mArea, "min-h-[64px]")} aria-label="งานที่ทำ" />
              {tasks.length > 0 && (
                <select
                  value={w.taskId ?? ""}
                  onChange={(e) => {
                    const t = tasks.find((x) => x.id === e.target.value);
                    set("work", d.work.map((x, j) => (j === i ? { ...x, taskId: e.target.value || undefined, pct: t ? (x.pct ?? t.pct) : x.pct, text: x.text || t?.name || "" } : x)));
                  }}
                  aria-label="งานในแผน"
                  className={cx(mInput, "mt-2")}
                >
                  <option value="">ไม่ผูกงานในแผน</option>
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.code} {t.name}
                    </option>
                  ))}
                </select>
              )}
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[13px] text-ink-3">ความคืบหน้าสะสม %</span>
                <div className="flex items-center gap-2">
                  <Stepper big label="เปอร์เซ็นต์" value={w.pct ?? 0} onChange={(v) => set("work", d.work.map((x, j) => (j === i ? { ...x, pct: Math.min(100, v) } : x)))} />
                  <button type="button" aria-label="ลบงาน" onClick={() => set("work", d.work.filter((_, j) => j !== i))} className="inline-flex size-10 items-center justify-center text-ink-3">
                    <Trash2 {...I} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          <MBtn onClick={() => set("work", [...d.work, { text: "" }])}>
            <Plus {...I} />
            เพิ่มงาน
          </MBtn>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <MLabel label="ปัญหา/ความล่าช้า">
          <textarea className={mArea} value={d.issues ?? ""} onChange={(e) => set("issues", e.target.value || undefined)} />
        </MLabel>
        <MLabel label="วัสดุเข้าหน้างาน">
          <input className={mInput} value={d.deliveries ?? ""} onChange={(e) => set("deliveries", e.target.value || undefined)} />
        </MLabel>
        <MLabel label="ความปลอดภัย">
          <input className={mInput} value={d.safety ?? ""} onChange={(e) => set("safety", e.target.value || undefined)} />
        </MLabel>
        <MediaField value={d.photos} onChange={(photos) => set("photos", photos)} label="รูปหน้างาน" photosOnly />
      </section>

      <div className="sticky bottom-0 -mx-4 grid grid-cols-2 gap-2 border-t border-line bg-page/95 px-4 py-3">
        <MBtn
          onClick={() => {
            setD(saveDiary(d));
            setSaved("draft");
          }}
        >
          {saved === "draft" ? "บันทึกแล้ว" : "บันทึกร่าง"}
        </MBtn>
        <MBtn
          primary
          onClick={() => {
            submitDiary(d);
            setSaved("sent");
          }}
        >
          ส่งรายงาน
        </MBtn>
      </div>
    </div>
  );
}
