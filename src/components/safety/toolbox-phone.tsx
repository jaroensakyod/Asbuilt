"use client";

// /m/toolbox — quick toolbox talk on the phone: topic, headcount, photo, signature.

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Minus, Plus } from "lucide-react";
import { cx } from "@/components/ui";
import { useHydrated } from "@/components/ops/bits";
import { MediaField } from "@/components/media/media-field";
import { SignaturePad } from "@/components/media/signature-pad";
import { TODAY } from "@/lib/data";
import type { MediaRef } from "@/lib/media";
import { attendance, employees } from "@/lib/hr/store";
import { timeOfDay } from "@/lib/safety/now";
import { toolboxTalks } from "@/lib/safety/store";
import { talkHeadcount, TOPIC_CAT_LABEL, TOPICS, type Attendee, type TopicCat, type ToolboxTalk } from "@/lib/safety/types";
import { useMe } from "@/lib/use-me";
import { PhoneBtn, PhoneCard, PhoneLabel, PhoneShell, PhoneSiteSelect, phoneInput, useRememberedSite } from "./phone-bits";
import { AiPill } from "@/components/ai-field/ai-bits";
import { HazardAssist, TopicAssist } from "@/components/ai-field/hazard-assist";
import { actionsText, applyHazards, followUpDays } from "@/lib/ai-field/safety";
import { addDaysIso } from "@/lib/ai-field/common";
import { canEdit } from "@/lib/permissions";
import { safetyInspections } from "@/lib/safety/store";
import { INSP_ITEMS, type ItemResult } from "@/lib/safety/types";

const CUSTOM = "__custom";
const DURATIONS = [10, 15, 20, 30];

