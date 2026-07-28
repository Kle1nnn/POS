import { NextRequest, NextResponse } from "next/server";
import { pgPool } from "../../../lib/db";

// GET /api/reports?type=daily|monthly&year=2026&month=7
export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type") ?? "daily";
  const yearParam = req.nextUrl.searchParams.get("year");
  const monthParam = req.nextUrl.searchParams.get("month");

  const now = new Date();
  const year = yearParam ? Number(yearParam) : now.getFullYear();
  const month = monthParam ? Number(monthParam) : now.getMonth() + 1;

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "valid year is required" }, { status: 400 });
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

  let client;
  try {
    client = await pgPool.connect();

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
