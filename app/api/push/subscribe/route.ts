import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withRateLimit } from "@/lib/api/with-auth";
import { parseJsonBody } from "@/lib/api/parse-body";
import { PushSubscribeSchema, PushUnsubscribeSchema } from "@/lib/schemas/push";
import { normalizeQueueRef } from "@/lib/queue-ref";
import { getEnvSafe } from "@/lib/env";

export const dynamic = "force-dynamic";

/** POST /api/push/subscribe — save a Web Push subscription for a queue number */
export const POST = withRateLimit(
  "push_subscribe",
  async (request: Request) => {
    const env = getEnvSafe();
    if (!env?.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !env?.VAPID_PRIVATE_KEY || !env?.VAPID_SUBJECT) {
      return NextResponse.json(
        { error: "Push notifications are not configured" },
        { status: 503 }
      );
    }

    const parsed = await parseJsonBody(request, PushSubscribeSchema);
    if ("error" in parsed) return parsed.error;

    const queueNumber = normalizeQueueRef(parsed.data.queueNumber);
    const { endpoint, keys } = parsed.data.subscription;

    const supabase = createAdminClient();

    // Confirm the queue entry exists (prevents orphan spam)
    const { data: queueRow } = await supabase
      .from("queue")
      .select("id")
      .eq("queue_number", queueNumber)
      .maybeSingle();

    if (!queueRow) {
      return NextResponse.json({ error: "Queue entry not found" }, { status: 404 });
    }

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        queue_number: queueNumber,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
      { onConflict: "endpoint" }
    );

    if (error) {
      return NextResponse.json({ error: "Failed to save subscription" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  },
  { max: 20, windowSeconds: 60, failClosed: true }
);

/** DELETE /api/push/subscribe — remove a Web Push subscription by endpoint */
export const DELETE = withRateLimit(
  "push_unsubscribe",
  async (request: Request) => {
    const parsed = await parseJsonBody(request, PushUnsubscribeSchema);
    if ("error" in parsed) return parsed.error;

    const supabase = createAdminClient();
    await supabase.from("push_subscriptions").delete().eq("endpoint", parsed.data.endpoint);

    return NextResponse.json({ success: true });
  },
  { max: 20, windowSeconds: 60, failClosed: true }
);
