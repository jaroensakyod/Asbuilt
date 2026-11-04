import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { LIVE, SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env";

const PUBLIC = ["/login", "/signup", "/auth", "/invite", "/reset-password", "/portal"];

// Refreshes the Supabase session cookie on every request and sends signed-out
// visitors to /login. In demo mode (no Supabase env) it does nothing.
export async function proxy(request: NextRequest) {
  if (!LIVE) return NextResponse.next();

  let response = NextResponse.next({ request });
  const sb = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });

  const {
    data: { user },
  } = await sb.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC.some((p) => path === p || path.startsWith(p + "/"));
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = path === "/" ? "" : `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\.(?:png|jpg|jpeg|svg|webp|ico|txt)$).*)"],
};
