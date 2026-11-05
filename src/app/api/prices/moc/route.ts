// GET /api/prices/moc?com=<com_code,…>&province=<code>&from=<CE year>&to=<CE year>
// Proxy to dataapi.moc.go.th csi-product-indexes (ราคาวัสดุก่อสร้างรายจังหวัด). One upstream call per
// com_code (max 12 per request, 2 at a time), cached per code/province/years for a day.
// Returns { prices: MocPrice[], errors: { comCode, error }[] } — 207-style partial results with 200.

import { MocError, mocDown, mocPrices, pool } from "@/lib/price-feeds/server";
import { intParam, requireUser } from "@/lib/price-feeds/route-auth";
import { TODAY } from "@/lib/data";

export const maxDuration = 300;
const MAX_CODES = 12;

export async function GET(request: Request) {
  const denied = await requireUser();
  if (denied) return denied;
  const url = new URL(request.url);
  const codes = [...new Set((url.searchParams.get("com") ?? "").split(",").map((s) => s.trim()).filter((s) => /^\d{16}$/.test(s)))];
  const province = (url.searchParams.get("province") ?? "10").padStart(2, "0");
  const year = Number(TODAY.slice(0, 4));
  const from = intParam(url.searchParams.get("from"), year);
  const to = intParam(url.searchParams.get("to"), year);
  if (!codes.length) return Response.json({ error: "ต้องระบุรหัสสินค้า (com) อย่างน้อย 1 รหัส 16 หลัก" }, { status: 400 });
  if (codes.length > MAX_CODES) return Response.json({ error: `ส่งได้ครั้งละไม่เกิน ${MAX_CODES} รหัส` }, { status: 400 });
  if (!/^\d{2}$/.test(province)) return Response.json({ error: "รหัสจังหวัดไม่ถูกต้อง" }, { status: 400 });

  const errors: { comCode: string; error: string; status?: number }[] = [];
  const results = await pool(codes, 2, async (c) => {
    try {
      return await mocPrices(c, province, Math.min(from, to), Math.max(from, to));
    } catch (e) {
      errors.push({ comCode: c, error: e instanceof Error ? e.message : String(e), status: e instanceof MocError ? e.status : 502 });
      return [];
    }
  });
  const prices = results.flat();
  if (!prices.length && errors.length === codes.length) {
    const status = errors.some((e) => e.status === 504 || e.status === 503) ? 504 : 502;
    return Response.json({ error: errors[0].error, errors, down: mocDown() }, { status });
  }
  return Response.json({ prices, errors, fetchedAt: new Date().toISOString() });
}
