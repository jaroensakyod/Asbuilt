"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Pencil, Plus, Save, Search, Trash2 } from "lucide-react";
import { Card, CardHead, cx, Dot, Field, inputCls, PageHeader } from "@/components/ui";
import { Btn, Empty, FilterField, I, IconBtn, Modal, Pill, Select, StatCard, type Tone } from "@/components/ops/bits";
import { MediaField, MediaStrip } from "@/components/media/media-field";
import { thDate, TODAY } from "@/lib/data";
import { addDays } from "@/lib/hr/payroll";
import { ACTIVE_SITES } from "@/lib/hr/seed";
import { employees } from "@/lib/hr/store";
import { migrantDocs, trainings, workerSkills } from "@/lib/hr/labour-store";
import { CERT_KEYS, CERT_LABEL, CERT_SHORT, CERT_VALID_YEARS, LEVEL_LABEL, MATRIX_CERTS, MIGRANT_DOC_LABEL, type CertKey, type MigrantDoc, type MigrantDocKind, type TrainingRecord, type WorkerSkills } from "@/lib/hr/labour-types";
import { NATIONALITY_LABEL, SKILLS, type Employee } from "@/lib/hr/types";
import { Drawer, HrTabs, Section, siteName, SubTabs, useHrAccess } from "./bits";

type Tab = "matrix" | "training" | "docs" | "expiring";
type State = "ok" | "expiring" | "expired" | "none";
const STATE_TONE: Record<State, Tone> = { ok: "pos", expiring: "warn", expired: "neg", none: "neutral" };
const STATE_LABEL: Record<State, string> = { ok: "ใช้ได้", expiring: "ใกล้หมด", expired: "หมดอายุ", none: "-" };
const daysTo = (iso: string) => Math.round((Date.parse(iso) - Date.parse(TODAY)) / 86400000);
const stateOf = (expiry?: string, warn = 30): State => {
  if (!expiry) return "ok";
  const d = daysTo(expiry);
  return d < 0 ? "expired" : d <= warn ? "expiring" : "ok";
};
const dueLabel = (expiry?: string) => {
  if (!expiry) return "ไม่มีวันหมดอายุ";
  const d = daysTo(expiry);
  return d < 0 ? `หมดแล้ว ${-d} วัน` : d === 0 ? "หมดวันนี้" : `อีก ${d} วัน`;
};
const addYears = (iso: string, y: number) => addDays(iso, Math.round(y * 365.25));
/** latest record of a certificate per person (no expiry counts as latest) */
const latest = (list: TrainingRecord[], employeeId: string, cert: CertKey) => list.filter((t) => t.employeeId === employeeId && t.cert === cert).sort((a, b) => (b.expiry ?? "9999").localeCompare(a.expiry ?? "9999"))[0];
const MIGRANT_COLS: MigrantDocKind[] = ["passport", "pink_card", "visa", "work_permit", "report_90", "health"];
const DOC_SHORT: Record<MigrantDocKind, string> = { passport: "พาสปอร์ต", pink_card: "บัตรชมพู", visa: "วีซ่า", work_permit: "ใบอนุญาตทำงาน", report_90: "รายงานตัว 90 วัน", health: "ใบรับรองแพทย์" };

