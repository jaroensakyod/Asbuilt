"use client";

// Run the same AI task on Gemini and Claude side by side: answer, time, tokens and cost per call.
// Every call (here and in the app's features) is logged, so the stats below show the real average
// cost per task — the basis for pricing packages.

import { useMemo, useState } from "react";
import { LoaderCircle, Play, Trash2 } from "lucide-react";
import { Card, CardHead, cx, inputCls, PageHeader, Status } from "@/components/ui";
import { aiGenerate, runToolLoop, useAiStatus } from "@/lib/ai/client";
import { buildSystemPrompt } from "@/lib/ai/tools/prompt";
import { useCompanyTools } from "@/lib/ai/tools/use-company-tools";
import { aiUsage, statsByTask } from "@/lib/ai/usage-log";
import type { AiProvider, AiUsage, JsonSchema } from "@/lib/ai/types";
import { getProject, ROLE_LABEL, TODAY } from "@/lib/data";
import { getModel } from "@/lib/house";
import { canView, MODULES, MODULE_KEYS } from "@/lib/permissions";
import { sampleBook } from "@/lib/sales/prices-data";
import { computeTakeoff, summarize } from "@/lib/takeoff/calc";
import { REVIEW_SCHEMA, reviewPrompt, takeoffFlags } from "@/lib/takeoff/checks";
import { catRates } from "@/lib/takeoff/pricing";
import { DEFAULT_SETTINGS } from "@/lib/takeoff/types";
import { useMe } from "@/lib/use-me";

const PROVIDERS: AiProvider[] = ["gemini", "claude"];
const NAME: Record<AiProvider, string> = { gemini: "Google Gemini", claude: "Anthropic Claude" };
const btn = "inline-flex h-9 items-center gap-2 rounded-[8px] border border-line-strong bg-card px-3.5 text-[14px] text-ink transition-colors hover:bg-raised disabled:opacity-50";
const n0 = (n: number) => Math.round(n).toLocaleString("th-TH");
const usd = (n: number) => `$${n < 0.01 ? n.toFixed(5) : n.toFixed(4)}`;
const thb = (n: number) => `฿${n < 1 ? n.toFixed(3) : n.toFixed(2)}`;

type Test = "chat" | "takeoff" | "custom";
const TESTS: { k: Test; label: string; note: string }[] = [
  { k: "chat", label: "แชทถามข้อมูลบริษัท (ใช้เครื่องมือ)", note: "AI เรียกเครื่องมืออ่านข้อมูลโครงการหลายรอบ แล้วตอบเป็นข้อความ — เหมือนปุ่ม 'ถาม AI'" },
  { k: "takeoff", label: "ตรวจงานถอดปริมาณ (JSON)", note: "ส่งสรุปถอดปริมาณของ HC-2026-01 แล้วให้ตอบเป็น JSON — เหมือนปุ่ม 'ให้ AI ตรวจและสรุป'" },
  { k: "custom", label: "คำถามเอง (ข้อความ)", note: "ส่งข้อความเดียว ไม่มีเครื่องมือ" },
];

type Run = { status: "idle" | "running" | "done" | "error"; text?: string; json?: unknown; error?: string; usage: AiUsage[]; steps: string[]; ms?: number };
const IDLE: Run = { status: "idle", usage: [], steps: [] };

const sumUsage = (u: AiUsage[]) =>
  u.reduce(
    (a, x) => ({
      input: a.input + x.input,
      cacheRead: a.cacheRead + (x.cacheRead ?? 0),
      cacheWrite: a.cacheWrite + (x.cacheWrite ?? 0),
      output: a.output + x.output,
      thinking: a.thinking + (x.thinking ?? 0),
      usd: a.usd + x.costUsd,
      thb: a.thb + x.costThb,
    }),
    { input: 0, cacheRead: 0, cacheWrite: 0, output: 0, thinking: 0, usd: 0, thb: 0 },
  );

