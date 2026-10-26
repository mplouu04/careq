-- Maxicare-style PCC: nurse vitals/triage before doctor Call
-- Enum ADD VALUE must commit before new labels are used (e.g. in indexes).
-- Index that filters on with_nurse / ready_for_doctor lives in 030.
ALTER TYPE queue_status ADD VALUE IF NOT EXISTS 'with_nurse';
ALTER TYPE queue_status ADD VALUE IF NOT EXISTS 'ready_for_doctor';

ALTER TABLE queue
  ADD COLUMN IF NOT EXISTS bp_systolic SMALLINT,
  ADD COLUMN IF NOT EXISTS bp_diastolic SMALLINT,
  ADD COLUMN IF NOT EXISTS temperature_c NUMERIC(4, 1),
  ADD COLUMN IF NOT EXISTS triage_notes TEXT,
  ADD COLUMN IF NOT EXISTS triaged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS triaged_by UUID REFERENCES staff(id),
  ADD COLUMN IF NOT EXISTS assigned_doctor_id UUID REFERENCES staff(id);

COMMENT ON COLUMN queue.assigned_doctor_id IS
  'Doctor chosen by nurse at triage; Call may confirm or override.';
