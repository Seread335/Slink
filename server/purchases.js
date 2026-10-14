'use strict';

const { createHash, randomUUID } = require('node:crypto');
const { ApiError, authenticate, requireCsrf } = require('./auth');
const { UUID_PATTERN, withStore } = require('./db');
const { lockActiveCashSession } = require('./cash-register');

const PURCHASE_ROLES = new Set(['owner', 'manager', 'stockkeeper', 'accountant']);
const METHODS = new Set(['cash', 'bank_transfer', 'bank_qr', 'card', 'other']);
const MAX_BIGINT = 9223372036854775807n;

function quantityMilli(value) {
  const text = typeof value === 'number' && Number.isFinite(value) ? String(value) : value;
  if (typeof text !== 'string' && typeof text !== 'number') throw new ApiError(400, 'validation_error', 'Số lượng nhập không hợp lệ.');
  const match = /^(0|[1-9]\d{0,9})(?:\.(\d{1,3}))?$/.exec(String(text));
  if (!match) throw new ApiError(400, 'validation_error', 'Số lượng phải lớn hơn 0 và có tối đa 3 chữ số thập phân.');
  const milli = BigInt(match[1]) * 1000n + BigInt((match[2] || '').padEnd(3, '0') || '0');
  if (milli <= 0n) throw new ApiError(400, 'validation_error', 'Số lượng phải lớn hơn 0.');
  return milli;
}

function quantityText(milli) {
  const whole = milli / 1000n;
  const fraction = milli % 1000n;
  return fraction ? `${whole}.${String(fraction).padStart(3, '0').replace(/0+$/, '')}` : String(whole);
}

function amount(value, label) {
  const text = typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : value;
  if (typeof text !== 'string' && typeof text !== 'number') throw new ApiError(400, 'validation_error', `${label} không hợp lệ.`);
  if (!/^(0|[1-9]\d{0,18})$/.test(String(text))) throw new ApiError(400, 'validation_error', `${label} phải là VND nguyên không âm.`);
  const parsed = BigInt(text);
  if (parsed > MAX_BIGINT) throw new ApiError(400, 'validation_error', `${label} vượt giới hạn lưu trữ.`);
  return parsed;
}

