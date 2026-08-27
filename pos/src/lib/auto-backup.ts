import fs from "fs/promises";
import path from "path";
import { pgPool } from "./db";

export type AutoBackupSettings = {
  contactsEnabled: boolean;
  fullEnabled: boolean;
  contactsTime: string; // HH:MM
  fullTime: string; // HH:MM
  customFolder: string | null; // absolute path; null/empty = default ./backups
  lastContactsDate: string | null; // YYYY-MM-DD local
  lastFullDate: string | null;
  lastContactsAt: string | null; // ISO
  lastFullAt: string | null;
  lastContactsFile: string | null;
  lastFullFile: string | null;
  lastError: string | null;
};

export const DEFAULT_AUTO_BACKUP_SETTINGS: AutoBackupSettings = {
  contactsEnabled: false,
  fullEnabled: false,
  contactsTime: "22:00",
  fullTime: "23:00",
  customFolder: null,
  lastContactsDate: null,
  lastFullDate: null,
  lastContactsAt: null,
  lastFullAt: null,
  lastContactsFile: null,
  lastFullFile: null,
  lastError: null,
};

const KEEP_COUNT = 30;

function defaultBackupsRoot() {
  return path.join(process.cwd(), "backups");
}

/** Normalize and validate an absolute backup folder path. Empty → null (use default). */
export function normalizeBackupFolder(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  const resolved = path.resolve(trimmed);
  if (!path.isAbsolute(resolved)) {
    throw new Error("Backup folder must be an absolute path");
  }
  return resolved;
}

async function resolveBackupsRoot(): Promise<string> {
  const settings = await getAutoBackupSettings();
  if (settings.customFolder) return settings.customFolder;
  return defaultBackupsRoot();
}

export function normalizeTime(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2}):([0-5]\d)(?::[0-5]\d)?$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function isValidTime(value: string) {
  return normalizeTime(value) != null;
}

function localDateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function localTimeStr(d = new Date()) {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function stampForFile(d = new Date()) {
  const date = localDateStr(d);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${date}_${h}${m}${s}`;
}

async function ensureSettingsTable(
  client: Awaited<ReturnType<typeof pgPool.connect>>,
) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS backup_auto_settings (
      id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      contacts_enabled boolean NOT NULL DEFAULT false,
      full_enabled boolean NOT NULL DEFAULT false,
      contacts_time text NOT NULL DEFAULT '22:00',
      full_time text NOT NULL DEFAULT '23:00',
      last_contacts_date date,
      last_full_date date,
      last_contacts_at timestamptz,
      last_full_at timestamptz,
      last_contacts_file text,
      last_full_file text,
      last_error text,
      updated_at timestamptz NOT NULL DEFAULT NOW()
    );
  `);
  await client.query(`
    ALTER TABLE backup_auto_settings
      ADD COLUMN IF NOT EXISTS custom_folder text;
  `);
  await client.query(`
    INSERT INTO backup_auto_settings (id)
    VALUES (1)
    ON CONFLICT (id) DO NOTHING;
  `);
}

function rowToSettings(row: Record<string, unknown>): AutoBackupSettings {
  const folder = row.custom_folder ? String(row.custom_folder).trim() : "";
  return {
    contactsEnabled: Boolean(row.contacts_enabled),
    fullEnabled: Boolean(row.full_enabled),
    contactsTime: String(row.contacts_time || "22:00"),
    fullTime: String(row.full_time || "23:00"),
    customFolder: folder || null,
    lastContactsDate: row.last_contacts_date
      ? String(row.last_contacts_date).slice(0, 10)
      : null,
    lastFullDate: row.last_full_date
      ? String(row.last_full_date).slice(0, 10)
      : null,
    lastContactsAt: row.last_contacts_at
      ? new Date(row.last_contacts_at as string).toISOString()
      : null,
    lastFullAt: row.last_full_at
      ? new Date(row.last_full_at as string).toISOString()
      : null,
    lastContactsFile: (row.last_contacts_file as string) || null,
    lastFullFile: (row.last_full_file as string) || null,
    lastError: (row.last_error as string) || null,
  };
}

export async function getAutoBackupSettings(): Promise<AutoBackupSettings> {
  const client = await pgPool.connect();
  try {
    await ensureSettingsTable(client);
    const result = await client.query(
      `
      SELECT
        contacts_enabled,
        full_enabled,
        contacts_time,
        full_time,
        custom_folder,
        to_char(last_contacts_date, 'YYYY-MM-DD') AS last_contacts_date,
        to_char(last_full_date, 'YYYY-MM-DD') AS last_full_date,
        last_contacts_at,
        last_full_at,
        last_contacts_file,
        last_full_file,
        last_error
      FROM backup_auto_settings
      WHERE id = 1
      `,
    );
    if (!result.rows[0]) return { ...DEFAULT_AUTO_BACKUP_SETTINGS };
    return rowToSettings(result.rows[0]);
  } finally {
    client.release();
  }
}

