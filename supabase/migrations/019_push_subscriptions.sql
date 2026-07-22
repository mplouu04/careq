-- Web Push subscriptions keyed by queue_number so patients can be notified
-- when staff call them (even with the status tab closed).

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          BIGSERIAL PRIMARY KEY,
  queue_number VARCHAR(20) NOT NULL,
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_queue
  ON push_subscriptions(queue_number);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Writes go through service-role API routes; no public RLS policies.