export function AiCompareView() {
  const status = useAiStatus();
  const me = useMe();
  const tools = useCompanyTools();
  const [test, setTest] = useState<Test>("chat");
  const [question, setQuestion] = useState("โครงการไหนช้ากว่าแผนบ้าง และมีแจ้งซ่อมค้างกี่เรื่อง สรุปสั้น ๆ");
  const [custom, setCustom] = useState("อธิบายขั้นตอนเทพื้นคอนกรีตชั้น 2 ให้โฟร์แมนมือใหม่ เป็นข้อ ๆ ไม่เกิน 8 ข้อ");
  const [runs, setRuns] = useState<Record<AiProvider, Run>>({ gemini: IDLE, claude: IDLE });
  const busy = PROVIDERS.some((p) => runs[p].status === "running");

  const system = useMemo(
    () =>
      buildSystemPrompt({
        company: me.company,
        today: TODAY,
        userName: me.name,
        roleLabel: ROLE_LABEL[me.role],
        visible: MODULE_KEYS.filter((m) => canView(me.role, m)).map((m) => MODULES[m]),
        hidden: MODULE_KEYS.filter((m) => !canView(me.role, m)).map((m) => MODULES[m]),
        demo: !me.live,
      }),
    [me.company, me.name, me.role, me.live],
  );

  const runOne = async (p: AiProvider) => {
    const t0 = Date.now();
    setRuns((r) => ({ ...r, [p]: { status: "running", usage: [], steps: [] } }));
    try {
      if (test === "chat") {
        const steps: string[] = [];
        const r = await runToolLoop({
          task: "compare-chat",
          system,
          messages: [{ role: "user", parts: [{ text: question }] }],
          tools,
          provider: p,
          onStep: (name) => {
            steps.push(name);
            setRuns((x) => ({ ...x, [p]: { ...x[p], steps: [...steps] } }));
          },
        });
        setRuns((x) => ({ ...x, [p]: { status: "done", text: r.text, usage: r.usage, steps, ms: Date.now() - t0 } }));
      } else if (test === "takeoff") {
        const project = getProject("HC-2026-01")!;
        const s = { id: "x", projectId: project.id, ...DEFAULT_SETTINGS };
        const t = computeTakeoff(getModel(project.modelCode), s);
        const summary = summarize(t.items, s, catRates(s, sampleBook(s.bookChoice), t.items));
        const prompt = reviewPrompt({ project: project.id, source: t.source, walls: t.walls, items: t.items, summary, flags: takeoffFlags(t.source, t.walls, t.items, summary) });
        const r = await aiGenerate({ task: "compare-takeoff-review", system: prompt.system, messages: [{ role: "user", parts: [{ text: prompt.prompt }] }], json: REVIEW_SCHEMA as JsonSchema, provider: p, maxOutputTokens: 12000, temperature: 0.2 });
        setRuns((x) => ({ ...x, [p]: { status: "done", json: r.json, usage: r.usage ? [r.usage] : [], steps: [], ms: Date.now() - t0 } }));
      } else {
        const r = await aiGenerate({ task: "compare-custom", messages: [{ role: "user", parts: [{ text: custom }] }], provider: p });
        setRuns((x) => ({ ...x, [p]: { status: "done", text: r.text, usage: r.usage ? [r.usage] : [], steps: [], ms: Date.now() - t0 } }));
      }
    } catch (e) {
      setRuns((x) => ({ ...x, [p]: { ...x[p], status: "error", error: e instanceof Error ? e.message : String(e), ms: Date.now() - t0 } }));
    }
  };

  const runBoth = () => {
    for (const p of PROVIDERS) if (status?.providers?.[p].configured) void runOne(p);
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="เทียบ AI และต้นทุนต่อครั้ง" sub="รันงานเดียวกันบน Gemini และ Claude พร้อมกัน ดูคำตอบ เวลา จำนวน token และค่าใช้จ่ายจริงต่อครั้ง ใช้คิดต้นทุนแพ็กเกจ" />

      <Card>
        <CardHead title="ผู้ให้บริการ" meta={status?.usdThb ? `อัตราแลกเปลี่ยน 1 USD = ${status.usdThb} บาท (AI_USD_THB)` : undefined} />
        <div className="grid gap-3 px-5 py-4 text-[13px] sm:grid-cols-2">
          {PROVIDERS.map((p) => {
            const ps = status?.providers?.[p];
            return (
              <div key={p} className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{NAME[p]}</span>
                {!status ? <span className="text-ink-3">กำลังตรวจสอบ…</span> : ps?.configured ? <Status tone="pos">พร้อม</Status> : <Status tone="warn">ยังไม่ได้ตั้งค่า</Status>}
                <span className="font-mono text-[12px] text-ink-3">
                  {ps?.model}
                  {ps?.effort ? ` · effort ${ps.effort}` : ""}
                </span>
                {status?.provider === p && <span className="rounded-[4px] bg-ink px-1.5 text-[11px] text-page">ใช้ในระบบ</span>}
              </div>
            );
          })}
          {status && !status.providers?.claude.configured && (
            <p className="text-ink-2 sm:col-span-2">
              ใส่ <span className="font-mono">ANTHROPIC_API_KEY</span> ในไฟล์ <span className="font-mono">.env.local</span> แล้วรีสตาร์ต <span className="font-mono">npm run dev</span> เพื่อเปิดฝั่ง Claude
            </p>
          )}
        </div>
      </Card>

      <Card>
        <CardHead title="ชุดทดสอบ" />
        <div className="flex flex-col gap-3 px-5 py-4 text-[13px]">
          <div className="flex flex-wrap gap-2">
            {TESTS.map((t) => (
              <button key={t.k} type="button" onClick={() => setTest(t.k)} className={cx("rounded-[8px] border px-3 py-1.5", test === t.k ? "border-ink bg-ink text-page" : "border-line-strong bg-card hover:bg-raised")}>
                {t.label}
              </button>
            ))}
          </div>
          <p className="text-ink-3">{TESTS.find((t) => t.k === test)!.note}</p>
          {test === "chat" && <input className={inputCls} value={question} onChange={(e) => setQuestion(e.target.value)} aria-label="คำถาม" />}
          {test === "custom" && <textarea className={cx(inputCls, "h-24 py-2")} value={custom} onChange={(e) => setCustom(e.target.value)} aria-label="ข้อความ" />}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={cx(btn, "border-ink bg-ink text-page hover:bg-ink/90")} onClick={runBoth} disabled={busy || !status}>
              {busy ? <LoaderCircle size={16} strokeWidth={1.5} className="animate-spin" /> : <Play size={16} strokeWidth={1.5} />} รันทั้งสองเจ้า
            </button>
            {PROVIDERS.map((p) => (
              <button key={p} type="button" className={btn} onClick={() => void runOne(p)} disabled={busy || !status?.providers?.[p].configured}>
                รันเฉพาะ {NAME[p]}
              </button>
            ))}
            <span className="text-[12px] text-ink-3">แต่ละครั้งเสียค่า API จริง</span>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {PROVIDERS.map((p) => (
          <RunCard key={p} provider={p} run={runs[p]} />
        ))}
      </div>

      <Stats />
    </div>
  );
}

