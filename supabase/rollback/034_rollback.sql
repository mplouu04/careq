-- ROLLBACK for 034_clinic_id_default_not_null_fks.sql
-- WARNING: Only valid before a second clinic exists (single default clinic era).
-- Drops Stage A clinic-scoped indexes/FKs, drops NOT NULL + DEFAULTs, restores
-- pre-034 next_counter(date, text) with original-style grants (PUBLIC EXECUTE from 004).
-- Prefer rolling back 034b first if it was applied.
-- Not applied by migrate — run manually on a scratch/branch DB only.

BEGIN;
SET LOCAL lock_timeout = '5s';

DROP INDEX IF EXISTS public.uq_queue_number_clinic_id_date;
DROP INDEX IF EXISTS public.uq_patients_clinic_phone_normalized;
DROP INDEX IF EXISTS public.uq_checkins_clinic_reference;
DROP INDEX IF EXISTS public.uq_push_subscriptions_clinic_endpoint;
DROP INDEX IF EXISTS public.uq_clinic_settings_clinic_id_key;
DROP INDEX IF EXISTS public.uq_daily_counters_clinic_date_key;
DROP INDEX IF EXISTS public.idx_patients_clinic_id;
DROP INDEX IF EXISTS public.idx_checkins_clinic_id;
DROP INDEX IF EXISTS public.idx_queue_clinic_id;
DROP INDEX IF EXISTS public.idx_queue_clinic_id_clinic_date_status;
DROP INDEX IF EXISTS public.idx_rooms_clinic_id;
DROP INDEX IF EXISTS public.idx_daily_counters_clinic_id;
DROP INDEX IF EXISTS public.idx_push_subscriptions_clinic_id;
DROP INDEX IF EXISTS public.idx_patient_sessions_clinic_id;
DROP INDEX IF EXISTS public.idx_appointment_types_clinic_id;
DROP INDEX IF EXISTS public.idx_doctor_schedules_clinic_id;
DROP INDEX IF EXISTS public.idx_doctor_blocks_clinic_id;
DROP INDEX IF EXISTS public.idx_display_settings_clinic_id;
DROP INDEX IF EXISTS public.idx_reminder_failures_clinic_id;
DROP INDEX IF EXISTS public.idx_email_verifications_clinic_id;
DROP INDEX IF EXISTS public.idx_email_proofs_clinic_id;

ALTER TABLE public.patients DROP CONSTRAINT IF EXISTS patients_clinic_id_fkey;
ALTER TABLE public.checkins DROP CONSTRAINT IF EXISTS checkins_clinic_id_fkey;
ALTER TABLE public.queue DROP CONSTRAINT IF EXISTS queue_clinic_id_fkey;
ALTER TABLE public.rooms DROP CONSTRAINT IF EXISTS rooms_clinic_id_fkey;
ALTER TABLE public.display_settings DROP CONSTRAINT IF EXISTS display_settings_clinic_id_fkey;
ALTER TABLE public.appointment_types DROP CONSTRAINT IF EXISTS appointment_types_clinic_id_fkey;
ALTER TABLE public.doctor_schedules DROP CONSTRAINT IF EXISTS doctor_schedules_clinic_id_fkey;
ALTER TABLE public.doctor_blocks DROP CONSTRAINT IF EXISTS doctor_blocks_clinic_id_fkey;
ALTER TABLE public.patient_sessions DROP CONSTRAINT IF EXISTS patient_sessions_clinic_id_fkey;
ALTER TABLE public.push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_clinic_id_fkey;
ALTER TABLE public.email_verifications DROP CONSTRAINT IF EXISTS email_verifications_clinic_id_fkey;
ALTER TABLE public.email_proofs DROP CONSTRAINT IF EXISTS email_proofs_clinic_id_fkey;
ALTER TABLE public.clinic_settings DROP CONSTRAINT IF EXISTS clinic_settings_clinic_id_fkey;
ALTER TABLE public.daily_counters DROP CONSTRAINT IF EXISTS daily_counters_clinic_id_fkey;
ALTER TABLE public.reminder_failures DROP CONSTRAINT IF EXISTS reminder_failures_clinic_id_fkey;

