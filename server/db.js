const { Pool } = require('pg');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class DatabaseError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = 'DatabaseError';
    this.statusCode = statusCode;
  }
}

function createPool(env = process.env) {
  if (!env.APP_DATABASE_URL) throw new Error('APP_DATABASE_URL is required for the application runtime.');
  return new Pool({
    connectionString: env.APP_DATABASE_URL,
    max: Number(env.DB_POOL_MAX || 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: env.PG_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
    application_name: 'slink-api',
  });
}

async function withUser(pool, userId, operation) {
  if (!UUID_PATTERN.test(String(userId || ''))) throw new DatabaseError('Phiên đăng nhập không hợp lệ.', 401);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function withStore(pool, userId, storeId, operation) {
  if (!UUID_PATTERN.test(String(userId || '')) || !UUID_PATTERN.test(String(storeId || ''))) {
    throw new DatabaseError('Cửa hàng hoặc phiên đăng nhập không hợp lệ.', 401);
  }
  return withUser(pool, userId, async (client) => {
    await client.query("SELECT set_config('app.store_id', $1, true)", [storeId]);
    const membership = await client.query(
      `SELECT m.role, s.name AS store_name, s.status AS store_status, s.timezone
       FROM memberships m
       JOIN stores s ON s.id = m.store_id
       WHERE m.store_id = $1 AND m.user_id = $2 AND m.status = 'active' AND s.status = 'active'`,
      [storeId, userId]
    );
    if (!membership.rowCount) throw new DatabaseError('Bạn không có quyền truy cập cửa hàng này.', 403);
    return operation(client, membership.rows[0]);
  });
}

async function listStores(pool, userId) {
  return withUser(pool, userId, async (client) => {
    const memberships = await client.query(
      `SELECT store_id, role FROM memberships WHERE user_id = $1 AND status = 'active' ORDER BY joined_at, created_at`,
      [userId]
    );
    const stores = [];
    for (const member of memberships.rows) {
      await client.query("SELECT set_config('app.store_id', $1, true)", [member.store_id]);
      const store = await client.query(
        `SELECT id, name, phone, address, receipt_footer, version, timezone, currency FROM stores WHERE id = $1 AND status = 'active'`,
        [member.store_id]
      );
      if (store.rowCount) stores.push({ ...store.rows[0], role: member.role });
    }
    return stores;
  });
}

module.exports = { DatabaseError, UUID_PATTERN, createPool, listStores, withStore, withUser };
