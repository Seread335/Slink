'use strict';

const { createHash, randomUUID } = require('node:crypto');
const { ApiError, authenticate, requireCsrf } = require('./auth');
const { UUID_PATTERN, withStore } = require('./db');

const EDIT_ROLES = new Set(['owner', 'manager', 'stockkeeper']);
const MAX_VND = Number.MAX_SAFE_INTEGER;

function requireEditor(role) {
  if (!EDIT_ROLES.has(role)) throw new ApiError(403, 'forbidden', 'Tài khoản này không có quyền quản lý sản phẩm.');
}

function validateProduct(input, { partial = false } = {}) {
  const source = input || {};
  const values = {};
  const textFields = [
    ['sku', 1, 80], ['name', 1, 240], ['category', 1, 120], ['unit', 1, 40],
  ];
  for (const [key, min, max] of textFields) {
    if (partial && source[key] === undefined) continue;
    const defaultValue = key === 'category' ? 'Chưa phân loại' : key === 'unit' ? 'cái' : '';
    const value = typeof source[key] === 'string' ? source[key].trim() : (!partial ? defaultValue : '');
    if (value.length < min || value.length > max) throw new ApiError(400, 'validation_error', 'Hãy kiểm tra mã, tên, danh mục và đơn vị sản phẩm.');
    values[key] = value;
  }
  for (const key of ['salePriceVnd', 'costVnd']) {
    if (partial && source[key] === undefined) continue;
    const value = source[key] === undefined && !partial ? 0 : source[key];
    if (!Number.isSafeInteger(value) || value < 0 || value > MAX_VND) throw new ApiError(400, 'validation_error', 'Giá bán và giá vốn phải là số VND nguyên không âm.');
    values[key] = value;
  }
  if (!partial || source.lowStockThreshold !== undefined) {
    const thresholdText = String(source.lowStockThreshold ?? 0);
    const thresholdMatch = /^(\d{1,11})(?:\.(\d{1,3}))?$/.exec(thresholdText);
    const threshold = Number(thresholdText);
    if (!thresholdMatch || !Number.isFinite(threshold) || threshold < 0) {
      throw new ApiError(400, 'validation_error', 'Ngưỡng tồn kho phải là số lượng không âm, tối đa 3 chữ số thập phân.');
    }
    values.lowStockThreshold = threshold;
  }
  if (!partial || source.barcode !== undefined) {
    const barcode = source.barcode === undefined || source.barcode === null || source.barcode === '' ? null : String(source.barcode).trim();
    if (barcode !== null && (barcode.length < 3 || barcode.length > 80)) throw new ApiError(400, 'validation_error', 'Mã vạch phải có từ 3 đến 80 ký tự.');
    values.barcode = barcode;
  }
  if (!partial || source.inventoryTracked !== undefined) {
    const tracked = source.inventoryTracked ?? true;
    if (typeof tracked !== 'boolean') throw new ApiError(400, 'validation_error', 'Cấu hình theo dõi tồn kho không hợp lệ.');
    values.inventoryTracked = tracked;
  }
  return values;
}

function conflict(error) {
  if (error.code === '23505') throw new ApiError(409, 'product_conflict', 'Mã sản phẩm hoặc mã vạch đã được sử dụng trong cửa hàng này.');
  throw error;
}

