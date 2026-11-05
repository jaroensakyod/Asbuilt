"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Check, ListChecks, Lock, Minus, Plus, Printer, Trash2, X } from "lucide-react";
import { Card, cx, Field, inputCls } from "@/components/ui";
import { Btn, Empty, I, IconBtn, KV, Meter, Modal, Pill, Select, type Tone } from "@/components/ops/bits";
import { MediaField, MediaStrip } from "@/components/media/media-field";
import { SignaturePad } from "@/components/media/signature-pad";
import { getProject, thDate, TODAY } from "@/lib/data";
import {
  addDays,
  canRecordStep,
  DISC_LABEL,
  DISCS,
  INSP_REQ_STATUS_LABEL,
  inspectionRequests,
  itpProgress,
  itpTemplates,
  nextOpenStep,
  nextSeries,
  nowIso,
  POINT_LABEL,
  waitingHold,
  type Disc,
  type InspectionRequest,
  type InspReqStatus,
  type ItpStep,
  type ItpTemplate,
  type PointType,
  type StepRecord,
  type StepResult,
} from "@/lib/engineering";
import { DocHeader, DocRow, DocSection, PeopleList, pname, ProjectSelect, rowCls, SigImg, td, th, thDT, useEngPerms } from "./bits";
import { matchQ, QFilters, useNewTrigger, type QFilter, type SetQ } from "./quality-bits";
import { NcrForm } from "./quality-ncr";

export const IR_TONE: Record<InspReqStatus, Tone> = { requested: "neutral", inprogress: "accent", approved: "pos", rejected: "neg" };
const POINT_TONE: Record<PointType, Tone> = { H: "neg", W: "warn", R: "neutral" };
const RESULT_LABEL: Record<StepResult, string> = { pass: "ผ่าน", fail: "ไม่ผ่าน", na: "ไม่เกี่ยวข้อง" };

export function PointBadge({ p }: { p: PointType }) {
  return (
    <span title={POINT_LABEL[p]}>
      <Pill tone={POINT_TONE[p]} mono>
        {p}
      </Pill>
    </span>
  );
}

