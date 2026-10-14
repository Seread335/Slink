'use strict';

const { createHash, randomUUID } = require('node:crypto');
const { ApiError, authenticate, requireCsrf } = require('./auth');
const { UUID_PATTERN, withStore } = require('./db');

const MAX_BIGINT = 9223372036854775807n;
const VIEW_ROLES = new Set(['owner', 'manager', 'cashier', 'accountant']);
const OPERATE_ROLES = new Set(['owner', 'manager', 'cashier']);

function amount(value, label) {
  const text = typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : value;
  if (typeof text !== 'string' && typeof text !== 'number') throw new ApiError(400, 'validation_error', `${label} không hợp lệ.`);
  const digits = String(text);
  if (!/^(0|[1-9]\d{0,18})$/.test(digits)) throw new ApiError(400, 'validation_error', `${label} phải là VND nguyên không âm.`);
  const parsed = BigInt(digits);
  if (parsed > MAX_BIGINT) throw new ApiError(400, 'validation_error', `${label} vượt giới hạn lưu trữ.`);
  return parsed;
}

function digest(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest();
}

function requireIdempotencyKey(request) {
  const key = request.headers['idempotency-key'];
  if (typeof key !== 'string' || key.length < 16 || key.length > 200) {
    throw new ApiError(400, 'idempotency_key_required', 'Thiếu mã lưu ca an toàn. Hãy thử lại.');
  }
  return key;
}

async function reserveIdempotency(client, storeId, userId, key, requestDigest) {
  const reserved = await client.query(
    `INSERT INTO idempotency_records (store_id, actor_user_id, idempotency_key, request_hash)
     VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING RETURNING idempotency_key`,
    [storeId, userId, key, requestDigest]
  );
  if (reserved.rowCount) return null;
  const previous = await client.query(
    `SELECT request_hash, response_status, response_body FROM idempotency_records
     WHERE store_id = $1 AND actor_user_id = $2 AND idempotency_key = $3 FOR UPDATE`,
    [storeId, userId, key]
  );
  const record = previous.rows[0];
  if (!record || !Buffer.from(record.request_hash).equals(requestDigest)) {
    throw new ApiError(409, 'idempotency_conflict', 'Mã lưu ca đã được dùng cho nội dung khác.');
  }
  if (!record.response_body || !record.response_status) throw new ApiError(409, 'request_in_progress', 'Ca đang được xử lý. Hãy kiểm tra lại sau.');
  return { status: record.response_status, body: record.response_body, replayed: true };
}

async function saveIdempotency(client, storeId, userId, key, status, body) {
  await client.query(
    `UPDATE idempotency_records SET response_status = $4, response_body = $5::jsonb, completed_at = now()
     WHERE store_id = $1 AND actor_user_id = $2 AND idempotency_key = $3`,
    [storeId, userId, key, status, JSON.stringify(body)]
  );
}

async function lockActiveCashSession(client, storeId, { cashOutVnd = 0n } = {}) {
  const result = await client.query(
    `SELECT id, opening_float_vnd::text AS opening_float_vnd
     FROM cash_register_sessions WHERE store_id = $1 AND status = 'open' FOR UPDATE`,
    [storeId]
  );
  if (!result.rowCount) throw new ApiError(409, 'cash_session_required', 'Hãy mở ca tiền mặt trước khi ghi giao dịch tiền mặt.');
  const session = result.rows[0];
  const requestedCashOut = BigInt(cashOutVnd);
  if (requestedCashOut > 0n) {
    const totals = await client.query(
      `SELECT COALESCE(SUM(amount_vnd) FILTER (WHERE direction = 'in' AND source_type <> 'cash_session_reconciliation'), 0)::text AS cash_in_vnd,
              COALESCE(SUM(amount_vnd) FILTER (WHERE direction = 'out' AND source_type <> 'cash_session_reconciliation'), 0)::text AS cash_out_vnd
       FROM cash_movements WHERE store_id = $1 AND cash_session_id = $2`,
      [storeId, session.id]
    );
    const availableCash = BigInt(session.opening_float_vnd)
      + BigInt(totals.rows[0].cash_in_vnd)
      - BigInt(totals.rows[0].cash_out_vnd);
    if (requestedCashOut > availableCash) {
      throw new ApiError(409, 'cash_balance_insufficient', 'Tiền trong ngăn kéo không đủ cho khoản chi này. Hãy kiểm quỹ hoặc chọn phương thức khác.');
    }
  }
  return session.id;
}

