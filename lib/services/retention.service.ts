import { createAdminClient } from "@/lib/supabase/admin";
import { getEnvSafe } from "@/lib/env";
import { logInfo } from "@/lib/observability";

export async function purgeOldLogs(retentionDays?: number) {
  const env = getEnvSafe();
  const days = retentionDays ?? env?.RETENTION_DAYS ?? 90;

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("purge_old_logs", { p_days: days });

  if (error) {
    throw new Error(`purge_old_logs failed: ${error.message}`);
  }

  const row = Array.isArray(data) ? data[0] : data;
  const rateLimitsDeleted = Number(row?.rate_limits_deleted ?? 0);
  const auditDeleted = Number(row?.audit_deleted ?? 0);

  logInfo("retention_purge", {
    retention_days: days,
    rate_limits_deleted: rateLimitsDeleted,
    audit_deleted: auditDeleted,
  });

  return {
    retention_days: days,
    rate_limits_deleted: rateLimitsDeleted,
    audit_deleted: auditDeleted,
  };
}
