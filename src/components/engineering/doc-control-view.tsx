"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCheck, FilePlus2, Plus, Printer, Send, X } from "lucide-react";
import { Card, cx, Field, inputCls } from "@/components/ui";
import { Btn, Empty, FilterField, I, Modal, Pill, PrintStyle, Select, StatCard, useHydrated, type Tone } from "@/components/ops/bits";
import { MediaField } from "@/components/media/media-field";
import { SignaturePad } from "@/components/media/signature-pad";
import { thDate, TODAY } from "@/lib/data";
import {
  controlledDocs,
  DISC_LABEL,
  DISCS,
  DOC_KIND_LABEL,
  DOC_STATUS_LABEL,
  nextPlainId,
  nextSeries,
  nowIso,
  PURPOSE_LABEL,
  transmittals,
  WF_LABEL,
  type ControlledDoc,
  type Disc,
  type DocKind,
  type DocRevision,
  type DocStatus,
  type Transmittal,
  type TransmittalPurpose,
} from "@/lib/engineering";
import { Area, DocHeader, DocRow, DocSection, Heading, pname, PeopleList, ProjectSelect, rowCls, SearchBox, SigImg, Tabs, td, th, thDT, useEngPerms } from "./bits";

export const DOC_STATUS_TONE: Record<DocStatus, Tone> = { prelim: "neutral", approval: "warn", afc: "pos", superseded: "neutral", asbuilt: "accent" };
export const current = (d: ControlledDoc) => d.revs[d.revs.length - 1];

/** "อนุมัติก่อสร้าง" stamp shown on approved-for-construction documents */
export function AfcStamp({ small }: { small?: boolean }) {
  return (
    <span className={cx("inline-flex items-center rounded-[4px] border-2 border-pos font-medium text-pos", small ? "h-5 px-1.5 text-[11px]" : "h-7 rotate-[-4deg] px-2.5 text-[13px]")}>
      อนุมัติก่อสร้าง
    </span>
  );
}

export function DocStatusPill({ s }: { s: DocStatus }) {
  return <Pill tone={DOC_STATUS_TONE[s]}>{DOC_STATUS_LABEL[s]}</Pill>;
}

type Tab = "register" | "transmittals";

export function DocControlView() {
  const sp = useSearchParams();
  return <Inner key={sp.toString()} initTab={sp.get("tab") === "transmittals" ? "transmittals" : "register"} initProject={sp.get("project") ?? ""} initQ={sp.get("q") ?? ""} />;
}

