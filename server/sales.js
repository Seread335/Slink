'use strict';

const { createHash } = require('node:crypto');
const { ApiError, authenticate, requireCsrf } = require('./auth');
const { UUID_PATTERN, withStore } = require('./db');
const { lockActiveCashSession } = require('./cash-register');

const MAX_BIGINT = 9223372036854775807n;
const SELL_ROLES = new Set(['owner', 'manager', 'cashier']);
const METHODS = new Set(['cash', 'bank_transfer', 'bank_qr', 'card', 'other']);

function amount(value, label) {
  const text = typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : value;
  if (typeof text !== 'string' && typeof text !== 'number') throw new ApiError(400, 'validation_error', `${label} không hợp lệ.`);
  const digits = String(text);
  if (!/^(0|[1-9]\d{0,18})$/.test(digits)) throw new ApiError(400, 'validation_error', `${label} phải là số VND nguyên không âm.`);
  const parsed = BigInt(digits);
  if (parsed > MAX_BIGINT) throw new ApiError(400, 'validation_error', `${label} vượt giới hạn lưu trữ.`);
  return parsed;
}

function quantityMilli(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 1_000_000_000) {
    throw new ApiError(400, 'validation_error', 'Số lượng phải lớn hơn 0 và tối đa 3 chữ số thập phân.');
  }
  const milli = Math.round(value * 1000);
  if (!Number.isSafeInteger(milli) || Math.abs(value - milli / 1000) > 1e-9) {
    throw new ApiError(400, 'validation_error', 'Số lượng chỉ được có tối đa 3 chữ số thập phân.');
  }
  return milli;
}

function quantityText(milli) {
  const whole = Math.floor(milli / 1000);
  const fraction = milli % 1000;
  return fraction ? `${whole}.${String(fraction).padStart(3, '0').replace(/0+$/, '')}` : String(whole);
}

function requestHash(value) {
  return createHash('sha256').update(JSON.stringify(value, (_key, entry) => typeof entry === 'bigint' ? entry.toString() : entry)).digest();
}

function normalizeSale(body) {
  if (!body || !Array.isArray(body.items) || body.items.length < 1 || body.items.length > 100) {
    throw new ApiError(400, 'validation_error', 'Đơn hàng cần có từ 1 đến 100 dòng sản phẩm.');
  }
  const items = [];
  const indices = new Map();
  for (const line of body.items) {
    if (!line || typeof line.productId !== 'string' || !UUID_PATTERN.test(line.productId)) {
      throw new ApiError(400, 'validation_error', 'Có sản phẩm không hợp lệ trong đơn hàng.');
    }
    const milli = quantityMilli(line.quantity);
    if (indices.has(line.productId)) {
      const index = indices.get(line.productId);
      items[index].quantityMilli += milli;
      if (!Number.isSafeInteger(items[index].quantityMilli)) throw new ApiError(400, 'validation_error', 'Số lượng sản phẩm vượt giới hạn.');
    } else {
      indices.set(line.productId, items.length);
      items.push({ productId: line.productId, quantityMilli: milli });
    }
  }
  const discountVnd = amount(body.discountVnd ?? 0, 'Khoản giảm giá');
  const rawTenders = body.tenders === undefined
    ? [{ method: body.method || 'cash', amountReceivedVnd: body.amountReceivedVnd }]
    : body.tenders;
  if (!Array.isArray(rawTenders) || rawTenders.length > 5) {
    throw new ApiError(400, 'validation_error', 'Đơn hàng cần tối đa 5 khoản thanh toán.');
  }
  const tenders = [];
  const methods = new Set();
  let amountReceivedVnd = 0n;
  for (const entry of rawTenders) {
    if (!entry || typeof entry !== 'object' || !METHODS.has(entry.method)) {
      throw new ApiError(400, 'validation_error', 'Phương thức thanh toán không hợp lệ.');
    }
    const amountReceived = amount(entry.amountReceivedVnd, 'Số tiền nhận');
    if (amountReceived === 0n) continue;
    if (methods.has(entry.method)) throw new ApiError(400, 'validation_error', 'Mỗi phương thức chỉ được nhập một khoản.');
    methods.add(entry.method);
    amountReceivedVnd += amountReceived;
    if (amountReceivedVnd > MAX_BIGINT) throw new ApiError(400, 'validation_error', 'Tổng tiền nhận vượt giới hạn lưu trữ.');
    tenders.push({ method: entry.method, amountReceivedVnd: amountReceived });
  }
  const method = tenders.length === 1 ? tenders[0].method : (tenders.length > 1 ? null : (body.method || 'cash'));
  if (method !== null && !METHODS.has(method)) throw new ApiError(400, 'validation_error', 'Phương thức thanh toán không hợp lệ.');
  const customerId = body.customerId || null;
  if (customerId !== null && (typeof customerId !== 'string' || !UUID_PATTERN.test(customerId))) {
    throw new ApiError(400, 'validation_error', 'Khách hàng không hợp lệ.');
  }
  const note = typeof body.note === 'string' ? body.note.trim() : '';
  if (note.length > 500) throw new ApiError(400, 'validation_error', 'Ghi chú tối đa 500 ký tự.');
  return { items, discountVnd, amountReceivedVnd, method, tenders, customerId, note };
}

