-- Fix book_appointment_slot: cast p_priority text to priority_level enum.
-- Without the cast, INSERT fails with:
--   column "priority" is of type priority_level but expression is of type text

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
    COALESCE(NULLIF(p_priority, ''), 'normal')::public.priority_level
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
