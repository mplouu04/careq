-- Manual verification after Stage A (031–034 + 034c + 034b) on a branch / copy.
-- Do NOT use as an automatic migration. Do NOT run against production without approval.
-- Full order: docs/rehearsal-runbook.md
--
-- Run with psql (or any client that prints NOTICE / EXCEPTION output).
-- Silence is NOT a pass — expect RAISE NOTICE 'PASS: …' from each transactional test
-- and zero FAIL rows from structural SELECTs.
--
-- Convention: every FAIL check returns ZERO ROWS when healthy.
-- See also docs/conflict-targets.md and docs/rpc-callers.md.
--
-- Default clinic: a0000000-0000-4000-8000-000000000001 (slug careq)
--
-- Ops notes:
--   • Run BEFORE rowcounts, then 031–034–034c, old-app smoke, then 034b, then role tests.
--   • Check 8 expects FKs validated → requires 034c.
--   • Review informational trigger list (10d) BEFORE running DDL tests 13/14.
--   • Transactional tests 11–19: run EACH as a SEPARATE execution (own BEGIN…ROLLBACK).
--     If a DO block errors, run ROLLBACK; manually before the next test.
--   • Update / replace test 14 after migration 035 (3-arg checkin_to_queue + DROP 2-arg).
--   • Role tests 18–19 require 034b applied (client EXECUTE revoked).
--
-- Legacy index name audit (check 7 vs migrations):
--   uq_queue_number_clinic_date     → UNIQUE INDEX (023) — use DROP INDEX (not constraint)
--   uq_patients_phone_normalized    → UNIQUE INDEX (010) — matches
--   uq_checkins_reference           → UNIQUE INDEX (004) — matches
--   push_subscriptions_endpoint_key → UNIQUE column constraint/index (019) — matches
--   clinic_settings_pkey            → PRIMARY KEY (setting_key) (027) — matches
--   daily_counters_pkey             → PRIMARY KEY (counter_date, counter_key) (004) — matches
--   (No name mismatches found.)

-- =============================================================================
-- BEFORE migrations (run this block ALONE)
-- IMMEDIATELY BEFORE 031 on an idle branch (no concurrent writes).
-- =============================================================================
/*
DROP TABLE IF EXISTS public._verify_rowcounts_before;
CREATE TABLE public._verify_rowcounts_before (
  tbl text PRIMARY KEY,
  n bigint NOT NULL
);

REVOKE ALL ON TABLE public._verify_rowcounts_before FROM anon, authenticated;

INSERT INTO public._verify_rowcounts_before (tbl, n)
SELECT * FROM (
  VALUES
    ('patients', (SELECT count(*) FROM public.patients)),
    ('checkins', (SELECT count(*) FROM public.checkins)),
    ('queue', (SELECT count(*) FROM public.queue)),
    ('rooms', (SELECT count(*) FROM public.rooms)),
    ('display_settings', (SELECT count(*) FROM public.display_settings)),
    ('appointment_types', (SELECT count(*) FROM public.appointment_types)),
    ('doctor_schedules', (SELECT count(*) FROM public.doctor_schedules)),
    ('doctor_blocks', (SELECT count(*) FROM public.doctor_blocks)),
    ('patient_sessions', (SELECT count(*) FROM public.patient_sessions)),
    ('push_subscriptions', (SELECT count(*) FROM public.push_subscriptions)),
    ('email_verifications', (SELECT count(*) FROM public.email_verifications)),
    ('email_proofs', (SELECT count(*) FROM public.email_proofs)),
    ('clinic_settings', (SELECT count(*) FROM public.clinic_settings)),
    ('daily_counters', (SELECT count(*) FROM public.daily_counters)),
    ('reminder_failures', (SELECT count(*) FROM public.reminder_failures)),
    ('audit_log', (SELECT count(*) FROM public.audit_log)),
    ('rate_limits', (SELECT count(*) FROM public.rate_limits)),
    ('staff', (SELECT count(*) FROM public.staff))
) AS v(tbl, n);
*/
-- Stop. Apply 031–034. Then run FROM "AFTER" below (leave BEFORE commented).

-- =============================================================================
-- AFTER 031–034 — structural FAIL checks (0 rows = healthy)
-- =============================================================================

-- 1) Default clinic missing
SELECT 'default_clinic_missing' AS fail
WHERE NOT EXISTS (
  SELECT 1 FROM public.clinics
  WHERE id = 'a0000000-0000-4000-8000-000000000001'::uuid
);

