-- PostgreSQL schema for this POS project.
-- Matches current Next.js API queries and minimizes code changes.

BEGIN;

-- Store state (single row, id=1)
CREATE TABLE IF NOT EXISTS store_state (
  id                   integer PRIMARY KEY,
  current_business_date date NOT NULL,
  opened_at            timestamptz NULL,
  closed_at            timestamptz NULL
);

-- Orders and items
CREATE TABLE IF NOT EXISTS orders (
  id              bigserial PRIMARY KEY,
  order_code      text NOT NULL UNIQUE,
  status          text NOT NULL CHECK (status IN ('saved', 'checkedout')),
  total           numeric(12,2) NOT NULL DEFAULT 0,
  notes           text NULL,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  checked_out_at  timestamptz NULL,
  business_date   date NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_status_created_at ON orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_business_date ON orders (business_date);

CREATE TABLE IF NOT EXISTS order_items (
  id               bigserial PRIMARY KEY,
  order_id         bigint NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id       bigint NULL,
  product_name     text NOT NULL,
  category         text NULL,
  selected_size    text NULL,
  selected_topping text NULL,
  selected_sauce   text NULL,
  unit_price       numeric(12,2) NOT NULL DEFAULT 0,
  quantity         integer NOT NULL DEFAULT 1 CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- Daily aggregate by business date
CREATE TABLE IF NOT EXISTS daily_sales (
  sale_date     date PRIMARY KEY,
  total_revenue numeric(14,2) NOT NULL DEFAULT 0,
  total_orders  integer NOT NULL DEFAULT 0,
  total_items   integer NOT NULL DEFAULT 0,
  updated_at    timestamptz NOT NULL DEFAULT NOW()
);

-- All-time aggregate (single row, id=1)
CREATE TABLE IF NOT EXISTS all_time_sales (
  id            integer PRIMARY KEY CHECK (id = 1),
  total_revenue numeric(14,2) NOT NULL DEFAULT 0,
  total_orders  integer NOT NULL DEFAULT 0,
  total_items   integer NOT NULL DEFAULT 0,
  updated_at    timestamptz NOT NULL DEFAULT NOW()
);

INSERT INTO all_time_sales (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- Ensure orders.business_date is filled from store_state.current_business_date
CREATE OR REPLACE FUNCTION set_order_business_date()
RETURNS trigger AS $$
DECLARE
  bdate date;
BEGIN
  IF NEW.business_date IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT current_business_date INTO bdate
  FROM store_state
  WHERE id = 1;

  NEW.business_date := COALESCE(bdate, CURRENT_DATE);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_orders_set_business_date ON orders;
CREATE TRIGGER trg_orders_set_business_date
BEFORE INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION set_order_business_date();

-- Apply aggregates when an order becomes checked out (inserted as checkedout or updated to checkedout)
CREATE OR REPLACE FUNCTION apply_sales_aggregates_for_order()
RETURNS trigger AS $$
DECLARE
  bdate date;
  item_count integer;
  revenue numeric(14,2);
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.status <> 'checkedout' OR OLD.status = 'checkedout' THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'checkedout' THEN
      RETURN NEW;
    END IF;
  END IF;

  bdate := COALESCE(NEW.business_date, CURRENT_DATE);
  revenue := COALESCE(NEW.total, 0);

  SELECT COALESCE(SUM(quantity), 0) INTO item_count
  FROM order_items
  WHERE order_id = NEW.id;

  INSERT INTO daily_sales (sale_date, total_revenue, total_orders, total_items, updated_at)
  VALUES (bdate, revenue, 1, item_count, NOW())
  ON CONFLICT (sale_date) DO UPDATE
  SET total_revenue = daily_sales.total_revenue + EXCLUDED.total_revenue,
      total_orders  = daily_sales.total_orders + EXCLUDED.total_orders,
      total_items   = daily_sales.total_items + EXCLUDED.total_items,
      updated_at    = NOW();

  UPDATE all_time_sales
  SET total_revenue = total_revenue + revenue,
      total_orders  = total_orders + 1,
      total_items   = total_items + item_count,
      updated_at    = NOW()
  WHERE id = 1;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_orders_aggregate_on_insert ON orders;
CREATE TRIGGER trg_orders_aggregate_on_insert
AFTER INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION apply_sales_aggregates_for_order();

DROP TRIGGER IF EXISTS trg_orders_aggregate_on_checkout ON orders;
CREATE TRIGGER trg_orders_aggregate_on_checkout
AFTER UPDATE OF status ON orders
FOR EACH ROW
EXECUTE FUNCTION apply_sales_aggregates_for_order();

COMMIT;

