# CAREQ Migration Parity Log

Migration from legacy **PQMS** (PHP + MySQL) to the Next.js rebuild (PostgreSQL / Supabase).

---

## 1. Scope

| Item | Detail |
|------|--------|
| **Legacy source** | `C:\xampp\htdocs\pqms\pqms` (PHP pages + `api_*.php` endpoints) |
| **Current stack** | Next.js 14 App Router, React 18, Supabase (PostgreSQL + Auth), Vitest + Playwright |
| **Service layer** | [`lib/services/`](../lib/services/) — business logic ported from legacy PHP |
| **API surface** | [`app/api/`](../app/api/) — REST routes matching legacy contracts |
| **Parity contracts** | [`docs/SMOKE_CHECKLIST.md`](SMOKE_CHECKLIST.md), [`tests/parity.*.test.ts`](../tests/) |
| **Seed data** | [`supabase/migrations/002_seed.sql`](../supabase/migrations/002_seed.sql) |

---

## 2. Parity Matrix

| Feature area | Legacy | Current | Status |
|--------------|--------|---------|--------|
| Patient registration | `registration.php` | `/registration` + `POST /api/patients` | **Matched** |
| Profile match (phone / name+DOB) | `api_patient_register.php` | `registerPatient` service | **Matched** (`matched_by: name_dob`) |
| Patient search (2+ chars) | `patient_search.php` | `/patient-search` + `GET /api/patients` | **Fixed** (was 3-char min) |
| Patient search rate limit | 30 / 60s | `GET /api/patients` | **Fixed** (was 20 / 60s) |
| Appointment booking UI | `appointments.php` | `/appointments` + `AppointmentBooking.tsx` | **Fixed** (was mock data, no API) |
| Slot availability | `api_patient_schedule.php` | `GET /api/doctors/availability` | **Matched** |
| Duplicate slot guard | Unique index + 409 | `bookAppointment` service | **Matched** |
| Check-in (appointment / walk-in) | `checkin.php` | `/checkin` + `POST /api/checkin` | **Matched** |
| Queue status | `status.php` | `/status`, `/status/[ref]` | **Matched** |
| My appointments lookup | `my_appointments.php` | `/my-appointments` + `GET /api/appointments` | **Matched** |
| Phone match (lookup / cancel) | Last **7 digits** | `phonesMatchLast7()` in [`lib/phone.ts`](../lib/phone.ts) | **Fixed** (was full-number match) |
| Cancel appointment | `api_patient_cancel.php` | `POST /api/appointments` (action: cancel) | **Matched** |
| Queue board (TV) | `queue_board.php` | `/queue`, `/queue/[screenId]` | **Matched** |
| Staff dashboard | `dashboard.php` | `/dashboard` + queue APIs | **Matched** |
| Stale auto-complete (20 min) | Triggered on registration page load | `POST /api/queue/public` `{ auto: true }` from dashboard poll | **Fixed** (endpoint existed but was not called) |
| Staff login | `login.php` | `/login` + Supabase Auth | **Matched** |
| Inactive staff login | Login fails | `LoginForm.tsx` checks `is_active`, signs out | **Fixed** |
| Admin panel | `admin.php` | `/admin` | **Matched** |
| Admin appointment updates | Admin only | `staffUpdateHandler` restricted to `["admin"]` | **Fixed** (was any staff) |
| Self-registration blocked | N/A in legacy staff | `POST /api/auth/register` → 405 | **Matched** |
| Rate limit 429 + Retry-After | Legacy header | `withRateLimit` in [`lib/api/with-auth.ts`](../lib/api/with-auth.ts) | **Fixed** |
| Audit logging | `pqms_log_audit` (fail-open) | `logAudit()` with try/catch | **Matched** |
| Reminder cron | Manual / external | `POST /api/cron/reminders` | **Improved** (new) |
| Retention cron | Manual purge | `POST /api/cron/retention` | **Improved** (new) |
| Realtime queue updates | PHP SSE | Supabase Realtime + poll fallback | **Improved** (replaces SSE) |
| Patient auth accounts | None | None | **N/A** (same as legacy) |

