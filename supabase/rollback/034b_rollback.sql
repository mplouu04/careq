-- ROLLBACK for 034b_revoke_client_rpc.sql
-- WARNING: Only valid before a second clinic exists (single default clinic era).
-- Restores GRANT EXECUTE to PUBLIC / anon / authenticated (pre-034b posture).
-- Not applied by migrate — run manually on a scratch/branch DB only.

BEGIN;
SET LOCAL lock_timeout = '5s';

GRANT EXECUTE ON FUNCTION public.next_counter(DATE, TEXT, uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_counter(DATE, TEXT, uuid) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.checkin_to_queue(integer, text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.checkin_to_queue(integer, text) TO anon, authenticated;

COMMIT;
