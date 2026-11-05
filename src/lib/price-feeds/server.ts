import "server-only";

// Server-side fetchers for the MOC open-data API (used by /api/prices/moc/*). Results are cached with
// `use cache` (monthly data → cacheLife "days"); failures are thrown, so they are never cached.
// Tested from this machine on 2026-11-05: dataapi.moc.go.th answers very slowly (≈ 40–60 s) and often
// with HTTP 500/504; csi-indexes answered once (2024, 38 s), csi-product-indexes only returned 500.

import { cacheLife } from "next/cache";
import { buildCatalog, MOC_API, MOC_PRODUCTS_URL, normaliseMocIndex, normaliseMocPrices, type MocIndexPoint, type MocPrice, type MocProduct } from "./moc";
import snapshot from "./moc-products.json";

export const MOC_TIMEOUT_MS = 55_000;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36 asbuilt";

export class MocError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}

/** after a timeout the host is skipped for a few minutes so a sync doesn't wait 55 s per request */
let downUntil = 0;
export const mocDown = () => Date.now() < downUntil;

async function getJson(url: string): Promise<unknown> {
  if (mocDown()) throw new MocError("ระบบของกระทรวงพาณิชย์ไม่ตอบสนองเมื่อสักครู่ ลองใหม่ในอีกไม่กี่นาที หรือใช้การนำเข้าจากไฟล์", 503);
  let res: Response;
  try {
    res = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" }, signal: AbortSignal.timeout(MOC_TIMEOUT_MS), cache: "no-store" });
  } catch (e) {
    const name = (e as Error)?.name;
    if (name === "TimeoutError" || name === "AbortError") {
      downUntil = Date.now() + 3 * 60_000;
      throw new MocError(`ติดต่อ dataapi.moc.go.th ไม่ได้ภายใน ${MOC_TIMEOUT_MS / 1000} วินาที (เซิร์ฟเวอร์ของกระทรวงพาณิชย์ช้าหรือปิดรับจากต่างประเทศ)`, 504);
    }
    throw new MocError(`ติดต่อ dataapi.moc.go.th ไม่ได้: ${(e as Error)?.message ?? e}`, 502);
  }
  const text = await res.text();
  if (!res.ok) throw new MocError(`ระบบของกระทรวงพาณิชย์ตอบกลับข้อผิดพลาด HTTP ${res.status}${res.status >= 500 ? " (ฝั่งผู้ให้บริการขัดข้อง ลองใหม่ภายหลัง)" : ""}`, res.status === 404 ? 404 : 502);
  try {
    return JSON.parse(text);
  } catch {
    throw new MocError("ระบบของกระทรวงพาณิชย์ตอบกลับไม่ใช่ข้อมูล JSON", 502);
  }
}

const qs = (p: Record<string, string | number>) => new URLSearchParams(Object.entries(p).map(([k, v]) => [k, String(v)])).toString();

/** prices for one com_code in one province, CE years */
export async function mocPrices(comCode: string, provinceCode: string, fromYear: number, toYear: number): Promise<MocPrice[]> {
  "use cache";
  cacheLife("days");
  const raw = await getJson(`${MOC_API}/csi-product-indexes?${qs({ com_code: comCode, province_code: provinceCode, from_year: fromYear, to_year: toYear })}`);
  return normaliseMocPrices(raw);
}

/** construction-material price index (CMI) for one group */
export async function mocIndex(indexId: string, fromYear: number, toYear: number): Promise<MocIndexPoint[]> {
  "use cache";
  cacheLife("days");
  const raw = await getJson(`${MOC_API}/csi-indexes?${qs({ index_id: indexId, from_year: fromYear, to_year: toYear })}`);
  return normaliseMocIndex(raw);
}

type Snapshot = { fetchedAt: string; source: string; count: number; rows: [string, string, string?][] };

/** product catalogue: the live list from data.moc.go.th (works from abroad), else the bundled snapshot */
export async function mocProducts(): Promise<{ products: MocProduct[]; from: "live" | "snapshot"; fetchedAt: string }> {
  "use cache";
  cacheLife("weeks");
  try {
    const res = await fetch(MOC_PRODUCTS_URL, { headers: { "user-agent": UA, accept: "application/json" }, signal: AbortSignal.timeout(20_000) });
    if (res.ok) {
      const rows = (await res.json()) as { id: string; name: string }[];
      if (Array.isArray(rows) && rows.length > 1000) return { products: buildCatalog(rows), from: "live", fetchedAt: new Date().toISOString().slice(0, 10) };
    }
  } catch {
    // fall back to the snapshot
  }
  const s = snapshot as unknown as Snapshot;
  return { products: buildCatalog(s.rows), from: "snapshot", fetchedAt: s.fetchedAt };
}

/** run tasks with a small concurrency (the MOC server copes badly with parallel calls) */
export async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    }),
  );
  return out;
}
