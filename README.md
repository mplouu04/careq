# CAREQ — Next.js + Supabase

Modern rebuild of the Patient Queue Management System using **Next.js 14**, **Supabase** (PostgreSQL, Auth, Realtime), **Tailwind CSS**, and **shadcn/ui**.

## Features

- Patient check-in (walk-in & appointment)
- Live queue TV board (`/queue`) with Supabase Realtime
- Queue status tracking (`/status`)
- Appointment booking & patient portal
- Staff dashboard (call next, skip, done, analytics)
- Admin panel (staff, types, displays, appointments)

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run SQL migrations in order (see [`supabase/MIGRATIONS.md`](supabase/MIGRATIONS.md)):
   - `supabase/migrations/001_schema.sql`
   - `supabase/migrations/002_seed.sql`
   - `supabase/migrations/003_booking_and_queue.sql`
   - `supabase/migrations/003_fix_staff_user_trigger.sql`
   - `supabase/migrations/004_atomic_counters.sql`
   - `supabase/migrations/005_rate_limit_rpc.sql`
   - `supabase/migrations/006_checkin_transaction.sql`
   - `supabase/migrations/007_indexes_and_reminders.sql`
3. Enable **Realtime** on the `queue` table (done in migration)
4. Create admin user in **Authentication → Users**:
   - Email: `admin@clinic.com`
   - Password: `admin123` (change immediately)
   - User metadata:
     ```json
     { "role": "admin", "first_name": "Admin", "last_name": "User" }
     ```

### 2. Environment

Copy `.env.local.example` to `.env.local` and fill in values. See [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md) for:

- Required vs optional variables (validated at startup via Zod in `lib/env.ts`)
- Separate Supabase projects for dev / staging / production
- Cron jobs (reminders + retention purge) and secret rotation

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
RESEND_API_KEY=          # optional locally
RESEND_FROM_EMAIL=
```

### 3. Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deploy (Vercel)

1. Push to GitHub
2. Import repo in [Vercel](https://vercel.com)
3. Add environment variables from `.env.local.example` (see [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md))
4. Cron jobs: daily appointment reminders (8 AM UTC), weekly log retention purge (Sun 3 AM UTC)

## Routes

| Route | Description |
|-------|-------------|
| `/` | Public landing |
| `/visit` | Check-in flow entry |
| `/queue` | TV queue board (fullscreen) |
| `/login` | Staff login |
| `/dashboard` | Staff queue control |
| `/admin` | Admin panel |

## Tech Stack

- Next.js 14 App Router + TypeScript
- Supabase Auth, PostgreSQL, Realtime
- Tailwind CSS + shadcn/ui
- Zod (API validation)
- Vercel (hosting + cron)
- GitHub Actions (CI: lint, test, build)
- Sentry (optional error tracking via `NEXT_PUBLIC_SENTRY_DSN`)
