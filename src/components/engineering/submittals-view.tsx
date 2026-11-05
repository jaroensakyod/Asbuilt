"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Card, cx, Field, inputCls } from "@/components/ui";
import { Btn, Empty, FilterField, I, Modal, Pill, Segmented, Select, StatCard, type Tone } from "@/components/ops/bits";
import { MediaField } from "@/components/media/media-field";
import { getProject, thDate, TODAY } from "@/lib/data";
import { subcontractors } from "@/lib/biz";
import {
  addDays,
  DISC_LABEL,
  DISCS,
  latestRev,
  nextSeries,
  SUBMITTAL_STATE_LABEL,
  SUBMITTAL_TYPE_LABEL,
  submittals,
  submittalState,
  type Disc,
  type ReviewCode,
  type Submittal,
  type SubmittalRev,
  type SubmittalState,
  type SubmittalType,
} from "@/lib/engineering";
import type { MediaRef } from "@/lib/media";
import { Area, DocId, Due, Heading, PeopleList, pname, ProjectSelect, rowCls, SearchBox, td, th, useEngPerms } from "./bits";

export const STATE_TONE: Record<SubmittalState, Tone> = { review: "warn", overdue: "neg", approved: "pos", approvedNotes: "pos", resubmit: "warn", rejected: "neg" };
export const CODE_TONE: Record<ReviewCode, Tone> = { A: "pos", B: "pos", C: "warn", D: "neg" };

export function SubmittalsView() {
  const sp = useSearchParams();
  return <Inner key={sp.toString()} initProject={sp.get("project") ?? ""} initQ={sp.get("q") ?? ""} />;
}

type Quick = "" | "review" | "overdue" | "approved" | "resubmit" | "rejected";

