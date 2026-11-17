-- Stage A: clinics + staff membership + slug redirects
-- Default clinic slug: careq (public URLs /c/careq/...)
--
-- ROLLBACK: supabase/rollback/031_rollback.sql
-- (only valid before a second clinic exists)

BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.clinics_slug_is_valid(p_slug text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    p_slug IS NOT NULL
    AND length(p_slug) BETWEEN 2 AND 48
    AND p_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    AND p_slug NOT IN (
      'www', 'api', 'admin', 'login', 'dashboard', 'queue', 'status', 'c',
      'static', 'assets', 'health', 'cron', 'supabase', 'null', 'undefined'
    );
$$;

CREATE TABLE IF NOT EXISTS public.clinics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clinics_slug_format CHECK (public.clinics_slug_is_valid(slug))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_clinics_slug ON public.clinics (slug);

DROP TRIGGER IF EXISTS clinics_updated_at ON public.clinics;
CREATE TRIGGER clinics_updated_at
  BEFORE UPDATE ON public.clinics
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.staff_clinics (
  staff_id uuid NOT NULL REFERENCES public.staff (id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES public.clinics (id) ON DELETE CASCADE,
  role public.staff_role NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (staff_id, clinic_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_clinics_clinic ON public.staff_clinics (clinic_id);

CREATE TABLE IF NOT EXISTS public.clinic_slug_redirects (
  old_slug text PRIMARY KEY,
  clinic_id uuid NOT NULL REFERENCES public.clinics (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NULL,
  CONSTRAINT clinic_slug_redirects_slug_format CHECK (public.clinics_slug_is_valid(old_slug))
);

CREATE OR REPLACE FUNCTION public.clinic_slug_redirects_reject_live_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.clinics c WHERE c.slug = NEW.old_slug) THEN
    RAISE EXCEPTION 'clinic_slug_redirect_conflicts_live_slug:%', NEW.old_slug;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clinic_slug_redirects_no_live_slug ON public.clinic_slug_redirects;
CREATE TRIGGER clinic_slug_redirects_no_live_slug
  BEFORE INSERT OR UPDATE OF old_slug ON public.clinic_slug_redirects
  FOR EACH ROW
  EXECUTE FUNCTION public.clinic_slug_redirects_reject_live_slug();

ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_slug_redirects ENABLE ROW LEVEL SECURITY;
-- Policies added in Stage B (036). No anon policies here.

REVOKE ALL ON TABLE public.clinics FROM anon, authenticated;
REVOKE ALL ON TABLE public.staff_clinics FROM anon, authenticated;
REVOKE ALL ON TABLE public.clinic_slug_redirects FROM anon, authenticated;

-- Fixed UUID so later DEFAULT / verify scripts can reference the default clinic.
INSERT INTO public.clinics (id, slug, name, is_active)
VALUES (
  'a0000000-0000-4000-8000-000000000001'::uuid,
  'careq',
  'CAREQ Clinic',
  true
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.staff_clinics (staff_id, clinic_id, role, is_active)
SELECT s.id, 'a0000000-0000-4000-8000-000000000001'::uuid, s.role, COALESCE(s.is_active, true)
FROM public.staff s
ON CONFLICT (staff_id, clinic_id) DO NOTHING;

COMMIT;
