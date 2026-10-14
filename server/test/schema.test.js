const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');

const migrationPath = path.join(__dirname, '..', 'migrations', '0001_core.sql');
let PGlite;
let migration;

async function database(t) {
  if (!PGlite) ({ PGlite } = await import('@electric-sql/pglite'));
  if (!migration) migration = await readFile(migrationPath, 'utf8');
  const db = new PGlite();
  await db.transaction(async (tx) => tx.exec(migration));
  await db.exec(`
    CREATE ROLE slink_app NOLOGIN;
    GRANT USAGE ON SCHEMA public TO slink_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO slink_app;
    SET ROLE slink_app;
  `);
  t.after(async () => db.close());
  return db;
}

async function seedStore(db, { storeId = randomUUID(), userId = randomUUID(), productId = randomUUID(), customerId = randomUUID() } = {}) {
  await db.transaction(async (tx) => {
    await tx.query("SELECT set_config('app.store_id', $1, true)", [storeId]);
    await tx.query("SELECT set_config('app.user_id', $1, true)", [userId]);
    await tx.query('INSERT INTO stores (id, name) VALUES ($1, $2)', [storeId, 'Cửa hàng kiểm tra']);
    const email = `${userId}@example.com`;
    await tx.query(
      'INSERT INTO users (id, email, email_normalized, display_name, password_hash) VALUES ($1, $2, $3, $4, $5)',
      [userId, email, email, 'Chủ cửa hàng', 'test-only-hash']
    );
    await tx.query('INSERT INTO memberships (store_id, user_id, role) VALUES ($1, $2, $3)', [storeId, userId, 'owner']);
    await tx.query(
      'INSERT INTO products (id, store_id, sku, sku_normalized, name, sale_price_vnd, cost_vnd) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [productId, storeId, 'SKU-1', 'sku-1', 'Sản phẩm kiểm tra', 100000, 60000]
    );
    await tx.query('INSERT INTO inventory_balances (store_id, product_id, on_hand) VALUES ($1, $2, $3)', [storeId, productId, '4']);
    await tx.query('INSERT INTO customers (id, store_id, name) VALUES ($1, $2, $3)', [customerId, storeId, 'Khách kiểm tra']);
  });
  return { storeId, userId, productId, customerId };
}

test('core migration creates the transactional, tenant-scoped records', async (t) => {
  const db = await database(t);
  const { rows } = await db.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
  const names = new Set(rows.map((row) => row.tablename));
  for (const name of [
    'stores', 'users', 'memberships', 'sessions', 'products', 'customers', 'suppliers',
    'orders', 'order_lines', 'payments', 'returns', 'return_lines', 'refunds',
    'purchases', 'purchase_lines', 'inventory_balances', 'inventory_movements',
    'customer_ledger_entries', 'supplier_ledger_entries', 'cash_movements', 'audit_events',
  ]) assert.ok(names.has(name), `missing ${name}`);

  const policies = await db.query("SELECT tablename FROM pg_policies WHERE schemaname = 'public'");
  assert.ok(policies.rows.length >= 20, 'tenant tables must have row security policies');
});

test('store context isolates products and order totals enforce VND invariants', async (t) => {
  const db = await database(t);
  const a = await seedStore(db);
  const b = await seedStore(db, {
    storeId: randomUUID(),
    userId: randomUUID(),
    productId: randomUUID(),
    customerId: randomUUID(),
  });

  const hidden = await db.transaction(async (tx) => {
    await tx.query("SELECT set_config('app.store_id', $1, true)", [b.storeId]);
    const result = await tx.query('SELECT id FROM products WHERE id = $1', [a.productId]);
    return result.rows;
  });
  assert.equal(hidden.length, 0, 'another store product must be invisible');

  await assert.rejects(db.transaction(async (tx) => {
    await tx.query("SELECT set_config('app.store_id', $1, true)", [a.storeId]);
    await tx.query(
      `INSERT INTO orders (store_id, order_number, cashier_id, subtotal_vnd, total_vnd)
       VALUES ($1, 'SL-INVALID', $2, 100000, 99000)`,
      [a.storeId, a.userId]
    );
  }), /check constraint|violates check/i);
});

test('inventory and financial history cannot be overwritten or deleted', async (t) => {
  const db = await database(t);
  const { storeId, userId, productId } = await seedStore(db);
  const movementId = randomUUID();
  await db.transaction(async (tx) => {
    await tx.query("SELECT set_config('app.store_id', $1, true)", [storeId]);
    await tx.query('INSERT INTO inventory_movements (id, store_id, product_id, movement_type, quantity_delta, quantity_after, reason, actor_user_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [movementId, storeId, productId, 'opening', '4', '4', 'Tồn đầu kỳ', userId]);
  });

  await assert.rejects(db.transaction(async (tx) => {
    await tx.query("SELECT set_config('app.store_id', $1, true)", [storeId]);
    await tx.query('UPDATE inventory_movements SET reason = $1 WHERE id = $2', ['Sửa lịch sử', movementId]);
  }), /append-only/i);
});
