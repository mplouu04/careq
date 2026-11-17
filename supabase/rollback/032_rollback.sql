-- ROLLBACK for 032_clinic_id_columns_nullable.sql
-- WARNING: Only valid before a second clinic exists (single default clinic era).
-- Requires 033/034/034c already rolled back (no NOT NULL / FKs / indexes on clinic_id).
-- Not applied by migrate — run manually on a scratch/branch DB only.

BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.rate_limits DROP COLUMN IF EXISTS clinic_id;
ALTER TABLE public.audit_log DROP COLUMN IF EXISTS clinic_id;
ALTER TABLE public.reminder_failures DROP COLUMN IF EXISTS clinic_id;
ALTER TABLE public.daily_counters DROP COLUMN IF EXISTS clinic_id;
ALTER TABLE public.clinic_settings DROP COLUMN IF EXISTS clinic_id;
ALTER TABLE public.email_proofs DROP COLUMN IF EXISTS clinic_id;
ALTER TABLE public.email_verifications DROP COLUMN IF EXISTS clinic_id;
ALTER TABLE public.push_subscriptions DROP COLUMN IF EXISTS clinic_id;
ALTER TABLE public.patient_sessions DROP COLUMN IF EXISTS clinic_id;
ALTER TABLE public.doctor_blocks DROP COLUMN IF EXISTS clinic_id;
ALTER TABLE public.doctor_schedules DROP COLUMN IF EXISTS clinic_id;
ALTER TABLE public.appointment_types DROP COLUMN IF EXISTS clinic_id;
ALTER TABLE public.display_settings DROP COLUMN IF EXISTS clinic_id;
ALTER TABLE public.rooms DROP COLUMN IF EXISTS clinic_id;
ALTER TABLE public.queue DROP COLUMN IF EXISTS clinic_id;
ALTER TABLE public.checkins DROP COLUMN IF EXISTS clinic_id;
ALTER TABLE public.patients DROP COLUMN IF EXISTS clinic_id;

COMMIT;
