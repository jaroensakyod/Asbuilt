// Benchmark: the same real app prompts on Gemini and Claude, scored against known answers,
// with tokens and cost per call. Uses the app's own provider code (src/lib/ai/providers/*).
//
//   npm run ai:bench            (2 rounds per task per model)
//   npm run ai:bench -- 3       (3 rounds)
//   GEMINI_MODEL=gemini-4-argon npm run ai:bench -- --only gemini --tag argon
//
// Reads .env.local (ANTHROPIC_API_KEY, CLAUDE_MODEL, CLAUDE_EFFORT, GEMINI_MODEL, AI_USD_THB);
// GEMINI_API_KEY may also come from the system environment. Every run costs real API money.

import * as nodeModule from "node:module";
import fs from "node:fs";

// relative imports in src/lib have no ".ts" extension (the Next.js bundler resolves them; plain Node does not)
type Next = (s: string, c?: unknown) => unknown;
(nodeModule as unknown as { registerHooks: (h: { resolve: (s: string, c: unknown, n: Next) => unknown }) => void }).registerHooks({
  resolve(s, c, next) {
    // "server-only" is provided by Next.js at build time; outside Next it is just a marker
    if (s === "server-only") return { url: "data:text/javascript,export{}", shortCircuit: true };
    try {
      return next(s, c);
    } catch (e) {
      if (s.startsWith(".") && !/\.[cm]?[jt]s$/.test(s)) return next(s + ".ts", c);
      throw e;
    }
  },
});
for (const f of [".env.local", ".env"]) if (fs.existsSync(f)) process.loadEnvFile(f);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lib = (p: string): Promise<any> => import(new URL(`../src/lib/${p}.ts`, import.meta.url).href);
const { generate, aiStatus } = await lib("ai/server");
const { DIARY_SCHEMA, diaryPrompt } = await lib("ai-field/diary");
const { SYSTEM_ESTIMATOR, BOQ_SCHEMA, estimatePrompt } = await lib("ai-sales/estimate");
const { SEED_PRICE_ITEMS, sampleBook } = await lib("sales/prices-data");
const { projects, repairs, TODAY } = await lib("data");
const house = await lib("house");
const { computeTakeoff, summarize } = await lib("takeoff/calc");
const { catRates } = await lib("takeoff/pricing");
const { REVIEW_SCHEMA, reviewPrompt, takeoffFlags } = await lib("takeoff/checks");
const { DEFAULT_SETTINGS } = await lib("takeoff/types");

type Provider = "gemini" | "claude";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
type Check = { name: string; ok: boolean; got?: string };
type Result = { task: string; provider: Provider; round: number; ok: boolean; error?: string; model?: string; ms: number; calls: number; input: number; cacheRead: number; cacheWrite: number; output: number; thinking: number; usd: number; thb: number; checks: Check[]; answer: string };

const arg = (name: string) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined);
const ROUNDS = Number(arg("--rounds") ?? (/^d+$/.test(process.argv[2] ?? "") ? process.argv[2] : "")) || 2;
/** --only gemini|claude runs one provider; --tag name adds a suffix to the report files */
const ONLY = arg("--only");
const TAG = arg("--tag");
const st = aiStatus();
const providers = (["gemini", "claude"] as Provider[]).filter((p) => st.providers[p].configured && (!ONLY || p === ONLY));
if (!providers.length) throw new Error("ไม่พบ key ของ Gemini หรือ Claude");

const COST_CODES = { "01": "งานเตรียมการ/ใบอนุญาต", "02": "งานฐานราก", "03": "งานโครงสร้าง", "04": "งานก่ออิฐ/ฉาบ", "05": "งานหลังคา", "06": "งานระบบไฟฟ้า", "07": "งานระบบประปา/สุขาภิบาล", "08": "งานระบบปรับอากาศ", "09": "งานประตู/หน้าต่าง", "10": "งานพื้น/ผนัง/ฝ้า (ตกแต่ง)", "11": "งานสี", "12": "สุขภัณฑ์/อุปกรณ์", "13": "งานภายนอก/รั้ว/ถนน" };
const near = (v: unknown, lo: number, hi: number) => typeof v === "number" && v >= lo && v <= hi;
const text = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v ?? ""));

