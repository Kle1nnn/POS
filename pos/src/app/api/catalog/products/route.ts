import { NextRequest, NextResponse } from "next/server";
import { pgPool } from "../../../../lib/db";
import { ensureCatalogTables } from "../../../../lib/catalog";

function mapProduct(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) ?? "",
    basePrice: Number(row.base_price),
    image: (row.image as string) || "deals.png",
    category: row.category as string,
    createdAt: row.created_at as string | undefined,
  };
}

// GET /api/catalog/products
export async function GET() {
  let client;
  try {
    await ensureCatalogTables();
    client = await pgPool.connect();
    const result = await client.query(
      `SELECT id, name, description, base_price, image, category, created_at
       FROM custom_products
       ORDER BY created_at DESC, id DESC`,
    );
    return NextResponse.json(
      { products: result.rows.map(mapProduct) },
      { status: 200 },
    );
  } catch (err) {
    console.error("Failed to list products", err);
    return NextResponse.json(
      { error: "Failed to list products" },
      { status: 500 },
    );
  } finally {
    if (client) client.release();
  }
}

// POST /api/catalog/products — { name, category, basePrice, description?, image? }
export async function POST(req: NextRequest) {
  let client;
  try {
    const body = (await req.json()) as {
      name?: string;
      category?: string;
      basePrice?: number | string;
      description?: string;
      image?: string;
    };

    const name = body.name?.trim();
    const category = body.category?.trim();
    const basePrice = Number(body.basePrice);

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (!category) {
      return NextResponse.json(
        { error: "category is required" },
        { status: 400 },
      );
    }
    if (!Number.isFinite(basePrice) || basePrice < 0) {
      return NextResponse.json(
        { error: "valid basePrice is required" },
        { status: 400 },
      );
    }

    const description = body.description?.trim() || name;
    const image = body.image?.trim() || "deals.png";
    const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await ensureCatalogTables();
    client = await pgPool.connect();

    const result = await client.query(
      `INSERT INTO custom_products (id, name, description, base_price, image, category)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, description, base_price, image, category, created_at`,
      [id, name, description, basePrice, image, category],
    );

    return NextResponse.json(
      { product: mapProduct(result.rows[0]) },
      { status: 201 },
    );
  } catch (err) {
    console.error("Failed to create product", err);
    return NextResponse.json(
      { error: "Failed to create product" },
      { status: 500 },
    );
  } finally {
    if (client) client.release();
  }
}

// DELETE /api/catalog/products?id=...
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")?.trim() ?? "";
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  let client;
  try {
    await ensureCatalogTables();
    client = await pgPool.connect();
    const result = await client.query(
      `DELETE FROM custom_products WHERE id = $1 RETURNING id`,
      [id],
    );
    if (!result.rowCount) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("Failed to delete product", err);
    return NextResponse.json(
      { error: "Failed to delete product" },
      { status: 500 },
    );
  } finally {
    if (client) client.release();
  }
}
