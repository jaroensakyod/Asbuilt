"use client";

// Official price feeds on /prices:
//   MappingPanel   "เชื่อมรหัส พณ."  — price-book item ↔ MOC com_code, auto-suggest + AI for leftovers
//   SyncModal      "ดึงราคาจาก พณ."  — provinces × months from dataapi.moc.go.th via /api/prices/moc
//   FileImportModal "อ่านไฟล์ราคา (AI)" — PDF/photo of an official price list → review grid → priceObs
//   AlertExplain   "ให้ AI อธิบาย"   — summary + suggested actions from the alert numbers

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, CloudDownload, Link2, Search, Unlink, X } from "lucide-react";
import { Card, CardHead, cx, Field, inputCls } from "@/components/ui";
import { Btn, Empty, IconBtn, Modal, Pill, Segmented } from "@/components/ops/bits";
import { aiGenerate, type JsonSchema } from "@/lib/ai/client";
import { projects, TODAY } from "@/lib/data";
import { useLocalProjects } from "@/lib/projects-store";
import { quotes } from "@/lib/sales/crm";
import { canEdit } from "@/lib/permissions";
import { useMe } from "@/lib/use-me";
import { importObs, priceObs, seriesOf, SOURCE_LABEL, thMonth, type PriceItem, type PriceSource } from "@/lib/sales/prices";
import { fullName, inMonths, lastMonths, MOC_PROVINCES, mocToObs, monthRange, planRequests, type MocPrice, type MocProduct } from "@/lib/price-feeds/moc";
import { MATCH_SURE, normText, prepareCatalog, suggestComCodes, unitFactor, type Scored } from "@/lib/price-feeds/match";
import { DOC_KIND_LABEL, DOC_SOURCE, EXTRACT_SCHEMA, extractPrompt, factorFor, reviewToObs, toReviewRows, type DocKind, type Extracted, type ReviewRow } from "@/lib/price-feeds/extract";
import { EXPLAIN_SCHEMA, explainPrompt, type AlertFact, type Explanation } from "@/lib/price-feeds/explain";
import { feedMaps, feedSettings, feedSyncs, syncId, type FeedMap } from "@/lib/price-feeds/store";
import { price } from "./common";
import { AiBusy, AiButton, AiError, AiPill, docToAi, I, MAX_DOC_BYTES, useAiRun } from "./price-ai-bits";

// ---------- catalogue ----------

type Catalog = { products: MocProduct[]; from: "live" | "snapshot"; fetchedAt: string };
let catalogP: Promise<Catalog> | null = null;
function loadCatalog() {
  return (catalogP ??= fetch("/api/prices/moc/products")
    .then(async (r) => {
      if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error ?? `HTTP ${r.status}`);
      return (await r.json()) as Catalog;
    })
    .catch((e) => {
      catalogP = null;
      throw e;
    }));
}
function useCatalog(enabled: boolean) {
  const [cat, setCat] = useState<Catalog | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let on = true;
    loadCatalog().then(
      (c) => on && setCat(c),
      (e) => on && setErr(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      on = false;
    };
  }, [enabled]);
  const prepared = useMemo(() => (cat ? prepareCatalog(cat.products) : null), [cat]);
  return { cat, prepared, err };
}

