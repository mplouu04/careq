-- CAREQ PostgreSQL schema (ported from PQMS migration.php)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
CREATE TYPE staff_role AS ENUM ('admin', 'doctor', 'nurse', 'receptionist');
CREATE TYPE queue_status AS ENUM ('waiting', 'called', 'in_progress', 'completed', 'cancelled');
CREATE TYPE priority_level AS ENUM ('low', 'normal', 'high', 'emergency');
CREATE TYPE checkin_status AS ENUM ('pending', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show');
CREATE TYPE block_reason AS ENUM ('lunch', 'meeting', 'time_off', 'other');

-- Staff (linked to Supabase Auth)
CREATE TABLE staff (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  role staff_role NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE checkin_types (
  id SMALLINT PRIMARY KEY,
  type_name VARCHAR(20) NOT NULL,
  description VARCHAR(255)
);

CREATE TABLE patients (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  date_of_birth DATE NOT NULL,
  gender VARCHAR(20) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  phone_normalized VARCHAR(20),
  email VARCHAR(190),
  address VARCHAR(255) NOT NULL DEFAULT '',
  consent BOOLEAN DEFAULT FALSE,
  is_registered BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_patients_email ON patients(email) WHERE email IS NOT NULL;

CREATE TABLE appointment_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  duration INT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE checkins (
  checkin_id SERIAL PRIMARY KEY,
  patient_id INT NOT NULL REFERENCES patients(id),
  type_id SMALLINT NOT NULL REFERENCES checkin_types(id),
  doctor_id UUID REFERENCES staff(id),
  app_type_id INT REFERENCES appointment_types(id),
  reference_number VARCHAR(20) NOT NULL,
  scheduled_time VARCHAR(20),
  appointment_date TIMESTAMPTZ,
  actual_checkin_time TIMESTAMPTZ,
  reason TEXT,
  status checkin_status,
  priority priority_level DEFAULT 'normal',
  consent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_appointment_fields CHECK (
    (type_id = 1 AND app_type_id IS NOT NULL AND scheduled_time IS NOT NULL
      AND doctor_id IS NOT NULL AND appointment_date IS NOT NULL)
    OR (type_id = 2 AND app_type_id IS NOT NULL AND doctor_id IS NULL)
  )
);

CREATE TABLE queue (
  id SERIAL PRIMARY KEY,
  checkin_id INT NOT NULL REFERENCES checkins(checkin_id),
  queue_number VARCHAR(10) NOT NULL,
  priority priority_level DEFAULT 'normal',
  status queue_status DEFAULT 'waiting',
  called_at TIMESTAMPTZ,
  called_by UUID REFERENCES staff(id),
  room_id INT,
  completed_at TIMESTAMPTZ,
  skip_count SMALLINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE rooms (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE display_settings (
  id SERIAL PRIMARY KEY,
  display_name VARCHAR(50) NOT NULL,
  location VARCHAR(100) NOT NULL,
  show_wait_time BOOLEAN DEFAULT TRUE,
  show_priority BOOLEAN DEFAULT TRUE,
  theme_color VARCHAR(20) DEFAULT '#0d6efd',
  is_active BOOLEAN DEFAULT TRUE,
  last_ping TIMESTAMPTZ
);

CREATE TABLE audit_log (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES staff(id),
  action VARCHAR(50) NOT NULL,
  table_name VARCHAR(50) NOT NULL,
  record_id INT,
  old_values TEXT,
  new_values TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE doctor_schedules (
  id SERIAL PRIMARY KEY,
  doctor_id UUID NOT NULL REFERENCES staff(id),
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE (doctor_id, day_of_week)
);

CREATE TABLE doctor_blocks (
  id SERIAL PRIMARY KEY,
  doctor_id UUID NOT NULL REFERENCES staff(id),
  block_date DATE,
  day_of_week SMALLINT CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  reason block_reason DEFAULT 'other',
  is_recurring BOOLEAN DEFAULT FALSE
);

CREATE TABLE rate_limits (
  id SERIAL PRIMARY KEY,
  action VARCHAR(50) NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  request_count INT DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_rate_limits_action_ip ON rate_limits(action, ip_address);
CREATE INDEX idx_rate_limits_window ON rate_limits(window_start);
CREATE INDEX idx_queue_status_created ON queue(status, created_at);
CREATE INDEX idx_checkins_ref ON checkins(reference_number);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER staff_updated_at BEFORE UPDATE ON staff
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER patients_updated_at BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER checkins_updated_at BEFORE UPDATE ON checkins
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER queue_updated_at BEFORE UPDATE ON queue
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Auto-create staff row when auth user signs up with staff metadata
CREATE OR REPLACE FUNCTION public.handle_new_staff_user()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.raw_user_meta_data->>'role' IS NOT NULL THEN
    INSERT INTO public.staff (id, first_name, last_name, email, role)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'first_name', 'Staff'),
      COALESCE(NEW.raw_user_meta_data->>'last_name', 'User'),
      NEW.email,
      (NEW.raw_user_meta_data->>'role')::staff_role
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_staff_user();

-- RLS
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE display_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkin_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Staff: read own row; admins read all
CREATE POLICY staff_select_own ON staff FOR SELECT
  USING (auth.uid() = id OR EXISTS (
    SELECT 1 FROM staff s WHERE s.id = auth.uid() AND s.role = 'admin'
  ));

-- Public read for appointment types, doctors list, checkin types, rooms, display
CREATE POLICY appt_types_read ON appointment_types FOR SELECT USING (true);
CREATE POLICY checkin_types_read ON checkin_types FOR SELECT USING (true);
CREATE POLICY rooms_read ON rooms FOR SELECT USING (is_active = true);
CREATE POLICY display_read ON display_settings FOR SELECT USING (is_active = true);

CREATE POLICY doctors_public_read ON staff FOR SELECT
  USING (role = 'doctor' AND is_active = true);

CREATE POLICY doctor_schedules_read ON doctor_schedules FOR SELECT USING (true);
CREATE POLICY doctor_blocks_read ON doctor_blocks FOR SELECT USING (true);

-- Queue: public read for today (TV board + status)
CREATE POLICY queue_public_read ON queue FOR SELECT USING (true);

-- Patients/checkins: service role handles writes via API; authenticated staff full access
CREATE POLICY patients_staff ON patients FOR ALL
  USING (EXISTS (SELECT 1 FROM staff WHERE id = auth.uid()));

CREATE POLICY checkins_staff ON checkins FOR ALL
  USING (EXISTS (SELECT 1 FROM staff WHERE id = auth.uid()));

CREATE POLICY queue_staff ON queue FOR ALL
  USING (EXISTS (SELECT 1 FROM staff WHERE id = auth.uid()));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE queue;