---

## 3. Intentional Improvements (do not revert)

These behaviors are **better** than legacy PHP and are kept by design:

1. **Atomic counters** — [`004_atomic_counters.sql`](../supabase/migrations/004_atomic_counters.sql) `next_counter()` replaces race-prone `COUNT+1` for queue/reference numbers.
2. **Transactional check-in** — [`006_checkin_transaction.sql`](../supabase/migrations/006_checkin_transaction.sql) `checkin_to_queue()` with `FOR UPDATE`, terminal-status guard, duplicate active-queue prevention.
3. **Appointment check-in guards** — Terminal status + duplicate queue checks in [`checkin.service.ts`](../lib/services/checkin.service.ts) (legacy lacked duplicate-queue check).
4. **Queue `no_show` status** — [`003_booking_and_queue.sql`](../supabase/migrations/003_booking_and_queue.sql); cascades to checkin in [`queue.service.ts`](../lib/services/queue.service.ts).
5. **Reminder + retention crons** — [`007_indexes_and_reminders.sql`](../supabase/migrations/007_indexes_and_reminders.sql), [`app/api/cron/`](../app/api/cron/).
6. **Realtime + poll fallback** — [`useRealtimePoll`](../lib/hooks/useRealtimePoll.ts) replaces PHP SSE.
7. **Queue ref normalization** — [`lib/queue-ref.ts`](../lib/queue-ref.ts) accepts compact forms (`APPT5` → `APPT-5`).
8. **`matched_by: name_dob`** — Current naming (legacy PHP used `fullname_dob`; UI expects `name_dob` per smoke §1.8).

---

## 4. Fixes Applied

### 4.1 Appointment booking UI (Critical)

| | |
|---|---|
| **Before** | [`AppointmentBooking.tsx`](../components/patient/AppointmentBooking.tsx) used hardcoded [`BOOKING_DOCTORS`](../lib/booking-doctors.ts); `handleConfirm` faked a reference with no API call. |
| **After** | Fetches `GET /api/doctors`, `GET /api/appointment-types`, `GET /api/doctors/availability`; `POST /api/appointments` on confirm. Honors `?patientId=` from patient search. Weekday-only + 30-day max + terms agreement enforced in UI. |
| **Files** | `components/patient/AppointmentBooking.tsx` |

### 4.2 Phone last-7 matching (Critical)

| | |
|---|---|
| **Before** | `cancelAppointment` and `lookupPatientAppointments` required full normalized phone match. |
| **After** | `phonesMatchLast7()` in [`lib/phone.ts`](../lib/phone.ts); used in [`appointment.service.ts`](../lib/services/appointment.service.ts). |
| **Tests** | [`tests/parity.business.test.ts`](../tests/parity.business.test.ts), [`tests/services.test.ts`](../tests/services.test.ts) |

### 4.3 Stale queue auto-complete (Critical)

| | |
|---|---|
| **Before** | `POST /api/queue/public` implemented 20-minute rule but nothing invoked it. |
| **After** | [`DashboardQueue.tsx`](../components/staff/DashboardQueue.tsx) fire-and-forget POST `{ auto: true }` on each dashboard refresh cycle. Audit logged in route handler. |
| **Files** | `components/staff/DashboardQueue.tsx`, `app/api/queue/public/route.ts` |

### 4.4 Admin-only appointment status updates (Critical)

| | |
|---|---|
| **Before** | Any staff could POST `staff_update` on appointments. |
| **After** | `staffUpdateHandler` wrapped with `withStaffAuth(handler, ["admin"])`. |
| **Files** | `app/api/appointments/route.ts` |

### 4.5 Patient search min length (Medium)

| | |
|---|---|
| **Before** | `minSearchLength` required 3 characters for text search. |
| **After** | Text search allows 2+ characters (digits-only still 1+). |
| **Files** | `lib/patient-search.ts`, `tests/patient-search.test.ts` |

