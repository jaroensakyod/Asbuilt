"use client";

import { useState } from "react";
import { Plus, Settings2, Trash2 } from "lucide-react";
import { Card, CardHead, cx, Field, inputCls } from "@/components/ui";
import { areaCls, Btn, Empty, I, IconBtn, MiniBars, Modal, Pill } from "@/components/ops/bits";
import { tableCls, td, tdR, th, thR } from "@/components/accounting/bits";
import { team, thDate, TODAY } from "@/lib/data";
import { addDays, prevPeriod } from "@/lib/hr/payroll";
import { ACTIVE_SITES } from "@/lib/hr/seed";
import { attendance, employees } from "@/lib/hr/store";
import { daysWithoutLti, isLti, jpCheck, ltifr, manHours } from "@/lib/safety/calc";
import { incidents, safetyOfficers, safetySettings, toolboxTalks, useSafetySettings, useSiteSafety } from "@/lib/safety/store";
import { JP_LABEL, type JpLevel, type JpRung, type SafetySettings } from "@/lib/safety/types";
import { n0, siteName, SiteSelect, useSafetyAccess, VerifyNote } from "./bits";

const LEVELS = Object.keys(JP_LABEL) as JpLevel[];

export function KpiTab() {
  const sites = useSiteSafety();
  const sheets = attendance.use();
  const inc = incidents.use();
  const talks = toolboxTalks.use();
  const officers = safetyOfficers.use();
  const settings = useSafetySettings();
  const { edit } = useSafetyAccess();
  const [assigning, setAssigning] = useState(false);
  const [editing, setEditing] = useState(false);
  const [calc, setCalc] = useState(45);

  // LTIFR only over the window that has attendance (man-hours) in the system, at most 12 months
  const first = sheets.reduce((m, x) => (x.date < m ? x.date : m), TODAY);
  const yearAgo = first > addDays(TODAY, -365) ? addDays(first, -1) : addDays(TODAY, -365);
  const month = addDays(TODAY, -30);
  const periods = Array.from({ length: 6 }, (_, i) => prevPeriod(TODAY.slice(0, 7), 5 - i));
  const monthly = periods.map((p) => ({
    p,
    hours: manHours(sheets, settings.hoursPerDay, (s) => s.date.startsWith(p)),
    lti: inc.filter((i) => isLti(i) && i.date.startsWith(p)).length,
    nm: inc.filter((i) => i.cls === "near_miss" && i.date.startsWith(p)).length,
    fa: inc.filter((i) => i.cls === "first_aid" && i.date.startsWith(p)).length,
  }));
  const result = jpCheck(calc, settings.ladder, []);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHead title="ตัวชี้วัดและ จป. ตามหน้างาน" meta={`ชั่วโมงทำงานจากใบลงเวลาตั้งแต่ ${thDate(addDays(yearAgo, 1))} · LTIFR ต่อ ${n0(settings.ltifrBase)} ชม.`} />
        <div className="overflow-x-auto">
          <table className={cx(tableCls, "min-w-[1040px]")}>
            <thead>
              <tr>
                <th className={cx(th, "pl-5")}>หน้างาน</th>
                <th className={thR}>ลูกจ้าง</th>
                <th className={th}>จป. ที่ต้องมี</th>
                <th className={th}>จป. ที่มี</th>
                <th className={thR}>ชม.-คน</th>
                <th className={thR}>LTI</th>
                <th className={thR}>LTIFR</th>
                <th className={thR}>ไม่มี LTI</th>
                <th className={thR}>เกือบเกิด</th>
                <th className={cx(thR, "pr-5")}>Talk 30 วัน</th>
              </tr>
            </thead>
            <tbody>
              {sites.map((s) => {
                const p = ACTIVE_SITES.find((x) => x.id === s.projectId)!;
                const h = manHours(sheets, settings.hoursPerDay, (x) => x.projectId === s.projectId && x.date > yearAgo);
                const l = inc.filter((i) => i.projectId === s.projectId && isLti(i) && i.date > yearAgo).length;
                return (
                  <tr key={s.projectId}>
                    <td className={cx(td, "pl-5")}>
                      <span className="block max-w-[200px] truncate">{p.name}</span>
                      <span className="font-mono text-[12px] text-ink-3">{p.id}</span>
                    </td>
                    <td className={cx(tdR, "font-mono")}>{s.headcount}</td>
                    <td className={td}>
                      <span className="flex flex-wrap gap-1">
                        {s.check.needs.length ? s.check.needs.map((n) => (
                          <Pill key={n.level} tone={n.ok ? "pos" : "neg"}>
                            {JP_LABEL[n.level]}
                          </Pill>
                        )) : <span className="text-[12px] text-ink-3">ไม่ต้องมี</span>}
                        {s.check.committee && <Pill tone="warn">คณะกรรมการความปลอดภัย</Pill>}
                      </span>
                    </td>
                    <td className={cx(td, "max-w-[260px] text-[12px] text-ink-2")}>{s.officers.length ? s.officers.map((o) => `${o.name.split(" ")[0]} (${JP_LABEL[o.level].replace("จป.", "")})`).join(", ") : <span className="text-neg">ไม่มี</span>}</td>
                    <td className={cx(tdR, "font-mono")}>{n0(h)}</td>
                    <td className={cx(tdR, "font-mono", l > 0 && "text-neg")}>{l}</td>
                    <td className={cx(tdR, "font-mono")}>{ltifr(l, h, settings.ltifrBase).toFixed(2)}</td>
                    <td className={cx(tdR, "font-mono")}>{n0(daysWithoutLti(inc, p.id, p.start, TODAY))}</td>
                    <td className={cx(tdR, "font-mono")}>{inc.filter((i) => i.projectId === p.id && i.cls === "near_miss" && i.date > yearAgo).length}</td>
                    <td className={cx(tdR, "pr-5 font-mono")}>{talks.filter((t) => t.projectId === p.id && t.date > month).length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-line px-5 py-2.5 text-[12px] text-ink-3">จำนวนลูกจ้างนับจากพนักงานประจำหน้างาน คนงานรายวัน และจำนวนคนของทีมเหมาค่าแรง (หรือจากรายงานประจำวันล่าสุดถ้ามากกว่า) · จป. นับจากใบรับรองการอบรมในหน้าทักษะ และผู้ที่มอบหมายด้านล่าง</p>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHead title="รายเดือน" meta="6 เดือนล่าสุด" />
          <div className="px-5 pt-4">
            <MiniBars values={monthly.map((m) => m.hours)} highlightLast />
          </div>
          <div className="overflow-x-auto">
            <table className={cx(tableCls, "mt-2")}>
              <thead>
                <tr>
                  <th className={cx(th, "pl-5")}>เดือน</th>
                  <th className={thR}>ชม.-คน</th>
                  <th className={thR}>LTI</th>
                  <th className={thR}>ปฐมพยาบาล</th>
                  <th className={thR}>เกือบเกิด</th>
                  <th className={cx(thR, "pr-5")}>LTIFR</th>
                </tr>
              </thead>
              <tbody>
                {monthly.map((m) => (
                  <tr key={m.p}>
                    <td className={cx(td, "pl-5 font-mono")}>{m.p}</td>
                    <td className={cx(tdR, "font-mono")}>{m.hours ? n0(m.hours) : "-"}</td>
                    <td className={cx(tdR, "font-mono")}>{m.lti}</td>
                    <td className={cx(tdR, "font-mono")}>{m.fa}</td>
                    <td className={cx(tdR, "font-mono")}>{m.nm}</td>
                    <td className={cx(tdR, "pr-5 font-mono")}>{m.hours ? ltifr(m.lti, m.hours, settings.ltifrBase).toFixed(2) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-line px-5 py-2.5 text-[12px] text-ink-3">เดือนที่ไม่มีใบลงเวลาในระบบไม่คำนวณ LTIFR</p>
        </Card>

        <Card>
          <CardHead
            title="คำนวณ จป. ตามจำนวนลูกจ้าง"
            action={
              edit && (
                <Btn small onClick={() => setEditing(true)}>
                  <Settings2 {...I} />
                  ตั้งค่าเกณฑ์
                </Btn>
              )
            }
          />
          <div className="px-5 py-4">
            <div className="flex items-end gap-3">
              <Field label="จำนวนลูกจ้างในสถานประกอบกิจการ">
                <input type="number" min={0} className={cx(inputCls, "w-40 font-mono")} value={calc} onChange={(e) => setCalc(Math.max(0, Number(e.target.value) || 0))} />
              </Field>
            </div>
            <ul className="mt-3 text-[13px]">
              {result.needs.length ? (
                result.needs.map((n) => (
                  <li key={n.level} className="border-b border-line py-1.5">
                    ต้องมี {JP_LABEL[n.level]} อย่างน้อย 1 คน
                  </li>
                ))
              ) : (
                <li className="py-1.5 text-ink-3">ยังไม่ถึงเกณฑ์ที่ต้องแต่งตั้ง จป.</li>
              )}
              {result.committee && <li className="border-b border-line py-1.5">ต้องจัดให้มีคณะกรรมการความปลอดภัย อาชีวอนามัย และสภาพแวดล้อมในการทำงาน</li>}
            </ul>
            <table className="mt-3 w-full text-[12px] text-ink-2">
              <tbody>
                {[...settings.ladder].sort((a, b) => a.min - b.min).map((r) => (
                  <tr key={r.min + r.level} className="border-b border-line">
                    <td className="py-1 font-mono">≥ {r.min} คน</td>
                    <td className="py-1">
                      {JP_LABEL[r.level]}
                      {r.committee ? " + คณะกรรมการความปลอดภัย" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2">
              <VerifyNote>ตรวจสอบกับกฎกระทรวง จป. 2565 ล่าสุด เกณฑ์ขึ้นกับประเภทกิจการ ปรับได้ที่ตั้งค่าเกณฑ์</VerifyNote>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHead
          title="จป. ที่มอบหมายเพิ่ม"
          meta="เจ้าหน้าที่ความปลอดภัยของบริษัทที่ดูแลหลายหน้างาน"
          action={
            edit && (
              <Btn small onClick={() => setAssigning(true)}>
                <Plus {...I} />
                มอบหมาย
              </Btn>
            )
          }
        />
        {officers.length ? (
          <ul>
            {officers.map((o) => (
              <li key={o.id} className="flex items-center gap-3 border-b border-line px-5 py-2 text-[13px] last:border-0">
                <span className="min-w-0 flex-1">
                  {o.name} · {JP_LABEL[o.level]}
                  <span className="ml-2 text-[12px] text-ink-3">
                    {o.projectId} {siteName(o.projectId)} · ตั้งแต่ {o.from}
                  </span>
                </span>
                {edit && (
                  <IconBtn label="ยกเลิกการมอบหมาย" danger onClick={() => safetyOfficers.remove(o.id)}>
                    <Trash2 {...I} />
                  </IconBtn>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Empty>ยังไม่มีการมอบหมาย จป. เพิ่มเติม · จป. ประจำหน้างานนับจากใบรับรองของพนักงานโดยอัตโนมัติ</Empty>
        )}
      </Card>

      {assigning && <AssignForm onClose={() => setAssigning(false)} />}
      {editing && <SettingsForm s={settings} onClose={() => setEditing(false)} />}
    </div>
  );
}

function AssignForm({ onClose }: { onClose: () => void }) {
  const emps = employees.use();
  const safetyTeam = team.filter((m) => m.role === "safety" && m.active);
  const staff = emps.filter((e) => e.type === "monthly" && e.status !== "resigned");
  const [projectId, setProjectId] = useState(ACTIVE_SITES[0]?.id ?? "");
  const [who, setWho] = useState(safetyTeam[0] ? `m:${safetyTeam[0].id}` : staff[0] ? `e:${staff[0].id}` : "");
  const [level, setLevel] = useState<JpLevel>("professional");
  const save = () => {
    const [k, id] = who.split(":");
    const name = k === "m" ? safetyTeam.find((m) => m.id === id)?.name : staff.find((e) => e.id === id)?.name;
    if (!name) return;
    safetyOfficers.upsert({ id: safetyOfficers.nextId("JPA-"), projectId, name, level, memberId: k === "m" ? id : undefined, employeeId: k === "e" ? id : undefined, from: TODAY });
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="มอบหมาย จป. ให้หน้างาน"
      width={520}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!who} onClick={save}>
            บันทึก
          </Btn>
        </>
      }
    >
      <div className="grid gap-3">
        <Field label="หน้างาน">
          <SiteSelect value={projectId} onChange={setProjectId} all={false} />
        </Field>
        <Field label="ผู้ได้รับมอบหมาย">
          <select className={inputCls} value={who} onChange={(e) => setWho(e.target.value)}>
            {safetyTeam.length > 0 && (
              <optgroup label="ทีมงาน บทบาท จป.">
                {safetyTeam.map((m) => (
                  <option key={m.id} value={`m:${m.id}`}>
                    {m.name}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="พนักงานรายเดือน">
              {staff.map((e) => (
                <option key={e.id} value={`e:${e.id}`}>
                  {e.name} · {e.position}
                </option>
              ))}
            </optgroup>
          </select>
        </Field>
        <Field label="ระดับ">
          <select className={inputCls} value={level} onChange={(e) => setLevel(e.target.value as JpLevel)}>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {JP_LABEL[l]}
              </option>
            ))}
          </select>
        </Field>
        <p className="text-[12px] text-ink-3">ควรมีใบรับรองการอบรมระดับนี้ในหน้าทักษะ & ใบรับรองด้วย</p>
      </div>
    </Modal>
  );
}

function SettingsForm({ s, onClose }: { s: SafetySettings; onClose: () => void }) {
  const [ladder, setLadder] = useState<JpRung[]>(s.ladder.map((r) => ({ ...r })));
  const [base, setBase] = useState(s.ltifrBase);
  const [hours, setHours] = useState(s.hoursPerDay);
  const [pm, setPm] = useState(s.pm25Limit);
  const [items, setItems] = useState(s.notifyItems.join("\n"));
  const save = () => {
    safetySettings.upsert({ ...s, ladder: ladder.filter((r) => r.min > 0).sort((a, b) => a.min - b.min), ltifrBase: base, hoursPerDay: hours, pm25Limit: pm, notifyItems: items.split("\n").map((x) => x.trim()).filter(Boolean) });
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="ตั้งค่าเกณฑ์ความปลอดภัย"
      width={640}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary onClick={save}>
            บันทึก
          </Btn>
        </>
      }
    >
      <h3 className="mb-1 text-[14px] font-medium">ขั้นจำนวนลูกจ้าง → จป.</h3>
      <div className="flex flex-col gap-1.5">
        {ladder.map((r, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] text-ink-2">ตั้งแต่</span>
            <input type="number" min={1} aria-label="จำนวนลูกจ้างขั้นต่ำ" className={cx(inputCls, "h-8 w-20 font-mono")} value={r.min} onChange={(e) => setLadder(ladder.map((x, k) => (k === i ? { ...x, min: Math.max(0, Number(e.target.value) || 0) } : x)))} />
            <span className="text-[13px] text-ink-2">คน</span>
            <select aria-label="ระดับ จป." className={cx(inputCls, "h-8")} value={r.level} onChange={(e) => setLadder(ladder.map((x, k) => (k === i ? { ...x, level: e.target.value as JpLevel } : x)))}>
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {JP_LABEL[l]}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-[13px] text-ink-2">
              <input type="checkbox" className="accent-[var(--accent)]" checked={!!r.committee} onChange={(e) => setLadder(ladder.map((x, k) => (k === i ? { ...x, committee: e.target.checked } : x)))} />
              คณะกรรมการ
            </label>
            <IconBtn label="ลบขั้น" danger onClick={() => setLadder(ladder.filter((_, k) => k !== i))}>
              <Trash2 {...I} />
            </IconBtn>
          </div>
        ))}
        <div>
          <Btn small onClick={() => setLadder([...ladder, { min: 200, level: "professional" }])}>
            <Plus {...I} />
            เพิ่มขั้น
          </Btn>
        </div>
      </div>
      <VerifyNote>ค่าเริ่มต้น ≥2 จป.หัวหน้างาน · ≥20 จป.เทคนิค · ≥50 จป.เทคนิคขั้นสูง + คณะกรรมการ · ≥100 จป.วิชาชีพ ตรวจสอบกับกฎกระทรวง จป. 2565 ล่าสุด</VerifyNote>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Field label="ฐาน LTIFR (ชม.-คน)">
          <select className={inputCls} value={base} onChange={(e) => setBase(Number(e.target.value))}>
            <option value={1000000}>1,000,000</option>
            <option value={200000}>200,000</option>
          </select>
        </Field>
        <Field label="ชั่วโมงทำงานต่อวัน">
          <input type="number" min={1} max={12} className={cx(inputCls, "font-mono")} value={hours} onChange={(e) => setHours(Math.max(1, Number(e.target.value) || 8))} />
        </Field>
        <Field label="เกณฑ์ PM2.5 (µg/m³)">
          <input type="number" min={0} step={0.5} className={cx(inputCls, "font-mono")} value={pm} onChange={(e) => setPm(Math.max(0, Number(e.target.value) || 0))} />
        </Field>
      </div>
      <div className="mt-3">
        <Field label="รายการที่ต้องแจ้ง/ดำเนินการเมื่อเกิดอุบัติเหตุร้ายแรง (บรรทัดละรายการ)">
          <textarea className={cx(areaCls, "min-h-[140px]")} value={items} onChange={(e) => setItems(e.target.value)} />
        </Field>
        <VerifyNote>ระยะเวลาแจ้งพนักงานตรวจความปลอดภัยและ กท.16 ตรวจสอบกับประกาศล่าสุด</VerifyNote>
      </div>
    </Modal>
  );
}