export async function updateAutoBackupSettings(input: {
  contactsEnabled?: boolean;
  fullEnabled?: boolean;
  contactsTime?: string;
  fullTime?: string;
  customFolder?: string | null;
}): Promise<AutoBackupSettings> {
  const contactsTimeNorm =
    input.contactsTime != null ? normalizeTime(input.contactsTime) : null;
  const fullTimeNorm =
    input.fullTime != null ? normalizeTime(input.fullTime) : null;

  if (input.contactsTime != null && !contactsTimeNorm) {
    throw new Error("contactsTime must be HH:MM");
  }
  if (input.fullTime != null && !fullTimeNorm) {
    throw new Error("fullTime must be HH:MM");
  }

  const customFolderNorm =
    input.customFolder !== undefined
      ? normalizeBackupFolder(input.customFolder)
      : undefined;

  if (customFolderNorm) {
    await fs.mkdir(customFolderNorm, { recursive: true });
  }

  const client = await pgPool.connect();
  try {
    await ensureSettingsTable(client);
    const currentResult = await client.query(
      `
      SELECT
        contacts_enabled,
        full_enabled,
        contacts_time,
        full_time,
        custom_folder,
        to_char(last_contacts_date, 'YYYY-MM-DD') AS last_contacts_date,
        to_char(last_full_date, 'YYYY-MM-DD') AS last_full_date,
        last_contacts_at,
        last_full_at,
        last_contacts_file,
        last_full_file,
        last_error
      FROM backup_auto_settings
      WHERE id = 1
      `,
    );
    const current = currentResult.rows[0]
      ? rowToSettings(currentResult.rows[0])
      : { ...DEFAULT_AUTO_BACKUP_SETTINGS };

    const next = {
      contactsEnabled:
        input.contactsEnabled ?? current.contactsEnabled,
      fullEnabled: input.fullEnabled ?? current.fullEnabled,
      contactsTime: contactsTimeNorm ?? current.contactsTime,
      fullTime: fullTimeNorm ?? current.fullTime,
      customFolder:
        customFolderNorm !== undefined
          ? customFolderNorm
          : current.customFolder,
    };

    const result = await client.query(
      `
      UPDATE backup_auto_settings
      SET contacts_enabled = $1,
          full_enabled = $2,
          contacts_time = $3,
          full_time = $4,
          custom_folder = $5,
          updated_at = NOW()
      WHERE id = 1
      RETURNING
        contacts_enabled,
        full_enabled,
        contacts_time,
        full_time,
        custom_folder,
        to_char(last_contacts_date, 'YYYY-MM-DD') AS last_contacts_date,
        to_char(last_full_date, 'YYYY-MM-DD') AS last_full_date,
        last_contacts_at,
        last_full_at,
        last_contacts_file,
        last_full_file,
        last_error
      `,
      [
        next.contactsEnabled,
        next.fullEnabled,
        next.contactsTime,
        next.fullTime,
        next.customFolder,
      ],
    );
    return rowToSettings(result.rows[0]);
  } finally {
    client.release();
  }
}

async function pruneOldBackups(dir: string, prefix: string) {
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return;
  }
  const matched = entries
    .filter((name) => name.startsWith(prefix) && name.endsWith(".json"))
    .sort()
    .reverse();
  const toDelete = matched.slice(KEEP_COUNT);
  await Promise.all(
    toDelete.map((name) =>
      fs.unlink(path.join(dir, name)).catch(() => undefined),
    ),
  );
}

async function writeBackupFile(filename: string, data: unknown) {
  const dir = await resolveBackupsRoot();
  await fs.mkdir(dir, { recursive: true });
  const fullPath = path.join(dir, filename);
  await fs.writeFile(fullPath, JSON.stringify(data, null, 2), "utf8");
  return fullPath;
}

