import { createHash, randomInt } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEnvSafe } from "@/lib/env";
import { CheckinError } from "@/lib/counters";
import { sendEmailVerificationCode } from "@/lib/email";

const CODE_TTL_MS = 10 * 60 * 1000;
const PROOF_TTL_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function getPepper(): string {
  const env = getEnvSafe();
  return (
    env?.EMAIL_CODE_PEPPER ||
    env?.CRON_SECRET ||
    env?.SUPABASE_SERVICE_ROLE_KEY ||
    "careq-dev-email-pepper"
  );
}

export function hashEmailCode(code: string, email: string): string {
  return createHash("sha256")
    .update(`${getPepper()}:${normalizeEmail(email)}:${code}`)
    .digest("hex");
}

export function generateEmailCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export async function sendEmailVerification(
  emailRaw: string,
  ip?: string | null
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const email = normalizeEmail(emailRaw);
  const env = getEnvSafe();
  if (!env?.RESEND_API_KEY || !env?.RESEND_FROM_EMAIL) {
    return {
      ok: false,
      error: "Email verification is not configured. Please try again later.",
      status: 503,
    };
  }

  const supabase = createAdminClient();
  const code = generateEmailCode();
  const codeHash = hashEmailCode(code, email);
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

  // Invalidate prior unused codes for this email
  await supabase
    .from("email_verifications")
    .update({ consumed: true })
    .eq("email", email)
    .eq("consumed", false);

  const { error: insertError } = await supabase.from("email_verifications").insert({
    email,
    code_hash: codeHash,
    expires_at: expiresAt,
    ip: ip ?? null,
  });

  if (insertError) {
    return { ok: false, error: "Failed to start email verification", status: 500 };
  }

  const clinicName = env.CLINIC_NAME ?? "Your Clinic";
  const sendResult = await sendEmailVerificationCode({
    to: email,
    code,
    clinicName,
  });

  if (!sendResult.ok) {
    return {
      ok: false,
      error: sendResult.error || "Failed to send verification email",
      status: sendResult.retryable ? 503 : 500,
    };
  }

  return { ok: true };
}

export async function confirmEmailVerification(
  emailRaw: string,
  codeRaw: string
): Promise<
  | { ok: true; emailProofToken: string }
  | { ok: false; error: string; status: number }
> {
  const email = normalizeEmail(emailRaw);
  const code = codeRaw.trim();
  if (!/^\d{6}$/.test(code)) {
    return { ok: false, error: "Invalid or expired code", status: 400 };
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: row, error } = await supabase
    .from("email_verifications")
    .select("id, code_hash, attempts, expires_at, consumed")
    .eq("email", email)
    .eq("consumed", false)
    .gt("expires_at", now)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !row) {
    return { ok: false, error: "Invalid or expired code", status: 400 };
  }

  if ((row.attempts ?? 0) >= MAX_ATTEMPTS) {
    await supabase
      .from("email_verifications")
      .update({ consumed: true })
      .eq("id", row.id);
    return { ok: false, error: "Invalid or expired code", status: 400 };
  }

  const expected = hashEmailCode(code, email);
  if (expected !== row.code_hash) {
    await supabase
      .from("email_verifications")
      .update({ attempts: (row.attempts ?? 0) + 1 })
      .eq("id", row.id);
    return { ok: false, error: "Invalid or expired code", status: 400 };
  }

  await supabase
    .from("email_verifications")
    .update({ consumed: true })
    .eq("id", row.id);

  const expiresAt = new Date(Date.now() + PROOF_TTL_MS).toISOString();
  const { data: proof, error: proofError } = await supabase
    .from("email_proofs")
    .insert({ email, expires_at: expiresAt })
    .select("token")
    .single();

  if (proofError || !proof?.token) {
    return { ok: false, error: "Failed to confirm email", status: 500 };
  }

  return { ok: true, emailProofToken: proof.token as string };
}

/** Single-use: validates proof for email and marks it used. */
export async function consumeEmailProof(
  token: string,
  emailRaw: string
): Promise<void> {
  const email = normalizeEmail(emailRaw);
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("email_proofs")
    .update({ used: true })
    .eq("token", token)
    .eq("email", email)
    .eq("used", false)
    .gt("expires_at", now)
    .select("token")
    .maybeSingle();

  if (error) {
    throw new CheckinError(error.message, 500);
  }
  if (!data) {
    throw new CheckinError("Email verification required. Please verify your email.", 403);
  }
}
