import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { LIVE, SUPABASE_KEY, SUPABASE_URL } from "./env";

/** Server Supabase client bound to the request cookies. Call inside a request scope (Suspense boundary). */
export async function serverSupabase() {
  if (!LIVE) return null;
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // called from a Server Component: the proxy refreshes cookies instead
        }
      },
    },
  });
}
