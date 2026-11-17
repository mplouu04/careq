-- Stage A: add nullable clinic_id columns (no backfill yet)
--
-- ROLLBACK: supabase/rollback/032_rollback.sql
-- (only valid before a second clinic exists; run after 033/034/034c rollbacks)

BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS clinic_id uuid;

ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS clinic_id uuid;

ALTER TABLE public.queue
  ADD COLUMN IF NOT EXISTS clinic_id uuid;

ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS clinic_id uuid;

ALTER TABLE public.display_settings
  ADD COLUMN IF NOT EXISTS clinic_id uuid;

ALTER TABLE public.appointment_types
  ADD COLUMN IF NOT EXISTS clinic_id uuid;

ALTER TABLE public.doctor_schedules
  ADD COLUMN IF NOT EXISTS clinic_id uuid;

ALTER TABLE public.doctor_blocks
  ADD COLUMN IF NOT EXISTS clinic_id uuid;

ALTER TABLE public.patient_sessions
  ADD COLUMN IF NOT EXISTS clinic_id uuid;

ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS clinic_id uuid;

ALTER TABLE public.email_verifications
  ADD COLUMN IF NOT EXISTS clinic_id uuid;

ALTER TABLE public.email_proofs
  ADD COLUMN IF NOT EXISTS clinic_id uuid;

ALTER TABLE public.clinic_settings
  ADD COLUMN IF NOT EXISTS clinic_id uuid;

ALTER TABLE public.daily_counters
  ADD COLUMN IF NOT EXISTS clinic_id uuid;

ALTER TABLE public.reminder_failures
  ADD COLUMN IF NOT EXISTS clinic_id uuid;

ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS clinic_id uuid;

ALTER TABLE public.rate_limits
  ADD COLUMN IF NOT EXISTS clinic_id uuid;

COMMIT;
