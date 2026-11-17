-- Stage A: NOT NULL, FKs (RESTRICT NOT VALID), clinic-scoped uniques/indexes,
-- rewrite next_counter preserving SECURITY from pg_proc; GRANT service_role.
-- VALIDATE lives in 034c. Temporary DEFAULTs are set in 033 — this file asserts them.
-- Keep legacy global uniques / PKs until Stage C (038) — see docs/conflict-targets.md.
--
-- 035 note: rewrite checkin_to_queue the same way — snapshot prosecdef/proacl before DROP.
--
-- ROLLBACK: supabase/rollback/034_rollback.sql (only valid before a second clinic exists)

BEGIN;
SET LOCAL lock_timeout = '5s';

DO $$
DECLARE
  v_default uuid := 'a0000000-0000-4000-8000-000000000001'::uuid;
  r record;
BEGIN
  -- Pre-flight: columns required for unique indexes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'patients' AND column_name = 'phone_normalized'
  ) THEN
    RAISE EXCEPTION 'patients.phone_normalized missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'checkins' AND column_name = 'reference_number'
  ) THEN
    RAISE EXCEPTION 'checkins.reference_number missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'daily_counters' AND column_name = 'last_value'
  ) THEN
    RAISE EXCEPTION 'daily_counters.last_value missing';
  END IF;

  -- Assert temporary DEFAULTs from 033
  FOR r IN
    SELECT unnest(ARRAY[
      'patients','checkins','queue','rooms','display_settings','appointment_types',
      'doctor_schedules','doctor_blocks','patient_sessions','push_subscriptions',
      'email_verifications','email_proofs','clinic_settings','daily_counters','reminder_failures'
    ]) AS tbl
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = r.tbl
        AND column_name = 'clinic_id'
        AND column_default ILIKE '%a0000000-0000-4000-8000-000000000001%'
    ) THEN
      RAISE EXCEPTION 'clinic_id DEFAULT missing on %.% — run 033 first', 'public', r.tbl;
    END IF;
  END LOOP;

  -- Final null sweep before NOT NULL
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
    RAISE EXCEPTION 'Null clinic_id remains on a NOT NULL target — run 033 backfill first';
  END IF;
END $$;

-- NOT NULL on tenant-required tables (audit_log / rate_limits stay nullable)
ALTER TABLE public.patients ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.checkins ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.queue ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.rooms ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.display_settings ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.appointment_types ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.doctor_schedules ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.doctor_blocks ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.patient_sessions ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.push_subscriptions ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.email_verifications ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.email_proofs ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.clinic_settings ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.daily_counters ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.reminder_failures ALTER COLUMN clinic_id SET NOT NULL;

-- Foreign keys: ADD NOT VALID if missing (VALIDATE in 034c; re-runs do not DROP existing FKs)
DO $$
DECLARE
  tables text[] := ARRAY[
    'patients','checkins','queue','rooms','display_settings','appointment_types',
    'doctor_schedules','doctor_blocks','patient_sessions','push_subscriptions',
    'email_verifications','email_proofs','clinic_settings','daily_counters','reminder_failures'
  ];
  t text;
  cname text;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    cname := t || '_clinic_id_fkey';
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class rel ON rel.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = rel.relnamespace
      WHERE n.nspname = 'public' AND rel.relname = t AND c.conname = cname
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (clinic_id) REFERENCES public.clinics (id) ON DELETE RESTRICT NOT VALID',
        t, cname
      );
    END IF;
  END LOOP;
END $$;

-- ADD clinic-scoped unique indexes (do NOT drop legacy globals — Stage C)
CREATE UNIQUE INDEX IF NOT EXISTS uq_queue_number_clinic_id_date
  ON public.queue (clinic_id, queue_number, clinic_date);

CREATE UNIQUE INDEX IF NOT EXISTS uq_patients_clinic_phone_normalized
  ON public.patients (clinic_id, phone_normalized)
  WHERE phone_normalized IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_checkins_clinic_reference
  ON public.checkins (clinic_id, reference_number);

CREATE UNIQUE INDEX IF NOT EXISTS uq_push_subscriptions_clinic_endpoint
  ON public.push_subscriptions (clinic_id, endpoint);

CREATE UNIQUE INDEX IF NOT EXISTS uq_clinic_settings_clinic_id_key
  ON public.clinic_settings (clinic_id, setting_key);

CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_counters_clinic_date_key
  ON public.daily_counters (clinic_id, counter_date, counter_key);

-- Non-unique clinic_id / queue filter indexes
CREATE INDEX IF NOT EXISTS idx_patients_clinic_id ON public.patients (clinic_id);
CREATE INDEX IF NOT EXISTS idx_checkins_clinic_id ON public.checkins (clinic_id);
CREATE INDEX IF NOT EXISTS idx_queue_clinic_id ON public.queue (clinic_id);
CREATE INDEX IF NOT EXISTS idx_queue_clinic_id_clinic_date_status
  ON public.queue (clinic_id, clinic_date, status);
