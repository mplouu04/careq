-- Capstone extensions (single-clinic). Safe to apply after 030.
-- Does not depend on multi-tenant Stage A (031+).

BEGIN;
SET LOCAL lock_timeout = '5s';

-- Doctor specialization
ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS specialization VARCHAR(100);

-- Consultation fee on services / appointment types
ALTER TABLE public.appointment_types
  ADD COLUMN IF NOT EXISTS fee NUMERIC(10, 2);

-- Appointment admin approval (new bookings await approval)
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved';

ALTER TABLE public.checkins
  DROP CONSTRAINT IF EXISTS checkins_approval_status_check;

ALTER TABLE public.checkins
  ADD CONSTRAINT checkins_approval_status_check
  CHECK (approval_status IN ('pending', 'approved', 'rejected'));

COMMENT ON COLUMN public.checkins.approval_status IS
  'Admin approval for appointments: pending | approved | rejected';

-- Clinic announcements
CREATE TABLE IF NOT EXISTS public.announcements (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcements_active_published
  ON public.announcements (is_active, published_at DESC);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS announcements_public_read ON public.announcements;
CREATE POLICY announcements_public_read ON public.announcements
  FOR SELECT USING (is_active = TRUE);

-- In-app notifications (patient-facing via phone+DOB lookup session)
CREATE TABLE IF NOT EXISTS public.notifications (
  id BIGSERIAL PRIMARY KEY,
  patient_id INT REFERENCES public.patients(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  reference_number TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT notifications_category_check CHECK (
    category IN (
      'general',
      'appointment_confirmation',
      'appointment_approval',
      'appointment_cancellation',
      'appointment_reminder',
      'queue_update',
      'announcement'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_notifications_patient_created
  ON public.notifications (patient_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
-- No anon policies: access only via service-role Route Handlers

-- Recreate doctors_public with specialization (capstone catalog).
-- Must DROP first: CREATE OR REPLACE cannot insert/rename middle columns
-- (error 42P16: cannot change name of view column "is_active" to "specialization").
DROP VIEW IF EXISTS public.doctors_public;
CREATE VIEW public.doctors_public
WITH (security_invoker = false)
AS
SELECT id, first_name, last_name, is_active, specialization
FROM public.staff
WHERE role = 'doctor' AND is_active = true;

REVOKE ALL ON public.doctors_public FROM PUBLIC;
GRANT SELECT ON public.doctors_public TO anon, authenticated;

COMMIT;
