-- Extend patient verify sessions for same-day clinic use (phone+DOB, no login).
-- Was 15 minutes; 4 hours covers a typical visit window without long-lived accounts.
ALTER TABLE patient_sessions
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '4 hours');
