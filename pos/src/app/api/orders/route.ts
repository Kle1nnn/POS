import { NextRequest, NextResponse } from "next/server";
import { pgPool }  from "../../../lib/db";

type CartItemPayload = {
  id: string;
  name: string;
  category: string;
  selectedSize?: string;
  selectedTopping?: string;
  selectedSauce?: string;
  price: number;
  quantity: number;
};

type SaveOrderBody = {
  orderCode?: string;
  items: CartItemPayload[];
  total: number;
  notes?: string;
  status?: "saved" | "checkedout";
};

export async function POST(req: NextRequest) {
  let client;
  try {
    const body = (await req.json()) as SaveOrderBody;
    const { orderCode: providedOrderCode, items, total, notes, status } = body;

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: "Order must have at least one item" },
        { status: 400 },
      );
    }

    if (total == null || Number.isNaN(Number(total))) {
      return NextResponse.json(
        { error: "Total is required and must be a number" },
        { status: 400 },
      );
    }

    const orderStatus: "saved" | "checkedout" =
      status === "checkedout" ? "checkedout" : "saved";
    const orderCode = providedOrderCode && providedOrderCode.trim().length > 0
      ? providedOrderCode
      : `ORD-${Date.now()}`;

    client = await pgPool.connect();
    await client.query("BEGIN");

    const orderInsert = await client.query(
      `
        INSERT INTO orders (order_code, status, total, notes, created_at, checked_out_at)
        VALUES ($1, $2, $3, $4, NOW(), CASE WHEN $2 = 'checkedout' THEN NOW() ELSE NULL END)
        RETURNING id;
      `,
      [orderCode, orderStatus, total, notes ?? null],
    );

    const orderId: number = orderInsert.rows[0].id;

    const insertItemText = `
      INSERT INTO order_items (
        order_id,
        product_id,
        product_name,
        category,
        selected_size,
        selected_topping,
        selected_sauce,
        unit_price,
        quantity
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
    `;

    for (const item of items) {
      const productId = Number.isNaN(Number(item.id))
        ? null
        : Number(item.id);
      await client.query(insertItemText, [
        orderId,
        productId,
        item.name,
        item.category ?? null,
        item.selectedSize ?? null,
        item.selectedTopping ?? null,
        item.selectedSauce ?? null,
        item.price,
        item.quantity,
      ]);
    }

    await client.query("COMMIT");

    return NextResponse.json(
      {
        orderId,
        orderCode,
        status: orderStatus,
      },
      { status: 201 },
    );
  } catch (err) {
    if (client) {
      await client.query("ROLLBACK");
    }
    console.error("Error saving order", err);
    return NextResponse.json(
      { error: "Failed to save order" },
      { status: 500 },
    );
  } finally {
    if (client) {
      client.release();
    }
  }
}

export async function DELETE(req: NextRequest) {
  let client;
  try {
    const orderCode = req.nextUrl.searchParams.get("orderCode");

    if (!orderCode) {
      return NextResponse.json(
        { error: "orderCode query param is required" },
        { status: 400 },
      );
    }

    client = await pgPool.connect();
    await client.query("BEGIN");

    // Read the order first so we can adjust aggregates if needed
    const orderResult = await client.query(
      `
        SELECT id, status, business_date, total
        FROM orders
        WHERE order_code = $1
        FOR UPDATE;
      `,
      [orderCode],
    );

    if (orderResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 },
      );
    }

    const orderRow = orderResult.rows[0] as {
      id: number;
      status: string;
      business_date: string | null;
      total: string | number;
    };

    // If this was a checkedout order, subtract its contribution from aggregates
    if (orderRow.status === "checkedout") {
      const orderId = orderRow.id;
      const businessDate = orderRow.business_date;
      const orderTotal = Number(orderRow.total) || 0;

      const itemsResult = await client.query(
        `
          SELECT COALESCE(SUM(quantity), 0) AS item_count
          FROM order_items
          WHERE order_id = $1;
        `,
        [orderId],
      );
      const itemCount = Number(itemsResult.rows[0]?.item_count || 0);

      if (businessDate) {
        await client.query(
          `
            UPDATE daily_sales
            SET total_revenue = GREATEST(0, total_revenue - $1),
                total_orders  = GREATEST(0, total_orders - 1),
                total_items   = GREATEST(0, total_items - $2),
                updated_at    = NOW()
            WHERE sale_date = $3::date;
          `,
          [orderTotal, itemCount, businessDate],
        );
      }

      await client.query(
        `
          UPDATE all_time_sales
          SET total_revenue = GREATEST(0, total_revenue - $1),
              total_orders  = GREATEST(0, total_orders - 1),
              total_items   = GREATEST(0, total_items - $2),
              updated_at    = NOW()
          WHERE id = 1;
        `,
        [orderTotal, itemCount],
      );
    }

    const result = await client.query(
      `
        DELETE FROM orders
        WHERE order_code = $1
        RETURNING id;
      `,
      [orderCode],
    );

    await client.query("COMMIT");

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    if (client) {
      await client.query("ROLLBACK");
    }
    console.error("Error deleting order", err);
    return NextResponse.json(
      { error: "Failed to delete order" },
      { status: 500 },
    );
  } finally {
    if (client) {
      client.release();
    }
  }
}

