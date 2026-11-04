"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownToLine, ArrowRightLeft, ClipboardList, PackageMinus, Pencil, Plus, Search, ShoppingCart, X } from "lucide-react";
import { Card, cx, Field, inputCls } from "@/components/ui";
import { Btn, Empty, FilterField, I, IconBtn, Modal, Pill, Select, StatCard, type Tone } from "@/components/ops/bits";
import { COST_CODES, type CostCode } from "@/lib/biz";
import { getProject, thDate, TODAY } from "@/lib/data";
import {
  addDays,
  adjustStock,
  avgOf,
  balKey,
  CATEGORIES,
  isActiveProject,
  issueStock,
  locProject,
  MOVE_LABEL,
  newPR,
  receiveStock,
  replay,
  siteLoc,
  stockItems,
  stockMoves,
  transferStock,
  WAREHOUSE,
  type Category,
  type MoveKind,
  type StockItem,
} from "@/lib/procurement";
import { Amt, fmt, td, th, useProcPerms, useProjects } from "./bits";
import { CodeSelect, ProjectSelect } from "./forms";

const MOVE_TONE: Record<MoveKind, Tone> = { receive: "pos", issue: "neutral", transfer: "accent", adjust: "warn" };
type Tab = "stock" | "moves" | "items";

export function InventoryView() {
  const router = useRouter();
  const perms = useProcPerms();
  const projects = useProjects();
  const items = stockItems.use();
  const moves = stockMoves.use();
  const [tab, setTab] = useState<Tab>("stock");
  const [loc, setLoc] = useState<string>(WAREHOUSE);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [kind, setKind] = useState("");
  const [form, setForm] = useState<{ mode: MoveKind; itemId?: string; from?: string } | null>(null);
  const [itemForm, setItemForm] = useState<{ item?: StockItem } | null>(null);

  const bal = useMemo(() => replay(moves).bal, [moves]);
  const itemOf = (id: string) => items.find((i) => i.id === id);
  const locName = (l: string) => (l === WAREHOUSE ? "คลังกลาง" : `${locProject(l)} · ${getProject(locProject(l) ?? "")?.name ?? ""}`);

  const locations = useMemo(() => {
    const set = new Set<string>([WAREHOUSE]);
    for (const p of projects) if (isActiveProject(p)) set.add(siteLoc(p.id));
    for (const [k, b] of bal) if (b.qty > 0) set.add(k.split("|")[0]);
    return [...set];
  }, [projects, bal]);

  const rows = (() => {
    const n = q.trim().toLowerCase();
    const out: { loc: string; item: StockItem; qty: number; value: number; avg: number; low: boolean }[] = [];
    for (const l of loc === "ALL" ? locations : [loc]) {
      for (const item of items) {
        if (!item.stock) continue;
        const b = bal.get(balKey(l, item.id));
        const qty = b?.qty ?? 0;
        const low = l === WAREHOUSE && !!item.min && qty < item.min;
        if (qty === 0 && !(l === WAREHOUSE && item.min)) continue;
        if (cat && item.category !== cat) continue;
        if (lowOnly && !low) continue;
        if (n && !`${item.id} ${item.name}`.toLowerCase().includes(n)) continue;
        out.push({ loc: l, item, qty, value: b?.value ?? 0, avg: avgOf(b), low });
      }
    }
    return out.sort((a, b) => Number(b.low) - Number(a.low) || a.item.costCode.localeCompare(b.item.costCode) || a.item.id.localeCompare(b.item.id));
  })();

  const lowWh = items.filter((i) => i.stock && i.min && (bal.get(balKey(WAREHOUSE, i.id))?.qty ?? 0) < i.min);
  const totalValue = [...bal.values()].reduce((t, b) => t + Math.max(0, b.value), 0);
  const whValue = items.reduce((t, i) => t + Math.max(0, bal.get(balKey(WAREHOUSE, i.id))?.value ?? 0), 0);
  const moves30 = moves.filter((m) => m.date >= addDays(TODAY, -30));

  const moveRows = (() => {
    const n = q.trim().toLowerCase();
    return moves
      .filter((m) => loc === "ALL" || m.from === loc || m.to === loc)
      .filter((m) => !kind || m.kind === kind)
      .filter((m) => !cat || itemOf(m.itemId)?.category === cat)
      .filter((m) => !n || `${m.id} ${m.itemId} ${itemOf(m.itemId)?.name ?? ""} ${m.ref ?? ""} ${m.projectId ?? ""} ${m.note ?? ""}`.toLowerCase().includes(n))
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  })();

  const reorder = () => {
    if (!lowWh.length) return;
    const pr = newPR({
      costCode: lowWh[0].costCode,
      date: TODAY,
      requestedBy: perms.me.name,
      lines: lowWh.map((i) => {
        const have = bal.get(balKey(WAREHOUSE, i.id))?.qty ?? 0;
        return { itemId: i.id, description: i.name, qty: Math.max(1, Math.ceil((i.min! * 2 - have) / 10) * 10), unit: i.unit, neededBy: addDays(TODAY, 7) };
      }),
      note: "เติมสต็อกคลังกลาง รายการต่ำกว่าจุดสั่งซื้อ",
    });
    router.push(`/purchasing/${pr.id}`);
  };

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
        <div>
          <p className="mb-1 text-[13px] text-ink-3">จัดซื้อ/คลัง</p>
          <h1 className="text-[30px] font-normal leading-[1.15]">คลังวัสดุ</h1>
          <p className="mt-2 max-w-[48rem] text-ink-2">คลังกลางและสต็อกหน้างานทุกไซต์ รับเข้าอัตโนมัติจากการรับสินค้าตามใบสั่งซื้อ เบิกเข้าโครงการตามรหัสต้นทุน มูลค่าคิดแบบถัวเฉลี่ยเคลื่อนที่</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {perms.edit && (
            <>
              <Btn onClick={() => setForm({ mode: "receive" })}>
                <ArrowDownToLine {...I} />
                รับเข้า
              </Btn>
              <Btn onClick={() => setForm({ mode: "transfer" })}>
                <ArrowRightLeft {...I} />
                โอนย้าย
              </Btn>
              <Btn onClick={() => setForm({ mode: "adjust" })}>
                <ClipboardList {...I} />
                ปรับยอดตรวจนับ
              </Btn>
            </>
          )}
          {perms.request && (
            <Btn primary onClick={() => setForm({ mode: "issue", from: loc === "ALL" ? WAREHOUSE : loc })}>
              <PackageMinus {...I} />
              เบิกวัสดุ
            </Btn>
          )}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="มูลค่าคงคลังรวม" value={perms.money ? (totalValue / 1e6).toFixed(2) : "•••"} unit="ล้านบาท" note={perms.money ? `คลังกลาง ฿${Math.round(whValue).toLocaleString("th-TH")}` : "ถัวเฉลี่ยเคลื่อนที่"} />
        <StatCard
          label="ต่ำกว่าจุดสั่งซื้อ"
          value={lowWh.length}
          unit="รายการ"
          tone={lowWh.length ? "neg" : undefined}
          note="คลังกลาง · คลิกเพื่อกรอง"
          active={lowOnly}
          onClick={() => {
            setTab("stock");
            setLoc(WAREHOUSE);
            setLowOnly(!lowOnly);
          }}
        />
        <StatCard label="ความเคลื่อนไหว 30 วัน" value={moves30.length} unit="รายการ" note={`รับ ${moves30.filter((m) => m.kind === "receive").length} · เบิก ${moves30.filter((m) => m.kind === "issue").length} · โอน ${moves30.filter((m) => m.kind === "transfer").length}`} />
        <StatCard label="จุดเก็บ" value={locations.length} unit="แห่ง" note="คลังกลาง + ไซต์ที่กำลังก่อสร้าง" />
      </div>

      {lowWh.length > 0 && (
        <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 border-neg/30 px-5 py-3">
          <p className="text-[14px]">
            <span className="text-neg">ต่ำกว่าจุดสั่งซื้อ {lowWh.length} รายการ</span>
            <span className="text-ink-2"> · {lowWh.map((i) => i.name).join(", ")}</span>
          </p>
          {perms.request && (
            <Btn small onClick={reorder}>
              <ShoppingCart {...I} />
              สร้างใบขอซื้อเติมสต็อก
            </Btn>
          )}
        </Card>
      )}

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-0.5 border-b border-line px-3 py-2">
          {(
            [
              ["stock", "คงคลัง"],
              ["moves", "ความเคลื่อนไหว"],
              ["items", "ทะเบียนวัสดุ"],
            ] as [Tab, string][]
          ).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setTab(k)} className={cx("flex h-8 items-center rounded-[8px] px-3 text-[13px] transition-colors duration-150", tab === k ? "bg-raised text-ink" : "text-ink-2 hover:text-ink")}>
              {label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 px-4 py-3 lg:grid-cols-6">
          <FilterField label="ค้นหา" className="col-span-2">
            <div className="relative">
              <Search {...I} className="pointer-events-none absolute left-2.5 top-2.5 text-ink-3" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="รหัส ชื่อวัสดุ เลขที่อ้างอิง" className={cx(inputCls, "w-full pl-8")} />
            </div>
          </FilterField>
          {tab !== "items" && (
            <FilterField label="จุดเก็บ" className="col-span-2">
              <Select label="จุดเก็บ" value={loc} onChange={setLoc}>
                <option value="ALL">ทุกจุดเก็บ</option>
                {locations.map((l) => (
                  <option key={l} value={l}>
                    {locName(l)}
                  </option>
                ))}
              </Select>
            </FilterField>
          )}
          <FilterField label="หมวด">
            <Select label="หมวด" value={cat} onChange={setCat}>
              <option value="">ทุกหมวด</option>
              {[...new Set(items.map((i) => i.category))].map((c) => (
                <option key={c} value={c}>
                  {CATEGORIES[c]}
                </option>
              ))}
            </Select>
          </FilterField>
          {tab === "moves" ? (
            <FilterField label="ประเภท">
              <Select label="ประเภท" value={kind} onChange={setKind}>
                <option value="">ทุกประเภท</option>
                {Object.entries(MOVE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </FilterField>
          ) : tab === "stock" ? (
            <label className="flex items-end gap-2 pb-2 text-[13px] text-ink-2">
              <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} className="size-4 accent-[var(--accent)]" />
              เฉพาะต่ำกว่าจุดสั่งซื้อ
            </label>
          ) : (
            perms.edit && (
              <div className="flex items-end">
                <Btn onClick={() => setItemForm({})}>
                  <Plus {...I} />
                  เพิ่มวัสดุ
                </Btn>
              </div>
            )
          )}
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          {tab === "stock" && (
            <table className="w-full min-w-[900px] text-left">
              <thead>
                <tr>
                  <th className={cx(th, "px-5")}>วัสดุ</th>
                  {loc === "ALL" && <th className={th}>จุดเก็บ</th>}
                  <th className={cx(th, "text-right")}>คงเหลือ</th>
                  <th className={cx(th, "text-right")}>จุดสั่งซื้อ</th>
                  <th className={cx(th, "text-right")}>ต้นทุนเฉลี่ย</th>
                  <th className={cx(th, "text-right")}>มูลค่า</th>
                  <th className={cx(th, "pr-5 text-right")} />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.loc}|${r.item.id}`} className="border-t border-line">
                    <td className={cx(td, "px-5")}>
                      <span className="block">{r.item.name}</span>
                      <span className="block font-mono text-[12px] text-ink-3">
                        {r.item.id} · {r.item.costCode} {COST_CODES[r.item.costCode]}
                      </span>
                    </td>
                    {loc === "ALL" && <td className={cx(td, "text-[13px]")}>{locName(r.loc)}</td>}
                    <td className={cx(td, "text-right")}>
                      <span className={cx("num font-mono", r.low && "text-neg")}>{r.qty.toLocaleString("th-TH")}</span> <span className="text-[12px] text-ink-3">{r.item.unit}</span>
                      {r.low && (
                        <span className="block">
                          <Pill tone="neg">ต่ำกว่าจุดสั่งซื้อ</Pill>
                        </span>
                      )}
                    </td>
                    <td className={cx(td, "num text-right font-mono text-[13px] text-ink-3")}>{r.loc === WAREHOUSE && r.item.min ? r.item.min.toLocaleString("th-TH") : "–"}</td>
                    <td className={cx(td, "text-right text-[13px]")}>
                      <Amt n={r.avg} show={perms.money} />
                    </td>
                    <td className={cx(td, "text-right text-[13px]")}>
                      <Amt n={r.value} show={perms.money} />
                    </td>
                    <td className={cx(td, "pr-5 text-right")}>
                      {perms.request && r.qty > 0 && (
                        <IconBtn label="เบิกวัสดุ" onClick={() => setForm({ mode: "issue", itemId: r.item.id, from: r.loc })}>
                          <PackageMinus {...I} />
                        </IconBtn>
                      )}
                      {perms.edit && r.qty > 0 && (
                        <IconBtn label="โอนย้าย" onClick={() => setForm({ mode: "transfer", itemId: r.item.id, from: r.loc })}>
                          <ArrowRightLeft {...I} />
                        </IconBtn>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === "stock" && rows.length === 0 && <Empty>ไม่มีวัสดุคงเหลือที่จุดเก็บนี้</Empty>}

          {tab === "moves" && (
            <table className="w-full min-w-[1080px] text-left">
              <thead>
                <tr>
                  <th className={cx(th, "px-5")}>เลขที่ · วันที่</th>
                  <th className={th}>ประเภท</th>
                  <th className={th}>วัสดุ</th>
                  <th className={cx(th, "text-right")}>จำนวน</th>
                  <th className={th}>จาก → ไป</th>
                  <th className={th}>โครงการ · อ้างอิง</th>
                  <th className={cx(th, "pr-5 text-right")}>มูลค่า</th>
                </tr>
              </thead>
              <tbody>
                {moveRows.slice(0, 400).map((m) => {
                  const item = itemOf(m.itemId);
                  const outOfLoc = loc !== "ALL" && m.from === loc;
                  const sign = m.kind === "adjust" ? (m.qty < 0 ? "−" : "+") : loc === "ALL" ? "" : outOfLoc ? "−" : "+";
                  return (
                    <tr key={m.id} className="border-t border-line">
                      <td className={cx(td, "px-5")}>
                        <span className="font-mono text-[12px] text-ink-2">{m.id}</span>
                        <span className="block text-[12px] text-ink-3">{thDate(m.date)}</span>
                      </td>
                      <td className={td}>
                        <Pill tone={MOVE_TONE[m.kind]}>{MOVE_LABEL[m.kind]}</Pill>
                      </td>
                      <td className={cx(td, "text-[13px]")}>
                        <span className="block max-w-[260px] truncate">{item?.name ?? m.itemId}</span>
                        <span className="block text-[12px] text-ink-3">{m.note ?? m.by}</span>
                      </td>
                      <td className={cx(td, "num text-right font-mono text-[13px]")}>
                        {sign}
                        {Math.abs(m.qty).toLocaleString("th-TH")} <span className="font-sans text-[12px] text-ink-3">{item?.unit}</span>
                      </td>
                      <td className={cx(td, "text-[12px] text-ink-2")}>
                        {m.from ? locName(m.from).split(" · ")[0] : "–"} → {m.to ? locName(m.to).split(" · ")[0] : m.kind === "issue" ? "ใช้งาน" : "–"}
                      </td>
                      <td className={cx(td, "text-[12px] text-ink-3")}>
                        {m.projectId && (
                          <span className="block text-ink-2">
                            {m.projectId}
                            {m.costCode ? ` · ${m.costCode}` : ""}
                          </span>
                        )}
                        {m.ref && <span className="font-mono">{m.ref}</span>}
                      </td>
                      <td className={cx(td, "pr-5 text-right text-[13px]")}>
                        <Amt n={Math.abs(m.qty) * m.unitCost} show={perms.money} />
                        {perms.money && <span className="block text-[11px] text-ink-3">@{fmt(m.unitCost)}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {tab === "moves" && moveRows.length === 0 && <Empty>ไม่มีความเคลื่อนไหวตามตัวกรอง</Empty>}
          {tab === "moves" && moveRows.length > 400 && <p className="border-t border-line px-5 py-3 text-[13px] text-ink-3">แสดง 400 รายการล่าสุด จาก {moveRows.length}</p>}

          {tab === "items" && (
            <table className="w-full min-w-[900px] text-left">
              <thead>
                <tr>
                  <th className={cx(th, "px-5")}>รหัส</th>
                  <th className={th}>ชื่อวัสดุ</th>
                  <th className={th}>หมวด</th>
                  <th className={th}>รหัสต้นทุน</th>
                  <th className={cx(th, "text-right")}>ราคาอ้างอิง</th>
                  <th className={cx(th, "text-right")}>จุดสั่งซื้อ</th>
                  <th className={th}>เก็บสต็อก</th>
                  <th className={cx(th, "pr-5")} />
                </tr>
              </thead>
              <tbody>
                {items
                  .filter((i) => !cat || i.category === cat)
                  .filter((i) => !q.trim() || `${i.id} ${i.name}`.toLowerCase().includes(q.trim().toLowerCase()))
                  .map((i) => (
                    <tr key={i.id} className="border-t border-line">
                      <td className={cx(td, "px-5 font-mono text-[12px]")}>{i.id}</td>
                      <td className={cx(td, "text-[14px]")}>
                        {i.name}
                        <span className="block text-[12px] text-ink-3">หน่วย {i.unit}</span>
                      </td>
                      <td className={cx(td, "text-[13px] text-ink-2")}>{CATEGORIES[i.category]}</td>
                      <td className={cx(td, "text-[13px] text-ink-2")}>
                        {i.costCode} · {COST_CODES[i.costCode]}
                      </td>
                      <td className={cx(td, "text-right text-[13px]")}>
                        <Amt n={i.price} show={perms.money} />
                      </td>
                      <td className={cx(td, "num text-right font-mono text-[13px]")}>{i.min ?? "–"}</td>
                      <td className={cx(td, "text-[13px]")}>{i.stock ? "เก็บสต็อก" : <span className="text-ink-3">ใช้เมื่อส่งถึง</span>}</td>
                      <td className={cx(td, "pr-5 text-right")}>
                        {perms.edit && (
                          <IconBtn label="แก้ไขวัสดุ" onClick={() => setItemForm({ item: i })}>
                            <Pencil {...I} />
                          </IconBtn>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {form && <MoveForm init={form} locations={locations} locName={locName} bal={bal} onClose={() => setForm(null)} />}
      {itemForm && <ItemForm item={itemForm.item} onClose={() => setItemForm(null)} />}
    </>
  );
}

function MoveForm({
  init,
  locations,
  locName,
  bal,
  onClose,
}: {
  init: { mode: MoveKind; itemId?: string; from?: string };
  locations: string[];
  locName: (l: string) => string;
  bal: ReturnType<typeof replay>["bal"];
  onClose: () => void;
}) {
  const { me, money } = useProcPerms();
  const items = stockItems.use().filter((i) => i.stock);
  const [mode, setMode] = useState<MoveKind>(init.mode);
  const [itemId, setItemId] = useState(init.itemId ?? items[0]?.id ?? "");
  const [from, setFrom] = useState(init.from ?? WAREHOUSE);
  const [to, setTo] = useState(init.mode === "transfer" ? (locations.find((l) => l !== (init.from ?? WAREHOUSE)) ?? WAREHOUSE) : WAREHOUSE);
  const [qty, setQty] = useState(0);
  const [unitCost, setUnitCost] = useState(0);
  const [projectId, setProjectId] = useState(locProject(init.from ?? "") ?? "");
  const item = items.find((i) => i.id === itemId);
  const [costCode, setCostCode] = useState<CostCode>(item?.costCode ?? "03");
  const [date, setDate] = useState(TODAY);
  const [note, setNote] = useState("");

  const srcLoc = mode === "receive" ? to : from;
  const have = bal.get(balKey(srcLoc, itemId));
  const onHandQty = have?.qty ?? 0;
  const avg = avgOf(have);
  const needsStock = mode === "issue" || mode === "transfer" || (mode === "adjust" && qty < 0);
  const ok =
    item &&
    qty !== 0 &&
    (mode === "adjust" || qty > 0) &&
    (!needsStock || Math.abs(qty) <= onHandQty) &&
    (mode !== "issue" || projectId) &&
    (mode !== "transfer" || from !== to) &&
    (mode !== "receive" || unitCost > 0);

  const save = () => {
    if (!ok) return;
    const base = { date, itemId, qty, by: me.name, note: note || undefined };
    if (mode === "issue") issueStock({ ...base, from, projectId, costCode });
    else if (mode === "transfer") transferStock({ ...base, from, to, costCode });
    else if (mode === "adjust") adjustStock({ ...base, loc: from, unitCost: unitCost || undefined });
    else receiveStock({ ...base, to, unitCost });
    onClose();
  };

  const locSelect = (v: string, set: (v: string) => void, label: string) => (
    <Field label={label}>
      <select value={v} onChange={(e) => set(e.target.value)} className={inputCls}>
        {locations.map((l) => (
          <option key={l} value={l}>
            {locName(l)}
          </option>
        ))}
      </select>
    </Field>
  );

  return (
    <Modal
      open
      onClose={onClose}
      width={640}
      title={`${MOVE_LABEL[mode]}วัสดุ`}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!ok} onClick={save}>
            บันทึก
          </Btn>
        </>
      }
    >
      <div className="mb-4 flex gap-1">
        {(Object.keys(MOVE_LABEL) as MoveKind[]).map((k) => (
          <Btn key={k} small primary={mode === k} onClick={() => setMode(k)}>
            {MOVE_LABEL[k]}
          </Btn>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Field label="วัสดุ">
            <select
              value={itemId}
              onChange={(e) => {
                setItemId(e.target.value);
                const it = items.find((i) => i.id === e.target.value);
                if (it) setCostCode(it.costCode);
              }}
              className={inputCls}
            >
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.id} · {i.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {mode === "receive" ? locSelect(to, setTo, "รับเข้าที่") : locSelect(from, (v) => (setFrom(v), mode === "issue" && setProjectId(locProject(v) ?? projectId)), mode === "adjust" ? "จุดเก็บ" : "จาก")}
        {mode === "transfer" && locSelect(to, setTo, "ไปที่")}
        {mode === "issue" && (
          <Field label="เบิกให้โครงการ">
            <ProjectSelect value={projectId} onChange={setProjectId} />
          </Field>
        )}
        <Field label={mode === "adjust" ? "จำนวนปรับ (+ เพิ่ม / − ลด)" : `จำนวน${item ? ` (${item.unit})` : ""}`}>
          <input type="number" value={qty || ""} onChange={(e) => setQty(Number(e.target.value))} className={cx(inputCls, "text-right font-mono", needsStock && Math.abs(qty) > onHandQty && "border-neg")} />
          <span className="text-[12px] text-ink-3">
            คงเหลือที่{locName(srcLoc).split(" · ")[0]} {onHandQty.toLocaleString("th-TH")} {item?.unit}
            {money && avg > 0 ? ` · เฉลี่ย ${fmt(avg)}` : ""}
          </span>
        </Field>
        {(mode === "issue" || mode === "transfer") && (
          <Field label="รหัสต้นทุน">
            <CodeSelect value={costCode} onChange={setCostCode} />
          </Field>
        )}
        {(mode === "receive" || (mode === "adjust" && qty > 0)) && money && (
          <Field label="ต้นทุนต่อหน่วย">
            <input type="number" min={0} value={unitCost || ""} onChange={(e) => setUnitCost(Number(e.target.value))} placeholder={avg ? fmt(avg) : String(item?.price ?? "")} className={cx(inputCls, "text-right font-mono")} />
          </Field>
        )}
        <Field label="วันที่">
          <input type="date" value={date} max={TODAY} onChange={(e) => setDate(e.target.value)} className={cx(inputCls, "font-mono")} />
        </Field>
        <div className="col-span-2">
          <Field label="หมายเหตุ">
            <input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} />
          </Field>
        </div>
      </div>
      <p className="mt-3 text-[12px] text-ink-3">
        {mode === "issue" && (from === WAREHOUSE ? "เบิกจากคลังกลาง: บันทึกต้นทุนเข้าโครงการตามราคาถัวเฉลี่ย" : "เบิกใช้จากสต็อกหน้างาน: ต้นทุนบันทึกแล้วตอนรับของ")}
        {mode === "transfer" && "โอนระหว่างไซต์: ต้นทุนย้ายจากโครงการต้นทางไปโครงการปลายทาง"}
        {mode === "adjust" && "ปรับยอดตามการตรวจนับจริง"}
        {mode === "receive" && "รับเข้าโดยไม่มีใบสั่งซื้อ เช่น รับคืนจากไซต์หรือยอดยกมา (การรับตาม PO ทำที่หน้าใบสั่งซื้อ)"}
      </p>
    </Modal>
  );
}

function ItemForm({ item, onClose }: { item?: StockItem; onClose: () => void }) {
  const [it, setIt] = useState<StockItem>(item ?? { id: "", name: "", unit: "", category: "hardware", costCode: "90", price: 0, stock: true });
  const set = <K extends keyof StockItem>(k: K, v: StockItem[K]) => setIt((x) => ({ ...x, [k]: v }));
  const exists = !item && stockItems.get(it.id.trim());
  const ok = it.id.trim() && it.name.trim() && it.unit.trim() && !exists;
  return (
    <Modal
      open
      onClose={onClose}
      width={600}
      title={item ? `แก้ไขวัสดุ ${item.id}` : "เพิ่มวัสดุในทะเบียน"}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn
            primary
            disabled={!ok}
            onClick={() => {
              stockItems.upsert({ ...it, id: it.id.trim().toUpperCase(), name: it.name.trim(), min: it.min || undefined });
              onClose();
            }}
          >
            บันทึก
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="รหัสวัสดุ">
          <input value={it.id} disabled={!!item} onChange={(e) => set("id", e.target.value)} className={cx(inputCls, "font-mono", exists && "border-neg")} placeholder="เช่น EL-THW6" />
        </Field>
        <Field label="หน่วย">
          <input value={it.unit} onChange={(e) => set("unit", e.target.value)} className={inputCls} />
        </Field>
        <div className="col-span-2">
          <Field label="ชื่อวัสดุ">
            <input value={it.name} onChange={(e) => set("name", e.target.value)} className={inputCls} />
          </Field>
        </div>
        <Field label="หมวด">
          <select value={it.category} onChange={(e) => set("category", e.target.value as Category)} className={inputCls}>
            {Object.entries(CATEGORIES)
              .filter(([k]) => !k.startsWith("sub_"))
              .map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
          </select>
        </Field>
        <Field label="รหัสต้นทุน">
          <CodeSelect value={it.costCode} onChange={(v) => set("costCode", v)} />
        </Field>
        <Field label="ราคาอ้างอิง/หน่วย">
          <input type="number" min={0} value={it.price || ""} onChange={(e) => set("price", Number(e.target.value))} className={cx(inputCls, "text-right font-mono")} />
        </Field>
        <Field label="จุดสั่งซื้อ (คลังกลาง)">
          <input type="number" min={0} value={it.min ?? ""} onChange={(e) => set("min", Number(e.target.value) || undefined)} className={cx(inputCls, "text-right font-mono")} />
        </Field>
        <label className="col-span-2 flex items-center gap-2 text-[14px]">
          <input type="checkbox" checked={it.stock} onChange={(e) => set("stock", e.target.checked)} className="size-4 accent-[var(--accent)]" />
          เก็บเป็นสต็อก (ไม่ติ๊ก = ใช้ทันทีเมื่อส่งถึง เช่น คอนกรีตผสมเสร็จ)
        </label>
      </div>
      {exists && (
        <p className="mt-3 flex items-center gap-1 text-[13px] text-neg">
          <X {...I} />
          มีรหัสนี้อยู่แล้ว
        </p>
      )}
    </Modal>
  );
}
