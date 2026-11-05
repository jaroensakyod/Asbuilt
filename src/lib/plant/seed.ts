// Deterministic plant & equipment demo data for the building sites.
import { seeded, TODAY } from "../data";
import { addDays, isWorkday } from "../hr/payroll";
import { seedEmployees } from "../hr/seed";
import { addMonths, DEFAULT_PLANT } from "./calc";
import { DEFAULT_COST_CODE, type Plant, type PlantBooking, type PlantCert, type PlantMaint, type PlantSettings, type PlantType, type PlantUsage } from "./types";

const int = (rnd: () => number, a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const pad = (n: number, w = 4) => String(n).padStart(w, "0");
const crew = (pid: string) => seedEmployees().filter((e) => e.type === "daily" && e.projectId === pid && e.status !== "resigned");

type Def = Omit<Plant, "id" | "costCode" | "photos"> & { costCode?: Plant["costCode"] };
const P = (type: PlantType, name: string, o: Partial<Def>): Def => ({ type, name, ownership: "owned", rateBasis: "day", rate: 0, status: "available", ...o });

const DEFS: Def[] = [
  P("tower_crane", "ทาวเวอร์เครน TC-01", { ownership: "rented", supplier: "บจก. ไทยทาวเวอร์เครน เซอร์วิส", make: "Potain", model: "MC 85B", serial: "PT-85B-1176", capacityT: 5, rateBasis: "month", rate: 185000, projectId: "HC-2025-03", status: "on_site", onHire: "2025-12-05", meterHours: 2140 }),
  P("hoist", "ลิฟต์ขนส่งวัสดุ HS-01", { ownership: "rented", supplier: "บจก. ไทยทาวเวอร์เครน เซอร์วิส", make: "Alimak", model: "Scando 650", capacityT: 1, rateBasis: "month", rate: 38000, projectId: "HC-2025-03", status: "on_site", onHire: "2026-04-01" }),
  P("mobile_crane", "รถเครน 25 ตัน", { ownership: "rented", supplier: "หจก. เชียงใหม่เครนบริการ", make: "Tadano", model: "GR-250N", serial: "TD-25-0931", capacityT: 25, rateBasis: "day", rate: 18000, status: "available" }),
  P("excavator", "รถขุด PC70", { make: "Komatsu", model: "PC70-8", serial: "KMT-PC70-3352", rateBasis: "hour", rate: 850, projectId: "HC-2026-08", status: "on_site", meterHours: 6830, serviceEveryHours: 250 }),
  P("backhoe", "รถแบ็คโฮ JCB 3CX", { make: "JCB", model: "3CX", serial: "JCB-3CX-7781", rateBasis: "hour", rate: 650, projectId: "HC-2026-09", status: "on_site", meterHours: 4412, serviceEveryHours: 250 }),
  P("concrete_pump", "ปั๊มคอนกรีตบูม 36 ม.", { ownership: "rented", supplier: "บจก. สยามคอนกรีตปั๊ม", make: "Putzmeister", model: "M36-4", rateBasis: "day", rate: 9500, status: "available" }),
  P("generator", "เครื่องกำเนิดไฟฟ้า 60 kVA", { make: "Denyo", model: "DCA-60", rateBasis: "day", rate: 1200, projectId: "HC-2026-09", status: "on_site", meterHours: 3120, serviceEveryHours: 500 }),
  P("generator", "เครื่องกำเนิดไฟฟ้า 20 kVA", { make: "Kubota", model: "GL-20", rateBasis: "day", rate: 500, projectId: "HC-2026-06", status: "on_site", meterHours: 1890, serviceEveryHours: 500 }),
  P("scaffold", "นั่งร้านเฟรม ชุด N (22 ม.)", { heightM: 22, rateBasis: "month", rate: 45000, projectId: "HC-2025-03", status: "on_site", note: "นั่งร้านภายนอกด้านทิศเหนือ 640 ชุด" }),
  P("scaffold", "นั่งร้านเฟรม ชุด S (22 ม.)", { heightM: 22, rateBasis: "month", rate: 45000, projectId: "HC-2025-03", status: "on_site", note: "นั่งร้านภายนอกด้านทิศใต้ 600 ชุด" }),
  P("scaffold", "นั่งร้านเฟรม ชุด R (12 ม.)", { heightM: 12, rateBasis: "month", rate: 12000, projectId: "HC-2026-03", status: "on_site", note: "180 ชุด" }),
  P("vibrator", "เครื่องจี้คอนกรีต VB-01", { make: "Mikasa", model: "FX-40G", rateBasis: "day", rate: 250, projectId: "HC-2026-07", status: "on_site" }),
  P("vibrator", "เครื่องจี้คอนกรีต VB-02", { make: "Mikasa", model: "FX-40G", rateBasis: "day", rate: 250, projectId: "HC-2026-08", status: "on_site" }),
  P("compactor", "เครื่องตบดิน CP-01", { make: "Mikasa", model: "MT-55", rateBasis: "day", rate: 400, projectId: "HC-2026-08", status: "on_site" }),
  P("welder", "ตู้เชื่อม WD-01", { make: "Lincoln", model: "Invertec 300", rateBasis: "day", rate: 300, projectId: "HC-2025-03", status: "on_site" }),
  P("excavator", "รถขุดเล็ก PC30", { ownership: "rented", supplier: "หจก. ขอนแก่นเครื่องจักร", make: "Komatsu", model: "PC30MR", rateBasis: "day", rate: 4500, projectId: "HC-2026-07", status: "breakdown", onHire: "2026-10-12", meterHours: 9120 }),
];

function gen() {
  const rnd = seeded(8128);
  const plants: Plant[] = DEFS.map((d, i) => ({ ...d, id: `PL-${pad(i + 1, 3)}`, costCode: d.costCode ?? DEFAULT_COST_CODE[d.type], photos: [] }));
  const byName = (n: string) => plants.find((p) => p.name === n)!;
  const bookings: PlantBooking[] = [];
  const book = (p: Plant, projectId: string, from: string, to: string, purpose: string, by: string) => bookings.push({ id: `PB-2026-${pad(bookings.length + 1)}`, plantId: p.id, projectId, from, to, purpose, by, status: "booked" });
  const usage: PlantUsage[] = [];
  const maint: PlantMaint[] = [];
  const certs: PlantCert[] = [];

  // current placements
  for (const p of plants) if (p.projectId) book(p, p.projectId, p.onHire ?? addDays(TODAY, -70), addDays(TODAY, p.type === "scaffold" || p.type === "tower_crane" ? 150 : 30), "ประจำหน้างาน", "ศิริพร ตั้งเจริญ");
  // mobile crane & concrete pump trips (the pump is double-booked in two days)
  const crane = byName("รถเครน 25 ตัน");
  const pump = byName("ปั๊มคอนกรีตบูม 36 ม.");
  book(crane, "HC-2026-06", addDays(TODAY, -40), addDays(TODAY, -39), "ยกโครงถักหลังคา", "ธีรวัฒน์ บุญมา");
  book(crane, "HC-2026-07", addDays(TODAY, 6), addDays(TODAY, 7), "ยกโครงถักหลังคาสำเร็จรูป", "ธีรวัฒน์ บุญมา");
  book(pump, "HC-2026-05", addDays(TODAY, -12), addDays(TODAY, -12), "เทพื้นชั้น 2", "วรเชษฐ์ อินทรประเสริฐ");
  book(pump, "HC-2025-03", addDays(TODAY, -5), addDays(TODAY, -5), "เทพื้นดาดฟ้า โซน A", "วรเชษฐ์ อินทรประเสริฐ");
  book(pump, "HC-2026-07", addDays(TODAY, 2), addDays(TODAY, 2), "เทคานคอดินและพื้นชั้น 1", "ธีรวัฒน์ บุญมา");
  book(pump, "HC-2026-08", addDays(TODAY, 2), addDays(TODAY, 3), "เทฐานรากและตอม่อ", "ศิริพร ตั้งเจริญ");
  book(pump, "HC-2025-03", addDays(TODAY, 9), addDays(TODAY, 9), "เทพื้นดาดฟ้า โซน B", "วรเชษฐ์ อินทรประเสริฐ");

  // operators
  const condo = crew("HC-2025-03");
  const craneOps = [condo[3], condo[4]];
  const hoistOp = condo[10] ?? condo[2]; // no crane certificate → warning on the usage log
  const opFor = (p: Plant, d: string) => {
    if (p.type === "tower_crane") return craneOps[Number(d.slice(8)) % 2];
    if (p.type === "hoist") return hoistOp;
    if (p.type === "mobile_crane") return undefined;
    const c = crew(p.projectId ?? "");
    return c[1] ?? c[0];
  };
  // usage on workdays for the last 70 days
  const start = addDays(TODAY, -70);
  for (const p of plants) {
    if (!p.projectId && p.type !== "mobile_crane" && p.type !== "concrete_pump") continue;
    for (let d = start; d < TODAY; d = addDays(d, 1)) {
      if (!isWorkday(d)) continue;
      if (p.type === "mobile_crane" || p.type === "concrete_pump") {
        const b = bookings.find((x) => x.plantId === p.id && x.from <= d && x.to >= d && x.projectId);
        if (!b) continue;
        usage.push({ id: `PU-${p.id}-${d}`, plantId: p.id, projectId: b.projectId, date: d, hours: p.type === "concrete_pump" ? int(rnd, 4, 7) : int(rnd, 6, 9), fuelL: p.type === "concrete_pump" ? int(rnd, 40, 70) : int(rnd, 60, 90), operatorName: p.type === "mobile_crane" ? "นายประยูร คำดี (คนขับของผู้ให้เช่า)" : "คนขับของผู้ให้เช่า" });
        continue;
      }
      if (p.onHire && d < p.onHire) continue;
      if (p.status === "breakdown" && d >= addDays(TODAY, -2)) continue;
      const light = p.type === "vibrator" || p.type === "compactor" || p.type === "welder";
      if (light && rnd() < 0.45) continue;
      if ((p.type === "excavator" || p.type === "backhoe") && rnd() < 0.2) continue;
      const hours = p.type === "scaffold" ? 8 : p.type === "tower_crane" ? int(rnd, 6, 9) : p.type === "hoist" ? int(rnd, 4, 8) : light ? int(rnd, 2, 5) : p.type === "generator" ? int(rnd, 6, 10) : int(rnd, 3, 8);
      const fuelL = p.type === "excavator" ? Math.round(hours * (p.name.includes("PC30") ? 3.5 : 7.5)) : p.type === "backhoe" ? Math.round(hours * 6) : p.type === "generator" ? Math.round(hours * (p.name.includes("60") ? 9 : 3.5)) : p.type === "compactor" ? 2 : 0;
      const op = opFor(p, d);
      usage.push({ id: `PU-${p.id}-${d}`, plantId: p.id, projectId: p.projectId!, date: d, hours, fuelL, operatorId: op?.id, operatorName: p.type === "scaffold" ? "-" : (op?.name ?? "-") });
    }
  }

  // maintenance
  let m = 0;
  const mt = (p: Plant, kind: PlantMaint["kind"], title: string, date: string, done: boolean, cost?: number, extra: Partial<PlantMaint> = {}) => maint.push({ id: `PMT-2026-${pad(++m)}`, plantId: p.id, kind, title, date, doneAt: done ? date : undefined, cost, by: "สมพงษ์ แสงอรุณ", photos: [], ...extra });
  const pc70 = byName("รถขุด PC70");
  mt(pc70, "service", "เปลี่ยนน้ำมันเครื่อง กรองน้ำมัน กรองอากาศ (6,750 ชม.)", addDays(TODAY, -21), true, 6800, { meterHours: 6750 });
  mt(pc70, "service", "บำรุงรักษา 7,000 ชม.: น้ำมันไฮดรอลิก", addDays(TODAY, 18), false, undefined, { meterHours: 7000 });
  const jcb = byName("รถแบ็คโฮ JCB 3CX");
  mt(jcb, "service", "เปลี่ยนน้ำมันเครื่อง อัดจารบี (4,250 ชม.)", addDays(TODAY, -34), true, 5200, { meterHours: 4250 });
  mt(byName("ทาวเวอร์เครน TC-01"), "service", "ตรวจเช็กประจำเดือนโดยผู้ให้เช่า: สลิง เบรก ลิมิตสวิตช์", addDays(TODAY, -6), true, 0);
  mt(byName("ทาวเวอร์เครน TC-01"), "service", "ตรวจเช็กประจำเดือนโดยผู้ให้เช่า", addDays(TODAY, 24), false);
  mt(byName("เครื่องกำเนิดไฟฟ้า 60 kVA"), "service", "เปลี่ยนน้ำมันเครื่องและไส้กรอง (3,000 ชม.)", addDays(TODAY, -45), true, 3400, { meterHours: 3000 });
  mt(byName("รถขุดเล็ก PC30"), "breakdown", "สายไฮดรอลิกบูมแตก น้ำมันรั่ว", addDays(TODAY, -2), false, undefined, { downtimeDays: 2 });
  mt(byName("เครื่องตบดิน CP-01"), "repair", "เปลี่ยนสปริงและหัวเทียน", addDays(TODAY, -16), true, 1250, { downtimeDays: 1 });

  // certificates
  let c = 0;
  const cert = (p: Plant, kind: PlantCert["kind"], issuedAt: string, expiry: string, loadTestT?: number) =>
    certs.push({ id: `PCT-2026-${pad(++c)}`, plantId: p.id, kind, issuedAt, expiry, inspector: kind === "scaffold_engineer" ? "นายวิศรุต ช่างคิด (วิศวกรโยธา)" : "นายอนุพงษ์ ยกได้ (วิศวกรเครื่องกล)", licenseNo: kind === "scaffold_engineer" ? "สย. 24581" : "สก. 11872", ref: `${kind === "scaffold_engineer" ? "SCF" : "ปจ.2"}-${int(rnd, 1000, 9999)}`, loadTestT, result: "pass", attachments: [] });
  const tc = byName("ทาวเวอร์เครน TC-01");
  cert(tc, "crane_load_test", "2025-12-10", addMonths("2025-12-10", 12), 6.25);
  cert(tc, "crane_periodic", "2026-05-12", addMonths("2026-05-12", 3));
  cert(tc, "crane_periodic", "2026-08-12", addMonths("2026-08-12", 3)); // expires in 8 days
  cert(byName("ลิฟต์ขนส่งวัสดุ HS-01"), "crane_periodic", "2026-05-20", addMonths("2026-05-20", 6));
  cert(crane, "crane_periodic", "2026-09-01", addMonths("2026-09-01", 3));
  cert(byName("นั่งร้านเฟรม ชุด N (22 ม.)"), "scaffold_engineer", "2026-05-16", addMonths("2026-05-16", 6));
  cert(byName("นั่งร้านเฟรม ชุด S (22 ม.)"), "scaffold_engineer", "2026-08-20", addMonths("2026-08-20", 6));

  return { plants, bookings, usage, maint, certs };
}

let cache: ReturnType<typeof gen> | null = null;
const g = () => (cache ??= gen());
export const seedPlants = () => g().plants;
export const seedBookings = () => g().bookings;
export const seedUsage = () => g().usage;
export const seedMaint = () => g().maint;
export const seedPlantCerts = () => g().certs;
export const seedPlantSettings = (): PlantSettings[] => [{ ...DEFAULT_PLANT, craneIntervals: DEFAULT_PLANT.craneIntervals.map((r) => ({ ...r })) }];
