"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Pencil, Plus, Printer, RotateCcw, Search } from "lucide-react";
import { Card, CardHead, cx, Field, inputCls } from "@/components/ui";
import { Btn, Empty, FilterField, I, Modal, Pill, Select, StatCard, areaCls } from "@/components/ops/bits";
import { PrintSheet } from "@/components/accounting/bits";
import { COMPANY_INFO, TODAY, getProject } from "@/lib/data";
import { COST_CODES, budgets, type CostCode } from "@/lib/biz";
import { resolveSpec, specByCostCode, specSections, specSets, type SpecClause, type SpecSection, type SpecSet } from "@/lib/design";
import { Amt, Check, Header, ProjectSelect, Tabs, dateOr, rowCls, td, th, thR, useAllProjects, usePerms } from "./bits";

export function SpecsView() {
  const sp = useSearchParams();
  const router = useRouter();
  const open = sp.get("project");
  const [tab, setTab] = useState<"sets" | "library">(sp.get("tab") === "library" ? "library" : "sets");
  const go = (projectId?: string) => router.push(projectId ? `/specs?project=${projectId}` : "/specs");
  if (open) return <SetEditor projectId={open} onBack={() => go()} />;
  return (
    <>
      <Header eyebrow="ออกแบบ" title="รายการประกอบแบบ" sub="คลังรายการประกอบแบบมาตรฐานแยกตามหมวดงาน พร้อมยี่ห้อที่อนุมัติและรหัสต้นทุน เลือกใช้เป็นชุดของแต่ละโครงการ ปรับข้อความเฉพาะโครงการ และพิมพ์แนบแบบก่อสร้าง" />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "sets", label: "ชุดของโครงการ" },
          { key: "library", label: "คลังรายการมาตรฐาน" },
        ]}
      />
      {tab === "sets" ? <SetsList onOpen={go} /> : <Library />}
    </>
  );
}

// ---------- project sets ----------

function SetsList({ onOpen }: { onOpen: (projectId: string) => void }) {
  const { edit, me } = usePerms("design");
  const sets = specSets.use();
  const lib = specSections.use();
  const all = useAllProjects();
  const [creating, setCreating] = useState(false);
  const clauses = lib.reduce((t, s) => t + s.clauses.length, 0);
  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="ชุดรายการของโครงการ" value={sets.length} unit="ชุด" />
        <StatCard label="หมวดงานในคลัง" value={lib.length} unit="หมวด" note={`${clauses} ข้อกำหนด`} />
        <StatCard label="ปรับเฉพาะโครงการ" value={sets.reduce((t, s) => t + Object.keys(s.overrides).length, 0)} unit="ข้อ" note="ข้อความ/ยี่ห้อที่ต่างจากมาตรฐาน" />
        <StatCard label="ฉบับร่าง (ยังไม่ออก Rev.1)" value={sets.filter((s) => s.revision === 0).length} unit="ชุด" />
      </div>
      <Card>
        <CardHead
          title="ชุดรายการประกอบแบบ"
          action={
            edit && (
              <Btn small primary onClick={() => setCreating(true)}>
                <Plus {...I} />
                สร้างชุดรายการ
              </Btn>
            )
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead>
              <tr>
                <th className={cx(th, "px-5")}>โครงการ</th>
                <th className={th}>ชื่อชุด</th>
                <th className={thR}>ฉบับ</th>
                <th className={th}>ออกเมื่อ</th>
                <th className={thR}>หมวด</th>
                <th className={thR}>ข้อกำหนด</th>
                <th className={cx(th, "pr-5")}>ผู้จัดทำ</th>
              </tr>
            </thead>
            <tbody>
              {sets.map((s) => {
                const r = resolveSpec(s, lib);
                return (
                  <tr key={s.id} className={cx(rowCls, "cursor-pointer")} onClick={() => onOpen(s.projectId)}>
                    <td className={cx(td, "px-5")}>
                      {getProject(s.projectId)?.name ?? s.projectId}
                      <span className="block font-mono text-[12px] text-ink-3">{s.projectId}</span>
                    </td>
                    <td className={td}>{s.title}</td>
                    <td className={cx(td, "num text-right font-mono")}>{s.revision === 0 ? "ร่าง" : `Rev.${s.revision}`}</td>
                    <td className={td}>{dateOr(s.issuedAt)}</td>
                    <td className={cx(td, "num text-right font-mono")}>{r.length}</td>
                    <td className={cx(td, "num text-right font-mono")}>
                      {r.reduce((t, x) => t + x.clauses.length, 0)}
                      {Object.keys(s.overrides).length > 0 && <span className="ml-1 text-[12px] text-accent-text">({Object.keys(s.overrides).length} ปรับ)</span>}
                    </td>
                    <td className={cx(td, "pr-5")}>{s.preparedBy}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {sets.length === 0 && <Empty>ยังไม่มีชุดรายการของโครงการ</Empty>}
      </Card>
      {creating && (
        <NewSet
          existing={sets.map((s) => s.projectId)}
          projects={all}
          by={me.name}
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            onOpen(id);
          }}
        />
      )}
    </>
  );
}

function NewSet({ existing, projects, by, onClose, onCreated }: { existing: string[]; projects: ReturnType<typeof useAllProjects>; by: string; onClose: () => void; onCreated: (projectId: string) => void }) {
  const lib = specSections.use();
  const free = projects.filter((p) => !existing.includes(p.id));
  const [projectId, setProjectId] = useState(free[0]?.id ?? "");
  const [ids, setIds] = useState<string[]>(lib.map((s) => s.id));
  const save = () => {
    const p = getProject(projectId) ?? projects.find((x) => x.id === projectId);
    specSets.upsert({ id: `SPEC-${projectId}`, projectId, title: `รายการประกอบแบบ ${p?.name ?? projectId}`, revision: 0, issuedAt: TODAY, preparedBy: by, sectionIds: ids, excluded: [], overrides: {} });
    onCreated(projectId);
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="สร้างชุดรายการประกอบแบบ"
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!projectId || !ids.length} onClick={save}>
            สร้าง
          </Btn>
        </>
      }
    >
      <Field label="โครงการ">
        <ProjectSelect value={projectId} onChange={setProjectId} list={free} />
      </Field>
      <p className="mb-1.5 mt-3 text-[13px] text-ink-2">หมวดงานที่ใช้</p>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {lib.map((s) => (
          <Check key={s.id} checked={ids.includes(s.id)} onChange={(on) => setIds(on ? [...ids, s.id] : ids.filter((x) => x !== s.id))} label={`${s.code} ${s.name}`} />
        ))}
      </div>
    </Modal>
  );
}

