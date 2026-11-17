-- Stage A companion (apply AFTER 034, once docs/rpc-callers.md confirms safe):
-- Revoke client EXECUTE on next_counter / checkin_to_queue; keep service_role.
--
-- Migration history: 004/006/018 left default PUBLIC EXECUTE (anon/authenticated
-- could execute via PUBLIC). App call sites use createAdminClient (service_role) only
-- for these two RPCs — see docs/rpc-callers.md.
--
-- ROLLBACK: supabase/rollback/034b_rollback.sql (only valid before a second clinic exists)

BEGIN;
SET LOCAL lock_timeout = '5s';

DO $$
BEGIN
  IF to_regprocedure('public.next_counter(date,text,uuid)') IS NULL THEN
    RAISE EXCEPTION 'next_counter(date,text,uuid) missing — run 034 first';
  END IF;
  IF to_regprocedure('public.checkin_to_queue(integer,text)') IS NULL THEN
    RAISE EXCEPTION 'checkin_to_queue(integer,text) missing';
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.next_counter(DATE, TEXT, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.next_counter(DATE, TEXT, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_counter(DATE, TEXT, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.checkin_to_queue(integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.checkin_to_queue(integer, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.checkin_to_queue(integer, text) TO service_role;

COMMIT;
