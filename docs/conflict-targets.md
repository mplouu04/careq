# Conflict targets (multi-tenant transition)

During Stage A–B, **legacy global uniques stay** so the old app keeps working. Stage A **adds** clinic-scoped unique indexes. Stage C (**038**) drops the legacy globals / PKs and may elevate clinic-scoped indexes to PKs.

Default clinic id: `a0000000-0000-4000-8000-000000000001`  
Default slug: `careq`

Temporary `clinic_id` **DEFAULTs** are set in **033** (asserted in **034**); dropped in **038**.

Rollbacks (scratch only, **before a second clinic exists**): `supabase/rollback/031_rollback.sql` … `034b_rollback.sql`.

## `daily_counters` / `next_counter`

| Stage | Physical constraint | `ON CONFLICT` / RPC |
|-------|---------------------|---------------------|
| Pre-A | PK `(counter_date, counter_key)`; column `last_value` | `ON CONFLICT (counter_date, counter_key)` |
| **A–B** | **Keep** PK `(counter_date, counter_key)` **and** unique index `uq_daily_counters_clinic_date_key` on `(clinic_id, counter_date, counter_key)` | `next_counter(date, key, clinic_id DEFAULT default)` uses **`ON CONFLICT (clinic_id, counter_date, counter_key)`** |
| **C** | Drop old PK; PK or unique remains clinic-scoped | Same clinic-scoped conflict target |

**034:** snapshot `pg_proc`, recreate with same security, `GRANT` `service_role`.  
**034c:** `VALIDATE CONSTRAINT` on all `*_clinic_id_fkey`.  
**034b:** `REVOKE` client EXECUTE (after [`rpc-callers.md`](./rpc-callers.md)).

### Call sites (RPC)

| Location | Calls | Args today |
|----------|-------|------------|
| `lib/counters.ts` → `nextCounter()` | `rpc("next_counter")` **service-role** | `p_date`, `p_key` |
| `lib/counters.ts` → `checkinToQueue()` | `rpc("checkin_to_queue")` **service-role** | `p_checkin_id`, `p_prefix` |
| `lib/services/checkin.service.ts` | via counters helper | same |
| `lib/services/appointment.service.ts` | `nextAppointmentReference()` | via counters |
| `public.checkin_to_queue` (`018`) | `next_counter(v_date, p_prefix)` | 2-arg |

### Upsert call sites

| Location | Table / RPC | Conflict target (today) | Client | Safe after Stage A? |
|----------|-------------|-------------------------|--------|---------------------|
| `lib/counters.ts` / `next_counter` SQL | `daily_counters` | **A–B:** `(clinic_id, counter_date, counter_key)` via 3-arg RPC; legacy PK `(counter_date, counter_key)` still blocks cross-clinic | service-role | Yes (default clinic) |
| `app/api/push/subscribe/route.ts` | `push_subscriptions` | `onConflict: "endpoint"` (legacy UNIQUE) | service-role | Yes until Stage C drops legacy endpoint unique |
| `lib/clinic-settings.ts` | `clinic_settings` | `onConflict: "setting_key"` (legacy PK) | service-role | Yes until Stage C → `(clinic_id, setting_key)` |
| `app/api/admin/doctors/route.ts` | `upsert_doctor_schedules` RPC | `ON CONFLICT (doctor_id, day_of_week)` inside RPC (`022`) | service-role | Yes (schedules get `clinic_id` DEFAULT) |
| `lib/services/admin.service.ts` | `staff` | upsert by `id` (implicit PK; no `onConflict` option) | service-role | Yes (staff not tenant-row; membership via `staff_clinics`) |

### All unique constraints (audit)

| Name | Table | Columns / predicate | Source | Stage A status |
|------|-------|---------------------|--------|----------------|
| `staff_pkey` / `staff.email` UNIQUE | `staff` | `id`; `email` | `001` | Unchanged |
| `uq_patients_email` | `patients` | `(email) WHERE email IS NOT NULL` | `001` | Unchanged (still global) |
| `uq_patients_public_id` | `patients` | `(public_id)` | `009` | Unchanged |
| `uq_patients_phone_normalized` | `patients` | `(phone_normalized) WHERE NOT NULL` | `010` | **Keep** (legacy) |
| `uq_patients_clinic_phone_normalized` | `patients` | `(clinic_id, phone_normalized) WHERE NOT NULL` | `034` | **Added** |
| `uq_checkins_reference` | `checkins` | `(reference_number)` | `004` | **Keep** (legacy) |
| `uq_checkins_clinic_reference` | `checkins` | `(clinic_id, reference_number)` | `034` | **Added** |
| `uq_checkin_doctor_slot` | `checkins` | `(doctor_id, appointment_date, scheduled_time)` partial | `003` | Unchanged (still global) |
| `uq_queue_number_clinic_date` | `queue` | `(queue_number, clinic_date)` | `023` | **Keep** (legacy index) |
| `uq_queue_number_clinic_id_date` | `queue` | `(clinic_id, queue_number, clinic_date)` | `034` | **Added** |
| `daily_counters_pkey` | `daily_counters` | `(counter_date, counter_key)` | `004` | **Keep** (legacy PK) |
| `uq_daily_counters_clinic_date_key` | `daily_counters` | `(clinic_id, counter_date, counter_key)` | `034` | **Added** |
| `push_subscriptions_endpoint_key` | `push_subscriptions` | `(endpoint)` | `019` UNIQUE col | **Keep** (legacy) |
| `uq_push_subscriptions_clinic_endpoint` | `push_subscriptions` | `(clinic_id, endpoint)` | `034` | **Added** |
| `clinic_settings_pkey` | `clinic_settings` | `(setting_key)` | `027` | **Keep** (legacy) |
| `uq_clinic_settings_clinic_id_key` | `clinic_settings` | `(clinic_id, setting_key)` | `034` | **Added** |
| `doctor_schedules` UNIQUE | `doctor_schedules` | `(doctor_id, day_of_week)` | `001` | Unchanged (still global) |
| `uq_appointment_types_name` | `appointment_types` | `(name)` | `015` | Unchanged (still global) |
| `uq_rooms_name` | `rooms` | `(name)` | `015` | Unchanged (still global) |
| `uq_clinics_slug` | `clinics` | `(slug)` | `031` | New |
| `staff_clinics_pkey` | `staff_clinics` | `(staff_id, clinic_id)` | `031` | New |
| `clinic_slug_redirects_pkey` | `clinic_slug_redirects` | `(old_slug)` | `031` | New |

## `checkin_to_queue` (Stage B — **035**)

1. Snapshot `prosecdef` / `proacl` for `checkin_to_queue(integer, text)`.
2. Create 3-arg clinic-scoped RPC; keep `service_role` EXECUTE; client REVOKE via 034b pattern.
3. **`DROP FUNCTION` old 2-arg** in the same migration.
4. Validate checkin belongs to `p_clinic_id`; insert `queue.clinic_id`.

## Supporting indexes (034)

Non-unique `clinic_id` indexes + `idx_queue_clinic_id_clinic_date_status` — see migration `034`.

## Slugs / redirects (031)

- Trigger: `clinic_slug_redirect_conflicts_live_slug:%` (SQLSTATE `P0001`)
- No anon/authenticated table privileges on `clinics` / `staff_clinics` / `clinic_slug_redirects`