function RunCard({ provider, run }: { provider: AiProvider; run: Run }) {
  const s = sumUsage(run.usage);
  const model = run.usage[run.usage.length - 1]?.model;
  return (
    <Card>
      <CardHead title={NAME[provider]} meta={model} />
      <div className="flex flex-col gap-3 px-5 py-4 text-[13px]">
        {run.status === "idle" && <p className="text-ink-3">ยังไม่ได้รัน</p>}
        {run.status === "running" && (
          <p className="flex items-center gap-2 text-ink-2">
            <LoaderCircle size={14} strokeWidth={1.5} className="animate-spin" /> กำลังรัน{run.steps.length ? ` · เรียกเครื่องมือ ${run.steps.join(", ")}` : ""}
          </p>
        )}
        {run.status === "error" && <p className="rounded-[8px] bg-accent-soft px-3 py-2 text-accent-text">{run.error}</p>}
        {run.usage.length > 0 && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-[10px] bg-raised/60 px-3 py-2.5 font-mono text-[12px] sm:grid-cols-3">
            <Kv k="เวลา" v={`${((run.ms ?? 0) / 1000).toFixed(1)} วิ`} />
            <Kv k="รอบที่เรียก" v={String(run.usage.length)} />
            <Kv k="input" v={n0(s.input)} />
            <Kv k="cache อ่าน/เขียน" v={`${n0(s.cacheRead)} / ${n0(s.cacheWrite)}`} />
            <Kv k="output" v={n0(s.output)} />
            <Kv k="ในนั้นเป็น thinking" v={n0(s.thinking)} />
            <Kv k="ค่าใช้จ่าย" v={`${usd(s.usd)} · ${thb(s.thb)}`} strong />
            <Kv k="ต่อ 1,000 ครั้ง" v={`฿${n0(s.thb * 1000)}`} strong />
            {run.usage.some((u) => !u.priced) && <p className="col-span-full font-sans text-accent-text">ไม่พบราคาของโมเดลนี้ในตาราง ค่าใช้จ่ายจึงเป็น 0 (เพิ่มใน AI_PRICES)</p>}
            {run.usage.some((u) => u.note) && <p className="col-span-full font-sans text-ink-3">{run.usage.find((u) => u.note)?.note}</p>}
          </div>
        )}
        {run.steps.length > 0 && run.status === "done" && <p className="text-[12px] text-ink-3">เครื่องมือที่ใช้: {run.steps.join(", ")}</p>}
        {run.text && <div className="max-h-[420px] overflow-auto whitespace-pre-wrap leading-relaxed text-ink">{run.text}</div>}
        {run.json != null && <JsonAnswer v={run.json} />}
      </div>
    </Card>
  );
}

