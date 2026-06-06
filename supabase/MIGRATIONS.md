# Supabase Migrations Checklist

Run migrations **in order** in the Supabase SQL Editor (or via Supabase CLI).

## Order

| # | File | Purpose |
|---|------|---------|
| 1 | `001_schema.sql` | Core schema, enums, RLS policies, triggers, Realtime on `queue` |
| 2 | `002_seed.sql` | Reference data: check-in types, appointment types, rooms, displays |
| 3 | `003_booking_and_queue.sql` | `no_show` queue status, unique doctor-slot index, default schedules |
| 4 | `003_fix_staff_user_trigger.sql` | Fix `handle_new_staff_user()` SECURITY DEFINER grants |
| 5 | `004_atomic_counters.sql` | Atomic daily counters for queue numbers and reference IDs |
| 6 | `005_rate_limit_rpc.sql` | Atomic rate-limit increment RPC |
| 7 | `006_checkin_transaction.sql` | Transactional check-in RPC |
| 8 | `007_indexes_and_reminders.sql` | Performance indexes, `reminder_sent_at`, retention helpers |

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
SELECT next_counter(CURRENT_DATE, 'APPT');
SELECT next_counter(CURRENT_DATE, 'APPT');
-- should return 1 then 2

SELECT indexname FROM pg_indexes WHERE indexname IN ('uq_queue_number_day', 'uq_checkins_reference');
-- both should exist
```

After `007_indexes_and_reminders.sql`:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'checkins' AND column_name = 'reminder_sent_at';
-- should return one row

SELECT * FROM purge_old_logs(90);
-- should return rate_limits_deleted and audit_deleted counts
```

## Post-migration setup

1. Create admin user in **Authentication → Users** (see README).
2. Confirm Realtime is enabled on `queue` (done in migration 001).
3. Set environment variables in Vercel / `.env.local`.
