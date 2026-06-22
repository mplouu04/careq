import { createAdminClient } from "@/lib/supabase/admin";
import { logWarn } from "@/lib/observability";

export async function logAudit(params: {
  userId?: string | null;
  action: string;
  tableName: string;
  recordId?: string | number | null;
  oldValues?: unknown;
  newValues?: unknown;
  ipAddress?: string | null;
}) {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("audit_log").insert({
      user_id: params.userId ?? null,
      action: params.action,
      table_name: params.tableName,
      record_id: params.recordId ?? null,
      old_values: params.oldValues ? JSON.stringify(params.oldValues) : null,
      new_values: params.newValues ? JSON.stringify(params.newValues) : null,
      ip_address: params.ipAddress ?? null,
    });
    if (error) {
      logWarn("audit_log_insert_failed", {
        action: params.action,
        error: error.message,
      });
    }
  } catch (err) {
    logWarn("audit_log_insert_failed", {
      action: params.action,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
