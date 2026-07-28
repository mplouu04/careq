import { createClient } from "@supabase/supabase-js";
import { getEnvSafe } from "@/lib/env";

/**
 * Service-role client for API routes (bypasses RLS). Never expose to the browser.
 *
 * Important: Next.js App Router patches global `fetch` and can cache GET requests
 * to PostgREST across invocations. That produced stale `/api/doctors` responses
 * (is_active=false) while SQL + `/api/admin/staff` already showed true — CDN
 * headers were MISS/no-store, so the bug was the Data Cache on the Supabase
 * HTTP call itself. Force `cache: 'no-store'` on every admin-client fetch.
 */
export function createAdminClient() {
  const env = getEnvSafe();
  const url = env?.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env?.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase admin credentials");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          cache: "no-store",
        }),
    },
  });
}
