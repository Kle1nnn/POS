import { NextRequest, NextResponse } from "next/server";
import { pgPool } from "../../../../lib/db";

export async function GET(req: NextRequest) {
  let client;
  try {
    client = await pgPool.connect();

    const result = await client.query(
      `
        SELECT to_char(current_business_date, 'YYYY-MM-DD') AS current_business_date
        FROM store_state
        WHERE id = 1;
      `,
    );

    if (result.rowCount === 0) {
      const inserted = await client.query(
        `
          INSERT INTO store_state (id, current_business_date)
          VALUES (1, CURRENT_DATE)
          RETURNING to_char(current_business_date, 'YYYY-MM-DD') AS current_business_date;
        `,
      );
      return NextResponse.json(
        { currentBusinessDate: inserted.rows[0].current_business_date },
        { status: 200 },
      );
    }

    return NextResponse.json(
      { currentBusinessDate: result.rows[0].current_business_date },
      { status: 200 },
    );
  } catch (err) {
    console.error("Failed to read store state", err);
    return NextResponse.json(
      { error: "Failed to read store state" },
      { status: 500 },
    );
  } finally {
    if (client) {
      client.release();
    }
  }
}

export async function POST(req: NextRequest) {
  let client;
  try {
    const { businessDate } = (await req.json()) as { businessDate: string };
    if (!businessDate) {
      return NextResponse.json(
        { error: "businessDate is required" },
        { status: 400 },
      );
    }

    client = await pgPool.connect();

    const result = await client.query(
      `
        UPDATE store_state
        SET current_business_date = $1::date,
            opened_at = NOW(),
            closed_at = NULL
        WHERE id = 1
        RETURNING to_char(current_business_date, 'YYYY-MM-DD') AS current_business_date;
      `,
      [businessDate],
    );

    if (result.rowCount === 0) {
      const inserted = await client.query(
        `
          INSERT INTO store_state (id, current_business_date, opened_at)
          VALUES (1, $1::date, NOW())
          RETURNING to_char(current_business_date, 'YYYY-MM-DD') AS current_business_date;
        `,
        [businessDate],
      );
      return NextResponse.json(
        { currentBusinessDate: inserted.rows[0].current_business_date },
        { status: 200 },
      );
    }

    return NextResponse.json(
      { currentBusinessDate: result.rows[0].current_business_date },
      { status: 200 },
    );
  } catch (err) {
    console.error("Failed to update store state", err);
    return NextResponse.json(
      { error: "Failed to update store state" },
      { status: 500 },
    );
  } finally {
    if (client) {
      client.release();
    }
  }
}