-- 2) Null clinic_id on NOT NULL targets
SELECT tbl AS fail_null_clinic_id, n
FROM (
  SELECT 'patients' AS tbl, count(*) AS n FROM public.patients WHERE clinic_id IS NULL
  UNION ALL SELECT 'checkins', count(*) FROM public.checkins WHERE clinic_id IS NULL
  UNION ALL SELECT 'queue', count(*) FROM public.queue WHERE clinic_id IS NULL
  UNION ALL SELECT 'rooms', count(*) FROM public.rooms WHERE clinic_id IS NULL
  UNION ALL SELECT 'display_settings', count(*) FROM public.display_settings WHERE clinic_id IS NULL
  UNION ALL SELECT 'appointment_types', count(*) FROM public.appointment_types WHERE clinic_id IS NULL
  UNION ALL SELECT 'doctor_schedules', count(*) FROM public.doctor_schedules WHERE clinic_id IS NULL
  UNION ALL SELECT 'doctor_blocks', count(*) FROM public.doctor_blocks WHERE clinic_id IS NULL
  UNION ALL SELECT 'patient_sessions', count(*) FROM public.patient_sessions WHERE clinic_id IS NULL
  UNION ALL SELECT 'push_subscriptions', count(*) FROM public.push_subscriptions WHERE clinic_id IS NULL
  UNION ALL SELECT 'email_verifications', count(*) FROM public.email_verifications WHERE clinic_id IS NULL
  UNION ALL SELECT 'email_proofs', count(*) FROM public.email_proofs WHERE clinic_id IS NULL
  UNION ALL SELECT 'clinic_settings', count(*) FROM public.clinic_settings WHERE clinic_id IS NULL
  UNION ALL SELECT 'daily_counters', count(*) FROM public.daily_counters WHERE clinic_id IS NULL
  UNION ALL SELECT 'reminder_failures', count(*) FROM public.reminder_failures WHERE clinic_id IS NULL
) s
WHERE n > 0;

-- 3) audit_log / rate_limits: clinic_id EXISTS and remains nullable
SELECT 'audit_log_clinic_id_missing' AS fail
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'audit_log' AND column_name = 'clinic_id'
);

SELECT 'rate_limits_clinic_id_missing' AS fail
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'rate_limits' AND column_name = 'clinic_id'
);

SELECT 'audit_log_clinic_id_not_nullable' AS fail
WHERE EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'audit_log' AND column_name = 'clinic_id'
    AND is_nullable = 'NO'
);

SELECT 'rate_limits_clinic_id_not_nullable' AS fail
WHERE EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'rate_limits' AND column_name = 'clinic_id'
    AND is_nullable = 'NO'
);

-- 4) Staff membership
SELECT 'staff_missing_default_membership' AS fail, s.id
FROM public.staff s
WHERE NOT EXISTS (
  SELECT 1 FROM public.staff_clinics sc
  WHERE sc.staff_id = s.id
    AND sc.clinic_id = 'a0000000-0000-4000-8000-000000000001'::uuid
);

-- 5) Temporary DEFAULTs from 033
SELECT 'clinic_id_default_missing' AS fail, t.tbl
FROM (VALUES
  ('patients'),
  ('checkins'),
  ('queue'),
  ('rooms'),
  ('display_settings'),
  ('appointment_types'),
  ('doctor_schedules'),
  ('doctor_blocks'),
  ('patient_sessions'),
  ('push_subscriptions'),
  ('email_verifications'),
  ('email_proofs'),
  ('clinic_settings'),
  ('daily_counters'),
  ('reminder_failures')
) AS t(tbl)
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = t.tbl
    AND c.column_name = 'clinic_id'
    AND c.column_default ILIKE '%a0000000-0000-4000-8000-000000000001%'
);

-- 6) daily_counters clinic-scoped unique or PK
SELECT 'daily_counters_missing_clinic_scoped_unique_or_pk' AS fail
WHERE NOT (
  EXISTS (
    SELECT 1
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey)
    WHERE i.indrelid = 'public.daily_counters'::regclass
      AND i.indisprimary
      AND a.attname = 'clinic_id'
  )
  OR EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'daily_counters'
      AND indexname = 'uq_daily_counters_clinic_date_key'
  )
);

-- 7) Unique indexes: name + indisunique + exact column lists
WITH idx_cols AS (
  SELECT
    ic.relname AS indexname,
    i.indisunique,
    array_agg(a.attname ORDER BY ord.ordinality) AS cols
  FROM pg_index i
  JOIN pg_class ic ON ic.oid = i.indexrelid
  JOIN pg_class t ON t.oid = i.indrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace AND n.nspname = 'public'
  JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS ord(attnum, ordinality) ON true
  JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ord.attnum AND a.attnum > 0
  GROUP BY ic.relname, i.indisunique
),
expected AS (
  SELECT * FROM (VALUES
    ('uq_queue_number_clinic_id_date', ARRAY['clinic_id','queue_number','clinic_date']::text[]),
    ('uq_patients_clinic_phone_normalized', ARRAY['clinic_id','phone_normalized']::text[]),
    ('uq_checkins_clinic_reference', ARRAY['clinic_id','reference_number']::text[]),
    ('uq_push_subscriptions_clinic_endpoint', ARRAY['clinic_id','endpoint']::text[]),
    ('uq_clinic_settings_clinic_id_key', ARRAY['clinic_id','setting_key']::text[]),
    ('uq_daily_counters_clinic_date_key', ARRAY['clinic_id','counter_date','counter_key']::text[]),
    ('uq_queue_number_clinic_date', ARRAY['queue_number','clinic_date']::text[]),
    ('uq_patients_phone_normalized', ARRAY['phone_normalized']::text[]),
    ('uq_checkins_reference', ARRAY['reference_number']::text[])
  ) AS v(indexname, cols)
)
SELECT 'unique_index_cols_or_flag_mismatch' AS fail, e.indexname, i.indisunique, i.cols AS actual_cols, e.cols AS expected_cols
FROM expected e
LEFT JOIN idx_cols i ON i.indexname = e.indexname
WHERE i.indexname IS NULL
   OR i.indisunique IS NOT TRUE
   OR i.cols IS DISTINCT FROM e.cols

