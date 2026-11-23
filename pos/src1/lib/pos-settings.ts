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
            id                     integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
            barcode_search_enabled boolean NOT NULL DEFAULT true,
            digital_clock_enabled  boolean NOT NULL DEFAULT true,
            updated_at             timestamptz NOT NULL DEFAULT NOW()
          );
          ALTER TABLE pos_settings
            ADD COLUMN IF NOT EXISTS digital_clock_enabled boolean NOT NULL DEFAULT true;
        `);

        const existing = await client.query(
          `SELECT id FROM pos_settings WHERE id = 1`,
        );
        if (!existing.rowCount) {
          await client.query(
            `INSERT INTO pos_settings (id, barcode_search_enabled, digital_clock_enabled)
             VALUES (1, $1, $2)`,
            [
              DEFAULT_POS_SETTINGS.barcodeSearchEnabled,
              DEFAULT_POS_SETTINGS.digitalClockEnabled,
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

export async function loadPosSettings(): Promise<PosSettings> {
  await ensurePosSettingsTable();
  const client = await pgPool.connect();
  try {
    const res = await client.query(
      `SELECT barcode_search_enabled, digital_clock_enabled FROM pos_settings WHERE id = 1`,
    );
    if (!res.rowCount) return { ...DEFAULT_POS_SETTINGS };
    const barcodeVal = res.rows[0]?.barcode_search_enabled;
    const clockVal = res.rows[0]?.digital_clock_enabled;
    return {
      barcodeSearchEnabled:
        typeof barcodeVal === "boolean"
          ? barcodeVal
          : DEFAULT_POS_SETTINGS.barcodeSearchEnabled,
      digitalClockEnabled:
        typeof clockVal === "boolean"
          ? clockVal
          : DEFAULT_POS_SETTINGS.digitalClockEnabled,
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

  const client = await pgPool.connect();
  try {
    const res = await client.query(
      `UPDATE pos_settings
       SET barcode_search_enabled = $1,
           digital_clock_enabled = $2,
           updated_at = NOW()
       WHERE id = 1
       RETURNING barcode_search_enabled, digital_clock_enabled`,
      [barcodeSearchEnabled, digitalClockEnabled],
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
    };
  } finally {
    client.release();
  }
}
