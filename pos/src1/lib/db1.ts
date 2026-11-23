import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";
import fs from "fs";
import path from "path";

// In-memory file-backed mock database state for AI Studio preview environment when Postgres is offline
const todayStr = () => new Date().toISOString().slice(0, 10);
const MOCK_DB_PATH = path.join("/tmp", "pos_mock_db.json");

type MockStoreState = {
  id: number;
  current_business_date: string;
  opened_at: string;
  closed_at: string | null;
};

type MockReceiptSettings = {
  id: number;
  store_name: string;
  store_address: string;
  store_phones: string;
  logo_image: string;
  payment_title: string;
  payment_image: string;
  payment_line: string;
  receipt_prefix: string;
  receipt_next_number: number;
};

type MockMenuAppearance = {
  id: number;
  tile_size: number;
  tile_bg_color: string;
  tile_text_color: string;
  tile_border_color: string;
  font_family: string;
  font_size: number;
};

type MockAutoBackup = {
  id: number;
  contacts_enabled: boolean;
  full_enabled: boolean;
  contacts_time: string;
  full_time: string;
  custom_folder: string | null;
  last_contacts_date: string | null;
  last_full_date: string | null;
  last_contacts_at: string | null;
  last_full_at: string | null;
  last_contacts_file: string | null;
  last_full_file: string | null;
  last_error: string | null;
};

type MockPosSettings = {
  id: number;
  barcode_search_enabled: boolean;
  digital_clock_enabled: boolean;
};

type MockDatabaseSchema = {
  storeState: MockStoreState;
  receiptSettings: MockReceiptSettings;
  menuAppearance: MockMenuAppearance;
  autoBackup: MockAutoBackup;
  posSettings: MockPosSettings;
  dangerWipeCode: string;
  customers: QueryResultRow[];
  customCategories: QueryResultRow[];
  customProducts: QueryResultRow[];
  inventoryLogs: QueryResultRow[];
  orders: QueryResultRow[];
  orderItems: QueryResultRow[];
  orderIdCounter: number;
  orderItemIdCounter: number;
  customerIdCounter: number;
  categoryIdCounter: number;
  inventoryLogIdCounter: number;
};

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function getInitialData(): MockDatabaseSchema {
  return {
    storeState: {
      id: 1,
      current_business_date: todayStr(),
      opened_at: new Date().toISOString(),
      closed_at: null,
    },
    receiptSettings: {
      id: 1,
      store_name: "Tasty Bites Pizza , FastFood and BarBQ Tharushah",
      store_address: "Main Road Tharushah",
      store_phones: "03213611550 - 03063096900",
      logo_image: "logo.png",
      payment_title: "Online payment",
      payment_image: "Jz.jpg",
      payment_line: "JazzCash / EasyPaisa",
      receipt_prefix: "TBT",
      receipt_next_number: 1,
    },
    menuAppearance: {
      id: 1,
      tile_size: 90,
      tile_bg_color: "#dce8f5",
      tile_text_color: "#1a3a5c",
      tile_border_color: "#4a7aa8",
      font_family: "system-ui, sans-serif",
      font_size: 11.5,
    },
    autoBackup: {
      id: 1,
      contacts_enabled: false,
      full_enabled: false,
      contacts_time: "22:00",
      full_time: "23:00",
      custom_folder: null,
      last_contacts_date: null,
      last_full_date: null,
      last_contacts_at: null,
      last_full_at: null,
      last_contacts_file: null,
      last_full_file: null,
      last_error: null,
    },
    posSettings: {
      id: 1,
      barcode_search_enabled: true,
      digital_clock_enabled: true,
    },
    dangerWipeCode: "1234",
    customers: [],
    customCategories: [],
    customProducts: [],
    inventoryLogs: [],
    orders: [],
    orderItems: [],
    orderIdCounter: 1,
    orderItemIdCounter: 1,
    customerIdCounter: 1,
    categoryIdCounter: 1,
    inventoryLogIdCounter: 1,
  };
}

class MockDbStore {
  private data: MockDatabaseSchema;

  constructor() {
    this.data = this.readData();
  }

  private readData(): MockDatabaseSchema {
    const defaults = getInitialData();
    try {
      if (fs.existsSync(MOCK_DB_PATH)) {
        const content = fs.readFileSync(MOCK_DB_PATH, "utf8");
        const parsed = JSON.parse(content) as Partial<MockDatabaseSchema>;
        return {
          ...defaults,
          ...parsed,
          storeState: { ...defaults.storeState, ...(parsed.storeState || {}) },
          receiptSettings: {
            ...defaults.receiptSettings,
            ...(parsed.receiptSettings || {}),
          },
          menuAppearance: {
            ...defaults.menuAppearance,
            ...(parsed.menuAppearance || {}),
          },
          autoBackup: { ...defaults.autoBackup, ...(parsed.autoBackup || {}) },
          posSettings: {
            ...defaults.posSettings,
            ...(parsed.posSettings || {}),
          },
          customers: Array.isArray(parsed.customers) ? parsed.customers : [],
          customCategories: Array.isArray(parsed.customCategories)
            ? parsed.customCategories
            : [],
          customProducts: Array.isArray(parsed.customProducts)
            ? parsed.customProducts
            : [],
          inventoryLogs: Array.isArray(parsed.inventoryLogs)
            ? parsed.inventoryLogs
            : [],
          orders: Array.isArray(parsed.orders) ? parsed.orders : [],
          orderItems: Array.isArray(parsed.orderItems) ? parsed.orderItems : [],
          inventoryLogIdCounter: Number(parsed.inventoryLogIdCounter) || 1,
        };
      }
    } catch {
      // ignore
    }
    this.writeData(defaults);
    return defaults;
  }

  private writeData(data: MockDatabaseSchema) {
    try {
      fs.writeFileSync(MOCK_DB_PATH, JSON.stringify(data, null, 2), "utf8");
    } catch {
      // ignore
    }
  }

  private sync() {
    this.data = this.readData();
  }

