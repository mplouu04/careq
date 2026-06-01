-- Seed reference data (run after 001_schema.sql)

INSERT INTO checkin_types (id, type_name, description) VALUES
  (1, 'appointment', 'Pre-scheduled appointment'),
  (2, 'walk_in', 'Walk-in patient without appointment')
ON CONFLICT (id) DO NOTHING;

INSERT INTO appointment_types (name, duration, description) VALUES
  ('General Consultation', 15, 'Regular doctor consultation'),
  ('Follow-up Visit', 10, 'Follow-up appointment'),
  ('Urgent Care', 30, 'Urgent medical attention needed'),
  ('Vaccination', 5, 'Vaccination appointment')
ON CONFLICT DO NOTHING;

INSERT INTO rooms (name, description) VALUES
  ('Room 1', 'General consultation room'),
  ('Room 2', 'Examination room'),
  ('Room 3', 'Nurse practitioner room')
ON CONFLICT DO NOTHING;

INSERT INTO display_settings (display_name, location) VALUES
  ('Main Lobby Display', 'Waiting Area')
ON CONFLICT DO NOTHING;

-- Admin user: create in Supabase Dashboard → Authentication → Users
-- Email: admin@clinic.com  Password: admin123 (change immediately)
-- User metadata JSON:
-- { "role": "admin", "first_name": "Admin", "last_name": "User" }
-- The trigger handle_new_staff_user() will create the staff row automatically.