UNION ALL
SELECT 'missing_legacy_push_endpoint_unique', 'push_subscriptions.endpoint', NULL, NULL, ARRAY['endpoint']::text[]
WHERE NOT EXISTS (
  SELECT 1 FROM idx_cols i
  WHERE i.indisunique
    AND i.cols = ARRAY['endpoint']::text[]
    AND i.indexname IN ('push_subscriptions_endpoint_key', 'push_subscriptions_endpoint_idx')
)
AND NOT EXISTS (
  SELECT 1
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'push_subscriptions'
    AND c.contype = 'u'
    AND pg_get_constraintdef(c.oid) ILIKE '%(endpoint)%'
)

UNION ALL
SELECT 'clinic_settings_legacy_pkey_cols', 'clinic_settings_pkey', NULL, NULL, ARRAY['setting_key']::text[]
WHERE NOT EXISTS (
  SELECT 1
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'clinic_settings'
    AND c.contype = 'p'
    AND pg_get_constraintdef(c.oid) = 'PRIMARY KEY (setting_key)'
)

UNION ALL
SELECT 'daily_counters_legacy_pkey_missing_or_includes_clinic', 'daily_counters_pkey', NULL, NULL, ARRAY['counter_date','counter_key']::text[]
WHERE NOT EXISTS (
  SELECT 1 FROM idx_cols i
  WHERE i.indexname = (
    SELECT ic.relname
    FROM pg_index ix
    JOIN pg_class ic ON ic.oid = ix.indexrelid
    WHERE ix.indrelid = 'public.daily_counters'::regclass AND ix.indisprimary
  )
  AND i.cols = ARRAY['counter_date','counter_key']::text[]
);

-- 8) clinic_id FKs: exist, validated, ON DELETE RESTRICT
SELECT 'clinic_fk_bad' AS fail, t.relname AS tbl, c.conname,
       c.convalidated, c.confdeltype
FROM (VALUES
  ('patients'),
  ('checkins'),
  ('queue'),
  ('rooms'),
  ('display_settings'),
  ('appointment_types'),
  ('doctor_schedules'),
  ('doctor_blocks'),
  ('patient_sessions'),
  ('push_subscriptions'),
  ('email_verifications'),
  ('email_proofs'),
  ('clinic_settings'),
  ('daily_counters'),
  ('reminder_failures')
) AS need(tbl)
JOIN pg_class t ON t.relname = need.tbl
JOIN pg_namespace n ON n.oid = t.relnamespace AND n.nspname = 'public'
LEFT JOIN pg_constraint c
  ON c.conrelid = t.oid
 AND c.contype = 'f'
 AND c.conname = need.tbl || '_clinic_id_fkey'
WHERE c.oid IS NULL
   OR c.convalidated IS NOT TRUE
   OR c.confdeltype <> 'r';

-- 9) Cross-table clinic_id consistency
SELECT 'queue_checkin_clinic_mismatch' AS fail, q.id AS row_id
FROM public.queue q
JOIN public.checkins c ON c.checkin_id = q.checkin_id
WHERE q.clinic_id IS DISTINCT FROM c.clinic_id;

SELECT 'queue_patient_clinic_mismatch' AS fail, q.id AS row_id
FROM public.queue q
JOIN public.checkins c ON c.checkin_id = q.checkin_id
JOIN public.patients p ON p.id = c.patient_id
WHERE q.clinic_id IS DISTINCT FROM p.clinic_id;

SELECT 'push_queue_clinic_mismatch' AS fail, ps.id AS row_id
FROM public.push_subscriptions ps
JOIN public.queue q
  ON q.queue_number = ps.queue_number
 AND q.clinic_date = (now() AT TIME ZONE 'Asia/Manila')::date
WHERE ps.clinic_id IS DISTINCT FROM q.clinic_id;

SELECT 'patient_sessions_patient_clinic_mismatch' AS fail, ps.token AS row_id
FROM public.patient_sessions ps
JOIN public.patients p ON p.id = ps.patient_id
WHERE ps.clinic_id IS DISTINCT FROM p.clinic_id;

-- 10) Slug helper + default clinic slug
SELECT 'slug_helper_rejects_valid' AS fail
WHERE public.clinics_slug_is_valid('verify-slug-ok') IS NOT TRUE;

SELECT 'slug_helper_accepts_bad_case' AS fail
WHERE public.clinics_slug_is_valid('Admin') IS TRUE;

SELECT 'slug_helper_accepts_reserved' AS fail
WHERE public.clinics_slug_is_valid('api') IS TRUE;

