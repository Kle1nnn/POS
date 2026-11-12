import { pgPool } from "./db";

let ready: Promise<void> | null = null;

export function ensureCatalogTables(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      const client = await pgPool.connect();
      try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS custom_categories (
            id         bigserial PRIMARY KEY,
            name       text NOT NULL UNIQUE,
            label      text NOT NULL,
            emoji      text NOT NULL DEFAULT '📦',
            image      text NOT NULL DEFAULT 'deals.png',
            created_at timestamptz NOT NULL DEFAULT NOW()
          );
          CREATE TABLE IF NOT EXISTS custom_products (
            id          text PRIMARY KEY,
            name        text NOT NULL,
            description text NOT NULL DEFAULT '',
            base_price  numeric(12,2) NOT NULL DEFAULT 0,
            image       text NOT NULL DEFAULT 'deals.png',
            category    text NOT NULL,
            created_at  timestamptz NOT NULL DEFAULT NOW()
          );
          ALTER TABLE custom_products
            ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;
          ALTER TABLE custom_products
            ADD COLUMN IF NOT EXISTS size_prices jsonb;
          ALTER TABLE custom_products
            ADD COLUMN IF NOT EXISTS sizes jsonb;
          ALTER TABLE custom_products
            ADD COLUMN IF NOT EXISTS has_extra_toppings boolean;
          ALTER TABLE custom_products
            ADD COLUMN IF NOT EXISTS has_sauce_options boolean;
          ALTER TABLE custom_products
            ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT NOW();
          ALTER TABLE custom_products
            ADD COLUMN IF NOT EXISTS sku text NOT NULL DEFAULT '';
          ALTER TABLE custom_products
            ADD COLUMN IF NOT EXISTS barcode text NOT NULL DEFAULT '';
          ALTER TABLE custom_products
            ADD COLUMN IF NOT EXISTS stock integer;
          CREATE INDEX IF NOT EXISTS idx_custom_products_category
            ON custom_products (LOWER(category));
          CREATE INDEX IF NOT EXISTS idx_custom_products_sku
            ON custom_products (LOWER(sku))
            WHERE sku <> '';
          CREATE INDEX IF NOT EXISTS idx_custom_products_barcode
            ON custom_products (LOWER(barcode))
            WHERE barcode <> '';
          CREATE TABLE IF NOT EXISTS inventory_logs (
            id              bigserial PRIMARY KEY,
            product_id      text NOT NULL,
            product_name    text NOT NULL,
            sku             text NOT NULL DEFAULT '',
            barcode         text NOT NULL DEFAULT '',
            previous_stock  integer NULL,
            new_stock       integer NULL,
            quantity_change integer NOT NULL DEFAULT 0,
            reason          text NOT NULL DEFAULT 'Adjustment',
            source          text NOT NULL DEFAULT 'manual',
            order_code      text NULL,
            created_at      timestamptz NOT NULL DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_inventory_logs_created_at
            ON inventory_logs (created_at DESC);
          CREATE INDEX IF NOT EXISTS idx_inventory_logs_product_id
            ON inventory_logs (product_id);
          ALTER TABLE IF EXISTS order_items
            ADD COLUMN IF NOT EXISTS product_key text NULL;
        `);
      } finally {
        client.release();
      }
    })();
  }
  return ready;
}
