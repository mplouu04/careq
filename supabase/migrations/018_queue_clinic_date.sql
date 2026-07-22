-- Clinic-local date column for efficient same-day queue filtering.
-- Derived from created_at in Asia/Manila (matches app TIMEZONE / getClinicTodayYmd).

ALTER TABLE queue
  ADD COLUMN IF NOT EXISTS clinic_date DATE;

UPDATE queue
SET clinic_date = (created_at AT TIME ZONE 'Asia/Manila')::DATE
WHERE clinic_date IS NULL;

ALTER TABLE queue
  ALTER COLUMN clinic_date SET DEFAULT ((now() AT TIME ZONE 'Asia/Manila')::DATE);

ALTER TABLE queue
  ALTER COLUMN clinic_date SET NOT NULL;

CREATE OR REPLACE FUNCTION public.set_queue_clinic_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.clinic_date IS NULL THEN
    NEW.clinic_date := (COALESCE(NEW.created_at, now()) AT TIME ZONE 'Asia/Manila')::DATE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS queue_set_clinic_date ON queue;
CREATE TRIGGER queue_set_clinic_date
  BEFORE INSERT ON queue
  FOR EACH ROW
  EXECUTE FUNCTION public.set_queue_clinic_date();

CREATE INDEX IF NOT EXISTS idx_queue_clinic_date_status_order
  ON queue (clinic_date, status, skip_count, id);

-- Align public SELECT policy with clinic_date (same-day board reads via anon key).
DROP POLICY IF EXISTS queue_public_read ON queue;
CREATE POLICY queue_public_read ON queue
  FOR SELECT
  USING (clinic_date = (now() AT TIME ZONE 'Asia/Manila')::DATE);

-- Ensure transactional check-in writes clinic_date using Manila local date.
CREATE OR REPLACE FUNCTION checkin_to_queue(
  p_checkin_id INT,
  p_prefix TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
  v_counter INT;
  v_queue_number TEXT;
  v_date DATE;
BEGIN
  SELECT status INTO v_status
  FROM checkins
  WHERE checkin_id = p_checkin_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'checkin_not_found';
  END IF;

  IF v_status IN ('cancelled', 'completed', 'no_show') THEN
    RAISE EXCEPTION 'checkin_terminal:%', v_status;
  END IF;

  IF EXISTS (
    SELECT 1 FROM queue
    WHERE checkin_id = p_checkin_id
      AND status NOT IN ('completed', 'cancelled', 'no_show')
  ) THEN
    RAISE EXCEPTION 'already_in_queue';
  END IF;

  v_date := (now() AT TIME ZONE 'Asia/Manila')::DATE;
  v_counter := next_counter(v_date, p_prefix);
  v_queue_number := p_prefix || '-' || v_counter;

  INSERT INTO queue (checkin_id, queue_number, status, clinic_date)
  VALUES (p_checkin_id, v_queue_number, 'waiting', v_date);

  RETURN v_queue_number;
END;
$$;

-- Waiting position uses clinic_date (same day as the entry) instead of timestamptz range.
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
  v_pos INT;
BEGIN
  -- Keep p_day_start / p_day_end for API compatibility; filter by clinic_date instead.
  SELECT status, skip_count, clinic_date
  INTO v_status, v_skip, v_clinic_date
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
      OR (q.skip_count = v_skip AND q.id < p_queue_id)
    );

  RETURN COALESCE(v_pos, 0);
END;
$$;
