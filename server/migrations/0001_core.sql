CREATE TABLE stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 160),
  timezone text NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  currency char(3) NOT NULL DEFAULT 'VND' CHECK (currency = 'VND'),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id)
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  email_normalized text NOT NULL UNIQUE,
  display_name text NOT NULL CHECK (length(trim(display_name)) BETWEEN 1 AND 120),
  password_hash text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'disabled')),
  email_verified_at timestamptz,
  password_changed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id)
);

CREATE TABLE memberships (
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  role text NOT NULL CHECK (role IN ('owner', 'manager', 'cashier', 'stockkeeper', 'accountant')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('invited', 'active', 'suspended')),
  invited_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  joined_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id, user_id)
);

CREATE INDEX memberships_user_status_idx ON memberships (user_id, status);

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_digest bytea NOT NULL UNIQUE,
  csrf_digest bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CHECK (expires_at > created_at)
);

CREATE INDEX sessions_user_active_idx ON sessions (user_id, expires_at) WHERE revoked_at IS NULL;

CREATE TABLE email_verification_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_digest bytea NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);

CREATE INDEX email_verification_tokens_user_idx ON email_verification_tokens (user_id, created_at DESC);

CREATE TABLE store_sequences (
  store_id uuid PRIMARY KEY REFERENCES stores(id) ON DELETE RESTRICT,
  next_order_number bigint NOT NULL DEFAULT 1001 CHECK (next_order_number > 0),
  next_return_number bigint NOT NULL DEFAULT 1001 CHECK (next_return_number > 0),
  next_purchase_number bigint NOT NULL DEFAULT 1001 CHECK (next_purchase_number > 0)
);

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  sku text NOT NULL CHECK (length(trim(sku)) BETWEEN 1 AND 80),
  sku_normalized text NOT NULL,
  barcode text,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 240),
  category text NOT NULL DEFAULT 'Chưa phân loại',
  unit text NOT NULL DEFAULT 'cái',
  sale_price_vnd bigint NOT NULL DEFAULT 0 CHECK (sale_price_vnd >= 0),
  cost_vnd bigint NOT NULL DEFAULT 0 CHECK (cost_vnd >= 0),
  low_stock_threshold numeric(14,3) NOT NULL DEFAULT 0 CHECK (low_stock_threshold >= 0),
  inventory_tracked boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, id),
  UNIQUE (store_id, sku_normalized)
);

CREATE UNIQUE INDEX products_store_barcode_idx ON products (store_id, barcode) WHERE barcode IS NOT NULL;
CREATE INDEX products_store_active_name_idx ON products (store_id, status, name);

CREATE TABLE product_cost_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  product_id uuid NOT NULL,
  unit_cost_vnd bigint NOT NULL CHECK (unit_cost_vnd >= 0),
  source_type text NOT NULL CHECK (source_type IN ('opening_balance', 'purchase', 'manual_adjustment')),
  source_id uuid,
  actor_user_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (store_id, product_id) REFERENCES products(store_id, id) ON DELETE RESTRICT
);

CREATE INDEX product_cost_history_lookup_idx ON product_cost_history (store_id, product_id, created_at DESC);

CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 160),
  phone text,
  phone_normalized text,
  email text,
  note text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, id)
);

CREATE INDEX customers_store_name_idx ON customers (store_id, status, name);
CREATE INDEX customers_store_phone_idx ON customers (store_id, phone_normalized) WHERE phone_normalized IS NOT NULL;

CREATE TABLE suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 160),
  phone text,
  email text,
  note text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, id)
);

CREATE INDEX suppliers_store_name_idx ON suppliers (store_id, status, name);

CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  order_number text NOT NULL,
  customer_id uuid,
  cashier_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'partially_returned', 'returned', 'voided')),
  subtotal_vnd bigint NOT NULL CHECK (subtotal_vnd >= 0),
  discount_vnd bigint NOT NULL DEFAULT 0 CHECK (discount_vnd >= 0),
  tax_vnd bigint NOT NULL DEFAULT 0 CHECK (tax_vnd >= 0),
  total_vnd bigint NOT NULL CHECK (total_vnd >= 0),
  note text NOT NULL DEFAULT '',
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, id),
  UNIQUE (store_id, order_number),
  FOREIGN KEY (store_id, customer_id) REFERENCES customers(store_id, id) ON DELETE RESTRICT,
  CHECK (discount_vnd <= subtotal_vnd),
  CHECK (total_vnd = subtotal_vnd - discount_vnd + tax_vnd)
);

