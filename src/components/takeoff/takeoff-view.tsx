"use client";

// Architectural takeoff for one project: 7 categories computed from the house model or an uploaded IFC,
// with the user's wall edits applied.
// Pick a category → its lines light up in 3D and fill the table; filter by floor and room;
// adjust block type, waste, rules and sample prices; export CSV / JSON.

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Download, FileJson, FileText, Info, LoaderCircle, RotateCcw, Send, TriangleAlert } from "lucide-react";
import { Card, cx, inputCls } from "@/components/ui";
import { TODAY, type Project } from "@/lib/data";
import { getModel } from "@/lib/house";
import { useMediaUrl } from "@/lib/media";
import { DEFAULT_MARGIN, DEFAULT_OVERHEAD } from "@/lib/sales/boq";
import { estimates } from "@/lib/sales/crm";
import { BOOK_LABEL, usePriceBook, type BookChoice } from "@/lib/sales/prices";
import { estimateFromTakeoff } from "@/lib/takeoff/estimate";
import { catRates } from "@/lib/takeoff/pricing";
import { modelFiles, projectModels, type ModelFile } from "@/lib/model3d/store";
import { computeFromSource, summarize } from "@/lib/takeoff/calc";
import { sourceFromIfc } from "@/lib/takeoff/ifc";
import { editsFor, resetSettings, saveSettings, settingsFor, takeoffEdits, takeoffSettings } from "@/lib/takeoff/store";
import { BLOCKS, CAT_OF, CATS, type BlockType, type Box, type Cat, type TakeoffItem, type TakeoffSettings, type TakeoffSource } from "@/lib/takeoff/types";
import { sourceFromModel } from "@/lib/takeoff/walls";
import { readIfcBoxes } from "./ifc-reader";
import { CAT_COLOR, type View } from "./takeoff-scene";
import { EditsCard, WallEditor } from "./wall-editor";
import { ReviewCard } from "./review-card";
import { TakeoffReport, type ReportScope } from "./takeoff-report";

const TakeoffScene = dynamic(() => import("./takeoff-scene").then((m) => m.TakeoffScene), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-raised" />,
});

const noop = () => () => {};
const nf = (n: number, d = 2) => n.toLocaleString("th-TH", { minimumFractionDigits: d, maximumFractionDigits: d });
const baht = (n: number) => `฿${Math.round(n).toLocaleString("th-TH")}`;
const btn = "inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-line-strong bg-card px-3 text-[13px] text-ink transition-colors duration-150 hover:bg-raised";
const seg = (on: boolean) => cx("h-8 px-3 text-[13px] transition-colors", on ? "bg-ink text-page" : "bg-card text-ink-2 hover:bg-raised");

const VIEWS: { k: View; label: string }[] = [
  { k: "iso", label: "Isometric" },
  { k: "top", label: "มุมบน" },
  { k: "front", label: "ด้านหน้า" },
  { k: "back", label: "ด้านหลัง" },
];

