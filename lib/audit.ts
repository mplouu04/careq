import { createAdminClient } from "@/lib/supabase/admin";

export async function logAudit(params: {
  userId?: string | null;
  action: string;
  tableName: string;
  recordId?: number | null;
  oldValues?: unknown;
  newValues?: unknown;
  ipAddress?: string | null;
}) {
  const supabase = createAdminClient();
  await supabase.from("audit_log").insert({
    user_id: params.userId ?? null,
    action: params.action,
    table_name: params.tableName,
    record_id: params.recordId ?? null,
    old_values: params.oldValues ? JSON.stringify(params.oldValues) : null,
    new_values: params.newValues ? JSON.stringify(params.newValues) : null,
    ip_address: params.ipAddress ?? null,
  });
}
