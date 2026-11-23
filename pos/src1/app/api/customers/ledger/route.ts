import { NextRequest, NextResponse } from "next/server";
import { pgPool } from "../../../../lib/db";

async function ensureInstructionsColumn(client: {
  query: (sql: string, params?: unknown[]) => Promise<unknown>;
}) {
  await client.query(
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS instructions text`,
  );
}

// GET /api/customers/ledger?name=Ali&phone=03...&year=2026&month=8
// Returns checked-out orders for a customer (ledger) with running totals.
// Optional year/month filters to a single calendar month (day-by-day view).
export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name")?.trim() ?? "";
  const phone = req.nextUrl.searchParams.get("phone")?.trim() ?? "";
  const yearRaw = req.nextUrl.searchParams.get("year");
  const monthRaw = req.nextUrl.searchParams.get("month");
  const year = yearRaw ? Number(yearRaw) : null;
  const month = monthRaw ? Number(monthRaw) : null;
  const filterMonth =
    year != null &&
    month != null &&
    Number.isFinite(year) &&
    Number.isFinite(month) &&
    month >= 1 &&
    month <= 12;

  if (!name) {
    return NextResponse.json(
      { error: "customer name is required" },
      { status: 400 },
    );
  }

  let client;
  try {
    client = await pgPool.connect();
    await ensureInstructionsColumn(client);

    const params: (string | number)[] = [name];
    const whereParts = [
      `o.status = 'checkedout'`,
      `LOWER(COALESCE(NULLIF(TRIM(o.customer_name), ''), 'Walk-In Customer')) = LOWER(TRIM($1))`,
    ];
    if (phone) {
      params.push(phone);
      whereParts.push(
        `TRIM(COALESCE(o.customer_phone, '')) = TRIM($${params.length})`,
      );
    }
    if (filterMonth) {
      params.push(year as number);
      whereParts.push(
        `EXTRACT(YEAR FROM o.business_date)::int = $${params.length}`,
      );
      params.push(month as number);
      whereParts.push(
        `EXTRACT(MONTH FROM o.business_date)::int = $${params.length}`,
      );
    }

    const result = await client.query(
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
        o.business_date::text AS business_date,
        COALESCE(o.checked_out_at, o.created_at) AS sold_at,
        o.created_at,
        o.checked_out_at,
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
      WHERE ${whereParts.join(" AND ")}
      ORDER BY COALESCE(o.checked_out_at, o.created_at) ASC, o.id ASC
      LIMIT 500
      `,
      params,
    );

    let running = 0;
    const entries = result.rows.map((row) => {
      const total = Number(row.total);
      running += total;
      return {
        orderCode: row.order_code as string,
        total,
        balance: running,
        notes: (row.notes as string) || "",
        instructions: (row.instructions as string) || "",
        customerName:
          (row.customer_name as string) || "Walk-In Customer",
        customerPhone: (row.customer_phone as string) || "",
        orderType: (row.order_type as string) || "Delivery",
        tableNumber: row.table_number as number | null,
        businessDate: row.business_date as string,
        soldAt: row.sold_at as string,
        createdAt: row.created_at as string,
        checkedOutAt: row.checked_out_at as string | null,
        itemCount: Number(row.item_count),
        items: Array.isArray(row.items) ? row.items : [],
      };
    });

    const dailyMap = new Map<
      string,
      { saleDate: string; totalRevenue: number; totalOrders: number; totalItems: number }
    >();
    for (const entry of entries) {
      const key = entry.businessDate;
      const cur = dailyMap.get(key) ?? {
        saleDate: key,
        totalRevenue: 0,
        totalOrders: 0,
        totalItems: 0,
      };
      cur.totalRevenue += entry.total;
      cur.totalOrders += 1;
      cur.totalItems += entry.itemCount;
      dailyMap.set(key, cur);
    }
    const daily = Array.from(dailyMap.values()).sort((a, b) =>
      a.saleDate.localeCompare(b.saleDate),
    );

    return NextResponse.json(
      {
        customerName: name,
        customerPhone: phone,
        entries,
        daily,
        totals: {
          totalOrders: entries.length,
          totalRevenue: running,
          totalItems: entries.reduce((s, e) => s + e.itemCount, 0),
        },
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("Failed to load customer ledger", err);
    return NextResponse.json(
      { error: "Failed to load customer ledger" },
      { status: 500 },
    );
  } finally {
    if (client) client.release();
  }
}