function distributeDiscount(lines, discount, subtotal) {
  if (discount === 0n) return lines.map(() => 0n);
  let allocated = 0n;
  const shares = lines.map((line, index) => {
    const numerator = discount * line.grossVnd;
    const share = numerator / subtotal;
    allocated += share;
    return { index, share, remainder: numerator % subtotal };
  });
  let remainder = discount - allocated;
  shares.sort((a, b) => a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1);
  for (let i = 0; remainder > 0n; i += 1, remainder -= 1n) shares[i].share += 1n;
  shares.sort((a, b) => a.index - b.index);
  return shares.map((share) => share.share);
}

function registerSalesRoutes(app, { pool, env }) {
  app.post('/api/stores/:storeId/sales', async (request, reply) => {
    const auth = await authenticate(pool, request);
    requireCsrf(request, env);
    const { storeId } = request.params;
    if (!UUID_PATTERN.test(storeId)) throw new ApiError(400, 'validation_error', 'Cửa hàng không hợp lệ.');
    const idempotencyKey = request.headers['idempotency-key'];
    if (typeof idempotencyKey !== 'string' || idempotencyKey.length < 16 || idempotencyKey.length > 200) {
      throw new ApiError(400, 'idempotency_key_required', 'Thiếu mã lưu đơn an toàn. Hãy thử lại.');
    }
    const sale = normalizeSale(request.body);
    const canonicalSale = {
      items: sale.items,
      discountVnd: sale.discountVnd,
      amountReceivedVnd: sale.amountReceivedVnd,
      method: sale.method,
      customerId: sale.customerId,
      note: sale.note,
    };
    // Keep the original single-tender request hash stable so a pending sale
    // can still be safely retried by a client upgraded to this version.
    if (sale.tenders.length > 1) canonicalSale.tenders = sale.tenders;
    const canonicalHash = requestHash(canonicalSale);
    const result = await withStore(pool, auth.userId, storeId, async (client, membership) => {
      if (!SELL_ROLES.has(membership.role)) throw new ApiError(403, 'forbidden', 'Tài khoản này không có quyền tạo đơn hàng.');
      const reservedKey = await client.query(
        `INSERT INTO idempotency_records (store_id, actor_user_id, idempotency_key, request_hash)
         VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING RETURNING idempotency_key`,
        [storeId, auth.userId, idempotencyKey, canonicalHash]
      );
      if (!reservedKey.rowCount) {
        const previous = await client.query(
          `SELECT request_hash, response_status, response_body FROM idempotency_records
           WHERE store_id = $1 AND actor_user_id = $2 AND idempotency_key = $3 FOR UPDATE`,
          [storeId, auth.userId, idempotencyKey]
        );
        const record = previous.rows[0];
        if (!record || !Buffer.from(record.request_hash).equals(canonicalHash)) {
          throw new ApiError(409, 'idempotency_conflict', 'Mã lưu đơn đã được dùng cho dữ liệu khác. Hãy tải lại trước khi gửi đơn mới.');
        }
        if (!record.response_body || !record.response_status) {
          throw new ApiError(409, 'request_in_progress', 'Đơn hàng đang được xử lý. Hãy đợi một chút rồi kiểm tra lại.');
        }
        return { status: record.response_status, body: record.response_body, replayed: true };
      }

      if (sale.customerId) {
        const customer = await client.query(
          `SELECT id FROM customers WHERE store_id = $1 AND id = $2 AND status = 'active' FOR UPDATE`,
          [storeId, sale.customerId]
        );
        if (!customer.rowCount) throw new ApiError(404, 'customer_not_found', 'Không tìm thấy khách hàng đang hoạt động.');
      }

      const productIds = sale.items.map((line) => line.productId).sort();
      const productResult = await client.query(
        `SELECT id, sku, name, unit, sale_price_vnd::text AS sale_price_vnd,
                cost_vnd::text AS cost_vnd, inventory_tracked, status
         FROM products WHERE store_id = $1 AND id = ANY($2::uuid[]) ORDER BY id FOR UPDATE`,
        [storeId, productIds]
      );
      const productMap = new Map(productResult.rows.map((product) => [product.id, product]));
      if (productMap.size !== productIds.length || productResult.rows.some((product) => product.status !== 'active')) {
        throw new ApiError(409, 'product_unavailable', 'Có sản phẩm đã ngừng bán hoặc không còn trong cửa hàng. Hãy tải lại giỏ hàng.');
      }

      for (const productId of productIds) {
        const product = productMap.get(productId);
        if (!product.inventory_tracked) continue;
        const balance = await client.query(
          `SELECT on_hand::text AS on_hand, reserved::text AS reserved
           FROM inventory_balances WHERE store_id = $1 AND product_id = $2 FOR UPDATE`,
          [storeId, productId]
        );
        if (!balance.rowCount) throw new ApiError(409, 'inventory_unavailable', 'Chưa có số dư tồn kho cho một sản phẩm. Hãy cập nhật danh mục.');
        const line = sale.items.find((item) => item.productId === productId);
        const requested = BigInt(line.quantityMilli);
        const onHandMilli = BigInt(Math.round(Number(balance.rows[0].on_hand) * 1000));
        const reservedMilli = BigInt(Math.round(Number(balance.rows[0].reserved) * 1000));
        if (requested > onHandMilli - reservedMilli) {
          throw new ApiError(409, 'insufficient_stock', `${product.name} không đủ tồn kho để hoàn tất đơn.`);
        }
      }

      const lines = sale.items.map((line) => {
        const product = productMap.get(line.productId);
        const price = BigInt(product.sale_price_vnd);
        const cost = BigInt(product.cost_vnd);
        const grossVnd = (price * BigInt(line.quantityMilli) + 500n) / 1000n;
        return { ...line, product, price, cost, grossVnd };
      });
      const subtotal = lines.reduce((sum, line) => sum + line.grossVnd, 0n);
      if (subtotal > MAX_BIGINT || sale.discountVnd > subtotal) {
        throw new ApiError(400, 'validation_error', 'Khoản giảm giá không được vượt quá tiền hàng.');
      }
      const total = subtotal - sale.discountVnd;
      const nonCashReceived = sale.tenders.filter((tender) => tender.method !== 'cash')
        .reduce((sum, tender) => sum + tender.amountReceivedVnd, 0n);
      const cashTender = sale.tenders.find((tender) => tender.method === 'cash');
      const cashReceived = cashTender ? cashTender.amountReceivedVnd : 0n;
      if (nonCashReceived > total || (sale.amountReceivedVnd > total && cashReceived === 0n)) {
        throw new ApiError(400, 'validation_error', 'Chỉ tiền mặt mới được nhận dư để thối; tổng thanh toán không tiền mặt không được vượt tổng đơn.');
      }
      const cashApplied = cashReceived < (total - nonCashReceived) ? cashReceived : (total - nonCashReceived);
      const paid = nonCashReceived + cashApplied;
      if (paid < total && !sale.customerId) throw new ApiError(400, 'customer_required', 'Cần chọn khách hàng để ghi nhận phần còn nợ.');
      const change = sale.amountReceivedVnd - paid;
      const cashSessionId = cashReceived > 0n || change > 0n ? await lockActiveCashSession(client, storeId) : null;
      const appliedTenders = sale.tenders.map((tender) => ({
        method: tender.method,
        amountVnd: tender.method === 'cash' ? cashApplied : tender.amountReceivedVnd,
        amountReceivedVnd: tender.amountReceivedVnd,
      })).filter((tender) => tender.amountVnd > 0n);
      const allocatedDiscount = distributeDiscount(lines, sale.discountVnd, subtotal || 1n);

      const sequenceResult = await client.query(
        `UPDATE store_sequences SET next_order_number = next_order_number + 1
         WHERE store_id = $1 RETURNING next_order_number - 1 AS order_number`,
        [storeId]
      );
      if (!sequenceResult.rowCount) throw new Error('Store order sequence is missing.');
      const orderNumber = `SL-${sequenceResult.rows[0].order_number}`;
      const orderResult = await client.query(
        `INSERT INTO orders (store_id, order_number, customer_id, cashier_id, status, subtotal_vnd,
                             discount_vnd, tax_vnd, total_vnd, cash_received_vnd, cash_change_vnd, note)
         VALUES ($1, $2, $3, $4, 'completed', $5, $6, 0, $7, $8, $9, $10)
         RETURNING id, order_number, status, subtotal_vnd::text AS subtotal_vnd,
                   discount_vnd::text AS discount_vnd, total_vnd::text AS total_vnd,
                   cash_received_vnd::text AS cash_received_vnd, cash_change_vnd::text AS cash_change_vnd, occurred_at`,
        [storeId, orderNumber, sale.customerId, auth.userId, subtotal.toString(), sale.discountVnd.toString(),
          total.toString(), cashReceived.toString(), change.toString(), sale.note]
      );
      const order = orderResult.rows[0];
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        const lineTotal = line.grossVnd - allocatedDiscount[index];
        await client.query(
          `INSERT INTO order_lines (store_id, order_id, product_id, product_name_snapshot, sku_snapshot,
                                    unit_snapshot, quantity, unit_price_vnd, unit_cost_vnd, discount_vnd, line_total_vnd)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [storeId, order.id, line.product.id, line.product.name, line.product.sku, line.product.unit,
            quantityText(line.quantityMilli), line.price.toString(), line.cost.toString(), allocatedDiscount[index].toString(), lineTotal.toString()]
        );
        if (line.product.inventory_tracked) {
          await client.query(
            `UPDATE inventory_balances SET on_hand = on_hand - $3::numeric, version = version + 1, updated_at = now()
             WHERE store_id = $1 AND product_id = $2`,
            [storeId, line.product.id, quantityText(line.quantityMilli)]
          );
          const after = await client.query(
            'SELECT on_hand::text AS on_hand FROM inventory_balances WHERE store_id = $1 AND product_id = $2',
            [storeId, line.product.id]
          );
          await client.query(
            `INSERT INTO inventory_movements (store_id, product_id, movement_type, quantity_delta, quantity_after,
                                               reason, source_type, source_id, actor_user_id)
             VALUES ($1, $2, 'sale', -$3::numeric, $4::numeric, $5, 'order', $6, $7)`,
            [storeId, line.product.id, quantityText(line.quantityMilli), after.rows[0].on_hand,
              `Bán hàng ${orderNumber}`, order.id, auth.userId]
          );
        }
      }

      for (const tender of appliedTenders) {
        await client.query(
          `INSERT INTO payments (store_id, order_id, method, status, amount_vnd, recorded_by)
           VALUES ($1, $2, $3, 'succeeded', $4, $5)`,
          [storeId, order.id, tender.method, tender.amountVnd.toString(), auth.userId]
        );
      }
      for (const tender of sale.tenders) {
        await client.query(
          `INSERT INTO cash_movements (store_id, direction, category, amount_vnd, method, source_type, source_id, note, actor_user_id, cash_session_id)
           VALUES ($1, 'in', 'Bán hàng', $2, $3, 'order_payment', $4, $5, $6, $7)`,
          [storeId, tender.amountReceivedVnd.toString(), tender.method, order.id, `Thu đơn ${orderNumber}`, auth.userId, tender.method === 'cash' ? cashSessionId : null]
        );
      }
      if (change > 0n) {
        await client.query(
          `INSERT INTO cash_movements (store_id, direction, category, amount_vnd, method, source_type, source_id, note, actor_user_id, cash_session_id)
           VALUES ($1, 'out', 'Tiền thối', $2, 'cash', 'order_change', $3, $4, $5, $6)`,
          [storeId, change.toString(), order.id, `Thối tiền đơn ${orderNumber}`, auth.userId, cashSessionId]
        );
      }
      if (sale.customerId) {
        if (total > 0n) {
          await client.query(
            `INSERT INTO customer_ledger_entries (store_id, customer_id, entry_type, debit_vnd, source_type, source_id, note, actor_user_id)
             VALUES ($1, $2, 'sale_debit', $3, 'order', $4, $5, $6)`,
            [storeId, sale.customerId, total.toString(), order.id, `Đơn ${orderNumber}`, auth.userId]
          );
        }
        if (paid > 0n) {
          await client.query(
            `INSERT INTO customer_ledger_entries (store_id, customer_id, entry_type, credit_vnd, source_type, source_id, note, actor_user_id)
             VALUES ($1, $2, 'payment_credit', $3, 'order_payment', $4, $5, $6)`,
            [storeId, sale.customerId, paid.toString(), order.id, `Thu tiền đơn ${orderNumber}`, auth.userId]
          );
        }
      }
      await client.query(
        `INSERT INTO audit_events (store_id, actor_user_id, action, entity_type, entity_id, metadata)
         VALUES ($1, $2, 'sale.created', 'order', $3, $4::jsonb)`,
        [storeId, auth.userId, order.id, JSON.stringify({
          orderNumber,
          totalVnd: total.toString(),
          receivedVnd: sale.amountReceivedVnd.toString(),
          cashReceivedVnd: cashReceived.toString(),
          cashChangeVnd: change.toString(),
          payments: appliedTenders.map((tender) => ({ method: tender.method, amountVnd: tender.amountVnd.toString() })),
        })]
      );
      const body = {
        order: {
          id: order.id,
          number: order.order_number,
          status: order.status,
          subtotalVnd: order.subtotal_vnd,
          discountVnd: order.discount_vnd,
          totalVnd: order.total_vnd,
          paidVnd: paid.toString(),
          dueVnd: (total - paid).toString(),
          cashReceivedVnd: order.cash_received_vnd,
          changeVnd: change.toString(),
          payments: appliedTenders.map((tender) => ({ method: tender.method, amountVnd: tender.amountVnd.toString() })),
          occurredAt: order.occurred_at,
          items: lines.map((line, index) => ({
            productId: line.product.id,
            name: line.product.name,
            sku: line.product.sku,
            quantity: quantityText(line.quantityMilli),
            unitPriceVnd: line.price.toString(),
            discountVnd: allocatedDiscount[index].toString(),
            lineTotalVnd: (line.grossVnd - allocatedDiscount[index]).toString(),
          })),
        },
      };
      await client.query(
        `UPDATE idempotency_records SET response_status = 201, response_body = $4::jsonb, completed_at = now()
         WHERE store_id = $1 AND actor_user_id = $2 AND idempotency_key = $3`,
        [storeId, auth.userId, idempotencyKey, JSON.stringify(body)]
      );
      return { status: 201, body, replayed: false };
    });
    if (result.replayed) reply.header('idempotent-replayed', 'true');
    return reply.code(result.status).send(result.body);
  });
}

module.exports = { registerSalesRoutes, normalizeSale, quantityMilli, quantityText, distributeDiscount };
