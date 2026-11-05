import "server-only";

import { serverSupabase } from "@/lib/supabase/server";
import { LIVE } from "@/lib/supabase/env";

/** live mode: a signed-in user is required (same rule as /api/ai). Returns an error Response or null. */
export async function requireUser(): Promise<Response | null> {
  if (!LIVE) return null;
  const sb = await serverSupabase();
  const { data } = (await sb?.auth.getUser()) ?? { data: { user: null } };
  return data.user ? null : Response.json({ error: "ต้องเข้าสู่ระบบก่อน" }, { status: 401 });
}

export const intParam = (v: string | null, def: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 1900 && n < 2700 ? (n > 2400 ? n - 543 : n) : def;
};
