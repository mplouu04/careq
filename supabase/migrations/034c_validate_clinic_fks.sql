-- Stage A: VALIDATE clinic_id foreign keys added NOT VALID in 034.
-- Run after 034 on an idle branch (validation scans can lock briefly).
--
-- ROLLBACK: no-op once constraints exist; dropping FKs is part of
-- supabase/rollback/034_rollback.sql.

BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.patients VALIDATE CONSTRAINT patients_clinic_id_fkey;
ALTER TABLE public.checkins VALIDATE CONSTRAINT checkins_clinic_id_fkey;
ALTER TABLE public.queue VALIDATE CONSTRAINT queue_clinic_id_fkey;
ALTER TABLE public.rooms VALIDATE CONSTRAINT rooms_clinic_id_fkey;
ALTER TABLE public.display_settings VALIDATE CONSTRAINT display_settings_clinic_id_fkey;
ALTER TABLE public.appointment_types VALIDATE CONSTRAINT appointment_types_clinic_id_fkey;
ALTER TABLE public.doctor_schedules VALIDATE CONSTRAINT doctor_schedules_clinic_id_fkey;
ALTER TABLE public.doctor_blocks VALIDATE CONSTRAINT doctor_blocks_clinic_id_fkey;
ALTER TABLE public.patient_sessions VALIDATE CONSTRAINT patient_sessions_clinic_id_fkey;
ALTER TABLE public.push_subscriptions VALIDATE CONSTRAINT push_subscriptions_clinic_id_fkey;
ALTER TABLE public.email_verifications VALIDATE CONSTRAINT email_verifications_clinic_id_fkey;
ALTER TABLE public.email_proofs VALIDATE CONSTRAINT email_proofs_clinic_id_fkey;
ALTER TABLE public.clinic_settings VALIDATE CONSTRAINT clinic_settings_clinic_id_fkey;
ALTER TABLE public.daily_counters VALIDATE CONSTRAINT daily_counters_clinic_id_fkey;
ALTER TABLE public.reminder_failures VALIDATE CONSTRAINT reminder_failures_clinic_id_fkey;

COMMIT;