function download(name: string, text: string, type: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Picks the data source (system house model, or an IFC file uploaded to the project) and loads it. */
export function TakeoffView({ project }: { project: Project }) {
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  const files = modelFiles.use();
  const ifcs = useMemo(() => projectModels(files, project.id).filter((f) => f.format === "ifc"), [files, project.id]);
  const [srcKey, setSrcKey] = useState("model");
  const file = ifcs.find((f) => f.id === srcKey);
  const modelSource = useMemo(() => sourceFromModel(getModel(project.modelCode)), [project.modelCode]);

  if (!hydrated) return <div className="h-[70vh] rounded-[14px] border border-line bg-raised" />;

  const picker = (
    <select className={cx(inputCls, "h-8 max-w-[260px] text-[13px]")} value={file ? file.id : "model"} onChange={(e) => setSrcKey(e.target.value)} aria-label="แหล่งข้อมูล">
      <option value="model">โมเดลแบบบ้าน {project.modelCode}</option>
      {ifcs.map((f) => (
        <option key={f.id} value={f.id}>
          IFC · {f.name}
        </option>
      ))}
    </select>
  );

  if (!file) return <TakeoffWorkspace key="model" project={project} source={modelSource} picker={picker} />;
  return <IfcLoader key={file.id} file={file} project={project} picker={picker} />;
}

function IfcLoader({ file, project, picker }: { file: ModelFile; project: Project; picker: React.ReactNode }) {
  const url = useMediaUrl(file.media);
  const [state, setState] = useState<{ source?: TakeoffSource; error?: string }>({});
  useEffect(() => {
    if (!url) return;
    let alive = true;
    readIfcBoxes(file.id, url)
      .then((boxes) => alive && setState({ source: sourceFromIfc(boxes, file.id, file.name) }))
      .catch((e: unknown) => alive && setState({ error: e instanceof Error ? e.message : String(e) }));
    return () => {
      alive = false;
    };
  }, [url, file.id, file.name]);
  if (state.source) return <TakeoffWorkspace project={project} source={state.source} picker={picker} />;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 rounded-[14px] border border-line bg-card px-3 py-2.5">{picker}</div>
      <div className="flex h-[50vh] flex-col items-center justify-center gap-2 rounded-[14px] border border-line bg-raised text-[14px] text-ink-2">
        {state.error ? (
          <>
            <TriangleAlert size={20} strokeWidth={1.5} className="text-accent-text" />
            อ่านไฟล์ IFC ไม่ได้: {state.error}
          </>
        ) : (
          <>
            <LoaderCircle size={20} strokeWidth={1.5} className="animate-spin" /> กำลังอ่านผนัง ประตู หน้าต่าง และห้องจาก {file.name}
          </>
        )}
      </div>
    </div>
  );
}

