'use strict';

const { createHash, randomUUID } = require('node:crypto');
const { ApiError, authenticate, requireCsrf } = require('./auth');
const { UUID_PATTERN, withStore } = require('./db');
const { lockActiveCashSession } = require('./cash-register');

const FINANCE_ROLES = new Set(['owner', 'manager', 'accountant']);
const FINANCE_PAGE_ROLES = new Set([...FINANCE_ROLES, 'cashier', 'stockkeeper']);
const SUPPLIER_CREATE_ROLES = new Set(['owner', 'manager', 'accountant', 'stockkeeper']);
const METHODS = new Set(['cash', 'bank_transfer', 'bank_qr', 'card', 'other']);
const MAX_BIGINT = 9223372036854775807n;

function positiveAmount(value) {
  const text = typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : value;
  if (typeof text !== 'string' && typeof text !== 'number') throw new ApiError(400, 'validation_error', 'Số tiền không hợp lệ.');
  if (!/^[1-9]\d{0,18}$/.test(String(text))) throw new ApiError(400, 'validation_error', 'Số tiền phải là VND nguyên dương.');
  const parsed = BigInt(text);
  if (parsed > 9223372036854775807n) throw new ApiError(400, 'validation_error', 'Số tiền vượt giới hạn lưu trữ.');
  return parsed;
}

function nonNegativeAmount(value, label) {
  if (value === undefined || value === null || value === '') return 0n;
  const text = typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : value;
  if (typeof text !== 'string' || !/^(0|[1-9]\d{0,18})$/.test(text)) throw new ApiError(400, 'validation_error', `${label} phải là VND nguyên không âm.`);
  const parsed = BigInt(text);
  if (parsed > MAX_BIGINT) throw new ApiError(400, 'validation_error', `${label} vượt giới hạn lưu trữ.`);
  return parsed;
}