SELECT 'default_clinic_slug_invalid' AS fail
FROM public.clinics cl
WHERE cl.id = 'a0000000-0000-4000-8000-000000000001'::uuid
  AND public.clinics_slug_is_valid(cl.slug) IS NOT TRUE;

-- 10b) RLS enabled; has_table_privilege denies client roles
SELECT 'rls_disabled' AS fail, c.relname
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
WHERE c.relname IN ('clinics', 'staff_clinics', 'clinic_slug_redirects')
  AND c.relkind = 'r'
  AND NOT c.relrowsecurity;

SELECT 'tenant_table_priv' AS fail, role_name, tbl, priv
FROM (VALUES
  ('anon'),
  ('authenticated')
) AS roles(role_name)
CROSS JOIN (VALUES
  ('clinics'),
  ('staff_clinics'),
  ('clinic_slug_redirects')
) AS tables(tbl)
CROSS JOIN (VALUES
  ('SELECT'),
  ('INSERT'),
  ('UPDATE'),
  ('DELETE')
) AS privs(priv)
WHERE has_table_privilege(roles.role_name, 'public.' || tables.tbl, privs.priv);

-- 10c) clinic_id indexes
SELECT 'missing_clinic_id_index' AS fail, expected
FROM (VALUES
  ('idx_patients_clinic_id'),
  ('idx_checkins_clinic_id'),
  ('idx_queue_clinic_id'),
  ('idx_queue_clinic_id_clinic_date_status'),
  ('idx_rooms_clinic_id'),
  ('idx_daily_counters_clinic_id'),
  ('idx_push_subscriptions_clinic_id'),
  ('idx_patient_sessions_clinic_id'),
  ('idx_appointment_types_clinic_id'),
  ('idx_doctor_schedules_clinic_id'),
  ('idx_doctor_blocks_clinic_id'),
  ('idx_display_settings_clinic_id'),
  ('idx_reminder_failures_clinic_id'),
  ('idx_email_verifications_clinic_id'),
  ('idx_email_proofs_clinic_id')
) AS v(expected)
WHERE NOT EXISTS (
  SELECT 1 FROM pg_indexes
  WHERE schemaname = 'public' AND indexname = expected
);

SELECT 'queue_clinic_date_status_index_cols' AS fail
WHERE NOT EXISTS (
  SELECT 1
  FROM pg_index i
  JOIN pg_class ic ON ic.oid = i.indexrelid
  JOIN pg_class t ON t.oid = i.indrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace AND n.nspname = 'public'
  JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS ord(attnum, ordinality) ON true
  JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ord.attnum
  WHERE ic.relname = 'idx_queue_clinic_id_clinic_date_status'
  GROUP BY ic.relname
  HAVING array_agg(a.attname ORDER BY ord.ordinality)
       = ARRAY['clinic_id','clinic_date','status']::text[]
);

-- 10c3) Functions exist; client roles must NOT EXECUTE after 034b
-- Arg types from migrations:
--   next_counter (034): (DATE, TEXT, uuid) → date, text, uuid
--   checkin_to_queue (006/018): (p_checkin_id INT, p_prefix TEXT) → integer, text
-- History: 004/018 default PUBLIC EXECUTE (clients WERE allowed via PUBLIC) until 034b.
SELECT 'next_counter_missing' AS fail
WHERE to_regprocedure('public.next_counter(date,text,uuid)') IS NULL;

SELECT 'checkin_to_queue_missing' AS fail
WHERE to_regprocedure('public.checkin_to_queue(integer,text)') IS NULL;

SELECT 'next_counter_client_execute' AS fail, r.role_name
FROM (VALUES ('anon'), ('authenticated')) AS r(role_name)
WHERE has_function_privilege(r.role_name, 'public.next_counter(date,text,uuid)', 'EXECUTE');

SELECT 'checkin_to_queue_client_execute' AS fail, r.role_name
FROM (VALUES ('anon'), ('authenticated')) AS r(role_name)
WHERE has_function_privilege(r.role_name, 'public.checkin_to_queue(integer,text)', 'EXECUTE');

-- 10d) Informational: triggers on public tables (review before tests 13/14)
SELECT c.relname AS table_name, t.tgname AS trigger_name, pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
WHERE NOT t.tgisinternal
ORDER BY c.relname, t.tgname;

-- =============================================================================
-- AFTER — transactional smoke tests (run EACH separately; ROLLBACK always)
-- =============================================================================

-- 11) next_counter smoke (default clinic)
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $$
DECLARE
  v1 int;
  v2 int;
BEGIN
  v1 := public.next_counter(DATE '2099-01-01', 'VERIFY_STAGE_A_SMOKE');
  v2 := public.next_counter(DATE '2099-01-01', 'VERIFY_STAGE_A_SMOKE');
  IF v1 < 1 OR v2 <> v1 + 1 THEN
    RAISE EXCEPTION 'next_counter smoke failed: %, %', v1, v2;
  END IF;
  RAISE NOTICE 'PASS: next_counter smoke';
END $$;
ROLLBACK;