// ---------- task 1: site diary from dictation (field app) ----------
const DIARY_TEXT =
  "วันนี้เช้าแดดดี บ่ายฝนตกประมาณสองชั่วโมง ช่างปูนบริษัทเราห้าคน กรรมกรสามคน ทีมช่างเอกการไฟฟ้าเข้ามาเดินท่อร้อยสายชั้นสองสองคน " +
  "เทพื้นชั้นสองไปได้เจ็ดสิบเปอร์เซ็นต์ ก่ออิฐผนังชั้นหนึ่งคืบหน้าเป็นแปดสิบเปอร์เซ็นต์ ปูนซีเมนต์เข้ายี่สิบถุง เหล็กเส้นสิบสองมิลห้าสิบเส้น " +
  "ปัญหาคือรถคอนกรีตมาช้าหนึ่งชั่วโมง ตอนบ่ายมีเจ้าหน้าที่เขตมาตรวจงาน ทุกคนใส่หมวกนิรภัยครบ";
const DIARY_TASKS = [
  { id: "T10", code: "1.10", name: "เทพื้นชั้น 2", pct: 40, crew: "ทีมบริษัท" },
  { id: "T20", code: "1.20", name: "ก่ออิฐผนังชั้น 1", pct: 60, crew: "ทีมบริษัท" },
  { id: "T30", code: "1.30", name: "ฉาบผนังชั้น 1", pct: 0 },
  { id: "T50", code: "2.05", name: "เดินท่อร้อยสายไฟชั้น 2", pct: 10, crew: "ช่างเอกการไฟฟ้า" },
];
const DIARY_SUBS = [
  { name: "ช่างเอกการไฟฟ้า", trades: ["ไฟฟ้า"] },
  { name: "ทีมสมชายประปา", trades: ["ประปา"] },
];
function checkDiary(j: Any): Check[] {
  const mp = (j?.manpower ?? []) as Any[];
  const work = (j?.work ?? []) as Any[];
  const has = (re: RegExp, n: number) => mp.some((m) => re.test(`${m.trade} ${m.group ?? ""}`) && m.count === n);
  return [
    { name: "อากาศเช้า sunny", ok: j?.weatherAm === "sunny", got: j?.weatherAm },
    { name: "อากาศบ่าย rain", ok: j?.weatherPm === "rain", got: j?.weatherPm },
    { name: "ฝนตก 2 ชม.", ok: j?.rainHours === 2, got: String(j?.rainHours) },
    { name: "ช่างปูน 5 คน", ok: has(/ปูน/, 5) },
    { name: "กรรมกร 3 คน", ok: has(/กรรมกร|แรงงาน/, 3) },
    { name: "ช่างเอกการไฟฟ้า 2 คน (ชื่อตรง)", ok: mp.some((m) => m.group === "ช่างเอกการไฟฟ้า" && m.count === 2) },
    { name: "เทพื้นชั้น 2 → T10 70%", ok: work.some((w) => w.taskId === "T10" && w.pct === 70) },
    { name: "ก่ออิฐชั้น 1 → T20 80%", ok: work.some((w) => w.taskId === "T20" && w.pct === 80) },
    { name: "วัสดุเข้า: ปูน 20 + เหล็ก 50", ok: /20/.test(text(j?.deliveries)) && /50/.test(text(j?.deliveries)) },
    { name: "ปัญหา: คอนกรีตมาช้า", ok: /ช้า/.test(text(j?.issues)) },
    { name: "ผู้มาเยี่ยม: เจ้าหน้าที่เขต", ok: /เขต/.test(text(j?.visitors)) },
    { name: "ไม่แต่งงานที่ไม่ได้พูดถึง (ฉาบ T30)", ok: !work.some((w) => w.taskId === "T30") },
  ];
}

// ---------- task 2: BOQ from a scope description (estimating) ----------
const SCOPE =
  "ต่อเติมห้องครัวหลังบ้าน ขนาด 3×4 ม. พื้น คสล. หนา 10 ซม. ผนังก่ออิฐมวลเบา 7.5 ซม. สูง 2.8 ม. สามด้าน (ด้านยาว 4 ม. หนึ่งด้านติดตัวบ้านเดิม ไม่ต้องก่อ) " +
  "ฉาบสองด้าน ทาสีภายในและภายนอก ปูกระเบื้องพื้นแกรนิตโต้ 60×60 มีหน้าต่างบานเลื่อนอะลูมิเนียม 1.2×1.0 ม. 1 ชุด ประตูไม้ 1 ชุด " +
  "เดินไฟ ดาวน์ไลท์ 4 จุด ปลั๊ก 3 จุด และติดซิงค์ล้างจาน 1 ชุด";
