import { NextRequest, NextResponse } from "next/server";
import { pgPool } from "../../../lib/db";

// Runs ONCE when this module is first loaded by the server — not on every request
const tableReady: Promise<void> = (async () => {
  const client = await pgPool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id         bigserial PRIMARY KEY,
        name       text NOT NULL,
        phone      text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_customers_name ON customers (LOWER(name));
    `);
  } finally {
    client.release();
  }
})();

// GET /api/customers?q=ali  — search by name prefix
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const all = req.nextUrl.searchParams.get("all") === "1";
  let client;
  try {
    await tableReady;
    client = await pgPool.connect();
    const result = all
      ? await client.query(
          `SELECT id, name, phone
           FROM customers
           ORDER BY created_at DESC, id DESC
           LIMIT 500`,
        )
      : await client.query(
          `SELECT id, name, phone
           FROM customers
           WHERE LOWER(name) LIKE LOWER($1)
           ORDER BY name ASC
           LIMIT 8`,
          [`${q}%`],
        );
    return NextResponse.json({ customers: result.rows }, { status: 200 });
  } catch (err) {
    console.error("Failed to search customers", err);
    return NextResponse.json(
      { error: "Failed to search customers" },
      { status: 500 },
    );
  } finally {
    if (client) client.release();
  }
}

// POST /api/customers  — { name, phone } → save and return new customer
export async function POST(req: NextRequest) {
  let client;
  try {
    const { name, phone } = (await req.json()) as {
      name: string;
      phone?: string;
    };
    if (!name?.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    await tableReady;
    client = await pgPool.connect();

    // Upsert: if exact name+phone exists, just return it
    const existing = await client.query(
      `SELECT id, name, phone FROM customers WHERE LOWER(name) = LOWER($1) AND phone = $2`,
      [name.trim(), phone?.trim() ?? ""],
    );
    if (existing.rowCount && existing.rowCount > 0) {
      return NextResponse.json({ customer: existing.rows[0] }, { status: 200 });
    }

    const result = await client.query(
      `INSERT INTO customers (name, phone) VALUES ($1, $2) RETURNING id, name, phone`,
      [name.trim(), phone?.trim() ?? ""],
    );
    return NextResponse.json({ customer: result.rows[0] }, { status: 201 });
  } catch (err) {
    console.error("Failed to save customer", err);
    return NextResponse.json(
      { error: "Failed to save customer" },
      { status: 500 },
    );
  } finally {
    if (client) client.release();
  }
}

// DELETE /api/customers?id=123
export async function DELETE(req: NextRequest) {
  const idParam = req.nextUrl.searchParams.get("id");
  const id = idParam ? Number(idParam) : NaN;

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "valid id is required" }, { status: 400 });
  }

  let client;
  try {
    await tableReady;
    client = await pgPool.connect();

    const result = await client.query(
      `DELETE FROM customers WHERE id = $1 RETURNING id`,
      [id],
    );

    if (!result.rowCount) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("Failed to delete customer", err);
    return NextResponse.json(
      { error: "Failed to delete customer" },
      { status: 500 },
    );
  } finally {
    if (client) client.release();
  }
}

// PATCH /api/customers — { id, name, phone } → update existing customer
export async function PATCH(req: NextRequest) {
  let client;
  try {
    const payload = (await req.json()) as {
      id?: number;
      name?: string;
      phone?: string;
    };

    if (!payload.id || !payload.name?.trim()) {
      return NextResponse.json(
        { error: "id and name are required" },
        { status: 400 },
      );
    }

    await tableReady;
    client = await pgPool.connect();

    const result = await client.query(
      `UPDATE customers
       SET name = $2, phone = $3
       WHERE id = $1
       RETURNING id, name, phone`,
      [payload.id, payload.name.trim(), payload.phone?.trim() ?? ""],
    );

    if (!result.rowCount) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    return NextResponse.json({ customer: result.rows[0] }, { status: 200 });
  } catch (err) {
    console.error("Failed to update customer", err);
    return NextResponse.json(
      { error: "Failed to update customer" },
      { status: 500 },
    );
  } finally {
    if (client) client.release();
  }
}
