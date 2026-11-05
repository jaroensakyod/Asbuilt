// GET /api/prices/moc/sync — monthly server-side sync for LIVE companies (Vercel Cron).
//
// Auth: header `Authorization: Bearer <CRON_SECRET>` (Vercel Cron sends it when CRON_SECRET is set).
// Needs SUPABASE_SERVICE_ROLE_KEY to read every company's com_code links (records kind
// "price_feed_maps") and settings ("price_feed_settings"), and to upsert "price_obs" + a
// "price_feed_syncs" log row. Demo data lives in the browser, so in demo mode this route only
// explains itself and writes nothing.
//
// vercel.json:  { "crons": [{ "path": "/api/prices/moc/sync", "schedule": "0 3 8 * *" }] }
//   (08:00 Thai time on the 8th — สนค. publishes provincial prices within 5 working days)

import { createClient } from "@supabase/supabase-js";
import { LIVE, SUPABASE_URL } from "@/lib/supabase/env";
import { TODAY } from "@/lib/data";
import { inMonths, lastMonths, mocToObs, planRequests, yearsOf, type ComLink } from "@/lib/price-feeds/moc";
import { mergeObs } from "@/lib/price-feeds/merge";
import { mocDown, mocPrices, pool } from "@/lib/price-feeds/server";
import type { PriceObs } from "@/lib/sales/prices-data";

export const maxDuration = 300;
const BUDGET_MS = 240_000;

type Rec<T> = { company_id: string; id: string; data: T };
type MapRec = { itemCode: string; comCode: string; factor: number };
type SettingsRec = { provinces?: string[]; monthsBack?: number; cron?: boolean };

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  if (secret && auth !== `Bearer ${secret}`) return Response.json({ error: "ไม่ได้รับอนุญาต" }, { status: 401 });
  if (!LIVE)
    return Response.json({
      mode: "demo",
      message: "โหมดสาธิตเก็บข้อมูลไว้ในเบราว์เซอร์ การดึงราคาตามรอบบนเซิร์ฟเวอร์ใช้ได้เฉพาะโหมดใช้งานจริง ให้ใช้ปุ่ม “ดึงราคาจาก พณ.” ในหน้าราคาวัสดุแทน",
      wrote: 0,
    });
  if (!secret) return Response.json({ error: "ต้องตั้งค่า CRON_SECRET ก่อนเปิดใช้การดึงราคาตามรอบ" }, { status: 503 });
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return Response.json({ error: "ต้องตั้งค่า SUPABASE_SERVICE_ROLE_KEY บนเซิร์ฟเวอร์ เพื่อเขียนราคาให้ทุกบริษัท" }, { status: 503 });

  const started = Date.now();
  const sb = createClient(SUPABASE_URL, serviceKey, { auth: { persistSession: false } });
  const [{ data: maps, error: e1 }, { data: sets, error: e2 }] = await Promise.all([
    sb.from("records").select("company_id, id, data").eq("kind", "price_feed_maps"),
    sb.from("records").select("company_id, id, data").eq("kind", "price_feed_settings"),
  ]);
  if (e1 || e2) return Response.json({ error: (e1 ?? e2)!.message }, { status: 500 });

  const byCompany = new Map<string, { links: ComLink[]; settings: SettingsRec }>();
  for (const r of (maps ?? []) as Rec<MapRec>[]) {
    const c = byCompany.get(r.company_id) ?? { links: [], settings: {} };
    if (r.data?.comCode && r.data.factor > 0) c.links.push({ itemCode: r.data.itemCode, comCode: r.data.comCode, factor: r.data.factor });
    byCompany.set(r.company_id, c);
  }
  for (const r of (sets ?? []) as Rec<SettingsRec>[]) {
    const c = byCompany.get(r.company_id);
    if (c && r.id === "moc") c.settings = r.data ?? {};
  }

  const report: { company: string; requests: number; added: number; updated: number; errors: number; partial: boolean }[] = [];
  for (const [company, { links, settings }] of byCompany) {
    if (!links.length || settings.cron === false) continue;
    const { from, to } = lastMonths(TODAY, settings.monthsBack ?? 2);
    const years = yearsOf(from, to);
    const plan = planRequests(links.map((l) => l.comCode), settings.provinces?.length ? settings.provinces : ["กรุงเทพฯ"]);
    let errors = 0;
    let partial = false;
    const got = await pool(plan, 2, async (p) => {
      if (Date.now() - started > BUDGET_MS || mocDown()) {
        partial = true;
        return [];
      }
      try {
        return await mocPrices(p.comCode, p.province, years.from, years.to);
      } catch {
        errors++;
        return [];
      }
    });
    const now = new Date().toISOString();
    const incoming = mocToObs(inMonths(got.flat(), from, to), links, now, "cron");
    const { data: existing } = await sb.from("records").select("data").eq("company_id", company).eq("kind", "price_obs").like("id", "O-%-moc-%");
    const merged = mergeObs(((existing ?? []) as { data: PriceObs }[]).map((r) => r.data), incoming);
    for (let i = 0; i < merged.rows.length; i += 500) {
      const chunk = merged.rows.slice(i, i + 500).map((d) => ({ company_id: company, kind: "price_obs", id: d.id, project_id: null, data: d }));
      const { error } = await sb.from("records").upsert(chunk);
      if (error) errors++;
    }
    const log = { id: `SYNC-${now.replace(/\D/g, "").slice(0, 14)}`, at: now, via: "cron", provinces: settings.provinces ?? ["กรุงเทพฯ"], from, to, requests: plan.length, added: merged.added, updated: merged.updated, errors, status: errors || partial ? (merged.rows.length ? "partial" : "failed") : "ok", by: "ระบบ (ตามรอบ)" };
    await sb.from("records").upsert({ company_id: company, kind: "price_feed_syncs", id: log.id, project_id: null, data: log });
    report.push({ company, requests: plan.length, added: merged.added, updated: merged.updated, errors, partial });
  }
  return Response.json({ mode: "live", companies: report.length, report, ms: Date.now() - started });
}