const BOOK = SEED_PRICE_ITEMS.map((i: Any) => ({ code: i.code, name: i.name, unit: i.unit, costCode: i.costCode, category: i.category }));
const CODES = new Set(BOOK.map((b: Any) => b.code));
function checkBoq(j: Any): Check[] {
  const lines = (j?.lines ?? []) as Any[];
  const q = (code: string) => lines.filter((l) => l.itemCode === code).reduce((a, l) => a + (Number(l.qty) || 0), 0);
  // walls: 3 + 4 + 3 = 10 m × 2.8 = 28 m² − window 1.2 − door ~1.8–2.0 ≈ 24–26 m² → ~200–220 blocks (+ waste)
  return [
    { name: "ใช้เฉพาะรหัสในฐานราคา", ok: lines.every((l) => !l.itemCode || CODES.has(l.itemCode)), got: lines.filter((l) => l.itemCode && !CODES.has(l.itemCode)).map((l) => l.itemCode).join(",") },
    (() => {
      // the slab line (named พื้น) when the model splits concrete by element, else all concrete
      const cn = lines.filter((l) => /^CN-/.test(l.itemCode ?? ""));
      const slab = cn.filter((l) => /พื้น/.test(l.name ?? ""));
      const v = (slab.length ? slab : cn).reduce((a, l) => a + (Number(l.qty) || 0), 0);
      return { name: "คอนกรีตพื้น 1.2–1.5 ลบ.ม.", ok: near(v, 1.15, 1.6), got: String(Math.round(v * 100) / 100) };
    })(),
    {
      // an extension needs its own foundation and frame, not just a slab
      name: "มีโครงสร้างรองรับ (ฐานราก/เสา/คาน + เหล็กเสริม)",
      ok: lines.some((l) => /ฐานราก|เข็ม|คาน|เสา/.test(l.name ?? "") && /^(CN|FD)-/.test(l.itemCode ?? "")) && lines.some((l) => /^ST-(DB|RB)/.test(l.itemCode ?? "")),
    },
    { name: "ปูนก่ออิฐพอ (≥ 2 ถุง)", ok: q("MS-MORTAR") >= 2, got: String(q("MS-MORTAR")) },
    { name: "อิฐมวลเบา 170–260 ก้อน", ok: near(q("MS-AAC75"), 170, 260), got: String(q("MS-AAC75")) },
    { name: "แกรนิตโต้ 12–13.5 ตร.ม.", ok: near(q("FN-GRANITO"), 12, 13.5), got: String(q("FN-GRANITO")) },
    { name: "หน้าต่าง 1.2 ตร.ม.", ok: near(q("DW-WIN"), 1.15, 1.35), got: String(q("DW-WIN")) },
    { name: "ประตู 1 ชุด", ok: q("DW-DOOR") === 1, got: String(q("DW-DOOR")) },
    { name: "ดาวน์ไลท์ 4", ok: q("EL-DL") === 4, got: String(q("EL-DL")) },
    { name: "ปลั๊ก 3", ok: q("EL-SOCKET") === 3, got: String(q("EL-SOCKET")) },
    { name: "ซิงค์ 1", ok: q("SN-SINK") === 1, got: String(q("SN-SINK")) },
    { name: "มีปูนฉาบ + สีภายใน/ภายนอก", ok: q("MS-PLASTER") > 0 && q("PT-INT") > 0 && q("PT-EXT") > 0 },
  ];
}

