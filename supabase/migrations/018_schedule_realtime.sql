-- Realtime on doctor schedules/blocks so patient booking refreshes slots
-- when staff change hours, deactivate days, or add blocks.

ALTER PUBLICATION supabase_realtime ADD TABLE doctor_schedules;
ALTER PUBLICATION supabase_realtime ADD TABLE doctor_blocks;
