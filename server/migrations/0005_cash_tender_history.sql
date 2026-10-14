ALTER TABLE orders
  ADD COLUMN cash_received_vnd bigint NOT NULL DEFAULT 0 CHECK (cash_received_vnd >= 0),
  ADD COLUMN cash_change_vnd bigint NOT NULL DEFAULT 0 CHECK (cash_change_vnd >= 0 AND cash_change_vnd <= cash_received_vnd);

-- Prior orders did not retain the cash tendered or change separately. Backfill
-- the best available cash receipt from payment rows; historical change stays 0.
UPDATE orders o
SET cash_received_vnd = COALESCE((
  SELECT SUM(p.amount_vnd)
  FROM payments p
  WHERE p.store_id = o.store_id AND p.order_id = o.id AND p.status = 'succeeded' AND p.method = 'cash'
), 0);
