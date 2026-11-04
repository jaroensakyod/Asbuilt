"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, LayoutGrid, List, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { Card, cx, inputCls } from "@/components/ui";
import { getProject, projects, SYSTEM_LABEL, thDate, TODAY, type SystemKey } from "@/lib/data";
import { deleteInspection, useInspections, type OpsInspection } from "@/lib/ops-store";
import { addDays, PASS_SCORE, PHASES } from "./seed";
import { Btn, Empty, FilterField, I, IconBtn, Initials, Meter, MiniBars, Pill, Segmented, Select, StatCard, SystemPill, type Tone } from "./bits";
import { InspectionForm, INSPECTORS } from "./inspection-form";

export const RESULT_LABEL: Record<OpsInspection["result"], string> = { scheduled: "รอตรวจ", pass: "ผ่าน", fail: "ไม่ผ่าน" };
export const RESULT_TONE: Record<OpsInspection["result"], Tone> = { scheduled: "warn", pass: "pos", fail: "neg" };

type Filters = { q: string; project: string; phase: string; system: string; result: string; inspector: string; from: string; to: string };
const NO_FILTER: Filters = { q: "", project: "", phase: "", system: "", result: "", inspector: "", from: "", to: "" };

export function InspectionsView() {
  const all = useInspections();
  const router = useRouter();
  const [f, setF] = useState<Filters>(NO_FILTER);
  const [view, setView] = useState<"table" | "cards">("table");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<OpsInspection | undefined>();
  const set = (k: keyof Filters) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  const stats = useMemo(() => {
    const month = TODAY.slice(0, 7);
    const yearAgo = addDays(TODAY, -365);
    const thisMonth = all.filter((i) => i.date.startsWith(month));
    const done = all.filter((i) => i.result !== "scheduled" && i.date >= yearAgo && i.date <= TODAY);
    const originals = done.filter((i) => !i.reinspectOf);
    const passedEventually = (i: OpsInspection): boolean => i.result === "pass" || all.some((r) => r.reinspectOf === i.id && passedEventually(r));
    const firstPass = originals.filter((i) => i.result === "pass").length;
    const eventual = originals.filter(passedEventually).length;
    const scheduled = all.filter((i) => i.result === "scheduled");
    const in7 = scheduled.filter((i) => i.date >= TODAY && i.date <= addDays(TODAY, 7)).length;
    const scored = done.filter((i) => i.score !== undefined);
    const avg = scored.reduce((s, i) => s + (i.score ?? 0), 0) / Math.max(1, scored.length);
    const s90 = scored.filter((i) => i.date >= addDays(TODAY, -90));
    const avg90 = s90.reduce((s, i) => s + (i.score ?? 0), 0) / Math.max(1, s90.length);
    const [ty, tm] = TODAY.split("-").map(Number);
    const bars = Array.from({ length: 12 }, (_, k) => {
      const d = new Date(Date.UTC(ty, tm - 12 + k, 1)).toISOString().slice(0, 7);
      return all.filter((i) => i.date.startsWith(d)).length;
    });
    return {
      thisMonth: thisMonth.length,
      doneThisMonth: thisMonth.filter((i) => i.result !== "scheduled").length,
      year: done.length,
      bars,
      passRate: originals.length ? (eventual / originals.length) * 100 : 0,
      firstRate: originals.length ? (firstPass / originals.length) * 100 : 0,
      fails: done.filter((i) => i.result === "fail").length,
      scheduled: scheduled.length,
      in7,
      avg,
      avg90,
    };
  }, [all]);

  const list = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    return all
      .filter((i) => !f.project || i.projectId === f.project)
      .filter((i) => !f.phase || i.phase === f.phase)
      .filter((i) => !f.system || i.systems.includes(f.system as SystemKey))
      .filter((i) => !f.result || i.result === f.result)
      .filter((i) => !f.inspector || i.inspector === f.inspector)
      .filter((i) => !f.from || i.date >= f.from)
      .filter((i) => !f.to || i.date <= f.to)
      .filter((i) => {
        if (!q) return true;
        const p = getProject(i.projectId);
        return `${i.id} ${i.title} ${i.projectId} ${p?.name ?? ""} ${p?.owner ?? ""}`.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        // scheduled first (soonest first), then completed newest first
        if ((a.result === "scheduled") !== (b.result === "scheduled")) return a.result === "scheduled" ? -1 : 1;
        const k = `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`);
        return a.result === "scheduled" ? k : -k;
      });
  }, [all, f]);

  const filtered = JSON.stringify(f) !== JSON.stringify(NO_FILTER);
  const del = (i: OpsInspection) => {
    if (window.confirm(`ลบการตรวจสอบ ${i.id}`)) deleteInspection(i.id);
  };
  const openEdit = (i: OpsInspection) => {
    setEditing(i);
    setFormOpen(true);
  };

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
        <div>
          <p className="mb-1 text-[13px] text-ink-3">QA / QC</p>
          <h1 className="text-[30px] font-normal leading-[1.15]">การตรวจสอบงาน</h1>
          <p className="mt-2 max-w-[44rem] text-ink-2">ตรวจคุณภาพงานก่อสร้างตามงวดงานด้วยเช็กลิสต์มาตรฐาน ข้อที่ไม่ผ่านเปิดเป็นใบแจ้งซ่อมให้อัตโนมัติ</p>
        </div>
        <div className="flex items-center gap-2">
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { key: "table", label: "ตาราง", icon: <List {...I} /> },
              { key: "cards", label: "การ์ด", icon: <LayoutGrid {...I} /> },
            ]}
          />
          <Btn
            primary
            onClick={() => {
              setEditing(undefined);
              setFormOpen(true);
            }}
          >
            <Plus {...I} />
            สร้างการตรวจสอบ
          </Btn>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="ตรวจเดือนนี้"
          value={stats.thisMonth}
          unit="ครั้ง"
          note={`ตรวจเสร็จแล้ว ${stats.doneThisMonth} ครั้ง · ย้อนหลัง 12 เดือน ${stats.year} ครั้ง`}
          extra={<MiniBars values={stats.bars} highlightLast />}
          active={f.from === `${TODAY.slice(0, 7)}-01` && !f.result}
          onClick={() => setF({ ...NO_FILTER, from: `${TODAY.slice(0, 7)}-01`, to: `${TODAY.slice(0, 7)}-31` })}
        />
        <StatCard
          label="อัตราผ่านการตรวจ"
          value={stats.passRate.toFixed(1)}
          unit="%"
          note={`ผ่านตั้งแต่ครั้งแรก ${stats.firstRate.toFixed(1)}% · ไม่ผ่าน ${stats.fails} ครั้ง`}
          extra={<Meter value={stats.passRate} />}
          active={f.result === "fail"}
          onClick={() => setF({ ...NO_FILTER, result: f.result === "fail" ? "" : "fail" })}
        />
        <StatCard
          label="รอตรวจ / นัดหมาย"
          value={stats.scheduled}
          unit="รายการ"
          note={`นัดตรวจใน 7 วันข้างหน้า ${stats.in7} รายการ`}
          active={f.result === "scheduled"}
          onClick={() => setF({ ...NO_FILTER, result: f.result === "scheduled" ? "" : "scheduled" })}
        />
        <StatCard
          label="คะแนนเฉลี่ย"
          value={stats.avg.toFixed(1)}
          unit="/100"
          note={`90 วันล่าสุด ${stats.avg90.toFixed(1)} · เกณฑ์ผ่าน ${PASS_SCORE}`}
          extra={<Meter value={stats.avg} mark={PASS_SCORE} />}
        />
      </div>

      <Card className="mb-4 px-4 py-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <FilterField label="ค้นหา" className="col-span-2">
            <div className="relative">
              <Search {...I} className="pointer-events-none absolute left-2.5 top-2.5 text-ink-3" />
              <input value={f.q} onChange={(e) => set("q")(e.target.value)} placeholder="รหัส INS หัวข้อ โครงการ ลูกค้า" className={cx(inputCls, "w-full pl-8")} />
            </div>
          </FilterField>
          <FilterField label="โครงการ">
            <Select label="โครงการ" value={f.project} onChange={set("project")}>
              <option value="">ทุกโครงการ</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id} · {p.name}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="งวดงาน">
            <Select label="งวดงาน" value={f.phase} onChange={set("phase")}>
              <option value="">ทุกงวดงาน</option>
              {PHASES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="ระบบงาน">
            <Select label="ระบบงาน" value={f.system} onChange={set("system")}>
              <option value="">ทุกระบบ</option>
              {Object.entries(SYSTEM_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="ผลการตรวจ">
            <Select label="ผลการตรวจ" value={f.result} onChange={set("result")}>
              <option value="">ทุกผล</option>
              {Object.entries(RESULT_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="ผู้ตรวจ">
            <Select label="ผู้ตรวจ" value={f.inspector} onChange={set("inspector")}>
              <option value="">ทุกคน</option>
              {INSPECTORS.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="ตั้งแต่">
            <input type="date" value={f.from} onChange={(e) => set("from")(e.target.value)} className={cx(inputCls, "w-full")} />
          </FilterField>
          <FilterField label="ถึง">
            <input type="date" value={f.to} onChange={(e) => set("to")(e.target.value)} className={cx(inputCls, "w-full")} />
          </FilterField>
          <div className="flex items-end gap-3 lg:col-span-3">
            <span className="num pb-2 font-mono text-[12px] text-ink-3">{list.length} รายการ</span>
            {filtered && (
              <Btn small onClick={() => setF(NO_FILTER)}>
                <X {...I} />
                ล้างตัวกรอง
              </Btn>
            )}
          </div>
        </div>
      </Card>

      {view === "table" ? (
        <Card>
          <table className="w-full text-left">
            <thead>
              <tr className="text-[13px] text-ink-3">
                <th className="px-5 py-3 font-normal">การตรวจสอบ</th>
                <th className="py-3 pr-4 font-normal">โครงการ / ตำแหน่ง</th>
                <th className="py-3 pr-4 font-normal">ผู้ตรวจ</th>
                <th className="py-3 pr-4 font-normal">วันที่</th>
                <th className="py-3 pr-4 font-normal">รายการตรวจ</th>
                <th className="py-3 pr-4 text-right font-normal">คะแนน</th>
                <th className="py-3 pr-4 font-normal">ผล</th>
                <th className="py-3 pr-4" />
              </tr>
            </thead>
            <tbody>
              {list.map((i) => {
                const p = getProject(i.projectId);
                const answered = Object.values(i.results ?? {}).filter((x) => x.r).length;
                const progress = i.result === "scheduled" ? (answered / Math.max(1, i.items)) * 100 : 100;
                return (
                  <tr key={i.id} onClick={() => router.push(`/inspections/${i.id}`)} className="cursor-pointer border-t border-line align-top transition-colors duration-150 hover:bg-raised/60">
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Pill mono>{i.id}</Pill>
                        <Pill tone="accent">{i.phase}</Pill>
                        {i.systems.map((s) => (
                          <SystemPill key={s} s={s} />
                        ))}
                        {i.reinspectOf && <Pill>ตรวจซ้ำ</Pill>}
                      </div>
                      <span className="mt-1 block max-w-[420px]">{i.title}</span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="block max-w-[240px] truncate">{p?.name ?? i.projectId}</span>
                      <span className="block text-[13px] text-ink-3">
                        <span className="font-mono text-[12px]">{i.projectId}</span> · {i.location}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="flex items-center gap-2 whitespace-nowrap">
                        <Initials name={i.inspector} />
                        {i.inspector}
                      </span>
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      <span className="num block font-mono text-[13px]">
                        {thDate(i.date)} {i.time}
                      </span>
                      <span className="block text-[13px] text-ink-3">{i.result === "scheduled" ? (i.date < TODAY ? "เลยวันนัด" : "นัดตรวจ") : "ตรวจแล้ว"}</span>
                    </td>
                    <td className="w-[140px] py-3 pr-4">
                      <div className="pt-2">
                        <Meter value={progress} />
                      </div>
                      <span className="num mt-1 block text-[13px] text-ink-3">{i.items} รายการ</span>
                    </td>
                    <td className="num py-3 pr-4 text-right font-mono">{i.score !== undefined ? i.score.toFixed(i.score % 1 ? 1 : 0) : "–"}</td>
                    <td className="py-3 pr-4">
                      <Pill tone={RESULT_TONE[i.result]}>{RESULT_LABEL[i.result]}</Pill>
                    </td>
                    <td className="py-2 pr-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end">
                        <Link href={`/inspections/${i.id}`} aria-label="ดูรายละเอียด" title="ดูรายละเอียด" className="inline-flex size-8 items-center justify-center rounded-[8px] text-ink-3 transition-colors duration-150 hover:bg-raised hover:text-ink">
                          <Eye {...I} />
                        </Link>
                        <IconBtn label="แก้ไข" onClick={() => openEdit(i)}>
                          <Pencil {...I} />
                        </IconBtn>
                        <IconBtn label="ลบ" danger onClick={() => del(i)}>
                          <Trash2 {...I} />
                        </IconBtn>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {list.length === 0 && <Empty>ไม่พบการตรวจสอบตามตัวกรอง</Empty>}
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {list.map((i) => {
              const p = getProject(i.projectId);
              return (
                <Card key={i.id} className="flex flex-col">
                  <Link href={`/inspections/${i.id}`} className="flex-1 px-5 pt-4 transition-opacity duration-150 hover:opacity-80">
                    <div className="flex items-center justify-between gap-2">
                      <Pill mono>{i.id}</Pill>
                      <Pill tone={RESULT_TONE[i.result]}>{RESULT_LABEL[i.result]}</Pill>
                    </div>
                    <p className="mt-3 font-medium">{i.title}</p>
                    <p className="mt-1 text-[13px] text-ink-3">
                      {p?.name ?? i.projectId} · {i.location}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <Pill tone="accent">{i.phase}</Pill>
                      {i.systems.map((s) => (
                        <SystemPill key={s} s={s} />
                      ))}
                    </div>
                    <div className="mt-4 flex items-end justify-between">
                      <span className="text-[13px] text-ink-2">
                        {i.inspector}
                        <span className="num block font-mono text-[12px] text-ink-3">
                          {thDate(i.date)} {i.time} · {i.items} รายการ
                        </span>
                      </span>
                      <span className="num font-mono text-[22px] leading-none">{i.score !== undefined ? i.score.toFixed(0) : "–"}</span>
                    </div>
                  </Link>
                  <div className="mt-3 flex items-center justify-end border-t border-line px-3 py-1.5">
                    <IconBtn label="แก้ไข" onClick={() => openEdit(i)}>
                      <Pencil {...I} />
                    </IconBtn>
                    <IconBtn label="ลบ" danger onClick={() => del(i)}>
                      <Trash2 {...I} />
                    </IconBtn>
                  </div>
                </Card>
              );
            })}
          </div>
          {list.length === 0 && <Empty>ไม่พบการตรวจสอบตามตัวกรอง</Empty>}
        </>
      )}

      <InspectionForm open={formOpen} onClose={() => setFormOpen(false)} edit={editing} onSaved={(ins) => !editing && router.push(`/inspections/${ins.id}`)} />
    </>
  );
}
