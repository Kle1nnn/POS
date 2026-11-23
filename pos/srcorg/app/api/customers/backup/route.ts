import { NextRequest, NextResponse } from "next/server";
import { pgPool } from "../../../../lib/db";

const CONTACTS_BACKUP_VERSION = 1;

type ContactsBackupPayload = {
  version: number;
  exportedAt: string;
  customers: Record<string, unknown>[];
};

function isContactsBackupPayload(data: unknown): data is ContactsBackupPayload {
  if (!data || typeof data !== "object") return false;
  const b = data as ContactsBackupPayload;
  return b.version === CONTACTS_BACKUP_VERSION && Array.isArray(b.customers);
}

async function ensureCustomersTable(
  client: Awaited<ReturnType<typeof pgPool.connect>>,
) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS customers (
      id         bigserial PRIMARY KEY,
      name       text NOT NULL,
      phone      text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT NOW()
    );
  `);
}

async function resetCustomersSequence(
  client: Awaited<ReturnType<typeof pgPool.connect>>,
) {
  await client.query(
    `SELECT setval(
       pg_get_serial_sequence('customers', 'id'),
       COALESCE((SELECT MAX(id) FROM customers), 1),
       (SELECT COUNT(*) > 0 FROM customers)
     )`,
  );
}

// GET /api/customers/backup — export contacts only
export async function GET() {
  let client;
  try {
    client = await pgPool.connect();
    await ensureCustomersTable(client);

    const result = await client.query(
      `SELECT id, name, phone, created_at FROM customers ORDER BY id`,
    );

    const backup: ContactsBackupPayload = {
      version: CONTACTS_BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      customers: result.rows,
    };

    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(backup, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="pos-contacts-backup-${stamp}.json"`,
      },
    });
  } catch (err) {
    console.error("Failed to export contacts backup", err);
    return NextResponse.json(
      { error: "Failed to export contacts backup" },
      { status: 500 },
    );
  } finally {
    if (client) client.release();
  }
}

// POST /api/customers/backup — restore contacts only
export async function POST(req: NextRequest) {
  let client;
  try {
    const body = (await req.json()) as unknown;
    if (!isContactsBackupPayload(body)) {
      return NextResponse.json(
        { error: "Invalid contacts backup file format" },
        { status: 400 },
      );
    }

    client = await pgPool.connect();
    await ensureCustomersTable(client);
    await client.query("BEGIN");

    await client.query(`DELETE FROM customers`);

    for (const row of body.customers) {
      await client.query(
        `INSERT INTO customers (id, name, phone, created_at)
         VALUES ($1, $2, $3, COALESCE($4::timestamptz, NOW()))`,
        [row.id, row.name, row.phone ?? "", row.created_at ?? null],
      );
    }

    await resetCustomersSequence(client);
    await client.query("COMMIT");

    return NextResponse.json(
      {
        success: true,
        restored: { customers: body.customers.length },
      },
      { status: 200 },
    );
  } catch (err) {
    if (client) {
      await client.query("ROLLBACK").catch(() => {});
    }
    console.error("Failed to restore contacts backup", err);
    return NextResponse.json(
      { error: "Failed to restore contacts backup" },
      { status: 500 },
    );
  } finally {
    if (client) client.release();
  }
}
