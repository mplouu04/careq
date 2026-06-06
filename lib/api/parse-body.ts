import { NextResponse } from "next/server";
import type { ZodType } from "zod";

export async function parseJsonBody<T>(
  request: Request,
  schema: ZodType<T>
): Promise<{ data: T } | { error: Response }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { error: NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }) };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid input";
    return { error: NextResponse.json({ error: message }, { status: 400 }) };
  }

  return { data: parsed.data };
}
