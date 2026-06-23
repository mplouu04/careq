-- Enforce one patient record per phone number at the database level.
-- Partial index (WHERE NOT NULL) avoids conflicts on legacy rows
-- that pre-date the phone_normalized column.
CREATE UNIQUE INDEX uq_patients_phone_normalized
  ON patients (phone_normalized)
  WHERE phone_normalized IS NOT NULL;
