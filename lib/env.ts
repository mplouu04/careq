import { z } from "zod";

const envSchema = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    NEXT_PUBLIC_APP_URL: z.string().url().optional(),
    NEXT_PUBLIC_TIMEZONE: z.string().default("Asia/Manila"),
    NEXT_PUBLIC_APPOINTMENT_LEAD_MINUTES: z.coerce.number().default(30),
    /** Vercel-injected: production | preview | development */
    VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),
    NODE_ENV: z.enum(["development", "production", "test"]).optional(),
    CRON_SECRET: z.string().min(16).optional(),
    NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
    RESEND_API_KEY: z.string().min(1).optional(),
    RESEND_FROM_EMAIL: z.string().email().optional(),
    /** Pepper for hashing email verification codes. Falls back to CRON_SECRET / service role. */
    EMAIL_CODE_PEPPER: z.string().min(8).optional(),
    CLINIC_NAME: z.string().min(1).optional(),
    CLINIC_ADDRESS: z.string().min(1).optional(),
    CLINIC_PHONE: z.string().min(1).optional(),
    /** Privacy / DPO contact shown on Privacy Notice and footer. */
    CLINIC_PRIVACY_EMAIL: z.string().email().optional(),
    /** Days to retain rate_limits and audit_log rows (cron purge). Default ~6 years for ops/audit accountability — not a medical-records schedule. */
    RETENTION_DAYS: z.coerce.number().int().min(7).max(3650).default(2190),
    /** Web Push VAPID keys — all three must be set together, or all omitted. */
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1).optional(),
    VAPID_PRIVATE_KEY: z.string().min(1).optional(),
    VAPID_SUBJECT: z.string().min(1).optional(),
  })
  .superRefine((data, ctx) => {
    const isProd =
      data.VERCEL_ENV === "production" ||
      (data.VERCEL_ENV === undefined && data.NODE_ENV === "production");

    if (isProd && !data.CRON_SECRET) {
      ctx.addIssue({
        code: "custom",
        path: ["CRON_SECRET"],
        message: "CRON_SECRET is required in production",
      });
    }

    const hasResendKey = Boolean(data.RESEND_API_KEY);
    const hasResendFrom = Boolean(data.RESEND_FROM_EMAIL);
    if (hasResendKey !== hasResendFrom) {
      ctx.addIssue({
        code: "custom",
        path: ["RESEND_API_KEY"],
        message: "RESEND_API_KEY and RESEND_FROM_EMAIL must both be set or both omitted",
      });
    }

    const vapidKeys = [
      data.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      data.VAPID_PRIVATE_KEY,
      data.VAPID_SUBJECT,
    ];
    const vapidSet = vapidKeys.filter(Boolean).length;
    if (vapidSet > 0 && vapidSet < 3) {
      ctx.addIssue({
        code: "custom",
        path: ["NEXT_PUBLIC_VAPID_PUBLIC_KEY"],
        message:
          "NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT must all be set or all omitted",
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid environment: ${missing}`);
  }
  cached = parsed.data;
  return cached;
}

export function getEnvSafe(): Env | null {
  const parsed = envSchema.safeParse(process.env);
  return parsed.success ? parsed.data : null;
}

/** Called once at server startup to fail fast on misconfiguration. */
export function validateEnvOnStartup(): void {
  try {
    getEnv();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ level: "error", message, context: "env_validation" }));
    if (process.env.NODE_ENV === "production") {
      throw err;
    }
  }
}

/** True when running against the production Vercel deployment. */
export function isProductionDeploy(): boolean {
  const env = getEnvSafe();
  return env?.VERCEL_ENV === "production";
}