export function ItpTab({ f, setF, newKey }: { f: QFilter; setF: SetQ; newKey: number }) {
  const perms = useEngPerms();
  const all = inspectionRequests.use();
  const tpls = itpTemplates.use();
  const [newOpen, setNewOpen] = useState(false);
  const [tplOpen, setTplOpen] = useState(false);
  const [view, setView] = useState<string | null>(() => all.find((r) => r.id === f.q)?.id ?? null);
  useNewTrigger(newKey, () => setNewOpen(true));

  const tplOf = (id: string) => tpls.find((t) => t.id === id);
  const people = [...new Set(all.map((r) => r.inspector))].sort();
  const rows = all
        .filter((r) => !f.project || r.projectId === f.project)
        .filter((r) => {
          if (!f.status) return true;
          if (f.status === "hold") {
            const t = tpls.find((x) => x.id === r.templateId);
            return !!t && !!waitingHold(t, r);
          }
          return r.status === f.status;
        })
        .filter((r) => !f.person || r.inspector === f.person)
        .filter((r) => matchQ(f.q, r.id, r.title, r.location, tpls.find((t) => t.id === r.templateId)?.name))
        .sort((a, b) => Number(a.status === "approved") - Number(b.status === "approved") || b.date.localeCompare(a.date));
  const viewing = view ? all.find((r) => r.id === view) : undefined;

  return (
    <>
      <QFilters
        f={f}
        setF={setF}
        count={rows.length}
        personLabel="ผู้ตรวจ / ผู้ควบคุมงาน"
        people={people}
        statuses={[...Object.entries(INSP_REQ_STATUS_LABEL), ["hold", "Hold point รออนุมัติ"]]}
        extra={
          <Btn small onClick={() => setTplOpen(true)}>
            <ListChecks {...I} />
            แม่แบบ ITP ({tpls.length})
          </Btn>
        }
      />
      <Card className="ops-noprint">
        {rows.length === 0 ? (
          <Empty>ไม่มีคำขอตรวจงานตามตัวกรองนี้</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr>
                  <th className={th}>คำขอตรวจ</th>
                  <th className={th}>งาน · ตำแหน่ง</th>
                  <th className={th}>ความคืบหน้า</th>
                  <th className={th}>ขั้นที่รอ</th>
                  <th className={th}>ผู้ควบคุมงาน</th>
                  <th className={th}>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const t = tplOf(r.templateId);
                  const pr = t ? itpProgress(t, r) : { done: 0, total: 0, pct: 0, failed: 0 };
                  const hold = t && waitingHold(t, r);
                  const next = t && r.status !== "approved" && r.status !== "rejected" ? t.steps[nextOpenStep(t, r)] : undefined;
                  return (
                    <tr key={r.id} className={rowCls} onClick={() => setView(r.id)}>
                      <td className={td}>
                        <span className="font-mono text-[12px] text-accent-text">{r.id}</span>
                        <span className="block text-[12px] text-ink-3">
                          {thDate(r.date)} {r.time && `${r.time} น.`}
                        </span>
                      </td>
                      <td className={td}>
                        <span className="block max-w-[320px] truncate">{r.title}</span>
                        <span className="block text-[12px] text-ink-3">
                          {pname(r.projectId)} · ITP {t?.name ?? r.templateId}
                        </span>
                      </td>
                      <td className={cx(td, "w-[160px]")}>
                        <Meter value={pr.pct} />
                        <span className="mt-1 block font-mono text-[12px] text-ink-3">
                          {pr.done}/{pr.total} ขั้น{pr.failed ? ` · ไม่ผ่าน ${pr.failed}` : ""}
                        </span>
                      </td>
                      <td className={cx(td, "text-[13px]")}>
                        {next ? (
                          <span className="flex items-start gap-1.5">
                            <PointBadge p={next.point} />
                            <span className={cx("max-w-[220px]", hold && "text-neg")}>{next.text}</span>
                          </span>
                        ) : (
                          <span className="text-ink-3">–</span>
                        )}
                      </td>
                      <td className={cx(td, "text-[13px]")}>{r.inspector}</td>
                      <td className={td}>
                        <Pill tone={IR_TONE[r.status]}>{INSP_REQ_STATUS_LABEL[r.status]}</Pill>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {viewing && <IrDetail r={viewing} tpl={tplOf(viewing.templateId)} onClose={() => setView(null)} canEdit={perms.edit} />}
      {newOpen && <IrForm defaultProject={f.project} onClose={() => setNewOpen(false)} onSaved={setView} />}
      {tplOpen && <TemplateManager onClose={() => setTplOpen(false)} canEdit={perms.edit} />}
    </>
  );
}

function IrForm({ defaultProject, onClose, onSaved }: { defaultProject?: string; onClose: () => void; onSaved: (id: string) => void }) {
  const perms = useEngPerms();
  const tpls = itpTemplates.use();
  const [d, setD] = useState({ projectId: defaultProject ?? "", templateId: tpls[0]?.id ?? "", title: "", location: "", date: addDays(TODAY, 1), time: "10:00", inspector: "ภานุวัฒน์ ศักดิ์สิทธิ์", requestedBy: perms.me.name });
  const set = (k: keyof typeof d) => (v: string) => setD((x) => ({ ...x, [k]: v }));
  const tpl = tpls.find((t) => t.id === d.templateId);
  const ok = d.projectId && d.templateId && d.title.trim() && d.inspector.trim();
  const save = () => {
    if (!ok) return;
    const { id, no } = nextSeries(inspectionRequests.all(), "IR", d.projectId);
    inspectionRequests.upsert({ id, no, ...d, title: d.title.trim(), requestedAt: TODAY, steps: [], status: "requested" });
    onSaved(id);
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="ขอตรวจงาน (Request for inspection)"
      width={680}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!ok} onClick={save}>
            ส่งคำขอตรวจ
          </Btn>
        </>
      }
    >
      <PeopleList />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="โครงการ">
          <ProjectSelect value={d.projectId} onChange={set("projectId")} required />
        </Field>
        <Field label="แผนตรวจสอบ (ITP)">
          <Select
            label="แผนตรวจสอบ"
            value={d.templateId}
            onChange={(v) => setD((x) => ({ ...x, templateId: v, title: x.title || (tpls.find((t) => t.id === v)?.name ?? "") }))}
          >
            {tpls.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · {t.workType}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="ชื่องานที่ขอตรวจ">
          <input value={d.title} onChange={(e) => set("title")(e.target.value)} className={inputCls} placeholder="เช่น เหล็กเสริมพื้นชั้น 3 โซน A" />
        </Field>
        <Field label="ตำแหน่ง">
          <input value={d.location} onChange={(e) => set("location")(e.target.value)} className={inputCls} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="วันที่ขอตรวจ">
            <input type="date" value={d.date} onChange={(e) => set("date")(e.target.value)} className={cx(inputCls, "font-mono")} />
          </Field>
          <Field label="เวลา">
            <input type="time" value={d.time} onChange={(e) => set("time")(e.target.value)} className={cx(inputCls, "font-mono")} />
          </Field>
        </div>
        <Field label="ผู้ควบคุมงาน (อนุมัติ Hold point)">
          <input value={d.inspector} onChange={(e) => set("inspector")(e.target.value)} list="eng-people" className={inputCls} />
        </Field>
      </div>
      {tpl && (
        <div className="mt-4 rounded-[10px] border border-line">
          <p className="border-b border-line px-3 py-2 text-[13px] text-ink-3">ขั้นตอนตามแผน {tpl.steps.length} ขั้น · Hold point {tpl.steps.filter((s) => s.point === "H").length} จุด</p>
          <ol className="px-3 py-2 text-[13px]">
            {tpl.steps.map((s, i) => (
              <li key={s.id} className="flex items-start gap-2 py-1">
                <span className="w-5 font-mono text-ink-3">{i + 1}</span>
                <PointBadge p={s.point} />
                <span>{s.text}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </Modal>
  );
}

function IrDetail({ r, tpl, onClose, canEdit }: { r: InspectionRequest; tpl?: ItpTemplate; onClose: () => void; canEdit: boolean }) {
  const perms = useEngPerms();
  const [notes, setNotes] = useState<Record<string, string>>(() => Object.fromEntries(r.steps.map((s) => [s.stepId, s.note ?? ""])));
  const [ncrFor, setNcrFor] = useState<ItpStep | null>(null);
  const [signing, setSigning] = useState(false);
  const p = getProject(r.projectId);
  const closed = r.status === "approved" || r.status === "rejected";
  const norm = (s: string) => s.replace(/^คุณ/, "").trim();
  const canRelease = perms.approve || norm(perms.me.name) === norm(r.inspector);
  const recOf = (id: string) => r.steps.find((s) => s.stepId === id);
  if (!tpl)
    return (
      <Modal open onClose={onClose} title={r.id}>
        <Empty>ไม่พบแม่แบบ ITP {r.templateId}</Empty>
      </Modal>
    );
  const pr = itpProgress(tpl, r);
  const allDone = nextOpenStep(tpl, r) >= tpl.steps.length;

  const upsertStep = (stepId: string, patch: Partial<StepRecord>) => {
    const cur = recOf(stepId) ?? { stepId };
    const steps = [...r.steps.filter((s) => s.stepId !== stepId), { ...cur, ...patch }];
    steps.sort((a, b) => tpl.steps.findIndex((s) => s.id === a.stepId) - tpl.steps.findIndex((s) => s.id === b.stepId));
    inspectionRequests.upsert({ ...r, steps, status: r.status === "requested" ? "inprogress" : r.status });
  };
  const record = (st: ItpStep, result: StepResult) => upsertStep(st.id, { result, by: perms.me.name, at: nowIso(), note: notes[st.id] || undefined });

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={`${r.id} · ${r.title}`}
        width={900}
        footer={
          <>
            <Btn onClick={() => window.print()}>
              <Printer {...I} />
              พิมพ์ใบขอตรวจ
            </Btn>
            {canEdit && !closed && (
              <Btn danger onClick={() => inspectionRequests.upsert({ ...r, status: "rejected" })}>
                ไม่ผ่าน ปิดคำขอ
              </Btn>
            )}
            {canEdit && closed && (
              <Btn onClick={() => inspectionRequests.upsert({ ...r, status: "inprogress", signature: undefined, signedAt: undefined, signedBy: undefined })}>เปิดตรวจใหม่</Btn>
            )}
            {canEdit && !closed && canRelease && (
              <Btn primary disabled={!allDone || pr.failed > 0} onClick={() => setSigning(true)} title={!allDone ? "ต้องบันทึกครบทุกขั้นก่อน" : undefined}>
                อนุมัติให้ทำงานต่อ
              </Btn>
            )}
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2 pb-3">
          <Pill tone={IR_TONE[r.status]}>{INSP_REQ_STATUS_LABEL[r.status]}</Pill>
          <Pill>ITP {tpl.name}</Pill>
          <Pill>{DISC_LABEL[tpl.disc]}</Pill>
          {r.ncrId && <Pill tone="neg" mono>{r.ncrId}</Pill>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 sm:gap-x-6">
          <KV k="โครงการ">{p?.name ?? r.projectId}</KV>
          <KV k="ตำแหน่ง">{r.location}</KV>
          <KV k="ผู้ขอตรวจ">
            {r.requestedBy} · {thDate(r.requestedAt)}
          </KV>
          <KV k="นัดตรวจ">
            {thDate(r.date)} {r.time && `${r.time} น.`}
          </KV>
          <KV k="ผู้ควบคุมงาน">{r.inspector}</KV>
          <KV k="ความคืบหน้า">
            {pr.done}/{pr.total} ขั้น
          </KV>
        </div>
        {!canRelease && !closed && <p className="mt-3 text-[13px] text-warn">Hold point (H) อนุมัติได้เฉพาะ {r.inspector} หรือผู้มีสิทธิ์อนุมัติงานวิศวกรรม</p>}

        <ol className="mt-4 rounded-[10px] border border-line">
          {tpl.steps.map((st, i) => {
            const rec = recOf(st.id);
            const allowed = canRecordStep(tpl, r, i);
            const mayRecord = canEdit && !closed && allowed && (st.point !== "H" || canRelease);
            return (
              <li key={st.id} className={cx("border-t border-line px-4 py-3 first:border-t-0", rec?.result === "fail" && "bg-neg-soft/40", !allowed && !rec?.result && "opacity-60")}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-start gap-2">
                      <span className="w-5 shrink-0 font-mono text-[12px] text-ink-3">{i + 1}</span>
                      <PointBadge p={st.point} />
                      <span>{st.text}</span>
                    </p>
                    <p className="ml-7 mt-0.5 text-[13px] text-ink-3">เกณฑ์ {st.criteria}</p>
                    {rec?.result && (
                      <p className="ml-7 mt-0.5 text-[12px] text-ink-3">
                        {RESULT_LABEL[rec.result]} · {rec.by} {rec.at && `· ${thDT(rec.at)}`}
                      </p>
                    )}
                    {!allowed && !rec?.result && (
                      <p className="ml-7 mt-0.5 flex items-center gap-1 text-[12px] text-warn">
                        <Lock size={12} strokeWidth={1.5} />
                        รอผ่าน Hold point ก่อนหน้า
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {(["pass", "fail", "na"] as StepResult[]).map((res) => (
                      <button
                        key={res}
                        type="button"
                        disabled={!mayRecord}
                        onClick={() => record(st, res)}
                        aria-pressed={rec?.result === res}
                        className={cx(
                          "inline-flex h-8 items-center gap-1 rounded-[8px] border px-2 text-[13px] transition-colors duration-150 disabled:cursor-default",
                          rec?.result === res
                            ? res === "pass"
                              ? "border-pos bg-pos-soft text-pos"
                              : res === "fail"
                                ? "border-neg bg-neg-soft text-neg"
                                : "border-ink-3 bg-raised text-ink"
                            : "border-line-strong bg-card text-ink-2 enabled:hover:bg-raised",
                          !mayRecord && rec?.result !== res && "opacity-40",
                        )}
                      >
                        {res === "pass" ? <Check {...I} /> : res === "fail" ? <X {...I} /> : <Minus {...I} />}
                        {RESULT_LABEL[res]}
                      </button>
                    ))}
                  </div>
                </div>
                {(mayRecord || rec?.note || rec?.photos?.length) && (
                  <div className="ml-7 mt-2 flex flex-col gap-2">
                    {mayRecord ? (
                      <input
                        value={notes[st.id] ?? ""}
                        onChange={(e) => setNotes((x) => ({ ...x, [st.id]: e.target.value }))}
                        onBlur={() => rec && (rec.note ?? "") !== (notes[st.id] ?? "") && upsertStep(st.id, { note: notes[st.id] || undefined })}
                        placeholder="หมายเหตุ / สิ่งที่พบ"
                        className={cx(inputCls, "h-8 text-[13px]")}
                      />
                    ) : (
                      rec?.note && <p className="text-[13px] text-ink-2">หมายเหตุ {rec.note}</p>
                    )}
                    {mayRecord ? <MediaField label="รูปถ่าย" photosOnly value={rec?.photos ?? []} onChange={(photos) => upsertStep(st.id, { photos })} /> : <MediaStrip refs={rec?.photos} />}
                    {rec?.result === "fail" && canEdit && !r.ncrId && (
                      <div>
                        <Btn small danger onClick={() => setNcrFor(st)}>
                          เปิด NCR จากขั้นนี้
                        </Btn>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>

        {r.status === "approved" && (
          <p className="mt-3 text-[13px] text-pos">
            อนุมัติให้ทำงานต่อโดย {r.signedBy} {r.signedAt && `· ${thDT(r.signedAt)}`}
          </p>
        )}
        {signing && (
          <div className="mt-4 rounded-[10px] border border-line p-3">
            <p className="mb-2 text-[14px] font-medium">ลงนามอนุมัติ (ผู้ควบคุมงาน)</p>
            <SignaturePad
              onSave={(sig, signer) => {
                inspectionRequests.upsert({ ...r, status: "approved", signature: sig, signedBy: signer, signedAt: nowIso() });
                setSigning(false);
              }}
            />
          </div>
        )}
      </Modal>

      {ncrFor && (
        <NcrForm
          defaultProject={r.projectId}
          preset={{
            title: `${tpl.name}: ${ncrFor.text}`,
            description: [notes[ncrFor.id] || recOf(ncrFor.id)?.note, `จากคำขอตรวจ ${r.id} (${r.title}) เกณฑ์ ${ncrFor.criteria}`].filter(Boolean).join("\n"),
            location: r.location,
            disc: tpl.disc,
            responsible: r.requestedBy,
            photos: recOf(ncrFor.id)?.photos ?? [],
            inspectionRequestId: r.id,
          }}
          onClose={() => setNcrFor(null)}
          onSaved={(id) => inspectionRequests.upsert({ ...(inspectionRequests.get(r.id) ?? r), ncrId: id })}
        />
      )}

      <article className="ops-print hidden bg-white text-ink print:block">
        <DocHeader title="ใบขอตรวจงานและผลการตรวจ" titleEn="REQUEST FOR INSPECTION" code={r.id} meta={<p>นัดตรวจ {thDate(r.date)} {r.time && `${r.time} น.`}</p>} />
        <DocSection n={1} title="ข้อมูลงานที่ขอตรวจ" en="WORK">
          <div className="grid grid-cols-2 gap-x-6">
            <DocRow k="โครงการ">
              {r.projectId} · {p?.name}
            </DocRow>
            <DocRow k="งาน">{r.title}</DocRow>
            <DocRow k="ตำแหน่ง">{r.location}</DocRow>
            <DocRow k="แผนตรวจสอบ">ITP {tpl.name} ({tpl.workType})</DocRow>
            <DocRow k="ผู้ขอตรวจ">{r.requestedBy}</DocRow>
            <DocRow k="ผลการตรวจ">{INSP_REQ_STATUS_LABEL[r.status]}</DocRow>
          </div>
        </DocSection>
        <DocSection n={2} title="ผลการตรวจรายขั้น" en="INSPECTION & TEST PLAN">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-ink-3 text-ink-3">
                <th className="w-6 py-1 font-normal">ขั้น</th>
                <th className="w-8 py-1 font-normal">จุด</th>
                <th className="py-1 font-normal">รายการตรวจ / เกณฑ์</th>
                <th className="w-16 py-1 font-normal">ผล</th>
                <th className="py-1 font-normal">ผู้ตรวจ</th>
                <th className="py-1 font-normal">หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              {tpl.steps.map((st, i) => {
                const rec = recOf(st.id);
                return (
                  <tr key={st.id} className="border-b border-line align-top">
                    <td className="py-1 font-mono">{i + 1}</td>
                    <td className="py-1 font-mono">{st.point}</td>
                    <td className="py-1">
                      {st.text}
                      <span className="block text-ink-3">{st.criteria}</span>
                    </td>
                    <td className={cx("py-1", rec?.result === "fail" && "text-neg")}>{rec?.result ? RESULT_LABEL[rec.result] : "–"}</td>
                    <td className="py-1">
                      {rec?.by}
                      {rec?.at && <span className="block text-ink-3">{thDT(rec.at)}</span>}
                    </td>
                    <td className="py-1 text-ink-2">{rec?.note}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-[12px] text-ink-3">H = Hold point ต้องได้รับอนุมัติก่อนทำขั้นต่อไป · W = Witness แจ้งผู้ควบคุมงานร่วมตรวจ · R = ตรวจเอกสาร/บันทึก</p>
        </DocSection>
        <div className="avoid-break mt-10 grid grid-cols-3 gap-8">
          <SigImg role="ผู้ขอตรวจ" name={r.requestedBy} date={r.requestedAt} />
          <SigImg role="ผู้ตรวจ (QC)" name={r.steps.find((s) => s.by && s.by !== r.signedBy)?.by} />
          <SigImg role="ผู้ควบคุมงาน" sig={r.signature} name={r.signedBy ?? r.inspector} date={r.signedAt} />
        </div>
      </article>
    </>
  );
}

// ---------- ITP template manager ----------

function TemplateManager({ onClose, canEdit }: { onClose: () => void; canEdit: boolean }) {
  const tpls = itpTemplates.use();
  const reqs = inspectionRequests.use();
  const [sel, setSel] = useState(tpls[0]?.id ?? "");
  const cur = tpls.find((t) => t.id === sel);
  const [draft, setDraft] = useState<ItpTemplate | undefined>(cur);
  const [dirty, setDirty] = useState(false);
  const pick = (id: string) => {
    setSel(id);
    setDraft(tpls.find((t) => t.id === id));
    setDirty(false);
  };
  const edit = (fn: (t: ItpTemplate) => ItpTemplate) => {
    setDraft((t) => (t ? fn(t) : t));
    setDirty(true);
  };
  const setStep = (i: number, patch: Partial<ItpStep>) => edit((t) => ({ ...t, steps: t.steps.map((s, k) => (k === i ? { ...s, ...patch } : s)) }));
  const move = (i: number, dir: -1 | 1) =>
    edit((t) => {
      const steps = [...t.steps];
      const j = i + dir;
      if (j < 0 || j >= steps.length) return t;
      [steps[i], steps[j]] = [steps[j], steps[i]];
      return { ...t, steps };
    });
  const addTpl = () => {
    let n = tpls.length + 1;
    while (tpls.some((t) => t.id === `ITP-C${n}`)) n++;
    const t: ItpTemplate = { id: `ITP-C${n}`, name: "แผนตรวจใหม่", workType: "งานทั่วไป", disc: "A", steps: [{ id: `C${n}-1`, text: "", criteria: "", point: "W" }] };
    itpTemplates.upsert(t);
    setSel(t.id);
    setDraft(t);
    setDirty(false);
  };
  const used = draft ? reqs.filter((r) => r.templateId === draft.id).length : 0;
  return (
    <Modal open onClose={onClose} title="แม่แบบแผนการตรวจสอบ (ITP)" width={980}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_1fr]">
        <div className="flex flex-col gap-1">
          {tpls.map((t) => (
            <button key={t.id} type="button" onClick={() => pick(t.id)} className={cx("rounded-[8px] px-3 py-2 text-left text-[13px] transition-colors duration-150", t.id === sel ? "bg-raised text-ink" : "text-ink-2 hover:bg-raised/60")}>
              {t.name}
              <span className="block font-mono text-[11px] text-ink-3">
                {t.id} · {t.steps.length} ขั้น · H {t.steps.filter((s) => s.point === "H").length}
              </span>
            </button>
          ))}
          {canEdit && (
            <Btn small onClick={addTpl}>
              <Plus {...I} />
              เพิ่มแม่แบบ
            </Btn>
          )}
        </div>
        {draft ? (
          <div className="min-w-0">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="ชื่อแผน">
                <input disabled={!canEdit} value={draft.name} onChange={(e) => edit((t) => ({ ...t, name: e.target.value }))} className={inputCls} />
              </Field>
              <Field label="ประเภทงาน">
                <input disabled={!canEdit} value={draft.workType} onChange={(e) => edit((t) => ({ ...t, workType: e.target.value }))} className={inputCls} />
              </Field>
              <Field label="หมวดงาน">
                <Select label="หมวดงาน" value={draft.disc} onChange={(v) => edit((t) => ({ ...t, disc: v as Disc }))}>
                  {DISCS.map((k) => (
                    <option key={k} value={k}>
                      {DISC_LABEL[k]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {draft.steps.map((s, i) => (
                <div key={s.id} className="grid grid-cols-[24px_1fr] items-start gap-2 rounded-[10px] border border-line p-2 sm:grid-cols-[24px_1fr_1fr_130px_auto]">
                  <span className="pt-2 font-mono text-[12px] text-ink-3">{i + 1}</span>
                  <input disabled={!canEdit} value={s.text} onChange={(e) => setStep(i, { text: e.target.value })} placeholder="รายการตรวจ" className={cx(inputCls, "h-8 text-[13px]")} />
                  <input disabled={!canEdit} value={s.criteria} onChange={(e) => setStep(i, { criteria: e.target.value })} placeholder="เกณฑ์ยอมรับ" className={cx(inputCls, "h-8 text-[13px]")} />
                  <select disabled={!canEdit} value={s.point} onChange={(e) => setStep(i, { point: e.target.value as PointType })} aria-label="ชนิดจุดตรวจ" className={cx(inputCls, "h-8 text-[13px]")}>
                    {(Object.keys(POINT_LABEL) as PointType[]).map((k) => (
                      <option key={k} value={k}>
                        {k} · {POINT_LABEL[k]}
                      </option>
                    ))}
                  </select>
                  {canEdit && (
                    <span className="flex">
                      <IconBtn label="เลื่อนขึ้น" onClick={() => move(i, -1)}>
                        <ArrowUp {...I} />
                      </IconBtn>
                      <IconBtn label="เลื่อนลง" onClick={() => move(i, 1)}>
                        <ArrowDown {...I} />
                      </IconBtn>
                      <IconBtn label="ลบขั้น" danger onClick={() => edit((t) => ({ ...t, steps: t.steps.filter((_, k) => k !== i) }))}>
                        <Trash2 {...I} />
                      </IconBtn>
                    </span>
                  )}
                </div>
              ))}
            </div>
            {canEdit && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Btn
                  small
                  onClick={() =>
                    edit((t) => {
                      let k = t.steps.length + 1;
                      while (t.steps.some((s) => s.id === `${t.id}-${k}`)) k++;
                      return { ...t, steps: [...t.steps, { id: `${t.id}-${k}`, text: "", criteria: "", point: "W" }] };
                    })
                  }
                >
                  <Plus {...I} />
                  เพิ่มขั้นตอน
                </Btn>
                <span className="flex-1" />
                <Btn
                  small
                  danger
                  disabled={used > 0}
                  title={used ? `ใช้อยู่ใน ${used} คำขอ` : undefined}
                  onClick={() => {
                    if (!window.confirm(`ลบแม่แบบ ${draft.name}`)) return;
                    itpTemplates.remove(draft.id);
                    pick(tpls.find((t) => t.id !== draft.id)?.id ?? "");
                  }}
                >
                  ลบแม่แบบ
                </Btn>
                <Btn
                  small
                  primary
                  disabled={!dirty}
                  onClick={() => {
                    itpTemplates.upsert({ ...draft, steps: draft.steps.filter((s) => s.text.trim()) });
                    setDirty(false);
                  }}
                >
                  บันทึกแม่แบบ
                </Btn>
              </div>
            )}
            <p className="mt-3 text-[12px] text-ink-3">ขั้นตอนเรียงตามลำดับการทำงาน Hold point (H) ต้องได้รับอนุมัติจากผู้ควบคุมงานก่อนบันทึกขั้นถัดไป การแก้แม่แบบมีผลกับคำขอตรวจที่ใช้แม่แบบนี้</p>
          </div>
        ) : (
          <Empty>เลือกแม่แบบทางซ้าย</Empty>
        )}
      </div>
    </Modal>
  );
}
