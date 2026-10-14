'use strict';

const { createHash } = require('node:crypto');
const { ApiError, authenticate, requireCsrf } = require('./auth');
const { UUID_PATTERN, withStore } = require('./db');

const STOCK_ROLES = new Set(['owner', 'manager', 'stockkeeper']);

function quantityMilli(value, label) {
  const text = typeof value === 'number' && Number.isFinite(value) ? String(value) : value;
  if (typeof text !== 'string' && typeof text !== 'number') throw new ApiError(400, 'validation_error', `${label} không hợp lệ.`);
  const match = /^(0|[1-9]\d{0,9})(?:\.(\d{1,3}))?$/.exec(String(text));
  if (!match) throw new ApiError(400, 'validation_error', `${label} phải không âm và có tối đa 3 chữ số thập phân.`);
  const fraction = (match[2] || '').padEnd(3, '0');
  return BigInt(match[1]) * 1000n + BigInt(fraction || '0');
}

function quantityText(milli) {
  const whole = milli / 1000n;
  const fraction = milli % 1000n;
  return fraction ? `${whole}.${String(fraction).padStart(3, '0').replace(/0+$/, '')}` : String(whole);
}

function registerStockRoutes(app, { pool, env }) {
  app.get('/api/stores/:storeId/inventory', async (request) => {
    const auth = await authenticate(pool, request);
    const { storeId } = request.params;
    if (!UUID_PATTERN.test(storeId)) throw new ApiError(400, 'validation_error', 'Cửa hàng không hợp lệ.');
    const requestedLimit = Number(request.query?.limit || 100);
    const requestedOffset = Number(request.query?.offset || 0);
    const limit = Number.isSafeInteger(requestedLimit) ? Math.max(1, Math.min(requestedLimit, 100)) : 100;
    const offset = Number.isSafeInteger(requestedOffset) ? Math.max(0, Math.min(requestedOffset, 1_000_000)) : 0;
    const search = typeof request.query?.q === 'string' ? request.query.q.trim().slice(0, 100) : '';
    return withStore(pool, auth.userId, storeId, async (client, membership) => {
      const canViewCost = ['owner', 'manager', 'stockkeeper', 'accountant'].includes(membership.role);
      const summaryResult = await client.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE b.on_hand <= p.low_stock_threshold)::int AS low_count,
                COUNT(*) FILTER (WHERE b.on_hand = 0)::int AS out_count,
                CASE WHEN $2::boolean THEN COALESCE(SUM(p.cost_vnd * b.on_hand), 0)::text ELSE NULL END AS stock_value_vnd
         FROM products p JOIN inventory_balances b ON b.store_id = p.store_id AND b.product_id = p.id
         WHERE p.store_id = $1 AND p.status = 'active'`,
        [storeId, canViewCost]
      );
      const rows = await client.query(
        `SELECT p.id, p.sku, p.barcode, p.name, p.category, p.unit,
                p.sale_price_vnd::text AS sale_price_vnd,
                CASE WHEN $5::boolean THEN p.cost_vnd::text ELSE NULL END AS cost_vnd,
                p.low_stock_threshold::text AS low_stock_threshold, p.inventory_tracked, p.status, p.version,
                b.on_hand::text AS on_hand, b.reserved::text AS reserved, b.version AS inventory_version,
                latest.movement_type AS latest_movement_type,
                latest.quantity_delta::text AS latest_quantity_delta,
                latest.reason AS latest_reason,
                latest.occurred_at AS latest_occurred_at,
                COUNT(*) OVER()::int AS total_count
         FROM products p JOIN inventory_balances b ON b.store_id = p.store_id AND b.product_id = p.id
         LEFT JOIN LATERAL (
           SELECT movement_type, quantity_delta, reason, occurred_at FROM inventory_movements m
           WHERE m.store_id = p.store_id AND m.product_id = p.id ORDER BY occurred_at DESC, id DESC LIMIT 1
         ) latest ON true
         WHERE p.store_id = $1 AND p.status = 'active'
           AND ($2 = '' OR p.name ILIKE '%' || $2 || '%' OR p.sku ILIKE '%' || $2 || '%' OR p.category ILIKE '%' || $2 || '%')
         ORDER BY p.name, p.id LIMIT $3 OFFSET $4`,
        [storeId, search, limit + 1, offset, canViewCost]
      );
      const hasMore = rows.rows.length > limit;
      return {
        products: rows.rows.slice(0, limit),
        total: Number(rows.rows[0]?.total_count || 0),
        nextOffset: hasMore ? offset + limit : null,
        summary: {
          total: Number(summaryResult.rows[0].total),
          low: Number(summaryResult.rows[0].low_count),
          out: Number(summaryResult.rows[0].out_count),
          stockValueVnd: summaryResult.rows[0].stock_value_vnd,
        },
        movements: rows.rows.slice(0, limit).filter((row) => row.latest_movement_type).map((row) => ({
          productId: row.id,
          type: row.latest_movement_type,
          delta: row.latest_quantity_delta,
          reason: row.latest_reason,
          createdAt: row.latest_occurred_at,
        })),
      };
    });
  });

  app.post('/api/stores/:storeId/stock-adjustments', async (request, reply) => {
    const auth = await authenticate(pool, request);
    requireCsrf(request, env);
    const { storeId } = request.params;
    if (!UUID_PATTERN.test(storeId)) throw new ApiError(400, 'validation_error', 'Cửa hàng không hợp lệ.');
    const idempotencyKey = request.headers['idempotency-key'];
    if (typeof idempotencyKey !== 'string' || idempotencyKey.length < 16 || idempotencyKey.length > 200) {
      throw new ApiError(400, 'idempotency_key_required', 'Thiếu mã lưu thao tác an toàn. Hãy thử lại.');
    }
    const body = request.body || {};
    if (typeof body.productId !== 'string' || !UUID_PATTERN.test(body.productId)) throw new ApiError(400, 'validation_error', 'Sản phẩm không hợp lệ.');
    const countMilli = quantityMilli(body.count, 'Số lượng kiểm kê');
    const expectedInventoryVersion = body.expectedInventoryVersion;
    if (!Number.isSafeInteger(expectedInventoryVersion) || expectedInventoryVersion < 1) throw new ApiError(400, 'validation_error', 'Phiên bản tồn kho không hợp lệ. Hãy tải lại danh sách.');
    const reason = typeof body.reason === 'string' ? body.reason.trim() : 'Kiểm kê thực tế';
    if (!reason || reason.length > 500) throw new ApiError(400, 'validation_error', 'Lý do điều chỉnh cần từ 1 đến 500 ký tự.');
    const value = { productId: body.productId, countMilli: countMilli.toString(), expectedInventoryVersion, reason };
    const digest = createHash('sha256').update(JSON.stringify(value)).digest();

    const outcome = await withStore(pool, auth.userId, storeId, async (client, membership) => {
      if (!STOCK_ROLES.has(membership.role)) throw new ApiError(403, 'forbidden', 'Tài khoản này không có quyền điều chỉnh tồn kho.');
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
        if (!record.response_body || !record.response_status) throw new ApiError(409, 'request_in_progress', 'Thao tác đang được xử lý. Hãy thử lại sau.');
        return { status: record.response_status, body: record.response_body, replayed: true };
      }

      const productResult = await client.query(
        `SELECT p.id, p.name, p.status, p.inventory_tracked, b.on_hand::text AS on_hand, b.reserved::text AS reserved, b.version AS inventory_version
         FROM products p JOIN inventory_balances b ON b.store_id = p.store_id AND b.product_id = p.id
         WHERE p.store_id = $1 AND p.id = $2 FOR UPDATE OF p, b`,
        [storeId, body.productId]
      );
      if (!productResult.rowCount || productResult.rows[0].status !== 'active') throw new ApiError(404, 'product_not_found', 'Không tìm thấy sản phẩm đang hoạt động.');
      const product = productResult.rows[0];
      if (Number(product.inventory_version) !== expectedInventoryVersion) throw new ApiError(409, 'inventory_version_conflict', 'Kho vừa thay đổi do một đơn bán hoặc thao tác khác. Hãy kiểm tra lại số lượng thực tế.');
      if (!product.inventory_tracked) throw new ApiError(409, 'inventory_not_tracked', 'Sản phẩm này không theo dõi tồn kho.');
      const previousMilli = quantityMilli(product.on_hand, 'Tồn kho hiện tại');
      const reservedMilli = quantityMilli(product.reserved, 'Số lượng đã giữ');
      if (countMilli < reservedMilli) throw new ApiError(409, 'reserved_stock', 'Số tồn mới không thể thấp hơn số lượng đã được giữ cho đơn hàng.');
      const deltaMilli = countMilli - previousMilli;
      if (deltaMilli === 0n) throw new ApiError(400, 'no_stock_change', 'Số tồn không thay đổi.');
      const count = quantityText(countMilli);
      const delta = `${deltaMilli < 0n ? '-' : ''}${quantityText(deltaMilli < 0n ? -deltaMilli : deltaMilli)}`;
      const updatedBalance = await client.query(
        `UPDATE inventory_balances SET on_hand = $3::numeric, version = version + 1, updated_at = now()
         WHERE store_id = $1 AND product_id = $2 RETURNING version`,
        [storeId, body.productId, count]
      );
      await client.query(
        `INSERT INTO inventory_movements (store_id, product_id, movement_type, quantity_delta, quantity_after,
                                           reason, source_type, actor_user_id)
         VALUES ($1, $2, $3, $4::numeric, $5::numeric, $6, 'stock_adjustment', $7)`,
        [storeId, body.productId, reason === 'Kiểm kê thực tế' ? 'count' : 'adjustment', delta, count, reason, auth.userId]
      );
      await client.query(
        `INSERT INTO audit_events (store_id, actor_user_id, action, entity_type, entity_id, reason, metadata)
         VALUES ($1, $2, 'inventory.adjusted', 'product', $3, $4, jsonb_build_object('previous', $5::text, 'counted', $6::text))`,
        [storeId, auth.userId, body.productId, reason, quantityText(previousMilli), count]
      );
      const response = { product: { id: body.productId, onHand: count, delta, version: Number(updatedBalance.rows[0].version) } };
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

module.exports = { registerStockRoutes };
