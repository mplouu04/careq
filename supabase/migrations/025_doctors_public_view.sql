-- Limit anon doctor catalog to non-sensitive columns via a view.
-- API routes use service role and are unaffected.

CREATE OR REPLACE VIEW public.doctors_public
WITH (security_invoker = false)
AS
SELECT id, first_name, last_name, is_active
FROM public.staff
WHERE role = 'doctor' AND is_active = true;

REVOKE ALL ON public.doctors_public FROM PUBLIC;
GRANT SELECT ON public.doctors_public TO anon, authenticated;

DROP POLICY IF EXISTS doctors_public_read ON public.staff;
