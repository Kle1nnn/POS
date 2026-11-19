"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  PackageX,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useCart, makeCartKey } from "../context/CartContext";
import { useOrders } from "../context/OrdersContext";
import { products } from "../data/products";
import type { Product } from "./Product";
import {
  DEFAULT_MENU_APPEARANCE,
  type MenuAppearanceSettings,
} from "../../lib/menu-appearance-shared";
import { playBarcodeScanBeep } from "../../lib/audio";

const BUILTIN_CATEGORY_TILES = [
  { key: "Burger", label: "Burgers", emoji: "🍔", image: "burger.png" },
  { key: "Broast", label: "Broast", emoji: "🍗", image: "broast.png" },
  { key: "Rolls", label: "Rolls", emoji: "🌯", image: "roll.png" },
  { key: "Shawarma", label: "Shawarma", emoji: "🥙", image: "shawarma.png" },
  { key: "Fries", label: "Fries", emoji: "🍟", image: "fries.png" },
  { key: "Sandwich", label: "Sandwich", emoji: "🍔", image: "sandwich.png" },
  { key: "Pasta", label: "Pasta", emoji: "🍝", image: "pasta.png" },
  { key: "BarBQ", label: "BarBQ", emoji: "🧂", image: "bbq.png" },
  { key: "Drinks", label: "Drinks", emoji: "🍹", image: "drink.png" },
  { key: "Toping", label: "Toping", emoji: "🧂", image: "dip.png" },
  { key: "Deals", label: "Deals", emoji: "🧂", image: "deals.png" },
];

const baseProducts: Product[] = products.map((p) =>
  p.category === "Rolls" && p.image === "shawarma.png"
    ? { ...p, category: "Shawarma" }
    : p,
);

type CategoryTile = {
  key: string;
  label: string;
  emoji: string;
  image: string;
};

type Selection =
  | { mode: "none" }
  | { mode: "pizza"; productId: string }
  | { mode: "category"; category: string };