// ---------- task 3: takeoff review (JSON) ----------
const tp = projects.find((p: Any) => p.id === "HC-2026-01");
const ts = { id: "x", projectId: tp.id, ...DEFAULT_SETTINGS };
const tk = computeTakeoff(house.getModel(tp.modelCode), ts);
const tsum = summarize(tk.items, ts, catRates(ts, sampleBook(ts.bookChoice), tk.items));
const REVIEW = reviewPrompt({ project: tp.id, source: tk.source, walls: tk.walls, items: tk.items, summary: tsum, flags: takeoffFlags(tk.source, tk.walls, tk.items, tsum) });
const KNOWN = new Set([...tk.items.map((x: Any) => x.code), ...tk.walls.map((w: Any) => w.id), "อ", "ฉ", "ส", "สอ", "ซ", "พ", "ผ"]);
function checkReview(j: Any): Check[] {
  const issues = (j?.issues ?? []) as Any[];
  const all = issues.map((i) => `${i.title} ${i.detail}`).join(" ");
  return [
    { name: "มีสรุปและไม่เกิน 8 ข้อ", ok: Boolean(j?.summary) && issues.length <= 8, got: String(issues.length) },
    { name: "รหัสที่อ้างมีจริงทั้งหมด", ok: issues.every((i) => (i.codes ?? []).every((c: string) => KNOWN.has(c))), got: issues.flatMap((i) => i.codes ?? []).filter((c: string) => !KNOWN.has(c)).join(",") },
    { name: "ไม่ตีความ partial ว่าราคาไม่ครบ", ok: !/partial[^]{0,40}(ไม่ครบ|ไม่สมบูรณ์|ยังไม่รวม)|(ไม่ครบ|ไม่สมบูรณ์)[^]{0,40}partial/i.test(all) },
    { name: "ไม่ติจำนวนเส้นจับเซี้ยม (ปัดรายแนวถูกแล้ว)", ok: !/(จับ)?เซี้ยม[^]{0,80}(ไม่สอดคล้อง|ผิด|เกิน)[^]{0,40}(เส้น|ความยาว)/.test(all) },
    { name: "ชี้เรื่องจับเซี้ยมใช้ราคาตัวอย่าง", ok: /เซี้ยม|ราคาตัวอย่าง|sample/i.test(all) },
  ];
}

// ---------- task 4: chat with tools ----------
const TOOLS = [
  { name: "list_projects", description: "รายการโครงการทั้งหมดของบริษัท: รหัส ชื่อ สถานะ (planning/building/handover/delivered) ความคืบหน้าจริง% แผน% ผู้จัดการ วันเสร็จตามสัญญา", parameters: { type: "object", properties: { status: { type: "string", description: "กรองสถานะ ถ้าต้องการ" } } } },
  { name: "list_repairs", description: "รายการแจ้งซ่อม กรองตามรหัสโครงการได้ สถานะ open/fixing/waiting/closed", parameters: { type: "object", properties: { projectId: { type: "string" }, openOnly: { type: "boolean", description: "true = เฉพาะที่ยังไม่ปิด" } } } },
];
function runTool(name: string, args: Any) {
  if (name === "list_projects")
    return projects.filter((p: Any) => !args?.status || p.status === args.status).map((p: Any) => ({ id: p.id, name: p.name, status: p.status, actual: p.actual, plan: p.plan, pm: p.pm, finish: p.finish }));
  if (name === "list_repairs")
    return repairs
      .filter((r: Any) => (!args?.projectId || r.projectId === args.projectId) && (!args?.openOnly || r.status !== "closed"))
      .map((r: Any) => ({ id: r.id, projectId: r.projectId, title: r.title, status: r.status, severity: r.severity }));
  return { error: `ไม่มีเครื่องมือ ${name}` };
}
const building = projects.filter((p: Any) => p.status === "building");
const worst = building.reduce((a: Any, p: Any) => (p.plan - p.actual > a.plan - a.actual ? p : a), building[0]);
const worstOpen = repairs.filter((r: Any) => r.projectId === worst.id && r.status !== "closed").length;
const CHAT_Q = "โครงการที่กำลังก่อสร้างอยู่ ตัวไหนช้ากว่าแผนมากที่สุด ช้ากี่เปอร์เซ็นต์ และโครงการนั้นมีแจ้งซ่อมที่ยังไม่ปิดกี่เรื่อง ตอบสั้น ๆ";
function checkChat(answer: string, toolNames: string[]): Check[] {
  return [
    { name: `ระบุโครงการถูก (${worst.id})`, ok: answer.includes(worst.id) || answer.includes(worst.name) },
    { name: `ช้า ${worst.plan - worst.actual}%`, ok: new RegExp(`(^|[^\\d])${worst.plan - worst.actual}(\\.0)?\\s*(%|เปอร์เซ็นต์|จุด)`).test(answer) },
    { name: `แจ้งซ่อมค้าง ${worstOpen} เรื่อง`, ok: new RegExp(`${worstOpen}\\s*(เรื่อง|รายการ)`).test(answer) || (worstOpen === 0 && /ไม่มี/.test(answer)) },
    { name: "ใช้เครื่องมือทั้งสอง", ok: toolNames.includes("list_projects") && toolNames.includes("list_repairs"), got: toolNames.join(",") },
  ];
}

