import { NextRequest, NextResponse } from "next/server";
import { pgPool } from "../../../../lib/db";

export async function GET(req: NextRequest) {
  let client;
  try {
    client = await pgPool.connect();

    const result = await client.query(
      `
        SELECT
          o.order_code,
          o.status,
          o.total,
          o.notes,
          o.created_at,
          o.checked_out_at,
          COALESCE(
            json_agg(
              json_build_object(
                'id', oi.product_id,
                'name', oi.product_name,
                'category', oi.category,
                'selectedSize', oi.selected_size,
                'selectedTopping', oi.selected_topping,
                'selectedSauce', oi.selected_sauce,
                'price', oi.unit_price,
                'quantity', oi.quantity,
                'cartKey', oi.product_name || '-' || oi.selected_size || '-' || oi.selected_topping || '-' || oi.selected_sauce
              )
            ) FILTER (WHERE oi.id IS NOT NULL),
            '[]'::json
          ) AS items
        FROM orders o
        LEFT JOIN order_items oi ON oi.order_id = o.id
        GROUP BY o.id
        ORDER BY o.created_at DESC;
      `,
    );

    return NextResponse.json(
      {
        orders: result.rows.map((row) => ({
          orderCode: row.order_code as string,
          status: row.status as "saved" | "checkedout",
          total: Number(row.total),
          notes: row.notes as string | null,
          createdAt: row.created_at as string,
          checkedOutAt: row.checked_out_at as string | null,
          items: row.items,
        })),
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("Failed to list orders", err);
    return NextResponse.json(
      { error: "Failed to list orders" },
      { status: 500 },
    );
  } finally {
    if (client) {
      client.release();
    }
  }
}

