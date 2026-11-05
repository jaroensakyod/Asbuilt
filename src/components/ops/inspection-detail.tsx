"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Minus, Pencil, Printer, RotateCcw, Trash2, X } from "lucide-react";
import { AssetTag, Card, CardHead, cx, inputCls } from "@/components/ui";
import { getProject, REPAIR_STATUS_LABEL, SEVERITY_LABEL, thDate, TODAY, type Severity } from "@/lib/data";
import {
  addInspection,
  deleteInspection,
  resultsOf,
  saveInspectionResults,
  submitInspection,
  useInspections,
  useRepairs,
  type ItemState,
  type OpsInspection,
} from "@/lib/ops-store";
import { addDays, itemsFor, itemSystem, PASS_SCORE, projectAssets, scoreOf, type ItemResult } from "./seed";
import { Btn, Empty, I, Meter, Pill, PrintStyle, SEV_TONE, SystemPill, useHydrated } from "./bits";
import { DocHeader, DocRow, DocSection, Signatures } from "./doc";
import { MediaField, MediaStrip } from "@/components/media/media-field";
import type { MediaRef } from "@/lib/media";
import { InspectionForm } from "./inspection-form";
import { RESULT_LABEL, RESULT_TONE } from "./inspections-view";

const R_LABEL: Record<ItemResult, string> = { pass: "ผ่าน", fail: "ไม่ผ่าน", na: "ไม่เกี่ยวข้อง" };

/** item result with real photos; `photos` (count) is kept in sync for older records and reports */
type ItemStateX = ItemState & { media?: MediaRef[] };
/** photos recorded before real uploads existed: only a count, no files */
const legacyPhotos = (st: ItemStateX) => Math.max(0, (st.photos ?? 0) - (st.media?.length ?? 0));

export function InspectionDetail({ id }: { id: string }) {
  const all = useInspections();
  const hydrated = useHydrated();
  const ins = all.find((i) => i.id === id);
  if (!ins) {
    return (
      <Card>
        <Empty>{hydrated ? `ไม่พบการตรวจสอบ ${id}` : "กำลังโหลด"}</Empty>
      </Card>
    );
  }
  return <Body key={`${ins.id}-${ins.submitted ?? ""}-${ins.result}`} ins={ins} />;
}