### 4.6 Patient search rate limit (Medium)

| | |
|---|---|
| **Before** | 20 requests / 60s on `GET /api/patients`. |
| **After** | 30 requests / 60s (legacy `patient_search` limit). |
| **Files** | `app/api/patients/route.ts` |

### 4.7 Inactive staff login (Medium)

| | |
|---|---|
| **Before** | Supabase auth succeeded for inactive staff; session guard returned null → redirect loop. |
| **After** | Post-login check of `staff.is_active` and `app_metadata.staff_active`; sign out + error message if inactive. |
| **Files** | `components/staff/LoginForm.tsx` |

### 4.8 429 Retry-After header (Medium)

| | |
|---|---|
| **Before** | Rate-limited responses returned JSON only. |
| **After** | `Retry-After: <windowSeconds>` on 429 responses. |
| **Files** | `lib/api/with-auth.ts`, `tests/with-auth.test.ts` |

### 4.9 Robustness hardening (Phase 3)

| Improvement | File |
|-------------|------|
| Fail-open audit inserts | `lib/audit.ts` |
| `checkinId` coercion for admin panel | `lib/schemas/appointment.ts` (`z.coerce.number()`) |
| Auto-complete audit trail | `app/api/queue/public/route.ts` |

### 4.10 Cancel after reference lookup (Medium)

| | |
|---|---|
| **Before** | My Appointments reference tab could look up appointments, but cancel sent an empty phone to the API and always failed. |
| **After** | Cancel dialog collects registered phone when lookup was by reference; `cancelAppointment` verifies last-7 digits as before. |
| **Files** | `components/patient/MyAppointments.tsx` |
| **Tests** | `tests/services.test.ts` (`lookupAppointmentByReference`, cancel-by-reference with phone at cancel time) |

---

## 5. Known Limitations

