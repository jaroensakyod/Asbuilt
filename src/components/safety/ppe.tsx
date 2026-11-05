"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardHead, cx, Field, inputCls } from "@/components/ui";
import { Btn, Empty, FilterField, I, IconBtn, Modal, Pill, StatCard } from "@/components/ops/bits";
import { tableCls, td, th } from "@/components/accounting/bits";
import { SignaturePad } from "@/components/media/signature-pad";
import { MediaStrip } from "@/components/media/media-field";
import { thDate, TODAY } from "@/lib/data";
import { employees } from "@/lib/hr/store";
import type { Employee } from "@/lib/hr/types";
import type { MediaRef } from "@/lib/media";
import { ppeIssues } from "@/lib/safety/store";
import { PPE_ITEMS, PPE_REASON_LABEL, type PpeIssue } from "@/lib/safety/types";
import { n0, siteName, SiteSelect, useSafetyAccess } from "./bits";

const BASIC = ["หมวกนิรภัย", "รองเท้านิรภัย"];

export function PpeTab() {
  const list = ppeIssues.use();
  const emps = employees.use();
  const { edit } = useSafetyAccess();
  const [site, setSite] = useState("");
  const [search, setSearch] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [history, setHistory] = useState<Employee | null>(null);
  const [creating, setCreating] = useState(false);

  const month = TODAY.slice(0, 7);
  const thisMonth = list.filter((x) => x.date.startsWith(month));
  const itemsMonth = thisMonth.reduce((s, x) => s + x.items.reduce((t, i) => t + i.qty, 0), 0);
  const replaceMonth = thisMonth.filter((x) => x.reason !== "new").length;

  const workers = emps.filter((e) => e.type !== "subcontract" && e.status !== "resigned" && e.projectId);
  const held = (() => {
    const m = new Map<string, { items: Map<string, { date: string; qty: number; size?: string }>; last: string }>();
    for (const x of [...list].sort((a, b) => a.date.localeCompare(b.date))) {
      const cur = m.get(x.employeeId) ?? { items: new Map(), last: "" };
      for (const i of x.items) cur.items.set(i.item, { date: x.date, qty: i.qty, size: i.size });
      if (x.date > cur.last) cur.last = x.date;
      m.set(x.employeeId, cur);
    }
    return m;
  })();
  const missingOf = (id: string) => BASIC.filter((b) => !held.get(id)?.items.has(b));
  const missingCount = workers.filter((e) => missingOf(e.id).length).length;

  const s = search.trim().toLowerCase();
  const rows = workers
    .filter((e) => (!site || e.projectId === site) && (!s || e.name.toLowerCase().includes(s) || e.id.toLowerCase().includes(s)))
    .filter((e) => !onlyMissing || missingOf(e.id).length)
    .sort((a, b) => (a.projectId ?? "").localeCompare(b.projectId ?? "") || a.name.localeCompare(b.name));
  const name = (id: string) => emps.find((e) => e.id === id)?.name ?? id;
  const log = list
    .filter((x) => (!site || x.projectId === site) && (!s || name(x.employeeId).toLowerCase().includes(s) || x.id.toLowerCase().includes(s)))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
    .slice(0, 60);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="ใบเบิกเดือนนี้" value={thisMonth.length} unit="ใบ" />
        <StatCard label="จำนวนชิ้นที่จ่ายเดือนนี้" value={n0(itemsMonth)} unit="ชิ้น" />
        <StatCard label="ไม่มีหมวก/รองเท้านิรภัย" value={missingCount} unit="คน" tone={missingCount ? "neg" : undefined} active={onlyMissing} onClick={() => setOnlyMissing((v) => !v)} note="คลิกเพื่อกรอง" />
        <StatCard label="เปลี่ยน/สูญหายเดือนนี้" value={replaceMonth} unit="ใบ" />
      </div>

      <Card>
        <div className="flex flex-wrap items-end gap-3 border-b border-line px-5 py-4">
          <FilterField label="หน้างาน" className="min-w-[220px] flex-1">
            <SiteSelect value={site} onChange={setSite} />
          </FilterField>
          <FilterField label="ค้นหา" className="min-w-[180px] flex-1">
            <input className={inputCls} placeholder="ชื่อหรือรหัสพนักงาน" value={search} onChange={(e) => setSearch(e.target.value)} />
          </FilterField>
          {edit && (
            <Btn primary onClick={() => setCreating(true)}>
              <Plus {...I} />
              เบิก PPE
            </Btn>
          )}
        </div>
        <CardHead title="อุปกรณ์ที่ถือครองรายคน" meta={`${rows.length} คน`} />
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className={cx(tableCls, "min-w-[760px]")}>
              <thead>
                <tr>
                  <th className={cx(th, "pl-5")}>พนักงาน</th>
                  <th className={th}>หน้างาน</th>
                  <th className={th}>อุปกรณ์ที่ได้รับ (ล่าสุด)</th>
                  <th className={th}>เบิกล่าสุด</th>
                  <th className={cx(th, "pr-5")}>ชุดพื้นฐาน</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => {
                  const h = held.get(e.id);
                  const miss = missingOf(e.id);
                  return (
                    <tr key={e.id} className="cursor-pointer transition-colors duration-150 hover:bg-raised/60" onClick={() => setHistory(e)}>
                      <td className={cx(td, "pl-5")}>
                        <span className="block">{e.name}</span>
                        <span className="font-mono text-[12px] text-ink-3">
                          {e.id} · {e.skill ?? e.position}
                        </span>
                      </td>
                      <td className={cx(td, "font-mono text-[12px] text-ink-2")}>{e.projectId}</td>
                      <td className={td}>
                        <span className="text-[12px] text-ink-2">{h ? [...h.items.keys()].join(", ") : "-"}</span>
                      </td>
                      <td className={cx(td, "whitespace-nowrap")}>{h?.last ? thDate(h.last) : "-"}</td>
                      <td className={cx(td, "pr-5")}>{miss.length ? <Pill tone="neg">ขาด {miss.join(", ")}</Pill> : <Pill tone="pos">ครบ</Pill>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>ไม่มีพนักงานตามเงื่อนไข</Empty>
        )}
      </Card>

      <Card>
        <CardHead title="บันทึกการเบิกจ่าย PPE" meta={`ล่าสุด ${log.length} รายการ`} />
        {log.length ? (
          <div className="overflow-x-auto">
            <table className={cx(tableCls, "min-w-[760px]")}>
              <thead>
                <tr>
                  <th className={cx(th, "pl-5")}>วันที่</th>
                  <th className={th}>พนักงาน</th>
                  <th className={th}>รายการ</th>
                  <th className={th}>เหตุผล</th>
                  <th className={cx(th, "pr-5")}>ผู้จ่าย</th>
                </tr>
              </thead>
              <tbody>
                {log.map((x) => (
                  <tr key={x.id}>
                    <td className={cx(td, "pl-5")}>
                      <span className="block whitespace-nowrap">{thDate(x.date)}</span>
                      <span className="font-mono text-[12px] text-ink-3">{x.id}</span>
                    </td>
                    <td className={td}>
                      <span className="block">{name(x.employeeId)}</span>
                      <span className="text-[12px] text-ink-3">{siteName(x.projectId)}</span>
                    </td>
                    <td className={td}>{itemsText(x)}</td>
                    <td className={td}>
                      <Pill tone={x.reason === "new" ? "neutral" : "warn"}>{PPE_REASON_LABEL[x.reason]}</Pill>
                    </td>
                    <td className={cx(td, "pr-5 text-ink-2")}>{x.issuedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>ยังไม่มีการเบิก PPE</Empty>
        )}
      </Card>

      {history && <HistoryModal emp={history} list={list.filter((x) => x.employeeId === history.id)} onClose={() => setHistory(null)} />}
      {creating && <IssueForm defaultSite={site} onClose={() => setCreating(false)} />}
    </div>
  );
}

const itemsText = (x: PpeIssue) => x.items.map((i) => `${i.item}${i.size ? ` (${i.size})` : ""} × ${i.qty}`).join(", ");

function HistoryModal({ emp, list, onClose }: { emp: Employee; list: PpeIssue[]; onClose: () => void }) {
  const rows = [...list].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <Modal open onClose={onClose} title={`ประวัติการเบิก PPE · ${emp.name}`} width={600}>
      {rows.length ? (
        <ul>
          {rows.map((x) => (
            <li key={x.id} className="flex flex-wrap items-start justify-between gap-3 border-b border-line py-2.5 last:border-0">
              <div className="min-w-0">
                <p className="text-[13px]">{itemsText(x)}</p>
                <p className="text-[12px] text-ink-3">
                  {thDate(x.date)} · {PPE_REASON_LABEL[x.reason]} · จ่ายโดย {x.issuedBy} · <span className="font-mono">{x.id}</span>
                </p>
              </div>
              {x.signature && <MediaStrip refs={[x.signature]} size={44} />}
            </li>
          ))}
        </ul>
      ) : (
        <Empty>ยังไม่เคยเบิก PPE</Empty>
      )}
    </Modal>
  );
}

type Row = { item: string; qty: number; size: string };

function IssueForm({ defaultSite, onClose }: { defaultSite: string; onClose: () => void }) {
  const { me } = useSafetyAccess();
  const emps = employees.use();
  const [site, setSite] = useState(defaultSite || "HC-2025-03");
  const [employeeId, setEmployeeId] = useState("");
  const [date, setDate] = useState(TODAY);
  const [reason, setReason] = useState<PpeIssue["reason"]>("new");
  const [rows, setRows] = useState<Row[]>([{ item: "หมวกนิรภัย", qty: 1, size: "" }]);
  const [signature, setSignature] = useState<MediaRef | undefined>();
  const staff = emps.filter((e) => (e.type === "daily" || e.type === "monthly") && e.status !== "resigned" && e.projectId === site);
  const valid = rows.filter((r) => r.item && r.qty > 0);
  const ok = employeeId && valid.length > 0;

  const patch = (k: number, p: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === k ? { ...r, ...p } : r)));
  const submit = () => {
    if (!ok) return;
    ppeIssues.upsert({ id: ppeIssues.nextId("PPE-2026-"), employeeId, projectId: site, date, items: valid.map((r) => ({ item: r.item, qty: r.qty, size: r.size.trim() || undefined })), issuedBy: me.name, reason, signature });
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="เบิก PPE"
      width={620}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!ok} onClick={submit}>
            บันทึกการเบิก
          </Btn>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="หน้างาน">
          <SiteSelect value={site} onChange={(v) => (setSite(v), setEmployeeId(""))} all={false} />
        </Field>
        <Field label="พนักงาน">
          <select className={inputCls} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">เลือกพนักงาน</option>
            {staff.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} · {e.skill ?? e.position}
              </option>
            ))}
          </select>
        </Field>
        <Field label="วันที่">
          <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="เหตุผล">
          <select className={inputCls} value={reason} onChange={(e) => setReason(e.target.value as PpeIssue["reason"])}>
            {(Object.keys(PPE_REASON_LABEL) as PpeIssue["reason"][]).map((r) => (
              <option key={r} value={r}>
                {PPE_REASON_LABEL[r]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="mt-4">
        <p className="mb-1.5 text-[13px] text-ink-2">รายการ</p>
        <div className="flex flex-col gap-2">
          {rows.map((r, k) => (
            <div key={k} className="grid grid-cols-[1fr_72px_80px_32px] items-center gap-2">
              <select className={inputCls} aria-label="อุปกรณ์" value={r.item} onChange={(e) => patch(k, { item: e.target.value })}>
                {PPE_ITEMS.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
              <input type="number" min={1} aria-label="จำนวน" className={cx(inputCls, "text-right font-mono")} value={r.qty} onChange={(e) => patch(k, { qty: Math.max(0, Number(e.target.value) || 0) })} />
              <input aria-label="ขนาด" placeholder="ขนาด" className={inputCls} value={r.size} onChange={(e) => patch(k, { size: e.target.value })} />
              <IconBtn label="ลบรายการ" danger onClick={() => setRows((rs) => rs.filter((_, j) => j !== k))}>
                <Trash2 {...I} />
              </IconBtn>
            </div>
          ))}
        </div>
        <div className="mt-2">
          <Btn small onClick={() => setRows((rs) => [...rs, { item: PPE_ITEMS.find((i) => !rs.some((r) => r.item === i)) ?? PPE_ITEMS[0], qty: 1, size: "" }])}>
            <Plus {...I} />
            เพิ่มรายการ
          </Btn>
        </div>
      </div>
      <div className="mt-4">
        <p className="mb-1.5 text-[13px] text-ink-2">ลายมือชื่อผู้รับอุปกรณ์</p>
        {signature ? (
          <div className="flex items-center gap-3">
            <MediaStrip refs={[signature]} size={64} />
            <Btn small onClick={() => setSignature(undefined)}>
              เซ็นใหม่
            </Btn>
          </div>
        ) : (
          <SignaturePad onSave={(ref) => setSignature(ref)} nameLabel="ชื่อผู้รับ" height={120} />
        )}
      </div>
    </Modal>
  );
}
