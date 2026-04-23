import { NextResponse } from "next/server";
import { pgPool } from "../../../../lib/db";

export async function GET() {
  let client;
  try {
    client = await pgPool.connect();
    const result = await client.query(`
      SELECT order_code FROM orders
      WHERE order_code LIKE 'TBT-%'
      ORDER BY id DESC
      LIMIT 1
    `);
    const lastCode = result.rows[0]?.order_code ?? "TBT-0";
    const lastNum = parseInt(lastCode.replace("TBT-", ""), 10) || 0;
    return NextResponse.json({ lastNum }, { status: 200 });
  } catch (err) {
    console.error("Failed to get last order id", err);
    return NextResponse.json({ lastNum: 0 }, { status: 200 });
  } finally {
    if (client) client.release();
  }
}