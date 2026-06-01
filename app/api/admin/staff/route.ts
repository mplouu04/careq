import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth";

export async function GET() {
  const auth = await requireStaff(["admin"]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("staff")
    .select("id, first_name, last_name, email, role, is_active, created_at")
    .order("last_name");

  return NextResponse.json({ success: true, staff: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireStaff(["admin"]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const supabase = createAdminClient();

  if (body.action === "toggle_active") {
    await supabase
      .from("staff")
      .update({ is_active: body.is_active })
      .eq("id", body.id);
    return NextResponse.json({ success: true });
  }

  if (body.action === "register") {
    const { data: authUser, error } = await supabase.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: {
        role: body.role,
        first_name: body.firstName,
        last_name: body.lastName,
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await supabase.from("staff").upsert({
      id: authUser.user.id,
      first_name: body.firstName,
      last_name: body.lastName,
      email: body.email,
      role: body.role,
      is_active: true,
    });

    return NextResponse.json({ success: true, id: authUser.user.id });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
