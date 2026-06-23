-- Short-lived verification tokens for public kiosk identity checks (walk-in check-in).

CREATE TABLE patient_sessions (
  token       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id  INTEGER     NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT now() + interval '15 minutes',
  used        BOOLEAN     NOT NULL DEFAULT false,
  ip          VARCHAR(45)
);

CREATE INDEX idx_patient_sessions_patient_id ON patient_sessions(patient_id);
CREATE INDEX idx_patient_sessions_expires_at ON patient_sessions(expires_at);

-- Service-role only (no policies); blocks anon/authenticated direct access
ALTER TABLE patient_sessions ENABLE ROW LEVEL SECURITY;
