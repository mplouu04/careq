-- Performance indexes, reminder tracking, retention helpers

ALTER TABLE checkins
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_checkins_patient_type_status
  ON checkins (patient_id, type_id, status);

CREATE INDEX IF NOT EXISTS idx_queue_created_status
  ON queue (created_at, status)
  WHERE status IN ('waiting', 'in_progress', 'called');

CREATE OR REPLACE FUNCTION purge_old_logs(p_days INT DEFAULT 90)
RETURNS TABLE(rate_limits_deleted INT, audit_deleted INT)
LANGUAGE plpgsql
AS $$
DECLARE
  v_cutoff TIMESTAMPTZ;
  v_rate INT;
  v_audit INT;
BEGIN
  v_cutoff := NOW() - (p_days || ' days')::INTERVAL;

  DELETE FROM rate_limits WHERE window_start < v_cutoff;
  GET DIAGNOSTICS v_rate = ROW_COUNT;

  DELETE FROM audit_log WHERE created_at < v_cutoff;
  GET DIAGNOSTICS v_audit = ROW_COUNT;

  rate_limits_deleted := v_rate;
  audit_deleted := v_audit;
  RETURN NEXT;
END;
$$;
