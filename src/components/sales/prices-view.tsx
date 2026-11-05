"use client";

import { useMemo, useRef, useState } from "react";
import { AlertTriangle, CloudDownload, Download, Info, Plus, Search, Trash2, Upload, X } from "lucide-react";
import { Card, CardHead, cx, Field, inputCls, PageHeader } from "@/components/ui";
import { Btn, Empty, IconBtn, Modal, Pill, Segmented, StatCard, useHydrated } from "@/components/ops/bits";
import { COST_CODES, type CostCode } from "@/lib/biz";
import { houseModels, thDate, TODAY } from "@/lib/data";
import {
  alertThreshold,
  competitorPerM2,
  competitorPrices,
  CSV_HEADER,
  CURRENT_MONTH,
  downloadText,
  importPriceRows,
  latestOf,
  parsePriceCsv,
  PRICE_SOURCES,
  priceItems,
  priceObs,
  seriesOf,
  SOURCE_LABEL,
  SOURCE_SHORT,
  thMonth,
  toCsv,
  type CompetitorPrice,
  type CsvRow,
  type PriceItem,
  type PriceSource,
} from "@/lib/sales/prices";
import { canEdit } from "@/lib/permissions";
import { useMe } from "@/lib/use-me";
import { latestLabourOf } from "@/lib/sales/prices";
import { Change, I, n0, price, SampleTag, Td, Th, theadCls } from "./common";
import { PriceChart } from "./price-chart";
import { AlertExplain, FileImportModal, MappingPanel, SyncLog, SyncModal, useFeedStatus } from "./price-feeds";
import { AiButton } from "./price-ai-bits";

type Tab = "items" | "alerts" | "feeds" | "competitors" | "sources";

