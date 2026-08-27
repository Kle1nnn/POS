import { pgPool } from "./db";
import { ensureReceiptSettingsTable } from "./receipt-settings";

const DEFAULT_WIPE_CODE = "1234";

let ready: Promise<void> | null = null;

export function ensureDangerSettingsTable(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      const client = await pgPool.connect();
      try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS danger_settings (
            id         integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
            wipe_code  text NOT NULL DEFAULT '1234',
            updated_at timestamptz NOT NULL DEFAULT NOW()
          );
        `);
        await client.query(`
          INSERT INTO danger_settings (id, wipe_code)
          VALUES (1, $1)
          ON CONFLICT (id) DO NOTHING;
        `, [DEFAULT_WIPE_CODE]);
      } finally {
        client.release();
      }
    })();
  }
  return ready;
}

export async function getWipeCode(): Promise<string> {
  await ensureDangerSettingsTable();
  const client = await pgPool.connect();
  try {
    const result = await client.query(
      `SELECT wipe_code FROM danger_settings WHERE id = 1`,
    );
    return String(result.rows[0]?.wipe_code || DEFAULT_WIPE_CODE);
  } finally {
    client.release();
  }
}

export async function setWipeCode(code: string): Promise<void> {
  const trimmed = code.trim();
  if (trimmed.length < 4 || trimmed.length > 32) {
    throw new Error("Confirmation code must be 4–32 characters");
  }
  await ensureDangerSettingsTable();
  const client = await pgPool.connect();
  try {
    await client.query(
      `
      UPDATE danger_settings
      SET wipe_code = $1, updated_at = NOW()
      WHERE id = 1
      `,
      [trimmed],
    );
  } finally {
    client.release();
  }
}

export type WipeResult = {
  customers: number;
  orders: number;
  orderItems: number;
  dailySales: number;
  allTimeReset: boolean;
  receiptNumberReset: boolean;
};

/** Wipe contacts, orders (saved + history), balances, and reset receipt number. Keeps catalog & settings. */
export async function wipeAllTransactionalData(
  confirmationCode: string,
): Promise<WipeResult> {
  const expected = await getWipeCode();
  if (confirmationCode.trim() !== expected) {
    throw new Error("Invalid confirmation code");
  }

  await ensureReceiptSettingsTable();
  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET session_replication_role = 'replica'`);

    const items = await client.query(`DELETE FROM order_items`);
    const orders = await client.query(`DELETE FROM orders`);
    const customers = await client.query(`DELETE FROM customers`);
    const daily = await client.query(`DELETE FROM daily_sales`);
    await client.query(
      `
      UPDATE all_time_sales
      SET total_revenue = 0,
          total_orders = 0,
          total_items = 0,
          updated_at = NOW()
      WHERE id = 1
      `,
    );
    await client.query(
      `
      UPDATE receipt_settings
      SET receipt_next_number = 1,
          updated_at = NOW()
      WHERE id = 1
      `,
    );

    await client.query(`SET session_replication_role = 'origin'`);
    await client.query("COMMIT");

    return {
      customers: customers.rowCount ?? 0,
      orders: orders.rowCount ?? 0,
      orderItems: items.rowCount ?? 0,
      dailySales: daily.rowCount ?? 0,
      allTimeReset: true,
      receiptNumberReset: true,
    };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
