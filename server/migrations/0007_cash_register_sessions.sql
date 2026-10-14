CREATE TABLE cash_register_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  opened_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  opening_float_vnd bigint NOT NULL CHECK (opening_float_vnd >= 0),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  closed_at timestamptz,
  expected_cash_vnd bigint,
  counted_cash_vnd bigint,
  variance_vnd bigint,
  close_note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, id),
  CHECK (
    (status = 'open' AND closed_by IS NULL AND closed_at IS NULL AND expected_cash_vnd IS NULL AND counted_cash_vnd IS NULL AND variance_vnd IS NULL)
    OR
    (status = 'closed' AND closed_by IS NOT NULL AND closed_at IS NOT NULL AND expected_cash_vnd IS NOT NULL AND counted_cash_vnd IS NOT NULL AND variance_vnd IS NOT NULL)
  )
);

CREATE UNIQUE INDEX cash_register_one_open_per_store_idx
  ON cash_register_sessions (store_id)
  WHERE status = 'open';
CREATE INDEX cash_register_store_recent_idx
  ON cash_register_sessions (store_id, opened_at DESC);

ALTER TABLE cash_movements
  ADD COLUMN cash_session_id uuid,
  ADD CONSTRAINT cash_movements_cash_session_fk
    FOREIGN KEY (store_id, cash_session_id)
    REFERENCES cash_register_sessions (store_id, id)
    ON DELETE RESTRICT;

CREATE INDEX cash_movements_session_idx
  ON cash_movements (store_id, cash_session_id, occurred_at)
  WHERE cash_session_id IS NOT NULL;

ALTER TABLE cash_register_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_register_sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON cash_register_sessions
  USING (store_id = NULLIF(current_setting('app.store_id', true), '')::uuid)
  WITH CHECK (store_id = NULLIF(current_setting('app.store_id', true), '')::uuid);
