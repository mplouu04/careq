-- Stage A: temporary clinic_id DEFAULTs + backfill to default clinic
-- Default clinic id: a0000000-0000-4000-8000-000000000001
--
-- DEFAULTs live here (not in 034). Dropped later in Stage C (038).
-- audit_log: optional backfill only; stays nullable. rate_limits: NOT backfilled.
--
-- ROLLBACK: supabase/rollback/033_rollback.sql (only valid before a second clinic exists)

BEGIN;
SET LOCAL lock_timeout = '5s';

DO $$
DECLARE
  v_default uuid := 'a0000000-0000-4000-8000-000000000001'::uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.clinics WHERE id = v_default) THEN
    RAISE EXCEPTION 'Default clinic % missing — run 031 first', v_default;
  END IF;

  -- Temporary DEFAULTs (before backfill so concurrent inserts get a clinic)
  ALTER TABLE public.patients ALTER COLUMN clinic_id SET DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid;
  ALTER TABLE public.checkins ALTER COLUMN clinic_id SET DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid;
  ALTER TABLE public.queue ALTER COLUMN clinic_id SET DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid;
  ALTER TABLE public.rooms ALTER COLUMN clinic_id SET DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid;
  ALTER TABLE public.display_settings ALTER COLUMN clinic_id SET DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid;
  ALTER TABLE public.appointment_types ALTER COLUMN clinic_id SET DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid;
  ALTER TABLE public.doctor_schedules ALTER COLUMN clinic_id SET DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid;
  ALTER TABLE public.doctor_blocks ALTER COLUMN clinic_id SET DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid;
  ALTER TABLE public.patient_sessions ALTER COLUMN clinic_id SET DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid;
  ALTER TABLE public.push_subscriptions ALTER COLUMN clinic_id SET DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid;
  ALTER TABLE public.email_verifications ALTER COLUMN clinic_id SET DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid;
  ALTER TABLE public.email_proofs ALTER COLUMN clinic_id SET DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid;
  ALTER TABLE public.clinic_settings ALTER COLUMN clinic_id SET DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid;
  ALTER TABLE public.daily_counters ALTER COLUMN clinic_id SET DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid;
  ALTER TABLE public.reminder_failures ALTER COLUMN clinic_id SET DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid;

  UPDATE public.patients SET clinic_id = v_default WHERE clinic_id IS NULL;
  UPDATE public.checkins SET clinic_id = v_default WHERE clinic_id IS NULL;
  UPDATE public.queue SET clinic_id = v_default WHERE clinic_id IS NULL;
  UPDATE public.rooms SET clinic_id = v_default WHERE clinic_id IS NULL;
  UPDATE public.display_settings SET clinic_id = v_default WHERE clinic_id IS NULL;
  UPDATE public.appointment_types SET clinic_id = v_default WHERE clinic_id IS NULL;
  UPDATE public.doctor_schedules SET clinic_id = v_default WHERE clinic_id IS NULL;
  UPDATE public.doctor_blocks SET clinic_id = v_default WHERE clinic_id IS NULL;
  UPDATE public.patient_sessions SET clinic_id = v_default WHERE clinic_id IS NULL;
  UPDATE public.push_subscriptions SET clinic_id = v_default WHERE clinic_id IS NULL;
  UPDATE public.email_verifications SET clinic_id = v_default WHERE clinic_id IS NULL;
  UPDATE public.email_proofs SET clinic_id = v_default WHERE clinic_id IS NULL;
  UPDATE public.clinic_settings SET clinic_id = v_default WHERE clinic_id IS NULL;
  UPDATE public.daily_counters SET clinic_id = v_default WHERE clinic_id IS NULL;
  UPDATE public.reminder_failures SET clinic_id = v_default WHERE clinic_id IS NULL;

  -- Nullable forever (no NOT NULL in 034): best-effort label only
  UPDATE public.audit_log SET clinic_id = v_default WHERE clinic_id IS NULL;
  -- rate_limits: intentionally NOT backfilled

  IF EXISTS (SELECT 1 FROM public.patients WHERE clinic_id IS NULL)
    OR EXISTS (SELECT 1 FROM public.checkins WHERE clinic_id IS NULL)
    OR EXISTS (SELECT 1 FROM public.queue WHERE clinic_id IS NULL)
    OR EXISTS (SELECT 1 FROM public.rooms WHERE clinic_id IS NULL)
    OR EXISTS (SELECT 1 FROM public.display_settings WHERE clinic_id IS NULL)
    OR EXISTS (SELECT 1 FROM public.appointment_types WHERE clinic_id IS NULL)
    OR EXISTS (SELECT 1 FROM public.doctor_schedules WHERE clinic_id IS NULL)
    OR EXISTS (SELECT 1 FROM public.doctor_blocks WHERE clinic_id IS NULL)
    OR EXISTS (SELECT 1 FROM public.patient_sessions WHERE clinic_id IS NULL)
    OR EXISTS (SELECT 1 FROM public.push_subscriptions WHERE clinic_id IS NULL)
    OR EXISTS (SELECT 1 FROM public.email_verifications WHERE clinic_id IS NULL)
    OR EXISTS (SELECT 1 FROM public.email_proofs WHERE clinic_id IS NULL)
    OR EXISTS (SELECT 1 FROM public.clinic_settings WHERE clinic_id IS NULL)
    OR EXISTS (SELECT 1 FROM public.daily_counters WHERE clinic_id IS NULL)
    OR EXISTS (SELECT 1 FROM public.reminder_failures WHERE clinic_id IS NULL)
  THEN
    RAISE EXCEPTION '033 post-check: null clinic_id remains on a tenant table';
  END IF;
END $$;

COMMIT;
