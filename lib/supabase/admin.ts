import { createClient } from "@supabase/supabase-js";
import { getEnvSafe } from "@/lib/env";

/** Service-role client for API routes (bypasses RLS). Never expose to the browser. */
export function createAdminClient() {
  const env = getEnvSafe();
  const url = env?.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env?.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase admin credentials");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