function registerFinanceRoutes(app, { pool, env }) {
  app.get('/api/stores/:storeId/finance', async (request) => {
    const auth = await authenticate(pool, request);
    const { storeId } = request.params;
    if (!UUID_PATTERN.test(storeId)) throw new ApiError(400, 'validation_error', 'Cửa hàng không hợp lệ.');
    return withStore(pool, auth.userId, storeId, async (client, membership) => {
      if (!FINANCE_PAGE_ROLES.has(membership.role)) throw new ApiError(403, 'forbidden', 'Tài khoản này không có quyền xem tài chính.');
      const fullFinanceAccess = FINANCE_ROLES.has(membership.role);
      const cashbookAccess = fullFinanceAccess || membership.role === 'cashier';
      const purchaseAccess = fullFinanceAccess || membership.role === 'stockkeeper';
      const [cash, suppliers, summary, customerDebtors, purchases] = await Promise.all([
        cashbookAccess ? client.query(
          `SELECT c.direction, c.category, c.amount_vnd::text AS amount_vnd, c.method, c.source_type, c.source_id,
                  c.cash_session_id, s.opened_at AS cash_session_opened_at,
                  c.note, c.occurred_at, u.display_name AS actor_name, COUNT(*) OVER()::int AS total_count
           FROM cash_movements c
           JOIN users u ON u.id = c.actor_user_id
           LEFT JOIN cash_register_sessions s ON s.store_id = c.store_id AND s.id = c.cash_session_id
           WHERE c.store_id = $1
             AND ($2::boolean OR c.cash_session_id IN (
               SELECT own.id FROM cash_register_sessions own
               WHERE own.store_id = $1 AND (own.opened_by = $3 OR own.status = 'open')
             ))
           ORDER BY c.occurred_at DESC, c.source_id DESC LIMIT 100`,
          [storeId, fullFinanceAccess, auth.userId]
        ) : Promise.resolve({ rows: [] }),
        fullFinanceAccess ? client.query(
          `SELECT s.id, s.name,
                  COALESCE(SUM(l.increases_payable_vnd) - SUM(l.decreases_payable_vnd), 0)::text AS balance_vnd,
                  MAX(l.occurred_at) AS last_activity_at
           FROM suppliers s LEFT JOIN supplier_ledger_entries l ON l.store_id = s.store_id AND l.supplier_id = s.id
           WHERE s.store_id = $1 AND s.status = 'active'
           GROUP BY s.id, s.name ORDER BY s.name`,
          [storeId]
        ) : membership.role === 'stockkeeper' ? client.query(
          `SELECT id, name FROM suppliers WHERE store_id = $1 AND status = 'active' ORDER BY name`,
          [storeId]
        ) : Promise.resolve({ rows: [] }),
        fullFinanceAccess ? client.query(
          `SELECT COALESCE(SUM(amount_vnd) FILTER (WHERE direction = 'in' AND occurred_at >= ((date_trunc('day', now() AT TIME ZONE s.timezone)) AT TIME ZONE s.timezone)), 0)::text AS today_in_vnd,
                  COALESCE(SUM(amount_vnd) FILTER (WHERE direction = 'out' AND occurred_at >= ((date_trunc('day', now() AT TIME ZONE s.timezone)) AT TIME ZONE s.timezone)), 0)::text AS today_out_vnd,
                  COALESCE((SELECT SUM(balance) FROM (
                    SELECT SUM(l.debit_vnd - l.credit_vnd) AS balance FROM customer_ledger_entries l
                    WHERE l.store_id = s.id GROUP BY l.customer_id
                  ) customer_balances WHERE balance > 0), 0)::text AS customer_debt_vnd,
                  COALESCE((SELECT COUNT(*) FROM (
                    SELECT SUM(l.debit_vnd - l.credit_vnd) AS balance FROM customer_ledger_entries l
                    WHERE l.store_id = s.id GROUP BY l.customer_id
                  ) customer_balances WHERE balance > 0), 0)::int AS customer_debt_count,
                  COALESCE((SELECT SUM(balance) FROM (
                    SELECT SUM(l.increases_payable_vnd - l.decreases_payable_vnd) AS balance FROM supplier_ledger_entries l
                    WHERE l.store_id = s.id GROUP BY l.supplier_id
                  ) supplier_balances WHERE balance > 0), 0)::text AS supplier_payable_vnd
           FROM stores s LEFT JOIN cash_movements c ON c.store_id = s.id WHERE s.id = $1 GROUP BY s.id, s.timezone`,
          [storeId]
        ) : Promise.resolve({ rows: [] }),
        fullFinanceAccess ? client.query(
          `SELECT c.id, c.name, COALESCE(c.phone, '') AS phone,
                  SUM(l.debit_vnd - l.credit_vnd)::text AS balance_vnd
           FROM customers c JOIN customer_ledger_entries l ON l.store_id = c.store_id AND l.customer_id = c.id
           WHERE c.store_id = $1 AND c.status = 'active'
           GROUP BY c.id, c.name, c.phone HAVING SUM(l.debit_vnd - l.credit_vnd) > 0
           ORDER BY SUM(l.debit_vnd - l.credit_vnd) DESC, c.name LIMIT 10`,
          [storeId]
        ) : Promise.resolve({ rows: [] }),
        purchaseAccess ? client.query(
          `SELECT p.id, p.purchase_number, p.status, p.note, p.total_vnd::text AS total_vnd,
                  p.received_at, COALESCE(s.name, '') AS supplier_name,
                  COALESCE((
                    SELECT json_agg(json_build_object(
                      'productName', l.product_name_snapshot,
                      'sku', l.sku_snapshot,
                      'unit', l.unit_snapshot,
                      'quantity', l.quantity_received::text,
                      'unitCostVnd', l.unit_cost_vnd::text,
                      'totalVnd', l.line_total_vnd::text
                    ) ORDER BY l.id)
                    FROM purchase_lines l WHERE l.store_id = p.store_id AND l.purchase_id = p.id
                  ), '[]'::json) AS lines
           FROM purchases p LEFT JOIN suppliers s ON s.store_id = p.store_id AND s.id = p.supplier_id
           WHERE p.store_id = $1 ORDER BY p.received_at DESC, p.id DESC LIMIT 50`,
          [storeId]
        ) : Promise.resolve({ rows: [] }),
      ]);
      return {
        movements: cash.rows,
        movementTotal: Number(cash.rows[0]?.total_count || 0),
        suppliers: suppliers.rows,
        customerDebtors: fullFinanceAccess ? customerDebtors.rows : [],
        purchases: purchaseAccess ? purchases.rows : [],
        financeAccess: { full: fullFinanceAccess, cashbook: cashbookAccess, purchases: purchaseAccess },
        summary: fullFinanceAccess ? {
          todayInVnd: summary.rows[0]?.today_in_vnd || '0',
          todayOutVnd: summary.rows[0]?.today_out_vnd || '0',
          customerDebtVnd: summary.rows[0]?.customer_debt_vnd || '0',
          customerDebtCount: Number(summary.rows[0]?.customer_debt_count || 0),
          supplierPayableVnd: summary.rows[0]?.supplier_payable_vnd || '0',
        } : null,
      };
    });
  });

  app.post('/api/stores/:storeId/suppliers', async (request, reply) => {
    const auth = await authenticate(pool, request);
    requireCsrf(request, env);
    const { storeId } = request.params;
    if (!UUID_PATTERN.test(storeId)) throw new ApiError(400, 'validation_error', 'Cửa hàng không hợp lệ.');
    const body = request.body || {};
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (name.length < 1 || name.length > 160) throw new ApiError(400, 'validation_error', 'Tên nhà cung cấp cần từ 1 đến 160 ký tự.');
    const openingBalance = nonNegativeAmount(body.openingPayableVnd, 'Khoản phải trả ban đầu');
    const idempotencyKey = request.headers['idempotency-key'];
    if (typeof idempotencyKey !== 'string' || idempotencyKey.length < 16 || idempotencyKey.length > 200) {
      throw new ApiError(400, 'idempotency_key_required', 'Thiếu mã lưu nhà cung cấp an toàn. Hãy thử lại.');
    }
    const value = { name, openingPayableVnd: openingBalance.toString() };
    const digest = createHash('sha256').update(JSON.stringify(value)).digest();
    const outcome = await withStore(pool, auth.userId, storeId, async (client, membership) => {
      if (!SUPPLIER_CREATE_ROLES.has(membership.role)) throw new ApiError(403, 'forbidden', 'Tài khoản này không có quyền quản lý nhà cung cấp.');
      if (openingBalance > 0n && !FINANCE_ROLES.has(membership.role)) throw new ApiError(403, 'forbidden', 'Chỉ chủ cửa hàng, quản lý hoặc kế toán được ghi khoản phải trả ban đầu.');
      await client.query('SELECT id FROM stores WHERE id = $1 FOR UPDATE', [storeId]);
      const reserved = await client.query(
        `INSERT INTO idempotency_records (store_id, actor_user_id, idempotency_key, request_hash)
         VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING RETURNING idempotency_key`,
        [storeId, auth.userId, idempotencyKey, digest]
      );
      if (!reserved.rowCount) {
        const previous = await client.query(
          `SELECT request_hash, response_status, response_body FROM idempotency_records
           WHERE store_id = $1 AND actor_user_id = $2 AND idempotency_key = $3 FOR UPDATE`,
          [storeId, auth.userId, idempotencyKey]
        );
        const record = previous.rows[0];
        if (!record || !Buffer.from(record.request_hash).equals(digest)) throw new ApiError(409, 'idempotency_conflict', 'Mã lưu nhà cung cấp đã được dùng cho nội dung khác.');
        if (!record.response_body || !record.response_status) throw new ApiError(409, 'request_in_progress', 'Nhà cung cấp đang được lưu. Hãy thử lại sau.');
        return { status: record.response_status, body: record.response_body, replayed: true };
      }

      const existing = await client.query(
        `SELECT id, name FROM suppliers WHERE store_id = $1 AND status = 'active' AND lower(name) = lower($2)
         ORDER BY created_at, id LIMIT 1 FOR UPDATE`,
        [storeId, name]
      );
      let supplier;
      let created = false;
      if (existing.rowCount) supplier = existing.rows[0];
      else {
        const inserted = await client.query(
          `INSERT INTO suppliers (store_id, name, created_by) VALUES ($1, $2, $3) RETURNING id, name`,
          [storeId, name, auth.userId]
        );
        supplier = inserted.rows[0];
        created = true;
        await client.query(
          `INSERT INTO audit_events (store_id, actor_user_id, action, entity_type, entity_id, metadata)
           VALUES ($1, $2, 'supplier.created', 'supplier', $3, jsonb_build_object('name', $4::text))`,
          [storeId, auth.userId, supplier.id, supplier.name]
        );
      }

      let openingBalanceEntryId = null;
      if (openingBalance > 0n) {
        openingBalanceEntryId = randomUUID();
        await client.query(
          `INSERT INTO supplier_ledger_entries (store_id, supplier_id, entry_type, increases_payable_vnd, source_type, source_id, note, actor_user_id)
           VALUES ($1, $2, 'manual_credit', $3, 'opening_balance', $4, 'Số dư phải trả mở đầu trước khi sử dụng Slink', $5)`,
          [storeId, supplier.id, openingBalance.toString(), openingBalanceEntryId, auth.userId]
        );
        await client.query(
          `INSERT INTO audit_events (store_id, actor_user_id, action, entity_type, entity_id, reason, metadata)
           VALUES ($1, $2, 'supplier.opening_balance_recorded', 'supplier', $3, 'Số dư phải trả mở đầu', jsonb_build_object('amountVnd', $4::text, 'ledgerEntryId', $5::text))`,
          [storeId, auth.userId, supplier.id, openingBalance.toString(), openingBalanceEntryId]
        );
      }
      const balance = await client.query(
        `SELECT COALESCE(SUM(increases_payable_vnd) - SUM(decreases_payable_vnd), 0)::text AS balance_vnd,
                MAX(occurred_at) AS last_activity_at
         FROM supplier_ledger_entries WHERE store_id = $1 AND supplier_id = $2`,
        [storeId, supplier.id]
      );
      const status = created ? 201 : 200;
      const response = { supplier: { id: supplier.id, name: supplier.name, balance_vnd: balance.rows[0].balance_vnd, last_activity_at: balance.rows[0].last_activity_at, created } };
      await client.query(
        `UPDATE idempotency_records SET response_status = $4, response_body = $5::jsonb, completed_at = now()
         WHERE store_id = $1 AND actor_user_id = $2 AND idempotency_key = $3`,
        [storeId, auth.userId, idempotencyKey, status, JSON.stringify(response)]
      );
      return { status, body: response, replayed: false };
    });
    if (outcome.replayed) reply.header('idempotent-replayed', 'true');
    return reply.code(outcome.status).send(outcome.body);
  });

  app.post('/api/stores/:storeId/suppliers/:supplierId/payments', async (request, reply) => {
    const auth = await authenticate(pool, request);
    requireCsrf(request, env);
    const { storeId, supplierId } = request.params;
    if (!UUID_PATTERN.test(storeId) || !UUID_PATTERN.test(supplierId)) throw new ApiError(400, 'validation_error', 'Cửa hàng hoặc nhà cung cấp không hợp lệ.');
    const idempotencyKey = request.headers['idempotency-key'];
    if (typeof idempotencyKey !== 'string' || idempotencyKey.length < 16 || idempotencyKey.length > 200) throw new ApiError(400, 'idempotency_key_required', 'Thiếu mã lưu khoản thanh toán an toàn. Hãy thử lại.');
    const body = request.body || {};
    const amount = positiveAmount(body.amountVnd);
    const method = body.method || 'cash';
    const note = typeof body.note === 'string' ? body.note.trim() : '';
    if (!METHODS.has(method) || note.length > 300) throw new ApiError(400, 'validation_error', 'Phương thức hoặc ghi chú thanh toán không hợp lệ.');
    const value = { supplierId, amountVnd: amount.toString(), method, note };
    const digest = createHash('sha256').update(JSON.stringify(value)).digest();
    const outcome = await withStore(pool, auth.userId, storeId, async (client, membership) => {
      if (!FINANCE_ROLES.has(membership.role)) throw new ApiError(403, 'forbidden', 'Tài khoản này không có quyền thanh toán nhà cung cấp.');
      const reserved = await client.query(
        `INSERT INTO idempotency_records (store_id, actor_user_id, idempotency_key, request_hash)
         VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING RETURNING idempotency_key`,
        [storeId, auth.userId, idempotencyKey, digest]
      );
      if (!reserved.rowCount) {
        const previous = await client.query(
          `SELECT request_hash, response_status, response_body FROM idempotency_records
           WHERE store_id = $1 AND actor_user_id = $2 AND idempotency_key = $3 FOR UPDATE`,
          [storeId, auth.userId, idempotencyKey]
        );
        const record = previous.rows[0];
        if (!record || !Buffer.from(record.request_hash).equals(digest)) throw new ApiError(409, 'idempotency_conflict', 'Mã lưu khoản thanh toán đã được dùng cho dữ liệu khác.');
        if (!record.response_body || !record.response_status) throw new ApiError(409, 'request_in_progress', 'Khoản thanh toán đang được xử lý. Hãy thử lại sau.');
        return { status: record.response_status, body: record.response_body, replayed: true };
      }
      if (method === 'cash') await client.query('SELECT id FROM stores WHERE id = $1 FOR UPDATE', [storeId]);
      const cashSessionId = method === 'cash'
        ? await lockActiveCashSession(client, storeId, { cashOutVnd: amount })
        : null;
      const supplier = await client.query(
        `SELECT id, name FROM suppliers WHERE store_id = $1 AND id = $2 AND status = 'active' FOR UPDATE`,
        [storeId, supplierId]
      );
      if (!supplier.rowCount) throw new ApiError(404, 'supplier_not_found', 'Không tìm thấy nhà cung cấp đang hoạt động.');
      const balanceResult = await client.query(
        `SELECT COALESCE(SUM(increases_payable_vnd) - SUM(decreases_payable_vnd), 0)::text AS balance_vnd
         FROM supplier_ledger_entries WHERE store_id = $1 AND supplier_id = $2`,
        [storeId, supplierId]
      );
      const balance = BigInt(balanceResult.rows[0].balance_vnd);
      if (balance <= 0n) throw new ApiError(409, 'no_payable_balance', 'Nhà cung cấp này không còn khoản phải trả.');
      if (amount > balance) throw new ApiError(409, 'payable_exceeded', 'Số tiền thanh toán vượt khoản còn phải trả. Hãy tải lại số dư.');
      const paymentId = randomUUID();
      const description = note || `Thanh toán nhà cung cấp ${supplier.rows[0].name}`;
      await client.query(
        `INSERT INTO supplier_ledger_entries (store_id, supplier_id, entry_type, decreases_payable_vnd, source_type, source_id, note, actor_user_id)
         VALUES ($1, $2, 'payment_debit', $3, 'supplier_payment', $4, $5, $6)`,
        [storeId, supplierId, amount.toString(), paymentId, description, auth.userId]
      );
      await client.query(
        `INSERT INTO cash_movements (store_id, direction, category, amount_vnd, method, source_type, source_id, note, actor_user_id, cash_session_id)
         VALUES ($1, 'out', 'Thanh toán nhà cung cấp', $2, $3, 'supplier_payment', $4, $5, $6, $7)`,
        [storeId, amount.toString(), method, paymentId, description, auth.userId, cashSessionId]
      );
      await client.query(
        `INSERT INTO audit_events (store_id, actor_user_id, action, entity_type, entity_id, reason, metadata)
         VALUES ($1, $2, 'supplier.payment_recorded', 'supplier', $3, $4, jsonb_build_object('amountVnd', $5::text, 'method', $6::text))`,
        [storeId, auth.userId, supplierId, description, amount.toString(), method]
      );
      const bodyResult = { payment: { id: paymentId, supplierId, amountVnd: amount.toString(), method, note: description, occurredAt: new Date().toISOString() } };
      await client.query(
        `UPDATE idempotency_records SET response_status = 201, response_body = $4::jsonb, completed_at = now()
         WHERE store_id = $1 AND actor_user_id = $2 AND idempotency_key = $3`,
        [storeId, auth.userId, idempotencyKey, JSON.stringify(bodyResult)]
      );
      return { status: 201, body: bodyResult, replayed: false };
    });
    if (outcome.replayed) reply.header('idempotent-replayed', 'true');
    return reply.code(outcome.status).send(outcome.body);
  });

  app.post('/api/stores/:storeId/cash-movements', async (request, reply) => {
    const auth = await authenticate(pool, request);
    requireCsrf(request, env);
    const { storeId } = request.params;
    if (!UUID_PATTERN.test(storeId)) throw new ApiError(400, 'validation_error', 'Cửa hàng không hợp lệ.');
    const idempotencyKey = request.headers['idempotency-key'];
    if (typeof idempotencyKey !== 'string' || idempotencyKey.length < 16 || idempotencyKey.length > 200) throw new ApiError(400, 'idempotency_key_required', 'Thiếu mã lưu phiếu an toàn. Hãy thử lại.');
    const body = request.body || {};
    const direction = body.direction;
    if (!['in', 'out'].includes(direction)) throw new ApiError(400, 'validation_error', 'Loại phiếu thu chi không hợp lệ.');
    const amount = positiveAmount(body.amountVnd);
    const method = body.method || 'cash';
    if (!METHODS.has(method)) throw new ApiError(400, 'validation_error', 'Phương thức thanh toán không hợp lệ.');
    const category = typeof body.category === 'string' ? body.category.trim() : '';
    const note = typeof body.note === 'string' ? body.note.trim() : '';
    if (!category || category.length > 100 || note.length > 300) throw new ApiError(400, 'validation_error', 'Khoản mục hoặc ghi chú không hợp lệ.');
    const value = { direction, amountVnd: amount.toString(), method, category, note };
    const digest = createHash('sha256').update(JSON.stringify(value)).digest();
    const outcome = await withStore(pool, auth.userId, storeId, async (client, membership) => {
      if (!FINANCE_ROLES.has(membership.role)) throw new ApiError(403, 'forbidden', 'Tài khoản này không có quyền ghi phiếu thu chi.');
      const reserved = await client.query(
        `INSERT INTO idempotency_records (store_id, actor_user_id, idempotency_key, request_hash)
         VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING RETURNING idempotency_key`,
        [storeId, auth.userId, idempotencyKey, digest]
      );
      if (!reserved.rowCount) {
        const previous = await client.query(
          `SELECT request_hash, response_status, response_body FROM idempotency_records
           WHERE store_id = $1 AND actor_user_id = $2 AND idempotency_key = $3 FOR UPDATE`,
          [storeId, auth.userId, idempotencyKey]
        );
        const record = previous.rows[0];
        if (!record || !Buffer.from(record.request_hash).equals(digest)) throw new ApiError(409, 'idempotency_conflict', 'Mã lưu phiếu đã được dùng cho dữ liệu khác.');
        if (!record.response_body || !record.response_status) throw new ApiError(409, 'request_in_progress', 'Phiếu đang được xử lý. Hãy thử lại sau.');
        return { status: record.response_status, body: record.response_body, replayed: true };
      }
      const movementId = randomUUID();
      const cashSessionId = method === 'cash'
        ? await lockActiveCashSession(client, storeId, { cashOutVnd: direction === 'out' ? amount : 0n })
        : null;
      await client.query(
        `INSERT INTO cash_movements (store_id, direction, category, amount_vnd, method, source_type, source_id, note, actor_user_id, cash_session_id)
         VALUES ($1, $2, $3, $4, $5, 'manual_cash_movement', $6, $7, $8, $9)`,
        [storeId, direction, category, amount.toString(), method, movementId, note, auth.userId, cashSessionId]
      );
      await client.query(
        `INSERT INTO audit_events (store_id, actor_user_id, action, entity_type, entity_id, reason, metadata)
         VALUES ($1, $2, 'cash_movement.created', 'cash_movement', $3, $4, jsonb_build_object('direction', $5::text, 'amountVnd', $6::text))`,
        [storeId, auth.userId, movementId, note || category, direction, amount.toString()]
      );
      const bodyResult = { movement: { id: movementId, direction, category, amountVnd: amount.toString(), method, note, occurredAt: new Date().toISOString() } };
      await client.query(
        `UPDATE idempotency_records SET response_status = 201, response_body = $4::jsonb, completed_at = now()
         WHERE store_id = $1 AND actor_user_id = $2 AND idempotency_key = $3`,
        [storeId, auth.userId, idempotencyKey, JSON.stringify(bodyResult)]
      );
      return { status: 201, body: bodyResult, replayed: false };
    });
    if (outcome.replayed) reply.header('idempotent-replayed', 'true');
    return reply.code(outcome.status).send(outcome.body);
  });
}

module.exports = { registerFinanceRoutes, positiveAmount };
