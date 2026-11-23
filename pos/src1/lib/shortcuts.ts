"use client";

export type ShortcutAction =
  | "newOrder"
  | "history"
  | "orders"
  | "saveOrder"
  | "payOrder";

export type ShortcutConfig = {
  key: string; // e.g. "n", "h", "o", "s", "c"
  altKey: boolean;
  ctrlKey: boolean;
  label: string;
  description: string;
};

export type ShortcutsMap = Record<ShortcutAction, ShortcutConfig>;

export const DEFAULT_SHORTCUTS: ShortcutsMap = {
  newOrder: {
    key: "n",
    altKey: true,
    ctrlKey: false,
    label: "Alt + N",
    description: "New Order / Clear Cart",
  },
  history: {
    key: "h",
    altKey: true,
    ctrlKey: false,
    label: "Alt + H",
    description: "Open Sales History",
  },
  orders: {
    key: "o",
    altKey: true,
    ctrlKey: false,
    label: "Alt + O",
    description: "Open Saved Orders",
  },
  saveOrder: {
    key: "s",
    altKey: true,
    ctrlKey: false,
    label: "Alt + S",
    description: "Save Order (Unpaid/Draft)",
  },
  payOrder: {
    key: "c",
    altKey: true,
    ctrlKey: false,
    label: "Alt + C",
    description: "Pay / Cash Checkout",
  },
};

const STORAGE_KEY = "pos_keyboard_shortcuts_v1";
export const SHORTCUTS_CHANGED_EVENT = "pos_shortcuts_changed";

export function getShortcuts(): ShortcutsMap {
  if (typeof window === "undefined") return DEFAULT_SHORTCUTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SHORTCUTS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SHORTCUTS,
      ...parsed,
    };
  } catch {
    return DEFAULT_SHORTCUTS;
  }
}

export function saveShortcuts(shortcuts: ShortcutsMap): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(shortcuts));
    window.dispatchEvent(new CustomEvent(SHORTCUTS_CHANGED_EVENT, { detail: shortcuts }));
  } catch (err) {
    console.warn("Failed to save shortcuts to localStorage:", err);
  }
}

export function resetShortcuts(): ShortcutsMap {
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(STORAGE_KEY);
      window.dispatchEvent(new CustomEvent(SHORTCUTS_CHANGED_EVENT, { detail: DEFAULT_SHORTCUTS }));
    } catch {
      /* ignore */
    }
  }
  return DEFAULT_SHORTCUTS;
}

export function formatKeyCombo(key: string, altKey = true, ctrlKey = false): string {
  const parts: string[] = [];
  if (ctrlKey) parts.push("Ctrl");
  if (altKey) parts.push("Alt");
  parts.push(key.toUpperCase());
  return parts.join(" + ");
}
