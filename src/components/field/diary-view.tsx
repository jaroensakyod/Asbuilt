"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Copy, Plus, Search, Smartphone } from "lucide-react";
import { Card, CardHead, cx, Field, inputCls } from "@/components/ui";
import { Btn, Empty, FilterField, I, Modal, Pill, Select, StatCard, useHydrated, type Tone } from "@/components/ops/bits";
import { getProject, projects, thDate, TODAY } from "@/lib/data";
import { addDays, dateRange, diaryTotals, dow, diaryId } from "@/lib/field/calc";
import { diaries, newDiary, useFieldSettings } from "@/lib/field/store";
import { DIARY_STATUS_LABEL, type Diary, type DiaryStatus } from "@/lib/field/types";
import { useMe } from "@/lib/use-me";
import { DiaryForm } from "./diary-form";
import { WeatherText } from "./bits";

export const DIARY_TONE: Record<DiaryStatus, Tone> = { draft: "neutral", submitted: "warn", approved: "pos" };
const ACTIVE = () => projects.filter((p) => p.status === "building" || p.status === "handover");

export function DiaryView() {
  return (
    <Suspense fallback={<div className="h-[60vh]" />}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const sp = useSearchParams();
  const router = useRouter();
  const me = useMe();
  const hydrated = useHydrated();
  const list = diaries.use();
  const s = useFieldSettings();
  const [project, setProject] = useState(sp.get("project") ?? "");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [editing, setEditing] = useState<Diary | null>(null);

  const active = useMemo(() => ACTIVE(), []);
  const days = useMemo(() => dateRange(addDays(TODAY, -27), TODAY), []);
  const byKey = useMemo(() => new Map(list.map((d) => [`${d.projectId}|${d.date}`, d])), [list]);
  const expected = (d: string) => s.diaryDays.includes(dow(d));

  const stats = useMemo(() => {
    let yday = addDays(TODAY, -1);
    while (!s.diaryDays.includes(dow(yday))) yday = addDays(yday, -1);
    const building = active.filter((p) => p.status === "building");
    const todayList = list.filter((d) => d.date === TODAY);
    const ydayList = list.filter((d) => d.date === yday);
    const missing = building.filter((p) => !ydayList.some((d) => d.projectId === p.id));
    const exp28 = active.reduce((n, p) => n + days.filter((d) => expected(d) && d >= p.start && d < TODAY).length, 0);
    const have28 = list.filter((d) => d.date >= days[0] && d.date < TODAY && active.some((p) => p.id === d.projectId)).length;
    return {
      today: todayList.length,
      yday,
      missing,
      waiting: list.filter((d) => d.status === "submitted").length,
      headcount: ydayList.reduce((n, d) => n + diaryTotals(d).headcount, 0),
      coverage: exp28 ? Math.round((have28 / exp28) * 100) : 0,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, active, days, s.diaryDays]);

  const rows = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return list
      .filter((d) => !project || d.projectId === project)
      .filter((d) => !status || d.status === status)
      .filter((d) => !qq || `${d.id} ${d.by} ${d.work.map((w) => w.text).join(" ")} ${d.issues ?? ""} ${getProject(d.projectId)?.name ?? ""}`.toLowerCase().includes(qq))
      .sort((a, b) => b.date.localeCompare(a.date) || a.projectId.localeCompare(b.projectId))
      .slice(0, 200);
  }, [list, project, status, q]);

  const open = (projectId: string, date: string) => {
    const d = byKey.get(`${projectId}|${date}`);
    if (d) router.push(`/diary/${d.id}`);
    else setEditing(newDiary(projectId, date, me.name));
  };

  const calProjects = project ? active.filter((p) => p.id === project) : active;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
        <div>
          <p className="mb-1 text-[13px] text-ink-3">หน้างาน</p>
          <h1 className="text-[30px] font-normal leading-[1.15]">รายงานประจำวัน</h1>
          <p className="mt-2 max-w-[44rem] text-ink-2">สภาพอากาศ กำลังคน เครื่องจักร งานที่ทำ วัสดุเข้า ปัญหา และรูปหน้างานของทุกโครงการ ผู้ควบคุมงานส่งจากมือถือ ผู้จัดการโครงการอนุมัติ</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/m/diary" className="inline-flex h-9 items-center gap-2 rounded-[8px] border border-line-strong bg-card px-4 text-[14px] font-medium hover:bg-raised">
            <Smartphone {...I} />
            เปิดแบบมือถือ
          </Link>
          <Btn primary onClick={() => setNewOpen(true)}>
            <Plus {...I} />
            เขียนรายงาน
          </Btn>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="ส่งรายงานวันนี้" value={stats.today} unit={`/ ${active.length} โครงการ`} note="รวมฉบับร่าง" />
        <StatCard label={`ยังไม่ส่ง ${thDate(stats.yday)}`} value={stats.missing.length} unit="โครงการ" tone={stats.missing.length ? "neg" : undefined} note={stats.missing.map((p) => p.id).join(", ") || "ครบทุกโครงการ"} />
        <StatCard label="รออนุมัติ" value={stats.waiting} unit="ฉบับ" note="ผู้จัดการโครงการ/วิศวกรตรวจ" active={status === "submitted"} onClick={() => setStatus(status === "submitted" ? "" : "submitted")} />
        <StatCard label="ความครบถ้วน 4 สัปดาห์" value={stats.coverage} unit="%" note={`คนงานเมื่อวานรวม ${stats.headcount} คน`} />
      </div>

      <Card className="mb-4">
        <CardHead title="ปฏิทินการส่งรายงาน" meta="28 วันล่าสุด" action={<Legend />} />
        <div className="overflow-x-auto px-5 py-4">
          <table className="border-separate border-spacing-[3px] text-[12px]">
            <thead>
              <tr>
                <th className="pr-3 text-left font-normal text-ink-3">โครงการ</th>
                {days.map((d) => (
                  <th key={d} className={cx("w-6 text-center font-mono font-normal", d === TODAY ? "text-ink" : "text-ink-3")}>
                    {Number(d.slice(8))}
                  </th>
                ))}
                <th className="pl-3 text-right font-normal text-ink-3">ขาด</th>
              </tr>
            </thead>
            <tbody>
              {calProjects.map((p) => {
                const miss = days.filter((d) => d < TODAY && d >= p.start && expected(d) && !byKey.has(`${p.id}|${d}`)).length;
                return (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap pr-3">
                      <span className="font-mono text-ink-3">{p.id}</span> {p.name}
                    </td>
                    {days.map((d) => {
                      const x = byKey.get(`${p.id}|${d}`);
                      const exp = expected(d) && d >= p.start;
                      const missing = !x && exp && d < TODAY;
                      return (
                        <td key={d} className="p-0">
                          <button
                            type="button"
                            title={`${thDate(d)} · ${x ? DIARY_STATUS_LABEL[x.status] : missing ? "ไม่มีรายงาน" : exp ? "ยังไม่ส่ง" : "วันหยุด"}`}
                            onClick={() => open(p.id, d)}
                            className={cx(
                              "block size-6 rounded-[4px] transition-opacity hover:opacity-70",
                              x?.status === "approved" && "bg-pos",
                              x?.status === "submitted" && "bg-warn",
                              x?.status === "draft" && "border border-ink-3 bg-raised",
                              missing && "border border-neg bg-neg-soft",
                              !x && !missing && exp && "border border-dashed border-line-strong",
                              !x && !exp && "bg-raised/60",
                            )}
                          />
                        </td>
                      );
                    })}
                    <td className={cx("num pl-3 text-right font-mono", miss ? "text-neg" : "text-ink-3")}>{hydrated ? miss : "–"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mb-4 px-4 py-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <FilterField label="ค้นหา" className="col-span-2">
            <div className="relative">
              <Search {...I} className="pointer-events-none absolute left-2.5 top-2.5 text-ink-3" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="งาน ปัญหา ผู้บันทึก" className={cx(inputCls, "w-full pl-8")} />
            </div>
          </FilterField>
          <FilterField label="โครงการ">
            <Select label="โครงการ" value={project} onChange={setProject}>
              <option value="">ทุกโครงการ</option>
              {active.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id} · {p.name}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="สถานะ">
            <Select label="สถานะ" value={status} onChange={setStatus}>
              <option value="">ทุกสถานะ</option>
              {(Object.keys(DIARY_STATUS_LABEL) as DiaryStatus[]).map((k) => (
                <option key={k} value={k}>
                  {DIARY_STATUS_LABEL[k]}
                </option>
              ))}
            </Select>
          </FilterField>
        </div>
      </Card>

      <Card>
        {rows.length === 0 ? (
          <Empty>ไม่พบรายงานตามตัวกรอง</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="text-ink-3">
                  <th className="px-5 py-3 font-normal">วันที่</th>
                  <th className="py-3 pr-4 font-normal">โครงการ</th>
                  <th className="py-3 pr-4 font-normal">อากาศ</th>
                  <th className="py-3 pr-4 text-right font-normal">คนงาน</th>
                  <th className="py-3 pr-4 font-normal">งานที่ทำ</th>
                  <th className="py-3 pr-4 font-normal">ผู้บันทึก</th>
                  <th className="py-3 pr-5 font-normal">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => {
                  const t = diaryTotals(d);
                  return (
                    <tr key={d.id} className="cursor-pointer border-t border-line hover:bg-raised/50" onClick={() => router.push(`/diary/${d.id}`)}>
                      <td className="whitespace-nowrap px-5 py-2.5">
                        <span className="num font-mono">{thDate(d.date)}</span>
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className="block">{getProject(d.projectId)?.name ?? d.projectId}</span>
                        <span className="font-mono text-[12px] text-ink-3">{d.projectId}</span>
                      </td>
                      <td className="py-2.5 pr-4">
                        <WeatherText am={d.weatherAm} pm={d.weatherPm} />
                        {!!d.rainHours && <span className="block text-[12px] text-ink-3">ฝน {d.rainHours} ชม.</span>}
                      </td>
                      <td className="num py-2.5 pr-4 text-right font-mono">{t.headcount}</td>
                      <td className="max-w-[420px] py-2.5 pr-4">
                        <span className="line-clamp-1">{d.work.map((w) => w.text).join(" · ")}</span>
                        {d.issues && <span className="line-clamp-1 text-[12px] text-warn">{d.issues}</span>}
                      </td>
                      <td className="py-2.5 pr-4 text-ink-2">{d.by}</td>
                      <td className="py-2.5 pr-5">
                        <Pill tone={DIARY_TONE[d.status]}>{DIARY_STATUS_LABEL[d.status]}</Pill>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {newOpen && <NewDiary onClose={() => setNewOpen(false)} onPick={(pid, date) => (setNewOpen(false), open(pid, date))} defaultProject={project || active[0]?.id || ""} />}
      {editing && <DiaryForm initial={editing} onClose={() => setEditing(null)} onSaved={(d) => router.push(`/diary/${d.id}`)} />}
    </>
  );
}

function NewDiary({ onClose, onPick, defaultProject }: { onClose: () => void; onPick: (projectId: string, date: string) => void; defaultProject: string }) {
  const [pid, setPid] = useState(defaultProject);
  const [date, setDate] = useState(TODAY);
  const exists = diaries.get(diaryId(pid, date));
  const prev = diaries
    .all()
    .filter((d) => d.projectId === pid && d.date < date)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  return (
    <Modal
      open
      onClose={onClose}
      title="เขียนรายงานประจำวัน"
      width={520}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary onClick={() => onPick(pid, date)} disabled={!pid}>
            {exists ? "เปิดรายงานที่มีอยู่" : prev ? <><Copy {...I} />คัดลอกจากวันก่อนหน้า</> : "เริ่มรายงานใหม่"}
          </Btn>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="โครงการ">
          <Select label="โครงการ" value={pid} onChange={setPid}>
            {ACTIVE().map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} · {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="วันที่">
          <input type="date" className={inputCls} value={date} max={TODAY} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <p className="text-[13px] text-ink-3">
          {exists ? `มีรายงาน ${exists.id} แล้ว (${DIARY_STATUS_LABEL[exists.status]})` : prev ? `ระบบคัดลอกกำลังคน เครื่องจักร และงานที่ยังไม่เสร็จจากรายงาน ${thDate(prev.date)} ให้แก้ต่อได้ทันที` : "ยังไม่มีรายงานก่อนหน้าของโครงการนี้"}
        </p>
      </div>
    </Modal>
  );
}

function Legend() {
  const item = (cls: string, t: string) => (
    <span className="inline-flex items-center gap-1.5">
      <span className={cx("inline-block size-3 rounded-[3px]", cls)} />
      {t}
    </span>
  );
  return (
    <div className="flex flex-wrap items-center gap-3 text-[12px] text-ink-3">
      {item("bg-pos", "อนุมัติ")}
      {item("bg-warn", "รออนุมัติ")}
      {item("border border-ink-3 bg-raised", "ร่าง")}
      {item("border border-neg bg-neg-soft", "ขาด")}
    </div>
  );
}
