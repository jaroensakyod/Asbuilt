"use client";

// ค่า K settings → "ดัชนีราคารายเดือน" tab: fill the monthly index table from official sources.
//   1. ดึงดัชนีจาก พณ.   — MOC CMI API (csi-indexes) through /api/prices/moc/index, symbol → group map
//   2. อ่านไฟล์ประกาศ (AI) — the monthly สนค. index announcement (PDF/photo) read by AI
// Both show a preview of the changed cells; nothing is applied until the user confirms, and the
// settings modal still needs "บันทึก".

import { useRef, useState } from "react";
import { AlertTriangle, CloudDownload, FileUp } from "lucide-react";
import { cx, inputCls } from "@/components/ui";
import { Btn, Modal, Segmented } from "@/components/ops/bits";
import { aiGenerate } from "@/lib/ai/client";
import { TODAY } from "@/lib/data";
import { CMI_GROUPS, type MocIndexPoint } from "@/lib/price-feeds/moc";
import { cmiToIndices, DEFAULT_K_MAP, extractedToIndices, indexPrompt, INDEX_SCHEMA, mergeIndices, type ExtractedIndices, type Indices } from "@/lib/price-feeds/kindex";
import { INDEX_LABEL, type TenderSettings } from "@/lib/tender/types";
import { useMe } from "@/lib/use-me";
import { AiBusy, AiButton, AiError, AiPill, docToAi, I, MAX_DOC_BYTES, useAiRun } from "@/components/sales/price-ai-bits";

type Apply = (patch: Pick<TenderSettings, "indices" | "kIndexMap" | "indexLog">) => void;

export function IndexImportButtons({ settings, onApply }: { settings: TenderSettings; onApply: Apply }) {
  const [mode, setMode] = useState<"api" | "file" | null>(null);
  return (
    <>
      <Btn small onClick={() => setMode("api")}>
        <CloudDownload {...I} />
        ดึงดัชนีจาก พณ.
      </Btn>
      <Btn small onClick={() => setMode("file")}>
        <FileUp {...I} />
        อ่านไฟล์ประกาศดัชนี
      </Btn>
      {mode && <IndexImportModal initial={mode} settings={settings} onApply={onApply} onClose={() => setMode(null)} />}
    </>
  );
}

