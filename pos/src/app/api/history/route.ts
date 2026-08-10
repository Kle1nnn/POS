import { NextRequest, NextResponse } from "next/server";
import { pgPool } from "../../../lib/db";

async function ensureInstructionsColumn(client: any) {
  await client.query(
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS instructions text`,
  );
}

export async function GET(req: NextRequest) {
  let client;
  try {
    const businessDate = req.nextUrl.searchParams.get("businessDate");
    const receiptParam =
      req.nextUrl.searchParams.get("receipt")?.trim() ||
      req.nextUrl.searchParams.get("orderCode")?.trim() ||
      req.nextUrl.searchParams.get("q")?.trim() ||
      "";
    client = await pgPool.connect();
    await ensureInstructionsColumn(client);

    const whereParts = [`o.status = 'checkedout'`];
    const params: string[] = [];

    if (receiptParam) {
      params.push(`%${receiptParam}%`);
      const p = `$${params.length}`;
      whereParts.push(
        `(
          LOWER(o.order_code) LIKE LOWER(${p})
          OR LOWER(COALESCE(o.customer_name, '')) LIKE LOWER(${p})
          OR COALESCE(o.customer_phone, '') LIKE ${p}
        )`,
      );
    } else if (businessDate) {
      params.push(businessDate);
      whereParts.push(`o.business_date = $${params.length}::date`);
    }

    const queryText = `SELECT
           o.order_code,
           o.status,
           o.total,
           o.notes,
           o.instructions,
           o.customer_name,
           o.customer_phone,
           o.order_type,
           o.table_number,
           o.created_at,
           o.checked_out_at,
           COALESCE(
             json_agg(
               json_build_object(
                 'id',              oi.product_id,
                 'name',            oi.product_name,
                 'category',        oi.category,
                 'selectedSize',    oi.selected_size,
                 'selectedTopping', oi.selected_topping,
                 'selectedSauce',   oi.selected_sauce,
                 'price',           oi.unit_price,
                 'quantity',        oi.quantity,
                 'cartKey',         oi.product_name || '-' || COALESCE(oi.selected_size,'') || '-' || COALESCE(oi.selected_topping,'') || '-' || COALESCE(oi.selected_sauce,'')
               )
             ) FILTER (WHERE oi.id IS NOT NULL),
             '[]'::json
           ) AS items
         FROM orders o
         LEFT JOIN order_items oi ON oi.order_id = o.id
         WHERE ${whereParts.join(" AND ")}
         GROUP BY o.id
         ORDER BY COALESCE(o.checked_out_at, o.created_at) DESC
         LIMIT 100`;

    const result = await client.query(queryText, params);

    return NextResponse.json(
      {
        orders: result.rows.map((row) => ({
          orderCode:     row.order_code      as string,
          status:        row.status          as "checkedout",
          total:         Number(row.total),
          notes:         row.notes           as string | null,
          instructions:  row.instructions    as string | null,
          customerName:  row.customer_name   as string | null,
          customerPhone: row.customer_phone  as string | null,
          orderType:     row.order_type      as string | null,
          tableNumber:   row.table_number    as number | null,
          createdAt:     row.created_at      as string,
          checkedOutAt:  row.checked_out_at  as string | null,
          items:         row.items,
        })),
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Failed to list history", err);
    return NextResponse.json({ error: "Failed to list history" }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}