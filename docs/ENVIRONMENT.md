# Environment & Deployment Guide

CAREQ uses **separate Supabase projects per environment**. Never point staging or preview deployments at production data.

## Environments

| Environment | Vercel | Supabase project | Purpose |
|-------------|--------|------------------|---------|
| **Development** | Local (`npm run dev`) | `careq-dev` (or shared dev) | Feature work, seed data |
| **Staging** | Preview deployments (`VERCEL_ENV=preview`) | `careq-staging` | PR smoke tests, QA |
| **Production** | Production branch (`VERCEL_ENV=production`) | `careq-prod` | Live clinic |

### Setup checklist (per environment)

1. Create a dedicated Supabase project.
2. Run all migrations in order — see [`supabase/MIGRATIONS.md`](../supabase/MIGRATIONS.md).
3. Create an admin user in Supabase Auth (see README).
4. Configure Vercel environment variables (below) scoped to **Production**, **Preview**, or **Development** as appropriate.
5. Run [`docs/SMOKE_CHECKLIST.md`](SMOKE_CHECKLIST.md) before promoting to production.

## Required variables

Validated at server startup via [`lib/env.ts`](../lib/env.ts) (Zod). Invalid config fails the build/runtime in production.

| Variable | Required | Scope | Notes |
|----------|----------|-------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | All | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | All | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | All | **Server only** — never expose to browser |
| `NEXT_PUBLIC_APP_URL` | Recommended | All | Canonical app URL (emails, links) |
| `CRON_SECRET` | Yes in production | Server | Min 16 chars; Vercel Cron `Authorization: Bearer` |
| `NEXT_PUBLIC_TIMEZONE` | No | All | Default `Asia/Manila` |
| `NEXT_PUBLIC_APPOINTMENT_LEAD_MINUTES` | No | All | Default `30` |

## Optional variables

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SENTRY_DSN` | Error tracking (Sentry) |
| `RESEND_API_KEY` | Appointment reminder emails |
| `RESEND_FROM_EMAIL` | Verified sender (must pair with `RESEND_API_KEY`) |
| `CLINIC_NAME` | Email template clinic name |
| `CLINIC_ADDRESS` | Email template address |
| `RETENTION_DAYS` | Days to keep `rate_limits` / `audit_log` (default `90`) |

## Cron jobs

Configured in [`vercel.json`](../vercel.json):

| Schedule | Route | Purpose |
|----------|-------|---------|
| Daily 08:00 UTC | `/api/cron/reminders` | Send tomorrow's appointment reminder emails |
| Weekly Sun 03:00 UTC | `/api/cron/retention` | Purge old `rate_limits` and `audit_log` rows |

Both routes require `Authorization: Bearer $CRON_SECRET`. Set `CRON_SECRET` in Vercel for **Production** (and Preview if you test crons there).

## Secret rotation (quarterly recommended)

1. **CRON_SECRET** — generate a new random string (≥16 chars), update in Vercel, redeploy. Old secret stops working immediately.
2. **SUPABASE_SERVICE_ROLE_KEY** — rotate in Supabase Dashboard → Settings → API → service role key. Update Vercel env vars for all environments, redeploy each.
3. **RESEND_API_KEY** — rotate in Resend dashboard; update Vercel production env.

After rotation, verify `/api/health` returns `healthy` and trigger a manual cron test:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-app.vercel.app/api/cron/reminders
```

## Vercel env scoping

- **Production** → production Supabase + production secrets + Resend live sender.
- **Preview** → staging Supabase; use staging `CRON_SECRET` or disable cron on previews.
- **Development** → local `.env.local` with dev Supabase; email/cron optional.

Copy [`.env.local.example`](../.env.local.example) to `.env.local` for local development.

## Health check

`GET /api/health` returns database connectivity, env validation status, and whether cron/email providers are configured. Use for uptime monitoring.