export function SkillsView() {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const q = params.get("q") ?? "";
  const tab = (params.get("tab") as Tab | null) ?? "matrix";
  const setTab = (t: Tab) => router.push(t === "matrix" ? path : `${path}?tab=${t}`);
  const [openId, setOpenId] = useState<string | null>(q && tab === "matrix" ? q : null);
  const [editTrn, setEditTrn] = useState<Partial<TrainingRecord> | null>(null);
  const [editDoc, setEditDoc] = useState<{ emp: Employee; kind: MigrantDocKind; doc?: MigrantDoc } | null>(null);
  const emps = employees.use();
  const trn = trainings.use();
  const docs = migrantDocs.use();
  const expiring = useExpiring();

  return (
    <>
      <PageHeader eyebrow="บุคคล" title="ทักษะ & ใบรับรอง" sub="ทักษะช่างและใบรับรองตามกฎหมาย (ปั้นจั่น นั่งร้าน ที่อับอากาศ ที่สูง ช่างไฟฟ้า จป.) ประวัติการอบรม และเอกสารแรงงานต่างด้าวพร้อมวันหมดอายุ" />
      <HrTabs />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="ใบรับรองที่ใช้ได้" value={trn.filter((t) => stateOf(t.expiry) !== "expired" && emps.some((e) => e.id === t.employeeId && e.status !== "resigned")).length} unit="ใบ" />
        <StatCard label="หมดอายุใน 30 วัน" value={expiring.filter((x) => x.d >= 0 && x.d <= 30).length} unit="รายการ" tone={expiring.some((x) => x.d >= 0 && x.d <= 30) ? "neg" : undefined} onClick={() => setTab("expiring")} />
        <StatCard label="หมดอายุแล้ว" value={expiring.filter((x) => x.d < 0).length} unit="รายการ" onClick={() => setTab("expiring")} />
        <StatCard label="แรงงานต่างด้าว" value={emps.filter((e) => e.type === "daily" && e.nationality !== "TH" && e.status !== "resigned").length} unit="คน" note={`เอกสาร ${docs.length} ฉบับ`} onClick={() => setTab("docs")} />
      </div>
      <div className="mb-5">
        <SubTabs
          value={tab}
          onChange={setTab}
          options={[
            { key: "matrix", label: "เมทริกซ์ทักษะ" },
            { key: "training", label: "ใบรับรอง/การอบรม" },
            { key: "docs", label: "เอกสารแรงงานต่างด้าว" },
            { key: "expiring", label: "ใกล้หมดอายุ", count: expiring.filter((x) => x.d <= 30).length || undefined },
          ]}
        />
      </div>
      {tab === "matrix" && <Matrix q={q} onOpen={setOpenId} />}
      {tab === "training" && <Trainings q={q} onEdit={setEditTrn} onOpen={setOpenId} />}
      {tab === "docs" && <Docs q={q} onEdit={(emp, kind, doc) => setEditDoc({ emp, kind, doc })} onOpen={setOpenId} />}
      {tab === "expiring" && <Expiring items={expiring} onOpen={setOpenId} />}

      {openId && <WorkerDrawer id={openId} onClose={() => setOpenId(null)} onEditTrn={setEditTrn} onEditDoc={(emp, kind, doc) => setEditDoc({ emp, kind, doc })} />}
      {editTrn && <TrainingForm init={editTrn} onClose={() => setEditTrn(null)} />}
      {editDoc && <DocForm {...editDoc} onClose={() => setEditDoc(null)} />}
    </>
  );
}

// ---------------- matrix ----------------

function useWorkers() {
  const emps = employees.use();
  return useMemo(() => emps.filter((e) => e.status !== "resigned" && (e.type === "daily" || (e.type === "monthly" && e.projectId))), [emps]);
}

