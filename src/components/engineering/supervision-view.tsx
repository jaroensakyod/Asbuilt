"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Pencil, Plus, Printer } from "lucide-react";
import { Card, cx, Field, inputCls } from "@/components/ui";
import { Btn, Empty, FilterField, I, KV, Modal, Pill, PrintStyle, Select, StatCard } from "@/components/ops/bits";
import { MediaField, MediaStrip } from "@/components/media/media-field";
import { SignaturePad } from "@/components/media/signature-pad";
import { siteDiaries } from "@/lib/biz";
import { COMPANY_INFO, getProject, thDate, TODAY } from "@/lib/data";
import {
  checkLicensing,
  diffDays,
  LEVEL_LABEL,
  COUNCIL_LABEL,
  licensees,
  nextSeries,
  nowIso,
  projectLicensing,
  supervisionReports,
  supervisorChanges,
  useEngSettings,
  type Licensee,
  type SupervisionReport,
  type SupervisorChange,
} from "@/lib/engineering";
import { Area, CheckNote, DocHeader, DocRow, DocSection, Heading, PeopleList, pname, ProjectSelect, rowCls, SearchBox, SigImg, Tabs, td, th, thDT, useActiveProjects, useEngPerms } from "./bits";
import { LicensesTab, RulesTab } from "./supervision-licenses";
import { SupervisionAssist } from "@/components/ai-field/eng-assist";

type STab = "reports" | "changes" | "licenses" | "rules";
const KIND_LABEL = { daily: "รายวัน", weekly: "รายสัปดาห์" } as const;
const levelName = (c: Licensee["council"], l: 1 | 2 | 3) => LEVEL_LABEL[c][l];

export function SupervisionView() {
  const sp = useSearchParams();
  const t = sp.get("tab");
  const tab: STab = t === "changes" || t === "licenses" || t === "rules" ? t : "reports";
  return <Inner key={sp.toString()} initTab={tab} initProject={sp.get("project") ?? ""} />;
}

function Inner({ initTab, initProject }: { initTab: STab; initProject: string }) {
  const perms = useEngPerms();
  const s = useEngSettings();
  const reps = supervisionReports.use();
  const chg = supervisorChanges.use();
  const lic = licensees.use();
  const pl = projectLicensing.use();
  const projects = useActiveProjects();
  const [tab, setTab] = useState<STab>(initTab);
  const [newKey, setNewKey] = useState(0);

  const stats = useMemo(() => {
    const month = TODAY.slice(0, 7);
    const thisMonth = reps.filter((r) => r.to.slice(0, 7) === month).length;
    const drafts = reps.filter((r) => r.status === "draft").length;
    const expiring = lic.filter((l) => diffDays(TODAY, l.expiry) <= s.licenseDays).length;
    const expired = lic.filter((l) => l.expiry < TODAY).length;
    const bad = pl.filter((x) => {
      const p = projects.find((q) => q.id === x.projectId);
      if (!p || p.status === "delivered") return false;
      return checkLicensing(s.rules, x.floors ?? p.floors, x.area ?? p.area, x.assigned, lic, TODAY, levelName).some((c) => !c.ok);
    }).length;
    return { thisMonth, drafts, expiring, expired, bad };
  }, [reps, lic, pl, projects, s]);

  return (
    <>
      <PrintStyle />
      <Heading
        title="ควบคุมงาน & ใบอนุญาต"
        sub="รายงานการควบคุมงานของวิศวกรผู้ควบคุมงาน การแจ้งเปลี่ยนผู้ควบคุมงานต่อเจ้าพนักงานท้องถิ่น และทะเบียนใบอนุญาตประกอบวิชาชีพของผู้ออกแบบและผู้ควบคุมงาน"
        actions={
          perms.edit && (tab === "reports" || tab === "changes" || tab === "licenses") ? (
            <Btn primary onClick={() => setNewKey((k) => k + 1)}>
              <Plus {...I} />
              {tab === "reports" ? "เขียนรายงานควบคุมงาน" : tab === "changes" ? "บันทึกเปลี่ยนผู้ควบคุมงาน" : "เพิ่มผู้ประกอบวิชาชีพ"}
            </Btn>
          ) : undefined
        }
      />
      <div className="ops-noprint mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="รายงานเดือนนี้" value={stats.thisMonth} note="รายวันและรายสัปดาห์" active={tab === "reports"} onClick={() => setTab("reports")} />
        <StatCard label="รายงานรอลงนาม" value={stats.drafts} note="ยังไม่ได้เซ็นรับรอง" tone={stats.drafts ? "neg" : undefined} onClick={() => setTab("reports")} />
        <StatCard label="ใบอนุญาตใกล้หมด/หมดอายุ" value={stats.expiring} note={stats.expired ? `หมดอายุแล้ว ${stats.expired} ราย` : `ภายใน ${s.licenseDays} วัน`} tone={stats.expired ? "neg" : undefined} active={tab === "licenses"} onClick={() => setTab("licenses")} />
        <StatCard label="โครงการที่ใบอนุญาตไม่ผ่านเกณฑ์" value={stats.bad} note="ระดับ สาขา หรือวันหมดอายุ" tone={stats.bad ? "neg" : undefined} onClick={() => setTab("licenses")} />
      </div>
      <Card className="ops-noprint mb-4">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { key: "reports", label: "รายงานการควบคุมงาน", count: reps.length },
            { key: "changes", label: "เปลี่ยนผู้ควบคุมงาน", count: chg.length },
            { key: "licenses", label: "ทะเบียนใบอนุญาต", count: lic.length },
            { key: "rules", label: "เกณฑ์ใบอนุญาต", count: s.rules.length },
          ]}
        />
      </Card>
      {tab === "reports" && <ReportsTab initProject={initProject} newKey={newKey} />}
      {tab === "changes" && <ChangesTab newKey={newKey} />}
      {tab === "licenses" && <LicensesTab newKey={newKey} />}
      {tab === "rules" && <RulesTab />}
    </>
  );
}

