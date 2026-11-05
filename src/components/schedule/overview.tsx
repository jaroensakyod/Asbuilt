"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Settings2 } from "lucide-react";
import { Card, cx, Field, inputCls, PageHeader } from "@/components/ui";
import { Btn, Empty, FilterField, I, Modal, Pill, Select, StatCard } from "@/components/ops/bits";
import { STATUS_LABEL, thDate, TODAY } from "@/lib/data";
import { saveScheduleSettings, summaryOf, useScheduleCtx, type ScheduleSettings } from "@/lib/schedule";
import { DaysLate, fmtPct, IdxPill, ProgressBar, useAllProjects, useSchedulePerms } from "./bits";

const th = "px-3 py-2 text-left text-[12px] font-normal text-ink-3 whitespace-nowrap";
const td = "px-3 py-2.5 align-top";

type Sort = "late" | "spi" | "pct" | "critical" | "finish";

export function ScheduleOverview() {
  const perms = useSchedulePerms();
  const ctx = useScheduleCtx();
  const projects = useAllProjects();
  const [scope, setScope] = useState("active");
  const [pm, setPm] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("late");
  const [only, setOnly] = useState<"" | "late" | "spi" | "critical">("");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const all = useMemo(
    () =>
      projects
        .filter((p) => p.status !== "delivered")
        .map((p) => ({ p, s: summaryOf(p, ctx) }))
        .filter((x) => x.s.hasWbs || x.p.status === "building" || x.p.status === "handover"),
    [projects, ctx],
  );
  const active = all.filter((x) => x.p.status === "building" || x.p.status === "handover");
  const pms = [...new Set(all.map((x) => x.p.pm))].sort();
  const spiWarn = ctx.settings.spiWarn;

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = all
      .filter((x) => (scope === "active" ? x.p.status === "building" || x.p.status === "handover" : scope === "all" ? true : x.p.status === scope))
      .filter((x) => !pm || x.p.pm === pm)
      .filter((x) => !needle || `${x.p.id} ${x.p.name} ${x.p.pm} ${x.p.province}`.toLowerCase().includes(needle))
      .filter((x) => (only === "late" ? x.s.daysLate > 0 : only === "spi" ? (x.s.spi ?? 1) < spiWarn : only === "critical" ? x.s.criticalLate > 0 : true));
    const key: Record<Sort, (x: (typeof rows)[number]) => number | string> = {
      late: (x) => -x.s.daysLate,
      spi: (x) => x.s.spi ?? 9,
      pct: (x) => -x.s.pct,
      critical: (x) => -x.s.criticalLate,
      finish: (x) => x.s.forecastFinish ?? x.p.finish,
    };
    return [...rows].sort((a, b) => {
      const ka = key[sort](a);
      const kb = key[sort](b);
      return ka < kb ? -1 : ka > kb ? 1 : a.p.id.localeCompare(b.p.id);
    });
  }, [all, scope, pm, q, sort, only, spiWarn]);

  const totalValue = active.reduce((s, x) => s + x.p.value, 0);
  const avg = (f: (x: (typeof active)[number]) => number | undefined) => {
    let v = 0;
    let w = 0;
    for (const x of active) {
      const n = f(x);
      if (n === undefined) continue;
      v += n * x.p.value;
      w += x.p.value;
    }
    return w > 0 ? v / w : undefined;
  };
  const avgSpi = avg((x) => x.s.spi);
  const lateCount = active.filter((x) => x.s.daysLate > 0).length;
  const lowSpi = active.filter((x) => (x.s.spi ?? 1) < spiWarn).length;
  const critLate = active.reduce((s, x) => s + x.s.criticalLate, 0);

  return (
    <>
      <PageHeader
        eyebrow="แผนงาน & ความคืบหน้า"
        title="แผนงานทุกโครงการ"
        sub="ความคืบหน้าถ่วงน้ำหนักตามมูลค่างานเทียบแผนฐาน (baseline) ดัชนี SPI/CPI วันแล้วเสร็จคาดการณ์ และงานวิกฤตที่ล่าช้า"
        actions={
          perms.edit && (
            <Btn onClick={() => setSettingsOpen(true)}>
              <Settings2 {...I} />
              ตั้งค่าแผนงาน
            </Btn>
          )
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="โครงการที่กำลังก่อสร้าง" value={active.length} unit="โครงการ" note={`มูลค่ารวม ${totalValue.toLocaleString("th-TH", { maximumFractionDigits: 1 })} ล้านบาท`} active={only === ""} onClick={() => setOnly("")} />
        <StatCard label="SPI เฉลี่ยถ่วงมูลค่า" value={avgSpi === undefined ? "–" : avgSpi.toFixed(2)} note={`${lowSpi} โครงการต่ำกว่า ${spiWarn.toFixed(2)}`} tone={avgSpi !== undefined && avgSpi < spiWarn ? "neg" : undefined} active={only === "spi"} onClick={() => setOnly(only === "spi" ? "" : "spi")} />
        <StatCard label="คาดว่าเสร็จช้ากว่าสัญญา" value={lateCount} unit="โครงการ" tone={lateCount ? "neg" : undefined} note="วันแล้วเสร็จคาดการณ์เทียบวันสิ้นสุดสัญญา" active={only === "late"} onClick={() => setOnly(only === "late" ? "" : "late")} />
        <StatCard label="งานวิกฤตล่าช้า" value={critLate} unit="งาน" tone={critLate ? "neg" : undefined} note="อยู่บนเส้นทางวิกฤตและช้ากว่าแผน" active={only === "critical"} onClick={() => setOnly(only === "critical" ? "" : "critical")} />
      </div>

      <Card className="mb-4">
        <div className="grid grid-cols-2 gap-3 px-4 py-3 lg:grid-cols-6">
          <FilterField label="ค้นหา" className="col-span-2">
            <div className="relative">
              <Search {...I} className="pointer-events-none absolute left-2.5 top-2.5 text-ink-3" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="รหัส ชื่อโครงการ ผู้จัดการโครงการ" className={cx(inputCls, "w-full pl-8")} />
            </div>
          </FilterField>
          <FilterField label="สถานะโครงการ">
            <Select label="สถานะโครงการ" value={scope} onChange={setScope}>
              <option value="active">กำลังก่อสร้าง/ตรวจรับ</option>
              <option value="building">{STATUS_LABEL.building}</option>
              <option value="handover">{STATUS_LABEL.handover}</option>
              <option value="planning">{STATUS_LABEL.planning}</option>
              <option value="all">ทั้งหมดที่มีแผนงาน</option>
            </Select>
          </FilterField>
          <FilterField label="ผู้จัดการโครงการ">
            <Select label="ผู้จัดการโครงการ" value={pm} onChange={setPm}>
              <option value="">ทุกคน</option>
              {pms.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="เรียงตาม">
            <Select label="เรียงตาม" value={sort} onChange={(v) => setSort(v as Sort)}>
              <option value="late">ล่าช้ามากสุด</option>
              <option value="spi">SPI ต่ำสุด</option>
              <option value="critical">งานวิกฤตล่าช้ามากสุด</option>
              <option value="pct">ความคืบหน้ามากสุด</option>
              <option value="finish">วันเสร็จคาดการณ์</option>
            </Select>
          </FilterField>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] border-collapse text-[13px]">
            <thead>
              <tr>
                <th className={cx(th, "pl-5")}>โครงการ</th>
                <th className={cx(th, "w-[170px]")}>ความคืบหน้า (จริง / แผน)</th>
                <th className={th}>SPI</th>
                <th className={th}>CPI</th>
                <th className={th}>สิ้นสุดสัญญา</th>
                <th className={th}>คาดการณ์เสร็จ</th>
                <th className={th}>เทียบสัญญา</th>
                <th className={th}>งานวิกฤตล่าช้า</th>
                <th className={cx(th, "pr-5")}>ช่วงงาน / หมุดหมายถัดไป</th>
              </tr>
            </thead>
            <tbody>
              {list.map(({ p, s }) => (
                <tr key={p.id} className="border-t border-line transition-colors duration-150 hover:bg-raised/60">
                  <td className={cx(td, "pl-5")}>
                    <Link href={`/schedule/${encodeURIComponent(p.id)}`} className="block max-w-[260px] truncate hover:underline">
                      {p.name}
                    </Link>
                    <span className="block text-[12px] text-ink-3">
                      <span className="font-mono">{p.id}</span> · {p.pm}
                    </span>
                  </td>
                  <td className={td}>
                    {s.hasWbs ? (
                      <>
                        <ProgressBar actual={s.pct} plan={s.planPct} />
                        <span className="mt-1 block font-mono text-[12px] text-ink-3">
                          {fmtPct(s.pct)} · แผน {fmtPct(s.planPct)}
                        </span>
                      </>
                    ) : (
                      <span className="text-[12px] text-ink-3">ยังไม่มีแผนงาน</span>
                    )}
                  </td>
                  <td className={td}>{s.hasWbs && <IdxPill v={s.spi} warn={spiWarn} />}</td>
                  <td className={td}>{s.hasWbs && <IdxPill v={s.cpi} warn={0.95} />}</td>
                  <td className={cx(td, "whitespace-nowrap font-mono text-[12px] text-ink-2")}>{thDate(p.finish)}</td>
                  <td className={cx(td, "whitespace-nowrap font-mono text-[12px]")}>{s.forecastFinish ? thDate(s.forecastFinish) : "–"}</td>
                  <td className={cx(td, "whitespace-nowrap text-[12px]")}>{s.hasWbs && <DaysLate d={s.daysLate} />}</td>
                  <td className={td}>
                    {s.criticalLate > 0 ? <Pill tone="neg">{s.criticalLate} งาน</Pill> : s.hasWbs ? <Pill tone="pos">ไม่มี</Pill> : null}
                    {s.dueNotStarted > 0 && <span className="mt-1 block text-[12px] text-warn">ควรเริ่มแล้ว {s.dueNotStarted}</span>}
                  </td>
                  <td className={cx(td, "pr-5")}>
                    <span className="block max-w-[240px] truncate">{s.currentPhase ?? "–"}</span>
                    {s.nextMilestone && (
                      <span className="block max-w-[240px] truncate text-[12px] text-ink-3">
                        <span className="mr-1.5 inline-block size-1.5 rotate-45 bg-ink-3 align-middle" />
                        {s.nextMilestone.name} · <span className="font-mono">{thDate(s.nextMilestone.date)}</span>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {list.length === 0 && <Empty>ไม่พบโครงการตามตัวกรอง</Empty>}
      </Card>
      <p className="mt-3 text-[12px] text-ink-3">
        ข้อมูล ณ {thDate(TODAY)} · แผนคิดจากเส้นฐาน (baseline) กระจายมูลค่าเชิงเส้นตามระยะเวลางาน · CPI เทียบมูลค่างานที่ทำได้ตามงบต้นทุนกับต้นทุนจริงจากระบบต้นทุน · วันเสร็จคาดการณ์ = วันเสร็จตามเส้นฐาน + ความล่าช้าสะสม (earned schedule) และไม่เร็วกว่าแผนปัจจุบัน
      </p>

      {settingsOpen && <SettingsModal initial={ctx.settings} onClose={() => setSettingsOpen(false)} />}
    </>
  );
}

function SettingsModal({ initial, onClose }: { initial: ScheduleSettings; onClose: () => void }) {
  const [s, setS] = useState(initial);
  return (
    <Modal
      open
      onClose={onClose}
      title="ตั้งค่าแผนงาน"
      width={520}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn
            primary
            onClick={() => {
              saveScheduleSettings(s);
              onClose();
            }}
          >
            บันทึก
          </Btn>
        </>
      }
    >
      <div className="grid gap-4">
        <label className="flex items-start gap-3 text-[14px]">
          <input type="checkbox" className="mt-1 accent-[var(--accent)]" checked={s.skipSundays} onChange={(e) => setS({ ...s, skipSundays: e.target.checked })} />
          <span>
            ไม่นับวันอาทิตย์เป็นวันทำงาน
            <span className="block text-[12px] text-ink-3">ใช้กับระยะเวลางานและ lag ของความสัมพันธ์ เมื่อคำนวณแผนใหม่ (ไม่ย้ายวันที่ที่บันทึกไว้จนกว่าจะแก้ไขงาน)</span>
          </span>
        </label>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Look-ahead (สัปดาห์)">
            <input type="number" min={1} max={8} value={s.lookaheadWeeks} onChange={(e) => setS({ ...s, lookaheadWeeks: Math.max(1, Math.min(8, Number(e.target.value) || 3)) })} className={cx(inputCls, "num font-mono")} />
          </Field>
          <Field label="แจ้งเตือน SPI ต่ำกว่า">
            <input type="number" step={0.05} min={0.5} max={1} value={s.spiWarn} onChange={(e) => setS({ ...s, spiWarn: Number(e.target.value) || 0.9 })} className={cx(inputCls, "num font-mono")} />
          </Field>
          <Field label="ช้ากว่าแผน (จุด %)">
            <input type="number" min={1} max={50} value={s.behindPts} onChange={(e) => setS({ ...s, behindPts: Number(e.target.value) || 10 })} className={cx(inputCls, "num font-mono")} />
          </Field>
        </div>
        <p className="text-[12px] text-ink-3">เกณฑ์เหล่านี้เป็นค่าภายในบริษัท ปรับได้ตามนโยบายการบริหารโครงการ</p>
      </div>
    </Modal>
  );
}
