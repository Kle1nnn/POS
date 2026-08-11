import { NextRequest, NextResponse } from "next/server";
import { pgPool } from "../../../../lib/db";
import { ensureCatalogTables } from "../../../../lib/catalog";
import {
  mergeMenuProducts,
  normalizeBuiltinProducts,
  type CatalogProductRow,
} from "../../../../lib/menuCatalog";

function parseStock(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

function mapRow(row: Record<string, unknown>): CatalogProductRow {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) ?? "",
    basePrice: Number(row.base_price),
    image: (row.image as string) || "deals.png",
    category: row.category as string,
    sizePrices: (row.size_prices as Record<string, number> | null) ?? null,
    sizes: (row.sizes as string[] | null) ?? null,
    hasExtraToppings:
      row.has_extra_toppings == null ? null : Boolean(row.has_extra_toppings),
    hasSauceOptions:
      row.has_sauce_options == null ? null : Boolean(row.has_sauce_options),
    sku: ((row.sku as string) ?? "").trim(),
    stock: row.stock == null ? null : Number(row.stock),
    isDeleted: Boolean(row.is_deleted),
    createdAt: row.created_at as string | undefined,
  };
}

const PRODUCT_SELECT = `id, name, description, base_price, image, category,
            size_prices, sizes, has_extra_toppings, has_sauce_options,
            sku, stock, is_deleted, created_at`;

async function loadOverrideRows(
  client: Awaited<ReturnType<typeof pgPool.connect>>,
) {
  const result = await client.query(
    `SELECT ${PRODUCT_SELECT}
     FROM custom_products
     ORDER BY created_at DESC, id DESC`,
  );
  return result.rows.map(mapRow);
}

