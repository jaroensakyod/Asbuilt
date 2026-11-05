"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Info, Plus, Settings2 } from "lucide-react";
import { Card, CardHead, Field, inputCls, PageHeader } from "@/components/ui";
import { Btn, Empty, I, MiniBars, Modal, Pill, Select, StatCard } from "@/components/ops/bits";
import { thDate, TODAY } from "@/lib/data";
import { ssoMonthlyMax, type SsoSettings } from "@/lib/hr/calc";
import { addDays, buildDailyRun, buildMonthlyRun, monthlyRunId, prevPeriod, runTotals, ssoAlreadyThisMonth, weekday } from "@/lib/hr/payroll";
import { ACTIVE_SITES } from "@/lib/hr/seed";
import { attendance, employees, saveHrSettings, saveRun, useHrSettings, useRuns } from "@/lib/hr/store";
import { advances, pieceClaims, useLabourSettings } from "@/lib/hr/labour-store";
import { applyAdvances } from "@/lib/hr/labour";
import type { HrRun } from "@/lib/hr/types";
import { fmt, HrTabs, periodLabel, SubTabs, useHrAccess } from "./bits";
import { LabourView, Pnd1View, SsoReportView, Tawi50View } from "./hr-reports";
import { RUN_STATUS, RunDetail, runTitle } from "./run-detail";

type Tab = "runs" | "sso" | "pnd1" | "tawi" | "labour";

export function PayrollView() {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const runId = params.get("run");
  const tab = (params.get("tab") as Tab | null) ?? "runs";
  const go = (q: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) if (v) sp.set(k, v);
    const s = sp.toString();
    router.push(s ? `${path}?${s}` : path);
  };

  return (
    <>
      <div className="hr-noprint">
        <PageHeader eyebrow="บุคคล" title="เงินเดือน & ค่าแรง" sub="รอบเงินเดือนพนักงานรายเดือน รอบค่าแรงคนงานรายวันจากใบลงเวลา ประกันสังคม ภาษีหัก ณ ที่จ่าย และต้นทุนแรงงานตามโครงการ" />
        <HrTabs />
      </div>
      {runId ? (
        <RunDetail id={runId} onBack={() => go({})} />
      ) : (
        <>
          <div className="hr-noprint mb-5">
            <SubTabs
              value={tab}
              onChange={(t) => go({ tab: t === "runs" ? undefined : t })}
              options={[
                { key: "runs", label: "รอบจ่าย" },
                { key: "sso", label: "ประกันสังคม สปส.1-10" },
                { key: "pnd1", label: "ภ.ง.ด.1" },
                { key: "tawi", label: "50 ทวิ ประจำปี" },
                { key: "labour", label: "ค่าแรงตามโครงการ" },
              ]}
            />
          </div>
          {tab === "runs" && <Runs open={(id) => go({ run: id })} />}
          {tab === "sso" && <SsoReportView />}
          {tab === "pnd1" && <Pnd1View />}
          {tab === "tawi" && <Tawi50View />}
          {tab === "labour" && <LabourView />}
        </>
      )}
    </>
  );
}

