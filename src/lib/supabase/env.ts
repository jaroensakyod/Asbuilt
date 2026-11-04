// Live mode (login + Supabase data) is on when the Supabase URL and public key
// are configured and NEXT_PUBLIC_ASBUILT_MODE is not "demo".
// Demo mode runs on the bundled sample data with no login.

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const FORCE_DEMO = process.env.NEXT_PUBLIC_ASBUILT_MODE === "demo";
export const LIVE = Boolean(SUPABASE_URL && SUPABASE_KEY) && !FORCE_DEMO;
