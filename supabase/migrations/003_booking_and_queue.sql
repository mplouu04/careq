-- Queue no_show status, appointment slot uniqueness, default doctor schedules

ALTER TYPE queue_status ADD VALUE IF NOT EXISTS 'no_show';

-- Prevent double-booking the same doctor slot (active appointments only).
-- Do not use (appointment_date::date): timestamptz→date is not IMMUTABLE (42P17).
-- The app stores appointment_date as YYYY-MM-DDTHH:MM:00 for the chosen slot.
CREATE UNIQUE INDEX IF NOT EXISTS uq_checkin_doctor_slot
  ON checkins (doctor_id, appointment_date, scheduled_time)
  WHERE type_id = 1 AND status NOT IN ('cancelled', 'no_show');

-- Default Mon–Fri 08:00–17:00 for each active doctor without schedules
INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, is_active)
SELECT s.id, d.day_of_week, '08:00:00'::time, '17:00:00'::time, true
FROM staff s
CROSS JOIN (VALUES (1), (2), (3), (4), (5)) AS d(day_of_week)
WHERE s.role = 'doctor' AND s.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM doctor_schedules ds
    WHERE ds.doctor_id = s.id AND ds.day_of_week = d.day_of_week
  );
