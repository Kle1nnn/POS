import { pgPool } from "./db";
import {
  DEFAULT_POS_SETTINGS,
  type PosSettings,
} from "./pos-settings-shared";

export type { PosSettings };
export { DEFAULT_POS_SETTINGS };

let ready: Promise<void> | null = null;

export function ensurePosSettingsTable(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      const client = await pgPool.connect();
      try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS pos_settings (
            id                       integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
            barcode_search_enabled   boolean NOT NULL DEFAULT true,
            digital_clock_enabled    boolean NOT NULL DEFAULT true,
            low_stock_threshold      integer NOT NULL DEFAULT 5,
            table_management_enabled boolean NOT NULL DEFAULT true,
            menu_logo_image          text NOT NULL DEFAULT '',
            menu_header_text         text NOT NULL DEFAULT 'Menu',
            updated_at               timestamptz NOT NULL DEFAULT NOW()
          );
          ALTER TABLE pos_settings
            ADD COLUMN IF NOT EXISTS digital_clock_enabled boolean NOT NULL DEFAULT true;
          ALTER TABLE pos_settings
            ADD COLUMN IF NOT EXISTS low_stock_threshold integer NOT NULL DEFAULT 5;
          ALTER TABLE pos_settings
            ADD COLUMN IF NOT EXISTS table_management_enabled boolean NOT NULL DEFAULT true;
          ALTER TABLE pos_settings
            ADD COLUMN IF NOT EXISTS menu_logo_image text NOT NULL DEFAULT '';
          ALTER TABLE pos_settings
            ADD COLUMN IF NOT EXISTS menu_header_text text NOT NULL DEFAULT 'Menu';
        `);

        const existing = await client.query(
          `SELECT id FROM pos_settings WHERE id = 1`,
        );
        if (!existing.rowCount) {
          await client.query(
            `INSERT INTO pos_settings (id, barcode_search_enabled, digital_clock_enabled, low_stock_threshold, table_management_enabled, menu_logo_image, menu_header_text)
             VALUES (1, $1, $2, $3, $4, $5, $6)`,
            [
              DEFAULT_POS_SETTINGS.barcodeSearchEnabled,
              DEFAULT_POS_SETTINGS.digitalClockEnabled,
              DEFAULT_POS_SETTINGS.lowStockThreshold,
              DEFAULT_POS_SETTINGS.tableManagementEnabled,
              DEFAULT_POS_SETTINGS.menuLogoImage,
              DEFAULT_POS_SETTINGS.menuHeaderText,
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

function normalizeThreshold(val: unknown, fallback: number): number {
  const num = Number(val);
  if (!Number.isFinite(num) || num < 0) return fallback;
  return Math.min(9999, Math.floor(num));
}

function normalizeMenuLogo(val: unknown, fallback: string): string {
  if (typeof val !== "string") return fallback;
  return val.trim().slice(0, 500);
}

function normalizeMenuText(val: unknown, fallback: string): string {
  if (typeof val !== "string") return fallback;
  const trimmed = val.trim().slice(0, 60);
  return trimmed || DEFAULT_POS_SETTINGS.menuHeaderText;
}

export async function loadPosSettings(): Promise<PosSettings> {
  await ensurePosSettingsTable();
  const client = await pgPool.connect();
  try {
    const res = await client.query(
      `SELECT barcode_search_enabled, digital_clock_enabled, low_stock_threshold, table_management_enabled, menu_logo_image, menu_header_text FROM pos_settings WHERE id = 1`,
    );
    if (!res.rowCount) return { ...DEFAULT_POS_SETTINGS };
    const barcodeVal = res.rows[0]?.barcode_search_enabled;
    const clockVal = res.rows[0]?.digital_clock_enabled;
    const thresholdVal = res.rows[0]?.low_stock_threshold;
    const tableVal = res.rows[0]?.table_management_enabled;
    const logoVal = res.rows[0]?.menu_logo_image;
    const textVal = res.rows[0]?.menu_header_text;
    return {
      barcodeSearchEnabled:
        typeof barcodeVal === "boolean"
          ? barcodeVal
          : DEFAULT_POS_SETTINGS.barcodeSearchEnabled,
      digitalClockEnabled:
        typeof clockVal === "boolean"
          ? clockVal
          : DEFAULT_POS_SETTINGS.digitalClockEnabled,
      lowStockThreshold:
        thresholdVal != null
          ? normalizeThreshold(thresholdVal, DEFAULT_POS_SETTINGS.lowStockThreshold)
          : DEFAULT_POS_SETTINGS.lowStockThreshold,
      tableManagementEnabled:
        typeof tableVal === "boolean"
          ? tableVal
          : DEFAULT_POS_SETTINGS.tableManagementEnabled,
      menuLogoImage: normalizeMenuLogo(
        logoVal,
        DEFAULT_POS_SETTINGS.menuLogoImage,
      ),
      menuHeaderText: normalizeMenuText(
        textVal,
        DEFAULT_POS_SETTINGS.menuHeaderText,
      ),
    };
  } finally {
    client.release();
  }
}

export async function savePosSettings(
  next: Partial<PosSettings>,
): Promise<PosSettings> {
  await ensurePosSettingsTable();
  const current = await loadPosSettings();
  const barcodeSearchEnabled =
    typeof next.barcodeSearchEnabled === "boolean"
      ? next.barcodeSearchEnabled
      : current.barcodeSearchEnabled;
  const digitalClockEnabled =
    typeof next.digitalClockEnabled === "boolean"
      ? next.digitalClockEnabled
      : current.digitalClockEnabled;
  const lowStockThreshold =
    typeof next.lowStockThreshold === "number"
      ? normalizeThreshold(next.lowStockThreshold, current.lowStockThreshold)
      : current.lowStockThreshold;
  const tableManagementEnabled =
    typeof next.tableManagementEnabled === "boolean"
      ? next.tableManagementEnabled
      : current.tableManagementEnabled;
  const menuLogoImage =
    typeof next.menuLogoImage === "string"
      ? normalizeMenuLogo(next.menuLogoImage, current.menuLogoImage)
      : current.menuLogoImage;
  const menuHeaderText =
    typeof next.menuHeaderText === "string"
      ? normalizeMenuText(next.menuHeaderText, current.menuHeaderText)
      : current.menuHeaderText;

  const client = await pgPool.connect();
  try {
    const res = await client.query(
      `UPDATE pos_settings
       SET barcode_search_enabled = $1,
           digital_clock_enabled = $2,
           low_stock_threshold = $3,
           table_management_enabled = $4,
           menu_logo_image = $5,
           menu_header_text = $6,
           updated_at = NOW()
       WHERE id = 1
       RETURNING barcode_search_enabled, digital_clock_enabled, low_stock_threshold, table_management_enabled, menu_logo_image, menu_header_text`,
      [
        barcodeSearchEnabled,
        digitalClockEnabled,
        lowStockThreshold,
        tableManagementEnabled,
        menuLogoImage,
        menuHeaderText,
      ],
    );
    return {
      barcodeSearchEnabled:
        typeof res.rows[0]?.barcode_search_enabled === "boolean"
          ? res.rows[0].barcode_search_enabled
          : barcodeSearchEnabled,
      digitalClockEnabled:
        typeof res.rows[0]?.digital_clock_enabled === "boolean"
          ? res.rows[0].digital_clock_enabled
          : digitalClockEnabled,
      lowStockThreshold:
        res.rows[0]?.low_stock_threshold != null
          ? normalizeThreshold(res.rows[0].low_stock_threshold, lowStockThreshold)
          : lowStockThreshold,
      tableManagementEnabled:
        typeof res.rows[0]?.table_management_enabled === "boolean"
          ? res.rows[0].table_management_enabled
          : tableManagementEnabled,
      menuLogoImage: normalizeMenuLogo(
        res.rows[0]?.menu_logo_image,
        menuLogoImage,
      ),
      menuHeaderText: normalizeMenuText(
        res.rows[0]?.menu_header_text,
        menuHeaderText,
      ),
    };
  } finally {
    client.release();
  }
}