function useNew(key: number, open: () => void) {
  const [seen, setSeen] = useState(key);
  if (key !== seen) {
    setSeen(key);
    open();
  }
}

// ---------- supervision reports ----------

function ReportsTab({ initProject, newKey }: { initProject: string; newKey: number }) {
  const perms = useEngPerms();
  const all = supervisionReports.use();
  const [project, setProject] = useState(initProject);
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<SupervisionReport | "new" | null>(null);
  const [view, setView] = useState<string | null>(null);
  useNew(newKey, () => setEdit("new"));
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return all
      .filter((r) => (!project || r.projectId === project) && (!kind || r.kind === kind) && (!status || r.status === status))
      .filter((r) => !t || `${r.id} ${r.engineer} ${r.work} ${r.instructions} ${r.tests}`.toLowerCase().includes(t))
      .sort((a, b) => b.to.localeCompare(a.to) || b.id.localeCompare(a.id));
  }, [all, project, kind, status, q]);
  const viewing = view ? all.find((r) => r.id === view) : undefined;
  return (
    <>
      <Card className="ops-noprint mb-4">
        <div className="grid grid-cols-2 gap-3 px-4 py-3 lg:grid-cols-5">
          <SearchBox value={q} onChange={setQ} placeholder="เลขที่ ผู้ควบคุมงาน งานที่ตรวจ" className="col-span-2" />
          <FilterField label="โครงการ">
            <ProjectSelect value={project} onChange={setProject} />
          </FilterField>
          <FilterField label="ประเภท">
            <Select label="ประเภท" value={kind} onChange={setKind}>
              <option value="">ทั้งหมด</option>
              <option value="daily">รายวัน</option>
              <option value="weekly">รายสัปดาห์</option>
            </Select>
          </FilterField>
          <FilterField label="สถานะ">
            <Select label="สถานะ" value={status} onChange={setStatus}>
              <option value="">ทุกสถานะ</option>
              <option value="draft">รอลงนาม</option>
              <option value="signed">ลงนามแล้ว</option>
            </Select>
          </FilterField>
        </div>
      </Card>
      <Card className="ops-noprint">
        {rows.length === 0 ? (
          <Empty>ยังไม่มีรายงานการควบคุมงานตามตัวกรองนี้</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr>
                  <th className={th}>รายงาน</th>
                  <th className={th}>ช่วงวันที่</th>
                  <th className={th}>โครงการ</th>
                  <th className={th}>งานที่ตรวจ · ข้อสั่งการ</th>
                  <th className={th}>ผู้ควบคุมงาน</th>
                  <th className={th}>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={rowCls} onClick={() => setView(r.id)}>
                    <td className={td}>
                      <span className="font-mono text-[12px] text-accent-text">{r.id}</span>
                      <span className="block text-[12px] text-ink-3">{KIND_LABEL[r.kind]}</span>
                    </td>
                    <td className={cx(td, "num font-mono text-[13px]")}>{r.from === r.to ? thDate(r.from) : `${thDate(r.from)} – ${thDate(r.to)}`}</td>
                    <td className={cx(td, "text-[13px]")}>{pname(r.projectId)}</td>
                    <td className={cx(td, "text-[13px]")}>
                      <span className="block max-w-[360px] truncate">{r.work}</span>
                      <span className="block max-w-[360px] truncate text-[12px] text-ink-3">{r.instructions}</span>
                    </td>
                    <td className={cx(td, "text-[13px]")}>{r.engineer}</td>
                    <td className={td}>
                      <Pill tone={r.status === "signed" ? "pos" : "warn"}>{r.status === "signed" ? "ลงนามแล้ว" : "รอลงนาม"}</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {viewing && <ReportDetail r={viewing} onClose={() => setView(null)} onEdit={() => setEdit(viewing)} canEdit={perms.edit} />}
      {edit && <ReportForm init={edit === "new" ? undefined : edit} defaultProject={project} onClose={() => setEdit(null)} onSaved={setView} />}
    </>
  );
}

function ReportForm({ init, defaultProject, onClose, onSaved }: { init?: SupervisionReport; defaultProject?: string; onClose: () => void; onSaved: (id: string) => void }) {
  const lic = licensees.use();
  const diaries = siteDiaries.use();
  const engineers = lic.filter((l) => l.council === "coe");
  const [d, setD] = useState<SupervisionReport>(
    () =>
      init ?? {
        id: "",
        projectId: defaultProject ?? "",
        no: 0,
        kind: "daily",
        from: TODAY,
        to: TODAY,
        engineer: engineers[0]?.name ?? "",
        licenseeId: engineers[0]?.id,
        work: "",
        tests: "",
        instructions: "",
        diaryIds: [],
        photos: [],
        status: "draft",
      },
  );
  const set = <K extends keyof SupervisionReport>(k: K, v: SupervisionReport[K]) => setD((x) => ({ ...x, [k]: v }));
  const inRange = diaries.filter((x) => x.projectId === d.projectId && x.date >= d.from && x.date <= d.to).sort((a, b) => a.date.localeCompare(b.date));
  const ok = d.projectId && d.engineer.trim() && d.work.trim() && d.from <= d.to;
  const save = () => {
    if (!ok) return;
    let rec = d;
    if (!init) {
      const { id, no } = nextSeries(supervisionReports.all(), "SVR", d.projectId);
      rec = { ...d, id, no, progress: d.progress ?? getProject(d.projectId)?.actual };
    }
    supervisionReports.upsert(rec);
    onSaved(rec.id);
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={init ? `แก้ไข ${init.id}` : "รายงานการควบคุมงาน"}
      width={780}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!ok} onClick={save}>
            บันทึก
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {!init && (
          <Field label="โครงการ">
            <ProjectSelect value={d.projectId} onChange={(v) => set("projectId", v)} required />
          </Field>
        )}
        <Field label="ประเภทรายงาน">
          <Select
            label="ประเภทรายงาน"
            value={d.kind}
            onChange={(v) => setD((x) => ({ ...x, kind: v as SupervisionReport["kind"], from: v === "weekly" && x.from === x.to ? new Date(Date.parse(x.to) - 6 * 86400000).toISOString().slice(0, 10) : x.from }))}
          >
            <option value="daily">รายวัน</option>
            <option value="weekly">รายสัปดาห์</option>
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="ตั้งแต่วันที่">
            <input type="date" value={d.from} onChange={(e) => set("from", e.target.value)} className={cx(inputCls, "font-mono")} />
          </Field>
          <Field label="ถึงวันที่">
            <input type="date" value={d.to} onChange={(e) => set("to", e.target.value)} className={cx(inputCls, "font-mono")} />
          </Field>
        </div>
        <Field label="ผู้ควบคุมงาน">
          <Select
            label="ผู้ควบคุมงาน"
            value={d.licenseeId ?? ""}
            onChange={(v) => {
              const l = lic.find((x) => x.id === v);
              setD((x) => ({ ...x, licenseeId: v || undefined, engineer: l?.name ?? x.engineer }));
            }}
          >
            <option value="">ระบุชื่อเอง</option>
            {engineers.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} · {l.licenseNo}
              </option>
            ))}
          </Select>
        </Field>
        {!d.licenseeId && (
          <Field label="ชื่อผู้ควบคุมงาน">
            <input value={d.engineer} onChange={(e) => set("engineer", e.target.value)} list="eng-people" className={inputCls} />
          </Field>
        )}
        <Field label="ความคืบหน้าโดยรวม (%)">
          <input type="number" inputMode="decimal" value={d.progress ?? ""} onChange={(e) => set("progress", e.target.value === "" ? undefined : Number(e.target.value))} className={cx(inputCls, "font-mono")} placeholder={String(getProject(d.projectId)?.actual ?? "")} />
        </Field>
        <div className="sm:col-span-2">
          <SupervisionAssist
            projectId={d.projectId}
            from={d.from}
            to={d.to}
            engineer={d.engineer}
            onApply={(a, ids) => setD((x) => ({ ...x, work: a.work || x.work, tests: a.tests || x.tests, instructions: a.instructions || x.instructions, issues: a.issues || x.issues, diaryIds: [...new Set([...x.diaryIds, ...ids])] }))}
          />
        </div>
        <div className="sm:col-span-2">
          <Field label="งานที่ตรวจ">
            <Area value={d.work} onChange={(v) => set("work", v)} placeholder="งานที่เข้าตรวจในช่วงนี้ ตำแหน่ง ผลการตรวจ" />
          </Field>
        </div>
        <Field label="การทดสอบที่ร่วมเป็นพยาน">
          <Area value={d.tests} onChange={(v) => set("tests", v)} rows={2} />
        </Field>
        <Field label="ข้อสั่งการ / คำแนะนำ">
          <Area value={d.instructions} onChange={(v) => set("instructions", v)} rows={2} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="ปัญหาและอุปสรรค">
            <Area value={d.issues ?? ""} onChange={(v) => set("issues", v || undefined)} rows={2} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-[13px] text-ink-2">รายงานประจำวันหน้างานที่อ้างอิง</p>
          {inRange.length === 0 ? (
            <p className="text-[13px] text-ink-3">ไม่มีรายงานประจำวันของโครงการนี้ในช่วงวันที่ที่เลือก</p>
          ) : (
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {inRange.map((x) => (
                <label key={x.id} className="inline-flex items-center gap-2 text-[13px] text-ink-2">
                  <input
                    type="checkbox"
                    checked={d.diaryIds.includes(x.id)}
                    onChange={(e) => set("diaryIds", e.target.checked ? [...d.diaryIds, x.id] : d.diaryIds.filter((y) => y !== x.id))}
                    className="size-4 accent-[var(--ink)]"
                  />
                  <span className="font-mono text-[12px]">{thDate(x.date)}</span> {x.by}
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="sm:col-span-2">
          <MediaField label="รูปถ่ายประกอบ" value={d.photos} onChange={(photos) => set("photos", photos)} />
        </div>
      </div>
      <PeopleList />
    </Modal>
  );
}

function ReportDetail({ r, onClose, onEdit, canEdit }: { r: SupervisionReport; onClose: () => void; onEdit: () => void; canEdit: boolean }) {
  const lic = licensees.use();
  const diaries = siteDiaries.use();
  const [signing, setSigning] = useState(false);
  const p = getProject(r.projectId);
  const l = lic.find((x) => x.id === r.licenseeId);
  const refs = diaries.filter((x) => r.diaryIds.includes(x.id));
  const period = r.from === r.to ? thDate(r.from) : `${thDate(r.from)} – ${thDate(r.to)}`;
  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={`${r.id} · รายงาน${KIND_LABEL[r.kind]}`}
        width={800}
        footer={
          <>
            <Btn onClick={() => window.print()}>
              <Printer {...I} />
              พิมพ์รายงาน
            </Btn>
            {canEdit && (
              <Btn onClick={onEdit}>
                <Pencil {...I} />
                แก้ไข
              </Btn>
            )}
            {canEdit && r.status === "draft" && (
              <Btn primary onClick={() => setSigning(true)}>
                ลงนามรับรองรายงาน
              </Btn>
            )}
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 sm:gap-x-6">
          <KV k="โครงการ">{p?.name ?? r.projectId}</KV>
          <KV k="ช่วงวันที่">{period}</KV>
          <KV k="ผู้ควบคุมงาน">{r.engineer}</KV>
          <KV k="ใบอนุญาต">{l ? `${levelName(l.council, l.level)} ${l.branch} · ${l.licenseNo}` : "–"}</KV>
          <KV k="ความคืบหน้า">{r.progress !== undefined ? `${r.progress}%` : "–"}</KV>
          <KV k="สถานะ">{r.status === "signed" ? `ลงนามแล้ว · ${r.signedAt ? thDT(r.signedAt) : ""}` : "รอลงนาม"}</KV>
          <KV k="งานที่ตรวจ" wide>
            <span className="whitespace-pre-line">{r.work}</span>
          </KV>
          <KV k="การทดสอบ" wide>
            <span className="whitespace-pre-line">{r.tests || "–"}</span>
          </KV>
          <KV k="ข้อสั่งการ" wide>
            <span className="whitespace-pre-line">{r.instructions || "–"}</span>
          </KV>
          <KV k="ปัญหาอุปสรรค" wide>
            <span className="whitespace-pre-line">{r.issues || "–"}</span>
          </KV>
          <KV k="รายงานประจำวัน" wide>
            {refs.length ? refs.map((x) => thDate(x.date)).join(", ") : "–"}
          </KV>
        </div>
        <MediaStrip refs={r.photos} className="mt-3" />
        {signing && (
          <div className="mt-4 rounded-[10px] border border-line p-3">
            <p className="mb-2 text-[14px] font-medium">ลงนามผู้ควบคุมงาน</p>
            <SignaturePad
              onSave={(sig, signer) => {
                supervisionReports.upsert({ ...r, signature: sig, signedBy: signer, signedAt: nowIso(), status: "signed" });
                setSigning(false);
              }}
            />
          </div>
        )}
      </Modal>

      <article className="ops-print hidden bg-white text-ink print:block">
        <DocHeader title="รายงานการควบคุมงานก่อสร้าง" titleEn="CONSTRUCTION SUPERVISION REPORT" code={r.id} meta={<p>{`รายงาน${KIND_LABEL[r.kind]} · ${period}`}</p>} />
        <DocSection n={1} title="ข้อมูลโครงการและผู้ควบคุมงาน" en="PROJECT & SUPERVISOR">
          <div className="grid grid-cols-2 gap-x-6">
            <DocRow k="โครงการ">
              {r.projectId} · {p?.name}
            </DocRow>
            <DocRow k="เจ้าของอาคาร">{p?.owner}</DocRow>
            <DocRow k="ที่ตั้ง">{p?.address ?? p?.province}</DocRow>
            <DocRow k="ผู้รับจ้าง">{COMPANY_INFO.name}</DocRow>
            <DocRow k="ผู้ควบคุมงาน">{r.engineer}</DocRow>
            <DocRow k="ใบอนุญาต">{l ? `${levelName(l.council, l.level)} สาขา${l.branch} เลขที่ ${l.licenseNo}` : "–"}</DocRow>
            <DocRow k="ช่วงรายงาน">{period}</DocRow>
            <DocRow k="ความคืบหน้า">{r.progress !== undefined ? `${r.progress}%` : "–"}</DocRow>
          </div>
        </DocSection>
        <DocSection n={2} title="งานที่ตรวจ" en="WORK INSPECTED">
          <p className="whitespace-pre-line text-[13px]">{r.work}</p>
        </DocSection>
        <DocSection n={3} title="การทดสอบที่ร่วมเป็นพยาน" en="TESTS WITNESSED">
          <p className="whitespace-pre-line text-[13px]">{r.tests || "–"}</p>
        </DocSection>
        <DocSection n={4} title="ข้อสั่งการและคำแนะนำ" en="INSTRUCTIONS">
          <p className="whitespace-pre-line text-[13px]">{r.instructions || "–"}</p>
        </DocSection>
        <DocSection n={5} title="ปัญหาและอุปสรรค" en="ISSUES">
          <p className="whitespace-pre-line text-[13px]">{r.issues || "–"}</p>
          {refs.length > 0 && <p className="mt-1 text-[12px] text-ink-3">อ้างอิงรายงานประจำวัน {refs.map((x) => thDate(x.date)).join(", ")}</p>}
        </DocSection>
        {r.photos.length > 0 && (
          <DocSection n={6} title="รูปถ่ายประกอบ" en="PHOTOS">
            <MediaStrip refs={r.photos} size={120} />
          </DocSection>
        )}
        <div className="avoid-break mt-10 grid grid-cols-2 gap-8">
          <SigImg role="ผู้ควบคุมงาน" sig={r.signature} name={r.signedBy ?? r.engineer} date={r.signedAt} />
          <SigImg role="ผู้จัดการโครงการ (ผู้รับจ้าง)" name={p?.pm} />
        </div>
      </article>
    </>
  );
}

// ---------- change of supervising engineer ----------

function ChangesTab({ newKey }: { newKey: number }) {
  const perms = useEngPerms();
  const all = supervisorChanges.use();
  const [project, setProject] = useState("");
  const [edit, setEdit] = useState<SupervisorChange | "new" | null>(null);
  const [print, setPrint] = useState<string | null>(null);
  useNew(newKey, () => setEdit("new"));
  const rows = all.filter((c) => !project || c.projectId === project).sort((a, b) => b.date.localeCompare(a.date));
  const printing = print ? all.find((c) => c.id === print) : undefined;
  return (
    <>
      <Card className="ops-noprint mb-4">
        <div className="grid grid-cols-2 gap-3 px-4 py-3 lg:grid-cols-5">
          <FilterField label="โครงการ" className="col-span-2">
            <ProjectSelect value={project} onChange={setProject} />
          </FilterField>
          <p className="col-span-2 self-end text-[12px] text-ink-3 lg:col-span-3">
            เมื่อเปลี่ยนผู้ควบคุมงาน ต้องแจ้งเจ้าพนักงานท้องถิ่นเป็นหนังสือ พร้อมหนังสือแสดงความยินยอมของผู้ควบคุมงานคนใหม่ <CheckNote>ตรวจสอบแบบฟอร์มและระยะเวลาที่ท้องถิ่นกำหนด</CheckNote>
          </p>
        </div>
      </Card>
      <Card className="ops-noprint">
        {rows.length === 0 ? (
          <Empty>ยังไม่มีการเปลี่ยนผู้ควบคุมงาน</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead>
                <tr>
                  <th className={th}>วันที่เปลี่ยน</th>
                  <th className={th}>โครงการ</th>
                  <th className={th}>ผู้ควบคุมงานเดิม → ใหม่</th>
                  <th className={th}>เหตุผล</th>
                  <th className={th}>แจ้งท้องถิ่น</th>
                  <th className={th} />
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-t border-line">
                    <td className={cx(td, "num font-mono text-[13px]")}>{thDate(c.date)}</td>
                    <td className={cx(td, "text-[13px]")}>{pname(c.projectId)}</td>
                    <td className={cx(td, "text-[13px]")}>
                      {c.fromName} → {c.toName}
                    </td>
                    <td className={cx(td, "max-w-[280px] text-[13px]")}>{c.reason}</td>
                    <td className={cx(td, "text-[13px]")}>
                      {c.notifiedAt ? (
                        <>
                          <Pill tone="pos">แจ้งแล้ว</Pill>
                          <span className="mt-1 block text-[12px] text-ink-3">
                            {thDate(c.notifiedAt)} {c.letterNo && `· ${c.letterNo}`}
                          </span>
                        </>
                      ) : (
                        <Pill tone="neg">ยังไม่แจ้ง</Pill>
                      )}
                      <span className="block text-[12px] text-ink-3">{c.authority}</span>
                    </td>
                    <td className={cx(td, "whitespace-nowrap")}>
                      <span className="flex gap-1">
                        <Btn
                          small
                          onClick={() => {
                            setPrint(c.id);
                            setTimeout(() => window.print(), 50);
                          }}
                        >
                          <Printer {...I} />
                          หนังสือแจ้ง
                        </Btn>
                        {perms.edit && (
                          <Btn small onClick={() => setEdit(c)}>
                            <Pencil {...I} />
                          </Btn>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {edit && <ChangeForm init={edit === "new" ? undefined : edit} defaultProject={project} onClose={() => setEdit(null)} />}
      {printing && <ChangeLetter c={printing} />}
    </>
  );
}

function ChangeForm({ init, defaultProject, onClose }: { init?: SupervisorChange; defaultProject: string; onClose: () => void }) {
  const lic = licensees.use();
  const pl = projectLicensing.use();
  const [d, setD] = useState<SupervisorChange>(() => {
    if (init) return init;
    const pid = defaultProject;
    const cur = lic.find((l) => l.id === pl.find((x) => x.projectId === pid)?.assigned.supervise);
    return { id: "", projectId: pid, date: TODAY, fromName: cur?.name ?? "", toName: "", reason: "", authority: "" };
  });
  const set = <K extends keyof SupervisorChange>(k: K, v: SupervisorChange[K]) => setD((x) => ({ ...x, [k]: v }));
  const [assign, setAssign] = useState(true);
  const ok = d.projectId && d.fromName.trim() && d.toName.trim() && d.reason.trim();
  const save = () => {
    if (!ok) return;
    let id = d.id;
    if (!id) {
      const head = `SVC-${d.projectId}-`;
      const max = supervisorChanges
        .all()
        .filter((x) => x.id.startsWith(head))
        .reduce((m, x) => Math.max(m, Number(x.id.slice(head.length)) || 0), 0);
      id = `${head}${max + 1}`;
    }
    supervisorChanges.upsert({ ...d, id, authority: d.authority.trim() || "เจ้าพนักงานท้องถิ่น" });
    if (assign && d.toLicenseeId) {
      const cur = pl.find((x) => x.projectId === d.projectId);
      projectLicensing.upsert({ id: d.projectId, projectId: d.projectId, ...cur, assigned: { ...cur?.assigned, supervise: d.toLicenseeId } });
    }
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={init ? "แก้ไขการเปลี่ยนผู้ควบคุมงาน" : "บันทึกการเปลี่ยนผู้ควบคุมงาน"}
      width={680}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!ok} onClick={save}>
            บันทึก
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {!init && (
          <Field label="โครงการ">
            <ProjectSelect
              value={d.projectId}
              onChange={(v) => {
                const cur = lic.find((l) => l.id === pl.find((x) => x.projectId === v)?.assigned.supervise);
                setD((x) => ({ ...x, projectId: v, fromName: cur?.name ?? x.fromName }));
              }}
              required
            />
          </Field>
        )}
        <Field label="วันที่มีผล">
          <input type="date" value={d.date} onChange={(e) => set("date", e.target.value)} className={cx(inputCls, "font-mono")} />
        </Field>
        <Field label="ผู้ควบคุมงานเดิม">
          <input value={d.fromName} onChange={(e) => set("fromName", e.target.value)} className={inputCls} />
        </Field>
        <Field label="ผู้ควบคุมงานใหม่">
          <Select
            label="ผู้ควบคุมงานใหม่"
            value={d.toLicenseeId ?? ""}
            onChange={(v) => {
              const l = lic.find((x) => x.id === v);
              setD((x) => ({ ...x, toLicenseeId: v || undefined, toName: l?.name ?? x.toName }));
            }}
          >
            <option value="">เลือกจากทะเบียนใบอนุญาต</option>
            {lic
              .filter((l) => l.council === "coe")
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} · {levelName(l.council, l.level)} {l.branch}
                </option>
              ))}
          </Select>
        </Field>
        {!d.toLicenseeId && (
          <Field label="ชื่อผู้ควบคุมงานใหม่">
            <input value={d.toName} onChange={(e) => set("toName", e.target.value)} className={inputCls} />
          </Field>
        )}
        <div className="sm:col-span-2">
          <Field label="เหตุผล">
            <Area value={d.reason} onChange={(v) => set("reason", v)} rows={2} />
          </Field>
        </div>
        <Field label="เจ้าพนักงานท้องถิ่น">
          <input value={d.authority} onChange={(e) => set("authority", e.target.value)} className={inputCls} placeholder="เช่น สำนักงานเขตลาดพร้าว / เทศบาล / อบต." />
        </Field>
        <Field label="วันที่แจ้ง">
          <input type="date" value={d.notifiedAt ?? ""} onChange={(e) => set("notifiedAt", e.target.value || undefined)} className={cx(inputCls, "font-mono")} />
        </Field>
        <Field label="เลขที่หนังสือ">
          <input value={d.letterNo ?? ""} onChange={(e) => set("letterNo", e.target.value || undefined)} className={inputCls} />
        </Field>
        {d.toLicenseeId && !init && (
          <label className="inline-flex items-center gap-2 self-end text-[13px] text-ink-2">
            <input type="checkbox" checked={assign} onChange={(e) => setAssign(e.target.checked)} className="size-4 accent-[var(--ink)]" />
            ตั้งเป็นผู้ควบคุมงานของโครงการในทะเบียนใบอนุญาต
          </label>
        )}
      </div>
    </Modal>
  );
}

function ChangeLetter({ c }: { c: SupervisorChange }) {
  const lic = licensees.use();
  const p = getProject(c.projectId);
  const n = lic.find((x) => x.id === c.toLicenseeId);
  return (
    <article className="ops-print hidden bg-white text-[14px] leading-[26px] text-ink print:block">
      <DocHeader title="หนังสือแจ้งการเปลี่ยนผู้ควบคุมงาน" titleEn="NOTICE OF CHANGE OF SUPERVISING ENGINEER" code={c.letterNo ?? c.id} meta={<p>วันที่ {thDate(c.notifiedAt ?? TODAY)}</p>} />
      <div className="mt-6">
        <p>เรื่อง แจ้งการเปลี่ยนผู้ควบคุมงานก่อสร้างอาคาร</p>
        <p>เรียน เจ้าพนักงานท้องถิ่น {c.authority}</p>
        <p className="mt-4 indent-12">
          ตามที่ได้รับอนุญาตให้ก่อสร้างอาคาร โครงการ {p?.name ?? c.projectId} ({c.projectId}) เจ้าของอาคาร {p?.owner} ตั้งอยู่ที่ {p?.address ?? p?.province} โดยมี {c.fromName} เป็นผู้ควบคุมงาน
          นั้น บัดนี้ได้เปลี่ยนผู้ควบคุมงานเป็น {c.toName}
          {n ? ` ผู้ได้รับใบอนุญาตประกอบวิชาชีพ${levelName(n.council, n.level)} สาขา${n.branch} เลขทะเบียน ${n.licenseNo} (${COUNCIL_LABEL[n.council]}) ใบอนุญาตใช้ได้ถึงวันที่ ${thDate(n.expiry)}` : ""} ตั้งแต่วันที่ {thDate(c.date)} เป็นต้นไป
        </p>
        <p className="indent-12">เหตุผลในการเปลี่ยน: {c.reason}</p>
        <p className="indent-12">จึงเรียนมาเพื่อโปรดทราบ พร้อมนี้ได้แนบหนังสือแสดงความยินยอมของผู้ควบคุมงานคนใหม่ และสำเนาใบอนุญาตประกอบวิชาชีพมาด้วยแล้ว</p>
      </div>
      <div className="avoid-break mt-12 grid grid-cols-3 gap-8">
        <SigImg role="เจ้าของอาคาร / ผู้ได้รับอนุญาต" name={p?.owner} />
        <SigImg role="ผู้ควบคุมงานเดิม" name={c.fromName} />
        <SigImg role="ผู้ควบคุมงานใหม่ (ยินยอม)" name={c.toName} />
      </div>
      <p className="mt-8 text-[11px] text-ink-3">ตรวจสอบแบบฟอร์มและเอกสารประกอบที่เจ้าพนักงานท้องถิ่นกำหนดก่อนยื่น · จัดทำโดย {COMPANY_INFO.name}</p>
    </article>
  );
}

