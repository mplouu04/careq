-- Short-lived email verification codes + proofs for register / guest booking.

CREATE TABLE email_verifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  code_hash   TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes'),
  attempts    INT NOT NULL DEFAULT 0,
  consumed    BOOLEAN NOT NULL DEFAULT false,
  ip          VARCHAR(45),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_verifications_email ON email_verifications (email);
CREATE INDEX idx_email_verifications_expires_at ON email_verifications (expires_at);

CREATE TABLE email_proofs (
  token       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '15 minutes'),
  used        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_proofs_email ON email_proofs (email);
CREATE INDEX idx_email_proofs_expires_at ON email_proofs (expires_at);

ALTER TABLE email_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_proofs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.purge_expired_email_verify()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT := 0;
  v_n INT;
BEGIN
  DELETE FROM email_verifications
  WHERE expires_at < now() OR consumed = TRUE;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_count := v_count + v_n;

  DELETE FROM email_proofs
  WHERE expires_at < now() OR used = TRUE;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_count := v_count + v_n;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_expired_email_verify() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_expired_email_verify() TO service_role;
