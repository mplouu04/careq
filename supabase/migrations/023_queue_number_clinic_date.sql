-- Align daily queue_number uniqueness with Manila clinic_date
-- (counters and checkin_to_queue already use Asia/Manila).
-- The old index keyed on UTC created_at date, which collides after
-- Manila midnight until 08:00 PH when WALK-1/APPT-1 reset for the new clinic day.

DROP INDEX IF EXISTS uq_queue_number_day;

CREATE UNIQUE INDEX IF NOT EXISTS uq_queue_number_clinic_date
  ON queue (queue_number, clinic_date);