function validateImportRows(input) {
  if (!Array.isArray(input) || input.length < 1 || input.length > 200) {
    throw new ApiError(400, 'validation_error', 'Tệp nhập cần có từ 1 đến 200 dòng sản phẩm.');
  }
  const seenSkus = new Map();
  const seenBarcodes = new Map();
  return input.map((row, index) => {
    const line = Number.isSafeInteger(row?.sourceLine) && row.sourceLine >= 2 && row.sourceLine <= 1_000_000
      ? row.sourceLine
      : index + 2;
    if (!row || typeof row !== 'object' || Array.isArray(row) || !Object.hasOwn(row, 'salePriceVnd')) {
      throw new ApiError(400, 'validation_error', `Dòng ${line}: cần khai báo giá bán VND nguyên không âm.`);
    }
    let product;
    try {
      product = validateProduct(row);
    } catch (error) {
      throw new ApiError(400, 'validation_error', `Dòng ${line}: ${error.message}`);
    }
    const rawOpeningQuantity = row?.openingQuantity === undefined || row.openingQuantity === '' ? '0' : String(row.openingQuantity).trim();
    const quantityMatch = /^(\d{1,10})(?:\.(\d{1,3}))?$/.exec(rawOpeningQuantity);
    const openingQuantity = Number(rawOpeningQuantity);
    if (!quantityMatch || !Number.isFinite(openingQuantity) || openingQuantity < 0 || openingQuantity > 9_999_999_999.999) {
      throw new ApiError(400, 'validation_error', `Dòng ${line}: tồn đầu kỳ phải không âm và có tối đa 3 chữ số thập phân.`);
    }
    if (!product.inventoryTracked && openingQuantity !== 0) {
      throw new ApiError(400, 'validation_error', `Dòng ${line}: sản phẩm không theo dõi tồn kho phải có tồn đầu kỳ bằng 0.`);
    }
    const normalizedSku = product.sku.toLocaleLowerCase('vi');
    if (seenSkus.has(normalizedSku)) throw new ApiError(400, 'duplicate_import_sku', `Dòng ${line}: mã SKU bị trùng với dòng ${seenSkus.get(normalizedSku)} trong tệp.`);
    seenSkus.set(normalizedSku, line);
    if (product.barcode !== null) {
      if (seenBarcodes.has(product.barcode)) throw new ApiError(400, 'duplicate_import_barcode', `Dòng ${line}: mã vạch bị trùng với dòng ${seenBarcodes.get(product.barcode)} trong tệp.`);
      seenBarcodes.set(product.barcode, line);
    }
    const wholeQuantity = quantityMatch[1].replace(/^0+(?=\d)/, '');
    const fractionQuantity = (quantityMatch[2] || '').replace(/0+$/, '');
    const openingQuantityText = wholeQuantity + (fractionQuantity ? `.${fractionQuantity}` : '');
    return { ...product, openingQuantity, openingQuantityText, sourceLine: line };
  });
}

function describeImportConflict(products, existingRows) {
  if (!existingRows.length) return null;
  const skuConflicts = new Map(existingRows.map((product) => [product.sku_normalized, product.sku]));
  const barcodeConflicts = new Set(existingRows.map((product) => product.barcode).filter(Boolean));
  const conflictProduct = products.find((product) => skuConflicts.has(product.sku.toLocaleLowerCase('vi')) || (product.barcode && barcodeConflicts.has(product.barcode)));
  if (!conflictProduct) return null;
  const normalizedSku = conflictProduct.sku.toLocaleLowerCase('vi');
  const conflictingValue = skuConflicts.has(normalizedSku)
    ? `SKU ${skuConflicts.get(normalizedSku)}`
    : `mã vạch ${conflictProduct.barcode}`;
  return `Dòng ${conflictProduct.sourceLine}: ${conflictingValue} đã có trong cửa hàng. Không có dòng nào được nhập.`;
}