CREATE INDEX orders_store_occurred_idx ON orders (store_id, occurred_at DESC);
CREATE INDEX orders_customer_occurred_idx ON orders (store_id, customer_id, occurred_at DESC);

CREATE TABLE order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  order_id uuid NOT NULL,
  product_id uuid NOT NULL,
  product_name_snapshot text NOT NULL,
  sku_snapshot text NOT NULL,
  unit_snapshot text NOT NULL,
  quantity numeric(14,3) NOT NULL CHECK (quantity > 0),
  unit_price_vnd bigint NOT NULL CHECK (unit_price_vnd >= 0),
  unit_cost_vnd bigint NOT NULL CHECK (unit_cost_vnd >= 0),
  discount_vnd bigint NOT NULL DEFAULT 0 CHECK (discount_vnd >= 0),
  tax_vnd bigint NOT NULL DEFAULT 0 CHECK (tax_vnd >= 0),
  line_total_vnd bigint NOT NULL CHECK (line_total_vnd >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, id),
  FOREIGN KEY (store_id, order_id) REFERENCES orders(store_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (store_id, product_id) REFERENCES products(store_id, id) ON DELETE RESTRICT
);

CREATE INDEX order_lines_order_idx ON order_lines (store_id, order_id);
CREATE INDEX order_lines_product_idx ON order_lines (store_id, product_id);

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  order_id uuid NOT NULL,
  method text NOT NULL CHECK (method IN ('cash', 'bank_transfer', 'bank_qr', 'card', 'other')),
  status text NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'reversed')),
  amount_vnd bigint NOT NULL CHECK (amount_vnd > 0),
  provider text,
  provider_reference text,
  recorded_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, id),
  FOREIGN KEY (store_id, order_id) REFERENCES orders(store_id, id) ON DELETE RESTRICT
);

CREATE INDEX payments_order_idx ON payments (store_id, order_id, occurred_at);
CREATE UNIQUE INDEX payments_provider_reference_idx ON payments (provider, provider_reference) WHERE provider_reference IS NOT NULL;

CREATE TABLE returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  order_id uuid NOT NULL,
  return_number text NOT NULL,
  status text NOT NULL CHECK (status IN ('completed', 'voided')),
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 500),
  refund_total_vnd bigint NOT NULL CHECK (refund_total_vnd >= 0),
  restock_policy text NOT NULL CHECK (restock_policy IN ('restock', 'damaged', 'discarded')),
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, id),
  UNIQUE (store_id, return_number),
  FOREIGN KEY (store_id, order_id) REFERENCES orders(store_id, id) ON DELETE RESTRICT
);

CREATE TABLE return_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  return_id uuid NOT NULL,
  order_id uuid NOT NULL,
  order_line_id uuid NOT NULL,
  quantity numeric(14,3) NOT NULL CHECK (quantity > 0),
  refund_vnd bigint NOT NULL CHECK (refund_vnd >= 0),
  restocked_quantity numeric(14,3) NOT NULL DEFAULT 0 CHECK (restocked_quantity >= 0 AND restocked_quantity <= quantity),
  UNIQUE (store_id, id),
  FOREIGN KEY (store_id, return_id) REFERENCES returns(store_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (store_id, order_id) REFERENCES orders(store_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (store_id, order_line_id) REFERENCES order_lines(store_id, id) ON DELETE RESTRICT
);

CREATE INDEX return_lines_order_line_idx ON return_lines (store_id, order_line_id);

CREATE TABLE refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  return_id uuid NOT NULL,
  method text NOT NULL CHECK (method IN ('cash', 'bank_transfer', 'bank_qr', 'card', 'other', 'account_credit')),
  status text NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'reversed')),
  amount_vnd bigint NOT NULL CHECK (amount_vnd > 0),
  provider text,
  provider_reference text,
  recorded_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, id),
  FOREIGN KEY (store_id, return_id) REFERENCES returns(store_id, id) ON DELETE RESTRICT
);

