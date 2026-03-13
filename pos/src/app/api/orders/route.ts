import { NextRequest, NextResponse } from "next/server";
import { pgPool } from "../../../lib/db";

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
  orderCode: string;
  items: CartItemPayload[];
  total: number;
  notes?: string;
};

export async function POST(req: NextRequest) {
  let client;
  try {
    const body = (await req.json()) as SaveOrderBody;
    const { orderCode, items, total, notes } = body;

    if (!orderCode) {
      return NextResponse.json(
        { error: "orderCode is required" },
        { status: 400 },
      );
    }

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

    const orderStatus: "saved" = "saved";

    client = await pgPool.connect();
    await client.query("BEGIN");

    const orderInsert = await client.query(
      `
        INSERT INTO orders (order_code, status, total, notes, created_at, business_date)
        VALUES (
          $1,
          $2::varchar(20),
          $3,
          $4,
          NOW(),
          (SELECT current_business_date FROM store_state WHERE id = 1)
        )
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