function TakeoffWorkspace({ project, source, picker }: { project: Project; source: TakeoffSource; picker: React.ReactNode }) {
  const all = takeoffSettings.use();
  const s = useMemo(() => settingsFor(all, project.id), [all, project.id]);
  const allEdits = takeoffEdits.use();
  const edits = useMemo(() => editsFor(allEdits, project.id, source.key), [allEdits, project.id, source.key]);
  const result = useMemo(() => computeFromSource(source, s, edits), [source, s, edits]);

  const [cat, setCat] = useState<Cat>("masonry");
  const [floor, setFloor] = useState<number | 0>(0); // 0 = all
  const [room, setRoom] = useState<string>("*");
  // line codes are renumbered after an edit, so a selection only holds for the edits it was made on
  const [selection, setSelection] = useState<{ code: string | null; on: unknown }>({ code: null, on: null });
  const selected = selection.on === edits ? selection.code : null;
  const setSelected = (code: string | null) => setSelection({ code, on: edits });
  const [wallSel, setWallSel] = useState<string | null>(null);
  const [view, setView] = useState<View>("iso");
  const [viewKey, setViewKey] = useState(0);

  const floors = Array.from({ length: source.floors }, (_, i) => i + 1);
  const roomsOnFloor = source.rooms.filter((r) => !floor || r.floor === floor);
  const editWallObj = result.walls.find((w) => w.id === wallSel);
  const filtered = useMemo(
    () => result.items.filter((x) => (!floor || x.floor === floor) && (room === "*" || x.roomIds.includes(room === "out" ? "" : room))),
    [result.items, floor, room],
  );
  const book = usePriceBook(s.bookChoice, project.province);
  const rates = useMemo(() => catRates(s, book, result.items), [s, book, result.items]);
  const summary = useMemo(() => summarize(filtered, s, rates), [filtered, s, rates]);
  const allSummary = useMemo(() => summarize(result.items, s, rates), [result.items, s, rates]);
  const [report, setReport] = useState<{ snapshot: string | null } | null>(null);
  const [scope, setScope] = useState<ReportScope>("cat");
  const [savedEst, setSavedEst] = useState<string | null>(null);
  const sceneBox = useRef<HTMLDivElement>(null);
  const filterLabel = `${floor ? `ชั้น ${floor}` : "ทุกชั้น"} · ${room === "*" ? "ทุกห้อง" : room === "out" ? "ภายนอก" : (source.rooms.find((r) => r.id === room)?.name ?? room)}`;
  const openReport = () => setReport({ snapshot: sceneBox.current?.querySelector("canvas")?.toDataURL("image/png") ?? null });
  const sendToBoq = () => {
    const id = estimates.nextId(`EST-${TODAY.slice(0, 4)}-`);
    const area = source.rooms.reduce((a, r) => a + (r.x1 - r.x0) * (r.z1 - r.z0), 0) || project.area;
    estimates.upsert(
      estimateFromTakeoff(summary, {
        id,
        name: `ถอดปริมาณงานสถาปัตย์ · ${project.name} (${filterLabel})`,
        date: TODAY,
        by: "ถอดปริมาณงาน",
        projectId: project.id,
        modelCode: project.modelCode,
        area: Math.round(area),
        choice: s.bookChoice,
        overheadPct: DEFAULT_OVERHEAD,
        marginPct: DEFAULT_MARGIN,
      }),
    );
    setSavedEst(id);
  };
  const lines = filtered.filter((x) => x.cat === cat);
  const sum = summary.find((x) => x.cat === cat)!;
  const total = summary.reduce((a, x) => a + x.cost, 0);
  const sel = result.items.find((x) => x.code === selected) ?? null;

  // geometry for the scene
  const visibleFloor = (f: number) => !floor || f === floor;
  const ghost = useMemo<Box[]>(
    () => result.items.filter((x) => x.cat === "masonry" && visibleFloor(x.floor)).flatMap((x) => x.shapes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [result.items, floor],
  );
  const slabs = useMemo<Box[]>(
    () => source.slabs.filter((_, i) => visibleFloor(i + 1)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [source, floor],
  );
  const { min, max } = source.bounds;
  const floorBase = floor ? Math.min(...source.walls.filter((w) => w.floor === floor).map((w) => w.base), Infinity) : min[1];
  const center: [number, number, number] = [(min[0] + max[0]) / 2, floor && Number.isFinite(floorBase) ? floorBase + 1.2 : (min[1] + max[1]) / 2 - 0.5, (min[2] + max[2]) / 2];
  const span = Math.max(max[0] - min[0], max[2] - min[2], max[1] - min[1], 4);

  const set = (patch: Partial<TakeoffSettings>) => saveSettings({ ...s, ...patch });
  const pickCat = (c: Cat) => {
    setCat(c);
    setSelected(null);
  };
  const pickLine = (code: string | null) => {
    setSelected(code);
    const it = result.items.find((x) => x.code === code);
    if (it?.wallId) setWallSel(it.wallId);
    if (code) document.getElementById(`to-${code}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  const exportCsv = () => {
    const head = ["รหัส", "หมวด", "ชั้น", "ห้อง/ด้าน", "ชนิด", "รายละเอียด", "ปริมาณ", "หน่วย", "จำนวนซื้อ", "หน่วยซื้อ"];
    const rows = filtered.map((x) => [x.code, CAT_OF[x.cat].label, x.floor, x.rooms.join(" / "), x.kind, x.detail, x.qty, CAT_OF[x.cat].unit, x.count ?? "", x.countUnit ?? ""]);
    const sumRows = summary.map((x) => ["รวม", CAT_OF[x.cat].label, "", "", "", `เผื่อ ${x.waste}% · ${x.purchaseNote}`, x.qtyWithWaste, CAT_OF[x.cat].unit, x.purchase, x.purchaseUnit]);
    const esc = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [head, ...rows, [], ...sumRows].map((r) => r.map(esc).join(",")).join("\r\n");
    download(`takeoff_${project.id}.csv`, "﻿" + csv, "text/csv;charset=utf-8");
  };
  const exportJson = () => {
    const data = {
      project: { id: project.id, name: project.name, model: project.model, modelCode: project.modelCode },
      generatedAt: new Date().toISOString(),
      filter: { floor: floor || "all", room },
      settings: s,
      summary,
      items: filtered.map((x) => ({ code: x.code, cat: x.cat, floor: x.floor, rooms: x.rooms, kind: x.kind, detail: x.detail, qty: x.qty, unit: CAT_OF[x.cat].unit, count: x.count, countUnit: x.countUnit, wallId: x.wallId })),
    };
    download(`takeoff_${project.id}.json`, JSON.stringify(data, null, 2), "application/json");
  };

  return (
    <div className="flex flex-col gap-3">
      {report && (
        <TakeoffReport
          project={project}
          sourceLabel={source.label}
          filterLabel={filterLabel}
          summary={summary}
          items={filtered}
          cat={cat}
          scope={scope}
          onScope={setScope}
          snapshot={report.snapshot}
          bookLabel={s.priceMode === "sample" ? "ราคาตัวอย่างต่อหน่วย" : `บัญชีราคาบริษัท · ${BOOK_LABEL[s.bookChoice]}`}
          onClose={() => setReport(null)}
        />
      )}
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-[14px] border border-line bg-card px-3 py-2.5">
        {picker}
        <div className="flex overflow-hidden rounded-[8px] border border-line-strong">
          <button type="button" className={seg(!floor)} onClick={() => { setFloor(0); setRoom("*"); }}>
            ทุกชั้น
          </button>
          {floors.map((f) => (
            <button key={f} type="button" className={cx(seg(floor === f), "border-l border-line-strong")} onClick={() => { setFloor(f); setRoom("*"); }}>
              ชั้น {f}
            </button>
          ))}
        </div>
        <select className={cx(inputCls, "h-8 text-[13px]")} value={room} onChange={(e) => setRoom(e.target.value)} aria-label="กรองห้อง">
          <option value="*">ทุกห้อง</option>
          {roomsOnFloor.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} (ชั้น {r.floor})
            </option>
          ))}
          <option value="out">ภายนอก</option>
        </select>
        <span className="text-[12px] text-ink-3">
          ยอดรวมตามตัวกรอง <span className="num font-mono text-[13px] text-ink">{baht(total)}</span>
        </span>
        <div className="ml-auto flex gap-2">
          <button type="button" className={btn} onClick={openReport}>
            <FileText size={16} strokeWidth={1.5} /> รายงาน
          </button>
          <button type="button" className={btn} onClick={sendToBoq} title="บันทึกเป็นประมาณการในหน้า ประเมินราคา & BOQ">
            <Send size={16} strokeWidth={1.5} /> ส่งเข้า BOQ
          </button>
          <button type="button" className={btn} onClick={exportCsv}>
            <Download size={16} strokeWidth={1.5} /> CSV
          </button>
          <button type="button" className={btn} onClick={exportJson}>
            <FileJson size={16} strokeWidth={1.5} /> JSON
          </button>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-[10px] bg-raised px-3 py-2 text-[12px] leading-relaxed text-ink-2">
        <Info size={14} strokeWidth={1.5} className="mt-0.5 shrink-0" />
        <div>
          <p>
            คำนวณจาก{source.kind === "ifc" ? `ไฟล์ IFC "${source.label}"` : source.label} ({source.walls.length} แนวผนัง {source.floors} ชั้น {source.rooms.length} ห้อง) ด้วยกฎและราคาตัวอย่างที่ปรับได้ด้านขวา
            คลิกชิ้นงานเพื่อแก้ผนัง เพิ่ม/ลบประตูหน้าต่าง ตัวเลขเป็นค่าประมาณ ต้องตรวจกับแบบก่อสร้างจริงก่อนสั่งของหรือทำสัญญาค่าแรง
          </p>
          {source.notes.length > 0 && (
            <ul className="mt-1 list-disc pl-4 text-accent-text">
              {source.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[220px_minmax(0,1fr)_300px]">
        {/* categories */}
        <nav className="flex gap-2 overflow-x-auto xl:flex-col xl:overflow-visible" aria-label="หมวดงาน">
          {CATS.map((c) => {
            const x = summary.find((y) => y.cat === c.key)!;
            const on = c.key === cat;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => pickCat(c.key)}
                aria-pressed={on}
                aria-label={`${c.prefix} ${c.label} ${nf(x.qty, c.key === "ties" ? 3 : 2)} ${c.unit}`}
                className={cx("flex min-w-[150px] items-center gap-3 rounded-[12px] border px-3 py-2.5 text-left transition-colors", on ? "border-ink bg-card shadow-sm" : "border-line bg-card/60 hover:bg-card")}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-[8px] text-[13px] font-medium text-white" style={{ background: CAT_COLOR[c.key] }}>
                  {c.prefix}
                </span>
                <span className="min-w-0">
                  <span className="block text-[14px]">{c.label}</span>
                  <span className="num block font-mono text-[12px] text-ink-3">
                    {nf(x.qty, c.key === "ties" ? 3 : 2)} {c.unit}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>

        {/* 3D + totals + table */}
        <div className="flex min-w-0 flex-col gap-3">
          <div ref={sceneBox} className="relative h-[46vh] min-h-[320px] overflow-hidden rounded-[14px] border border-line">
            <TakeoffScene ghost={ghost} floors={slabs} items={lines} cat={cat} selected={selected} onSelect={pickLine} center={center} span={span} view={view} viewKey={viewKey} />
            <div className="absolute left-3 top-3 flex overflow-hidden rounded-[8px] border border-line-strong shadow-sm">
              {VIEWS.map((v, i) => (
                <button key={v.k} type="button" className={cx(seg(view === v.k), i > 0 && "border-l border-line-strong")} onClick={() => { setView(v.k); setViewKey((k) => k + 1); }}>
                  {v.label}
                </button>
              ))}
            </div>
            <div className="absolute bottom-3 right-3 flex flex-col gap-1 rounded-[8px] border border-line bg-card/95 px-2.5 py-2 text-[12px] shadow-sm">
              <span className="flex items-center gap-2">
                <span className="size-2.5 rounded-[2px]" style={{ background: CAT_COLOR[cat] }} /> {CAT_OF[cat].label}
              </span>
              <span className="flex items-center gap-2">
                <span className="size-2.5 rounded-[2px] bg-[#f2a23a]" /> รายการที่เลือก
              </span>
            </div>
          </div>

          <Card>
            <div className="grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x">
              <Metric label={`ปริมาณวัดจริง · ${sum.lines} รายการ`} value={`${nf(sum.qty, cat === "ties" ? 3 : 2)} ${CAT_OF[cat].unit}`} />
              <Metric label="ค่าเผื่อ" value={`${sum.waste}%`} note={`+${nf(sum.qtyWithWaste - sum.qty, cat === "ties" ? 3 : 2)}`} />
              <Metric label="ยอดสั่งซื้อ" value={`${sum.purchase.toLocaleString("th-TH")} ${sum.purchaseUnit}`} note={sum.purchaseNote} />
              <Metric
                label={sum.priceStatus === "sample" ? "ราคาตัวอย่าง" : "ราคาจากบัญชีราคา"}
                value={baht(sum.cost)}
                note={`วัสดุ ${nf(sum.unitMaterial, 0)} + ค่าแรง ${nf(sum.unitLabour, 0)} บ./${CAT_OF[cat].unit} · ค่าแรงรวม ${baht(sum.labourCost)}`}
                strong
              />
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full min-w-[720px] text-[13px]">
                <thead className="sticky top-0 z-10 bg-card text-left text-[12px] text-ink-3 shadow-[0_1px_0_var(--color-line,#e5e2dc)]">
                  <tr>
                    <th className="px-3 py-2 font-normal">รหัส</th>
                    <th className="px-2 py-2 font-normal">ชั้น</th>
                    <th className="px-2 py-2 font-normal">ชนิด</th>
                    <th className="px-2 py-2 font-normal">ห้อง / ด้าน</th>
                    <th className="px-2 py-2 font-normal">รายละเอียด</th>
                    <th className="px-2 py-2 text-right font-normal">ปริมาณ</th>
                    <th className="px-3 py-2 text-right font-normal">ซื้อ</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((x) => (
                    <Row key={x.code} x={x} on={x.code === selected} onClick={() => pickLine(x.code === selected ? null : x.code)} />
                  ))}
                  {!lines.length && (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-ink-3">
                        ไม่มีรายการ{CAT_OF[cat].label}ตามตัวกรองนี้
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* selection + settings */}
        <div className="flex flex-col gap-3">
          {editWallObj && (
            <WallEditor key={editWallObj.id} wall={editWallObj} original={source.walls.find((w) => w.id === editWallObj.id)} edits={edits} onClose={() => setWallSel(null)} />
          )}
          <EditsCard edits={edits} />
          {savedEst && (
            <p className="flex flex-wrap items-center gap-2 rounded-[10px] border border-[#2e8b57]/40 bg-[#2e8b57]/[0.07] px-3 py-2 text-[13px]">
              บันทึกเป็นประมาณการ <span className="font-mono">{savedEst}</span> แล้ว
              <Link href="/estimating" className="ml-auto text-[12px] underline underline-offset-2">
                เปิดหน้า BOQ
              </Link>
            </p>
          )}
          <ReviewCard
            project={project.id}
            source={source}
            walls={result.walls}
            items={result.items}
            summary={allSummary}
            onCode={(c) => {
              const it = result.items.find((x) => x.code === c);
              if (!it) return;
              setFloor(0);
              setRoom("*");
              setCat(it.cat);
              pickLine(c);
            }}
          />
          <Card>
            <div className="px-4 py-3">
              {sel ? (
                <div className="flex flex-col gap-1.5 text-[13px]">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-mono text-[15px] font-medium">{sel.code}</span>
                    <button type="button" className="text-[12px] text-ink-3 hover:text-ink" onClick={() => setSelected(null)}>
                      ล้าง
                    </button>
                  </div>
                  <p className="text-ink">{sel.kind}</p>
                  <p className="leading-relaxed text-ink-2">{sel.detail}</p>
                  <dl className="mt-1 grid grid-cols-[80px_1fr] gap-y-1 text-ink-2">
                    <dt className="text-ink-3">ชั้น</dt>
                    <dd>{sel.floor}</dd>
                    <dt className="text-ink-3">ห้อง/ด้าน</dt>
                    <dd>{sel.rooms.join(" / ")}</dd>
                    <dt className="text-ink-3">ปริมาณ</dt>
                    <dd className="num font-mono">
                      {nf(sel.qty, sel.cat === "ties" ? 3 : 2)} {CAT_OF[sel.cat].unit}
                    </dd>
                    <dt className="text-ink-3">หลังเผื่อ</dt>
                    <dd className="num font-mono">
                      {nf(sel.qty * (1 + s.waste[sel.cat] / 100), sel.cat === "ties" ? 3 : 2)} {CAT_OF[sel.cat].unit}
                    </dd>
                    <dt className="text-ink-3">ราคาตัวอย่าง</dt>
                    <dd className="num font-mono">≈ {baht(sel.qty * (1 + s.waste[sel.cat] / 100) * s.price[sel.cat])}</dd>
                  </dl>
                </div>
              ) : (
                <p className="text-[13px] leading-relaxed text-ink-3">คลิกชิ้นงานในโมเดลหรือแถวในตาราง เพื่อดูที่มาของตัวเลขและราคาของรายการนั้น</p>
              )}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="text-[14px] font-medium">ตั้งค่าหมวด{CAT_OF[cat].label}</h2>
              <button type="button" className="flex items-center gap-1 text-[12px] text-ink-3 hover:text-ink" onClick={() => resetSettings(project.id)} title="คืนค่าเริ่มต้นทุกหมวด">
                <RotateCcw size={13} strokeWidth={1.5} /> ค่าเริ่มต้น
              </button>
            </div>
            <div className="flex flex-col gap-3 px-4 py-3 text-[13px]">
              <p className="text-[12px] text-ink-3">{CAT_OF[cat].note}</p>
              {cat === "masonry" && (
                <Labeled label="ชนิดอิฐ">
                  <select className={cx(inputCls, "h-8 text-[13px]")} value={s.block} onChange={(e) => set({ block: e.target.value as BlockType })}>
                    {(Object.keys(BLOCKS) as BlockType[]).map((b) => (
                      <option key={b} value={b}>
                        {BLOCKS[b].label} · {BLOCKS[b].perM2} ก้อน/ตร.ม.
                      </option>
                    ))}
                  </select>
                </Labeled>
              )}
              {cat === "ties" && (
                <>
                  <Num label="ระยะเสาเอ็นไม่เกิน (ม.)" value={s.tieSpacing} step={0.1} min={1} onChange={(v) => set({ tieSpacing: v })} />
                  <Num label="คานเอ็นกลางผนังเมื่อสูงเกิน (ม.)" value={s.bandAbove} step={0.1} min={1} onChange={(v) => set({ bandAbove: v })} />
                  <Num label="หน้าตัด (ม.)" value={s.tieSection} step={0.01} min={0.05} onChange={(v) => set({ tieSection: v })} />
                  <Num label="ฝากคานเอ็นข้างละ (ม.)" value={s.bearing} step={0.05} min={0} onChange={(v) => set({ bearing: v })} />
                </>
              )}
              {cat === "bead" && (
                <>
                  <Num label="ความยาวต่อเส้น (ม.)" value={s.beadStick} step={0.1} min={1} onChange={(v) => set({ beadStick: v })} />
                  <label className="flex items-center gap-2 text-ink-2">
                    <input type="checkbox" checked={s.outerCorners} onChange={(e) => set({ outerCorners: e.target.checked })} className="size-4 accent-[#13243b]" />
                    รวมมุมผนังภายนอกอาคาร
                  </label>
                </>
              )}
              {cat === "floorTile" && (
                <Labeled label="ขนาดกระเบื้อง">
                  <select className={cx(inputCls, "h-8 text-[13px]")} value={s.floorTile} onChange={(e) => set({ floorTile: Number(e.target.value) })}>
                    {[0.3, 0.4, 0.6, 0.8].map((v) => (
                      <option key={v} value={v}>
                        {v * 100}×{v * 100} ซม.
                      </option>
                    ))}
                  </select>
                </Labeled>
              )}
              {cat === "wallTile" && (
                <>
                  <Labeled label="ขนาดกระเบื้อง">
                    <select
                      className={cx(inputCls, "h-8 text-[13px]")}
                      value={s.wallTile.join("x")}
                      onChange={(e) => set({ wallTile: e.target.value.split("x").map(Number) as [number, number] })}
                    >
                      {[
                        [0.2, 0.25],
                        [0.25, 0.4],
                        [0.3, 0.6],
                        [0.6, 0.6],
                      ].map((v) => (
                        <option key={v.join("x")} value={v.join("x")}>
                          {Math.round(v[0] * 100)}×{Math.round(v[1] * 100)} ซม.
                        </option>
                      ))}
                    </select>
                  </Labeled>
                  <Num label="ปูสูงถึง (ม.)" value={s.wallTileHeight} step={0.1} min={0.5} onChange={(v) => set({ wallTileHeight: v })} />
                </>
              )}
              <Num label="ค่าเผื่อ (%)" value={s.waste[cat]} step={1} min={0} onChange={(v) => set({ waste: { ...s.waste, [cat]: v } })} />

              <div className="mt-1 flex flex-col gap-2 border-t border-line pt-3">
                <p className="font-medium">ราคา</p>
                <div className="flex overflow-hidden rounded-[8px] border border-line-strong">
                  <button type="button" className={cx(seg(s.priceMode === "book"), "flex-1")} onClick={() => set({ priceMode: "book" })}>
                    บัญชีราคาบริษัท
                  </button>
                  <button type="button" className={cx(seg(s.priceMode === "sample"), "flex-1 border-l border-line-strong")} onClick={() => set({ priceMode: "sample" })}>
                    ราคาตัวอย่าง
                  </button>
                </div>
                {s.priceMode === "book" && (
                  <Labeled label="แหล่งราคาวัสดุ">
                    <select className={cx(inputCls, "h-8 text-[13px]")} value={s.bookChoice} onChange={(e) => set({ bookChoice: e.target.value as TakeoffSettings["bookChoice"] })}>
                      {(Object.keys(BOOK_LABEL) as BookChoice[]).map((b) => (
                        <option key={b} value={b}>
                          {BOOK_LABEL[b]}
                        </option>
                      ))}
                    </select>
                  </Labeled>
                )}
                {rates[cat].parts.length > 0 && (
                  <ul className="flex flex-col gap-0.5 rounded-[8px] bg-raised/60 px-2.5 py-2 text-[12px]">
                    {rates[cat].parts.map((pt) => (
                      <li key={pt.code} className="flex justify-between gap-2">
                        <span className="min-w-0 truncate" title={pt.name}>
                          {pt.name}
                        </span>
                        <span className="num shrink-0 font-mono text-ink-2">
                          {pt.per < 1 ? pt.per.toFixed(3) : pt.per.toFixed(2)} {pt.unit} × {nf(pt.price, 0)}
                          {pt.sample && <span className="ml-1 text-[10px] text-ink-3">ตย.</span>}
                        </span>
                      </li>
                    ))}
                    <li className="mt-0.5 flex justify-between border-t border-line pt-1 text-ink">
                      <span>วัสดุต่อ {CAT_OF[cat].unit}</span>
                      <span className="num font-mono">{nf(rates[cat].material)}</span>
                    </li>
                  </ul>
                )}
                <p className="text-[12px] text-ink-3">{rates[cat].note}</p>
                {s.priceMode === "sample" || rates[cat].status === "sample" ? (
                  <Num label={`ราคาต่อหน่วย วัสดุ+ค่าแรง (บาท/${CAT_OF[cat].unit})`} value={s.price[cat]} step={cat === "ties" ? 100 : 5} min={0} onChange={(v) => set({ price: { ...s.price, [cat]: v } })} />
                ) : null}
                {rates[cat].status !== "book" && (
                  <Num label={`ค่าแรง (บาท/${CAT_OF[cat].unit})`} value={s.labour[cat]} step={cat === "ties" ? 100 : 5} min={0} onChange={(v) => set({ labour: { ...s.labour, [cat]: v } })} />
                )}
                {rates[cat].status === "book" && (
                  <p className="text-[12px] text-ink-2">
                    ค่าแรงจากบัญชีราคา <span className="num font-mono">{nf(rates[cat].labour)}</span> บ./{CAT_OF[cat].unit}
                  </p>
                )}
                <p className="text-[11px] leading-relaxed text-ink-3">ราคาในโหมดเดโมเป็นราคาตัวอย่าง แก้ราคาได้ที่หน้า ราคาวัสดุตลาด ค่าที่ปรับที่นี่บันทึกไว้กับโครงการนี้</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="px-4 py-3 text-[13px]">
              <p className="mb-2 font-medium">สรุปทุกหมวด</p>
              <ul className="flex flex-col gap-1">
                {summary.map((x) => (
                  <li key={x.cat} className="flex items-baseline justify-between gap-2">
                    <span className="text-ink-2">
                      {CAT_OF[x.cat].prefix} {CAT_OF[x.cat].label}
                    </span>
                    <span className="num font-mono">{baht(x.cost)}</span>
                  </li>
                ))}
                <li className="mt-1 flex items-baseline justify-between gap-2 border-t border-line pt-1.5 font-medium">
                  <span>รวม</span>
                  <span className="num font-mono">{baht(total)}</span>
                </li>
              </ul>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ x, on, onClick }: { x: TakeoffItem; on: boolean; onClick: () => void }) {
  const dec = x.cat === "ties" ? 3 : 2;
  return (
    <tr id={`to-${x.code}`} onClick={onClick} className={cx("cursor-pointer border-t border-line align-top transition-colors", on ? "bg-[#f2a23a]/15" : "hover:bg-raised/60")}>
      <td className="whitespace-nowrap px-3 py-1.5 font-mono font-medium">{x.code}</td>
      <td className="px-2 py-1.5 font-mono">{x.floor}</td>
      <td className="whitespace-nowrap px-2 py-1.5">{x.kind}</td>
      <td className="px-2 py-1.5 text-ink-2">{x.rooms.join(" / ")}</td>
      <td className="px-2 py-1.5 text-ink-2">{x.detail}</td>
      <td className="num whitespace-nowrap px-2 py-1.5 text-right font-mono">
        {nf(x.qty, dec)} <span className="font-sans text-[11px] text-ink-3">{CAT_OF[x.cat].unit}</span>
      </td>
      <td className="num whitespace-nowrap px-3 py-1.5 text-right font-mono">{x.count != null ? `${x.count.toLocaleString("th-TH")} ${x.countUnit}` : "—"}</td>
    </tr>
  );
}

function Metric({ label, value, note, strong }: { label: string; value: string; note?: string; strong?: boolean }) {
  return (
    <div className={cx("px-4 py-3", strong && "bg-[#2e8b57]/[0.07]")}>
      <p className="text-[12px] text-ink-3">{label}</p>
      <p className="num mt-0.5 font-mono text-[18px] leading-tight">{value}</p>
      {note && <p className="mt-0.5 text-[11px] text-ink-3">{note}</p>}
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-ink-2">
      {label}
      {children}
    </label>
  );
}

function Num({ label, value, step, min, onChange }: { label: string; value: number; step: number; min: number; onChange: (v: number) => void }) {
  return (
    <Labeled label={label}>
      <input
        type="number"
        className={cx(inputCls, "h-8 font-mono text-[13px]")}
        value={value}
        step={step}
        min={min}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (e.target.value !== "" && Number.isFinite(v) && v >= min) onChange(v);
        }}
      />
    </Labeled>
  );
}