function Runs({ open }: { open: (id: string) => void }) {
  const runs = useRuns();
  const settings = useHrSettings();
  const { edit, approve } = useHrAccess();
  const [kind, setKind] = useState<"" | "monthly" | "daily">("");
  const [creating, setCreating] = useState<"monthly" | "daily" | null>(null);
  const [editSso, setEditSso] = useState(false);

  const sorted = useMemo(() => [...runs].sort((a, b) => b.payDate.localeCompare(a.payDate) || a.id.localeCompare(b.id)), [runs]);
  const shown = sorted.filter((r) => !kind || r.kind === kind);
  const year = TODAY.slice(0, 4);
  const filed = runs.filter((r) => r.status !== "draft");
  const ytd = filed.filter((r) => r.period.startsWith(year)).reduce((s, r) => s + runTotals(r).gross + r.employerSso, 0);
  const last = prevPeriod(TODAY.slice(0, 7));
  const lastMonth = filed.filter((r) => r.period === last);
  const drafts = runs.filter((r) => r.status === "draft");
  const months = Array.from({ length: 12 }, (_, i) => prevPeriod(TODAY.slice(0, 7), 12 - i));
  const series = (k: "monthly" | "daily") => months.map((p) => filed.filter((r) => r.kind === k && r.period === p).reduce((s, r) => s + runTotals(r).gross, 0));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={`เงินเดือน ${periodLabel(last)}`} value={fmt(lastMonth.filter((r) => r.kind === "monthly").reduce((s, r) => s + runTotals(r).gross, 0), 0)} unit="บาท" extra={<MiniBars values={series("monthly")} highlightLast />} active={kind === "monthly"} onClick={() => setKind(kind === "monthly" ? "" : "monthly")} />
        <StatCard label={`ค่าแรงรายวัน ${periodLabel(last)}`} value={fmt(lastMonth.filter((r) => r.kind === "daily").reduce((s, r) => s + runTotals(r).gross, 0), 0)} unit="บาท" extra={<MiniBars values={series("daily")} highlightLast />} active={kind === "daily"} onClick={() => setKind(kind === "daily" ? "" : "daily")} />
        <StatCard label={`ต้นทุนบุคลากรปี ${Number(year) + 543}`} value={fmt(ytd / 1e6, 2)} unit="ล้านบาท" note="รายได้ + สมทบนายจ้าง" />
        <StatCard label="รอบที่ยังเป็นร่าง" value={drafts.length} unit="รอบ" note={drafts.length ? (approve ? "รอคุณอนุมัติ" : "รอผู้บริหารอนุมัติ") : "ไม่มี"} tone={drafts.length ? "neg" : undefined} />
      </div>

      <Card className="flex flex-wrap items-center gap-3 px-5 py-3.5">
        <Info {...I} className="shrink-0 text-ink-3" />
        <p className="min-w-0 flex-1 text-[13px] text-ink-2">
          ประกันสังคม {settings.sso.rate * 100}% ของค่าจ้าง ฐานต่ำสุด <span className="num font-mono">{fmt(settings.sso.floor, 0)}</span> สูงสุด <span className="num font-mono">{fmt(settings.sso.ceiling, 0)}</span> บาท (หักสูงสุด <span className="num font-mono">{fmt(ssoMonthlyMax(settings.sso), 0)}</span> บาท/เดือน) · เพดานค่าจ้างมีกำหนดปรับขึ้นเป็นขั้นบันได ตรวจสอบประกาศสำนักงานประกันสังคมก่อนปิดงวด
        </p>
        {edit && (
          <Btn small onClick={() => setEditSso(true)}>
            <Settings2 {...I} />
            ตั้งค่า
          </Btn>
        )}
      </Card>

      <Card>
        <CardHead
          title="รอบจ่าย"
          meta={`${shown.length} รอบ`}
          action={
            edit && (
              <div className="flex gap-2">
                <Btn small onClick={() => setCreating("daily")}>
                  <Plus {...I} />
                  รอบค่าแรงรายวัน
                </Btn>
                <Btn small primary onClick={() => setCreating("monthly")}>
                  <Plus {...I} />
                  รอบเงินเดือน
                </Btn>
              </div>
            )
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-ink-3">
                <th className="px-5 py-2 font-normal">รอบ</th>
                <th className="px-2 py-2 font-normal">รายละเอียด</th>
                <th className="px-2 py-2 font-normal">วันจ่าย</th>
                <th className="px-2 py-2 text-right font-normal">คน</th>
                <th className="px-2 py-2 text-right font-normal">รายได้รวม</th>
                <th className="px-2 py-2 text-right font-normal">ประกันสังคม</th>
                <th className="px-2 py-2 text-right font-normal">ภาษี</th>
                <th className="px-2 py-2 text-right font-normal">สุทธิ</th>
                <th className="px-5 py-2 font-normal">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const t = runTotals(r);
                return (
                  <tr key={r.id} onClick={() => open(r.id)} className="cursor-pointer border-b border-line transition-colors duration-150 last:border-0 hover:bg-raised/60">
                    <td className="px-5 py-2 font-mono text-[12px]">{r.id}</td>
                    <td className="px-2 py-2">
                      {runTitle(r)}
                      <span className="block text-[12px] text-ink-3">{r.kind === "monthly" ? "พนักงานรายเดือน" : `คนงานรายวัน · ${new Set(r.lines.map((l) => l.projectId)).size} หน้างาน`}</span>
                    </td>
                    <td className="px-2 py-2 text-ink-2">{thDate(r.payDate)}</td>
                    <td className="num px-2 py-2 text-right font-mono">{t.heads}</td>
                    <td className="num px-2 py-2 text-right font-mono">{fmt(t.gross)}</td>
                    <td className="num px-2 py-2 text-right font-mono">{fmt(t.sso, 0)}</td>
                    <td className="num px-2 py-2 text-right font-mono">{fmt(t.wht)}</td>
                    <td className="num px-2 py-2 text-right font-mono font-medium">{fmt(t.net)}</td>
                    <td className="px-5 py-2">
                      <Pill tone={RUN_STATUS[r.status].tone}>{RUN_STATUS[r.status].label}</Pill>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!shown.length && <Empty>ยังไม่มีรอบจ่าย</Empty>}
        </div>
      </Card>

      {creating === "monthly" && <NewMonthly onClose={() => setCreating(null)} onCreated={open} />}
      {creating === "daily" && <NewDaily onClose={() => setCreating(null)} onCreated={open} />}
      {editSso && <SsoSettingsForm onClose={() => setEditSso(false)} />}
    </div>
  );
}

