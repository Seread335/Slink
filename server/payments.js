'use strict';

const { createHash } = require('node:crypto');
const { ApiError, authenticate, requireCsrf } = require('./auth');
const { UUID_PATTERN, withStore } = require('./db');
const { lockActiveCashSession } = require('./cash-register');

const PAYMENT_ROLES = new Set(['owner', 'manager', 'cashier', 'accountant']);
const METHODS = new Set(['cash', 'bank_transfer', 'bank_qr', 'card', 'other']);
const MAX_BIGINT = 9223372036854775807n;

function amountVnd(value) {
  const text = typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : value;
  if (typeof text !== 'string' && typeof text !== 'number') throw new ApiError(400, 'validation_error', 'Số tiền không hợp lệ.');
  const digits = String(text);
  if (!/^[1-9]\d{0,18}$/.test(digits)) throw new ApiError(400, 'validation_error', 'Số tiền phải là VND nguyên dương.');
  const parsed = BigInt(digits);
  if (parsed > MAX_BIGINT) throw new ApiError(400, 'validation_error', 'Số tiền vượt giới hạn lưu trữ.');
  return parsed;
}

function registerPaymentRoutes(app, { pool, env }) {
  app.post('/api/stores/:storeId/orders/:orderId/payments', async (request, reply) => {
    const auth = await authenticate(pool, request);
    requireCsrf(request, env);
    const { storeId, orderId } = request.params;
    if (!UUID_PATTERN.test(storeId) || !UUID_PATTERN.test(orderId)) throw new ApiError(400, 'validation_error', 'Cửa hàng hoặc đơn hàng không hợp lệ.');
    const idempotencyKey = request.headers['idempotency-key'];
    if (typeof idempotencyKey !== 'string' || idempotencyKey.length < 16 || idempotencyKey.length > 200) throw new ApiError(400, 'idempotency_key_required', 'Thiếu mã lưu thao tác an toàn. Hãy thử lại.');
    const amount = amountVnd(request.body?.amountVnd);
    const method = request.body?.method || 'cash';
    if (!METHODS.has(method)) throw new ApiError(400, 'validation_error', 'Phương thức thanh toán không hợp lệ.');
    const note = typeof request.body?.note === 'string' ? request.body.note.trim() : '';
    if (note.length > 300) throw new ApiError(400, 'validation_error', 'Ghi chú tối đa 300 ký tự.');
    const value = { amountVnd: amount.toString(), method, note };
    const digest = createHash('sha256').update(JSON.stringify(value)).digest();
    const outcome = await withStore(pool, auth.userId, storeId, async (client, membership) => {
      if (!PAYMENT_ROLES.has(membership.role)) throw new ApiError(403, 'forbidden', 'Tài khoản này không có quyền ghi nhận thu tiền.');
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
        if (!record || !Buffer.from(record.request_hash).equals(digest)) throw new ApiError(409, 'idempotency_conflict', 'Mã lưu thao tác đã được dùng cho dữ liệu khác.');
        if (!record.response_body || !record.response_status) throw new ApiError(409, 'request_in_progress', 'Thanh toán đang được xử lý. Hãy thử lại sau.');
        return { status: record.response_status, body: record.response_body, replayed: true };
      }
      const orderResult = await client.query(
        `SELECT id, order_number, customer_id, status, total_vnd::text AS total_vnd FROM orders
         WHERE store_id = $1 AND id = $2 FOR UPDATE`,
        [storeId, orderId]
      );
      if (!orderResult.rowCount || orderResult.rows[0].status === 'voided') throw new ApiError(404, 'order_not_found', 'Không tìm thấy đơn hàng có thể thu tiền.');
      const order = orderResult.rows[0];
      if (!order.customer_id) throw new ApiError(409, 'customer_required', 'Đơn hàng này chưa gắn khách hàng nên không thể ghi nợ hoặc thu nợ.');
      const sums = await client.query(
        `SELECT
           COALESCE((SELECT SUM(p.amount_vnd) FROM payments p WHERE p.store_id = $1 AND p.order_id = $2 AND p.status = 'succeeded'), 0)::text AS paid_vnd,
           COALESCE((SELECT SUM(f.amount_vnd) FROM refunds f JOIN returns r ON r.id = f.return_id
                     WHERE r.store_id = $1 AND r.order_id = $2 AND r.status = 'completed' AND f.status = 'succeeded'), 0)::text AS refunded_vnd,
           COALESCE((SELECT SUM(r.refund_total_vnd) FROM returns r WHERE r.store_id = $1 AND r.order_id = $2 AND r.status = 'completed'), 0)::text AS returned_vnd`,
        [storeId, orderId]
      );
      const paid = BigInt(sums.rows[0].paid_vnd);
      const refunded = BigInt(sums.rows[0].refunded_vnd);
      const returned = BigInt(sums.rows[0].returned_vnd);
      const due = BigInt(order.total_vnd) - returned - paid + refunded;
      if (due <= 0n) throw new ApiError(409, 'no_balance_due', 'Đơn hàng không còn khoản phải thu.');
      if (amount > due) throw new ApiError(409, 'payment_exceeds_due', 'Số tiền thu vượt khoản còn phải thu của đơn hàng.');
      const cashSessionId = method === 'cash' ? await lockActiveCashSession(client, storeId) : null;
      const payment = await client.query(
        `INSERT INTO payments (store_id, order_id, method, status, amount_vnd, provider_reference, recorded_by)
         VALUES ($1, $2, $3, 'succeeded', $4, NULL, $5) RETURNING id, occurred_at`,
        [storeId, orderId, method, amount.toString(), auth.userId]
      );
      await client.query(
        `INSERT INTO customer_ledger_entries (store_id, customer_id, entry_type, credit_vnd, source_type, source_id, note, actor_user_id)
         VALUES ($1, $2, 'payment_credit', $3, 'order_payment', $4, $5, $6)`,
        [storeId, order.customer_id, amount.toString(), payment.rows[0].id, note || `Thu nợ đơn ${order.order_number}`, auth.userId]
      );
      await client.query(
        `INSERT INTO cash_movements (store_id, direction, category, amount_vnd, method, source_type, source_id, note, actor_user_id, cash_session_id)
         VALUES ($1, 'in', 'Thu nợ bán hàng', $2, $3, 'order_payment', $4, $5, $6, $7)`,
        [storeId, amount.toString(), method, payment.rows[0].id, note || `Thu đơn ${order.order_number}`, auth.userId, cashSessionId]
      );
      await client.query(
        `INSERT INTO audit_events (store_id, actor_user_id, action, entity_type, entity_id, reason, metadata)
         VALUES ($1, $2, 'order.payment_recorded', 'order', $3, $4, jsonb_build_object('amountVnd', $5::text, 'method', $6::text))`,
        [storeId, auth.userId, orderId, note, amount.toString(), method]
      );
      const body = { payment: { id: payment.rows[0].id, amountVnd: amount.toString(), method, occurredAt: payment.rows[0].occurred_at } };
      await client.query(
        `UPDATE idempotency_records SET response_status = 201, response_body = $4::jsonb, completed_at = now()
         WHERE store_id = $1 AND actor_user_id = $2 AND idempotency_key = $3`,
        [storeId, auth.userId, idempotencyKey, JSON.stringify(body)]
      );
      return { status: 201, body, replayed: false };
    });
    if (outcome.replayed) reply.header('idempotent-replayed', 'true');
    return reply.code(outcome.status).send(outcome.body);
  });
}

module.exports = { registerPaymentRoutes, amountVnd };
