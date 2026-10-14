'use strict';

const { createHash, randomUUID } = require('node:crypto');
const { ApiError, authenticate, requireCsrf } = require('./auth');
const { UUID_PATTERN, withStore } = require('./db');
const { quantityMilli, quantityText } = require('./sales');
const { lockActiveCashSession } = require('./cash-register');

const RETURN_ROLES = new Set(['owner', 'manager']);
const REFUND_METHODS = new Set(['cash', 'bank_transfer', 'bank_qr', 'card', 'other']);
const RESTOCK_POLICIES = new Set(['restock', 'damaged', 'discarded']);

function digest(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest();
}

function normalizeReturn(body) {
  if (!body || !Array.isArray(body.items) || body.items.length < 1 || body.items.length > 100) {
    throw new ApiError(400, 'validation_error', 'Chọn ít nhất một sản phẩm trong đơn cần trả.');
  }
  const items = [];
  const seen = new Map();
  for (const row of body.items) {
    if (!row || typeof row.orderLineId !== 'string' || !UUID_PATTERN.test(row.orderLineId)) {
      throw new ApiError(400, 'validation_error', 'Sản phẩm trả lại không hợp lệ.');
    }
    const milli = quantityMilli(row.quantity);
    if (seen.has(row.orderLineId)) {
      const index = seen.get(row.orderLineId);
      items[index].quantityMilli += milli;
      if (!Number.isSafeInteger(items[index].quantityMilli)) throw new ApiError(400, 'validation_error', 'Số lượng trả vượt giới hạn.');
    } else {
      seen.set(row.orderLineId, items.length);
      items.push({ orderLineId: row.orderLineId, quantityMilli: milli });
    }
  }
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (reason.length < 2 || reason.length > 500) throw new ApiError(400, 'validation_error', 'Lý do trả hàng cần từ 2 đến 500 ký tự.');
  const restockPolicy = body.restockPolicy || 'restock';
  if (!RESTOCK_POLICIES.has(restockPolicy)) throw new ApiError(400, 'validation_error', 'Cách xử lý hàng trả không hợp lệ.');
  const refundMethod = body.refundMethod || 'cash';
  if (!REFUND_METHODS.has(refundMethod)) throw new ApiError(400, 'validation_error', 'Phương thức hoàn tiền không hợp lệ.');
  return { items, reason, restockPolicy, refundMethod };
}