function registerPurchaseRoutes(app, { pool, env }) {
  app.post('/api/stores/:storeId/purchases', async (request, reply) => {
    const auth = await authenticate(pool, request);
    requireCsrf(request, env);
    const { storeId } = request.params;
    if (!UUID_PATTERN.test(storeId)) throw new ApiError(400, 'validation_error', 'Cửa hàng không hợp lệ.');
    const idempotencyKey = request.headers['idempotency-key'];
    if (typeof idempotencyKey !== 'string' || idempotencyKey.length < 16 || idempotencyKey.length > 200) throw new ApiError(400, 'idempotency_key_required', 'Thiếu mã lưu phiếu nhập an toàn. Hãy thử lại.');
    const body = request.body || {};
    if (typeof body.productId !== 'string' || !UUID_PATTERN.test(body.productId)) throw new ApiError(400, 'validation_error', 'Sản phẩm không hợp lệ.');
    const quantity = quantityMilli(body.quantity);
    const unitCostVnd = amount(body.unitCostVnd, 'Giá nhập');
    const paidVnd = amount(body.amountPaidVnd ?? 0, 'Số tiền đã thanh toán');
    const supplierName = typeof body.supplierName === 'string' ? body.supplierName.trim() : '';
    const note = typeof body.note === 'string' ? body.note.trim() : '';
    const method = body.method || 'cash';
    if (supplierName.length > 160 || note.length > 500) throw new ApiError(400, 'validation_error', 'Tên nhà cung cấp hoặc ghi chú vượt giới hạn.');
    if (!METHODS.has(method)) throw new ApiError(400, 'validation_error', 'Phương thức thanh toán không hợp lệ.');
    const value = { productId: body.productId, quantityMilli: quantity.toString(), unitCostVnd: unitCostVnd.toString(), paidVnd: paidVnd.toString(), supplierName, note, method };
    const digest = createHash('sha256').update(JSON.stringify(value)).digest();
    const outcome = await withStore(pool, auth.userId, storeId, async (client, membership) => {
      if (!PURCHASE_ROLES.has(membership.role)) throw new ApiError(403, 'forbidden', 'Tài khoản này không có quyền nhập hàng.');
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
        if (!record || !Buffer.from(record.request_hash).equals(digest)) throw new ApiError(409, 'idempotency_conflict', 'Mã lưu phiếu nhập đã được dùng cho dữ liệu khác.');
        if (!record.response_body || !record.response_status) throw new ApiError(409, 'request_in_progress', 'Phiếu nhập đang được xử lý. Hãy thử lại sau.');
        return { status: record.response_status, body: record.response_body, replayed: true };
      }
      const productResult = await client.query(
        `SELECT p.id, p.name, p.sku, p.unit, p.status, p.inventory_tracked,
                b.on_hand::text AS on_hand
         FROM products p JOIN inventory_balances b ON b.store_id = p.store_id AND b.product_id = p.id
         WHERE p.store_id = $1 AND p.id = $2 FOR UPDATE OF p, b`,
        [storeId, body.productId]
      );
      if (!productResult.rowCount || productResult.rows[0].status !== 'active') throw new ApiError(404, 'product_not_found', 'Không tìm thấy sản phẩm đang hoạt động.');
      const product = productResult.rows[0];
      const total = (unitCostVnd * quantity + 500n) / 1000n;
      if (total > MAX_BIGINT || paidVnd > total) throw new ApiError(400, 'validation_error', 'Số tiền thanh toán không được vượt tổng phiếu nhập.');
      if (paidVnd < total && !supplierName) throw new ApiError(409, 'supplier_required', 'Nhập tên nhà cung cấp để theo dõi khoản còn phải trả.');
      // Take the store lock before the cash-session and supplier locks, matching supplier cash payments.
      if (supplierName) await client.query('SELECT id FROM stores WHERE id = $1 FOR UPDATE', [storeId]);
      const cashSessionId = paidVnd > 0n && method === 'cash'
        ? await lockActiveCashSession(client, storeId, { cashOutVnd: paidVnd })
        : null;

      let supplierId = null;
      if (supplierName) {
        // Serialize supplier creation with standalone onboarding so concurrent purchases cannot create two active records by name.
        const existing = await client.query(
          `SELECT id FROM suppliers WHERE store_id = $1 AND status = 'active' AND lower(name) = lower($2) ORDER BY created_at LIMIT 1 FOR UPDATE`,
          [storeId, supplierName]
        );
        if (existing.rowCount) supplierId = existing.rows[0].id;
        else {
          const supplier = await client.query(
            `INSERT INTO suppliers (store_id, name, created_by) VALUES ($1, $2, $3) RETURNING id`,
            [storeId, supplierName, auth.userId]
          );
          supplierId = supplier.rows[0].id;
        }
      }
      const sequence = await client.query(
        `UPDATE store_sequences SET next_purchase_number = next_purchase_number + 1
         WHERE store_id = $1 RETURNING next_purchase_number - 1 AS purchase_number`,
        [storeId]
      );
      if (!sequence.rowCount) throw new Error('Store purchase sequence is missing.');
      const purchaseNumber = `PO-${sequence.rows[0].purchase_number}`;
      const purchaseId = randomUUID();
      await client.query(
        `INSERT INTO purchases (id, store_id, purchase_number, supplier_id, status, subtotal_vnd, tax_vnd, total_vnd,
                               note, created_by, received_at)
         VALUES ($1, $2, $3, $4, 'received', $5, 0, $5, $6, $7, now())`,
        [purchaseId, storeId, purchaseNumber, supplierId, total.toString(), note, auth.userId]
      );
      const qty = quantityText(quantity);
      const lineTotal = total.toString();
      await client.query(
        `INSERT INTO purchase_lines (store_id, purchase_id, product_id, product_name_snapshot, sku_snapshot, unit_snapshot,
                                     quantity_ordered, quantity_received, unit_cost_vnd, line_total_vnd)
         VALUES ($1, $2, $3, $4, $5, $6, $7::numeric, $7::numeric, $8, $9)`,
        [storeId, purchaseId, product.id, product.name, product.sku, product.unit, qty, unitCostVnd.toString(), lineTotal]
      );
      await client.query(
        `UPDATE products SET cost_vnd = $3, version = version + 1, updated_at = now() WHERE store_id = $1 AND id = $2`,
        [storeId, product.id, unitCostVnd.toString()]
      );
      await client.query(
        `INSERT INTO product_cost_history (store_id, product_id, unit_cost_vnd, source_type, source_id, actor_user_id)
         VALUES ($1, $2, $3, 'purchase', $4, $5)`,
        [storeId, product.id, unitCostVnd.toString(), purchaseId, auth.userId]
      );
      if (product.inventory_tracked) {
        await client.query(
          `UPDATE inventory_balances SET on_hand = on_hand + $3::numeric, version = version + 1, updated_at = now()
           WHERE store_id = $1 AND product_id = $2`,
          [storeId, product.id, qty]
        );
        const balance = await client.query(
          `SELECT on_hand::text AS on_hand FROM inventory_balances WHERE store_id = $1 AND product_id = $2`,
          [storeId, product.id]
        );
        await client.query(
          `INSERT INTO inventory_movements (store_id, product_id, movement_type, quantity_delta, quantity_after,
                                             reason, source_type, source_id, actor_user_id)
           VALUES ($1, $2, 'purchase_receipt', $3::numeric, $4::numeric, $5, 'purchase', $6, $7)`,
          [storeId, product.id, qty, balance.rows[0].on_hand, `Nhập phiếu ${purchaseNumber}`, purchaseId, auth.userId]
        );
      }
      if (supplierId && total > 0n) {
        await client.query(
          `INSERT INTO supplier_ledger_entries (store_id, supplier_id, entry_type, increases_payable_vnd, source_type, source_id, note, actor_user_id)
           VALUES ($1, $2, 'purchase_credit', $3, 'purchase', $4, $5, $6)`,
          [storeId, supplierId, total.toString(), purchaseId, `Nhập hàng ${purchaseNumber}`, auth.userId]
        );
        if (paidVnd > 0n) {
          await client.query(
            `INSERT INTO supplier_ledger_entries (store_id, supplier_id, entry_type, decreases_payable_vnd, source_type, source_id, note, actor_user_id)
             VALUES ($1, $2, 'payment_debit', $3, 'purchase_payment', $4, $5, $6)`,
            [storeId, supplierId, paidVnd.toString(), purchaseId, `Đã thanh toán phiếu ${purchaseNumber}`, auth.userId]
          );
        }
      }
      if (paidVnd > 0n) {
        await client.query(
          `INSERT INTO cash_movements (store_id, direction, category, amount_vnd, method, source_type, source_id, note, actor_user_id, cash_session_id)
           VALUES ($1, 'out', 'Nhập hàng', $2, $3, 'purchase_payment', $4, $5, $6, $7)`,
          [storeId, paidVnd.toString(), method, purchaseId, `Nhập ${product.name} · ${purchaseNumber}`, auth.userId, cashSessionId]
        );
      }
      await client.query(
        `INSERT INTO audit_events (store_id, actor_user_id, action, entity_type, entity_id, reason, metadata)
         VALUES ($1, $2, 'purchase.received', 'purchase', $3, $4, jsonb_build_object('purchaseNumber', $5::text, 'totalVnd', $6::text))`,
        [storeId, auth.userId, purchaseId, note, purchaseNumber, lineTotal]
      );
      const response = { purchase: { id: purchaseId, number: purchaseNumber, productId: product.id, quantity: qty, totalVnd: lineTotal, paidVnd: paidVnd.toString() } };
      await client.query(
        `UPDATE idempotency_records SET response_status = 201, response_body = $4::jsonb, completed_at = now()
         WHERE store_id = $1 AND actor_user_id = $2 AND idempotency_key = $3`,
        [storeId, auth.userId, idempotencyKey, JSON.stringify(response)]
      );
      return { status: 201, body: response, replayed: false };
    });
    if (outcome.replayed) reply.header('idempotent-replayed', 'true');
    return reply.code(outcome.status).send(outcome.body);
  });
}

module.exports = { registerPurchaseRoutes };
