-- Atomic daily counters for queue numbers and reference IDs

CREATE TABLE IF NOT EXISTS daily_counters (
  counter_date DATE NOT NULL,
  counter_key  TEXT NOT NULL,
  last_value   INT NOT NULL DEFAULT 0,
  PRIMARY KEY (counter_date, counter_key)
);

CREATE OR REPLACE FUNCTION next_counter(p_date DATE, p_key TEXT)
RETURNS INT
LANGUAGE sql
AS $$
  INSERT INTO daily_counters (counter_date, counter_key, last_value)
  VALUES (p_date, p_key, 1)
  ON CONFLICT (counter_date, counter_key)
  DO UPDATE SET last_value = daily_counters.last_value + 1
  RETURNING last_value;
$$;

-- Safety net: unique queue numbers per clinic day
CREATE UNIQUE INDEX IF NOT EXISTS uq_queue_number_day
  ON queue (queue_number, ((created_at AT TIME ZONE 'UTC')::date));

-- Safety net: unique appointment / walk-in reference numbers
CREATE UNIQUE INDEX IF NOT EXISTS uq_checkins_reference
  ON checkins (reference_number);

ALTER TABLE daily_counters ENABLE ROW LEVEL SECURITY;