function registerReturnRoutes(app, { pool, env }) {
  app.post('/api/stores/:storeId/orders/:orderId/returns', async (request, reply) => {
    const auth = await authenticate(pool, request);
    requireCsrf(request, env);
    const { storeId, orderId } = request.params;
    if (!UUID_PATTERN.test(storeId) || !UUID_PATTERN.test(orderId)) throw new ApiError(400, 'validation_error', 'Cửa hàng hoặc đơn hàng không hợp lệ.');
    const idempotencyKey = request.headers['idempotency-key'];
    if (typeof idempotencyKey !== 'string' || idempotencyKey.length < 16 || idempotencyKey.length > 200) {
      throw new ApiError(400, 'idempotency_key_required', 'Thiếu mã lưu thao tác an toàn. Hãy thử lại.');
    }
    const value = normalizeReturn(request.body);
    const requestDigest = digest(value);
    const outcome = await withStore(pool, auth.userId, storeId, async (client, membership) => {
      if (!RETURN_ROLES.has(membership.role)) throw new ApiError(403, 'forbidden', 'Tài khoản này không có quyền xử lý trả hàng.');
      const reserved = await client.query(
        `INSERT INTO idempotency_records (store_id, actor_user_id, idempotency_key, request_hash)
         VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING RETURNING idempotency_key`,
        [storeId, auth.userId, idempotencyKey, requestDigest]
      );
      if (!reserved.rowCount) {
        const previous = await client.query(
          `SELECT request_hash, response_status, response_body FROM idempotency_records
           WHERE store_id = $1 AND actor_user_id = $2 AND idempotency_key = $3 FOR UPDATE`,
          [storeId, auth.userId, idempotencyKey]
        );
        const record = previous.rows[0];
        if (!record || !Buffer.from(record.request_hash).equals(requestDigest)) {
          throw new ApiError(409, 'idempotency_conflict', 'Mã lưu thao tác đã được dùng cho dữ liệu khác.');
        }
        if (!record.response_body || !record.response_status) throw new ApiError(409, 'request_in_progress', 'Yêu cầu đang được xử lý. Hãy thử lại sau.');
        return { status: record.response_status, body: record.response_body, replayed: true };
      }

      const orderResult = await client.query(
        `SELECT id, order_number, customer_id, status, total_vnd::text AS total_vnd FROM orders
         WHERE store_id = $1 AND id = $2 FOR UPDATE`,
        [storeId, orderId]
      );
      if (!orderResult.rowCount || orderResult.rows[0].status === 'voided') throw new ApiError(404, 'order_not_found', 'Không tìm thấy đơn hàng có thể trả.');
      const order = orderResult.rows[0];
      if (order.status === 'returned') throw new ApiError(409, 'already_returned', 'Đơn hàng đã được trả toàn bộ.');

      const linesResult = await client.query(
        `SELECT ol.id, ol.product_id, ol.product_name_snapshot, ol.quantity::text AS quantity,
                ol.line_total_vnd::text AS line_total_vnd, p.inventory_tracked,
                COALESCE((SELECT SUM(rl.quantity) FROM return_lines rl JOIN returns r ON r.id = rl.return_id
                          WHERE rl.store_id = ol.store_id AND rl.order_line_id = ol.id AND r.status = 'completed'), 0)::text AS returned_quantity,
                COALESCE((SELECT SUM(rl.refund_vnd) FROM return_lines rl JOIN returns r ON r.id = rl.return_id
                          WHERE rl.store_id = ol.store_id AND rl.order_line_id = ol.id AND r.status = 'completed'), 0)::text AS refunded_vnd
         FROM order_lines ol JOIN products p ON p.store_id = ol.store_id AND p.id = ol.product_id
         WHERE ol.store_id = $1 AND ol.order_id = $2 ORDER BY ol.product_id, ol.id FOR UPDATE OF ol`,
        [storeId, orderId]
      );
      const linesById = new Map(linesResult.rows.map((line) => [line.id, line]));
      const requestedLines = value.items.map((requested) => {
        const line = linesById.get(requested.orderLineId);
        if (!line) throw new ApiError(400, 'return_line_invalid', 'Một sản phẩm không thuộc đơn hàng đã chọn.');
        const soldMilli = quantityMilli(Number(line.quantity));
        const returnedQuantity = Number(line.returned_quantity || 0);
        const returnedMilli = returnedQuantity ? quantityMilli(returnedQuantity) : 0;
        const remainingMilli = soldMilli - returnedMilli;
        if (requested.quantityMilli > remainingMilli) {
          throw new ApiError(409, 'return_quantity_exceeded', `${line.product_name_snapshot}: số lượng trả vượt số lượng còn được trả.`);
        }
        const gross = BigInt(line.line_total_vnd);
        const refunded = BigInt(line.refunded_vnd);
        const remainingRefund = gross - refunded;
        const refundVnd = requested.quantityMilli === remainingMilli
          ? remainingRefund
          : (remainingRefund * BigInt(requested.quantityMilli) + BigInt(Math.floor(remainingMilli / 2))) / BigInt(remainingMilli);
        return { requested, line, remainingMilli, refundVnd };
      }).sort((a, b) => a.line.product_id.localeCompare(b.line.product_id));
      const refundTotal = requestedLines.reduce((sum, item) => sum + item.refundVnd, 0n);
      const refundableResult = await client.query(
        `SELECT (
           COALESCE((SELECT SUM(p.amount_vnd) FROM payments p WHERE p.store_id = $1 AND p.order_id = $2 AND p.status = 'succeeded'), 0)
           - COALESCE((SELECT SUM(f.amount_vnd) FROM refunds f JOIN returns r ON r.id = f.return_id
                       WHERE r.store_id = $1 AND r.order_id = $2 AND r.status = 'completed' AND f.status = 'succeeded'), 0)
         )::text AS refundable_vnd`,
        [storeId, orderId]
      );
      const netPayments = BigInt(refundableResult.rows[0].refundable_vnd || '0');
      const previouslyReturnedValue = linesResult.rows.reduce(
        (sum, line) => sum + BigInt(line.refunded_vnd),
        0n
      );
      const remainingOrderValue = BigInt(order.total_vnd) - previouslyReturnedValue - refundTotal;
      const cashSurplus = netPayments > remainingOrderValue ? netPayments - remainingOrderValue : 0n;
      const refundPayment = refundTotal < cashSurplus ? refundTotal : cashSurplus;
      const customerCredit = refundTotal - refundPayment;
      if (customerCredit > 0n && !order.customer_id) {
        throw new ApiError(409, 'customer_required', 'Đơn này chưa gắn khách hàng. Không thể chuyển phần chưa thu thành số dư khách.');
      }
      const cashSessionId = refundPayment > 0n && value.refundMethod === 'cash'
        ? await lockActiveCashSession(client, storeId, { cashOutVnd: refundPayment })
        : null;

      const returnId = randomUUID();
      const sequence = await client.query(
        `UPDATE store_sequences SET next_return_number = next_return_number + 1
         WHERE store_id = $1 RETURNING next_return_number - 1 AS return_number`,
        [storeId]
      );
      if (!sequence.rowCount) throw new Error('Store return sequence is missing.');
      const returnNumber = `RT-${sequence.rows[0].return_number}`;
      await client.query(
        `INSERT INTO returns (id, store_id, order_id, return_number, status, reason, refund_total_vnd, restock_policy, created_by)
         VALUES ($1, $2, $3, $4, 'completed', $5, $6, $7, $8)`,
        [returnId, storeId, orderId, returnNumber, value.reason, refundTotal.toString(), value.restockPolicy, auth.userId]
      );
      for (const item of requestedLines) {
        const restockedMilli = value.restockPolicy === 'restock' && item.line.inventory_tracked ? item.requested.quantityMilli : 0;
        await client.query(
          `INSERT INTO return_lines (store_id, return_id, order_id, order_line_id, quantity, refund_vnd, restocked_quantity)
           VALUES ($1, $2, $3, $4, $5::numeric, $6, $7::numeric)`,
          [storeId, returnId, orderId, item.line.id, quantityText(item.requested.quantityMilli), item.refundVnd.toString(), quantityText(restockedMilli)]
        );
        if (restockedMilli > 0) {
          await client.query(
            `UPDATE inventory_balances SET on_hand = on_hand + $3::numeric, version = version + 1, updated_at = now()
             WHERE store_id = $1 AND product_id = $2`,
            [storeId, item.line.product_id, quantityText(restockedMilli)]
          );
          const balance = await client.query(
            'SELECT on_hand::text AS on_hand FROM inventory_balances WHERE store_id = $1 AND product_id = $2',
            [storeId, item.line.product_id]
          );
          await client.query(
            `INSERT INTO inventory_movements (store_id, product_id, movement_type, quantity_delta, quantity_after,
                                               reason, source_type, source_id, actor_user_id)
             VALUES ($1, $2, 'return', $3::numeric, $4::numeric, $5, 'return', $6, $7)`,
            [storeId, item.line.product_id, quantityText(restockedMilli), balance.rows[0].on_hand,
              `Trả hàng ${returnNumber}`, returnId, auth.userId]
          );
        }
      }
      if (refundPayment > 0n) {
        await client.query(
          `INSERT INTO refunds (store_id, return_id, method, status, amount_vnd, recorded_by)
           VALUES ($1, $2, $3, 'succeeded', $4, $5)`,
          [storeId, returnId, value.refundMethod, refundPayment.toString(), auth.userId]
        );
        await client.query(
          `INSERT INTO cash_movements (store_id, direction, category, amount_vnd, method, source_type, source_id, note, actor_user_id, cash_session_id)
           VALUES ($1, 'out', 'Hoàn tiền', $2, $3, 'return_refund', $4, $5, $6, $7)`,
          [storeId, refundPayment.toString(), value.refundMethod, returnId, `Hoàn đơn ${order.order_number}`, auth.userId, cashSessionId]
        );
      }
      if (order.customer_id) {
        if (refundTotal > 0n) {
          await client.query(
            `INSERT INTO customer_ledger_entries (store_id, customer_id, entry_type, credit_vnd, source_type, source_id, note, actor_user_id)
             VALUES ($1, $2, 'return_credit', $3, 'return', $4, $5, $6)`,
            [storeId, order.customer_id, refundTotal.toString(), returnId, `Trả hàng ${returnNumber}`, auth.userId]
          );
        }
        if (refundPayment > 0n) {
          await client.query(
            `INSERT INTO customer_ledger_entries (store_id, customer_id, entry_type, debit_vnd, source_type, source_id, note, actor_user_id)
             VALUES ($1, $2, 'manual_debit', $3, 'return_refund', $4, $5, $6)`,
            [storeId, order.customer_id, refundPayment.toString(), returnId, `Đã hoàn tiền ${returnNumber}`, auth.userId]
          );
        }
      }
      const totalRemaining = linesResult.rows.reduce((sum, line) => {
        const sold = quantityMilli(Number(line.quantity));
        const previousQuantity = Number(line.returned_quantity || 0);
        const previous = previousQuantity ? quantityMilli(previousQuantity) : 0;
        const added = requestedLines.find((item) => item.line.id === line.id)?.requested.quantityMilli || 0;
        return sum + sold - previous - added;
      }, 0);
      const nextStatus = totalRemaining === 0 ? 'returned' : 'partially_returned';
      await client.query('UPDATE orders SET status = $3, updated_at = now() WHERE store_id = $1 AND id = $2', [storeId, orderId, nextStatus]);
      await client.query(
        `INSERT INTO audit_events (store_id, actor_user_id, action, entity_type, entity_id, reason, metadata)
         VALUES ($1, $2, 'return.created', 'return', $3, $4, jsonb_build_object('returnNumber', $5::text, 'refundVnd', $6::text))`,
        [storeId, auth.userId, returnId, value.reason, returnNumber, refundTotal.toString()]
      );
      const body = {
        return: {
          id: returnId,
          number: returnNumber,
          orderId,
          status: 'completed',
          refundTotalVnd: refundTotal.toString(),
          refundedVnd: refundPayment.toString(),
          customerCreditVnd: customerCredit.toString(),
          restockPolicy: value.restockPolicy,
          orderStatus: nextStatus,
        },
      };
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

module.exports = { registerReturnRoutes, normalizeReturn };
