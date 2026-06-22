-- Scheduling improvements: buffer time, per-slot capacity, type-based priority

ALTER TABLE appointment_types
  ADD COLUMN IF NOT EXISTS buffer_minutes SMALLINT NOT NULL DEFAULT 0;

ALTER TABLE appointment_types
  ADD COLUMN IF NOT EXISTS max_concurrent SMALLINT NOT NULL DEFAULT 1;

ALTER TABLE appointment_types
  ADD COLUMN IF NOT EXISTS default_priority priority_level NOT NULL DEFAULT 'normal';

UPDATE appointment_types SET default_priority = 'high'
  WHERE name = 'Urgent Care';