function Body({ ins }: { ins: OpsInspection }) {
  const router = useRouter();
  const repairs = useRepairs();
  const p = getProject(ins.projectId);
  const items = useMemo(() => itemsFor(ins), [ins]);
  const { assets } = useMemo(() => projectAssets(p), [p]);
  const locked = ins.result !== "scheduled";
  const [results, setResults] = useState<Record<string, ItemStateX>>(() => resultsOf(ins));
  const [editOpen, setEditOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const live = scoreOf(results);
  const answered = items.filter((it) => results[it.id]?.r).length;
  const remaining = items.length - answered;
  const linked = repairs.filter((r) => r.inspectionId === ins.id || ins.repairIds?.includes(r.id));
  const reinspections = useInspections().filter((x) => x.reinspectOf === ins.id);

  const setItem = (itemId: string, patch: Partial<ItemStateX>) => {
    setSaved(false);
    setResults((x) => ({ ...x, [itemId]: { ...x[itemId], ...patch } }));
  };
  const passRest = () => {
    setSaved(false);
    setResults((x) => {
      const n = { ...x };
      for (const it of items) if (!n[it.id]?.r) n[it.id] = { ...n[it.id], r: "pass" };
      return n;
    });
  };
  const submit = () => {
    if (remaining > 0) return;
    const fails = live.fail;
    if (!window.confirm(`ส่งผลการตรวจ คะแนน ${live.score.toFixed(1)}${fails ? ` · เปิดใบแจ้งซ่อม ${fails} เรื่อง` : ""}`)) return;
    submitInspection(ins.id, results);
  };
  const reinspect = () => {
    const n = addInspection({
      title: `ตรวจซ้ำ · ${ins.title.replace(/^ตรวจซ้ำ · /, "")}`,
      projectId: ins.projectId,
      location: ins.location,
      inspector: ins.inspector,
      date: addDays(TODAY, 3),
      time: ins.time,
      items: ins.items,
      phase: ins.phase,
      result: "scheduled",
      systems: ins.systems,
      reinspectOf: ins.id,
    });
    router.push(`/inspections/${n.id}`);
  };
  const del = () => {
    if (!window.confirm(`ลบการตรวจสอบ ${ins.id}`)) return;
    deleteInspection(ins.id);
    router.push("/inspections");
  };

  const score = locked ? (ins.score ?? live.score) : live.score;

  return (
    <>
      <PrintStyle />
      <div className="ops-noprint">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-5">
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/inspections" className="mr-1 inline-flex h-8 items-center gap-1.5 rounded-[8px] px-2 text-[13px] text-ink-2 transition-colors duration-150 hover:bg-raised hover:text-ink">
              <ArrowLeft {...I} />
              กลับ
            </Link>
            <Pill mono>{ins.id}</Pill>
            <Pill tone="accent">{ins.phase}</Pill>
            <Pill tone={RESULT_TONE[ins.result]}>{RESULT_LABEL[ins.result]}</Pill>
            {ins.reinspectOf && (
              <Link href={`/inspections/${ins.reinspectOf}`} className="text-[13px] text-accent-text hover:underline">
                ตรวจซ้ำจาก {ins.reinspectOf}
              </Link>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Btn onClick={() => setEditOpen(true)}>
              <Pencil {...I} />
              แก้ไข
            </Btn>
            <Btn onClick={() => window.print()}>
              <Printer {...I} />
              พิมพ์รายงาน
            </Btn>
            <Btn danger onClick={del}>
              <Trash2 {...I} />
            </Btn>
          </div>
        </div>

        <h1 className="text-[26px] font-normal leading-[1.2]">{ins.title}</h1>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 pb-6 text-[13px] text-ink-2">
          <Link href={`/projects/${ins.projectId}`} className="hover:text-ink">
            {p?.name ?? ins.projectId} <span className="font-mono text-[12px] text-ink-3">{ins.projectId}</span>
          </Link>
          <span>{ins.location}</span>
          <span>ผู้ตรวจ {ins.inspector}</span>
          <span className="num font-mono text-[12px]">
            {thDate(ins.date)} {ins.time} น.
          </span>
          <span className="flex gap-1.5">
            {ins.systems.map((s) => (
              <SystemPill key={s} s={s} />
            ))}
          </span>
        </p>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
          <Card>
            <CardHead title="เช็กลิสต์" meta={`${answered}/${items.length} รายการ`} action={!locked && remaining > 0 ? <Btn small onClick={passRest}>ผ่านทั้งหมดที่เหลือ</Btn> : undefined} />
            <ol>
              {items.map((it, n) => {
                const st = results[it.id] ?? {};
                const sys = itemSystem(it.id);
                const opts = assets.filter((a) => a.system === sys && a.category !== "เบรกเกอร์ลูกย่อย");
                return (
                  <li key={it.id} className={cx("border-t border-line px-5 py-3.5 first:border-t-0", st.r === "fail" && "bg-neg-soft/40")}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p>
                          <span className="num mr-2 font-mono text-[12px] text-ink-3">
                            {String(n + 1).padStart(2, "0")} · {it.id}
                          </span>
                          {it.text}
                        </p>
                        <p className="mt-0.5 text-[13px] text-ink-3">เกณฑ์ {it.standard}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {(["pass", "fail", "na"] as ItemResult[]).map((r) => (
                          <button
                            key={r}
                            type="button"
                            disabled={locked}
                            onClick={() => setItem(it.id, { r })}
                            aria-pressed={st.r === r}
                            className={cx(
                              "inline-flex h-8 items-center gap-1.5 rounded-[8px] border px-2.5 text-[13px] transition-colors duration-150 disabled:cursor-default",
                              st.r === r
                                ? r === "pass"
                                  ? "border-pos bg-pos-soft text-pos"
                                  : r === "fail"
                                    ? "border-neg bg-neg-soft text-neg"
                                    : "border-ink-3 bg-raised text-ink"
                                : "border-line-strong bg-card text-ink-2 enabled:hover:bg-raised",
                              locked && st.r !== r && "opacity-40",
                            )}
                          >
                            {r === "pass" ? <Check {...I} /> : r === "fail" ? <X {...I} /> : <Minus {...I} />}
                            {R_LABEL[r]}
                          </button>
                        ))}
                      </div>
                    </div>
                    {(!locked || !!st.note || !!st.photos || !!st.media?.length) && (
                      <div className="mt-2.5 flex flex-col gap-2">
                        {locked ? (
                          st.note && <p className="text-[13px] text-ink-2">หมายเหตุ {st.note}</p>
                        ) : (
                          <input value={st.note ?? ""} onChange={(e) => setItem(it.id, { note: e.target.value })} placeholder="หมายเหตุ / สิ่งที่พบ" className={cx(inputCls, "h-8 min-w-[240px] flex-1 text-[13px]")} />
                        )}
                        {locked ? (
                          <MediaStrip refs={st.media} />
                        ) : (
                          <MediaField
                            value={st.media ?? []}
                            onChange={(media) => setItem(it.id, { media, photos: media.length + legacyPhotos(st) })}
                            label="รูปถ่าย"
                            photosOnly
                          />
                        )}
                        {legacyPhotos(st) > 0 && (
                          <span className="flex flex-wrap gap-2">
                            {Array.from({ length: legacyPhotos(st) }, (_, k) => (
                              <span key={k} className="flex h-8 w-11 items-center justify-center rounded-[6px] border border-line bg-raised font-mono text-[11px] text-ink-3" title="รูปถ่ายจากระบบเดิม (ไม่มีไฟล์)">
                                IMG{k + 1}
                              </span>
                            ))}
                          </span>
                        )}
                      </div>
                    )}
                    {st.r === "fail" && !locked && (
                      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
                        <span>เปิดใบแจ้งซ่อม · ความรุนแรง</span>
                        <select value={st.severity ?? "medium"} onChange={(e) => setItem(it.id, { severity: e.target.value as Severity })} className={cx(inputCls, "h-8 text-[13px]")}>
                          {(Object.keys(SEVERITY_LABEL) as Severity[]).map((s) => (
                            <option key={s} value={s}>
                              {SEVERITY_LABEL[s]}
                            </option>
                          ))}
                        </select>
                        <span>อุปกรณ์</span>
                        <select value={st.asset ?? ""} onChange={(e) => setItem(it.id, { asset: e.target.value })} className={cx(inputCls, "h-8 max-w-[280px] text-[13px]")}>
                          <option value="">เลือกอัตโนมัติตามระบบและชั้น</option>
                          {opts.map((a) => (
                            <option key={a.code} value={a.code}>
                              {a.code} · {a.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </Card>

          <div className="flex flex-col gap-4">
            <Card className="px-5 py-4">
              <p className="text-[13px] text-ink-2">{locked ? "คะแนนการตรวจ" : "คะแนนขณะตรวจ"}</p>
              <p className="mt-2 flex items-baseline gap-1.5">
                <span className={cx("num text-[40px] font-medium leading-none", score < PASS_SCORE && (locked || answered > 0) && "text-neg")}>{score.toFixed(1)}</span>
                <span className="text-[13px] text-ink-3">/100</span>
              </p>
              <div className="mt-3">
                <Meter value={score} mark={PASS_SCORE} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[
                  ["ผ่าน", live.pass, "text-pos"],
                  ["ไม่ผ่าน", live.fail, "text-neg"],
                  ["ไม่เกี่ยวข้อง", live.na, "text-ink-2"],
                ].map(([l, v, c]) => (
                  <div key={l as string} className="rounded-[10px] bg-raised py-2">
                    <p className={cx("num font-mono text-[18px]", c as string)}>{v}</p>
                    <p className="text-[12px] text-ink-3">{l}</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[13px] text-ink-3">เกณฑ์ผ่าน {PASS_SCORE} คะแนน คิดจากข้อที่เกี่ยวข้อง</p>
              {!locked ? (
                <div className="mt-4 flex flex-col gap-2">
                  <Btn primary onClick={submit} disabled={remaining > 0}>
                    ส่งผลการตรวจ
                  </Btn>
                  <Btn
                    onClick={() => {
                      saveInspectionResults(ins.id, results);
                      setSaved(true);
                    }}
                  >
                    {saved ? "บันทึกร่างแล้ว" : "บันทึกร่าง"}
                  </Btn>
                  {remaining > 0 && <p className="text-center text-[13px] text-ink-3">เหลืออีก {remaining} รายการ</p>}
                </div>
              ) : (
                <div className="mt-4 flex flex-col gap-2">
                  <p className="text-[13px] text-ink-2">
                    ผล <span className={ins.result === "pass" ? "text-pos" : "text-neg"}>{RESULT_LABEL[ins.result]}</span>
                    {ins.submitted && <span className="text-ink-3"> · ส่งผล {ins.submitted}</span>}
                  </p>
                  {ins.result === "fail" && reinspections.length === 0 && (
                    <Btn onClick={reinspect}>
                      <RotateCcw {...I} />
                      นัดตรวจซ้ำ
                    </Btn>
                  )}
                  {reinspections.map((r) => (
                    <Link key={r.id} href={`/inspections/${r.id}`} className="text-[13px] text-accent-text hover:underline">
                      ตรวจซ้ำ {r.id} · {RESULT_LABEL[r.result]}
                    </Link>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <CardHead title="ใบแจ้งซ่อมจากการตรวจนี้" meta={linked.length} />
              {linked.length === 0 ? (
                <p className="px-5 py-4 text-[13px] text-ink-3">{locked ? "ไม่มีข้อบกพร่องที่ต้องแจ้งซ่อม" : "ข้อที่ไม่ผ่านจะเปิดใบแจ้งซ่อมเมื่อส่งผล"}</p>
              ) : (
                <ul>
                  {linked.map((r) => (
                    <li key={r.id} className="border-t border-line px-5 py-3 first:border-t-0">
                      <Link href={`/repairs?q=${r.id}`} className="block transition-opacity duration-150 hover:opacity-70">
                        <span className="flex items-center gap-2">
                          <span className="font-mono text-[12px] text-ink-3">{r.id}</span>
                          <Pill tone={SEV_TONE[r.severity]}>{SEVERITY_LABEL[r.severity]}</Pill>
                        </span>
                        <span className="mt-0.5 block text-[13px]">{r.title}</span>
                        <span className="mt-1 flex items-center gap-2 text-[12px] text-ink-3">
                          <AssetTag code={r.asset} /> {REPAIR_STATUS_LABEL[r.status]}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      </div>

      {/* printable report */}
      <article className="ops-print hidden bg-white text-ink print:block">
        <DocHeader
          title="รายงานผลการตรวจสอบงาน"
          titleEn="INSPECTION REPORT"
          code={ins.id}
          meta={
            <>
              <p>
                วันที่ตรวจ {thDate(ins.date)} {ins.time} น.
              </p>
              <p>
                ผล {RESULT_LABEL[ins.result]} · คะแนน {score.toFixed(1)}
              </p>
            </>
          }
        />
        <DocSection n={1} title="ข้อมูลโครงการ" en="PROJECT">
          <div className="grid grid-cols-2 gap-x-6">
            <DocRow k="โครงการ">
              {ins.projectId} · {p?.name}
            </DocRow>
            <DocRow k="เจ้าของบ้าน">{p?.owner}</DocRow>
            <DocRow k="แบบบ้าน">
              {p?.modelCode} {p?.model}
            </DocRow>
            <DocRow k="ที่ตั้ง">{p?.address}</DocRow>
            <DocRow k="งวดงาน">{ins.phase}</DocRow>
            <DocRow k="ตำแหน่ง">{ins.location}</DocRow>
            <DocRow k="ผู้ตรวจ">{ins.inspector}</DocRow>
            <DocRow k="ผู้จัดการโครงการ">{p?.pm}</DocRow>
          </div>
        </DocSection>
        <DocSection n={2} title="ผลการตรวจรายข้อ" en="CHECKLIST">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-ink-3 text-ink-3">
                <th className="w-8 py-1 font-normal">ข้อ</th>
                <th className="py-1 font-normal">รายการตรวจ</th>
                <th className="py-1 font-normal">เกณฑ์</th>
                <th className="w-20 py-1 font-normal">ผล</th>
                <th className="py-1 font-normal">หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, n) => {
                const st = results[it.id] ?? {};
                return (
                  <tr key={it.id} className="border-b border-line align-top">
                    <td className="py-1 font-mono">{n + 1}</td>
                    <td className="py-1">{it.text}</td>
                    <td className="py-1 text-ink-2">{it.standard}</td>
                    <td className={cx("py-1", st.r === "fail" && "text-neg")}>{st.r ? R_LABEL[st.r] : "–"}</td>
                    <td className="py-1 text-ink-2">{st.note}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-[12px]">
            สรุป ผ่าน {live.pass} · ไม่ผ่าน {live.fail} · ไม่เกี่ยวข้อง {live.na} · คะแนน {score.toFixed(1)} / 100 (เกณฑ์ผ่าน {PASS_SCORE})
          </p>
        </DocSection>
        {linked.length > 0 && (
          <DocSection n={3} title="ข้อบกพร่องที่ต้องแก้ไข" en="DEFECTS">
            {linked.map((r) => (
              <DocRow key={r.id} k={r.id}>
                {r.title} · {r.asset} · {r.location} · ความรุนแรง{SEVERITY_LABEL[r.severity]} · {r.assignee}
              </DocRow>
            ))}
          </DocSection>
        )}
        <Signatures roles={[{ role: "ผู้ตรวจ", name: ins.inspector }, { role: "ผู้จัดการโครงการ", name: p?.pm }, { role: "เจ้าของบ้าน / ผู้แทน", name: p?.owner }]} />
      </article>

      <InspectionForm open={editOpen} onClose={() => setEditOpen(false)} edit={ins} />
    </>
  );
}
