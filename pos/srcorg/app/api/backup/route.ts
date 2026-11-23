import { NextRequest, NextResponse } from "next/server";
import { pgPool } from "../../../lib/db";

const BACKUP_VERSION = 1;

type BackupPayload = {
  version: number;
  exportedAt: string;
  store_state: Record<string, unknown>[];
  customers: Record<string, unknown>[];
  orders: Record<string, unknown>[];
  order_items: Record<string, unknown>[];
  daily_sales: Record<string, unknown>[];
  all_time_sales: Record<string, unknown>[];
};

async function ensureTables(client: Awaited<ReturnType<typeof pgPool.connect>>) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS customers (
      id         bigserial PRIMARY KEY,
      name       text NOT NULL,
      phone      text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT NOW()
    );
  `);
  await client.query(
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS instructions text`,
  );
}

function isBackupPayload(data: unknown): data is BackupPayload {
  if (!data || typeof data !== "object") return false;
  const b = data as BackupPayload;
  return (
    b.version === BACKUP_VERSION &&
    Array.isArray(b.store_state) &&
    Array.isArray(b.customers) &&
    Array.isArray(b.orders) &&
    Array.isArray(b.order_items) &&
    Array.isArray(b.daily_sales) &&
    Array.isArray(b.all_time_sales)
  );
}

async function resetSequence(
  client: Awaited<ReturnType<typeof pgPool.connect>>,
  table: string,
  column: string,
) {
  await client.query(
    `SELECT setval(
       pg_get_serial_sequence($1, $2),
       COALESCE((SELECT MAX(${column}) FROM ${table}), 1),
       (SELECT COUNT(*) > 0 FROM ${table})
     )`,
    [table, column],
  );
}