CREATE TABLE purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  purchase_number text NOT NULL,
  supplier_id uuid,
  status text NOT NULL CHECK (status IN ('draft', 'received', 'partially_received', 'cancelled')),
  subtotal_vnd bigint NOT NULL CHECK (subtotal_vnd >= 0),
  tax_vnd bigint NOT NULL DEFAULT 0 CHECK (tax_vnd >= 0),
  total_vnd bigint NOT NULL CHECK (total_vnd = subtotal_vnd + tax_vnd),
  note text NOT NULL DEFAULT '',
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  received_at timestamptz,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, id),
  UNIQUE (store_id, purchase_number),
  FOREIGN KEY (store_id, supplier_id) REFERENCES suppliers(store_id, id) ON DELETE RESTRICT
);

CREATE TABLE purchase_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  purchase_id uuid NOT NULL,
  product_id uuid NOT NULL,
  product_name_snapshot text NOT NULL,
  sku_snapshot text NOT NULL,
  unit_snapshot text NOT NULL,
  quantity_ordered numeric(14,3) NOT NULL CHECK (quantity_ordered > 0),
  quantity_received numeric(14,3) NOT NULL DEFAULT 0 CHECK (quantity_received >= 0 AND quantity_received <= quantity_ordered),
  unit_cost_vnd bigint NOT NULL CHECK (unit_cost_vnd >= 0),
  line_total_vnd bigint NOT NULL CHECK (line_total_vnd >= 0),
  UNIQUE (store_id, id),
  FOREIGN KEY (store_id, purchase_id) REFERENCES purchases(store_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (store_id, product_id) REFERENCES products(store_id, id) ON DELETE RESTRICT
);

CREATE TABLE inventory_balances (
  store_id uuid NOT NULL,
  product_id uuid NOT NULL,
  on_hand numeric(14,3) NOT NULL DEFAULT 0 CHECK (on_hand >= 0),
  reserved numeric(14,3) NOT NULL DEFAULT 0 CHECK (reserved >= 0 AND reserved <= on_hand),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id, product_id),
  FOREIGN KEY (store_id, product_id) REFERENCES products(store_id, id) ON DELETE RESTRICT
);

CREATE TABLE inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  product_id uuid NOT NULL,
  movement_type text NOT NULL CHECK (movement_type IN ('opening', 'sale', 'return', 'purchase_receipt', 'count', 'adjustment', 'transfer_in', 'transfer_out', 'reversal')),
  quantity_delta numeric(14,3) NOT NULL CHECK (quantity_delta <> 0),
  quantity_after numeric(14,3) NOT NULL CHECK (quantity_after >= 0),
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 500),
  source_type text,
  source_id uuid,
  actor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, id),
  FOREIGN KEY (store_id, product_id) REFERENCES products(store_id, id) ON DELETE RESTRICT
);

CREATE INDEX inventory_movements_product_idx ON inventory_movements (store_id, product_id, occurred_at DESC);
CREATE INDEX inventory_movements_source_idx ON inventory_movements (store_id, source_type, source_id);

CREATE TABLE customer_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  entry_type text NOT NULL CHECK (entry_type IN ('sale_debit', 'payment_credit', 'return_credit', 'manual_credit', 'manual_debit', 'reversal')),
  debit_vnd bigint NOT NULL DEFAULT 0 CHECK (debit_vnd >= 0),
  credit_vnd bigint NOT NULL DEFAULT 0 CHECK (credit_vnd >= 0),
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  note text NOT NULL DEFAULT '',
  actor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, id),
  FOREIGN KEY (store_id, customer_id) REFERENCES customers(store_id, id) ON DELETE RESTRICT,
  CHECK ((debit_vnd > 0) <> (credit_vnd > 0))
);

CREATE INDEX customer_ledger_customer_idx ON customer_ledger_entries (store_id, customer_id, occurred_at DESC);

