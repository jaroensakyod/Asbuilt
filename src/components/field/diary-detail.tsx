"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Copy, Pencil, Printer, Trash2, Undo2 } from "lucide-react";
import { Card } from "@/components/ui";
import { areaCls, Btn, Empty, I, Pill, PrintStyle, useHydrated } from "@/components/ops/bits";
import { DocHeader, DocRow, DocSection } from "@/components/ops/doc";
import { MediaStrip } from "@/components/media/media-field";
import { wbsTasks, WEATHER_LABEL } from "@/lib/biz";
import { getProject, thDate } from "@/lib/data";
import { canApprove, canEdit } from "@/lib/permissions";
import { addDays, diaryTotals, diaryId } from "@/lib/field/calc";
import { approveDiary, diaries, newDiary, returnDiary } from "@/lib/field/store";
import { DIARY_STATUS_LABEL, type Diary } from "@/lib/field/types";
import { useMe } from "@/lib/use-me";
import { DiaryForm } from "./diary-form";
import { DIARY_TONE } from "./diary-view";

export function DiaryDetail({ id }: { id: string }) {
  const list = diaries.use();
  const hydrated = useHydrated();
  const d = list.find((x) => x.id === id);
  if (!d)
    return (
      <Card>
        <Empty>{hydrated ? `ไม่พบรายงาน ${id}` : "กำลังโหลด"}</Empty>
      </Card>
    );
  return <Sheet key={d.id} d={d} />;
}

