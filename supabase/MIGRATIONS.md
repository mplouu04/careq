# Supabase Migrations Checklist

Run migrations **in order** in the Supabase SQL Editor (or via Supabase CLI).

## Order

| # | File | Purpose |
|---|------|---------|
| 1 | `001_schema.sql` | Core schema, enums, RLS policies, triggers, Realtime on `queue` |
| 2 | `002_seed.sql` | Reference data: check-in types, appointment types, rooms, displays |
| 3 | `003_booking_and_queue.sql` | `no_show` queue status, unique doctor-slot index, default schedules |
| 4 | `003_fix_staff_user_trigger.sql` | Fix `handle_new_staff_user()` SECURITY DEFINER grants |
| 5 | `003_improvements.sql` | Additional schema improvements |
| 6 | `004_atomic_counters.sql` | Atomic daily counters for queue numbers and reference IDs |
| 7 | `005_rate_limit_rpc.sql` | Atomic rate-limit increment RPC |
| 8 | `006_checkin_transaction.sql` | Transactional check-in RPC |
| 9 | `007_indexes_and_reminders.sql` | Performance indexes, `reminder_sent_at`, retention helpers |
| 10 | `008_patient_sessions.sql` | Short-lived verification tokens |
| 11 | `009_patients_public_id.sql` | Opaque `public_id` on patients |
| 12 | `010_unique_phone_normalized.sql` | Unique index on `phone_normalized` |
| 13 | `011_backfill_phone_normalized.sql` | Backfill legacy phone rows |
| 14 | `012_checkins_realtime.sql` | Enable Realtime on `checkins` |
| 15 | `013_queue_replica_identity.sql` | `REPLICA IDENTITY FULL` on `queue` |
| 16 | `014_queue_perf_indexes.sql` | Queue API performance indexes |
| 17 | `015_audit_remediation.sql` | Audit indexes, RLS scope, reminder failures, staff trigger hardening |
| 18 | `016_staff_realtime.sql` | Realtime on `staff` + `REPLICA IDENTITY FULL` for doctor catalog sync |
| 19 | `017_queue_metrics_rpc.sql` | SQL avg service time and daily history aggregation RPCs |
| 20 | `018_queue_clinic_date.sql` | `queue.clinic_date` + index for same-day board/staff filters |
| 21 | `018_schedule_realtime.sql` | Realtime on `doctor_schedules` / `doctor_blocks` for live slot updates |
| 22 | `019_push_subscriptions.sql` | `push_subscriptions` table for Web Push turn notifications |
| 23 | `020_schedule_replica_identity.sql` | `REPLICA IDENTITY FULL` on schedule/block tables so UPDATE/DELETE emit realtime events |
| 24 | `021_staff_trigger_insert_only.sql` | Staff auth trigger only runs on INSERT (not UPDATE) |
| 25 | `022_audit_hardening.sql` | Slot booking RPC, `phone_last7` index, schedule upsert RPC, atomic verify-failure counter |
| 26 | `023_queue_number_clinic_date.sql` | Unique `(queue_number, clinic_date)` instead of UTC day — fixes midnight walk-in collisions |
| 27 | `024_email_verifications.sql` | Email verification codes + short-lived email proof tokens for register/guest book |

**Note:** Three files share the `003_` prefix. Always apply them in the order above (`003_booking_and_queue` → `003_fix_staff_user_trigger` → `003_improvements`).

**Note:** Two files share the `018_` prefix (`018_queue_clinic_date.sql` then `018_schedule_realtime.sql`). Apply in the order listed above.

## Verification queries

After `001_schema.sql`:

```sql
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' AND tablename IN ('staff','patients','checkins','queue');
-- rowsecurity should be true for all

SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'queue';
-- should return one row
```

After `003_booking_and_queue.sql`:

```sql
SELECT indexname FROM pg_indexes WHERE indexname = 'uq_checkin_doctor_slot';
-- should exist
```

After `004_atomic_counters.sql`:

```sql
SELECT proname FROM pg_proc WHERE proname = 'next_counter';
```

After `015_audit_remediation.sql`:

```sql
SELECT indexname FROM pg_indexes WHERE indexname = 'idx_patients_dob';
SELECT proname FROM pg_proc WHERE proname = 'get_queue_waiting_position';
SELECT tablename FROM pg_tables WHERE tablename = 'reminder_failures';
```

After `016_staff_realtime.sql`:

```sql
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'staff';
-- should return one row
```

After `017_queue_metrics_rpc.sql`:

```sql
SELECT proname FROM pg_proc WHERE proname IN ('get_avg_service_minutes', 'get_queue_served_by_day');
```

After `018_queue_clinic_date.sql`:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'queue' AND column_name = 'clinic_date';
-- should return one row

SELECT indexname FROM pg_indexes WHERE indexname = 'idx_queue_clinic_date_status_order';
```

After `018_schedule_realtime.sql`:

```sql
SELECT tablename FROM pg_publication_tables
WHERE pubname = 'supabase_realtime' AND tablename IN ('doctor_schedules','doctor_blocks');
-- should return two rows
```

After `019_push_subscriptions.sql`:

```sql
SELECT tablename FROM pg_tables WHERE tablename = 'push_subscriptions';
-- should return one row
```

After `020_schedule_replica_identity.sql`:

```sql
SELECT relname, relreplident FROM pg_class
WHERE relname IN ('doctor_schedules','doctor_blocks');
-- relreplident should be 'f' (full) for both
```

After `022_audit_hardening.sql`:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'patients' AND column_name = 'phone_last7';

SELECT proname FROM pg_proc
WHERE proname IN (
  'book_appointment_slot',
  'upsert_doctor_schedules',
  'record_verification_failure'
);
-- should return three rows
```
