import { createAdminClient } from "@/lib/supabase/admin";

export const DEFAULT_NO_SHOW_GRACE_MINUTES = 5;
export const NO_SHOW_GRACE_KEY = "no_show_grace_minutes";

const MIN_GRACE = 1;
const MAX_GRACE = 60;

export function clampGraceMinutes(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_NO_SHOW_GRACE_MINUTES;
  return Math.min(MAX_GRACE, Math.max(MIN_GRACE, Math.round(value)));
}

export async function getNoShowGraceMinutes(): Promise<number> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("clinic_settings")
    .select("value")
    .eq("setting_key", NO_SHOW_GRACE_KEY)
    .maybeSingle();

  const n = Number(data?.value);
  return clampGraceMinutes(n);
}

export async function setNoShowGraceMinutes(minutes: number): Promise<number> {
  const clamped = clampGraceMinutes(minutes);
  const supabase = createAdminClient();
  const { error } = await supabase.from("clinic_settings").upsert(
    {
      setting_key: NO_SHOW_GRACE_KEY,
      value: String(clamped),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "setting_key" }
  );
  if (error) throw new Error(error.message);
  return clamped;
}
