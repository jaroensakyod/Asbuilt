// SaaS plans and limits. Prices are placeholders ("ราคาตัวอย่าง") until pricing is set.
// The chosen plan is stored in the collection "subscription" (one record, id "current").
// No payment is taken anywhere in the app: changing plan only records the choice.
//
// Other pages can enforce limits with seatLimit() / projectLimit() / storageLimitGb(),
// e.g.  if (activeProjects >= projectLimit()) show an upgrade note.

import { createCollection } from "./collection";
import { TODAY } from "./data";

export type PlanId = "starter" | "pro" | "enterprise";
export type BillingCycle = "monthly" | "yearly";

export type Plan = {
  id: PlanId;
  name: string;
  tagline: string;
  /** ฿ per month, excl. VAT — placeholder */
  price: number;
  seats: number; // Infinity = unlimited
  projects: number; // active (not delivered) projects
  storageGb: number;
  features: string[];
};

export const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    tagline: "บริษัทเล็ก เริ่มใช้งานระบบ",
    price: 1490,
    seats: 5,
    projects: 10,
    storageGb: 20,
    features: ["โครงการ แบบบ้าน และเอกสาร", "ตรวจงาน แจ้งซ่อม ใบสั่งงาน", "พอร์ทัลเจ้าของบ้าน"],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "บริษัทรับสร้างบ้านที่มีหลายไซต์",
    price: 4900,
    seats: 25,
    projects: 60,
    storageGb: 200,
    features: ["ทุกอย่างใน Starter", "ขาย ใบเสนอราคา ประเมินราคา BOQ", "จัดซื้อ คลัง ต้นทุนโครงการ", "บัญชี ภาษี เงินเดือน", "แดชบอร์ดผู้บริหาร"],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "หลายสาขา ต้องการการดูแลเฉพาะ",
    price: 12900,
    seats: Infinity,
    projects: Infinity,
    storageGb: 1000,
    features: ["ทุกอย่างใน Pro", "ผู้ใช้และโครงการไม่จำกัด", "สำรองข้อมูลรายวันแยกบริษัท", "ผู้ดูแลลูกค้าเฉพาะ และ SLA การตอบกลับ"],
  },
];

export const PRICE_NOTE = "ราคาตัวอย่าง ยังไม่ใช่ราคาจริง";
export const YEARLY_DISCOUNT = 0.15;
export const VAT_RATE = 0.07;

export const planOf = (id: PlanId | undefined): Plan => PLANS.find((p) => p.id === id) ?? PLANS[0];
export const planRank = (id: PlanId) => PLANS.findIndex((p) => p.id === id);

export type SubscriptionChange = { date: string; from: PlanId | null; to: PlanId; cycle: BillingCycle; by: string };
export type Subscription = {
  id: "current";
  plan: PlanId;
  cycle: BillingCycle;
  since: string; // current plan start
  started: string; // first subscribed
  history: SubscriptionChange[];
};

const SEED: Subscription[] = [
  {
    id: "current",
    plan: "pro",
    cycle: "monthly",
    since: "2026-03-01",
    started: "2025-11-01",
    history: [
      { date: "2025-11-01", from: null, to: "starter", cycle: "monthly", by: "ณัฐวุฒิ พงษ์ไพบูลย์" },
      { date: "2026-03-01", from: "starter", to: "pro", cycle: "monthly", by: "ณัฐวุฒิ พงษ์ไพบูลย์" },
    ],
  },
];

export const subscription = createCollection<Subscription>("subscription", SEED);

/** Default when a company has no subscription record yet (new live company) */
const DEFAULT_PLAN: PlanId = "starter";

export const currentSubscription = (): Subscription | undefined => subscription.get("current");
export const currentPlanId = (): PlanId => currentSubscription()?.plan ?? DEFAULT_PLAN;