function registerCashRegisterRoutes(app, { pool, env }) {
  app.get('/api/stores/:storeId/cash-register', async (request) => {
    const auth = await authenticate(pool, request);
    const { storeId } = request.params;
    if (!UUID_PATTERN.test(storeId)) throw new ApiError(400, 'validation_error', 'Cửa hàng không hợp lệ.');
    return withStore(pool, auth.userId, storeId, async (client, membership) => {
      if (!VIEW_ROLES.has(membership.role)) throw new ApiError(403, 'forbidden', 'Tài khoản này không có quyền xem ca tiền mặt.');
      const active = await client.query(
        `SELECT s.id, s.opening_float_vnd::text AS opening_float_vnd, s.opened_at,
                s.opened_by, opener.display_name AS opened_by_name,
                COALESCE(SUM(c.amount_vnd) FILTER (WHERE c.direction = 'in' AND c.source_type <> 'cash_session_reconciliation'), 0)::text AS cash_in_vnd,
                COALESCE(SUM(c.amount_vnd) FILTER (WHERE c.direction = 'out' AND c.source_type <> 'cash_session_reconciliation'), 0)::text AS cash_out_vnd
         FROM cash_register_sessions s
         JOIN users opener ON opener.id = s.opened_by
         LEFT JOIN cash_movements c ON c.store_id = s.store_id AND c.cash_session_id = s.id
         WHERE s.store_id = $1 AND s.status = 'open'
         GROUP BY s.id, opener.display_name`,
        [storeId]
      );
      const lastClosed = await client.query(
        `SELECT id, opening_float_vnd::text AS opening_float_vnd, opened_at, closed_at,
                expected_cash_vnd::text AS expected_cash_vnd, counted_cash_vnd::text AS counted_cash_vnd,
                variance_vnd::text AS variance_vnd, close_note
         FROM cash_register_sessions WHERE store_id = $1 AND status = 'closed'
           AND ($2 <> 'cashier' OR opened_by = $3)
         ORDER BY closed_at DESC, id DESC LIMIT 1`,
        [storeId, membership.role, auth.userId]
      );
      const recentClosed = await client.query(
        `SELECT s.id, s.opening_float_vnd::text AS opening_float_vnd, s.opened_at, s.closed_at,
                opener.display_name AS opened_by_name, closer.display_name AS closed_by_name,
                s.expected_cash_vnd::text AS expected_cash_vnd, s.counted_cash_vnd::text AS counted_cash_vnd,
                s.variance_vnd::text AS variance_vnd, s.close_note,
                COALESCE(SUM(c.amount_vnd) FILTER (WHERE c.direction = 'in' AND c.source_type <> 'cash_session_reconciliation'), 0)::text AS cash_in_vnd,
                COALESCE(SUM(c.amount_vnd) FILTER (WHERE c.direction = 'out' AND c.source_type <> 'cash_session_reconciliation'), 0)::text AS cash_out_vnd
         FROM cash_register_sessions s
         JOIN users opener ON opener.id = s.opened_by
         JOIN users closer ON closer.id = s.closed_by
         LEFT JOIN cash_movements c ON c.store_id = s.store_id AND c.cash_session_id = s.id
         WHERE s.store_id = $1 AND s.status = 'closed'
           AND ($2 <> 'cashier' OR s.opened_by = $3)
         GROUP BY s.id, opener.display_name, closer.display_name
         ORDER BY s.closed_at DESC, s.id DESC LIMIT 10`,
        [storeId, membership.role, auth.userId]
      );
      const row = active.rows[0];
      return {
        session: row ? {
          id: row.id,
          status: 'open',
          openingFloatVnd: row.opening_float_vnd,
          openedAt: row.opened_at,
          openedBy: row.opened_by,
          openedByName: row.opened_by_name,
          cashInVnd: row.cash_in_vnd,
          cashOutVnd: row.cash_out_vnd,
          expectedCashVnd: (BigInt(row.opening_float_vnd) + BigInt(row.cash_in_vnd) - BigInt(row.cash_out_vnd)).toString(),
        } : null,
        lastClosed: lastClosed.rows[0] ? {
          id: lastClosed.rows[0].id,
          openingFloatVnd: lastClosed.rows[0].opening_float_vnd,
          openedAt: lastClosed.rows[0].opened_at,
          closedAt: lastClosed.rows[0].closed_at,
          expectedCashVnd: lastClosed.rows[0].expected_cash_vnd,
          countedCashVnd: lastClosed.rows[0].counted_cash_vnd,
          varianceVnd: lastClosed.rows[0].variance_vnd,
          closeNote: lastClosed.rows[0].close_note,
        } : null,
        recentClosed: recentClosed.rows.map((item) => ({
          id: item.id,
          openingFloatVnd: item.opening_float_vnd,
          openedAt: item.opened_at,
          closedAt: item.closed_at,
          openedByName: item.opened_by_name,
          closedByName: item.closed_by_name,
          cashInVnd: item.cash_in_vnd,
          cashOutVnd: item.cash_out_vnd,
          expectedCashVnd: item.expected_cash_vnd,
          countedCashVnd: item.counted_cash_vnd,
          varianceVnd: item.variance_vnd,
          closeNote: item.close_note,
        })),
        canOperate: OPERATE_ROLES.has(membership.role),
        canOpen: OPERATE_ROLES.has(membership.role) && !row,
        canClose: Boolean(row && OPERATE_ROLES.has(membership.role) && (membership.role !== 'cashier' || row.opened_by === auth.userId)),
      };
    });
  });

  app.post('/api/stores/:storeId/cash-register/open', async (request, reply) => {
    const auth = await authenticate(pool, request);
    requireCsrf(request, env);
    const { storeId } = request.params;
    if (!UUID_PATTERN.test(storeId)) throw new ApiError(400, 'validation_error', 'Cửa hàng không hợp lệ.');
    const key = requireIdempotencyKey(request);
    const openingFloat = amount(request.body?.openingFloatVnd, 'Tiền đầu ca');
    const value = { openingFloatVnd: openingFloat.toString() };
    const requestDigest = digest(value);
    const outcome = await withStore(pool, auth.userId, storeId, async (client, membership) => {
      if (!OPERATE_ROLES.has(membership.role)) throw new ApiError(403, 'forbidden', 'Tài khoản này không có quyền mở ca tiền mặt.');
      await client.query('SELECT id FROM stores WHERE id = $1 FOR UPDATE', [storeId]);
      const replay = await reserveIdempotency(client, storeId, auth.userId, key, requestDigest);
      if (replay) return replay;
      const open = await client.query("SELECT id FROM cash_register_sessions WHERE store_id = $1 AND status = 'open' FOR UPDATE", [storeId]);
      if (open.rowCount) throw new ApiError(409, 'cash_session_already_open', 'Cửa hàng đã có một ca tiền mặt đang mở. Hãy kiểm tra ca hiện tại.');
      const inserted = await client.query(
        `INSERT INTO cash_register_sessions (store_id, opened_by, opening_float_vnd)
         VALUES ($1, $2, $3) RETURNING id, opened_at`,
        [storeId, auth.userId, openingFloat.toString()]
      );
      const session = inserted.rows[0];
      await client.query(
        `INSERT INTO audit_events (store_id, actor_user_id, action, entity_type, entity_id, metadata)
         VALUES ($1, $2, 'cash_session.opened', 'cash_register_session', $3, jsonb_build_object('openingFloatVnd', $4::text))`,
        [storeId, auth.userId, session.id, openingFloat.toString()]
      );
      const body = { session: { id: session.id, status: 'open', openingFloatVnd: openingFloat.toString(), openedAt: session.opened_at } };
      await saveIdempotency(client, storeId, auth.userId, key, 201, body);
      return { status: 201, body, replayed: false };
    });
    if (outcome.replayed) reply.header('idempotent-replayed', 'true');
    return reply.code(outcome.status).send(outcome.body);
  });

  app.post('/api/stores/:storeId/cash-register/:sessionId/close', async (request, reply) => {
    const auth = await authenticate(pool, request);
    requireCsrf(request, env);
    const { storeId, sessionId } = request.params;
    if (!UUID_PATTERN.test(storeId) || !UUID_PATTERN.test(sessionId)) throw new ApiError(400, 'validation_error', 'Cửa hàng hoặc ca tiền mặt không hợp lệ.');
    const key = requireIdempotencyKey(request);
    const counted = amount(request.body?.countedCashVnd, 'Tiền mặt đã đếm');
    const note = typeof request.body?.note === 'string' ? request.body.note.trim() : '';
    if (note.length > 500) throw new ApiError(400, 'validation_error', 'Ghi chú chốt ca tối đa 500 ký tự.');
    const value = { sessionId, countedCashVnd: counted.toString(), note };
    const requestDigest = digest(value);
    const outcome = await withStore(pool, auth.userId, storeId, async (client, membership) => {
      if (!OPERATE_ROLES.has(membership.role)) throw new ApiError(403, 'forbidden', 'Tài khoản này không có quyền chốt ca tiền mặt.');
      const replay = await reserveIdempotency(client, storeId, auth.userId, key, requestDigest);
      if (replay) return replay;
      const locked = await client.query(
        `SELECT id, opened_by, opening_float_vnd::text AS opening_float_vnd
         FROM cash_register_sessions WHERE store_id = $1 AND id = $2 AND status = 'open' FOR UPDATE`,
        [storeId, sessionId]
      );
      if (!locked.rowCount) throw new ApiError(409, 'cash_session_not_open', 'Ca này đã được chốt hoặc không còn mở. Tải lại trạng thái ca.');
      const session = locked.rows[0];
      if (membership.role === 'cashier' && session.opened_by !== auth.userId) {
        throw new ApiError(403, 'forbidden', 'Thu ngân chỉ có thể chốt ca do chính mình mở.');
      }
      const movementTotals = await client.query(
        `SELECT COALESCE(SUM(amount_vnd) FILTER (WHERE direction = 'in' AND source_type <> 'cash_session_reconciliation'), 0)::text AS cash_in_vnd,
                COALESCE(SUM(amount_vnd) FILTER (WHERE direction = 'out' AND source_type <> 'cash_session_reconciliation'), 0)::text AS cash_out_vnd
         FROM cash_movements WHERE store_id = $1 AND cash_session_id = $2`,
        [storeId, sessionId]
      );
      const cashIn = BigInt(movementTotals.rows[0].cash_in_vnd);
      const cashOut = BigInt(movementTotals.rows[0].cash_out_vnd);
      const expected = BigInt(session.opening_float_vnd) + cashIn - cashOut;
      const variance = counted - expected;
      if (expected < -MAX_BIGINT || expected > MAX_BIGINT || variance < -MAX_BIGINT || variance > MAX_BIGINT) {
        throw new ApiError(409, 'cash_session_total_overflow', 'Tổng tiền ca vượt giới hạn lưu trữ. Hãy yêu cầu hỗ trợ trước khi chốt.');
      }
      if (variance !== 0n && note.length < 2) throw new ApiError(400, 'cash_variance_reason_required', 'Cần ghi rõ lý do khi tiền đếm được lệch với số dự kiến.');
      const adjustmentId = variance === 0n ? null : randomUUID();
      if (adjustmentId) {
        const amountVnd = (variance < 0n ? -variance : variance).toString();
        await client.query(
          `INSERT INTO cash_movements (store_id, direction, category, amount_vnd, method, source_type, source_id, note, actor_user_id, cash_session_id)
           VALUES ($1, $2, 'Chênh lệch chốt ca', $3, 'cash', 'cash_session_reconciliation', $4, $5, $6, $7)`,
          [storeId, variance > 0n ? 'in' : 'out', amountVnd, sessionId, note, auth.userId, sessionId]
        );
      }
      await client.query(
        `UPDATE cash_register_sessions
         SET status = 'closed', closed_by = $3, closed_at = now(), expected_cash_vnd = $4,
             counted_cash_vnd = $5, variance_vnd = $6, close_note = $7
         WHERE store_id = $1 AND id = $2`,
        [storeId, sessionId, auth.userId, expected.toString(), counted.toString(), variance.toString(), note]
      );
      await client.query(
        `INSERT INTO audit_events (store_id, actor_user_id, action, entity_type, entity_id, reason, metadata)
         VALUES ($1, $2, 'cash_session.closed', 'cash_register_session', $3, $4,
                 jsonb_build_object('expectedCashVnd', $5::text, 'countedCashVnd', $6::text, 'varianceVnd', $7::text, 'adjustmentId', $8::text))`,
        [storeId, auth.userId, sessionId, note, expected.toString(), counted.toString(), variance.toString(), adjustmentId]
      );
      const body = {
        session: {
          id: sessionId,
          status: 'closed',
          openingFloatVnd: session.opening_float_vnd,
          cashInVnd: cashIn.toString(),
          cashOutVnd: cashOut.toString(),
          expectedCashVnd: expected.toString(),
          countedCashVnd: counted.toString(),
          varianceVnd: variance.toString(),
          note,
          closedAt: new Date().toISOString(),
        },
      };
      await saveIdempotency(client, storeId, auth.userId, key, 201, body);
      return { status: 201, body, replayed: false };
    });
    if (outcome.replayed) reply.header('idempotent-replayed', 'true');
    return reply.code(outcome.status).send(outcome.body);
  });
}

module.exports = { lockActiveCashSession, registerCashRegisterRoutes };
