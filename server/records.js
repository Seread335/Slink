'use strict';

const { createHash, randomUUID } = require('node:crypto');
const { ApiError, authenticate, requireCsrf } = require('./auth');
const { UUID_PATTERN, withStore } = require('./db');

const EDIT_CUSTOMER_ROLES = new Set(['owner', 'manager', 'cashier']);
const CREATE_CUSTOMER_ROLES = new Set(['owner', 'manager', 'cashier', 'accountant']);
const CUSTOMER_VIEW_ROLES = new Set(['owner', 'manager', 'cashier', 'accountant']);
const ORDER_VIEW_ROLES = new Set(['owner', 'manager', 'cashier', 'accountant']);
const OPENING_BALANCE_ROLES = new Set(['owner', 'manager', 'accountant']);
const VOID_ORDER_ROLES = new Set(['owner', 'manager']);
const MAX_BIGINT = 9223372036854775807n;

function nonNegativeVnd(value, label) {
  if (value === undefined || value === null || value === '') return 0n;
  const text = typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : value;
  if (typeof text !== 'string' || !/^(0|[1-9]\d{0,18})$/.test(text)) {
    throw new ApiError(400, 'validation_error', `${label} phải là VND nguyên không âm.`);
  }
  const amount = BigInt(text);
  if (amount > MAX_BIGINT) throw new ApiError(400, 'validation_error', `${label} vượt giới hạn lưu trữ.`);
  return amount;
}

function validateCustomer(input, { partial = false } = {}) {
  const source = input || {};
  const values = {};
  if (!partial || source.name !== undefined) {
    const name = typeof source.name === 'string' ? source.name.trim() : '';
    if (name.length < 1 || name.length > 160) throw new ApiError(400, 'validation_error', 'Tên khách hàng cần từ 1 đến 160 ký tự.');
    values.name = name;
  }
  if (!partial || source.phone !== undefined) {
    const phone = source.phone == null ? '' : String(source.phone).trim();
    const normalized = phone.replace(/\D/g, '');
    if (phone && (normalized.length < 7 || normalized.length > 15)) throw new ApiError(400, 'validation_error', 'Số điện thoại cần có từ 7 đến 15 chữ số.');
    values.phone = phone || null;
    values.phoneNormalized = normalized || null;
  }
  if (!partial || source.email !== undefined) {
    const email = source.email == null ? '' : String(source.email).trim();
    if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new ApiError(400, 'validation_error', 'Email khách hàng không hợp lệ.');
    values.email = email || null;
  }
  if (!partial || source.note !== undefined) {
    const note = typeof source.note === 'string' ? source.note.trim() : '';
    if (note.length > 1000) throw new ApiError(400, 'validation_error', 'Ghi chú tối đa 1.000 ký tự.');
    values.note = note;
  }
  return values;
}

function pageArgs(query) {
  const limit = Math.min(Math.max(Number.parseInt(query?.limit || '50', 10) || 50, 1), 100);
  const offset = Math.min(Math.max(Number.parseInt(query?.offset || '0', 10) || 0, 0), 10000);
  const search = typeof query?.q === 'string' ? query.q.trim().slice(0, 120) : '';
  return { limit, offset, search };
}

