"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KanbanSquare, List, Plus, Search, Settings2 } from "lucide-react";
import { Card, cx, Field, inputCls } from "@/components/ui";
import { Btn, Empty, FilterField, I, Modal, Pill, Segmented, Select, StatCard } from "@/components/ops/bits";
import { TODAY, getHouseModel } from "@/lib/data";
import {
  AUTHORITY_LABEL,
  FLAG_LABEL,
  ROUTE_LABEL,
  ROUTE_SHORT,
  USE_LABEL,
  completionKindFor,
  eiaCheck,
  permitChecklist,
  permitState,
  permits,
  useDesignSettings,
  type AuthorityKind,
  type BuildingUse,
  type Permit,
  type PermitRoute,
  type PermitStatus,
} from "@/lib/design";
import { Check, Header, NumInput, PermitPill, ProjectSelect, VerifyNote, dateOr, rowCls, td, th, useAllProjects, usePerms } from "./bits";
import { SettingsModal } from "./stages-view";

const COLS: { key: string; label: string; has: PermitStatus[] }[] = [
  { key: "prep", label: "เตรียมเอกสาร", has: ["preparing", "rejected"] },
  { key: "wait", label: "ยื่นแล้ว รอพิจารณา", has: ["submitted", "query"] },
  { key: "ok", label: "ได้รับอนุญาต/ใบรับแจ้ง", has: ["approved"] },
  { key: "done", label: "แจ้งก่อสร้างเสร็จ / ปิดเรื่อง", has: ["completion", "completed"] },
];

