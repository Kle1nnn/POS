import { NextRequest, NextResponse } from "next/server";
import { pgPool } from "../../../../lib/db";
import { ensureCatalogTables } from "../../../../lib/catalog";

// GET /api/catalog/categories
export async function GET() {
  let client;
  try {
    await ensureCatalogTables();
    client = await pgPool.connect();
    const result = await client.query(
      `SELECT id, name, label, emoji, image, created_at
       FROM custom_categories
       ORDER BY created_at DESC, id DESC`,
    );
    return NextResponse.json(
      {
        categories: result.rows.map((row) => ({
          id: Number(row.id),
          name: row.name as string,
          label: row.label as string,
          emoji: row.emoji as string,
          image: row.image as string,
          createdAt: row.created_at as string,
        })),
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("Failed to list categories", err);
    return NextResponse.json(
      { error: "Failed to list categories" },
      { status: 500 },
    );
  } finally {
    if (client) client.release();
  }
}

// POST /api/catalog/categories — { name, label?, emoji?, image? }
export async function POST(req: NextRequest) {
  let client;
  try {
    const body = (await req.json()) as {
      name?: string;
      label?: string;
      emoji?: string;
      image?: string;
    };

    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const label = body.label?.trim() || name;
    const emoji = body.emoji?.trim() || "📦";
    const image = body.image?.trim() || "deals.png";

    await ensureCatalogTables();
    client = await pgPool.connect();

    const existing = await client.query(
      `SELECT id FROM custom_categories WHERE LOWER(name) = LOWER($1)`,
      [name],
    );
    if (existing.rowCount && existing.rowCount > 0) {
      return NextResponse.json(
        { error: "Category already exists" },
        { status: 409 },
      );
    }

    const result = await client.query(
      `INSERT INTO custom_categories (name, label, emoji, image)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, label, emoji, image, created_at`,
      [name, label, emoji, image],
    );

    const row = result.rows[0];
    return NextResponse.json(
      {
        category: {
          id: Number(row.id),
          name: row.name as string,
          label: row.label as string,
          emoji: row.emoji as string,
          image: row.image as string,
          createdAt: row.created_at as string,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("Failed to create category", err);
    return NextResponse.json(
      { error: "Failed to create category" },
      { status: 500 },
    );
  } finally {
    if (client) client.release();
  }
}

// DELETE /api/catalog/categories?id=123
export async function DELETE(req: NextRequest) {
  const idParam = req.nextUrl.searchParams.get("id");
  const id = idParam ? Number(idParam) : NaN;
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "valid id is required" }, { status: 400 });
  }

  let client;
  try {
    await ensureCatalogTables();
    client = await pgPool.connect();
    const result = await client.query(
      `DELETE FROM custom_categories WHERE id = $1 RETURNING id, name`,
      [id],
    );
    if (!result.rowCount) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("Failed to delete category", err);
    return NextResponse.json(
      { error: "Failed to delete category" },
      { status: 500 },
    );
  } finally {
    if (client) client.release();
  }
}
