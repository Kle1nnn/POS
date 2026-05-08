import { NextRequest, NextResponse } from "next/server";
import { pgPool } from "../../../lib/db";

type CartItemPayload = {
  id: string; name: string; category: string;
  selectedSize?: string; selectedTopping?: string; selectedSauce?: string;
  price: number; quantity: number;
};
type SaveOrderBody = {
  orderCode?: string; items: CartItemPayload[]; total: number; notes?: string;
  instructions?: string;
  status?: "saved" | "checkedout"; customerName?: string; customerPhone?: string;
  orderType?: string; tableNumber?: number | null;
  createdAtClient?: string;
};
type UpdateOrderBody = {
  orderCode: string;
  items: CartItemPayload[];
  total: number;
  notes?: string;
  instructions?: string;
};

async function ensureInstructionsColumn(client: any) {
  await client.query(
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS instructions text`,
  );
}

// Shared helper — recalculates daily_sales and all_time_sales from scratch
async function recalcSales(client: any, businessDate?: string | null) {
  // All-time
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
      SET total_revenue = EXCLUDED.total_revenue, total_orders = EXCLUDED.total_orders,
          total_items = EXCLUDED.total_items, updated_at = NOW()
  `);
  // Daily — recalculate the specific business date if known, otherwise all dates
  if (businessDate) {
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
        SET total_revenue = EXCLUDED.total_revenue, total_orders = EXCLUDED.total_orders,
            total_items = EXCLUDED.total_items, updated_at = NOW()
    `, [businessDate]);
  }
}

export async function PATCH(req: NextRequest) {
  let client;
  try {
    const { orderCode, items, total, notes, instructions } = (await req.json()) as UpdateOrderBody;
    if (!orderCode) return NextResponse.json({ error: "orderCode is required" }, { status: 400 });
    if (!items?.length) return NextResponse.json({ error: "Order must have at least one item" }, { status: 400 });

    client = await pgPool.connect();
    await ensureInstructionsColumn(client);
    await client.query("BEGIN");
    const orderResult = await client.query(
      `SELECT id, status, business_date FROM orders WHERE order_code = $1 FOR UPDATE`, [orderCode]
    );
    if (orderResult.rowCount === 0) { await client.query("ROLLBACK"); return NextResponse.json({ error: "Order not found" }, { status: 404 }); }
    const { id: orderId, status, business_date } = orderResult.rows[0];

    await client.query(`UPDATE orders SET total = $1, notes = $2, instructions = $3 WHERE id = $4`, [total, notes ?? null, instructions ?? null, orderId]);
    await client.query(`DELETE FROM order_items WHERE order_id = $1`, [orderId]);
    for (const item of items) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, category, selected_size, selected_topping, selected_sauce, unit_price, quantity)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [orderId, isNaN(Number(item.id)) ? null : Number(item.id), item.name, item.category ?? null,
         item.selectedSize ?? null, item.selectedTopping ?? null, item.selectedSauce ?? null, item.price, item.quantity]
      );
    }
    if (status === "checkedout") {
      await recalcSales(client, business_date);
    }
    await client.query("COMMIT");
    return NextResponse.json({ success: true, orderCode }, { status: 200 });
  } catch (err) {
    if (client) await client.query("ROLLBACK");
    console.error("[PATCH /api/orders] Error:", err);
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  } finally { if (client) client.release(); }
}

export async function POST(req: NextRequest) {
  let client;
  try {
    const { orderCode: provided, items, total, notes, instructions, status, customerName, customerPhone, orderType, tableNumber, createdAtClient } = (await req.json()) as SaveOrderBody;
    if (!items?.length) return NextResponse.json({ error: "Order must have at least one item" }, { status: 400 });
    if (total == null || isNaN(Number(total))) return NextResponse.json({ error: "Total is required" }, { status: 400 });

    const orderStatus: "saved" | "checkedout" = status === "checkedout" ? "checkedout" : "saved";
    const orderCode = provided?.trim() || `TBT-${Date.now()}`;
    const createdAtValue =
      createdAtClient && !Number.isNaN(Date.parse(createdAtClient))
        ? createdAtClient
        : null;

    client = await pgPool.connect();
    await ensureInstructionsColumn(client);
    await client.query("BEGIN");
    const orderInsert = await client.query(
      `INSERT INTO orders (order_code, status, total, notes, instructions, customer_name, customer_phone, order_type, table_number,
         business_date, created_at, checked_out_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,
         (SELECT current_business_date FROM store_state WHERE id = 1),
         COALESCE($10::timestamptz, NOW()), CASE WHEN $2 = 'checkedout' THEN NOW() ELSE NULL END)
       RETURNING id`,
      [orderCode, orderStatus, total, notes ?? null, instructions ?? null, customerName ?? null, customerPhone ?? null, orderType ?? "Delivery", tableNumber ?? null, createdAtValue]
    );
    const orderId = orderInsert.rows[0].id;
    for (const item of items) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, category, selected_size, selected_topping, selected_sauce, unit_price, quantity)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [orderId, isNaN(Number(item.id)) ? null : Number(item.id), item.name, item.category ?? null,
         item.selectedSize ?? null, item.selectedTopping ?? null, item.selectedSauce ?? null, item.price, item.quantity]
      );
    }
    await client.query("COMMIT");
    return NextResponse.json({ orderId, orderCode, status: orderStatus }, { status: 201 });
  } catch (err) {
    if (client) await client.query("ROLLBACK");
    console.error("Error saving order", err);
    return NextResponse.json({ error: "Failed to save order" }, { status: 500 });
  } finally { if (client) client.release(); }
}

export async function DELETE(req: NextRequest) {
  let client;
  try {
    const orderCode = req.nextUrl.searchParams.get("orderCode");
    if (!orderCode) return NextResponse.json({ error: "orderCode is required" }, { status: 400 });

    client = await pgPool.connect();
    await client.query("BEGIN");

    const orderResult = await client.query(
      `SELECT id, status, business_date FROM orders WHERE order_code = $1 FOR UPDATE`, [orderCode]
    );
    if (orderResult.rowCount === 0) { await client.query("ROLLBACK"); return NextResponse.json({ error: "Order not found" }, { status: 404 }); }

    const { status, business_date } = orderResult.rows[0];

    await client.query(`DELETE FROM orders WHERE order_code = $1`, [orderCode]);

    // After deleting, recalculate from scratch — no more increment/decrement arithmetic
    if (status === "checkedout") {
      await recalcSales(client, business_date);
    }

    await client.query("COMMIT");
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    if (client) await client.query("ROLLBACK");
    console.error("Error deleting order", err);
    return NextResponse.json({ error: "Failed to delete order" }, { status: 500 });
  } finally { if (client) client.release(); }
}