import { NextResponse } from "next/server";
import { withStaffAuth } from "@/lib/api/with-auth";
import { parseJsonBody } from "@/lib/api/parse-body";
import { getClientIp } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { AnnouncementActionSchema } from "@/lib/schemas/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { sanitize } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const GET = withStaffAuth(async () => {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("announcements")
    .select("id, title, body, is_active, published_at, created_at, updated_at")
    .order("published_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: "Failed to load announcements" }, { status: 500 });
  }
  return NextResponse.json({ success: true, announcements: data ?? [] });
}, ["admin"]);

export const POST = withStaffAuth(async (request: Request) => {
  const parsed = await parseJsonBody(request, AnnouncementActionSchema);
  if ("error" in parsed) return parsed.error;

  const body = parsed.data;
  const supabase = createAdminClient();
  const userId = (request as Request & { staffSession?: { userId: string } }).staffSession!.userId;
  const ip = getClientIp(request);

  if (body.action === "delete") {
    const { error } = await supabase.from("announcements").delete().eq("id", body.id);
    if (error) {
      return NextResponse.json({ error: "Delete failed" }, { status: 500 });
    }
    void logAudit({
      userId,
      action: "announcement_delete",
      tableName: "announcements",
      recordId: body.id,
      ipAddress: ip,
    });
    return NextResponse.json({ success: true });
  }

  const title = sanitize(body.title, 200);
  const text = sanitize(body.body, 2000);
  if (!title || !text) {
    return NextResponse.json({ error: "Title and body are required" }, { status: 400 });
  }

  if (body.action === "add") {
    const { data, error } = await supabase
      .from("announcements")
      .insert({
        title,
        body: text,
        is_active: body.is_active ?? true,
      })
      .select("id")
      .single();
    if (error) {
      return NextResponse.json({ error: "Create failed" }, { status: 500 });
    }
    void logAudit({
      userId,
      action: "announcement_add",
      tableName: "announcements",
      recordId: data.id,
      ipAddress: ip,
    });
    return NextResponse.json({ success: true, id: data.id });
  }

  if (!body.id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  const patch: Record<string, unknown> = { title, body: text };
  if (body.is_active !== undefined) patch.is_active = body.is_active;

  const { error } = await supabase.from("announcements").update(patch).eq("id", body.id);
  if (error) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
  void logAudit({
    userId,
    action: "announcement_update",
    tableName: "announcements",
    recordId: body.id,
    ipAddress: ip,
  });
  return NextResponse.json({ success: true });
}, ["admin"]);