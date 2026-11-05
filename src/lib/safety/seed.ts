// Deterministic safety demo data tied to the building sites and the HR employee seed.
import { getProject, seeded, TODAY } from "../data";
import { addDays, isWorkday, weekday } from "../hr/payroll";
import { ACTIVE_SITES, seedEmployees } from "../hr/seed";
import type { Employee } from "../hr/types";
import { DEFAULT_SAFETY } from "./calc";
import {
  INSP_ITEMS,
  PERMIT_CONTROLS,
  PERMIT_HAZARDS,
  TOPICS,
  type EnvLog,
  type Incident,
  type InspKind,
  type Permit,
  type PermitType,
  type PpeIssue,
  type SafetyInspection,
  type SafetyOfficer,
  type SafetySettings,
  type ToolboxTalk,
} from "./types";

const int = (rnd: () => number, a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const pick = <T,>(rnd: () => number, xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
const pad = (n: number, w = 4) => String(n).padStart(w, "0");
const crewOf = (pid: string) => seedEmployees().filter((e) => e.type === "daily" && e.projectId === pid && e.status !== "resigned");
const subsOf = (pid: string) => seedEmployees().filter((e) => e.type === "subcontract" && e.projectId === pid);
const headOf = (pid: string) => crewOf(pid).find((e) => e.skill === "หัวหน้าช่าง");
const foremanOf = (pid: string) => seedEmployees().find((e) => e.type === "monthly" && e.position === "โฟร์แมน" && e.projectId === pid && e.status !== "resigned");
const leaderName = (pid: string) => foremanOf(pid)?.name ?? headOf(pid)?.name ?? getProject(pid)?.pm ?? "";
const workdaysBack = (n: number) => {
  const out: string[] = [];
  for (let d = TODAY; out.length < n; d = addDays(d, -1)) if (isWorkday(d)) out.push(d);
  return out.reverse();
};

// ---------- toolbox talks ----------

function genTalks(): ToolboxTalk[] {
  const rnd = seeded(7301);
  const out: ToolboxTalk[] = [];
  const days = workdaysBack(36).filter((d) => d < TODAY);
  for (const p of ACTIVE_SITES) {
    const big = p.id === "HC-2025-03";
    const crew = crewOf(p.id);
    if (!crew.length) continue;
    for (const d of days) {
      if (d < p.start) continue;
      // condo: daily talk; houses: every Monday
      if (!big && weekday(d) !== 1) continue;
      if (p.id === "HC-2026-08" && d > addDays(TODAY, -8)) continue; // missed last week
      if (big && rnd() < 0.08) continue;
      const topic = TOPICS[(out.length * 7 + int(rnd, 0, 3)) % TOPICS.length];
      const present = crew.filter(() => rnd() > 0.1);
      const crews = subsOf(p.id).map((s) => ({ name: s.name, count: Math.max(1, (s.crewSize ?? 3) - int(rnd, 0, 1)) }));
      out.push({
        id: "",
        projectId: p.id,
        date: d,
        time: big ? "07:45" : "08:00",
        topicId: topic.id,
        topic: topic.title,
        presenter: rnd() < 0.7 ? leaderName(p.id) : (headOf(p.id)?.name ?? leaderName(p.id)),
        attendees: present.map((e) => ({ employeeId: e.id, name: e.name, group: "คนงานบริษัท" })),
        crews,
        durationMin: pick(rnd, [10, 15, 15, 20]),
        photos: [],
        signer: leaderName(p.id),
        source: rnd() < 0.6 ? "phone" : "web",
      });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.projectId.localeCompare(b.projectId)).map((t, i) => ({ ...t, id: `TBT-2026-${pad(i + 1)}` }));
}

// ---------- permits ----------

type PDef = [PermitType, string, string, string, number, number, number, Permit["status"], number?]; // type, site, title, location, dayOffset, fromHour, hours, status, workers
const PDEFS: PDef[] = [
  ["lift", "HC-2025-03", "ยกแบบหล่อและเหล็กเสริมขึ้นชั้นหลังคา", "ทาวเวอร์เครน TC-01 ฝั่งทิศเหนือ", 0, 8, 9, "active", 5],
  ["hot", "HC-2025-03", "เชื่อมโครงหลังคาเหล็กและราวกันตกดาดฟ้า", "ดาดฟ้า ชั้น 6", 0, 8, 9, "active", 3],
  ["height", "HC-2025-03", "ติดตั้งตาข่ายกันตกขอบอาคาร ชั้น 6", "ขอบอาคารด้านถนน", -1, 8, 9, "active", 4],
  ["electrical", "HC-2025-03", "ต่อตู้ไฟชั่วคราว MDB ชั้น 1", "ห้องไฟฟ้าชั้น 1", -2, 13, 4, "closed", 2],
  ["confined", "HC-2026-04", "ติดตั้งท่อในบ่อบำบัดน้ำเสียสำเร็จรูป", "บ่อบำบัดหน้าบ้าน", 0, 9, 6, "issued", 3],
  ["excavation", "HC-2026-08", "ขุดฐานรากลึก 1.8 ม. ฐาน F1–F6", "ฐานรากแนว A–C", -1, 8, 10, "active", 6],
  ["height", "HC-2026-03", "ติดตั้งนั่งร้านภายนอก ชั้น 3–4", "ด้านหน้าอาคาร", 0, 8, 9, "requested", 4],
  ["hot", "HC-2026-01", "เชื่อมโครงหลังคาจอดรถ", "โรงจอดรถ", -3, 9, 7, "closed", 2],
  ["lift", "HC-2026-06", "ยกโครงถักหลังคาด้วยรถเครน 25 ตัน", "ตัวบ้านด้านทิศใต้", -6, 8, 8, "closed", 5],
  ["height", "HC-2026-02", "ติดตั้งรางน้ำฝนและเชิงชาย", "ชายคาชั้น 2", -9, 8, 9, "closed", 3],
  ["excavation", "HC-2026-09", "ขุดวางท่อระบายน้ำรอบบ้าน", "แนวท่อทิศตะวันตก", -2, 8, 9, "active", 4],
  ["electrical", "HC-2026-05", "ตัดไฟเพื่อย้ายมิเตอร์ชั่วคราว", "หน้าแปลง", -12, 10, 3, "closed", 2],
  ["hot", "HC-2026-04", "ตัดเหล็กเสริมด้วยแก๊ส", "ลานเตรียมเหล็ก", -15, 8, 9, "cancelled", 2],
  ["confined", "HC-2025-03", "ตรวจสอบถังเก็บน้ำใต้ดิน", "ถังเก็บน้ำใต้ดิน", -20, 9, 5, "closed", 3],
];
const ISSUERS = ["สมศักดิ์ แก้วมณี", "ชาตรี บุญยืน", "กิตติพงษ์ ศรีประเสริฐ"];
const hh = (h: number) => `${String(Math.floor(h)).padStart(2, "0")}:${h % 1 ? "30" : "00"}`;

function genPermits(): Permit[] {
  const rnd = seeded(5150);
  return PDEFS.map(([type, pid, title, location, off, fromH, hours, status, workers], i) => {
    const date = addDays(TODAY, off);
    const toH = fromH + hours;
    const issuer = pid === "HC-2025-03" ? ISSUERS[0] : pid === "HC-2026-06" ? ISSUERS[1] : ISSUERS[2];
    const approver = getProject(pid)?.pm ?? "ศิริพร ตั้งเจริญ";
    const signed = status !== "requested";
    const approved = status === "active" || status === "closed";
    const hz = PERMIT_HAZARDS[type];
    return {
      id: `PTW-2026-${pad(101 + i)}`,
      projectId: pid,
      type,
      title,
      location,
      crew: headOf(pid)?.name ? `ทีม${headOf(pid)!.name.split(" ")[0]}` : "ทีมช่างบริษัท",
      workers: workers ?? 3,
      validFrom: `${date}T${hh(fromH)}`,
      validTo: `${date}T${hh(toH)}`,
      hazards: hz.filter((_, k) => k < 3 || rnd() < 0.5),
      controls: PERMIT_CONTROLS[type].map((text) => ({ text, done: signed ? rnd() > 0.05 || approved : rnd() < 0.5 })),
      gas: type === "confined" && signed ? { o2: 20.6, lel: 0, h2s: 1, co: 3, at: hh(fromH - 0.5) } : undefined,
      requestedBy: headOf(pid)?.name ?? leaderName(pid),
      requestedAt: `${addDays(date, -1)}T16:30`,
      issuer: signed ? { name: issuer, at: `${date}T${hh(fromH - 0.5)}` } : undefined,
      approver: approved ? { name: approver, at: `${date}T${hh(fromH - 0.5)}` } : undefined,
      closeOut: status === "closed" ? { name: issuer, at: `${date}T${hh(toH)}`, note: "เก็บอุปกรณ์ ตรวจพื้นที่เรียบร้อย ไม่มีความเสี่ยงค้าง", areaSafe: true } : undefined,
      status,
      photos: [],
    };
  });
}

// ---------- inspections ----------

function genInspections(): SafetyInspection[] {
  const rnd = seeded(6262);
  const out: Omit<SafetyInspection, "id">[] = [];
  const mk = (pid: string, kind: InspKind, date: string, extra: Partial<SafetyInspection> = {}, failRate = 0.1) => {
    const items = INSP_ITEMS[kind].map((text) => {
      const r = rnd();
      return { text, result: (r < failRate ? "fail" : r < failRate + 0.06 && kind !== "scaffold" ? "na" : "pass") as "pass" | "fail" | "na" };
    });
    const fails = items.filter((x) => x.result === "fail");
    out.push({
      projectId: pid,
      kind,
      date,
      inspector: pid === "HC-2025-03" ? "สมศักดิ์ แก้วมณี" : leaderName(pid),
      location: "",
      items: items.map((x) => (x.result === "fail" ? { ...x, note: "แจ้งแก้ไข" } : x)),
      photos: [],
      actions: fails.length ? `แก้ไข: ${fails.map((f) => f.text).join(" / ")}` : undefined,
      followUpDue: fails.length ? addDays(date, 3) : undefined,
      closed: !fails.length || date < addDays(TODAY, -6),
      ...extra,
    });
  };
  // condo: weekly scaffold tag inspections for 4 scaffold sets
  const scaffolds: [string, string, number][] = [
    ["SC-01", "นั่งร้านภายนอก ด้านทิศเหนือ", 22],
    ["SC-02", "นั่งร้านภายนอก ด้านทิศใต้", 22],
    ["SC-03", "นั่งร้านภายใน โถงบันได", 9],
    ["SC-04", "หอนั่งร้านเคลื่อนที่ ชั้น 1", 4],
  ];
  for (let w = 5; w >= 0; w--) {
    const date = addDays(TODAY, -w * 7 - 1);
    scaffolds.forEach(([no, location, h], k) => {
      const recentFail = w === 0 && k === 1;
      const red = w === 0 && k === 3;
      mk("HC-2025-03", "scaffold", date, { scaffoldNo: no, location, heightM: h, tag: red ? "red" : recentFail ? "yellow" : "green" }, recentFail || red ? 0.35 : 0.04);
    });
  }
  mk("HC-2026-03", "scaffold", addDays(TODAY, -2), { scaffoldNo: "SC-01", location: "นั่งร้านด้านหน้าอาคาร", heightM: 12, tag: "green" }, 0.03);
  // PPE checks and safety walks
  for (const p of ACTIVE_SITES) {
    for (let w = 4; w >= 0; w--) {
      const date = addDays(TODAY, -w * 7 - (p.id.charCodeAt(9) % 4));
      if (date < p.start || date >= TODAY) continue;
      mk(p.id, "walk", date, { location: "ทั่วทั้งไซต์" }, p.id === "HC-2026-08" ? 0.25 : 0.1);
      if (w % 2 === 0) mk(p.id, "ppe", date, { location: "จุดลงเวลา/ทางเข้าไซต์" }, 0.12);
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date)).map((x, i) => ({ ...x, id: `SIN-2026-${pad(i + 1)}` }));
}

// ---------- incidents ----------

function genIncidents(): Incident[] {
  const condo = crewOf("HC-2025-03");
  const site4 = crewOf("HC-2026-04");
  const inj = (e: Employee | undefined, bodyParts: string[], injury: string, treatment: string, hospital?: string) => (e ? { employeeId: e.id, name: e.name, trade: e.skill, nationality: e.nationality, bodyParts, injury, treatment, hospital } : undefined);
  const notifyAll = (date: string, done: number) => DEFAULT_SAFETY.notifyItems.map((item, k) => ({ item, done: k < done, at: k < done ? addDays(date, Math.min(k, 6)) : undefined }));
  const list: Omit<Incident, "id">[] = [
    {
      projectId: "HC-2025-03", cls: "lost_time", date: "2026-09-18", time: "14:20", place: "ชั้น 5 โซน B ขอบพื้น",
      description: "คนงานก้าวพลาดจากแผ่นพื้นนั่งร้านที่ยังยึดไม่แน่น ตกลงพื้นชั้นล่าง สูงประมาณ 1.8 ม. ข้อเท้าพลิก",
      people: ["สมศักดิ์ แก้วมณี", condo[1]?.name ?? ""], injured: inj(condo[9], ["เท้า/นิ้วเท้า", "ขา"], "ข้อเท้าแพลง เอ็นอักเสบ", "ส่งโรงพยาบาล เอกซเรย์ ใส่เฝือกอ่อน", "โรงพยาบาลลาดพร้าว"),
      cause: { immediate: "แผ่นพื้นนั่งร้านไม่ได้ยึดกับโครง", root: "ไม่มีการตรวจนั่งร้านหลังย้ายแผ่นพื้น และไม่มีป้ายสถานะนั่งร้าน", cats: ["สภาพการทำงานไม่ปลอดภัย", "ขาดการควบคุมงาน"] },
      actions: [
        { id: "A1", text: "ตรวจนั่งร้านและติดป้ายเขียว/เหลือง/แดง ทุกเช้าก่อนใช้งาน", owner: "สมศักดิ์ แก้วมณี", due: "2026-09-21", done: true, doneAt: "2026-09-20" },
        { id: "A2", text: "อบรมทีมนั่งร้านเรื่องการยึดแผ่นพื้น", owner: "กิตติพงษ์ ศรีประเสริฐ", due: "2026-09-25", done: true, doneAt: "2026-09-24" },
      ],
      daysLost: 6, returnedAt: "2026-09-25", status: "closed", reportedBy: "สมศักดิ์ แก้วมณี",
      notify: notifyAll("2026-09-18", 7), kt16: { no: "กท.16-6909-0312", submittedAt: "2026-09-22", office: "สำนักงานประกันสังคมกรุงเทพมหานครพื้นที่ 6", wage: condo[9]?.dailyRate ? condo[9].dailyRate * 26 : undefined, note: "ใช้สิทธิ์กองทุนเงินทดแทน ค่ารักษาพยาบาลและค่าทดแทนระหว่างหยุดงาน" },
      photos: [],
    },
    {
      projectId: "HC-2026-04", cls: "lost_time", date: addDays(TODAY, -8), time: "10:40", place: "ลานตัดเหล็กหน้าบ้าน",
      description: "ใบตัดเครื่องตัดเหล็กแตกกระเด็นถูกแขนซ้าย แผลฉีกขาดลึก",
      people: [site4[0]?.name ?? ""], injured: inj(site4[4], ["แขน"], "แผลฉีกขาด 6 ซม. เย็บ 8 เข็ม", "ปฐมพยาบาลห้ามเลือด ส่งโรงพยาบาล", "โรงพยาบาลรามคำแหง"),
      cause: { immediate: "ใช้ใบตัดผิดขนาดและถอดการ์ดป้องกันออก", root: "ไม่มีการตรวจเครื่องมือก่อนใช้ ไม่มีใบตัดสำรองถูกขนาดในไซต์", cats: ["เครื่องมือชำรุด", "การกระทำไม่ปลอดภัย"] },
      actions: [
        { id: "A1", text: "ติดตั้งการ์ดเครื่องตัดเหล็กคืนและห้ามถอด", owner: site4[0]?.name ?? "หัวหน้าช่าง", due: addDays(TODAY, -6), done: true, doneAt: addDays(TODAY, -7) },
        { id: "A2", text: "จัดซื้อใบตัดขนาดถูกต้องสำรองไว้ในไซต์", owner: "วิภาวรรณ ทองดี", due: addDays(TODAY, -2), done: false },
        { id: "A3", text: "Toolbox talk เรื่องการ์ดป้องกันเครื่องมือ", owner: site4[0]?.name ?? "หัวหน้าช่าง", due: addDays(TODAY, 2), done: false },
      ],
      daysLost: 4, status: "investigating", reportedBy: site4[0]?.name ?? "หัวหน้าช่าง",
      notify: notifyAll(addDays(TODAY, -8), 2), photos: [],
    },
    {
      projectId: "HC-2025-03", cls: "near_miss", date: addDays(TODAY, -3), time: "09:15", place: "ใต้รัศมีทาวเวอร์เครน",
      description: "ถุงปูนหลุดจากกระบะยกตกลงพื้น ห่างคนงานประมาณ 3 ม.",
      people: [condo[5]?.name ?? "", condo[7]?.name ?? ""],
      cause: { immediate: "บรรจุของในกระบะเกินขอบ ไม่ใช้ตาข่ายคลุม", root: "ไม่มีการกั้นเขตใต้รัศมีการยก", cats: ["การกระทำไม่ปลอดภัย", "ขั้นตอนงานไม่ชัดเจน"] },
      actions: [{ id: "A1", text: "กั้นเขตและติดป้ายห้ามเข้าใต้รัศมีการยก", owner: "สมศักดิ์ แก้วมณี", due: addDays(TODAY, 1), done: false }],
      daysLost: 0, status: "open", reportedBy: condo[5]?.name ?? "หัวหน้าช่าง", notify: [], photos: [],
    },
    {
      projectId: "HC-2026-08", cls: "near_miss", date: addDays(TODAY, -5), time: "15:30", place: "ขอบหลุมฐานราก F3",
      description: "ดินขอบหลุมฐานรากพังลงบางส่วนหลังฝนตก ไม่มีคนอยู่ในหลุม",
      people: [crewOf("HC-2026-08")[0]?.name ?? ""],
      cause: { immediate: "กองดินชิดขอบหลุม", root: "ไม่ได้ทำลาดดินหลังฝนตก", cats: ["สภาพการทำงานไม่ปลอดภัย", "สภาพอากาศ"] },
      actions: [{ id: "A1", text: "ย้ายกองดินห่างขอบหลุม 0.6 ม. และทำลาดดิน", owner: crewOf("HC-2026-08")[0]?.name ?? "หัวหน้าช่าง", due: addDays(TODAY, -3), done: false }],
      daysLost: 0, status: "open", reportedBy: "ศิริพร ตั้งเจริญ", notify: [], photos: [],
    },
    {
      projectId: "HC-2026-02", cls: "first_aid", date: addDays(TODAY, -14), time: "11:00", place: "ห้องนอน 2 ชั้น 2",
      description: "เศษปูนกระเด็นเข้าตาระหว่างสกัดผนัง",
      people: [], injured: inj(crewOf("HC-2026-02")[2], ["ตา"], "ระคายเคืองตา", "ล้างตาด้วยน้ำสะอาด 15 นาที"),
      cause: { immediate: "ไม่สวมแว่นตานิรภัย", root: "แว่นตาในไซต์ไม่พอ", cats: ["ไม่สวม PPE"] },
      actions: [{ id: "A1", text: "เบิกแว่นตานิรภัยเพิ่ม 10 อัน", owner: "วิภาวรรณ ทองดี", due: addDays(TODAY, -12), done: true, doneAt: addDays(TODAY, -12) }],
      daysLost: 0, status: "closed", reportedBy: crewOf("HC-2026-02")[0]?.name ?? "หัวหน้าช่าง", notify: [], photos: [],
    },
    {
      projectId: "HC-2026-06", cls: "first_aid", date: addDays(TODAY, -27), time: "13:45", place: "โครงหลังคา",
      description: "ค้อนกระแทกนิ้วมือระหว่างตอกตะปูยึดแป",
      people: [], injured: inj(crewOf("HC-2026-06")[2], ["มือ/นิ้วมือ"], "นิ้วช้ำ", "ประคบเย็น"),
      cause: { immediate: "ทำงานเร่งรีบ", root: "-", cats: ["การกระทำไม่ปลอดภัย"] },
      actions: [], daysLost: 0, status: "closed", reportedBy: "ชาตรี บุญยืน", notify: [], photos: [],
    },
    {
      projectId: "HC-2026-03", cls: "near_miss", date: addDays(TODAY, -19), time: "08:50", place: "ช่องบันไดชั้น 3",
      description: "ไม้แบบหล่นจากชั้น 4 ผ่านช่องบันไดที่ไม่มีราวกั้น",
      people: [],
      cause: { immediate: "ช่องเปิดไม่มีราวกั้น/ขอบกันของตก", root: "ไม่มีผู้รับผิดชอบปิดช่องเปิดหลังถอดแบบ", cats: ["สภาพการทำงานไม่ปลอดภัย"] },
      actions: [{ id: "A1", text: "ติดตั้งราวกั้นและขอบกันของตกรอบช่องบันไดทุกชั้น", owner: "กิตติพงษ์ ศรีประเสริฐ", due: addDays(TODAY, -16), done: true, doneAt: addDays(TODAY, -17) }],
      daysLost: 0, status: "closed", reportedBy: "กิตติพงษ์ ศรีประเสริฐ", notify: [], photos: [],
    },
    {
      projectId: "HC-2026-01", cls: "first_aid", date: "2026-07-08", time: "16:10", place: "หน้าบ้าน",
      description: "ตะปูตำเท้าขณะเก็บไม้แบบ",
      people: [], injured: inj(crewOf("HC-2026-01")[3], ["เท้า/นิ้วเท้า"], "แผลตะปูตำ", "ล้างแผล ฉีดยากันบาดทะยัก", "คลินิกใกล้ไซต์"),
      cause: { immediate: "สวมรองเท้าแตะ", root: "ไม่บังคับรองเท้านิรภัย", cats: ["ไม่สวม PPE"] },
      actions: [], daysLost: 0, status: "closed", reportedBy: "วรเชษฐ์ อินทรประเสริฐ", notify: [], photos: [],
    },
  ];
  return list.sort((a, b) => a.date.localeCompare(b.date)).map((x, i) => ({ ...x, id: `INC-2026-${pad(i + 1)}` }));
}

// ---------- PPE issue ----------

function genPpe(): PpeIssue[] {
  const rnd = seeded(1919);
  const out: Omit<PpeIssue, "id">[] = [];
  const kit = ["หมวกนิรภัย", "รองเท้านิรภัย", "เสื้อสะท้อนแสง", "ถุงมือผ้า"];
  for (const e of seedEmployees()) {
    if (e.type !== "daily") continue;
    const start = e.startDate > addDays(TODAY, -120) ? e.startDate : addDays(TODAY, -int(rnd, 60, 120));
    out.push({ employeeId: e.id, projectId: e.projectId, date: start, items: kit.map((item) => ({ item, qty: item === "ถุงมือผ้า" ? 3 : 1, size: item === "รองเท้านิรภัย" ? String(int(rnd, 39, 44)) : undefined })), issuedBy: leaderName(e.projectId ?? ""), reason: "new" });
    if (rnd() < 0.35) out.push({ employeeId: e.id, projectId: e.projectId, date: addDays(TODAY, -int(rnd, 1, 40)), items: [{ item: pick(rnd, ["ถุงมือผ้า", "ถุงมือหนัง", "หน้ากาก N95", "แว่นตานิรภัย", "ที่อุดหู"]), qty: int(rnd, 1, 5) }], issuedBy: leaderName(e.projectId ?? ""), reason: "replace" });
    if (e.skill === "ช่างเชื่อม") out.push({ employeeId: e.id, projectId: e.projectId, date: addDays(start, 1), items: [{ item: "หน้ากากเชื่อม", qty: 1 }, { item: "ถุงมือหนัง", qty: 2 }], issuedBy: leaderName(e.projectId ?? ""), reason: "new" });
    if ((e.skill === "ช่างเหล็ก" || e.skill === "ช่างไม้") && e.projectId === "HC-2025-03") out.push({ employeeId: e.id, projectId: e.projectId, date: addDays(start, 2), items: [{ item: "เข็มขัดนิรภัยเต็มตัว", qty: 1 }], issuedBy: "สมศักดิ์ แก้วมณี", reason: "new" });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date)).map((x, i) => ({ ...x, id: `PPE-2026-${pad(i + 1)}` }));
}

// ---------- environment ----------

function genEnv(): EnvLog[] {
  const rnd = seeded(2525);
  const out: EnvLog[] = [];
  const sites = ["HC-2025-03", "HC-2026-04", "HC-2026-03", "HC-2026-06"];
  for (const pid of sites) {
    for (const d of workdaysBack(26)) {
      if (d >= TODAY) continue;
      const north = pid === "HC-2026-06";
      // PM2.5 rises into November (burning season / still air)
      const trend = (Date.parse(d) - Date.parse(addDays(TODAY, -40))) / 86400000;
      const pm25 = Math.round((north ? 22 : 18) + trend * 0.55 + rnd() * 18);
      const complaints: EnvLog["complaints"] = [];
      if (pid === "HC-2025-03" && rnd() < 0.12) complaints.push({ text: pick(rnd, ["ฝุ่นปูนลอยเข้าบ้าน", "เสียงเครื่องตัดเหล็กดังหลัง 18.00 น.", "รถขนดินทำถนนเลอะ"]), from: pick(rnd, ["บ้านเลขที่ 71/12", "หอพักข้างไซต์", "ร้านค้าหน้าซอย"]), resolved: rnd() < 0.7 || d < addDays(TODAY, -7) });
      out.push({ id: `ENV-${pid}-${d}`, projectId: pid, date: d, pm25, noiseDb: pid === "HC-2025-03" ? int(rnd, 68, 84) : undefined, dustScreen: pid !== "HC-2026-06" || rnd() < 0.6, wheelWash: pid === "HC-2025-03" || rnd() < 0.3, waterSprayTimes: pm25 > 37.5 ? int(rnd, 2, 4) : int(rnd, 0, 2), complaints, by: leaderName(pid), photos: [] });
    }
  }
  return out;
}

// ---------- officers / settings ----------

/** extra assignments (team members with role "safety", officers covering several sites); certified site staff are counted automatically */
export const seedOfficers = (): SafetyOfficer[] => [];
export const seedSafetySettings = (): SafetySettings[] => [{ ...DEFAULT_SAFETY, ladder: DEFAULT_SAFETY.ladder.map((r) => ({ ...r })), notifyItems: [...DEFAULT_SAFETY.notifyItems] }];

let talkCache: ToolboxTalk[] | null = null;
let permitCache: Permit[] | null = null;
let inspCache: SafetyInspection[] | null = null;
let incCache: Incident[] | null = null;
let ppeCache: PpeIssue[] | null = null;
let envCache: EnvLog[] | null = null;
export const seedTalks = () => (talkCache ??= genTalks());
export const seedPermits = () => (permitCache ??= genPermits());
export const seedSafetyInspections = () => (inspCache ??= genInspections());
export const seedIncidents = () => (incCache ??= genIncidents());
export const seedPpe = () => (ppeCache ??= genPpe());
export const seedEnv = () => (envCache ??= genEnv());
