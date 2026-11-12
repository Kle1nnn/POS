import { NextRequest, NextResponse } from "next/server";
import { pgPool } from "../../../../lib/db";
import { ensureCatalogTables } from "../../../../lib/catalog";
import { adjustProductStock, listInventoryLogs } from "../../../../lib/inventory";
import {
  mergeMenuProducts,
  type CatalogProductRow,
} from "../../../../lib/menuCatalog";

function mapOverrideRow(row: Record<string, unknown>): CatalogProductRow {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    description: String(row.description ?? ""),
    basePrice: Number(row.base_price ?? 0),
    image: String(row.image ?? "deals.png"),
    category: String(row.category ?? "Other"),
    sizePrices: (row.size_prices as Record<string, number> | null) ?? null,
    sizes: (row.sizes as string[] | null) ?? null,
    hasExtraToppings:
      row.has_extra_toppings == null ? null : Boolean(row.has_extra_toppings),
    hasSauceOptions:
      row.has_sauce_options == null ? null : Boolean(row.has_sauce_options),
    sku: String(row.sku ?? "").trim(),
    barcode: String(row.barcode ?? "").trim(),
    stock: row.stock == null ? null : Number(row.stock),
    isDeleted: Boolean(row.is_deleted),
    createdAt: row.created_at as string | undefined,
  };
}

// GET /api/catalog/inventory?q=...&filter=...&productId=...&limit=...
export async function GET(req: NextRequest) {
  try {
    const search = req.nextUrl.searchParams.get("q") || "";
    const filter = req.nextUrl.searchParams.get("filter") || "";
    const productId = req.nextUrl.searchParams.get("productId") || "";
    const limitParam = req.nextUrl.searchParams.get("limit");
    const limit = limitParam ? Number(limitParam) : 200;

    const logs = await listInventoryLogs({
      search,
      filter,
      productId,
      limit,
    });
    return NextResponse.json({ logs }, { status: 200 });
  } catch (err) {
    console.error("Failed to fetch inventory logs", err);
    return NextResponse.json(
      { error: "Failed to fetch inventory logs" },
      { status: 500 },
    );
  }
}

// POST /api/catalog/inventory — perform a restock, stock adjustment, or scan_event log
export async function POST(req: NextRequest) {
  let client;
  try {
    const body = (await req.json()) as {
      productId?: string;
      barcode?: string;
      mode?: "add" | "subtract" | "set" | "scan_event";
      quantity?: number | string | null;
      reason?: string;
      source?: string;
      scanEvent?: boolean;
    };

    let productId = body.productId?.trim() || "";
    const barcode = body.barcode?.trim() || "";
    const reasonInput = body.reason?.trim() || "";
    const isScanEvent =
      body.mode === "scan_event" ||
      body.scanEvent === true ||
      body.source === "scan_event" ||
      reasonInput.toLowerCase() === "scan_event";

    const mode: "add" | "subtract" | "set" | "scan_event" | undefined =
      body.mode ?? (isScanEvent ? "scan_event" : undefined);

    if (!productId && !barcode) {
      return NextResponse.json(
        { error: "productId or barcode is required" },
        { status: 400 },
      );
    }
    if (
      mode !== "add" &&
      mode !== "subtract" &&
      mode !== "set" &&
      mode !== "scan_event"
    ) {
      return NextResponse.json(
        { error: "mode must be 'add', 'subtract', 'set', or 'scan_event'" },
        { status: 400 },
      );
    }

    let parsedQty: number | null = null;
    if (mode === "scan_event") {
      if (
        body.quantity !== undefined &&
        body.quantity !== null &&
        body.quantity !== ""
      ) {
        const n = Number(body.quantity);
        if (!Number.isFinite(n) || n < 0) {
          return NextResponse.json(
            { error: "Enter a valid quantity" },
            { status: 400 },
          );
        }
        parsedQty = Math.floor(n);
      }
    } else if (
      mode === "set" &&
      (body.quantity === null || body.quantity === "")
    ) {
      parsedQty = null;
    } else {
      const n = Number(body.quantity);
      if (!Number.isFinite(n) || n < 0 || (mode !== "set" && n <= 0)) {
        return NextResponse.json(
          { error: "Enter a valid quantity" },
          { status: 400 },
        );
      }
      parsedQty = Math.floor(n);
    }

    await ensureCatalogTables();
    client = await pgPool.connect();

    if (!productId && barcode) {
      const overrideRes = await client.query(
        `SELECT id, name, description, base_price, image, category,
                size_prices, sizes, has_extra_toppings, has_sauce_options,
                sku, barcode, stock, is_deleted, created_at
         FROM custom_products
         ORDER BY created_at DESC, id DESC`,
      );
      const merged = mergeMenuProducts(overrideRes.rows.map(mapOverrideRow));
      const matched = merged.find(
        (p) =>
          !p.isDeleted &&
          (p.barcode || "").trim().toLowerCase() === barcode.toLowerCase(),
      );
      if (!matched) {
        return NextResponse.json(
          { error: "Product not found for barcode" },
          { status: 404 },
        );
      }
      productId = matched.id;
    }

    const reason = isScanEvent ? reasonInput || "scan_event" : reasonInput;
    const source = isScanEvent
      ? "scan_event"
      : body.source || (mode === "add" ? "restock" : "adjustment");

    await client.query("BEGIN");

    const result = await adjustProductStock(client, {
      productId,
      mode,
      quantity: parsedQty,
      reason,
      source,
      scanEvent: isScanEvent,
      barcode,
    });

    await client.query("COMMIT");
    return NextResponse.json({ adjustment: result }, { status: 200 });
  } catch (err) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    const msg =
      err instanceof Error ? err.message : "Failed to adjust inventory";
    const status = msg.includes("not found") ? 404 : 400;
    console.error("Failed to adjust inventory", err);
    return NextResponse.json({ error: msg }, { status });
  } finally {
    if (client) client.release();
  }
}