/** Hook: the company's current plan (re-renders on change) */
export function useCurrentPlan(): { plan: Plan; sub: Subscription | undefined } {
  const list = subscription.use();
  const sub = list.find((s) => s.id === "current");
  return { plan: planOf(sub?.plan ?? DEFAULT_PLAN), sub };
}

export const seatLimit = (id: PlanId = currentPlanId()) => planOf(id).seats;
export const projectLimit = (id: PlanId = currentPlanId()) => planOf(id).projects;
export const storageLimitGb = (id: PlanId = currentPlanId()) => planOf(id).storageGb;

export const priceFor = (p: Plan, cycle: BillingCycle) => (cycle === "yearly" ? Math.round(p.price * 12 * (1 - YEARLY_DISCOUNT)) : p.price);
export const limitText = (n: number, unit = "") => (Number.isFinite(n) ? `${n.toLocaleString("th-TH")}${unit}` : "ไม่จำกัด");

export type Usage = { seats: number; projects: number; storageGb: number };

/** Which limits of a plan the current usage would exceed (blocks a downgrade) */
export function overLimits(p: Plan, u: Usage): string[] {
  const out: string[] = [];
  if (u.seats > p.seats) out.push(`ผู้ใช้ ${u.seats} คน เกินสิทธิ์ ${limitText(p.seats)} คน`);
  if (u.projects > p.projects) out.push(`โครงการที่ดำเนินอยู่ ${u.projects} โครงการ เกินสิทธิ์ ${limitText(p.projects)} โครงการ`);
  if (u.storageGb > p.storageGb) out.push(`พื้นที่ ${u.storageGb.toFixed(1)} GB เกินสิทธิ์ ${limitText(p.storageGb)} GB`);
  return out;
}

/** Record a plan change (no charge is made) */
export function changePlan(to: PlanId, cycle: BillingCycle, by: string, date = TODAY) {
  const cur = currentSubscription();
  const next: Subscription = {
    id: "current",
    plan: to,
    cycle,
    since: date,
    started: cur?.started ?? date,
    history: [...(cur?.history ?? []), { date, from: cur?.plan ?? null, to, cycle, by }],
  };
  subscription.upsert(next);
  return next;
}

export type DemoInvoice = { no: string; period: string; date: string; plan: PlanId; cycle: BillingCycle; amount: number; vat: number; status: "paid" | "open" };

/** Demo invoice history derived from the subscription history (monthly cycle) */
export function demoInvoices(sub: Subscription | undefined, until = TODAY): DemoInvoice[] {
  if (!sub) return [];
  const out: DemoInvoice[] = [];
  const changes = [...sub.history].sort((a, b) => a.date.localeCompare(b.date));
  if (!changes.length) return out;
  const [y0, m0] = changes[0].date.split("-").map(Number);
  const [y1, m1] = until.split("-").map(Number);
  let n = 0;
  for (let y = y0, m = m0; y < y1 || (y === y1 && m <= m1); m === 12 ? ((m = 1), y++) : m++) {
    const iso = `${y}-${String(m).padStart(2, "0")}-01`;
    const active = [...changes].reverse().find((c) => c.date <= iso) ?? changes[0];
    const p = planOf(active.to);
    if (active.cycle === "yearly" && n > 0 && out.length && out[out.length - 1].cycle === "yearly") {
      const last = out[out.length - 1];
      const [ly, lm] = last.date.split("-").map(Number);
      if ((y - ly) * 12 + (m - lm) < 12) continue;
    }
    n++;
    const amount = priceFor(p, active.cycle);
    out.push({
      no: `ASB-${y}${String(m).padStart(2, "0")}-${String(n).padStart(3, "0")}`,
      period: iso.slice(0, 7),
      date: iso,
      plan: p.id,
      cycle: active.cycle,
      amount,
      vat: Math.round(amount * VAT_RATE * 100) / 100,
      status: iso.slice(0, 7) === until.slice(0, 7) ? "open" : "paid",
    });
  }
  return out.reverse();
}
