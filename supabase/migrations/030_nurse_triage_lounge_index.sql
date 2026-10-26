-- Requires 029 committed first (new queue_status enum values).
CREATE INDEX IF NOT EXISTS idx_queue_status_waiting_since
  ON queue (status, waiting_since)
  WHERE status IN ('waiting', 'with_nurse', 'ready_for_doctor');
