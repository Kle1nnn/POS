import { NextResponse } from "next/server";
import { pgPool } from "../../../../lib/db";
import {
  formatReceiptCode,
  loadReceiptSettings,
  normalizeReceiptPrefix,
} from "../../../../lib/receipt-settings";

export async function GET() {
  let client;
  try {
    const settings = await loadReceiptSettings();
    const prefix = normalizeReceiptPrefix(settings.receiptPrefix);
    client = await pgPool.connect();

    const result = await client.query(
      `
      SELECT order_code FROM orders
      WHERE order_code ~ ('^' || $1 || '-[0-9]+$')
      ORDER BY NULLIF(regexp_replace(order_code, '^.*-', ''), '')::bigint DESC NULLS LAST,
               id DESC
      LIMIT 1
      `,
      [prefix],
    );

    const lastCode = (result.rows[0]?.order_code as string | undefined) ?? null;
    let lastFromOrders = 0;
    if (lastCode) {
      const match = lastCode.match(/-(\d+)$/);
      if (match) lastFromOrders = parseInt(match[1], 10) || 0;
    }

    const configuredNext = Math.max(1, Math.floor(settings.receiptNextNumber || 1));
    // Effective last used = max(existing orders, configured next - 1)
    const lastNum = Math.max(lastFromOrders, configuredNext - 1);
    const nextNum = lastNum + 1;
    const nextCode = formatReceiptCode(prefix, nextNum);

    return NextResponse.json(
      { prefix, lastNum, nextNum, nextCode },
      { status: 200 },
    );
  } catch (err) {
    console.error("Failed to get last order id", err);
    return NextResponse.json(
      { prefix: "TBT", lastNum: 0, nextNum: 1, nextCode: "TBT-1" },
      { status: 200 },
    );
  } finally {
    if (client) client.release();
  }
}
