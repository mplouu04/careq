-- Realtime on staff so patient booking and staff dashboard refresh doctor lists
-- when admins create or deactivate doctors.

ALTER PUBLICATION supabase_realtime ADD TABLE staff;

-- Full row images so deactivate (is_active true→false) still emits events when
-- the row leaves the doctors_public_read RLS policy.
ALTER TABLE staff REPLICA IDENTITY FULL;