function SetEditor({ projectId, onBack }: { projectId: string; onBack: () => void }) {
  const { edit, me } = usePerms("design");
  const sets = specSets.use();
  const lib = specSections.use();
  const buds = budgets.use();
  const set = sets.find((s) => s.projectId === projectId);
  const [override, setOverride] = useState<SpecClause | null>(null);
  const [print, setPrint] = useState(false);
  const resolved = useMemo(() => (set ? resolveSpec(set, lib) : []), [set, lib]);
  const byCode = useMemo(() => specByCostCode(resolved), [resolved]);
  if (!set)
    return (
      <Card>
        <Empty>
          ยังไม่มีชุดรายการของ {projectId} ·{" "}
          <button type="button" className="underline-offset-2 hover:underline" onClick={onBack}>
            กลับ
          </button>
        </Empty>
      </Card>
    );
  const p = getProject(projectId);
  const save = (patch: Partial<SpecSet>) => specSets.upsert({ ...set, ...patch });
  const budget = buds.find((b) => b.projectId === projectId);
  const codes = [...new Set([...byCode.keys(), ...(budget?.lines.map((l) => l.costCode) ?? [])])].sort() as CostCode[];
  return (
    <>
      <Header
        eyebrow={`รายการประกอบแบบ · ${projectId}`}
        title={set.title}
        sub={`${p?.name ?? projectId} · ${set.revision === 0 ? "ฉบับร่าง" : `ฉบับที่ ${set.revision}`} · ออกเมื่อ ${dateOr(set.issuedAt)} · ${set.preparedBy}`}
        actions={
          <>
            <Btn onClick={onBack}>
              <ArrowLeft {...I} />
              ทุกโครงการ
            </Btn>
            {edit && (
              <Btn onClick={() => save({ revision: set.revision + 1, issuedAt: TODAY, preparedBy: me.name })}>
                <RotateCcw {...I} />
                ออก Rev.{set.revision + 1}
              </Btn>
            )}
            <Btn primary onClick={() => setPrint(true)}>
              <Printer {...I} />
              พิมพ์รายการประกอบแบบ
            </Btn>
          </>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-4">
          {lib
            .slice()
            .sort((a, b) => a.code.localeCompare(b.code))
            .map((sec) => {
              const on = set.sectionIds.includes(sec.id);
              return (
                <Card key={sec.id} className={cx(!on && "opacity-60")}>
                  <CardHead
                    title={`${sec.code} ${sec.name}`}
                    meta={sec.costCode ? `รหัสต้นทุน ${sec.costCode}` : undefined}
                    action={edit && <Check checked={on} onChange={(v) => save({ sectionIds: v ? [...set.sectionIds, sec.id] : set.sectionIds.filter((x) => x !== sec.id) })} label="ใช้หมวดนี้" />}
                  />
                  {on && (
                    <ul className="divide-y divide-line">
                      {sec.clauses.map((c) => {
                        const excluded = set.excluded.includes(c.id);
                        const o = set.overrides[c.id];
                        return (
                          <li key={c.id} className={cx("flex gap-3 px-5 py-3", excluded && "opacity-50")}>
                            <span className="num w-12 shrink-0 font-mono text-[12px] text-ink-3">{c.code}</span>
                            <div className="min-w-0 flex-1 text-[13px]">
                              <p className="font-medium">
                                {c.title}
                                {o && <Pill tone="accent">ปรับเฉพาะโครงการ</Pill>}
                              </p>
                              <p className={cx("mt-0.5 text-ink-2", excluded && "line-through")}>{o?.text ?? c.text}</p>
                              {(o?.brands ?? c.brands).length > 0 && (
                                <p className="mt-0.5 text-[12px] text-ink-3">
                                  ยี่ห้อที่อนุมัติ: {(o?.brands ?? c.brands).join(", ")}
                                  {c.equivalents && " หรือเทียบเท่า"}
                                </p>
                              )}
                            </div>
                            {edit && (
                              <div className="flex shrink-0 flex-col items-end gap-1">
                                <Check checked={!excluded} onChange={(v) => save({ excluded: v ? set.excluded.filter((x) => x !== c.id) : [...set.excluded, c.id] })} label="ใช้" />
                                {!excluded && (
                                  <button type="button" onClick={() => setOverride(c)} className="text-[12px] text-accent-text hover:underline">
                                    ปรับข้อความ
                                  </button>
                                )}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Card>
              );
            })}
        </div>
        <div className="flex flex-col gap-4">
          <Card>
            <CardHead title="เชื่อมกับรหัสต้นทุน" meta={budget ? "งบประมาณโครงการ" : "ยังไม่มีงบประมาณ"} />
            <table className="w-full text-left">
              <thead>
                <tr>
                  <th className={cx(th, "px-5")}>รหัส</th>
                  <th className={thR}>ข้อกำหนด</th>
                  <th className={cx(thR, "pr-5")}>งบประมาณ</th>
                </tr>
              </thead>
              <tbody>
                {codes.map((code) => (
                  <tr key={code} className="border-t border-line">
                    <td className={cx(td, "px-5")}>
                      <span className="font-mono text-ink-3">{code}</span> {COST_CODES[code]}
                    </td>
                    <td className={cx(td, "num text-right font-mono", !byCode.get(code) && "text-ink-3")}>{byCode.get(code) ?? 0}</td>
                    <td className={cx(td, "pr-5 text-right")}>{budget ? <Amt n={budget.lines.filter((l) => l.costCode === code).reduce((t, l) => t + l.amount, 0)} /> : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-5 py-3 text-[12px] text-ink-3">รหัสที่มีงบแต่ไม่มีข้อกำหนด ควรเพิ่มรายการประกอบแบบให้ครบก่อนประมูลหรือสั่งซื้อ</p>
          </Card>
          {edit && (
            <Card>
              <CardHead title="ข้อมูลชุดรายการ" />
              <div className="flex flex-col gap-3 px-5 py-4">
                <Field label="ชื่อชุด">
                  <input defaultValue={set.title} onBlur={(e) => e.target.value.trim() && e.target.value !== set.title && save({ title: e.target.value.trim() })} className={inputCls} />
                </Field>
                <Field label="หมายเหตุ">
                  <textarea defaultValue={set.note ?? ""} onBlur={(e) => e.target.value !== (set.note ?? "") && save({ note: e.target.value || undefined })} className={areaCls} />
                </Field>
              </div>
            </Card>
          )}
        </div>
      </div>
      {override && (
        <OverrideModal
          c={override}
          cur={set.overrides[override.id]}
          onClose={() => setOverride(null)}
          onSave={(o) => {
            const next = { ...set.overrides };
            if (o) next[override.id] = o;
            else delete next[override.id];
            save({ overrides: next });
            setOverride(null);
          }}
        />
      )}
      <PrintSheet open={print} onClose={() => setPrint(false)} title="รายการประกอบแบบ">
        <SpecDocument set={set} sections={resolved} />
      </PrintSheet>
    </>
  );
}

function OverrideModal({ c, cur, onClose, onSave }: { c: SpecClause; cur?: { text?: string; brands?: string[] }; onClose: () => void; onSave: (o: { text?: string; brands?: string[] } | null) => void }) {
  const [text, setText] = useState(cur?.text ?? c.text);
  const [brands, setBrands] = useState((cur?.brands ?? c.brands).join(", "));
  const commit = () => {
    const b = brands.split(",").map((x) => x.trim()).filter(Boolean);
    const o: { text?: string; brands?: string[] } = {};
    if (text.trim() !== c.text) o.text = text.trim();
    if (b.join("|") !== c.brands.join("|")) o.brands = b;
    onSave(Object.keys(o).length ? o : null);
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`ปรับข้อกำหนด ${c.code} เฉพาะโครงการ`}
      footer={
        <>
          {cur && (
            <Btn danger onClick={() => onSave(null)}>
              กลับไปใช้มาตรฐาน
            </Btn>
          )}
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary onClick={commit}>
            บันทึก
          </Btn>
        </>
      }
    >
      <p className="mb-2 text-[13px] text-ink-3">มาตรฐาน: {c.text}</p>
      <Field label="ข้อความสำหรับโครงการนี้">
        <textarea value={text} onChange={(e) => setText(e.target.value)} className={cx(areaCls, "min-h-[120px]")} />
      </Field>
      <div className="mt-3">
        <Field label="ยี่ห้อที่อนุมัติ (คั่นด้วยจุลภาค)">
          <input value={brands} onChange={(e) => setBrands(e.target.value)} className={inputCls} />
        </Field>
      </div>
    </Modal>
  );
}

function SpecDocument({ set, sections }: { set: SpecSet; sections: ReturnType<typeof resolveSpec> }) {
  const p = getProject(set.projectId);
  return (
    <div className="text-[12.5px] leading-relaxed">
      <div className="flex items-start justify-between border-b border-ink pb-3">
        <div>
          <p className="text-[15px] font-medium">{COMPANY_INFO.name}</p>
          <p className="text-ink-2">{COMPANY_INFO.address}</p>
        </div>
        <div className="text-right">
          <p className="text-[18px] font-medium">รายการประกอบแบบ</p>
          <p className="text-ink-2">Specification</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-0.5">
        <p>
          <span className="text-ink-3">โครงการ</span> {p?.name ?? set.projectId} ({set.projectId})
        </p>
        <p>
          <span className="text-ink-3">ฉบับ</span> {set.revision === 0 ? "ร่าง" : `Rev.${set.revision}`} · {dateOr(set.issuedAt)}
        </p>
        <p>
          <span className="text-ink-3">เจ้าของ</span> {p?.owner}
        </p>
        <p>
          <span className="text-ink-3">ผู้จัดทำ</span> {set.preparedBy}
        </p>
      </div>
      <p className="mt-3 text-ink-2">หากแบบและรายการประกอบแบบขัดแย้งกัน ให้ถือรายการประกอบแบบเป็นหลัก ยี่ห้อที่ระบุ “หรือเทียบเท่า” ต้องได้รับอนุมัติจากผู้ออกแบบก่อนใช้งาน</p>
      {sections.map((s) => (
        <section key={s.id} className="avoid-break mt-4">
          <h3 className="border-b border-line-strong pb-1 text-[14px] font-medium">
            หมวด {s.code} {s.name}
          </h3>
          <ol className="mt-1.5 flex flex-col gap-1.5">
            {s.clauses.map((c) => (
              <li key={c.id} className="avoid-break grid grid-cols-[48px_1fr] gap-2">
                <span className="num font-mono text-ink-3">{c.code}</span>
                <div>
                  <p>
                    <span className="font-medium">{c.title}</span> — {c.text}
                  </p>
                  {c.brands.length > 0 && (
                    <p className="text-ink-2">
                      ยี่ห้อที่อนุมัติ: {c.brands.join(", ")}
                      {c.equivalents && " หรือเทียบเท่า"}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
      <div className="mt-10 grid grid-cols-3 gap-6 text-center text-ink-2">
        {["สถาปนิกผู้ออกแบบ", "วิศวกรผู้คำนวณ", "เจ้าของอาคาร"].map((x) => (
          <div key={x}>
            <div className="h-12 border-b border-ink-3" />
            <p className="mt-1">{x}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- library ----------

function Library() {
  const { edit } = usePerms("design");
  const lib = specSections.use();
  const [q, setQ] = useState("");
  const [secId, setSecId] = useState("");
  const [editing, setEditing] = useState<{ sec: SpecSection; c?: SpecClause } | null>(null);
  const [newSec, setNewSec] = useState(false);
  const sorted = [...lib].sort((a, b) => a.code.localeCompare(b.code));
  const n = q.trim().toLowerCase();
  const shown = sorted.filter((s) => !secId || s.id === secId).map((s) => ({ s, clauses: s.clauses.filter((c) => !n || `${c.code} ${c.title} ${c.text} ${c.brands.join(" ")}`.toLowerCase().includes(n)) })).filter((x) => x.clauses.length || !n);
  return (
    <>
      <Card className="mb-4">
        <div className="grid grid-cols-2 items-end gap-3 px-4 py-3 lg:grid-cols-5">
          <FilterField label="ค้นหา" className="col-span-2">
            <div className="relative">
              <Search {...I} className="pointer-events-none absolute left-2.5 top-2.5 text-ink-3" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ข้อกำหนด ยี่ห้อ" className={cx(inputCls, "w-full pl-8")} />
            </div>
          </FilterField>
          <FilterField label="หมวด" className="col-span-2">
            <Select label="หมวด" value={secId} onChange={setSecId}>
              <option value="">ทุกหมวด</option>
              {sorted.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} {s.name}
                </option>
              ))}
            </Select>
          </FilterField>
          {edit && (
            <div className="flex justify-end">
              <Btn onClick={() => setNewSec(true)}>
                <Plus {...I} />
                เพิ่มหมวด
              </Btn>
            </div>
          )}
        </div>
      </Card>
      <div className="flex flex-col gap-4">
        {shown.map(({ s, clauses }) => (
          <Card key={s.id}>
            <CardHead
              title={`${s.code} ${s.name}`}
              meta={s.costCode ? `${s.costCode} ${COST_CODES[s.costCode]}` : undefined}
              action={
                edit && (
                  <Btn small onClick={() => setEditing({ sec: s })}>
                    <Plus {...I} />
                    ข้อกำหนด
                  </Btn>
                )
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead>
                  <tr>
                    <th className={cx(th, "w-16 px-5")}>ข้อ</th>
                    <th className={th}>ข้อกำหนด</th>
                    <th className={th}>ยี่ห้อที่อนุมัติ</th>
                    <th className={th}>รหัสต้นทุน</th>
                    <th className={cx(th, "pr-5")} />
                  </tr>
                </thead>
                <tbody>
                  {clauses.map((c) => (
                    <tr key={c.id} className="border-t border-line">
                      <td className={cx(td, "num px-5 font-mono text-ink-3")}>{c.code}</td>
                      <td className={td}>
                        <p className="font-medium">{c.title}</p>
                        <p className="text-ink-2">{c.text}</p>
                      </td>
                      <td className={cx(td, "text-[12px]")}>
                        {c.brands.length ? c.brands.join(", ") : "–"}
                        {c.equivalents && c.brands.length > 0 && <span className="block text-ink-3">หรือเทียบเท่า</span>}
                      </td>
                      <td className={cx(td, "font-mono text-[12px]")}>{c.costCode ?? s.costCode ?? "–"}</td>
                      <td className={cx(td, "pr-5 text-right")}>
                        {edit && (
                          <button type="button" aria-label="แก้ไข" onClick={() => setEditing({ sec: s, c })} className="inline-flex size-8 items-center justify-center rounded-[8px] text-ink-3 hover:bg-raised hover:text-ink">
                            <Pencil {...I} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ))}
        {shown.length === 0 && (
          <Card>
            <Empty>ไม่พบข้อกำหนด</Empty>
          </Card>
        )}
      </div>
      {editing && <ClauseModal sec={editing.sec} c={editing.c} onClose={() => setEditing(null)} />}
      {newSec && <SectionModal existing={lib} onClose={() => setNewSec(false)} />}
    </>
  );
}

function ClauseModal({ sec, c, onClose }: { sec: SpecSection; c?: SpecClause; onClose: () => void }) {
  const nextNo = Math.max(0, ...sec.clauses.map((x) => Number(x.id.split("-")[2]) || 0)) + 1;
  const [v, setV] = useState<SpecClause>(c ?? { id: `SPC-${sec.code}-${String(nextNo).padStart(2, "0")}`, code: `${sec.code}.${String(nextNo).padStart(2, "0")}`, title: "", text: "", brands: [], equivalents: true, costCode: sec.costCode });
  const [brands, setBrands] = useState(v.brands.join(", "));
  const save = () => {
    const clause = { ...v, brands: brands.split(",").map((x) => x.trim()).filter(Boolean) };
    specSections.upsert({ ...sec, clauses: c ? sec.clauses.map((x) => (x.id === c.id ? clause : x)) : [...sec.clauses, clause] });
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={c ? `แก้ไขข้อกำหนด ${c.code}` : `เพิ่มข้อกำหนดในหมวด ${sec.code}`}
      footer={
        <>
          {c && (
            <Btn danger onClick={() => (specSections.upsert({ ...sec, clauses: sec.clauses.filter((x) => x.id !== c.id) }), onClose())}>
              ลบ
            </Btn>
          )}
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!v.title.trim() || !v.text.trim()} onClick={save}>
            บันทึก
          </Btn>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
        <Field label="ข้อ">
          <input value={v.code} onChange={(e) => setV({ ...v, code: e.target.value })} className={cx(inputCls, "font-mono")} />
        </Field>
        <Field label="หัวข้อ">
          <input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} className={inputCls} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="ข้อความ">
            <textarea value={v.text} onChange={(e) => setV({ ...v, text: e.target.value })} className={cx(areaCls, "min-h-[110px]")} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="ยี่ห้อที่อนุมัติ (คั่นด้วยจุลภาค)">
            <input value={brands} onChange={(e) => setBrands(e.target.value)} className={inputCls} />
          </Field>
        </div>
        <Field label="รหัสต้นทุน">
          <Select label="รหัสต้นทุน" value={v.costCode ?? ""} onChange={(x) => setV({ ...v, costCode: (x || undefined) as CostCode | undefined })}>
            <option value="">ตามหมวด</option>
            {Object.entries(COST_CODES).map(([k, x]) => (
              <option key={k} value={k}>
                {k} {x}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex items-end pb-2">
          <Check checked={v.equivalents} onChange={(equivalents) => setV({ ...v, equivalents })} label="ยอมรับ “หรือเทียบเท่า”" />
        </div>
      </div>
    </Modal>
  );
}

function SectionModal({ existing, onClose }: { existing: SpecSection[]; onClose: () => void }) {
  const next = String(Math.max(0, ...existing.map((s) => Number(s.code) || 0)) + 1).padStart(2, "0");
  const [code, setCode] = useState(next);
  const [name, setName] = useState("");
  const [cc, setCc] = useState<CostCode>("10");
  return (
    <Modal
      open
      onClose={onClose}
      title="เพิ่มหมวดงาน"
      width={480}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!name.trim() || existing.some((s) => s.code === code)} onClick={() => (specSections.upsert({ id: `SPS-${code}`, code, name: name.trim(), costCode: cc, clauses: [] }), onClose())}>
            เพิ่ม
          </Btn>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-[100px_1fr]">
        <Field label="รหัสหมวด">
          <input value={code} onChange={(e) => setCode(e.target.value)} className={cx(inputCls, "font-mono")} />
        </Field>
        <Field label="ชื่อหมวด">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น งานลิฟต์" className={inputCls} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="รหัสต้นทุนหลัก">
            <Select label="รหัสต้นทุน" value={cc} onChange={(x) => setCc(x as CostCode)}>
              {Object.entries(COST_CODES).map(([k, x]) => (
                <option key={k} value={k}>
                  {k} {x}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </div>
    </Modal>
  );
}
