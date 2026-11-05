"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search, Settings2, X } from "lucide-react";
import { Card, cx, Field, inputCls } from "@/components/ui";
import { Btn, Empty, FilterField, I, Meter, Modal, Select, StatCard } from "@/components/ops/bits";
import { TODAY, thDate } from "@/lib/data";
import { installments } from "@/lib/biz";
import {
  ARCHITECTS,
  ENGINEERS,
  STAGE_KEYS,
  STAGE_LABEL,
  createDesignJob,
  designJobs,
  designStages,
  designState,
  feeStateOf,
  isStageLate,
  saveDesignSettings,
  useDesignSettings,
  waitingDays,
  type DesignSettings,
  type DesignStage,
  type StageKey,
} from "@/lib/design";
import { Amt, Check, Header, NumInput, ProjectSelect, StagePill, VerifyNote, rowCls, td, th, thR, useAllProjects, usePerms } from "./bits";

type Filter = "" | "active" | "waiting" | "changes" | "done";

export function DesignStagesView() {
  const { edit } = usePerms("design");
  const jobs = designJobs.use();
  const stages = designStages.use();
  const inst = installments.use();
  const settings = useDesignSettings();
  const all = useAllProjects();

  const [q, setQ] = useState("");
  const [f, setF] = useState<Filter>("");
  const [arch, setArch] = useState("");
  const [creating, setCreating] = useState(false);
  const [setup, setSetup] = useState(false);

  const rows = useMemo(() => {
    return jobs
      .map((j) => {
        const list = stages.filter((s) => s.projectId === j.projectId);
        const st = designState(list, settings.feePct);
        const waiting = list.map((s) => waitingDays(s, TODAY)).find((d) => d !== undefined);
        const ready = list.filter((s) => feeStateOf(s, inst) === "ready").reduce((t, s) => t + s.fee, 0);
        const late = list.some((s) => isStageLate(s, TODAY) && s.status === "in_progress");
        const p = all.find((x) => x.id === j.projectId);
        return { j, list, st, waiting, ready, late, p };
      })
      .filter((r) => {
        const n = q.trim().toLowerCase();
        if (n && !`${r.j.projectId} ${r.p?.name ?? ""} ${r.p?.owner ?? ""} ${r.j.leadArchitect}`.toLowerCase().includes(n)) return false;
        if (arch && r.j.leadArchitect !== arch) return false;
        if (f === "active") return !r.st.done;
        if (f === "waiting") return r.waiting !== undefined;
        if (f === "changes") return r.list.some((s) => s.status === "changes_requested");
        if (f === "done") return r.st.done;
        return true;
      })
      .sort((a, b) => Number(a.st.done) - Number(b.st.done) || (b.waiting ?? -1) - (a.waiting ?? -1) || a.j.projectId.localeCompare(b.j.projectId));
  }, [jobs, stages, inst, settings.feePct, all, q, f, arch]);

  const active = jobs.filter((j) => !designState(stages.filter((s) => s.projectId === j.projectId), settings.feePct).done);
  const waitingList = stages.filter((s) => s.status === "client_review");
  const overdueWait = waitingList.filter((s) => (waitingDays(s, TODAY) ?? 0) > settings.reviewAlertDays);
  const readyFee = stages.filter((s) => feeStateOf(s, inst) === "ready");
  const revisions = stages.filter((s) => active.some((j) => j.projectId === s.projectId)).reduce((t, s) => t + s.revisions, 0);

  return (
    <>
      <Header
        eyebrow="ออกแบบ"
        title="ขั้นตอนออกแบบ"
        sub="ติดตามงานออกแบบแต่ละโครงการตั้งแต่แนวคิดจนถึงยื่นขออนุญาต รายการส่งมอบ ผู้รับผิดชอบ การอนุมัติของลูกค้าผ่านพอร์ทัล และงวดค่าออกแบบ"
        actions={
          <>
            <Btn onClick={() => setSetup(true)}>
              <Settings2 {...I} />
              ตั้งค่า
            </Btn>
            {edit && (
              <Btn primary onClick={() => setCreating(true)}>
                <Plus {...I} />
                เริ่มงานออกแบบ
              </Btn>
            )}
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="กำลังออกแบบ" value={active.length} unit="โครงการ" note={`ทั้งหมด ${jobs.length} โครงการ`} onClick={() => setF(f === "active" ? "" : "active")} active={f === "active"} />
        <StatCard label="รอลูกค้าอนุมัติ" value={waitingList.length} unit="ขั้นตอน" tone={overdueWait.length ? "neg" : undefined} note={overdueWait.length ? `${overdueWait.length} รายการรอเกิน ${settings.reviewAlertDays} วัน` : "ไม่มีรายการรอนาน"} onClick={() => setF(f === "waiting" ? "" : "waiting")} active={f === "waiting"} />
        <StatCard label="การแก้ไขแบบ" value={revisions} unit="ครั้ง" note={`ขอแก้ไขอยู่ ${stages.filter((s) => s.status === "changes_requested").length} ขั้นตอน`} onClick={() => setF(f === "changes" ? "" : "changes")} active={f === "changes"} />
        <StatCard label="ค่าออกแบบพร้อมเรียกเก็บ" value={<Amt n={readyFee.reduce((t, s) => t + s.fee, 0)} />} note={`${readyFee.length} ขั้นตอนที่ลูกค้าอนุมัติแล้ว`} />
      </div>

      <Card className="mb-4">
        <div className="grid grid-cols-2 gap-3 px-4 py-3 lg:grid-cols-5">
          <FilterField label="ค้นหา" className="col-span-2">
            <div className="relative">
              <Search {...I} className="pointer-events-none absolute left-2.5 top-2.5 text-ink-3" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="รหัส ชื่อโครงการ เจ้าของ สถาปนิก" className={cx(inputCls, "w-full pl-8")} />
            </div>
          </FilterField>
          <FilterField label="สถานะ">
            <Select label="สถานะ" value={f} onChange={(v) => setF(v as Filter)}>
              <option value="">ทั้งหมด</option>
              <option value="active">กำลังออกแบบ</option>
              <option value="waiting">รอลูกค้าอนุมัติ</option>
              <option value="changes">ลูกค้าขอแก้ไข</option>
              <option value="done">ออกแบบเสร็จแล้ว</option>
            </Select>
          </FilterField>
          <FilterField label="สถาปนิก">
            <Select label="สถาปนิก" value={arch} onChange={setArch}>
              <option value="">ทุกคน</option>
              {[...new Set(jobs.map((j) => j.leadArchitect))].map((a) => (
                <option key={a}>{a}</option>
              ))}
            </Select>
          </FilterField>
          <div className="flex items-end">
            {(q || f || arch) && (
              <button type="button" onClick={() => (setQ(""), setF(""), setArch(""))} className="inline-flex h-9 items-center gap-1 text-[13px] text-ink-2 hover:text-ink">
                <X {...I} />
                ล้างตัวกรอง
              </button>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left">
            <thead>
              <tr>
                <th className={cx(th, "px-5")}>โครงการ</th>
                <th className={th}>ขั้นตอน</th>
                <th className={th}>ขั้นปัจจุบัน</th>
                <th className={cx(th, "w-[140px]")}>ความคืบหน้า</th>
                <th className={th}>สถาปนิก</th>
                <th className={thR}>แก้ไข</th>
                <th className={thR}>ค่าออกแบบรอเก็บ</th>
                <th className={cx(th, "pr-5")}>หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ j, list, st, waiting, ready, late, p }) => (
                <tr key={j.id} className={rowCls}>
                  <td className={cx(td, "px-5")}>
                    <Link href={`/design-stages/${j.projectId}`} className="block hover:underline">
                      {p?.name ?? j.projectId}
                    </Link>
                    <span className="block font-mono text-[12px] text-ink-3">
                      {j.projectId} · {p?.owner}
                    </span>
                  </td>
                  <td className={td}>
                    <StageDots list={list} />
                  </td>
                  <td className={td}>{st.current ? <span className="flex flex-col gap-1"><span>{STAGE_LABEL[st.current.key]}</span><StagePill s={st.current.status} /></span> : <StagePill s="approved" />}</td>
                  <td className={td}>
                    <div className="flex items-center gap-2">
                      <Meter value={st.pct} />
                      <span className="num w-9 shrink-0 text-right font-mono text-[12px] text-ink-2">{st.pct}%</span>
                    </div>
                  </td>
                  <td className={td}>{j.leadArchitect}</td>
                  <td className={cx(td, "num text-right font-mono")}>{st.revisions}</td>
                  <td className={cx(td, "text-right")}>{ready > 0 ? <Amt n={ready} /> : <span className="text-ink-3">–</span>}</td>
                  <td className={cx(td, "pr-5 text-[12px]")}>
                    {waiting !== undefined && <span className={cx("block", waiting > settings.reviewAlertDays ? "text-neg" : "text-warn")}>รอลูกค้า {waiting} วัน</span>}
                    {late && <span className="block text-neg">เลยกำหนดส่งงาน</span>}
                    {st.current && <span className="block text-ink-3">กำหนด {thDate(st.current.due)}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <Empty>{jobs.length ? "ไม่พบโครงการตามตัวกรอง" : "ยังไม่มีงานออกแบบ กด “เริ่มงานออกแบบ” เพื่อสร้าง"}</Empty>}
      </Card>

      {creating && <NewJobModal onClose={() => setCreating(false)} existing={jobs.map((j) => j.projectId)} />}
      {setup && <SettingsModal s={settings} onClose={() => setSetup(false)} />}
    </>
  );
}

const DOT: Record<DesignStage["status"], string> = {
  not_started: "border-line-strong bg-card",
  in_progress: "border-accent bg-accent-soft",
  client_review: "border-warn bg-warn-soft",
  changes_requested: "border-neg bg-neg-soft",
  approved: "border-ink bg-ink",
};
export function StageDots({ list }: { list: DesignStage[] }) {
  return (
    <div className="flex items-center gap-1">
      {STAGE_KEYS.map((k, i) => {
        const s = list.find((x) => x.key === k);
        return (
          <span key={k} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden className="h-px w-2.5 bg-line-strong" />}
            <span title={`${STAGE_LABEL[k]} · ${s ? s.status : "–"}`} className={cx("size-3 rounded-full border", s ? DOT[s.status] : "border-line bg-card")} />
          </span>
        );
      })}
    </div>
  );
}

function NewJobModal({ onClose, existing }: { onClose: () => void; existing: string[] }) {
  const all = useAllProjects();
  const free = all.filter((p) => !existing.includes(p.id) && p.status !== "delivered");
  const [projectId, setProjectId] = useState(free[0]?.id ?? "");
  const [fee, setFee] = useState(150000);
  const [inContract, setInContract] = useState(false);
  const [lead, setLead] = useState(ARCHITECTS[0]);
  const [structural, setStructural] = useState(ENGINEERS[0]);
  const [mep, setMep] = useState(ENGINEERS[1]);
  const [start, setStart] = useState(TODAY);
  const save = () => {
    if (!projectId) return;
    createDesignJob({ projectId, feeTotal: inContract ? 0 : fee, inContract, leadArchitect: lead, structural, mep, start, note: inContract ? "ค่าออกแบบรวมอยู่ในสัญญาก่อสร้าง" : undefined });
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="เริ่มงานออกแบบ"
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary onClick={save} disabled={!projectId}>
            สร้าง 5 ขั้นตอน
          </Btn>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="โครงการ">
            <ProjectSelect value={projectId} onChange={setProjectId} list={free} />
          </Field>
        </div>
        <Field label="วันเริ่มออกแบบ">
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} />
        </Field>
        <Field label="ค่าออกแบบรวม (บาท ก่อน VAT)">
          <NumInput value={inContract ? 0 : fee} onChange={setFee} step={1000} />
        </Field>
        <div className="sm:col-span-2">
          <Check checked={inContract} onChange={setInContract} label="ค่าออกแบบรวมอยู่ในสัญญาก่อสร้าง (ไม่สร้างงวดค่าออกแบบแยก)" />
        </div>
        <Field label="สถาปนิกผู้รับผิดชอบ">
          <Select label="สถาปนิก" value={lead} onChange={setLead}>
            {ARCHITECTS.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </Select>
        </Field>
        <Field label="วิศวกรโครงสร้าง">
          <Select label="วิศวกรโครงสร้าง" value={structural} onChange={setStructural}>
            {ENGINEERS.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </Select>
        </Field>
        <Field label="วิศวกรงานระบบ">
          <Select label="วิศวกรงานระบบ" value={mep} onChange={setMep}>
            {ENGINEERS.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </Select>
        </Field>
      </div>
      <p className="mt-3 text-[12px] text-ink-3">ระบบสร้างขั้นตอน แนวคิด → ร่างแบบ → พัฒนาแบบ → แบบก่อสร้าง → ยื่นขออนุญาต พร้อมรายการส่งมอบมาตรฐาน แก้ไขได้ภายหลัง</p>
    </Modal>
  );
}

export function SettingsModal({ s, onClose }: { s: DesignSettings; onClose: () => void }) {
  const { edit } = usePerms("design");
  const [v, setV] = useState<DesignSettings>(s);
  const set = <K extends keyof DesignSettings>(k: K, x: DesignSettings[K]) => setV((p) => ({ ...p, [k]: x }));
  const pctSum = STAGE_KEYS.reduce((t, k) => t + v.feePct[k], 0);
  return (
    <Modal
      open
      onClose={onClose}
      title="ตั้งค่างานออกแบบและใบอนุญาต"
      width={720}
      footer={
        <>
          <Btn onClick={onClose}>ปิด</Btn>
          {edit && (
            <Btn primary onClick={() => (saveDesignSettings(v), onClose())}>
              บันทึก
            </Btn>
          )}
        </>
      }
    >
      <p className="mb-2 text-[13px] font-medium">สัดส่วนค่าออกแบบต่อขั้นตอน (%)</p>
      <div className="grid grid-cols-5 gap-2">
        {STAGE_KEYS.map((k: StageKey) => (
          <Field key={k} label={STAGE_LABEL[k]}>
            <NumInput value={v.feePct[k]} onChange={(n) => set("feePct", { ...v.feePct, [k]: n })} />
          </Field>
        ))}
      </div>
      <p className={cx("mt-1 text-[12px]", pctSum === 100 ? "text-ink-3" : "text-neg")}>รวม {pctSum}% {pctSum !== 100 && "(ควรรวมได้ 100%)"}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Field label="ครบกำหนดชำระหลังอนุมัติ (วัน)">
          <NumInput value={v.installmentDueDays} onChange={(n) => set("installmentDueDays", n)} />
        </Field>
        <Field label="VAT (%)">
          <NumInput value={v.vatRate} onChange={(n) => set("vatRate", n)} />
        </Field>
        <Field label="เตือนเมื่อลูกค้ายังไม่ตอบ (วัน)">
          <NumInput value={v.reviewAlertDays} onChange={(n) => set("reviewAlertDays", n)} />
        </Field>
      </div>
      <div className="mt-3">
        <Check checked={v.autoInstallment} onChange={(x) => set("autoInstallment", x)} label="สร้างงวด “ค่าออกแบบ …” ให้บัญชีอัตโนมัติเมื่อลูกค้าอนุมัติขั้นตอน" />
      </div>

      <div className="mt-5 flex items-baseline justify-between">
        <p className="text-[13px] font-medium">ใบอนุญาตก่อสร้าง</p>
        <VerifyNote />
      </div>
      <div className="mt-2 grid gap-3 sm:grid-cols-3">
        <Field label="อายุใบอนุญาต (วัน)">
          <NumInput value={v.permitValidityDays} onChange={(n) => set("permitValidityDays", n)} />
        </Field>
        <Field label="ระยะพิจารณา ข.1 ตามกฎหมาย (วัน)">
          <NumInput value={v.permitReviewDays} onChange={(n) => set("permitReviewDays", n)} />
        </Field>
        <Field label="ระยะตรวจแบบหลังรับแจ้ง ม.39 ทวิ (วัน)">
          <NumInput value={v.m39ReviewDays} onChange={(n) => set("m39ReviewDays", n)} />
        </Field>
        <Field label="เตือนเมื่อรอพิจารณาเกิน (วัน)">
          <NumInput value={v.permitPendingDays} onChange={(n) => set("permitPendingDays", n)} />
        </Field>
        <Field label="เตือนก่อนใบอนุญาตหมดอายุ (วัน)">
          <NumInput value={v.permitExpiryDays} onChange={(n) => set("permitExpiryDays", n)} />
        </Field>
        <Field label="อาคารขนาดใหญ่ ตั้งแต่ (ตร.ม.)">
          <NumInput value={v.largeBuildingM2} onChange={(n) => set("largeBuildingM2", n)} />
        </Field>
      </div>
      <div className="mt-5 flex items-baseline justify-between">
        <p className="text-[13px] font-medium">เกณฑ์ต้องจัดทำรายงาน EIA</p>
        <VerifyNote>ตรวจสอบกับประกาศกระทรวงทรัพยากรฯ ล่าสุดและพื้นที่ตั้งโครงการ</VerifyNote>
      </div>
      <div className="mt-2 grid gap-3 sm:grid-cols-3">
        <Field label="ความสูงอาคาร ตั้งแต่ (ม.)">
          <NumInput value={v.eiaHeightM} onChange={(n) => set("eiaHeightM", n)} step={0.5} />
        </Field>
        <Field label="พื้นที่รวม ตั้งแต่ (ตร.ม.)">
          <NumInput value={v.eiaAreaM2} onChange={(n) => set("eiaAreaM2", n)} step={100} />
        </Field>
        <Field label="อาคารชุด ตั้งแต่ (ห้อง)">
          <NumInput value={v.eiaCondoUnits} onChange={(n) => set("eiaCondoUnits", n)} />
        </Field>
      </div>
    </Modal>
  );
}
