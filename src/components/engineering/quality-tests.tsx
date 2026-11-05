"use client";

import { useMemo, useState } from "react";
import { FlaskConical } from "lucide-react";
import { Card, CardHead, cx, Field, inputCls } from "@/components/ui";
import { Btn, Empty, I, Modal, Pill, Segmented, Select, type Tone } from "@/components/ops/bits";
import { MediaField, MediaStrip } from "@/components/media/media-field";
import { thDate, TODAY } from "@/lib/data";
import {
  addDays,
  concreteTests,
  concreteVerdict,
  DEFAULT_CONCRETE_RULE,
  DEFAULT_REBAR_SPEC,
  diffDays,
  dueSets,
  ENG_DEFAULTS,
  evalEarly,
  evalStrength,
  nextPlainId,
  PILE_METHOD_LABEL,
  PILE_RESULT_LABEL,
  pileTests,
  planSets,
  rebarLots,
  rebarVerdict,
  saveEngSettings,
  setState,
  slumpOk,
  SPECIMEN_LABEL,
  useEngSettings,
  type ConcreteRule,
  type ConcreteTest,
  type ConcreteVerdict,
  type EngSettings,
  type PileMethod,
  type PileResult,
  type PileTest,
  type RebarGrade,
  type RebarLot,
  type RebarSpec,
  type SetState,
  type Specimen,
  type TestSet,
} from "@/lib/engineering";
import { CheckNote, pname, ProjectSelect, rowCls, td, th, useEngPerms } from "./bits";
import { matchQ, QFilters, useNewTrigger, type QFilter, type SetQ } from "./quality-bits";

type Kind = "concrete" | "rebar" | "pile";

const VERDICT_LABEL: Record<ConcreteVerdict, string> = { pass: "ผ่าน", fail: "ไม่ผ่าน", pending: "รอผล", "early-low": "7 วันต่ำกว่าเป้า" };
const VERDICT_TONE: Record<ConcreteVerdict, Tone> = { pass: "pos", fail: "neg", pending: "neutral", "early-low": "warn" };
const SET_TONE: Record<SetState, string> = { done: "text-ink", overdue: "text-neg", today: "text-accent-text", upcoming: "text-ink-3" };
const PILE_TONE: Record<PileResult, Tone> = { pending: "neutral", pass: "pos", fail: "neg", doubt: "warn" };
const num = (v: string) => (v.trim() === "" ? undefined : Number(v));
const f0 = (n: number) => Math.round(n).toLocaleString("th-TH");

