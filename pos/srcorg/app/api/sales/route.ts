import { NextRequest, NextResponse } from "next/server";
import   { pgPool }  from "../../../lib/db";

export async function GET(req: NextRequest) {
  let client;
  try {
    client = await pgPool.connect();

    const result = await client.query(
      `
        SELECT
          s.current_business_date AS business_date,
          COALESCE(d.total_revenue, 0) AS total_revenue,
          COALESCE(d.total_orders, 0)  AS total_orders,
          COALESCE(d.total_items, 0)   AS total_items,
          COALESCE(a.total_revenue, 0) AS all_time_revenue,
          COALESCE(a.total_orders, 0)  AS all_time_orders,
          COALESCE(a.total_items, 0)   AS all_time_items
        FROM store_state s
        LEFT JOIN daily_sales d
          ON d.sale_date = s.current_business_date
        LEFT JOIN all_time_sales a
          ON a.id = 1
        WHERE s.id = 1;
      `,
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        {
          businessDate: null,
          totalRevenue: 0,
          totalOrders: 0,
          totalItems: 0,
          allTimeRevenue: 0,
          allTimeOrders: 0,
          allTimeItems: 0,
        },
        { status: 200 },
      );
    }

    const row = result.rows[0];
    return NextResponse.json(
      {
        businessDate: row.business_date,
        totalRevenue: Number(row.total_revenue),
        totalOrders: Number(row.total_orders),
        totalItems: Number(row.total_items),
        allTimeRevenue: Number(row.all_time_revenue),
        allTimeOrders: Number(row.all_time_orders),
        allTimeItems: Number(row.all_time_items),
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("Failed to read sales summary", err);
    return NextResponse.json(
      { error: "Failed to read sales summary" },
      { status: 500 },
    );
  } finally {
    if (client) {
      client.release();
    }
  }
}

