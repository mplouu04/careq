-- Full row images so schedule/block UPDATE + DELETE emit realtime events
-- that reach the patient booking page (matches staff/queue realtime pattern).

ALTER TABLE doctor_schedules REPLICA IDENTITY FULL;
ALTER TABLE doctor_blocks REPLICA IDENTITY FULL;
