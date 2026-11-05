"use client";

import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { Card, CardHead, cx, Field, inputCls } from "@/components/ui";
import { areaCls, Btn, Empty, FilterField, I, KV, Modal, Pill, Segmented, StatCard, type Tone } from "@/components/ops/bits";
import { tableCls, td, th } from "@/components/accounting/bits";
import { MediaField, MediaStrip } from "@/components/media/media-field";
import { thDate, TODAY } from "@/lib/data";
import { addDays } from "@/lib/hr/payroll";
import { ACTIVE_SITES } from "@/lib/hr/seed";
import { inspectionScore } from "@/lib/safety/calc";
import { safetyInspections } from "@/lib/safety/store";
import { INSP_ITEMS, INSP_LABEL, INSP_SHORT, TAG_LABEL, type InspKind, type ItemResult, type SafetyInspection, type ScaffoldTag } from "@/lib/safety/types";
import type { MediaRef } from "@/lib/media";
import { n0, ResultToggle, ScorePill, siteName, SiteSelect, useSafetyAccess } from "./bits";

const TAG_TONE: Record<ScaffoldTag, Tone> = { green: "pos", yellow: "warn", red: "neg" };
const TAG_SHORT: Record<ScaffoldTag, string> = { green: "เขียว", yellow: "เหลือง", red: "แดง" };
const TAG_SWATCH: Record<ScaffoldTag, string> = { green: "bg-pos", yellow: "bg-warn", red: "bg-neg" };