| Limitation | Notes |
|------------|-------|
| No patient login accounts | Same as legacy — patients identify via phone/DOB/reference only. |
| No PHP SSE | Replaced by Supabase Realtime + 5s poll fallback. |
| Stale auto-complete trigger | Runs on staff dashboard poll (logged-in staff), not on every public page load like legacy registration page. Functionally equivalent when dashboard is in use. |
| Email reminders | Require Resend configuration (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`). Skips gracefully when unset. |
| Manual smoke requires seeded DB | Full 16-section checklist needs live Supabase with `002_seed.sql` data. |

---

## 6. Security Posture

| Concern | Mitigation |
|---------|------------|
| SQL injection | Parameterized Supabase / PostgREST queries |
| XSS | React auto-escaping; `sanitize()` on free-text fields |
| CSRF | JSON API + SameSite cookies; staff routes require session |
| Service role exposure | Server-only in [`lib/supabase/admin.ts`](../lib/supabase/admin.ts) |
| Cron endpoints | `CRON_SECRET` bearer auth in [`lib/cron-auth.ts`](../lib/cron-auth.ts) |

---

## 7. Verification Record

### 7.1 Automated CI gates

| Gate | Command | Result | Date |
|------|---------|--------|------|
| Lint | `npm run lint` | **Exit 0** | 2026-06-22 |
| Unit + parity tests | `npm test` | **93/93 passed** (8 files) | 2026-06-22 |
| Production build | `npm run build` | **Exit 0** (Sentry/OpenTelemetry warnings only) | 2026-06-22 |
| E2E smoke | `npm run test:e2e` | **41/41 passed** (public + smoke §1–8 + §9–16; requires build + server on `:3000`) | 2026-06-22 |

> **Note:** `playwright.config.ts` auto-starts the app (`npm run dev` locally, `npm run start` in CI). No manual server step required for e2e.

### 7.2 Manual smoke checklist ([`SMOKE_CHECKLIST.md`](SMOKE_CHECKLIST.md))

Execute against a clean Supabase project seeded with `002_seed.sql`. Mark each section Pass/Fail.

| Section | Description | Pass/Fail | Tester | Date |
|---------|-------------|-----------|--------|------|
| 1 | Public — New Patient Registration | **Pass** | Playwright + API smoke | 2026-06-22 |
| 2 | Public — Patient Search | **Pass** | Playwright + API smoke | 2026-06-22 |
| 3 | Public — Appointment Booking | **Pass** | Playwright + API smoke | 2026-06-22 |
| 4 | Public — Check-In | **Pass** | Playwright + API smoke | 2026-06-22 |
| 5 | Public — Queue Status | **Pass** | Playwright + API smoke | 2026-06-22 |
| 6 | Public — My Appointments | **Pass** | Playwright + API smoke (incl. §6.10–6.12 reference lookup/cancel) | 2026-06-22 |
| 7 | Public — Queue Board (TV) | **Pass** | Playwright + API smoke | 2026-06-22 |
| 8 | Staff — Login | **Pass** | Playwright + API smoke | 2026-06-22 |
| 9 | Staff — Dashboard | **Pass** | Playwright + `scripts/smoke-sections-9-16.mjs` | 2026-06-22 |
| 10 | Admin — Staff Management | **Pass** | Playwright + API smoke | 2026-06-22 |
| 11 | Admin — Appointment Types | **Pass** | API smoke | 2026-06-22 |
| 12 | Admin — Doctor Schedules | **Pass** | API smoke | 2026-06-22 |
| 13 | Admin — Display Settings | **Pass** | API smoke | 2026-06-22 |
| 14 | Admin — Appointments | **Pass** | API smoke | 2026-06-22 |
| 15 | Admin — Data Cleanup | **Pass** | API smoke | 2026-06-22 |
| 16 | Security & Auth | **Pass** | API smoke | 2026-06-22 |

**Sign-off criteria** (from smoke doc):

- [x] All 16 checklist sections pass (0 failures, 0 skips)
- [x] `npm test` — 93/93 automated tests pass
- [x] `npm run build` — exits 0
- [x] `npm run test:e2e` — 41/41 Playwright smoke tests pass
- [x] No known regressions vs. legacy CAREQ

**Signed off by:** Cursor agent (full system verification)  
**Date:** 2026-06-22

---

## 8. Test Coverage Map

| Test file | What it verifies |
|-----------|------------------|
| [`tests/parity.lib.test.ts`](../tests/parity.lib.test.ts) | `normalizePhone`, slot generation, same-day filtering |
| [`tests/parity.business.test.ts`](../tests/parity.business.test.ts) | `phonesMatchLast7`, reference formats, queue ordering, rate limits, role rules, status labels |
| [`tests/services.test.ts`](../tests/services.test.ts) | `cancelAppointment` / `lookupPatientAppointments` last-7, `lookupAppointmentByReference`, cancel-by-reference flow, queue call, admin self-deactivate |
| [`tests/patient-search.test.ts`](../tests/patient-search.test.ts) | Search helpers, 2-char min length |
| [`tests/with-auth.test.ts`](../tests/with-auth.test.ts) | 429 `Retry-After` header |
| [`tests/queue-ref.test.ts`](../tests/queue-ref.test.ts) | Queue reference normalization |
| [`tests/schemas.test.ts`](../tests/schemas.test.ts) | Zod schema validation |
| [`tests/ops.test.ts`](../tests/ops.test.ts) | Env, email, cron auth |
| [`e2e/smoke.spec.ts`](../e2e/smoke.spec.ts) | Public page loads, auth gate, health API (no DB required) |
| [`e2e/smoke-sections-1-8.spec.ts`](../e2e/smoke-sections-1-8.spec.ts) | Playwright coverage for smoke checklist §1–8 |
| [`e2e/smoke-sections-9-16.spec.ts`](../e2e/smoke-sections-9-16.spec.ts) | Playwright coverage for smoke checklist §9–16 (staff/admin) |
