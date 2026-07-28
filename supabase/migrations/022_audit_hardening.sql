-- Audit hardening: slot booking RPC, phone_last7 index, schedule upsert RPC,
-- atomic verification-failure counter.

-- ── phone_last7 generated column (avoids leading-wildcard scans) ─────────────
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS phone_last7 VARCHAR(7)
  GENERATED ALWAYS AS (
    CASE
      WHEN phone_normalized IS NOT NULL AND length(phone_normalized) >= 7
        THEN right(phone_normalized, 7)
      ELSE NULL
    END
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_patients_dob_phone_last7
  ON patients (date_of_birth, phone_last7);

-- ── Transactional appointment slot booking (FOR UPDATE + overlap check) ──────
CREATE OR REPLACE FUNCTION public.book_appointment_slot(
  p_patient_id INT,
  p_doctor_id UUID,
  p_app_type_id INT,
  p_appointment_date TIMESTAMPTZ,
  p_scheduled_time TEXT,
  p_duration_minutes INT,
  p_max_concurrent INT,
  p_reference_number TEXT,
  p_reason TEXT,
  p_consent BOOLEAN,
  p_priority TEXT
)
RETURNS TABLE(out_checkin_id INT, out_reference_number TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slot_start INT;
  v_date_start TIMESTAMPTZ;
  v_date_end TIMESTAMPTZ;
  v_overlap_count INT;
  v_new_id INT;
  v_time TEXT;
BEGIN
  v_time := left(trim(p_scheduled_time), 5);
  v_slot_start := (split_part(v_time, ':', 1)::INT * 60)
                + split_part(v_time, ':', 2)::INT;

  v_date_start := date_trunc('day', p_appointment_date);
  v_date_end := v_date_start + interval '1 day' - interval '1 second';

  -- Lock all active same-day bookings for this doctor so concurrent bookers serialize
  PERFORM c.checkin_id
  FROM checkins c
  WHERE c.doctor_id = p_doctor_id
    AND c.type_id = 1
    AND c.status NOT IN ('cancelled', 'no_show')
    AND c.appointment_date >= v_date_start
    AND c.appointment_date <= v_date_end
  FOR UPDATE OF c;

  SELECT COUNT(*)::INT INTO v_overlap_count
  FROM checkins c
  LEFT JOIN appointment_types at ON at.id = c.app_type_id
  WHERE c.doctor_id = p_doctor_id
    AND c.type_id = 1
    AND c.status NOT IN ('cancelled', 'no_show')
    AND c.appointment_date >= v_date_start
    AND c.appointment_date <= v_date_end
    AND c.scheduled_time IS NOT NULL
    AND (
      v_slot_start < (
        (split_part(left(c.scheduled_time, 5), ':', 1)::INT * 60)
        + split_part(left(c.scheduled_time, 5), ':', 2)::INT
        + COALESCE(at.duration, 30)
      )
      AND (v_slot_start + GREATEST(p_duration_minutes, 1)) > (
        (split_part(left(c.scheduled_time, 5), ':', 1)::INT * 60)
        + split_part(left(c.scheduled_time, 5), ':', 2)::INT
      )
    );

  IF v_overlap_count >= GREATEST(p_max_concurrent, 1) THEN
    RAISE EXCEPTION 'slot_unavailable';
  END IF;

  INSERT INTO checkins (
    patient_id,
    doctor_id,
    app_type_id,
    appointment_date,
    scheduled_time,
    reason,
    consent,
    reference_number,
    type_id,
    status,
    priority
  )
  VALUES (
    p_patient_id,
    p_doctor_id,
    p_app_type_id,
    p_appointment_date,
    v_time,
    p_reason,
    COALESCE(p_consent, false),
    p_reference_number,
    1,
    'pending',
    COALESCE(NULLIF(p_priority, ''), 'normal')
  )
  RETURNING checkin_id INTO v_new_id;

  out_checkin_id := v_new_id;
  out_reference_number := p_reference_number;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.book_appointment_slot(
  INT, UUID, INT, TIMESTAMPTZ, TEXT, INT, INT, TEXT, TEXT, BOOLEAN, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.book_appointment_slot(
  INT, UUID, INT, TIMESTAMPTZ, TEXT, INT, INT, TEXT, TEXT, BOOLEAN, TEXT
) TO service_role;

-- ── Bulk upsert doctor weekly schedules (replaces N+1 loop) ──────────────────
CREATE OR REPLACE FUNCTION public.upsert_doctor_schedules(
  p_doctor_id UUID,
  p_schedules JSONB
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row JSONB;
  v_count INT := 0;
  v_day SMALLINT;
  v_start TEXT;
  v_end TEXT;
  v_active BOOLEAN;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM staff WHERE id = p_doctor_id AND role = 'doctor'
  ) THEN
    RAISE EXCEPTION 'doctor_not_found';
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_schedules)
  LOOP
    v_day := (v_row->>'day_of_week')::SMALLINT;
    v_start := left(COALESCE(v_row->>'start_time', '08:00'), 5);
    v_end := left(COALESCE(v_row->>'end_time', '17:00'), 5);
    v_active := COALESCE((v_row->>'is_active')::BOOLEAN, false);

    IF v_day < 0 OR v_day > 6 THEN
      RAISE EXCEPTION 'invalid_day_of_week';
    END IF;

    INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, is_active)
    VALUES (p_doctor_id, v_day, v_start::TIME, v_end::TIME, v_active)
    ON CONFLICT (doctor_id, day_of_week)
    DO UPDATE SET
      start_time = EXCLUDED.start_time,
      end_time = EXCLUDED.end_time,
      is_active = EXCLUDED.is_active;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_doctor_schedules(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_doctor_schedules(UUID, JSONB) TO service_role;

-- ── Atomic verification failure counter + lockout ────────────────────────────
CREATE OR REPLACE FUNCTION public.record_verification_failure(
  p_ip TEXT,
  p_max_failures INT DEFAULT 5
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id INT;
  v_count INT;
  v_now TIMESTAMPTZ := now();
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('patient_verify_failures:' || p_ip));

  SELECT id, request_count INTO v_id, v_count
  FROM rate_limits
  WHERE action = 'patient_verify_failures' AND ip_address = p_ip
  ORDER BY id DESC
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO rate_limits (action, ip_address, request_count, window_start)
    VALUES ('patient_verify_failures', p_ip, 1, v_now)
    RETURNING request_count INTO v_count;
  ELSE
    UPDATE rate_limits
    SET request_count = request_count + 1, window_start = v_now
    WHERE id = v_id
    RETURNING request_count INTO v_count;
  END IF;

  IF v_count >= p_max_failures THEN
    DELETE FROM rate_limits
    WHERE action = 'patient_verify_lockout' AND ip_address = p_ip;
    INSERT INTO rate_limits (action, ip_address, request_count, window_start)
    VALUES ('patient_verify_lockout', p_ip, 1, v_now);
  END IF;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.record_verification_failure(TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_verification_failure(TEXT, INT) TO service_role;