export function InspectionsTab({ q }: { q?: string }) {
  const list = safetyInspections.use();
  const { edit } = useSafetyAccess();
  const [kind, setKind] = useState<"all" | InspKind>("all");
  const [site, setSite] = useState("");
  const [openId, setOpenId] = useState<string | null>(q && list.some((x) => x.id === q) ? q : null);
  const [creating, setCreating] = useState<InspKind | null>(null);

  const shown = list.filter((x) => (kind === "all" || x.kind === kind) && (!site || x.projectId === site)).sort((a, b) => b.date.localeCompare(a.date));
  // latest tag per scaffold
  const latest = new Map<string, SafetyInspection>();
  for (const x of list) if (x.kind === "scaffold" && x.scaffoldNo) {
    const k = `${x.projectId}|${x.scaffoldNo}`;
    const cur = latest.get(k);
    if (!cur || x.date > cur.date) latest.set(k, x);
  }
  const board = [...latest.values()].filter((x) => !site || x.projectId === site).sort((a, b) => a.projectId.localeCompare(b.projectId) || (a.scaffoldNo ?? "").localeCompare(b.scaffoldNo ?? ""));
  const month = addDays(TODAY, -30);
  const walks = list.filter((x) => x.kind === "walk" && x.date > month && (!site || x.projectId === site));
  const avgWalk = walks.length ? Math.round(walks.reduce((s, x) => s + inspectionScore(x.items), 0) / walks.length) : 0;
  const followUps = list.filter((x) => !x.closed && x.followUpDue && (!site || x.projectId === site));
  const current = openId ? list.find((x) => x.id === openId) : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="นั่งร้านป้ายแดง/เหลือง" value={board.filter((x) => x.tag !== "green").length} unit={`จาก ${board.length} ชุด`} tone={board.some((x) => x.tag === "red") ? "neg" : undefined} />
        <StatCard label="คะแนนเดินตรวจเฉลี่ย 30 วัน" value={avgWalk} unit="%" note={`${walks.length} ครั้ง`} />
        <StatCard label="รอแก้ไข" value={followUps.length} unit="รายการ" tone={followUps.some((x) => x.followUpDue! < TODAY) ? "neg" : undefined} note={followUps.filter((x) => x.followUpDue! < TODAY).length ? `เลยกำหนด ${followUps.filter((x) => x.followUpDue! < TODAY).length}` : "ไม่มีเลยกำหนด"} />
        <StatCard label="ตรวจ PPE 30 วัน" value={list.filter((x) => x.kind === "ppe" && x.date > month).length} unit="ครั้ง" />
      </div>

      {board.length > 0 && (
        <Card>
          <CardHead title="สถานะป้ายนั่งร้าน" meta="ล่าสุดของแต่ละชุด" />
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
            {board.map((x) => (
              <button key={x.id} type="button" onClick={() => setOpenId(x.id)} className="flex items-start gap-3 rounded-[10px] border border-line p-3 text-left transition-colors duration-150 hover:bg-raised/60">
                <span aria-hidden className={cx("mt-0.5 h-9 w-2 shrink-0 rounded-full", TAG_SWATCH[x.tag ?? "green"])} />
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium">
                    {x.scaffoldNo} · {TAG_SHORT[x.tag ?? "green"]}
                  </span>
                  <span className="block truncate text-[12px] text-ink-2">{x.location}</span>
                  <span className="block font-mono text-[12px] text-ink-3">
                    {x.projectId} · {x.heightM ? `${x.heightM} ม. · ` : ""}
                    {thDate(x.date)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <div className="flex flex-wrap items-end gap-3 border-b border-line px-5 py-4">
          <Segmented
            value={kind}
            onChange={setKind}
            options={[
              { key: "all", label: "ทั้งหมด" },
              { key: "scaffold", label: INSP_SHORT.scaffold },
              { key: "ppe", label: INSP_SHORT.ppe },
              { key: "walk", label: INSP_SHORT.walk },
            ]}
          />
          <FilterField label="หน้างาน" className="min-w-[220px] flex-1">
            <SiteSelect value={site} onChange={setSite} />
          </FilterField>
          {edit && (
            <div className="flex flex-wrap gap-2">
              {(["scaffold", "ppe", "walk"] as InspKind[]).map((k) => (
                <Btn key={k} small={k !== "walk"} primary={k === "walk"} onClick={() => setCreating(k)}>
                  <Plus {...I} />
                  {INSP_SHORT[k]}
                </Btn>
              ))}
            </div>
          )}
        </div>
        {shown.length ? (
          <div className="overflow-x-auto">
            <table className={cx(tableCls, "min-w-[820px]")}>
              <thead>
                <tr>
                  <th className={cx(th, "pl-5")}>วันที่</th>
                  <th className={th}>ประเภท</th>
                  <th className={th}>หน้างาน / จุดตรวจ</th>
                  <th className={th}>ผู้ตรวจ</th>
                  <th className={th}>คะแนน</th>
                  <th className={th}>ข้อบกพร่อง</th>
                  <th className={cx(th, "pr-5")}>ติดตาม</th>
                </tr>
              </thead>
              <tbody>
                {shown.slice(0, 150).map((x) => {
                  const fails = x.items.filter((i) => i.result === "fail").length;
                  return (
                    <tr key={x.id} className="cursor-pointer hover:bg-raised/50" onClick={() => setOpenId(x.id)}>
                      <td className={cx(td, "pl-5")}>
                        <span className="block">{thDate(x.date)}</span>
                        <span className="font-mono text-[12px] text-ink-3">{x.id}</span>
                      </td>
                      <td className={td}>
                        <span className="flex flex-wrap gap-1">
                          <Pill>{INSP_SHORT[x.kind]}</Pill>
                          {x.tag && <Pill tone={TAG_TONE[x.tag]}>{TAG_SHORT[x.tag]}</Pill>}
                        </span>
                      </td>
                      <td className={cx(td, "max-w-[280px]")}>
                        <span className="block truncate">{siteName(x.projectId)}</span>
                        <span className="text-[12px] text-ink-3">
                          {x.scaffoldNo ? `${x.scaffoldNo} · ` : ""}
                          {x.location}
                        </span>
                      </td>
                      <td className={td}>{x.inspector}</td>
                      <td className={td}>
                        <ScorePill score={inspectionScore(x.items)} />
                      </td>
                      <td className={cx(td, "font-mono")}>{fails || ""}</td>
                      <td className={cx(td, "pr-5")}>
                        {x.closed ? x.followUpDue ? <Pill tone="pos">แก้ไขแล้ว</Pill> : <span className="text-[12px] text-ink-3">-</span> : <Pill tone={x.followUpDue && x.followUpDue < TODAY ? "neg" : "warn"}>ภายใน {x.followUpDue ? thDate(x.followUpDue) : "-"}</Pill>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>ยังไม่มีผลตรวจตามตัวกรอง</Empty>
        )}
      </Card>

      {current && <InspectionDetail x={current} onClose={() => setOpenId(null)} canEdit={edit} />}
      {creating && <InspectionForm kind={creating} defaultSite={site} onClose={() => setCreating(null)} onCreated={(id) => (setCreating(null), setOpenId(id))} />}
    </div>
  );
}

function InspectionDetail({ x, onClose, canEdit }: { x: SafetyInspection; onClose: () => void; canEdit: boolean }) {
  const save = (p: Partial<SafetyInspection>) => safetyInspections.upsert({ ...x, ...p });
  return (
    <Modal
      open
      onClose={onClose}
      title={`${x.id} · ${INSP_LABEL[x.kind]}`}
      width={680}
      footer={
        <>
          {canEdit && !x.closed && (
            <Btn primary onClick={() => save({ closed: true, tag: x.tag && x.tag !== "green" ? "green" : x.tag })}>
              <Check {...I} />
              แก้ไขเรียบร้อย{x.tag && x.tag !== "green" ? " เปลี่ยนเป็นป้ายเขียว" : ""}
            </Btn>
          )}
          <Btn onClick={onClose}>ปิด</Btn>
        </>
      }
    >
      <div className="grid gap-x-6 sm:grid-cols-2">
        <KV k="หน้างาน">{siteName(x.projectId)}</KV>
        <KV k="วันที่">{thDate(x.date)}</KV>
        <KV k="จุดตรวจ">
          {x.scaffoldNo ? `${x.scaffoldNo} · ` : ""}
          {x.location}
        </KV>
        <KV k="ผู้ตรวจ">{x.inspector}</KV>
        {x.tag && (
          <KV k="ป้ายนั่งร้าน">
            <Pill tone={TAG_TONE[x.tag]}>{TAG_LABEL[x.tag]}</Pill>
            {x.heightM ? <span className="ml-2 font-mono text-[12px] text-ink-3">สูง {x.heightM} ม.</span> : null}
          </KV>
        )}
        <KV k="คะแนน">
          <ScorePill score={inspectionScore(x.items)} />
        </KV>
      </div>
      <ul className="mt-3">
        {x.items.map((i) => (
          <li key={i.text} className="flex items-center justify-between gap-3 border-b border-line py-1.5 text-[13px] last:border-0">
            <span className={cx("min-w-0", i.result === "fail" ? "text-neg" : "text-ink")}>
              {i.text}
              {i.note && <span className="ml-1 text-[12px] text-ink-3">· {i.note}</span>}
            </span>
            <Pill tone={i.result === "pass" ? "pos" : i.result === "fail" ? "neg" : "neutral"}>{i.result === "pass" ? "ผ่าน" : i.result === "fail" ? "ไม่ผ่าน" : "ไม่เกี่ยว"}</Pill>
          </li>
        ))}
      </ul>
      {x.actions && (
        <p className="mt-3 text-[13px]">
          <span className="text-ink-3">การแก้ไข: </span>
          {x.actions}
          {x.followUpDue && <span className="text-ink-3"> · ภายใน {thDate(x.followUpDue)}</span>}
        </p>
      )}
      <MediaStrip refs={x.photos} className="mt-3" size={72} />
    </Modal>
  );
}

function InspectionForm({ kind, defaultSite, onClose, onCreated }: { kind: InspKind; defaultSite: string; onClose: () => void; onCreated: (id: string) => void }) {
  const { me } = useSafetyAccess();
  const [projectId, setProjectId] = useState(defaultSite || ACTIVE_SITES[0]?.id || "");
  const [date, setDate] = useState(TODAY);
  const [inspector, setInspector] = useState(me.name);
  const [location, setLocation] = useState(kind === "walk" ? "ทั่วทั้งไซต์" : kind === "ppe" ? "จุดลงเวลา/ทางเข้าไซต์" : "");
  const [scaffoldNo, setScaffoldNo] = useState("");
  const [heightM, setHeightM] = useState(0);
  const [items, setItems] = useState(INSP_ITEMS[kind].map((text) => ({ text, result: "pass" as ItemResult, note: "" })));
  const [actions, setActions] = useState("");
  const [due, setDue] = useState(addDays(TODAY, 3));
  const [photos, setPhotos] = useState<MediaRef[]>([]);
  const score = inspectionScore(items);
  const fails = items.filter((i) => i.result === "fail").length;
  const autoTag: ScaffoldTag = fails === 0 ? "green" : fails <= 2 ? "yellow" : "red";
  const [tag, setTag] = useState<ScaffoldTag | null>(null);
  const finalTag = tag ?? autoTag;
  const ok = projectId && location.trim() && (kind !== "scaffold" || scaffoldNo.trim()) && (!fails || actions.trim());
  const save = () => {
    if (!ok) return;
    const id = safetyInspections.nextId(`SIN-${date.slice(0, 4)}-`);
    safetyInspections.upsert({
      id,
      projectId,
      kind,
      date,
      inspector: inspector.trim() || me.name,
      location: location.trim(),
      scaffoldNo: kind === "scaffold" ? scaffoldNo.trim() : undefined,
      heightM: kind === "scaffold" && heightM ? heightM : undefined,
      tag: kind === "scaffold" ? finalTag : undefined,
      items: items.map((i) => ({ text: i.text, result: i.result, note: i.note.trim() || undefined })),
      photos,
      actions: actions.trim() || undefined,
      followUpDue: fails ? due : undefined,
      closed: !fails,
    });
    onCreated(id);
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={INSP_LABEL[kind]}
      width={720}
      footer={
        <>
          <span className="mr-auto flex items-center gap-2 text-[13px] text-ink-2">
            คะแนน <ScorePill score={score} /> {fails > 0 && <span>ไม่ผ่าน {n0(fails)} ข้อ</span>}
          </span>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!ok} onClick={save}>
            บันทึกผลตรวจ
          </Btn>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <Field label="หน้างาน">
            <SiteSelect value={projectId} onChange={setProjectId} all={false} />
          </Field>
        </div>
        <Field label="วันที่">
          <input type="date" className={inputCls} value={date} max={TODAY} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </Field>
        <Field label="ผู้ตรวจ">
          <input className={inputCls} value={inspector} onChange={(e) => setInspector(e.target.value)} />
        </Field>
        {kind === "scaffold" && (
          <>
            <Field label="รหัสนั่งร้าน">
              <input className={cx(inputCls, "font-mono")} value={scaffoldNo} onChange={(e) => setScaffoldNo(e.target.value)} placeholder="SC-01" />
            </Field>
            <Field label="ความสูง (ม.)">
              <input type="number" min={0} className={cx(inputCls, "font-mono")} value={heightM || ""} onChange={(e) => setHeightM(Math.max(0, Number(e.target.value) || 0))} />
            </Field>
          </>
        )}
        <div className={kind === "scaffold" ? "sm:col-span-2" : "sm:col-span-4"}>
          <Field label="จุดตรวจ">
            <input className={inputCls} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="ด้าน / ชั้น / โซน" />
          </Field>
        </div>
      </div>
      <ul className="mt-4">
        {items.map((i, k) => (
          <li key={i.text} className="flex flex-col gap-1.5 border-b border-line py-2 last:border-0 sm:flex-row sm:items-center">
            <span className="min-w-0 flex-1 text-[13px]">{i.text}</span>
            {i.result === "fail" && <input className={cx(inputCls, "h-7 text-[12px] sm:w-[200px]")} value={i.note} placeholder="สิ่งที่พบ" onChange={(e) => setItems(items.map((x, j) => (j === k ? { ...x, note: e.target.value } : x)))} />}
            <ResultToggle label={i.text} value={i.result} onChange={(r) => setItems(items.map((x, j) => (j === k ? { ...x, result: r } : x)))} />
          </li>
        ))}
      </ul>
      {kind === "scaffold" && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
          <span className="text-ink-2">ป้ายที่ติด</span>
          {(["green", "yellow", "red"] as ScaffoldTag[]).map((t) => (
            <button key={t} type="button" aria-pressed={finalTag === t} onClick={() => setTag(t)} className={cx("inline-flex h-8 items-center gap-2 rounded-[8px] border px-3", finalTag === t ? "border-ink-3 bg-raised" : "border-line")}>
              <span aria-hidden className={cx("size-2.5 rounded-full", TAG_SWATCH[t])} />
              {TAG_LABEL[t]}
            </button>
          ))}
        </div>
      )}
      {fails > 0 && (
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_180px]">
          <Field label="การแก้ไขที่สั่ง">
            <textarea className={areaCls} value={actions} onChange={(e) => setActions(e.target.value)} placeholder="สิ่งที่ต้องแก้ ผู้รับผิดชอบ" />
          </Field>
          <Field label="กำหนดแก้ไขเสร็จ">
            <input type="date" className={inputCls} value={due} min={date} onChange={(e) => setDue(e.target.value)} />
          </Field>
        </div>
      )}
      <div className="mt-3">
        <MediaField value={photos} onChange={setPhotos} label="รูปถ่ายการตรวจ" photosOnly />
      </div>
    </Modal>
  );
}
