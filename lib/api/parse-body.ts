import { NextResponse } from "next/server";
import type { ZodType } from "zod";

export type ParseJsonBodyOptions = {
  /** When set, validation failures return this message instead of field-specific Zod text. */
  genericValidationError?: string;
};

export async function parseJsonBody<T>(
  request: Request,
  schema: ZodType<T>,
  options?: ParseJsonBodyOptions
): Promise<{ data: T } | { error: Response }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    const message = options?.genericValidationError ?? "Invalid JSON body";
    return { error: NextResponse.json({ error: message }, { status: 400 }) };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const message =
      options?.genericValidationError ??
      parsed.error.issues[0]?.message ??
      "Invalid input";
    return { error: NextResponse.json({ error: message }, { status: 400 }) };
  }

  return { data: parsed.data };
}
