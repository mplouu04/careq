# CareQ gap analysis: current repo vs phone-only requirements

**Requirements:** [`docs/requirements.md`](requirements.md)  
**Flow:** [`docs/flow.md`](flow.md)  
**Rules:** [`.cursor/rules/careq.mdc`](../.cursor/rules/careq.mdc) (create from [`docs/careq-cursor-rule.md`](careq-cursor-rule.md) if missing — Agent mode required for `.mdc`)  
**Multitenant plan:** [`docs/plan-multitenant.md`](plan-multitenant.md)  
**Date:** 2026-10-31 (amended)  
**Constraint:** Docs only — ask before any migration or application code.

---

## 1. Current repo summary

### Routes / pages

| Area | Routes |
|------|--------|
| Public patient | `/` hub, `/patient-search`, `/registration`, `/appointments`, `/my-appointments`, `/checkin`, `/status`, `/status/[ref]`, `/visit`→`/`, `/privacy`, `/terms` |
| Staff | `/login`, `/dashboard`, `/admin` |
| TV | `/queue`, `/queue/[screenId]` |
| API | Patient verify, patients, appointments, check-in, queue (+ per-id actions), doctors, rooms, push, email-verify, admin, cron |

### Key components

- Patient: `PatientHub`, `PatientSearch`, `RegistrationForm`, `AppointmentBooking`, `CheckinForm`, track/help forms
- Queue: `QueueBoard`, `QueueStatus`, `EnablePushAlerts`
- Staff: `DashboardQueue`, `QueueCommandBar`, `LoginForm`, admin panel

### Auth

| Who | Mechanism |
|-----|-----------|
| Staff | Supabase Auth email/password; middleware on `/dashboard` `/admin` `/login`; `requireStaff` / `withStaffAuth` |
| Patient | **No password.** Match by **phone last-7 + DOB** → `patient_sessions` token (~4h). Email OTP only for email proof — **not** login. |

**Security flag:** Phone last-7 + DOB is a **weak identity gate** (small search space; no possession factor). Interim only. Target: **phone OTP via SMS**, rate-limited with existing **`rate_limits`**, before remote join expands attack surface.

### Supabase tables (high level)

`staff`, `patients`, `checkins`, `queue`, `rooms`, `display_settings`, `appointment_types`, `checkin_types`, `doctor_schedules`, `doctor_blocks`, `patient_sessions`, `push_subscriptions`, `email_verifications`, `email_proofs`, `clinic_settings`, `daily_counters`, `rate_limits`, `audit_log`, `reminder_failures` + view `doctors_public`.

**No `clinic_id` anywhere.** `queue.clinic_date` = Manila calendar day; `clinic_settings` = single-clinic KV.

### Queue statuses (today)

`waiting` | `with_nurse` | `ready_for_doctor` | `called` | `in_progress` | `completed` | `cancelled` | `no_show`

### Realtime

- Client `postgres_changes` on `queue`, `staff`, `checkins`, schedules/blocks
- Server broadcast `doctors:changes`
- React Query invalidate + poll fallbacks

### Queue mutation pattern (today)

- **Insert:** RPC `checkin_to_queue` only
- **Status transitions:** service-role `.from("queue").update(...)` in `lib/services/queue.service.ts` — **service role bypasses RLS**

**Interim rule (until transition RPCs exist):** every service-role query/update that touches tenant data **must filter by `clinic_id` and verify the caller’s clinic membership** in application code. RLS alone is not enough for service-role paths.

---

## 2. What already exists (keep / extend)

| Requirement area | Exists |
|------------------|--------|
| Phone-first hub + book / check-in / track | Yes |
| Live position + est. wait | Yes |
| Web Push on **called** | Yes |
| Nurse triage path | Yes (`with_nurse` / `ready_for_doctor`) |
| TV board without names | Yes |
| Staff call / recall / present / done / no-show / return | Yes |
| Email verification + day-before reminders | Yes (Resend) |
| Zod on many mutating APIs | Partial |
| `rate_limits` table + helpers | Yes — reuse for OTP SMS send |
| Skip + return-ish paths | Partial — no dedicated `skipped` |

---

## 3. What must change

| Area | Current | Target |
|------|---------|--------|
| Tenancy | Single shared DB | `clinic_id` on core tables + RLS + membership |
| Queue writes | Service-role updates | Postgres functions that check **clinic_id + role**; interim: explicit clinic filter on every service-role path |
| Ticket states | See §5.2 | Live tickets from `remote_waiting` onward; **`booked` is appointment/checkin status only** (not a queue ticket) |
| Patient auth | Phone last-7 + DOB | **Phone OTP over SMS** + `rate_limits`; guardian/dependents |
| Join / check-in | “I’m here” | Remote join + **clinic QR** → `remote_waiting` → `waiting` |
| Approaching alerts | Client-only, **`position <= 2`** | Server Web Push; per-clinic threshold **default 3** |
| Counters / push keys | Global by day / queue_number | **Per clinic** (`daily_counters`, `push_subscriptions`) |
| Public URLs | Flat `/status/...` | **Tenant resolution** via `/c/[slug]/...` |
| Design tokens | Mixed palettes | Migrate later (see §6) — no drive-by change |

