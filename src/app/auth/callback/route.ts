import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { LIVE, SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env";

// Email links (confirm sign-up, reset password) land here with ?code=…
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const raw = url.searchParams.get("next") ?? "/";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
  const code = url.searchParams.get("code");
  const response = NextResponse.redirect(new URL(next, url.origin));
  if (!LIVE || !code) return response;

  const sb = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  const { error } = await sb.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin));
  return response;
}