  private save() {
    this.writeData(this.data);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async executeQuery<R extends QueryResultRow = any>(rawSql: string, values: unknown[] = []): Promise<QueryResult<R>> {
    this.sync();
    const sql = rawSql.trim();
    const upper = sql.toUpperCase();

    const makeResult = (rows: unknown[]): QueryResult<R> => ({
      command: upper.split(" ")[0] || "SELECT",
      rowCount: rows.length,
      oid: 0,
      fields: [],
      rows: rows as R[],
    });

    // 1. DDL and transaction control
    if (
      upper.startsWith("CREATE") ||
      upper.startsWith("ALTER") ||
      upper.startsWith("DROP") ||
      upper.startsWith("BEGIN") ||
      upper.startsWith("COMMIT") ||
      upper.startsWith("ROLLBACK") ||
      upper.startsWith("SET ")
    ) {
      return makeResult([]);
    }

    // 2. INSERT statements
    if (upper.startsWith("INSERT INTO ORDERS")) {
      // Check if full restore insert with (id, order_code, status, total, ...)
      if (upper.includes("(ID, ORDER_CODE, STATUS") || values.length >= 12) {
        const id = Number(values[0]);
        const orderCode = String(values[1] || `TBT-${id}`);
        const status = (String(values[2]) as "saved" | "checkedout") || "saved";
        const total = Number(values[3]) || 0;
        const notes = values[4] ? String(values[4]) : "";
        const instructions = values[5] ? String(values[5]) : "";
        const customerName = values[6] ? String(values[6]) : "";
        const customerPhone = values[7] ? String(values[7]) : "";
        const orderType = values[8] ? String(values[8]) : "Delivery";
        const tableNumber = values[9] != null ? Number(values[9]) : null;
        const createdAt = values[10] ? String(values[10]) : new Date().toISOString();
        const checkedOutAt = values[11] ? String(values[11]) : (status === "checkedout" ? createdAt : null);
        const bDate = values[12] ? String(values[12]) : this.data.storeState.current_business_date;

        const newOrder = {
          id,
          order_code: orderCode,
          status,
          total,
          notes,
          instructions,
          customer_name: customerName,
          customer_phone: customerPhone,
          order_type: orderType,
          table_number: tableNumber,
          business_date: bDate,
          created_at: createdAt,
          checked_out_at: checkedOutAt,
        };
        this.data.orders.push(newOrder);
        this.data.orderIdCounter = Math.max(this.data.orderIdCounter, id + 1);
        this.save();
        return makeResult([{ id, order_code: orderCode }]);
      }

      // Normal order insert
      const id = this.data.orderIdCounter++;
      const orderCode = (values[0] as string) || `TBT-${id}`;
      const status = (values[1] as string) || "saved";
      const total = Number(values[2]) || 0;
      const notes = (values[3] as string) || "";
      const instructions = (values[4] as string) || "";
      const customerName = (values[5] as string) || "";
      const customerPhone = (values[6] as string) || "";
      const orderType = (values[7] as string) || "Delivery";
      const tableNumber = values[8] ?? null;
      const bDate = this.data.storeState.current_business_date;
      const now = (values[9] as string) || new Date().toISOString();

      const newOrder = {
        id,
        order_code: orderCode,
        status,
        total,
        notes,
        instructions,
        customer_name: customerName,
        customer_phone: customerPhone,
        order_type: orderType,
        table_number: tableNumber,
        business_date: bDate,
        created_at: now,
        checked_out_at: status === "checkedout" ? now : null,
      };
      this.data.orders.unshift(newOrder);
      this.save();
      return makeResult([{ id, order_code: orderCode }]);
    }

    if (upper.startsWith("INSERT INTO ORDER_ITEMS")) {
      // Check if restore insert with id column
      if (upper.includes("(ID, ORDER_ID")) {
        const id = Number(values[0]);
        this.data.orderItems.push({
          id,
          order_id: Number(values[1]),
          product_id: values[2],
          product_key: values[2] != null ? String(values[2]) : null,
          product_name: values[3],
          category: values[4],
          selected_size: values[5],
          selected_topping: values[6],
          selected_sauce: values[7],
          unit_price: values[8],
          quantity: values[9],
        });
        this.data.orderItemIdCounter = Math.max(this.data.orderItemIdCounter, id + 1);
        this.save();
        return makeResult([{ id }]);
      }

      const hasProductKey = upper.includes("PRODUCT_KEY");
      const id = this.data.orderItemIdCounter++;
      if (hasProductKey) {
        this.data.orderItems.push({
          id,
          order_id: values[0],
          product_id: values[1],
          product_key: values[2] ?? (values[1] != null ? String(values[1]) : null),
          product_name: values[3],
          category: values[4],
          selected_size: values[5],
          selected_topping: values[6],
          selected_sauce: values[7],
          unit_price: values[8],
          quantity: values[9],
        });
      } else {
        this.data.orderItems.push({
          id,
          order_id: values[0],
          product_id: values[1],
          product_key: values[1] != null ? String(values[1]) : null,
          product_name: values[2],
          category: values[3],
          selected_size: values[4],
          selected_topping: values[5],
          selected_sauce: values[6],
          unit_price: values[7],
          quantity: values[8],
        });
      }
      this.save();
      return makeResult([{ id }]);
    }

    if (upper.startsWith("INSERT INTO CUSTOMERS")) {
      // Check if restore insert: (id, name, phone, created_at)
      if (upper.includes("(ID, NAME, PHONE") || values.length >= 4) {
        const id = Number(values[0]);
        const name = (values[1] as string) || "Walk-In Customer";
        const phone = (values[2] as string) || "";
        const created_at = values[3] ? String(values[3]) : new Date().toISOString();
        const newCust = { id, name, phone, created_at };
        this.data.customers.push(newCust);
        this.data.customerIdCounter = Math.max(this.data.customerIdCounter, id + 1);
        this.save();
        return makeResult([newCust]);
      }

      // Normal customer insert: name, phone
      const name = (values[0] as string) || "Walk-In Customer";
      const phone = (values[1] as string) || "";
      const newCust = {
        id: this.data.customerIdCounter++,
        name,
        phone,
        created_at: new Date().toISOString(),
      };
      this.data.customers.push(newCust);
      this.save();
      return makeResult([newCust]);
    }

    if (upper.startsWith("INSERT INTO CUSTOM_CATEGORIES")) {
      const name = (values[0] as string) || "Custom";
      const label = (values[1] as string) || name;
      const emoji = (values[2] as string) || "📦";
      const image = (values[3] as string) || "deals.png";
      const cat = { id: this.data.categoryIdCounter++, name, label, emoji, image, created_at: new Date().toISOString() };
      this.data.customCategories.push(cat);
      this.save();
      return makeResult([cat]);
    }

    if (upper.startsWith("INSERT INTO CUSTOM_PRODUCTS")) {
      const id = (values[0] as string) || `prod_${Date.now()}`;
      const existingIdx = this.data.customProducts.findIndex((p) => p.id === id);

      // Soft-delete insert/upsert (6 params)
      if (values.length <= 6 && upper.includes("IS_DELETED")) {
        if (existingIdx >= 0) {
          this.data.customProducts[existingIdx] = {
            ...this.data.customProducts[existingIdx],
            is_deleted: true,
            updated_at: new Date().toISOString(),
          };
          this.save();
          return makeResult([this.data.customProducts[existingIdx]]);
        }
        const softRow = {
          id,
          name: (values[1] as string) || "Deleted",
          description: (values[2] as string) || "",
          base_price: values[3] || 0,
          image: (values[4] as string) || "deals.png",
          category: (values[5] as string) || "Other",
          is_deleted: true,
          size_prices: null,
          sizes: null,
          has_extra_toppings: null,
          has_sauce_options: null,
          sku: "",
          barcode: "",
          stock: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        this.data.customProducts.push(softRow);
        this.save();
        return makeResult([softRow]);
      }

      const hasBarcodeParam = upper.includes("BARCODE");
      const skuVal = ((values[10] as string) || "").trim();
      const barcodeVal = hasBarcodeParam ? ((values[11] as string) || "").trim() : "";
      const stockVal = hasBarcodeParam ? (values[12] ?? null) : (values[11] ?? null);

      const nextFields = {
        id,
        name: (values[1] as string) || "",
        description: (values[2] as string) || "",
        base_price: Number(values[3] || 0),
        image: (values[4] as string) || "deals.png",
        category: (values[5] as string) || "Other",
        is_deleted: false,
        size_prices: parseMaybeJson(values[6] ?? null),
        sizes: parseMaybeJson(values[7] ?? null),
        has_extra_toppings: values[8] ?? null,
        has_sauce_options: values[9] ?? null,
        sku: skuVal,
        barcode: barcodeVal,
        stock: stockVal != null ? Number(stockVal) : null,
        updated_at: new Date().toISOString(),
      };

      if (existingIdx >= 0 && upper.includes("ON CONFLICT")) {
        const merged = {
          ...this.data.customProducts[existingIdx],
          ...nextFields,
        };
        this.data.customProducts[existingIdx] = merged;
        this.save();
        return makeResult([merged]);
      }

      const prod = {
        ...nextFields,
        created_at: new Date().toISOString(),
      };
      this.data.customProducts.push(prod);
      this.save();
      return makeResult([prod]);
    }

    if (upper.startsWith("INSERT INTO INVENTORY_LOGS")) {
      const entry = {
        id: this.data.inventoryLogIdCounter++,
        product_id: String(values[0] || ""),
        product_name: String(values[1] || ""),
        sku: String(values[2] || ""),
        barcode: String(values[3] || ""),
        previous_stock: values[4] != null ? Number(values[4]) : null,
        new_stock: values[5] != null ? Number(values[5]) : null,
        quantity_change: Number(values[6] || 0),
        reason: String(values[7] || "Adjustment"),
        source: String(values[8] || "manual"),
        order_code: values[9] != null ? String(values[9]) : null,
        created_at: new Date().toISOString(),
      };
      this.data.inventoryLogs.unshift(entry);
      this.save();
      return makeResult([entry]);
    }

    if (upper.startsWith("INSERT INTO POS_SETTINGS")) {
      if (values[0] !== undefined) {
        this.data.posSettings.barcode_search_enabled = Boolean(values[0]);
      }
      if (values[1] !== undefined) {
        this.data.posSettings.digital_clock_enabled = Boolean(values[1]);
      }
      this.save();
      return makeResult([{ ...this.data.posSettings }]);
    }

    if (upper.startsWith("INSERT INTO STORE_STATE")) {
      if (values[0]) {
        this.data.storeState.current_business_date = String(values[0]);
        this.save();
      }
      return makeResult([{ current_business_date: this.data.storeState.current_business_date }]);
    }

    if (upper.startsWith("INSERT INTO RECEIPT_SETTINGS")) {
      if (values.length >= 7) {
        this.data.receiptSettings.store_name = (values[0] as string) ?? this.data.receiptSettings.store_name;
        this.data.receiptSettings.store_address = (values[1] as string) ?? this.data.receiptSettings.store_address;
        this.data.receiptSettings.store_phones = (values[2] as string) ?? this.data.receiptSettings.store_phones;
        this.data.receiptSettings.logo_image = (values[3] as string) ?? this.data.receiptSettings.logo_image;
        this.data.receiptSettings.payment_title = (values[4] as string) ?? this.data.receiptSettings.payment_title;
        this.data.receiptSettings.payment_image = (values[5] as string) ?? this.data.receiptSettings.payment_image;
        this.data.receiptSettings.payment_line = (values[6] as string) ?? this.data.receiptSettings.payment_line;
        if (values[7] !== undefined) this.data.receiptSettings.receipt_prefix = String(values[7]);
        if (values[8] !== undefined) this.data.receiptSettings.receipt_next_number = Number(values[8]);
        this.save();
      }
      return makeResult([{ ...this.data.receiptSettings }]);
    }

    // 3. UPDATE statements
    if (upper.startsWith("UPDATE STORE_STATE")) {
      if (values[0]) {
        this.data.storeState.current_business_date = String(values[0]);
        this.data.storeState.opened_at = new Date().toISOString();
        this.data.storeState.closed_at = null;
        this.save();
      }
      return makeResult([{ current_business_date: this.data.storeState.current_business_date }]);
    }

    if (upper.startsWith("UPDATE ORDERS")) {
      // Check if full PATCH update with 9 parameters:
      // SET total = $1, notes = $2, instructions = $3, customer_name = $4, customer_phone = $5, order_type = $6, table_number = $7, status = $8 ... WHERE id = $9
      if (values.length >= 8 && (upper.includes("SET TOTAL") || upper.includes("WHERE ID ="))) {
        const orderId = values[8] ?? values[values.length - 1];
        const target = this.data.orders.find(
          (o) => o.id === Number(orderId) || o.id === orderId || o.order_code === orderId,
        );
        if (target) {
          target.total = Number(values[0]) || 0;
          target.notes = values[1] ? String(values[1]) : "";
          target.instructions = values[2] ? String(values[2]) : "";
          target.customer_name = values[3] ? String(values[3]) : "";
          target.customer_phone = values[4] ? String(values[4]) : "";
          target.order_type = values[5] ? String(values[5]) : "Delivery";
          target.table_number = values[6] != null ? Number(values[6]) : null;
          const newStat = values[7] as "saved" | "checkedout" | undefined;
          if (newStat === "saved") {
            target.status = "saved";
            target.checked_out_at = null;
          } else if (newStat === "checkedout") {
            target.status = "checkedout";
            target.checked_out_at = target.checked_out_at || new Date().toISOString();
            target.business_date = target.business_date || this.data.storeState.current_business_date;
          }
          this.save();
        }
        return makeResult(target ? [{ id: target.id, order_code: target.order_code }] : []);
      }

      // Checkout or simple update by order_code or id
      const code = values[0];
      const target = this.data.orders.find((o) => o.order_code === code || o.id === Number(code));
      if (target) {
        if (upper.includes("CHECKEDOUT")) {
          target.status = "checkedout";
          target.checked_out_at = new Date().toISOString();
          target.business_date = this.data.storeState.current_business_date;
        }
        this.save();
      }
      return makeResult(
        target
          ? [
              {
                id: target.id,
                order_code: target.order_code,
                status: target.status,
                checked_out_at: target.checked_out_at,
                business_date: target.business_date || this.data.storeState.current_business_date,
              },
            ]
          : [],
      );
    }

    if (upper.startsWith("UPDATE RECEIPT_SETTINGS")) {
      if (upper.includes("RECEIPT_NEXT_NUMBER = 1")) {
        this.data.receiptSettings.receipt_next_number = 1;
        this.save();
      } else if (values.length >= 7) {
        this.data.receiptSettings.store_name = (values[0] as string) ?? this.data.receiptSettings.store_name;
        this.data.receiptSettings.store_address = (values[1] as string) ?? this.data.receiptSettings.store_address;
        this.data.receiptSettings.store_phones = (values[2] as string) ?? this.data.receiptSettings.store_phones;
        this.data.receiptSettings.logo_image = (values[3] as string) ?? this.data.receiptSettings.logo_image;
        this.data.receiptSettings.payment_title = (values[4] as string) ?? this.data.receiptSettings.payment_title;
        this.data.receiptSettings.payment_image = (values[5] as string) ?? this.data.receiptSettings.payment_image;
        this.data.receiptSettings.payment_line = (values[6] as string) ?? this.data.receiptSettings.payment_line;
        if (values[7] !== undefined) this.data.receiptSettings.receipt_prefix = String(values[7]);
        if (values[8] !== undefined) this.data.receiptSettings.receipt_next_number = Number(values[8]);
        this.save();
      }
      return makeResult([{ ...this.data.receiptSettings }]);
    }

    if (upper.startsWith("UPDATE MENU_APPEARANCE_SETTINGS")) {
      if (values.length >= 6) {
        this.data.menuAppearance.tile_size = Number(values[0]);
        this.data.menuAppearance.tile_bg_color = String(values[1]);
        this.data.menuAppearance.tile_text_color = String(values[2]);
        this.data.menuAppearance.tile_border_color = String(values[3]);
        this.data.menuAppearance.font_family = String(values[4]);
        this.data.menuAppearance.font_size = Number(values[5]);
        this.save();
      }
      return makeResult([
        {
          tile_size: this.data.menuAppearance.tile_size,
          tile_bg_color: this.data.menuAppearance.tile_bg_color,
          tile_text_color: this.data.menuAppearance.tile_text_color,
          tile_border_color: this.data.menuAppearance.tile_border_color,
          font_family: this.data.menuAppearance.font_family,
          font_size: this.data.menuAppearance.font_size,
        },
      ]);
    }

    if (upper.startsWith("UPDATE DANGER_SETTINGS")) {
      if (values[0]) {
        this.data.dangerWipeCode = String(values[0]);
        this.save();
      }
      return makeResult([{ wipe_code: this.data.dangerWipeCode }]);
    }

    if (upper.startsWith("UPDATE BACKUP_AUTO_SETTINGS")) {
      if (values.length >= 5) {
        this.data.autoBackup.contacts_enabled = Boolean(values[0]);
        this.data.autoBackup.full_enabled = Boolean(values[1]);
        this.data.autoBackup.contacts_time = String(values[2]);
        this.data.autoBackup.full_time = String(values[3]);
        this.data.autoBackup.custom_folder = values[4] ? String(values[4]) : null;
        this.save();
      }
      return makeResult([{ ...this.data.autoBackup }]);
    }

    if (upper.startsWith("UPDATE POS_SETTINGS")) {
      if (values[0] !== undefined) {
        this.data.posSettings.barcode_search_enabled = Boolean(values[0]);
      }
      if (values[1] !== undefined) {
        this.data.posSettings.digital_clock_enabled = Boolean(values[1]);
      }
      this.save();
      return makeResult([
        {
          barcode_search_enabled: this.data.posSettings.barcode_search_enabled,
          digital_clock_enabled: this.data.posSettings.digital_clock_enabled,
        },
      ]);
    }

    if (upper.startsWith("UPDATE CUSTOM_PRODUCTS")) {
      if (upper.includes("SET CATEGORY =")) {
        const nextCat = String(values[0] || "");
        const prevCat = String(values[1] || "").toLowerCase();
        for (const p of this.data.customProducts) {
          if (String(p.category || "").toLowerCase() === prevCat) {
            p.category = nextCat;
            p.updated_at = new Date().toISOString();
          }
        }
        this.save();
        return makeResult([]);
      }
      if (upper.includes("SET STOCK =")) {
        const nextStock = values[0] != null ? Number(values[0]) : null;
        const targetId = String(values[1] || "");
        const target = this.data.customProducts.find((p) => p.id === targetId);
        if (target) {
          target.stock = nextStock;
          target.updated_at = new Date().toISOString();
          this.save();
          return makeResult([target]);
        }
        return makeResult([]);
      }
    }

    if (upper.startsWith("UPDATE ALL_TIME_SALES") || upper.startsWith("UPDATE DAILY_SALES")) {
      return makeResult([]);
    }

    // 4. DELETE statements
    if (upper.startsWith("DELETE FROM CUSTOM_PRODUCTS")) {
      if (values[0]) {
        const targetId = String(values[0]);
        const target = this.data.customProducts.find((p) => p.id === targetId);
        this.data.customProducts = this.data.customProducts.filter((p) => p.id !== targetId);
        this.save();
        return makeResult(target ? [{ id: target.id, image: target.image }] : []);
      }
      return makeResult([]);
    }
    if (upper.startsWith("DELETE FROM INVENTORY_LOGS")) {
      const prevLen = this.data.inventoryLogs.length;
      this.data.inventoryLogs = [];
      this.save();
      const res = makeResult([]);
      res.rowCount = prevLen;
      return res;
    }
    if (upper.startsWith("DELETE FROM ORDER_ITEMS")) {
      let count = this.data.orderItems.length;
      if (values.length > 0 && values[0] != null) {
        const orderId = Number(values[0]);
        const prevLen = this.data.orderItems.length;
        this.data.orderItems = this.data.orderItems.filter((oi) => oi.order_id !== orderId);
        count = prevLen - this.data.orderItems.length;
      } else {
        this.data.orderItems = [];
      }
      this.save();
      const res = makeResult([]);
      res.rowCount = count;
      return res;
    }
    if (upper.startsWith("DELETE FROM ORDERS")) {
      let count = this.data.orders.length;
      if (values[0]) {
        const doomedIds = new Set(
          this.data.orders
            .filter((o) => o.order_code === values[0])
            .map((o) => o.id),
        );
        const prev = this.data.orders.length;
        this.data.orders = this.data.orders.filter((o) => o.order_code !== values[0]);
        this.data.orderItems = this.data.orderItems.filter(
          (oi) => !doomedIds.has(oi.order_id),
        );
        count = prev - this.data.orders.length;
      } else {
        this.data.orders = [];
        this.data.orderItems = [];
      }
      this.save();
      const res = makeResult([]);
      res.rowCount = count;
      return res;
    }
    if (upper.startsWith("DELETE FROM CUSTOMERS")) {
      let count = this.data.customers.length;
      if (values.length > 0 && values[0] != null) {
        const id = Number(values[0]);
        const prev = this.data.customers.length;
        this.data.customers = this.data.customers.filter((c) => c.id !== id);
        count = prev - this.data.customers.length;
      } else {
        this.data.customers = [];
      }
      this.save();
      const res = makeResult([]);
      res.rowCount = count;
      return res;
    }
    if (upper.startsWith("DELETE FROM DAILY_SALES")) {
      return makeResult([]);
    }

    // 5. SELECT statements
    // 5. SELECT statements

    // Distinct categories query for reports:
    if (upper.includes("SELECT DISTINCT") && upper.includes("CATEGORY") && upper.includes("ORDER_ITEMS")) {
      const cats = Array.from(
        new Set(
          this.data.orderItems
            .map((oi) => (oi.category ? String(oi.category).trim() : ""))
            .filter(Boolean),
        ),
      ).sort();
      return makeResult(cats.map((c) => ({ category: c })));
    }

    // Distinct customers query for reports:
    if (upper.includes("SELECT DISTINCT") && upper.includes("CUSTOMER_NAME") && upper.includes("FROM ORDERS")) {
      const map = new Map<string, { customer_name: string; customer_phone: string }>();
      for (const o of this.data.orders.filter((ord) => ord.status === "checkedout")) {
        const name = (o.customer_name ? String(o.customer_name).trim() : "") || "Walk-In Customer";
        const phone = o.customer_phone ? String(o.customer_phone).trim() : "";
        map.set(`${name}|||${phone}`, { customer_name: name, customer_phone: phone });
      }
      return makeResult(Array.from(map.values()));
    }

    // Product sales and item reports queries:
    // e.g. FROM order_items oi INNER JOIN orders o ... GROUP BY oi.product_name...
    if (
      !upper.includes("JSON_AGG") &&
      (upper.includes("FROM ORDER_ITEMS") || upper.includes("ORDER_ITEMS OI")) &&
      upper.includes("ORDERS") &&
      (upper.includes("SUM(") || upper.includes("QUANTITY_SOLD") || upper.includes("COUNT(DISTINCT O.ID)"))
    ) {
      let matchedOrders = this.data.orders.filter((o) => o.status === "checkedout");

      // Check if values has a date (YYYY-MM-DD)
      const dateVal = values.find((v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) as string | undefined;
      if (dateVal) {
        matchedOrders = matchedOrders.filter(
          (o) =>
            o.business_date === dateVal ||
            String(o.checked_out_at || o.created_at || "").slice(0, 10) === dateVal,
        );
      } else {
        // Check for year and month params
        const yearVal = values.find((v) => typeof v === "number" && v >= 2000 && v <= 2100) as number | undefined;
        if (yearVal) {
          matchedOrders = matchedOrders.filter((o) => {
            const dStr = String(o.business_date || o.checked_out_at || o.created_at || "");
            return dStr.startsWith(String(yearVal));
          });
        }
      }

      const orderIds = new Set(matchedOrders.map((o) => o.id));
      const orderDateMap = new Map<number | string, string>();
      for (const o of matchedOrders) {
        orderDateMap.set(o.id, o.business_date || String(o.checked_out_at || o.created_at || "").slice(0, 10));
      }

      let relevantItems = this.data.orderItems.filter((oi) => orderIds.has(oi.order_id));

      // Customer or category filters if specified in query
      const catVal = values.find(
        (v) => typeof v === "string" && v && !/^\d{4}-\d{2}-\d{2}$/.test(v) && !v.includes("%"),
      ) as string | undefined;
      if (catVal && upper.includes("TRIM(OI.CATEGORY) =")) {
        relevantItems = relevantItems.filter(
          (oi) => (oi.category || "").trim().toLowerCase() === catVal.trim().toLowerCase(),
        );
      }

      // If query is COUNT(DISTINCT o.id)::integer AS order_count
      if (upper.includes("COUNT(DISTINCT O.ID)")) {
        const matchingOrderIds = new Set(relevantItems.map((oi) => oi.order_id));
        return makeResult([{ order_count: matchingOrderIds.size }]);
      }

      // Group by item
      const groups = new Map<
        string,
        {
          period: string;
          product_name: string;
          category: string | null;
          selected_size: string | null;
          selected_topping: string | null;
          selected_sauce: string | null;
          quantity_sold: number;
          revenue: number;
          order_ids: Set<unknown>;
        }
      >();

      for (const oi of relevantItems) {
        const itemDate = orderDateMap.get(oi.order_id) || "";
        const period = upper.includes("O.BUSINESS_DATE::TEXT AS PERIOD") ? itemDate : "";
        const key = `${period}|||${oi.product_name}|||${oi.category || ""}|||${oi.selected_size || ""}|||${oi.selected_topping || ""}|||${oi.selected_sauce || ""}`;

        let entry = groups.get(key);
        if (!entry) {
          entry = {
            period,
            product_name: String(oi.product_name || ""),
            category: oi.category ? String(oi.category) : null,
            selected_size: oi.selected_size ? String(oi.selected_size) : null,
            selected_topping: oi.selected_topping ? String(oi.selected_topping) : null,
            selected_sauce: oi.selected_sauce ? String(oi.selected_sauce) : null,
            quantity_sold: 0,
            revenue: 0,
            order_ids: new Set(),
          };
          groups.set(key, entry);
        }
        const qty = Number(oi.quantity) || 1;
        const price = Number(oi.unit_price) || 0;
        entry.quantity_sold += qty;
        entry.revenue += qty * price;
        entry.order_ids.add(oi.order_id);
      }

      const rows = Array.from(groups.values()).map((g) => ({
        period: g.period,
        product_name: g.product_name,
        category: g.category,
        selected_size: g.selected_size,
        selected_topping: g.selected_topping,
        selected_sauce: g.selected_sauce,
        quantity_sold: g.quantity_sold,
        revenue: g.revenue,
        order_count: g.order_ids.size,
      }));

      // Sort
      rows.sort((a, b) => {
        const catCmp = (a.category || "").localeCompare(b.category || "");
        if (catCmp !== 0) return catCmp;
        if (b.quantity_sold !== a.quantity_sold) return b.quantity_sold - a.quantity_sold;
        return a.product_name.localeCompare(b.product_name);
      });

      return makeResult(rows);
    }

    if (upper.includes("DAILY_SALES") || upper.includes("ALL_TIME_SALES")) {
      const bDate = this.data.storeState.current_business_date;

      // Check if queried for a specific date (e.g. WHERE sale_date = $1::date)
      const targetDate =
        (values.find((v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) as string) || bDate;

      const checkedOutForDate = this.data.orders.filter(
        (o) =>
          o.status === "checkedout" &&
          (o.business_date === targetDate ||
            (!o.business_date && targetDate === bDate) ||
            String(o.checked_out_at || o.created_at || "").slice(0, 10) === targetDate),
      );
      const totalRevenueDate = checkedOutForDate.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
      const orderIdsDate = new Set(checkedOutForDate.map((o) => o.id));
      const totalItemsDate = this.data.orderItems
        .filter((oi) => orderIdsDate.has(oi.order_id))
        .reduce((sum, oi) => sum + (Number(oi.quantity) || 1), 0);

      // If queried exclusively from daily_sales by reports
      if (upper.includes("FROM DAILY_SALES") && !upper.includes("ALL_TIME_SALES") && !upper.includes("STORE_STATE")) {
        if (upper.includes("WHERE SALE_DATE =")) {
          return makeResult([
            {
              sale_date: targetDate,
              total_revenue: totalRevenueDate,
              total_orders: checkedOutForDate.length,
              total_items: totalItemsDate,
            },
          ]);
        }
        // Group by sale_date
        const datesMap = new Map<string, { total_revenue: number; total_orders: number; total_items: number }>();
        for (const o of this.data.orders.filter((ord) => ord.status === "checkedout")) {
          const d = o.business_date || String(o.checked_out_at || o.created_at || "").slice(0, 10);
          if (!d) continue;
          let entry = datesMap.get(d);
          if (!entry) {
            entry = { total_revenue: 0, total_orders: 0, total_items: 0 };
            datesMap.set(d, entry);
          }
          entry.total_revenue += Number(o.total) || 0;
          entry.total_orders += 1;
        }
        const dailyRows = Array.from(datesMap.entries()).map(([sale_date, d]) => ({
          sale_date,
          total_revenue: d.total_revenue,
          total_orders: d.total_orders,
          total_items: d.total_items,
        }));
        return makeResult(dailyRows);
      }

      const allCheckedOut = this.data.orders.filter((o) => o.status === "checkedout");
      const allTimeRevenue = allCheckedOut.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
      const allOrderIds = new Set(allCheckedOut.map((o) => o.id));
      const allTimeItems = this.data.orderItems
        .filter((oi) => allOrderIds.has(oi.order_id))
        .reduce((sum, oi) => sum + (Number(oi.quantity) || 1), 0);

      return makeResult([
        {
          business_date: bDate,
          sale_date: targetDate,
          total_revenue: totalRevenueDate,
          total_orders: checkedOutForDate.length,
          total_items: totalItemsDate,
          all_time_revenue: allTimeRevenue,
          all_time_orders: allCheckedOut.length,
          all_time_items: allTimeItems,
        },
      ]);
    }

    if (upper.includes("FROM STORE_STATE")) {
      return makeResult([
        {
          id: 1,
          current_business_date: this.data.storeState.current_business_date,
          opened_at: this.data.storeState.opened_at,
          closed_at: this.data.storeState.closed_at,
        },
      ]);
    }

    if (upper.includes("FROM RECEIPT_SETTINGS")) {
      return makeResult([
        {
          id: 1,
          store_name: this.data.receiptSettings.store_name,
          store_address: this.data.receiptSettings.store_address,
          store_phones: this.data.receiptSettings.store_phones,
          logo_image: this.data.receiptSettings.logo_image,
          payment_title: this.data.receiptSettings.payment_title,
          payment_image: this.data.receiptSettings.payment_image,
          payment_line: this.data.receiptSettings.payment_line,
          receipt_prefix: this.data.receiptSettings.receipt_prefix,
          receipt_next_number: this.data.receiptSettings.receipt_next_number,
        },
      ]);
    }

    if (upper.includes("FROM MENU_APPEARANCE_SETTINGS")) {
      return makeResult([
        {
          tile_size: this.data.menuAppearance.tile_size,
          tile_bg_color: this.data.menuAppearance.tile_bg_color,
          tile_text_color: this.data.menuAppearance.tile_text_color,
          tile_border_color: this.data.menuAppearance.tile_border_color,
          font_family: this.data.menuAppearance.font_family,
          font_size: this.data.menuAppearance.font_size,
        },
      ]);
    }

    if (upper.includes("FROM POS_SETTINGS")) {
      return makeResult([
        {
          id: 1,
          barcode_search_enabled: this.data.posSettings.barcode_search_enabled,
          digital_clock_enabled: this.data.posSettings.digital_clock_enabled,
        },
      ]);
    }

    if (upper.includes("FROM DANGER_SETTINGS")) {
      return makeResult([{ id: 1, wipe_code: this.data.dangerWipeCode }]);
    }

    if (upper.includes("FROM BACKUP_AUTO_SETTINGS")) {
      return makeResult([
        {
          ...this.data.autoBackup,
          last_contacts_date: this.data.autoBackup.last_contacts_date,
          last_full_date: this.data.autoBackup.last_full_date,
        },
      ]);
    }

    if (upper.includes("FROM CUSTOMERS")) {
      const q = values[0] ? String(values[0]).toLowerCase().replace(/%/g, "") : "";
      let res = [...this.data.customers];
      if (q) {
        res = res.filter((c) => String(c.name || "").toLowerCase().includes(q) || String(c.phone || "").includes(q));
      }
      return makeResult(res);
    }

    if (upper.includes("FROM CUSTOM_CATEGORIES")) {
      return makeResult([...this.data.customCategories]);
    }

    if (upper.includes("FROM CUSTOM_PRODUCTS")) {
      let list = [...this.data.customProducts];
      if (upper.includes("WHERE ID = $1")) {
        const idVal = String(values[0] || "");
        list = list.filter((p) => p.id === idVal);
        return makeResult(list);
      }
      if (upper.includes("WHERE ID = ANY(")) {
        const ids = Array.isArray(values[0]) ? new Set(values[0].map(String)) : new Set<string>();
        return makeResult(list.filter((p) => ids.has(String(p.id))));
      }
      list.sort((a, b) => {
        const ta = new Date(String(a.created_at || 0)).getTime();
        const tb = new Date(String(b.created_at || 0)).getTime();
        if (tb !== ta) return tb - ta;
        return String(b.id).localeCompare(String(a.id));
      });
      return makeResult(list);
    }

    if (upper.includes("FROM INVENTORY_LOGS")) {
      const q = String(values[0] || "").trim().toLowerCase();
      const filterType = String(values[2] || "").trim().toLowerCase();
      const productId = String(values[3] || "").trim();
      const limit = Number(values[4]) > 0 ? Number(values[4]) : 200;

      let logs = [...this.data.inventoryLogs];
      if (q) {
        logs = logs.filter(
          (l) =>
            String(l.product_name || "").toLowerCase().includes(q) ||
            String(l.sku || "").toLowerCase().includes(q) ||
            String(l.barcode || "").toLowerCase().includes(q) ||
            String(l.reason || "").toLowerCase().includes(q) ||
            String(l.order_code || "").toLowerCase().includes(q),
        );
      }
      if (filterType === "in") {
        logs = logs.filter((l) => Number(l.quantity_change) > 0);
      } else if (filterType === "out") {
        logs = logs.filter((l) => Number(l.quantity_change) < 0);
      } else if (filterType === "manual") {
        logs = logs.filter((l) => l.source !== "sale");
      } else if (filterType === "sale") {
        logs = logs.filter((l) => l.source === "sale");
      } else if (filterType === "scan") {
        logs = logs.filter(
          (l) =>
            l.source === "scan_event" ||
            String(l.reason || "").toLowerCase() === "scan_event",
        );
      }
      if (productId) {
        logs = logs.filter((l) => String(l.product_id) === productId);
      }

      logs.sort((a, b) => {
        const ta = new Date(String(a.created_at || 0)).getTime();
        const tb = new Date(String(b.created_at || 0)).getTime();
        if (tb !== ta) return tb - ta;
        return Number(b.id) - Number(a.id);
      });
      return makeResult(logs.slice(0, limit));
    }

    if (upper.includes("FROM ORDER_ITEMS") && upper.includes("WHERE ORDER_ID = $1")) {
      const orderId = Number(values[0]);
      const matching = this.data.orderItems.filter(
        (oi) => Number(oi.order_id) === orderId || oi.order_id === values[0],
      );
      return makeResult(matching);
    }

    if (upper.includes("FROM ORDERS") && (upper.includes("ORDER_CODE ~") || (upper.includes("ORDER BY") && upper.includes("REGEXP_REPLACE")))) {
      const prefix = (values[0] as string) || "TBT";
      const re = new RegExp(`^${prefix}-(\\d+)$`, "i");
      let maxNum = 0;
      let lastOrderCode = null;
      for (const o of this.data.orders) {
        const oCode = String(o.order_code || "");
        const match = oCode.match(re);
        if (match) {
          const n = parseInt(match[1], 10);
          if (n > maxNum) {
            maxNum = n;
            lastOrderCode = oCode;
          }
        }
      }
      return makeResult(lastOrderCode ? [{ order_code: lastOrderCode }] : []);
    }

    if (upper.includes("FROM ORDERS") && upper.includes("JSON_AGG")) {
      const isCheckedOut = upper.includes("CHECKEDOUT");
      let matchedOrders = this.data.orders.filter((o) =>
        isCheckedOut ? o.status === "checkedout" : o.status === "saved",
      );

      // Support date or receipt search filtering if passed in values
      if (values.length > 0) {
        for (const val of values) {
          if (!val) continue;
          const sVal = String(val);
          if (sVal.startsWith("%") && sVal.endsWith("%")) {
            const clean = sVal.replace(/%/g, "").trim().toLowerCase();
            if (clean) {
              matchedOrders = matchedOrders.filter(
                (o) =>
                  String(o.order_code || "").toLowerCase().includes(clean) ||
                  String(o.customer_name || "").toLowerCase().includes(clean) ||
                  String(o.customer_phone || "").includes(clean),
              );
            }
          } else if (/^\d{4}-\d{2}-\d{2}$/.test(sVal)) {
            matchedOrders = matchedOrders.filter(
              (o) =>
                o.business_date === sVal ||
                String(o.created_at || "").slice(0, 10) === sVal,
            );
          }
        }
      }

      // Sort checkedout orders newest checkout first; saved orders newest creation first
      matchedOrders.sort((a, b) => {
        const timeA = new Date(
          (isCheckedOut ? a.checked_out_at : a.created_at) || a.created_at,
        ).getTime();
        const timeB = new Date(
          (isCheckedOut ? b.checked_out_at : b.created_at) || b.created_at,
        ).getTime();
        return timeB - timeA;
      });

      const mapped = matchedOrders.map((o) => {
        const items = this.data.orderItems
          .filter((oi) => oi.order_id === o.id)
          .map((oi) => ({
            id: oi.product_key || (oi.product_id != null ? String(oi.product_id) : null),
            name: oi.product_name,
            category: oi.category,
            selectedSize: oi.selected_size,
            selectedTopping: oi.selected_topping,
            selectedSauce: oi.selected_sauce,
            price: Number(oi.unit_price),
            quantity: Number(oi.quantity),
            cartKey: `${oi.product_name}-${oi.selected_size || ""}-${oi.selected_topping || ""}-${oi.selected_sauce || ""}`,
          }));
        return {
          order_code: o.order_code,
          status: o.status,
          total: o.total,
          notes: o.notes,
          instructions: o.instructions,
          customer_name: o.customer_name,
          customer_phone: o.customer_phone,
          order_type: o.order_type,
          table_number: o.table_number,
          created_at: o.created_at,
          checked_out_at: o.checked_out_at,
          items,
        };
      });
      return makeResult(mapped);
    }

    if (upper.includes("FROM ORDERS") && upper.includes("WHERE ORDER_CODE = $1")) {
      const code = values[0];
      const found = this.data.orders.find((o) => o.order_code === code);
      return makeResult(found ? [found] : []);
    }

    // Default fallback: empty result
    return makeResult([]);
  }
}

declare global {
  var __mockDbStore: MockDbStore | undefined;
  var __appletPgPool: {
    connect: () => Promise<ResilientClient>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query: <R extends QueryResultRow = any>(text: string | { text: string; values?: unknown[] }, values?: unknown[]) => Promise<QueryResult<R>>;
  } | undefined;
}

const mockStore = global.__mockDbStore || new MockDbStore();
if (!global.__mockDbStore) {
  global.__mockDbStore = mockStore;
}

// Check if a real DATABASE_URL is explicitly set and not localhost/default placeholder
const rawUrl = process.env.DATABASE_URL;
const hasRealUrl = Boolean(rawUrl && !rawUrl.includes("localhost") && !rawUrl.includes("127.0.0.1"));

let poolInstance: Pool | null = null;
if (hasRealUrl) {
  try {
    poolInstance = new Pool({
      connectionString: rawUrl,
      connectionTimeoutMillis: 3000,
    });
  } catch {
    poolInstance = null;
  }
}

class ResilientClient {
  private client: PoolClient | null = null;

  constructor(client: PoolClient | null) {
    this.client = client;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async query<R extends QueryResultRow = any>(text: string | { text: string; values?: unknown[] }, values?: unknown[]): Promise<QueryResult<R>> {
    if (this.client) {
      try {
        const queryText = typeof text === "string" ? text : text.text;
        const queryVals = typeof text === "string" ? values : text.values;
        return await this.client.query<R>(queryText, queryVals as unknown[]);
      } catch {
        // Remote database query failed, fall back to mock store
      }
    }
    const sqlText = typeof text === "string" ? text : text.text;
    const sqlVals = typeof text === "string" ? values || [] : text.values || [];
    return await mockStore.executeQuery<R>(sqlText, sqlVals);
  }

  release() {
    if (this.client) {
      try {
        this.client.release();
      } catch {
        /* ignore */
      }
    }
  }
}

export const pgPool = global.__appletPgPool || {
  async connect(): Promise<ResilientClient> {
    if (poolInstance) {
      try {
        const client = await poolInstance.connect();
        return new ResilientClient(client);
      } catch {
        // Fall back quietly to in-memory mock store
      }
    }
    return new ResilientClient(null);
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async query<R extends QueryResultRow = any>(text: string | { text: string; values?: unknown[] }, values?: unknown[]): Promise<QueryResult<R>> {
    const client = await this.connect();
    try {
      return await client.query<R>(text, values);
    } finally {
      client.release();
    }
  },
};

if (!global.__appletPgPool) {
  global.__appletPgPool = pgPool;
}