// ---------- runner ----------
const sumU = (us: Any[]) => ({
  input: us.reduce((a, u) => a + u.input, 0),
  cacheRead: us.reduce((a, u) => a + (u.cacheRead ?? 0), 0),
  cacheWrite: us.reduce((a, u) => a + (u.cacheWrite ?? 0), 0),
  output: us.reduce((a, u) => a + u.output, 0),
  thinking: us.reduce((a, u) => a + (u.thinking ?? 0), 0),
  usd: us.reduce((a, u) => a + u.costUsd, 0),
  thb: us.reduce((a, u) => a + u.costThb, 0),
});

async function runTask(task: string, provider: Provider, round: number): Promise<Result> {
  const t0 = Date.now();
  const base = { task, provider, round };
  try {
    if (task === "chat") {
      const msgs: Any[] = [{ role: "user", parts: [{ text: CHAT_Q }] }];
      const us: Any[] = [];
      const used: string[] = [];
      let answer = "";
      let model = "";
      for (let step = 0; step < 6; step++) {
        const r = await generate({ task, provider, system: `คุณเป็นผู้ช่วยของบริษัทรับสร้างบ้าน วันนี้ ${TODAY} ตอบภาษาไทย ใช้ข้อมูลจากเครื่องมือเท่านั้น`, messages: msgs, tools: TOOLS });
        us.push(r.usage);
        model = r.model;
        msgs.push(r.message);
        if (!r.calls?.length) {
          answer = r.text ?? "";
          break;
        }
        used.push(...r.calls.map((c: Any) => c.name));
        msgs.push({ role: "user", parts: r.calls.map((c: Any) => ({ result: { id: c.id, name: c.name, response: runTool(c.name, c.args) } })) });
      }
      const checks = checkChat(answer, used);
      return { ...base, ok: true, model, ms: Date.now() - t0, calls: us.length, ...sumU(us), checks, answer };
    }
    const spec =
      task === "diary"
        ? (() => {
            const p = diaryPrompt({ text: DIARY_TEXT, date: TODAY, projectName: "บ้านคุณพลวัฒน์", tasks: DIARY_TASKS, subs: DIARY_SUBS });
            return { system: p.system, prompt: p.prompt, schema: DIARY_SCHEMA, check: checkDiary, max: 4000 };
          })()
        : task === "boq"
          ? { system: SYSTEM_ESTIMATOR, prompt: estimatePrompt(SCOPE, BOOK, COST_CODES, TODAY), schema: BOQ_SCHEMA, check: checkBoq, max: 8000 }
          : { system: REVIEW.system, prompt: REVIEW.prompt, schema: REVIEW_SCHEMA, check: checkReview, max: 8000 };
    const r = await generate({ task, provider, system: spec.system, messages: [{ role: "user", parts: [{ text: spec.prompt }] }], json: spec.schema, maxOutputTokens: spec.max, temperature: 0.2 });
    return { ...base, ok: true, model: r.model, ms: Date.now() - t0, calls: 1, ...sumU([r.usage]), checks: spec.check(r.json), answer: JSON.stringify(r.json, null, 1) };
  } catch (e) {
    return { ...base, ok: false, error: e instanceof Error ? e.message : String(e), ms: Date.now() - t0, calls: 0, input: 0, cacheRead: 0, cacheWrite: 0, output: 0, thinking: 0, usd: 0, thb: 0, checks: [], answer: "" };
  }
}

const TASKS: { k: string; label: string }[] = [
  { k: "diary", label: "รายงานประจำวันจากคำพูด (JSON)" },
  { k: "boq", label: "ถอด BOQ จากคำบรรยาย (JSON)" },
  { k: "review", label: "ตรวจงานถอดปริมาณ (JSON)" },
  { k: "chat", label: "แชทถามข้อมูล + เรียกเครื่องมือ" },
];

