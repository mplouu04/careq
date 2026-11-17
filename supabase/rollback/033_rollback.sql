-- ROLLBACK for 033_clinic_id_backfill.sql
-- WARNING: Only valid before a second clinic exists (single default clinic era).
-- Clears DEFAULTs and nulls clinic_id back to pre-033 (requires 034/034c rolled back first
-- so columns are nullable again).
-- Not applied by migrate — run manually on a scratch/branch DB only.

BEGIN;
SET LOCAL lock_timeout = '5s';

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

UPDATE public.patients SET clinic_id = NULL
  WHERE clinic_id = 'a0000000-0000-4000-8000-000000000001'::uuid;
UPDATE public.checkins SET clinic_id = NULL
  WHERE clinic_id = 'a0000000-0000-4000-8000-000000000001'::uuid;
UPDATE public.queue SET clinic_id = NULL
  WHERE clinic_id = 'a0000000-0000-4000-8000-000000000001'::uuid;
UPDATE public.rooms SET clinic_id = NULL
  WHERE clinic_id = 'a0000000-0000-4000-8000-000000000001'::uuid;
UPDATE public.display_settings SET clinic_id = NULL
  WHERE clinic_id = 'a0000000-0000-4000-8000-000000000001'::uuid;
UPDATE public.appointment_types SET clinic_id = NULL
  WHERE clinic_id = 'a0000000-0000-4000-8000-000000000001'::uuid;
UPDATE public.doctor_schedules SET clinic_id = NULL
  WHERE clinic_id = 'a0000000-0000-4000-8000-000000000001'::uuid;
UPDATE public.doctor_blocks SET clinic_id = NULL
  WHERE clinic_id = 'a0000000-0000-4000-8000-000000000001'::uuid;
UPDATE public.patient_sessions SET clinic_id = NULL
  WHERE clinic_id = 'a0000000-0000-4000-8000-000000000001'::uuid;
UPDATE public.push_subscriptions SET clinic_id = NULL
  WHERE clinic_id = 'a0000000-0000-4000-8000-000000000001'::uuid;
UPDATE public.email_verifications SET clinic_id = NULL
  WHERE clinic_id = 'a0000000-0000-4000-8000-000000000001'::uuid;
UPDATE public.email_proofs SET clinic_id = NULL
  WHERE clinic_id = 'a0000000-0000-4000-8000-000000000001'::uuid;
UPDATE public.clinic_settings SET clinic_id = NULL
  WHERE clinic_id = 'a0000000-0000-4000-8000-000000000001'::uuid;
UPDATE public.daily_counters SET clinic_id = NULL
  WHERE clinic_id = 'a0000000-0000-4000-8000-000000000001'::uuid;
UPDATE public.reminder_failures SET clinic_id = NULL
  WHERE clinic_id = 'a0000000-0000-4000-8000-000000000001'::uuid;
UPDATE public.audit_log SET clinic_id = NULL
  WHERE clinic_id = 'a0000000-0000-4000-8000-000000000001'::uuid;

COMMIT;