export async function runContactsAutoBackup(): Promise<{
  file: string;
  count: number;
}> {
  const client = await pgPool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id         bigserial PRIMARY KEY,
        name       text NOT NULL,
        phone      text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT NOW()
      );
    `);
    const result = await client.query(
      `SELECT id, name, phone, created_at FROM customers ORDER BY id`,
    );
    const stamp = stampForFile();
    const filename = `pos-contacts-auto-${stamp}.json`;
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      auto: true,
      customers: result.rows,
    };
    const file = await writeBackupFile(filename, payload);
    await pruneOldBackups(path.dirname(file), "pos-contacts-auto-");

    await ensureSettingsTable(client);
    await client.query(
      `
      UPDATE backup_auto_settings
      SET last_contacts_date = CURRENT_DATE,
          last_contacts_at = NOW(),
          last_contacts_file = $1,
          last_error = NULL,
          updated_at = NOW()
      WHERE id = 1
      `,
      [filename],
    );

    return { file, count: result.rows.length };
  } finally {
    client.release();
  }
}

export async function runFullAutoBackup(): Promise<{
  file: string;
  orders: number;
  customers: number;
}> {
  const client = await pgPool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id         bigserial PRIMARY KEY,
        name       text NOT NULL,
        phone      text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS instructions text`,
    );

    const [
      storeState,
      customers,
      orders,
      orderItems,
      dailySales,
      allTimeSales,
    ] = await Promise.all([
      client.query(`SELECT * FROM store_state ORDER BY id`),
      client.query(`SELECT * FROM customers ORDER BY id`),
      client.query(`SELECT * FROM orders ORDER BY id`),
      client.query(`SELECT * FROM order_items ORDER BY id`),
      client.query(`SELECT * FROM daily_sales ORDER BY sale_date`),
      client.query(`SELECT * FROM all_time_sales ORDER BY id`),
    ]);

    const stamp = stampForFile();
    const filename = `pos-full-auto-${stamp}.json`;
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      auto: true,
      store_state: storeState.rows,
      customers: customers.rows,
      orders: orders.rows,
      order_items: orderItems.rows,
      daily_sales: dailySales.rows,
      all_time_sales: allTimeSales.rows,
    };
    const file = await writeBackupFile(filename, payload);
    await pruneOldBackups(path.dirname(file), "pos-full-auto-");

    await ensureSettingsTable(client);
    await client.query(
      `
      UPDATE backup_auto_settings
      SET last_full_date = CURRENT_DATE,
          last_full_at = NOW(),
          last_full_file = $1,
          last_error = NULL,
          updated_at = NOW()
      WHERE id = 1
      `,
      [filename],
    );

    return {
      file,
      orders: orders.rows.length,
      customers: customers.rows.length,
    };
  } finally {
    client.release();
  }
}

async function setLastError(message: string) {
  const client = await pgPool.connect();
  try {
    await ensureSettingsTable(client);
    await client.query(
      `
      UPDATE backup_auto_settings
      SET last_error = $1,
          updated_at = NOW()
      WHERE id = 1
      `,
      [message.slice(0, 500)],
    );
  } finally {
    client.release();
  }
}

export async function listRecentAutoBackups(limit = 20) {
  const dir = await resolveBackupsRoot();
  try {
    const entries = await fs.readdir(dir);
    return entries
      .filter(
        (name) =>
          (name.startsWith("pos-contacts-auto-") ||
            name.startsWith("pos-full-auto-")) &&
          name.endsWith(".json"),
      )
      .sort()
      .reverse()
      .slice(0, limit)
      .map((name) => ({
        name,
        type: name.startsWith("pos-contacts-auto-")
          ? ("contacts" as const)
          : ("full" as const),
        path: path.join(dir, name),
      }));
  } catch {
    return [];
  }
}

export async function getBackupsFolderPath() {
  return resolveBackupsRoot();
}

let tickRunning = false;

export async function tickAutoBackups() {
  if (tickRunning) return;
  tickRunning = true;
  try {
    const settings = await getAutoBackupSettings();
    const today = localDateStr();
    const nowTime = localTimeStr();

    if (
      settings.contactsEnabled &&
      settings.contactsTime === nowTime &&
      settings.lastContactsDate !== today
    ) {
      try {
        await runContactsAutoBackup();
        console.log(`[auto-backup] contacts backup saved at ${nowTime}`);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Contacts auto backup failed";
        console.error("[auto-backup] contacts failed", err);
        await setLastError(msg);
      }
    }

    if (
      settings.fullEnabled &&
      settings.fullTime === nowTime &&
      settings.lastFullDate !== today
    ) {
      try {
        await runFullAutoBackup();
        console.log(`[auto-backup] full backup saved at ${nowTime}`);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Full auto backup failed";
        console.error("[auto-backup] full failed", err);
        await setLastError(msg);
      }
    }
  } catch (err) {
    console.error("[auto-backup] tick failed", err);
  } finally {
    tickRunning = false;
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __posAutoBackupInterval: ReturnType<typeof setInterval> | undefined;
}

export function startAutoBackupScheduler() {
  if (global.__posAutoBackupInterval) return;
  // Check every 20s so we don't miss the HH:MM minute window.
  global.__posAutoBackupInterval = setInterval(() => {
    void tickAutoBackups();
  }, 20_000);
  void tickAutoBackups();
  console.log("[auto-backup] scheduler started");
}
