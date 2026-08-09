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

function mapCategory(row: {
  id: number | string;
  name: string;
  label: string;
  emoji: string;
  image: string;
  created_at: string;
}) {
  return {
    id: Number(row.id),
    name: row.name as string,
    label: row.label as string,
    emoji: row.emoji as string,
    image: row.image as string,
    createdAt: row.created_at as string,
  };
}

// PATCH /api/catalog/categories — { id, name?, label?, emoji?, image? }
export async function PATCH(req: NextRequest) {
  let client;
  try {
    const body = (await req.json()) as {
      id?: number;
      name?: string;
      label?: string;
      emoji?: string;
      image?: string;
    };

    const id = Number(body.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "valid id is required" }, { status: 400 });
    }

    await ensureCatalogTables();
    client = await pgPool.connect();

    const existing = await client.query(
      `SELECT id, name, label, emoji, image, created_at
       FROM custom_categories WHERE id = $1`,
      [id],
    );
    if (!existing.rowCount) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const current = existing.rows[0];
    const name =
      body.name !== undefined ? body.name.trim() : (current.name as string);
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    const label =
      body.label !== undefined
        ? body.label.trim() || name
        : (current.label as string);
    const emoji =
      body.emoji !== undefined
        ? body.emoji.trim() || "📦"
        : (current.emoji as string);
    const image =
      body.image !== undefined
        ? body.image.trim() || "deals.png"
        : (current.image as string);

    const clash = await client.query(
      `SELECT id FROM custom_categories
       WHERE LOWER(name) = LOWER($1) AND id <> $2`,
      [name, id],
    );
    if (clash.rowCount && clash.rowCount > 0) {
      return NextResponse.json(
        { error: "Category already exists" },
        { status: 409 },
      );
    }

    const oldName = current.name as string;
    await client.query("BEGIN");
    try {
      const result = await client.query(
        `UPDATE custom_categories
         SET name = $1, label = $2, emoji = $3, image = $4
         WHERE id = $5
         RETURNING id, name, label, emoji, image, created_at`,
        [name, label, emoji, image, id],
      );

      if (oldName.toLowerCase() !== name.toLowerCase()) {
        await client.query(
          `UPDATE custom_products
           SET category = $1, updated_at = NOW()
           WHERE LOWER(category) = LOWER($2)`,
          [name, oldName],
        );
      }

      await client.query("COMMIT");
      return NextResponse.json(
        { category: mapCategory(result.rows[0]) },
        { status: 200 },
      );
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  } catch (err) {
    console.error("Failed to update category", err);
    return NextResponse.json(
      { error: "Failed to update category" },
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
      `DELETE FROM custom_categories WHERE id = $1 RETURNING id, name, image`,
      [id],
    );
    if (!result.rowCount) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }
    return NextResponse.json(
      {
        ok: true,
        image: result.rows[0].image as string,
      },
      { status: 200 },
    );
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
