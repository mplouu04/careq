-- Performance indexes for queue API hot paths

-- Covering partial index for getAvgServiceTime.
-- The query filters status='completed' and called_at in a day range, then reads completed_at.
-- Without this, Postgres falls back to the heap for every completed row.
-- INCLUDE (completed_at) enables an index-only scan so no heap access is needed.
CREATE INDEX IF NOT EXISTS idx_queue_completed_called
  ON queue (called_at)
  INCLUDE (completed_at)
  WHERE status = 'completed'
    AND called_at IS NOT NULL
    AND completed_at IS NOT NULL;

-- Index on queue.checkin_id to support the ref-lookup fallback path.
-- queue.checkin_id is a NOT NULL FK but has no index; without one Postgres
-- does a sequential scan of the entire queue table to resolve a single row.
CREATE INDEX IF NOT EXISTS idx_queue_checkin_id ON queue (checkin_id);
