-- Walk-ins may carry an optional preferred doctor (CheckinForm → checkinWalkIn writes checkins.doctor_id),
-- and nurse triage assigns checkins.doctor_id for walk-ins too. The original 001 constraint required
-- doctor_id IS NULL for walk-ins, which made any walk-in with a preferred doctor fail.
-- Appointment rules (type_id = 1) are unchanged.

ALTER TABLE public.checkins DROP CONSTRAINT IF EXISTS chk_appointment_fields;

ALTER TABLE public.checkins
  ADD CONSTRAINT chk_appointment_fields CHECK (
    (type_id = 1 AND app_type_id IS NOT NULL AND scheduled_time IS NOT NULL
      AND doctor_id IS NOT NULL AND appointment_date IS NOT NULL)
    OR (type_id = 2 AND app_type_id IS NOT NULL)
  );
