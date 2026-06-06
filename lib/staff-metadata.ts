import { createAdminClient } from "@/lib/supabase/admin";
import type { StaffRole } from "@/lib/constants";

export async function syncStaffMetadata(params: {
  userId: string;
  firstName: string;
  lastName: string;
  role: StaffRole;
  isActive: boolean;
}) {
  const supabase = createAdminClient();
  await supabase.auth.admin.updateUserById(params.userId, {
    app_metadata: {
      staff_role: params.role,
      staff_first_name: params.firstName,
      staff_last_name: params.lastName,
      staff_active: params.isActive,
    },
  });
}
