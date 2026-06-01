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

export async function getStaffSession(): Promise<{
  userId: string;
  staff: StaffProfile;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: staff } = await admin
    .from("staff")
    .select("id, first_name, last_name, email, role, is_active")
    .eq("id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!staff) return null;
  return { userId: user.id, staff: staff as StaffProfile };
}

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