function registerRecordRoutes(app, { pool, env }) {
  app.get('/api/stores/:storeId/customers', async (request) => {
    const auth = await authenticate(pool, request);
    const { storeId } = request.params;
    if (!UUID_PATTERN.test(storeId)) throw new ApiError(400, 'validation_error', 'Cửa hàng không hợp lệ.');
    const { limit, offset, search } = pageArgs(request.query);
    const phoneSearch = search.replace(/\D/g, '');
    return withStore(pool, auth.userId, storeId, async (client, membership) => {
      if (!CUSTOMER_VIEW_ROLES.has(membership.role)) throw new ApiError(403, 'forbidden', 'Tài khoản này không có quyền xem hồ sơ khách hàng.');
      const result = await client.query(
        `SELECT c.id, c.name, c.phone, c.email, c.note, c.status, c.version,
                COALESCE((SELECT SUM(l.debit_vnd - l.credit_vnd) FROM customer_ledger_entries l
                          WHERE l.store_id = c.store_id AND l.customer_id = c.id), 0)::text AS balance_vnd,
                COALESCE((SELECT COUNT(*) FROM orders o WHERE o.store_id = c.store_id AND o.customer_id = c.id AND o.status <> 'voided'), 0)::int AS order_count,
                COALESCE((SELECT SUM(o.total_vnd - COALESCE((SELECT SUM(r.refund_total_vnd) FROM returns r
                           WHERE r.store_id = o.store_id AND r.order_id = o.id AND r.status = 'completed'), 0))
                          FROM orders o WHERE o.store_id = c.store_id AND o.customer_id = c.id AND o.status <> 'voided'), 0)::text AS total_spent_vnd,
                c.created_at, c.updated_at, COUNT(*) OVER()::int AS total_count
         FROM customers c
         WHERE c.store_id = $1 AND c.status = 'active'
           AND ($2 = '' OR c.name ILIKE '%' || $2 || '%' OR ($3 <> '' AND COALESCE(c.phone_normalized, '') LIKE '%' || $3 || '%'))
         ORDER BY c.name, c.id LIMIT $4 OFFSET $5`,
        [storeId, search, phoneSearch, limit + 1, offset]
      );
      const hasMore = result.rows.length > limit;
      return { customers: result.rows.slice(0, limit), total: Number(result.rows[0]?.total_count || 0), nextOffset: hasMore ? offset + limit : null };
    });
  });

  app.get('/api/stores/:storeId/customers/:customerId', async (request) => {
    const auth = await authenticate(pool, request);
    const { storeId, customerId } = request.params;
    if (!UUID_PATTERN.test(storeId) || !UUID_PATTERN.test(customerId)) throw new ApiError(400, 'validation_error', 'Cửa hàng hoặc khách hàng không hợp lệ.');
    return withStore(pool, auth.userId, storeId, async (client, membership) => {
      if (!CUSTOMER_VIEW_ROLES.has(membership.role)) throw new ApiError(403, 'forbidden', 'Tài khoản này không có quyền xem hồ sơ khách hàng.');
      const customerResult = await client.query(
        `SELECT c.id, c.name, c.phone, c.email, c.note, c.status, c.version, c.created_at,
                COALESCE((SELECT SUM(l.debit_vnd - l.credit_vnd) FROM customer_ledger_entries l
                          WHERE l.store_id = c.store_id AND l.customer_id = c.id), 0)::text AS balance_vnd,
                COALESCE((SELECT COUNT(*) FROM orders o WHERE o.store_id = c.store_id AND o.customer_id = c.id AND o.status <> 'voided'), 0)::int AS order_count,
                COALESCE((SELECT SUM(o.total_vnd - COALESCE((SELECT SUM(r.refund_total_vnd) FROM returns r
                           WHERE r.store_id = o.store_id AND r.order_id = o.id AND r.status = 'completed'), 0))
                          FROM orders o WHERE o.store_id = c.store_id AND o.customer_id = c.id AND o.status <> 'voided'), 0)::text AS total_spent_vnd
         FROM customers c WHERE c.store_id = $1 AND c.id = $2 AND c.status = 'active'`,
        [storeId, customerId]
      );
      if (!customerResult.rowCount) throw new ApiError(404, 'customer_not_found', 'Không tìm thấy khách hàng đang hoạt động.');
      const orders = await client.query(
        `SELECT o.id, o.order_number, o.customer_id, o.status,
                o.subtotal_vnd::text AS subtotal_vnd, o.discount_vnd::text AS discount_vnd,
                o.total_vnd::text AS total_vnd, o.note, o.occurred_at,
                COALESCE((SELECT SUM(p.amount_vnd) FROM payments p WHERE p.store_id = o.store_id AND p.order_id = o.id AND p.status = 'succeeded'), 0)::text AS paid_vnd,
                COALESCE((SELECT SUM(f.amount_vnd) FROM refunds f JOIN returns r ON r.id = f.return_id
                          WHERE r.store_id = o.store_id AND r.order_id = o.id AND r.status = 'completed' AND f.status = 'succeeded'), 0)::text AS refunded_vnd,
                COALESCE((SELECT SUM(r.refund_total_vnd) FROM returns r WHERE r.store_id = o.store_id AND r.order_id = o.id AND r.status = 'completed'), 0)::text AS return_total_vnd,
                COALESCE((SELECT COUNT(*) FROM order_lines l WHERE l.store_id = o.store_id AND l.order_id = o.id), 0)::int AS line_count
         FROM orders o
         WHERE o.store_id = $1 AND o.customer_id = $2
         ORDER BY o.occurred_at DESC, o.id DESC LIMIT 5`,
        [storeId, customerId]
      );
      return { customer: customerResult.rows[0], recentOrders: orders.rows };
    });
  });

  app.post('/api/stores/:storeId/customers', async (request, reply) => {
    const auth = await authenticate(pool, request);
    requireCsrf(request, env);
    const { storeId } = request.params;
    if (!UUID_PATTERN.test(storeId)) throw new ApiError(400, 'validation_error', 'Cửa hàng không hợp lệ.');
    const customer = validateCustomer(request.body);
    const openingBalance = nonNegativeVnd(request.body?.openingBalanceVnd, 'Công nợ ban đầu');
    const idempotencyKey = request.headers['idempotency-key'];
    if (idempotencyKey !== undefined && (typeof idempotencyKey !== 'string' || idempotencyKey.length < 16 || idempotencyKey.length > 200)) {
      throw new ApiError(400, 'idempotency_key_invalid', 'Mã lưu khách hàng không hợp lệ. Hãy thử lại.');
    }
    if (openingBalance > 0n && !idempotencyKey) throw new ApiError(400, 'idempotency_key_required', 'Thiếu mã lưu an toàn cho khoản công nợ ban đầu. Hãy thử lại.');
    const value = { customer, openingBalanceVnd: openingBalance.toString() };
    const requestHash = idempotencyKey ? createHash('sha256').update(JSON.stringify(value)).digest() : null;
    const outcome = await withStore(pool, auth.userId, storeId, async (client, membership) => {
      if (!CREATE_CUSTOMER_ROLES.has(membership.role)) throw new ApiError(403, 'forbidden', 'Tài khoản này không có quyền tạo khách hàng.');
      if (openingBalance > 0n && !OPENING_BALANCE_ROLES.has(membership.role)) {
        throw new ApiError(403, 'forbidden', 'Chỉ chủ cửa hàng, quản lý hoặc kế toán được ghi công nợ ban đầu.');
      }
      if (idempotencyKey) {
        const reserved = await client.query(
          `INSERT INTO idempotency_records (store_id, actor_user_id, idempotency_key, request_hash)
           VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING RETURNING idempotency_key`,
          [storeId, auth.userId, idempotencyKey, requestHash]
        );
        if (!reserved.rowCount) {
          const previous = await client.query(
            `SELECT request_hash, response_status, response_body FROM idempotency_records
             WHERE store_id = $1 AND actor_user_id = $2 AND idempotency_key = $3 FOR UPDATE`,
            [storeId, auth.userId, idempotencyKey]
          );
          const record = previous.rows[0];
          if (!record || !Buffer.from(record.request_hash).equals(requestHash)) throw new ApiError(409, 'idempotency_conflict', 'Mã lưu khách hàng đã được dùng cho nội dung khác.');
          if (!record.response_body || !record.response_status) throw new ApiError(409, 'request_in_progress', 'Hồ sơ khách hàng đang được lưu. Hãy thử lại sau.');
          return { status: record.response_status, body: record.response_body, replayed: true };
        }
      }
      const inserted = await client.query(
        `INSERT INTO customers (store_id, name, phone, phone_normalized, email, note, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, name, phone, email, note, status, version, created_at, updated_at`,
        [storeId, customer.name, customer.phone, customer.phoneNormalized, customer.email, customer.note, auth.userId]
      );
      const created = inserted.rows[0];
      let openingBalanceEntryId = null;
      if (openingBalance > 0n) {
        openingBalanceEntryId = randomUUID();
        await client.query(
          `INSERT INTO customer_ledger_entries (id, store_id, customer_id, entry_type, debit_vnd, source_type, source_id, note, actor_user_id)
           VALUES ($1, $2, $3, 'manual_debit', $4, 'opening_balance', $5, 'Số dư phải thu mở đầu trước khi sử dụng Slink', $6)`,
          [openingBalanceEntryId, storeId, created.id, openingBalance.toString(), openingBalanceEntryId, auth.userId]
        );
      }
      await client.query(
        `INSERT INTO audit_events (store_id, actor_user_id, action, entity_type, entity_id, metadata)
         VALUES ($1, $2, 'customer.created', 'customer', $3, jsonb_build_object('name', $4::text))`,
        [storeId, auth.userId, created.id, created.name]
      );
      if (openingBalanceEntryId) {
        await client.query(
          `INSERT INTO audit_events (store_id, actor_user_id, action, entity_type, entity_id, reason, metadata)
           VALUES ($1, $2, 'customer.opening_balance_recorded', 'customer', $3, 'Số dư công nợ mở đầu', jsonb_build_object('amountVnd', $4::text, 'ledgerEntryId', $5::text))`,
          [storeId, auth.userId, created.id, openingBalance.toString(), openingBalanceEntryId]
        );
      }
      const body = { customer: { ...created, balance_vnd: openingBalance.toString(), order_count: 0, total_spent_vnd: '0' } };
      if (idempotencyKey) {
        await client.query(
          `UPDATE idempotency_records SET response_status = 201, response_body = $4::jsonb, completed_at = now()
           WHERE store_id = $1 AND actor_user_id = $2 AND idempotency_key = $3`,
          [storeId, auth.userId, idempotencyKey, JSON.stringify(body)]
        );
      }
      return { status: 201, body, replayed: false };
    });
    if (outcome.replayed) reply.header('idempotent-replayed', 'true');
    return reply.code(outcome.status).send(outcome.body);
  });

  app.put('/api/stores/:storeId/customers/:customerId', async (request) => {
    const auth = await authenticate(pool, request);
    requireCsrf(request, env);
    const { storeId, customerId } = request.params;
    if (!UUID_PATTERN.test(storeId) || !UUID_PATTERN.test(customerId)) throw new ApiError(400, 'validation_error', 'Cửa hàng hoặc khách hàng không hợp lệ.');
    const expectedVersion = request.body?.version;
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) throw new ApiError(400, 'validation_error', 'Phiên bản hồ sơ không hợp lệ. Hãy tải lại rồi thử lại.');
    const fields = validateCustomer(request.body, { partial: true });
    return withStore(pool, auth.userId, storeId, async (client, membership) => {
      if (!EDIT_CUSTOMER_ROLES.has(membership.role)) throw new ApiError(403, 'forbidden', 'Tài khoản này không có quyền quản lý khách hàng.');
      const currentResult = await client.query('SELECT * FROM customers WHERE store_id = $1 AND id = $2 FOR UPDATE', [storeId, customerId]);
      if (!currentResult.rowCount || currentResult.rows[0].status !== 'active') throw new ApiError(404, 'customer_not_found', 'Không tìm thấy khách hàng đang hoạt động.');
      const current = currentResult.rows[0];
      if (current.version !== expectedVersion) throw new ApiError(409, 'version_conflict', 'Hồ sơ đã được thay đổi trên thiết bị khác. Hãy tải lại rồi thử lại.');
      const next = {
        name: fields.name ?? current.name,
        phone: fields.phone !== undefined ? fields.phone : current.phone,
        phoneNormalized: fields.phoneNormalized !== undefined ? fields.phoneNormalized : current.phone_normalized,
        email: fields.email !== undefined ? fields.email : current.email,
        note: fields.note ?? current.note,
      };
      const updated = await client.query(
        `UPDATE customers SET name = $3, phone = $4, phone_normalized = $5, email = $6, note = $7,
             version = version + 1, updated_at = now()
         WHERE store_id = $1 AND id = $2 AND version = $8
         RETURNING id, name, phone, email, note, status, version, updated_at`,
        [storeId, customerId, next.name, next.phone, next.phoneNormalized, next.email, next.note, expectedVersion]
      );
      await client.query(
        `INSERT INTO audit_events (store_id, actor_user_id, action, entity_type, entity_id, metadata)
         VALUES ($1, $2, 'customer.updated', 'customer', $3, jsonb_build_object('version', $4::integer))`,
        [storeId, auth.userId, customerId, updated.rows[0].version]
      );
      return { customer: updated.rows[0] };
    });
  });

  app.post('/api/stores/:storeId/customers/:customerId/archive', async (request) => {
    const auth = await authenticate(pool, request);
    requireCsrf(request, env);
    const { storeId, customerId } = request.params;
    if (!UUID_PATTERN.test(storeId) || !UUID_PATTERN.test(customerId)) throw new ApiError(400, 'validation_error', 'Cửa hàng hoặc khách hàng không hợp lệ.');
    const expectedVersion = request.body?.version;
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) throw new ApiError(400, 'validation_error', 'Phiên bản hồ sơ không hợp lệ.');
    return withStore(pool, auth.userId, storeId, async (client, membership) => {
      if (!EDIT_CUSTOMER_ROLES.has(membership.role)) throw new ApiError(403, 'forbidden', 'Tài khoản này không có quyền quản lý khách hàng.');
      const updated = await client.query(
        `UPDATE customers SET status = 'archived', version = version + 1, updated_at = now()
         WHERE store_id = $1 AND id = $2 AND status = 'active' AND version = $3
         RETURNING id, name, status, version`,
        [storeId, customerId, expectedVersion]
      );
      if (!updated.rowCount) throw new ApiError(409, 'version_conflict', 'Khách hàng đã thay đổi hoặc đã được lưu trữ. Hãy tải lại danh sách.');
      await client.query(
        `INSERT INTO audit_events (store_id, actor_user_id, action, entity_type, entity_id)
         VALUES ($1, $2, 'customer.archived', 'customer', $3)`,
        [storeId, auth.userId, customerId]
      );
      return { customer: updated.rows[0] };
    });
  });

  app.get('/api/stores/:storeId/orders', async (request) => {
    const auth = await authenticate(pool, request);
    const { storeId } = request.params;
    if (!UUID_PATTERN.test(storeId)) throw new ApiError(400, 'validation_error', 'Cửa hàng không hợp lệ.');
    const { limit, offset, search } = pageArgs(request.query);
    const phoneSearch = search.replace(/\D/g, '');
    return withStore(pool, auth.userId, storeId, async (client, membership) => {
      if (!ORDER_VIEW_ROLES.has(membership.role)) throw new ApiError(403, 'forbidden', 'Tài khoản này không có quyền xem đơn hàng.');
      const result = await client.query(
        `SELECT o.id, o.order_number, o.customer_id, c.name AS customer_name, c.phone AS customer_phone,
                o.status, o.subtotal_vnd::text AS subtotal_vnd, o.discount_vnd::text AS discount_vnd,
                o.total_vnd::text AS total_vnd, o.note, o.occurred_at,
                COALESCE((SELECT SUM(p.amount_vnd) FROM payments p WHERE p.store_id = o.store_id AND p.order_id = o.id AND p.status = 'succeeded'), 0)::text AS paid_vnd,
                COALESCE((SELECT SUM(f.amount_vnd) FROM refunds f JOIN returns r ON r.id = f.return_id
                          WHERE r.store_id = o.store_id AND r.order_id = o.id AND r.status = 'completed' AND f.status = 'succeeded'), 0)::text AS refunded_vnd,
                COALESCE((SELECT SUM(r.refund_total_vnd) FROM returns r WHERE r.store_id = o.store_id AND r.order_id = o.id AND r.status = 'completed'), 0)::text AS return_total_vnd,
                COALESCE((SELECT COUNT(*) FROM order_lines l WHERE l.store_id = o.store_id AND l.order_id = o.id), 0)::int AS line_count,
                COUNT(*) OVER()::int AS total_count
         FROM orders o LEFT JOIN customers c ON c.store_id = o.store_id AND c.id = o.customer_id
         WHERE o.store_id = $1
           AND ($2 = '' OR o.order_number ILIKE '%' || $2 || '%' OR c.name ILIKE '%' || $2 || '%' OR ($3 <> '' AND COALESCE(c.phone_normalized, '') LIKE '%' || $3 || '%'))
         ORDER BY o.occurred_at DESC, o.id DESC LIMIT $4 OFFSET $5`,
        [storeId, search, phoneSearch, limit + 1, offset]
      );
      const hasMore = result.rows.length > limit;
      return { orders: result.rows.slice(0, limit), total: Number(result.rows[0]?.total_count || 0), nextOffset: hasMore ? offset + limit : null };
    });
  });

  app.get('/api/stores/:storeId/orders/:orderId', async (request) => {
    const auth = await authenticate(pool, request);
    const { storeId, orderId } = request.params;
    if (!UUID_PATTERN.test(storeId) || !UUID_PATTERN.test(orderId)) throw new ApiError(400, 'validation_error', 'Cửa hàng hoặc đơn hàng không hợp lệ.');
    return withStore(pool, auth.userId, storeId, async (client, membership) => {
      if (!ORDER_VIEW_ROLES.has(membership.role)) throw new ApiError(403, 'forbidden', 'Tài khoản này không có quyền xem đơn hàng.');
      const order = await client.query(
        `SELECT o.*, o.subtotal_vnd::text AS subtotal_vnd_text, o.discount_vnd::text AS discount_vnd_text,
                o.total_vnd::text AS total_vnd_text, o.cash_received_vnd::text AS cash_received_vnd_text,
                o.cash_change_vnd::text AS cash_change_vnd_text, c.name AS customer_name, c.phone AS customer_phone,
                u.display_name AS cashier_name
         FROM orders o LEFT JOIN customers c ON c.store_id = o.store_id AND c.id = o.customer_id
         JOIN users u ON u.id = o.cashier_id
         WHERE o.store_id = $1 AND o.id = $2`,
        [storeId, orderId]
      );
      if (!order.rowCount) throw new ApiError(404, 'order_not_found', 'Không tìm thấy đơn hàng.');
      const lines = await client.query(
        `SELECT ol.id, ol.product_id, ol.product_name_snapshot, ol.sku_snapshot, ol.unit_snapshot, ol.quantity::text AS quantity,
                ol.unit_price_vnd::text AS unit_price_vnd,
                CASE WHEN $3::boolean THEN ol.unit_cost_vnd::text ELSE NULL END AS unit_cost_vnd,
                ol.discount_vnd::text AS discount_vnd, ol.line_total_vnd::text AS line_total_vnd,
                COALESCE((SELECT SUM(rl.quantity) FROM return_lines rl JOIN returns r ON r.id = rl.return_id
                          WHERE rl.store_id = ol.store_id AND rl.order_line_id = ol.id AND r.status = 'completed'), 0)::text AS returned_quantity
         FROM order_lines ol WHERE ol.store_id = $1 AND ol.order_id = $2 ORDER BY ol.id`,
        [storeId, orderId, ['owner', 'manager', 'accountant'].includes(membership.role)]
      );
      const payments = await client.query(
        `SELECT id, method, status, amount_vnd::text AS amount_vnd, provider_reference, occurred_at
         FROM payments WHERE store_id = $1 AND order_id = $2 ORDER BY occurred_at, id`,
        [storeId, orderId]
      );
      const returns = await client.query(
        `SELECT r.id, r.return_number, r.status, r.reason, r.refund_total_vnd::text AS refund_total_vnd,
                r.restock_policy, r.occurred_at,
                COALESCE((SELECT SUM(f.amount_vnd) FROM refunds f WHERE f.store_id = r.store_id AND f.return_id = r.id AND f.status = 'succeeded'), 0)::text AS refunded_vnd
         FROM returns r WHERE r.store_id = $1 AND r.order_id = $2 ORDER BY r.occurred_at, r.id`,
        [storeId, orderId]
      );
      const item = order.rows[0];
      return {
        order: {
          id: item.id,
          number: item.order_number,
          customerId: item.customer_id,
          customerName: item.customer_name,
          customerPhone: item.customer_phone,
          cashierName: item.cashier_name,
          status: item.status,
          subtotalVnd: item.subtotal_vnd_text,
          discountVnd: item.discount_vnd_text,
          totalVnd: item.total_vnd_text,
          cashReceivedVnd: item.cash_received_vnd_text,
          cashChangeVnd: item.cash_change_vnd_text,
          note: item.note,
          occurredAt: item.occurred_at,
          items: lines.rows,
          payments: payments.rows,
          returns: returns.rows,
        },
      };
    });
  });

  app.post('/api/stores/:storeId/orders/:orderId/void', async (request) => {
    const auth = await authenticate(pool, request);
    requireCsrf(request, env);
    const { storeId, orderId } = request.params;
    if (!UUID_PATTERN.test(storeId) || !UUID_PATTERN.test(orderId)) throw new ApiError(400, 'validation_error', 'Cửa hàng hoặc đơn hàng không hợp lệ.');
    const reason = typeof request.body?.reason === 'string' ? request.body.reason.trim() : '';
    if (reason.length < 1 || reason.length > 450) throw new ApiError(400, 'validation_error', 'Lý do hủy cần từ 1 đến 450 ký tự.');
    if (request.body?.stockConfirmed !== true) throw new ApiError(400, 'stock_confirmation_required', 'Xác nhận hàng chưa giao hoặc đã được đưa lại cửa hàng trước khi hủy đơn.');

    return withStore(pool, auth.userId, storeId, async (client, membership) => {
      if (!VOID_ORDER_ROLES.has(membership.role)) throw new ApiError(403, 'forbidden', 'Chỉ chủ cửa hàng hoặc quản lý mới được hủy đơn.');
      const orderResult = await client.query(
        `SELECT id, order_number, customer_id, status, total_vnd::text AS total_vnd
         FROM orders WHERE store_id = $1 AND id = $2 FOR UPDATE`,
        [storeId, orderId]
      );
      if (!orderResult.rowCount) throw new ApiError(404, 'order_not_found', 'Không tìm thấy đơn hàng.');
      const order = orderResult.rows[0];
      if (order.status === 'voided') return { orderId, status: 'voided', alreadyVoided: true };
      if (order.status !== 'completed') throw new ApiError(409, 'order_not_voidable', 'Đơn đã trả hàng hoặc có trạng thái khác; hãy dùng quy trình trả hàng để giữ đúng lịch sử.');

      const [payments, completedReturns, saleMovements] = await Promise.all([
        client.query('SELECT id FROM payments WHERE store_id = $1 AND order_id = $2 LIMIT 1', [storeId, orderId]),
        client.query("SELECT id FROM returns WHERE store_id = $1 AND order_id = $2 AND status = 'completed' LIMIT 1", [storeId, orderId]),
        client.query(
          `SELECT product_id, quantity_delta::text AS quantity_delta
           FROM inventory_movements
           WHERE store_id = $1 AND source_type = 'order' AND source_id = $2 AND movement_type = 'sale'
           ORDER BY product_id FOR UPDATE`,
          [storeId, orderId]
        ),
      ]);
      if (payments.rowCount) throw new ApiError(409, 'payment_must_be_refunded', 'Đơn đã có giao dịch thanh toán. Hãy xử lý trả hàng và hoàn tiền để giữ đối soát chính xác.');
      if (completedReturns.rowCount) throw new ApiError(409, 'order_has_returns', 'Đơn đã có hàng trả; không thể hủy trực tiếp.');

      for (const movement of saleMovements.rows) {
        if (!movement.quantity_delta.startsWith('-')) throw new Error('Sale inventory movement has an unexpected sign.');
        const quantity = movement.quantity_delta.slice(1);
        const balance = await client.query(
          'SELECT on_hand::text AS on_hand FROM inventory_balances WHERE store_id = $1 AND product_id = $2 FOR UPDATE',
          [storeId, movement.product_id]
        );
        if (!balance.rowCount) throw new ApiError(409, 'inventory_unavailable', 'Không còn số dư tồn kho để phục hồi. Hãy liên hệ hỗ trợ.');
        const updatedBalance = await client.query(
          `UPDATE inventory_balances SET on_hand = on_hand + $3::numeric, version = version + 1, updated_at = now()
           WHERE store_id = $1 AND product_id = $2 RETURNING on_hand::text AS on_hand`,
          [storeId, movement.product_id, quantity]
        );
        await client.query(
          `INSERT INTO inventory_movements (store_id, product_id, movement_type, quantity_delta, quantity_after,
                                             reason, source_type, source_id, actor_user_id)
           VALUES ($1, $2, 'reversal', $3::numeric, $4::numeric, $5, 'order_void', $6, $7)`,
          [storeId, movement.product_id, quantity, updatedBalance.rows[0].on_hand,
            `Hủy đơn ${order.order_number}: ${reason}`, orderId, auth.userId]
        );
      }

      if (order.customer_id && BigInt(order.total_vnd) > 0n) {
        await client.query(
          `INSERT INTO customer_ledger_entries (store_id, customer_id, entry_type, credit_vnd, source_type, source_id, note, actor_user_id)
           VALUES ($1, $2, 'reversal', $3, 'order_void', $4, $5, $6)`,
          [storeId, order.customer_id, order.total_vnd, orderId, `Hủy đơn ${order.order_number}: ${reason}`, auth.userId]
        );
      }
      await client.query("UPDATE orders SET status = 'voided', updated_at = now() WHERE store_id = $1 AND id = $2", [storeId, orderId]);
      await client.query(
        `INSERT INTO audit_events (store_id, actor_user_id, action, entity_type, entity_id, reason, metadata)
         VALUES ($1, $2, 'sale.voided', 'order', $3, $4, jsonb_build_object('orderNumber', $5::text, 'totalVnd', $6::text))`,
        [storeId, auth.userId, orderId, reason, order.order_number, order.total_vnd]
      );
      return { orderId, status: 'voided', alreadyVoided: false };
    });
  });
}

module.exports = { registerRecordRoutes, validateCustomer };
