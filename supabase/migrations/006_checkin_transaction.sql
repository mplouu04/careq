-- Transactional check-in: atomically create queue entry with counter

CREATE OR REPLACE FUNCTION checkin_to_queue(
  p_checkin_id INT,
  p_prefix TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
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

  v_date := CURRENT_DATE;
  v_counter := next_counter(v_date, p_prefix);
  v_queue_number := p_prefix || '-' || v_counter;

  INSERT INTO queue (checkin_id, queue_number, status)
  VALUES (p_checkin_id, v_queue_number, 'waiting');

  RETURN v_queue_number;
END;
$$;
