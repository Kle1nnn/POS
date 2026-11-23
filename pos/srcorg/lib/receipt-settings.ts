import { pgPool } from "./db";
import {
  DEFAULT_RECEIPT_SETTINGS,
  normalizeReceiptPrefix,
  type ReceiptSettings,
} from "./receipt-settings-shared";

export type { ReceiptSettings };
export { DEFAULT_RECEIPT_SETTINGS, normalizeReceiptPrefix };
export { formatReceiptCode } from "./receipt-settings-shared";

let ready: Promise<void> | null = null;

export function ensureReceiptSettingsTable(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      const client = await pgPool.connect();
      try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS receipt_settings (
            id             integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
            store_name     text NOT NULL,
            store_address  text NOT NULL,
            store_phones   text NOT NULL,
            logo_image     text NOT NULL DEFAULT 'logo.png',
            payment_title  text NOT NULL DEFAULT 'Online payment',
            payment_image  text NOT NULL DEFAULT 'Jz.jpg',
            payment_line   text NOT NULL,
            updated_at     timestamptz NOT NULL DEFAULT NOW()
          );
        `);
        await client.query(`
          ALTER TABLE receipt_settings
            ADD COLUMN IF NOT EXISTS receipt_prefix text NOT NULL DEFAULT 'TBT';
        `);
        await client.query(`
          ALTER TABLE receipt_settings
            ADD COLUMN IF NOT EXISTS receipt_next_number integer NOT NULL DEFAULT 1;
        `);

        const existing = await client.query(
          `SELECT id FROM receipt_settings WHERE id = 1`,
        );
        if (!existing.rowCount) {
          await client.query(
            `INSERT INTO receipt_settings
              (id, store_name, store_address, store_phones, logo_image,
               payment_title, payment_image, payment_line,
               receipt_prefix, receipt_next_number)
             VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              DEFAULT_RECEIPT_SETTINGS.storeName,
              DEFAULT_RECEIPT_SETTINGS.storeAddress,
              DEFAULT_RECEIPT_SETTINGS.storePhones,
              DEFAULT_RECEIPT_SETTINGS.logoImage,
              DEFAULT_RECEIPT_SETTINGS.paymentTitle,
              DEFAULT_RECEIPT_SETTINGS.paymentImage,
              DEFAULT_RECEIPT_SETTINGS.paymentLine,
              DEFAULT_RECEIPT_SETTINGS.receiptPrefix,
              DEFAULT_RECEIPT_SETTINGS.receiptNextNumber,
            ],
          );
        }
      } finally {
        client.release();
      }
    })();
  }
  return ready;
}

export function mapReceiptSettings(row: {
  store_name: string;
  store_address: string;
  store_phones: string;
  logo_image: string;
  payment_title: string;
  payment_image: string;
  payment_line: string;
  receipt_prefix?: string | null;
  receipt_next_number?: number | null;
}): ReceiptSettings {
  const nextNum = Number(row.receipt_next_number);
  return {
    storeName: row.store_name,
    storeAddress: row.store_address,
    storePhones: row.store_phones,
    logoImage: row.logo_image,
    paymentTitle: row.payment_title,
    paymentImage: row.payment_image,
    paymentLine: row.payment_line,
    receiptPrefix: normalizeReceiptPrefix(
      row.receipt_prefix || DEFAULT_RECEIPT_SETTINGS.receiptPrefix,
    ),
    receiptNextNumber:
      Number.isFinite(nextNum) && nextNum >= 1
        ? Math.floor(nextNum)
        : DEFAULT_RECEIPT_SETTINGS.receiptNextNumber,
  };
}

export async function loadReceiptSettings(): Promise<ReceiptSettings> {
  await ensureReceiptSettingsTable();
  const client = await pgPool.connect();
  try {
    const result = await client.query(
      `SELECT store_name, store_address, store_phones, logo_image,
              payment_title, payment_image, payment_line,
              receipt_prefix, receipt_next_number
       FROM receipt_settings WHERE id = 1`,
    );
    if (!result.rowCount) return { ...DEFAULT_RECEIPT_SETTINGS };
    return mapReceiptSettings(result.rows[0]);
  } finally {
    client.release();
  }
}
