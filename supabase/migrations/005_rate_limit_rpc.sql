-- Atomic rate-limit increment

CREATE OR REPLACE FUNCTION increment_rate_limit(
  p_action TEXT,
  p_ip TEXT,
  p_max INT,
  p_window_seconds INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_count INT;
  v_id INT;
BEGIN
  v_window_start := NOW() - (p_window_seconds || ' seconds')::INTERVAL;

  DELETE FROM rate_limits
  WHERE action = p_action
    AND ip_address = p_ip
    AND window_start < v_window_start;

  SELECT id, request_count INTO v_id, v_count
  FROM rate_limits
  WHERE action = p_action
    AND ip_address = p_ip
    AND window_start >= v_window_start
  ORDER BY window_start DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO rate_limits (action, ip_address, request_count, window_start)
    VALUES (p_action, p_ip, 1, NOW());
    RETURN TRUE;
  END IF;

  IF v_count >= p_max THEN
    RETURN FALSE;
  END IF;

  UPDATE rate_limits
  SET request_count = request_count + 1
  WHERE id = v_id;

  RETURN TRUE;
END;
$$;
