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
2. Run SQL migrations in order:
   - `supabase/migrations/001_schema.sql`
   - `supabase/migrations/002_seed.sql`
3. Enable **Realtime** on the `queue` table (done in migration)
4. Create admin user in **Authentication → Users**:
   - Email: `admin@clinic.com`
   - Password: `admin123` (change immediately)
   - User metadata:
     ```json
     { "role": "admin", "first_name": "Admin", "last_name": "User" }
     ```

### 2. Environment

Copy `.env.local.example` to `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
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
3. Add environment variables from `.env.local.example`
4. Cron job runs daily at 8 AM UTC (configure `CRON_SECRET` in Vercel)

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
- Chart.js (dashboard analytics)
- Vercel (hosting + cron)
