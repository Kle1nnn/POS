import { pgPool } from "./db";
import { ensureCatalogTables } from "./catalog";
import { normalizeBuiltinProducts } from "./menuCatalog";

export type InventoryLogEntry = {
  id: number;
  productId: string;
  productName: string;
  sku: string;
  barcode: string;
  previousStock: number | null;
  newStock: number | null;
  quantityChange: number;
  reason: string;
  source: string;
  orderCode: string | null;
  createdAt: string;
};

export class InsufficientStockError extends Error {
  productName: string;
  available: number;
  requested: number;

  constructor(productName: string, available: number, requested: number) {
    super(
      available <= 0
        ? `${productName} is out of stock (0 remaining)`
        : `Only ${available} left in stock for ${productName} (requested ${requested})`,
    );
    this.name = "InsufficientStockError";
    this.productName = productName;
    this.available = available;
    this.requested = requested;
  }
}

type DbClient = Awaited<ReturnType<typeof pgPool.connect>>;

function mapLogRow(row: Record<string, unknown>): InventoryLogEntry {
  return {
    id: Number(row.id),
    productId: String(row.product_id ?? ""),
    productName: String(row.product_name ?? ""),
    sku: String(row.sku ?? ""),
    barcode: String(row.barcode ?? ""),
    previousStock:
      row.previous_stock == null ? null : Number(row.previous_stock),
    newStock: row.new_stock == null ? null : Number(row.new_stock),
    quantityChange: Number(row.quantity_change ?? 0),
    reason: String(row.reason ?? "Adjustment"),
    source: String(row.source ?? "manual"),
    orderCode: row.order_code == null ? null : String(row.order_code),
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

export async function recordInventoryLog(
  client: DbClient,
  input: {
    productId: string;
    productName: string;
    sku?: string;
    barcode?: string;
    previousStock: number | null;
    newStock: number | null;
    quantityChange: number;
    reason: string;
    source: string;
    orderCode?: string | null;
  },
): Promise<InventoryLogEntry> {
  const result = await client.query(
    `INSERT INTO inventory_logs (
       product_id, product_name, sku, barcode,
       previous_stock, new_stock, quantity_change,
       reason, source, order_code
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING id, product_id, product_name, sku, barcode,
               previous_stock, new_stock, quantity_change,
               reason, source, order_code, created_at`,
    [
      input.productId,
      input.productName,
      (input.sku ?? "").trim(),
      (input.barcode ?? "").trim(),
      input.previousStock,
      input.newStock,
      Math.trunc(input.quantityChange),
      (input.reason || "Adjustment").trim(),
      input.source || "manual",
      input.orderCode ?? null,
    ],
  );
  return mapLogRow(result.rows[0]);
}

export async function listInventoryLogs(opts?: {
  search?: string;
  filter?: string;
  productId?: string;
  limit?: number;
}): Promise<InventoryLogEntry[]> {
  await ensureCatalogTables();
  const q = (opts?.search || "").trim();
  const filter = (opts?.filter || "").trim().toLowerCase();
  const productId = (opts?.productId || "").trim();
  const limit = Math.min(500, Math.max(1, Number(opts?.limit) || 200));

  const client = await pgPool.connect();
  try {
    const result = await client.query(
      `SELECT id, product_id, product_name, sku, barcode,
              previous_stock, new_stock, quantity_change,
              reason, source, order_code, created_at
       FROM inventory_logs
       WHERE (
         $1::text = ''
         OR LOWER(product_name) LIKE LOWER($2)
         OR LOWER(sku) LIKE LOWER($2)
         OR LOWER(barcode) LIKE LOWER($2)
         OR LOWER(reason) LIKE LOWER($2)
         OR LOWER(COALESCE(order_code, '')) LIKE LOWER($2)
       )
         AND (
           $3::text = ''
           OR ($3 = 'in' AND quantity_change > 0)
           OR ($3 = 'out' AND quantity_change < 0)
           OR ($3 = 'manual' AND source <> 'sale')
           OR ($3 = 'sale' AND source = 'sale')
           OR ($3 = 'scan' AND (source = 'scan_event' OR LOWER(reason) = 'scan_event'))
         )
         AND ($4::text = '' OR product_id = $4)
         ORDER BY created_at DESC, id DESC
         LIMIT $5`,
      [q, `%${q}%`, filter, productId, limit],
    );
    return result.rows.map(mapLogRow);
  } finally {
    client.release();
  }
}

export async function adjustProductStock(
  client: DbClient,
  opts: {
    productId: string;
    mode: "add" | "subtract" | "set" | "scan_event";
    quantity: number | null;
    reason?: string;
    source?: string;
    scanEvent?: boolean;
    barcode?: string;
  },
): Promise<{
  productId: string;
  productName: string;
  previousStock: number | null;
  newStock: number | null;
  log: InventoryLogEntry | null;
}> {
  const { productId, mode, quantity } = opts;
  const isScanEvent =
    mode === "scan_event" ||
    Boolean(opts.scanEvent) ||
    opts.source === "scan_event";
  const builtin = normalizeBuiltinProducts().find((p) => p.id === productId);

  const existingRes = await client.query(
    `SELECT id, name, sku, barcode, stock, is_deleted
     FROM custom_products
     WHERE id = $1`,
    [productId],
  );
  const row = existingRes.rows[0] as Record<string, unknown> | undefined;

  if (!row && !builtin) {
    throw new Error("Product not found");
  }
  if (row?.is_deleted) {
    throw new Error("Cannot adjust stock for deleted product");
  }

  const productName = String(row?.name || builtin?.name || "Item");
  const sku = String(row?.sku ?? builtin?.sku ?? "");
  const barcode = String(
    row?.barcode || builtin?.barcode || opts.barcode || "",
  );
  const prevStock =
    row && row.stock != null
      ? Number(row.stock)
      : builtin?.stock != null
        ? Number(builtin.stock)
        : null;

  let newStock: number | null = prevStock;
  if (mode === "scan_event") {
    newStock = prevStock;
  } else if (mode === "set") {
    newStock = quantity == null ? null : Math.max(0, Math.floor(quantity));
  } else if (mode === "add") {
    const qty = Math.max(0, Math.floor(Number(quantity) || 0));
    newStock = (prevStock ?? 0) + qty;
  } else if (mode === "subtract") {
    const qty = Math.max(0, Math.floor(Number(quantity) || 0));
    newStock = Math.max(0, (prevStock ?? 0) - qty);
  }

  if (mode !== "scan_event") {
    if (row) {
      await client.query(
        `UPDATE custom_products
         SET stock = $1, updated_at = NOW()
         WHERE id = $2`,
        [newStock, productId],
      );
    } else if (builtin) {
      await client.query(
        `INSERT INTO custom_products (
           id, name, description, base_price, image, category,
           size_prices, sizes, has_extra_toppings, has_sauce_options,
           sku, barcode, stock, is_deleted, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,false,NOW())
         ON CONFLICT (id) DO UPDATE SET
           stock = EXCLUDED.stock,
           updated_at = NOW()`,
        [
          builtin.id,
          builtin.name,
          builtin.description || builtin.name,
          builtin.basePrice,
          builtin.image || "deals.png",
          builtin.category,
          builtin.sizePrices ? JSON.stringify(builtin.sizePrices) : null,
          builtin.sizes ? JSON.stringify(builtin.sizes) : null,
          builtin.hasExtraToppings ?? null,
          builtin.hasSauceOptions ?? null,
          sku,
          barcode,
          newStock,
        ],
      );
    }
  }

  let quantityChange = 0;
  if (newStock != null && prevStock != null) {
    quantityChange = newStock - prevStock;
  } else if (newStock != null && prevStock == null) {
    quantityChange = newStock;
  } else if (newStock == null && prevStock != null) {
    quantityChange = -prevStock;
  }

  const defaultReason = isScanEvent
    ? "scan_event"
    : newStock === null && prevStock !== null
      ? "Stock tracking removed (Unlimited)"
      : prevStock === null && newStock !== null
        ? "Initial stock set"
        : quantityChange > 0
          ? "Restock"
          : quantityChange < 0
            ? "Stock deduction"
            : "Stock verified";

  const reason = (opts.reason || "").trim() || defaultReason;
  const source =
    opts.source ||
    (isScanEvent
      ? "scan_event"
      : quantityChange > 0
        ? "restock"
        : "adjustment");

  let log: InventoryLogEntry | null = null;
  if (isScanEvent || prevStock !== newStock || quantityChange !== 0) {
    log = await recordInventoryLog(client, {
      productId,
      productName,
      sku,
      barcode,
      previousStock: prevStock,
      newStock,
      quantityChange,
      reason,
      source,
    });
  }

  return { productId, productName, previousStock: prevStock, newStock, log };
}

export async function applyOrderStockDelta(
  client: DbClient,
  opts: {
    orderCode: string;
    deltas: Map<string, { name: string; deltaQty: number }>;
    enforceAvailability?: boolean;
    reasonPrefix?: string;
  },
): Promise<void> {
  const { orderCode, deltas, enforceAvailability = true, reasonPrefix } = opts;
  for (const [productId, { name, deltaQty }] of deltas.entries()) {
    if (!productId || deltaQty === 0) continue;

    const res = await client.query(
      `SELECT id, name, sku, barcode, stock, is_deleted
       FROM custom_products
       WHERE id = $1
       FOR UPDATE`,
      [productId],
    );
    const row = res.rows[0] as Record<string, unknown> | undefined;
    if (!row || row.stock == null) {
      continue;
    }

    const prevStock = Number(row.stock);
    const productName = String(row.name || name || productId);
    if (deltaQty > 0 && enforceAvailability) {
      if (prevStock <= 0 || deltaQty > prevStock) {
        throw new InsufficientStockError(productName, prevStock, deltaQty);
      }
    }

    const nextStock = Math.max(0, prevStock - deltaQty);
    const actualChange = nextStock - prevStock;

    if (actualChange !== 0) {
      await client.query(
        `UPDATE custom_products
         SET stock = $1, updated_at = NOW()
         WHERE id = $2`,
        [nextStock, productId],
      );

      const reason = reasonPrefix
        ? `${reasonPrefix} (${orderCode})`
        : actualChange < 0
          ? `Order sale (${orderCode})`
          : `Order item removed / reduced (${orderCode})`;

      await recordInventoryLog(client, {
        productId,
        productName,
        sku: String(row.sku ?? ""),
        barcode: String(row.barcode ?? ""),
        previousStock: prevStock,
        newStock: nextStock,
        quantityChange: actualChange,
        reason,
        source: "sale",
        orderCode,
      });
    }
  }
}
