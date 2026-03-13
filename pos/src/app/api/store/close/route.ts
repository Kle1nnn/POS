import { NextRequest, NextResponse } from "next/server";
import { pgPool } from "../../../../lib/db";

export async function POST(req: NextRequest) {
  let client;
  try {
    client = await pgPool.connect();

    const result = await client.query(
      `
        UPDATE store_state
        SET closed_at = NOW()
        WHERE id = 1
        RETURNING current_business_date, closed_at;
      `,
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: "store_state row not found" },
        { status: 404 },
      );
    }

    const row = result.rows[0];
    return NextResponse.json(
      {
        currentBusinessDate: row.current_business_date,
        closedAt: row.closed_at,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("Failed to close store", err);
    return NextResponse.json(
      { error: "Failed to close store" },
      { status: 500 },
    );
  } finally {
    if (client) {
      client.release();
    }
  }
}