function IndexImportModal({ initial, settings, onApply, onClose }: { initial: "api" | "file"; settings: TenderSettings; onApply: Apply; onClose: () => void }) {
  const me = useMe();
  const [mode, setMode] = useState(initial);
  const syms = [...new Set([...Object.keys(INDEX_LABEL), ...settings.kFormulas.flatMap((f) => f.terms.map((t) => t.sym))])];
  const [map, setMap] = useState<Record<string, string>>({ ...DEFAULT_K_MAP, ...(settings.kIndexMap ?? {}) });
  const year = Number(TODAY.slice(0, 4));
  const [fromY, setFromY] = useState(year - 1);
  const [toY, setToY] = useState(year);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [points, setPoints] = useState<MocIndexPoint[] | null>(null);
  const [incoming, setIncoming] = useState<Indices | null>(null);
  const [file, setFile] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const ai = useAiRun();
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchApi = async () => {
    const ids = [...new Set(Object.values(map).filter(Boolean))];
    if (!ids.length) return setErr("เลือกหมวดดัชนีของ พณ. ให้สัญลักษณ์อย่างน้อย 1 ตัว");
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/prices/moc/index?ids=${ids.join(",")}&from=${fromY}&to=${toY}`);
      const body = (await res.json().catch(() => ({}))) as { points?: MocIndexPoint[]; error?: string; errors?: { error: string }[] };
      if (!res.ok || !body.points) throw new Error(body.error ?? `HTTP ${res.status}`);
      setPoints(body.points);
      setIncoming(cmiToIndices(body.points, map));
      if (body.errors?.length) setErr(`บางหมวดดึงไม่สำเร็จ: ${body.errors[0].error}`);
    } catch (e) {
      setErr(`${e instanceof Error ? e.message : String(e)} — ใช้ “อ่านไฟล์ประกาศดัชนี” แทนได้ (ดาวน์โหลด PDF ดัชนีราคาค่า K จากเว็บไซต์ สนค. www.tpso.go.th)`);
    } finally {
      setBusy(false);
    }
  };

  const readFile = async (f: File) => {
    if (f.size > MAX_DOC_BYTES) return ai.setError("ไฟล์ใหญ่เกิน 8 MB ให้ตัดเฉพาะหน้าตารางดัชนี");
    setFile(f.name);
    const out = await ai.run(async () => {
      const part = await docToAi(f);
      const p = indexPrompt(Object.fromEntries(syms.map((s) => [s, INDEX_LABEL[s] ?? s])), TODAY);
      const r = await aiGenerate({ task: "k-index-read", system: p.system, messages: [{ role: "user", parts: [{ file: part }, { text: p.prompt }] }], json: INDEX_SCHEMA, maxOutputTokens: 8192, temperature: 0 });
      return r.json as ExtractedIndices;
    });
    if (out) {
      setTitle([out.title, out.baseYear && `ปีฐาน ${out.baseYear}`].filter(Boolean).join(" · "));
      setIncoming(extractedToIndices(out, syms));
    }
  };

  const merged = incoming ? mergeIndices(settings.indices, incoming) : null;
  const apply = () => {
    if (!merged) return;
    const months = [...new Set(merged.changes.map((c) => c.month))];
    const entry = { at: new Date().toISOString(), via: mode === "api" ? ("moc-api" as const) : ("file" as const), file: mode === "file" ? file : undefined, cells: merged.changes.length, months, by: me.name };
    onApply({ indices: merged.indices, kIndexMap: map, indexLog: [entry, ...(settings.indexLog ?? [])].slice(0, 24) });
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      width={860}
      title="นำเข้าดัชนีราคาทางการสำหรับค่า K"
      footer={
        <>
          <span className="mr-auto text-[12px] text-ink-3">{merged ? `เปลี่ยน ${merged.changes.length} ช่อง · กดบันทึกในหน้าตั้งค่าอีกครั้งเพื่อเก็บถาวร` : "ยังไม่มีข้อมูล"}</span>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!merged?.changes.length} onClick={apply}>
            ใช้ค่าเหล่านี้
          </Btn>
        </>
      }
    >
      <div className="mb-4">
        <Segmented
          value={mode}
          onChange={(m) => {
            setMode(m);
            setIncoming(null);
            setErr(null);
          }}
          options={[
            { key: "api", label: "ดึงจาก API กระทรวงพาณิชย์" },
            { key: "file", label: "อ่านไฟล์ประกาศ (AI)" },
          ]}
        />
      </div>

      {mode === "api" && (
        <div className="space-y-3">
          <p className="text-[13px] text-ink-2">
            API ของ สนค. ให้ <span className="text-ink">ดัชนีราคาวัสดุก่อสร้าง (CMI) รายหมวด</span> ใช้แทนดัชนีในสูตรค่า K ได้เฉพาะสัญลักษณ์ที่ความหมายตรงกัน (ซีเมนต์ เหล็ก) ดัชนีผู้บริโภค เครื่องจักร น้ำมัน แอสฟัลต์ ท่อ ให้นำเข้าจากไฟล์ประกาศ
          </p>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {syms.map((s) => (
              <label key={s} className="flex items-center gap-2 text-[13px]">
                <span className="w-5 font-mono">{s}</span>
                <select aria-label={`หมวดดัชนีของ ${s}`} className={cx(inputCls, "h-8 flex-1 text-[12px]")} value={map[s] ?? ""} onChange={(e) => setMap({ ...map, [s]: e.target.value })}>
                  <option value="">ไม่ใช้</option>
                  {CMI_GROUPS.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            ปี ค.ศ.
            <input aria-label="ปีเริ่ม" className={cx(inputCls, "h-8 w-20 font-mono")} value={fromY} onChange={(e) => setFromY(Number(e.target.value) || year)} />
            ถึง
            <input aria-label="ปีสิ้นสุด" className={cx(inputCls, "h-8 w-20 font-mono")} value={toY} onChange={(e) => setToY(Number(e.target.value) || year)} />
            <Btn small primary disabled={busy} onClick={fetchApi}>
              <CloudDownload {...I} />
              {busy ? "กำลังดึง (อาจใช้เวลาถึง 1 นาที)…" : "ดึงข้อมูล"}
            </Btn>
          </div>
          {points && <p className="text-[12px] text-ink-3">ได้ {points.length} ค่าจาก {new Set(points.map((p) => p.indexId)).size} หมวด · ปีฐาน {[...new Set(points.map((p) => p.baseYear).filter(Boolean))].join(", ") || "–"}</p>}
        </div>
      )}

      {mode === "file" && (
        <div className="space-y-3">
          <p className="text-[13px] text-ink-2">อัปโหลด PDF หรือรูปถ่ายตาราง “ดัชนีราคาที่ใช้คำนวณค่า K” ของสำนักงานนโยบายและยุทธศาสตร์การค้า AI จะอ่านค่าดัชนีรายเดือนให้ ตรวจตัวเลขกับต้นฉบับก่อนใช้</p>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void readFile(f);
              e.target.value = "";
            }}
          />
          <div className="flex items-center gap-2">
            <AiButton busy={ai.busy} onClick={() => fileRef.current?.click()}>
              ให้ AI อ่านไฟล์ดัชนี
            </AiButton>
            {file && <span className="text-[12px] text-ink-3">{file}</span>}
            {title && <span className="text-[12px] text-ink-2">{title}</span>}
          </div>
          {ai.busy && <AiBusy label="AI กำลังอ่านตารางดัชนี (5–20 วินาที)…" onCancel={ai.cancel} />}
          <AiError text={ai.error} />
        </div>
      )}

      {err && <p className="mt-3 text-[13px] text-warn">{err}</p>}

      {merged && (
        <div className="mt-4">
          {merged.suspect.length > 0 && (
            <p className="mb-2 flex items-start gap-2 rounded-[10px] border border-warn/40 bg-warn-soft/40 px-3 py-2 text-[12px] text-ink-2">
              <AlertTriangle {...I} className="mt-0.5 shrink-0 text-warn" />
              ค่าใหม่ของ {merged.suspect.join(", ")} ต่างจากค่าเดิมเกิน 25% อาจเป็นดัชนีคนละปีฐาน ค่า K ต้องใช้ดัชนีชุดเดียวกันทั้งเดือนเปิดซองและเดือนส่งงาน ควรแทนที่ทุกเดือนด้วยชุดเดียวกัน
            </p>
          )}
          {merged.changes.length ? (
            <div className="max-h-[300px] overflow-auto rounded-[10px] border border-line">
              <table className="w-full text-[12px]">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b border-line text-left text-ink-3">
                    <th className="px-3 py-2 font-normal">เดือน</th>
                    <th className="px-3 py-2 font-normal">ดัชนี</th>
                    <th className="px-3 py-2 text-right font-normal">ค่าเดิม</th>
                    <th className="px-3 py-2 text-right font-normal">ค่าใหม่</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {merged.changes.map((c) => (
                    <tr key={`${c.month}-${c.sym}`}>
                      <td className="px-3 py-1.5 font-mono">{c.month}</td>
                      <td className="px-3 py-1.5">
                        <span className="font-mono">{c.sym}</span> <span className="text-ink-3">{INDEX_LABEL[c.sym] ?? ""}</span>
                      </td>
                      <td className="num px-3 py-1.5 text-right font-mono text-ink-3">{c.old ?? "–"}</td>
                      <td className="num px-3 py-1.5 text-right font-mono text-ink">
                        {c.value} {mode === "file" && <AiPill className="ml-1" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-[13px] text-ink-3">ค่าที่ได้ตรงกับตารางเดิมทั้งหมด</p>
          )}
        </div>
      )}
    </Modal>
  );
}
