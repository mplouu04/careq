-- ROLLBACK for 031_clinics_and_membership.sql
-- WARNING: Only valid before a second clinic exists (single default clinic era).
-- Do NOT run after production multi-clinic data exists.
-- Not applied by migrate — run manually on a scratch/branch DB only.

BEGIN;
SET LOCAL lock_timeout = '5s';

DROP TRIGGER IF EXISTS clinics_updated_at ON public.clinics;
DROP TRIGGER IF EXISTS clinic_slug_redirects_no_live_slug ON public.clinic_slug_redirects;
DROP FUNCTION IF EXISTS public.clinic_slug_redirects_reject_live_slug();

DELETE FROM public.staff_clinics;
DROP TABLE IF EXISTS public.clinic_slug_redirects;
DROP TABLE IF EXISTS public.staff_clinics;
DROP TABLE IF EXISTS public.clinics;
DROP FUNCTION IF EXISTS public.clinics_slug_is_valid(text);

COMMIT;
