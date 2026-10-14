CREATE TABLE password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_digest bytea NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);

CREATE INDEX password_reset_user_pending_idx ON password_reset_tokens (user_id, expires_at)
  WHERE consumed_at IS NULL;

CREATE UNIQUE INDEX password_reset_one_active_per_user ON password_reset_tokens (user_id)
  WHERE consumed_at IS NULL;
