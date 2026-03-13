import { NextRequest, NextResponse } from "next/server";
import { pgPool } from "../../../../lib/db";

type CheckoutBody = {
  orderCode: string;
};

export async function POST(req: NextRequest) {
  let client;
  try {
    const { orderCode } = (await req.json()) as CheckoutBody;

    if (!orderCode) {
      return NextResponse.json(
        { error: "orderCode is required" },
        { status: 400 },
      );
    }

    client = await pgPool.connect();
    await client.query("BEGIN");

    const result = await client.query(
      `
        UPDATE orders
        SET status = 'checkedout',
            checked_out_at = NOW()
        WHERE order_code = $1
          AND status <> 'checkedout'
        RETURNING id, status, checked_out_at;
      `,
      [orderCode],
    );

    await client.query("COMMIT");

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: "Order not found or already checked out" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        orderId: result.rows[0].id,
        status: result.rows[0].status,
        checkedOutAt: result.rows[0].checked_out_at,
      },
      { status: 200 },
    );
  } catch (err) {
    if (client) {
      await client.query("ROLLBACK");
    }
    console.error("Error checking out order", err);
    return NextResponse.json(
      { error: "Failed to checkout order" },
      { status: 500 },
    );
  } finally {
    if (client) {
      client.release();
    }
  }
}