function Kv({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <p className="flex flex-col">
      <span className="font-sans text-[11px] text-ink-3">{k}</span>
      <span className={cx("num", strong && "font-medium text-ink")}>{v}</span>
    </p>
  );
}

function JsonAnswer({ v }: { v: unknown }) {
  const r = v as { summary?: string; issues?: { severity: string; title: string; detail: string; suggestion?: string }[] };
  if (!r?.issues) return <pre className="max-h-[420px] overflow-auto text-[12px]">{JSON.stringify(v, null, 2)}</pre>;
  return (
    <div className="flex max-h-[420px] flex-col gap-2 overflow-auto">
      <p className="leading-relaxed text-ink-2">{r.summary}</p>
      {r.issues.map((x, i) => (
        <div key={i} className="rounded-[8px] border border-line px-2.5 py-2">
          <p className="text-ink">
            <span className="mr-1.5 font-mono text-[11px] text-ink-3">[{x.severity}]</span>
            {x.title}
          </p>
          <p className="text-[12px] text-ink-2">{x.detail}</p>
          {x.suggestion && <p className="text-[12px] text-ink-3">ควรทำ: {x.suggestion}</p>}
        </div>
      ))}
    </div>
  );
}

// ---------- stats + package calculator ----------

const TASK_LABEL: Record<string, string> = {
  chat: "แชทถาม AI",
  "compare-chat": "ทดสอบ: แชท + เครื่องมือ",
  "compare-takeoff-review": "ทดสอบ: ตรวจถอดปริมาณ",
  "compare-custom": "ทดสอบ: คำถามเอง",
  "takeoff-review": "ตรวจถอดปริมาณ",
};

