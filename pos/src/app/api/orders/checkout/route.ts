import { NextRequest, NextResponse } from "next/server";
import { pgPool } from "../../../../lib/db";

type CheckoutBody = { orderCode: string };

export async function POST(req: NextRequest) {
  let client;
  try {
    const { orderCode } = (await req.json()) as CheckoutBody;
    if (!orderCode) return NextResponse.json({ error: "orderCode is required" }, { status: 400 });

    client = await pgPool.connect();
    await client.query("BEGIN");

    // Flip to checkedout — guard ensures this is idempotent
    const result = await client.query(
      `UPDATE orders
       SET status = 'checkedout',
           checked_out_at = NOW(),
           business_date = (SELECT current_business_date FROM store_state WHERE id = 1)
       WHERE order_code = $1 AND status <> 'checkedout'
       RETURNING id, checked_out_at,
         (SELECT current_business_date FROM store_state WHERE id = 1) AS business_date`,
      [orderCode]
    );

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Order not found or already checked out" }, { status: 404 });
    }

    const { checked_out_at, business_date } = result.rows[0];

    // Recalculate all_time_sales from scratch — never increments, so can never double-count
    await client.query(`
      INSERT INTO all_time_sales (id, total_revenue, total_orders, total_items, updated_at)
      SELECT 1,
        COALESCE(SUM(o.total), 0), COUNT(DISTINCT o.id),
        COALESCE(SUM(oi.qty), 0), NOW()
      FROM orders o
      LEFT JOIN (SELECT order_id, SUM(quantity) AS qty FROM order_items GROUP BY order_id) oi
        ON oi.order_id = o.id
      WHERE o.status = 'checkedout'
      ON CONFLICT (id) DO UPDATE
        SET total_revenue = EXCLUDED.total_revenue,
            total_orders  = EXCLUDED.total_orders,
            total_items   = EXCLUDED.total_items,
            updated_at    = NOW()
    `);

    // Recalculate daily_sales for this business date from scratch
    if (business_date) {
      await client.query(`
        INSERT INTO daily_sales (sale_date, total_revenue, total_orders, total_items, updated_at)
        SELECT $1::date,
          COALESCE(SUM(o.total), 0), COUNT(DISTINCT o.id),
          COALESCE(SUM(oi.qty), 0), NOW()
        FROM orders o
        LEFT JOIN (SELECT order_id, SUM(quantity) AS qty FROM order_items GROUP BY order_id) oi
          ON oi.order_id = o.id
        WHERE o.status = 'checkedout' AND o.business_date = $1::date
        ON CONFLICT (sale_date) DO UPDATE
          SET total_revenue = EXCLUDED.total_revenue,
              total_orders  = EXCLUDED.total_orders,
              total_items   = EXCLUDED.total_items,
              updated_at    = NOW()
      `, [business_date]);
    }

    await client.query("COMMIT");
    return NextResponse.json({ status: "checkedout", checkedOutAt: checked_out_at }, { status: 200 });
  } catch (err) {
    if (client) await client.query("ROLLBACK");
    console.error("Error checking out order", err);
    return NextResponse.json({ error: "Failed to checkout order" }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}