-- 12) Two-clinic counter independence (drop legacy PK inside txn only)
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $$
DECLARE
  v_default uuid := 'a0000000-0000-4000-8000-000000000001'::uuid;
  v_b uuid := 'b0000000-0000-4000-8000-000000000002'::uuid;
  a1 int;
  a2 int;
  b1 int;
BEGIN
  ALTER TABLE public.daily_counters DROP CONSTRAINT IF EXISTS daily_counters_pkey;

  INSERT INTO public.clinics (id, slug, name, is_active)
  VALUES (v_b, 'verify-clinic-b', 'Verify Clinic B', true)
  ON CONFLICT (id) DO NOTHING;

  a1 := public.next_counter(DATE '2099-02-01', 'VERIFY_INDEP', v_default);
  a2 := public.next_counter(DATE '2099-02-01', 'VERIFY_INDEP', v_default);
  b1 := public.next_counter(DATE '2099-02-01', 'VERIFY_INDEP', v_b);

  IF NOT (a1 = 1 AND a2 = 2 AND b1 = 1) THEN
    RAISE EXCEPTION 'two-clinic counter expected 1,2,1 got %,%,%', a1, a2, b1;
  END IF;
  RAISE NOTICE 'PASS: two-clinic counter independence';
END $$;
ROLLBACK;

-- 13) Two-clinic queue_number uniqueness
-- uq_queue_number_clinic_date is a UNIQUE INDEX (023), not a table constraint → DROP INDEX
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $$
DECLARE
  v_default uuid := 'a0000000-0000-4000-8000-000000000001'::uuid;
  v_b uuid := 'b0000000-0000-4000-8000-000000000002'::uuid;
  v_app_type int;
  v_walk_in smallint;
  p1 int;
  p2 int;
  p3 int;
  c1 int;
  c2 int;
  c3 int;
  dup_ok boolean := false;
BEGIN
  DROP INDEX IF EXISTS public.uq_queue_number_clinic_date;

  INSERT INTO public.clinics (id, slug, name, is_active)
  VALUES (v_b, 'verify-clinic-b', 'Verify Clinic B', true)
  ON CONFLICT (id) DO NOTHING;

  SELECT id INTO v_app_type FROM public.appointment_types ORDER BY id LIMIT 1;
  SELECT id INTO v_walk_in FROM public.checkin_types WHERE type_name = 'walk_in' ORDER BY id LIMIT 1;
  IF v_app_type IS NULL OR v_walk_in IS NULL THEN
    RAISE EXCEPTION 'need appointment_types + checkin_types.walk_in for queue uniqueness test';
  END IF;

  INSERT INTO public.patients (
    first_name, last_name, date_of_birth, gender, phone, address, clinic_id
  ) VALUES (
    'Verify', 'A', DATE '1990-01-01', 'other', '0000000001', '', v_default
  ) RETURNING id INTO p1;

  INSERT INTO public.patients (
    first_name, last_name, date_of_birth, gender, phone, address, clinic_id
  ) VALUES (
    'Verify', 'B', DATE '1990-01-01', 'other', '0000000002', '', v_b
  ) RETURNING id INTO p2;

  INSERT INTO public.patients (
    first_name, last_name, date_of_birth, gender, phone, address, clinic_id
  ) VALUES (
    'Verify', 'A2', DATE '1990-01-01', 'other', '0000000003', '', v_default
  ) RETURNING id INTO p3;

  INSERT INTO public.checkins (
    patient_id, type_id, app_type_id, reference_number, status, clinic_id
  ) VALUES (
    p1, v_walk_in, v_app_type, 'VERIFY-Q-A-' || p1::text, 'checked_in', v_default
  ) RETURNING checkin_id INTO c1;

  INSERT INTO public.checkins (
    patient_id, type_id, app_type_id, reference_number, status, clinic_id
  ) VALUES (
    p2, v_walk_in, v_app_type, 'VERIFY-Q-B-' || p2::text, 'checked_in', v_b
  ) RETURNING checkin_id INTO c2;

  INSERT INTO public.checkins (
    patient_id, type_id, app_type_id, reference_number, status, clinic_id
  ) VALUES (
    p3, v_walk_in, v_app_type, 'VERIFY-Q-A2-' || p3::text, 'checked_in', v_default
  ) RETURNING checkin_id INTO c3;

  INSERT INTO public.queue (checkin_id, queue_number, status, clinic_date, clinic_id)
  VALUES (c1, 'Z-9', 'waiting', DATE '2099-03-01', v_default);

  INSERT INTO public.queue (checkin_id, queue_number, status, clinic_date, clinic_id)
  VALUES (c2, 'Z-9', 'waiting', DATE '2099-03-01', v_b);

  BEGIN
    INSERT INTO public.queue (checkin_id, queue_number, status, clinic_date, clinic_id)
    VALUES (c3, 'Z-9', 'waiting', DATE '2099-03-01', v_default);
  EXCEPTION
    WHEN unique_violation THEN
      dup_ok := true;
  END;

  IF NOT dup_ok THEN
    RAISE EXCEPTION 'same clinic duplicate queue_number should be rejected';
  END IF;
  RAISE NOTICE 'PASS: two-clinic queue_number uniqueness';