function Inner({ initTab, initProject, initQ }: { initTab: Tab; initProject: string; initQ: string }) {
  const router = useRouter();
  const perms = useEngPerms();
  const docs = controlledDocs.use();
  const trs = transmittals.use();
  const [tab, setTab] = useState<Tab>(initTab);
  const [q, setQ] = useState(initQ);
  const [project, setProject] = useState(initProject);
  const [disc, setDisc] = useState("");
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [trOpen, setTrOpen] = useState(false);
  const [trView, setTrView] = useState<string | null>(null);

  const inProject = useMemo(() => docs.filter((d) => !project || d.projectId === project), [docs, project]);
  const stats = useMemo(() => {
    const cur = inProject.map(current);
    return {
      total: inProject.length,
      afc: cur.filter((r) => r.status === "afc").length,
      waiting: cur.filter((r) => r.wf === "submitted" || r.wf === "reviewed").length,
      superseded: inProject.reduce((s, d) => s + d.revs.filter((r) => r.status === "superseded").length, 0),
      asbuilt: cur.filter((r) => r.status === "asbuilt").length,
    };
  }, [inProject]);

  const needle = q.trim().toLowerCase();
  const rows = useMemo(
    () =>
      inProject
        .filter((d) => !disc || d.disc === disc)
        .filter((d) => !kind || d.kind === kind)
        .filter((d) => {
          const r = current(d);
          if (!status) return true;
          if (status === "waiting") return r.wf === "submitted" || r.wf === "reviewed";
          return r.status === status;
        })
        .filter((d) => !needle || `${d.id} ${d.number} ${d.title} ${d.projectId} ${pname(d.projectId)}`.toLowerCase().includes(needle))
        .sort((a, b) => a.projectId.localeCompare(b.projectId) || a.number.localeCompare(b.number)),
    [inProject, disc, kind, status, needle],
  );
  const trRows = useMemo(
    () =>
      trs
        .filter((t) => !project || t.projectId === project)
        .filter((t) => !needle || `${t.id} ${t.to} ${t.attn ?? ""} ${pname(t.projectId)}`.toLowerCase().includes(needle))
        .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
    [trs, project, needle],
  );
  const filtered = q || project || disc || status || kind;
  const viewing = trView ? trs.find((t) => t.id === trView) : undefined;

  return (
    <>
      <Heading
        title="ทะเบียนแบบ & เอกสาร"
        sub="ทะเบียนแบบและเอกสารควบคุมของแต่ละโครงการ ฉบับแก้ไข การอนุมัติก่อนใช้ก่อสร้าง การเปรียบเทียบฉบับ หมุดความเห็นบนแบบ และใบนำส่งเอกสาร"
        actions={
          perms.edit && (
            <>
              <Btn onClick={() => setTrOpen(true)}>
                <Send {...I} />
                ใบนำส่งเอกสาร
              </Btn>
              <Btn primary onClick={() => setAddOpen(true)}>
                <Plus {...I} />
                เพิ่มเอกสาร
              </Btn>
            </>
          )
        }
      />

      <div className="ops-noprint mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="เอกสารในทะเบียน" value={stats.total} note={project ? pname(project) : "ทุกโครงการ"} active={tab === "register" && !status} onClick={() => (setTab("register"), setStatus(""))} />
        <StatCard label="อนุมัติก่อสร้าง" value={stats.afc} note="ฉบับปัจจุบันใช้ก่อสร้างได้" active={status === "afc"} onClick={() => (setTab("register"), setStatus(status === "afc" ? "" : "afc"))} />
        <StatCard label="รออนุมัติ" value={stats.waiting} note="ส่งตรวจ / ตรวจแล้วรออนุมัติ" tone={stats.waiting ? "warn" : undefined} active={status === "waiting"} onClick={() => (setTab("register"), setStatus(status === "waiting" ? "" : "waiting"))} />
        <StatCard label="ฉบับที่ถูกแทนที่" value={stats.superseded} note="ห้ามใช้ก่อสร้าง" />
        <StatCard label="ใบนำส่งเอกสาร" value={trs.filter((t) => !project || t.projectId === project).length} note={`รอตอบรับ ${trs.filter((t) => (!project || t.projectId === project) && !t.ackAt).length}`} active={tab === "transmittals"} onClick={() => setTab("transmittals")} />
      </div>

      <Card className="ops-noprint mb-4">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { key: "register", label: "ทะเบียนเอกสาร", count: inProject.length },
            { key: "transmittals", label: "ใบนำส่งเอกสาร", count: trRows.length },
          ]}
        />
        <div className="grid grid-cols-2 gap-3 px-4 py-3 lg:grid-cols-6">
          <SearchBox value={q} onChange={setQ} placeholder="เลขที่แบบ ชื่อเอกสาร ผู้รับ" className="col-span-2" />
          <FilterField label="โครงการ">
            <ProjectSelect value={project} onChange={setProject} />
          </FilterField>
          {tab === "register" && (
            <>
              <FilterField label="หมวดงาน">
                <Select label="หมวดงาน" value={disc} onChange={setDisc}>
                  <option value="">ทุกหมวด</option>
                  {DISCS.map((k) => (
                    <option key={k} value={k}>
                      {DISC_LABEL[k]}
                    </option>
                  ))}
                </Select>
              </FilterField>
              <FilterField label="สถานะ">
                <Select label="สถานะ" value={status} onChange={setStatus}>
                  <option value="">ทุกสถานะ</option>
                  <option value="waiting">รออนุมัติ</option>
                  {(Object.keys(DOC_STATUS_LABEL) as DocStatus[]).map((k) => (
                    <option key={k} value={k}>
                      {DOC_STATUS_LABEL[k]}
                    </option>
                  ))}
                </Select>
              </FilterField>
              <FilterField label="ประเภท">
                <Select label="ประเภท" value={kind} onChange={setKind}>
                  <option value="">ทุกประเภท</option>
                  {(Object.keys(DOC_KIND_LABEL) as DocKind[]).map((k) => (
                    <option key={k} value={k}>
                      {DOC_KIND_LABEL[k]}
                    </option>
                  ))}
                </Select>
              </FilterField>
            </>
          )}
        </div>
        <div className="flex items-center gap-3 border-t border-line px-4 py-2 text-[13px] text-ink-3">
          <span className="num font-mono text-[12px]">{tab === "register" ? rows.length : trRows.length} รายการ</span>
          {filtered && (
            <button type="button" onClick={() => (setQ(""), setProject(""), setDisc(""), setStatus(""), setKind(""))} className="inline-flex items-center gap-1 text-ink-2 hover:text-ink">
              <X {...I} />
              ล้างตัวกรอง
            </button>
          )}
        </div>
      </Card>

      <Card className="ops-noprint">
        <div className="overflow-x-auto">
          {tab === "register" ? (
            rows.length === 0 ? (
              <Empty>ไม่พบเอกสารตามตัวกรอง</Empty>
            ) : (
              <table className="w-full min-w-[880px]">
                <thead>
                  <tr>
                    <th className={th}>เลขที่</th>
                    <th className={th}>ชื่อเอกสาร</th>
                    <th className={th}>หมวด · ประเภท</th>
                    <th className={th}>ฉบับ</th>
                    <th className={th}>วันที่</th>
                    <th className={th}>สถานะ</th>
                    <th className={th}>การอนุมัติ</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((d) => {
                    const r = current(d);
                    return (
                      <tr key={d.id} className={rowCls} onClick={() => router.push(`/doc-control/${d.id}`)}>
                        <td className={td}>
                          <span className="font-mono text-[13px]">{d.number}</span>
                          <span className="block font-mono text-[11px] text-ink-3">{d.projectId}</span>
                        </td>
                        <td className={td}>
                          <span className="block max-w-[320px] truncate">{d.title}</span>
                          {!project && <span className="block max-w-[320px] truncate text-[12px] text-ink-3">{pname(d.projectId)}</span>}
                        </td>
                        <td className={cx(td, "text-[13px] text-ink-2")}>
                          {DISC_LABEL[d.disc]}
                          <span className="block text-[12px] text-ink-3">{DOC_KIND_LABEL[d.kind]}</span>
                        </td>
                        <td className={td}>
                          <span className="font-mono text-[13px]">Rev.{r.rev}</span>
                          <span className="block text-[12px] text-ink-3">{d.revs.length} ฉบับ</span>
                        </td>
                        <td className={cx(td, "num font-mono text-[13px] text-ink-2")}>{thDate(r.date)}</td>
                        <td className={td}>{r.status === "afc" ? <AfcStamp small /> : <DocStatusPill s={r.status} />}</td>
                        <td className={cx(td, "text-[13px] text-ink-2")}>
                          {WF_LABEL[r.wf]}
                          {r.approvedBy && <span className="block text-[12px] text-ink-3">{r.approvedBy}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          ) : trRows.length === 0 ? (
            <Empty>ยังไม่มีใบนำส่งเอกสาร</Empty>
          ) : (
            <table className="w-full min-w-[820px]">
              <thead>
                <tr>
                  <th className={th}>เลขที่</th>
                  <th className={th}>วันที่</th>
                  <th className={th}>ถึง</th>
                  <th className={th}>วัตถุประสงค์</th>
                  <th className={th}>เอกสาร</th>
                  <th className={th}>ตอบรับ</th>
                </tr>
              </thead>
              <tbody>
                {trRows.map((t) => (
                  <tr key={t.id} className={rowCls} onClick={() => setTrView(t.id)}>
                    <td className={td}>
                      <span className="font-mono text-[12px] text-accent-text">{t.id}</span>
                      <span className="block max-w-[220px] truncate text-[12px] text-ink-3">{pname(t.projectId)}</span>
                    </td>
                    <td className={cx(td, "num font-mono text-[13px] text-ink-2")}>{thDate(t.date)}</td>
                    <td className={td}>
                      <span className="block max-w-[260px] truncate">{t.to}</span>
                      {t.attn && <span className="block text-[12px] text-ink-3">เรียน {t.attn}</span>}
                    </td>
                    <td className={cx(td, "text-[13px]")}>{PURPOSE_LABEL[t.purpose]}</td>
                    <td className={cx(td, "num font-mono text-[13px]")}>{t.items.length}</td>
                    <td className={td}>{t.ackAt ? <Pill tone="pos">รับแล้ว {thDate(t.ackAt.slice(0, 10))}</Pill> : <Pill tone="warn">รอตอบรับ</Pill>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      <AddDocModal open={addOpen} onClose={() => setAddOpen(false)} defaultProject={project} onCreated={(id) => router.push(`/doc-control/${id}`)} />
      <TransmittalForm open={trOpen} onClose={() => setTrOpen(false)} defaultProject={project} onCreated={(id) => (setTab("transmittals"), setTrView(id))} />
      {viewing && <TransmittalPanel key={viewing.id} t={viewing} onClose={() => setTrView(null)} />}
    </>
  );
}

// ---------- add document ----------

function AddDocModal({ open, onClose, defaultProject, onCreated }: { open: boolean; onClose: () => void; defaultProject: string; onCreated: (id: string) => void }) {
  const { me } = useEngPerms();
  const [projectId, setProjectId] = useState(defaultProject);
  const [number, setNumber] = useState("");
  const [title, setTitle] = useState("");
  const [disc, setDisc] = useState<Disc>("A");
  const [kind, setKind] = useState<DocKind>("drawing");
  const [rev, setRev] = useState("A");
  const [status, setStatus] = useState<DocStatus>("prelim");
  const [date, setDate] = useState(TODAY);
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<DocRevision["files"]>([]);
  const ok = projectId && number.trim() && title.trim() && rev.trim();
  const save = () => {
    if (!ok) return;
    const id = nextPlainId(controlledDocs.all(), "DC", projectId);
    const r: DocRevision = { id: `${number.trim()}-${rev.trim()}-${Date.now().toString(36)}`, rev: rev.trim(), date, status, note: note.trim() || undefined, by: me.name, files, wf: "draft", pins: [] };
    controlledDocs.upsert({ id, projectId, number: number.trim(), title: title.trim(), disc, kind, revs: [r] });
    onClose();
    setNumber("");
    setTitle("");
    setNote("");
    setFiles([]);
    onCreated(id);
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="เพิ่มเอกสารในทะเบียน"
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
        <div className="sm:col-span-2">
          <Field label="โครงการ">
            <ProjectSelect value={projectId} onChange={setProjectId} required />
          </Field>
        </div>
        <Field label="เลขที่แบบ/เอกสาร">
          <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="A-101" className={cx(inputCls, "font-mono")} />
        </Field>
        <Field label="ชื่อเอกสาร">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="แปลนพื้นชั้น 1" className={inputCls} />
        </Field>
        <Field label="หมวดงาน">
          <Select label="หมวดงาน" value={disc} onChange={(v) => setDisc(v as Disc)}>
            {DISCS.map((k) => (
              <option key={k} value={k}>
                {DISC_LABEL[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="ประเภท">
          <Select label="ประเภท" value={kind} onChange={(v) => setKind(v as DocKind)}>
            {(Object.keys(DOC_KIND_LABEL) as DocKind[]).map((k) => (
              <option key={k} value={k}>
                {DOC_KIND_LABEL[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="ฉบับแรก (Rev.)">
          <input value={rev} onChange={(e) => setRev(e.target.value)} className={cx(inputCls, "font-mono")} />
        </Field>
        <Field label="สถานะ">
          <Select label="สถานะ" value={status} onChange={(v) => setStatus(v as DocStatus)}>
            {(["prelim", "approval", "asbuilt"] as DocStatus[]).map((k) => (
              <option key={k} value={k}>
                {DOC_STATUS_LABEL[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="วันที่">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={cx(inputCls, "font-mono")} />
        </Field>
        <Field label="หมายเหตุ">
          <input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} />
        </Field>
        <div className="sm:col-span-2">
          <MediaField value={files} onChange={setFiles} label="ไฟล์แบบ (PDF, DXF, รูป, IFC)" accept="image/*,application/pdf,.dxf,.dwg,.ifc" geotag={false} />
        </div>
      </div>
      <p className="mt-3 text-[12px] text-ink-3">ฉบับที่อนุมัติก่อสร้างต้องผ่านขั้นตอน ส่งตรวจ → ตรวจ → อนุมัติ ในหน้ารายละเอียดเอกสาร</p>
    </Modal>
  );
}

// ---------- transmittals ----------

function TransmittalForm({ open, onClose, defaultProject, onCreated }: { open: boolean; onClose: () => void; defaultProject: string; onCreated: (id: string) => void }) {
  const { me } = useEngPerms();
  const docs = controlledDocs.use();
  const [projectId, setProjectId] = useState(defaultProject);
  const [to, setTo] = useState("");
  const [attn, setAttn] = useState("");
  const [purpose, setPurpose] = useState<TransmittalPurpose>("construction");
  const [date, setDate] = useState(TODAY);
  const [note, setNote] = useState("");
  const [picked, setPicked] = useState<Record<string, { revId: string; copies: number }>>({});
  const list = docs.filter((d) => d.projectId === projectId).sort((a, b) => a.number.localeCompare(b.number));
  const items = Object.entries(picked).map(([docId, v]) => ({ docId, ...v }));
  const ok = projectId && to.trim() && items.length > 0;
  const toggle = (d: ControlledDoc, on: boolean) =>
    setPicked((p) => {
      const n = { ...p };
      if (on) n[d.id] = { revId: current(d).id, copies: 1 };
      else delete n[d.id];
      return n;
    });
  const save = () => {
    if (!ok) return;
    const { id, no } = nextSeries(transmittals.all(), "TR", projectId);
    transmittals.upsert({ id, projectId, no, date, to: to.trim(), attn: attn.trim() || undefined, purpose, items, note: note.trim() || undefined, sentBy: me.name });
    onClose();
    setPicked({});
    setTo("");
    setAttn("");
    setNote("");
    onCreated(id);
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      width={760}
      title="ออกใบนำส่งเอกสาร"
      footer={
        <>
          <span className="mr-auto text-[13px] text-ink-3">เลือก {items.length} เอกสาร</span>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!ok} onClick={save}>
            <Send {...I} />
            บันทึกใบนำส่ง
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="โครงการ">
            <ProjectSelect value={projectId} onChange={(v) => (setProjectId(v), setPicked({}))} required />
          </Field>
        </div>
        <Field label="ถึง (บริษัท / หน่วยงาน)">
          <input value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} />
        </Field>
        <Field label="เรียน">
          <input value={attn} onChange={(e) => setAttn(e.target.value)} list="eng-people" className={inputCls} />
        </Field>
        <Field label="วัตถุประสงค์">
          <Select label="วัตถุประสงค์" value={purpose} onChange={(v) => setPurpose(v as TransmittalPurpose)}>
            {(Object.keys(PURPOSE_LABEL) as TransmittalPurpose[]).map((k) => (
              <option key={k} value={k}>
                {PURPOSE_LABEL[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="วันที่ส่ง">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={cx(inputCls, "font-mono")} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="หมายเหตุ">
            <Area value={note} onChange={setNote} rows={2} />
          </Field>
        </div>
      </div>
      <PeopleList />
      <div className="mt-4 max-h-[320px] overflow-y-auto rounded-[10px] border border-line">
        {!projectId ? (
          <p className="px-4 py-6 text-center text-[13px] text-ink-3">เลือกโครงการก่อน</p>
        ) : list.length === 0 ? (
          <p className="px-4 py-6 text-center text-[13px] text-ink-3">โครงการนี้ยังไม่มีเอกสารในทะเบียน</p>
        ) : (
          <ul>
            {list.map((d) => {
              const p = picked[d.id];
              return (
                <li key={d.id} className="flex flex-wrap items-center gap-2 border-t border-line px-3 py-2 first:border-t-0">
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-[13px]">
                    <input type="checkbox" checked={!!p} onChange={(e) => toggle(d, e.target.checked)} className="size-4 accent-[var(--ink)]" />
                    <span className="font-mono text-[12px]">{d.number}</span>
                    <span className="truncate">{d.title}</span>
                  </label>
                  {p && (
                    <>
                      <select aria-label="ฉบับ" value={p.revId} onChange={(e) => setPicked((x) => ({ ...x, [d.id]: { ...p, revId: e.target.value } }))} className={cx(inputCls, "h-8 text-[13px]")}>
                        {d.revs.map((r) => (
                          <option key={r.id} value={r.id}>
                            Rev.{r.rev} · {DOC_STATUS_LABEL[r.status]}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        aria-label="จำนวนชุด"
                        value={p.copies}
                        onChange={(e) => setPicked((x) => ({ ...x, [d.id]: { ...p, copies: Math.max(1, Number(e.target.value) || 1) } }))}
                        className={cx(inputCls, "h-8 w-16 font-mono text-[13px]")}
                      />
                      <span className="text-[12px] text-ink-3">ชุด</span>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}

function TransmittalPanel({ t, onClose }: { t: Transmittal; onClose: () => void }) {
  const perms = useEngPerms();
  const docs = controlledDocs.use();
  const hydrated = useHydrated();
  const [ackName, setAckName] = useState("");
  const [acking, setAcking] = useState(false);
  const lines = t.items.map((it) => {
    const d = docs.find((x) => x.id === it.docId);
    const r = d?.revs.find((x) => x.id === it.revId);
    return { ...it, d, r };
  });
  const ack = (name: string, sig?: Transmittal["ackSignature"]) => {
    transmittals.upsert({ ...t, ackBy: name, ackAt: nowIso(), ackSignature: sig });
    setAcking(false);
  };
  return (
    <>
      <PrintStyle />
      <Modal
        open
        onClose={onClose}
        width={760}
        title={`ใบนำส่งเอกสาร ${t.id}`}
        footer={
          <>
            <Btn onClick={() => window.print()}>
              <Printer {...I} />
              พิมพ์
            </Btn>
            <Btn onClick={onClose}>ปิด</Btn>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-x-6 text-[13px] sm:grid-cols-2">
          <DocRow k="โครงการ">{pname(t.projectId)}</DocRow>
          <DocRow k="วันที่ส่ง">{thDate(t.date)}</DocRow>
          <DocRow k="ถึง">{t.to}</DocRow>
          <DocRow k="เรียน">{t.attn ?? "–"}</DocRow>
          <DocRow k="วัตถุประสงค์">{PURPOSE_LABEL[t.purpose]}</DocRow>
          <DocRow k="ผู้ส่ง">{t.sentBy}</DocRow>
        </div>
        <table className="mt-4 w-full text-left text-[13px]">
          <thead>
            <tr className="text-ink-3">
              <th className="py-1.5 pr-3 font-normal">เลขที่</th>
              <th className="py-1.5 pr-3 font-normal">ชื่อเอกสาร</th>
              <th className="py-1.5 pr-3 font-normal">ฉบับ</th>
              <th className="py-1.5 font-normal">ชุด</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.docId} className="border-t border-line">
                <td className="py-1.5 pr-3 font-mono text-[12px]">{l.d?.number ?? l.docId}</td>
                <td className="py-1.5 pr-3">{l.d?.title ?? "เอกสารถูกลบ"}</td>
                <td className="py-1.5 pr-3 font-mono text-[12px]">{l.r ? `Rev.${l.r.rev}` : "–"}</td>
                <td className="num py-1.5 font-mono">{l.copies}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {t.note && <p className="mt-3 text-[13px] text-ink-2">หมายเหตุ {t.note}</p>}
        <div className="mt-4 rounded-[10px] border border-line px-4 py-3">
          {t.ackAt ? (
            <p className="flex items-center gap-2 text-[13px] text-pos">
              <CheckCheck {...I} />
              ผู้รับลงนามรับแล้ว · {t.ackBy} · {hydrated ? thDT(t.ackAt) : thDate(t.ackAt.slice(0, 10))}
            </p>
          ) : acking ? (
            <div className="flex flex-col gap-2">
              <p className="text-[13px] text-ink-2">ผู้รับเอกสารลงนามรับ</p>
              <SignaturePad nameLabel="ชื่อผู้รับเอกสาร" onSave={(ref, signer) => ack(signer, ref)} />
              <div className="flex flex-wrap items-center gap-2 border-t border-line pt-2">
                <input value={ackName} onChange={(e) => setAckName(e.target.value)} placeholder="หรือบันทึกชื่อผู้รับโดยไม่เซ็น" className={cx(inputCls, "h-8 flex-1 text-[13px]")} />
                <Btn small disabled={!ackName.trim()} onClick={() => ack(ackName.trim())}>
                  บันทึกการรับ
                </Btn>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] text-ink-3">ยังไม่มีการตอบรับเอกสาร</p>
              {perms.edit && (
                <Btn small onClick={() => setAcking(true)}>
                  <FilePlus2 {...I} />
                  บันทึกการตอบรับ
                </Btn>
              )}
            </div>
          )}
        </div>
      </Modal>

      <article className="ops-print hidden bg-white text-ink print:block">
        <DocHeader title="ใบนำส่งเอกสาร" titleEn="DOCUMENT TRANSMITTAL" code={t.id} meta={<p>วันที่ {thDate(t.date)}</p>} />
        <DocSection n={1} title="รายละเอียดการนำส่ง" en="TRANSMITTAL">
          <div className="grid grid-cols-2 gap-x-6">
            <DocRow k="โครงการ">
              {t.projectId} · {pname(t.projectId)}
            </DocRow>
            <DocRow k="วัตถุประสงค์">{PURPOSE_LABEL[t.purpose]}</DocRow>
            <DocRow k="ถึง">{t.to}</DocRow>
            <DocRow k="เรียน">{t.attn ?? "–"}</DocRow>
            <DocRow k="ผู้ส่ง">{t.sentBy}</DocRow>
            <DocRow k="หมายเหตุ">{t.note ?? "–"}</DocRow>
          </div>
        </DocSection>
        <DocSection n={2} title="รายการเอกสาร" en="DOCUMENTS">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-ink-3 text-ink-3">
                <th className="w-8 py-1 font-normal">ที่</th>
                <th className="py-1 font-normal">เลขที่</th>
                <th className="py-1 font-normal">ชื่อเอกสาร</th>
                <th className="py-1 font-normal">ฉบับ</th>
                <th className="py-1 font-normal">สถานะ</th>
                <th className="py-1 font-normal">ชุด</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={l.docId} className="border-b border-line">
                  <td className="py-1 font-mono">{i + 1}</td>
                  <td className="py-1 font-mono">{l.d?.number}</td>
                  <td className="py-1">{l.d?.title}</td>
                  <td className="py-1 font-mono">{l.r ? `Rev.${l.r.rev}` : "–"}</td>
                  <td className="py-1">{l.r ? DOC_STATUS_LABEL[l.r.status] : ""}</td>
                  <td className="py-1 font-mono">{l.copies}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DocSection>
        <div className="avoid-break mt-10 grid grid-cols-2 gap-8">
          <SigImg role="ผู้ส่งเอกสาร" name={t.sentBy} date={t.date} />
          <SigImg role="ผู้รับเอกสาร" name={t.ackBy} sig={t.ackSignature} date={t.ackAt} />
        </div>
      </article>
    </>
  );
}
