-- =============================================================================
-- Diagnostic queries for the "doctor activation delay" investigation.
-- Run these in the Supabase SQL editor of the AFFECTED environment (prod / staging).
-- Cross-reference results with:
--   docs / plan: doctor_activation_delay_rca (H1, H2, H5)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- H2: publication + replica identity check
--
-- Expected (per migration 016_staff_realtime.sql):
--   * staff is in the supabase_realtime publication
--   * relreplident = 'f'  (FULL row images)
--
-- If staff is missing from the publication, no postgres_changes event is
-- emitted at all — the primary Realtime path is dead.
-- ---------------------------------------------------------------------------
SELECT
  'H2 publication'                                     AS check_name,
  EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname   = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename  = 'staff'
  )                                                    AS staff_in_publication;

SELECT
  'H2 replica identity'                                AS check_name,
  c.relname                                            AS table_name,
  c.relreplident                                       AS replica_identity, -- 'f' = FULL, 'd' = DEFAULT, 'n' = NOTHING, 'i' = INDEX
  c.relreplident = 'f'                                 AS is_full
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('staff', 'doctor_schedules', 'doctor_blocks');

-- ---------------------------------------------------------------------------
-- H1: RLS policies on staff that Realtime uses for filtering anon events
--
-- Supabase Realtime applies RLS to postgres_changes broadcasts. For anon
-- subscribers, the SELECT policy is evaluated against both the OLD and NEW
-- row images. If the changed row does not satisfy the policy on the side
-- that transitioned OUT of visibility (e.g. is_active flipping true -> false
-- or false -> true), the event may be filtered and clients never invalidate.
--
-- Look for a SELECT policy on staff whose USING clause depends on is_active.
-- Migration 023 (see below) replaces this with a role-only USING so that both
-- directions of the transition pass the policy check.
-- ---------------------------------------------------------------------------
SELECT
  'H1 select policies on staff'                              AS check_name,
  polname                                                    AS policy_name,
  polcmd                                                     AS command,        -- 'r' = SELECT
  polpermissive                                              AS permissive,
  pg_get_expr(polqual, polrelid)                             AS using_clause,
  pg_get_expr(polwithcheck, polrelid)                        AS with_check_clause,
  ARRAY(
    SELECT r.rolname
    FROM pg_roles r
    WHERE r.oid = ANY(polroles::oid[])
  )                                                          AS applies_to_roles
FROM pg_policy
WHERE polrelid = 'public.staff'::regclass
ORDER BY polname;

-- ---------------------------------------------------------------------------
-- H5: auth.users triggers that could re-flip staff.is_active
--
-- Migration 021_staff_trigger_insert_only.sql dropped on_auth_user_updated
-- and rewrote handle_new_staff_user to be INSERT-only. Verify no other trigger
-- on auth.users touches public.staff.is_active in the current environment.
-- ---------------------------------------------------------------------------
SELECT
  'H5 auth.users triggers' AS check_name,
  t.tgname                  AS trigger_name,
  CASE
    WHEN t.tgtype & 2 = 2 THEN 'BEFORE'
    ELSE 'AFTER'
  END                       AS timing,
  CASE
    WHEN t.tgtype & 4  = 4  THEN 'INSERT'
    WHEN t.tgtype & 16 = 16 THEN 'UPDATE'
    WHEN t.tgtype & 8  = 8  THEN 'DELETE'
    ELSE 'OTHER'
  END                       AS event,
  p.proname                 AS function_name,
  pg_get_functiondef(p.oid) AS function_body
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE n.nspname = 'auth'
  AND c.relname = 'users'
  AND NOT t.tgisinternal;

-- ---------------------------------------------------------------------------
-- Sanity: any function that writes public.staff.is_active
--
-- Surface every plpgsql/sql function whose body references staff.is_active so
-- reviewers can eyeball whether a background path could stomp it.
-- ---------------------------------------------------------------------------
SELECT
  'H5 functions touching staff.is_active' AS check_name,
  n.nspname                                AS schema,
  p.proname                                AS function_name,
  l.lanname                                AS language
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_language l ON l.oid = p.prolang
WHERE pg_get_functiondef(p.oid) ILIKE '%staff%is_active%'
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY n.nspname, p.proname;

-- ---------------------------------------------------------------------------
-- Bonus: recent staff.is_active mutations (requires audit_log)
--
-- If activation flapping is suspected, this shows the last 20 toggle events
-- and the requesting user. Correlate with client reports.
-- ---------------------------------------------------------------------------
SELECT
  'recent staff_toggle audit rows' AS check_name,
  created_at,
  user_id                           AS requesting_user_id,
  record_id                         AS staff_id,
  ip_address
FROM public.audit_log
WHERE action = 'staff_toggle'
ORDER BY created_at DESC
LIMIT 20;