END $$;
ROLLBACK;

-- 14) Legacy checkin_to_queue(checkin_id, prefix) — UPDATE AFTER 035
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $$
DECLARE
  v_default uuid := 'a0000000-0000-4000-8000-000000000001'::uuid;
  v_app_type int;
  v_walk_in smallint;
  v_patient int;
  v_checkin int;
  v_qn text;
  v_q_clinic uuid;
BEGIN
  SELECT id INTO v_app_type FROM public.appointment_types ORDER BY id LIMIT 1;
  SELECT id INTO v_walk_in FROM public.checkin_types WHERE type_name = 'walk_in' ORDER BY id LIMIT 1;
  IF v_app_type IS NULL OR v_walk_in IS NULL THEN
    RAISE EXCEPTION 'need appointment_types + checkin_types.walk_in for checkin_to_queue test';
  END IF;

  INSERT INTO public.patients (
    first_name, last_name, date_of_birth, gender, phone, address, clinic_id
  ) VALUES (
    'Verify', 'Legacy', DATE '1990-01-01', 'other', '0000000099', '', v_default
  ) RETURNING id INTO v_patient;

  INSERT INTO public.checkins (
    patient_id, type_id, app_type_id, reference_number, status, clinic_id
  ) VALUES (
    v_patient, v_walk_in, v_app_type, 'VERIFY-LEGACY-' || v_patient::text, 'checked_in', v_default
  ) RETURNING checkin_id INTO v_checkin;

  v_qn := public.checkin_to_queue(v_checkin, 'L');

  IF v_qn IS NULL OR length(v_qn) < 2 THEN
    RAISE EXCEPTION 'checkin_to_queue returned empty';
  END IF;

  SELECT clinic_id INTO v_q_clinic
  FROM public.queue
  WHERE checkin_id = v_checkin
  ORDER BY id DESC
  LIMIT 1;

  IF v_q_clinic IS DISTINCT FROM v_default THEN
    RAISE EXCEPTION 'legacy checkin_to_queue clinic_id % <> default', v_q_clinic;
  END IF;
  RAISE NOTICE 'PASS: legacy checkin_to_queue default clinic';
END $$;
ROLLBACK;

-- 15) Redirect old_slug equal to live clinic slug
-- 031 raises: RAISE EXCEPTION 'clinic_slug_redirect_conflicts_live_slug:%' (SQLSTATE P0001)
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $$
DECLARE
  v_default uuid := 'a0000000-0000-4000-8000-000000000001'::uuid;
  v_slug text;
  rejected boolean := false;
BEGIN
  SELECT slug INTO v_slug FROM public.clinics WHERE id = v_default;
  BEGIN
    INSERT INTO public.clinic_slug_redirects (old_slug, clinic_id)
    VALUES (v_slug, v_default);
  EXCEPTION
    WHEN raise_exception THEN  -- SQLSTATE P0001
      IF SQLERRM LIKE 'clinic_slug_redirect_conflicts_live_slug:%' THEN
        rejected := true;
      ELSE
        RAISE;
      END IF;
  END;
  IF NOT rejected THEN
    RAISE EXCEPTION 'redirect with live slug % should be rejected', v_slug;
  END IF;
  RAISE NOTICE 'PASS: redirect live slug rejected';
END $$;
ROLLBACK;

-- 16) clinics.updated_at trigger advances past 2001
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $$
DECLARE
  v_default uuid := 'a0000000-0000-4000-8000-000000000001'::uuid;
  t1 timestamptz;
BEGIN
  ALTER TABLE public.clinics DISABLE TRIGGER clinics_updated_at;
  UPDATE public.clinics
  SET updated_at = TIMESTAMPTZ '2000-01-01 00:00:00+00'
  WHERE id = v_default;
  ALTER TABLE public.clinics ENABLE TRIGGER clinics_updated_at;

  UPDATE public.clinics SET name = name WHERE id = v_default
  RETURNING updated_at INTO t1;

  IF t1 <= TIMESTAMPTZ '2001-01-01 00:00:00+00' THEN
    RAISE EXCEPTION 'clinics.updated_at did not move past 2001 (got %)', t1;
  END IF;
  RAISE NOTICE 'PASS: clinics updated_at trigger';
END $$;
ROLLBACK;

-- 17) Legacy conflict targets + DEFAULT clinic_id on insert-without-column
-- Column names/types from migrations (001, 004, 019, 027 + 032 clinic_id):
--   push_subscriptions: queue_number VARCHAR(20), endpoint TEXT UNIQUE, p256dh TEXT, auth TEXT
--   clinic_settings: setting_key TEXT PK, value TEXT NOT NULL, updated_at TIMESTAMPTZ
--   daily_counters: counter_date DATE, counter_key TEXT, last_value INT
--   rooms: id SERIAL (= integer), name VARCHAR(50), description TEXT
--   patients: id SERIAL (= integer), first_name/last_name VARCHAR(50), date_of_birth DATE,
--             gender VARCHAR(20), phone VARCHAR(20), address VARCHAR(255)
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $$
DECLARE
  v_default uuid := 'a0000000-0000-4000-8000-000000000001'::uuid;
  v_endpoint text := 'https://verify.example/push/' || gen_random_uuid()::text;
  v_room_id integer;      -- rooms.id SERIAL → integer (001)
  v_patient_id integer;   -- patients.id SERIAL → integer (001)
  v_checkin_id integer;   -- checkins.checkin_id SERIAL → integer (001)
  v_app_type integer;     -- appointment_types.id SERIAL → integer (001)
  v_walk_in smallint;     -- checkin_types.id SMALLINT (001)
  v_q_clinic uuid;
  v_r_clinic uuid;
  v_p_clinic uuid;