ALTER TABLE public.patients ALTER COLUMN clinic_id DROP NOT NULL;
ALTER TABLE public.checkins ALTER COLUMN clinic_id DROP NOT NULL;
ALTER TABLE public.queue ALTER COLUMN clinic_id DROP NOT NULL;
ALTER TABLE public.rooms ALTER COLUMN clinic_id DROP NOT NULL;
ALTER TABLE public.display_settings ALTER COLUMN clinic_id DROP NOT NULL;
ALTER TABLE public.appointment_types ALTER COLUMN clinic_id DROP NOT NULL;
ALTER TABLE public.doctor_schedules ALTER COLUMN clinic_id DROP NOT NULL;
ALTER TABLE public.doctor_blocks ALTER COLUMN clinic_id DROP NOT NULL;
ALTER TABLE public.patient_sessions ALTER COLUMN clinic_id DROP NOT NULL;
ALTER TABLE public.push_subscriptions ALTER COLUMN clinic_id DROP NOT NULL;
ALTER TABLE public.email_verifications ALTER COLUMN clinic_id DROP NOT NULL;
ALTER TABLE public.email_proofs ALTER COLUMN clinic_id DROP NOT NULL;
ALTER TABLE public.clinic_settings ALTER COLUMN clinic_id DROP NOT NULL;
ALTER TABLE public.daily_counters ALTER COLUMN clinic_id DROP NOT NULL;
ALTER TABLE public.reminder_failures ALTER COLUMN clinic_id DROP NOT NULL;

ALTER TABLE public.patients ALTER COLUMN clinic_id DROP DEFAULT;
ALTER TABLE public.checkins ALTER COLUMN clinic_id DROP DEFAULT;
ALTER TABLE public.queue ALTER COLUMN clinic_id DROP DEFAULT;
ALTER TABLE public.rooms ALTER COLUMN clinic_id DROP DEFAULT;
ALTER TABLE public.display_settings ALTER COLUMN clinic_id DROP DEFAULT;
ALTER TABLE public.appointment_types ALTER COLUMN clinic_id DROP DEFAULT;
ALTER TABLE public.doctor_schedules ALTER COLUMN clinic_id DROP DEFAULT;
ALTER TABLE public.doctor_blocks ALTER COLUMN clinic_id DROP DEFAULT;
ALTER TABLE public.patient_sessions ALTER COLUMN clinic_id DROP DEFAULT;
ALTER TABLE public.push_subscriptions ALTER COLUMN clinic_id DROP DEFAULT;
ALTER TABLE public.email_verifications ALTER COLUMN clinic_id DROP DEFAULT;
ALTER TABLE public.email_proofs ALTER COLUMN clinic_id DROP DEFAULT;
ALTER TABLE public.clinic_settings ALTER COLUMN clinic_id DROP DEFAULT;
ALTER TABLE public.daily_counters ALTER COLUMN clinic_id DROP DEFAULT;
ALTER TABLE public.reminder_failures ALTER COLUMN clinic_id DROP DEFAULT;

DROP FUNCTION IF EXISTS public.next_counter(DATE, TEXT, uuid);

-- Restore pre-034 definition (004): SECURITY INVOKER, ON CONFLICT (counter_date, counter_key)
CREATE OR REPLACE FUNCTION public.next_counter(p_date DATE, p_key TEXT)
RETURNS INT
LANGUAGE sql
SET search_path = public
AS $$
  INSERT INTO public.daily_counters (counter_date, counter_key, last_value)
  VALUES (p_date, p_key, 1)
  ON CONFLICT (counter_date, counter_key)
  DO UPDATE SET last_value = public.daily_counters.last_value + 1
  RETURNING last_value;
$$;

-- Original grants (004): no REVOKE — default PUBLIC EXECUTE
GRANT EXECUTE ON FUNCTION public.next_counter(DATE, TEXT) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_counter(DATE, TEXT) TO service_role;

COMMIT;