console.log(`โมเดล: ${providers.map((p) => `${p}=${st.providers[p].model}${st.providers[p].effort ? ` (effort ${st.providers[p].effort})` : ""}`).join(" · ")} · ${ROUNDS} รอบ/งาน · 1 USD = ${st.usdThb} บาท`);
const results: Result[] = [];
// `npm run ai:bench -- --rescore <file.json>`: re-check saved answers with the current rules (no API calls)
const rescoreFrom = process.argv.includes("--rescore") ? process.argv[process.argv.indexOf("--rescore") + 1] : null;
if (rescoreFrom) {
  const saved = JSON.parse(fs.readFileSync(rescoreFrom, "utf8")) as Result[];
  for (const r of saved) {
    if (r.ok && r.task === "chat") {
      const tools = r.checks.find((c) => c.name === "ใช้เครื่องมือทั้งสอง"); // tool calls aren't saved: keep that check
      r.checks = checkChat(r.answer, []).map((c) => (c.name === "ใช้เครื่องมือทั้งสอง" && tools ? tools : c));
    } else if (r.ok) r.checks = (r.task === "diary" ? checkDiary : r.task === "boq" ? checkBoq : checkReview)(JSON.parse(r.answer));
    results.push(r);
  }
}
for (const t of rescoreFrom ? [] : TASKS)
  for (let round = 1; round <= ROUNDS; round++) {
    const rs = await Promise.all(providers.map((p) => runTask(t.k, p, round)));
    for (const r of rs) {
      results.push(r);
      const score = r.checks.filter((c) => c.ok).length;
      console.log(`${t.k.padEnd(7)} #${round} ${r.provider.padEnd(6)} ${r.ok ? `${score}/${r.checks.length}` : "ERROR"}  ${(r.ms / 1000).toFixed(1)}s  in ${r.input}+cache ${r.cacheRead}  out ${r.output} (think ${r.thinking})  $${r.usd.toFixed(5)}  ฿${r.thb.toFixed(3)}${r.error ? `  ${r.error}` : ""}`);
    }
  }

// ---------- report ----------
const date = new Date().toISOString().slice(0, 10);
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
let md = `# เทียบ AI: ${providers.map((p) => st.providers[p].model).join(" vs ")}\n\nวันที่ ${date} · ${ROUNDS} รอบต่องาน · 1 USD = ${st.usdThb} บาท · Claude effort ${st.providers.claude.effort}\n\n`;
md += `## สรุปต่องาน (ค่าเฉลี่ยต่อ 1 ครั้งที่ผู้ใช้กด)\n\n| งาน | โมเดล | คะแนน | เวลา | input (+cache) | output (thinking) | บาท/ครั้ง | บาท/1,000 ครั้ง |\n|---|---|---|---|---|---|---|---|\n`;
for (const t of TASKS)
  for (const p of providers) {
    const rs = results.filter((r) => r.task === t.k && r.provider === p);
    const okRs = rs.filter((r) => r.ok);
    const pts = okRs.reduce((a, r) => a + r.checks.filter((c) => c.ok).length, 0);
    const max = okRs.reduce((a, r) => a + r.checks.length, 0);
    md += `| ${t.label} | ${okRs[0]?.model ?? st.providers[p].model} | ${max ? `${pts}/${max} (${Math.round((pts / max) * 100)}%)` : "-"}${rs.length - okRs.length ? ` · error ${rs.length - okRs.length}` : ""} | ${(avg(okRs.map((r) => r.ms)) / 1000).toFixed(1)} วิ | ${Math.round(avg(okRs.map((r) => r.input)))} (+${Math.round(avg(okRs.map((r) => r.cacheRead)))}) | ${Math.round(avg(okRs.map((r) => r.output)))} (${Math.round(avg(okRs.map((r) => r.thinking)))}) | ${avg(okRs.map((r) => r.thb)).toFixed(3)} | ${Math.round(avg(okRs.map((r) => r.thb)) * 1000).toLocaleString("en-US")} |\n`;
  }
md += `\n## จุดที่พลาด\n\n`;
for (const r of results) {
  const miss = r.checks.filter((c) => !c.ok);
  if (!r.ok) md += `- ${r.task} #${r.round} ${r.provider}: ERROR ${r.error}\n`;
  else if (miss.length) md += `- ${r.task} #${r.round} ${r.provider}: ${miss.map((c) => `${c.name}${c.got ? ` (ได้ ${c.got})` : ""}`).join(" · ")}\n`;
}
md += `\n## คำตอบรอบที่ 1\n`;
for (const t of TASKS)
  for (const p of providers) {
    const r = results.find((x) => x.task === t.k && x.provider === p && x.round === 1);
    md += `\n### ${t.label} · ${p}\n\n\`\`\`\n${(r?.answer || r?.error || "").slice(0, 6000)}\n\`\`\`\n`;
  }
fs.mkdirSync("reports", { recursive: true });
const out = `reports/ai-benchmark-${date}${TAG ? `-${TAG}` : ""}.md`;
fs.writeFileSync(out, md);
fs.writeFileSync(`reports/ai-benchmark-${date}${TAG ? `-${TAG}` : ""}.json`, JSON.stringify(results, null, 1));
console.log(`\nรายงาน: ${out}`);