BEGIN
  SELECT id INTO v_app_type FROM public.appointment_types ORDER BY id LIMIT 1;
  SELECT id INTO v_walk_in FROM public.checkin_types WHERE type_name = 'walk_in' ORDER BY id LIMIT 1;

  -- push_subscriptions: ON CONFLICT (endpoint) — UNIQUE endpoint TEXT (019)
  INSERT INTO public.push_subscriptions (queue_number, endpoint, p256dh, auth)
  VALUES ('V-1', v_endpoint, 'p256dh-verify', 'auth-verify')
  ON CONFLICT (endpoint) DO UPDATE
    SET p256dh = EXCLUDED.p256dh;

  INSERT INTO public.push_subscriptions (queue_number, endpoint, p256dh, auth)
  VALUES ('V-1', v_endpoint, 'p256dh-verify-2', 'auth-verify')
  ON CONFLICT (endpoint) DO UPDATE
    SET p256dh = EXCLUDED.p256dh;

  -- clinic_settings: ON CONFLICT (setting_key) — TEXT PK (027)
  INSERT INTO public.clinic_settings (setting_key, value)
  VALUES ('verify_stage_a_legacy', 'one')
  ON CONFLICT (setting_key) DO UPDATE
    SET value = EXCLUDED.value, updated_at = now();

  INSERT INTO public.clinic_settings (setting_key, value)
  VALUES ('verify_stage_a_legacy', 'two')
  ON CONFLICT (setting_key) DO UPDATE
    SET value = EXCLUDED.value, updated_at = now();

  -- daily_counters: ON CONFLICT (counter_date, counter_key) — legacy PK (004)
  INSERT INTO public.daily_counters (counter_date, counter_key, last_value)
  VALUES (DATE '2099-06-01', 'VERIFY_LEGACY_CONFLICT', 1)
  ON CONFLICT (counter_date, counter_key) DO UPDATE
    SET last_value = public.daily_counters.last_value + 1;

  INSERT INTO public.daily_counters (counter_date, counter_key, last_value)
  VALUES (DATE '2099-06-01', 'VERIFY_LEGACY_CONFLICT', 1)
  ON CONFLICT (counter_date, counter_key) DO UPDATE
    SET last_value = public.daily_counters.last_value + 1;

  -- inserts WITHOUT clinic_id must receive DEFAULT clinic (033)
  INSERT INTO public.rooms (name, description)
  VALUES ('Verify Room Legacy', 'verify')
  RETURNING id, clinic_id INTO v_room_id, v_r_clinic;

  INSERT INTO public.patients (first_name, last_name, date_of_birth, gender, phone, address)
  VALUES ('Verify', 'DefaultClinic', DATE '1990-01-01', 'other', '0000000088', '')
  RETURNING id, clinic_id INTO v_patient_id, v_p_clinic;

  INSERT INTO public.checkins (
    patient_id, type_id, app_type_id, reference_number, status
  ) VALUES (
    v_patient_id, v_walk_in, v_app_type, 'VERIFY-DEF-' || v_patient_id::text, 'checked_in'
  ) RETURNING checkin_id INTO v_checkin_id;

  INSERT INTO public.queue (checkin_id, queue_number, status, clinic_date)
  VALUES (v_checkin_id, 'V-8', 'waiting', DATE '2099-06-02')
  RETURNING clinic_id INTO v_q_clinic;

  IF v_r_clinic IS DISTINCT FROM v_default
     OR v_p_clinic IS DISTINCT FROM v_default
     OR v_q_clinic IS DISTINCT FROM v_default THEN
    RAISE EXCEPTION 'DEFAULT clinic_id missing: rooms=% patients=% queue=%',
      v_r_clinic, v_p_clinic, v_q_clinic;
  END IF;

  RAISE NOTICE 'PASS: legacy conflict targets + DEFAULT clinic_id';
END $$;
ROLLBACK;

-- 18) service_role can execute RPCs + perform test-17 style inserts
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL ROLE service_role;
DO $$
DECLARE
  v_default uuid := 'a0000000-0000-4000-8000-000000000001'::uuid;
  v_n int;
  v_qn text;
  v_app_type integer;
  v_walk_in smallint;
  v_patient_id integer;
  v_checkin_id integer;
  v_endpoint text := 'https://verify.example/svc/' || gen_random_uuid()::text;
