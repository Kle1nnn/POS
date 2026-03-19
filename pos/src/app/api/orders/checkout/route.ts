import { NextRequest, NextResponse } from "next/server";
import { pgPool } from "../../../../lib/db";

type CheckoutBody = { orderCode: string };

export async function POST(req: NextRequest) {
  let client;
  try {
    const { orderCode } = (await req.json()) as CheckoutBody;
    if (!orderCode) {
      return NextResponse.json({ error: "orderCode is required" }, { status: 400 });
    }

    client = await pgPool.connect();
    await client.query("BEGIN");

    // 1. Flip order to checkedout and stamp business_date from store_state
    const result = await client.query(
      `UPDATE orders
       SET status = 'checkedout',
           checked_out_at = NOW(),
           business_date = (SELECT current_business_date FROM store_state WHERE id = 1)
       WHERE order_code = $1
         AND status <> 'checkedout'
       RETURNING id, total, checked_out_at,
                 (SELECT current_business_date FROM store_state WHERE id = 1) AS business_date`,
      [orderCode]
    );

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Order not found or already checked out" }, { status: 404 });
    }

    const { id: orderId, total, checked_out_at, business_date } = result.rows[0];
    const orderTotal = Number(total) || 0;

    // 2. Count items for aggregates
    const itemsResult = await client.query(
      `SELECT COALESCE(SUM(quantity), 0) AS item_count FROM order_items WHERE order_id = $1`,
      [orderId]
    );
    const itemCount = Number(itemsResult.rows[0]?.item_count || 0);

    // 3. Upsert daily_sales
    if (business_date) {
      await client.query(
        `INSERT INTO daily_sales (sale_date, total_revenue, total_orders, total_items, updated_at)
         VALUES ($1::date, $2, 1, $3, NOW())
         ON CONFLICT (sale_date) DO UPDATE
           SET total_revenue = daily_sales.total_revenue + $2,
               total_orders  = daily_sales.total_orders + 1,
               total_items   = daily_sales.total_items + $3,
               updated_at    = NOW()`,
        [business_date, orderTotal, itemCount]
      );
    }

    // 4. Upsert all_time_sales
    await client.query(
      `INSERT INTO all_time_sales (id, total_revenue, total_orders, total_items, updated_at)
       VALUES (1, $1, 1, $2, NOW())
       ON CONFLICT (id) DO UPDATE
         SET total_revenue = all_time_sales.total_revenue + $1,
             total_orders  = all_time_sales.total_orders + 1,
             total_items   = all_time_sales.total_items + $2,
             updated_at    = NOW()`,
      [orderTotal, itemCount]
    );

    await client.query("COMMIT");

    return NextResponse.json(
      { orderId, status: "checkedout", checkedOutAt: checked_out_at },
      { status: 200 }
    );
  } catch (err) {
    if (client) await client.query("ROLLBACK");
    console.error("Error checking out order", err);
    return NextResponse.json({ error: "Failed to checkout order" }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}