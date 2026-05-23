import { NextRequest, NextResponse } from "next/server";
import { pgPool } from "../../../../lib/db";

export async function GET(req: NextRequest) {
  const businessDate = req.nextUrl.searchParams.get("businessDate")?.trim();
  if (!businessDate) {
    return NextResponse.json(
      { error: "businessDate is required" },
      { status: 400 },
    );
  }

  let client;
  try {
    client = await pgPool.connect();

    const result = await client.query(
      `SELECT
         oi.product_name,
         oi.category,
         oi.selected_size,
         oi.selected_topping,
         oi.selected_sauce,
         SUM(oi.quantity)::integer AS quantity_sold,
         SUM(oi.quantity * oi.unit_price)::numeric AS revenue
       FROM order_items oi
       INNER JOIN orders o ON o.id = oi.order_id
       WHERE o.status = 'checkedout'
         AND o.business_date = $1::date
       GROUP BY
         oi.product_name,
         oi.category,
         oi.selected_size,
         oi.selected_topping,
         oi.selected_sauce
       ORDER BY
         COALESCE(oi.category, '') ASC,
         quantity_sold DESC,
         oi.product_name ASC`,
      [businessDate],
    );

    const products = result.rows.map((row) => ({
      name: row.product_name as string,
      category: (row.category as string | null) ?? null,
      selectedSize: (row.selected_size as string | null) ?? null,
      selectedTopping: (row.selected_topping as string | null) ?? null,
      selectedSauce: (row.selected_sauce as string | null) ?? null,
      quantitySold: Number(row.quantity_sold),
      revenue: Number(row.revenue),
    }));

    const totalQuantity = products.reduce((sum, p) => sum + p.quantitySold, 0);
    const totalRevenue = products.reduce((sum, p) => sum + p.revenue, 0);

    return NextResponse.json(
      {
        businessDate,
        products,
        totalQuantity,
        totalRevenue,
        uniqueLineItems: products.length,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("Failed to load product sales", err);
    return NextResponse.json(
      { error: "Failed to load product sales" },
      { status: 500 },
    );
  } finally {
    if (client) client.release();
  }
}