function Sheet({ d }: { d: Diary }) {
  const router = useRouter();
  const me = useMe();
  const tasks = wbsTasks.use();
  const p = getProject(d.projectId);
  const [edit, setEdit] = useState<Diary | null>(null);
  const [comment, setComment] = useState("");
  const t = diaryTotals(d);
  const mayApprove = canApprove(me.role, "field") || me.role === "engineer" || me.role === "pm";
  const mayEdit = canEdit(me.role, "field");
  const prevId = diaryId(d.projectId, addDays(d.date, -1));
  const nextId = diaryId(d.projectId, addDays(d.date, 1));
  const groups = new Map<string, number>();
  for (const m of d.manpower) groups.set(m.group, (groups.get(m.group) ?? 0) + m.count);

  return (
    <>
      <PrintStyle />
      <div className="ops-noprint flex flex-wrap items-center justify-between gap-3 pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/diary" className="mr-1 inline-flex h-8 items-center gap-1.5 rounded-[8px] px-2 text-[13px] text-ink-2 hover:bg-raised hover:text-ink">
            <ArrowLeft {...I} />
            กลับ
          </Link>
          <Pill mono>{d.id}</Pill>
          <Pill tone={DIARY_TONE[d.status]}>{DIARY_STATUS_LABEL[d.status]}</Pill>
          <span className="inline-flex items-center">
            <Btn small onClick={() => router.push(`/diary/${prevId}`)} disabled={!diaries.get(prevId)} title="วันก่อนหน้า">
              <ChevronLeft {...I} />
            </Btn>
            <Btn small onClick={() => router.push(`/diary/${nextId}`)} disabled={!diaries.get(nextId)} title="วันถัดไป">
              <ChevronRight {...I} />
            </Btn>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {mayEdit && (
            <Btn onClick={() => setEdit(newDiary(d.projectId, addDays(d.date, 1), me.name))} disabled={!!diaries.get(nextId)} title="เริ่มรายงานวันถัดไปจากฉบับนี้">
              <Copy {...I} />
              คัดลอกไปวันถัดไป
            </Btn>
          )}
          {mayEdit && d.status !== "approved" && (
            <Btn onClick={() => setEdit(d)}>
              <Pencil {...I} />
              แก้ไข
            </Btn>
          )}
          <Btn primary onClick={() => window.print()}>
            <Printer {...I} />
            พิมพ์รายงาน
          </Btn>
          {mayEdit && d.status === "draft" && (
            <Btn
              danger
              onClick={() => {
                if (window.confirm(`ลบรายงาน ${d.id}`)) {
                  diaries.remove(d.id);
                  router.push("/diary");
                }
              }}
            >
              <Trash2 {...I} />
            </Btn>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[1fr_340px]">
        <article className="ops-print mx-auto w-full max-w-[860px] rounded-[4px] border border-line bg-white px-12 py-10 text-ink shadow-[0_2px_12px_rgba(31,27,22,0.08)]">
          <DocHeader
            title="รายงานการปฏิบัติงานประจำวัน"
            titleEn="DAILY SITE REPORT"
            code={d.id}
            meta={
              <>
                <p>วันที่ {thDate(d.date)}</p>
                <p>สถานะ {DIARY_STATUS_LABEL[d.status]}</p>
              </>
            }
          />
          <DocSection n={1} title="โครงการและสภาพอากาศ" en="PROJECT & WEATHER">
            <div className="grid grid-cols-2 gap-x-6">
              <DocRow k="โครงการ">
                {d.projectId} · {p?.name}
              </DocRow>
              <DocRow k="ผู้ว่าจ้าง">{p?.owner ?? "–"}</DocRow>
              <DocRow k="ผู้จัดการโครงการ">{p?.pm ?? "–"}</DocRow>
              <DocRow k="ช่วงงาน">{p?.phase ?? "–"}</DocRow>
              <DocRow k="อากาศเช้า">{WEATHER_LABEL[d.weatherAm]}</DocRow>
              <DocRow k="อากาศบ่าย">{WEATHER_LABEL[d.weatherPm]}</DocRow>
              <DocRow k="ฝนตก">{d.rainHours ? `${d.rainHours} ชม.` : "ไม่มี"}</DocRow>
              <DocRow k="ผู้บันทึก">{d.by}</DocRow>
            </div>
          </DocSection>
          <DocSection n={2} title={`กำลังคน ${t.headcount} คน`} en="MANPOWER">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-ink-3">
                  <th className="py-1 font-normal">บริษัท / ทีม</th>
                  <th className="py-1 font-normal">ประเภทช่าง</th>
                  <th className="py-1 text-right font-normal">จำนวน</th>
                </tr>
              </thead>
              <tbody>
                {d.manpower.map((m, i) => (
                  <tr key={i} className="border-t border-line">
                    <td className="py-1">{m.group}</td>
                    <td className="py-1">{m.trade}</td>
                    <td className="num py-1 text-right font-mono">{m.count}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-ink-3">
                  <td className="py-1" colSpan={2}>
                    บริษัท {t.own} คน · ผู้รับเหมาช่วง {t.sub} คน
                  </td>
                  <td className="num py-1 text-right font-mono font-medium">{t.headcount}</td>
                </tr>
              </tfoot>
            </table>
          </DocSection>
          <DocSection n={3} title="เครื่องจักร/อุปกรณ์" en="EQUIPMENT">
            {d.equipment.length ? (
              <div className="grid grid-cols-2 gap-x-6">
                {d.equipment.map((e, i) => (
                  <DocRow key={i} k={`${e.hours} ชม.`}>
                    {e.name}
                  </DocRow>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-ink-3">ไม่มี</p>
            )}
          </DocSection>
          <DocSection n={4} title="งานที่ดำเนินการ" en="WORK PERFORMED">
            <ol className="list-decimal pl-5 text-[13px]">
              {d.work.map((w, i) => {
                const task = w.taskId ? tasks.find((x) => x.id === w.taskId) : undefined;
                return (
                  <li key={i} className="py-0.5">
                    {w.text}
                    {task && <span className="text-ink-3"> · WBS {task.code}</span>}
                    {w.pct !== undefined && <span className="num font-mono text-ink-3"> · สะสม {w.pct}%</span>}
                  </li>
                );
              })}
            </ol>
          </DocSection>
          <DocSection n={5} title="วัสดุ ปัญหา ผู้เข้าตรวจ ความปลอดภัย" en="DELIVERIES · ISSUES · VISITORS · SAFETY">
            <DocRow k="วัสดุเข้า">{d.deliveries ?? "–"}</DocRow>
            <DocRow k="ปัญหา/ล่าช้า">{d.issues ?? "–"}</DocRow>
            <DocRow k="ผู้เข้าตรวจ">{d.visitors ?? "–"}</DocRow>
            <DocRow k="ความปลอดภัย">{d.safety ?? "–"}</DocRow>
          </DocSection>
          {d.photos.length > 0 && (
            <DocSection n={6} title={`รูปหน้างาน ${d.photos.length} รูป`} en="PHOTOS">
              <MediaStrip refs={d.photos} size={120} />
            </DocSection>
          )}
          <div className="avoid-break mt-10 grid grid-cols-2 gap-8 text-center text-[12px] text-ink-2">
            <div>
              <div className="h-12 border-b border-ink-3" />
              <p className="mt-2 text-ink">({d.by})</p>
              <p>ผู้ควบคุมงาน / ผู้บันทึก</p>
              <p className="mt-1 text-ink-3">{d.submittedAt ?? "วันที่ ........../........../.........."}</p>
            </div>
            <div>
              <div className="h-12 border-b border-ink-3" />
              <p className="mt-2 text-ink">({d.approvedBy ?? p?.pm ?? "................................"})</p>
              <p>ผู้จัดการโครงการ / วิศวกร</p>
              <p className="mt-1 text-ink-3">{d.approvedAt ?? "วันที่ ........../........../.........."}</p>
            </div>
          </div>
        </article>

        <div className="ops-noprint flex flex-col gap-4">
          <Card className="px-5 py-4">
            <p className="text-[13px] text-ink-3">สรุป</p>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <Big n={t.headcount} l="คนงาน" />
              <Big n={t.equipmentHours} l="ชม.เครื่องจักร" />
              <Big n={t.workLines} l="รายการงาน" />
            </div>
            <ul className="mt-3 flex flex-col gap-1 text-[13px]">
              {[...groups.entries()].map(([g, n]) => (
                <li key={g} className="flex justify-between gap-2">
                  <span className="truncate text-ink-2">{g}</span>
                  <span className="num font-mono">{n}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="px-5 py-4">
            <p className="mb-2 text-[13px] text-ink-3">การอนุมัติ</p>
            {d.status === "approved" ? (
              <p className="text-[13px]">
                อนุมัติโดย {d.approvedBy} · {d.approvedAt}
              </p>
            ) : d.status === "submitted" ? (
              mayApprove ? (
                <div className="flex flex-col gap-2">
                  <textarea className={areaCls} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="ความเห็น (ถ้ามี)" aria-label="ความเห็น" />
                  <Btn primary onClick={() => approveDiary(d.id, me.name, comment.trim() || undefined)}>
                    <Check {...I} />
                    อนุมัติรายงาน
                  </Btn>
                  <Btn onClick={() => (comment.trim() ? returnDiary(d.id, comment.trim()) : window.alert("ใส่ความเห็นก่อนส่งกลับ"))}>
                    <Undo2 {...I} />
                    ส่งกลับแก้ไข
                  </Btn>
                </div>
              ) : (
                <p className="text-[13px] text-ink-2">รอผู้จัดการโครงการหรือวิศวกรอนุมัติ</p>
              )
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-[13px] text-ink-2">ฉบับร่าง ยังไม่ได้ส่ง</p>
                {d.comment && <p className="rounded-[8px] bg-warn-soft px-3 py-2 text-[13px] text-warn">{d.comment}</p>}
                {mayEdit && <Btn onClick={() => setEdit(d)}>แก้ไขและส่ง</Btn>}
              </div>
            )}
            {d.comment && d.status !== "draft" && <p className="mt-2 text-[13px] text-ink-3">ความเห็น: {d.comment}</p>}
          </Card>
        </div>
      </div>
      {edit && <DiaryForm initial={edit} onClose={() => setEdit(null)} onSaved={(x) => x.id !== d.id && router.push(`/diary/${x.id}`)} />}
    </>
  );
}

function Big({ n, l }: { n: number; l: string }) {
  return (
    <div>
      <p className="num font-mono text-[22px]">{n}</p>
      <p className="text-[12px] text-ink-3">{l}</p>
    </div>
  );
}
