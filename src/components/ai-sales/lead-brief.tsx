"use client";

// Lead brief → structured requirements on the lead + 2–3 recommended house models.

import { useMemo, useState } from "react";
import { FilePlus2 } from "lucide-react";
import { cx } from "@/components/ui";
import { Btn, Modal, Pill } from "@/components/ops/bits";
import { houseModels, TODAY } from "@/lib/data";
import { PROVINCES } from "@/lib/projects-store";
import { addActivity, leads, type Lead } from "@/lib/sales/crm";
import { useMe } from "@/lib/use-me";
import { briefChanges, cleanRecommendations, fitIssues, LEAD_BRIEF_SCHEMA, leadBriefPrompt, patchFrom, SYSTEM_LEAD, type LeadBrief, type LeadBriefResult } from "@/lib/ai-sales/lead";
import { UPGRADE_PACKAGES } from "@/lib/ai-sales/quote";
import { aiJsonBig, AiBusy, AiButton, AiError, AiPill, DraftNote, taCls, useAiRun } from "./bits";

const CATALOG = houseModels.filter((m) => m.type !== "condo");

export function LeadBriefModal({ lead, onClose, onQuote }: { lead: Lead; onClose: () => void; onQuote: (modelCode: string, brief: LeadBrief) => void }) {
  const me = useMe();
  const [text, setText] = useState(lead.notes ?? "");
  const ai = useAiRun<LeadBriefResult>();
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [addModels, setAddModels] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState(false);

  const known = `ชื่อ ${lead.name} · งบ ${lead.budget} ล้าน · จังหวัด ${lead.province}${lead.landSize ? ` · ที่ดิน ${lead.landSize} ตร.ว.` : ""}${lead.models.length ? ` · สนใจ ${lead.models.join(", ")}` : ""}`;

  const analyse = async () => {
    setSaved(false);
    const r = await ai.start(() =>
      aiJsonBig<LeadBriefResult>("sales-lead-brief", {
        system: SYSTEM_LEAD,
        prompt: leadBriefPrompt({ text, models: CATALOG, provinces: PROVINCES, upgrades: UPGRADE_PACKAGES.map((p) => p.name), today: TODAY, known }),
        schema: LEAD_BRIEF_SCHEMA,
        temperature: 0.3,
      }),
    );
    if (!r) return;
    const { changes, note: n } = briefChanges(lead, r.brief ?? {}, PROVINCES);
    setAccepted(new Set(changes.map((c) => c.field)));
    setNote(n);
    setAddModels(new Set(cleanRecommendations(r.recommendations, CATALOG).map((x) => x.code).filter((c) => !lead.models.includes(c))));
  };

  const result = ai.data;
  const brief = result?.brief ?? {};
  const view = useMemo(() => (result ? briefChanges(lead, result.brief ?? {}, PROVINCES) : null), [result, lead]);
  const recs = useMemo(() => (result ? cleanRecommendations(result.recommendations, CATALOG) : []), [result]);

  const save = () => {
    if (!view) return;
    const patch = patchFrom(view.changes, accepted) as Partial<Lead>;
    const models = [...lead.models, ...[...addModels].filter((c) => !lead.models.includes(c))];
    const fresh = leads.get(lead.id) ?? lead;
    const text = [note.trim() && `AI สรุปความต้องการ: ${note.trim()}`, recs.length && `แนะนำแบบ ${recs.map((r) => r.code).join(", ")}`].filter(Boolean).join(" · ");
    if (text) addActivity(fresh, { date: TODAY, kind: "note", text, by: me.name }, { ...patch, models });
    else leads.upsert({ ...fresh, ...patch, models, updated: TODAY });
    setSaved(true);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="ให้ AI สรุปความต้องการลูกค้า"
      width={880}
      footer={
        <>
          {saved && <span className="mr-auto text-[13px] text-pos">บันทึกลงลีดแล้ว</span>}
          <Btn onClick={onClose}>ปิด</Btn>
          {result && (
            <Btn primary onClick={save} disabled={saved}>
              บันทึกลงลีด
            </Btn>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-[13px] text-ink-2">
          วางข้อความแชต LINE / Facebook หรือบันทึกการคุยกับลูกค้า
          <textarea className={cx(taCls, "min-h-[120px]")} value={text} onChange={(e) => setText(e.target.value)} placeholder="เช่น สวัสดีค่ะ มีที่ดิน 80 ตร.ว. ที่นนทบุรี หน้ากว้าง 16 ม. อยากได้บ้าน 2 ชั้น 3 ห้องนอน งบไม่เกิน 4 ล้าน อยากเริ่มสร้างต้นปีหน้า ชอบสไตล์มินิมอล" />
        </label>
        <div className="flex items-center gap-3">
          <AiButton onClick={() => void analyse()} disabled={ai.busy || text.trim().length < 10}>
            {result ? "วิเคราะห์ใหม่" : "วิเคราะห์ด้วย AI"}
          </AiButton>
          <span className="text-[12px] text-ink-3">AI อ่านเฉพาะข้อความนี้และแค็ตตาล็อกแบบบ้าน ไม่บันทึกอะไรจนกว่าจะกดบันทึก</span>
        </div>
        {ai.busy && <AiBusy onCancel={ai.cancel} />}
        <AiError text={ai.error} />

        {result && view && (
          <>
            {brief.summary && <p className="rounded-[10px] bg-raised px-4 py-3 text-[14px] text-ink">{brief.summary}</p>}

            <section>
              <p className="mb-2 text-[14px] font-medium">ข้อมูลที่จะอัปเดตในลีด</p>
              {view.changes.length ? (
                <ul className="divide-y divide-line rounded-[10px] border border-line">
                  {view.changes.map((c) => (
                    <li key={c.field} className="flex items-center gap-3 px-4 py-2 text-[13px]">
                      <input
                        type="checkbox"
                        checked={accepted.has(c.field)}
                        onChange={(e) => {
                          const n = new Set(accepted);
                          if (e.target.checked) n.add(c.field);
                          else n.delete(c.field);
                          setAccepted(n);
                        }}
                        aria-label={`อัปเดต ${c.label}`}
                      />
                      <span className="w-[150px] text-ink-3">{c.label}</span>
                      <span className="text-ink-3 line-through">{c.from}</span>
                      <span className="text-ink">{c.to}</span>
                      <AiPill />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-ink-3">ไม่มีช่องข้อมูลที่ต้องเปลี่ยน</p>
              )}
              <label className="mt-3 flex flex-col gap-1.5 text-[13px] text-ink-2">
                <span className="inline-flex items-center gap-1.5">
                  บันทึกเป็นกิจกรรม (ข้อมูลที่ไม่มีช่องในลีด) <AiPill />
                </span>
                <textarea className={cx(taCls, "min-h-[64px]")} value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
            </section>

            <section>
              <p className="mb-2 text-[14px] font-medium">แบบบ้านที่แนะนำ</p>
              {recs.length ? (
                <div className="grid gap-3 md:grid-cols-3">
                  {recs.map((r) => {
                    const issues = fitIssues(r.model, brief);
                    return (
                      <div key={r.code} className="flex flex-col gap-2 rounded-[10px] border border-line p-3">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-mono text-[12px] text-ink-3">{r.code}</span>
                          <Pill tone={r.fit >= 75 ? "pos" : r.fit >= 50 ? "accent" : "warn"}>เหมาะ {r.fit}%</Pill>
                        </div>
                        <p className="text-[14px] text-ink">{r.model.name}</p>
                        <p className="text-[12px] text-ink-3">
                          {r.model.floors} ชั้น · {r.model.area} ตร.ม. · {r.model.beds} นอน {r.model.baths} น้ำ · ที่ดิน {r.model.land}
                        </p>
                        <p className="num font-mono text-[12px] text-ink-2">
                          {r.model.priceMin}–{r.model.priceMax} ล้าน
                        </p>
                        <p className="text-[13px] text-ink-2">{r.reason}</p>
                        {issues.length > 0 && <p className="text-[12px] text-warn">{issues.join(" · ")}</p>}
                        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
                          <label className="inline-flex items-center gap-1.5 text-[12px] text-ink-2">
                            <input
                              type="checkbox"
                              disabled={lead.models.includes(r.code)}
                              checked={lead.models.includes(r.code) || addModels.has(r.code)}
                              onChange={(e) => {
                                const n = new Set(addModels);
                                if (e.target.checked) n.add(r.code);
                                else n.delete(r.code);
                                setAddModels(n);
                              }}
                            />
                            {lead.models.includes(r.code) ? "อยู่ในแบบที่สนใจแล้ว" : "เพิ่มในแบบที่สนใจ"}
                          </label>
                          <Btn small onClick={() => onQuote(r.code, brief)}>
                            <FilePlus2 size={14} strokeWidth={1.5} />
                            ร่างใบเสนอราคา
                          </Btn>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[13px] text-ink-3">AI ไม่พบแบบที่เหมาะในแค็ตตาล็อก</p>
              )}
            </section>

            {(result.upgrades?.length ?? 0) > 0 && (
              <section>
                <p className="mb-1 text-[14px] font-medium">รายการเสริมที่ลูกค้าน่าสนใจ</p>
                <ul className="list-disc space-y-0.5 pl-5 text-[13px] text-ink-2">
                  {result.upgrades.map((u, i) => (
                    <li key={i}>
                      <span className="text-ink">{u.name}</span> · {u.reason}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {result.nextStep && (
              <p className="text-[13px] text-ink-2">
                <span className="text-ink-3">ขั้นต่อไป</span> {result.nextStep}
              </p>
            )}
            <DraftNote />
          </>
        )}
      </div>
    </Modal>
  );
}