CREATE TABLE supplier_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  supplier_id uuid NOT NULL,
  entry_type text NOT NULL CHECK (entry_type IN ('purchase_credit', 'payment_debit', 'manual_credit', 'manual_debit', 'reversal')),
  increases_payable_vnd bigint NOT NULL DEFAULT 0 CHECK (increases_payable_vnd >= 0),
  decreases_payable_vnd bigint NOT NULL DEFAULT 0 CHECK (decreases_payable_vnd >= 0),
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  note text NOT NULL DEFAULT '',
  actor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, id),
  FOREIGN KEY (store_id, supplier_id) REFERENCES suppliers(store_id, id) ON DELETE RESTRICT,
  CHECK ((increases_payable_vnd > 0) <> (decreases_payable_vnd > 0))
);

CREATE INDEX supplier_ledger_supplier_idx ON supplier_ledger_entries (store_id, supplier_id, occurred_at DESC);

CREATE TABLE cash_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('in', 'out')),
  category text NOT NULL,
  amount_vnd bigint NOT NULL CHECK (amount_vnd > 0),
  method text NOT NULL CHECK (method IN ('cash', 'bank_transfer', 'bank_qr', 'card', 'other')),
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  note text NOT NULL DEFAULT '',
  actor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX cash_movements_store_date_idx ON cash_movements (store_id, occurred_at DESC);

CREATE TABLE idempotency_records (
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  actor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 16 AND 200),
  request_hash bytea NOT NULL,
  response_status smallint,
  response_body jsonb,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id, actor_user_id, idempotency_key)
);

CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  actor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (length(action) BETWEEN 1 AND 100),
  entity_type text NOT NULL CHECK (length(entity_type) BETWEEN 1 AND 80),
  entity_id uuid NOT NULL,
  reason text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_events_store_entity_idx ON audit_events (store_id, entity_type, entity_id, occurred_at DESC);
CREATE INDEX audit_events_store_actor_idx ON audit_events (store_id, actor_user_id, occurred_at DESC);

CREATE FUNCTION reject_history_mutation() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'History records are append-only; write a reversing or adjustment record instead.';
END;
$$;

CREATE TRIGGER product_cost_history_append_only
  BEFORE UPDATE OR DELETE ON product_cost_history
  FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
CREATE TRIGGER inventory_movements_append_only
  BEFORE UPDATE OR DELETE ON inventory_movements
  FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
CREATE TRIGGER customer_ledger_append_only
  BEFORE UPDATE OR DELETE ON customer_ledger_entries
  FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
CREATE TRIGGER supplier_ledger_append_only
  BEFORE UPDATE OR DELETE ON supplier_ledger_entries
  FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
CREATE TRIGGER cash_movements_append_only
  BEFORE UPDATE OR DELETE ON cash_movements
  FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
CREATE TRIGGER audit_events_append_only
  BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();

DO $$
DECLARE
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'store_sequences', 'products', 'product_cost_history',
    'customers', 'suppliers', 'orders', 'order_lines', 'payments', 'returns',
    'return_lines', 'refunds', 'purchases', 'purchase_lines',
    'inventory_balances', 'inventory_movements', 'customer_ledger_entries',
    'supplier_ledger_entries', 'cash_movements', 'idempotency_records', 'audit_events'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', target_table);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', target_table);
    EXECUTE format(
      'CREATE POLICY tenant_scope ON %I USING (store_id = NULLIF(current_setting(''app.store_id'', true), '''')::uuid) WITH CHECK (store_id = NULLIF(current_setting(''app.store_id'', true), '''')::uuid)',
      target_table
    );
  END LOOP;
END;
$$;

ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY membership_scope ON memberships
  USING (
    user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    OR store_id = NULLIF(current_setting('app.store_id', true), '')::uuid
  )
  WITH CHECK (store_id = NULLIF(current_setting('app.store_id', true), '')::uuid);

ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON stores
  USING (id = NULLIF(current_setting('app.store_id', true), '')::uuid)
  WITH CHECK (id = NULLIF(current_setting('app.store_id', true), '')::uuid);

CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  checksum text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
