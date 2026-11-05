"use client";

import { useMemo, useState } from "react";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { Card, CardHead, cx, Field, inputCls } from "@/components/ui";
import { Btn, Empty, FilterField, I, IconBtn, Modal, Pill, Select } from "@/components/ops/bits";
import { team, thDate, TODAY } from "@/lib/data";
import {
  BRANCHES,
  checkLicensing,
  COUNCIL_LABEL,
  DEFAULT_LICENSE_RULES,
  diffDays,
  DUTY_LABEL,
  LEVEL_LABEL,
  licensees,
  projectLicensing,
  requiredFor,
  saveEngSettings,
  useEngSettings,
  type Council,
  type Duty,
  type LicLevel,
  type Licensee,
  type LicenseRule,
  type ProjectLicensing,
} from "@/lib/engineering";
import { CheckNote, Due, rowCls, SearchBox, td, th, useActiveProjects, useEngPerms } from "./bits";

const levelName = (c: Council, l: LicLevel) => LEVEL_LABEL[c][l];
const DUTIES = Object.keys(DUTY_LABEL) as Duty[];
const LEVELS: LicLevel[] = [1, 2, 3];

function useNew(key: number, open: () => void) {
  const [seen, setSeen] = useState(key);
  if (key !== seen) {
    setSeen(key);
    open();
  }
}

// ---------- licence registry + project check ----------