function registerProductRoutes(app, { pool, env }) {
  app.get('/api/stores/:storeId/products', async (request) => {
    const auth = await authenticate(pool, request);
    const { storeId } = request.params;
    if (!UUID_PATTERN.test(storeId)) throw new ApiError(400, 'validation_error', 'Cửa hàng không hợp lệ.');
    const limit = Math.min(Math.max(Number.parseInt(request.query?.limit || '50', 10) || 50, 1), 100);
    const offset = Math.min(Math.max(Number.parseInt(request.query?.offset || '0', 10) || 0, 0), 10000);
    const search = typeof request.query?.q === 'string' ? request.query.q.trim().slice(0, 120) : '';
    const status = request.query?.status === 'archived' ? 'archived' : 'active';
    return withStore(pool, auth.userId, storeId, async (client, membership) => {
      const canViewCost = ['owner', 'manager', 'stockkeeper', 'accountant'].includes(membership.role);
      const result = await client.query(
        `SELECT p.id, p.sku, p.barcode, p.name, p.category, p.unit,
                p.sale_price_vnd::text AS sale_price_vnd,
                CASE WHEN $5::boolean THEN p.cost_vnd::text ELSE NULL END AS cost_vnd,
                p.low_stock_threshold::text AS low_stock_threshold, p.inventory_tracked,
                p.status, p.version, COALESCE(i.on_hand, 0)::text AS on_hand,
                COALESCE(i.reserved, 0)::text AS reserved, COALESCE(i.version, 1)::int AS inventory_version,
                p.updated_at, COUNT(*) OVER()::int AS total_count
         FROM products p
         LEFT JOIN inventory_balances i ON i.store_id = p.store_id AND i.product_id = p.id
         WHERE p.status = $1 AND ($2 = '' OR p.name ILIKE '%' || $2 || '%' OR p.sku_normalized LIKE '%' || lower($2) || '%' OR p.barcode = $2)
         ORDER BY p.name, p.id LIMIT $3 OFFSET $4`,
        [status, search, limit + 1, offset, canViewCost]
      );
      const hasMore = result.rows.length > limit;
      return { products: result.rows.slice(0, limit), total: Number(result.rows[0]?.total_count || 0), nextOffset: hasMore ? offset + limit : null };
    });
  });

  app.post('/api/stores/:storeId/products/import', async (request, reply) => {
    const auth = await authenticate(pool, request);
    requireCsrf(request, env);
    const { storeId } = request.params;
    if (!UUID_PATTERN.test(storeId)) throw new ApiError(400, 'validation_error', 'Cửa hàng không hợp lệ.');
    const idempotencyKey = request.headers['idempotency-key'];
    if (typeof idempotencyKey !== 'string' || idempotencyKey.length < 16 || idempotencyKey.length > 200) {
      throw new ApiError(400, 'idempotency_key_required', 'Thiếu mã lưu thao tác an toàn. Hãy thử lại.');
    }
    const products = validateImportRows(request.body?.items);
    const requestHash = createHash('sha256').update(JSON.stringify(products)).digest();
    const importId = randomUUID();
    const skuValues = products.map((product) => product.sku.toLocaleLowerCase('vi'));
    const barcodeValues = products.map((product) => product.barcode).filter(Boolean);
    try {
      const outcome = await withStore(pool, auth.userId, storeId, async (client, membership) => {
        requireEditor(membership.role);
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
          if (!record || !Buffer.from(record.request_hash).equals(requestHash)) throw new ApiError(409, 'idempotency_conflict', 'Mã nhập đã được dùng cho bộ dữ liệu khác.');
          if (!record.response_body || !record.response_status) throw new ApiError(409, 'request_in_progress', 'Tệp nhập đang được xử lý. Hãy thử lại sau.');
          return { status: record.response_status, body: record.response_body, replayed: true };
        }

        const existing = await client.query(
          `SELECT sku, sku_normalized, barcode FROM products
           WHERE store_id = $1 AND (sku_normalized = ANY($2::text[]) OR barcode = ANY($3::text[]))`,
          [storeId, skuValues, barcodeValues]
        );
        const conflictMessage = describeImportConflict(products, existing.rows);
        if (conflictMessage) throw new ApiError(409, 'product_conflict', conflictMessage);

        const createdProducts = [];
        for (const product of products) {
          const inserted = await client.query(
            `INSERT INTO products (
               store_id, sku, sku_normalized, barcode, name, category, unit,
               sale_price_vnd, cost_vnd, low_stock_threshold, inventory_tracked, created_by
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             RETURNING id, sku, barcode, name, category, unit, sale_price_vnd::text AS sale_price_vnd,
                       cost_vnd::text AS cost_vnd, low_stock_threshold::text AS low_stock_threshold,
                       inventory_tracked, status, version, created_at`,
            [storeId, product.sku, product.sku.toLocaleLowerCase('vi'), product.barcode, product.name,
              product.category, product.unit, product.salePriceVnd, product.costVnd,
              product.lowStockThreshold, product.inventoryTracked, auth.userId]
          );
          const created = inserted.rows[0];
          const openingQuantity = product.openingQuantityText;
          await client.query(
            `INSERT INTO inventory_balances (store_id, product_id, on_hand) VALUES ($1, $2, $3::numeric)`,
            [storeId, created.id, openingQuantity]
          );
          if (product.costVnd > 0) {
            await client.query(
              `INSERT INTO product_cost_history (store_id, product_id, unit_cost_vnd, source_type, source_id, actor_user_id)
               VALUES ($1, $2, $3, 'opening_balance', $4, $5)`,
              [storeId, created.id, product.costVnd, importId, auth.userId]
            );
          }
          if (product.openingQuantity > 0) {
            await client.query(
              `INSERT INTO inventory_movements (store_id, product_id, movement_type, quantity_delta, quantity_after,
                                                 reason, source_type, source_id, actor_user_id)
               VALUES ($1, $2, 'opening', $3::numeric, $3::numeric, 'Tồn đầu kỳ khi nhập danh mục', 'opening_import', $4, $5)`,
              [storeId, created.id, openingQuantity, importId, auth.userId]
            );
          }
          await client.query(
            `INSERT INTO audit_events (store_id, actor_user_id, action, entity_type, entity_id, metadata)
             VALUES ($1, $2, 'product.created', 'product', $3, jsonb_build_object('sku', $4::text, 'openingQuantity', $5::text, 'importId', $6::text))`,
            [storeId, auth.userId, created.id, created.sku, openingQuantity, importId]
          );
          createdProducts.push({ ...created, on_hand: openingQuantity, reserved: '0', import_id: importId });
        }
        await client.query(
          `INSERT INTO audit_events (store_id, actor_user_id, action, entity_type, entity_id, metadata)
           VALUES ($1, $2, 'products.imported', 'product_import', $3, jsonb_build_object('count', $4::integer))`,
          [storeId, auth.userId, importId, createdProducts.length]
        );
        const body = { importId, count: createdProducts.length, products: createdProducts };
        await client.query(
          `UPDATE idempotency_records SET response_status = 201, response_body = $4::jsonb, completed_at = now()
           WHERE store_id = $1 AND actor_user_id = $2 AND idempotency_key = $3`,
          [storeId, auth.userId, idempotencyKey, JSON.stringify(body)]
        );
        return { status: 201, body, replayed: false };
      });
      if (outcome.replayed) reply.header('idempotent-replayed', 'true');
      return reply.code(outcome.status).send(outcome.body);
    } catch (error) {
      if (error.code === '23505') {
        const conflictMessage = await withStore(pool, auth.userId, storeId, async (client, membership) => {
          requireEditor(membership.role);
          const existing = await client.query(
            `SELECT sku, sku_normalized, barcode FROM products
             WHERE store_id = $1 AND (sku_normalized = ANY($2::text[]) OR barcode = ANY($3::text[]))`,
            [storeId, skuValues, barcodeValues]
          );
          return describeImportConflict(products, existing.rows);
        });
        if (conflictMessage) throw new ApiError(409, 'product_conflict', conflictMessage);
      }
      return conflict(error);
    }
  });

  app.post('/api/stores/:storeId/products', async (request) => {
    const auth = await authenticate(pool, request);
    requireCsrf(request, env);
    const { storeId } = request.params;
    if (!UUID_PATTERN.test(storeId)) throw new ApiError(400, 'validation_error', 'Cửa hàng không hợp lệ.');
    const product = validateProduct(request.body);
    try {
      return await withStore(pool, auth.userId, storeId, async (client, membership) => {
        requireEditor(membership.role);
        const inserted = await client.query(
          `INSERT INTO products (
             store_id, sku, sku_normalized, barcode, name, category, unit,
             sale_price_vnd, cost_vnd, low_stock_threshold, inventory_tracked, created_by
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           RETURNING id, sku, barcode, name, category, unit, sale_price_vnd::text AS sale_price_vnd,
                     cost_vnd::text AS cost_vnd, low_stock_threshold::text AS low_stock_threshold,
                     inventory_tracked, status, version, created_at`,
          [storeId, product.sku, product.sku.toLocaleLowerCase('vi'), product.barcode, product.name,
            product.category, product.unit, product.salePriceVnd, product.costVnd,
            product.lowStockThreshold, product.inventoryTracked, auth.userId]
        );
        const created = inserted.rows[0];
        await client.query('INSERT INTO inventory_balances (store_id, product_id, on_hand) VALUES ($1, $2, 0)', [storeId, created.id]);
        if (product.costVnd > 0) {
          await client.query(
            `INSERT INTO product_cost_history (store_id, product_id, unit_cost_vnd, source_type, actor_user_id)
             VALUES ($1, $2, $3, 'manual_adjustment', $4)`,
            [storeId, created.id, product.costVnd, auth.userId]
          );
        }
        await client.query(
          `INSERT INTO audit_events (store_id, actor_user_id, action, entity_type, entity_id, metadata)
           VALUES ($1, $2, 'product.created', 'product', $3, jsonb_build_object('sku', $4::text))`,
          [storeId, auth.userId, created.id, created.sku]
        );
        return { product: { ...created, on_hand: '0', reserved: '0' } };
      });
    } catch (error) {
      return conflict(error);
    }
  });

  app.put('/api/stores/:storeId/products/:productId', async (request) => {
    const auth = await authenticate(pool, request);
    requireCsrf(request, env);
    const { storeId, productId } = request.params;
    if (!UUID_PATTERN.test(storeId) || !UUID_PATTERN.test(productId)) throw new ApiError(400, 'validation_error', 'Cửa hàng hoặc sản phẩm không hợp lệ.');
    const expectedVersion = request.body?.version;
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) throw new ApiError(400, 'validation_error', 'Phiên bản sản phẩm không hợp lệ. Hãy tải lại danh sách.');
    const product = validateProduct(request.body, { partial: true });
    try {
      return await withStore(pool, auth.userId, storeId, async (client, membership) => {
        requireEditor(membership.role);
        const current = await client.query('SELECT * FROM products WHERE store_id = $1 AND id = $2 FOR UPDATE', [storeId, productId]);
        if (!current.rowCount || current.rows[0].status === 'archived') throw new ApiError(404, 'product_not_found', 'Không tìm thấy sản phẩm đang hoạt động.');
        if (current.rows[0].version !== expectedVersion) throw new ApiError(409, 'version_conflict', 'Sản phẩm đã được thay đổi trên thiết bị khác. Hãy tải lại rồi thử lại.');
        const old = current.rows[0];
        const next = {
          sku: product.sku ?? old.sku,
          barcode: product.barcode !== undefined ? product.barcode : old.barcode,
          name: product.name ?? old.name,
          category: product.category ?? old.category,
          unit: product.unit ?? old.unit,
          salePriceVnd: product.salePriceVnd ?? Number(old.sale_price_vnd),
          costVnd: product.costVnd ?? Number(old.cost_vnd),
          lowStockThreshold: product.lowStockThreshold ?? Number(old.low_stock_threshold),
          inventoryTracked: product.inventoryTracked ?? old.inventory_tracked,
        };
        const updated = await client.query(
          `UPDATE products SET sku = $3, sku_normalized = $4, barcode = $5, name = $6, category = $7, unit = $8,
               sale_price_vnd = $9, cost_vnd = $10, low_stock_threshold = $11, inventory_tracked = $12,
               version = version + 1, updated_at = now()
           WHERE store_id = $1 AND id = $2 AND version = $13
           RETURNING id, sku, barcode, name, category, unit, sale_price_vnd::text AS sale_price_vnd,
                     cost_vnd::text AS cost_vnd, low_stock_threshold::text AS low_stock_threshold,
                     inventory_tracked, status, version, updated_at`,
          [storeId, productId, next.sku, next.sku.toLocaleLowerCase('vi'), next.barcode, next.name, next.category,
            next.unit, next.salePriceVnd, next.costVnd, next.lowStockThreshold, next.inventoryTracked, expectedVersion]
        );
        if (next.costVnd !== Number(old.cost_vnd)) {
          await client.query(
            `INSERT INTO product_cost_history (store_id, product_id, unit_cost_vnd, source_type, actor_user_id)
             VALUES ($1, $2, $3, 'manual_adjustment', $4)`,
            [storeId, productId, next.costVnd, auth.userId]
          );
        }
        await client.query(
          `INSERT INTO audit_events (store_id, actor_user_id, action, entity_type, entity_id, metadata)
           VALUES ($1, $2, 'product.updated', 'product', $3, jsonb_build_object('version', $4::integer))`,
          [storeId, auth.userId, productId, updated.rows[0].version]
        );
        return { product: updated.rows[0] };
      });
    } catch (error) {
      return conflict(error);
    }
  });

  app.post('/api/stores/:storeId/products/:productId/archive', async (request, reply) => {
    const auth = await authenticate(pool, request);
    requireCsrf(request, env);
    const { storeId, productId } = request.params;
    if (!UUID_PATTERN.test(storeId) || !UUID_PATTERN.test(productId)) throw new ApiError(400, 'validation_error', 'Cửa hàng hoặc sản phẩm không hợp lệ.');
    const result = await withStore(pool, auth.userId, storeId, async (client, membership) => {
      requireEditor(membership.role);
      const updated = await client.query(
        `UPDATE products SET status = 'archived', version = version + 1, updated_at = now()
         WHERE store_id = $1 AND id = $2 AND status = 'active' RETURNING id, sku, name, status, version`,
        [storeId, productId]
      );
      if (!updated.rowCount) throw new ApiError(404, 'product_not_found', 'Không tìm thấy sản phẩm đang hoạt động.');
      await client.query(
        `INSERT INTO audit_events (store_id, actor_user_id, action, entity_type, entity_id)
         VALUES ($1, $2, 'product.archived', 'product', $3)`,
        [storeId, auth.userId, productId]
      );
      return { product: updated.rows[0] };
    });
    reply.code(200);
    return result;
  });
}

module.exports = { registerProductRoutes, validateProduct };