const nowIso = () => new Date().toISOString();
const thStamp = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })} ${d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}`;
};
const omit = <T,>(o: Record<string, T>, k: string) => Object.fromEntries(Object.entries(o).filter(([x]) => x !== k));
const fmtFactor = (f: number) => (f === 1 ? "1" : String(Math.round(f * 1e6) / 1e6));

/** last sync line for the page header */
export function useFeedStatus() {
  const syncs = feedSyncs.use();
  const maps = feedMaps.use();
  const last = [...syncs].sort((a, b) => b.at.localeCompare(a.at))[0];
  return { last, mapped: maps.filter((m) => m.comCode).length };
}

// ---------- mapping ----------

type Draft = { comCode: string; comName: string; comUnit?: string; factor: number; by: FeedMap["by"]; score?: number; reason?: string };

export function MappingPanel({ items }: { items: PriceItem[] }) {
  const me = useMe();
  const editable = canEdit(me.role, "costs");
  const maps = feedMaps.use();
  const { cat, prepared, err } = useCatalog(true);
  const [filter, setFilter] = useState<"all" | "linked" | "open">("all");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [pick, setPick] = useState<PriceItem | null>(null);
  const ai = useAiRun();
  const byItem = useMemo(() => new Map(maps.map((m) => [m.itemCode, m])), [maps]);
  const sugg = useMemo(() => {
    const out = new Map<string, Scored<MocProduct>[]>();
    if (prepared) for (const it of items) out.set(it.code, suggestComCodes(it, prepared, 5));
    return out;
  }, [items, prepared]);
  const byCode = useMemo(() => new Map((cat?.products ?? []).map((p) => [p.code, p])), [cat]);

  const save = (it: PriceItem, d: Draft) => {
    feedMaps.upsert({ id: it.code, itemCode: it.code, comCode: d.comCode, comName: d.comName, comUnit: d.comUnit, factor: d.factor, by: d.by, score: d.score, updatedAt: nowIso(), by_name: me.name });
    setDrafts((d) => omit(d, it.code));
  };
  const fromScored = (s: Scored<MocProduct>, by: FeedMap["by"]): Draft => ({ comCode: s.item.code, comName: fullName(s.item), comUnit: s.item.unit, factor: s.factor ?? 1, by, score: s.score });

  const sure = items.filter((it) => !byItem.has(it.code) && !drafts[it.code] && (sugg.get(it.code)?.[0]?.score ?? 0) >= MATCH_SURE && sugg.get(it.code)?.[0]?.factor !== undefined);
  const leftovers = items.filter((it) => !byItem.has(it.code) && !drafts[it.code] && !sure.includes(it));
  const aiDrafts = Object.entries(drafts).filter(([, d]) => d.by === "ai");

  const acceptSure = () => {
    for (const it of sure) save(it, fromScored(sugg.get(it.code)![0], "auto"));
  };

  const askAi = async () => {
    if (!prepared) return;
    const batch = leftovers.slice(0, AI_BATCH).map((it) => ({ it, cands: suggestComCodes(it, prepared, 6) })).filter((x) => x.cands.length);
    if (!batch.length) return;
    type Res = { matches: { itemCode: string; comCode?: string | null; factor?: number; reason?: string }[] };
    const res = await ai.run(async () => {
      const q = {
        system: "คุณช่วยจับคู่รายการวัสดุในฐานข้อมูลราคาของบริษัทกับรหัสสินค้าวัสดุก่อสร้างของกระทรวงพาณิชย์ ตอบเป็น JSON ภาษาไทย เลือกได้เฉพาะรหัสในรายการผู้สมัครที่ให้มา ถ้าไม่มีตัวที่ตรงสเปกจริงให้ comCode เป็น null factor คือตัวคูณแปลงราคาต่อหน่วยของ พณ. เป็นราคาต่อหน่วยของเรา (เช่น ตัน→กก. = 0.001, ม้วน 100 ม.→ม. = 0.01) reason สั้นไม่เกิน 10 คำ",
        prompt:
          `วันนี้ ${TODAY}\n` +
          batch
            .map(({ it, cands }) => `รายการ ${it.code}: ${it.name} (หน่วย ${it.unit})\n` + cands.map((c) => `  - ${c.item.code}: ${fullName(c.item)} (หน่วย ${c.item.unit ?? "-"})${c.factor !== undefined ? ` factor ที่คำนวณได้ ${c.factor}` : ""}`).join("\n"))
            .join("\n\n"),
        schema: {
          type: "object",
          properties: {
            matches: {
              type: "array",
              items: { type: "object", properties: { itemCode: { type: "string" }, comCode: { type: "string", nullable: true }, factor: { type: "number" }, reason: { type: "string" } }, required: ["itemCode"] },
            },
          },
          required: ["matches"],
        } as JsonSchema,
      };
      const r = await aiGenerate({ task: "price-com-match", system: q.system, messages: [{ role: "user", parts: [{ text: q.prompt }] }], json: q.schema, maxOutputTokens: 16384, temperature: 0 });
      return r.json as Res;
    });
    if (!res) return;
    const next: Record<string, Draft> = {};
    for (const m of res.matches ?? []) {
      const b = batch.find((x) => x.it.code === m.itemCode);
      const c = b?.cands.find((x) => x.item.code === m.comCode);
      if (!b || !c) continue; // only codes we offered
      const factor = m.factor && m.factor > 0 ? m.factor : (c.factor ?? 1);
      next[b.it.code] = { ...fromScored(c, "ai"), factor, reason: m.reason };
    }
    setDrafts((d) => ({ ...d, ...next }));
    if (!Object.keys(next).length) ai.setError("AI ไม่พบรหัสที่ตรงสเปกสำหรับรายการที่เหลือ ให้เลือกเองหรือนำเข้าราคาจากไฟล์");
  };

  const rows = items.filter((it) => (filter === "linked" ? byItem.has(it.code) : filter === "open" ? !byItem.has(it.code) : true));
  const linked = items.filter((it) => byItem.has(it.code)).length;

  return (
    <Card className="mt-3">
      <CardHead
        title="เชื่อมรายการกับรหัสสินค้า พณ."
        meta={`เชื่อมแล้ว ${linked} จาก ${items.length} รายการ`}
        action={
          editable ? (
            <div className="flex flex-wrap items-center gap-2">
              <Btn small disabled={!sure.length} onClick={acceptSure}>
                <Check {...I} />
                ใช้คำแนะนำที่มั่นใจ ({sure.length})
              </Btn>
              <AiButton busy={ai.busy} disabled={!prepared || !leftovers.length} onClick={askAi}>
                ให้ AI ช่วยจับคู่ ({Math.min(AI_BATCH, leftovers.length)})
              </AiButton>
              {aiDrafts.length > 0 && (
                <Btn small primary onClick={() => aiDrafts.forEach(([code, d]) => save(items.find((i) => i.code === code)!, d))}>
                  บันทึกที่ AI เสนอ ({aiDrafts.length})
                </Btn>
              )}
            </div>
          ) : undefined
        }
      />
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3 text-[12px] text-ink-3">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { key: "all", label: "ทั้งหมด" },
            { key: "linked", label: `เชื่อมแล้ว (${linked})` },
            { key: "open", label: `ยังไม่เชื่อม (${items.length - linked})` },
          ]}
        />
        <span>
          รายการรหัสสินค้า {cat ? `${cat.products.length.toLocaleString("th-TH")} รหัส · ${cat.from === "live" ? "ดึงจาก data.moc.go.th" : `ชุดสำรองในระบบ ${cat.fetchedAt}`}` : err ? <span className="text-neg">โหลดไม่สำเร็จ: {err}</span> : "กำลังโหลด…"}
        </span>
        <span className="ml-auto">ราคาของเรา = ราคา พณ. × ตัวคูณหน่วย</span>
      </div>
      {ai.busy && (
        <div className="px-5 pt-3">
          <AiBusy label="AI กำลังเลือกรหัสที่ตรงสเปกจากผู้สมัคร…" onCancel={ai.cancel} />
        </div>
      )}
      {ai.error && (
        <div className="px-5 pt-3">
          <AiError text={ai.error} />
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-[13px]">
          <thead>
            <tr className="border-b border-line text-left text-[12px] text-ink-3">
              <th className="px-5 py-2.5 font-normal">รายการของเรา</th>
              <th className="px-3 py-2.5 font-normal">รหัสสินค้า พณ.</th>
              <th className="px-3 py-2.5 text-right font-normal">ตัวคูณหน่วย</th>
              <th className="px-3 py-2.5 font-normal">สถานะ</th>
              <th className="px-5 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((it) => {
              const m = byItem.get(it.code);
              const d = drafts[it.code];
              const best = sugg.get(it.code)?.[0];
              const shown: Draft | undefined = m ? { comCode: m.comCode, comName: m.comName, comUnit: m.comUnit, factor: m.factor, by: m.by, score: m.score } : d ?? (best ? fromScored(best, "auto") : undefined);
              const isSuggestion = !m && !d;
              return (
                <tr key={it.code} className="align-top">
                  <td className="px-5 py-2.5">
                    <span className="text-ink">{it.name}</span>
                    <span className="mt-0.5 block font-mono text-[12px] text-ink-3">
                      {it.code} · {it.unit}
                    </span>
                  </td>
                  <td className="max-w-[420px] px-3 py-2.5">
                    {shown ? (
                      <>
                        <span className={cx("block", isSuggestion ? "text-ink-3" : "text-ink-2")} title={shown.comName}>
                          {shown.comName.length > 110 ? "…" + shown.comName.slice(-110) : shown.comName}
                        </span>
                        <span className="mt-0.5 block font-mono text-[12px] text-ink-3">
                          {shown.comCode} · ต่อ {shown.comUnit ?? "?"}
                          {d?.reason && <span className="ml-2 font-sans">{d.reason}</span>}
                        </span>
                      </>
                    ) : (
                      <span className="text-ink-3">{prepared ? "ไม่พบรหัสที่ใกล้เคียง" : "–"}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {m && editable ? (
                      <input
                        aria-label={`ตัวคูณหน่วย ${it.code}`}
                        className={cx(inputCls, "num h-8 w-24 text-right font-mono text-[12px]")}
                        defaultValue={fmtFactor(m.factor)}
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (v > 0 && v !== m.factor) feedMaps.upsert({ ...m, factor: v, by: "user", updatedAt: nowIso(), by_name: me.name });
                        }}
                      />
                    ) : shown ? (
                      <span className={cx("num font-mono text-[12px]", isSuggestion && "text-ink-3")}>× {fmtFactor(shown.factor)}</span>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    {m ? (
                      <span className="inline-flex items-center gap-1">
                        <Pill tone="pos">เชื่อมแล้ว</Pill>
                        {m.by === "ai" && <AiPill />}
                        {m.by === "auto" && <span className="text-[11px] text-ink-3">อัตโนมัติ</span>}
                      </span>
                    ) : d ? (
                      <span className="inline-flex items-center gap-1">
                        <Pill tone="warn">รอยืนยัน</Pill>
                        {d.by === "ai" && <AiPill />}
                      </span>
                    ) : best ? (
                      <span className="text-[12px] text-ink-3">
                        คำแนะนำ <span className="num font-mono">{Math.round(best.score * 100)}%</span>
                        {best.factor === undefined && <span className="block text-warn">ต้องกำหนดตัวคูณหน่วยเอง</span>}
                      </span>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-5 py-2.5 text-right">
                    {editable && (
                      <span className="inline-flex items-center gap-1">
                        {!m && shown && (
                          <Btn small onClick={() => save(it, d ?? fromScored(best!, "user"))}>
                            <Link2 {...I} />
                            {d ? "ยืนยัน" : "ใช้"}
                          </Btn>
                        )}
                        <Btn small onClick={() => setPick(it)}>
                          เลือกเอง
                        </Btn>
                        {m && (
                          <IconBtn label="เลิกเชื่อม" danger onClick={() => feedMaps.remove(m.id)}>
                            <Unlink {...I} />
                          </IconBtn>
                        )}
                        {d && (
                          <IconBtn label="ไม่ใช้คำแนะนำนี้" onClick={() => setDrafts((d) => omit(d, it.code))}>
                            <X {...I} />
                          </IconBtn>
                        )}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && <Empty>ไม่มีรายการในกลุ่มนี้</Empty>}
      </div>
      <p className="border-t border-line px-5 py-3 text-[12px] text-ink-3">
        ระบบแนะนำรหัสจากชื่อ ขนาด และหน่วย ตรวจสเปกก่อนยืนยันทุกครั้ง ราคาของ พณ. เป็นราคาเฉลี่ยรายจังหวัดของยี่ห้อที่สำรวจ ตัวคูณหน่วยแปลงหน่วยของ พณ. (เช่น ตัน ม้วน ท่อน) เป็นหน่วยในฐานข้อมูลของเรา
      </p>
      {pick && cat && (
        <PickModal
          item={pick}
          products={cat.products}
          suggestions={sugg.get(pick.code) ?? []}
          byCode={byCode}
          onClose={() => setPick(null)}
          onPick={(p) => {
            save(pick, { comCode: p.code, comName: fullName(p), comUnit: p.unit, factor: unitFactor(p.unit, fullName(p), pick.unit, pick.name) ?? 1, by: "user" });
            setPick(null);
          }}
        />
      )}
    </Card>
  );
}

function PickModal({ item, products, suggestions, onPick, onClose }: { item: PriceItem; products: MocProduct[]; suggestions: Scored<MocProduct>[]; byCode: Map<string, MocProduct>; onPick: (p: MocProduct) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const needle = normText(q);
  const hits = useMemo(() => {
    if (needle.length < 2) return [];
    const parts = needle.split(" ").filter(Boolean);
    return products.filter((p) => p.unit && (p.code.startsWith(q.trim()) || parts.every((w) => normText(fullName(p)).includes(w)))).slice(0, 40);
  }, [needle, products, q]);
  const list = needle.length >= 2 ? hits : suggestions.map((s) => s.item);
  return (
    <Modal open onClose={onClose} title={`เลือกรหัส พณ. · ${item.name}`} width={820}>
      <label className="relative block">
        <Search {...I} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นชื่อสินค้า ขนาด หรือรหัส 16 หลัก" className={cx(inputCls, "w-full pl-9")} aria-label="ค้นรหัสสินค้า พณ." />
      </label>
      <p className="mt-2 text-[12px] text-ink-3">{needle.length >= 2 ? `พบ ${hits.length}${hits.length === 40 ? "+" : ""} รหัส` : "คำแนะนำจากชื่อและหน่วย"} · หน่วยของเรา {item.unit}</p>
      <ul className="mt-2 max-h-[420px] divide-y divide-line overflow-y-auto rounded-[10px] border border-line">
        {list.map((p) => {
          const f = unitFactor(p.unit, fullName(p), item.unit, item.name);
          return (
            <li key={p.code}>
              <button type="button" onClick={() => onPick(p)} className="w-full px-4 py-2 text-left text-[13px] transition-colors duration-150 hover:bg-raised/60">
                <span className="text-ink-2">{fullName(p)}</span>
                <span className="mt-0.5 block font-mono text-[12px] text-ink-3">
                  {p.code} · ต่อ {p.unit} · {f !== undefined ? `× ${fmtFactor(f)}` : "ตัวคูณหน่วย 1 (แก้ได้ภายหลัง)"}
                </span>
              </button>
            </li>
          );
        })}
        {!list.length && <li className="px-4 py-6 text-center text-[13px] text-ink-3">ไม่พบรหัส</li>}
      </ul>
    </Modal>
  );
}

// ---------- sync ----------

const CHUNK = 6;
const AI_BATCH = 20;

export function SyncModal({ onClose }: { onClose: () => void }) {
  const me = useMe();
  const maps = feedMaps.use();
  const settings = feedSettings.use().find((s) => s.id === "moc");
  const local = useLocalProjects();
  const activeProvs = useMemo(() => [...new Set([...projects, ...local].filter((p) => p.status === "building" || p.status === "planning").map((p) => p.province))].filter((p) => MOC_PROVINCES.some(([, n]) => n === p)), [local]);
  const [provs, setProvs] = useState<string[]>(settings?.provinces?.length ? settings.provinces : activeProvs.length ? activeProvs : ["กรุงเทพฯ"]);
  const def = lastMonths(TODAY, 3);
  const [from, setFrom] = useState(def.from);
  const [to, setTo] = useState(def.to);
  const [state, setState] = useState<"idle" | "running" | "done">("idle");
  const [done, setDone] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [result, setResult] = useState<{ added: number; updated: number; unchanged: number; prices: number } | null>(null);
  const abort = useRef<AbortController | null>(null);

  const links = maps.filter((m) => m.comCode && m.factor > 0);
  const plan = planRequests(links.map((l) => l.comCode), provs);
  const batches = useMemo(() => {
    const byProv = new Map<string, string[]>();
    for (const p of plan) byProv.set(p.province, [...(byProv.get(p.province) ?? []), p.comCode]);
    return [...byProv.entries()].flatMap(([prov, codes]) => Array.from({ length: Math.ceil(codes.length / CHUNK) }, (_, i) => ({ prov, codes: codes.slice(i * CHUNK, i * CHUNK + CHUNK) })));
  }, [plan]);
  const months = monthRange(from, to);

  const run = async () => {
    const ctl = new AbortController();
    abort.current = ctl;
    setState("running");
    setDone(0);
    setErrors([]);
    setResult(null);
    feedSettings.upsert({ id: "moc", provinces: provs, monthsBack: settings?.monthsBack ?? 2, cron: settings?.cron });
    const all: MocPrice[] = [];
    const errs: string[] = [];
    const years = { from: Number(from.slice(0, 4)), to: Number(to.slice(0, 4)) };
    let stopped = false;
    for (let i = 0; i < batches.length; i++) {
      if (ctl.signal.aborted) break;
      const b = batches[i];
      try {
        const res = await fetch(`/api/prices/moc?com=${b.codes.join(",")}&province=${b.prov}&from=${years.from}&to=${years.to}`, { signal: ctl.signal });
        const body = (await res.json().catch(() => ({}))) as { prices?: MocPrice[]; error?: string; errors?: { comCode: string; error: string }[] };
        if (!res.ok) {
          errs.push(body.error ?? `HTTP ${res.status}`);
          if (res.status === 504 || res.status === 401) {
            stopped = true;
            break;
          }
        } else {
          all.push(...(body.prices ?? []));
          for (const e of body.errors ?? []) errs.push(`${e.comCode}: ${e.error}`);
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") break;
        errs.push((e as Error).message);
      }
      setDone(i + 1);
      setErrors([...errs]);
    }
    const inRange = inMonths(all, from, to);
    const r = importObs(mocToObs(inRange, links, nowIso(), "api"));
    const at = nowIso();
    feedSyncs.upsert({
      id: syncId(at),
      at,
      via: "api",
      source: "moc",
      provinces: provs,
      from,
      to,
      requests: plan.length,
      added: r.added,
      updated: r.updated,
      errors: errs.length,
      status: errs.length || stopped || ctl.signal.aborted ? (r.added + r.updated ? "partial" : "failed") : "ok",
      message: stopped ? errs[errs.length - 1] : ctl.signal.aborted ? "ยกเลิกโดยผู้ใช้" : undefined,
      by: me.name,
    });
    setResult({ ...r, prices: inRange.length });
    setErrors(errs);
    setState("done");
  };

  const toggle = (p: string) => setProvs((l) => (l.includes(p) ? l.filter((x) => x !== p) : [...l, p]));

  return (
    <Modal
      open
      onClose={() => {
        abort.current?.abort();
        onClose();
      }}
      title="ดึงราคาวัสดุจากกระทรวงพาณิชย์"
      width={760}
      footer={
        state === "running" ? (
          <>
            <span className="mr-auto text-[13px] text-ink-3">
              {done}/{batches.length} ชุดคำขอ · ระบบของ พณ. ตอบช้า (ประมาณ 40–60 วินาทีต่อชุด)
            </span>
            <Btn onClick={() => abort.current?.abort()}>หยุด</Btn>
          </>
        ) : state === "done" ? (
          <Btn primary onClick={onClose}>
            ปิด
          </Btn>
        ) : (
          <>
            <span className="mr-auto text-[13px] text-ink-3">
              {links.length} รายการที่เชื่อมรหัส × {provs.length} จังหวัด = {plan.length} รหัส-จังหวัด · {months.length} เดือน
            </span>
            <Btn onClick={onClose}>ยกเลิก</Btn>
            <Btn primary disabled={!plan.length || !months.length} onClick={run}>
              <CloudDownload {...I} />
              เริ่มดึงราคา
            </Btn>
          </>
        )
      }
    >
      {!links.length ? (
        <p className="py-4 text-[14px] text-ink-2">ยังไม่มีรายการที่เชื่อมกับรหัสสินค้า พณ. ไปที่แท็บ “เชื่อมรหัส พณ.” ก่อน แล้วกลับมาดึงราคา</p>
      ) : state === "idle" ? (
        <div className="space-y-4">
          <div>
            <p className="text-[13px] text-ink-2">จังหวัด (ค่าเริ่มต้นคือจังหวัดของโครงการที่กำลังก่อสร้าง/วางแผน)</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {provs.map((p) => (
                <button key={p} type="button" onClick={() => toggle(p)} className="inline-flex h-7 items-center gap-1 rounded-[8px] border border-line-strong bg-raised px-2 text-[13px] text-ink hover:border-ink-3">
                  {p}
                  <X size={12} strokeWidth={1.5} />
                </button>
              ))}
              <select aria-label="เพิ่มจังหวัด" className={cx(inputCls, "h-7 text-[13px]")} value="" onChange={(e) => e.target.value && toggle(e.target.value)}>
                <option value="">+ เพิ่มจังหวัด</option>
                {MOC_PROVINCES.filter(([, n]) => !provs.includes(n)).map(([c, n]) => (
                  <option key={c} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:w-[360px]">
            <Field label="ตั้งแต่เดือน">
              <input type="month" className={inputCls} value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="ถึงเดือน">
              <input type="month" className={inputCls} value={to} min={from} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>
          <p className="text-[12px] text-ink-3">
            ราคาที่ได้จะแทนที่ราคาตัวอย่างของแหล่ง “กระทรวงพาณิชย์” ในรายการนั้นทันที ถ้าดึงเดือนเดิมซ้ำ ระบบจะอัปเดตแถวเดิม ไม่สร้างซ้ำ ถ้าระบบของ พณ. ไม่ตอบสนอง ให้ใช้ “อ่านไฟล์ราคา (AI)” กับไฟล์ PDF ราคาวัสดุรายจังหวัดจากเว็บไซต์ สนค. แทน
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="h-1.5 w-full rounded-full bg-raised">
            <div className="h-1.5 rounded-full bg-ink transition-[width] duration-300" style={{ width: `${batches.length ? (done / batches.length) * 100 : 0}%` }} />
          </div>
          {result && (
            <p className="text-[14px] text-ink-2">
              ได้ราคา <span className="num font-mono text-ink">{result.prices}</span> ค่า · เพิ่มใหม่ <span className="num font-mono text-ink">{result.added}</span> · อัปเดต <span className="num font-mono text-ink">{result.updated}</span> · ไม่เปลี่ยน {result.unchanged}
            </p>
          )}
          {errors.length > 0 && (
            <div className="max-h-[160px] overflow-y-auto rounded-[10px] border border-line px-4 py-2 text-[12px] text-ink-2">
              <p className="mb-1 text-warn">ข้อผิดพลาด {errors.length} รายการ</p>
              {[...new Set(errors)].slice(0, 12).map((e) => (
                <p key={e}>{e}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

// ---------- file import (AI) ----------

export function FileImportModal({ items, onClose }: { items: PriceItem[]; onClose: () => void }) {
  const me = useMe();
  const [kind, setKind] = useState<DocKind>("moc-province");
  const [source, setSource] = useState<PriceSource>("moc");
  const [file, setFile] = useState<File | null>(null);
  const [meta, setMeta] = useState<{ title?: string; province?: string; month?: string } | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [done, setDone] = useState<{ added: number; updated: number } | null>(null);
  const ai = useAiRun();
  const fileRef = useRef<HTMLInputElement>(null);
  const byCode = useMemo(() => new Map(items.map((i) => [i.code, i])), [items]);

  const read = async (f: File) => {
    if (f.size > MAX_DOC_BYTES) return ai.setError("ไฟล์ใหญ่เกิน 8 MB ให้ตัดเฉพาะหน้าที่มีตาราง");
    setFile(f);
    setRows([]);
    const ex = await ai.run(async () => {
      const part = await docToAi(f);
      const p = extractPrompt(kind, TODAY);
      const r = await aiGenerate({ task: "price-list-read", system: p.system, messages: [{ role: "user", parts: [{ file: part }, { text: p.prompt }] }], json: EXTRACT_SCHEMA, maxOutputTokens: 16384, temperature: 0 });
      return r.json as Extracted;
    });
    if (!ex) return;
    setMeta({ title: ex.title, province: ex.province, month: ex.month });
    setRows(toReviewRows({ ...ex, rows: ex.rows ?? [] }, kind, items, { fallbackMonth: lastMonths(TODAY, 1).to }));
  };

  const set = (key: string, patch: Partial<ReviewRow>) =>
    setRows((l) =>
      l.map((r) => {
        if (r.key !== key) return r;
        const n = { ...r, ...patch };
        if (patch.itemCode !== undefined && patch.itemCode) n.factor = factorFor(n, byCode.get(patch.itemCode)!);
        n.errors = [...(!(n.price && n.price > 0) ? ["ไม่มีราคา"] : []), ...(!n.month || !/^\d{4}-\d{2}$/.test(n.month) ? ["ไม่ทราบเดือน"] : [])];
        return n;
      }),
    );
  const ready = rows.filter((r) => r.itemCode && !r.errors.length && r.factor > 0);

  const doImport = () => {
    const obs = reviewToObs(ready, source, nowIso(), file?.name);
    const r = importObs(obs);
    const at = nowIso();
    feedSyncs.upsert({ id: syncId(at), at, via: "file", source: source === "supplier" ? undefined : source, file: file?.name, added: r.added, updated: r.updated, errors: 0, status: "ok", by: me.name, message: DOC_KIND_LABEL[kind] });
    setDone(r);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="อ่านไฟล์ราคาทางการด้วย AI"
      width={1100}
      footer={
        done ? (
          <Btn primary onClick={onClose}>
            ปิด
          </Btn>
        ) : (
          <>
            <span className="mr-auto text-[13px] text-ink-3">{rows.length ? `พร้อมนำเข้า ${ready.length} จาก ${rows.length} แถว · แถวที่ไม่ได้เลือกรายการจะถูกข้าม` : "เลือกไฟล์ PDF หรือรูปถ่ายตารางราคา"}</span>
            <Btn onClick={onClose}>ยกเลิก</Btn>
            <Btn primary disabled={!ready.length} onClick={doImport}>
              นำเข้า {ready.length || ""} ราคา
            </Btn>
          </>
        )
      }
    >
      {done ? (
        <p className="py-6 text-center text-[14px] text-ink-2">
          นำเข้าแล้ว เพิ่มใหม่ <span className="num font-mono text-ink">{done.added}</span> · อัปเดต <span className="num font-mono text-ink">{done.updated}</span> ราคา ({SOURCE_LABEL[source]}) ราคาที่นำเข้าจะแทนราคาตัวอย่างของรายการและแหล่งนั้น
        </p>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-[1fr_200px_auto]">
            <Field label="ชนิดเอกสาร">
              <select
                className={inputCls}
                value={kind}
                onChange={(e) => {
                  const k = e.target.value as DocKind;
                  setKind(k);
                  setSource(DOC_SOURCE[k]);
                }}
              >
                {(Object.keys(DOC_KIND_LABEL) as DocKind[]).map((k) => (
                  <option key={k} value={k}>
                    {DOC_KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="บันทึกเป็นแหล่ง">
              <select className={inputCls} value={source} onChange={(e) => setSource(e.target.value as PriceSource)}>
                {(["moc", "cgd"] as const).map((s) => (
                  <option key={s} value={s}>
                    {SOURCE_LABEL[s]}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex items-end">
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                data-testid="price-file"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void read(f);
                  e.target.value = "";
                }}
              />
              <AiButton small={false} busy={ai.busy} onClick={() => fileRef.current?.click()}>
                ให้ AI อ่านไฟล์
              </AiButton>
            </div>
          </div>
          <p className="mt-2 text-[12px] text-ink-3">
            ใช้กับ PDF/รูปถ่ายของ ราคาวัสดุก่อสร้างรายจังหวัด (สนค.), ราคาเฉลี่ยสำหรับราคากลางงานก่อสร้างภาครัฐ, บัญชีค่าแรงงานของกรมบัญชีกลาง ไฟล์ไม่เกิน 8 MB · ตรวจตัวเลขกับต้นฉบับก่อนนำเข้า
          </p>
          {ai.busy && (
            <div className="mt-3">
              <AiBusy label={`AI กำลังอ่านตารางใน ${file?.name ?? "ไฟล์"} (5–30 วินาที)…`} onCancel={ai.cancel} />
            </div>
          )}
          {ai.error && (
            <div className="mt-3">
              <AiError text={ai.error} />
            </div>
          )}
          {meta && !ai.busy && (
            <p className="mt-3 text-[13px] text-ink-2">
              <AiPill className="mr-1.5" />
              {meta.title ?? file?.name} {meta.province && `· ${meta.province}`} {meta.month && `· ${meta.month}`} · อ่านได้ {rows.length} แถว
            </p>
          )}
          {rows.length > 0 && (
            <div className="mt-3 max-h-[440px] overflow-auto rounded-[10px] border border-line">
              <table className="w-full min-w-[1040px] text-[12px]">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b border-line text-left text-ink-3">
                    <th className="px-3 py-2 font-normal">รายการในไฟล์</th>
                    <th className="px-2 py-2 text-right font-normal">ราคาในไฟล์</th>
                    <th className="px-2 py-2 font-normal">ชนิด</th>
                    <th className="px-2 py-2 font-normal">รายการของเรา</th>
                    <th className="px-2 py-2 text-right font-normal">ตัวคูณ</th>
                    <th className="px-2 py-2 text-right font-normal">ราคา/หน่วยเรา</th>
                    <th className="px-2 py-2 font-normal">เดือน</th>
                    <th className="px-2 py-2 font-normal">จังหวัด</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((r) => {
                    const it = byCode.get(r.itemCode);
                    return (
                      <tr key={r.key} className={cx("align-top", !r.itemCode && "text-ink-3")}>
                        <td className="max-w-[260px] px-3 py-1.5">
                          {r.name}
                          {r.errors.map((e) => (
                            <span key={e} className="block text-neg">
                              {e}
                            </span>
                          ))}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-right">
                          <input aria-label="ราคาในไฟล์" className={cx(inputCls, "num h-7 w-24 text-right font-mono text-[12px]")} value={r.price ?? ""} onChange={(e) => set(r.key, { price: Number(e.target.value.replace(/,/g, "")) || undefined })} />
                          <span className="block text-ink-3">/{r.unit ?? "?"}</span>
                        </td>
                        <td className="px-2 py-1.5">
                          <select aria-label="ชนิดราคา" className={cx(inputCls, "h-7 text-[12px]")} value={r.kind} onChange={(e) => set(r.key, { kind: e.target.value as ReviewRow["kind"] })}>
                            <option value="material">วัสดุ</option>
                            <option value="labour">ค่าแรง</option>
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <select aria-label="รายการของเรา" className={cx(inputCls, "h-7 w-[240px] text-[12px]")} value={r.itemCode} onChange={(e) => set(r.key, { itemCode: e.target.value })}>
                            <option value="">— ไม่นำเข้า —</option>
                            {r.options.length > 0 && (
                              <optgroup label="ใกล้เคียง">
                                {r.options.map((o) => (
                                  <option key={o.code} value={o.code}>
                                    {byCode.get(o.code)?.name} ({Math.round(o.score * 100)}%)
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            <optgroup label="ทั้งหมด">
                              {items.map((i) => (
                                <option key={i.code} value={i.code}>
                                  {i.code} {i.name}
                                </option>
                              ))}
                            </optgroup>
                          </select>
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <input aria-label="ตัวคูณหน่วย" className={cx(inputCls, "num h-7 w-20 text-right font-mono text-[12px]")} value={r.factor} onChange={(e) => set(r.key, { factor: Number(e.target.value) || 0 })} />
                        </td>
                        <td className="num whitespace-nowrap px-2 py-1.5 text-right font-mono">
                          {it && r.price ? (
                            <>
                              {price(r.price * r.factor)}
                              <span className="block font-sans text-ink-3">/{it.unit}</span>
                            </>
                          ) : (
                            "–"
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          <input aria-label="เดือน" type="month" className={cx(inputCls, "h-7 w-[130px] text-[12px]")} value={r.month ?? ""} onChange={(e) => set(r.key, { month: e.target.value })} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input aria-label="จังหวัด" className={cx(inputCls, "h-7 w-[110px] text-[12px]")} value={r.province ?? ""} onChange={(e) => set(r.key, { province: e.target.value || undefined })} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

// ---------- AI explanation of alerts ----------

export type AlertRow = { it: PriceItem; s: PriceSource; l: { price: number; prev?: number; change?: number; sample: boolean } | null };

export function AlertExplain({ alerts, threshold }: { alerts: AlertRow[]; threshold: number }) {
  const obs = priceObs.use();
  const qs = quotes.use();
  const ai = useAiRun();
  const [out, setOut] = useState<Explanation | null>(null);
  const facts: AlertFact[] = useMemo(
    () =>
      alerts.slice(0, 40).map(({ it, s, l }) => ({
        code: it.code,
        name: it.name,
        category: it.category,
        unit: it.unit,
        source: SOURCE_LABEL[s],
        prev: l!.prev!,
        price: l!.price,
        change: Math.round(l!.change! * 10000) / 10000,
        sample: l!.sample,
        history: seriesOf(it, s, obs)
          .slice(-6)
          .map((p) => p.price),
      })),
    [alerts, obs],
  );
  const go = async () => {
    const openQuotes = qs.filter((q) => q.status === "draft" || q.status === "sent").length;
    const activeProjects = projects.filter((p) => p.status === "building").length;
    const p = explainPrompt(facts, threshold, TODAY, { openQuotes, activeProjects });
    const r = await ai.run(async () => (await aiGenerate({ task: "price-alert-explain", system: p.system, messages: [{ role: "user", parts: [{ text: p.prompt }] }], json: EXPLAIN_SCHEMA, maxOutputTokens: 8192, temperature: 0.2 })).json as Explanation);
    if (r) setOut(r);
  };
  const DIR = { up: "ขึ้น", down: "ลง", mixed: "ผันผวน" } as const;
  return (
    <div className="border-b border-line px-5 py-3">
      {!out && !ai.busy && (
        <div className="flex flex-wrap items-center gap-3">
          <AiButton onClick={go} disabled={!facts.length}>
            ให้ AI อธิบาย
          </AiButton>
          <span className="text-[12px] text-ink-3">สรุปแนวโน้มและข้อเสนอแนะจากตัวเลขในรายการนี้เท่านั้น ({facts.length} รายการ)</span>
        </div>
      )}
      {ai.busy && <AiBusy label="AI กำลังสรุปการเปลี่ยนแปลงราคา…" onCancel={ai.cancel} />}
      <AiError text={ai.error} />
      {out && (
        <div className="rounded-[10px] border border-line bg-raised/40 px-4 py-3 text-[13px] leading-[21px] text-ink-2">
          <div className="mb-1 flex items-center gap-2">
            <AiPill />
            <span className="text-[12px] text-ink-3">ร่างโดย AI จากตัวเลขบนหน้านี้ ตรวจสอบก่อนนำไปใช้</span>
            <button type="button" className="ml-auto text-[12px] text-ink-3 hover:text-ink" onClick={() => setOut(null)}>
              ปิด
            </button>
          </div>
          <p className="text-ink">{out.summary}</p>
          {out.trends?.length > 0 && (
            <ul className="mt-2 space-y-1">
              {out.trends.map((t) => (
                <li key={t.category}>
                  <span className="text-ink">{t.category}</span> <span className={cx("text-[12px]", t.direction === "up" ? "text-neg" : t.direction === "down" ? "text-pos" : "text-ink-3")}>{DIR[t.direction] ?? t.direction}</span> — {t.note}
                </li>
              ))}
            </ul>
          )}
          {out.actions?.length > 0 && (
            <>
              <p className="mt-3 text-[12px] text-ink-3">ข้อเสนอแนะ</p>
              <ol className="mt-1 list-decimal space-y-1 pl-5">
                {out.actions.map((a, i) => (
                  <li key={i}>
                    <span className="text-ink">{a.title}</span> {a.detail} {a.who && <span className="text-[12px] text-ink-3">({a.who})</span>}
                  </li>
                ))}
              </ol>
            </>
          )}
          {out.caveat && <p className="mt-2 text-[12px] text-ink-3">{out.caveat}</p>}
        </div>
      )}
    </div>
  );
}

// ---------- sync log ----------

export function SyncLog() {
  const syncs = feedSyncs.use();
  const list = [...syncs].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12);
  if (!list.length) return null;
  const VIA = { api: "API พณ.", file: "ไฟล์ (AI)", cron: "ตามรอบ" } as const;
  return (
    <Card className="px-5 py-4 lg:col-span-3">
      <p className="text-[15px] font-medium">ประวัติการดึง/นำเข้าราคา</p>
      <table className="mt-2 w-full text-[12px]">
        <tbody className="divide-y divide-line">
          {list.map((s) => (
            <tr key={s.id}>
              <td className="py-1.5 pr-3 font-mono text-ink-3">{thStamp(s.at)}</td>
              <td className="py-1.5 pr-3">{VIA[s.via]}</td>
              <td className="py-1.5 pr-3 text-ink-2">{s.via === "file" ? s.file : `${(s.provinces ?? []).join(", ")} · ${s.from ? thMonth(`${s.from}-01`) : ""}–${s.to ? thMonth(`${s.to}-01`) : ""}`}</td>
              <td className="num py-1.5 pr-3 text-right font-mono">
                +{s.added} / ~{s.updated}
              </td>
              <td className="py-1.5 pr-3">
                <Pill tone={s.status === "ok" ? "pos" : s.status === "partial" ? "warn" : "neg"}>{s.status === "ok" ? "สำเร็จ" : s.status === "partial" ? "บางส่วน" : "ไม่สำเร็จ"}</Pill>
              </td>
              <td className="py-1.5 text-ink-3">{s.message ?? s.by}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
