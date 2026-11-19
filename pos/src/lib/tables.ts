export const DEFAULT_DINE_TABLE_COUNT = 12;
export const MIN_DINE_TABLE_COUNT = 4;
export const MAX_DINE_TABLE_COUNT = 30;

export const DINE_TABLE_COUNT_STORAGE_KEY = "pos_dine_table_count";
export const DINE_TABLE_CONFIG_CHANGED_EVENT = "pos-dine-table-config-changed";
export const PENDING_DINE_TABLE_STORAGE_KEY = "pos_pending_dine_table";

export function clampDineTableCount(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_DINE_TABLE_COUNT;
  return Math.min(MAX_DINE_TABLE_COUNT, Math.max(MIN_DINE_TABLE_COUNT, Math.round(value)));
}

export function getStoredDineTableCount(): number {
  if (typeof window === "undefined") return DEFAULT_DINE_TABLE_COUNT;
  try {
    const raw = window.localStorage.getItem(DINE_TABLE_COUNT_STORAGE_KEY);
    if (!raw) return DEFAULT_DINE_TABLE_COUNT;
    return clampDineTableCount(Number(raw));
  } catch {
    return DEFAULT_DINE_TABLE_COUNT;
  }
}

export function setStoredDineTableCount(count: number): number {
  const clamped = clampDineTableCount(count);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(DINE_TABLE_COUNT_STORAGE_KEY, String(clamped));
      window.dispatchEvent(
        new CustomEvent<number>(DINE_TABLE_CONFIG_CHANGED_EVENT, {
          detail: clamped,
        }),
      );
    } catch {
      /* ignore storage failure */
    }
  }
  return clamped;
}
