"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Layers,
  Link2,
  Maximize,
  Minimize,
  PanelLeft,
  PanelRight,
  Printer,
  Scan,
  Search,
  Wrench,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { AssetTag, cx, Status } from "@/components/ui";
import { MODEL_TYPE_LABEL, projects, thDate, TODAY } from "@/lib/data";
import { assetOf, roomOf } from "@/lib/house";
import {
  DISCIPLINES,
  getDrawingSet,
  KIND_LABEL,
  layerDef,
  REVISIONS,
  THEME,
  THEMES,
  themeCss,
  thumbDataUrl,
  type Sheet,
  type ThemeId,
} from "@/lib/drawing";
import { downloadDxf, downloadSvg, printSheets } from "./export";
import { SheetMarkup, useIsClient } from "./shared";
import { niceLength, useViewport } from "./use-viewport";

const SCOPE = "bp-canvas";

export function BlueprintViewer({ code }: { code: string }) {
  const params = useSearchParams();
  const client = useIsClient();
  const set = useMemo(() => getDrawingSet(code), [code]);
  const { model, sheets } = set;
  const spec = model.spec;
  const initial = Math.max(
    0,
    sheets.findIndex((s) => s.id === (params.get("sheet") ?? "A-101")),
  );
  const [idx, setIdx] = useState(initial);
  const sheet = sheets[idx] ?? sheets[0];
  const [theme, setTheme] = useState<ThemeId>("blueprint");
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [layersOpen, setLayersOpen] = useState(false);
  const [dlOpen, setDlOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [full, setFull] = useState(false);
  const cursorRef = useRef<HTMLSpanElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [fitS, setFitS] = useState(1);

  const hitAt = useCallback(
    (wx: number, wy: number) => {
      const x = wx;
      const y = sheet.h - wy;
      let best: string | null = null;
      let area = Infinity;
      const pad = sheet.scale / 1000;
      for (const h of sheet.hits) {
        const [x0, y0, x1, y1] = h.bb;
        if (x >= x0 - pad && x <= x1 + pad && y >= y0 - pad && y <= y1 + pad) {
          const a = (x1 - x0) * (y1 - y0);
          if (a < area && assetOf(model, h.code)) {
            area = a;
            best = h.code;
          }
        }
      }
      return best;
    },
    [sheet, model],
  );

  const vp = useViewport({
    onClick: (wx, wy) => setSelected(hitAt(wx, wy)),
    onMove: (wx, wy) => {
      const el = cursorRef.current;
      if (el) el.textContent = `X ${(wx - sheet.origin[0]).toFixed(2)} · Y ${(sheet.h - wy - sheet.origin[1]).toFixed(2)} ม.`;
      const h = hitAt(wx, wy);
      setHover((p) => (p === h ? p : h));
    },
    minS: 0.5,
    maxS: 4000,
  });
  const { fit, zoom, centerOn, boxRef, svgRef, view: v, get: getView } = vp;

  const doFit = useCallback(() => {
    fit([0, 0, sheet.w, sheet.h], 0.02);
    setFitS(getView().s);
  }, [fit, sheet, getView]);

  // fit whenever the sheet changes or the panels resize the stage
  useEffect(() => {
    if (!client) return;
    const id = requestAnimationFrame(doFit);
    return () => cancelAnimationFrame(id);
  }, [doFit, client, leftOpen, rightOpen, full]);

  const go = useCallback(
    (i: number, keep = false) => {
      const n = (i + sheets.length) % sheets.length;
      setIdx(n);
      if (!keep) setSelected(null);
      const url = new URL(window.location.href);
      url.searchParams.set("sheet", sheets[n].id);
      window.history.replaceState(null, "", url.toString());
    },
    [sheets],
  );

  useEffect(() => {
    const onFs = () => setFull(document.fullscreenElement === stageRef.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggleFull = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen();
    else stageRef.current?.requestFullscreen?.();
  }, []);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowRight") go(idx + 1);
      else if (e.key === "ArrowLeft") go(idx - 1);
      else if (e.key === "f" || e.key === "F") doFit();
      else if (e.key === "+" || e.key === "=") zoom(1.25);
      else if (e.key === "-") zoom(0.8);
      else if (e.key === "Escape") {
        setSelected(null);
        setLayersOpen(false);
        setDlOpen(false);
      } else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [go, idx, doFit, zoom]);

  const flash = (s: string) => {
    setToast(s);
    window.setTimeout(() => setToast(null), 2200);
  };

  const share = async () => {
    const url = new URL(window.location.href);
    url.searchParams.set("sheet", sheet.id);
    try {
      await navigator.clipboard.writeText(url.toString());
      flash("คัดลอกลิงก์แผ่นนี้แล้ว");
    } catch {
      flash(url.toString());
    }
  };

  const th = THEME[theme];
  const css = useMemo(() => themeCss(th, `.${SCOPE}`, hidden), [th, hidden]);
  const hl = (code: string | null, cls: string) => {
    if (!code) return null;
    const h = sheet.hits.find((q) => q.code === code);
    if (!h) return null;
    const p = (sheet.scale / 1000) * 1.2;
    return <rect className={cls} x={h.bb[0] - p} y={sheet.h - h.bb[3] - p} width={h.bb[2] - h.bb[0] + 2 * p} height={h.bb[3] - h.bb[1] + 2 * p} rx={p} />;
  };

  const zoomPct = Math.round((v.s / fitS) * 100);
  const barM = niceLength(110 / Math.max(v.s, 1e-6));
  const barPx = barM * v.s;
  const disc = DISCIPLINES.find((d) => d.key === sheet.disc)!;

  return (
    <div className="flex h-[calc(100vh-88px)] min-h-[560px] overflow-hidden rounded-[14px] border border-line bg-card">
      {leftOpen && <SheetList set={set} idx={idx} onPick={go} client={client} />}

      <div className="flex min-w-0 flex-1 flex-col border-x border-line">
        {/* toolbar */}
        <div className="flex h-12 shrink-0 items-center gap-1 border-b border-line px-2">
          <IconBtn label={leftOpen ? "ซ่อนรายการแผ่น" : "แสดงรายการแผ่น"} onClick={() => setLeftOpen((o) => !o)}>
            <PanelLeft size={16} strokeWidth={1.5} />
          </IconBtn>
          <IconBtn label="แผ่นก่อนหน้า" onClick={() => go(idx - 1)}>
            <ChevronLeft size={16} strokeWidth={1.5} />
          </IconBtn>
          <span className="rounded-[6px] bg-ink px-2 py-0.5 font-mono text-[12px] text-card">{sheet.id}</span>
          <span className="ml-1.5 min-w-0 truncate text-[14px]">
            {sheet.titleTh} <span className="text-ink-3">· {sheet.titleEn}</span>
          </span>
          <span className="ml-1.5 font-mono text-[12px] text-ink-3">
            {idx + 1} / {sheets.length}
          </span>
          <IconBtn label="แผ่นถัดไป" onClick={() => go(idx + 1)}>
            <ChevronRight size={16} strokeWidth={1.5} />
          </IconBtn>
          <div className="ml-auto flex items-center gap-1">
            <TextBtn onClick={() => printSheets([sheet], sheet.code, hidden) || flash("เบราว์เซอร์บล็อกหน้าต่างพิมพ์")}>
              <Printer size={16} strokeWidth={1.5} /> พิมพ์
            </TextBtn>
            <div className="relative">
              <TextBtn onClick={() => setDlOpen((o) => !o)}>
                <Download size={16} strokeWidth={1.5} /> ดาวน์โหลด <ChevronDown size={14} strokeWidth={1.5} />
              </TextBtn>
              {dlOpen && (
                <div className="absolute right-0 top-10 z-30 w-64 rounded-[10px] border border-line-strong bg-card p-1 shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
                  {(
                    [
                      ["SVG (เวกเตอร์)", `${sheet.code}.svg · กระดาษขาว`, () => downloadSvg(sheet, hidden)],
                      ["DXF R12 (AutoCAD)", `${sheet.code}.dxf · ${sheet.layers.length} เลเยอร์`, () => downloadDxf(sheet, hidden)],
                    ] as [string, string, () => void][]
                  ).map(([t, sub, fn]) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        fn();
                        setDlOpen(false);
                      }}
                      className="flex w-full flex-col items-start rounded-[8px] px-3 py-2 text-left transition-colors duration-150 hover:bg-raised"
                    >
                      <span className="text-[14px]">{t}</span>
                      <span className="font-mono text-[12px] text-ink-3">{sub}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <TextBtn onClick={share}>
              <Link2 size={16} strokeWidth={1.5} /> แชร์ลิงก์
            </TextBtn>
            <IconBtn label={rightOpen ? "ซ่อนแผงข้อมูล" : "แสดงแผงข้อมูล"} onClick={() => setRightOpen((o) => !o)}>
              <PanelRight size={16} strokeWidth={1.5} />
            </IconBtn>
          </div>
        </div>

        {/* stage */}
        <div ref={stageRef} className="relative min-h-0 flex-1" style={{ background: th.backdrop }}>
          <style>{css + `.${SCOPE} .hl{fill:none;stroke:var(--accent);stroke-width:${(sheet.scale / 1000) * 0.6};stroke-dasharray:${sheet.scale / 1000} ${sheet.scale / 2000}}.${SCOPE} .hv{fill:rgba(194,65,12,0.12);stroke:none}`}</style>
          <div ref={boxRef} className={cx("absolute inset-0 touch-none select-none", hover ? "cursor-pointer" : "cursor-grab active:cursor-grabbing")}>
            <svg ref={svgRef} className={cx(SCOPE, "block h-full w-full")} role="img" aria-label={`${sheet.id} ${sheet.titleTh}`}>
              {client && (
                <>
                  <rect x={sheet.w * 0.004} y={sheet.h * 0.006} width={sheet.w} height={sheet.h} fill="rgba(0,0,0,0.18)" />
                  <SheetMarkup sheet={sheet} />
                  {hover !== selected && hl(hover, "hv")}
                  {hl(selected, "hl")}
                </>
              )}
            </svg>
          </div>

          {/* theme + layers */}
          <div className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-[10px] border border-line-strong bg-card/95 p-1 shadow-[0_2px_8px_rgba(0,0,0,0.12)]">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                title={t.label}
                aria-label={`กระดาษ ${t.label}`}
                aria-pressed={theme === t.id}
                onClick={() => setTheme(t.id)}
                className={cx("grid size-8 place-items-center rounded-[8px] transition-colors duration-150", theme === t.id ? "bg-raised" : "hover:bg-raised")}
              >
                <span className="size-4 rounded-full border border-line-strong" style={{ background: t.bg, boxShadow: `inset 0 0 0 3px ${t.bg}, inset 0 0 0 4px ${t.frame}` }} />
              </button>
            ))}
            <span className="mx-0.5 h-5 w-px bg-line-strong" />
            <button
              type="button"
              onClick={() => setLayersOpen((o) => !o)}
              aria-pressed={layersOpen}
              className={cx("flex h-8 items-center gap-1.5 rounded-[8px] px-2 text-[13px] transition-colors duration-150", layersOpen ? "bg-raised" : "hover:bg-raised")}
            >
              <Layers size={16} strokeWidth={1.5} /> เลเยอร์
              {hidden.size > 0 && <span className="font-mono text-[12px] text-accent-text">−{hidden.size}</span>}
            </button>
          </div>
          {layersOpen && (
            <div className="absolute left-3 top-14 z-20 max-h-[70%] w-[300px] overflow-auto rounded-[12px] border border-line-strong bg-card p-2 shadow-[0_8px_24px_rgba(0,0,0,0.16)]">
              <div className="flex items-center justify-between px-2 pb-1.5 pt-1">
                <span className="text-[13px] font-medium">เลเยอร์ในแผ่น {sheet.id}</span>
                <button type="button" onClick={() => setHidden(new Set())} className="text-[12px] text-ink-3 transition-colors duration-150 hover:text-ink">
                  แสดงทั้งหมด
                </button>
              </div>
              {sheet.layers.map((l) => {
                const d = layerDef(l);
                const on = !hidden.has(l);
                return (
                  <button
                    key={l}
                    type="button"
                    onClick={() =>
                      setHidden((h) => {
                        const n = new Set(h);
                        if (on) n.add(l);
                        else n.delete(l);
                        return n;
                      })
                    }
                    className="flex w-full items-center gap-2.5 rounded-[8px] px-2 py-1.5 text-left transition-colors duration-150 hover:bg-raised"
                  >
                    <span className={cx("grid size-4 place-items-center rounded-[4px] border", on ? "border-ink bg-ink text-card" : "border-line-strong")}>{on && <Check size={12} strokeWidth={2} />}</span>
                    <span className="size-2.5 rounded-full" style={{ background: l === "TITLE" ? th.frame : th.color(d), outline: "1px solid var(--line-strong)" }} />
                    <span className="w-[62px] font-mono text-[12px]">{l}</span>
                    <span className="truncate text-[13px] text-ink-2">{d.desc}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* scale bar */}
          <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-[8px] bg-card/90 px-2.5 py-1.5">
            <div className="flex h-2" style={{ width: barPx }}>
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={cx("h-full flex-1 border border-ink", i % 2 ? "bg-card" : "bg-ink")} />
              ))}
            </div>
            <div className="mt-1 flex justify-between font-mono text-[11px] text-ink-2" style={{ width: barPx }}>
              <span>0</span>
              <span>{barM >= 1 ? barM : barM.toFixed(1)} ม.</span>
            </div>
          </div>

          {/* zoom controls */}
          <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-[10px] border border-line-strong bg-card/95 p-1 shadow-[0_2px_8px_rgba(0,0,0,0.12)]">
            <IconBtn label="ซูมออก" onClick={() => zoom(0.8)}>
              <ZoomOut size={16} strokeWidth={1.5} />
            </IconBtn>
            <span className="w-14 text-center font-mono text-[12px]">{zoomPct}%</span>
            <IconBtn label="ซูมเข้า" onClick={() => zoom(1.25)}>
              <ZoomIn size={16} strokeWidth={1.5} />
            </IconBtn>
            <IconBtn label="พอดีแผ่น (F)" onClick={doFit}>
              <Scan size={16} strokeWidth={1.5} />
            </IconBtn>
            <IconBtn label={full ? "ออกจากเต็มจอ" : "เต็มจอ"} onClick={toggleFull}>
              {full ? <Minimize size={16} strokeWidth={1.5} /> : <Maximize size={16} strokeWidth={1.5} />}
            </IconBtn>
          </div>

          {/* minimap */}
          {client && (
            <Minimap
              sheet={sheet}
              theme={theme}
              view={v}
              onJump={(x, y) => centerOn(x, y)}
            />
          )}

          {toast && <div className="absolute left-1/2 top-3 z-30 -translate-x-1/2 rounded-[8px] bg-ink px-3 py-1.5 text-[13px] text-card">{toast}</div>}
        </div>

        {/* status bar */}
        <div className="flex h-8 shrink-0 items-center gap-5 border-t border-line px-3 text-[12px] text-ink-3">
          <span ref={cursorRef} className="w-[200px] font-mono text-ink-2">
            X — · Y — ม.
          </span>
          <span>มาตราส่วน {sheet.nts ? "ไม่มีมาตราส่วน" : `1:${sheet.scale}`} (A3)</span>
          <span>
            แผ่นที่ {idx + 1} / {sheets.length}
          </span>
          <span className="ml-auto hidden items-center gap-1 xl:flex">ลากเพื่อเลื่อน · ล้อเมาส์ซูม · คลิกอุปกรณ์เพื่อดูข้อมูล · ← → เปลี่ยนแผ่น · F พอดีแผ่น · Esc ยกเลิก</span>
        </div>
      </div>

      {rightOpen && (
        <aside className="w-[320px] shrink-0 overflow-y-auto bg-page/40 p-3">
          {selected ? (
            <AssetPanel code={selected} set={set} onClose={() => setSelected(null)} onSheet={(id) => go(sheets.findIndex((s) => s.id === id), true)} />
          ) : (
            <>
              <div className="rounded-[12px] border border-line bg-card">
                <div className="flex items-baseline gap-3 border-b border-line px-4 py-3">
                  <span className="font-mono text-[22px] leading-none">{sheet.id}</span>
                  <span className="text-[13px] text-ink-2">
                    {disc.th} <span className="text-ink-3">· {disc.en}</span>
                  </span>
                </div>
                <div className="px-4 py-3">
                  <p className="text-[16px] font-medium">{sheet.titleTh}</p>
                  <p className="text-[13px] text-ink-3">{sheet.titleEn}</p>
                  <dl className="mt-3 grid grid-cols-[96px_1fr] gap-x-3 gap-y-2 text-[13px]">
                    <dt className="text-ink-3">มาตราส่วน</dt>
                    <dd>
                      <span className="font-mono">{sheet.nts ? "—" : `1:${sheet.scale}`}</span> บนกระดาษ A3 (420×297 มม.)
                    </dd>
                    <dt className="text-ink-3">ประเภทแบบ</dt>
                    <dd>{KIND_LABEL[sheet.kind]}</dd>
                    <dt className="text-ink-3">ชั้น/ระดับ</dt>
                    <dd>{sheet.level}</dd>
                    <dt className="text-ink-3">ชิ้นงานในแผ่น</dt>
                    <dd>
                      <span className="font-mono">{sheet.prims.length.toLocaleString()}</span> รายการ · <span className="font-mono">{sheet.layers.length}</span> เลเยอร์ · <span className="font-mono">{sheet.hits.length}</span> อุปกรณ์
                    </dd>
                    <dt className="text-ink-3">รหัสแบบ</dt>
                    <dd className="font-mono">{sheet.code}</dd>
                    <dt className="text-ink-3">ลำดับแผ่น</dt>
                    <dd className="font-mono">
                      {sheet.index} / {sheet.total}
                    </dd>
                  </dl>
                </div>
              </div>

              <div className="mt-3 rounded-[12px] border border-line bg-card">
                <div className="flex items-baseline justify-between border-b border-line px-4 py-3">
                  <span className="text-[14px] font-medium">ประวัติการแก้ไขแบบ</span>
                  <span className="text-[12px] text-ink-3">Revisions</span>
                </div>
                <ol className="px-4 py-2">
                  {[...REVISIONS].reverse().map((r, i) => (
                    <li key={r.rev} className="flex gap-3 border-b border-line py-2.5 last:border-0">
                      <span className={cx("grid size-6 shrink-0 place-items-center rounded-full font-mono text-[12px]", i === 0 ? "bg-ink text-card" : "border border-line-strong text-ink-2")}>{r.rev}</span>
                      <div className="min-w-0 text-[13px]">
                        <p>
                          <span className="font-mono text-ink-2">{thDate(r.date)}</span> · {r.text}
                        </p>
                        <p className="text-[12px] text-ink-3">{r.by}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="mt-3 rounded-[12px] border border-line bg-card">
                <div className="flex items-baseline justify-between border-b border-line px-4 py-3">
                  <span className="text-[14px] font-medium">แบบบ้าน</span>
                  <span className="text-[12px] text-ink-3">House model</span>
                </div>
                <div className="px-4 py-3">
                  <p className="text-[15px] font-medium">{spec.nameTh}</p>
                  <p className="mt-0.5 text-[13px] text-ink-3">
                    <span className="font-mono">{spec.code}</span> · {spec.name} · {MODEL_TYPE_LABEL[spec.type]}
                  </p>
                  <div className="mt-3 grid grid-cols-4 gap-1.5">
                    {(
                      [
                        [spec.beds, "ห้องนอน"],
                        [spec.baths, "ห้องน้ำ"],
                        [spec.floors, "ชั้น"],
                        [spec.area.toLocaleString(), "ตร.ม."],
                      ] as [string | number, string][]
                    ).map(([n, l]) => (
                      <div key={l} className="rounded-[8px] border border-line px-1 py-2 text-center">
                        <p className="font-mono text-[16px] leading-none">{n}</p>
                        <p className="mt-1 text-[11px] text-ink-3">{l}</p>
                      </div>
                    ))}
                  </div>
                  <dl className="mt-3 grid grid-cols-[112px_1fr] gap-x-3 gap-y-1.5 text-[13px]">
                    <dt className="text-ink-3">สไตล์</dt>
                    <dd>{spec.style}</dd>
                    <dt className="text-ink-3">ที่จอดรถ</dt>
                    <dd>{spec.parking} คัน</dd>
                    <dt className="text-ink-3">ขนาดที่ดินแนะนำ</dt>
                    <dd>{spec.land}</dd>
                    <dt className="text-ink-3">ราคาก่อสร้าง</dt>
                    <dd>
                      <span className="font-mono">
                        ฿{spec.priceMin.toFixed(1)}–{spec.priceMax.toFixed(1)}
                      </span>{" "}
                      ล้าน
                    </dd>
                    <dt className="text-ink-3">ระยะก่อสร้าง</dt>
                    <dd>{spec.months} เดือน</dd>
                    <dt className="text-ink-3">โครงการที่ใช้</dt>
                    <dd>{projects.filter((p) => p.modelCode === spec.code).length} โครงการ</dd>
                  </dl>
                </div>
              </div>
            </>
          )}
        </aside>
      )}
    </div>
  );
}

function IconBtn({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" title={label} aria-label={label} onClick={onClick} className="grid size-8 place-items-center rounded-[8px] text-ink-2 transition-colors duration-150 hover:bg-raised hover:text-ink">
      {children}
    </button>
  );
}

function TextBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex h-8 items-center gap-1.5 rounded-[8px] px-2.5 text-[13px] text-ink-2 transition-colors duration-150 hover:bg-raised hover:text-ink">
      {children}
    </button>
  );
}

function Minimap({ sheet, theme, view, onJump }: { sheet: Sheet; theme: ThemeId; view: { x: number; y: number; s: number; w: number; h: number }; onJump: (x: number, y: number) => void }) {
  const src = useMemo(() => thumbDataUrl(sheet, THEME[theme]), [sheet, theme]);
  const W = 176;
  const H = (W * sheet.h) / sheet.w;
  const k = W / sheet.w;
  const rx = Math.max(0, view.x * k);
  const ry = Math.max(0, view.y * k);
  const rw = Math.min(W, (view.x + view.w / view.s) * k) - rx;
  const rh = Math.min(H, (view.y + view.h / view.s) * k) - ry;
  return (
    <button
      type="button"
      aria-label="แผนที่ย่อ คลิกเพื่อเลื่อนไปยังตำแหน่ง"
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        onJump((e.clientX - r.left - 4) / k, (e.clientY - r.top - 4) / k);
      }}
      className="absolute bottom-3 right-3 z-10 rounded-[10px] border border-line-strong bg-card p-1 shadow-[0_2px_8px_rgba(0,0,0,0.14)]"
    >
      <span className="relative block" style={{ width: W, height: H }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" width={W} height={H} className="block rounded-[6px]" />
        {rw > 0 && rh > 0 && <span className="absolute border-[1.5px] border-accent bg-accent/10" style={{ left: rx, top: ry, width: rw, height: rh }} />}
      </span>
    </button>
  );
}

function SheetList({ set, idx, onPick, client }: { set: ReturnType<typeof getDrawingSet>; idx: number; onPick: (i: number) => void; client: boolean }) {
  const [q, setQ] = useState("");
  const [closed, setClosed] = useState<Set<string>>(() => new Set());
  const { sheets, model } = set;
  const thumbs = useMemo(() => (client ? sheets.map((s) => thumbDataUrl(s, THEME.paper)) : []), [sheets, client]);
  const terms = q
    .split(/[,\s]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const match = (s: Sheet) => {
    if (!terms.length) return true;
    const d = DISCIPLINES.find((x) => x.key === s.disc)!;
    const hay = `${s.id} ${s.titleTh} ${s.titleEn} ${d.th} ${d.en} ${KIND_LABEL[s.kind]}`.toLowerCase();
    return terms.some((t) => hay.includes(t));
  };
  const activeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [idx]);

  return (
    <aside className="flex w-[288px] shrink-0 flex-col">
      <div className="flex items-center gap-2.5 border-b border-line px-3 py-3">
        <Link href="/blueprint" aria-label="กลับไปรายการชุดแบบ" className="grid size-8 shrink-0 place-items-center rounded-[8px] border border-line-strong text-ink-2 transition-colors duration-150 hover:bg-raised">
          <ArrowLeft size={16} strokeWidth={1.5} />
        </Link>
        <div className="min-w-0">
          <p className="font-mono text-[12px] text-accent-text">{model.code}</p>
          <p className="truncate text-[14px] font-medium leading-tight">{model.spec.nameTh}</p>
        </div>
      </div>
      <div className="px-3 pt-3">
        <label className="flex h-9 items-center gap-2 rounded-[8px] border border-line-strong bg-card px-2.5 text-ink-3 focus-within:border-ink-3">
          <Search size={16} strokeWidth={1.5} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาแผ่นงาน เช่น A-101, ไฟฟ้า" className="w-full bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-3" />
          {q && (
            <button type="button" aria-label="ล้างคำค้น" onClick={() => setQ("")}>
              <X size={14} strokeWidth={1.5} />
            </button>
          )}
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 pt-2">
        {DISCIPLINES.map((d) => {
          const list = sheets.map((s, i) => [s, i] as const).filter(([s]) => s.disc === d.key && match(s));
          if (!list.length) return null;
          const open = !closed.has(d.key) || terms.length > 0;
          return (
            <section key={d.key} className="mb-1">
              <button
                type="button"
                onClick={() =>
                  setClosed((c) => {
                    const n = new Set(c);
                    if (n.has(d.key)) n.delete(d.key);
                    else n.add(d.key);
                    return n;
                  })
                }
                className="flex w-full items-center gap-2.5 rounded-[8px] px-2 py-2 text-left transition-colors duration-150 hover:bg-raised"
              >
                <span className="grid size-6 place-items-center rounded-[6px] bg-ink font-mono text-[12px] text-card">{d.key}</span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block text-[14px]">{d.th}</span>
                  <span className="block text-[12px] text-ink-3">{d.en}</span>
                </span>
                <span className="rounded-full bg-raised px-2 font-mono text-[12px] text-ink-2">{list.length}</span>
                <ChevronDown size={16} strokeWidth={1.5} className={cx("text-ink-3 transition-transform duration-150", !open && "-rotate-90")} />
              </button>
              {open &&
                list.map(([s, i]) => (
                  <button
                    key={s.id}
                    ref={i === idx ? activeRef : undefined}
                    type="button"
                    onClick={() => onPick(i)}
                    className={cx("relative flex w-full items-center gap-2.5 rounded-[8px] px-2 py-1.5 text-left transition-colors duration-150", i === idx ? "bg-accent-soft" : "hover:bg-raised")}
                  >
                    {i === idx && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-accent" />}
                    <span className="block h-[44px] w-[62px] shrink-0 overflow-hidden rounded-[6px] border border-line-strong bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {thumbs[i] && <img src={thumbs[i]} alt="" className="h-full w-full object-contain" loading="lazy" />}
                    </span>
                    <span className="min-w-0 leading-tight">
                      <span className={cx("block font-mono text-[12px]", i === idx ? "text-accent-text" : "text-ink-2")}>{s.id}</span>
                      <span className="block truncate text-[13px]">{s.titleTh}</span>
                      <span className="block truncate text-[12px] text-ink-3">
                        {s.titleEn} · {s.nts ? "NTS" : `1:${s.scale}`}
                      </span>
                    </span>
                  </button>
                ))}
            </section>
          );
        })}
      </div>
      <div className="flex h-10 items-center justify-between border-t border-line px-3 text-[12px] text-ink-3">
        <span>
          <span className="font-mono">{sheets.length}</span> แผ่น · A3
        </span>
        <button type="button" onClick={() => printSheets(sheets, `${model.code} ชุดแบบ`)} className="flex items-center gap-1.5 text-ink-2 transition-colors duration-150 hover:text-ink">
          <Printer size={14} strokeWidth={1.5} /> พิมพ์ทั้งชุด
        </button>
      </div>
    </aside>
  );
}

function AssetPanel({ code, set, onClose, onSheet }: { code: string; set: ReturnType<typeof getDrawingSet>; onClose: () => void; onSheet: (id: string) => void }) {
  const m = set.model;
  const a = assetOf(m, code);
  if (!a) return null;
  const room = roomOf(m, a.room);
  const circuit = a.circuit ? m.circuits.find((c) => c.id === a.circuit) : undefined;
  const inWarranty = a.warrantyUntil >= TODAY;
  const on = set.sheets.filter((s) => s.hits.some((h) => h.code === code));
  return (
    <div className="rounded-[12px] border border-line bg-card">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <AssetTag code={a.code} />
        <button type="button" aria-label="ปิด" onClick={onClose} className="grid size-7 place-items-center rounded-[6px] text-ink-3 transition-colors duration-150 hover:bg-raised hover:text-ink">
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>
      <div className="px-4 py-3">
        <p className="text-[15px] font-medium leading-snug">{a.name}</p>
        <p className="mt-0.5 text-[13px] text-ink-3">{a.category}</p>
        <dl className="mt-3 grid grid-cols-[88px_1fr] gap-x-3 gap-y-2 text-[13px]">
          <dt className="text-ink-3">ตำแหน่ง</dt>
          <dd>
            {room ? room.name : a.room} · {a.floor > m.floors ? "หลังคา" : `ชั้น ${a.floor}`}
          </dd>
          <dt className="text-ink-3">ยี่ห้อ/รุ่น</dt>
          <dd>{a.brand}</dd>
          <dt className="text-ink-3">ติดตั้ง</dt>
          <dd>{thDate(a.installed)}</dd>
          <dt className="text-ink-3">ประกันถึง</dt>
          <dd className="flex flex-wrap items-center gap-x-2">
            {thDate(a.warrantyUntil)} <Status tone={inWarranty ? "pos" : "neg"}>{inWarranty ? "อยู่ในประกัน" : "หมดประกัน"}</Status>
          </dd>
          {circuit && (
            <>
              <dt className="text-ink-3">วงจร</dt>
              <dd>
                <span className="font-mono">{circuit.breaker}</span> · {circuit.name} <span className="text-ink-3">({circuit.db})</span>
              </dd>
            </>
          )}
          {a.btu && (
            <>
              <dt className="text-ink-3">ขนาด</dt>
              <dd className="font-mono">{a.btu.toLocaleString()} BTU</dd>
            </>
          )}
          {a.watts && (
            <>
              <dt className="text-ink-3">กำลังไฟ</dt>
              <dd className="font-mono">{a.watts.toLocaleString()} W</dd>
            </>
          )}
          <dt className="text-ink-3">พิกัด</dt>
          <dd className="font-mono text-ink-2">
            {a.pos[0].toFixed(2)}, {a.pos[2].toFixed(2)} · h {a.pos[1].toFixed(2)}
          </dd>
        </dl>
        <Link href={`/repairs?new=${encodeURIComponent(a.code)}`} className="mt-4 flex h-9 items-center justify-center gap-2 rounded-[8px] bg-ink text-[14px] font-medium text-card transition-[background-color,transform] duration-150 hover:bg-[#3a332b] active:scale-[0.98]">
          <Wrench size={16} strokeWidth={1.5} /> แจ้งซ่อม
        </Link>
      </div>
      {on.length > 0 && (
        <div className="border-t border-line px-4 py-3">
          <p className="text-[13px] text-ink-3">ปรากฏในแผ่น</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {on.map((s) => (
              <button key={s.id} type="button" onClick={() => onSheet(s.id)} className="rounded-[6px] border border-line-strong px-1.5 py-0.5 font-mono text-[12px] text-ink-2 transition-colors duration-150 hover:bg-raised">
                {s.id}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
