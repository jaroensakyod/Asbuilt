// GET /api/prices/moc/products — MOC construction-material product codes (com_code) for the
// "เชื่อมรหัส พณ." mapping: the live list from data.moc.go.th when reachable, else the bundled
// snapshot (src/lib/price-feeds/moc-products.json, fetched 2026-11-05). Cached for a week.

import { mocProducts } from "@/lib/price-feeds/server";
import { requireUser } from "@/lib/price-feeds/route-auth";

export async function GET() {
  const denied = await requireUser();
  if (denied) return denied;
  const data = await mocProducts();
  return Response.json(data, { headers: { "cache-control": "private, max-age=86400" } });
}
