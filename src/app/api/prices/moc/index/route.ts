// GET /api/prices/moc/index?ids=<index_id,…>&from=<CE year>&to=<CE year>
// Proxy to dataapi.moc.go.th csi-indexes (ดัชนีราคาวัสดุก่อสร้าง CMI รายหมวด) for the ค่า K settings.
// Defaults to all 10 groups of the CMI.

import { CMI_GROUPS } from "@/lib/price-feeds/moc";
import { MocError, mocIndex, pool } from "@/lib/price-feeds/server";
import { intParam, requireUser } from "@/lib/price-feeds/route-auth";
import { TODAY } from "@/lib/data";

export const maxDuration = 300;

export async function GET(request: Request) {
  const denied = await requireUser();
  if (denied) return denied;
  const url = new URL(request.url);
  const all = CMI_GROUPS.map(([id]) => id);
  const ids = (url.searchParams.get("ids") ?? "").split(",").map((s) => s.trim()).filter((s) => all.includes(s));
  const year = Number(TODAY.slice(0, 4));
  const from = intParam(url.searchParams.get("from"), year - 1);
  const to = intParam(url.searchParams.get("to"), year);
  const list = ids.length ? ids : all;
  const errors: { indexId: string; error: string; status?: number }[] = [];
  const results = await pool(list, 2, async (id) => {
    try {
      return await mocIndex(id, Math.min(from, to), Math.max(from, to));
    } catch (e) {
      errors.push({ indexId: id, error: e instanceof Error ? e.message : String(e), status: e instanceof MocError ? e.status : 502 });
      return [];
    }
  });
  const points = results.flat();
  if (!points.length && errors.length) return Response.json({ error: errors[0].error, errors }, { status: errors.some((e) => e.status === 504 || e.status === 503) ? 504 : 502 });
  return Response.json({ points, errors, fetchedAt: new Date().toISOString() });
}
