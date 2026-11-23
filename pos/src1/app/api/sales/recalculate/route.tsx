import { NextResponse } from "next/server";
import { pgPool } from "../../../../lib/db";

// POST /api/sales/recalculate — rebuilds daily_sales + all_time_sales from actual checkedout orders
export async function POST() {
  let client;
  try {
    client = await pgPool.connect();
    await client.query("BEGIN");

    // Rebuild daily_sales from scratch
    await client.query(`DELETE FROM daily_sales`);
    await client.query(`
      INSERT INTO daily_sales (sale_date, total_revenue, total_orders, total_items, updated_at)
      SELECT
        o.business_date,
        SUM(o.total),
        COUNT(*),
        COALESCE(SUM(oi.qty), 0),
        NOW()
      FROM orders o
      LEFT JOIN (
        SELECT order_id, SUM(quantity) AS qty FROM order_items GROUP BY order_id
      ) oi ON oi.order_id = o.id
      WHERE o.status = 'checkedout'
        AND o.business_date IS NOT NULL
      GROUP BY o.business_date
    `);

    // Rebuild all_time_sales from scratch
    await client.query(`DELETE FROM all_time_sales`);
    await client.query(`
      INSERT INTO all_time_sales (id, total_revenue, total_orders, total_items, updated_at)
      SELECT
        1,
        COALESCE(SUM(o.total), 0),
        COUNT(*),
        COALESCE(SUM(oi.qty), 0),
        NOW()
      FROM orders o
      LEFT JOIN (
        SELECT order_id, SUM(quantity) AS qty FROM order_items GROUP BY order_id
      ) oi ON oi.order_id = o.id
      WHERE o.status = 'checkedout'
    `);

    await client.query("COMMIT");
    return NextResponse.json({ success: true, message: "Sales totals recalculated from actual orders" }, { status: 200 });
  } catch (err) {
    if (client) await client.query("ROLLBACK");
    console.error("Failed to recalculate sales", err);
    return NextResponse.json({ error: "Failed to recalculate sales" }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}