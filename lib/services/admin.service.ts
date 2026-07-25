import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { STAFF_ROLES, type StaffRole } from "@/lib/constants";
import { sanitize, isValidEmail } from "@/lib/utils";
import { syncStaffMetadata } from "@/lib/staff-metadata";

export async function listStaff() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("staff")
    .select("id, first_name, last_name, email, role, is_active, created_at")
    .order("last_name");
  return data ?? [];
}

export async function registerStaff(params: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: string;
  requestingUserId: string;
  ip: string;
}) {
  const supabase = createAdminClient();
  const emailNorm = params.email.trim().toLowerCase();
  const role = params.role.trim().toLowerCase();

  if (!(STAFF_ROLES as readonly string[]).includes(role)) {
    return {
      error: `Invalid role. Must be one of: ${STAFF_ROLES.join(", ")}`,
      status: 400 as const,
    };
  }

  const { data: existing } = await supabase
    .from("staff")
    .select("id")
    .eq("email", emailNorm)
    .maybeSingle();
  if (existing) {
    return { error: "Email already registered", status: 409 as const };
  }

  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: emailNorm,
    password: params.password,
    email_confirm: true,
    user_metadata: {
      first_name: params.firstName,
      last_name: params.lastName,
    },
  });

  if (authError) {
    const msg = authError.message.toLowerCase();
    if (msg.includes("already registered") || msg.includes("already been registered")) {
      return { error: "A user with this email already exists.", status: 409 as const };
    }
    return { error: authError.message, status: 500 as const };
  }

  const { error: staffError } = await supabase.from("staff").upsert({
    id: authUser.user.id,
    first_name: params.firstName.trim(),
    last_name: params.lastName.trim(),
    email: emailNorm,
    role,
    is_active: true,
  });

  if (staffError) {
    await supabase.auth.admin.deleteUser(authUser.user.id);
    return {
      error: "Failed to create staff profile. Please try again.",
      status: 500 as const,
    };
  }

  await syncStaffMetadata({
    userId: authUser.user.id,
    firstName: params.firstName.trim(),
    lastName: params.lastName.trim(),
    role: role as StaffRole,
    isActive: true,
  });

  void logAudit({
    userId: params.requestingUserId,
    action: "staff_create",
    tableName: "staff",
    recordId: authUser.user.id,
    ipAddress: params.ip,
  });

  return { success: true as const, staff_id: authUser.user.id };
}

export async function updateStaff(params: {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  requestingUserId: string;
  ip: string;
}) {
  const supabase = createAdminClient();
  const firstName = sanitize(params.firstName, 100);
  const lastName = sanitize(params.lastName, 100);
  const emailRaw = sanitize(params.email, 254).toLowerCase();
  const role = sanitize(params.role, 30).toLowerCase();

  if (!isValidEmail(emailRaw)) {
    return { error: "Invalid email address", status: 400 as const };
  }
  if (!(STAFF_ROLES as readonly string[]).includes(role)) {
    return {
      error: `Invalid role. Must be one of: ${STAFF_ROLES.join(", ")}`,
      status: 400 as const,
    };
  }

  const { data: dup } = await supabase
    .from("staff")
    .select("id")
    .eq("email", emailRaw)
    .neq("id", params.id)
    .maybeSingle();
  if (dup) {
    return { error: "Email already in use by another staff member", status: 409 as const };
  }

  const { error } = await supabase
    .from("staff")
    .update({
      first_name: firstName,
      last_name: lastName,
      email: emailRaw,
      role,
    })
    .eq("id", params.id);

  if (error) {
    return { error: "Update failed", status: 500 as const };
  }

  const { data: activeRow } = await supabase
    .from("staff")
    .select("is_active")
    .eq("id", params.id)
    .single();

  await syncStaffMetadata({
    userId: params.id,
    firstName,
    lastName,
    role: role as StaffRole,
    isActive: activeRow?.is_active ?? true,
  });

  void logAudit({
    userId: params.requestingUserId,
    action: "staff_update",
    tableName: "staff",
    recordId: params.id,
    ipAddress: params.ip,
  });

  return { success: true as const };
}