function Matrix({ q, onOpen }: { q: string; onOpen: (id: string) => void }) {
  const workers = useWorkers();
  const trn = trainings.use();
  const skills = workerSkills.use();
  const [site, setSite] = useState("");
  const [trade, setTrade] = useState("");
  const [cert, setCert] = useState("");
  const [text, setText] = useState(q);
  const skillOf = useMemo(() => new Map(skills.map((s) => [s.employeeId, s])), [skills]);
  const trades = useMemo(() => [...new Set(skills.flatMap((s) => s.trades.map((t) => t.trade)))].sort((a, b) => a.localeCompare(b, "th")), [skills]);
  const rows = workers.filter((e) => {
    if (site && e.projectId !== site) return false;
    if (trade && !skillOf.get(e.id)?.trades.some((t) => t.trade === trade)) return false;
    if (cert && !trn.some((t) => t.employeeId === e.id && t.cert === cert && stateOf(t.expiry) !== "expired")) return false;
    const s = text.trim().toLowerCase();
    return !s || e.name.toLowerCase().includes(s) || e.id.toLowerCase().includes(s);
  });
  const coverage = MATRIX_CERTS.map((c) => rows.filter((e) => {
    const t = latest(trn, e.id, c);
    return t && stateOf(t.expiry) !== "expired";
  }).length);

  return (
    <Card>
      <div className="flex flex-wrap items-end gap-3 border-b border-line px-5 py-4">
        <FilterField label="หน้างาน" className="w-full sm:w-[240px]">
          <Select label="หน้างาน" value={site} onChange={setSite}>
            <option value="">ทุกหน้างาน</option>
            {ACTIVE_SITES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} · {p.name}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="ทักษะ" className="w-[160px]">
          <Select label="ทักษะ" value={trade} onChange={setTrade}>
            <option value="">ทุกทักษะ</option>
            {trades.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="มีใบรับรอง" className="w-[200px]">
          <Select label="มีใบรับรอง" value={cert} onChange={setCert}>
            <option value="">ไม่กรอง</option>
            {CERT_KEYS.filter((c) => c !== "other").map((c) => (
              <option key={c} value={c}>
                {CERT_LABEL[c]}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="ค้นหา" className="min-w-[180px] flex-1">
          <div className="relative">
            <Search {...I} className="absolute left-2.5 top-2.5 text-ink-3" />
            <input className={cx(inputCls, "w-full pl-8")} value={text} onChange={(e) => setText(e.target.value)} placeholder="ชื่อหรือรหัสพนักงาน" />
          </div>
        </FilterField>
      </div>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-ink-3">
                <th className="px-5 py-2 font-normal">พนักงาน</th>
                <th className="px-3 py-2 font-normal">หน้างาน</th>
                <th className="px-3 py-2 font-normal">ทักษะ (ระดับ)</th>
                {MATRIX_CERTS.map((c, i) => (
                  <th key={c} className="w-[64px] px-1 py-2 text-center text-[11px] font-normal leading-tight" title={CERT_LABEL[c]}>
                    {CERT_SHORT[c]}
                    <span className="block font-mono text-ink-3">{coverage[i]}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className={cx("cursor-pointer border-b border-line transition-colors duration-150 last:border-0 hover:bg-raised/60", q === e.id && "bg-accent-soft/40")} onClick={() => onOpen(e.id)}>
                  <td className="px-5 py-1.5">
                    <span className="block">{e.name}</span>
                    <span className="font-mono text-[12px] text-ink-3">
                      {e.id} · {NATIONALITY_LABEL[e.nationality]}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 font-mono text-[12px] text-ink-2">{e.projectId}</td>
                  <td className="px-3 py-1.5">
                    <div className="flex flex-wrap gap-1">
                      {(skillOf.get(e.id)?.trades ?? (e.skill ? [{ trade: e.skill, level: 2 as const }] : [{ trade: e.position, level: 2 as const }])).map((t) => (
                        <Pill key={t.trade} tone={t.level === 3 ? "accent" : "neutral"}>
                          {t.trade} {t.level}
                        </Pill>
                      ))}
                    </div>
                  </td>
                  {MATRIX_CERTS.map((c) => {
                    const t = latest(trn, e.id, c);
                    const st: State = t ? stateOf(t.expiry) : "none";
                    return (
                      <td key={c} className="px-1 py-1.5 text-center" title={t ? `${CERT_LABEL[c]} · ${dueLabel(t.expiry)}` : undefined}>
                        {st === "none" ? <span className="text-line-strong">·</span> : <Dot tone={STATE_TONE[st]} />}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>ไม่พบพนักงานตามตัวกรอง</Empty>
      )}
      <p className="border-t border-line px-5 py-2.5 text-[12px] text-ink-3">จุดเขียว = ใบรับรองใช้ได้ · เหลือง = หมดอายุภายใน 30 วัน · แดง = หมดอายุแล้ว · ระดับทักษะ 1 ฝึกหัด 2 ฝีมือ 3 หัวหน้าช่าง · คลิกแถวเพื่อดูประวัติและแก้ไข</p>
    </Card>
  );
}

function WorkerDrawer({ id, onClose, onEditTrn, onEditDoc }: { id: string; onClose: () => void; onEditTrn: (t: Partial<TrainingRecord>) => void; onEditDoc: (e: Employee, kind: MigrantDocKind, doc?: MigrantDoc) => void }) {
  const e = employees.use().find((x) => x.id === id);
  const trn = trainings.use().filter((t) => t.employeeId === id);
  const docs = migrantDocs.use().filter((d) => d.employeeId === id);
  const sk = workerSkills.use().find((s) => s.employeeId === id);
  const { edit } = useHrAccess();
  if (!e) return null;
  return (
    <Drawer
      open
      onClose={onClose}
      title={
        <>
          <p className="font-mono text-[12px] text-ink-3">{e.id}</p>
          <p className="text-[17px]">{e.name}</p>
          <p className="text-[13px] text-ink-2">
            {e.skill ?? e.position} · {NATIONALITY_LABEL[e.nationality]} · {siteName(e.projectId)}
          </p>
        </>
      }
    >
      <SkillsEditor key={sk?.id ?? id} employeeId={id} value={sk} canEdit={edit} fallback={e.skill} />
      <Section
        title="ใบรับรองและการอบรม"
        action={
          edit && (
            <Btn small onClick={() => onEditTrn({ employeeId: id })}>
              <Plus {...I} />
              เพิ่ม
            </Btn>
          )
        }
      >
        {trn.length ? (
          <ul className="rounded-[10px] border border-line">
            {trn
              .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
              .map((t) => {
                const st = stateOf(t.expiry);
                return (
                  <li key={t.id} className="flex items-start gap-3 border-b border-line px-3 py-2 text-[13px] last:border-0">
                    <div className="min-w-0 flex-1">
                      <p>{CERT_LABEL[t.cert]}</p>
                      <p className="text-[12px] text-ink-3">
                        {t.provider} · ออก {thDate(t.issuedAt)}
                        {t.certNo && ` · ${t.certNo}`}
                      </p>
                      <MediaStrip refs={t.attachments} size={36} className="mt-1" />
                    </div>
                    <div className="text-right">
                      <Pill tone={STATE_TONE[st]}>{STATE_LABEL[st]}</Pill>
                      <p className="mt-0.5 text-[12px] text-ink-3">{t.expiry ? thDate(t.expiry) : "ไม่หมดอายุ"}</p>
                    </div>
                    {edit && (
                      <IconBtn label="แก้ไข" onClick={() => onEditTrn(t)}>
                        <Pencil {...I} />
                      </IconBtn>
                    )}
                  </li>
                );
              })}
          </ul>
        ) : (
          <p className="text-[13px] text-ink-3">ยังไม่มีประวัติการอบรม</p>
        )}
      </Section>
      {e.nationality !== "TH" && (
        <Section title="เอกสารแรงงานต่างด้าว">
          <ul className="rounded-[10px] border border-line">
            {MIGRANT_COLS.map((kind) => {
              const doc = kind === "work_permit" ? undefined : docs.filter((d) => d.kind === kind).sort((a, b) => b.expiry.localeCompare(a.expiry))[0];
              const expiry = kind === "work_permit" ? e.workPermitExpiry : doc?.expiry;
              const no = kind === "work_permit" ? e.workPermitNo : doc?.no;
              if (!expiry && (kind === "pink_card" || kind === "health")) return null;
              const st: State = expiry ? stateOf(expiry) : "none";
              return (
                <li key={kind} className="flex items-center gap-3 border-b border-line px-3 py-2 text-[13px] last:border-0">
                  <div className="min-w-0 flex-1">
                    <p>{DOC_SHORT[kind]}</p>
                    <p className="font-mono text-[12px] text-ink-3">{no ?? "ยังไม่บันทึก"}</p>
                  </div>
                  <div className="text-right">
                    {expiry ? <Pill tone={STATE_TONE[st]}>{dueLabel(expiry)}</Pill> : <Pill>ไม่มีข้อมูล</Pill>}
                    {expiry && <p className="mt-0.5 text-[12px] text-ink-3">{thDate(expiry)}</p>}
                  </div>
                  {edit && (
                    <IconBtn label="แก้ไข" onClick={() => onEditDoc(e, kind, doc)}>
                      <Pencil {...I} />
                    </IconBtn>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>
      )}
    </Drawer>
  );
}

function SkillsEditor({ employeeId, value, canEdit, fallback }: { employeeId: string; value?: WorkerSkills; canEdit: boolean; fallback?: string }) {
  const [rows, setRows] = useState<WorkerSkills["trades"]>(() => value?.trades ?? (fallback ? [{ trade: fallback, level: 2 }] : []));
  const [dirty, setDirty] = useState(false);
  const set = (next: WorkerSkills["trades"]) => (setRows(next), setDirty(true));
  const unused = SKILLS.filter((s) => !rows.some((r) => r.trade === s));
  return (
    <Section
      title="ทักษะช่าง"
      action={
        canEdit &&
        dirty && (
          <Btn small primary onClick={() => (workerSkills.upsert({ id: `SKL-${employeeId}`, employeeId, trades: rows }), setDirty(false))}>
            <Save {...I} />
            บันทึก
          </Btn>
        )
      }
    >
      <div className="flex flex-col gap-1.5">
        {rows.map((r, i) => (
          <div key={r.trade} className="flex items-center gap-2 text-[13px]">
            <span className="flex-1">{r.trade}</span>
            <select disabled={!canEdit} className={cx(inputCls, "h-8 w-[150px]")} value={r.level} aria-label={`ระดับ ${r.trade}`} onChange={(e) => set(rows.map((x, j) => (j === i ? { ...x, level: Number(e.target.value) as 1 | 2 | 3 } : x)))}>
              {([1, 2, 3] as const).map((l) => (
                <option key={l} value={l}>
                  {l} · {LEVEL_LABEL[l]}
                </option>
              ))}
            </select>
            {canEdit && (
              <IconBtn label="ลบ" danger onClick={() => set(rows.filter((_, j) => j !== i))}>
                <Trash2 {...I} />
              </IconBtn>
            )}
          </div>
        ))}
        {!rows.length && <p className="text-[13px] text-ink-3">ยังไม่ระบุทักษะ</p>}
        {canEdit && unused.length > 0 && (
          <select className={cx(inputCls, "h-8 w-full sm:w-[220px]")} value="" aria-label="เพิ่มทักษะ" onChange={(e) => e.target.value && set([...rows, { trade: e.target.value, level: 1 }])}>
            <option value="">+ เพิ่มทักษะ</option>
            {unused.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
      </div>
    </Section>
  );
}

// ---------------- trainings ----------------

function Trainings({ q, onEdit, onOpen }: { q: string; onEdit: (t: Partial<TrainingRecord>) => void; onOpen: (id: string) => void }) {
  const trn = trainings.use();
  const emps = employees.use();
  const { edit } = useHrAccess();
  const [cert, setCert] = useState("");
  const [state, setState] = useState<"" | State>("");
  const [text, setText] = useState(q);
  const byId = useMemo(() => new Map(emps.map((e) => [e.id, e])), [emps]);
  const rows = trn
    .filter((t) => {
      const e = byId.get(t.employeeId);
      if (!e || e.status === "resigned") return false;
      if (cert && t.cert !== cert) return false;
      if (state && stateOf(t.expiry) !== state) return false;
      const s = text.trim().toLowerCase();
      return !s || e.name.toLowerCase().includes(s) || e.id.toLowerCase().includes(s) || (t.certNo ?? "").toLowerCase().includes(s);
    })
    .sort((a, b) => (a.expiry ?? "9999").localeCompare(b.expiry ?? "9999"));
  return (
    <Card>
      <div className="flex flex-wrap items-end gap-3 border-b border-line px-5 py-4">
        <FilterField label="ใบรับรอง" className="w-[240px]">
          <Select label="ใบรับรอง" value={cert} onChange={setCert}>
            <option value="">ทั้งหมด</option>
            {CERT_KEYS.map((c) => (
              <option key={c} value={c}>
                {CERT_LABEL[c]}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="สถานะ" className="w-[150px]">
          <Select label="สถานะ" value={state} onChange={(v) => setState(v as "" | State)}>
            <option value="">ทั้งหมด</option>
            <option value="ok">ใช้ได้</option>
            <option value="expiring">ใกล้หมด (30 วัน)</option>
            <option value="expired">หมดอายุ</option>
          </Select>
        </FilterField>
        <FilterField label="ค้นหา" className="min-w-[180px] flex-1">
          <input className={inputCls} value={text} onChange={(e) => setText(e.target.value)} placeholder="ชื่อ รหัส หรือเลขที่ใบรับรอง" />
        </FilterField>
        {edit && (
          <Btn primary onClick={() => onEdit({})}>
            <Plus {...I} />
            บันทึกการอบรม
          </Btn>
        )}
      </div>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-ink-3">
                <th className="px-5 py-2 font-normal">พนักงาน</th>
                <th className="px-3 py-2 font-normal">ใบรับรอง</th>
                <th className="px-3 py-2 font-normal">ผู้จัดอบรม</th>
                <th className="px-3 py-2 font-normal">เลขที่</th>
                <th className="px-3 py-2 font-normal">วันที่ออก</th>
                <th className="px-3 py-2 font-normal">หมดอายุ</th>
                <th className="px-3 py-2 font-normal">สถานะ</th>
                <th className="px-5 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const e = byId.get(t.employeeId)!;
                const st = stateOf(t.expiry);
                return (
                  <tr key={t.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-1.5">
                      <button type="button" onClick={() => onOpen(e.id)} className="text-left hover:underline">
                        {e.name}
                      </button>
                      <span className="block font-mono text-[12px] text-ink-3">
                        {e.id} · {e.projectId ?? e.department}
                      </span>
                    </td>
                    <td className="px-3 py-1.5">
                      <span className="block">{CERT_LABEL[t.cert]}</span>
                      <span className="block max-w-[260px] truncate text-[12px] text-ink-3" title={t.title}>
                        {t.title}
                      </span>
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-1.5 text-ink-2">{t.provider}</td>
                    <td className="px-3 py-1.5 font-mono text-[12px]">{t.certNo}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-ink-2">{thDate(t.issuedAt)}</td>
                    <td className="whitespace-nowrap px-3 py-1.5">{t.expiry ? thDate(t.expiry) : <span className="text-ink-3">ไม่หมดอายุ</span>}</td>
                    <td className="px-3 py-1.5">
                      <Pill tone={STATE_TONE[st]}>{t.expiry && st !== "ok" ? dueLabel(t.expiry) : STATE_LABEL[st]}</Pill>
                    </td>
                    <td className="px-5 py-1.5 text-right">
                      {edit && (
                        <IconBtn label="แก้ไข" onClick={() => onEdit(t)}>
                          <Pencil {...I} />
                        </IconBtn>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>ไม่พบประวัติการอบรมตามตัวกรอง</Empty>
      )}
    </Card>
  );
}

function TrainingForm({ init, onClose }: { init: Partial<TrainingRecord>; onClose: () => void }) {
  const workers = useWorkers();
  const emps = employees.use();
  const people = init.employeeId && !workers.some((w) => w.id === init.employeeId) ? [...workers, ...emps.filter((e) => e.id === init.employeeId)] : workers;
  const [t, setT] = useState<TrainingRecord>(() => ({
    id: init.id ?? "",
    employeeId: init.employeeId ?? people[0]?.id ?? "",
    cert: init.cert ?? "work_at_height",
    title: init.title ?? CERT_LABEL[init.cert ?? "work_at_height"],
    provider: init.provider ?? "",
    certNo: init.certNo,
    issuedAt: init.issuedAt ?? TODAY,
    expiry: init.id ? init.expiry : CERT_VALID_YEARS[init.cert ?? "work_at_height"] ? addYears(TODAY, CERT_VALID_YEARS[init.cert ?? "work_at_height"]) : undefined,
    hours: init.hours,
    attachments: init.attachments ?? [],
    note: init.note,
  }));
  const set = (p: Partial<TrainingRecord>) => setT((x) => ({ ...x, ...p }));
  const pickCert = (c: CertKey) => set({ cert: c, title: t.title && t.title !== CERT_LABEL[t.cert] ? t.title : CERT_LABEL[c], expiry: CERT_VALID_YEARS[c] ? addYears(t.issuedAt, CERT_VALID_YEARS[c]) : undefined });
  const ok = t.employeeId && t.title.trim() && t.provider.trim() && t.issuedAt && (!t.expiry || t.expiry >= t.issuedAt);
  const save = () => {
    if (!ok) return;
    trainings.upsert({ ...t, id: t.id || trainings.nextId("TRN-"), title: t.title.trim(), provider: t.provider.trim(), certNo: t.certNo?.trim() || undefined });
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={init.id ? `แก้ไขใบรับรอง ${init.id}` : "บันทึกการอบรม/ใบรับรอง"}
      width={600}
      footer={
        <>
          {init.id && (
            <Btn danger onClick={() => (trainings.remove(init.id!), onClose())}>
              <Trash2 {...I} />
              ลบ
            </Btn>
          )}
          <span className="flex-1" />
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!ok} onClick={save}>
            <Save {...I} />
            บันทึก
          </Btn>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="พนักงาน">
          <select className={inputCls} value={t.employeeId} disabled={!!init.employeeId} onChange={(e) => set({ employeeId: e.target.value })}>
            {people.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} · {e.projectId ?? e.department}
              </option>
            ))}
          </select>
        </Field>
        <Field label="ประเภทใบรับรอง">
          <select className={inputCls} value={t.cert} onChange={(e) => pickCert(e.target.value as CertKey)}>
            {CERT_KEYS.map((c) => (
              <option key={c} value={c}>
                {CERT_LABEL[c]}
              </option>
            ))}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="หลักสูตร">
            <input className={inputCls} value={t.title} onChange={(e) => set({ title: e.target.value })} />
          </Field>
        </div>
        <Field label="ผู้จัดอบรม/หน่วยงานที่ออก">
          <input className={inputCls} value={t.provider} onChange={(e) => set({ provider: e.target.value })} />
        </Field>
        <Field label="เลขที่ใบรับรอง">
          <input className={cx(inputCls, "font-mono")} value={t.certNo ?? ""} onChange={(e) => set({ certNo: e.target.value })} />
        </Field>
        <Field label="วันที่ออก">
          <input type="date" className={inputCls} value={t.issuedAt} onChange={(e) => set({ issuedAt: e.target.value, expiry: !init.id && CERT_VALID_YEARS[t.cert] ? addYears(e.target.value, CERT_VALID_YEARS[t.cert]) : t.expiry })} />
        </Field>
        <Field label="วันหมดอายุ (เว้นว่าง = ไม่หมดอายุ)">
          <input type="date" className={inputCls} value={t.expiry ?? ""} min={t.issuedAt} onChange={(e) => set({ expiry: e.target.value || undefined })} />
        </Field>
        <Field label="ชั่วโมงอบรม">
          <input type="number" min={0} className={cx(inputCls, "text-right font-mono")} value={t.hours ?? ""} onChange={(e) => set({ hours: Number(e.target.value) || undefined })} />
        </Field>
        <div />
        <div className="sm:col-span-2">
          <MediaField value={t.attachments} onChange={(attachments) => set({ attachments })} label="สำเนาใบรับรอง/วุฒิบัตร" />
        </div>
      </div>
      <p className="mt-3 text-[12px] text-ink-3">อายุใบรับรองที่เสนอเป็นค่าเริ่มต้นของบริษัท ({CERT_VALID_YEARS[t.cert] ? `${CERT_VALID_YEARS[t.cert]} ปี` : "ไม่หมดอายุ"}) ตรวจสอบกับเงื่อนไขของหน่วยฝึกและกฎกระทรวงที่เกี่ยวข้อง</p>
    </Modal>
  );
}

// ---------------- migrant documents ----------------

function Docs({ q, onEdit, onOpen }: { q: string; onEdit: (e: Employee, kind: MigrantDocKind, doc?: MigrantDoc) => void; onOpen: (id: string) => void }) {
  const emps = employees.use();
  const docs = migrantDocs.use();
  const { edit } = useHrAccess();
  const [site, setSite] = useState("");
  const rows = emps.filter((e) => e.nationality !== "TH" && e.status !== "resigned" && (!site || e.projectId === site));
  const docOf = (id: string, kind: MigrantDocKind) => docs.filter((d) => d.employeeId === id && d.kind === kind).sort((a, b) => b.expiry.localeCompare(a.expiry))[0];
  return (
    <Card>
      <div className="flex flex-wrap items-end gap-3 border-b border-line px-5 py-4">
        <FilterField label="หน้างาน" className="w-full sm:w-[260px]">
          <Select label="หน้างาน" value={site} onChange={setSite}>
            <option value="">ทุกหน้างาน</option>
            {ACTIVE_SITES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} · {p.name}
              </option>
            ))}
          </Select>
        </FilterField>
        <p className="pb-2 text-[12px] text-ink-3">{rows.length} คน · คลิกช่องเพื่อบันทึกหรือต่ออายุเอกสาร</p>
      </div>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-ink-3">
                <th className="px-5 py-2 font-normal">แรงงาน</th>
                {MIGRANT_COLS.map((k) => (
                  <th key={k} className="px-2 py-2 font-normal">
                    {DOC_SHORT[k]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className={cx("border-b border-line last:border-0", q === e.id && "bg-accent-soft/40")}>
                  <td className="px-5 py-1.5">
                    <button type="button" onClick={() => onOpen(e.id)} className="text-left hover:underline">
                      {e.name}
                    </button>
                    <span className="block font-mono text-[12px] text-ink-3">
                      {e.id} · {NATIONALITY_LABEL[e.nationality]} · {e.projectId}
                    </span>
                  </td>
                  {MIGRANT_COLS.map((k) => {
                    const d = k === "work_permit" ? undefined : docOf(e.id, k);
                    const expiry = k === "work_permit" ? e.workPermitExpiry : d?.expiry;
                    const st: State = expiry ? stateOf(expiry) : "none";
                    return (
                      <td key={k} className="px-2 py-1.5">
                        <button type="button" disabled={!edit} onClick={() => onEdit(e, k, d)} className="w-full rounded-[6px] px-1 py-0.5 text-left transition-colors duration-150 enabled:hover:bg-raised">
                          {expiry ? (
                            <>
                              <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                                <Dot tone={STATE_TONE[st]} />
                                {thDate(expiry)}
                              </span>
                              {st !== "ok" && <span className={cx("block text-[11px]", st === "expired" ? "text-neg" : "text-warn")}>{dueLabel(expiry)}</span>}
                            </>
                          ) : (
                            <span className="text-ink-3">-</span>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>ไม่มีแรงงานต่างด้าวในหน้างานนี้</Empty>
      )}
      <p className="border-t border-line px-5 py-2.5 text-[12px] text-ink-3">แรงงานกัมพูชาบางส่วนใช้บัตรชมพูแทนพาสปอร์ต/วีซ่า · รายงานตัวทุก 90 วันที่สำนักงานตรวจคนเข้าเมือง (ตม.47) · ตรวจสอบมติคณะรัฐมนตรีเรื่องแรงงานต่างด้าวล่าสุด</p>
    </Card>
  );
}

function DocForm({ emp, kind, doc, onClose }: { emp: Employee; kind: MigrantDocKind; doc?: MigrantDoc; onClose: () => void }) {
  const permit = kind === "work_permit";
  const [no, setNo] = useState(permit ? (emp.workPermitNo ?? "") : (doc?.no ?? (kind === "passport" ? emp.idNo : kind === "report_90" ? "ตม.47" : "")));
  const [issuedAt, setIssuedAt] = useState(doc?.issuedAt ?? TODAY);
  const [expiry, setExpiry] = useState(permit ? (emp.workPermitExpiry ?? "") : (doc?.expiry ?? (kind === "report_90" ? addDays(TODAY, 90) : "")));
  const [attachments, setAttachments] = useState(doc?.attachments ?? []);
  const [renew, setRenew] = useState(false);
  const ok = no.trim() && expiry;
  const save = () => {
    if (!ok) return;
    if (permit) employees.upsert({ ...emp, workPermitNo: no.trim(), workPermitExpiry: expiry });
    else migrantDocs.upsert({ id: doc && !renew ? doc.id : migrantDocs.nextId("MGD-"), employeeId: emp.id, kind, no: no.trim(), issuedAt, expiry, attachments });
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`${MIGRANT_DOC_LABEL[kind]} · ${emp.name}`}
      width={520}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!ok} onClick={save}>
            <Save {...I} />
            บันทึก
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Field label="เลขที่เอกสาร">
            <input className={cx(inputCls, "font-mono")} value={no} onChange={(e) => setNo(e.target.value)} />
          </Field>
        </div>
        {!permit && (
          <Field label={kind === "report_90" ? "วันที่รายงานตัวล่าสุด" : "วันที่ออก"}>
            <input type="date" className={inputCls} value={issuedAt} onChange={(e) => (setIssuedAt(e.target.value), kind === "report_90" && setExpiry(addDays(e.target.value, 90)))} />
          </Field>
        )}
        <Field label={kind === "report_90" ? "ครบกำหนดรายงานตัวครั้งถัดไป" : "วันหมดอายุ"}>
          <input type="date" className={inputCls} value={expiry} onChange={(e) => setExpiry(e.target.value)} />
        </Field>
        {!permit && (
          <div className="col-span-2">
            <MediaField value={attachments} onChange={setAttachments} label="สำเนาเอกสาร" />
          </div>
        )}
        {doc && !permit && (
          <label className="col-span-2 flex items-center gap-2 text-[13px] text-ink-2">
            <input type="checkbox" checked={renew} onChange={(e) => setRenew(e.target.checked)} />
            ต่ออายุ (เก็บฉบับเดิมไว้เป็นประวัติ)
          </label>
        )}
      </div>
      {permit && <p className="mt-3 text-[12px] text-ink-3">ใบอนุญาตทำงานบันทึกไว้ที่ข้อมูลพนักงาน และแจ้งเตือนในหมวดบุคคล</p>}
    </Modal>
  );
}

// ---------------- expiring ----------------

type Exp = { key: string; d: number; date: string; employeeId: string; name: string; what: string; site?: string };

function useExpiring(): Exp[] {
  const emps = employees.use();
  const trn = trainings.use();
  const docs = migrantDocs.use();
  return useMemo(() => {
    const out: Exp[] = [];
    const active = new Map(emps.filter((e) => e.status !== "resigned").map((e) => [e.id, e]));
    const push = (key: string, e: Employee, date: string, what: string) => {
      const d = daysTo(date);
      if (d <= 60 && d >= -180) out.push({ key, d, date, employeeId: e.id, name: e.name, what, site: e.projectId });
    };
    for (const t of trn) {
      const e = active.get(t.employeeId);
      if (!e || !t.expiry || latest(trn, t.employeeId, t.cert)?.id !== t.id) continue;
      push(`t-${t.id}`, e, t.expiry, CERT_LABEL[t.cert]);
    }
    for (const m of docs) {
      const e = active.get(m.employeeId);
      if (!e || docs.some((o) => o.employeeId === m.employeeId && o.kind === m.kind && o.expiry > m.expiry)) continue;
      push(`d-${m.id}`, e, m.expiry, m.kind === "report_90" ? "รายงานตัว 90 วัน" : MIGRANT_DOC_LABEL[m.kind]);
    }
    for (const e of active.values()) if (e.workPermitExpiry) push(`wp-${e.id}`, e, e.workPermitExpiry, "ใบอนุญาตทำงาน");
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }, [emps, trn, docs]);
}

function Expiring({ items, onOpen }: { items: Exp[]; onOpen: (id: string) => void }) {
  return (
    <Card>
      <CardHead title="ใกล้หมดอายุและหมดอายุแล้ว" meta={`${items.length} รายการ · ภายใน 60 วัน`} />
      {items.length ? (
        <ul>
          {items.map((x) => (
            <li key={x.key}>
              <button type="button" onClick={() => onOpen(x.employeeId)} className="flex w-full flex-wrap items-center gap-3 border-b border-line px-5 py-2.5 text-left text-[13px] transition-colors duration-150 hover:bg-raised/60">
                <span className="w-[92px] font-mono text-[12px] text-ink-2">{thDate(x.date)}</span>
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{x.name}</span> · {x.what}
                  <span className="block font-mono text-[12px] text-ink-3">
                    {x.employeeId} · {x.site ?? "-"}
                  </span>
                </span>
                <Pill tone={x.d < 0 ? "neg" : x.d <= 30 ? "warn" : "neutral"}>{dueLabel(x.date)}</Pill>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>ไม่มีใบรับรองหรือเอกสารที่ใกล้หมดอายุ</Empty>
      )}
    </Card>
  );
}
