-- Enable Supabase Realtime on the checkins table so that
-- staff dashboards and patient booking pages receive instant
-- updates when check-ins are inserted or updated.
ALTER PUBLICATION supabase_realtime ADD TABLE checkins;