CREATE INDEX IF NOT EXISTS idx_rooms_clinic_id ON public.rooms (clinic_id);
CREATE INDEX IF NOT EXISTS idx_daily_counters_clinic_id ON public.daily_counters (clinic_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_clinic_id ON public.push_subscriptions (clinic_id);
CREATE INDEX IF NOT EXISTS idx_patient_sessions_clinic_id ON public.patient_sessions (clinic_id);
CREATE INDEX IF NOT EXISTS idx_appointment_types_clinic_id ON public.appointment_types (clinic_id);
CREATE INDEX IF NOT EXISTS idx_doctor_schedules_clinic_id ON public.doctor_schedules (clinic_id);
CREATE INDEX IF NOT EXISTS idx_doctor_blocks_clinic_id ON public.doctor_blocks (clinic_id);
CREATE INDEX IF NOT EXISTS idx_display_settings_clinic_id ON public.display_settings (clinic_id);
CREATE INDEX IF NOT EXISTS idx_reminder_failures_clinic_id ON public.reminder_failures (clinic_id);
CREATE INDEX IF NOT EXISTS idx_email_verifications_clinic_id ON public.email_verifications (clinic_id);
CREATE INDEX IF NOT EXISTS idx_email_proofs_clinic_id ON public.email_proofs (clinic_id);

-- next_counter: snapshot original SECURITY + EXECUTE grants (pg_proc), then recreate
DO $$
DECLARE
  v_oid oid;
  v_prosecdef boolean;
  v_proacl aclitem[];
  v_args text;
  v_grant_public boolean := false;
  v_grant_anon boolean := false;
  v_grant_authenticated boolean := false;
  v_grant_service_role boolean := false;
  v_sql text;
  v_sec text;
BEGIN
  v_oid := to_regprocedure('public.next_counter(date,text)');
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'public.next_counter(date, text) not found — cannot preserve grants';
  END IF;

  SELECT p.prosecdef, p.proacl, pg_get_function_identity_arguments(p.oid)
  INTO v_prosecdef, v_proacl, v_args
  FROM pg_proc p
  WHERE p.oid = v_oid;

  -- Direct ACL entries (grantee 0 = PUBLIC). NULL proacl ⇒ default PUBLIC EXECUTE.
  IF v_proacl IS NULL THEN
    v_grant_public := true;
  ELSE
    v_grant_public := EXISTS (
      SELECT 1 FROM aclexplode(v_proacl) a
      WHERE a.privilege_type = 'EXECUTE' AND a.grantee = 0
    );
    v_grant_anon := EXISTS (
      SELECT 1 FROM aclexplode(v_proacl) a
      WHERE a.privilege_type = 'EXECUTE' AND a.grantee = (SELECT oid FROM pg_roles WHERE rolname = 'anon')
    );
    v_grant_authenticated := EXISTS (
      SELECT 1 FROM aclexplode(v_proacl) a
      WHERE a.privilege_type = 'EXECUTE' AND a.grantee = (SELECT oid FROM pg_roles WHERE rolname = 'authenticated')
    );
    v_grant_service_role := EXISTS (
      SELECT 1 FROM aclexplode(v_proacl) a
      WHERE a.privilege_type = 'EXECUTE' AND a.grantee = (SELECT oid FROM pg_roles WHERE rolname = 'service_role')
    );
  END IF;

  RAISE NOTICE
    'next_counter original: args=%, prosecdef=%, EXECUTE public=%, anon=%, authenticated=%, service_role=%',
    v_args, v_prosecdef, v_grant_public, v_grant_anon, v_grant_authenticated, v_grant_service_role;

  DROP FUNCTION IF EXISTS public.next_counter(DATE, TEXT);

  v_sec := CASE WHEN v_prosecdef THEN 'SECURITY DEFINER' ELSE '' END;
  v_sql := format(
    $f$
    CREATE FUNCTION public.next_counter(
      p_date DATE,
      p_key TEXT,
      p_clinic_id uuid DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid
    )
    RETURNS INT
    LANGUAGE sql
    %s
    SET search_path = public
    AS $body$
      INSERT INTO public.daily_counters (clinic_id, counter_date, counter_key, last_value)
      VALUES (p_clinic_id, p_date, p_key, 1)
      ON CONFLICT (clinic_id, counter_date, counter_key)
      DO UPDATE SET last_value = public.daily_counters.last_value + 1
      RETURNING last_value;
    $body$;
    $f$,
    v_sec
  );
  EXECUTE v_sql;

  -- Grant service_role EXECUTE so admin client keeps working.
  -- Client REVOKE (PUBLIC/anon/authenticated) is deferred to 034b — apply after
  -- confirming callers in docs/rpc-callers.md.
  GRANT EXECUTE ON FUNCTION public.next_counter(DATE, TEXT, uuid) TO service_role;
END $$;

COMMIT;
