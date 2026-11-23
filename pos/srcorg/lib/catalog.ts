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
            ADD COLUMN IF NOT EXISTS stock integer;
          CREATE INDEX IF NOT EXISTS idx_custom_products_category
            ON custom_products (LOWER(category));
          CREATE INDEX IF NOT EXISTS idx_custom_products_sku
            ON custom_products (LOWER(sku))
            WHERE sku <> '';
        `);
      } finally {
        client.release();
      }
    })();
  }
  return ready;
}