BEGIN
  v_n := public.next_counter(DATE '2099-07-01', 'VERIFY_SVC_ROLE');
  IF v_n IS NULL OR v_n < 1 THEN
    RAISE EXCEPTION 'service_role next_counter failed';
  END IF;

  SELECT id INTO v_app_type FROM public.appointment_types ORDER BY id LIMIT 1;
  SELECT id INTO v_walk_in FROM public.checkin_types WHERE type_name = 'walk_in' ORDER BY id LIMIT 1;

  INSERT INTO public.patients (first_name, last_name, date_of_birth, gender, phone, address)
  VALUES ('Verify', 'SvcRole', DATE '1990-01-01', 'other', '0000000077', '')
  RETURNING id INTO v_patient_id;

  INSERT INTO public.checkins (
    patient_id, type_id, app_type_id, reference_number, status
  ) VALUES (
    v_patient_id, v_walk_in, v_app_type, 'VERIFY-SVC-' || v_patient_id::text, 'checked_in'
  ) RETURNING checkin_id INTO v_checkin_id;

  v_qn := public.checkin_to_queue(v_checkin_id, 'S');
  IF v_qn IS NULL THEN
    RAISE EXCEPTION 'service_role checkin_to_queue failed';
  END IF;

  INSERT INTO public.push_subscriptions (queue_number, endpoint, p256dh, auth)
  VALUES ('S-1', v_endpoint, 'p', 'a')
  ON CONFLICT (endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh;

  INSERT INTO public.clinic_settings (setting_key, value)
  VALUES ('verify_svc_role', '1')
  ON CONFLICT (setting_key) DO UPDATE SET value = EXCLUDED.value;

  INSERT INTO public.daily_counters (counter_date, counter_key, last_value)
  VALUES (DATE '2099-07-02', 'VERIFY_SVC', 1)
  ON CONFLICT (counter_date, counter_key) DO UPDATE
    SET last_value = public.daily_counters.last_value + 1;

  INSERT INTO public.rooms (name, description) VALUES ('Verify Svc Room', 'svc');

  IF v_default IS NULL THEN
    RAISE EXCEPTION 'unreachable';
  END IF;
  RAISE NOTICE 'PASS: service_role rpc + inserts';
END $$;
ROLLBACK;

-- 19) anon must get insufficient_privilege (42501) on both RPCs
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL ROLE anon;
DO $$
DECLARE
  denied_nc boolean := false;
  denied_cq boolean := false;
  v_dummy int;
  v_dummy_t text;
BEGIN
  BEGIN
    v_dummy := public.next_counter(DATE '2099-08-01', 'VERIFY_ANON');
  EXCEPTION
    WHEN insufficient_privilege THEN  -- SQLSTATE 42501
      denied_nc := true;
  END;
  IF NOT denied_nc THEN
    RAISE EXCEPTION 'anon next_counter should raise 42501';
  END IF;

  BEGIN
    v_dummy_t := public.checkin_to_queue(1, 'A');
  EXCEPTION
    WHEN insufficient_privilege THEN  -- SQLSTATE 42501
      denied_cq := true;
  END;
  IF NOT denied_cq THEN
    RAISE EXCEPTION 'anon checkin_to_queue should raise 42501';
  END IF;

  RAISE NOTICE 'PASS: anon insufficient_privilege on both rpcs';
END $$;
ROLLBACK;

-- =============================================================================
-- AFTER — row-count comparison + cleanup
-- Core drift → RAISE EXCEPTION; drop scratch only when no core drift
-- =============================================================================

DO $$
DECLARE
  r record;
  v_after bigint;
  v_core_drift boolean := false;
  v_drift_msg text := '';
BEGIN
  IF to_regclass('public._verify_rowcounts_before') IS NULL THEN
    RAISE NOTICE 'INFO: missing_before_rowcounts_table — skip drift checks';
    RETURN;
  END IF;

  FOR r IN
    SELECT b.tbl, b.n AS before_n
    FROM public._verify_rowcounts_before b
    WHERE b.tbl IN (
      'patients','checkins','queue','rooms','staff',
      'appointment_types','doctor_schedules','doctor_blocks'
    )
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', r.tbl) INTO v_after;
    IF v_after <> r.before_n THEN
      v_core_drift := true;
      v_drift_msg := v_drift_msg || format(' %s: before=%s after=%s;', r.tbl, r.before_n, v_after);
    END IF;
  END LOOP;

  FOR r IN
    SELECT b.tbl, b.n AS before_n
    FROM public._verify_rowcounts_before b
    WHERE b.tbl IN (
      'rate_limits','audit_log','patient_sessions',
      'email_verifications','email_proofs','daily_counters','push_subscriptions'
    )
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', r.tbl) INTO v_after;
    IF v_after <> r.before_n THEN
      RAISE NOTICE 'INFO: rowcount_volatile tbl=% before=% after=%',
        r.tbl, r.before_n, v_after;
    END IF;
  END LOOP;

  IF v_core_drift THEN
    RAISE EXCEPTION 'rowcount_drift_core:%', v_drift_msg;
  END IF;

  DROP TABLE public._verify_rowcounts_before;
  RAISE NOTICE 'PASS: rowcount core ok; scratch table dropped';
END $$;