export default function MenuGrid({
  searchQuery = "",
  onSearchChange,
  barcodeSearchEnabled = true,
  lowStockThreshold = 5,
  scanSubmitCount = 0,
}: {
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
  barcodeSearchEnabled?: boolean;
  lowStockThreshold?: number;
  scanSubmitCount?: number;
}) {
  const router = useRouter();
  const { cartItems, addToCart } = useCart();
  const { editingOrder } = useOrders();
  const [selection, setSelection] = useState<Selection>({ mode: "none" });
  const [menuProducts, setMenuProducts] = useState<Product[]>(baseProducts);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [customCategories, setCustomCategories] = useState<CategoryTile[]>([]);
  const [appearance, setAppearance] = useState<MenuAppearanceSettings>(
    DEFAULT_MENU_APPEARANCE,
  );
  const [toast, setToast] = useState<{
    message: string;
    tone: "error" | "success" | "info" | "warning";
    actionHref?: string;
    actionLabel?: string;
  } | null>(null);
  const [alertExpanded, setAlertExpanded] = useState(true);
  const toastTimerRef = useRef<number | null>(null);
  const lastAutoMatchRef = useRef("");
  const debounceTimerRef = useRef<number | null>(null);
  const lastScanSubmitCountRef = useRef(scanSubmitCount);
  const barcodePendingPizzaIdRef = useRef<string | null>(null);
  const seenLowStockLevelsRef = useRef<Map<string, number> | null>(null);

  const recordBarcodeScanEvent = useCallback((product: Product) => {
    playBarcodeScanBeep();
    void fetch("/api/catalog/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: product.id,
        barcode: product.barcode || "",
        mode: "scan_event",
        scanEvent: true,
      }),
      keepalive: true,
    }).catch(() => {
      /* non-blocking barcode scan audit log */
    });
  }, []);

  const showNotice = useCallback(
    (
      message: string,
      tone: "error" | "success" | "info" | "warning" = "info",
      durationMs = 2800,
      action?: { href: string; label: string },
    ) => {
      setToast({
        message,
        tone,
        actionHref: action?.href,
        actionLabel: action?.label,
      });
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
      toastTimerRef.current = window.setTimeout(() => {
        setToast(null);
      }, durationMs);
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/menu-appearance");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.settings) setAppearance(data.settings);
      } catch {
        /* keep defaults */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadCatalog = useCallback(async () => {
    try {
      const [productsRes, categoriesRes] = await Promise.all([
        fetch("/api/catalog/products?menu=1"),
        fetch("/api/catalog/categories"),
      ]);
      if (!productsRes.ok || !categoriesRes.ok) return;
      const pType = productsRes.headers.get("content-type") || "";
      const cType = categoriesRes.headers.get("content-type") || "";
      if (
        !pType.includes("application/json") ||
        !cType.includes("application/json")
      ) {
        return;
      }
      const productsData = await productsRes.json().catch(() => ({}));
      const categoriesData = await categoriesRes.json().catch(() => ({}));

      setMenuProducts(
        (productsData.products ?? []).map(
          (p: {
            id: string;
            name: string;
            description: string;
            basePrice: number;
            image: string;
            category: string;
            sizePrices?: Record<string, number> | null;
            sizes?: string[] | null;
            hasExtraToppings?: boolean | null;
            hasSauceOptions?: boolean | null;
            sku?: string | null;
            barcode?: string | null;
            stock?: number | null;
          }) => ({
            id: p.id,
            name: p.name,
            description: p.description || p.name,
            basePrice: Number(p.basePrice),
            image: p.image || "deals.png",
            category: p.category,
            ...(p.sizePrices ? { sizePrices: p.sizePrices } : {}),
            ...(p.sizes ? { sizes: p.sizes } : {}),
            ...(p.hasExtraToppings != null
              ? { hasExtraToppings: !!p.hasExtraToppings }
              : {}),
            ...(p.hasSauceOptions != null
              ? { hasSauceOptions: !!p.hasSauceOptions }
              : {}),
            ...(p.sku ? { sku: String(p.sku).trim() } : {}),
            ...(p.barcode ? { barcode: String(p.barcode).trim() } : {}),
            ...(p.stock != null && Number.isFinite(Number(p.stock))
              ? { stock: Number(p.stock) }
              : {}),
          }),
        ),
      );
      setCustomCategories(
        (categoriesData.categories ?? []).map(
          (c: {
            name: string;
            label: string;
            emoji: string;
            image: string;
          }) => ({
            key: c.name,
            label: c.label || c.name,
            emoji: c.emoji || "📦",
            image: c.image || "deals.png",
          }),
        ),
      );
      setCatalogLoaded(true);
    } catch (error) {
      console.error("Failed to load custom catalog", error);
    }
  }, []);

  useEffect(() => {
    void loadCatalog();
    const onCatalogUpdated = () => {
      void loadCatalog();
    };
    window.addEventListener("catalog-updated", onCatalogUpdated);
    return () => {
      window.removeEventListener("catalog-updated", onCatalogUpdated);
    };
  }, [loadCatalog]);

  const allProducts = menuProducts;

  const originalEditingQtyByProduct = useMemo(() => {
    const map = new Map<string, number>();
    if (!editingOrder?.items) return map;
    for (const item of editingOrder.items) {
      const id = String(item.id || "").trim();
      if (!id) continue;
      map.set(id, (map.get(id) ?? 0) + (Number(item.quantity) || 0));
    }
    return map;
  }, [editingOrder]);

  const getEffectiveStock = useCallback(
    (product: Product): number | null => {
      if (product.stock == null) return null;
      const baseStock = Number(product.stock);
      const editAllowance = originalEditingQtyByProduct.get(product.id) ?? 0;
      return Math.max(0, baseStock + editAllowance);
    },
    [originalEditingQtyByProduct],
  );

  const usedQtyByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of cartItems) {
      map.set(item.id, (map.get(item.id) ?? 0) + item.quantity);
    }
    return map;
  }, [cartItems]);

  const stockAlerts = useMemo(() => {
    const threshold = Math.max(0, lowStockThreshold);
    const items: {
      id: string;
      name: string;
      category: string;
      sku?: string;
      remaining: number;
      isOut: boolean;
    }[] = [];

    for (const product of allProducts) {
      const eff = getEffectiveStock(product);
      if (eff === null) continue;
      const inCart = usedQtyByProduct.get(product.id) ?? 0;
      const remaining = Math.max(0, eff - inCart);
      if (remaining === 0 || (threshold > 0 && remaining <= threshold)) {
        items.push({
          id: product.id,
          name: product.name,
          category: product.category,
          sku: product.sku,
          remaining,
          isOut: remaining === 0,
        });
      }
    }

    items.sort((a, b) => a.remaining - b.remaining || a.name.localeCompare(b.name));
    return items;
  }, [allProducts, getEffectiveStock, usedQtyByProduct, lowStockThreshold]);

  const lowStockOnlyCount = useMemo(
    () => stockAlerts.filter((item) => !item.isOut).length,
    [stockAlerts],
  );
  const outOfStockAlertCount = useMemo(
    () => stockAlerts.filter((item) => item.isOut).length,
    [stockAlerts],
  );

  useEffect(() => {
    if (!catalogLoaded) return;

    const currentMap = new Map<string, number>();
    for (const item of stockAlerts) {
      currentMap.set(item.id, item.remaining);
    }

    const prevMap = seenLowStockLevelsRef.current;
    seenLowStockLevelsRef.current = currentMap;

    if (stockAlerts.length === 0) return;

    if (prevMap === null) {
      const first = stockAlerts[0];
      const msg =
        stockAlerts.length === 1
          ? first.isOut
            ? `Stock alert: ${first.name} is out of stock (0 left)`
            : `Low stock alert: ${first.name} has ${first.remaining} left (threshold ≤ ${lowStockThreshold})`
          : `Stock alert: ${stockAlerts.length} items at/below threshold (≤ ${lowStockThreshold} units)`;
      const t = window.setTimeout(() => {
        showNotice(
          msg,
          first.isOut && lowStockOnlyCount === 0 ? "error" : "warning",
          4800,
          {
            href: `/settings?tab=catalog&stock=${lowStockOnlyCount > 0 ? "low" : "out"}`,
            label: "Manage",
          },
        );
      }, 0);
      return () => window.clearTimeout(t);
    }

    const newlyLowered = stockAlerts.filter((item) => {
      const prev = prevMap.get(item.id);
      return prev === undefined || item.remaining < prev;
    });

    if (newlyLowered.length > 0) {
      const lead = newlyLowered[0];
      const msg =
        newlyLowered.length === 1
          ? lead.isOut
            ? `Out of stock: ${lead.name} has 0 remaining`
            : `Low stock alert: ${lead.name} fell to ${lead.remaining} left (threshold ≤ ${lowStockThreshold})`
          : `Low stock alert: ${lead.name} (${lead.remaining} left) & ${newlyLowered.length - 1} more`;
      const t = window.setTimeout(() => {
        showNotice(
          msg,
          lead.isOut ? "error" : "warning",
          4500,
          {
            href: `/settings?tab=catalog&stock=${lead.isOut ? "out" : "low"}`,
            label: "Manage",
          },
        );
      }, 0);
      return () => window.clearTimeout(t);
    }
  }, [
    catalogLoaded,
    stockAlerts,
    lowStockThreshold,
    lowStockOnlyCount,
    showNotice,
  ]);

  const pizzaProducts = useMemo(
    () => allProducts.filter((p) => p.category === "Pizza"),
    [allProducts],
  );

  const categoryTiles = useMemo(() => {
    const builtinKeys = new Set(
      BUILTIN_CATEGORY_TILES.map((c) => c.key.toLowerCase()),
    );
    const overrides = new Map(
      customCategories.map((c) => [c.key.toLowerCase(), c] as const),
    );
    const mergedBuiltins = BUILTIN_CATEGORY_TILES.map((tile) => {
      const override = overrides.get(tile.key.toLowerCase());
      if (!override) return tile;
      return {
        ...tile,
        label: override.label || tile.label,
        emoji: override.emoji || tile.emoji,
        image: override.image || tile.image,
      };
    });
    const extras = customCategories.filter(
      (c) => !builtinKeys.has(c.key.toLowerCase()),
    );
    return [...mergedBuiltins, ...extras];
  }, [customCategories]);

  const togglePizza = (id: string, viaBarcode = false) => {
    const product = pizzaProducts.find((p) => p.id === id);
    if (product) {
      const cap = getEffectiveStock(product);
      if (cap !== null && cap <= 0) {
        showNotice(
          `${product.name} is out of stock (0 remaining) and cannot be added.`,
          "error",
        );
        return;
      }
    }
    setSelection((p) => {
      const closing = p.mode === "pizza" && p.productId === id;
      barcodePendingPizzaIdRef.current = !closing && viaBarcode ? id : null;
      return closing ? { mode: "none" } : { mode: "pizza", productId: id };
    });
  };

  const toggleCategory = (cat: string) => {
    barcodePendingPizzaIdRef.current = null;
    setSelection((p) =>
      p.mode === "category" && p.category === cat
        ? { mode: "none" }
        : { mode: "category", category: cat },
    );
  };

  const addPizzaSize = (productId: string, size: string) => {
    const product = pizzaProducts.find((p) => p.id === productId);
    if (!product) return;
    const cap = getEffectiveStock(product);
    if (cap !== null && cap <= 0) {
      showNotice(
        `${product.name} is out of stock (0 remaining) and cannot be added.`,
        "error",
      );
      return;
    }
    const result = addToCart({
      ...product,
      maxStock: cap,
      cartKey: makeCartKey(product.id, size),
      selectedSize: size,
      selectedTopping: "None",
      selectedSauce: "None",
      price: product.sizePrices?.[size] ?? product.basePrice,
    });
    if (!result.ok) {
      showNotice(
        result.reason === "out_of_stock"
          ? `${product.name} is out of stock (0 remaining).`
          : `Only ${result.available} in stock for ${product.name}.`,
        "error",
      );
      return;
    }
    if (barcodePendingPizzaIdRef.current === product.id) {
      barcodePendingPizzaIdRef.current = null;
      recordBarcodeScanEvent(product);
      showNotice(`Added ${product.name} via barcode`, "success");
    }
  };

  const addSimpleProduct = useCallback(
    (id: string): boolean => {
      const product = allProducts.find((p) => p.id === id);
      if (!product) return false;
      const cap = getEffectiveStock(product);
      if (cap !== null && cap <= 0) {
        showNotice(
          `${product.name} is out of stock (0 remaining) and cannot be added.`,
          "error",
        );
        return false;
      }
      const result = addToCart({
        ...product,
        maxStock: cap,
        cartKey: makeCartKey(product.id),
        price: product.basePrice,
      });
      if (!result.ok) {
        showNotice(
          result.reason === "out_of_stock"
            ? `${product.name} is out of stock (0 remaining).`
            : `Only ${result.available} in stock for ${product.name}.`,
          "error",
        );
        return false;
      }
      return true;
    },
    [allProducts, getEffectiveStock, addToCart, showNotice],
  );

  const query = searchQuery.trim().toLowerCase();
  const isSearching = query.length > 0;
  const searchResults = useMemo(() => {
    if (!isSearching) return [];
    return allProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        (p.sku || "").toLowerCase().includes(query) ||
        (barcodeSearchEnabled &&
          (p.barcode || "").toLowerCase().includes(query)),
    );
  }, [allProducts, isSearching, query, barcodeSearchEnabled]);

  const attemptExactMatch = useCallback(
    (raw: string, fromEnter: boolean) => {
      const q = raw.trim().toLowerCase();
      if (!q) {
        lastAutoMatchRef.current = "";
        return;
      }
      if (!fromEnter && q === lastAutoMatchRef.current) return;

      const byBarcode = barcodeSearchEnabled
        ? allProducts.find(
            (p) => (p.barcode || "").trim().toLowerCase() === q,
          )
        : undefined;
      const exact =
        byBarcode ??
        allProducts.find((p) => (p.sku || "").trim().toLowerCase() === q);

      if (!exact) return;

      lastAutoMatchRef.current = q;

      const cap = getEffectiveStock(exact);
      if (cap !== null && cap <= 0) {
        showNotice(
          `${exact.name} is out of stock (0 remaining) and cannot be added.`,
          "error",
        );
        onSearchChange?.("");
        return;
      }

      if (exact.category === "Pizza") {
        const used = usedQtyByProduct.get(exact.id) ?? 0;
        if (cap !== null && used >= cap) {
          showNotice(`Only ${cap} in stock for ${exact.name}.`, "error");
          onSearchChange?.("");
          return;
        }
        barcodePendingPizzaIdRef.current = byBarcode ? exact.id : null;
        setSelection({ mode: "pizza", productId: exact.id });
        onSearchChange?.("");
        return;
      }

      const added = addSimpleProduct(exact.id);
      if (added && byBarcode) {
        recordBarcodeScanEvent(exact);
        showNotice(`Added ${exact.name} via barcode`, "success");
      }
      onSearchChange?.("");
    },
    [
      allProducts,
      barcodeSearchEnabled,
      getEffectiveStock,
      usedQtyByProduct,
      addSimpleProduct,
      onSearchChange,
      recordBarcodeScanEvent,
      showNotice,
    ],
  );

  // Explicit Enter / scanner submit executes immediately without debounce
  useEffect(() => {
    if (scanSubmitCount === lastScanSubmitCountRef.current) return;
    lastScanSubmitCountRef.current = scanSubmitCount;
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    attemptExactMatch(searchQuery, true);
  }, [scanSubmitCount, searchQuery, attemptExactMatch]);

  // Typed / pasted / scanner-without-Enter auto match after short debounce
  useEffect(() => {
    const raw = searchQuery.trim();
    if (!raw) {
      lastAutoMatchRef.current = "";
      return;
    }
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      attemptExactMatch(searchQuery, false);
    }, 220);

    return () => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [searchQuery, attemptExactMatch]);

  const selectedPizza =
    selection.mode === "pizza"
      ? pizzaProducts.find((p) => p.id === selection.productId)
      : null;
  const subItems =
    selection.mode === "category"
      ? allProducts.filter((p) => p.category === selection.category)
      : [];

  const toastBanner = toast && (
    <div
      role="status"
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl shadow-lg text-sm font-semibold border flex items-center gap-3 max-w-[92vw] ${
        toast.tone === "error"
          ? "bg-red-700 border-red-800 text-white"
          : toast.tone === "success"
            ? "bg-emerald-700 border-emerald-800 text-white"
            : toast.tone === "warning"
              ? "bg-amber-950 border-amber-700 text-amber-50"
              : "bg-gray-900 border-gray-800 text-white"
      }`}
    >
      {toast.tone === "warning" && (
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
      )}
      <span className="truncate">{toast.message}</span>
      {toast.actionHref && toast.actionLabel && (
        <button
          type="button"
          onClick={() => {
            const target = toast.actionHref!;
            setToast(null);
            router.push(target);
          }}
          className="px-2 py-0.5 rounded bg-white/15 hover:bg-white/25 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
        >
          {toast.actionLabel}
        </button>
      )}
      <button
        type="button"
        onClick={() => setToast(null)}
        aria-label="Dismiss notification"
        className="text-white/70 hover:text-white shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );

  const lowStockWidget = stockAlerts.length > 0 && (
    <section
      aria-label="Persistent low stock alert"
      className={`mx-4 mb-2.5 rounded-xl border ${
        outOfStockAlertCount > 0 && lowStockOnlyCount === 0
          ? "bg-red-50/95 border-red-200"
          : "bg-amber-50/95 border-amber-200"
      }`}
    >
      <div className="px-3.5 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {outOfStockAlertCount > 0 && lowStockOnlyCount === 0 ? (
            <PackageX className="w-4 h-4 text-red-700 shrink-0" aria-hidden="true" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
          )}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-800">
            <span className="font-bold text-gray-900">Low Stock Alert</span>
            <span className="text-gray-400" aria-hidden="true">
              ·
            </span>
            {lowStockOnlyCount > 0 && (
              <span className="font-semibold text-amber-900 tabular-nums">
                {lowStockOnlyCount} at/below threshold (≤ {lowStockThreshold})
              </span>
            )}
            {lowStockOnlyCount > 0 && outOfStockAlertCount > 0 && (
              <span className="text-gray-400" aria-hidden="true">
                ·
              </span>
            )}
            {outOfStockAlertCount > 0 && (
              <span className="font-semibold text-red-700 tabular-nums">
                {outOfStockAlertCount} out of stock
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setAlertExpanded((v) => !v)}
            className="px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-xs font-semibold text-gray-800 hover:bg-gray-50 transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0"
          >
            <span>
              {alertExpanded ? "Collapse" : `Show All (${stockAlerts.length})`}
            </span>
            {alertExpanded ? (
              <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
            )}
          </button>
          <Link
            href="/settings?tab=inventory"
            className="px-2.5 py-1 rounded-lg bg-gray-900 text-white text-xs font-semibold hover:bg-gray-800 transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0"
          >
            <SlidersHorizontal className="w-3 h-3" aria-hidden="true" />
            <span>Inventory Settings</span>
          </Link>
        </div>
      </div>

      {alertExpanded && (
        <div className="border-t border-amber-200/70 bg-white/95 rounded-b-xl divide-y divide-gray-100 max-h-44 overflow-y-auto">
          {stockAlerts.map((item) => (
            <div
              key={item.id}
              className="px-3.5 py-2 flex items-center justify-between gap-3 text-xs hover:bg-gray-50/80"
            >
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => onSearchChange?.(item.name)}
                  className="font-semibold text-gray-900 hover:text-[#1565c0] text-left truncate block max-w-full"
                  title="Filter this product in search"
                >
                  {item.name}
                </button>
                <div className="text-[11px] text-gray-500 flex items-center gap-1.5">
                  <span>{item.category}</span>
                  {item.sku && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{item.sku}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`font-mono font-bold tabular-nums ${
                    item.isOut ? "text-red-700" : "text-amber-800"
                  }`}
                >
                  {item.isOut ? "0 left (Out)" : `${item.remaining} left`}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );

  const tileGrid = (
    <div className="flex flex-wrap gap-2 p-3 bg-[#1e3a5f] justify-center">
      {pizzaProducts.map((pizza) => {
        const isSelected =
          selection.mode === "pizza" && selection.productId === pizza.id;
        const shortName = pizza.name.replace(/ Pizza$/i, "");
        const effStock = getEffectiveStock(pizza);
        return (
          <Tile
            key={pizza.id}
            label={shortName}
            image="pizzaa.png"
            sku={pizza.sku}
            stock={effStock}
            selected={isSelected}
            selectedColor="blue"
            appearance={appearance}
            onClick={() => togglePizza(pizza.id)}
          />
        );
      })}
      {categoryTiles.map((cat) => {
        const isSelected =
          selection.mode === "category" && selection.category === cat.key;
        return (
          <Tile
            key={cat.key}
            label={cat.label}
            image={cat.image}
            fallbackEmoji={cat.emoji}
            selected={isSelected}
            selectedColor="orange"
            appearance={appearance}
            onClick={() => toggleCategory(cat.key)}
          />
        );
      })}
    </div>
  );

  if (isSearching) {
    return (
      <div className="flex flex-col min-h-0">
        {toastBanner}
        {lowStockWidget}
        <div className="flex flex-wrap gap-2 p-3 bg-[#1e3a5f] justify-center">
          {searchResults.length === 0 ? (
            <div className="text-center py-16 text-white/60 w-full">
              No products found
            </div>
          ) : (
            searchResults.map((p) => {
              const isPizza = p.category === "Pizza";
              const isSelected =
                selection.mode === "pizza" && selection.productId === p.id;
              const effStock = getEffectiveStock(p);
              const matchedByBarcode =
                barcodeSearchEnabled &&
                Boolean(
                  p.barcode && p.barcode.trim().toLowerCase().includes(query),
                );
              return (
                <Tile
                  key={p.id}
                  label={p.name}
                  image={p.image}
                  sku={p.sku}
                  barcode={barcodeSearchEnabled ? p.barcode : undefined}
                  stock={effStock}
                  selected={isSelected}
                  selectedColor="blue"
                  appearance={appearance}
                  onClick={() => {
                    if (isPizza) {
                      togglePizza(p.id, matchedByBarcode);
                    } else if (addSimpleProduct(p.id) && matchedByBarcode) {
                      recordBarcodeScanEvent(p);
                      showNotice(`Added ${p.name} via barcode`, "success");
                    }
                  }}
                />
              );
            })
          )}
        </div>
        {selectedPizza && (
          <SizePicker
            pizza={selectedPizza}
            effectiveStock={getEffectiveStock(selectedPizza)}
            inCartQty={usedQtyByProduct.get(selectedPizza.id) ?? 0}
            onAdd={addPizzaSize}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-0">
      {toastBanner}
      {lowStockWidget}
      {tileGrid}
      {selection.mode === "pizza" && selectedPizza && (
        <SizePicker
          pizza={selectedPizza}
          effectiveStock={getEffectiveStock(selectedPizza)}
          inCartQty={usedQtyByProduct.get(selectedPizza.id) ?? 0}
          onAdd={addPizzaSize}
        />
      )}
      {selection.mode === "category" && subItems.length > 0 && (
        <SubItemPanel
          category={selection.category}
          items={subItems.map((item) => ({
            ...item,
            effectiveStock: getEffectiveStock(item),
            inCartQty: usedQtyByProduct.get(item.id) ?? 0,
          }))}
          onAdd={(id) => addSimpleProduct(id)}
        />
      )}
    </div>
  );
}

// ── Tile ──────────────────────────────────────────────────────────────────
function Tile({
  label,
  image,
  sku,
  barcode,
  stock,
  fallbackEmoji,
  selected,
  selectedColor,
  appearance,
  onClick,
}: {
  label: string;
  image: string;
  sku?: string;
  barcode?: string;
  stock?: number | null;
  fallbackEmoji?: string;
  selected: boolean;
  selectedColor: "blue" | "orange";
  appearance: MenuAppearanceSettings;
  onClick: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const size = appearance.tileSize;
  const imgH = Math.round(size * 0.64);
  const imgInner = Math.round(size * 0.55);
  const isOutOfStock = stock === 0;
  const ring = selected
    ? selectedColor === "blue"
      ? "border-[#64b5f6] bg-[#bbdefb]"
      : "border-[#ffb74d] bg-[#ffe0b2]"
    : "";

  return (
    <button
      onClick={onClick}
      aria-disabled={isOutOfStock}
      className={`relative flex flex-col items-center justify-start border-2 rounded-xl transition-all overflow-hidden ${
        isOutOfStock
          ? "opacity-70 grayscale-[40%] cursor-not-allowed"
          : "active:scale-95"
      } ${ring || "hover:brightness-95"}`}
      style={{
        width: size,
        minHeight: size,
        backgroundColor: selected ? undefined : appearance.tileBgColor,
        borderColor: isOutOfStock
          ? "#dc2626"
          : selected
            ? undefined
            : appearance.tileBorderColor,
        fontFamily: appearance.fontFamily,
      }}
    >
      <div
        className="w-full flex items-center justify-center relative"
        style={{
          height: imgH,
          backgroundColor: selected ? undefined : "#c8daea",
        }}
      >
        {image && !imgError ? (
          <img
            src={
              image.startsWith("http") || image.startsWith("/")
                ? image
                : `/${image}`
            }
            alt={label}
            onError={() => setImgError(true)}
            className="object-contain"
            style={{ width: imgInner, height: imgInner }}
          />
        ) : (
          <span className="text-2xl">{fallbackEmoji ?? "🍽️"}</span>
        )}
        {isOutOfStock && (
          <span className="absolute inset-x-0 bottom-0 bg-red-600/95 text-white text-[9px] font-bold uppercase tracking-wider py-0.5 text-center">
            Out of Stock
          </span>
        )}
      </div>
      <div className="w-full px-1 py-1 text-center">
        <span
          className="font-bold leading-tight line-clamp-2 block"
          style={{
            fontSize: `${appearance.fontSize}px`,
            color: appearance.tileTextColor,
            fontFamily: appearance.fontFamily,
          }}
        >
          {label}
        </span>
        {sku || barcode ? (
          <span
            className="font-medium block truncate opacity-75 font-mono"
            style={{
              fontSize: `${Math.max(8, appearance.fontSize - 2)}px`,
              color: appearance.tileTextColor,
            }}
          >
            {sku || barcode}
          </span>
        ) : null}
      </div>
    </button>
  );
}

// ── Size picker ───────────────────────────────────────────────────────────
function SizePicker({
  pizza,
  effectiveStock,
  inCartQty,
  onAdd,
}: {
  pizza: {
    id: string;
    name: string;
    sizePrices?: Record<string, number>;
    sizes?: string[];
  };
  effectiveStock: number | null;
  inCartQty: number;
  onAdd: (id: string, size: string) => void;
}) {
  const sizes = pizza.sizes ?? ["S", "M", "L"];
  const isOut = effectiveStock === 0;
  const isAtMax = effectiveStock !== null && inCartQty >= effectiveStock;

  return (
    <div className="border-t-2 border-[#1565c0] bg-white">
      <div className="flex items-center justify-between bg-[#1565c0] px-4 py-2">
        <span className="text-white text-sm font-bold flex-1 text-center">
          {pizza.name}
          {effectiveStock !== null ? (
            <span className="ml-2 text-xs font-medium text-blue-100 tabular-nums">
              · {isOut ? "Out of Stock" : `${effectiveStock - inCartQty} available`}
            </span>
          ) : null}
        </span>
      </div>
      <div className="flex gap-3 p-4 bg-[#e8eef5] justify-center">
        {sizes.map((size) => {
          const price = pizza.sizePrices?.[size];
          const blocked = isOut || isAtMax;
          return (
            <button
              key={size}
              onClick={() => onAdd(pizza.id, size)}
              aria-disabled={blocked}
              className={`flex flex-col items-center border-2 rounded-xl bg-white transition-all overflow-hidden ${
                blocked
                  ? "border-red-300 opacity-75 cursor-not-allowed"
                  : "border-[#b0c4de] hover:border-[#1565c0] active:scale-95"
              }`}
              style={{ width: 110 }}
            >
              <div
                className="w-full flex items-center justify-center bg-[#dce8f5]"
                style={{ height: 70 }}
              >
                <img
                  src="/pizzaa.png"
                  alt={size}
                  className="object-contain"
                  style={{ width: 60, height: 60 }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
              <div className="px-2 py-1 text-center">
                <p className="text-[0.7rem] text-gray-700 font-semibold">
                  {pizza.name.replace(/ Pizza$/i, "")} {size}
                </p>
              </div>
              <div
                className={`w-full text-white text-sm font-bold text-center py-1.5 ${
                  isOut
                    ? "bg-red-600"
                    : isAtMax
                      ? "bg-amber-600"
                      : "bg-[#2e7d32]"
                }`}
              >
                {isOut
                  ? "Out of Stock"
                  : isAtMax
                    ? "Max Stock"
                    : `Rs : ${price ?? "—"}`}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Sub-item panel ────────────────────────────────────────────────────────
function SubItemPanel({
  category,
  items,
  onAdd,
}: {
  category: string;
  items: {
    id: string;
    name: string;
    basePrice: number;
    image: string;
    sku?: string;
    barcode?: string;
    effectiveStock: number | null;
    inCartQty: number;
  }[];
  onAdd: (id: string) => boolean;
}) {
  const [added, setAdded] = useState<string | null>(null);
  const handleAdd = (id: string) => {
    const ok = onAdd(id);
    if (!ok) return;
    setAdded(id);
    setTimeout(() => setAdded(null), 800);
  };
  return (
    <div className="border-t-2 border-[#b84c00] bg-white">
      <div className="flex items-center bg-[#b84c00] px-4 py-2">
        <span className="text-white text-sm font-bold flex-1 text-center">
          {category}
        </span>
      </div>
      <div className="flex flex-wrap gap-3 p-4 bg-[#e8eef5] justify-center">
        {items.map((item) => {
          const isAdded = added === item.id;
          const isOut = item.effectiveStock === 0;
          const isAtMax =
            item.effectiveStock !== null &&
            item.inCartQty >= item.effectiveStock;
          const remaining =
            item.effectiveStock !== null
              ? Math.max(0, item.effectiveStock - item.inCartQty)
              : null;

          return (
            <button
              key={item.id}
              onClick={() => handleAdd(item.id)}
              aria-disabled={isOut || isAtMax}
              className={`flex flex-col items-center border-2 rounded-xl bg-white transition-all overflow-hidden ${
                isOut
                  ? "border-red-300 opacity-75 cursor-not-allowed"
                  : isAdded
                    ? "border-green-500 active:scale-95"
                    : isAtMax
                      ? "border-amber-400 opacity-85 cursor-not-allowed"
                      : "border-[#b0c4de] hover:border-[#b84c00] active:scale-95"
              }`}
              style={{ width: 112 }}
            >
              <div
                className="w-full flex items-center justify-center bg-[#dce8f5]"
                style={{ height: 70 }}
              >
                {item.image ? (
                  <img
                    src={`/${item.image}`}
                    alt={item.name}
                    className={`object-contain ${isOut ? "grayscale" : ""}`}
                    style={{ width: 60, height: 60 }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <span className="text-3xl">🍽️</span>
                )}
              </div>
              <div className="px-2 py-1 text-center flex-1 flex flex-col items-center justify-center">
                <p className="text-[0.7rem] text-gray-700 font-semibold leading-tight">
                  {item.name}
                </p>
                {item.sku ? (
                  <p className="text-[0.58rem] text-gray-500 mt-0.5 truncate w-full font-mono">
                    {item.sku}
                  </p>
                ) : null}
                {remaining !== null && !isOut && (
                  <p className="text-[0.6rem] text-gray-500 font-mono tabular-nums mt-0.5">
                    {remaining} left
                  </p>
                )}
              </div>
              <div
                className={`w-full text-white text-xs font-bold text-center py-1.5 ${
                  isOut
                    ? "bg-red-600"
                    : isAdded
                      ? "bg-green-600"
                      : isAtMax
                        ? "bg-amber-600"
                        : "bg-[#2e7d32]"
                }`}
              >
                {isOut
                  ? "Out of Stock"
                  : isAdded
                    ? "✓ Added"
                    : isAtMax
                      ? `Max (${item.effectiveStock})`
                      : `Rs : ${item.basePrice}`}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
