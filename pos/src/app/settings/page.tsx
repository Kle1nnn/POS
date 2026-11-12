"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowDownRight,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  History,
  PackageMinus,
  PackagePlus,
  PackageX,
  RefreshCw,
  ScanBarcode,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import PrintModal from "../components/PrintModal";
import { CartItem } from "../context/CartContext";
import { useOrders } from "../context/OrdersContext";
import {
  clearReceiptSettingsCache,
  printReportHtml,
  escapeReportHtml,
  type ReceiptSettings,
} from "../lib/receipt";
import { DEFAULT_RECEIPT_SETTINGS } from "../../lib/receipt-settings-shared";
import {
  DEFAULT_MENU_APPEARANCE,
  MENU_FONT_OPTIONS,
  type MenuAppearanceSettings,
} from "../../lib/menu-appearance-shared";
import {
  DEFAULT_POS_SETTINGS,
  POS_SETTINGS_CHANGED_EVENT,
  type PosSettings,
} from "../../lib/pos-settings-shared";
import {
  DEFAULT_SHORTCUTS,
  SHORTCUTS_CHANGED_EVENT,
  formatKeyCombo,
  getShortcuts,
  resetShortcuts,
  saveShortcuts,
  type ShortcutAction,
  type ShortcutConfig,
  type ShortcutsMap,
} from "../../lib/shortcuts";

type Tab =
  | "contacts"
  | "catalog"
  | "inventory"
  | "shortcuts"
  | "reports"
  | "ledger"
  | "receipt"
  | "receiptNumber"
  | "backup"
  | "menu"
  | "danger";

type Customer = {
  id: number;
  name: string;
  phone: string;
};

type CustomerDraft = {
  name: string;
  phone: string;
};

type CustomCategory = {
  id: number;
  name: string;
  label: string;
  emoji: string;
  image: string;
};

type CatalogProduct = {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  image: string;
  category: string;
  source?: "builtin" | "custom";
  sizePrices?: Record<string, number> | null;
  sizes?: string[] | null;
  hasExtraToppings?: boolean | null;
  hasSauceOptions?: boolean | null;
  sku?: string | null;
  barcode?: string | null;
  stock?: number | null;
};

type InventoryLogItem = {
  id: number;
  productId: string;
  productName: string;
  sku: string;
  barcode: string;
  previousStock: number | null;
  newStock: number | null;
  quantityChange: number;
  reason: string;
  source: string;
  orderCode: string | null;
  createdAt: string;
};

type DailyRow = {
  saleDate: string;
  totalRevenue: number;
  totalOrders: number;
  totalItems: number;
};

type MonthlyRow = {
  period: string;
  totalRevenue: number;
  totalOrders: number;
  totalItems: number;
};

type DateOrderRow = {
  orderCode: string;
  total: number;
  notes?: string;
  instructions?: string;
  customerName: string;
  customerPhone?: string;
  orderType: string;
  tableNumber: number | null;
  soldAt: string;
  createdAt?: string;
  itemCount: number;
  items?: Array<{
    id?: string;
    name: string;
    category?: string;
    selectedSize?: string;
    selectedTopping?: string;
    selectedSauce?: string;
    price: number;
    quantity: number;
    cartKey?: string;
  }>;
};

type ReportTotals = {
  totalRevenue: number;
  totalOrders: number;
  totalItems: number;
};

type ItemReportRow = {
  period?: string;
  name: string;
  category: string | null;
  selectedSize: string | null;
  selectedTopping: string | null;
  selectedSauce: string | null;
  quantitySold: number;
  revenue: number;
  orderCount: number;
};

type DayCustomerOption = {
  name: string;
  phone: string;
};

type LedgerEntry = {
  orderCode: string;
  total: number;
  balance: number;
  notes?: string;
  instructions?: string;
  customerName: string;
  customerPhone?: string;
  orderType: string;
  tableNumber: number | null;
  businessDate: string;
  soldAt: string;
  createdAt?: string;
  itemCount: number;
  items?: DateOrderRow["items"];
};

type AutoBackupSettings = {
  contactsEnabled: boolean;
  fullEnabled: boolean;
  contactsTime: string;
  fullTime: string;
  customFolder: string | null;
  lastContactsDate: string | null;
  lastFullDate: string | null;
  lastContactsAt: string | null;
  lastFullAt: string | null;
  lastContactsFile: string | null;
  lastFullFile: string | null;
  lastError: string | null;
};

type AutoBackupRecent = {
  name: string;
  type: "contacts" | "full";
};

const DEFAULT_IMAGE = "deals.png";

const BUILTIN_CATEGORIES = [
  "Pizza",
  "Burger",
  "Broast",
  "Rolls",
  "Shawarma",
  "Fries",
  "Sandwich",
  "Pasta",
  "BarBQ",
  "Drinks",
  "Toping",
  "Deals",
];

function imageUrl(image: string) {
  if (!image) return `/${DEFAULT_IMAGE}`;
  if (image.startsWith("http") || image.startsWith("/")) return image;
  return `/${image}`;
}

function isUploadedImage(image: string) {
  return image.startsWith("uploads/");
}

async function deleteUploadedImage(image: string) {
  if (!isUploadedImage(image)) return;
  try {
    await fetch(`/api/catalog/upload?image=${encodeURIComponent(image)}`, {
      method: "DELETE",
    });
  } catch {
    // ignore cleanup failures
  }
}

function draftsFromCustomers(customers: Customer[]): Record<number, CustomerDraft> {
  return Object.fromEntries(
    customers.map((c) => [c.id, { name: c.name, phone: c.phone }]),
  );
}

function money(n: number) {
  return `Rs ${Number(n || 0).toLocaleString()}`;
}

function formatSizePrices(sizePrices?: Record<string, number> | null) {
  if (!sizePrices) return null;
  const order = ["S", "M", "L"];
  const parts = order
    .filter((k) => sizePrices[k] != null)
    .map((k) => `${k}: ${Number(sizePrices[k]).toLocaleString()}`);
  if (parts.length === 0) {
    return Object.entries(sizePrices)
      .map(([k, v]) => `${k}: ${Number(v).toLocaleString()}`)
      .join(" · ");
  }
  return parts.join(" · ");
}

function formatInventoryDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function inventorySourceLabel(source: string) {
  switch (source) {
    case "restock":
      return { label: "Restock", cls: "bg-emerald-50 text-emerald-800 border-emerald-200" };
    case "sale":
      return { label: "Order", cls: "bg-blue-50 text-blue-800 border-blue-200" };
    case "scan_event":
      return { label: "Barcode Scan", cls: "bg-indigo-50 text-indigo-800 border-indigo-200" };
    case "catalog_create":
      return { label: "New Item", cls: "bg-gray-100 text-gray-700 border-gray-200" };
    case "catalog_edit":
      return { label: "Catalog Edit", cls: "bg-amber-50 text-amber-800 border-amber-200" };
    default:
      return { label: "Adjustment", cls: "bg-gray-100 text-gray-700 border-gray-200" };
  }
}

const INVENTORY_REASON_PRESETS = [
  "Restock",
  "Supplier Delivery",
  "Stock Count Correction",
  "Damaged / Waste",
  "Expired",
];