export function LicensesTab({ newKey }: { newKey: number }) {
  const perms = useEngPerms();
  const s = useEngSettings();
  const all = licensees.use();
  const pl = projectLicensing.use();
  const projects = useActiveProjects();
  const [q, setQ] = useState("");
  const [council, setCouncil] = useState("");
  const [edit, setEdit] = useState<Licensee | "new" | null>(null);
  const [assign, setAssign] = useState<string | null>(null);
  useNew(newKey, () => setEdit("new"));

  const usedIn = (id: string) => pl.filter((x) => Object.values(x.assigned).includes(id)).length;
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return all
      .filter((l) => !council || l.council === council)
      .filter((l) => !t || `${l.name} ${l.licenseNo} ${l.company ?? ""} ${l.branch}`.toLowerCase().includes(t))
      .sort((a, b) => a.expiry.localeCompare(b.expiry));
  }, [all, q, council]);

  const projRows = projects
        .filter((p) => p.status !== "delivered")
        .map((p) => {
          const rec = pl.find((x) => x.projectId === p.id);
          const floors = rec?.floors ?? p.floors;
          const area = rec?.area ?? p.area;
          const checks = checkLicensing(s.rules, floors, area, rec?.assigned ?? {}, all, TODAY, levelName);
          return { p, rec, floors, area, checks, bad: checks.filter((c) => !c.ok).length };
        })
        .sort((a, b) => b.bad - a.bad || a.p.id.localeCompare(b.p.id));
  const assigning = assign ? projRows.find((r) => r.p.id === assign) : undefined;

  return (
    <>
      <Card className="mb-4">
        <CardHead title="ผู้ประกอบวิชาชีพ" meta={`${rows.length} ราย`} />
        <div className="grid grid-cols-2 gap-3 border-b border-line px-4 py-3 lg:grid-cols-4">
          <SearchBox value={q} onChange={setQ} placeholder="ชื่อ เลขใบอนุญาต บริษัท" className="col-span-2" />
          <FilterField label="สภาวิชาชีพ">
            <Select label="สภาวิชาชีพ" value={council} onChange={setCouncil}>
              <option value="">ทั้งหมด</option>
              {(Object.keys(COUNCIL_LABEL) as Council[]).map((c) => (
                <option key={c} value={c}>
                  {COUNCIL_LABEL[c]}
                </option>
              ))}
            </Select>
          </FilterField>
        </div>
        {rows.length === 0 ? (
          <Empty>ไม่พบผู้ประกอบวิชาชีพ</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead>
                <tr>
                  <th className={th}>ชื่อ</th>
                  <th className={th}>สภา · สาขา</th>
                  <th className={th}>ระดับ</th>
                  <th className={th}>เลขทะเบียน</th>
                  <th className={th}>หมดอายุ</th>
                  <th className={th}>โครงการ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => {
                  const d = diffDays(TODAY, l.expiry);
                  return (
                    <tr key={l.id} className={rowCls} onClick={() => perms.edit && setEdit(l)}>
                      <td className={td}>
                        {l.name}
                        <span className="block text-[12px] text-ink-3">{l.memberId ? `พนักงาน ${l.memberId}` : (l.company ?? "บุคคลภายนอก")}</span>
                      </td>
                      <td className={cx(td, "text-[13px]")}>
                        {COUNCIL_LABEL[l.council]}
                        <span className="block text-[12px] text-ink-3">{l.branch}</span>
                      </td>
                      <td className={cx(td, "text-[13px]")}>{levelName(l.council, l.level)}</td>
                      <td className={cx(td, "font-mono text-[13px]")}>{l.licenseNo}</td>
                      <td className={td}>
                        <Due date={l.expiry} warnDays={s.licenseDays} />
                        {d < 0 ? (
                          <span className="mt-1 block">
                            <Pill tone="neg">หมดอายุ</Pill>
                          </span>
                        ) : d <= s.licenseDays ? (
                          <span className="mt-1 block">
                            <Pill tone="warn">ต่ออายุ</Pill>
                          </span>
                        ) : null}
                      </td>
                      <td className={cx(td, "num font-mono text-[13px]")}>{usedIn(l.id)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardHead title="ตรวจคุณสมบัติผู้ออกแบบและผู้ควบคุมงานรายโครงการ" meta={`${projRows.filter((r) => r.bad).length} โครงการไม่ผ่าน`} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead>
              <tr>
                <th className={th}>โครงการ</th>
                <th className={th}>ขนาดอาคาร</th>
                {DUTIES.map((d) => (
                  <th key={d} className={th}>
                    {DUTY_LABEL[d]}
                  </th>
                ))}
                <th className={th}>ผล</th>
              </tr>
            </thead>
            <tbody>
              {projRows.map(({ p, floors, area, checks, bad }) => (
                <tr key={p.id} className={rowCls} onClick={() => perms.edit && setAssign(p.id)}>
                  <td className={td}>
                    <span className="block max-w-[200px] truncate">{p.name}</span>
                    <span className="font-mono text-[12px] text-ink-3">{p.id}</span>
                  </td>
                  <td className={cx(td, "num font-mono text-[13px]")}>
                    {floors} ชั้น
                    <span className="block text-[12px] text-ink-3">{area.toLocaleString("th-TH")} ตร.ม.</span>
                  </td>
                  {DUTIES.map((duty) => {
                    const c = checks.find((x) => x.duty === duty);
                    if (!c) return <td key={duty} className={cx(td, "text-[12px] text-ink-3")}>ไม่บังคับ</td>;
                    const exp = c.licensee ? diffDays(TODAY, c.licensee.expiry) : 999;
                    return (
                      <td key={duty} className={cx(td, "text-[13px]")}>
                        <span className={cx("block max-w-[180px] truncate", !c.ok && "text-neg")}>{c.licensee?.name ?? "ยังไม่กำหนด"}</span>
                        <span className="block text-[12px] text-ink-3">ต้อง{levelName(c.rule!.council, c.rule!.minLevel)}ขึ้นไป</span>
                        {c.problems.map((x) => (
                          <span key={x} className="block text-[12px] text-neg">
                            {x}
                          </span>
                        ))}
                        {c.ok && exp <= s.licenseDays && <span className="block text-[12px] text-warn">ใบอนุญาตหมดอายุใน {exp} วัน</span>}
                      </td>
                    );
                  })}
                  <td className={td}>
                    <Pill tone={bad ? "neg" : "pos"}>{bad ? `ไม่ผ่าน ${bad} ตำแหน่ง` : "ผ่านเกณฑ์"}</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-line px-5 py-2.5 text-[12px] text-ink-3">
          ตรวจตามตารางเกณฑ์ในแท็บเกณฑ์ใบอนุญาต · <CheckNote>ตรวจสอบกับข้อบังคับล่าสุด</CheckNote>
        </p>
      </Card>

      {edit && <LicenseeForm init={edit === "new" ? undefined : edit} onClose={() => setEdit(null)} canDelete={edit !== "new" && usedIn(edit.id) === 0} />}
      {assigning && <AssignModal projectId={assigning.p.id} name={assigning.p.name} baseFloors={assigning.p.floors} baseArea={assigning.p.area} rec={assigning.rec} onClose={() => setAssign(null)} />}
    </>
  );
}

function LicenseeForm({ init, onClose, canDelete }: { init?: Licensee; onClose: () => void; canDelete: boolean }) {
  const [d, setD] = useState<Licensee>(() => init ?? { id: "", name: "", council: "coe", branch: "โยธา", level: 1, licenseNo: "", expiry: "" });
  const set = <K extends keyof Licensee>(k: K, v: Licensee[K]) => setD((x) => ({ ...x, [k]: v }));
  const ok = d.name.trim() && d.licenseNo.trim() && d.expiry;
  const save = () => {
    if (!ok) return;
    let id = d.id;
    if (!id) {
      const max = licensees.all().reduce((m, x) => Math.max(m, Number(x.id.replace(/\D/g, "")) || 0), 0);
      id = `LIC-${String(max + 1).padStart(3, "0")}`;
    }
    licensees.upsert({ ...d, id, name: d.name.trim() });
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={init ? `แก้ไข ${init.name}` : "เพิ่มผู้ประกอบวิชาชีพ"}
      width={640}
      footer={
        <>
          {init && canDelete && (
            <Btn
              danger
              onClick={() => {
                if (!window.confirm(`ลบ ${init.name}`)) return;
                licensees.remove(init.id);
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
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="พนักงานในบริษัท">
          <Select
            label="พนักงานในบริษัท"
            value={d.memberId ?? ""}
            onChange={(v) => {
              const m = team.find((x) => x.id === v);
              setD((x) => ({ ...x, memberId: v || undefined, name: m?.name ?? x.name, phone: m?.phone ?? x.phone, company: m ? undefined : x.company }));
            }}
          >
            <option value="">บุคคลภายนอก / ที่ปรึกษา</option>
            {team
              .filter((m) => m.active)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="ชื่อ-นามสกุล">
          <input value={d.name} onChange={(e) => set("name", e.target.value)} className={inputCls} />
        </Field>
        {!d.memberId && (
          <Field label="บริษัท / สังกัด">
            <input value={d.company ?? ""} onChange={(e) => set("company", e.target.value || undefined)} className={inputCls} />
          </Field>
        )}
        <Field label="โทรศัพท์">
          <input value={d.phone ?? ""} onChange={(e) => set("phone", e.target.value || undefined)} className={cx(inputCls, "font-mono")} />
        </Field>
        <Field label="สภาวิชาชีพ">
          <Select label="สภาวิชาชีพ" value={d.council} onChange={(v) => setD((x) => ({ ...x, council: v as Council, branch: BRANCHES[v as Council][0] }))}>
            {(Object.keys(COUNCIL_LABEL) as Council[]).map((c) => (
              <option key={c} value={c}>
                {COUNCIL_LABEL[c]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="สาขา">
          <Select label="สาขา" value={d.branch} onChange={(v) => set("branch", v)}>
            {BRANCHES[d.council].map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="ระดับ">
          <Select label="ระดับ" value={String(d.level)} onChange={(v) => set("level", Number(v) as LicLevel)}>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {levelName(d.council, l)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="เลขทะเบียนใบอนุญาต">
          <input value={d.licenseNo} onChange={(e) => set("licenseNo", e.target.value)} className={cx(inputCls, "font-mono")} />
        </Field>
        <Field label="วันหมดอายุ">
          <input type="date" value={d.expiry} onChange={(e) => set("expiry", e.target.value)} className={cx(inputCls, "font-mono")} />
        </Field>
      </div>
      {d.expiry && <p className="mt-3 text-[13px] text-ink-2">ใบอนุญาตใช้ได้ถึง {thDate(d.expiry)}</p>}
    </Modal>
  );
}

function AssignModal({ projectId, name, baseFloors, baseArea, rec, onClose }: { projectId: string; name: string; baseFloors: number; baseArea: number; rec?: ProjectLicensing; onClose: () => void }) {
  const s = useEngSettings();
  const lic = licensees.use();
  const [d, setD] = useState<ProjectLicensing>(() => rec ?? { id: projectId, projectId, assigned: {} });
  const floors = d.floors ?? baseFloors;
  const area = d.area ?? baseArea;
  const req = requiredFor(s.rules, floors, area);
  const checks = checkLicensing(s.rules, floors, area, d.assigned, lic, TODAY, levelName);
  const save = () => {
    projectLicensing.upsert(d);
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`ผู้ออกแบบและผู้ควบคุมงาน · ${name}`}
      width={720}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary onClick={save}>
            บันทึก
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label={`จำนวนชั้น (โครงการ ${baseFloors})`}>
          <input type="number" value={d.floors ?? ""} placeholder={String(baseFloors)} onChange={(e) => setD((x) => ({ ...x, floors: e.target.value === "" ? undefined : Number(e.target.value) }))} className={cx(inputCls, "font-mono")} />
        </Field>
        <Field label={`พื้นที่อาคาร ตร.ม. (โครงการ ${baseArea})`}>
          <input type="number" value={d.area ?? ""} placeholder={String(baseArea)} onChange={(e) => setD((x) => ({ ...x, area: e.target.value === "" ? undefined : Number(e.target.value) }))} className={cx(inputCls, "font-mono")} />
        </Field>
      </div>
      <div className="mt-4 flex flex-col gap-3">
        {DUTIES.map((duty) => {
          const rule = req[duty];
          const c = checks.find((x) => x.duty === duty);
          const opts = lic.filter((l) => !rule || l.council === rule.council);
          return (
            <div key={duty} className="rounded-[10px] border border-line p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-[14px]">{DUTY_LABEL[duty]}</p>
                <span className="text-[12px] text-ink-3">{rule ? `ต้อง${levelName(rule.council, rule.minLevel)} สาขา${rule.branch}ขึ้นไป · ${rule.label}` : "ไม่บังคับตามเกณฑ์"}</span>
              </div>
              <div className="mt-2">
                <Select label={DUTY_LABEL[duty]} value={d.assigned[duty] ?? ""} onChange={(v) => setD((x) => ({ ...x, assigned: { ...x.assigned, [duty]: v || undefined } }))}>
                  <option value="">ยังไม่กำหนด</option>
                  {opts.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} · {levelName(l.council, l.level)} {l.branch} · หมดอายุ {thDate(l.expiry)}
                    </option>
                  ))}
                </Select>
              </div>
              {c && (c.ok ? <p className="mt-1.5 text-[12px] text-pos">ผ่านเกณฑ์</p> : c.problems.map((x) => <p key={x} className="mt-1.5 text-[12px] text-neg">{x}</p>))}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[12px]">
        <CheckNote>เกณฑ์เป็นค่าเริ่มต้นที่ตั้งได้ ตรวจสอบกับข้อบังคับล่าสุด</CheckNote>
      </p>
    </Modal>
  );
}

// ---------- rule table ----------

export function RulesTab() {
  const perms = useEngPerms();
  const s = useEngSettings();
  const [rows, setRows] = useState<LicenseRule[]>(s.rules);
  const [dirty, setDirty] = useState(false);
  const [base, setBase] = useState(s.rules);
  if (base !== s.rules && !dirty) {
    // saved rules arrived (hydration / another tab): show them
    setBase(s.rules);
    setRows(s.rules);
  }
  const edit = (i: number, patch: Partial<LicenseRule>) => {
    setRows((r) => r.map((x, k) => (k === i ? { ...x, ...patch } : x)));
    setDirty(true);
  };
  const add = () => {
    const max = rows.reduce((m, x) => Math.max(m, Number(x.id.replace(/\D/g, "")) || 0), 0);
    setRows((r) => [...r, { id: `R${String(max + 1).padStart(2, "0")}`, label: "", minFloors: 0, minArea: 0, duty: "struct", council: "coe", branch: "โยธา", minLevel: 1 }]);
    setDirty(true);
  };
  const cell = "px-2 py-1.5 align-top first:pl-5 last:pr-5";
  return (
    <Card>
      <CardHead
        title="เกณฑ์ระดับใบอนุญาตตามขนาดอาคาร"
        meta={`${rows.length} เกณฑ์`}
        action={
          perms.edit ? (
            <span className="flex gap-2">
              <Btn
                small
                onClick={() => {
                  setRows(DEFAULT_LICENSE_RULES);
                  setDirty(true);
                }}
              >
                <RotateCcw {...I} />
                ค่าเริ่มต้น
              </Btn>
              <Btn
                small
                primary
                disabled={!dirty}
                onClick={() => {
                  saveEngSettings({ ...s, rules: rows });
                  setDirty(false);
                }}
              >
                บันทึกเกณฑ์
              </Btn>
            </span>
          ) : undefined
        }
      />
      <p className="px-5 pt-3 text-[13px] text-ink-2">
        แต่ละแถวใช้เมื่อจำนวนชั้น ≥ ค่าที่กำหนด หรือพื้นที่ ≥ ค่าที่กำหนด (0 = ใช้กับทุกอาคาร) ถ้าหลายแถวตรงกันจะใช้ระดับที่สูงที่สุด · <CheckNote>ค่าเริ่มต้นเป็นตัวอย่าง ตรวจสอบกับข้อบังคับล่าสุด (กฎกระทรวงกำหนดวิชาชีพวิศวกรรมควบคุม / สถาปัตยกรรมควบคุม)</CheckNote>
      </p>
      <div className="overflow-x-auto">
        <table className="mt-2 w-full min-w-[980px] text-[13px]">
          <thead>
            <tr>
              <th className={th}>เงื่อนไข</th>
              <th className={th}>ชั้น ≥</th>
              <th className={th}>พื้นที่ ≥ ตร.ม.</th>
              <th className={th}>หน้าที่</th>
              <th className={th}>สภา</th>
              <th className={th}>สาขา</th>
              <th className={th}>ระดับขั้นต่ำ</th>
              <th className={th} />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className="border-t border-line">
                <td className={cell}>
                  <input disabled={!perms.edit} value={r.label} onChange={(e) => edit(i, { label: e.target.value })} className={cx(inputCls, "h-8 w-full min-w-[220px] text-[13px]")} />
                </td>
                <td className={cell}>
                  <input disabled={!perms.edit} type="number" value={r.minFloors} onChange={(e) => edit(i, { minFloors: Number(e.target.value) })} className={cx(inputCls, "h-8 w-16 font-mono text-[13px]")} />
                </td>
                <td className={cell}>
                  <input disabled={!perms.edit} type="number" value={r.minArea} onChange={(e) => edit(i, { minArea: Number(e.target.value) })} className={cx(inputCls, "h-8 w-24 font-mono text-[13px]")} />
                </td>
                <td className={cell}>
                  <select disabled={!perms.edit} aria-label="หน้าที่" value={r.duty} onChange={(e) => edit(i, { duty: e.target.value as Duty })} className={cx(inputCls, "h-8 text-[13px]")}>
                    {DUTIES.map((d) => (
                      <option key={d} value={d}>
                        {DUTY_LABEL[d]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className={cell}>
                  <select disabled={!perms.edit} aria-label="สภา" value={r.council} onChange={(e) => edit(i, { council: e.target.value as Council, branch: BRANCHES[e.target.value as Council][0] })} className={cx(inputCls, "h-8 text-[13px]")}>
                    {(Object.keys(COUNCIL_LABEL) as Council[]).map((c) => (
                      <option key={c} value={c}>
                        {COUNCIL_LABEL[c]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className={cell}>
                  <select disabled={!perms.edit} aria-label="สาขา" value={r.branch} onChange={(e) => edit(i, { branch: e.target.value })} className={cx(inputCls, "h-8 text-[13px]")}>
                    {BRANCHES[r.council].map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </td>
                <td className={cell}>
                  <select disabled={!perms.edit} aria-label="ระดับขั้นต่ำ" value={r.minLevel} onChange={(e) => edit(i, { minLevel: Number(e.target.value) as LicLevel })} className={cx(inputCls, "h-8 text-[13px]")}>
                    {LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {levelName(r.council, l)}
                      </option>
                    ))}
                  </select>
                </td>
                <td className={cell}>
                  {perms.edit && (
                    <IconBtn
                      label="ลบเกณฑ์"
                      danger
                      onClick={() => {
                        setRows((x) => x.filter((_, k) => k !== i));
                        setDirty(true);
                      }}
                    >
                      <Trash2 {...I} />
                    </IconBtn>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {perms.edit && (
        <div className="flex items-center gap-2 border-t border-line px-5 py-3">
          <Btn small onClick={add}>
            <Plus {...I} />
            เพิ่มเกณฑ์
          </Btn>
          {dirty && <span className="text-[12px] text-warn">ยังไม่ได้บันทึก</span>}
        </div>
      )}
    </Card>
  );
}

