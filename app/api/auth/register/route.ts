import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (!(await checkRateLimit("staff_register", ip))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await request.json();
  const { email, password, firstName, lastName, role } = body;

  if (!email || !password || !firstName || !lastName || !role) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const allowed = ["doctor", "nurse", "receptionist"];
  if (!allowed.includes(role)) {
    return NextResponse.json({ error: "Invalid role for self-registration" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role, first_name: firstName, last_name: lastName },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from("staff").upsert({
    id: data.user.id,
    first_name: firstName,
    last_name: lastName,
    email,
    role,
    is_active: true,
  });

  return NextResponse.json({ success: true });
}
