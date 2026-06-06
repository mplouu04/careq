import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { StaffRole } from "@/lib/constants";

export type StaffProfile = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: StaffRole;
  is_active: boolean;
};

export const getStaffSession = cache(async (): Promise<{
  userId: string;
  staff: StaffProfile;
} | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const meta = user.app_metadata ?? {};
  if (
    meta.staff_role &&
    meta.staff_first_name &&
    meta.staff_last_name &&
    meta.staff_active !== false
  ) {
    return {
      userId: user.id,
      staff: {
        id: user.id,
        first_name: String(meta.staff_first_name),
        last_name: String(meta.staff_last_name),
        email: user.email ?? "",
        role: meta.staff_role as StaffRole,
        is_active: true,
      },
    };
  }

  const admin = createAdminClient();
  const { data: staff } = await admin
    .from("staff")
    .select("id, first_name, last_name, email, role, is_active")
    .eq("id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!staff) return null;
  return { userId: user.id, staff: staff as StaffProfile };
});

export async function requireStaff(roles?: StaffRole[]) {
  const session = await getStaffSession();
  if (!session) {
    return { error: "Unauthorized", status: 401 as const };
  }
  if (roles && !roles.includes(session.staff.role)) {
    return { error: "Forbidden", status: 403 as const };
  }
  return { session };
}