// GET /api/backup — export all POS data as JSON
export async function GET() {
  let client;
  try {
    client = await pgPool.connect();
    await ensureTables(client);

    const [
      storeState,
      customers,
      orders,
      orderItems,
      dailySales,
      allTimeSales,
    ] = await Promise.all([
      client.query(`SELECT * FROM store_state ORDER BY id`),
      client.query(`SELECT * FROM customers ORDER BY id`),
      client.query(`SELECT * FROM orders ORDER BY id`),
      client.query(`SELECT * FROM order_items ORDER BY id`),
      client.query(`SELECT * FROM daily_sales ORDER BY sale_date`),
      client.query(`SELECT * FROM all_time_sales ORDER BY id`),
    ]);

    const backup: BackupPayload = {
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      store_state: storeState.rows,
      customers: customers.rows,
      orders: orders.rows,
      order_items: orderItems.rows,
      daily_sales: dailySales.rows,
      all_time_sales: allTimeSales.rows,
    };

    // #region agent log
    fetch("http://127.0.0.1:7480/ingest/9a20f3ee-1884-4721-a3e7-1497e20d6670", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "507331",
      },
      body: JSON.stringify({
        sessionId: "507331",
        location: "api/backup/route.ts:GET",
        message: "Backup exported",
        data: {
          orders: backup.orders.length,
          customers: backup.customers.length,
          orderItems: backup.order_items.length,
        },
        timestamp: Date.now(),
        hypothesisId: "backup-export",
      }),
    }).catch(() => {});
    // #endregion

    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(backup, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="pos-backup-${stamp}.json"`,
      },
    });
  } catch (err) {
    console.error("Failed to export backup", err);
    return NextResponse.json({ error: "Failed to export backup" }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

// POST /api/backup — restore all POS data from JSON backup
export async function POST(req: NextRequest) {
  let client;
  try {
    const body = (await req.json()) as unknown;
    if (!isBackupPayload(body)) {
      return NextResponse.json(
        { error: "Invalid backup file format" },
        { status: 400 },
      );
    }

    client = await pgPool.connect();
    await ensureTables(client);
    await client.query("BEGIN");
    await client.query(`SET session_replication_role = 'replica'`);

    await client.query(`DELETE FROM order_items`);
    await client.query(`DELETE FROM orders`);
    await client.query(`DELETE FROM customers`);
    await client.query(`DELETE FROM daily_sales`);
    await client.query(`DELETE FROM all_time_sales`);
    await client.query(`DELETE FROM store_state`);

    for (const row of body.store_state) {
      await client.query(
        `INSERT INTO store_state (id, current_business_date, opened_at, closed_at)
         VALUES ($1, $2, $3, $4)`,
        [row.id, row.current_business_date, row.opened_at ?? null, row.closed_at ?? null],
      );
    }

    for (const row of body.customers) {
      await client.query(
        `INSERT INTO customers (id, name, phone, created_at)
         VALUES ($1, $2, $3, COALESCE($4::timestamptz, NOW()))`,
        [row.id, row.name, row.phone ?? "", row.created_at ?? null],
      );
    }

    for (const row of body.orders) {
      await client.query(
        `INSERT INTO orders (
           id, order_code, status, total, notes, instructions,
           customer_name, customer_phone, order_type, table_number,
           created_at, checked_out_at, business_date
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          row.id,
          row.order_code,
          row.status,
          row.total,
          row.notes ?? null,
          row.instructions ?? null,
          row.customer_name ?? null,
          row.customer_phone ?? null,
          row.order_type ?? "Delivery",
          row.table_number ?? null,
          row.created_at,
          row.checked_out_at ?? null,
          row.business_date ?? null,
        ],
      );
    }

    for (const row of body.order_items) {
      await client.query(
        `INSERT INTO order_items (
           id, order_id, product_id, product_name, category,
           selected_size, selected_topping, selected_sauce, unit_price, quantity
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          row.id,
          row.order_id,
          row.product_id ?? null,
          row.product_name,
          row.category ?? null,
          row.selected_size ?? null,
          row.selected_topping ?? null,
          row.selected_sauce ?? null,
          row.unit_price,
          row.quantity,
        ],
      );
    }

    for (const row of body.daily_sales) {
      await client.query(
        `INSERT INTO daily_sales (sale_date, total_revenue, total_orders, total_items, updated_at)
         VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, NOW()))`,
        [
          row.sale_date,
          row.total_revenue,
          row.total_orders,
          row.total_items,
          row.updated_at ?? null,
        ],
      );
    }

    for (const row of body.all_time_sales) {
      await client.query(
        `INSERT INTO all_time_sales (id, total_revenue, total_orders, total_items, updated_at)
         VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, NOW()))`,
        [
          row.id,
          row.total_revenue,
          row.total_orders,
          row.total_items,
          row.updated_at ?? null,
        ],
      );
    }

    await resetSequence(client, "customers", "id");
    await resetSequence(client, "orders", "id");
    await resetSequence(client, "order_items", "id");

    await client.query(`SET session_replication_role = 'origin'`);
    await client.query("COMMIT");

    // #region agent log
    fetch("http://127.0.0.1:7480/ingest/9a20f3ee-1884-4721-a3e7-1497e20d6670", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "507331",
      },
      body: JSON.stringify({
        sessionId: "507331",
        location: "api/backup/route.ts:POST",
        message: "Backup restored",
        data: {
          orders: body.orders.length,
          customers: body.customers.length,
          orderItems: body.order_items.length,
        },
        timestamp: Date.now(),
        hypothesisId: "backup-restore",
      }),
    }).catch(() => {});
    // #endregion

    return NextResponse.json(
      {
        success: true,
        restored: {
          orders: body.orders.length,
          customers: body.customers.length,
          orderItems: body.order_items.length,
        },
      },
      { status: 200 },
    );
  } catch (err) {
    if (client) {
      await client.query("ROLLBACK").catch(() => {});
    }
    console.error("Failed to restore backup", err);
    return NextResponse.json({ error: "Failed to restore backup" }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
