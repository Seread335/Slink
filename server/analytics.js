'use strict';

const { ApiError, authenticate } = require('./auth');
const { UUID_PATTERN, withStore } = require('./db');
const ANALYTICS_ROLES = new Set(['owner', 'manager', 'accountant']);

function registerAnalyticsRoutes(app, { pool }) {
  app.get('/api/stores/:storeId/analytics', async (request) => {
    const auth = await authenticate(pool, request);
    const { storeId } = request.params;
    if (!UUID_PATTERN.test(storeId)) throw new ApiError(400, 'validation_error', 'Cửa hàng không hợp lệ.');
    const days = request.query?.days === '30' ? 30 : 7;
    return withStore(pool, auth.userId, storeId, async (client, membership) => {
      if (!ANALYTICS_ROLES.has(membership.role)) throw new ApiError(403, 'forbidden', 'Tài khoản này không có quyền xem báo cáo tài chính.');
      const [summary, daily, topProducts] = await Promise.all([
        client.query(
          `WITH bounds AS (
             SELECT timezone, (now() AT TIME ZONE timezone)::date AS end_date,
                    ((now() AT TIME ZONE timezone)::date - ($2::int - 1)) AS start_date
             FROM stores WHERE id = $1
           ), scoped AS (
             SELECT o.id, o.total_vnd, o.occurred_at,
                    COALESCE((SELECT SUM(r.refund_total_vnd) FROM returns r WHERE r.store_id = o.store_id AND r.order_id = o.id AND r.status = 'completed'), 0)::bigint AS returned_vnd,
                    COALESCE((SELECT SUM(p.amount_vnd) FROM payments p WHERE p.store_id = o.store_id AND p.order_id = o.id AND p.status = 'succeeded'), 0)::bigint AS paid_vnd,
                    COALESCE((SELECT SUM(f.amount_vnd) FROM refunds f JOIN returns r ON r.store_id = f.store_id AND r.id = f.return_id
                              WHERE r.store_id = o.store_id AND r.order_id = o.id AND r.status = 'completed' AND f.status = 'succeeded'), 0)::bigint AS refunded_vnd
             FROM orders o CROSS JOIN bounds b
             WHERE o.store_id = $1 AND o.status <> 'voided'
               AND o.occurred_at >= (b.start_date::timestamp AT TIME ZONE b.timezone)
               AND o.occurred_at < ((b.end_date + 1)::timestamp AT TIME ZONE b.timezone)
           ), margin AS (
             SELECT COALESCE(SUM(ol.line_total_vnd - COALESCE(r.returned_vnd, 0)
                       - (ol.unit_cost_vnd * ol.quantity)
                       + COALESCE(r.restocked_cost_vnd, 0)), 0)::text AS gross_profit_vnd
             FROM scoped o JOIN order_lines ol ON ol.store_id = $1 AND ol.order_id = o.id
             LEFT JOIN LATERAL (
               SELECT SUM(rl.refund_vnd)::bigint AS returned_vnd,
                      SUM(rl.restocked_quantity * ol.unit_cost_vnd)::numeric AS restocked_cost_vnd
               FROM return_lines rl JOIN returns ret ON ret.store_id = rl.store_id AND ret.id = rl.return_id
               WHERE rl.store_id = ol.store_id AND rl.order_line_id = ol.id AND ret.status = 'completed'
             ) r ON true
           )
           SELECT COUNT(*)::int AS order_count,
                  COALESCE(SUM(total_vnd - returned_vnd), 0)::text AS net_sales_vnd,
                  COALESCE(SUM(total_vnd), 0)::text AS gross_sales_vnd,
                  COALESCE(SUM(paid_vnd - refunded_vnd), 0)::text AS collected_vnd,
                  COALESCE(SUM(GREATEST(total_vnd - returned_vnd - paid_vnd + refunded_vnd, 0)), 0)::text AS receivable_vnd,
                  COALESCE(AVG(total_vnd - returned_vnd), 0)::numeric(20,2)::text AS average_ticket_vnd,
                  (SELECT gross_profit_vnd FROM margin) AS gross_profit_vnd,
                  (SELECT start_date::text FROM bounds) AS start_date,
                  (SELECT end_date::text FROM bounds) AS end_date
           FROM scoped`,
          [storeId, days]
        ),
        client.query(
          `WITH bounds AS (
             SELECT timezone, (now() AT TIME ZONE timezone)::date AS end_date,
                    ((now() AT TIME ZONE timezone)::date - ($2::int - 1)) AS start_date
             FROM stores WHERE id = $1
           ), dates AS (
             SELECT generate_series(start_date::timestamp, end_date::timestamp, interval '1 day')::date AS day, timezone FROM bounds
           ), scoped AS (
             SELECT o.id, o.store_id, o.total_vnd, o.occurred_at,
                    COALESCE((SELECT SUM(r.refund_total_vnd) FROM returns r WHERE r.store_id = o.store_id AND r.order_id = o.id AND r.status = 'completed'), 0)::bigint AS returned_vnd
             FROM orders o CROSS JOIN bounds b
             WHERE o.store_id = $1 AND o.status <> 'voided'
               AND o.occurred_at >= (b.start_date::timestamp AT TIME ZONE b.timezone)
               AND o.occurred_at < ((b.end_date + 1)::timestamp AT TIME ZONE b.timezone)
           )
           SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
                  COALESCE(SUM(o.total_vnd - o.returned_vnd), 0)::text AS sales_vnd,
                  COUNT(o.id)::int AS order_count
           FROM dates d LEFT JOIN scoped o ON (o.occurred_at AT TIME ZONE d.timezone)::date = d.day
           GROUP BY d.day ORDER BY d.day`,
          [storeId, days]
        ),
        client.query(
          `SELECT p.id, p.name, p.sku, p.unit,
                  COALESCE(SUM(ol.quantity - COALESCE(returns.returned_quantity, 0)), 0)::text AS quantity_sold,
                  COALESCE(SUM(ol.line_total_vnd - COALESCE(returns.returned_vnd, 0)), 0)::text AS net_sales_vnd
           FROM orders o JOIN order_lines ol ON ol.store_id = o.store_id AND ol.order_id = o.id
           JOIN products p ON p.store_id = ol.store_id AND p.id = ol.product_id
           CROSS JOIN LATERAL (SELECT timezone, (now() AT TIME ZONE timezone)::date AS end_date,
                               ((now() AT TIME ZONE timezone)::date - ($2::int - 1)) AS start_date FROM stores WHERE id = $1) bounds
           LEFT JOIN LATERAL (
             SELECT SUM(rl.quantity)::numeric AS returned_quantity, SUM(rl.refund_vnd)::bigint AS returned_vnd
             FROM return_lines rl JOIN returns r ON r.store_id = rl.store_id AND r.id = rl.return_id
             WHERE rl.store_id = ol.store_id AND rl.order_line_id = ol.id AND r.status = 'completed'
           ) returns ON true
           WHERE o.store_id = $1 AND o.status <> 'voided'
             AND o.occurred_at >= (bounds.start_date::timestamp AT TIME ZONE bounds.timezone)
             AND o.occurred_at < ((bounds.end_date + 1)::timestamp AT TIME ZONE bounds.timezone)
           GROUP BY p.id, p.name, p.sku, p.unit
           ORDER BY SUM(ol.line_total_vnd - COALESCE(returns.returned_vnd, 0)) DESC, p.name LIMIT 10`,
          [storeId, days]
        ),
      ]);
      const row = summary.rows[0];
      return {
        range: { from: row.start_date, to: row.end_date, days },
        summary: {
          orderCount: Number(row.order_count),
          netSalesVnd: row.net_sales_vnd,
          grossSalesVnd: row.gross_sales_vnd,
          collectedVnd: row.collected_vnd,
          receivableVnd: row.receivable_vnd,
          averageTicketVnd: row.average_ticket_vnd,
          grossProfitVnd: row.gross_profit_vnd,
        },
        days: daily.rows.map((item) => ({ date: item.day, salesVnd: item.sales_vnd, orderCount: Number(item.order_count) })),
        topProducts: topProducts.rows,
      };
    });
  });
}

module.exports = { registerAnalyticsRoutes };