function Inner({ initProject, initQ }: { initProject: string; initQ: string }) {
  const router = useRouter();
  const perms = useEngPerms();
  const all = submittals.use();
  const [view, setView] = useState<"list" | "register">("list");
  const [q, setQ] = useState(initQ);
  const [project, setProject] = useState(initProject);
  const [type, setType] = useState("");
  const [state, setState] = useState("");
  const [reviewer, setReviewer] = useState("");
  const [quick, setQuick] = useState<Quick>("");
  const [formOpen, setFormOpen] = useState(false);

  const inProject = useMemo(() => all.filter((x) => !project || x.projectId === project), [all, project]);
  const st = (x: Submittal) => submittalState(x, TODAY);
  const stats = {
    review: inProject.filter((x) => st(x) === "review").length,
    overdue: inProject.filter((x) => st(x) === "overdue").length,
    approved: inProject.filter((x) => ["approved", "approvedNotes"].includes(st(x))).length,
    resubmit: inProject.filter((x) => st(x) === "resubmit").length,
    rejected: inProject.filter((x) => st(x) === "rejected").length,
  };
  const reviewers = useMemo(() => [...new Set(all.map((x) => x.reviewer))].sort(), [all]);
  const needle = q.trim().toLowerCase();
  const matchQuick = (x: Submittal) => {
    const s = st(x);
    if (!quick) return true;
    if (quick === "approved") return s === "approved" || s === "approvedNotes";
    return s === quick;
  };
  const rows = inProject
    .filter((x) => !type || x.type === type)
    .filter((x) => !state || st(x) === state)
    .filter((x) => !reviewer || x.reviewer === reviewer)
    .filter(matchQuick)
    .filter((x) => !needle || `${x.id} ${x.title} ${x.specSection} ${x.supplier ?? ""} ${x.reviewer} ${pname(x.projectId)}`.toLowerCase().includes(needle))
    .sort((a, b) => {
      const rank: Record<SubmittalState, number> = { overdue: 0, review: 1, resubmit: 2, rejected: 3, approvedNotes: 4, approved: 5 };
      return rank[st(a)] - rank[st(b)] || latestRev(a).due.localeCompare(latestRev(b).due);
    });
  const toggle = (k: Quick) => setQuick((x) => (x === k ? "" : k));
  const filtered = q || type || state || reviewer || quick;
  const clear = () => (setQ(""), setType(""), setState(""), setReviewer(""), setQuick(""));

  // register: one row per revision, grouped by spec section
  const register = useMemo(() => {
    const out: { s: Submittal; r: SubmittalRev }[] = [];
    for (const s of rows) for (const r of s.revs) out.push({ s, r });
    return out.sort((a, b) => a.s.specSection.localeCompare(b.s.specSection) || a.s.id.localeCompare(b.s.id) || a.r.rev - b.r.rev);
  }, [rows]);

  return (
    <>
      <Heading
        title="ส่งอนุมัติวัสดุ & แบบ"
        sub="Submittal วัสดุ Shop drawing ตัวอย่าง Method statement และเอกสารรับรอง ผู้พิจารณาให้รหัส A–D ถ้าต้องแก้ไขจะส่งใหม่เป็น Rev. ถัดไป"
        actions={
          perms.edit && (
            <Btn primary onClick={() => setFormOpen(true)}>
              <Plus {...I} />
              ส่งเอกสารขออนุมัติ
            </Btn>
          )
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="รอพิจารณา" value={stats.review} unit="รายการ" active={quick === "review"} onClick={() => toggle("review")} />
        <StatCard label="เลยกำหนดพิจารณา" value={stats.overdue} unit="รายการ" tone={stats.overdue ? "neg" : undefined} active={quick === "overdue"} onClick={() => toggle("overdue")} />
        <StatCard label="อนุมัติ (A/B)" value={stats.approved} unit="รายการ" active={quick === "approved"} onClick={() => toggle("approved")} />
        <StatCard label="แก้ไขส่งใหม่ (C)" value={stats.resubmit} unit="รายการ" active={quick === "resubmit"} onClick={() => toggle("resubmit")} />
        <StatCard label="ไม่อนุมัติ (D)" value={stats.rejected} unit="รายการ" active={quick === "rejected"} onClick={() => toggle("rejected")} />
      </div>

      <Card className="mb-4">
        <div className="grid grid-cols-2 gap-3 px-4 py-3 lg:grid-cols-6">
          <SearchBox value={q} onChange={setQ} placeholder="เลขที่ รายการ หมวดสเปก ผู้ขาย" className="col-span-2" />
          <FilterField label="โครงการ">
            <ProjectSelect value={project} onChange={setProject} />
          </FilterField>
          <FilterField label="ประเภท">
            <Select label="ประเภท" value={type} onChange={setType}>
              <option value="">ทุกประเภท</option>
              {(Object.keys(SUBMITTAL_TYPE_LABEL) as SubmittalType[]).map((k) => (
                <option key={k} value={k}>
                  {SUBMITTAL_TYPE_LABEL[k]}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="สถานะ">
            <Select label="สถานะ" value={state} onChange={setState}>
              <option value="">ทุกสถานะ</option>
              {(Object.keys(SUBMITTAL_STATE_LABEL) as SubmittalState[]).map((k) => (
                <option key={k} value={k}>
                  {SUBMITTAL_STATE_LABEL[k]}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="ผู้พิจารณา">
            <Select label="ผู้พิจารณา" value={reviewer} onChange={setReviewer}>
              <option value="">ทุกคน</option>
              {reviewers.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </FilterField>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-2 text-[13px] text-ink-3">
          <span className="num font-mono text-[12px]">{rows.length} รายการ</span>
          {filtered && (
            <button type="button" onClick={clear} className="inline-flex items-center gap-1 text-ink-2 hover:text-ink">
              <X {...I} />
              ล้างตัวกรอง
            </button>
          )}
          <span className="ml-auto">
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { key: "list", label: "รายการ" },
                { key: "register", label: "ทะเบียนทุก Rev." },
              ]}
            />
          </span>
        </div>
      </Card>

      <Card>
        {rows.length === 0 ? (
          <Empty>{all.length ? "ไม่พบรายการตามตัวกรอง" : "ยังไม่มีเอกสารส่งอนุมัติ"}</Empty>
        ) : view === "list" ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left">
              <thead>
                <tr>
                  <th className={th}>เลขที่</th>
                  <th className={th}>รายการ</th>
                  <th className={th}>ประเภท · หมวดสเปก</th>
                  <th className={th}>Rev.</th>
                  <th className={th}>ผู้พิจารณา</th>
                  <th className={th}>กำหนดพิจารณา</th>
                  <th className={th}>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((x) => {
                  const r = latestRev(x);
                  const s = st(x);
                  return (
                    <tr key={x.id} onClick={() => router.push(`/submittals/${x.id}`)} className={rowCls}>
                      <td className={td}>
                        <DocId id={x.id} href={`/submittals/${x.id}`} />
                        <span className="block text-[12px] text-ink-3">{thDate(r.submittedAt)}</span>
                      </td>
                      <td className={td}>
                        <span className="block max-w-[320px] truncate">{x.title}</span>
                        <span className="block max-w-[320px] truncate text-[12px] text-ink-3">
                          {pname(x.projectId)}
                          {x.supplier && ` · ${x.supplier}`}
                        </span>
                      </td>
                      <td className={cx(td, "text-[13px]")}>
                        {SUBMITTAL_TYPE_LABEL[x.type]}
                        <span className="block max-w-[220px] truncate text-[12px] text-ink-3">{x.specSection}</span>
                      </td>
                      <td className={cx(td, "font-mono text-[13px]")}>Rev.{r.rev}</td>
                      <td className={cx(td, "text-[13px]")}>
                        <span className="block max-w-[200px] truncate">{x.reviewer}</span>
                      </td>
                      <td className={td}>
                        <Due date={r.due} done={!!r.code} />
                      </td>
                      <td className={td}>
                        <Pill tone={STATE_TONE[s]}>{SUBMITTAL_STATE_LABEL[s]}</Pill>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left">
              <thead>
                <tr>
                  <th className={th}>หมวดสเปก</th>
                  <th className={th}>เลขที่</th>
                  <th className={th}>รายการ</th>
                  <th className={th}>Rev.</th>
                  <th className={th}>ส่ง</th>
                  <th className={th}>พิจารณา</th>
                  <th className={th}>รหัส</th>
                  <th className={th}>ความเห็น</th>
                </tr>
              </thead>
              <tbody>
                {register.map(({ s, r }) => (
                  <tr key={`${s.id}-${r.rev}`} onClick={() => router.push(`/submittals/${s.id}`)} className={rowCls}>
                    <td className={cx(td, "text-[13px] text-ink-2")}>
                      <span className="block max-w-[200px] truncate">{s.specSection}</span>
                    </td>
                    <td className={td}>
                      <DocId id={s.id} href={`/submittals/${s.id}`} />
                    </td>
                    <td className={cx(td, "text-[13px]")}>
                      <span className="block max-w-[260px] truncate">{s.title}</span>
                    </td>
                    <td className={cx(td, "font-mono text-[13px]")}>{r.rev}</td>
                    <td className={cx(td, "num font-mono text-[12px]")}>{thDate(r.submittedAt)}</td>
                    <td className={cx(td, "num font-mono text-[12px]")}>{r.reviewedAt ? thDate(r.reviewedAt) : <span className={r.due < TODAY ? "text-neg" : "text-ink-3"}>รอ · {thDate(r.due)}</span>}</td>
                    <td className={td}>{r.code ? <Pill tone={CODE_TONE[r.code]}>{r.code}</Pill> : <span className="text-ink-3">–</span>}</td>
                    <td className={cx(td, "text-[13px] text-ink-2")}>
                      <span className="block max-w-[260px] truncate">{r.comments ?? ""}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {formOpen && <SubmittalForm onClose={() => setFormOpen(false)} initProject={project} onSaved={(x) => router.push(`/submittals/${x.id}`)} />}
    </>
  );
}

export function SubmittalForm({ onClose, edit, initProject, onSaved }: { onClose: () => void; edit?: Submittal; initProject?: string; onSaved?: (s: Submittal) => void }) {
  const { me } = useEngPerms();
  const subs = subcontractors.use();
  const first = edit?.revs[0];
  const [projectId, setProjectId] = useState(edit?.projectId ?? initProject ?? "");
  const [title, setTitle] = useState(edit?.title ?? "");
  const [type, setType] = useState<SubmittalType>(edit?.type ?? "material");
  const [disc, setDisc] = useState<Disc>(edit?.disc ?? "A");
  const [specSection, setSpec] = useState(edit?.specSection ?? "");
  const [supplier, setSupplier] = useState(edit?.supplier ?? "");
  const [subId, setSubId] = useState(edit?.subcontractorId ?? "");
  const [reviewer, setReviewer] = useState(edit?.reviewer ?? "");
  const [due, setDue] = useState(first?.due ?? addDays(TODAY, 7));
  const [note, setNote] = useState(first?.note ?? "");
  const [files, setFiles] = useState<MediaRef[]>(first?.attachments ?? []);
  const ok = projectId && title.trim() && specSection.trim() && reviewer.trim();

  const save = () => {
    if (!ok) return;
    const head = edit ?? nextSeries(submittals.all(), "SBM", projectId);
    const x: Submittal = {
      ...head,
      projectId,
      title: title.trim(),
      type,
      disc,
      specSection: specSection.trim(),
      supplier: supplier.trim() || undefined,
      subcontractorId: subId || undefined,
      reviewer: reviewer.trim(),
      revs: edit ? edit.revs.map((r, i) => (i === edit.revs.length - 1 && !r.code ? { ...r, due, note: note.trim() || undefined, attachments: files } : r)) : [{ rev: 0, submittedAt: TODAY, submittedBy: me.name, due, note: note.trim() || undefined, attachments: files }],
    };
    submittals.upsert(x);
    onSaved?.(x);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={edit ? `แก้ไข ${edit.id}` : "ส่งเอกสารขออนุมัติ"}
      width={720}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary onClick={save} disabled={!ok}>
            {edit ? "บันทึก" : "ส่ง Rev.0"}
          </Btn>
        </>
      }
    >
      <PeopleList />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="โครงการ">{edit ? <input disabled value={`${projectId} · ${getProject(projectId)?.name ?? ""}`} className={inputCls} /> : <ProjectSelect value={projectId} onChange={setProjectId} required />}</Field>
        <Field label="ประเภท">
          <Select label="ประเภท" value={type} onChange={(v) => setType(v as SubmittalType)}>
            {(Object.keys(SUBMITTAL_TYPE_LABEL) as SubmittalType[]).map((k) => (
              <option key={k} value={k}>
                {SUBMITTAL_TYPE_LABEL[k]}
              </option>
            ))}
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="รายการ">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น กระเบื้องพื้น Porcelain 60×60 ซม." className={inputCls} />
          </Field>
        </div>
        <Field label="หมวดงาน">
          <Select label="หมวดงาน" value={disc} onChange={(v) => setDisc(v as Disc)}>
            {DISCS.map((k) => (
              <option key={k} value={k}>
                {DISC_LABEL[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="หมวดรายการประกอบแบบ (spec section)">
          <input value={specSection} onChange={(e) => setSpec(e.target.value)} placeholder="เช่น 09 30 00 งานกระเบื้อง" className={inputCls} />
        </Field>
        <Field label="ผู้ขาย/ผู้ผลิต">
          <input value={supplier} onChange={(e) => setSupplier(e.target.value)} className={inputCls} />
        </Field>
        <Field label="ผู้รับเหมาช่วงที่ส่ง (ถ้ามี)">
          <Select label="ผู้รับเหมาช่วง" value={subId} onChange={setSubId}>
            <option value="">ไม่ระบุ</option>
            {subs.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="ผู้พิจารณา">
          <input list="eng-people" value={reviewer} onChange={(e) => setReviewer(e.target.value)} placeholder="ผู้ออกแบบ / ผู้ควบคุมงาน" className={inputCls} />
        </Field>
        <Field label="กำหนดพิจารณา">
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={cx(inputCls, "font-mono")} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="รายละเอียด / หมายเหตุ">
            <Area value={note} onChange={setNote} rows={2} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <MediaField value={files} onChange={setFiles} label="แคตตาล็อก แบบ ใบรับรอง รูปตัวอย่าง" />
        </div>
      </div>
    </Modal>
  );
}