function Stats() {
  const rows = aiUsage.use();
  const stats = useMemo(() => statsByTask(rows), [rows]);
  const tasks = [...new Set(stats.map((s) => s.task))];
  const [perMonth, setPerMonth] = useState<Record<string, number>>({});
  const [margin, setMargin] = useState(40);
  const monthly = (p: AiProvider) => tasks.reduce((a, t) => a + (stats.find((s) => s.task === t && s.provider === p)?.avgThb ?? 0) * (perMonth[t] ?? 0), 0);

  return (
    <>
      <Card>
        <CardHead
          title="ค่าใช้จ่ายเฉลี่ยต่อครั้ง (1 ครั้ง = 1 คำถาม/1 งาน แม้ AI เรียกหลายรอบ)"
          meta={`${rows.length.toLocaleString("th-TH")} ครั้ง`}
          action={
            rows.length > 0 ? (
              <button
                type="button"
                className="flex items-center gap-1 text-[12px] text-ink-3 hover:text-ink"
                onClick={() => {
                  if (window.confirm("ล้างประวัติการใช้ AI ทั้งหมด?")) for (const r of rows) aiUsage.remove(r.id);
                }}
              >
                <Trash2 size={13} strokeWidth={1.5} /> ล้างประวัติ
              </button>
            ) : undefined
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-[13px]">
            <thead className="text-left text-[12px] text-ink-3">
              <tr className="border-b border-line">
                <th className="px-5 py-2 font-normal">งาน</th>
                <th className="px-2 py-2 font-normal">ผู้ให้บริการ / โมเดล</th>
                <th className="px-2 py-2 text-right font-normal">ครั้ง (เรียก API)</th>
                <th className="px-2 py-2 text-right font-normal">input เฉลี่ย</th>
                <th className="px-2 py-2 text-right font-normal">output เฉลี่ย</th>
                <th className="px-2 py-2 text-right font-normal">เวลาเฉลี่ย</th>
                <th className="px-2 py-2 text-right font-normal">ต่อครั้ง</th>
                <th className="px-5 py-2 text-right font-normal">รวม</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={`${s.task}${s.provider}${s.model}`} className="border-b border-line">
                  <td className="px-5 py-1.5">{TASK_LABEL[s.task] ?? s.task}</td>
                  <td className="px-2 py-1.5 font-mono text-[12px]">{s.model}</td>
                  <td className="px-2 py-1.5 text-right font-mono">
                    {s.calls} <span className="text-[11px] text-ink-3">({s.apiCalls})</span>
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono">{n0((s.input + s.cacheRead) / s.calls)}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{n0(s.output / s.calls)}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{(s.avgMs / 1000).toFixed(1)} วิ</td>
                  <td className="px-2 py-1.5 text-right font-mono">
                    {thb(s.avgThb)} <span className="text-[11px] text-ink-3">{usd(s.avgUsd)}</span>
                  </td>
                  <td className="px-5 py-1.5 text-right font-mono">{thb(s.costThb)}</td>
                </tr>
              ))}
              {!stats.length && (
                <tr>
                  <td colSpan={8} className="px-5 py-6 text-center text-ink-3">
                    ยังไม่มีข้อมูล รันทดสอบด้านบน หรือใช้ฟีเจอร์ AI ในระบบ ทุกครั้งจะถูกบันทึกที่นี่
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {tasks.length > 0 && (
        <Card>
          <CardHead title="คำนวณต้นทุน AI ต่อบริษัทต่อเดือน" meta="ใช้ค่าเฉลี่ยต่อครั้งด้านบน" />
          <div className="flex flex-col gap-3 px-5 py-4 text-[13px]">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {tasks.map((t) => (
                <label key={t} className="flex items-center justify-between gap-2 rounded-[8px] border border-line px-3 py-2">
                  <span className="text-ink-2">{TASK_LABEL[t] ?? t}</span>
                  <span className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      className={cx(inputCls, "h-8 w-24 text-right font-mono text-[13px]")}
                      value={perMonth[t] ?? 0}
                      onChange={(e) => setPerMonth((m) => ({ ...m, [t]: Math.max(0, Number(e.target.value) || 0) }))}
                    />
                    <span className="text-[12px] text-ink-3">ครั้ง/เดือน</span>
                  </span>
                </label>
              ))}
            </div>
            <label className="flex items-center gap-2 text-ink-2">
              เผื่อกำไร/ความเสี่ยงบนค่า AI
              <input type="number" min={0} className={cx(inputCls, "h-8 w-20 text-right font-mono text-[13px]")} value={margin} onChange={(e) => setMargin(Math.max(0, Number(e.target.value) || 0))} />%
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              {PROVIDERS.map((p) => {
                const cost = monthly(p);
                const missing = tasks.filter((t) => (perMonth[t] ?? 0) > 0 && !stats.some((s) => s.task === t && s.provider === p));
                return (
                  <div key={p} className="rounded-[10px] bg-raised/60 px-4 py-3">
                    <p className="font-medium">{NAME[p]}</p>
                    <p className="num mt-1 font-mono text-[20px]">฿{n0(cost)}</p>
                    <p className="text-[12px] text-ink-3">ต้นทุน AI ต่อบริษัทต่อเดือน</p>
                    <p className="num mt-1 font-mono">ควรคิดในแพ็กเกจ ≈ ฿{n0(cost * (1 + margin / 100))} / เดือน</p>
                    {missing.length > 0 && <p className="mt-1 text-[12px] text-accent-text">ยังไม่มีข้อมูลของงาน: {missing.map((t) => TASK_LABEL[t] ?? t).join(", ")}</p>}
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] leading-relaxed text-ink-3">
              ค่าเฉลี่ยมาจากครั้งที่บันทึกไว้ในเบราว์เซอร์นี้/บริษัทนี้ ยิ่งรันหลายครั้งยิ่งแม่น ราคาต่อ token ตามตารางใน lib/ai/pricing.ts (Gemini Flash ขึ้นราคาเป็น 2 เท่าตั้งแต่ 1 ม.ค. 2027) ยังไม่รวม VAT และค่าเซิร์ฟเวอร์อื่น
            </p>
          </div>
        </Card>
      )}
    </>
  );
}
