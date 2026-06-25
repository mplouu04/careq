-- Audit remediation: indexes, integrity, RLS, reminder failures, queue position RPC

-- ── Performance indexes ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_patients_dob ON patients(date_of_birth);
CREATE INDEX IF NOT EXISTS idx_patients_dob_phone ON patients(date_of_birth, phone_normalized);
CREATE INDEX IF NOT EXISTS idx_checkins_reminder
  ON checkins(appointment_date, status)
  WHERE reminder_sent_at IS NULL AND status = 'pending';
CREATE INDEX IF NOT EXISTS idx_doctor_blocks_doctor ON doctor_blocks(doctor_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);

-- ── Referential integrity ──────────────────────────────────────────────────────
ALTER TABLE queue
  DROP CONSTRAINT IF EXISTS fk_queue_room;
ALTER TABLE queue
  ADD CONSTRAINT fk_queue_room
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL;

-- ── NOT NULL on status columns ───────────────────────────────────────────────
UPDATE checkins SET status = 'pending' WHERE status IS NULL;
UPDATE queue SET status = 'waiting' WHERE status IS NULL;
ALTER TABLE checkins ALTER COLUMN status SET NOT NULL;
ALTER TABLE queue ALTER COLUMN status SET NOT NULL;

-- ── Unique names on reference tables ─────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_appointment_types_name'
  ) THEN
    ALTER TABLE appointment_types ADD CONSTRAINT uq_appointment_types_name UNIQUE (name);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_rooms_name'
  ) THEN
    ALTER TABLE rooms ADD CONSTRAINT uq_rooms_name UNIQUE (name);
  END IF;
END $$;

-- ── Realtime: full replica identity on checkins ──────────────────────────────
ALTER TABLE checkins REPLICA IDENTITY FULL;

-- ── Scoped public queue read (today only, Asia/Manila clinic day) ────────────
DROP POLICY IF EXISTS queue_public_read ON queue;
CREATE POLICY queue_public_read ON queue
  FOR SELECT
  USING (
    created_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Manila') AT TIME ZONE 'Asia/Manila')
    AND created_at < (
      (date_trunc('day', now() AT TIME ZONE 'Asia/Manila') + interval '1 day')
      AT TIME ZONE 'Asia/Manila'
    )
  );

-- ── Reminder dead-letter persistence ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reminder_failures (
  id BIGSERIAL PRIMARY KEY,
  checkin_id INT REFERENCES checkins(checkin_id) ON DELETE SET NULL,
  reference_number TEXT NOT NULL,
  recipient_email TEXT,
  error_message TEXT NOT NULL,
  retryable BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_reminder_failures_unresolved
  ON reminder_failures(created_at)
  WHERE resolved_at IS NULL;

ALTER TABLE reminder_failures ENABLE ROW LEVEL SECURITY;

-- ── Queue waiting position (avoids full-table scan) ────────────────────────────
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
  v_pos INT;
BEGIN
  SELECT status, skip_count INTO v_status, v_skip
  FROM queue WHERE id = p_queue_id;

  IF v_status IS NULL OR v_status <> 'waiting' THEN
    RETURN 0;
  END IF;

  SELECT COUNT(*)::INT + 1 INTO v_pos
  FROM queue q
  WHERE q.status = 'waiting'
    AND q.created_at >= p_day_start
    AND q.created_at <= p_day_end
    AND (
      q.skip_count < v_skip
      OR (q.skip_count = v_skip AND q.id < p_queue_id)
    );

  RETURN COALESCE(v_pos, 0);
END;
$$;

-- ── Purge expired patient sessions ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.purge_expired_patient_sessions()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INT;
BEGIN
  DELETE FROM patient_sessions
  WHERE expires_at < now() OR used = TRUE;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- Extend purge_old_logs to also purge expired sessions
-- (Postgres cannot change RETURNS TABLE signature via CREATE OR REPLACE)
DROP FUNCTION IF EXISTS public.purge_old_logs(integer);

CREATE OR REPLACE FUNCTION public.purge_old_logs(p_days INT DEFAULT 2190)
RETURNS TABLE(rate_limits_deleted INT, audit_deleted INT, sessions_deleted INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff TIMESTAMPTZ;
  v_rate INT;
  v_audit INT;
  v_sessions INT;
BEGIN
  v_cutoff := now() - (p_days || ' days')::INTERVAL;

  DELETE FROM rate_limits WHERE window_start < v_cutoff;
  GET DIAGNOSTICS v_rate = ROW_COUNT;

  DELETE FROM audit_log WHERE created_at < v_cutoff;
  GET DIAGNOSTICS v_audit = ROW_COUNT;

  v_sessions := purge_expired_patient_sessions();

  rate_limits_deleted := v_rate;
  audit_deleted := v_audit;
  sessions_deleted := v_sessions;
  RETURN NEXT;
END;
$$;

-- ── Staff trigger: only trust service-role app_metadata, not user_metadata ───
CREATE OR REPLACE FUNCTION public.handle_new_staff_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Staff role must be set via service-role app_metadata (not user-editable metadata)
  v_role := LOWER(TRIM(NEW.raw_app_meta_data->>'staff_role'));

  IF v_role IS NULL OR v_role NOT IN ('admin', 'doctor', 'nurse', 'receptionist') THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.staff (id, first_name, last_name, email, role, is_active)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(TRIM(NEW.raw_app_meta_data->>'staff_first_name'), ''), 'Staff'),
    COALESCE(NULLIF(TRIM(NEW.raw_app_meta_data->>'staff_last_name'), ''), 'User'),
    NEW.email,
    v_role::staff_role,
    TRUE
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;
