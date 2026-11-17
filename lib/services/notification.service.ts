import { createAdminClient } from "@/lib/supabase/admin";

export type NotificationCategory =
  | "general"
  | "appointment_confirmation"
  | "appointment_approval"
  | "appointment_cancellation"
  | "appointment_reminder"
  | "queue_update"
  | "announcement";

export async function createNotification(params: {
  patientId: number;
  title: string;
  body: string;
  category?: NotificationCategory;
  referenceNumber?: string | null;
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("notifications")
    .insert({
      patient_id: params.patientId,
      title: params.title,
      body: params.body,
      category: params.category ?? "general",
      reference_number: params.referenceNumber ?? null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[createNotification] failed", error);
    return { error: "Failed to create notification", status: 500 as const };
  }
  return { success: true as const, id: data.id as number };
}

export async function listForPatientIds(patientIds: number[]) {
  if (!patientIds.length) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("notifications")
    .select(
      "id, title, body, category, reference_number, is_read, created_at"
    )
    .in("patient_id", patientIds)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[listForPatientIds] failed", error);
    return [];
  }
  return data ?? [];
}

export async function markRead(notificationId: number, patientIds: number[]) {
  if (!patientIds.length) {
    return { error: "Not found", status: 404 as const };
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .in("patient_id", patientIds)
    .select("id")
    .maybeSingle();

  if (error) {
    return { error: "Update failed", status: 500 as const };
  }
  if (!data) {
    return { error: "Not found", status: 404 as const };
  }
  return { success: true as const };
}