export async function toggleStaffActive(params: {
  id: string;
  requestingUserId: string;
  ip: string;
}) {
  if (params.id === params.requestingUserId) {
    return { error: "You cannot deactivate your own account", status: 400 as const };
  }

  const supabase = createAdminClient();
  const { data: current } = await supabase
    .from("staff")
    .select("is_active, first_name, last_name, role")
    .eq("id", params.id)
    .single();

  if (!current) {
    return { error: "Staff member not found", status: 404 as const };
  }

  const newActive = !(current.is_active ?? true);
  const { error: updateError } = await supabase
    .from("staff")
    .update({ is_active: newActive })
    .eq("id", params.id);

  if (updateError) {
    return { error: "Failed to update staff status", status: 500 as const };
  }

  const { data: confirmed } = await supabase
    .from("staff")
    .select("is_active")
    .eq("id", params.id)
    .single();

  const confirmedActive = confirmed?.is_active ?? newActive;

  // Auth updateUserById (via syncStaffMetadata) was observed to flip staff.is_active
  // back to true within ~10s after a successful deactivate. Skip metadata sync on
  // deactivate; LoginForm + getStaffSession read staff.is_active from DB.
  // On activate, sync metadata so staff_active becomes true again.
  if (confirmedActive) {
    await syncStaffMetadata({
      userId: params.id,
      firstName: current.first_name,
      lastName: current.last_name,
      role: current.role as StaffRole,
      isActive: true,
    });
  }

  void logAudit({
    userId: params.requestingUserId,
    action: "staff_toggle",
    tableName: "staff",
    recordId: params.id,
    ipAddress: params.ip,
  });

  return { success: true as const, is_active: confirmedActive };
}

export async function listDisplayScreens() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("display_settings")
    .select("id, display_name, location, show_wait_time, show_priority, theme_color, is_active")
    .order("id");
  return data ?? [];
}

export async function addDisplayScreen(
  body: {
    display_name: string;
    location: string;
    show_wait_time?: boolean;
    show_priority?: boolean;
    theme_color?: string;
  },
  audit: { userId: string; ip: string }
) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("display_settings")
    .insert({
      display_name: body.display_name,
      location: body.location,
      show_wait_time: body.show_wait_time ?? true,
      show_priority: body.show_priority ?? true,
      theme_color: body.theme_color ?? "#004ac6",
      is_active: true,
    })
    .select("id")
    .single();
  if (error) return { error: error.message, status: 500 as const };
  void logAudit({
    userId: audit.userId,
    action: "display_add",
    tableName: "display_settings",
    recordId: data.id,
    ipAddress: audit.ip,
    newValues: body,
  });
  return { success: true as const, id: data.id };
}

export async function toggleDisplayScreen(
  id: number,
  audit: { userId: string; ip: string }
) {
  const supabase = createAdminClient();
  const { data: current } = await supabase
    .from("display_settings")
    .select("is_active")
    .eq("id", id)
    .single();

  const newActive = !(current?.is_active ?? true);
  await supabase.from("display_settings").update({ is_active: newActive }).eq("id", id);
  void logAudit({
    userId: audit.userId,
    action: "display_toggle",
    tableName: "display_settings",
    recordId: id,
    ipAddress: audit.ip,
    newValues: { is_active: newActive },
  });
  return { success: true as const, is_active: newActive };
}

export async function updateDisplayScreen(
  body: {
    id: number;
    display_name: string;
    location: string;
    show_wait_time?: boolean;
    show_priority?: boolean;
    theme_color?: string;
    is_active?: boolean;
  },
  audit: { userId: string; ip: string }
) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("display_settings")
    .update({
      display_name: body.display_name,
      location: body.location,
      show_wait_time: body.show_wait_time ?? true,
      show_priority: body.show_priority ?? true,
      theme_color: body.theme_color ?? "#004ac6",
      is_active: body.is_active ?? true,
    })
    .eq("id", body.id);
  if (error) return { error: error.message, status: 500 as const };
  void logAudit({
    userId: audit.userId,
    action: "display_update",
    tableName: "display_settings",
    recordId: body.id,
    ipAddress: audit.ip,
    newValues: body,
  });
  return { success: true as const };
}

export async function deleteDisplayScreen(
  id: number,
  audit: { userId: string; ip: string }
) {
  const supabase = createAdminClient();
  await supabase.from("display_settings").delete().eq("id", id);
  void logAudit({
    userId: audit.userId,
    action: "display_delete",
    tableName: "display_settings",
    recordId: id,
    ipAddress: audit.ip,
  });
  return { success: true as const };
}