// GET /api/catalog/products
//   ?all=1   → every menu item (builtin + custom), for settings
//   ?menu=1  → active menu items only (for MenuGrid)
//   default  → DB rows only (legacy)
export async function GET(req: NextRequest) {
  const all = req.nextUrl.searchParams.get("all") === "1";
  const menu = req.nextUrl.searchParams.get("menu") === "1";
  let client;
  try {
    await ensureCatalogTables();
    client = await pgPool.connect();
    const overrides = await loadOverrideRows(client);

    if (all || menu) {
      const products = mergeMenuProducts(overrides).filter((p) =>
        menu ? !p.isDeleted : true,
      );
      return NextResponse.json({ products }, { status: 200 });
    }

    return NextResponse.json(
      {
        products: overrides
          .filter((p) => !p.isDeleted)
          .map((p) => ({ ...p, source: p.id.startsWith("custom-") ? "custom" : "builtin" })),
      },
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

// POST /api/catalog/products — create new custom item
export async function POST(req: NextRequest) {
  let client;
  try {
    const body = (await req.json()) as {
      name?: string;
      category?: string;
      basePrice?: number | string;
      description?: string;
      image?: string;
      sku?: string;
      stock?: number | string | null;
      sizePrices?: Record<string, number>;
      sizes?: string[];
      hasExtraToppings?: boolean;
      hasSauceOptions?: boolean;
    };

    const name = body.name?.trim();
    const category = body.category?.trim();
    const basePrice = Number(body.basePrice);
    const sku = body.sku?.trim() || "";
    const stock = parseStock(body.stock);

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
    if (
      body.stock !== undefined &&
      body.stock !== null &&
      body.stock !== "" &&
      stock === null
    ) {
      return NextResponse.json(
        { error: "valid stock is required" },
        { status: 400 },
      );
    }

    const description = body.description?.trim() || name;
    const image = body.image?.trim() || "deals.png";
    const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await ensureCatalogTables();
    client = await pgPool.connect();

    const result = await client.query(
      `INSERT INTO custom_products (
         id, name, description, base_price, image, category,
         size_prices, sizes, has_extra_toppings, has_sauce_options,
         sku, stock, is_deleted
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,false)
       RETURNING ${PRODUCT_SELECT}`,
      [
        id,
        name,
        description,
        basePrice,
        image,
        category,
        body.sizePrices ? JSON.stringify(body.sizePrices) : null,
        body.sizes ? JSON.stringify(body.sizes) : null,
        body.hasExtraToppings ?? null,
        body.hasSauceOptions ?? null,
        sku,
        stock,
      ],
    );

    return NextResponse.json(
      { product: { ...mapRow(result.rows[0]), source: "custom" } },
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

// PATCH /api/catalog/products — upsert edit for builtin or custom
export async function PATCH(req: NextRequest) {
  let client;
  try {
    const body = (await req.json()) as {
      id?: string;
      name?: string;
      category?: string;
      basePrice?: number | string;
      description?: string;
      image?: string;
      sku?: string;
      stock?: number | string | null;
      sizePrices?: Record<string, number> | null;
      sizes?: string[] | null;
      hasExtraToppings?: boolean | null;
      hasSauceOptions?: boolean | null;
    };

    const id = body.id?.trim();
    const name = body.name?.trim();
    const category = body.category?.trim();
    const basePrice = Number(body.basePrice);
    const sku = body.sku?.trim() || "";
    const stock = parseStock(body.stock);

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
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
    if (
      body.stock !== undefined &&
      body.stock !== null &&
      body.stock !== "" &&
      stock === null
    ) {
      return NextResponse.json(
        { error: "valid stock is required" },
        { status: 400 },
      );
    }

    const builtin = normalizeBuiltinProducts().find((p) => p.id === id);
    const description = body.description?.trim() || name;
    const image = body.image?.trim() || builtin?.image || "deals.png";
    const sizePrices =
      body.sizePrices ?? builtin?.sizePrices ?? null;
    const sizes = body.sizes ?? builtin?.sizes ?? null;
    const hasExtraToppings =
      body.hasExtraToppings ?? builtin?.hasExtraToppings ?? null;
    const hasSauceOptions =
      body.hasSauceOptions ?? builtin?.hasSauceOptions ?? null;

    await ensureCatalogTables();
    client = await pgPool.connect();

    const result = await client.query(
      `INSERT INTO custom_products (
         id, name, description, base_price, image, category,
         size_prices, sizes, has_extra_toppings, has_sauce_options,
         sku, stock, is_deleted, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,false,NOW())
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         base_price = EXCLUDED.base_price,
         image = EXCLUDED.image,
         category = EXCLUDED.category,
         size_prices = EXCLUDED.size_prices,
         sizes = EXCLUDED.sizes,
         has_extra_toppings = EXCLUDED.has_extra_toppings,
         has_sauce_options = EXCLUDED.has_sauce_options,
         sku = EXCLUDED.sku,
         stock = EXCLUDED.stock,
         is_deleted = false,
         updated_at = NOW()
       RETURNING ${PRODUCT_SELECT}`,
      [
        id,
        name,
        description,
        basePrice,
        image,
        category,
        sizePrices ? JSON.stringify(sizePrices) : null,
        sizes ? JSON.stringify(sizes) : null,
        hasExtraToppings,
        hasSauceOptions,
        sku,
        stock,
      ],
    );

    return NextResponse.json(
      {
        product: {
          ...mapRow(result.rows[0]),
          source: builtin ? "builtin" : "custom",
        },
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("Failed to update product", err);
    return NextResponse.json(
      { error: "Failed to update product" },
      { status: 500 },
    );
  } finally {
    if (client) client.release();
  }
}

// DELETE /api/catalog/products?id=...
// custom-* → hard delete; builtin → soft delete (hide from menu)
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")?.trim() ?? "";
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  let client;
  try {
    await ensureCatalogTables();
    client = await pgPool.connect();
    const builtin = normalizeBuiltinProducts().find((p) => p.id === id);
    const isCustom = id.startsWith("custom-") || !builtin;

    if (isCustom && !builtin) {
      const result = await client.query(
        `DELETE FROM custom_products WHERE id = $1 RETURNING id, image`,
        [id],
      );
      if (!result.rowCount) {
        return NextResponse.json({ error: "Product not found" }, { status: 404 });
      }
      return NextResponse.json(
        { ok: true, image: result.rows[0].image as string, soft: false },
        { status: 200 },
      );
    }

    // Soft-delete builtin (upsert hidden row)
    const existing = await client.query(
      `SELECT image FROM custom_products WHERE id = $1`,
      [id],
    );
    const image =
      (existing.rows[0]?.image as string | undefined) ||
      builtin?.image ||
      "deals.png";

    await client.query(
      `INSERT INTO custom_products (
         id, name, description, base_price, image, category, is_deleted, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,true,NOW())
       ON CONFLICT (id) DO UPDATE SET
         is_deleted = true,
         updated_at = NOW()`,
      [
        id,
        builtin?.name ?? "Deleted",
        builtin?.description ?? "",
        builtin?.basePrice ?? 0,
        image,
        builtin?.category ?? "Other",
      ],
    );

    return NextResponse.json({ ok: true, image, soft: true }, { status: 200 });
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