---

## 4. What is missing

| Item | Notes |
|------|-------|
| **Multi-tenant `clinic_id` + RLS** | Foundation; see [`plan-multitenant.md`](plan-multitenant.md) |
| **Tenant resolution** | Clinic **slug in URL** for public routes, QR codes, and status links: e.g. `/c/[slug]/…` |
| **Phone OTP (SMS)** | OTP sent by SMS; **SMS provider setup belongs in this step**; throttle with **`rate_limits`** |
| **Guardian + dependents** | Manage children under one verified phone |
| **`remote_waiting` + hold TTL** | Per-clinic hold; system expiry |
| **Clinic QR** | On-site check-in / walk-in entry (slug-scoped) |
| **Live ticket states** | `remote_waiting` … `done` / `skipped` (not `booked` as ticket) |
| **Server approaching push** | Position ≤ clinic setting (default 3) |
| **SMS for call/approaching fallback** | Same provider as OTP; product notify path after OTP step |
| **Recall max N** | Setting + enforcement |
| **`skipped` state + re-queue** | Distinct from skip→waiting |
| **Phoneless front-desk ticket** | Staff create without phone |
| **Postgres transition RPCs** | All status changes with clinic+role checks |

---

## 5. Data migration plan (when implementing — not now)

### 5.1 Default clinic backfill

1. Create `clinics` row (slug + name from env / “CAREQ Clinic”).
2. Add nullable `clinic_id` → backfill → `NOT NULL` + FKs on core tables (including **`daily_counters`** and **`push_subscriptions`**).
3. Scope `clinic_settings` per clinic (`approaching_threshold`, `remote_hold_minutes`, `max_recalls`, …).
4. `staff_clinics` membership with role; RLS by membership.

### 5.2 Status mapping (queue tickets)

| Old `queue_status` | New ticket state |
|--------------------|------------------|
| *(n/a — appointments stay on checkins)* | **`booked` is not a queue row** — appointment/checkin status only |
| *(n/a)* | `remote_waiting` (new) |
| `waiting` | `waiting` |
| `with_nurse` | `in_triage` |
| `ready_for_doctor` | `waiting_for_service` |
| `called` | `called` |
| `in_progress` | `in_service` |
| `completed` | `done` |
| `no_show` | `no_show` |
| `cancelled` | `cancelled` |
| skip→waiting today | New skips → `skipped`; historical stay `waiting` |

Enum changes: separate committed migrations (ADD VALUE before use).

### 5.3 Counters, push, sessions

- **`daily_counters`:** include `clinic_id` so queue numbers are **unique per clinic per day** (change uniqueness from global `(queue_number, clinic_date)` to include clinic).
- **`push_subscriptions`:** add `clinic_id` (+ prefer ticket/queue id) to avoid cross-clinic collisions.
- **`patient_sessions`:** bind to clinic + OTP subject after cutover.

---

## 6. Design tokens (document only — do not change yet)

### Target

| Token | Value |
|-------|--------|
| Primary | `#2563EB` |
| Danger | `#DC2626` |
| Background | `#F8F9FB` |
| Border | `#E2E5EA` |
| Font | Inter |
| Radius | `rounded-lg` |

### Current

| Source | Values |
|--------|--------|
| `lib/design-tokens.ts` | `#004ac6`, `#faf8ff`, … |
| `app/globals.css` | `--primary: 222 100% 39%`; `--background: 250 100% 99%`; `--destructive: 0 72% 42%` |
| Admin UI | Often `#2563EB` already |

Migrate in a dedicated PR later.

---

## 7. Approaching threshold

| | |
|--|--|
| **Target** | Per-clinic setting, **default 3** |
| **Current** | Hard-coded **`position <= 2`** in `QueueStatus.tsx` (in-tab only) |

---

## 8. Recommended build order

1. **Docs + Cursor rules**
2. **Multi-tenant foundation** — see [`plan-multitenant.md`](plan-multitenant.md) (await approval before migrations)
3. **Phone OTP auth** — **includes SMS provider setup**; OTP SMS uses **`rate_limits`**; replaces last-7+DOB
4. **Guardian + dependents**
5. **Ticket state machine** — RPCs + status map; retire interim service-role clinic filters where RPCs cover writes
6. **Remote join + clinic QR + hold** (slug URLs / QR)
7. **Priority ordering**
8. **Notifications** — server approaching (default 3) + called; SMS fallback via same provider as OTP
9. **Front-desk phoneless ticket** + recall max N / `skipped`
10. **Design-token migration** + phone-only copy

---

## 9. Stop line

**Do not write migrations or app code until `plan-multitenant.md` is approved.**  
Also install `.cursor/rules/careq.mdc` from `docs/careq-cursor-rule.md` when Agent mode allows (currently missing).
