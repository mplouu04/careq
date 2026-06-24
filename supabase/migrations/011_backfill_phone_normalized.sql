-- Backfill phone_normalized for existing records that pre-date the column.
-- Migration 010 added the column and its unique index but did not populate
-- rows inserted before the column existed (e.g. via direct SQL, Supabase
-- dashboard, or the legacy PQMS import). Without this backfill those rows
-- are invisible to resolveExistingPatient's phone_normalized equality check,
-- causing silent duplicate records on re-registration.
--
-- Strategy: strip all non-digit characters from the phone column, matching
-- the same transformation applied by normalizePhone() in lib/phone.ts.
-- The partial unique index (WHERE phone_normalized IS NOT NULL) already
-- prevents conflicts between newly backfilled rows and existing ones.

UPDATE patients
SET phone_normalized = regexp_replace(phone, '[^0-9]', '', 'g')
WHERE phone_normalized IS NULL
  AND phone IS NOT NULL
  AND phone <> '';
