-- Opaque public patient handle (replaces sequential integer id in public URLs)

ALTER TABLE patients
  ADD COLUMN public_id uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX uq_patients_public_id ON patients (public_id);