export function PermitsView() {
  const { edit } = usePerms("design");
  const list = permits.use();
  const s = useDesignSettings();
  const all = useAllProjects();
  const [view, setView] = useState<"board" | "table">("board");
  const [q, setQ] = useState("");
  const [route, setRoute] = useState("");
  const [flag, setFlag] = useState("");
  const [creating, setCreating] = useState(false);
  const [setup, setSetup] = useState(false);

  const rows = useMemo(
    () =>
      list
        .map((p) => ({ p, st: permitState(p, TODAY, s), proj: all.find((x) => x.id === p.projectId) }))
        .filter(({ p, st, proj }) => {
          const n = q.trim().toLowerCase();
          if (n && !`${p.projectId} ${proj?.name ?? ""} ${p.authorityName} ${p.permitNo ?? ""}`.toLowerCase().includes(n)) return false;
          if (route && p.route !== route) return false;
          if (flag && !st.flags.includes(flag as never)) return false;
          return true;
        })
        .sort((a, b) => b.st.flags.length - a.st.flags.length || a.p.projectId.localeCompare(b.p.projectId)),
    [list, s, all, q, route, flag],
  );

  const states = list.map((p) => permitState(p, TODAY, s));
  const count = (f: string) => states.filter((x) => x.flags.includes(f as never)).length;
  const inProcess = list.filter((p) => ["preparing", "submitted", "query"].includes(p.status)).length;

  return (
    <>
      <Header
        eyebrow="ออกแบบ"
        title="ขออนุญาตก่อสร้าง"
        sub="ติดตามคำขออนุญาต (ข.1 → อ.1) และการแจ้งตามมาตรา 39 ทวิ ของทุกโครงการ เอกสารประกอบ ข้อซักถามของเจ้าหน้าที่ วันหมดอายุ การต่ออายุ จนถึงแจ้งก่อสร้างเสร็จ"
        actions={
          <>
            <Btn onClick={() => setSetup(true)}>
              <Settings2 {...I} />
              เกณฑ์และระยะเวลา
            </Btn>
            {edit && (
              <Btn primary onClick={() => setCreating(true)}>
                <Plus {...I} />
                เพิ่มคำขอ
              </Btn>
            )}
          </>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="อยู่ระหว่างดำเนินการ" value={inProcess} unit="เรื่อง" note={`ทั้งหมด ${list.length} โครงการ`} />
        <StatCard label={`รอพิจารณาเกิน ${s.permitPendingDays} วัน`} value={count("stuck")} unit="เรื่อง" tone={count("stuck") ? "neg" : undefined} note={`มีข้อซักถามค้าง ${count("query")} เรื่อง`} onClick={() => setFlag(flag === "stuck" ? "" : "stuck")} active={flag === "stuck"} />
        <StatCard label={`ใบอนุญาตหมดอายุใน ${s.permitExpiryDays} วัน`} value={count("expiring") + count("expired")} unit="ใบ" tone={count("expired") ? "neg" : undefined} note={count("expired") ? `หมดอายุแล้ว ${count("expired")} ใบ` : "ยื่นต่ออายุก่อนหมดอายุ"} onClick={() => setFlag(flag === "expiring" ? "" : "expiring")} active={flag === "expiring"} />
        <StatCard label="ปิดเรื่องแล้ว" value={list.filter((p) => p.status === "completed").length} unit="เรื่อง" note={`รอผลแจ้งก่อสร้างเสร็จ ${list.filter((p) => p.status === "completion").length}`} />
      </div>

      <Card className="mb-4">
        <div className="grid grid-cols-2 items-end gap-3 px-4 py-3 lg:grid-cols-6">
          <FilterField label="ค้นหา" className="col-span-2">
            <div className="relative">
              <Search {...I} className="pointer-events-none absolute left-2.5 top-2.5 text-ink-3" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="โครงการ หน่วยงาน เลขที่ใบอนุญาต" className={cx(inputCls, "w-full pl-8")} />
            </div>
          </FilterField>
          <FilterField label="ช่องทาง">
            <Select label="ช่องทาง" value={route} onChange={setRoute}>
              <option value="">ทั้งหมด</option>
              <option value="permit">{ROUTE_LABEL.permit}</option>
              <option value="m39">{ROUTE_LABEL.m39}</option>
            </Select>
          </FilterField>
          <FilterField label="ต้องติดตาม">
            <Select label="ต้องติดตาม" value={flag} onChange={setFlag}>
              <option value="">ทั้งหมด</option>
              {Object.entries(FLAG_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </FilterField>
          <div className="col-span-2 flex justify-end">
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { key: "board", label: "บอร์ดสถานะ", icon: <KanbanSquare {...I} /> },
                { key: "table", label: "ตาราง", icon: <List {...I} /> },
              ]}
            />
          </div>
        </div>
      </Card>

      {view === "board" ? (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          {COLS.map((c) => {
            const items = rows.filter((r) => c.has.includes(r.p.status));
            return (
              <section key={c.key} className="flex flex-col gap-2 rounded-[14px] border border-line bg-raised/50 p-2">
                <header className="flex items-baseline justify-between px-2 pt-1">
                  <h2 className="text-[14px] font-medium">{c.label}</h2>
                  <span className="num font-mono text-[12px] text-ink-3">{items.length}</span>
                </header>
                {items.map(({ p, st, proj }) => (
                  <Link key={p.id} href={`/permits/${p.projectId}`} className="rounded-[10px] border border-line bg-card px-3 py-2.5 transition-colors duration-150 hover:border-line-strong">
                    <p className="text-[14px]">{proj?.name ?? p.projectId}</p>
                    <p className="font-mono text-[12px] text-ink-3">
                      {p.projectId} · {ROUTE_SHORT[p.route]}
                    </p>
                    <p className="mt-1 text-[12px] text-ink-2">{p.authorityName}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      <PermitPill s={p.status} />
                      {st.flags.map((f) => (
                        <Pill key={f} tone={f === "expired" || f === "stuck" ? "neg" : "warn"}>
                          {FLAG_LABEL[f]}
                        </Pill>
                      ))}
                    </div>
                    <p className="mt-1.5 text-[12px] text-ink-3">{cardLine(p, st)}</p>
                  </Link>
                ))}
                {items.length === 0 && <p className="px-2 py-4 text-center text-[12px] text-ink-3">ไม่มีรายการ</p>}
              </section>
            );
          })}
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left">
              <thead>
                <tr>
                  <th className={cx(th, "px-5")}>โครงการ</th>
                  <th className={th}>ช่องทาง</th>
                  <th className={th}>หน่วยงาน</th>
                  <th className={th}>เอกสาร</th>
                  <th className={th}>ยื่น</th>
                  <th className={th}>เลขที่/วันที่ได้รับ</th>
                  <th className={th}>หมดอายุ</th>
                  <th className={cx(th, "pr-5")}>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ p, st, proj }) => (
                  <tr key={p.id} className={rowCls}>
                    <td className={cx(td, "px-5")}>
                      <Link href={`/permits/${p.projectId}`} className="block hover:underline">
                        {proj?.name ?? p.projectId}
                      </Link>
                      <span className="font-mono text-[12px] text-ink-3">{p.projectId}</span>
                    </td>
                    <td className={td}>{ROUTE_SHORT[p.route]}</td>
                    <td className={td}>{p.authorityName}</td>
                    <td className={cx(td, "num font-mono")}>
                      {st.docs.ready}/{st.docs.total}
                    </td>
                    <td className={td}>
                      {dateOr(p.submittedAt)}
                      {st.pendingDays !== undefined && <span className={cx("block text-[12px]", st.flags.includes("stuck") ? "text-neg" : "text-ink-3")}>รอ {st.pendingDays} วัน</span>}
                    </td>
                    <td className={td}>
                      {p.permitNo ?? "–"}
                      {p.issuedAt && <span className="block text-[12px] text-ink-3">{dateOr(p.issuedAt)}</span>}
                    </td>
                    <td className={td}>
                      {dateOr(st.expiry)}
                      {st.expiresIn !== undefined && <span className={cx("block text-[12px]", st.expiresIn < 0 ? "text-neg" : st.flags.includes("expiring") ? "text-warn" : "text-ink-3")}>{st.expiresIn < 0 ? `เกิน ${-st.expiresIn} วัน` : `อีก ${st.expiresIn} วัน`}</span>}
                    </td>
                    <td className={cx(td, "pr-5")}>
                      <div className="flex flex-wrap gap-1">
                        <PermitPill s={p.status} />
                        {st.flags.map((f) => (
                          <Pill key={f} tone={f === "expired" || f === "stuck" ? "neg" : "warn"}>
                            {FLAG_LABEL[f]}
                          </Pill>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length === 0 && <Empty>ไม่พบคำขออนุญาตตามตัวกรอง</Empty>}
        </Card>
      )}
      {creating && <NewPermitModal onClose={() => setCreating(false)} existing={list.map((p) => p.projectId)} />}
      {setup && <SettingsModal s={s} onClose={() => setSetup(false)} />}
    </>
  );
}

function cardLine(p: Permit, st: ReturnType<typeof permitState>) {
  if (p.status === "preparing") return `เอกสารพร้อม ${st.docs.ready}/${st.docs.total}`;
  if (p.status === "submitted" || p.status === "query") return `ยื่น ${dateOr(p.submittedAt)} · รอ ${st.pendingDays ?? 0} วัน`;
  if (p.status === "approved") return `${p.permitNo ?? ""} · หมดอายุ ${dateOr(st.expiry)}${st.expiresIn !== undefined ? ` (${st.expiresIn < 0 ? `เกิน ${-st.expiresIn}` : `อีก ${st.expiresIn}`} วัน)` : ""}`;
  if (p.status === "completion") return `แจ้งก่อสร้างเสร็จ ${dateOr(p.completionSubmittedAt)}`;
  if (p.status === "completed") return `ปิดเรื่อง ${dateOr(p.completionIssuedAt)} · ${p.completionRef ?? ""}`;
  return "";
}

const buildingUseOfModel = (code?: string): BuildingUse => {
  const t = code ? getHouseModel(code)?.type : undefined;
  return t === "condo" ? "condo" : t === "homeoffice" ? "homeoffice" : t === "townhome" ? "townhome" : "house";
};

function NewPermitModal({ onClose, existing }: { onClose: () => void; existing: string[] }) {
  const router = useRouter();
  const s = useDesignSettings();
  const all = useAllProjects().filter((p) => !existing.includes(p.id) && p.status !== "delivered");
  const [projectId, setProjectId] = useState(all[0]?.id ?? "");
  const proj = all.find((p) => p.id === projectId);
  const [route, setRoute] = useState<PermitRoute>("permit");
  const [kind, setKind] = useState<AuthorityKind>(proj?.province === "กรุงเทพฯ" ? "district" : "municipality");
  const [authority, setAuthority] = useState("");
  const [use, setUse] = useState<BuildingUse>(buildingUseOfModel(proj?.modelCode));
  const [height, setHeight] = useState(proj ? Math.round((proj.floors * 3.3 + 2.2) * 10) / 10 : 9);
  const [area, setArea] = useState(proj?.area ?? 200);
  const [units, setUnits] = useState(0);
  const [owner, setOwner] = useState(true);
  const eia = eiaCheck({ height, floorArea: area, units, use }, s);
  const pickProject = (id: string) => {
    setProjectId(id);
    const p = all.find((x) => x.id === id);
    if (!p) return;
    setUse(buildingUseOfModel(p.modelCode));
    setHeight(Math.round((p.floors * 3.3 + 2.2) * 10) / 10);
    setArea(p.area);
    setKind(p.province === "กรุงเทพฯ" ? "district" : "municipality");
  };
  const save = () => {
    if (!projectId || !authority.trim()) return;
    const input = { route, use, height, floorArea: area, units: units || undefined, ownerIsApplicant: owner };
    const p: Permit = {
      id: `PMT-${projectId}`,
      projectId,
      route,
      authorityKind: kind,
      authorityName: authority.trim(),
      use,
      height,
      floorArea: area,
      units: units || undefined,
      ownerIsApplicant: owner,
      docs: permitChecklist(input, s),
      queries: [],
      status: "preparing",
      extensions: [],
      completionKind: completionKindFor(use),
    };
    permits.upsert(p);
    onClose();
    router.push(`/permits/${projectId}`);
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="เพิ่มคำขออนุญาตก่อสร้าง"
      width={680}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!projectId || !authority.trim()} onClick={save}>
            สร้างและเตรียมเอกสาร
          </Btn>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="โครงการ">
            <ProjectSelect value={projectId} onChange={pickProject} list={all} />
          </Field>
        </div>
        <Field label="ช่องทาง">
          <Select label="ช่องทาง" value={route} onChange={(v) => setRoute(v as PermitRoute)}>
            <option value="permit">{ROUTE_LABEL.permit}</option>
            <option value="m39">{ROUTE_LABEL.m39}</option>
          </Select>
        </Field>
        <Field label="ประเภทหน่วยงานท้องถิ่น">
          <Select label="หน่วยงาน" value={kind} onChange={(v) => setKind(v as AuthorityKind)}>
            {Object.entries(AUTHORITY_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="ชื่อหน่วยงาน">
            <input value={authority} onChange={(e) => setAuthority(e.target.value)} placeholder={kind === "district" ? "เช่น สำนักงานเขตบางเขน" : kind === "sao" ? "เช่น องค์การบริหารส่วนตำบล…" : "เช่น เทศบาลนครนนทบุรี"} className={inputCls} />
          </Field>
        </div>
        <Field label="ประเภทอาคาร">
          <Select label="ประเภทอาคาร" value={use} onChange={(v) => setUse(v as BuildingUse)}>
            {Object.entries(USE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="ความสูงอาคาร (ม.)">
          <NumInput value={height} onChange={setHeight} step={0.1} />
        </Field>
        <Field label="พื้นที่อาคารรวม (ตร.ม.)">
          <NumInput value={area} onChange={setArea} />
        </Field>
        {use === "condo" && (
          <Field label="จำนวนห้องชุด">
            <NumInput value={units} onChange={setUnits} />
          </Field>
        )}
        <div className="sm:col-span-2">
          <Check checked={owner} onChange={setOwner} label="ผู้ขออนุญาตเป็นเจ้าของที่ดิน (ไม่ต้องมีหนังสือยินยอม)" />
        </div>
      </div>
      <div className={cx("mt-3 rounded-[10px] px-3 py-2 text-[13px]", eia.required ? "bg-warn-soft text-warn" : "bg-raised text-ink-2")}>
        {eia.required ? `ต้องจัดทำรายงาน EIA: ${eia.reasons.join(" · ")}` : `ไม่เข้าเกณฑ์ EIA (สูง < ${s.eiaHeightM} ม. และพื้นที่ < ${s.eiaAreaM2.toLocaleString("th-TH")} ตร.ม.)`}
        <span className="ml-2">
          <VerifyNote />
        </span>
      </div>
    </Modal>
  );
}
