"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { LIVE, SUPABASE_KEY, SUPABASE_URL } from "./env";

let client: SupabaseClient | null = null;

/** Browser Supabase client (cookie-based session shared with the server). Null in demo mode. */
export function supabase(): SupabaseClient | null {
  if (!LIVE) return null;
  if (!client) client = createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
  return client;
}