export function ToolboxPhone() {
  const [site, setSite] = useRememberedSite();
  const [saved, setSaved] = useState<ToolboxTalk | null>(null);
  const talks = toolboxTalks.use();
  const hydrated = useHydrated();
  const today = talks.filter((t) => t.projectId === site && t.date === TODAY);

  return (
    <PhoneShell title="บันทึก Toolbox Talk">
      <PhoneSiteSelect
        value={site}
        onChange={(v) => {
          setSite(v);
          setSaved(null);
        }}
      />
      {saved ? (
        <PhoneCard>
          <p className="flex items-center gap-2 text-[15px] text-pos">
            <Check size={20} strokeWidth={1.5} />
            บันทึกแล้ว
          </p>
          <p className="mt-2 text-[17px]">{saved.topic}</p>
          <p className="mt-1 text-[14px] text-ink-2">
            <span className="font-mono">{saved.id}</span> · {saved.time} น. · ผู้เข้าร่วม <span className="num font-mono">{talkHeadcount(saved)}</span> คน · {saved.durationMin} นาที
          </p>
          <div className="mt-4 grid gap-2">
            <PhoneBtn primary onClick={() => setSaved(null)}>
              บันทึกอีกครั้ง
            </PhoneBtn>
            <Link href="/safety?tab=toolbox" className="inline-flex h-12 items-center justify-center rounded-[12px] text-[15px] text-ink-2 hover:bg-raised">
              ดูประวัติ Toolbox Talk
            </Link>
          </div>
        </PhoneCard>
      ) : (
        <TalkForm key={site} site={site} onSaved={setSaved} />
      )}

      <PhoneCard className="p-0">
        <h2 className="border-b border-line px-4 py-3 text-[16px] font-medium">วันนี้ที่หน้างานนี้</h2>
        {hydrated && today.length ? (
          <ul>
            {today.map((t) => (
              <li key={t.id} className="border-b border-line px-4 py-3 last:border-0">
                <p className="text-[15px]">{t.topic}</p>
                <p className="text-[13px] text-ink-3">
                  <span className="font-mono">{t.time}</span> · {t.presenter} · <span className="num font-mono">{talkHeadcount(t)}</span> คน
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-6 text-center text-[14px] text-ink-3">ยังไม่มี Toolbox Talk วันนี้</p>
        )}
      </PhoneCard>
    </PhoneShell>
  );
}

function TalkForm({ site, onSaved }: { site: string; onSaved: (t: ToolboxTalk) => void }) {
  const me = useMe();
  const emps = employees.use();
  const hydrated = useHydrated();
  const sheets = attendance.use();
  const sheet = hydrated ? sheets.find((s) => s.id === `ATT-${site}-${TODAY}`) : undefined;
  const onSite = useMemo(() => (sheet?.entries ?? []).filter((e) => e.in || e.mark !== "absent").map((e) => ({ id: e.employeeId, name: emps.find((x) => x.id === e.employeeId)?.name ?? e.employeeId })), [sheet, emps]);

  const [topicId, setTopicId] = useState(TOPICS[0].id);
  const [custom, setCustom] = useState("");
  const [presenter, setPresenter] = useState("");
  const [unticked, setUnticked] = useState<string[]>([]);
  const [crewCount, setCrewCount] = useState(0);
  const [duration, setDuration] = useState(15);
  const [photos, setPhotos] = useState<MediaRef[]>([]);
  const [sig, setSig] = useState<{ ref: MediaRef; signer: string } | null>(null);
  const [notes, setNotes] = useState("");
  const [aiTopic, setAiTopic] = useState(false);
  const [sitePhotos, setSitePhotos] = useState<MediaRef[]>([]);
  const [walkId, setWalkId] = useState("");
  const mayInspect = canEdit(me.role, "safety");

  const attendees: Attendee[] = onSite.filter((w) => !unticked.includes(w.id)).map((w) => ({ employeeId: w.id, name: w.name, group: "คนงานบริษัท" }));
  const total = attendees.length + crewCount;
  const topic = topicId === CUSTOM ? custom.trim() : (TOPICS.find((t) => t.id === topicId)?.title ?? "");
  const ok = !!topic && total > 0;

  const save = () => {
    if (!ok) return;
    const t: ToolboxTalk = {
      id: toolboxTalks.nextId("TBT-2026-"),
      projectId: site,
      date: TODAY,
      time: timeOfDay(),
      topicId: topicId === CUSTOM ? undefined : topicId,
      topic,
      presenter: presenter.trim() || me.name,
      attendees,
      crews: crewCount > 0 ? [{ name: "ผู้รับเหมาช่วง", count: crewCount }] : [],
      durationMin: duration,
      notes: notes.trim() || undefined,
      photos,
      signature: sig?.ref,
      signer: sig?.signer || undefined,
      source: "phone",
    };
    toolboxTalks.upsert(t);
    onSaved(t);
  };

  const cats = Object.keys(TOPIC_CAT_LABEL) as TopicCat[];

  return (
    <>
      <PhoneCard>
        <div className="flex flex-col gap-3">
          <TopicAssist
            phone
            site={site}
            onPick={(t) => {
              if (t.topicId) setTopicId(t.topicId);
              else {
                setTopicId(CUSTOM);
                setCustom(t.title);
              }
              if (t.points.length) setNotes(t.points.map((x) => `- ${x}`).join("\n"));
              setAiTopic(true);
            }}
          />
          <PhoneLabel label="หัวข้อ">
            <select className={phoneInput} value={topicId} onChange={(e) => setTopicId(e.target.value)}>
              {cats.map((c) => (
                <optgroup key={c} label={TOPIC_CAT_LABEL[c]}>
                  {TOPICS.filter((t) => t.cat === c).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </optgroup>
              ))}
              <option value={CUSTOM}>หัวข้ออื่น (พิมพ์เอง)</option>
            </select>
          </PhoneLabel>
          {topicId === CUSTOM && <input className={phoneInput} placeholder="หัวข้อที่พูดคุย" value={custom} onChange={(e) => setCustom(e.target.value)} />}
          <label className="flex flex-col gap-1.5 text-[14px] text-ink-2">
            <span className="flex items-center gap-2">ประเด็นที่พูด/ข้อสั่งการ {aiTopic && <AiPill />}</span>
            <textarea className="min-h-[88px] w-full rounded-[12px] border border-line-strong bg-card px-3 py-2.5 text-[16px] text-ink outline-none placeholder:text-ink-3 focus:border-ink-3" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ไม่บังคับ" />
          </label>
          <PhoneLabel label="ผู้บรรยาย">
            <input className={phoneInput} placeholder={me.name} value={presenter} onChange={(e) => setPresenter(e.target.value)} />
          </PhoneLabel>
          <div className="flex flex-col gap-1.5">
            <span className="text-[14px] text-ink-2">ระยะเวลา</span>
            <div className="grid grid-cols-4 gap-2">
              {DURATIONS.map((d) => (
                <button key={d} type="button" aria-pressed={duration === d} onClick={() => setDuration(d)} className={cx("h-12 rounded-[12px] text-[15px]", duration === d ? "bg-ink text-card" : "border border-line-strong bg-card")}>
                  <span className="font-mono">{d}</span> นาที
                </button>
              ))}
            </div>
          </div>
        </div>
      </PhoneCard>

      <PhoneCard className="p-0">
        <div className="flex items-baseline justify-between border-b border-line px-4 py-3">
          <h2 className="text-[16px] font-medium">ผู้เข้าร่วม</h2>
          <span className="num font-mono text-[15px]">{total} คน</span>
        </div>
        {onSite.length ? (
          <ul className="max-h-[300px] overflow-y-auto">
            {onSite.map((w) => {
              const on = !unticked.includes(w.id);
              return (
                <li key={w.id}>
                  <button type="button" aria-pressed={on} onClick={() => setUnticked((u) => (on ? [...u, w.id] : u.filter((x) => x !== w.id)))} className="flex min-h-12 w-full items-center gap-3 border-b border-line px-4 py-2 text-left last:border-0">
                    <span className={cx("inline-flex size-6 shrink-0 items-center justify-center rounded-[6px] border", on ? "border-ink bg-ink text-card" : "border-line-strong")}>{on && <Check size={16} strokeWidth={1.5} />}</span>
                    <span className="min-w-0 flex-1 truncate text-[15px]">{w.name}</span>
                    <span className="font-mono text-[12px] text-ink-3">{w.id}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-4 py-4 text-[14px] text-ink-3">ยังไม่มีคนงานลงเวลาวันนี้ ใส่จำนวนคนด้านล่าง หรือให้คนงานลงเวลาที่ /m/clock ก่อน</p>
        )}
        <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
          <span className="text-[14px] text-ink-2">คนงานผู้รับเหมาช่วง</span>
          <div className="flex items-center gap-2">
            <button type="button" aria-label="ลดจำนวน" onClick={() => setCrewCount((n) => Math.max(0, n - 1))} className="inline-flex size-12 items-center justify-center rounded-[12px] border border-line-strong bg-card">
              <Minus size={20} strokeWidth={1.5} />
            </button>
            <span className="num w-10 text-center font-mono text-[20px]">{crewCount}</span>
            <button type="button" aria-label="เพิ่มจำนวน" onClick={() => setCrewCount((n) => n + 1)} className="inline-flex size-12 items-center justify-center rounded-[12px] border border-line-strong bg-card">
              <Plus size={20} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </PhoneCard>

      <PhoneCard>
        <MediaField value={photos} onChange={setPhotos} label="รูปการประชุม" photosOnly />
      </PhoneCard>

      <PhoneCard>
        <h2 className="mb-1 text-[16px] font-medium">ตรวจความเสี่ยงจากรูปหน้างาน</h2>
        <p className="mb-3 text-[13px] text-ink-3">ถ่ายรูปจุดทำงาน ให้ AI ชี้จุดเสี่ยง แล้วใช้เป็นหัวข้อพูดวันนี้{mayInspect ? " หรือบันทึกเป็นผลเดินตรวจ" : ""}</p>
        <div className="flex flex-col gap-3">
          <MediaField value={sitePhotos} onChange={setSitePhotos} label="รูปหน้างาน" photosOnly geotag />
          <HazardAssist
            phone
            photos={sitePhotos}
            checklist={INSP_ITEMS.walk}
            applyLabel="ใช้เป็นหัวข้อ Toolbox วันนี้"
            onApply={(h) => {
              setTopicId(CUSTOM);
              setCustom(`ความเสี่ยงที่พบหน้างาน: ${h[0].hazard}`);
              setNotes(actionsText(h));
              setAiTopic(true);
            }}
            extra={(h) =>
              mayInspect && (
                <button
                  type="button"
                  disabled={!h.length || !!walkId}
                  onClick={() => {
                    const base = INSP_ITEMS.walk.map((text) => ({ text, result: "na" as ItemResult, note: "" }));
                    const r = applyHazards(base, h);
                    const id = safetyInspections.nextId(`SIN-${TODAY.slice(0, 4)}-`);
                    safetyInspections.upsert({
                      id,
                      projectId: site,
                      kind: "walk",
                      date: TODAY,
                      inspector: me.name,
                      location: "เดินตรวจจากแอปหน้างาน",
                      items: r.items.map((i) => ({ text: i.text, result: i.result, note: i.note || undefined })),
                      photos: sitePhotos,
                      actions: r.actions,
                      followUpDue: addDaysIso(TODAY, followUpDays(h)),
                      closed: false,
                    });
                    setWalkId(id);
                  }}
                  className="h-12 rounded-[12px] border border-line-strong bg-card text-[15px] font-medium disabled:opacity-40"
                >
                  บันทึกเป็นผลเดินตรวจ
                </button>
              )
            }
          />
          {walkId && (
            <p className="flex items-center gap-2 text-[14px] text-pos">
              <Check size={18} strokeWidth={1.5} />
              บันทึกผลเดินตรวจ <Link href={`/safety?tab=inspections&q=${walkId}`} className="font-mono underline-offset-2 hover:underline">{walkId}</Link> แล้ว (ข้อที่ไม่ได้ตรวจเป็น ไม่เกี่ยวข้อง)
            </p>
          )}
        </div>
      </PhoneCard>

      <PhoneCard>
        <p className="mb-2 text-[14px] text-ink-2">ลายมือชื่อผู้บรรยาย/หัวหน้างาน</p>
        {sig ? (
          <div className="flex items-center justify-between gap-2 text-[14px]">
            <span className="flex items-center gap-2 text-pos">
              <Check size={18} strokeWidth={1.5} />
              ลงนามแล้ว · {sig.signer}
            </span>
            <button type="button" onClick={() => setSig(null)} className="h-10 rounded-[10px] px-3 text-ink-2 hover:bg-raised">
              เซ็นใหม่
            </button>
          </div>
        ) : (
          <SignaturePad onSave={(ref, signer) => setSig({ ref, signer })} />
        )}
      </PhoneCard>

      <PhoneBtn primary disabled={!ok} onClick={save} className="h-14 text-[17px]">
        บันทึก Toolbox Talk
      </PhoneBtn>
      {!ok && <p className="-mt-2 text-center text-[13px] text-ink-3">{topic ? "ต้องมีผู้เข้าร่วมอย่างน้อย 1 คน" : "เลือกหรือพิมพ์หัวข้อ"}</p>}
    </>
  );
}
