import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

import { requireStaff } from "@/lib/auth";

import { sanitize } from "@/lib/utils";

import { getClientIp } from "@/lib/rate-limit";

import { logAudit } from "@/lib/audit";

import { captureException } from "@/lib/observability";



export const dynamic = "force-dynamic";



/**

 * GET /api/appointment-types

 * - Public (no auth): returns only active types

 * - Staff (valid session): returns all types including inactive (for admin management)

 */

export async function GET() {

  const supabase = createAdminClient();



  const staffAuth = await requireStaff();

  const staffMode = !("error" in staffAuth);



  let query = supabase

    .from("appointment_types")

    .select("id, name, duration, description, is_active")

    .order("name");



  if (!staffMode) {

    query = query.eq("is_active", true) as typeof query;

  }



  const { data, error } = await query;

  if (error) {
    captureException(error, { route: "/api/appointment-types" });
    return NextResponse.json(
      { error: "Failed to load appointment types" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { success: true, types: data ?? [] },
    { headers: { "Cache-Control": "private, no-store" } }
  );

}



/**

 * POST /api/appointment-types  — admin only

 * Actions: add, toggle, update

 */

export async function POST(request: Request) {

  const auth = await requireStaff(["admin"]);

  if ("error" in auth) {

    return NextResponse.json({ error: auth.error }, { status: auth.status });

  }



  const ip = getClientIp(request);



  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: Record<string, any>;

  try {

    body = await request.json();

  } catch {

    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  }

  const supabase = createAdminClient();



  if (body.action === "add") {

    const name = sanitize(body.name, 100);

    if (!name || !body.duration || Number(body.duration) < 1) {

      return NextResponse.json(

        { error: "name and duration (≥1) are required" },

        { status: 400 }

      );

    }

    const { data, error } = await supabase

      .from("appointment_types")

      .insert({

        name,

        duration: Number(body.duration),

        description: sanitize(body.description, 500) || null,

        is_active: true,

      })

      .select("id")

      .single();

    if (error) {

      return NextResponse.json({ error: error.message }, { status: 500 });

    }

    await logAudit({

      userId: auth.session.userId,

      action: "appt_type_add",

      tableName: "appointment_types",

      recordId: data.id,

      ipAddress: ip,

      newValues: { name, duration: body.duration },

    });

    return NextResponse.json({ success: true, id: data.id });

  }



  if (body.action === "toggle") {

    if (!body.id) {

      return NextResponse.json({ error: "Missing id" }, { status: 400 });

    }

    const { data: current } = await supabase

      .from("appointment_types")

      .select("is_active")

      .eq("id", body.id)

      .single();



    const newActive = !(current?.is_active ?? true);

    await supabase

      .from("appointment_types")

      .update({ is_active: newActive })

      .eq("id", body.id);

    await logAudit({

      userId: auth.session.userId,

      action: "appt_type_toggle",

      tableName: "appointment_types",

      recordId: body.id,

      ipAddress: ip,

      newValues: { is_active: newActive },

    });

    return NextResponse.json({ success: true, is_active: newActive });

  }



  if (body.action === "update") {

    const updName = sanitize(body.name, 100);

    if (!body.id || !updName || !body.duration || Number(body.duration) < 1) {

      return NextResponse.json(

        { error: "id, name and duration (≥1) are required" },

        { status: 400 }

      );

    }

    const { error } = await supabase

      .from("appointment_types")

      .update({

        name: updName,

        duration: Number(body.duration),

        description: sanitize(body.description, 500) || null,

      })

      .eq("id", body.id);

    if (error) {

      return NextResponse.json({ error: error.message }, { status: 500 });

    }

    await logAudit({

      userId: auth.session.userId,

      action: "appt_type_update",

      tableName: "appointment_types",

      recordId: body.id,

      ipAddress: ip,

      newValues: { name: updName, duration: body.duration },

    });

    return NextResponse.json({ success: true });

  }



  return NextResponse.json({ error: "Invalid action" }, { status: 400 });

}