function reportPrintShell(title: string, subtitle: string, bodyHtml: string) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeReportHtml(title)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    color: #111;
    margin: 0;
    padding: 16px 20px;
    font-size: 12px;
  }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .sub { color: #444; margin: 0 0 14px; font-size: 12px; }
  .totals { margin: 0 0 14px; }
  .totals span { display: inline-block; margin-right: 18px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border-bottom: 1px solid #ccc; padding: 6px 4px; text-align: left; vertical-align: top; }
  th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #333; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  .muted { color: #666; font-size: 11px; }
  @media print {
    @page { margin: 12mm; size: A4; }
    body { padding: 0; }
  }
</style>
</head>
<body>
  <h1>${escapeReportHtml(title)}</h1>
  <p class="sub">${escapeReportHtml(subtitle)}</p>
  ${bodyHtml}
</body>
</html>`;
}

function monthLabel(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export default function SettingsPage() {
  const router = useRouter();
  const { savedOrders } = useOrders();
  const [tab, setTab] = useState<Tab>("contacts");
  const [toast, setToast] = useState<string | null>(null);

  // Contacts
  const [savedCustomers, setSavedCustomers] = useState<Customer[]>([]);
  const [drafts, setDrafts] = useState<Record<number, CustomerDraft>>({});
  const [newContact, setNewContact] = useState<CustomerDraft>({ name: "", phone: "" });
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isBackingUpContacts, setIsBackingUpContacts] = useState(false);
  const [isRestoringContacts, setIsRestoringContacts] = useState(false);
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const contactsRestoreInputRef = useRef<HTMLInputElement>(null);

  // Shortcuts
  const [shortcuts, setShortcuts] = useState<ShortcutsMap>(getShortcuts);
  const [editingShortcutAction, setEditingShortcutAction] = useState<ShortcutAction | null>(null);
  const [tempKeyCombo, setTempKeyCombo] = useState<{
    key: string;
    altKey: boolean;
    ctrlKey: boolean;
  }>({ key: "n", altKey: true, ctrlKey: false });

  // Low stock alert threshold & filter
  const [lowStockThreshold, setLowStockThreshold] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("pos_low_stock_threshold");
      if (saved && !isNaN(Number(saved))) return Math.max(0, Number(saved));
    }
    return 5;
  });
  const [catalogStockFilter, setCatalogStockFilter] = useState<"all" | "low" | "out" | "in">("all");

  // In-app Restore Confirmation Dialog (replaces window.confirm)
  const [pendingRestore, setPendingRestore] = useState<{
    type: "contacts" | "full";
    file: File;
    filename: string;
  } | null>(null);

  // In-app Delete Confirmation Dialog (replaces window.confirm)
  const [pendingDelete, setPendingDelete] = useState<{
    type: "product" | "category" | "customer";
    target: any;
    title: string;
    description: string;
  } | null>(null);

  useEffect(() => {
    const handler = () => {
      setShortcuts(getShortcuts());
    };
    window.addEventListener(SHORTCUTS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(SHORTCUTS_CHANGED_EVENT, handler);
  }, []);

  // Auto backup
  const [autoBackup, setAutoBackup] = useState<AutoBackupSettings>({
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
  });
  const [autoBackupFolder, setAutoBackupFolder] = useState("");
  const [customFolderDraft, setCustomFolderDraft] = useState("");
  const [autoBackupRecent, setAutoBackupRecent] = useState<AutoBackupRecent[]>(
    [],
  );
  const [autoBackupLoading, setAutoBackupLoading] = useState(false);
  const [isSavingAutoBackup, setIsSavingAutoBackup] = useState(false);
  const [isRunningAutoContacts, setIsRunningAutoContacts] = useState(false);
  const [isRunningAutoFull, setIsRunningAutoFull] = useState(false);

  // Menu appearance
  const [menuAppearance, setMenuAppearance] = useState<MenuAppearanceSettings>(
    DEFAULT_MENU_APPEARANCE,
  );
  const [menuAppearanceLoading, setMenuAppearanceLoading] = useState(false);
  const [isSavingMenuAppearance, setIsSavingMenuAppearance] = useState(false);

  // Danger / wipe all data
  const [wipeCodeHint, setWipeCodeHint] = useState("****");
  const [wipeCurrentCode, setWipeCurrentCode] = useState("");
  const [wipeNewCode, setWipeNewCode] = useState("");
  const [wipeConfirmNewCode, setWipeConfirmNewCode] = useState("");
  const [wipeConfirmInput, setWipeConfirmInput] = useState("");
  const [isSavingWipeCode, setIsSavingWipeCode] = useState(false);
  const [isWipingData, setIsWipingData] = useState(false);

  // Catalog
  const [categories, setCategories] = useState<CustomCategory[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [itemQuery, setItemQuery] = useState("");
  const [posSettings, setPosSettings] = useState<PosSettings>(DEFAULT_POS_SETTINGS);
  const [posSettingsLoading, setPosSettingsLoading] = useState(false);
  const [isSavingPosSettings, setIsSavingPosSettings] = useState(false);
  const [inventoryLogs, setInventoryLogs] = useState<InventoryLogItem[]>([]);
  const [inventoryLogsLoading, setInventoryLogsLoading] = useState(false);
  const [inventoryQuery, setInventoryQuery] = useState("");
  const [inventoryFilter, setInventoryFilter] = useState<
    "" | "in" | "out" | "manual" | "sale" | "scan"
  >("");
  const [showInventoryAdjustForm, setShowInventoryAdjustForm] = useState(false);
  const [adjustProductId, setAdjustProductId] = useState("");
  const [adjustMode, setAdjustMode] = useState<"add" | "subtract" | "set">("add");
  const [adjustQuantity, setAdjustQuantity] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [isAdjustingStock, setIsAdjustingStock] = useState(false);
  const [quickAdjustProduct, setQuickAdjustProduct] =
    useState<CatalogProduct | null>(null);
  const [quickAdjustMode, setQuickAdjustMode] = useState<
    "add" | "subtract" | "set"
  >("add");
  const [quickAdjustQty, setQuickAdjustQty] = useState("");
  const [quickAdjustReason, setQuickAdjustReason] = useState("");
  const [isSavingQuickAdjust, setIsSavingQuickAdjust] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryEmoji, setNewCategoryEmoji] = useState("📦");
  const [newCategoryImage, setNewCategoryImage] = useState(DEFAULT_IMAGE);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [originalCategoryImage, setOriginalCategoryImage] = useState<string | null>(
    null,
  );
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [isUploadingCategoryImage, setIsUploadingCategoryImage] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState<number | null>(null);
  const [changingPictureCategoryId, setChangingPictureCategoryId] = useState<
    number | string | null
  >(null);
  const categoryImageInputRef = useRef<HTMLInputElement>(null);
  const categoryRowImageInputRef = useRef<HTMLInputElement>(null);
  const categoryPictureTargetRef = useRef<CustomCategory | null>(null);
  const categoryFormRef = useRef<HTMLDivElement>(null);
  const emptyItemForm = {
    name: "",
    category: "Burger",
    basePrice: "",
    description: "",
    image: DEFAULT_IMAGE,
    sku: "",
    barcode: "",
    stock: "",
    stockReason: "",
    priceS: "",
    priceM: "",
    priceL: "",
  };
  const [newItem, setNewItem] = useState(emptyItemForm);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [originalEditImage, setOriginalEditImage] = useState<string | null>(null);
  const [isSavingItem, setIsSavingItem] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const itemImageInputRef = useRef<HTMLInputElement>(null);
  const catalogItemsRef = useRef<HTMLDivElement>(null);

  // Reports
  const now = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, [now]);
  const [reportMode, setReportMode] = useState<
    "date" | "daily" | "monthly" | "items"
  >("date");
  const [reportDate, setReportDate] = useState(todayStr);
  const [reportYear, setReportYear] = useState(now.getFullYear());
  const [reportMonth, setReportMonth] = useState(now.getMonth() + 1);
  const [dailyRows, setDailyRows] = useState<DailyRow[]>([]);
  const [monthlyRows, setMonthlyRows] = useState<MonthlyRow[]>([]);
  const [dateOrders, setDateOrders] = useState<DateOrderRow[]>([]);
  const [itemReportRows, setItemReportRows] = useState<ItemReportRow[]>([]);
  const [dayCustomers, setDayCustomers] = useState<DayCustomerOption[]>([]);
  const [reportCustomerKey, setReportCustomerKey] = useState("all");
  const [itemReportRange, setItemReportRange] = useState<
    "date" | "daily" | "monthly"
  >("date");
  const [reportCategory, setReportCategory] = useState("all");
  const [reportCategories, setReportCategories] = useState<string[]>([]);
  const [reportTotals, setReportTotals] = useState<ReportTotals>({
    totalRevenue: 0,
    totalOrders: 0,
    totalItems: 0,
  });
  const [reportsLoading, setReportsLoading] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printOrder, setPrintOrder] = useState<{
    id: string;
    items: CartItem[];
    total: number;
    notes: string;
    instructions: string;
    customer?: { name: string; phone: string };
    orderType?: string;
    tableNumber?: number | null;
    placedAt?: string | null;
  } | null>(null);

  // Customer ledger
  const [ledgerCustomerKey, setLedgerCustomerKey] = useState("");
  const [ledgerViewMode, setLedgerViewMode] = useState<"all" | "daily">("all");
  const [ledgerYear, setLedgerYear] = useState(now.getFullYear());
  const [ledgerMonth, setLedgerMonth] = useState(now.getMonth() + 1);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [ledgerDaily, setLedgerDaily] = useState<DailyRow[]>([]);
  const [ledgerTotals, setLedgerTotals] = useState<ReportTotals>({
    totalRevenue: 0,
    totalOrders: 0,
    totalItems: 0,
  });
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // Receipt settings
  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings>({
    ...DEFAULT_RECEIPT_SETTINGS,
  });
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [isSavingReceipt, setIsSavingReceipt] = useState(false);
  const [isSavingReceiptNumber, setIsSavingReceiptNumber] = useState(false);
  const [isUploadingReceiptLogo, setIsUploadingReceiptLogo] = useState(false);
  const [isUploadingPaymentImage, setIsUploadingPaymentImage] = useState(false);
  const receiptLogoInputRef = useRef<HTMLInputElement>(null);
  const paymentImageInputRef = useRef<HTMLInputElement>(null);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  };

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/customers?all=1");
      const data = await res.json();
      const customers: Customer[] = data.customers ?? [];
      setSavedCustomers(customers);
      setDrafts(draftsFromCustomers(customers));
    } catch (error) {
      console.error("Failed to load customers", error);
    } finally {
      setLoading(false);
    }
  };

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const [catRes, prodRes] = await Promise.all([
        fetch("/api/catalog/categories"),
        fetch("/api/catalog/products?all=1"),
      ]);
      const catData = await catRes.json();
      const prodData = await prodRes.json();
      setCategories(catData.categories ?? []);
      setCatalogProducts(prodData.products ?? []);
    } catch (error) {
      console.error("Failed to load catalog", error);
      showToast("Failed to load catalog");
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  const loadPosSettings = useCallback(async () => {
    setPosSettingsLoading(true);
    try {
      const res = await fetch("/api/pos-settings");
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.settings) {
        setPosSettings({
          barcodeSearchEnabled:
            typeof data.settings.barcodeSearchEnabled === "boolean"
              ? data.settings.barcodeSearchEnabled
              : DEFAULT_POS_SETTINGS.barcodeSearchEnabled,
          digitalClockEnabled:
            typeof data.settings.digitalClockEnabled === "boolean"
              ? data.settings.digitalClockEnabled
              : DEFAULT_POS_SETTINGS.digitalClockEnabled,
        });
      }
    } catch (error) {
      console.error("Failed to load POS settings", error);
    } finally {
      setPosSettingsLoading(false);
    }
  }, []);

  const toggleBarcodeSearch = async (nextEnabled: boolean) => {
    setIsSavingPosSettings(true);
    try {
      const res = await fetch("/api/pos-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcodeSearchEnabled: nextEnabled }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to update barcode search setting");
      }
      const updated: PosSettings = data.settings ?? {
        ...posSettings,
        barcodeSearchEnabled: nextEnabled,
      };
      setPosSettings(updated);
      window.dispatchEvent(
        new CustomEvent(POS_SETTINGS_CHANGED_EVENT, { detail: updated }),
      );
      showToast(
        updated.barcodeSearchEnabled
          ? "Barcode search enabled in billing"
          : "Barcode search disabled in billing",
      );
    } catch (error) {
      console.error("Failed to save POS settings", error);
      showToast(
        error instanceof Error ? error.message : "Failed to save barcode setting",
      );
    } finally {
      setIsSavingPosSettings(false);
    }
  };

  const setDigitalClockVisibility = async (nextVisible: boolean) => {
    setIsSavingPosSettings(true);
    try {
      const res = await fetch("/api/pos-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ digitalClockEnabled: nextVisible }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to update digital clock setting");
      }
      const updated: PosSettings = data.settings ?? {
        ...posSettings,
        digitalClockEnabled: nextVisible,
      };
      setPosSettings(updated);
      window.dispatchEvent(
        new CustomEvent(POS_SETTINGS_CHANGED_EVENT, { detail: updated }),
      );
      showToast(
        updated.digitalClockEnabled
          ? "Digital clock shown above navigation buttons"
          : "Digital clock hidden above navigation buttons",
      );
    } catch (error) {
      console.error("Failed to save digital clock setting", error);
      showToast(
        error instanceof Error
          ? error.message
          : "Failed to save digital clock setting",
      );
    } finally {
      setIsSavingPosSettings(false);
    }
  };

  const loadInventoryLogs = useCallback(async () => {
    setInventoryLogsLoading(true);
    try {
      const params = new URLSearchParams();
      if (inventoryQuery.trim()) params.set("q", inventoryQuery.trim());
      if (inventoryFilter) params.set("filter", inventoryFilter);
      params.set("limit", "250");
      const res = await fetch(`/api/catalog/inventory?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to load inventory log");
      }
      setInventoryLogs(data.logs ?? []);
    } catch (error) {
      console.error("Failed to load inventory log", error);
      showToast("Failed to load inventory log");
    } finally {
      setInventoryLogsLoading(false);
    }
  }, [inventoryQuery, inventoryFilter]);

  const loadReports = useCallback(async () => {
    setReportsLoading(true);
    try {
      const params = new URLSearchParams({ type: reportMode });
      if (reportMode === "date") {
        params.set("date", reportDate);
      } else if (reportMode === "items") {
        params.set("range", itemReportRange);
        if (itemReportRange === "date") {
          params.set("date", reportDate);
        } else {
          params.set("year", String(reportYear));
          if (itemReportRange === "daily") {
            params.set("month", String(reportMonth));
          }
        }
        if (reportCustomerKey !== "all") {
          const [name, phone = ""] = reportCustomerKey.split("\t");
          if (name) params.set("customerName", name);
          if (phone) params.set("customerPhone", phone);
        }
        if (reportCategory !== "all") {
          params.set("category", reportCategory);
        }
      } else {
        params.set("year", String(reportYear));
        if (reportMode === "daily") params.set("month", String(reportMonth));
      }

      const res = await fetch(`/api/reports?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load reports");

      if (reportMode === "date") {
        setDailyRows(data.rows ?? []);
        setDateOrders(data.orders ?? []);
        setMonthlyRows([]);
        setItemReportRows([]);
        setDayCustomers([]);
        setReportCategories([]);
      } else if (reportMode === "items") {
        setItemReportRows(data.items ?? []);
        setDayCustomers(data.dayCustomers ?? []);
        setReportCategories(data.categories ?? []);
        setDailyRows([]);
        setDateOrders([]);
        setMonthlyRows([]);
      } else if (reportMode === "daily") {
        setDailyRows(data.rows ?? []);
        setDateOrders([]);
        setMonthlyRows([]);
        setItemReportRows([]);
        setDayCustomers([]);
        setReportCategories([]);
      } else {
        setMonthlyRows(data.rows ?? []);
        setDailyRows([]);
        setDateOrders([]);
        setItemReportRows([]);
        setDayCustomers([]);
        setReportCategories([]);
      }
      setReportTotals(
        data.totals ?? { totalRevenue: 0, totalOrders: 0, totalItems: 0 },
      );
    } catch (error) {
      console.error("Failed to load reports", error);
      showToast("Failed to load reports");
    } finally {
      setReportsLoading(false);
    }
  }, [
    reportMode,
    reportYear,
    reportMonth,
    reportDate,
    reportCustomerKey,
    itemReportRange,
    reportCategory,
  ]);

  const loadLedger = useCallback(async () => {
    if (!ledgerCustomerKey) {
      setLedgerEntries([]);
      setLedgerDaily([]);
      setLedgerTotals({ totalRevenue: 0, totalOrders: 0, totalItems: 0 });
      return;
    }
    setLedgerLoading(true);
    try {
      const [name, phone = ""] = ledgerCustomerKey.split("\t");
      const params = new URLSearchParams({ name });
      if (phone) params.set("phone", phone);
      if (ledgerViewMode === "daily") {
        params.set("year", String(ledgerYear));
        params.set("month", String(ledgerMonth));
      }
      const res = await fetch(`/api/customers/ledger?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load ledger");
      setLedgerEntries(data.entries ?? []);
      setLedgerDaily(data.daily ?? []);
      setLedgerTotals(
        data.totals ?? { totalRevenue: 0, totalOrders: 0, totalItems: 0 },
      );
    } catch (error) {
      console.error("Failed to load customer ledger", error);
      showToast("Failed to load customer ledger");
      setLedgerEntries([]);
      setLedgerDaily([]);
    } finally {
      setLedgerLoading(false);
    }
  }, [ledgerCustomerKey, ledgerViewMode, ledgerYear, ledgerMonth]);

  useEffect(() => {
    loadCustomers();
    void loadPosSettings();
  }, [loadPosSettings]);

  useEffect(() => {
    if (tab === "catalog") {
      void loadCatalog();
      void loadPosSettings();
    } else if (tab === "menu") {
      void loadPosSettings();
    } else if (tab === "reports" || tab === "inventory") {
      void loadCatalog();
    }
  }, [tab, loadCatalog, loadPosSettings]);

  useEffect(() => {
    if (tab !== "inventory") return;
    const t = window.setTimeout(() => {
      void loadInventoryLogs();
    }, 150);
    return () => window.clearTimeout(t);
  }, [tab, loadInventoryLogs]);

  useEffect(() => {
    if (tab === "reports") void loadReports();
  }, [tab, loadReports]);

  useEffect(() => {
    if (tab === "ledger") void loadLedger();
  }, [tab, loadLedger]);

  const loadAutoBackup = useCallback(async () => {
    setAutoBackupLoading(true);
    try {
      const res = await fetch("/api/backup/auto");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load auto backup");
      if (data.settings) {
        setAutoBackup(data.settings);
        setCustomFolderDraft(data.settings.customFolder ?? "");
      }
      setAutoBackupFolder(data.folder ?? "");
      setAutoBackupRecent(data.recent ?? []);
    } catch (error) {
      console.error("Failed to load auto backup settings", error);
      showToast("Failed to load auto backup settings");
    } finally {
      setAutoBackupLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "contacts" || tab === "backup") void loadAutoBackup();
  }, [tab, loadAutoBackup]);

  const saveAutoBackupSettings = async (patch: {
    contactsEnabled?: boolean;
    fullEnabled?: boolean;
    contactsTime?: string;
    fullTime?: string;
    customFolder?: string | null;
  }) => {
    setIsSavingAutoBackup(true);
    try {
      const res = await fetch("/api/backup/auto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save auto backup");
      if (data.settings) {
        setAutoBackup(data.settings);
        setCustomFolderDraft(data.settings.customFolder ?? "");
      }
      if (data.folder) setAutoBackupFolder(data.folder);
      showToast("Auto backup settings saved");
      await loadAutoBackup();
    } catch (error) {
      console.error("Failed to save auto backup", error);
      showToast(
        error instanceof Error ? error.message : "Save auto backup failed",
      );
    } finally {
      setIsSavingAutoBackup(false);
    }
  };

  const runAutoBackupNow = async (kind: "contacts" | "full") => {
    if (kind === "contacts") setIsRunningAutoContacts(true);
    else setIsRunningAutoFull(true);
    try {
      const res = await fetch("/api/backup/auto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ run: kind }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Auto backup failed");
      if (data.settings) setAutoBackup(data.settings);
      showToast(
        kind === "contacts"
          ? "Contacts auto backup saved to folder"
          : "Full auto backup saved to folder",
      );
      await loadAutoBackup();
    } catch (error) {
      console.error("Failed to run auto backup", error);
      showToast(
        error instanceof Error ? error.message : "Auto backup failed",
      );
    } finally {
      if (kind === "contacts") setIsRunningAutoContacts(false);
      else setIsRunningAutoFull(false);
    }
  };

  const loadMenuAppearance = useCallback(async () => {
    setMenuAppearanceLoading(true);
    try {
      const res = await fetch("/api/menu-appearance");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load menu style");
      if (data.settings) setMenuAppearance(data.settings);
    } catch (error) {
      console.error("Failed to load menu appearance", error);
      showToast("Failed to load menu style");
    } finally {
      setMenuAppearanceLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "menu") void loadMenuAppearance();
  }, [tab, loadMenuAppearance]);

  const saveMenuAppearance = async () => {
    setIsSavingMenuAppearance(true);
    try {
      const res = await fetch("/api/menu-appearance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(menuAppearance),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save menu style");
      if (data.settings) setMenuAppearance(data.settings);
      showToast("Menu style saved");
    } catch (error) {
      console.error("Failed to save menu appearance", error);
      showToast(
        error instanceof Error ? error.message : "Save menu style failed",
      );
    } finally {
      setIsSavingMenuAppearance(false);
    }
  };

  const loadDangerSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/danger");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load wipe settings");
      setWipeCodeHint(data.hint ?? "****");
    } catch (error) {
      console.error("Failed to load danger settings", error);
    }
  }, []);

  useEffect(() => {
    if (tab === "danger") void loadDangerSettings();
  }, [tab, loadDangerSettings]);

  const saveWipeCode = async () => {
    if (wipeNewCode.trim().length < 4) {
      showToast("New code must be at least 4 characters");
      return;
    }
    if (wipeNewCode.trim() !== wipeConfirmNewCode.trim()) {
      showToast("New code and confirm do not match");
      return;
    }
    setIsSavingWipeCode(true);
    try {
      const res = await fetch("/api/danger", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentCode: wipeCurrentCode,
          newCode: wipeNewCode.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to set code");
      setWipeCurrentCode("");
      setWipeNewCode("");
      setWipeConfirmNewCode("");
      showToast("Confirmation code updated");
      await loadDangerSettings();
    } catch (error) {
      console.error("Failed to set wipe code", error);
      showToast(
        error instanceof Error ? error.message : "Failed to set code",
      );
    } finally {
      setIsSavingWipeCode(false);
    }
  };

  const wipeAllData = async () => {
    if (!wipeConfirmInput.trim()) {
      showToast("Enter confirmation code to wipe data");
      return;
    }

    setIsWipingData(true);
    try {
      const res = await fetch("/api/danger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmationCode: wipeConfirmInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Wipe failed");
      setWipeConfirmInput("");
      setSavedCustomers([]);
      setDrafts({});
      showToast(
        `Wiped ${data.wiped?.customers ?? 0} contacts, ${data.wiped?.orders ?? 0} orders.`,
      );
      window.setTimeout(() => {
        window.location.reload();
      }, 600);
    } catch (error) {
      console.error("Failed to wipe data", error);
      showToast(error instanceof Error ? error.message : "Wipe failed");
    } finally {
      setIsWipingData(false);
    }
  };

  const loadReceiptSettings = useCallback(async () => {
    setReceiptLoading(true);
    try {
      const res = await fetch("/api/receipt-settings");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load receipt settings");
      setReceiptSettings(data.settings ?? { ...DEFAULT_RECEIPT_SETTINGS });
    } catch (error) {
      console.error("Failed to load receipt settings", error);
      showToast("Failed to load receipt settings");
    } finally {
      setReceiptLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "receipt" || tab === "receiptNumber") void loadReceiptSettings();
  }, [tab, loadReceiptSettings]);

  const openReportPrint = (order: DateOrderRow | LedgerEntry) => {
    const items: CartItem[] = (order.items || []).map((item) => ({
      id: String(item.id ?? item.name),
      name: item.name,
      description: item.name,
      basePrice: Number(item.price ?? 0),
      image: "deals.png",
      category: item.category ?? "",
      selectedSize: item.selectedSize,
      selectedTopping: item.selectedTopping,
      selectedSauce: item.selectedSauce,
      cartKey:
        item.cartKey ??
        `${item.name}-${item.selectedSize ?? ""}-${item.selectedTopping ?? ""}-${item.selectedSauce ?? ""}`,
      quantity: item.quantity ?? 1,
      price: Number(item.price ?? 0),
    }));
    const placedAt =
      ("createdAt" in order ? order.createdAt : null) ||
      order.soldAt ||
      null;
    setPrintOrder({
      id: order.orderCode,
      items,
      total: order.total,
      notes: order.notes ?? "",
      instructions: order.instructions ?? "",
      customer: {
        name: order.customerName,
        phone: order.customerPhone ?? "",
      },
      orderType: order.orderType,
      tableNumber: order.tableNumber,
      placedAt,
    });
    setPrintModalOpen(true);
  };

  const filteredCustomers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return savedCustomers;
    return savedCustomers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q),
    );
  }, [savedCustomers, query]);

  const categoryOptions = useMemo(() => {
    const customNames = categories.map((c) => c.name);
    const fromProducts = catalogProducts.map((p) => p.category);
    return Array.from(
      new Set([...BUILTIN_CATEGORIES, ...customNames, ...fromProducts]),
    ).sort((a, b) => a.localeCompare(b));
  }, [categories, catalogProducts]);

  const lowStockCount = useMemo(() => {
    return catalogProducts.filter(
      (p) => p.stock != null && p.stock <= lowStockThreshold && p.stock > 0,
    ).length;
  }, [catalogProducts, lowStockThreshold]);

  const outOfStockCount = useMemo(() => {
    return catalogProducts.filter((p) => p.stock === 0).length;
  }, [catalogProducts]);

  const inStockCount = useMemo(() => {
    return catalogProducts.filter((p) => p.stock != null && p.stock > lowStockThreshold).length;
  }, [catalogProducts, lowStockThreshold]);

  const unlimitedStockCount = useMemo(() => {
    return catalogProducts.filter((p) => p.stock == null).length;
  }, [catalogProducts]);

  const jumpToFilteredCatalog = useCallback(
    (filter: "all" | "low" | "out" | "in") => {
      setCatalogStockFilter(filter);
      setItemQuery("");
      window.requestAnimationFrame(() => {
        catalogItemsRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    },
    [],
  );

  const filteredCatalogProducts = useMemo(() => {
    let list = catalogProducts;
    if (catalogStockFilter === "low") {
      list = list.filter(
        (p) => p.stock != null && p.stock <= lowStockThreshold && p.stock > 0,
      );
    } else if (catalogStockFilter === "out") {
      list = list.filter((p) => p.stock === 0);
    } else if (catalogStockFilter === "in") {
      list = list.filter((p) => p.stock != null && p.stock > lowStockThreshold);
    }

    const q = itemQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.description || "").toLowerCase().includes(q) ||
        (p.sku || "").toLowerCase().includes(q) ||
        (p.barcode || "").toLowerCase().includes(q),
    );
  }, [catalogProducts, itemQuery, catalogStockFilter, lowStockThreshold]);

  const sortedCatalogProductsForSelect = useMemo(() => {
    return [...catalogProducts].sort((a, b) => a.name.localeCompare(b.name));
  }, [catalogProducts]);

  const inventorySummary = useMemo(() => {
    let totalAdded = 0;
    let totalDeducted = 0;
    for (const entry of inventoryLogs) {
      if (entry.quantityChange > 0) totalAdded += entry.quantityChange;
      else if (entry.quantityChange < 0) totalDeducted += Math.abs(entry.quantityChange);
    }
    return {
      count: inventoryLogs.length,
      totalAdded,
      totalDeducted,
    };
  }, [inventoryLogs]);

  const reportCustomerOptions = useMemo(() => {
    const map = new Map<string, DayCustomerOption>();
    for (const c of dayCustomers) {
      const key = `${c.name}\t${c.phone}`;
      map.set(key, c);
    }
    for (const c of savedCustomers) {
      const name = c.name.trim() || "Walk-In Customer";
      const phone = c.phone.trim();
      const key = `${name}\t${phone}`;
      if (!map.has(key)) map.set(key, { name, phone });
    }
    return Array.from(map.entries())
      .map(([key, value]) => ({ key, ...value }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [dayCustomers, savedCustomers]);

  const ledgerCustomerOptions = useMemo(() => {
    return savedCustomers
      .map((c) => {
        const name = c.name.trim() || "Walk-In Customer";
        const phone = c.phone.trim();
        return { key: `${name}\t${phone}`, name, phone };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [savedCustomers]);

  const categoryFilterOptions = useMemo(() => {
    const set = new Set<string>([
      ...BUILTIN_CATEGORIES,
      ...categories.map((c) => c.name),
      ...reportCategories,
    ]);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [categories, reportCategories]);

  const itemReportPeriodLabel = useMemo(() => {
    if (itemReportRange === "date") return reportDate;
    if (itemReportRange === "daily") {
      return monthLabel(reportYear, reportMonth);
    }
    return String(reportYear);
  }, [itemReportRange, reportDate, reportYear, reportMonth]);

  const itemReportVariant = (item: ItemReportRow) => {
    const parts: string[] = [];
    if (item.selectedSize && item.selectedSize !== "N/A") {
      parts.push(item.selectedSize);
    }
    if (item.selectedTopping && item.selectedTopping !== "None") {
      parts.push(item.selectedTopping);
    }
    if (item.selectedSauce && item.selectedSauce !== "None") {
      parts.push(item.selectedSauce);
    }
    return parts.length > 0 ? parts.join(" · ") : null;
  };

  const printCustomerLedger = async () => {
    if (!ledgerCustomerKey) {
      showToast("Select a customer first");
      return;
    }
    const [name, phone = ""] = ledgerCustomerKey.split("\t");
    const periodLabel =
      ledgerViewMode === "daily"
        ? monthLabel(ledgerYear, ledgerMonth)
        : "All time";
    const title = `Customer Ledger · ${name}`;
    const subtitle = `${phone ? `Phone: ${phone} · ` : ""}${periodLabel} · Total ${money(ledgerTotals.totalRevenue)} · ${ledgerTotals.totalOrders} orders · ${ledgerTotals.totalItems} items`;

    let body = `
      <div class="totals">
        <span><strong>Total spent:</strong> ${escapeReportHtml(money(ledgerTotals.totalRevenue))}</span>
        <span><strong>Orders:</strong> ${ledgerTotals.totalOrders}</span>
        <span><strong>Items:</strong> ${ledgerTotals.totalItems}</span>
      </div>
    `;

    if (ledgerViewMode === "daily") {
      body += `
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th class="num">Orders</th>
              <th class="num">Items</th>
              <th class="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${
              ledgerDaily.length === 0
                ? `<tr><td colspan="4">No orders for this month.</td></tr>`
                : ledgerDaily
                    .map(
                      (row) => `<tr>
                <td>${escapeReportHtml(row.saleDate)}</td>
                <td class="num">${row.totalOrders}</td>
                <td class="num">${row.totalItems}</td>
                <td class="num">${escapeReportHtml(money(row.totalRevenue))}</td>
              </tr>`,
                    )
                    .join("")
            }
          </tbody>
        </table>
        <p class="muted" style="margin-top:16px;">Order detail</p>
      `;
    }

    body += `
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Receipt #</th>
            <th>Type</th>
            <th class="num">Amount</th>
            <th class="num">Balance</th>
          </tr>
        </thead>
        <tbody>
          ${
            ledgerEntries.length === 0
              ? `<tr><td colspan="5">No checked-out orders.</td></tr>`
              : ledgerEntries
                  .map(
                    (entry) => `<tr>
              <td>${escapeReportHtml(entry.businessDate)}</td>
              <td>${escapeReportHtml(entry.orderCode)}<div class="muted">${entry.itemCount} item${entry.itemCount === 1 ? "" : "s"}</div></td>
              <td>${escapeReportHtml(
                entry.orderType +
                  (entry.tableNumber != null ? ` #${entry.tableNumber}` : ""),
              )}</td>
              <td class="num">${escapeReportHtml(money(entry.total))}</td>
              <td class="num">${escapeReportHtml(money(entry.balance))}</td>
            </tr>`,
                  )
                  .join("")
          }
        </tbody>
      </table>
    `;

    await printReportHtml(reportPrintShell(title, subtitle, body));
  };

  const printSalesOrItemReport = async () => {
    const isItems = reportMode === "items";
    const title = isItems ? "Item Report" : "Sales Report";
    const subtitle = isItems
      ? `Item report · ${itemReportPeriodLabel}${
          reportCategory !== "all" ? ` · ${reportCategory}` : " · All categories"
        }${
          reportCustomerKey !== "all"
            ? ` · ${reportCustomerKey.split("\t")[0]}`
            : " · All customers"
        }`
      : reportMode === "date"
        ? `Report for ${reportDate}`
        : reportMode === "daily"
          ? `Day-by-day · ${monthLabel(reportYear, reportMonth)}`
          : `Monthly · ${reportYear}`;

    let body = `
      <div class="totals">
        <span><strong>Revenue:</strong> ${escapeReportHtml(money(reportTotals.totalRevenue))}</span>
        <span><strong>Orders:</strong> ${reportTotals.totalOrders}</span>
        <span><strong>Items:</strong> ${reportTotals.totalItems}</span>
      </div>
    `;

    if (isItems) {
      body += `
        <table>
          <thead>
            <tr>
              ${itemReportRange !== "date" ? "<th>Period</th>" : ""}
              <th>Item</th>
              <th>Category</th>
              <th class="num">Qty</th>
              <th class="num">Revenue</th>
            </tr>
          </thead>
          <tbody>
            ${
              itemReportRows.length === 0
                ? `<tr><td colspan="5">No items sold for this period.</td></tr>`
                : itemReportRows
                    .map((item) => {
                      const variant = itemReportVariant(item);
                      return `<tr>
                ${
                  itemReportRange !== "date"
                    ? `<td>${escapeReportHtml(item.period || "")}</td>`
                    : ""
                }
                <td>${escapeReportHtml(item.name)}${
                  variant
                    ? `<div class="muted">${escapeReportHtml(variant)}</div>`
                    : ""
                }</td>
                <td>${escapeReportHtml(item.category || "—")}</td>
                <td class="num">${item.quantitySold}</td>
                <td class="num">${escapeReportHtml(money(item.revenue))}</td>
              </tr>`;
                    })
                    .join("")
            }
          </tbody>
        </table>
      `;
    } else if (reportMode === "monthly") {
      body += `
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th class="num">Revenue</th>
              <th class="num">Orders</th>
              <th class="num">Items</th>
            </tr>
          </thead>
          <tbody>
            ${
              monthlyRows.length === 0
                ? `<tr><td colspan="4">No monthly sales for this year.</td></tr>`
                : monthlyRows
                    .map(
                      (row) => `<tr>
                <td>${escapeReportHtml(row.period)}</td>
                <td class="num">${escapeReportHtml(money(row.totalRevenue))}</td>
                <td class="num">${row.totalOrders}</td>
                <td class="num">${row.totalItems}</td>
              </tr>`,
                    )
                    .join("")
            }
          </tbody>
        </table>
      `;
    } else {
      body += `
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th class="num">Revenue</th>
              <th class="num">Orders</th>
              <th class="num">Items</th>
            </tr>
          </thead>
          <tbody>
            ${
              dailyRows.length === 0
                ? `<tr><td colspan="4">No sales for this period.</td></tr>`
                : dailyRows
                    .map(
                      (row) => `<tr>
                <td>${escapeReportHtml(row.saleDate)}</td>
                <td class="num">${escapeReportHtml(money(row.totalRevenue))}</td>
                <td class="num">${row.totalOrders}</td>
                <td class="num">${row.totalItems}</td>
              </tr>`,
                    )
                    .join("")
            }
          </tbody>
        </table>
      `;

      if (reportMode === "date" && dateOrders.length > 0) {
        body += `
          <p class="muted" style="margin-top:16px;">Orders on ${escapeReportHtml(reportDate)}</p>
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Type</th>
                <th class="num">Items</th>
                <th class="num">Total</th>
              </tr>
            </thead>
            <tbody>
              ${dateOrders
                .map(
                  (order) => `<tr>
                <td>${escapeReportHtml(order.orderCode)}</td>
                <td>${escapeReportHtml(order.customerName)}${
                  order.customerPhone
                    ? `<div class="muted">${escapeReportHtml(order.customerPhone)}</div>`
                    : ""
                }</td>
                <td>${escapeReportHtml(
                  order.orderType +
                    (order.tableNumber != null ? ` #${order.tableNumber}` : ""),
                )}</td>
                <td class="num">${order.itemCount}</td>
                <td class="num">${escapeReportHtml(money(order.total))}</td>
              </tr>`,
                )
                .join("")}
            </tbody>
          </table>
        `;
      }
    }

    await printReportHtml(reportPrintShell(title, subtitle, body));
  };

  const updateDraft = (id: number, field: "name" | "phone", value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  const isDirty = (customer: Customer) => {
    const draft = drafts[customer.id];
    if (!draft) return false;
    return (
      draft.name.trim() !== customer.name.trim() ||
      draft.phone.trim() !== customer.phone.trim()
    );
  };

  const saveCustomer = async (customer: Customer) => {
    const draft = drafts[customer.id];
    if (!draft?.name.trim()) {
      showToast("Name is required");
      return;
    }

    setSavingId(customer.id);
    try {
      const res = await fetch("/api/customers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: customer.id,
          name: draft.name.trim(),
          phone: draft.phone.trim(),
        }),
      });

      if (!res.ok) {
        const errorData = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(errorData.error ?? "Failed to update customer");
      }

      const data = await res.json();
      const updated: Customer = data.customer;
      setSavedCustomers((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c)),
      );
      setDrafts((prev) => ({
        ...prev,
        [updated.id]: { name: updated.name, phone: updated.phone },
      }));
      showToast("Contact saved");
    } catch (error) {
      console.error("Failed to update customer", error);
      showToast("Save failed");
    } finally {
      setSavingId(null);
    }
  };

  const executeDeleteCustomer = async (customer: Customer) => {
    setDeletingId(customer.id);
    try {
      const res = await fetch(`/api/customers?id=${customer.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errorData = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(errorData.error ?? "Failed to delete customer");
      }

      setSavedCustomers((prev) => prev.filter((c) => c.id !== customer.id));
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[customer.id];
        return next;
      });
      showToast("Contact deleted");
    } catch (error) {
      console.error("Failed to delete customer", error);
      showToast("Delete failed");
    } finally {
      setDeletingId(null);
      setPendingDelete(null);
    }
  };

  const deleteCustomer = (customer: Customer) => {
    setPendingDelete({
      type: "customer",
      target: customer,
      title: "Delete Contact",
      description: `Delete contact "${customer.name}"${customer.phone ? ` (${customer.phone})` : ""}?`,
    });
  };

  const backupAllData = async () => {
    setIsBackingUp(true);
    try {
      const res = await fetch("/api/backup");
      if (!res.ok) throw new Error("Backup failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      anchor.href = url;
      anchor.download = `pos-backup-${stamp}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      showToast("Backup downloaded");
    } catch (error) {
      console.error("Failed to backup data", error);
      showToast("Backup failed");
    } finally {
      setIsBackingUp(false);
    }
  };

  const backupContacts = async () => {
    setIsBackingUpContacts(true);
    try {
      const res = await fetch("/api/customers/backup");
      if (!res.ok) throw new Error("Contacts backup failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      anchor.href = url;
      anchor.download = `pos-contacts-backup-${stamp}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      showToast("Contacts backup downloaded");
    } catch (error) {
      console.error("Failed to backup contacts", error);
      showToast("Contacts backup failed");
    } finally {
      setIsBackingUpContacts(false);
    }
  };

  const executeRestoreContacts = async (file: File) => {
    setIsRestoringContacts(true);
    try {
      const text = await file.text();
      const payload = JSON.parse(text) as unknown;
      const res = await fetch("/api/customers/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Contacts restore failed");
      await loadCustomers();
      showToast("Contacts restored successfully");
    } catch (error) {
      console.error("Failed to restore contacts backup", error);
      showToast(error instanceof Error ? error.message : "Contacts restore failed");
    } finally {
      setIsRestoringContacts(false);
      setPendingRestore(null);
      if (contactsRestoreInputRef.current) contactsRestoreInputRef.current.value = "";
    }
  };

  const executeRestoreFull = async (file: File) => {
    setIsRestoring(true);
    try {
      const text = await file.text();
      const payload = JSON.parse(text) as unknown;
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Restore failed");
      await loadCustomers();
      await loadCatalog();
      showToast("Data restored successfully");
    } catch (error) {
      console.error("Failed to restore backup", error);
      showToast(error instanceof Error ? error.message : "Restore failed");
    } finally {
      setIsRestoring(false);
      setPendingRestore(null);
      if (restoreInputRef.current) restoreInputRef.current.value = "";
    }
  };

  const restoreContactsFromBackup = (file: File) => {
    setPendingRestore({
      type: "contacts",
      file,
      filename: file.name,
    });
  };

  const restoreFromBackup = (file: File) => {
    setPendingRestore({
      type: "full",
      file,
      filename: file.name,
    });
  };

  const startEditShortcut = (action: ShortcutAction) => {
    const config = shortcuts[action] || DEFAULT_SHORTCUTS[action];
    setTempKeyCombo({
      key: config.key,
      altKey: config.altKey,
      ctrlKey: config.ctrlKey,
    });
    setEditingShortcutAction(action);
  };

  const saveCurrentShortcut = () => {
    if (!editingShortcutAction) return;
    const current =
      shortcuts[editingShortcutAction] || DEFAULT_SHORTCUTS[editingShortcutAction];
    const key = tempKeyCombo.key.trim().toLowerCase();
    if (!key) {
      showToast("Key cannot be empty");
      return;
    }
    const label = formatKeyCombo(key, tempKeyCombo.altKey, tempKeyCombo.ctrlKey);
    const updated: ShortcutsMap = {
      ...shortcuts,
      [editingShortcutAction]: {
        ...current,
        key,
        altKey: tempKeyCombo.altKey,
        ctrlKey: tempKeyCombo.ctrlKey,
        label,
      },
    };
    saveShortcuts(updated);
    setShortcuts(updated);
    setEditingShortcutAction(null);
    showToast(`Shortcut updated: ${label}`);
  };

  const handleResetShortcuts = () => {
    const def = resetShortcuts();
    setShortcuts(def);
    setEditingShortcutAction(null);
    showToast("Keyboard shortcuts reset to defaults");
  };

  const addCustomer = async () => {
    if (!newContact.name.trim()) {
      showToast("Name is required");
      return;
    }

    setIsAdding(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newContact.name.trim(),
          phone: newContact.phone.trim(),
        }),
      });

      if (!res.ok) {
        const errorData = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(errorData.error ?? "Failed to add customer");
      }

      const data = await res.json();
      const created: Customer = data.customer;
      setSavedCustomers((prev) => [created, ...prev]);
      setDrafts((prev) => ({
        ...prev,
        [created.id]: { name: created.name, phone: created.phone },
      }));
      setNewContact({ name: "", phone: "" });
      showToast("Contact added");
    } catch (error) {
      console.error("Failed to add customer", error);
      showToast("Add failed");
    } finally {
      setIsAdding(false);
    }
  };

  const resetCategoryForm = () => {
    setNewCategoryName("");
    setNewCategoryEmoji("📦");
    setNewCategoryImage(DEFAULT_IMAGE);
    setEditingCategoryId(null);
    setOriginalCategoryImage(null);
    if (categoryImageInputRef.current) categoryImageInputRef.current.value = "";
  };

  const startEditCategory = (category: CustomCategory) => {
    setEditingCategoryId(category.id);
    setNewCategoryName(category.name);
    setNewCategoryEmoji(category.emoji || "📦");
    setNewCategoryImage(category.image || DEFAULT_IMAGE);
    setOriginalCategoryImage(category.image || DEFAULT_IMAGE);
    if (categoryImageInputRef.current) categoryImageInputRef.current.value = "";
    window.setTimeout(() => {
      categoryFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const uploadCategoryImage = async (file: File) => {
    setIsUploadingCategoryImage(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/catalog/upload", {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Upload failed");

      const previous = newCategoryImage;
      setNewCategoryImage(data.image as string);

      if (
        isUploadedImage(previous) &&
        previous !== originalCategoryImage &&
        previous !== data.image
      ) {
        await deleteUploadedImage(previous);
      }

      showToast("Category picture uploaded");
    } catch (error) {
      console.error("Failed to upload category image", error);
      showToast(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setIsUploadingCategoryImage(false);
      if (categoryImageInputRef.current) categoryImageInputRef.current.value = "";
    }
  };

  const changeCategoryPicture = async (
    category: CustomCategory,
    file: File,
  ) => {
    setChangingPictureCategoryId(category.id);
    try {
      const form = new FormData();
      form.append("file", file);
      const uploadRes = await fetch("/api/catalog/upload", {
        method: "POST",
        body: form,
      });
      const uploadData = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok) {
        throw new Error(uploadData.error ?? "Upload failed");
      }

      const newImage = uploadData.image as string;
      const res = await fetch("/api/catalog/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: category.id,
          image: newImage,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to update picture");

      setCategories((prev) =>
        prev.map((c) => (c.id === category.id ? data.category : c)),
      );
      if (editingCategoryId === category.id) {
        setNewCategoryImage(newImage);
        setOriginalCategoryImage(newImage);
      }
      if (
        isUploadedImage(category.image) &&
        category.image !== newImage
      ) {
        await deleteUploadedImage(category.image);
      }
      showToast("Category picture updated");
    } catch (error) {
      console.error("Failed to change category picture", error);
      showToast(
        error instanceof Error ? error.message : "Change picture failed",
      );
    } finally {
      setChangingPictureCategoryId(null);
      if (categoryRowImageInputRef.current) {
        categoryRowImageInputRef.current.value = "";
      }
      categoryPictureTargetRef.current = null;
    }
  };

  const removeCategoryPicture = async () => {
    const current = newCategoryImage;
    setNewCategoryImage(DEFAULT_IMAGE);
    if (
      isUploadedImage(current) &&
      current !== originalCategoryImage
    ) {
      await deleteUploadedImage(current);
    }
    if (categoryImageInputRef.current) categoryImageInputRef.current.value = "";
  };

  const clearCategoryPicture = async (category: CustomCategory) => {
    if (category.image === DEFAULT_IMAGE) return;
    setChangingPictureCategoryId(category.id);
    try {
      const res = await fetch("/api/catalog/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: category.id,
          image: DEFAULT_IMAGE,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to remove picture");

      setCategories((prev) =>
        prev.map((c) => (c.id === category.id ? data.category : c)),
      );
      if (editingCategoryId === category.id) {
        setNewCategoryImage(DEFAULT_IMAGE);
        setOriginalCategoryImage(DEFAULT_IMAGE);
      }
      if (isUploadedImage(category.image)) {
        await deleteUploadedImage(category.image);
      }
      showToast("Category picture removed");
    } catch (error) {
      console.error("Failed to remove category picture", error);
      showToast("Remove picture failed");
    } finally {
      setChangingPictureCategoryId(null);
    }
  };

  const saveCategory = async () => {
    if (!newCategoryName.trim()) {
      showToast("Category name is required");
      return;
    }

    if (editingCategoryId) {
      setIsSavingCategory(true);
      try {
        const res = await fetch("/api/catalog/categories", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingCategoryId,
            name: newCategoryName.trim(),
            label: newCategoryName.trim(),
            emoji: newCategoryEmoji.trim() || "📦",
            image: newCategoryImage.trim() || DEFAULT_IMAGE,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Failed to update category");

        setCategories((prev) =>
          prev.map((c) => (c.id === editingCategoryId ? data.category : c)),
        );
        if (
          originalCategoryImage &&
          isUploadedImage(originalCategoryImage) &&
          originalCategoryImage !== data.category.image
        ) {
          await deleteUploadedImage(originalCategoryImage);
        }
        // Refresh products in case category was renamed
        void loadCatalog();
        resetCategoryForm();
        showToast("Category updated");
      } catch (error) {
        console.error("Failed to update category", error);
        showToast(
          error instanceof Error ? error.message : "Update category failed",
        );
      } finally {
        setIsSavingCategory(false);
      }
      return;
    }

    setIsAddingCategory(true);
    try {
      const res = await fetch("/api/catalog/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCategoryName.trim(),
          label: newCategoryName.trim(),
          emoji: newCategoryEmoji.trim() || "📦",
          image: newCategoryImage.trim() || DEFAULT_IMAGE,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to add category");

      setCategories((prev) => [data.category, ...prev]);
      setNewItem((prev) => ({ ...prev, category: data.category.name }));
      resetCategoryForm();
      showToast("Category added");
    } catch (error) {
      console.error("Failed to add category", error);
      showToast(error instanceof Error ? error.message : "Add category failed");
    } finally {
      setIsAddingCategory(false);
    }
  };

  const executeDeleteCategory = async (category: CustomCategory) => {
    setDeletingCategoryId(category.id);
    try {
      const res = await fetch(`/api/catalog/categories?id=${category.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to delete category");
      setCategories((prev) => prev.filter((c) => c.id !== category.id));
      if (isUploadedImage(data.image || category.image)) {
        await deleteUploadedImage(data.image || category.image);
      }
      if (editingCategoryId === category.id) resetCategoryForm();
      showToast("Category deleted");
    } catch (error) {
      console.error("Failed to delete category", error);
      showToast("Delete category failed");
    } finally {
      setDeletingCategoryId(null);
      setPendingDelete(null);
    }
  };

  const deleteCategory = (category: CustomCategory) => {
    setPendingDelete({
      type: "category",
      target: category,
      title: "Delete Category",
      description: `Delete category "${category.name}"? Products in this category will keep their items.`,
    });
  };

  const saveReceiptSettings = async () => {
    setIsSavingReceipt(true);
    try {
      const res = await fetch("/api/receipt-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeName: receiptSettings.storeName,
          storeAddress: receiptSettings.storeAddress,
          storePhones: receiptSettings.storePhones,
          logoImage: receiptSettings.logoImage,
          paymentTitle: receiptSettings.paymentTitle,
          paymentImage: receiptSettings.paymentImage,
          paymentLine: receiptSettings.paymentLine,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to save receipt settings");
      setReceiptSettings(data.settings ?? receiptSettings);
      clearReceiptSettingsCache();
      showToast("Receipt settings saved");
    } catch (error) {
      console.error("Failed to save receipt settings", error);
      showToast(
        error instanceof Error ? error.message : "Save receipt settings failed",
      );
    } finally {
      setIsSavingReceipt(false);
    }
  };

  const saveReceiptNumberSettings = async () => {
    const prefix = receiptSettings.receiptPrefix?.trim() || "TBT";
    const nextNum = Number(receiptSettings.receiptNextNumber);
    if (!Number.isFinite(nextNum) || nextNum < 1) {
      showToast("Next receipt number must be 1 or higher");
      return;
    }
    setIsSavingReceiptNumber(true);
    try {
      const res = await fetch("/api/receipt-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiptPrefix: prefix,
          receiptNextNumber: Math.floor(nextNum),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to save receipt number settings");
      }
      setReceiptSettings(data.settings ?? receiptSettings);
      clearReceiptSettingsCache();
      window.dispatchEvent(new Event("receipt-number-settings-changed"));
      showToast("Receipt number settings saved");
    } catch (error) {
      console.error("Failed to save receipt number settings", error);
      showToast(
        error instanceof Error
          ? error.message
          : "Save receipt number settings failed",
      );
    } finally {
      setIsSavingReceiptNumber(false);
    }
  };

  const uploadReceiptImage = async (
    file: File,
    field: "logoImage" | "paymentImage",
  ) => {
    const setUploading =
      field === "logoImage"
        ? setIsUploadingReceiptLogo
        : setIsUploadingPaymentImage;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/catalog/upload", {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Upload failed");

      const previous = receiptSettings[field];
      setReceiptSettings((prev) => ({
        ...prev,
        [field]: data.image as string,
      }));
      if (isUploadedImage(previous) && previous !== data.image) {
        await deleteUploadedImage(previous);
      }
      showToast(field === "logoImage" ? "Logo uploaded" : "Payment image uploaded");
    } catch (error) {
      console.error("Failed to upload receipt image", error);
      showToast(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const resetItemForm = () => {
    setNewItem(emptyItemForm);
    setEditingProductId(null);
    setOriginalEditImage(null);
    if (itemImageInputRef.current) itemImageInputRef.current.value = "";
  };

  const uploadItemImage = async (file: File) => {
    setIsUploadingImage(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/catalog/upload", {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Upload failed");

      const previous = newItem.image;
      setNewItem((prev) => ({ ...prev, image: data.image as string }));

      // Clean up previous uploaded image that is not the original being edited
      if (
        isUploadedImage(previous) &&
        previous !== originalEditImage &&
        previous !== data.image
      ) {
        await deleteUploadedImage(previous);
      }

      showToast("Picture uploaded");
    } catch (error) {
      console.error("Failed to upload image", error);
      showToast(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setIsUploadingImage(false);
      if (itemImageInputRef.current) itemImageInputRef.current.value = "";
    }
  };

  const removeItemPicture = async () => {
    const current = newItem.image;
    if (current === DEFAULT_IMAGE) return;

    setNewItem((prev) => ({ ...prev, image: DEFAULT_IMAGE }));

    if (isUploadedImage(current) && current !== originalEditImage) {
      await deleteUploadedImage(current);
    }
    showToast("Picture removed");
  };

  const startEditProduct = (product: CatalogProduct) => {
    setEditingProductId(product.id);
    setOriginalEditImage(product.image || DEFAULT_IMAGE);
    const sizes = product.sizePrices || {};
    setNewItem({
      name: product.name,
      category: product.category,
      basePrice: String(product.basePrice),
      description: product.description || "",
      image: product.image || DEFAULT_IMAGE,
      sku: product.sku || "",
      barcode: product.barcode || "",
      stock:
        product.stock != null && Number.isFinite(Number(product.stock))
          ? String(product.stock)
          : "",
      stockReason: "",
      priceS: sizes.S != null ? String(sizes.S) : "",
      priceM: sizes.M != null ? String(sizes.M) : "",
      priceL: sizes.L != null ? String(sizes.L) : "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveItem = async () => {
    if (!newItem.name.trim()) {
      showToast("Item name is required");
      return;
    }
    if (!newItem.category.trim()) {
      showToast("Category is required");
      return;
    }

    const isPizza = newItem.category.trim() === "Pizza";
    let sizePrices: Record<string, number> | null = null;
    let sizes: string[] | null = null;
    let price = Number(newItem.basePrice);

    if (isPizza) {
      const s = Number(newItem.priceS);
      const m = Number(newItem.priceM);
      const l = Number(newItem.priceL);
      if (
        !Number.isFinite(s) ||
        s < 0 ||
        !Number.isFinite(m) ||
        m < 0 ||
        !Number.isFinite(l) ||
        l < 0
      ) {
        showToast("Valid S / M / L pizza prices are required");
        return;
      }
      sizePrices = { S: s, M: m, L: l };
      sizes = ["S", "M", "L"];
      price = s;
    } else if (!Number.isFinite(price) || price < 0) {
      showToast("Valid price is required");
      return;
    }

    const stockRaw = newItem.stock.trim();
    let stock: number | null = null;
    if (stockRaw !== "") {
      stock = Number(stockRaw);
      if (!Number.isFinite(stock) || stock < 0) {
        showToast("Valid stock is required");
        return;
      }
      stock = Math.floor(stock);
    }

    setIsSavingItem(true);
    try {
      const existing = editingProductId
        ? catalogProducts.find((p) => p.id === editingProductId)
        : null;

      const payload = {
        name: newItem.name.trim(),
        category: newItem.category.trim(),
        basePrice: price,
        description: newItem.description.trim() || newItem.name.trim(),
        image: newItem.image.trim() || DEFAULT_IMAGE,
        sku: newItem.sku.trim(),
        barcode: newItem.barcode.trim(),
        stock,
        stockReason: newItem.stockReason.trim(),
        sizePrices: isPizza ? sizePrices : (existing?.sizePrices ?? null),
        sizes: isPizza ? sizes : (existing?.sizes ?? null),
        hasExtraToppings: isPizza
          ? (existing?.hasExtraToppings ?? true)
          : (existing?.hasExtraToppings ?? null),
        hasSauceOptions: isPizza
          ? (existing?.hasSauceOptions ?? true)
          : (existing?.hasSauceOptions ?? null),
      };

      const res = await fetch("/api/catalog/products", {
        method: editingProductId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingProductId ? { id: editingProductId, ...payload } : payload,
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to save item");

      if (editingProductId) {
        setCatalogProducts((prev) =>
          prev.map((p) =>
            p.id === editingProductId
              ? { ...data.product, source: data.product.source ?? p.source }
              : p,
          ),
        );
        if (
          originalEditImage &&
          isUploadedImage(originalEditImage) &&
          originalEditImage !== data.product.image
        ) {
          await deleteUploadedImage(originalEditImage);
        }
        showToast("Item updated");
      } else {
        setCatalogProducts((prev) => [
          { ...data.product, source: "custom" },
          ...prev,
        ]);
        showToast("Item added");
      }
      window.dispatchEvent(new Event("catalog-updated"));
      resetItemForm();
    } catch (error) {
      console.error("Failed to save item", error);
      showToast(error instanceof Error ? error.message : "Save item failed");
    } finally {
      setIsSavingItem(false);
    }
  };

  const executeDeleteProduct = async (product: CatalogProduct) => {
    setDeletingProductId(product.id);
    try {
      const res = await fetch(
        `/api/catalog/products?id=${encodeURIComponent(product.id)}`,
        { method: "DELETE" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to delete item");

      setCatalogProducts((prev) => prev.filter((p) => p.id !== product.id));
      if (
        product.source === "custom" &&
        isUploadedImage(data.image || product.image)
      ) {
        await deleteUploadedImage(data.image || product.image);
      }
      if (editingProductId === product.id) resetItemForm();
      window.dispatchEvent(new Event("catalog-updated"));
      showToast(product.source === "builtin" ? "Item removed from menu" : "Item deleted");
    } catch (error) {
      console.error("Failed to delete item", error);
      showToast("Delete item failed");
    } finally {
      setDeletingProductId(null);
      setPendingDelete(null);
    }
  };

  const submitInventoryAdjustment = async () => {
    if (!adjustProductId) {
      showToast("Select a product first");
      return;
    }
    let parsedQty: number | null = null;
    if (adjustMode === "set" && adjustQuantity.trim() === "") {
      parsedQty = null;
    } else {
      const n = Number(adjustQuantity);
      if (!Number.isFinite(n) || n < 0 || (adjustMode !== "set" && n <= 0)) {
        showToast(
          adjustMode === "set"
            ? "Enter 0 or higher (or leave blank for unlimited)"
            : "Enter a quantity greater than 0",
        );
        return;
      }
      parsedQty = Math.floor(n);
    }

    setIsAdjustingStock(true);
    try {
      const res = await fetch("/api/catalog/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: adjustProductId,
          mode: adjustMode,
          quantity: parsedQty,
          reason: adjustReason.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to adjust stock");

      const newStock = data.adjustment?.newStock ?? null;
      const productName = data.adjustment?.productName ?? "Item";
      setCatalogProducts((prev) =>
        prev.map((p) => (p.id === adjustProductId ? { ...p, stock: newStock } : p)),
      );
      window.dispatchEvent(new Event("catalog-updated"));
      setAdjustQuantity("");
      setAdjustReason("");
      showToast(
        `${productName}: stock set to ${newStock == null ? "Unlimited" : newStock}`,
      );
      await loadInventoryLogs();
    } catch (error) {
      console.error("Failed to adjust inventory", error);
      showToast(
        error instanceof Error ? error.message : "Failed to adjust stock",
      );
    } finally {
      setIsAdjustingStock(false);
    }
  };

  const openQuickAdjust = (product: CatalogProduct) => {
    setQuickAdjustProduct(product);
    setQuickAdjustMode("add");
    setQuickAdjustQty("");
    setQuickAdjustReason("Restock");
  };

  const submitQuickAdjust = async () => {
    if (!quickAdjustProduct) return;
    let parsedQty: number | null = null;
    if (quickAdjustMode === "set" && quickAdjustQty.trim() === "") {
      parsedQty = null;
    } else {
      const n = Number(quickAdjustQty);
      if (
        !Number.isFinite(n) ||
        n < 0 ||
        (quickAdjustMode !== "set" && n <= 0)
      ) {
        showToast(
          quickAdjustMode === "set"
            ? "Enter 0 or higher (or leave blank for unlimited)"
            : "Enter a quantity greater than 0",
        );
        return;
      }
      parsedQty = Math.floor(n);
    }

    setIsSavingQuickAdjust(true);
    try {
      const res = await fetch("/api/catalog/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: quickAdjustProduct.id,
          mode: quickAdjustMode,
          quantity: parsedQty,
          reason: quickAdjustReason.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to update stock");

      const newStock = data.adjustment?.newStock ?? null;
      setCatalogProducts((prev) =>
        prev.map((p) =>
          p.id === quickAdjustProduct.id ? { ...p, stock: newStock } : p,
        ),
      );
      window.dispatchEvent(new Event("catalog-updated"));
      showToast(
        `${quickAdjustProduct.name}: stock updated to ${newStock == null ? "Unlimited" : newStock}`,
      );
      setQuickAdjustProduct(null);
    } catch (error) {
      console.error("Failed to quick adjust stock", error);
      showToast(
        error instanceof Error ? error.message : "Failed to update stock",
      );
    } finally {
      setIsSavingQuickAdjust(false);
    }
  };

  const deleteProduct = (product: CatalogProduct) => {
    const label =
      product.source === "builtin"
        ? `Remove "${product.name}" from the menu?`
        : `Delete item "${product.name}"?`;
    setPendingDelete({
      type: "product",
      target: product,
      title: product.source === "builtin" ? "Remove Menu Item" : "Delete Item",
      description: label,
    });
  };

  const yearOptions = useMemo(() => {
    const y = now.getFullYear();
    return [y, y - 1, y - 2, y - 3];
  }, [now]);

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg">
          {toast}
        </div>
      )}

      {printOrder && (
        <PrintModal
          isOpen={printModalOpen}
          onClose={() => {
            setPrintModalOpen(false);
            setPrintOrder(null);
          }}
          cartItems={printOrder.items}
          totalPrice={printOrder.total}
          notes={printOrder.notes}
          instructions={printOrder.instructions}
          orderId={printOrder.id}
          isPaid={true}
          customer={printOrder.customer}
          orderType={printOrder.orderType}
          tableNumber={printOrder.tableNumber}
          placedAt={printOrder.placedAt}
        />
      )}



      {pendingRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-200 animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-amber-50/70">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">⚠️</span>
                <h3 className="text-base font-bold text-amber-950">
                  {pendingRestore.type === "contacts"
                    ? "Restore Contacts"
                    : "Restore Full Database"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPendingRestore(null);
                  if (restoreInputRef.current) restoreInputRef.current.value = "";
                  if (contactsRestoreInputRef.current)
                    contactsRestoreInputRef.current.value = "";
                }}
                disabled={isRestoring || isRestoringContacts}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Selected File</p>
                <p className="text-sm font-mono font-bold text-gray-900 break-all">
                  {pendingRestore.filename}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Size: {(pendingRestore.file.size / 1024).toFixed(1)} KB
                </p>
              </div>

              <div
                className={`p-3.5 rounded-xl text-xs leading-relaxed border ${
                  pendingRestore.type === "full"
                    ? "bg-red-50 border-red-200 text-red-900 font-medium"
                    : "bg-amber-50 border-amber-200 text-amber-900"
                }`}
              >
                {pendingRestore.type === "contacts" ? (
                  <p>
                    <strong>Warning:</strong> Restoring contacts will replace ALL saved customer contacts with the records in this backup file. Orders and sales data will remain unchanged.
                  </p>
                ) : (
                  <p>
                    <strong>CRITICAL WARNING:</strong> Restoring will replace ALL current orders, customer contacts, and sales data with the records from this backup file.
                  </p>
                )}
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setPendingRestore(null);
                  if (restoreInputRef.current) restoreInputRef.current.value = "";
                  if (contactsRestoreInputRef.current)
                    contactsRestoreInputRef.current.value = "";
                }}
                disabled={isRestoring || isRestoringContacts}
                className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (pendingRestore.type === "contacts") {
                    void executeRestoreContacts(pendingRestore.file);
                  } else {
                    void executeRestoreFull(pendingRestore.file);
                  }
                }}
                disabled={isRestoring || isRestoringContacts}
                className={`px-4 py-2 rounded-xl text-white text-sm font-bold shadow-sm transition-colors disabled:opacity-50 ${
                  pendingRestore.type === "full"
                    ? "bg-red-700 hover:bg-red-800"
                    : "bg-green-700 hover:bg-green-800"
                }`}
              >
                {isRestoring || isRestoringContacts
                  ? "Restoring..."
                  : "Confirm & Restore"}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-200 animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-red-50/70">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">🗑️</span>
                <h3 className="text-base font-bold text-red-950">
                  {pendingDelete.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <div className="p-5">
              <p className="text-sm text-gray-700 leading-relaxed">
                {pendingDelete.description}
              </p>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (pendingDelete.type === "customer") {
                    void executeDeleteCustomer(pendingDelete.target);
                  } else if (pendingDelete.type === "category") {
                    void executeDeleteCategory(pendingDelete.target);
                  } else if (pendingDelete.type === "product") {
                    void executeDeleteProduct(pendingDelete.target);
                  }
                }}
                disabled={
                  deletingId != null ||
                  deletingCategoryId != null ||
                  deletingProductId != null
                }
                className="px-4 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white text-sm font-bold shadow-sm transition-colors disabled:opacity-50"
              >
                {deletingId != null ||
                deletingCategoryId != null ||
                deletingProductId != null
                  ? "Deleting..."
                  : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {quickAdjustProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-200">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2.5 min-w-0">
                <SlidersHorizontal className="w-4 h-4 text-gray-700 shrink-0" />
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-gray-900 truncate">
                    Adjust Stock: {quickAdjustProduct.name}
                  </h3>
                  <p className="text-xs text-gray-500 font-mono">
                    Current:{" "}
                    {quickAdjustProduct.stock == null
                      ? "Unlimited"
                      : `${quickAdjustProduct.stock} units`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuickAdjustProduct(null)}
                disabled={isSavingQuickAdjust}
                aria-label="Close stock adjustment"
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: "add", label: "Add (+)" },
                    { id: "subtract", label: "Deduct (-)" },
                    { id: "set", label: "Set Exact" },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setQuickAdjustMode(m.id);
                      if (
                        m.id === "add" &&
                        (!quickAdjustReason || quickAdjustReason === "Stock deduction")
                      ) {
                        setQuickAdjustReason("Restock");
                      } else if (
                        m.id === "subtract" &&
                        (!quickAdjustReason || quickAdjustReason === "Restock")
                      ) {
                        setQuickAdjustReason("Stock deduction");
                      } else if (m.id === "set" && quickAdjustReason === "Restock") {
                        setQuickAdjustReason("Stock count correction");
                      }
                    }}
                    className={`py-2 px-2 rounded-lg text-xs font-semibold border transition-colors ${
                      quickAdjustMode === m.id
                        ? "bg-gray-900 text-white border-gray-900"
                        : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  {quickAdjustMode === "set"
                    ? "Exact Stock Quantity (leave blank for Unlimited)"
                    : quickAdjustMode === "add"
                      ? "Quantity to Add"
                      : "Quantity to Deduct"}
                </label>
                <input
                  type="number"
                  min={quickAdjustMode === "set" ? "0" : "1"}
                  step="1"
                  value={quickAdjustQty}
                  onChange={(e) => setQuickAdjustQty(e.target.value)}
                  placeholder={
                    quickAdjustMode === "set"
                      ? "Blank = Unlimited stock"
                      : "Enter quantity"
                  }
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Reason
                </label>
                <input
                  type="text"
                  value={quickAdjustReason}
                  onChange={(e) => setQuickAdjustReason(e.target.value)}
                  placeholder="e.g. Restock, Supplier delivery, Damaged"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {INVENTORY_REASON_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setQuickAdjustReason(preset)}
                      className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors ${
                        quickAdjustReason === preset
                          ? "bg-blue-50 border-blue-300 text-blue-800"
                          : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setQuickAdjustProduct(null)}
                disabled={isSavingQuickAdjust}
                className="px-3.5 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitQuickAdjust()}
                disabled={isSavingQuickAdjust}
                className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-50"
              >
                {isSavingQuickAdjust ? "Saving..." : "Apply Stock Change"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="sticky top-0 z-30 bg-[#f0f2f5]">
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">⚙️ Settings</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 rounded-xl bg-[#1a3a5c] text-white text-sm font-semibold hover:bg-[#1565c0] transition-colors"
          >
            Menu
          </button>
          <button
            onClick={() => router.push("/Orders")}
            className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 transition-colors flex items-center gap-2"
          >
            <span>Orders</span>
            {savedOrders.length > 0 && (
              <span
                aria-label={`${savedOrders.length} saved orders`}
                className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-amber-500 text-gray-950 font-mono text-xs font-bold leading-none tabular-nums"
              >
                {savedOrders.length}
              </span>
            )}
          </button>
          <button
            onClick={() => router.push("/History")}
            className="px-4 py-2 rounded-xl bg-[#1a5c2a] text-white text-sm font-semibold hover:bg-green-700 transition-colors"
          >
            History
          </button>
        </div>
      </div>

      <div className="px-6 pt-4 pb-2 bg-[#f0f2f5] border-b border-gray-100">
        <div className="flex flex-wrap gap-2 mb-4">
          {(
            [
              { id: "contacts", label: "Contacts" },
              { id: "catalog", label: "Catalog" },
              { id: "inventory", label: "Inventory Log" },
              { id: "shortcuts", label: "⌨️ Shortcuts" },
              { id: "menu", label: "Menu Style" },
              { id: "reports", label: "Reports" },
              { id: "ledger", label: "Customer Ledger" },
              { id: "receipt", label: "Receipt Settings" },
              { id: "receiptNumber", label: "Receipt Number" },
              { id: "backup", label: "Full Backup" },
              { id: "danger", label: "Remove All Data" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                tab === t.id
                  ? t.id === "danger"
                    ? "bg-red-700 text-white"
                    : "bg-gray-900 text-white"
                  : t.id === "danger"
                    ? "bg-red-50 text-red-800 border border-red-200 hover:bg-red-100"
                    : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      </div>

      <div
        className={`p-6 pt-4 ${
          tab === "catalog" || tab === "inventory" ? "max-w-5xl" : "max-w-4xl"
        }`}
      >
        {tab === "contacts" && (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Contacts backup &amp; restore
              </p>
              <p className="text-sm text-gray-500 mb-3">
                Download or restore only your saved customer contacts. Orders and
                sales data are not included.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={backupContacts}
                  disabled={
                    isBackingUpContacts ||
                    isRestoringContacts ||
                    isBackingUp ||
                    isRestoring
                  }
                  className="px-4 py-2 rounded-lg bg-green-700 text-white text-sm font-semibold hover:bg-green-800 disabled:opacity-50 transition-colors"
                >
                  {isBackingUpContacts ? "Backing up..." : "Backup Contacts"}
                </button>
                <button
                  onClick={() => contactsRestoreInputRef.current?.click()}
                  disabled={
                    isBackingUpContacts ||
                    isRestoringContacts ||
                    isBackingUp ||
                    isRestoring
                  }
                  className="px-4 py-2 rounded-lg bg-green-50 text-green-900 text-sm font-semibold hover:bg-green-100 disabled:opacity-50 transition-colors"
                >
                  {isRestoringContacts ? "Restoring..." : "Restore Contacts"}
                </button>
                <input
                  ref={contactsRestoreInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void restoreContactsFromBackup(file);
                  }}
                />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Auto backup contacts
              </p>
              <p className="text-sm text-gray-500 mb-3">
                Automatically save contacts to the server backups folder every
                day at the time you set. Keep the POS app running.
              </p>
              {autoBackupLoading ? (
                <p className="text-sm text-gray-500">Loading auto backup...</p>
              ) : (
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm text-gray-800 font-medium">
                    <input
                      type="checkbox"
                      checked={autoBackup.contactsEnabled}
                      onChange={(e) =>
                        setAutoBackup((prev) => ({
                          ...prev,
                          contactsEnabled: e.target.checked,
                        }))
                      }
                      className="rounded border-gray-300"
                    />
                    Enable daily contacts auto backup
                  </label>
                  <div className="flex flex-wrap items-end gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Time
                      </label>
                      <input
                        type="time"
                        value={autoBackup.contactsTime}
                        onChange={(e) =>
                          setAutoBackup((prev) => ({
                            ...prev,
                            contactsTime: e.target.value,
                          }))
                        }
                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        void saveAutoBackupSettings({
                          contactsEnabled: autoBackup.contactsEnabled,
                          contactsTime: autoBackup.contactsTime,
                        })
                      }
                      disabled={isSavingAutoBackup}
                      className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-50"
                    >
                      {isSavingAutoBackup ? "Saving..." : "Save Schedule"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void runAutoBackupNow("contacts")}
                      disabled={isRunningAutoContacts}
                      className="px-4 py-2 rounded-lg bg-green-50 text-green-900 text-sm font-semibold hover:bg-green-100 disabled:opacity-50"
                    >
                      {isRunningAutoContacts ? "Running..." : "Run Now"}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">
                    Last auto:{" "}
                    {autoBackup.lastContactsAt
                      ? new Date(autoBackup.lastContactsAt).toLocaleString()
                      : "Never"}
                    {autoBackup.lastContactsFile
                      ? ` · ${autoBackup.lastContactsFile}`
                      : ""}
                  </p>
                  {autoBackupFolder && (
                    <p className="text-xs text-gray-400 break-all">
                      Folder: {autoBackupFolder}
                    </p>
                  )}
                </div>
              )}
            </div>

            <p className="text-sm text-gray-500 mb-4">
              Add, edit, or remove saved customer contacts. Changes are only saved
              when you click Save Contact.
            </p>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Add contact
              </p>
              <div className="grid grid-cols-12 gap-3 items-center">
                <div className="col-span-5">
                  <input
                    value={newContact.name}
                    onChange={(e) =>
                      setNewContact((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="Name"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div className="col-span-4">
                  <input
                    value={newContact.phone}
                    onChange={(e) =>
                      setNewContact((prev) => ({
                        ...prev,
                        phone: e.target.value,
                      }))
                    }
                    placeholder="Phone"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div className="col-span-3 flex justify-end">
                  <button
                    onClick={addCustomer}
                    disabled={isAdding}
                    className="px-3 py-2 rounded-lg bg-green-50 text-green-900 text-sm font-semibold hover:bg-green-200 disabled:opacity-50 transition-colors"
                  >
                    {isAdding ? "Saving..." : "Save Contact"}
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or phone number..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  All contacts
                </p>
                <p className="text-xs text-gray-500">
                  Total contacts:{" "}
                  <span className="font-semibold text-gray-900">
                    {savedCustomers.length}
                  </span>
                  {savedCustomers.length >= 3000
                    ? " (showing up to 3000)"
                    : ""}
                  {query.trim()
                    ? ` · Showing ${filteredCustomers.length}`
                    : ""}
                </p>
              </div>
              {loading ? (
                <div className="p-8 text-sm text-gray-500">Loading customers...</div>
              ) : filteredCustomers.length === 0 ? (
                <div className="p-8 text-sm text-gray-500">No customers found.</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  <div className="px-4 py-2 grid grid-cols-12 gap-3 text-xs font-semibold text-gray-500 uppercase">
                    <div className="col-span-1">#</div>
                    <div className="col-span-4">Name</div>
                    <div className="col-span-4">Phone</div>
                    <div className="col-span-3 text-right">Actions</div>
                  </div>
                  {filteredCustomers.map((customer, index) => {
                    const draft = drafts[customer.id] ?? {
                      name: customer.name,
                      phone: customer.phone,
                    };
                    const dirty = isDirty(customer);

                    return (
                      <div
                        key={customer.id}
                        className="p-4 grid grid-cols-12 gap-3 items-center"
                      >
                        <div className="col-span-1 text-sm font-semibold text-gray-500">
                          {index + 1}
                        </div>
                        <div className="col-span-4">
                          <input
                            value={draft.name}
                            onChange={(e) =>
                              updateDraft(customer.id, "name", e.target.value)
                            }
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          />
                        </div>
                        <div className="col-span-4">
                          <input
                            value={draft.phone}
                            onChange={(e) =>
                              updateDraft(customer.id, "phone", e.target.value)
                            }
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          />
                        </div>
                        <div className="col-span-3 flex justify-end gap-2">
                          <button
                            onClick={() => saveCustomer(customer)}
                            disabled={
                              savingId === customer.id ||
                              deletingId === customer.id ||
                              !dirty
                            }
                            className="px-3 py-2 rounded-lg bg-blue-50 text-blue-700 text-sm font-semibold hover:bg-blue-100 disabled:opacity-50 transition-colors"
                          >
                            {savingId === customer.id ? "Saving..." : "Update"}
                          </button>
                          <button
                            onClick={() => deleteCustomer(customer)}
                            disabled={
                              savingId === customer.id ||
                              deletingId === customer.id
                            }
                            className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm font-semibold hover:bg-red-100 disabled:opacity-50 transition-colors"
                          >
                            {deletingId === customer.id ? "..." : "Delete"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {tab === "catalog" && (
          <>
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-4">
              <div className="px-5 py-3.5 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Inventory Health Summary
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 tabular-nums">
                    {catalogLoading
                      ? "Loading menu stock levels..."
                      : `${catalogProducts.length} menu items · Low stock threshold ≤ ${lowStockThreshold} units`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {catalogStockFilter !== "all" && (
                    <button
                      type="button"
                      onClick={() => jumpToFilteredCatalog("all")}
                      className="text-xs font-semibold text-gray-700 hover:text-gray-900 underline underline-offset-2"
                    >
                      Reset filter
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => jumpToFilteredCatalog("all")}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors tabular-nums"
                  >
                    View All ({catalogLoading ? "--" : catalogProducts.length})
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200">
                <button
                  type="button"
                  onClick={() => jumpToFilteredCatalog("low")}
                  aria-pressed={catalogStockFilter === "low"}
                  className={`group text-left px-5 py-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500 ${
                    catalogStockFilter === "low"
                      ? "bg-amber-50/80"
                      : "hover:bg-amber-50/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${
                          lowStockCount > 0
                            ? "bg-amber-50 border-amber-200 text-amber-700"
                            : "bg-gray-50 border-gray-200 text-gray-500"
                        }`}
                      >
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-700">
                        Low Stock Items
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 group-hover:translate-x-0.5 transition-transform">
                      <span>
                        {catalogStockFilter === "low"
                          ? "Filtered below"
                          : "View filtered"}
                      </span>
                      <ArrowDownRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                  <div className="mt-3 flex items-baseline justify-between gap-3">
                    <span
                      className={`text-3xl font-bold tracking-tight tabular-nums ${
                        lowStockCount > 0 ? "text-amber-700" : "text-gray-900"
                      }`}
                    >
                      {catalogLoading ? "--" : lowStockCount}
                    </span>
                    <span className="text-xs text-gray-500 tabular-nums">
                      {lowStockThreshold > 0
                        ? `1–${lowStockThreshold} units left`
                        : "0 threshold"}
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => jumpToFilteredCatalog("out")}
                  aria-pressed={catalogStockFilter === "out"}
                  className={`group text-left px-5 py-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-600 ${
                    catalogStockFilter === "out"
                      ? "bg-red-50/80"
                      : "hover:bg-red-50/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${
                          outOfStockCount > 0
                            ? "bg-red-50 border-red-200 text-red-700"
                            : "bg-gray-50 border-gray-200 text-gray-500"
                        }`}
                      >
                        <PackageX className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-700">
                        Out of Stock Items
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 group-hover:translate-x-0.5 transition-transform">
                      <span>
                        {catalogStockFilter === "out"
                          ? "Filtered below"
                          : "View filtered"}
                      </span>
                      <ArrowDownRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                  <div className="mt-3 flex items-baseline justify-between gap-3">
                    <span
                      className={`text-3xl font-bold tracking-tight tabular-nums ${
                        outOfStockCount > 0 ? "text-red-700" : "text-gray-900"
                      }`}
                    >
                      {catalogLoading ? "--" : outOfStockCount}
                    </span>
                    <span className="text-xs text-gray-500">
                      0 units · Blocked in billing
                    </span>
                  </div>
                </button>
              </div>

              <div className="px-5 py-3 bg-gray-50/70 border-t border-gray-200 space-y-2">
                <div
                  className="h-2 w-full rounded bg-gray-200 overflow-hidden flex"
                  aria-label="Catalog stock breakdown bar"
                >
                  {!catalogLoading && catalogProducts.length > 0 && (
                    <>
                      {outOfStockCount > 0 && (
                        <div
                          style={{
                            width: `${(outOfStockCount / catalogProducts.length) * 100}%`,
                          }}
                          className="bg-red-600 h-full transition-all"
                          title={`Out of Stock: ${outOfStockCount}`}
                        />
                      )}
                      {lowStockCount > 0 && (
                        <div
                          style={{
                            width: `${(lowStockCount / catalogProducts.length) * 100}%`,
                          }}
                          className="bg-amber-500 h-full transition-all"
                          title={`Low Stock: ${lowStockCount}`}
                        />
                      )}
                      {inStockCount > 0 && (
                        <div
                          style={{
                            width: `${(inStockCount / catalogProducts.length) * 100}%`,
                          }}
                          className="bg-emerald-600 h-full transition-all"
                          title={`In Stock: ${inStockCount}`}
                        />
                      )}
                      {unlimitedStockCount > 0 && (
                        <div
                          style={{
                            width: `${(unlimitedStockCount / catalogProducts.length) * 100}%`,
                          }}
                          className="bg-gray-300 h-full transition-all"
                          title={`Unlimited Stock: ${unlimitedStockCount}`}
                        />
                      )}
                    </>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-gray-600 tabular-nums">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <button
                      type="button"
                      onClick={() => jumpToFilteredCatalog("out")}
                      className="inline-flex items-center gap-1.5 hover:text-gray-900"
                    >
                      <span className="w-2 h-2 rounded-xs bg-red-600 inline-block" />
                      <span>
                        Out of Stock: {catalogLoading ? "--" : outOfStockCount}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => jumpToFilteredCatalog("low")}
                      className="inline-flex items-center gap-1.5 hover:text-gray-900"
                    >
                      <span className="w-2 h-2 rounded-xs bg-amber-500 inline-block" />
                      <span>
                        Low Stock: {catalogLoading ? "--" : lowStockCount}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => jumpToFilteredCatalog("in")}
                      className="inline-flex items-center gap-1.5 hover:text-gray-900"
                    >
                      <span className="w-2 h-2 rounded-xs bg-emerald-600 inline-block" />
                      <span>
                        In Stock: {catalogLoading ? "--" : inStockCount}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => jumpToFilteredCatalog("all")}
                      className="inline-flex items-center gap-1.5 hover:text-gray-900"
                    >
                      <span className="w-2 h-2 rounded-xs bg-gray-400 inline-block" />
                      <span>
                        Unlimited:{" "}
                        {catalogLoading ? "--" : unlimitedStockCount}
                      </span>
                    </button>
                  </div>
                  <span className="text-[11px] text-gray-500">
                    Click any metric to filter menu items below
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="w-9 h-9 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center shrink-0">
                  <ScanBarcode className="w-5 h-5 text-gray-700" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-gray-900">
                      Barcode Search in Billing
                    </p>
                    <span
                      className={`px-2 py-0.5 rounded border text-[11px] font-semibold uppercase tracking-wide ${
                        posSettings.barcodeSearchEnabled
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : "bg-gray-100 text-gray-600 border-gray-200"
                      }`}
                    >
                      {posSettings.barcodeSearchEnabled ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    When enabled, scanning or typing a barcode into the billing search input finds and auto-adds the matching item (items with 0 stock remain blocked).
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  role="switch"
                  aria-checked={posSettings.barcodeSearchEnabled}
                  onClick={() =>
                    void toggleBarcodeSearch(!posSettings.barcodeSearchEnabled)
                  }
                  disabled={posSettingsLoading || isSavingPosSettings}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-50 ${
                    posSettings.barcodeSearchEnabled
                      ? "bg-gray-900 text-white border-gray-900 hover:bg-gray-800"
                      : "bg-white text-gray-800 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {isSavingPosSettings
                    ? "Saving..."
                    : posSettings.barcodeSearchEnabled
                      ? "Disable Barcode Search"
                      : "Enable Barcode Search"}
                </button>
              </div>
            </div>

            <div
              ref={categoryFormRef}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4"
            >
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                {editingCategoryId ? "Edit category" : "Add category"}
              </p>
              <p className="text-sm text-gray-500 mb-3">
                {editingCategoryId
                  ? "Update category name, emoji, or picture."
                  : "New categories appear on the menu grid for adding items."}
              </p>
              <div className="grid grid-cols-12 gap-3 items-center">
                <div className="col-span-12 flex flex-wrap items-center gap-3 mb-1">
                  <img
                    src={imageUrl(newCategoryImage)}
                    alt="Category"
                    className="w-16 h-16 rounded-xl object-cover border border-gray-200 bg-gray-50"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => categoryImageInputRef.current?.click()}
                      disabled={
                        isUploadingCategoryImage ||
                        isAddingCategory ||
                        isSavingCategory
                      }
                      className="px-3 py-2 rounded-lg bg-blue-50 text-blue-800 text-sm font-semibold hover:bg-blue-100 disabled:opacity-50"
                    >
                      {isUploadingCategoryImage
                        ? "Uploading..."
                        : newCategoryImage === DEFAULT_IMAGE
                          ? "Add Picture"
                          : "Change Picture"}
                    </button>
                    {newCategoryImage !== DEFAULT_IMAGE && (
                      <button
                        type="button"
                        onClick={() => void removeCategoryPicture()}
                        disabled={
                          isUploadingCategoryImage ||
                          isAddingCategory ||
                          isSavingCategory
                        }
                        className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm font-semibold hover:bg-red-100 disabled:opacity-50"
                      >
                        Delete Picture
                      </button>
                    )}
                  </div>
                  <input
                    ref={categoryImageInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadCategoryImage(file);
                    }}
                  />
                </div>
                <div className="col-span-2">
                  <input
                    value={newCategoryEmoji}
                    onChange={(e) => setNewCategoryEmoji(e.target.value)}
                    placeholder="Emoji"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div className="col-span-6">
                  <input
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Category name (e.g. Soup)"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div className="col-span-4 flex justify-end gap-2">
                  {editingCategoryId && (
                    <button
                      onClick={resetCategoryForm}
                      disabled={isSavingCategory}
                      className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 disabled:opacity-50 transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    onClick={() => void saveCategory()}
                    disabled={
                      isAddingCategory ||
                      isSavingCategory ||
                      isUploadingCategoryImage
                    }
                    className="px-3 py-2 rounded-lg bg-indigo-50 text-indigo-900 text-sm font-semibold hover:bg-indigo-100 disabled:opacity-50 transition-colors"
                  >
                    {isAddingCategory || isSavingCategory
                      ? "Saving..."
                      : editingCategoryId
                        ? "Update Category"
                        : "Add Category"}
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                {editingProductId ? "Edit item" : "Add item"}
              </p>
              <p className="text-sm text-gray-500 mb-3">
                {editingProductId
                  ? "Update item details, SKU, barcode, stock, price, category, or picture."
                  : "Add a new menu item under an existing or custom category."}
              </p>
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-12 flex flex-wrap items-center gap-3 mb-1">
                  <img
                    src={imageUrl(newItem.image)}
                    alt="Item"
                    className="w-16 h-16 rounded-xl object-cover border border-gray-200 bg-gray-50"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => itemImageInputRef.current?.click()}
                      disabled={isUploadingImage || isSavingItem}
                      className="px-3 py-2 rounded-lg bg-blue-50 text-blue-800 text-sm font-semibold hover:bg-blue-100 disabled:opacity-50"
                    >
                      {isUploadingImage
                        ? "Uploading..."
                        : newItem.image === DEFAULT_IMAGE
                          ? "Add Picture"
                          : "Change Picture"}
                    </button>
                    {newItem.image !== DEFAULT_IMAGE && (
                      <button
                        type="button"
                        onClick={() => void removeItemPicture()}
                        disabled={isUploadingImage || isSavingItem}
                        className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm font-semibold hover:bg-red-100 disabled:opacity-50"
                      >
                        Delete Picture
                      </button>
                    )}
                  </div>
                  <input
                    ref={itemImageInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadItemImage(file);
                    }}
                  />
                </div>
                <div className="col-span-4">
                  <input
                    value={newItem.name}
                    onChange={(e) =>
                      setNewItem((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="Item name"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div className="col-span-3">
                  <select
                    value={newItem.category}
                    onChange={(e) =>
                      setNewItem((prev) => ({
                        ...prev,
                        category: e.target.value,
                      }))
                    }
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    {categoryOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                {newItem.category === "Pizza" ? (
                  <div className="col-span-3 grid grid-cols-3 gap-2">
                    {(
                      [
                        ["priceS", "S"],
                        ["priceM", "M"],
                        ["priceL", "L"],
                      ] as const
                    ).map(([field, label]) => (
                      <input
                        key={field}
                        type="number"
                        min="0"
                        step="1"
                        value={newItem[field]}
                        onChange={(e) =>
                          setNewItem((prev) => ({
                            ...prev,
                            [field]: e.target.value,
                          }))
                        }
                        placeholder={`${label} price`}
                        title={`${label} size price`}
                        className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    ))}
                  </div>
                ) : (
                  <div className="col-span-3">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={newItem.basePrice}
                      onChange={(e) =>
                        setNewItem((prev) => ({
                          ...prev,
                          basePrice: e.target.value,
                        }))
                      }
                      placeholder="Price"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                )}
                <div className="col-span-2 flex justify-end gap-2">
                  {editingProductId && (
                    <button
                      onClick={resetItemForm}
                      disabled={isSavingItem}
                      className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 disabled:opacity-50 transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    onClick={saveItem}
                    disabled={isSavingItem || isUploadingImage}
                    className="px-3 py-2 rounded-lg bg-green-50 text-green-900 text-sm font-semibold hover:bg-green-100 disabled:opacity-50 transition-colors"
                  >
                    {isSavingItem
                      ? "Saving..."
                      : editingProductId
                        ? "Update"
                        : "Add Item"}
                  </button>
                </div>
                <div className="col-span-12 sm:col-span-4">
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    SKU
                  </label>
                  <input
                    value={newItem.sku}
                    onChange={(e) =>
                      setNewItem((prev) => ({ ...prev, sku: e.target.value }))
                    }
                    placeholder="Product SKU"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div className="col-span-12 sm:col-span-4">
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Barcode
                  </label>
                  <div className="relative flex items-center">
                    <ScanBarcode className="w-4 h-4 text-gray-400 absolute left-3 pointer-events-none" />
                    <input
                      value={newItem.barcode}
                      onChange={(e) =>
                        setNewItem((prev) => ({ ...prev, barcode: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.preventDefault();
                      }}
                      placeholder="Scan or enter barcode"
                      className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>
                <div className="col-span-12 sm:col-span-4">
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Stock
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={newItem.stock}
                    onChange={(e) =>
                      setNewItem((prev) => ({
                        ...prev,
                        stock: e.target.value,
                      }))
                    }
                    placeholder="Blank = unlimited"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                {(editingProductId || newItem.stock.trim() !== "") && (
                  <div className="col-span-12">
                    <input
                      value={newItem.stockReason}
                      onChange={(e) =>
                        setNewItem((prev) => ({
                          ...prev,
                          stockReason: e.target.value,
                        }))
                      }
                      placeholder={
                        editingProductId
                          ? "Reason for stock change (optional, logged if stock changes)"
                          : "Initial stock reason (optional, e.g. Initial stock)"
                      }
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                )}
                <div className="col-span-12">
                  <input
                    value={newItem.description}
                    onChange={(e) =>
                      setNewItem((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Description (optional)"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Custom categories
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Edit name, change picture, or delete each category.
                </p>
              </div>
              <input
                ref={categoryRowImageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  const target = categoryPictureTargetRef.current;
                  if (file && target) void changeCategoryPicture(target, file);
                }}
              />
              {catalogLoading ? (
                <div className="p-6 text-sm text-gray-500">Loading...</div>
              ) : categories.length === 0 ? (
                <div className="p-6 text-sm text-gray-500">
                  No custom categories yet. Add one above.
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {categories.map((category) => (
                    <div
                      key={category.id}
                      className="px-4 py-3 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={imageUrl(category.image)}
                          alt={category.name}
                          className="w-12 h-12 rounded-lg object-cover border border-gray-200 bg-gray-50 shrink-0"
                        />
                        <span className="text-lg">{category.emoji}</span>
                        <span className="text-sm font-semibold text-gray-900 truncate">
                          {category.name}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => startEditCategory(category)}
                          disabled={
                            deletingCategoryId === category.id ||
                            changingPictureCategoryId === category.id
                          }
                          className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-sm font-semibold hover:bg-blue-100 disabled:opacity-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            categoryPictureTargetRef.current = category;
                            categoryRowImageInputRef.current?.click();
                          }}
                          disabled={
                            deletingCategoryId === category.id ||
                            changingPictureCategoryId === category.id
                          }
                          className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-800 text-sm font-semibold hover:bg-indigo-100 disabled:opacity-50"
                        >
                          {changingPictureCategoryId === category.id
                            ? "Uploading..."
                            : "Change Picture"}
                        </button>
                        {category.image !== DEFAULT_IMAGE && (
                          <button
                            type="button"
                            onClick={() => void clearCategoryPicture(category)}
                            disabled={
                              deletingCategoryId === category.id ||
                              changingPictureCategoryId === category.id
                            }
                            className="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-800 text-sm font-semibold hover:bg-amber-100 disabled:opacity-50"
                          >
                            Delete Picture
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => deleteCategory(category)}
                          disabled={
                            deletingCategoryId === category.id ||
                            changingPictureCategoryId === category.id
                          }
                          className="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-sm font-semibold hover:bg-red-100 disabled:opacity-50"
                        >
                          {deletingCategoryId === category.id
                            ? "..."
                            : "Delete"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div
              ref={catalogItemsRef}
              className="scroll-mt-36 bg-white rounded-2xl border border-gray-200 overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-gray-100 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      All menu items
                    </p>
                    {catalogStockFilter !== "all" && (
                      <span className="text-xs font-semibold text-gray-700">
                        · Showing{" "}
                        {catalogStockFilter === "low"
                          ? "Low Stock"
                          : catalogStockFilter === "out"
                            ? "Out of Stock"
                            : "In Stock"}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 tabular-nums">
                    {filteredCatalogProducts.length} / {catalogProducts.length}
                  </p>
                </div>

                {/* Low Stock Alert Threshold Control */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-amber-50/70 rounded-xl border border-amber-200/80 text-sm">
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                    <div>
                      <span className="font-bold text-amber-950">Low Stock Alert Threshold:</span>
                      <span className="text-amber-800 text-xs ml-1.5 block sm:inline">Highlight items when remaining quantity is ≤ this value</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="999"
                      value={lowStockThreshold}
                      onChange={(e) => {
                        const val = Math.max(0, parseInt(e.target.value) || 0);
                        setLowStockThreshold(val);
                        if (typeof window !== "undefined") {
                          localStorage.setItem("pos_low_stock_threshold", String(val));
                        }
                      }}
                      className="w-20 px-2.5 py-1 text-sm font-bold text-center border border-amber-300 rounded-lg bg-white tabular-nums focus:ring-2 focus:ring-amber-500/20"
                    />
                    <span className="text-xs font-semibold text-amber-900">units</span>
                  </div>
                </div>

                {/* Quick Stock Filters */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCatalogStockFilter("all")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors tabular-nums ${
                      catalogStockFilter === "all"
                        ? "bg-gray-900 text-white border-gray-900"
                        : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    All Items ({catalogProducts.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCatalogStockFilter("low")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-colors tabular-nums ${
                      catalogStockFilter === "low"
                        ? "bg-amber-600 text-white border-amber-600"
                        : "bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100"
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Low Stock ({lowStockCount})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCatalogStockFilter("out")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-colors tabular-nums ${
                      catalogStockFilter === "out"
                        ? "bg-red-700 text-white border-red-700"
                        : "bg-red-50 text-red-900 border-red-200 hover:bg-red-100"
                    }`}
                  >
                    <PackageX className="w-3.5 h-3.5" />
                    <span>Out of Stock ({outOfStockCount})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCatalogStockFilter("in")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-colors tabular-nums ${
                      catalogStockFilter === "in"
                        ? "bg-emerald-700 text-white border-emerald-700"
                        : "bg-emerald-50 text-emerald-900 border-emerald-200 hover:bg-emerald-100"
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>In Stock ({inStockCount})</span>
                  </button>
                </div>

                <input
                  value={itemQuery}
                  onChange={(e) => setItemQuery(e.target.value)}
                  placeholder="Search all items by name, SKU, barcode, or category..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              {catalogLoading ? (
                <div className="p-6 text-sm text-gray-500">Loading...</div>
              ) : filteredCatalogProducts.length === 0 ? (
                <div className="p-6 text-sm text-gray-500">No items found matching the selected filter.</div>
              ) : (
                <div className="divide-y divide-gray-100 max-h-[560px] overflow-y-auto">
                  {filteredCatalogProducts.map((product) => {
                    const isOutOfStock = product.stock === 0;
                    const isLowStock =
                      product.stock != null &&
                      product.stock > 0 &&
                      product.stock <= lowStockThreshold;
                    return (
                      <div
                        key={product.id}
                        className={`px-4 py-3 flex flex-wrap md:grid md:grid-cols-[52px_minmax(0,1.5fr)_100px_118px_132px_auto] gap-3 items-center transition-colors ${
                          isOutOfStock
                            ? "bg-red-50/70 border-l-4 border-l-red-500 hover:bg-red-100/50"
                            : isLowStock
                              ? "bg-amber-50/70 border-l-4 border-l-amber-500 hover:bg-amber-100/50"
                              : "hover:bg-gray-50 border-l-4 border-l-transparent"
                        }`}
                      >
                        <div className="shrink-0">
                          <img
                            src={imageUrl(product.image)}
                            alt={product.name}
                            className="w-12 h-12 rounded-lg object-cover border border-gray-200 bg-gray-50"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {product.name}
                            </p>
                            {isOutOfStock && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-red-600 text-white">
                                Out of Stock
                              </span>
                            )}
                            {isLowStock && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-amber-500 text-white">
                                Low Stock
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 truncate space-y-0.5 mt-0.5">
                            {product.sku || product.barcode ? (
                              <p className="font-mono text-[11px] text-gray-500 truncate">
                                {[
                                  product.sku ? `SKU: ${product.sku}` : null,
                                  product.barcode
                                    ? `Barcode: ${product.barcode}`
                                    : null,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                            ) : (
                              <p className="truncate">{product.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-sm text-gray-600">
                          <div>{product.category}</div>
                          <div className="text-[10px] uppercase tracking-wide text-gray-400">
                            {product.source === "custom" ? "Custom" : "Menu"}
                          </div>
                        </div>
                        <div className="text-sm">
                          {isOutOfStock ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800 border border-red-300 tabular-nums">
                              0 left
                            </span>
                          ) : isLowStock ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 tabular-nums">
                              {product.stock} left
                            </span>
                          ) : product.stock != null ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 tabular-nums">
                              {product.stock} in stock
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">Unlimited</span>
                          )}
                        </div>
                        <div className="text-sm font-semibold text-gray-900 tabular-nums">
                          {product.sizePrices
                            ? formatSizePrices(product.sizePrices)
                            : money(product.basePrice)}
                        </div>
                        <div className="flex justify-end gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => openQuickAdjust(product)}
                            disabled={deletingProductId === product.id}
                            className="px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-800 text-xs font-semibold hover:bg-gray-200 disabled:opacity-50"
                          >
                            Stock
                          </button>
                          <button
                            type="button"
                            onClick={() => startEditProduct(product)}
                            disabled={deletingProductId === product.id}
                            className="px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 disabled:opacity-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteProduct(product)}
                            disabled={deletingProductId === product.id}
                            className="px-2.5 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100 disabled:opacity-50"
                          >
                            {deletingProductId === product.id ? "..." : "Delete"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {tab === "inventory" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center shrink-0">
                    <History className="w-5 h-5 text-gray-700" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-gray-900">
                      Inventory Adjustments &amp; Restock History
                    </h2>
                    <p className="text-xs text-gray-500">
                      Chronological audit trail of restocks, manual adjustments, and order deductions.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowInventoryAdjustForm((v) => !v)}
                    className="px-3.5 py-2 rounded-lg bg-gray-900 text-white text-xs font-semibold hover:bg-gray-800 flex items-center gap-1.5 transition-colors"
                  >
                    <PackagePlus className="w-4 h-4" />
                    <span>
                      {showInventoryAdjustForm
                        ? "Close Restock / Adjust"
                        : "Restock / Adjust Stock"}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void loadInventoryLogs()}
                    disabled={inventoryLogsLoading}
                    aria-label="Refresh inventory logs"
                    className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 text-xs font-semibold hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${inventoryLogsLoading ? "animate-spin" : ""}`}
                    />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              {showInventoryAdjustForm && (
                <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-12 md:col-span-5">
                      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        Product
                      </label>
                      <select
                        value={adjustProductId}
                        onChange={(e) => setAdjustProductId(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      >
                        <option value="">Select a product...</option>
                        {sortedCatalogProductsForSelect.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (
                            {p.stock == null ? "Unlimited" : `${p.stock} in stock`}
                            )
                            {p.barcode ? ` · ${p.barcode}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-6 md:col-span-3">
                      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        Adjustment Type
                      </label>
                      <select
                        value={adjustMode}
                        onChange={(e) =>
                          setAdjustMode(
                            e.target.value as "add" | "subtract" | "set",
                          )
                        }
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      >
                        <option value="add">Restock / Add (+)</option>
                        <option value="subtract">Deduct (-)</option>
                        <option value="set">Set Exact Stock</option>
                      </select>
                    </div>
                    <div className="col-span-6 md:col-span-2">
                      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        Quantity
                      </label>
                      <input
                        type="number"
                        min={adjustMode === "set" ? "0" : "1"}
                        step="1"
                        value={adjustQuantity}
                        onChange={(e) => setAdjustQuantity(e.target.value)}
                        placeholder={adjustMode === "set" ? "Blank = unlim." : "Qty"}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                    <div className="col-span-12 md:col-span-2 flex items-end">
                      <button
                        type="button"
                        onClick={() => void submitInventoryAdjustment()}
                        disabled={isAdjustingStock}
                        className="w-full py-2 px-3 rounded-lg bg-emerald-700 text-white text-sm font-semibold hover:bg-emerald-800 disabled:opacity-50 transition-colors"
                      >
                        {isAdjustingStock ? "Saving..." : "Apply"}
                      </button>
                    </div>
                    <div className="col-span-12">
                      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        Reason
                      </label>
                      <input
                        type="text"
                        value={adjustReason}
                        onChange={(e) => setAdjustReason(e.target.value)}
                        placeholder="Reason (e.g. Restock, Supplier delivery, Inventory audit, Damaged)"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {INVENTORY_REASON_PRESETS.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setAdjustReason(preset)}
                            className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors ${
                              adjustReason === preset
                                ? "bg-blue-50 border-blue-300 text-blue-800"
                                : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                            }`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-xl border border-gray-200 p-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Log Entries
                </p>
                <p className="text-xl font-bold text-gray-900 mt-1 tabular-nums">
                  {inventorySummary.count}
                </p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 flex items-center gap-1">
                  <PackagePlus className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Units Added</span>
                </p>
                <p className="text-xl font-bold text-emerald-700 mt-1 tabular-nums">
                  +{inventorySummary.totalAdded}
                </p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 flex items-center gap-1">
                  <PackageMinus className="w-3.5 h-3.5 text-red-700" />
                  <span>Units Deducted</span>
                </p>
                <p className="text-xl font-bold text-red-700 mt-1 tabular-nums">
                  -{inventorySummary.totalDeducted}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  {(
                    [
                      { id: "", label: "All Activity" },
                      { id: "in", label: "Restocks (+)" },
                      { id: "out", label: "Deductions (-)" },
                      { id: "manual", label: "Manual Adjustments" },
                      { id: "sale", label: "Order Deductions" },
                      { id: "scan", label: "Barcode Scans" },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id || "all"}
                      type="button"
                      onClick={() => setInventoryFilter(f.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        inventoryFilter === f.id
                          ? "bg-gray-900 text-white border-gray-900"
                          : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <div className="relative flex items-center">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 pointer-events-none" />
                  <input
                    type="text"
                    value={inventoryQuery}
                    onChange={(e) => setInventoryQuery(e.target.value)}
                    placeholder="Filter by product name, SKU, barcode, order #, or reason..."
                    className="w-full border border-gray-200 rounded-xl pl-9 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  {inventoryQuery && (
                    <button
                      type="button"
                      onClick={() => setInventoryQuery("")}
                      aria-label="Clear filter"
                      className="absolute right-2.5 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {inventoryLogsLoading ? (
                <div className="p-8 text-center text-sm text-gray-500">
                  Loading inventory history...
                </div>
              ) : inventoryLogs.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <CheckCircle2 className="w-7 h-7 text-gray-300 mx-auto" />
                  <p className="text-sm font-medium text-gray-700">
                    {inventoryQuery || inventoryFilter
                      ? "No inventory entries match the selected filter."
                      : "No inventory adjustments logged yet."}
                  </p>
                  <p className="text-xs text-gray-500">
                    Stock updates in Catalog, manual restocks, barcode scans, and order sales will appear here.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                          Product Name
                        </th>
                        <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                          Date
                        </th>
                        <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 text-right">
                          Quantity Changed
                        </th>
                        <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                          Reason
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {inventoryLogs.map((entry) => {
                        const badge = inventorySourceLabel(entry.source);
                        const signed =
                          entry.quantityChange > 0
                            ? `+${entry.quantityChange}`
                            : String(entry.quantityChange);
                        const prevLabel =
                          entry.previousStock == null ? "Unlimited" : String(entry.previousStock);
                        const nextLabel =
                          entry.newStock == null ? "Unlimited" : String(entry.newStock);
                        return (
                          <tr key={entry.id} className="hover:bg-gray-50/70">
                            <td className="px-4 py-3 align-top">
                              <p className="text-sm font-semibold text-gray-900">
                                {entry.productName}
                              </p>
                              {(entry.sku || entry.barcode) && (
                                <p className="text-[11px] text-gray-500 font-mono mt-0.5">
                                  {[
                                    entry.sku ? `SKU: ${entry.sku}` : null,
                                    entry.barcode
                                      ? `Barcode: ${entry.barcode}`
                                      : null,
                                  ]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3 align-top text-xs text-gray-600 whitespace-nowrap tabular-nums">
                              {formatInventoryDate(entry.createdAt)}
                            </td>
                            <td className="px-4 py-3 align-top text-right whitespace-nowrap">
                              <span
                                className={`font-mono text-sm font-bold tabular-nums ${
                                  entry.quantityChange > 0
                                    ? "text-emerald-700"
                                    : entry.quantityChange < 0
                                      ? "text-red-700"
                                      : "text-gray-700"
                                }`}
                              >
                                {signed}
                              </span>
                              <p className="text-[11px] text-gray-500 font-mono tabular-nums mt-0.5">
                                {prevLabel} → {nextLabel}
                              </p>
                            </td>
                            <td className="px-4 py-3 align-top">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold uppercase tracking-wide ${badge.cls}`}
                                >
                                  {badge.label}
                                </span>
                                <span className="text-sm text-gray-800">
                                  {entry.reason}
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "shortcuts" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4 border-b border-gray-100 pb-4">
                <div>
                  <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <span>⌨️ Keyboard Shortcuts</span>
                  </h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Configure keyboard shortcuts for quick POS actions. Click &quot;Change Button&quot; to assign any key.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleResetShortcuts}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-xs font-semibold hover:bg-gray-50 transition-colors shadow-xs"
                >
                  ↺ Reset to Defaults
                </button>
              </div>

              {/* Action List */}
              <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden mb-4">
                {(
                  [
                    {
                      action: "newOrder" as const,
                      title: "New Order",
                      icon: "✨",
                      desc: "Clear cart and prepare a fresh new order",
                    },
                    {
                      action: "history" as const,
                      title: "Sales History",
                      icon: "📜",
                      desc: "Open completed order history & receipts",
                    },
                    {
                      action: "orders" as const,
                      title: "Saved Orders",
                      icon: "📋",
                      desc: "Open unpaid saved orders list",
                    },
                    {
                      action: "saveOrder" as const,
                      title: "Save Order",
                      icon: "💾",
                      desc: "Save order as unpaid/draft without checking out",
                    },
                    {
                      action: "payOrder" as const,
                      title: "Pay / Checkout",
                      icon: "💵",
                      desc: "Cash checkout, save sales record, and open receipt",
                    },
                  ]
                ).map(({ action, title, icon, desc }) => {
                  const cfg = shortcuts[action] || DEFAULT_SHORTCUTS[action];
                  const isEditing = editingShortcutAction === action;
                  return (
                    <div
                      key={action}
                      className={`p-4 flex flex-wrap items-center justify-between gap-4 transition-colors ${
                        isEditing ? "bg-blue-50/70" : "bg-white hover:bg-gray-50/50"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-[200px]">
                        <span className="text-2xl">{icon}</span>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{title}</p>
                          <p className="text-xs text-gray-500">{desc}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <kbd className="px-3 py-1.5 rounded-lg bg-gray-900 text-white font-mono font-bold text-xs shadow-xs tracking-wider border border-gray-800">
                          {cfg.label}
                        </kbd>

                        <button
                          type="button"
                          onClick={() => startEditShortcut(action)}
                          className="px-3.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition-colors shadow-xs"
                        >
                          Change Button
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Editing key combo panel */}
              {editingShortcutAction && (
                <div className="p-4 bg-blue-50/90 rounded-xl border border-blue-200 animate-in fade-in">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <p className="text-sm font-bold text-blue-950">
                      Configure button for:{" "}
                      <span className="text-blue-700 font-extrabold uppercase">
                        {shortcuts[editingShortcutAction]?.description || editingShortcutAction}
                      </span>
                    </p>
                    <button
                      type="button"
                      onClick={() => setEditingShortcutAction(null)}
                      className="text-xs text-gray-500 hover:text-gray-800"
                    >
                      ✕ Cancel
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 bg-white p-3 rounded-lg border border-blue-100 shadow-xs">
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={tempKeyCombo.altKey}
                          onChange={(e) =>
                            setTempKeyCombo((prev) => ({
                              ...prev,
                              altKey: e.target.checked,
                            }))
                          }
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        Alt
                      </label>
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={tempKeyCombo.ctrlKey}
                          onChange={(e) =>
                            setTempKeyCombo((prev) => ({
                              ...prev,
                              ctrlKey: e.target.checked,
                            }))
                          }
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        Ctrl
                      </label>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">+ Key:</span>
                      <select
                        value={tempKeyCombo.key.toLowerCase()}
                        onChange={(e) =>
                          setTempKeyCombo((prev) => ({
                            ...prev,
                            key: e.target.value.toLowerCase(),
                          }))
                        }
                        className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm font-mono font-bold bg-white"
                      >
                        {"abcdefghijklmnopqrstuvwxyz".split("").map((letter) => (
                          <option key={letter} value={letter}>
                            {letter.toUpperCase()}
                          </option>
                        ))}
                        {"0123456789".split("").map((num) => (
                          <option key={num} value={num}>
                            {num}
                          </option>
                        ))}
                        <option value="f1">F1</option>
                        <option value="f2">F2</option>
                        <option value="f3">F3</option>
                        <option value="f4">F4</option>
                        <option value="f5">F5</option>
                        <option value="f6">F6</option>
                        <option value="f7">F7</option>
                        <option value="f8">F8</option>
                        <option value="f9">F9</option>
                        <option value="f10">F10</option>
                        <option value="f11">F11</option>
                        <option value="f12">F12</option>
                        <option value="space">Space</option>
                      </select>
                    </div>

                    <div className="ml-auto flex items-center gap-2">
                      <span className="text-xs text-gray-500">Preview:</span>
                      <kbd className="px-2.5 py-1 rounded bg-blue-900 text-white font-mono font-bold text-xs shadow-xs">
                        {formatKeyCombo(
                          tempKeyCombo.key,
                          tempKeyCombo.altKey,
                          tempKeyCombo.ctrlKey,
                        )}
                      </kbd>
                      <button
                        type="button"
                        onClick={saveCurrentShortcut}
                        className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-xs ml-2"
                      >
                        Save Shortcut
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Fixed Reference Key Combos */}
              <div className="mt-5 pt-4 border-t border-gray-100">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                  Built-in dialog shortcuts
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-600">
                  <div className="p-2.5 rounded-lg bg-gray-50 flex items-center justify-between border border-gray-100">
                    <span>Confirm print / complete sale in Print Modal</span>
                    <kbd className="px-2 py-0.5 rounded bg-gray-200 text-gray-800 font-mono font-bold">
                      Enter
                    </kbd>
                  </div>
                  <div className="p-2.5 rounded-lg bg-gray-50 flex items-center justify-between border border-gray-100">
                    <span>Close Print Modal or dismiss popup</span>
                    <kbd className="px-2 py-0.5 rounded bg-gray-200 text-gray-800 font-mono font-bold">
                      Esc
                    </kbd>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "backup" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Custom backup location
              </p>
              <p className="text-sm text-gray-500 mb-3">
                Set an absolute folder path on this PC where auto backups are
                saved (contacts + full). Leave empty to use the default{" "}
                <span className="font-mono text-xs">backups</span> folder inside
                the app.
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[240px]">
                  <label className="block text-xs text-gray-500 mb-1">
                    Folder path
                  </label>
                  <input
                    value={customFolderDraft}
                    onChange={(e) => setCustomFolderDraft(e.target.value)}
                    placeholder="e.g. D:\POS-Backups"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white font-mono"
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void saveAutoBackupSettings({
                      customFolder: customFolderDraft.trim() || null,
                    })
                  }
                  disabled={isSavingAutoBackup}
                  className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-50"
                >
                  {isSavingAutoBackup ? "Saving..." : "Save Location"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCustomFolderDraft("");
                    void saveAutoBackupSettings({ customFolder: null });
                  }}
                  disabled={isSavingAutoBackup}
                  className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 disabled:opacity-50"
                >
                  Use Default
                </button>
              </div>
              {autoBackupFolder && (
                <p className="text-xs text-gray-400 break-all mt-2">
                  Active folder: {autoBackupFolder}
                </p>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Full data backup &amp; restore
              </p>
              <p className="text-sm text-gray-500 mb-4">
                Download a full backup of orders, contacts, and sales data, or
                restore from a previously saved backup file. This is separate from
                contacts-only backup.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={backupAllData}
                  disabled={
                    isBackingUp ||
                    isRestoring ||
                    isBackingUpContacts ||
                    isRestoringContacts
                  }
                  className="px-4 py-2 rounded-lg bg-[#1a3a5c] text-white text-sm font-semibold hover:bg-[#1565c0] disabled:opacity-50 transition-colors"
                >
                  {isBackingUp ? "Backing up..." : "Backup All Data"}
                </button>
                <button
                  onClick={() => restoreInputRef.current?.click()}
                  disabled={
                    isBackingUp ||
                    isRestoring ||
                    isBackingUpContacts ||
                    isRestoringContacts
                  }
                  className="px-4 py-2 rounded-lg bg-amber-50 text-amber-900 text-sm font-semibold hover:bg-amber-100 disabled:opacity-50 transition-colors"
                >
                  {isRestoring ? "Restoring..." : "Restore from Backup"}
                </button>
                <input
                  ref={restoreInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void restoreFromBackup(file);
                  }}
                />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Auto full backup
              </p>
              <p className="text-sm text-gray-500 mb-3">
                Automatically save a full backup to the backup folder every day
                at the time you set. Keep the POS app running.
              </p>
              {autoBackupLoading ? (
                <p className="text-sm text-gray-500">Loading auto backup...</p>
              ) : (
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm text-gray-800 font-medium">
                    <input
                      type="checkbox"
                      checked={autoBackup.fullEnabled}
                      onChange={(e) =>
                        setAutoBackup((prev) => ({
                          ...prev,
                          fullEnabled: e.target.checked,
                        }))
                      }
                      className="rounded border-gray-300"
                    />
                    Enable daily full auto backup
                  </label>
                  <div className="flex flex-wrap items-end gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Time
                      </label>
                      <input
                        type="time"
                        value={autoBackup.fullTime}
                        onChange={(e) =>
                          setAutoBackup((prev) => ({
                            ...prev,
                            fullTime: e.target.value,
                          }))
                        }
                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        void saveAutoBackupSettings({
                          fullEnabled: autoBackup.fullEnabled,
                          fullTime: autoBackup.fullTime,
                        })
                      }
                      disabled={isSavingAutoBackup}
                      className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-50"
                    >
                      {isSavingAutoBackup ? "Saving..." : "Save Schedule"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void runAutoBackupNow("full")}
                      disabled={isRunningAutoFull}
                      className="px-4 py-2 rounded-lg bg-blue-50 text-blue-800 text-sm font-semibold hover:bg-blue-100 disabled:opacity-50"
                    >
                      {isRunningAutoFull ? "Running..." : "Run Now"}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">
                    Last auto:{" "}
                    {autoBackup.lastFullAt
                      ? new Date(autoBackup.lastFullAt).toLocaleString()
                      : "Never"}
                    {autoBackup.lastFullFile
                      ? ` · ${autoBackup.lastFullFile}`
                      : ""}
                  </p>
                  {autoBackup.lastError && (
                    <p className="text-xs text-red-600">
                      Last error: {autoBackup.lastError}
                    </p>
                  )}
                  {autoBackupFolder && (
                    <p className="text-xs text-gray-400 break-all">
                      Folder: {autoBackupFolder}
                    </p>
                  )}
                  {autoBackupRecent.length > 0 && (
                    <div className="pt-2 border-t border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        Recent auto backups
                      </p>
                      <ul className="space-y-1 max-h-40 overflow-y-auto">
                        {autoBackupRecent.map((f) => (
                          <li
                            key={f.name}
                            className="text-xs text-gray-600 flex gap-2"
                          >
                            <span className="font-medium text-gray-800 w-16">
                              {f.type === "contacts" ? "Contacts" : "Full"}
                            </span>
                            <span className="truncate">{f.name}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "menu" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="w-9 h-9 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5 text-gray-700" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-gray-900">
                      Header Digital Clock
                    </p>
                    <span
                      className={`px-2 py-0.5 rounded border text-[11px] font-semibold uppercase tracking-wide ${
                        posSettings.digitalClockEnabled
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : "bg-gray-100 text-gray-600 border-gray-200"
                      }`}
                    >
                      {posSettings.digitalClockEnabled ? "Shown" : "Hidden"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Show or hide the live digital clock (with seconds) above the navigation buttons on the main billing screen.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void setDigitalClockVisibility(true)}
                  disabled={posSettingsLoading || isSavingPosSettings}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors flex items-center gap-1.5 disabled:opacity-50 ${
                    posSettings.digitalClockEnabled
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-800 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Show</span>
                </button>
                <button
                  type="button"
                  onClick={() => void setDigitalClockVisibility(false)}
                  disabled={posSettingsLoading || isSavingPosSettings}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors flex items-center gap-1.5 disabled:opacity-50 ${
                    !posSettings.digitalClockEnabled
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-800 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Hide</span>
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Menu item style
                </p>
                <p className="text-sm text-gray-500">
                  Change size, colors, and font for menu tiles on the main screen.
                </p>
              </div>
            {menuAppearanceLoading ? (
              <p className="text-sm text-gray-500">Loading...</p>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Tile size ({menuAppearance.tileSize}px)
                    </label>
                    <input
                      type="range"
                      min={60}
                      max={160}
                      value={menuAppearance.tileSize}
                      onChange={(e) =>
                        setMenuAppearance((prev) => ({
                          ...prev,
                          tileSize: Number(e.target.value),
                        }))
                      }
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Font size ({menuAppearance.fontSize}px)
                    </label>
                    <input
                      type="range"
                      min={8}
                      max={18}
                      step={0.5}
                      value={menuAppearance.fontSize}
                      onChange={(e) =>
                        setMenuAppearance((prev) => ({
                          ...prev,
                          fontSize: Number(e.target.value),
                        }))
                      }
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Background color
                    </label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="color"
                        value={menuAppearance.tileBgColor}
                        onChange={(e) =>
                          setMenuAppearance((prev) => ({
                            ...prev,
                            tileBgColor: e.target.value,
                          }))
                        }
                        className="h-10 w-14 rounded border border-gray-200"
                      />
                      <input
                        value={menuAppearance.tileBgColor}
                        onChange={(e) =>
                          setMenuAppearance((prev) => ({
                            ...prev,
                            tileBgColor: e.target.value,
                          }))
                        }
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Text color
                    </label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="color"
                        value={menuAppearance.tileTextColor}
                        onChange={(e) =>
                          setMenuAppearance((prev) => ({
                            ...prev,
                            tileTextColor: e.target.value,
                          }))
                        }
                        className="h-10 w-14 rounded border border-gray-200"
                      />
                      <input
                        value={menuAppearance.tileTextColor}
                        onChange={(e) =>
                          setMenuAppearance((prev) => ({
                            ...prev,
                            tileTextColor: e.target.value,
                          }))
                        }
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Border color
                    </label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="color"
                        value={menuAppearance.tileBorderColor}
                        onChange={(e) =>
                          setMenuAppearance((prev) => ({
                            ...prev,
                            tileBorderColor: e.target.value,
                          }))
                        }
                        className="h-10 w-14 rounded border border-gray-200"
                      />
                      <input
                        value={menuAppearance.tileBorderColor}
                        onChange={(e) =>
                          setMenuAppearance((prev) => ({
                            ...prev,
                            tileBorderColor: e.target.value,
                          }))
                        }
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Font
                    </label>
                    <select
                      value={menuAppearance.fontFamily}
                      onChange={(e) =>
                        setMenuAppearance((prev) => ({
                          ...prev,
                          fontFamily: e.target.value,
                        }))
                      }
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                    >
                      {MENU_FONT_OPTIONS.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Preview
                  </p>
                  <div className="inline-flex flex-col items-center justify-start border-2 rounded-xl overflow-hidden"
                    style={{
                      width: menuAppearance.tileSize,
                      minHeight: menuAppearance.tileSize,
                      backgroundColor: menuAppearance.tileBgColor,
                      borderColor: menuAppearance.tileBorderColor,
                      fontFamily: menuAppearance.fontFamily,
                    }}
                  >
                    <div
                      className="w-full flex items-center justify-center bg-[#c8daea]"
                      style={{ height: Math.round(menuAppearance.tileSize * 0.64) }}
                    >
                      <span className="text-2xl">🍔</span>
                    </div>
                    <div className="w-full px-1 py-1 text-center">
                      <span
                        className="font-bold leading-tight block"
                        style={{
                          fontSize: `${menuAppearance.fontSize}px`,
                          color: menuAppearance.tileTextColor,
                        }}
                      >
                        Sample Item
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void saveMenuAppearance()}
                    disabled={isSavingMenuAppearance}
                    className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-50"
                  >
                    {isSavingMenuAppearance ? "Saving..." : "Save Menu Style"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMenuAppearance({ ...DEFAULT_MENU_APPEARANCE })}
                    disabled={isSavingMenuAppearance}
                    className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 disabled:opacity-50"
                  >
                    Reset Defaults
                  </button>
                </div>
              </>
            )}
            </div>
          </div>
        )}

        {tab === "danger" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-4">
              <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2">
                Confirmation code
              </p>
              <p className="text-sm text-gray-500 mb-3">
                Required before wiping all data. Current code hint:{" "}
                <span className="font-mono font-semibold text-gray-800">
                  {wipeCodeHint}
                </span>
                . Default code is <span className="font-mono">1234</span> until
                you change it.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Current code
                  </label>
                  <input
                    type="password"
                    value={wipeCurrentCode}
                    onChange={(e) => setWipeCurrentCode(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    placeholder="Current code"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    New code
                  </label>
                  <input
                    type="password"
                    value={wipeNewCode}
                    onChange={(e) => setWipeNewCode(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    placeholder="Min 4 characters"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Confirm new code
                  </label>
                  <input
                    type="password"
                    value={wipeConfirmNewCode}
                    onChange={(e) => setWipeConfirmNewCode(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    placeholder="Repeat new code"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => void saveWipeCode()}
                disabled={isSavingWipeCode}
                className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-50"
              >
                {isSavingWipeCode ? "Saving..." : "Set Confirmation Code"}
              </button>
            </div>

            <div className="bg-red-50 rounded-2xl border border-red-200 shadow-sm p-4">
              <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2">
                Remove all data
              </p>
              <p className="text-sm text-red-800/80 mb-3">
                Permanently deletes contacts, saved orders, history (checked-out
                orders), all balances / sales totals, and resets receipt numbering.
                Catalog items, categories, and receipt branding are kept.
              </p>
              <div className="flex flex-wrap items-end gap-3 mb-2">
                <div className="min-w-[200px]">
                  <label className="block text-xs text-red-700/70 mb-1">
                    Enter confirmation code (Default: 1234)
                  </label>
                  <input
                    type="password"
                    value={wipeConfirmInput}
                    onChange={(e) => setWipeConfirmInput(e.target.value)}
                    className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm bg-white"
                    placeholder="e.g. 1234"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setWipeConfirmInput("1234")}
                  className="px-3 py-2 rounded-lg border border-red-200 bg-white text-red-800 text-xs font-semibold hover:bg-red-100 transition-colors"
                >
                  Fill Default Code (1234)
                </button>
                <button
                  type="button"
                  onClick={() => void wipeAllData()}
                  disabled={isWipingData || !wipeConfirmInput.trim()}
                  className="px-4 py-2 rounded-lg bg-red-700 text-white text-sm font-semibold hover:bg-red-800 disabled:opacity-50 transition-colors shadow-xs"
                >
                  {isWipingData ? "Removing..." : "Remove All Data"}
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === "receipt" && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Receipt settings
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Store name, address, phones, logo, and payment details printed on
              customer receipts.
            </p>
            {receiptLoading ? (
              <div className="text-sm text-gray-500">Loading...</div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  {receiptSettings.logoImage ? (
                    <img
                      src={imageUrl(receiptSettings.logoImage)}
                      alt="Logo"
                      className="w-20 h-20 rounded-xl object-contain border border-gray-200 bg-gray-50"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-xl border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-[10px] text-gray-400 text-center px-1">
                      No logo
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => receiptLogoInputRef.current?.click()}
                      disabled={isUploadingReceiptLogo || isSavingReceipt}
                      className="px-3 py-2 rounded-lg bg-blue-50 text-blue-800 text-sm font-semibold hover:bg-blue-100 disabled:opacity-50"
                    >
                      {isUploadingReceiptLogo
                        ? "Uploading..."
                        : receiptSettings.logoImage
                          ? "Change Logo"
                          : "Add Logo"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const prev = receiptSettings.logoImage;
                        setReceiptSettings((s) => ({
                          ...s,
                          logoImage: "",
                        }));
                        if (isUploadedImage(prev)) void deleteUploadedImage(prev);
                        showToast("Logo removed");
                      }}
                      disabled={
                        isUploadingReceiptLogo ||
                        isSavingReceipt ||
                        !receiptSettings.logoImage
                      }
                      className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm font-semibold hover:bg-red-100 disabled:opacity-50"
                    >
                      Delete Logo
                    </button>
                  </div>
                  <input
                    ref={receiptLogoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadReceiptImage(file, "logoImage");
                      e.target.value = "";
                    }}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Store name
                    </label>
                    <input
                      value={receiptSettings.storeName}
                      onChange={(e) =>
                        setReceiptSettings((s) => ({
                          ...s,
                          storeName: e.target.value,
                        }))
                      }
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Address
                    </label>
                    <input
                      value={receiptSettings.storeAddress}
                      onChange={(e) =>
                        setReceiptSettings((s) => ({
                          ...s,
                          storeAddress: e.target.value,
                        }))
                      }
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">
                      Phones
                    </label>
                    <input
                      value={receiptSettings.storePhones}
                      onChange={(e) =>
                        setReceiptSettings((s) => ({
                          ...s,
                          storePhones: e.target.value,
                        }))
                      }
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Payment title
                    </label>
                    <div className="flex gap-2">
                      <input
                        value={receiptSettings.paymentTitle}
                        onChange={(e) =>
                          setReceiptSettings((s) => ({
                            ...s,
                            paymentTitle: e.target.value,
                          }))
                        }
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setReceiptSettings((s) => ({
                            ...s,
                            paymentTitle: "",
                          }));
                          showToast("Payment title removed");
                        }}
                        disabled={
                          isSavingReceipt || !receiptSettings.paymentTitle.trim()
                        }
                        className="shrink-0 px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm font-semibold hover:bg-red-100 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Payment line
                    </label>
                    <div className="flex gap-2">
                      <input
                        value={receiptSettings.paymentLine}
                        onChange={(e) =>
                          setReceiptSettings((s) => ({
                            ...s,
                            paymentLine: e.target.value,
                          }))
                        }
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setReceiptSettings((s) => ({
                            ...s,
                            paymentLine: "",
                          }));
                          showToast("Payment line removed");
                        }}
                        disabled={
                          isSavingReceipt || !receiptSettings.paymentLine.trim()
                        }
                        className="shrink-0 px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm font-semibold hover:bg-red-100 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {receiptSettings.paymentImage ? (
                    <img
                      src={imageUrl(receiptSettings.paymentImage)}
                      alt="Payment"
                      className="w-16 h-16 rounded-xl object-contain border border-gray-200 bg-gray-50"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-[10px] text-gray-400 text-center px-1">
                      No image
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => paymentImageInputRef.current?.click()}
                      disabled={isUploadingPaymentImage || isSavingReceipt}
                      className="px-3 py-2 rounded-lg bg-blue-50 text-blue-800 text-sm font-semibold hover:bg-blue-100 disabled:opacity-50"
                    >
                      {isUploadingPaymentImage
                        ? "Uploading..."
                        : receiptSettings.paymentImage
                          ? "Change Payment Image"
                          : "Add Payment Image"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const prev = receiptSettings.paymentImage;
                        setReceiptSettings((s) => ({
                          ...s,
                          paymentImage: "",
                        }));
                        if (isUploadedImage(prev)) void deleteUploadedImage(prev);
                        showToast("Payment image removed");
                      }}
                      disabled={
                        isUploadingPaymentImage ||
                        isSavingReceipt ||
                        !receiptSettings.paymentImage
                      }
                      className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm font-semibold hover:bg-red-100 disabled:opacity-50"
                    >
                      Delete Payment Image
                    </button>
                  </div>
                  <input
                    ref={paymentImageInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadReceiptImage(file, "paymentImage");
                      e.target.value = "";
                    }}
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => void saveReceiptSettings()}
                    disabled={
                      isSavingReceipt ||
                      isUploadingReceiptLogo ||
                      isUploadingPaymentImage
                    }
                    className="px-4 py-2 rounded-lg bg-green-700 text-white text-sm font-semibold hover:bg-green-800 disabled:opacity-50"
                  >
                    {isSavingReceipt ? "Saving..." : "Save Receipt Settings"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "receiptNumber" && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Receipt number settings
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Set the prefix and next number used for new order receipts
              (example: TBT-101).
            </p>
            {receiptLoading ? (
              <div className="text-sm text-gray-500">Loading...</div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Prefix
                    </label>
                    <input
                      value={receiptSettings.receiptPrefix ?? "TBT"}
                      onChange={(e) =>
                        setReceiptSettings((s) => ({
                          ...s,
                          receiptPrefix: e.target.value
                            .toUpperCase()
                            .replace(/[^A-Z0-9]/g, "")
                            .slice(0, 12),
                        }))
                      }
                      placeholder="TBT"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Next number
                    </label>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={receiptSettings.receiptNextNumber ?? 1}
                      onChange={(e) =>
                        setReceiptSettings((s) => ({
                          ...s,
                          receiptNextNumber: Number(e.target.value || 1),
                        }))
                      }
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Preview
                    </label>
                    <div className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white font-semibold text-gray-900">
                      {(receiptSettings.receiptPrefix || "TBT").toUpperCase()}-
                      {Math.max(
                        1,
                        Math.floor(
                          Number(receiptSettings.receiptNextNumber) || 1,
                        ),
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => void saveReceiptNumberSettings()}
                    disabled={isSavingReceiptNumber}
                    className="px-4 py-2 rounded-lg bg-[#1a3a5c] text-white text-sm font-semibold hover:bg-[#1565c0] disabled:opacity-50"
                  >
                    {isSavingReceiptNumber
                      ? "Saving..."
                      : "Save Receipt Number Settings"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "reports" && (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Sales reports
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={() => setReportMode("date")}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                    reportMode === "date"
                      ? "bg-[#1a3a5c] text-white"
                      : "bg-gray-50 text-gray-700 border border-gray-200"
                  }`}
                >
                  Select Date
                </button>
                <button
                  onClick={() => {
                    setReportMode("items");
                    setReportCustomerKey("all");
                    setReportCategory("all");
                  }}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                    reportMode === "items"
                      ? "bg-[#1a3a5c] text-white"
                      : "bg-gray-50 text-gray-700 border border-gray-200"
                  }`}
                >
                  Item Report
                </button>
                <button
                  onClick={() => setReportMode("daily")}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                    reportMode === "daily"
                      ? "bg-[#1a3a5c] text-white"
                      : "bg-gray-50 text-gray-700 border border-gray-200"
                  }`}
                >
                  Day by Day
                </button>
                <button
                  onClick={() => setReportMode("monthly")}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                    reportMode === "monthly"
                      ? "bg-[#1a3a5c] text-white"
                      : "bg-gray-50 text-gray-700 border border-gray-200"
                  }`}
                >
                  Monthly
                </button>
              </div>

              {reportMode === "items" && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {(
                    [
                      { id: "date", label: "By Date" },
                      { id: "daily", label: "Day by Day" },
                      { id: "monthly", label: "Monthly" },
                    ] as const
                  ).map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setItemReportRange(r.id);
                        setReportCustomerKey("all");
                        setReportCategory("all");
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        itemReportRange === r.id
                          ? "bg-amber-800 text-white"
                          : "bg-gray-50 text-gray-700 border border-gray-200"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-end gap-3">
                {reportMode === "date" ||
                (reportMode === "items" && itemReportRange === "date") ? (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      value={reportDate}
                      onChange={(e) => {
                        setReportDate(e.target.value);
                        if (reportMode === "items") {
                          setReportCustomerKey("all");
                          setReportCategory("all");
                        }
                      }}
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                    />
                  </div>
                ) : reportMode === "items" ||
                  reportMode === "daily" ||
                  reportMode === "monthly" ? (
                  <>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Year
                      </label>
                      <select
                        value={reportYear}
                        onChange={(e) => {
                          setReportYear(Number(e.target.value));
                          if (reportMode === "items") {
                            setReportCustomerKey("all");
                            setReportCategory("all");
                          }
                        }}
                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                      >
                        {yearOptions.map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                    </div>
                    {(reportMode === "daily" ||
                      (reportMode === "items" &&
                        itemReportRange === "daily")) && (
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">
                          Month
                        </label>
                        <select
                          value={reportMonth}
                          onChange={(e) => {
                            setReportMonth(Number(e.target.value));
                            if (reportMode === "items") {
                              setReportCustomerKey("all");
                              setReportCategory("all");
                            }
                          }}
                          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                        >
                          {Array.from({ length: 12 }, (_, i) => i + 1).map(
                            (m) => (
                              <option key={m} value={m}>
                                {new Date(2000, m - 1, 1).toLocaleString(
                                  undefined,
                                  { month: "long" },
                                )}
                              </option>
                            ),
                          )}
                        </select>
                      </div>
                    )}
                  </>
                ) : null}

                {reportMode === "items" && (
                  <>
                    <div className="min-w-[180px]">
                      <label className="block text-xs text-gray-500 mb-1">
                        Category
                      </label>
                      <select
                        value={reportCategory}
                        onChange={(e) => setReportCategory(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                      >
                        <option value="all">All categories</option>
                        {categoryFilterOptions.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="min-w-[220px]">
                      <label className="block text-xs text-gray-500 mb-1">
                        Customer
                      </label>
                      <select
                        value={reportCustomerKey}
                        onChange={(e) =>
                          setReportCustomerKey(e.target.value)
                        }
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                      >
                        <option value="all">All customers</option>
                        {reportCustomerOptions.map((c) => (
                          <option key={c.key} value={c.key}>
                            {c.name}
                            {c.phone ? ` (${c.phone})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                <button
                  onClick={() => void loadReports()}
                  disabled={reportsLoading}
                  className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-50"
                >
                  {reportsLoading ? "Loading..." : "View Report"}
                </button>
                <button
                  type="button"
                  onClick={() => void printSalesOrItemReport()}
                  disabled={reportsLoading}
                  className="px-4 py-2 rounded-lg bg-blue-50 text-blue-800 text-sm font-semibold hover:bg-blue-100 disabled:opacity-50"
                >
                  Print Report
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-xs text-gray-500 mb-1">Revenue</p>
                <p className="text-lg font-bold text-gray-900">
                  {money(reportTotals.totalRevenue)}
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-xs text-gray-500 mb-1">Orders</p>
                <p className="text-lg font-bold text-gray-900">
                  {reportTotals.totalOrders}
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-xs text-gray-500 mb-1">Items</p>
                <p className="text-lg font-bold text-gray-900">
                  {reportTotals.totalItems}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-900">
                  {reportMode === "date"
                    ? `Report for ${reportDate}`
                    : reportMode === "items"
                      ? `Item report · ${itemReportPeriodLabel}${
                          reportCategory !== "all"
                            ? ` · ${reportCategory}`
                            : " · All categories"
                        }${
                          reportCustomerKey !== "all"
                            ? ` · ${reportCustomerKey.split("\t")[0]}`
                            : " · All customers"
                        }`
                      : reportMode === "daily"
                        ? `Day-by-day · ${monthLabel(reportYear, reportMonth)}`
                        : `Monthly · ${reportYear}`}
                </p>
              </div>
              {reportsLoading ? (
                <div className="p-8 text-sm text-gray-500">Loading report...</div>
              ) : reportMode === "items" ? (
                itemReportRows.length === 0 ? (
                  <div className="p-8 text-sm text-gray-500">
                    No items sold for this period
                    {reportCategory !== "all" ? " and category" : ""}
                    {reportCustomerKey !== "all" ? " and customer" : ""}.
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    <div className="px-4 py-2 grid grid-cols-12 gap-2 text-xs font-semibold text-gray-500 uppercase">
                      {itemReportRange !== "date" && (
                        <div className="col-span-2">Period</div>
                      )}
                      <div
                        className={
                          itemReportRange !== "date"
                            ? "col-span-4"
                            : "col-span-5"
                        }
                      >
                        Item
                      </div>
                      <div className="col-span-2">Category</div>
                      <div className="col-span-2 text-right">Qty</div>
                      <div
                        className={`text-right ${
                          itemReportRange !== "date"
                            ? "col-span-2"
                            : "col-span-3"
                        }`}
                      >
                        Revenue
                      </div>
                    </div>
                    {itemReportRows.map((item, idx) => {
                      const variant = itemReportVariant(item);
                      return (
                        <div
                          key={`${item.period}-${item.name}-${item.category}-${item.selectedSize}-${item.selectedTopping}-${item.selectedSauce}-${idx}`}
                          className="px-4 py-3 grid grid-cols-12 gap-2 text-sm items-start"
                        >
                          {itemReportRange !== "date" && (
                            <div className="col-span-2 text-gray-700 text-xs font-medium">
                              {item.period}
                            </div>
                          )}
                          <div
                            className={`min-w-0 ${
                              itemReportRange !== "date"
                                ? "col-span-4"
                                : "col-span-5"
                            }`}
                          >
                            <p className="font-medium text-gray-900 truncate">
                              {item.name}
                            </p>
                            {variant && (
                              <p className="text-xs text-gray-500 truncate">
                                {variant}
                              </p>
                            )}
                          </div>
                          <div className="col-span-2 text-gray-700 truncate">
                            {item.category || "—"}
                          </div>
                          <div className="col-span-2 text-right text-gray-700">
                            {item.quantitySold}
                          </div>
                          <div
                            className={`text-right font-semibold ${
                              itemReportRange !== "date"
                                ? "col-span-2"
                                : "col-span-3"
                            }`}
                          >
                            {money(item.revenue)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : reportMode === "monthly" ? (
                monthlyRows.length === 0 ? (
                  <div className="p-8 text-sm text-gray-500">
                    No monthly sales for this year.
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    <div className="px-4 py-2 grid grid-cols-12 gap-2 text-xs font-semibold text-gray-500 uppercase">
                      <div className="col-span-4">Month</div>
                      <div className="col-span-3 text-right">Revenue</div>
                      <div className="col-span-2 text-right">Orders</div>
                      <div className="col-span-3 text-right">Items</div>
                    </div>
                    {monthlyRows.map((row) => (
                      <div
                        key={row.period}
                        className="px-4 py-3 grid grid-cols-12 gap-2 text-sm"
                      >
                        <div className="col-span-4 font-medium text-gray-900">
                          {row.period}
                        </div>
                        <div className="col-span-3 text-right font-semibold">
                          {money(row.totalRevenue)}
                        </div>
                        <div className="col-span-2 text-right text-gray-700">
                          {row.totalOrders}
                        </div>
                        <div className="col-span-3 text-right text-gray-700">
                          {row.totalItems}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : dailyRows.length === 0 ? (
                <div className="p-8 text-sm text-gray-500">
                  {reportMode === "date"
                    ? "No sales for this date."
                    : "No daily sales for this month."}
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  <div className="px-4 py-2 grid grid-cols-12 gap-2 text-xs font-semibold text-gray-500 uppercase">
                    <div className="col-span-4">Date</div>
                    <div className="col-span-3 text-right">Revenue</div>
                    <div className="col-span-2 text-right">Orders</div>
                    <div className="col-span-3 text-right">Items</div>
                  </div>
                  {dailyRows.map((row) => (
                    <div
                      key={row.saleDate}
                      className="px-4 py-3 grid grid-cols-12 gap-2 text-sm"
                    >
                      <div className="col-span-4 font-medium text-gray-900">
                        {row.saleDate}
                      </div>
                      <div className="col-span-3 text-right font-semibold">
                        {money(row.totalRevenue)}
                      </div>
                      <div className="col-span-2 text-right text-gray-700">
                        {row.totalOrders}
                      </div>
                      <div className="col-span-3 text-right text-gray-700">
                        {row.totalItems}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {reportMode === "date" && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-900">
                    Orders on {reportDate}
                  </p>
                </div>
                {reportsLoading ? (
                  <div className="p-8 text-sm text-gray-500">Loading orders...</div>
                ) : dateOrders.length === 0 ? (
                  <div className="p-8 text-sm text-gray-500">
                    No checked-out orders for this date.
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    <div className="px-4 py-2 grid grid-cols-12 gap-2 text-xs font-semibold text-gray-500 uppercase">
                      <div className="col-span-3">Order</div>
                      <div className="col-span-3">Customer</div>
                      <div className="col-span-2">Type</div>
                      <div className="col-span-1 text-right">Items</div>
                      <div className="col-span-2 text-right">Total</div>
                      <div className="col-span-1 text-right">Print</div>
                    </div>
                    {dateOrders.map((order) => (
                      <div
                        key={order.orderCode}
                        className="px-4 py-3 grid grid-cols-12 gap-2 text-sm items-center"
                      >
                        <div className="col-span-3 font-medium text-gray-900">
                          {order.orderCode}
                        </div>
                        <div className="col-span-3 text-gray-700 truncate">
                          {order.customerName}
                        </div>
                        <div className="col-span-2 text-gray-700">
                          {order.orderType}
                          {order.tableNumber != null
                            ? ` #${order.tableNumber}`
                            : ""}
                        </div>
                        <div className="col-span-1 text-right text-gray-700">
                          {order.itemCount}
                        </div>
                        <div className="col-span-2 text-right font-semibold">
                          {money(order.total)}
                        </div>
                        <div className="col-span-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() => openReportPrint(order)}
                            className="px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100"
                          >
                            Print
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {tab === "ledger" && (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Customer ledger
              </p>
              <p className="text-sm text-gray-500 mb-3">
                Select a customer to see all checked-out orders, totals, and
                running balance. Use Day by Day for a monthly daily summary.
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setLedgerViewMode("all")}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                    ledgerViewMode === "all"
                      ? "bg-[#1a3a5c] text-white"
                      : "bg-gray-50 text-gray-700 border border-gray-200"
                  }`}
                >
                  All Orders
                </button>
                <button
                  type="button"
                  onClick={() => setLedgerViewMode("daily")}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                    ledgerViewMode === "daily"
                      ? "bg-[#1a3a5c] text-white"
                      : "bg-gray-50 text-gray-700 border border-gray-200"
                  }`}
                >
                  Day by Day
                </button>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[260px] flex-1">
                  <label className="block text-xs text-gray-500 mb-1">
                    Customer
                  </label>
                  <select
                    value={ledgerCustomerKey}
                    onChange={(e) => setLedgerCustomerKey(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    <option value="">Select customer...</option>
                    {ledgerCustomerOptions.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.name}
                        {c.phone ? ` (${c.phone})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                {ledgerViewMode === "daily" && (
                  <>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Year
                      </label>
                      <select
                        value={ledgerYear}
                        onChange={(e) => setLedgerYear(Number(e.target.value))}
                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                      >
                        {yearOptions.map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Month
                      </label>
                      <select
                        value={ledgerMonth}
                        onChange={(e) => setLedgerMonth(Number(e.target.value))}
                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                          <option key={m} value={m}>
                            {new Date(2000, m - 1, 1).toLocaleString(undefined, {
                              month: "long",
                            })}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => void loadLedger()}
                  disabled={ledgerLoading || !ledgerCustomerKey}
                  className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-50"
                >
                  {ledgerLoading ? "Loading..." : "View Ledger"}
                </button>
                <button
                  type="button"
                  onClick={() => void printCustomerLedger()}
                  disabled={ledgerLoading || !ledgerCustomerKey}
                  className="px-4 py-2 rounded-lg bg-blue-50 text-blue-800 text-sm font-semibold hover:bg-blue-100 disabled:opacity-50"
                >
                  Print Ledger
                </button>
              </div>
            </div>

            {ledgerCustomerKey && (
              <>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-white rounded-2xl border border-gray-100 p-4">
                    <p className="text-xs text-gray-500 mb-1">Total spent</p>
                    <p className="text-lg font-bold text-gray-900">
                      {money(ledgerTotals.totalRevenue)}
                    </p>
                  </div>
                  <div className="bg-white rounded-2xl border border-gray-100 p-4">
                    <p className="text-xs text-gray-500 mb-1">Orders</p>
                    <p className="text-lg font-bold text-gray-900">
                      {ledgerTotals.totalOrders}
                    </p>
                  </div>
                  <div className="bg-white rounded-2xl border border-gray-100 p-4">
                    <p className="text-xs text-gray-500 mb-1">Items</p>
                    <p className="text-lg font-bold text-gray-900">
                      {ledgerTotals.totalItems}
                    </p>
                  </div>
                </div>

                {ledgerViewMode === "daily" && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-semibold text-gray-900">
                        Day by day · {monthLabel(ledgerYear, ledgerMonth)}
                      </p>
                    </div>
                    {ledgerLoading ? (
                      <div className="p-8 text-sm text-gray-500">
                        Loading ledger...
                      </div>
                    ) : ledgerDaily.length === 0 ? (
                      <div className="p-8 text-sm text-gray-500">
                        No orders for this month.
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        <div className="px-4 py-2 grid grid-cols-12 gap-2 text-xs font-semibold text-gray-500 uppercase">
                          <div className="col-span-4">Date</div>
                          <div className="col-span-2 text-right">Orders</div>
                          <div className="col-span-3 text-right">Items</div>
                          <div className="col-span-3 text-right">Amount</div>
                        </div>
                        {ledgerDaily.map((row) => (
                          <div
                            key={row.saleDate}
                            className="px-4 py-3 grid grid-cols-12 gap-2 text-sm"
                          >
                            <div className="col-span-4 font-medium text-gray-900">
                              {row.saleDate}
                            </div>
                            <div className="col-span-2 text-right text-gray-700">
                              {row.totalOrders}
                            </div>
                            <div className="col-span-3 text-right text-gray-700">
                              {row.totalItems}
                            </div>
                            <div className="col-span-3 text-right font-semibold">
                              {money(row.totalRevenue)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-semibold text-gray-900">
                      {ledgerViewMode === "daily"
                        ? `Orders · ${monthLabel(ledgerYear, ledgerMonth)}`
                        : "Ledger"}{" "}
                      · {ledgerCustomerKey.split("\t")[0]}
                      {ledgerCustomerKey.split("\t")[1]
                        ? ` (${ledgerCustomerKey.split("\t")[1]})`
                        : ""}
                    </p>
                  </div>
                  {ledgerLoading ? (
                    <div className="p-8 text-sm text-gray-500">
                      Loading ledger...
                    </div>
                  ) : ledgerEntries.length === 0 ? (
                    <div className="p-8 text-sm text-gray-500">
                      No checked-out orders for this customer
                      {ledgerViewMode === "daily" ? " in this month" : ""}.
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      <div className="px-4 py-2 grid grid-cols-12 gap-2 text-xs font-semibold text-gray-500 uppercase">
                        <div className="col-span-2">Date</div>
                        <div className="col-span-3">Receipt #</div>
                        <div className="col-span-2">Type</div>
                        <div className="col-span-2 text-right">Amount</div>
                        <div className="col-span-2 text-right">Balance</div>
                        <div className="col-span-1 text-right">Print</div>
                      </div>
                      {ledgerEntries.map((entry) => (
                        <div
                          key={entry.orderCode}
                          className="px-4 py-3 grid grid-cols-12 gap-2 text-sm items-center"
                        >
                          <div className="col-span-2 text-gray-700">
                            {entry.businessDate}
                          </div>
                          <div className="col-span-3 font-medium text-gray-900 truncate">
                            {entry.orderCode}
                            <p className="text-xs text-gray-400 font-normal">
                              {entry.itemCount} item
                              {entry.itemCount === 1 ? "" : "s"}
                            </p>
                          </div>
                          <div className="col-span-2 text-gray-700">
                            {entry.orderType}
                            {entry.tableNumber != null
                              ? ` #${entry.tableNumber}`
                              : ""}
                          </div>
                          <div className="col-span-2 text-right font-semibold">
                            {money(entry.total)}
                          </div>
                          <div className="col-span-2 text-right text-gray-800">
                            {money(entry.balance)}
                          </div>
                          <div className="col-span-1 flex justify-end">
                            <button
                              type="button"
                              onClick={() => openReportPrint(entry)}
                              className="px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100"
                            >
                              Print
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
