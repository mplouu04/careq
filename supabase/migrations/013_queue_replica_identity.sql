-- Set REPLICA IDENTITY FULL on the queue table so that Supabase Realtime
-- UPDATE events include all column values in both OLD and NEW records.
-- Without this, Postgres only sends the PK in OLD values, which forces
-- the Realtime server to do an extra row lookup to validate anonymous
-- subscriber RLS access -- a lookup that can silently fail in edge cases.
ALTER TABLE queue REPLICA IDENTITY FULL;
