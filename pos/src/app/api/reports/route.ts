import { NextRequest, NextResponse } from "next/server";
import { pgPool } from "../../../lib/db";

// GET /api/reports?type=daily|monthly|date&year=2026&month=7&date=2026-07-28
export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type") ?? "daily";
  const yearParam = req.nextUrl.searchParams.get("year");
  const monthParam = req.nextUrl.searchParams.get("month");
  const dateParam = req.nextUrl.searchParams.get("date")?.trim() ?? "";
  const customerNameParam =
    req.nextUrl.searchParams.get("customerName")?.trim() ?? "";
  const customerPhoneParam =
    req.nextUrl.searchParams.get("customerPhone")?.trim() ?? "";
  const categoryParam =
    req.nextUrl.searchParams.get("category")?.trim() ?? "";

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

      await client.query(
        `ALTER TABLE orders ADD COLUMN IF NOT EXISTS instructions text`,
      );

      const ordersResult = await client.query(
        `
        SELECT
          o.order_code,
          o.total,
          o.notes,
          o.instructions,
          o.customer_name,
          o.customer_phone,
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
          ) AS item_count,
          COALESCE(
            (
              SELECT json_agg(
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
                ORDER BY oi.id
              )
              FROM order_items oi
              WHERE oi.order_id = o.id
            ),
            '[]'::json
          ) AS items
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
            notes: (r.notes as string) || "",
            instructions: (r.instructions as string) || "",
            customerName: (r.customer_name as string) || "Walk-In Customer",
            customerPhone: (r.customer_phone as string) || "",
            orderType: (r.order_type as string) || "Delivery",
            tableNumber: r.table_number as number | null,
            soldAt: r.sold_at as string,
            itemCount: Number(r.item_count),
            items: Array.isArray(r.items) ? r.items : [],
          })),
          totals,
        },
        { status: 200 },
      );
    }

    if (type === "items") {
      const range =
        req.nextUrl.searchParams.get("range")?.trim() ||
        (dateParam ? "date" : "daily");

      if (range === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        return NextResponse.json(
          { error: "valid date (YYYY-MM-DD) is required" },
          { status: 400 },
        );
      }
      if (
        (range === "daily" || range === "monthly") &&
        (!Number.isInteger(year) || year < 2000 || year > 2100)
      ) {
        return NextResponse.json(
          { error: "valid year is required" },
          { status: 400 },
        );
      }
      if (
        range === "daily" &&
        (!Number.isInteger(month) || month < 1 || month > 12)
      ) {
        return NextResponse.json(
          { error: "valid month is required" },
          { status: 400 },
        );
      }

      const params: Array<string | number> = [];
      const whereParts: string[] = [`o.status = 'checkedout'`];

      if (range === "date") {
        params.push(dateParam);
        whereParts.push(`o.business_date = $${params.length}::date`);
      } else if (range === "daily") {
        params.push(year, month);
        whereParts.push(`EXTRACT(YEAR FROM o.business_date) = $${params.length - 1}`);
        whereParts.push(`EXTRACT(MONTH FROM o.business_date) = $${params.length}`);
      } else {
        params.push(year);
        whereParts.push(`EXTRACT(YEAR FROM o.business_date) = $${params.length}`);
      }

      if (customerNameParam) {
        params.push(customerNameParam);
        whereParts.push(
          `LOWER(COALESCE(NULLIF(TRIM(o.customer_name), ''), 'Walk-In Customer')) = LOWER(TRIM($${params.length}))`,
        );
      }
      if (customerPhoneParam) {
        params.push(customerPhoneParam);
        whereParts.push(
          `TRIM(COALESCE(o.customer_phone, '')) = TRIM($${params.length})`,
        );
      }
      if (categoryParam) {
        params.push(categoryParam);
        whereParts.push(
          `LOWER(TRIM(COALESCE(oi.category, ''))) = LOWER(TRIM($${params.length}))`,
        );
      }

      const whereClause = whereParts.join(" AND ");

      const periodSelect =
        range === "date"
          ? `o.business_date::text AS period`
          : range === "daily"
            ? `o.business_date::text AS period`
            : `TO_CHAR(o.business_date, 'YYYY-MM') AS period`;

      const result = await client.query(
        `
        SELECT
          ${periodSelect},
          oi.product_name,
          oi.category,
          oi.selected_size,
          oi.selected_topping,
          oi.selected_sauce,
          SUM(oi.quantity)::integer AS quantity_sold,
          SUM(oi.quantity * oi.unit_price)::float AS revenue,
          COUNT(DISTINCT o.id)::integer AS order_count
        FROM order_items oi
        INNER JOIN orders o ON o.id = oi.order_id
        WHERE ${whereClause}
        GROUP BY
          period,
          oi.product_name,
          oi.category,
          oi.selected_size,
          oi.selected_topping,
          oi.selected_sauce
        ORDER BY
          period DESC,
          COALESCE(oi.category, '') ASC,
          quantity_sold DESC,
          oi.product_name ASC
        `,
        params,
      );

      // Customers / categories in range — ignore customer & category filters so lists stay full
      const filterParams: Array<string | number> = [];
      const filterWhere = [`o.status = 'checkedout'`];
      if (range === "date") {
        filterParams.push(dateParam);
        filterWhere.push(`o.business_date = $${filterParams.length}::date`);
      } else if (range === "daily") {
        filterParams.push(year, month);
        filterWhere.push(
          `EXTRACT(YEAR FROM o.business_date) = $${filterParams.length - 1}`,
        );
        filterWhere.push(
          `EXTRACT(MONTH FROM o.business_date) = $${filterParams.length}`,
        );
      } else {
        filterParams.push(year);
        filterWhere.push(
          `EXTRACT(YEAR FROM o.business_date) = $${filterParams.length}`,
        );
      }

      const customersResult = await client.query(
        `
        SELECT DISTINCT
          COALESCE(NULLIF(TRIM(o.customer_name), ''), 'Walk-In Customer') AS customer_name,
          COALESCE(TRIM(o.customer_phone), '') AS customer_phone
        FROM orders o
        WHERE ${filterWhere.join(" AND ")}
        ORDER BY customer_name ASC, customer_phone ASC
        `,
        filterParams,
      );

      const categoriesResult = await client.query(
        `
        SELECT DISTINCT TRIM(oi.category) AS category
        FROM order_items oi
        INNER JOIN orders o ON o.id = oi.order_id
        WHERE ${filterWhere.join(" AND ")}
          AND TRIM(COALESCE(oi.category, '')) <> ''
        ORDER BY category ASC
        `,
        filterParams,
      );

      const items = result.rows.map((row) => ({
        period: row.period as string,
        name: row.product_name as string,
        category: (row.category as string | null) ?? null,
        selectedSize: (row.selected_size as string | null) ?? null,
        selectedTopping: (row.selected_topping as string | null) ?? null,
        selectedSauce: (row.selected_sauce as string | null) ?? null,
        quantitySold: Number(row.quantity_sold),
        revenue: Number(row.revenue),
        orderCount: Number(row.order_count),
      }));

      const ordersCountResult = await client.query(
        `
        SELECT COUNT(DISTINCT o.id)::integer AS order_count
        FROM order_items oi
        INNER JOIN orders o ON o.id = oi.order_id
        WHERE ${whereClause}
        `,
        params,
      );

      const totals = {
        totalRevenue: items.reduce((s, i) => s + i.revenue, 0),
        totalOrders: Number(ordersCountResult.rows[0]?.order_count ?? 0),
        totalItems: items.reduce((s, i) => s + i.quantitySold, 0),
      };

      return NextResponse.json(
        {
          type: "items",
          range,
          date: range === "date" ? dateParam : null,
          year: range !== "date" ? year : null,
          month: range === "daily" ? month : null,
          category: categoryParam || null,
          customerName: customerNameParam || null,
          customerPhone: customerPhoneParam || null,
          items,
          dayCustomers: customersResult.rows.map((r) => ({
            name: r.customer_name as string,
            phone: r.customer_phone as string,
          })),
          categories: categoriesResult.rows.map(
            (r) => r.category as string,
          ),
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