export function TestsTab({ f, setF, newKey }: { f: QFilter; setF: SetQ; newKey: number }) {
  const perms = useEngPerms();
  const s = useEngSettings();
  const ct = concreteTests.use();
  const rb = rebarLots.use();
  const pt = pileTests.use();
  const [kind, setKind] = useState<Kind>(() => (f.q.startsWith("RB-") ? "rebar" : f.q.startsWith("PT-") ? "pile" : "concrete"));
  const [cOpen, setCOpen] = useState<string | "new" | null>(() => (ct.some((c) => c.id === f.q) ? f.q : null));
  const [rOpen, setROpen] = useState<string | "new" | null>(null);
  const [pOpen, setPOpen] = useState<string | "new" | null>(null);
  useNewTrigger(newKey, () => (kind === "concrete" ? setCOpen("new") : kind === "rebar" ? setROpen("new") : setPOpen("new")));

  const inProject = <T extends { projectId: string }>(x: T) => !f.project || x.projectId === f.project;
  const cRows = useMemo(
    () =>
      ct
        .filter(inProject)
        .filter((c) => {
          const v = concreteVerdict(c, s.concrete);
          if (!f.status) return true;
          if (f.status === "due") return c.sets.some((x) => ["today", "overdue"].includes(setState(x, TODAY)));
          if (f.status === "fail") return v === "fail" || slumpOk(c) === false;
          return v === f.status;
        })
        .filter((c) => matchQ(f.q, c.id, c.element, c.location, c.supplier, c.ticketNo))
        .sort((a, b) => b.pourDate.localeCompare(a.pourDate)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ct, f, s.concrete],
  );
  const rRows = useMemo(
    () =>
      rb
        .filter(inProject)
        .filter((l) => !f.status || f.status === "due" || rebarVerdict(l, s.rebar) === f.status)
        .filter((l) => matchQ(f.q, l.id, l.size, l.grade, l.heatNo, l.supplier))
        .sort((a, b) => b.date.localeCompare(a.date)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rb, f, s.rebar],
  );
  const pRows = useMemo(
    () =>
      pt
        .filter(inProject)
        .filter((p) => !f.status || f.status === "due" || (f.status === "fail" ? p.result === "fail" || p.result === "doubt" : p.result === f.status))
        .filter((p) => matchQ(f.q, p.id, p.pileNo, p.pileType, p.lab))
        .sort((a, b) => b.date.localeCompare(a.date)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pt, f],
  );
  const due = useMemo(() => dueSets(ct.filter(inProject), TODAY).filter((x) => diffDays(TODAY, x.set.due) <= 3), [ct, f.project]); // eslint-disable-line react-hooks/exhaustive-deps

  const count = kind === "concrete" ? cRows.length : kind === "rebar" ? rRows.length : pRows.length;
  return (
    <>
      <QFilters
        f={f}
        setF={setF}
        count={count}
        personLabel="ห้องปฏิบัติการ"
        people={[...new Set([...ct.flatMap((c) => c.sets.map((x) => x.lab ?? "")), ...pt.map((p) => p.lab)].filter(Boolean))]}
        statuses={[
          ["due", "ถึงกำหนดทดสอบ"],
          ["pending", "รอผล"],
          ["pass", "ผ่าน"],
          ["fail", "ไม่ผ่าน"],
        ]}
        extra={
          <Segmented
            value={kind}
            onChange={setKind}
            options={[
              { key: "concrete", label: `คอนกรีต ${ct.length}` },
              { key: "rebar", label: `เหล็กเสริม ${rb.length}` },
              { key: "pile", label: `เสาเข็ม ${pt.length}` },
            ]}
          />
        }
      />

      {kind === "concrete" && due.length > 0 && (
        <Card className="ops-noprint mb-4">
          <CardHead title="ก้อนตัวอย่างที่ถึงกำหนดทดสอบ" meta={`${due.length} ชุด · ภายใน 3 วัน`} />
          <ul>
            {due.map(({ testId, set, state }) => {
              const t = ct.find((c) => c.id === testId)!;
              return (
                <li key={`${testId}-${set.age}`} className="border-t border-line first:border-t-0">
                  <button type="button" onClick={() => setCOpen(testId)} className="flex w-full flex-wrap items-center gap-3 px-5 py-2.5 text-left text-[13px] transition-colors duration-150 hover:bg-raised/60">
                    <FlaskConical {...I} className="text-ink-3" />
                    <span className="font-mono text-[12px] text-accent-text">{testId}</span>
                    <span className="min-w-0 flex-1 truncate">
                      {t.element} · {pname(t.projectId)}
                    </span>
                    <span>อายุ {set.age} วัน</span>
                    <span className={cx("num font-mono", SET_TONE[state])}>
                      {thDate(set.due)} {state === "overdue" ? `· เลย ${diffDays(set.due, TODAY)} วัน` : state === "today" ? "· วันนี้" : ""}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Card className="ops-noprint">
        {kind === "concrete" &&
          (cRows.length === 0 ? (
            <Empty>ไม่มีผลทดสอบคอนกรีตตามตัวกรองนี้</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px]">
                <thead>
                  <tr>
                    <th className={th}>เลขที่ · วันเท</th>
                    <th className={th}>ส่วนโครงสร้าง</th>
                    <th className={th}>fc&apos; · ตัวอย่าง</th>
                    <th className={th}>Slump (ซม.)</th>
                    {s.concrete.ages.map((a) => (
                      <th key={a} className={th}>
                        {a} วัน (ksc)
                      </th>
                    ))}
                    <th className={th}>ผล</th>
                  </tr>
                </thead>
                <tbody>
                  {cRows.map((c) => {
                    const v = concreteVerdict(c, s.concrete);
                    const sl = slumpOk(c);
                    return (
                      <tr key={c.id} className={rowCls} onClick={() => setCOpen(c.id)}>
                        <td className={td}>
                          <span className="font-mono text-[12px] text-accent-text">{c.id}</span>
                          <span className="block text-[12px] text-ink-3">เท {thDate(c.pourDate)}</span>
                        </td>
                        <td className={td}>
                          <span className="block max-w-[260px] truncate">{c.element}</span>
                          <span className="block text-[12px] text-ink-3">
                            {pname(c.projectId)}
                            {c.volume ? ` · ${c.volume} ลบ.ม.` : ""}
                          </span>
                        </td>
                        <td className={cx(td, "text-[13px]")}>
                          <span className="num font-mono">{c.fc}</span> ksc
                          <span className="block text-[12px] text-ink-3">{c.specimen === "cube" ? "ลูกบาศก์" : "ทรงกระบอก"}</span>
                        </td>
                        <td className={cx(td, "text-[13px]")}>
                          {c.slump === undefined ? (
                            <span className="text-ink-3">–</span>
                          ) : (
                            <>
                              <span className={cx("num font-mono", sl === false && "text-neg")}>{c.slump}</span>
                              <span className="block text-[12px] text-ink-3">
                                {c.slumpMin ?? "–"}–{c.slumpMax ?? "–"}
                              </span>
                            </>
                          )}
                        </td>
                        {s.concrete.ages.map((a) => {
                          const set = c.sets.find((x) => x.age === a);
                          return (
                            <td key={a} className={cx(td, "text-[13px]")}>
                              <SetCell set={set} fc={c.fc} rule={s.concrete} last={a === Math.max(...c.sets.map((x) => x.age))} />
                            </td>
                          );
                        })}
                        <td className={td}>
                          <Pill tone={VERDICT_TONE[v]}>{VERDICT_LABEL[v]}</Pill>
                          {sl === false && (
                            <span className="mt-1 block">
                              <Pill tone="neg">slump นอกช่วง</Pill>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}

        {kind === "rebar" &&
          (rRows.length === 0 ? (
            <Empty>ไม่มีล็อตเหล็กเสริมตามตัวกรองนี้</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px]">
                <thead>
                  <tr>
                    <th className={th}>ล็อต · วันที่รับ</th>
                    <th className={th}>ชั้นคุณภาพ · ขนาด</th>
                    <th className={th}>ผู้ผลิต · Heat no.</th>
                    <th className={th}>ใบรับรอง</th>
                    <th className={th}>Yield / Tensile (ksc)</th>
                    <th className={th}>Elong. %</th>
                    <th className={th}>ผล</th>
                  </tr>
                </thead>
                <tbody>
                  {rRows.map((l) => {
                    const v = rebarVerdict(l, s.rebar);
                    const sp = s.rebar[l.grade];
                    return (
                      <tr key={l.id} className={rowCls} onClick={() => setROpen(l.id)}>
                        <td className={td}>
                          <span className="font-mono text-[12px] text-accent-text">{l.id}</span>
                          <span className="block text-[12px] text-ink-3">{thDate(l.date)}</span>
                        </td>
                        <td className={cx(td, "text-[13px]")}>
                          {l.grade} · {l.size}
                          <span className="block text-[12px] text-ink-3">
                            {l.tons} ตัน · {pname(l.projectId)}
                          </span>
                        </td>
                        <td className={cx(td, "text-[13px]")}>
                          {l.supplier}
                          <span className="block font-mono text-[12px] text-ink-3">{l.heatNo}</span>
                        </td>
                        <td className={cx(td, "text-[13px]")}>{l.millCert.length ? `${l.millCert.length} ไฟล์` : <span className="text-ink-3">ยังไม่แนบ</span>}</td>
                        <td className={cx(td, "text-[13px]")}>
                          {l.yieldKsc !== undefined ? (
                            <span className="num font-mono">
                              <span className={cx(l.yieldKsc < sp.yieldKsc && "text-neg")}>{f0(l.yieldKsc)}</span> / <span className={cx((l.tensileKsc ?? 0) < sp.tensileKsc && "text-neg")}>{f0(l.tensileKsc ?? 0)}</span>
                            </span>
                          ) : (
                            <span className="text-ink-3">รอผล</span>
                          )}
                          <span className="block text-[12px] text-ink-3">
                            ขั้นต่ำ {f0(sp.yieldKsc)} / {f0(sp.tensileKsc)}
                          </span>
                        </td>
                        <td className={cx(td, "text-[13px]")}>
                          <span className={cx("num font-mono", l.elongation !== undefined && l.elongation < sp.elongation && "text-neg")}>{l.elongation ?? "–"}</span>
                          <span className="block text-[12px] text-ink-3">≥ {sp.elongation}</span>
                        </td>
                        <td className={td}>
                          <Pill tone={v === "pass" ? "pos" : v === "fail" ? "neg" : "neutral"}>{v === "pass" ? "ผ่าน" : v === "fail" ? "ไม่ผ่าน" : "รอผล"}</Pill>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}

        {kind === "pile" &&
          (pRows.length === 0 ? (
            <Empty>ไม่มีผลทดสอบเสาเข็มตามตัวกรองนี้</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr>
                    <th className={th}>เลขที่ · วันที่</th>
                    <th className={th}>วิธีทดสอบ</th>
                    <th className={th}>เสาเข็ม</th>
                    <th className={th}>น้ำหนักออกแบบ / ผลรับได้ (ตัน)</th>
                    <th className={th}>ผล</th>
                  </tr>
                </thead>
                <tbody>
                  {pRows.map((p) => (
                    <tr key={p.id} className={rowCls} onClick={() => setPOpen(p.id)}>
                      <td className={td}>
                        <span className="font-mono text-[12px] text-accent-text">{p.id}</span>
                        <span className="block text-[12px] text-ink-3">{thDate(p.date)}</span>
                      </td>
                      <td className={cx(td, "text-[13px]")}>
                        {PILE_METHOD_LABEL[p.method]}
                        <span className="block text-[12px] text-ink-3">{p.lab}</span>
                      </td>
                      <td className={cx(td, "text-[13px]")}>
                        {p.pileNo}
                        <span className="block text-[12px] text-ink-3">
                          {p.pileType} · {pname(p.projectId)}
                        </span>
                      </td>
                      <td className={cx(td, "text-[13px]")}>
                        <span className="num font-mono">
                          {p.designLoad}
                          {p.capacity !== undefined && ` / ${p.capacity}`}
                        </span>
                        {p.capacity !== undefined && <span className="block text-[12px] text-ink-3">FS {(p.capacity / p.designLoad).toFixed(2)}</span>}
                      </td>
                      <td className={td}>
                        <Pill tone={PILE_TONE[p.result]}>{PILE_RESULT_LABEL[p.result]}</Pill>
                        {p.note && <span className="mt-1 block max-w-[260px] text-[12px] text-ink-3">{p.note}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
      </Card>
      <p className="ops-noprint mt-3 text-[12px] text-ink-3">
        เกณฑ์ยอมรับคอนกรีต: ค่าเฉลี่ย ≥ fc&apos;{s.concrete.avgOffset ? ` + ${s.concrete.avgOffset}` : ""} และทุกก้อน ≥ fc&apos; − {s.concrete.tolKsc} ksc ที่อายุ {Math.max(...s.concrete.ages)} วัน · <CheckNote>ตรวจสอบกับมาตรฐาน</CheckNote>
      </p>

      {cOpen && <ConcreteModal init={cOpen === "new" ? undefined : ct.find((c) => c.id === cOpen)} defaultProject={f.project} onClose={() => setCOpen(null)} canEdit={perms.edit} />}
      {rOpen && <RebarModal init={rOpen === "new" ? undefined : rb.find((x) => x.id === rOpen)} defaultProject={f.project} onClose={() => setROpen(null)} canEdit={perms.edit} />}
      {pOpen && <PileModal init={pOpen === "new" ? undefined : pt.find((x) => x.id === pOpen)} defaultProject={f.project} onClose={() => setPOpen(null)} canEdit={perms.edit} />}
    </>
  );
}

function SetCell({ set, fc, rule, last }: { set?: TestSet; fc: number; rule: ConcreteRule; last: boolean }) {
  if (!set) return <span className="text-ink-3">–</span>;
  const st = setState(set, TODAY);
  if (st !== "done")
    return (
      <span className={cx("text-[12px]", SET_TONE[st])}>
        {st === "today" ? "ทดสอบวันนี้" : st === "overdue" ? "เลยกำหนด" : "กำหนด"}
        <span className="block font-mono">{thDate(set.due)}</span>
      </span>
    );
  const e = last ? evalStrength(set.results, fc, rule) : null;
  const early = !last ? evalEarly(set.results, fc, rule.earlyPct) : null;
  const avg = e?.avg ?? early?.avg ?? 0;
  const ok = e ? e.pass : early!.ok;
  return (
    <span>
      <span className={cx("num font-mono", !ok && (e ? "text-neg" : "text-warn"))}>{f0(avg)}</span>
      <span className="block font-mono text-[12px] text-ink-3">{set.results.map(f0).join(" · ")}</span>
    </span>
  );
}

// ---------- concrete form + results ----------

function ConcreteModal({ init, defaultProject, onClose, canEdit }: { init?: ConcreteTest; defaultProject?: string; onClose: () => void; canEdit: boolean }) {
  const s = useEngSettings();
  const [d, setD] = useState<ConcreteTest>(
    () =>
      init ?? {
        id: "",
        projectId: defaultProject ?? "",
        pourDate: TODAY,
        element: "",
        fc: 240,
        specimen: "cube",
        slumpMin: 7.5,
        slumpMax: 12.5,
        sets: planSets(TODAY, s.concrete.ages),
      },
  );
  const set = <K extends keyof ConcreteTest>(k: K, v: ConcreteTest[K]) => setD((x) => ({ ...x, [k]: v }));
  const [vals, setVals] = useState<Record<number, string[]>>(() =>
    Object.fromEntries(d.sets.map((x) => [x.age, Array.from({ length: Math.max(s.concrete.specimensPerAge, x.results.length) }, (_, i) => (x.results[i] ? String(x.results[i]) : ""))])),
  );
  const ok = d.projectId && d.element.trim() && d.fc > 0 && d.pourDate;
  const lastAge = Math.max(...d.sets.map((x) => x.age));
  const save = () => {
    if (!ok) return;
    const sets = d.sets.map((x) => {
      const results = (vals[x.age] ?? []).map(Number).filter((v) => v > 0);
      return { ...x, due: addDays(d.pourDate, x.age), results, testedAt: results.length ? (x.testedAt ?? TODAY) : undefined };
    });
    const id = d.id || nextPlainId(concreteTests.all(), "CT", d.projectId);
    concreteTests.upsert({ ...d, id, sets });
    onClose();
  };
  const sl = slumpOk(d);
  return (
    <Modal
      open
      onClose={onClose}
      title={init ? `ผลทดสอบคอนกรีต ${init.id}` : "บันทึกการเทคอนกรีตและเก็บตัวอย่าง"}
      width={820}
      footer={
        canEdit ? (
          <>
            {init && (
              <Btn
                danger
                onClick={() => {
                  if (!window.confirm(`ลบ ${init.id}`)) return;
                  concreteTests.remove(init.id);
                  onClose();
                }}
              >
                ลบ
              </Btn>
            )}
            <span className="flex-1" />
            <Btn onClick={onClose}>ยกเลิก</Btn>
            <Btn primary disabled={!ok} onClick={save}>
              บันทึก
            </Btn>
          </>
        ) : undefined
      }
    >
      <fieldset disabled={!canEdit} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {!init && (
          <div className="sm:col-span-3">
            <Field label="โครงการ">
              <ProjectSelect value={d.projectId} onChange={(v) => set("projectId", v)} required />
            </Field>
          </div>
        )}
        <Field label="วันที่เท">
          <input type="date" value={d.pourDate} onChange={(e) => set("pourDate", e.target.value)} className={cx(inputCls, "font-mono")} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="ส่วนโครงสร้าง">
            <input value={d.element} onChange={(e) => set("element", e.target.value)} className={inputCls} placeholder="เช่น คานและพื้นชั้น 2" />
          </Field>
        </div>
        <Field label="fc' ออกแบบ (ksc)">
          <input type="number" inputMode="decimal" value={d.fc} onChange={(e) => set("fc", Number(e.target.value))} className={cx(inputCls, "font-mono")} />
        </Field>
        <Field label="ชนิดตัวอย่าง">
          <Select label="ชนิดตัวอย่าง" value={d.specimen} onChange={(v) => set("specimen", v as Specimen)}>
            {(Object.keys(SPECIMEN_LABEL) as Specimen[]).map((k) => (
              <option key={k} value={k}>
                {SPECIMEN_LABEL[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="ปริมาตร (ลบ.ม.)">
          <input type="number" inputMode="decimal" value={d.volume ?? ""} onChange={(e) => set("volume", num(e.target.value))} className={cx(inputCls, "font-mono")} />
        </Field>
        <Field label="ผู้ผลิตคอนกรีต">
          <input value={d.supplier ?? ""} onChange={(e) => set("supplier", e.target.value || undefined)} className={inputCls} />
        </Field>
        <Field label="เลขที่ใบส่งคอนกรีต">
          <input value={d.ticketNo ?? ""} onChange={(e) => set("ticketNo", e.target.value || undefined)} className={cx(inputCls, "font-mono")} />
        </Field>
        <Field label="ตำแหน่ง">
          <input value={d.location ?? ""} onChange={(e) => set("location", e.target.value || undefined)} className={inputCls} />
        </Field>
        <Field label="Slump วัดได้ (ซม.)">
          <input type="number" inputMode="decimal" value={d.slump ?? ""} onChange={(e) => set("slump", num(e.target.value))} className={cx(inputCls, "font-mono", sl === false && "border-neg text-neg")} />
        </Field>
        <Field label="Slump ต่ำสุด (ซม.)">
          <input type="number" inputMode="decimal" value={d.slumpMin ?? ""} onChange={(e) => set("slumpMin", num(e.target.value))} className={cx(inputCls, "font-mono")} />
        </Field>
        <Field label="Slump สูงสุด (ซม.)">
          <input type="number" inputMode="decimal" value={d.slumpMax ?? ""} onChange={(e) => set("slumpMax", num(e.target.value))} className={cx(inputCls, "font-mono")} />
        </Field>
      </fieldset>

      <div className="mt-4 flex flex-col gap-3">
        {d.sets.map((x) => {
          const results = (vals[x.age] ?? []).map(Number).filter((v) => v > 0);
          const isLast = x.age === lastAge;
          const e = isLast ? evalStrength(results, d.fc, s.concrete) : null;
          const early = !isLast ? evalEarly(results, d.fc, s.concrete.earlyPct) : null;
          const due = addDays(d.pourDate, x.age);
          const st = setState({ ...x, due, results }, TODAY);
          return (
            <div key={x.age} className="rounded-[10px] border border-line p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-[14px] font-medium">
                  อายุ {x.age} วัน <span className="ml-2 font-mono text-[12px] font-normal text-ink-3">กำหนดทดสอบ {thDate(due)}</span>
                  {st !== "done" && <span className={cx("ml-2 text-[12px] font-normal", SET_TONE[st])}>{st === "today" ? "วันนี้" : st === "overdue" ? "เลยกำหนด" : ""}</span>}
                </p>
                {results.length > 0 &&
                  (e ? (
                    <span className="text-[13px]">
                      เฉลี่ย <span className="num font-mono">{f0(e.avg)}</span> (≥ {f0(e.avgLimit)}) · ต่ำสุด <span className="num font-mono">{f0(e.min)}</span> (≥ {f0(e.eachLimit)}) · <Pill tone={e.pass ? "pos" : "neg"}>{e.pass ? "ผ่าน" : "ไม่ผ่าน"}</Pill>
                    </span>
                  ) : (
                    <span className="text-[13px]">
                      เฉลี่ย <span className="num font-mono">{f0(early!.avg)}</span> · เป้า {s.concrete.earlyPct}% = {f0(early!.target)} · <Pill tone={early!.ok ? "pos" : "warn"}>{early!.ok ? "ตามเป้า" : "ต่ำกว่าเป้า"}</Pill>
                    </span>
                  ))}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {(vals[x.age] ?? []).map((v, i) => (
                  <input
                    key={i}
                    disabled={!canEdit}
                    type="number"
                    inputMode="decimal"
                    value={v}
                    onChange={(ev) => setVals((m) => ({ ...m, [x.age]: (m[x.age] ?? []).map((y, k) => (k === i ? ev.target.value : y)) }))}
                    placeholder={`ก้อน ${i + 1}`}
                    aria-label={`ก้อนที่ ${i + 1} อายุ ${x.age} วัน`}
                    className={cx(inputCls, "w-24 font-mono")}
                  />
                ))}
                {canEdit && (
                  <Btn small onClick={() => setVals((m) => ({ ...m, [x.age]: [...(m[x.age] ?? []), ""] }))}>
                    เพิ่มก้อน
                  </Btn>
                )}
                <input
                  disabled={!canEdit}
                  value={x.lab ?? ""}
                  onChange={(ev) => setD((t) => ({ ...t, sets: t.sets.map((y) => (y.age === x.age ? { ...y, lab: ev.target.value || undefined } : y)) }))}
                  placeholder="ห้องปฏิบัติการ"
                  className={cx(inputCls, "min-w-[180px] flex-1")}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4">
        {canEdit ? <MediaField label="รายงานผลทดสอบ" value={d.report ?? []} onChange={(r) => set("report", r)} /> : <MediaStrip refs={d.report} />}
      </div>
      <p className="mt-3 text-[12px] text-ink-3">
        ผลอายุ {lastAge} วัน: ค่าเฉลี่ย ≥ fc&apos;{s.concrete.avgOffset ? ` + ${s.concrete.avgOffset}` : ""} และทุกก้อน ≥ fc&apos; − {s.concrete.tolKsc} ksc · ผลอายุน้อยกว่าเป็นค่าเตือนล่วงหน้า · <CheckNote>ตรวจสอบกับมาตรฐาน</CheckNote>
      </p>
    </Modal>
  );
}

// ---------- rebar ----------

function RebarModal({ init, defaultProject, onClose, canEdit }: { init?: RebarLot; defaultProject?: string; onClose: () => void; canEdit: boolean }) {
  const s = useEngSettings();
  const [d, setD] = useState<RebarLot>(() => init ?? { id: "", projectId: defaultProject ?? "", date: TODAY, grade: "SD40", size: "DB12", tons: 0, supplier: "", heatNo: "", millCert: [] });
  const set = <K extends keyof RebarLot>(k: K, v: RebarLot[K]) => setD((x) => ({ ...x, [k]: v }));
  const ok = d.projectId && d.size.trim() && d.heatNo.trim();
  const v = rebarVerdict(d, s.rebar);
  const sp = s.rebar[d.grade];
  const save = () => {
    if (!ok) return;
    rebarLots.upsert({ ...d, id: d.id || nextPlainId(rebarLots.all(), "RB", d.projectId), testedAt: d.yieldKsc !== undefined ? (d.testedAt ?? TODAY) : undefined });
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={init ? `ล็อตเหล็กเสริม ${init.id}` : "รับเหล็กเสริมล็อตใหม่"}
      width={720}
      footer={
        canEdit ? (
          <>
            <Btn onClick={onClose}>ยกเลิก</Btn>
            <Btn primary disabled={!ok} onClick={save}>
              บันทึก
            </Btn>
          </>
        ) : undefined
      }
    >
      <fieldset disabled={!canEdit} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {!init && (
          <div className="sm:col-span-3">
            <Field label="โครงการ">
              <ProjectSelect value={d.projectId} onChange={(x) => set("projectId", x)} required />
            </Field>
          </div>
        )}
        <Field label="วันที่รับ">
          <input type="date" value={d.date} onChange={(e) => set("date", e.target.value)} className={cx(inputCls, "font-mono")} />
        </Field>
        <Field label="ชั้นคุณภาพ">
          <Select label="ชั้นคุณภาพ" value={d.grade} onChange={(x) => set("grade", x as RebarGrade)}>
            {(Object.keys(s.rebar) as RebarGrade[]).map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="ขนาด">
          <input value={d.size} onChange={(e) => set("size", e.target.value)} className={cx(inputCls, "font-mono")} />
        </Field>
        <Field label="น้ำหนัก (ตัน)">
          <input type="number" inputMode="decimal" value={d.tons || ""} onChange={(e) => set("tons", Number(e.target.value))} className={cx(inputCls, "font-mono")} />
        </Field>
        <Field label="ผู้ผลิต / ผู้ขาย">
          <input value={d.supplier} onChange={(e) => set("supplier", e.target.value)} className={inputCls} />
        </Field>
        <Field label="Heat no.">
          <input value={d.heatNo} onChange={(e) => set("heatNo", e.target.value)} className={cx(inputCls, "font-mono")} />
        </Field>
        <Field label={`Yield (ksc) ≥ ${f0(sp.yieldKsc)}`}>
          <input type="number" inputMode="decimal" value={d.yieldKsc ?? ""} onChange={(e) => set("yieldKsc", num(e.target.value))} className={cx(inputCls, "font-mono")} />
        </Field>
        <Field label={`Tensile (ksc) ≥ ${f0(sp.tensileKsc)}`}>
          <input type="number" inputMode="decimal" value={d.tensileKsc ?? ""} onChange={(e) => set("tensileKsc", num(e.target.value))} className={cx(inputCls, "font-mono")} />
        </Field>
        <Field label={`Elongation (%) ≥ ${sp.elongation}`}>
          <input type="number" inputMode="decimal" value={d.elongation ?? ""} onChange={(e) => set("elongation", num(e.target.value))} className={cx(inputCls, "font-mono")} />
        </Field>
        <div className="sm:col-span-3">
          <Field label="ห้องปฏิบัติการ">
            <input value={d.lab ?? ""} onChange={(e) => set("lab", e.target.value || undefined)} className={inputCls} />
          </Field>
        </div>
      </fieldset>
      <p className="mt-3 text-[13px]">
        ผลทดสอบแรงดึง <Pill tone={v === "pass" ? "pos" : v === "fail" ? "neg" : "neutral"}>{v === "pass" ? "ผ่าน" : v === "fail" ? "ไม่ผ่าน" : "รอผล"}</Pill> <CheckNote>ค่าขั้นต่ำตาม มอก. ตรวจสอบกับมาตรฐาน</CheckNote>
      </p>
      <div className="mt-3 flex flex-col gap-3">
        {canEdit ? (
          <>
            <MediaField label="ใบรับรองโรงงาน (Mill certificate)" value={d.millCert} onChange={(m) => set("millCert", m)} />
            <MediaField label="รายงานผลทดสอบแรงดึง" value={d.report ?? []} onChange={(m) => set("report", m)} />
          </>
        ) : (
          <>
            <MediaStrip refs={d.millCert} />
            <MediaStrip refs={d.report} />
          </>
        )}
      </div>
    </Modal>
  );
}

// ---------- piles ----------

function PileModal({ init, defaultProject, onClose, canEdit }: { init?: PileTest; defaultProject?: string; onClose: () => void; canEdit: boolean }) {
  const [d, setD] = useState<PileTest>(() => init ?? { id: "", projectId: defaultProject ?? "", date: TODAY, method: "seismic", pileNo: "", pileType: "", designLoad: 0, result: "pending", lab: "", report: [] });
  const set = <K extends keyof PileTest>(k: K, v: PileTest[K]) => setD((x) => ({ ...x, [k]: v }));
  const ok = d.projectId && d.pileNo.trim();
  const save = () => {
    if (!ok) return;
    pileTests.upsert({ ...d, id: d.id || nextPlainId(pileTests.all(), "PT", d.projectId) });
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={init ? `ผลทดสอบเสาเข็ม ${init.id}` : "บันทึกการทดสอบเสาเข็ม"}
      width={720}
      footer={
        canEdit ? (
          <>
            <Btn onClick={onClose}>ยกเลิก</Btn>
            <Btn primary disabled={!ok} onClick={save}>
              บันทึก
            </Btn>
          </>
        ) : undefined
      }
    >
      <fieldset disabled={!canEdit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {!init && (
          <div className="sm:col-span-2">
            <Field label="โครงการ">
              <ProjectSelect value={d.projectId} onChange={(x) => set("projectId", x)} required />
            </Field>
          </div>
        )}
        <Field label="วันที่ทดสอบ">
          <input type="date" value={d.date} onChange={(e) => set("date", e.target.value)} className={cx(inputCls, "font-mono")} />
        </Field>
        <Field label="วิธีทดสอบ">
          <Select label="วิธีทดสอบ" value={d.method} onChange={(x) => set("method", x as PileMethod)}>
            {(Object.keys(PILE_METHOD_LABEL) as PileMethod[]).map((k) => (
              <option key={k} value={k}>
                {PILE_METHOD_LABEL[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="หมายเลขเสาเข็ม">
          <input value={d.pileNo} onChange={(e) => set("pileNo", e.target.value)} className={inputCls} placeholder="เช่น P12 หรือ เข็ม 1–24" />
        </Field>
        <Field label="ชนิดเสาเข็ม">
          <input value={d.pileType} onChange={(e) => set("pileType", e.target.value)} className={inputCls} />
        </Field>
        <Field label="น้ำหนักบรรทุกออกแบบ (ตัน)">
          <input type="number" inputMode="decimal" value={d.designLoad || ""} onChange={(e) => set("designLoad", Number(e.target.value))} className={cx(inputCls, "font-mono")} />
        </Field>
        <Field label="กำลังรับน้ำหนักที่ได้ (ตัน)">
          <input type="number" inputMode="decimal" value={d.capacity ?? ""} onChange={(e) => set("capacity", num(e.target.value))} className={cx(inputCls, "font-mono")} />
        </Field>
        <Field label="การทรุดตัว (มม.)">
          <input type="number" inputMode="decimal" value={d.settlement ?? ""} onChange={(e) => set("settlement", num(e.target.value))} className={cx(inputCls, "font-mono")} />
        </Field>
        <Field label="ผลการทดสอบ">
          <Select label="ผลการทดสอบ" value={d.result} onChange={(x) => set("result", x as PileResult)}>
            {(Object.keys(PILE_RESULT_LABEL) as PileResult[]).map((k) => (
              <option key={k} value={k}>
                {PILE_RESULT_LABEL[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="ผู้ทดสอบ">
          <input value={d.lab} onChange={(e) => set("lab", e.target.value)} className={inputCls} />
        </Field>
        <Field label="หมายเหตุ">
          <input value={d.note ?? ""} onChange={(e) => set("note", e.target.value || undefined)} className={inputCls} />
        </Field>
      </fieldset>
      {d.capacity !== undefined && d.designLoad > 0 && <p className="mt-3 text-[13px] text-ink-2">อัตราส่วนความปลอดภัย (FS) {(d.capacity / d.designLoad).toFixed(2)}</p>}
      <div className="mt-3">{canEdit ? <MediaField label="รายงานผลทดสอบ" value={d.report} onChange={(m) => set("report", m)} /> : <MediaStrip refs={d.report} />}</div>
    </Modal>
  );
}

// ---------- settings: acceptance rules ----------

export function EngRulesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return <RulesBody onClose={onClose} />;
}

function RulesBody({ onClose }: { onClose: () => void }) {
  const perms = useEngPerms();
  const cur = useEngSettings();
  const [d, setD] = useState<EngSettings>(cur);
  const [ages, setAges] = useState(cur.concrete.ages.join(", "));
  const setC = (k: keyof ConcreteRule, v: number) => setD((x) => ({ ...x, concrete: { ...x.concrete, [k]: v } }));
  const setR = (g: RebarGrade, k: keyof RebarSpec[RebarGrade], v: number) => setD((x) => ({ ...x, rebar: { ...x.rebar, [g]: { ...x.rebar[g], [k]: v } } }));
  const save = () => {
    const parsed = ages
      .split(/[,\s]+/)
      .map(Number)
      .filter((n) => n > 0);
    saveEngSettings({ ...d, concrete: { ...d.concrete, ages: parsed.length ? [...new Set(parsed)].sort((a, b) => a - b) : DEFAULT_CONCRETE_RULE.ages } });
    onClose();
  };
  const reset = () => {
    setD((x) => ({ ...x, concrete: DEFAULT_CONCRETE_RULE, rebar: DEFAULT_REBAR_SPEC, rfiWarnDays: ENG_DEFAULTS.rfiWarnDays, ncrOpenDays: ENG_DEFAULTS.ncrOpenDays, licenseDays: ENG_DEFAULTS.licenseDays }));
    setAges(DEFAULT_CONCRETE_RULE.ages.join(", "));
  };
  const numIn = (v: number, on: (n: number) => void, label: string) => <input type="number" inputMode="decimal" aria-label={label} disabled={!perms.edit} value={v} onChange={(e) => on(Number(e.target.value))} className={cx(inputCls, "w-full font-mono")} />;
  return (
    <Modal
      open
      onClose={onClose}
      title="เกณฑ์การทดสอบและการแจ้งเตือน"
      width={720}
      footer={
        perms.edit ? (
          <>
            <Btn onClick={reset}>ใช้ค่าเริ่มต้น</Btn>
            <span className="flex-1" />
            <Btn onClick={onClose}>ยกเลิก</Btn>
            <Btn primary onClick={save}>
              บันทึก
            </Btn>
          </>
        ) : undefined
      }
    >
      <p className="text-[14px] font-medium">การยอมรับกำลังอัดคอนกรีต</p>
      <p className="mt-0.5 text-[12px]">
        <CheckNote>ค่าเริ่มต้น: เฉลี่ย ≥ fc&apos; และทุกก้อน ≥ fc&apos; − 35 ksc · ตรวจสอบกับมาตรฐานและรายการประกอบแบบของโครงการ</CheckNote>
      </p>
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="ค่าเฉลี่ย ≥ fc' + (ksc)">{numIn(d.concrete.avgOffset, (n) => setC("avgOffset", n), "ค่าเพิ่มจาก fc'")}</Field>
        <Field label="ทุกก้อน ≥ fc' − (ksc)">{numIn(d.concrete.tolKsc, (n) => setC("tolKsc", n), "ค่าลดรายก้อน")}</Field>
        <Field label="อายุทดสอบ (วัน)">
          <input disabled={!perms.edit} value={ages} onChange={(e) => setAges(e.target.value)} className={cx(inputCls, "font-mono")} placeholder="7, 28" />
        </Field>
        <Field label="จำนวนก้อนต่ออายุ">{numIn(d.concrete.specimensPerAge, (n) => setC("specimensPerAge", n), "จำนวนก้อน")}</Field>
        <Field label="เป้าอายุแรก (% ของ fc')">{numIn(d.concrete.earlyPct, (n) => setC("earlyPct", n), "เป้าอายุแรก")}</Field>
      </div>

      <p className="mt-5 text-[14px] font-medium">คุณสมบัติขั้นต่ำเหล็กเสริม</p>
      <p className="mt-0.5 text-[12px]">
        <CheckNote>ค่าเริ่มต้นตาม มอก. 20 / มอก. 24 · ตรวจสอบกับมาตรฐานล่าสุด</CheckNote>
      </p>
      <table className="mt-2 w-full text-[13px]">
        <thead>
          <tr className="text-ink-3">
            <th className="py-1 text-left font-normal">ชั้นคุณภาพ</th>
            <th className="py-1 text-left font-normal">Yield (ksc)</th>
            <th className="py-1 text-left font-normal">Tensile (ksc)</th>
            <th className="py-1 text-left font-normal">Elongation (%)</th>
          </tr>
        </thead>
        <tbody>
          {(Object.keys(d.rebar) as RebarGrade[]).map((g) => (
            <tr key={g} className="border-t border-line">
              <td className="py-1.5 pr-2 font-mono">{g}</td>
              <td className="py-1.5 pr-2">{numIn(d.rebar[g].yieldKsc, (n) => setR(g, "yieldKsc", n), `${g} yield`)}</td>
              <td className="py-1.5 pr-2">{numIn(d.rebar[g].tensileKsc, (n) => setR(g, "tensileKsc", n), `${g} tensile`)}</td>
              <td className="py-1.5">{numIn(d.rebar[g].elongation, (n) => setR(g, "elongation", n), `${g} elongation`)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-5 text-[14px] font-medium">การแจ้งเตือน</p>
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="เตือน RFI ก่อนครบกำหนด (วัน)">{numIn(d.rfiWarnDays, (n) => setD((x) => ({ ...x, rfiWarnDays: n })), "วันเตือน RFI")}</Field>
        <Field label="เตือน NCR เปิดค้างเกิน (วัน)">{numIn(d.ncrOpenDays, (n) => setD((x) => ({ ...x, ncrOpenDays: n })), "วัน NCR")}</Field>
        <Field label="เตือนใบอนุญาตก่อนหมดอายุ (วัน)">{numIn(d.licenseDays, (n) => setD((x) => ({ ...x, licenseDays: n })), "วันใบอนุญาต")}</Field>
      </div>
    </Modal>
  );
}
