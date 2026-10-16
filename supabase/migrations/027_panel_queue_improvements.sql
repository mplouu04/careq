-- Panel improvements: present_at, waiting_since, no-show grace, per-screen rooms, metrics.

-- Consult start timestamp (Present); service time = present_at → completed_at
ALTER TABLE queue
  ADD COLUMN IF NOT EXISTS present_at TIMESTAMPTZ;

-- FIFO re-queue ordering (restore no-show to end of waiting)
ALTER TABLE queue
  ADD COLUMN IF NOT EXISTS waiting_since TIMESTAMPTZ;

UPDATE queue
SET waiting_since = created_at
WHERE waiting_since IS NULL;

ALTER TABLE queue
  ALTER COLUMN waiting_since SET DEFAULT NOW();

-- Per-TV room filter (NULL / empty = all active rooms)
ALTER TABLE display_settings
  ADD COLUMN IF NOT EXISTS room_ids INT[];

-- Clinic-wide settings (service-role API only).
-- Column is setting_key (not "key") to avoid reserved-word / PostgREST ambiguity.
CREATE TABLE IF NOT EXISTS clinic_settings (
  setting_key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Upgrade path if an earlier draft created clinic_settings(key, ...)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clinic_settings'
      AND column_name = 'key'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clinic_settings'
      AND column_name = 'setting_key'
  ) THEN
    ALTER TABLE clinic_settings RENAME COLUMN key TO setting_key;
  END IF;
END $$;

INSERT INTO clinic_settings (setting_key, value)
VALUES ('no_show_grace_minutes', '5')
ON CONFLICT (setting_key) DO NOTHING;

ALTER TABLE clinic_settings ENABLE ROW LEVEL SECURITY;

-- Drop permissive draft policy if present (app uses service-role admin client)
DROP POLICY IF EXISTS clinic_settings_staff_read ON clinic_settings;

REVOKE ALL ON TABLE clinic_settings FROM PUBLIC;
GRANT ALL ON TABLE clinic_settings TO service_role;

-- Avg service: consult started (present_at, else called_at) → completed_at
CREATE OR REPLACE FUNCTION public.get_avg_service_minutes(
  p_day_start TIMESTAMPTZ,
  p_day_end TIMESTAMPTZ
) RETURNS INT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    ROUND(
      AVG(
        EXTRACT(
          EPOCH FROM (
            completed_at - COALESCE(present_at, called_at)
          )
        ) / 60.0
      )
    )::INT,
    10
  )
  FROM queue
  WHERE status = 'completed'
    AND COALESCE(present_at, called_at) IS NOT NULL
    AND completed_at IS NOT NULL
    AND COALESCE(present_at, called_at) >= p_day_start
    AND COALESCE(present_at, called_at) <= p_day_end;
$$;

-- Waiting position: skip_count, then waiting_since, then id
CREATE OR REPLACE FUNCTION public.get_queue_waiting_position(
  p_queue_id INT,
  p_day_start TIMESTAMPTZ,
  p_day_end TIMESTAMPTZ
) RETURNS INT
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
DECLARE
  v_status queue_status;
  v_skip INT;
  v_clinic_date DATE;
  v_waiting_since TIMESTAMPTZ;
  v_pos INT;
BEGIN
  SELECT status, skip_count, clinic_date, COALESCE(waiting_since, created_at)
  INTO v_status, v_skip, v_clinic_date, v_waiting_since
  FROM queue WHERE id = p_queue_id;

  IF v_status IS NULL OR v_status <> 'waiting' THEN
    RETURN 0;
  END IF;

  SELECT COUNT(*)::INT + 1 INTO v_pos
  FROM queue q
  WHERE q.status = 'waiting'
    AND q.clinic_date = v_clinic_date
    AND (
      q.skip_count < v_skip
      OR (
        q.skip_count = v_skip
        AND COALESCE(q.waiting_since, q.created_at) < v_waiting_since
      )
      OR (
        q.skip_count = v_skip
        AND COALESCE(q.waiting_since, q.created_at) = v_waiting_since
        AND q.id < p_queue_id
      )
    );

  RETURN COALESCE(v_pos, 0);
END;
$$;
