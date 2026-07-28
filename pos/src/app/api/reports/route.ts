import { NextRequest, NextResponse } from "next/server";
import { pgPool } from "../../../lib/db";

// GET /api/reports?type=daily|monthly|date&year=2026&month=7&date=2026-07-28
export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type") ?? "daily";
  const yearParam = req.nextUrl.searchParams.get("year");
  const monthParam = req.nextUrl.searchParams.get("month");
  const dateParam = req.nextUrl.searchParams.get("date")?.trim() ?? "";

  const now = new Date();
  const year = yearParam ? Number(yearParam) : now.getFullYear();
  const month = monthParam ? Number(monthParam) : now.getMonth() + 1;

  let client;
  try {
    client = await pgPool.connect();

    if (type === "date") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        return NextResponse.json(
          { error: "valid date (YYYY-MM-DD) is required" },
          { status: 400 },
        );
      }

      const salesResult = await client.query(
        `
        SELECT
          sale_date::text AS sale_date,
          total_revenue::float AS total_revenue,
          total_orders::int AS total_orders,
          total_items::int AS total_items
        FROM daily_sales
        WHERE sale_date = $1::date
        `,
        [dateParam],
      );

      const ordersResult = await client.query(
        `
        SELECT
          o.order_code,
          o.total,
          o.customer_name,
          o.order_type,
          o.table_number,
          COALESCE(o.checked_out_at, o.created_at) AS sold_at,
          COALESCE(
            (
              SELECT SUM(oi.quantity)::int
              FROM order_items oi
              WHERE oi.order_id = o.id
            ),
            0
          ) AS item_count
        FROM orders o
        WHERE o.status = 'checkedout'
          AND o.business_date = $1::date
        ORDER BY COALESCE(o.checked_out_at, o.created_at) DESC
        LIMIT 200
        `,
        [dateParam],
      );

      const row = salesResult.rows[0];
      const totals = row
        ? {
            totalRevenue: Number(row.total_revenue),
            totalOrders: Number(row.total_orders),
            totalItems: Number(row.total_items),
          }
        : {
            totalRevenue: ordersResult.rows.reduce(
              (s, r) => s + Number(r.total),
              0,
            ),
            totalOrders: ordersResult.rows.length,
            totalItems: ordersResult.rows.reduce(
              (s, r) => s + Number(r.item_count),
              0,
            ),
          };

      return NextResponse.json(
        {
          type: "date",
          date: dateParam,
          rows: row
            ? [
                {
                  saleDate: row.sale_date as string,
                  totalRevenue: Number(row.total_revenue),
                  totalOrders: Number(row.total_orders),
                  totalItems: Number(row.total_items),
                },
              ]
            : totals.totalOrders > 0
              ? [
                  {
                    saleDate: dateParam,
                    totalRevenue: totals.totalRevenue,
                    totalOrders: totals.totalOrders,
                    totalItems: totals.totalItems,
                  },
                ]
              : [],
          orders: ordersResult.rows.map((r) => ({
            orderCode: r.order_code as string,
            total: Number(r.total),
            customerName: (r.customer_name as string) || "Walk-In Customer",
            orderType: (r.order_type as string) || "Delivery",
            tableNumber: r.table_number as number | null,
            soldAt: r.sold_at as string,
            itemCount: Number(r.item_count),
          })),
          totals,
        },
        { status: 200 },
      );
    }

    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ error: "valid year is required" }, { status: 400 });
    }

    if (type === "monthly") {
      const result = await client.query(
        `
        SELECT
          TO_CHAR(sale_date, 'YYYY-MM') AS period,
          SUM(total_revenue)::float AS total_revenue,
          SUM(total_orders)::int AS total_orders,
          SUM(total_items)::int AS total_items
        FROM daily_sales
        WHERE EXTRACT(YEAR FROM sale_date) = $1
        GROUP BY TO_CHAR(sale_date, 'YYYY-MM')
        ORDER BY period DESC
        `,
        [year],
      );

      const rows = result.rows.map((row) => ({
        period: row.period as string,
        totalRevenue: Number(row.total_revenue),
        totalOrders: Number(row.total_orders),
        totalItems: Number(row.total_items),
      }));

      return NextResponse.json(
        {
          type: "monthly",
          year,
          rows,
          totals: {
            totalRevenue: rows.reduce((s, r) => s + r.totalRevenue, 0),
            totalOrders: rows.reduce((s, r) => s + r.totalOrders, 0),
            totalItems: rows.reduce((s, r) => s + r.totalItems, 0),
          },
        },
        { status: 200 },
      );
    }

    if (
      type === "daily" &&
      (!Number.isInteger(month) || month < 1 || month > 12)
    ) {
      return NextResponse.json(
        { error: "valid month is required" },
        { status: 400 },
      );
    }

    // daily (day-by-day for selected month)
    const result = await client.query(
      `
      SELECT
        sale_date::text AS sale_date,
        total_revenue::float AS total_revenue,
        total_orders::int AS total_orders,
        total_items::int AS total_items
      FROM daily_sales
      WHERE EXTRACT(YEAR FROM sale_date) = $1
        AND EXTRACT(MONTH FROM sale_date) = $2
      ORDER BY sale_date DESC
      `,
      [year, month],
    );

    const rows = result.rows.map((row) => ({
      saleDate: row.sale_date as string,
      totalRevenue: Number(row.total_revenue),
      totalOrders: Number(row.total_orders),
      totalItems: Number(row.total_items),
    }));

    return NextResponse.json(
      {
        type: "daily",
        year,
        month,
        rows,
        totals: {
          totalRevenue: rows.reduce((s, r) => s + r.totalRevenue, 0),
          totalOrders: rows.reduce((s, r) => s + r.totalOrders, 0),
          totalItems: rows.reduce((s, r) => s + r.totalItems, 0),
        },
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("Failed to load reports", err);
    return NextResponse.json(
      { error: "Failed to load reports" },
      { status: 500 },
    );
  } finally {
    if (client) client.release();
  }
}