function NewMonthly({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const runs = useRuns();
  const emps = employees.use();
  const settings = useHrSettings();
  const options = Array.from({ length: 4 }, (_, i) => prevPeriod(TODAY.slice(0, 7), 2 - i));
  const [period, setPeriod] = useState(options.find((p) => !runs.some((r) => r.id === monthlyRunId(p))) ?? options[2]);
  const [payDate, setPayDate] = useState(`${period}-${String(settings.payDay).padStart(2, "0")}`);
  const exists = runs.some((r) => r.id === monthlyRunId(period));
  const advs = advances.use();
  const claims = pieceClaims.use();
  const labour = useLabourSettings();
  const preview = useMemo(() => {
    const r = buildMonthlyRun(emps, period, payDate, settings.sso);
    return { ...r, lines: applyAdvances(r.lines, r.id, advs, runs, claims, labour.maxDeductShare) };
  }, [emps, period, payDate, settings.sso, advs, runs, claims, labour.maxDeductShare]);
  const t = runTotals(preview);
  const create = () => {
    saveRun({ ...preview, createdBy: "HR" });
    onCreated(preview.id);
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="สร้างรอบเงินเดือน"
      width={520}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={exists || !t.heads} onClick={create}>
            สร้างร่าง
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="งวดเดือน">
          <select
            className={inputCls}
            value={period}
            onChange={(e) => {
              setPeriod(e.target.value);
              setPayDate(`${e.target.value}-${String(settings.payDay).padStart(2, "0")}`);
            }}
          >
            {options.map((p) => (
              <option key={p} value={p}>
                {periodLabel(p)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="วันที่จ่าย">
          <input type="date" className={inputCls} value={payDate} onChange={(e) => setPayDate(e.target.value)} />
        </Field>
      </div>
      {exists ? (
        <p className="mt-3 text-[13px] text-neg">มีรอบ {monthlyRunId(period)} อยู่แล้ว เปิดรอบเดิมเพื่อแก้ไขหรือคำนวณใหม่</p>
      ) : (
        <p className="mt-3 text-[13px] text-ink-2">
          {t.heads} คน · รายได้รวม <span className="num font-mono">{fmt(t.gross)}</span> · ประกันสังคม <span className="num font-mono">{fmt(t.sso, 0)}</span> · ภาษี <span className="num font-mono">{fmt(t.wht)}</span> บาท. ใส่ OT และรายการหักในร่างได้ก่อนส่งอนุมัติ
          <AdvanceNote run={preview} />
        </p>
      )}
    </Modal>
  );
}

function NewDaily({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const runs = useRuns();
  const emps = employees.use();
  const sheets = attendance.use();
  const settings = useHrSettings();
  const [cycle, setCycle] = useState(settings.dailyCycle);
  const lastTo = runs.filter((r) => r.kind === "daily" && r.to).reduce((m, r) => (r.to! > m ? r.to! : m), addDays(TODAY, -7));
  const defFrom = addDays(lastTo, 1 + (weekday(addDays(lastTo, 1)) === 0 ? 1 : 0));
  const [from, setFrom] = useState(defFrom);
  const [to, setTo] = useState(addDays(defFrom, 5));
  const [payDate, setPayDate] = useState(addDays(defFrom, 5));
  const [site, setSite] = useState("");

  const changeCycle = (c: "weekly" | "semimonthly") => {
    setCycle(c);
    if (c === "semimonthly") {
      const day = Number(TODAY.slice(8, 10));
      const m = TODAY.slice(0, 7);
      const f = day <= 15 ? `${prevPeriod(m)}-16` : `${m}-01`;
      const tt = day <= 15 ? addDays(`${m}-01`, -1) : `${m}-15`;
      setFrom(f);
      setTo(tt);
      setPayDate(tt);
    } else {
      setFrom(defFrom);
      setTo(addDays(defFrom, 5));
      setPayDate(addDays(defFrom, 5));
    }
  };

  const advs = advances.use();
  const claims = pieceClaims.use();
  const labour = useLabourSettings();
  const preview = useMemo(() => {
    const r = buildDailyRun(emps, sheets, { from, to, payDate, cycle, projectId: site || undefined, sso: settings.sso, already: ssoAlreadyThisMonth(runs, payDate.slice(0, 7)) });
    return { ...r, lines: applyAdvances(r.lines, r.id, advs, runs, claims, labour.maxDeductShare) };
  }, [emps, sheets, from, to, payDate, cycle, site, settings.sso, runs, advs, claims, labour.maxDeductShare]);
  const exists = runs.some((r) => r.id === preview.id);
  const overlap = runs.some((r) => r.kind === "daily" && r.from && r.to && r.from <= to && r.to >= from && (!r.projectId || !site || r.projectId === site));
  const t = runTotals(preview);
  const missingDays = useMemo(() => {
    let n = 0;
    for (let d = from; d <= to && d <= TODAY; d = addDays(d, 1)) if (weekday(d) !== 0 && !sheets.some((s) => s.date === d && (!site || s.projectId === site))) n++;
    return n;
  }, [from, to, sheets, site]);

  return (
    <Modal
      open
      onClose={onClose}
      title="สร้างรอบค่าแรงรายวัน"
      width={600}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn
            primary
            disabled={exists || !t.heads || to < from}
            onClick={() => {
              saveRun({ ...preview, createdBy: "HR" });
              onCreated(preview.id);
            }}
          >
            สร้างร่าง
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="รอบการจ่าย">
          <select className={inputCls} value={cycle} onChange={(e) => changeCycle(e.target.value as "weekly" | "semimonthly")}>
            <option value="weekly">รายสัปดาห์ (จ.–ส.)</option>
            <option value="semimonthly">ครึ่งเดือน</option>
          </select>
        </Field>
        <Field label="หน้างาน">
          <Select label="หน้างาน" value={site} onChange={setSite}>
            <option value="">ทุกหน้างาน</option>
            {ACTIVE_SITES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} · {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="ตั้งแต่วันที่">
          <input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="ถึงวันที่">
          <input type="date" className={inputCls} value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <Field label="วันที่จ่าย">
          <input type="date" className={inputCls} value={payDate} onChange={(e) => setPayDate(e.target.value)} />
        </Field>
        <Field label="รหัสรอบ">
          <input className={`${inputCls} font-mono`} value={preview.id} readOnly />
        </Field>
      </div>
      <div className="mt-3 flex flex-col gap-1 text-[13px]">
        <p className="text-ink-2">
          {t.heads} รายการ · ค่าแรงรวม <span className="num font-mono">{fmt(t.gross)}</span> · OT <span className="num font-mono">{fmt(t.ot)}</span> · ประกันสังคม <span className="num font-mono">{fmt(t.sso, 0)}</span> บาท
        </p>
        {missingDays > 0 && <p className="text-warn">มี {missingDays} วันทำงานในช่วงนี้ที่ยังไม่มีใบลงเวลา คนงานในวันนั้นจะไม่ได้รับค่าแรงจนกว่าจะลงเวลาและคำนวณใหม่</p>}
        {exists && <p className="text-neg">มีรอบ {preview.id} อยู่แล้ว</p>}
        {!exists && overlap && <p className="text-warn">ช่วงวันที่ซ้อนกับรอบค่าแรงที่มีอยู่ ตรวจสอบเพื่อไม่ให้จ่ายซ้ำ</p>}
        <AdvanceNote run={preview} />
        <p className="text-ink-3">ค่าแรง = วัน × อัตรา (ครึ่งวัน = 0.5) + OT ชั่วโมงละ อัตรา/8 × 1.5 · ประกันสังคมหักไม่เกินเพดานต่อเดือนรวมทุกรอบ · คนงานรายวันโดยปกติไม่หักภาษี</p>
      </div>
    </Modal>
  );
}

/** "หักเงินเบิก n รายการ ฿x" for a run preview */
function AdvanceNote({ run }: { run: HrRun }) {
  const taken = run.lines.flatMap((l) => l.advances ?? []);
  if (!taken.length) return null;
  return (
    <span className="mt-1 block text-ink-2">
      หักเงินเบิกล่วงหน้าตามตาราง {taken.length} รายการ รวม <span className="num font-mono">{fmt(taken.reduce((s, x) => s + x.amount, 0))}</span> บาท
    </span>
  );
}

function SsoSettingsForm({ onClose }: { onClose: () => void }) {
  const s = useHrSettings();
  const [sso, setSso] = useState<SsoSettings>(s.sso);
  const [payDay, setPayDay] = useState(s.payDay);
  const [cycle, setCycle] = useState(s.dailyCycle);
  const num = (k: keyof SsoSettings, pct = false) => (e: React.ChangeEvent<HTMLInputElement>) => setSso((x) => ({ ...x, [k]: pct ? Number(e.target.value) / 100 : Number(e.target.value) }));
  return (
    <Modal
      open
      onClose={onClose}
      title="ตั้งค่าเงินเดือนและประกันสังคม"
      width={560}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn
            primary
            onClick={() => {
              saveHrSettings({ ...s, sso, payDay, dailyCycle: cycle });
              onClose();
            }}
          >
            บันทึก
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="อัตราสมทบลูกจ้าง (%)">
          <input type="number" step={0.5} className={`${inputCls} font-mono`} value={sso.rate * 100} onChange={num("rate", true)} />
        </Field>
        <Field label="อัตราสมทบนายจ้าง (%)">
          <input type="number" step={0.5} className={`${inputCls} font-mono`} value={sso.employerRate * 100} onChange={num("employerRate", true)} />
        </Field>
        <Field label="ฐานค่าจ้างต่ำสุด (บาท)">
          <input type="number" className={`${inputCls} font-mono`} value={sso.floor} onChange={num("floor")} />
        </Field>
        <Field label="ฐานค่าจ้างสูงสุด (บาท)">
          <input type="number" className={`${inputCls} font-mono`} value={sso.ceiling} onChange={num("ceiling")} />
        </Field>
        <Field label="วันที่จ่ายเงินเดือน">
          <input type="number" min={1} max={31} className={`${inputCls} font-mono`} value={payDay} onChange={(e) => setPayDay(Math.min(31, Math.max(1, Number(e.target.value) || 25)))} />
        </Field>
        <Field label="รอบค่าแรงรายวัน">
          <select className={inputCls} value={cycle} onChange={(e) => setCycle(e.target.value as "weekly" | "semimonthly")}>
            <option value="weekly">รายสัปดาห์</option>
            <option value="semimonthly">ครึ่งเดือน</option>
          </select>
        </Field>
      </div>
      <p className="mt-3 text-[13px] text-ink-2">
        หักสูงสุด <span className="num font-mono">{fmt(ssoMonthlyMax(sso), 0)}</span> บาท/เดือน. เพดานค่าจ้าง 15,000 บาทมีกำหนดปรับขึ้นเป็นขั้นบันได เมื่อมีผลบังคับให้แก้ค่าที่นี่ก่อนสร้างรอบของเดือนนั้น รอบที่สร้างแล้วไม่เปลี่ยนจนกว่าจะกดคำนวณใหม่
      </p>
    </Modal>
  );
}
