CREATE TABLE store_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  email text NOT NULL CHECK (length(trim(email)) BETWEEN 3 AND 254),
  email_normalized text NOT NULL CHECK (length(email_normalized) BETWEEN 3 AND 254),
  role text NOT NULL CHECK (role IN ('manager', 'cashier', 'stockkeeper', 'accountant')),
  token_digest bytea NOT NULL UNIQUE,
  invited_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  claimed_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at),
  CHECK (accepted_at IS NULL OR revoked_at IS NULL)
);

CREATE INDEX store_invitations_store_recent_idx
  ON store_invitations (store_id, created_at DESC);
CREATE UNIQUE INDEX store_invitations_one_pending_email_idx
  ON store_invitations (store_id, email_normalized)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

ALTER TABLE store_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_invitations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_or_invitation_scope ON store_invitations
  USING (
    store_id = NULLIF(current_setting('app.store_id', true), '')::uuid
    OR token_digest = decode(NULLIF(current_setting('app.invitation_digest', true), ''), 'hex')
    OR claimed_user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
  )
  WITH CHECK (store_id = NULLIF(current_setting('app.store_id', true), '')::uuid);