export function PricesView() {
  const hydrated = useHydrated();
  const items = priceItems.use();
  const obs = priceObs.use();
  const comps = competitorPrices.use();
  const threshold = alertThreshold.use();
  const [tab, setTab] = useState<Tab>("items");
  const [q, setQ] = useState("");
  const [source, setSource] = useState<"" | PriceSource>("");
  const [cc, setCc] = useState("");
  const [cat, setCat] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [reading, setReading] = useState(false);
  const me = useMe();
  const editable = canEdit(me.role, "costs");
  const feed = useFeedStatus();

  const rows = useMemo(
    () =>
      items.map((it) => {
        const latest = Object.fromEntries(PRICE_SOURCES.map((s) => [s, latestOf(it, s, obs)])) as Record<PriceSource, ReturnType<typeof latestOf>>;
        const moves = PRICE_SOURCES.map((s) => latest[s]?.change).filter((v): v is number => v !== undefined);
        const maxMove = moves.length ? moves.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a)) : 0;
        const imported = PRICE_SOURCES.some((s) => latest[s] && !latest[s]!.sample);
        const realSources = PRICE_SOURCES.filter((s) => latest[s] && !latest[s]!.sample);
        return { it, latest, maxMove, imported, realSources };
      }),
    [items, obs],
  );
  const cats = useMemo(() => Array.from(new Set(items.map((i) => i.category))).sort((a, b) => a.localeCompare(b, "th")), [items]);
  const needle = q.trim().toLowerCase();
  const list = rows
    .filter((r) => !needle || [r.it.code, r.it.name, r.it.category].some((s) => s.toLowerCase().includes(needle)))
    .filter((r) => !cc || r.it.costCode === cc)
    .filter((r) => !cat || r.it.category === cat)
    .filter((r) => !source || r.latest[source]);
  const alerts = rows
    .flatMap((r) => PRICE_SOURCES.map((s) => ({ r, s, l: r.latest[s] })).filter((x) => x.l?.change !== undefined && Math.abs(x.l.change) * 100 >= threshold))
    .sort((a, b) => Math.abs(b.l!.change!) - Math.abs(a.l!.change!));
  const importedItems = rows.filter((r) => r.imported).length;
  const ourMedian = useMemo(() => {
    const v = houseModels.filter((m) => m.type === "house").map((m) => ((m.priceMin + m.priceMax) / 2) * 1e6 / m.area).sort((a, b) => a - b);
    return v[Math.floor(v.length / 2)];
  }, []);
  const compAll = competitorPerM2(comps, 200);

  const exportCsv = () => {
    const out: (string | number | undefined)[][] = [[...CSV_HEADER, "cost_code", "sample"]];
    for (const it of items)
      for (const s of PRICE_SOURCES)
        for (const p of seriesOf(it, s, obs)) out.push([it.code, it.name, it.unit, s, p.date, p.price, p.province ?? "", it.costCode, p.sample ? "1" : ""]);
    downloadText(`asbuilt-prices-${TODAY}.csv`, toCsv(out));
  };

  const openItem = open ? items.find((i) => i.code === open) : undefined;

  return (
    <>
      <PageHeader
        title="ราคาวัสดุตลาด"
        sub="ฐานข้อมูลราคาวัสดุและค่าแรงสำหรับประมาณราคา เทียบราคาจากกระทรวงพาณิชย์ กรมบัญชีกลาง และใบเสนอราคาผู้ขาย"
        actions={
          <>
            <Btn onClick={exportCsv}>
              <Download {...I} />
              ส่งออก CSV
            </Btn>
            <Btn onClick={() => setImporting(true)}>
              <Upload {...I} />
              นำเข้า CSV
            </Btn>
            {editable && (
              <>
                <AiButton small={false} onClick={() => setReading(true)}>
                  อ่านไฟล์ราคา (AI)
                </AiButton>
                <Btn primary onClick={() => setSyncing(true)}>
                  <CloudDownload {...I} />
                  ดึงราคาจาก พณ.
                </Btn>
              </>
            )}
          </>
        }
      />

      <div className="mb-4 flex gap-3 rounded-[12px] border border-dashed border-line-strong bg-card px-4 py-3 text-[13px] text-ink-2">
        <Info {...I} className="mt-0.5 shrink-0 text-ink-3" />
        <p>
          {hydrated && importedItems ? (
            <>
              มีราคาจริงแล้ว <span className="num font-mono text-ink">{importedItems}</span> จาก {items.length} รายการ
              {feed.last ? ` · ดึง/นำเข้าล่าสุด ${new Date(feed.last.at).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}` : ""} · รายการและแหล่งที่ยังไม่มีราคาจริงยังแสดง <span className="text-ink">ราคาตัวอย่าง</span> ซึ่งไม่ใช่ราคาทางการ
            </>
          ) : (
            <>
              ราคาในตารางนี้เป็น <span className="text-ink">ราคาตัวอย่าง</span> ที่ระบบสร้างขึ้นเพื่อสาธิต ไม่ใช่ราคาทางการ จนกว่าจะดึงราคาจริงจากกระทรวงพาณิชย์ อ่านไฟล์ราคาทางการ หรือนำเข้า CSV
            </>
          )}{" "}
          ราคาจริงของแหล่งใดจะแทนที่ราคาตัวอย่างของแหล่งนั้นทันที เชื่อมรายการกับรหัสสินค้า พณ. ได้ที่แท็บ
          <button type="button" className="mx-1 text-accent-text hover:underline" onClick={() => setTab("feeds")}>
            เชื่อมรหัส พณ.
          </button>
          ดูที่มาของแต่ละแหล่งได้ที่แท็บ
          <button type="button" className="mx-1 text-accent-text hover:underline" onClick={() => setTab("sources")}>
            แหล่งข้อมูล
          </button>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="รายการในฐานข้อมูล" value={items.length} unit="รายการ" note={`${cats.length} หมวดวัสดุ · ${Object.keys(COST_CODES).length} หมวดต้นทุน`} />
        <StatCard label={`ราคาเปลี่ยนเกิน ${threshold}%`} value={alerts.length} unit="รายการ" note="เทียบเดือนก่อน ทุกแหล่ง" onClick={() => setTab("alerts")} active={tab === "alerts"} tone={alerts.length ? "neg" : undefined} />
        <StatCard
          label="มีราคาจริงแล้ว"
          value={hydrated ? importedItems : 0}
          unit={`จาก ${items.length}`}
          note={hydrated && obs.length ? `${n0(obs.length)} ราคา · เชื่อมรหัส พณ. ${feed.mapped} รายการ` : "ยังใช้ราคาตัวอย่างทั้งหมด"}
          onClick={() => setTab("feeds")}
          active={tab === "feeds"}
        />
        <StatCard
          label="ราคาบ้านคู่แข่ง (มัธยฐาน)"
          value={compAll ? n0(compAll.median) : "–"}
          unit="บ./ตร.ม."
          note={`แค็ตตาล็อกของเรา ${n0(ourMedian)} บ./ตร.ม.`}
          onClick={() => setTab("competitors")}
          active={tab === "competitors"}
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { key: "items", label: "ราคาวัสดุ/ค่าแรง" },
            { key: "alerts", label: `แจ้งเตือน (${alerts.length})` },
            { key: "feeds", label: "เชื่อมรหัส พณ." },
            { key: "competitors", label: "ราคาบ้านคู่แข่ง" },
            { key: "sources", label: "แหล่งข้อมูล" },
          ]}
        />
        <span className="font-mono text-[12px] text-ink-3">ข้อมูลล่าสุด {thMonth(CURRENT_MONTH)}</span>
      </div>

      {tab === "items" && (
        <Card className="mt-3">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
            <label className="relative min-w-[240px] flex-1">
              <Search {...I} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหารหัส ชื่อวัสดุ หมวด" className={cx(inputCls, "w-full pl-9")} aria-label="ค้นหาวัสดุ" />
            </label>
            <select aria-label="แหล่งราคา" className={inputCls} value={source} onChange={(e) => setSource(e.target.value as PriceSource | "")}>
              <option value="">ทุกแหล่งราคา</option>
              {PRICE_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {SOURCE_LABEL[s]}
                </option>
              ))}
            </select>
            <select aria-label="หมวดวัสดุ" className={inputCls} value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">ทุกหมวดวัสดุ</option>
              {cats.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <select aria-label="หมวดต้นทุน" className={inputCls} value={cc} onChange={(e) => setCc(e.target.value)}>
              <option value="">ทุกหมวดต้นทุน</option>
              {(Object.keys(COST_CODES) as CostCode[]).map((c) => (
                <option key={c} value={c}>
                  {c} · {COST_CODES[c]}
                </option>
              ))}
            </select>
            {(q || source || cc || cat) && (
              <button
                type="button"
                onClick={() => {
                  setQ("");
                  setSource("");
                  setCc("");
                  setCat("");
                }}
                className="inline-flex h-9 items-center gap-1 rounded-[8px] px-2 text-[13px] text-ink-2 hover:bg-raised"
              >
                <X size={14} strokeWidth={1.5} />
                ล้างตัวกรอง
              </button>
            )}
            <span className="ml-auto font-mono text-[12px] text-ink-3">{list.length} รายการ</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-[13px]">
              <thead>
                <tr className={theadCls}>
                  <Th>รหัส</Th>
                  <Th>รายการ</Th>
                  <Th>หน่วย</Th>
                  {(source ? [source] : PRICE_SOURCES).map((s) => (
                    <Th key={s} right>
                      {SOURCE_LABEL[s]}
                    </Th>
                  ))}
                  <Th right>ค่าแรง/หน่วย</Th>
                  <Th>หมวดต้นทุน</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.map(({ it, latest, imported, realSources }) => (
                  <tr key={it.code} onClick={() => setOpen(it.code)} className="cursor-pointer transition-colors duration-150 hover:bg-raised/60">
                    <Td mono className="whitespace-nowrap text-ink-2">
                      {it.code}
                    </Td>
                    <Td>
                      <span className="text-ink">{it.name}</span>
                      <span className="mt-0.5 flex items-center gap-2 text-[12px] text-ink-3">
                        {it.category}
                        {imported ? <Pill tone="pos">ราคาจริง {realSources.map((s) => SOURCE_SHORT[s]).join(" ")}</Pill> : <SampleTag />}
                      </span>
                    </Td>
                    <Td className="whitespace-nowrap text-ink-2">{it.unit}</Td>
                    {(source ? [source] : PRICE_SOURCES).map((s) => {
                      const l = latest[s];
                      return (
                        <Td key={s} right className="whitespace-nowrap">
                          {l ? (
                            <>
                              <span className="num font-mono text-[13px] text-ink">{price(l.price)}</span>
                              <span className="block">
                                <Change v={l.change} threshold={threshold} />
                              </span>
                            </>
                          ) : (
                            <span className="text-ink-3">–</span>
                          )}
                        </Td>
                      );
                    })}
                    <Td right mono className="text-ink-2">
                      {it.labour ? price(it.labour) : "–"}
                    </Td>
                    <Td className="whitespace-nowrap text-[12px] text-ink-2">
                      <span className="font-mono">{it.costCode}</span> {COST_CODES[it.costCode]}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!list.length && <Empty>ไม่พบรายการที่ตรงกับตัวกรอง</Empty>}
          </div>
        </Card>
      )}

      {tab === "alerts" && (
        <Card className="mt-3">
          <CardHead
            title="รายการที่ราคาเปลี่ยนแปลงผิดปกติ"
            meta={`${alerts.length} รายการ`}
            action={
              <label className="flex items-center gap-2 text-[13px] text-ink-2">
                แจ้งเตือนเมื่อเปลี่ยนเกิน
                <input
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={threshold}
                  onChange={(e) => alertThreshold.set(Math.max(0.5, Number(e.target.value) || 0.5))}
                  className={cx(inputCls, "h-8 w-20 text-right font-mono")}
                  aria-label="เกณฑ์แจ้งเตือน (%)"
                />
                %
              </label>
            }
          />
          {alerts.length > 0 && <AlertExplain alerts={alerts.map(({ r, s, l }) => ({ it: r.it, s, l }))} threshold={threshold} />}
          {alerts.length ? (
            <ul className="divide-y divide-line">
              {alerts.map(({ r, s, l }) => (
                <li key={`${r.it.code}-${s}`}>
                  <button type="button" onClick={() => setOpen(r.it.code)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-left transition-colors duration-150 hover:bg-raised/60">
                    <AlertTriangle {...I} className={l!.change! > 0 ? "text-neg" : "text-pos"} />
                    <span className="min-w-[260px] flex-1">
                      <span className="text-ink">{r.it.name}</span>
                      <span className="ml-2 font-mono text-[12px] text-ink-3">{r.it.code}</span>
                    </span>
                    <span className="w-[150px] text-[13px] text-ink-2">{SOURCE_LABEL[s]}</span>
                    <span className="num w-[200px] text-right font-mono text-[13px] text-ink-2">
                      {price(l!.prev!)} → <span className="text-ink">{price(l!.price)}</span> บ./{r.it.unit}
                    </span>
                    <span className="w-[72px] text-right">
                      <Change v={l!.change} threshold={threshold} />
                    </span>
                    {l!.sample && <SampleTag />}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>ไม่มีรายการที่ราคาเปลี่ยนเกิน {threshold}% จากเดือนก่อน</Empty>
          )}
          <p className="border-t border-line px-5 py-3 text-[12px] text-ink-3">ราคาขึ้นแสดงเป็นสีแดง ราคาลงเป็นสีเขียว ควรทบทวนใบเสนอราคาที่ยังไม่เซ็นสัญญาเมื่อวัสดุหลัก (เหล็ก คอนกรีต สายไฟ) เปลี่ยนแปลง</p>
        </Card>
      )}

      {tab === "feeds" && <MappingPanel items={items} />}
      {tab === "competitors" && <Competitors list={comps} ourMedian={ourMedian} />}
      {tab === "sources" && <Sources />}

      {openItem && <ItemDetail item={openItem} onClose={() => setOpen(null)} threshold={threshold} />}
      {importing && <ImportModal items={items} onClose={() => setImporting(false)} />}
      {syncing && <SyncModal onClose={() => setSyncing(false)} />}
      {reading && <FileImportModal items={items} onClose={() => setReading(false)} />}
    </>
  );
}

function ItemDetail({ item, onClose, threshold }: { item: PriceItem; onClose: () => void; threshold: number }) {
  const obs = priceObs.use();
  const series = Object.fromEntries(PRICE_SOURCES.map((s) => [s, seriesOf(item, s, obs)]).filter(([, v]) => (v as unknown[]).length)) as Partial<Record<PriceSource, ReturnType<typeof seriesOf>>>;
  const recent = (Object.keys(series) as PriceSource[]).flatMap((s) => series[s]!.slice(-6).map((p) => ({ ...p, s }))).sort((a, b) => b.date.localeCompare(a.date) || a.s.localeCompare(b.s));
  const hasSample = recent.some((p) => p.sample);
  const labour = latestLabourOf(item, obs);
  const realRows = obs.filter((o) => o.itemCode === item.code).sort((a, b) => b.date.localeCompare(a.date));
  return (
    <Modal open onClose={onClose} title={item.name} width={820}>
      <div className="flex flex-wrap items-center gap-2 pb-3 text-[13px] text-ink-2">
        <Pill mono>{item.code}</Pill>
        <span>{item.category}</span>
        <span className="text-ink-3">·</span>
        <span>หน่วย {item.unit}</span>
        <span className="text-ink-3">·</span>
        <span>
          หมวดต้นทุน <span className="font-mono">{item.costCode}</span> {COST_CODES[item.costCode]}
        </span>
        {(labour || item.labour > 0) && (
          <>
            <span className="text-ink-3">·</span>
            <span>
              ค่าแรง <span className="num font-mono text-ink">{price(labour?.price ?? item.labour)}</span> บ./{item.unit}
              {labour && (
                <span className="ml-1 text-ink-3">
                  ({SOURCE_SHORT[labour.source]} {thMonth(labour.date)})
                </span>
              )}
            </span>
          </>
        )}
        {hasSample && <SampleTag />}
      </div>
      <PriceChart series={series} unit={item.unit} />
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {PRICE_SOURCES.map((s) => {
          const l = latestOf(item, s, obs);
          return (
            <div key={s} className="rounded-[10px] border border-line px-4 py-3">
              <p className="text-[12px] text-ink-3">{SOURCE_LABEL[s]}</p>
              {l ? (
                <>
                  <p className="mt-1 flex items-baseline gap-2">
                    <span className="num font-mono text-[18px] text-ink">{price(l.price)}</span>
                    <span className="text-[12px] text-ink-3">บ./{item.unit}</span>
                  </p>
                  <p className="mt-1 flex items-center gap-2 text-[12px] text-ink-3">
                    {thMonth(l.date)} · เทียบเดือนก่อน <Change v={l.change} threshold={threshold} />
                  </p>
                </>
              ) : (
                <p className="mt-1 text-[13px] text-ink-3">ยังไม่มีราคา</p>
              )}
            </div>
          );
        })}
      </div>
      <h3 className="mt-5 text-[13px] font-medium">ราคา 6 เดือนล่าสุด</h3>
      <div className="mt-2 max-h-[220px] overflow-y-auto rounded-[10px] border border-line">
        <table className="w-full text-[13px]">
          <thead className="sticky top-0 bg-card">
            <tr className={theadCls}>
              <Th>เดือน</Th>
              <Th>แหล่ง</Th>
              <Th>จังหวัด</Th>
              <Th right>ราคา</Th>
              <Th>ประเภท</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {recent.map((p) => (
              <tr key={`${p.s}-${p.date}`}>
                <Td className="whitespace-nowrap">{thMonth(p.date)}</Td>
                <Td className="text-ink-2">{SOURCE_LABEL[p.s]}</Td>
                <Td className="text-ink-2">{p.province ?? "–"}</Td>
                <Td right mono>
                  {price(p.price)}
                </Td>
                <Td>{p.sample ? <SampleTag /> : <Pill tone="pos">ราคาจริง</Pill>}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {realRows.length > 0 && (
        <p className="mt-3 text-[12px] text-ink-3">
          ราคาจริง {realRows.length} ค่า · ล่าสุดจาก{" "}
          {realRows[0].via === "api" || realRows[0].via === "cron" ? `API กระทรวงพาณิชย์ รหัส ${realRows[0].ref ?? ""}` : realRows[0].via === "file" ? `ไฟล์ ${realRows[0].ref ?? ""}` : "CSV"}
          {realRows[0].rawPrice !== undefined && realRows[0].rawUnit ? ` (ต้นฉบับ ${price(realRows[0].rawPrice)} บ./${realRows[0].rawUnit})` : ""}
          {realRows.some((o) => o.kind === "labour") ? ` · มีค่าแรงนำเข้า ${realRows.filter((o) => o.kind === "labour").length} ค่า` : ""}
        </p>
      )}
    </Modal>
  );
}

const CSV_EXAMPLE = `code,name,unit,source,date,price,province
ST-DB12,เหล็กข้ออ้อย DB12 SD40,กก.,moc,2026-11,26.10,กรุงเทพฯ
CN-240,คอนกรีตผสมเสร็จ 240 ksc,ลบ.ม.,supplier,2026-11-01,2390,นนทบุรี
FN-GRANITO,กระเบื้องแกรนิตโต้ 60×60 ซม.,ตร.ม.,cgd,2026-10,445,`;

function ImportModal({ items, onClose }: { items: PriceItem[]; onClose: () => void }) {
  const [text, setText] = useState("");
  const [done, setDone] = useState<{ items: number; obs: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const rows: CsvRow[] = useMemo(() => (text.trim() ? parsePriceCsv(text, items) : []), [text, items]);
  const ok = rows.filter((r) => !r.errors.length);
  const bad = rows.length - ok.length;

  return (
    <Modal
      open
      onClose={onClose}
      title="นำเข้าราคาจาก CSV"
      width={960}
      footer={
        done ? (
          <Btn primary onClick={onClose}>
            ปิด
          </Btn>
        ) : (
          <>
            <span className="mr-auto text-[13px] text-ink-3">{rows.length ? `พร้อมนำเข้า ${ok.length} แถว${bad ? ` · ข้ามแถวที่ผิด ${bad} แถว` : ""}` : "วางข้อมูลหรือเลือกไฟล์ก่อน"}</span>
            <Btn onClick={onClose}>ยกเลิก</Btn>
            <Btn primary disabled={!ok.length} onClick={() => setDone(importPriceRows(rows))}>
              นำเข้า {ok.length ? ok.length : ""} แถว
            </Btn>
          </>
        )
      }
    >
      {done ? (
        <p className="py-6 text-center text-[14px] text-ink-2">
          นำเข้าราคาแล้ว <span className="num font-mono text-ink">{done.obs}</span> แถว{done.items ? ` และสร้างรายการใหม่ ${done.items} รายการ` : ""} ราคาที่นำเข้าจะใช้แทนราคาตัวอย่างของรายการและแหล่งนั้น
        </p>
      ) : (
        <>
          <p className="text-[13px] text-ink-2">
            คอลัมน์ <span className="font-mono text-ink">{CSV_HEADER.join(",")}</span> (เพิ่ม <span className="font-mono">cost_code</span> ได้สำหรับรายการใหม่) · source ใช้ <span className="font-mono">moc</span> กระทรวงพาณิชย์, <span className="font-mono">cgd</span> กรมบัญชีกลาง, <span className="font-mono">supplier</span> ใบเสนอราคาผู้ขาย · date รูปแบบ YYYY-MM หรือ YYYY-MM-DD (ปี พ.ศ. แปลงให้)
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) setText(await f.text());
                e.target.value = "";
              }}
            />
            <Btn small onClick={() => fileRef.current?.click()}>
              <Upload {...I} />
              เลือกไฟล์ CSV
            </Btn>
            <Btn small onClick={() => setText(CSV_EXAMPLE)}>
              ใส่ตัวอย่าง
            </Btn>
            {text && (
              <Btn small onClick={() => setText("")}>
                ล้าง
              </Btn>
            )}
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={CSV_EXAMPLE}
            spellCheck={false}
            className="mt-3 h-[140px] w-full rounded-[8px] border border-line-strong bg-card px-3 py-2 font-mono text-[12px] text-ink outline-none placeholder:text-ink-3 focus:border-ink-3"
            aria-label="ข้อมูล CSV"
          />
          {rows.length > 0 && (
            <div className="mt-3 max-h-[300px] overflow-auto rounded-[10px] border border-line">
              <table className="w-full min-w-[820px] text-[12px]">
                <thead className="sticky top-0 bg-card">
                  <tr className={theadCls}>
                    <Th>แถว</Th>
                    <Th>รหัส</Th>
                    <Th>รายการ</Th>
                    <Th>แหล่ง</Th>
                    <Th>เดือน</Th>
                    <Th right>ราคา</Th>
                    <Th>จังหวัด</Th>
                    <Th>ตรวจสอบ</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((r) => (
                    <tr key={r.line} className={r.errors.length ? "bg-neg-soft/50" : undefined}>
                      <Td mono className="text-ink-3">
                        {r.line}
                      </Td>
                      <Td mono>{r.code}</Td>
                      <Td>
                        {r.name} <span className="text-ink-3">{r.unit}</span>
                      </Td>
                      <Td>{r.source ? SOURCE_LABEL[r.source] : "–"}</Td>
                      <Td className="whitespace-nowrap">{r.date ? thMonth(r.date) : "–"}</Td>
                      <Td right mono>
                        {r.price !== undefined ? price(r.price) : "–"}
                      </Td>
                      <Td>{r.province ?? "–"}</Td>
                      <Td>
                        {r.errors.map((e) => (
                          <span key={e} className="block text-neg">
                            {e}
                          </span>
                        ))}
                        {r.warnings.map((w) => (
                          <span key={w} className="block text-warn">
                            {w}
                          </span>
                        ))}
                        {!r.errors.length && !r.warnings.length && <span className="text-pos">ถูกต้อง</span>}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

function Competitors({ list, ourMedian }: { list: CompetitorPrice[]; ourMedian: number }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ company: "", model: "", area: "", floors: "2", price: "", date: TODAY, source: "" });
  const sorted = [...list].sort((a, b) => b.date.localeCompare(a.date));
  const ours = houseModels.filter((m) => m.type !== "condo");
  const valid = form.company.trim() && form.model.trim() && Number(form.area) > 0 && Number(form.price) > 0;
  const save = () => {
    if (!valid) return;
    competitorPrices.upsert({
      id: competitorPrices.nextId("CMP-", 3),
      company: form.company.trim(),
      model: form.model.trim(),
      area: Number(form.area),
      floors: Number(form.floors) || 1,
      price: Number(form.price) >= 1000 ? Number(form.price) : Number(form.price) * 1e6,
      date: form.date,
      source: form.source.trim() || "บันทึกโดยฝ่ายขาย",
    });
    setForm({ company: "", model: "", area: "", floors: "2", price: "", date: TODAY, source: "" });
    setAdding(false);
  };
  return (
    <div className="mt-3 grid gap-4 xl:grid-cols-[1fr_380px]">
      <Card>
        <CardHead
          title="ราคาบ้านคู่แข่ง"
          meta={`${list.length} รายการ`}
          action={
            <Btn small onClick={() => setAdding((v) => !v)}>
              <Plus {...I} />
              เพิ่มราคา
            </Btn>
          }
        />
        {adding && (
          <div className="grid grid-cols-2 gap-3 border-b border-line bg-raised/40 px-5 py-4 md:grid-cols-4">
            <Field label="บริษัท">
              <input className={inputCls} value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            </Field>
            <Field label="แบบบ้าน">
              <input className={inputCls} value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            </Field>
            <Field label="พื้นที่ (ตร.ม.)">
              <input className={inputCls} inputMode="decimal" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
            </Field>
            <Field label="ราคา (บาท หรือ ล้าน)">
              <input className={inputCls} inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="4.5" />
            </Field>
            <Field label="จำนวนชั้น">
              <input className={inputCls} inputMode="numeric" value={form.floors} onChange={(e) => setForm({ ...form, floors: e.target.value })} />
            </Field>
            <Field label="วันที่พบราคา">
              <input type="date" className={inputCls} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
            <Field label="แหล่งที่มา">
              <input className={inputCls} value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="งานบ้านและสวน, เว็บไซต์" />
            </Field>
            <div className="flex items-end gap-2">
              <Btn primary disabled={!valid} onClick={save}>
                บันทึก
              </Btn>
              <Btn onClick={() => setAdding(false)}>ยกเลิก</Btn>
            </div>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-[13px]">
            <thead>
              <tr className={theadCls}>
                <Th>บริษัท</Th>
                <Th>แบบบ้าน</Th>
                <Th right>พื้นที่</Th>
                <Th right>ราคา</Th>
                <Th right>บ./ตร.ม.</Th>
                <Th right>เทียบของเรา</Th>
                <Th>วันที่ · แหล่ง</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {sorted.map((c) => {
                const per = c.price / c.area;
                return (
                  <tr key={c.id}>
                    <Td>{c.company}</Td>
                    <Td>
                      {c.model}
                      <span className="block text-[12px] text-ink-3">{c.floors} ชั้น</span>
                    </Td>
                    <Td right mono>
                      {n0(c.area)}
                    </Td>
                    <Td right mono>
                      {(c.price / 1e6).toFixed(2)} ล้าน
                    </Td>
                    <Td right mono className="text-ink">
                      {n0(per)}
                    </Td>
                    <Td right>
                      <Change v={per / ourMedian - 1} />
                    </Td>
                    <Td className="text-[12px] text-ink-2">
                      {thDate(c.date)}
                      <span className="block text-ink-3">
                        {c.source} {c.sample && <SampleTag className="ml-1" />}
                      </span>
                    </Td>
                    <Td right>
                      <IconBtn label="ลบ" danger onClick={() => competitorPrices.remove(c.id)}>
                        <Trash2 {...I} />
                      </IconBtn>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-line px-5 py-3 text-[12px] text-ink-3">ราคาที่ระบบใส่มาให้เป็นข้อมูลตัวอย่างของบริษัทสมมติ บันทึกราคาจริงที่พบจากงานแสดงสินค้า โบรชัวร์ หรือเว็บไซต์ เพื่อใช้เทียบในหน้าประเมินราคา</p>
      </Card>
      <Card>
        <CardHead title="บ./ตร.ม. แบบบ้านของเรา" meta="ราคากลางแค็ตตาล็อก" />
        <ul className="divide-y divide-line text-[13px]">
          {ours.map((m) => {
            const per = (((m.priceMin + m.priceMax) / 2) * 1e6) / m.area;
            const comp = competitorPerM2(list, m.area, m.floors);
            return (
              <li key={m.code} className="flex items-center gap-3 px-5 py-2">
                <span className="w-[52px] font-mono text-[12px] text-ink-3">{m.code}</span>
                <span className="min-w-0 flex-1 truncate">{m.name}</span>
                <span className="num font-mono text-[12px]">{n0(per)}</span>
                <span className="w-[64px] text-right">{comp ? <Change v={per / comp.median - 1} /> : "–"}</span>
              </li>
            );
          })}
        </ul>
        <p className="border-t border-line px-5 py-3 text-[12px] text-ink-3">เปอร์เซ็นต์ คือส่วนต่างเทียบมัธยฐานคู่แข่งที่มีพื้นที่ใกล้เคียง (±35%)</p>
      </Card>
    </div>
  );
}

function Sources() {
  const blocks: { title: string; who: string; body: string; cadence: string; how: string }[] = [
    {
      title: "ราคาวัสดุก่อสร้าง",
      who: "สำนักงานนโยบายและยุทธศาสตร์การค้า (สนค.) กระทรวงพาณิชย์",
      body: "ราคาขายปลีกวัสดุก่อสร้างเฉลี่ยรายเดือน แยกตามจังหวัด เช่น เหล็กเส้น ปูนซีเมนต์ คอนกรีตผสมเสร็จ อิฐ กระเบื้อง สายไฟ ท่อ PVC ใช้เป็นราคาตลาดอ้างอิงและดูแนวโน้มราคา",
      cadence: "รายเดือน · แยกจังหวัด",
      how: "ดาวน์โหลดตารางราคาจากเว็บไซต์ของ สนค. แล้วแปลงเป็นไฟล์ CSV ตามรูปแบบในหน้านี้ ใช้ source = moc และใส่จังหวัด",
    },
    {
      title: "ราคากลางงานก่อสร้าง",
      who: "กรมบัญชีกลาง กระทรวงการคลัง (คณะกรรมการราคากลาง)",
      body: "ราคากลางวัสดุและบัญชีค่าแรงงาน/ค่าดำเนินการ ที่หน่วยงานรัฐใช้คำนวณราคากลางงานก่อสร้าง ช่วยตรวจสอบค่าแรงต่อหน่วยในการประมาณราคา",
      cadence: "ปรับปรุงเป็นรอบ (ระบบสาธิตจัดเป็นรายไตรมาส)",
      how: "คัดลอกรายการจากบัญชีราคามาตรฐานของกรมบัญชีกลางเป็น CSV ใช้ source = cgd",
    },
    {
      title: "ใบเสนอราคาผู้ขาย",
      who: "ผู้ขายวัสดุและผู้รับเหมาช่วงของบริษัท",
      body: "ราคาจริงที่บริษัทได้รับหรือซื้อ เหมาะสำหรับตั้งราคาประมาณการให้ใกล้ต้นทุนจริงที่สุด ในอนาคตจะดึงจากใบสั่งซื้อในโมดูลจัดซื้อโดยอัตโนมัติ",
      cadence: "ตามใบเสนอราคา",
      how: "บันทึกราคาจากใบเสนอราคาเป็น CSV ใช้ source = supplier",
    },
  ];
  return (
    <div className="mt-3 grid gap-4 lg:grid-cols-3">
      {blocks.map((b) => (
        <Card key={b.title} className="flex flex-col px-5 py-4">
          <p className="text-[15px] font-medium">{b.title}</p>
          <p className="mt-1 text-[13px] text-ink-2">{b.who}</p>
          <p className="mt-3 text-[13px] leading-[21px] text-ink-2">{b.body}</p>
          <dl className="mt-4 space-y-2 border-t border-line pt-3 text-[12px]">
            <div>
              <dt className="text-ink-3">ความถี่</dt>
              <dd className="text-ink-2">{b.cadence}</dd>
            </div>
            <div>
              <dt className="text-ink-3">วิธีนำเข้าตอนนี้</dt>
              <dd className="text-ink-2">{b.how}</dd>
            </div>
          </dl>
        </Card>
      ))}
      <Card className="px-5 py-4 lg:col-span-3">
        <p className="text-[15px] font-medium">การดึงข้อมูลอัตโนมัติ</p>
        <p className="mt-2 max-w-[60rem] text-[13px] leading-[21px] text-ink-2">
          กระทรวงพาณิชย์มี API ข้อมูลเปิด (dataapi.moc.go.th) ให้ราคาวัสดุรายสินค้า รายจังหวัด รายเดือน เชื่อมรายการของเรากับรหัสสินค้าในแท็บ “เชื่อมรหัส พณ.” แล้วกด “ดึงราคาจาก พณ.” ระบบของ พณ. ตอบช้าและบางครั้งขัดข้อง ถ้าดึงไม่ได้ให้ดาวน์โหลดไฟล์ PDF ราคาวัสดุรายจังหวัดหรือราคาเฉลี่ยสำหรับราคากลางจากเว็บไซต์ สนค. (www.tpso.go.th) แล้วใช้
          “อ่านไฟล์ราคา (AI)” กรมบัญชีกลางไม่มี API ให้ดาวน์โหลดบัญชีค่าแรงงาน/ราคากลางจาก gprocurement.go.th แล้วอ่านด้วย AI เช่นกัน ราคาที่ไม่ได้นำเข้าจะแสดงป้าย <SampleTag className="mx-1 align-middle" /> และเป็นตัวเลขสาธิตเท่านั้น ห้ามใช้อ้างอิงเป็นราคาทางการ
        </p>
      </Card>
      <SyncLog />
    </div>
  );
}
