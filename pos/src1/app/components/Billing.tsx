"use client";
import { useCart } from "../context/CartContext";
import { useOrders } from "../context/OrdersContext";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import PrintModal from "./PrintModal";
import { CartItem } from "../context/CartContext";
import {
  getShortcuts,
  SHORTCUTS_CHANGED_EVENT,
  type ShortcutsMap,
  DEFAULT_SHORTCUTS,
} from "../../lib/shortcuts";

type OrderType = "Delivery" | "Dine In" | "Take Away";
type Customer = { id?: number; name: string; phone: string };

const ORDER_TYPE_OPTIONS: { label: OrderType; emoji: string }[] = [
  { label: "Delivery", emoji: "🛵" },
  { label: "Dine In", emoji: "🍽️" },
  { label: "Take Away", emoji: "🥡" },
];

export default function Billing() {
  const { cartItems, removeFromCart, clearCart, updateQuantity, updatePrice, totalPrice } =
    useCart();
  const {
    saveOrder,
    checkoutOrder,
    deleteOrder,
    updateOrder,
    editingOrder,
    editingOrderId,
    setEditingOrder,
    reloadSavedOrders,
  } = useOrders();
  const router = useRouter();

  const [toast, setToast] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [instructions, setInstructions] = useState("");
  const [updating, setUpdating] = useState(false);
  const [catalogStockMap, setCatalogStockMap] = useState<
    Map<string, number | null>
  >(() => new Map());
  const [catalogBarcodeMap, setCatalogBarcodeMap] = useState<
    Map<string, string>
  >(() => new Map());
  const [orderType, setOrderType] = useState<OrderType>("Delivery");
  const [tableNumber, setTableNumber] = useState<number | null>(null);
  const [orderTypeOpen, setOrderTypeOpen] = useState(false);
  const [tablePickerOpen, setTablePickerOpen] = useState(false);

  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [customerName, setCustomerName] = useState("Walk-In Customer");
  const [customerPhone, setCustomerPhone] = useState("");
  const [isWalkIn, setIsWalkIn] = useState(true);
  const [suggestions, setSuggestions] = useState<Customer[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  const [customerSaved, setCustomerSaved] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const customerDropdownRef = useRef<HTMLDivElement>(null);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printOrderData, setPrintOrderData] = useState<{
    id: string;
    items: CartItem[];
    total: number;
    notes: string;
    instructions: string;
    isPaid: boolean;
    customer: Customer;
    orderType: OrderType;
    tableNumber: number | null;
    placedAt: string;
    destination?: "/Orders" | "/History";
  } | null>(null);

  const openPrintDialog = (
    orderId: string,
    items: CartItem[],
    total: number,
    notes: string,
    instructions: string,
    isPaid: boolean,
    customer: Customer,
    orderType: OrderType,
    tableNumber: number | null,
    placedAt: string,
    destination?: "/Orders" | "/History",
  ) => {
    setPrintOrderData({
      id: orderId,
      items: [...items],
      total,
      notes,
      instructions,
      isPaid,
      customer,
      orderType,
      tableNumber,
      placedAt,
      destination,
    });
    setPrintModalOpen(true);
  };

  const handleClosePrintModal = () => {
    const dest = printOrderData?.destination;
    setPrintModalOpen(false);
    setPrintOrderData(null);
    if (dest) {
      router.push(dest);
    }
  };
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const isEditMode = !!editingOrderId;

  const refreshCatalogStock = useCallback(async () => {
    try {
      const res = await fetch("/api/catalog/products?menu=1");
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      const stockMap = new Map<string, number | null>();
      const barcodeMap = new Map<string, string>();
      for (const p of data.products ?? []) {
        stockMap.set(String(p.id), p.stock == null ? null : Number(p.stock));
        if (p.barcode) {
          barcodeMap.set(String(p.id), String(p.barcode));
        }
      }
      setCatalogStockMap(stockMap);
      setCatalogBarcodeMap(barcodeMap);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    void refreshCatalogStock();
    const onCatalogUpdated = () => {
      void refreshCatalogStock();
    };
    window.addEventListener("catalog-updated", onCatalogUpdated);
    return () => {
      window.removeEventListener("catalog-updated", onCatalogUpdated);
    };
  }, [refreshCatalogStock]);

  useEffect(() => {
    if (!editingOrder) return;

    setNotes(editingOrder.notes ?? "");
    setInstructions(editingOrder.instructions ?? "");

    const resolvedName = editingOrder.customerName?.trim() || "Walk-In Customer";
    const isWalkInCustomer = resolvedName === "Walk-In Customer";
    setCustomerName(resolvedName);
    setCustomerPhone(editingOrder.customerPhone ?? "");
    setIsWalkIn(isWalkInCustomer);

    const validOrderType = (
      editingOrder.orderType === "Delivery" ||
      editingOrder.orderType === "Dine In" ||
      editingOrder.orderType === "Take Away"
    )
      ? editingOrder.orderType
      : "Delivery";
    setOrderType(validOrderType);
    setTableNumber(
      validOrderType === "Dine In" ? (editingOrder.tableNumber ?? null) : null,
    );
  }, [editingOrder]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target as Node)) {
        setCustomerDropdownOpen(false);
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (activeIndex < 0 || !suggestionsRef.current) return;
    const container = suggestionsRef.current;
    const itemHeight = 36;
    const containerHeight = container.clientHeight;
    const itemTop = activeIndex * itemHeight;
    const itemBottom = itemTop + itemHeight;
    if (itemBottom > container.scrollTop + containerHeight) container.scrollTop = itemBottom - containerHeight;
    else if (itemTop < container.scrollTop) container.scrollTop = itemTop;
  }, [activeIndex]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const fetchSuggestions = useCallback(async (q: string) => {
    try {
      const url = q.trim()
        ? `/api/customers?q=${encodeURIComponent(q)}`
        : `/api/customers?all=1`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setSuggestions((data.customers ?? []).slice(0, 12));
      }
    } catch { setSuggestions([]); }
  }, []);

  const handleCustomerNameChange = (val: string) => {
    setCustomerName(val); setActiveIndex(-1); setCustomerSaved(false);
    setShowSuggestions(true); fetchSuggestions(val);
  };

  const handleCustomerPhoneChange = (val: string) => {
    setCustomerPhone(val); setActiveIndex(-1); setCustomerSaved(false);
    if (val.trim()) {
      setShowSuggestions(true);
      fetchSuggestions(val);
    } else if (!customerName.trim()) {
      setShowSuggestions(false);
      setSuggestions([]);
    }
  };

  const selectSuggestion = (c: Customer) => {
    setCustomerName(c.name); setCustomerPhone(c.phone);
    setShowSuggestions(false); setActiveIndex(-1);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((prev) => prev < suggestions.length - 1 ? prev + 1 : prev); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((prev) => prev > 0 ? prev - 1 : 0); }
    else if (e.key === "Enter") { e.preventDefault(); if (activeIndex >= 0 && activeIndex < suggestions.length) selectSuggestion(suggestions[activeIndex]); }
    else if (e.key === "Escape") { setShowSuggestions(false); setActiveIndex(-1); }
  };

  const saveCustomerIfNew = async () => {
    if (!customerName.trim() || isWalkIn) return;
    setIsSavingCustomer(true);
    try {
      await fetch("/api/customers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: customerName.trim(), phone: customerPhone.trim() }) });
      setCustomerSaved(true);
    } catch { } finally { setIsSavingCustomer(false); }
  };


  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const resetForm = () => {
    clearCart(); setNotes(""); setInstructions(""); setCustomerName("Walk-In Customer"); setCustomerPhone("");
    setIsWalkIn(true); setCustomerSaved(false); setOrderType("Delivery");
    setTableNumber(null); setOrderTypeOpen(false); setCustomerDropdownOpen(false);
  };

  const buildItems = () => cartItems.map((item) => ({
    id: item.id, name: item.name, category: item.category,
    selectedSize: item.selectedSize, selectedTopping: item.selectedTopping,
    selectedSauce: item.selectedSauce, price: item.price, quantity: item.quantity,
  }));

  const patchEditingOrder = async (status?: "saved" | "checkedout") => {
    if (!editingOrderId || !editingOrder) {
      throw new Error("No order being edited");
    }
    const finalCustomerName = isWalkIn ? "Walk-In Customer" : customerName.trim();
    const body: Record<string, unknown> = {
      orderCode: editingOrderId,
      items: buildItems(),
      total: totalPrice,
      notes,
      instructions,
      customerName: finalCustomerName,
      customerPhone: customerPhone.trim(),
      orderType,
      tableNumber: orderType === "Dine In" ? tableNumber : null,
    };
    if (status) body.status = status;

    const res = await fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(
        (errData as { error?: string }).error || `HTTP ${res.status}`,
      );
    }
  };

  const [shortcuts, setShortcuts] = useState<ShortcutsMap>(DEFAULT_SHORTCUTS);

  useEffect(() => {
    setShortcuts(getShortcuts());
    const onShortcutsChange = (e: Event) => {
      const customEvent = e as CustomEvent<ShortcutsMap>;
      if (customEvent.detail) setShortcuts(customEvent.detail);
      else setShortcuts(getShortcuts());
    };
    window.addEventListener(SHORTCUTS_CHANGED_EVENT, onShortcutsChange);
    return () => window.removeEventListener(SHORTCUTS_CHANGED_EVENT, onShortcutsChange);
  }, []);

  const originalEditingQtyByProduct = useCallback(() => {
    const map = new Map<string, number>();
    if (!editingOrder?.items) return map;
    for (const item of editingOrder.items) {
      const id = String(item.id || "").trim();
      if (!id) continue;
      map.set(id, (map.get(id) ?? 0) + (Number(item.quantity) || 0));
    }
    return map;
  }, [editingOrder]);

  const getAvailableStockForCartItem = useCallback(
    (productId: string, fallbackStock?: number | null): number | null => {
      const hasLive = catalogStockMap.has(productId);
      const raw = hasLive
        ? catalogStockMap.get(productId)
        : (fallbackStock ?? null);
      if (raw == null) return null;
      const editAllowance = originalEditingQtyByProduct().get(productId) ?? 0;
      return Math.max(0, Number(raw) + editAllowance);
    },
    [catalogStockMap, originalEditingQtyByProduct],
  );

  const handleIncrementQuantity = (item: CartItem) => {
    const cap = getAvailableStockForCartItem(item.id, item.stock);
    if (cap !== null) {
      if (cap <= 0) {
        showToast(`${item.name} is out of stock (0 remaining).`);
        return;
      }
      const totalUsed = cartItems
        .filter((ci) => ci.id === item.id)
        .reduce((sum, ci) => sum + ci.quantity, 0);
      if (totalUsed + 1 > cap) {
        showToast(`Only ${cap} in stock for ${item.name}.`);
        return;
      }
    }
    const res = updateQuantity(item.cartKey, item.quantity + 1, cap);
    if (!res.ok) {
      showToast(
        res.reason === "out_of_stock"
          ? `${item.name} is out of stock (0 remaining).`
          : `Only ${res.available} in stock for ${item.name}.`,
      );
    }
  };

  const finishEdit = async (
    snap: { id: string; items: CartItem[]; total: number; notes: string; instructions: string },
    cust: Customer,
    isPaid: boolean,
    destination: "/Orders" | "/History",
  ) => {
    const placedAt = editingOrder?.createdAt ?? new Date().toISOString();
    setEditingOrder(null);
    resetForm();
    openPrintDialog(
      snap.id,
      snap.items,
      snap.total,
      snap.notes,
      snap.instructions,
      isPaid,
      cust,
      orderType,
      tableNumber,
      placedAt,
      destination,
    );
  };

  /** Save edit — moves order to Saved Orders (status: 'saved') and navigates to /Orders. */
  const handleEditSave = async () => {
    if (cartItems.length === 0 || !editingOrderId || !editingOrder) return;
    setUpdating(true);
    try {
      // User requirement: When editing ANY order (including cash orders), clicking Save moves it to saved orders!
      await patchEditingOrder("saved");
      window.dispatchEvent(new Event("catalog-updated"));

      const finalCustomerName = isWalkIn ? "Walk-In Customer" : customerName.trim();
      const snap = {
        id: editingOrderId,
        items: [...cartItems],
        total: totalPrice,
        notes,
        instructions,
      };
      const cust = { name: finalCustomerName, phone: customerPhone.trim() };

      updateOrder(
        editingOrderId,
        snap.items,
        snap.total,
        snap.notes,
        snap.instructions,
        finalCustomerName,
        cust.phone,
        orderType,
        orderType === "Dine In" ? tableNumber : null,
        "saved",
      );
      void reloadSavedOrders();
      showToast("Order moved to Saved Orders!");
      await finishEdit(snap, cust, false, "/Orders");
    } catch (error) {
      window.dispatchEvent(new Event("catalog-updated"));
      showToast(
        `Save failed: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    } finally {
      setUpdating(false);
    }
  };

  /** Pay — keeps or moves order to Cash / History (status: 'checkedout') and navigates to /History. */
  const handleEditPay = async () => {
    if (cartItems.length === 0 || !editingOrderId || !editingOrder) return;
    setUpdating(true);
    try {
      const wasSaved = editingOrder.status === "saved";
      await patchEditingOrder("checkedout");
      window.dispatchEvent(new Event("catalog-updated"));

      const finalCustomerName = isWalkIn ? "Walk-In Customer" : customerName.trim();
      const snap = {
        id: editingOrderId,
        items: [...cartItems],
        total: totalPrice,
        notes,
        instructions,
      };
      const cust = { name: finalCustomerName, phone: customerPhone.trim() };

      if (wasSaved) {
        try {
          await fetch("/api/orders/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderCode: editingOrderId }),
          });
        } catch (error) {
          console.error("Failed to checkout order", error);
        }
        checkoutOrder(editingOrderId);
      } else {
        updateOrder(
          editingOrderId,
          snap.items,
          snap.total,
          snap.notes,
          snap.instructions,
          finalCustomerName,
          cust.phone,
          orderType,
          orderType === "Dine In" ? tableNumber : null,
          "checkedout",
        );
      }
      void reloadSavedOrders();
      showToast(wasSaved ? "Order checked out!" : "Order saved in Cash / History!");
      await finishEdit(snap, cust, true, "/History");
    } catch (error) {
      window.dispatchEvent(new Event("catalog-updated"));
      showToast(
        `Pay failed: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    } finally {
      setUpdating(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingOrder(null);
    resetForm();
  };

  const validateCartStockBeforeOrder = (): string | null => {
    const qtyByProd = new Map<string, { name: string; qty: number; fallbackStock?: number | null }>();
    for (const item of cartItems) {
      const existing = qtyByProd.get(item.id);
      if (existing) {
        existing.qty += item.quantity;
      } else {
        qtyByProd.set(item.id, {
          name: item.name,
          qty: item.quantity,
          fallbackStock: item.stock,
        });
      }
    }
    for (const [id, entry] of qtyByProd.entries()) {
      const cap = getAvailableStockForCartItem(id, entry.fallbackStock);
      if (cap !== null && cap <= 0) {
        return `${entry.name} is out of stock (0 remaining).`;
      }
      if (cap !== null && entry.qty > cap) {
        return `Only ${cap} left in stock for ${entry.name}.`;
      }
    }
    return null;
  };

  const handleSaveOrder = async () => {
    if (cartItems.length === 0 || updating) return;
    const stockIssue = validateCartStockBeforeOrder();
    if (stockIssue) {
      showToast(stockIssue);
      return;
    }
    setUpdating(true);
    try {
      const finalCustomerName = isWalkIn ? "Walk-In Customer" : customerName;
      const createdAtClient = new Date().toISOString();
      const orderId = saveOrder([...cartItems], totalPrice, notes, instructions, finalCustomerName, customerPhone, orderType, tableNumber);
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderCode: orderId,
          items: buildItems(),
          total: totalPrice,
          notes,
          instructions,
          customerName: finalCustomerName,
          customerPhone,
          orderType,
          tableNumber,
          createdAtClient,
        }),
      });
      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as { error?: string };
        deleteOrder(orderId);
        void reloadSavedOrders();
        window.dispatchEvent(new Event("catalog-updated"));
        showToast(errData.error || "Failed to save order");
        return;
      }
      window.dispatchEvent(new Event("catalog-updated"));
      const snap = { id: orderId, items: [...cartItems], total: totalPrice, notes, instructions };
      const cust = { name: finalCustomerName, phone: customerPhone };
      resetForm();
      showToast("💾 Order saved!");
      openPrintDialog(
        orderId,
        snap.items,
        snap.total,
        snap.notes,
        snap.instructions,
        false,
        cust,
        orderType,
        tableNumber,
        createdAtClient,
      );
    } catch (error) {
      console.error("Failed to persist saved order", error);
      void reloadSavedOrders();
      showToast("Failed to save order");
    } finally {
      setUpdating(false);
    }
  };

  const handleCheckout = async () => {
    if (cartItems.length === 0 || updating) return;
    const stockIssue = validateCartStockBeforeOrder();
    if (stockIssue) {
      showToast(stockIssue);
      return;
    }
    setUpdating(true);
    try {
      const finalCustomerName = isWalkIn ? "Walk-In Customer" : customerName;
      const createdAtClient = new Date().toISOString();
      const orderId = saveOrder([...cartItems], totalPrice, notes, instructions, finalCustomerName, customerPhone, orderType, tableNumber);
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderCode: orderId,
          items: buildItems(),
          total: totalPrice,
          notes,
          instructions,
          customerName: finalCustomerName,
          customerPhone,
          orderType,
          tableNumber,
          createdAtClient,
        }),
      });
      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as { error?: string };
        deleteOrder(orderId);
        void reloadSavedOrders();
        window.dispatchEvent(new Event("catalog-updated"));
        showToast(errData.error || "Failed to place order");
        return;
      }
      try {
        await fetch("/api/orders/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderCode: orderId }),
        });
      } catch (error) {
        console.error("Failed to checkout order", error);
      }
      checkoutOrder(orderId);
      window.dispatchEvent(new Event("catalog-updated"));
      const snap = { id: orderId, items: [...cartItems], total: totalPrice, notes, instructions };
      const cust = { name: finalCustomerName, phone: customerPhone };
      resetForm();
      showToast("✅ Order checked out!");
      openPrintDialog(
        orderId,
        snap.items,
        snap.total,
        snap.notes,
        snap.instructions,
        true,
        cust,
        orderType,
        tableNumber,
        createdAtClient,
      );
    } catch (error) {
      console.error("Failed to persist order", error);
      showToast("Checkout failed");
    } finally {
      setUpdating(false);
    }
  };

  // Global keyboard shortcuts (configured in Settings > Shortcuts)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input or textarea
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isInput = targetTag === "input" || targetTag === "textarea" || (e.target as HTMLElement)?.isContentEditable;
      if (isInput && !e.altKey && !e.ctrlKey) return;

      const key = e.key.toLowerCase();
      const match = (cfg: { key: string; altKey: boolean; ctrlKey: boolean }) =>
        key === cfg.key.toLowerCase() &&
        Boolean(e.altKey) === Boolean(cfg.altKey) &&
        Boolean(e.ctrlKey) === Boolean(cfg.ctrlKey);

      if (match(shortcuts.newOrder)) {
        e.preventDefault();
        if (isEditMode) {
          handleCancelEdit();
        } else {
          clearCart();
          resetForm();
        }
        showToast("New order ready");
        router.push("/");
      } else if (match(shortcuts.saveOrder)) {
        e.preventDefault();
        if (cartItems.length === 0) {
          showToast("Cart is empty! Add items first.");
          return;
        }
        if (isEditMode) {
          void handleEditSave();
        } else {
          void handleSaveOrder();
        }
      } else if (match(shortcuts.payOrder)) {
        e.preventDefault();
        if (cartItems.length === 0) {
          showToast("Cart is empty! Add items first.");
          return;
        }
        if (isEditMode) {
          void handleEditPay();
        } else {
          void handleCheckout();
        }
      } else if (match(shortcuts.history)) {
        e.preventDefault();
        router.push("/History");
      } else if (match(shortcuts.orders)) {
        e.preventDefault();
        router.push("/Orders");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    shortcuts,
    isEditMode,
    cartItems,
    customerName,
    customerPhone,
    isWalkIn,
    notes,
    instructions,
    orderType,
    tableNumber,
    editingOrderId,
    editingOrder,
    updating,
    router,
    clearCart,
    resetForm,
    handleEditSave,
    handleEditPay,
    handleSaveOrder,
    handleCheckout,
  ]);

  const currentDate = mounted
    ? `${String(now.getDate()).padStart(2, "0")}-${String(now.getMonth() + 1).padStart(2, "0")}-${now.getFullYear()}`
    : "";
  const currentTime = mounted
    ? `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`
    : "";

  return (
    <aside className="w-[340px] flex-shrink-0 h-screen bg-white flex flex-col border-r border-gray-200 shadow-sm">
      {printOrderData && (
        <PrintModal
          isOpen={printModalOpen}
          onClose={handleClosePrintModal}
          cartItems={printOrderData.items}
          totalPrice={printOrderData.total}
          notes={printOrderData.notes}
          instructions={printOrderData.instructions}
          orderId={printOrderData.id}
          isPaid={printOrderData.isPaid}
          customer={printOrderData.customer}
          orderType={printOrderData.orderType}
          tableNumber={printOrderData.tableNumber}
          placedAt={printOrderData.placedAt}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg">{toast}</div>
      )}

      {/* ── TOP BAR ── */}
      <div className="px-3 py-3 border-b border-gray-100 space-y-2.5">
        {/* Row 1: Customer + date + nav */}
        <div className="flex items-center gap-2">
          {/* Customer dropdown */}
          <div className="relative flex-1" ref={customerDropdownRef}>
            <div
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 transition-colors w-full shadow-sm"
              style={{
                paddingLeft: "4px",
                paddingRight: "9px",
                paddingTop: "7px",
                marginLeft: "-2px",
                paddingBottom: "7px",
                width: "195.613px",
              }}
            >
              <span
                className="text-base flex-shrink-0"
                style={{ backgroundColor: "#f1f1f1" }}
              >
                👤
              </span>
              <input
                ref={nameInputRef}
                type="text"
                value={isWalkIn ? "" : customerName}
                placeholder="Walk-In Customer"
                autoComplete="off"
                onFocus={() => {
                  setCustomerDropdownOpen(true);
                  setShowSuggestions(true);
                  void fetchSuggestions(isWalkIn ? "" : customerName);
                }}
                onChange={(e) => {
                  setIsWalkIn(false);
                  setCustomerDropdownOpen(true);
                  handleCustomerNameChange(e.target.value);
                  if (!e.target.value.trim()) {
                    setIsWalkIn(true);
                    setCustomerName("Walk-In Customer");
                    setCustomerPhone("");
                    void fetchSuggestions("");
                  }
                }}
                onKeyDown={handleNameKeyDown}
                className="flex-1 min-w-0 text-sm font-medium text-gray-700 bg-transparent outline-none placeholder:text-gray-500"
              />
            </div>

            {customerDropdownOpen && (
              <div className="absolute top-full left-0 z-[999] mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl p-3 w-72">
                <button
                  onClick={() => { setIsWalkIn(true); setCustomerName("Walk-In Customer"); setCustomerPhone(""); setShowSuggestions(false); setSuggestions([]); setCustomerDropdownOpen(false); }}
                  className={`w-full py-2.5 mb-2 rounded-xl text-sm font-semibold border transition-all active:scale-95 ${isWalkIn ? "bg-blue-600 text-white border-blue-600" : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"}`}
                >Walk-In Customer</button>

                <div className="space-y-2">
                  {!isWalkIn && (
                    <div className="flex gap-2">
                      <input type="text" value={customerPhone} onChange={(e) => handleCustomerPhoneChange(e.target.value)} onFocus={() => { if (customerPhone || customerName) setShowSuggestions(true); }} placeholder="Phone number..."
                        className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300" />
                      <button onClick={saveCustomerIfNew} disabled={isSavingCustomer || customerSaved || !customerName.trim()}
                        className={`px-3 py-2.5 rounded-xl text-sm font-semibold border whitespace-nowrap transition-all active:scale-95 ${customerSaved ? "bg-green-50 text-green-700 border-green-200" : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"} disabled:opacity-50`}>
                        {isSavingCustomer ? "…" : customerSaved ? "✓ Saved" : "+ Save"}
                      </button>
                    </div>
                  )}
                  {showSuggestions && suggestions.length > 0 && (
                    <div ref={suggestionsRef} className="bg-white border border-gray-200 rounded-xl shadow-xl overflow-y-auto" style={{ maxHeight: "176px" }}>
                      {suggestions.map((c, i) => (
                        <button key={c.id ?? i} onMouseDown={() => { setIsWalkIn(false); selectSuggestion(c); setCustomerDropdownOpen(false); }} onMouseEnter={() => setActiveIndex(i)} style={{ height: "44px" }}
                          className={`w-full text-left px-3 flex justify-between items-center border-b border-gray-50 last:border-0 shrink-0 ${i === activeIndex ? "bg-blue-50 text-blue-800" : "hover:bg-gray-50 text-gray-900"}`}>
                          <span className="text-sm font-semibold truncate">{c.name}</span>
                          <span className="text-xs text-gray-400 ml-2 shrink-0">{c.phone}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {!isWalkIn && (
                    <button onClick={() => setCustomerDropdownOpen(false)} className="w-full py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors active:scale-[0.99]">Confirm</button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Date/time */}
          <div
            suppressHydrationWarning
            className="flex items-center gap-0.5 px-1 py-2.5 rounded-xl bg-gray-50 border border-gray-300 text-xs text-gray-500 whitespace-nowrap flex-shrink-0"
            style={{
              width: "124.113px",
              height: "35.6px",
              fontSize: "14px",
              fontWeight: "bold",
              marginLeft: "-2px",
            }}
          >
            <span className="text-[10px] leading-none flex-shrink-0">📅</span>
            <span
              suppressHydrationWarning
              className="tabular-nums tracking-tighter"
              style={{
                height: "14.5px",
                fontSize: "11.5px",
                fontWeight: "bold",
                lineHeight: "12.5px",
                textAlign: "left",
                fontStyle: "normal",
              }}
            >
              {mounted ? `${currentDate} ${currentTime}` : "\u00A0"}
            </span>
          </div>


        </div>

        {/* Row 2: Invoice type + Order type + Table button */}
        <div className="flex items-center gap-2">
          <div className="px-3 py-2.5 rounded-xl bg-blue-50 border border-blue-200 text-sm font-semibold text-blue-700 whitespace-nowrap">Billing Invoice</div>

          {/* Order type */}
          <div className="relative flex-1">
            <button onClick={() => { setOrderTypeOpen((v) => !v); setTablePickerOpen(false); }}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 shadow-sm transition-colors text-sm active:scale-[0.99]">
              <span className="flex items-center gap-1.5 font-medium text-gray-700">
                <span>{ORDER_TYPE_OPTIONS.find((o) => o.label === orderType)?.emoji}</span>
                <span>{orderType}</span>
              </span>
              <span className={`text-gray-400 text-xs transition-transform duration-200 ${orderTypeOpen ? "rotate-180" : ""}`}>▾</span>
            </button>
            {orderTypeOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 border border-gray-200 rounded-xl overflow-hidden bg-white shadow-lg z-50">
                {ORDER_TYPE_OPTIONS.map(({ label, emoji }) => (
                  <button key={label} onClick={() => { setOrderType(label); if (label !== "Dine In") setTableNumber(null); setOrderTypeOpen(false); }}
                    className={`w-full flex items-center gap-2 px-4 py-3 text-sm transition-colors border-b border-gray-50 last:border-0 ${orderType === label ? "bg-amber-50 text-amber-900 font-semibold" : "text-gray-700 hover:bg-gray-50"}`}>
                    <span>{emoji}</span><span>{label}</span>
                    {orderType === label && <span className="ml-auto text-amber-900">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Table button — only shown for Dine In */}
          {orderType === "Dine In" && (
            <button
              onClick={() => { setTablePickerOpen((v) => !v); setOrderTypeOpen(false); }}
              className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-bold whitespace-nowrap transition-all active:scale-95 ${tablePickerOpen ? "bg-amber-900 text-white border-amber-900" : tableNumber ? "bg-amber-100 text-amber-900 border-amber-300" : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"}`}
            >
              <span>🪑</span>
              <span>{tableNumber ? `T${tableNumber}` : "Table"}</span>
            </button>
          )}
        </div>

        {/* Table picker panel — full width, opens below row 2 */}
        {orderType === "Dine In" && tablePickerOpen && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-sm text-amber-800 font-bold mb-3 uppercase tracking-wide">Select Table</p>
            <div className="grid grid-cols-5 gap-2.5">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => { setTableNumber(n); setTablePickerOpen(false); }}
                  className={`h-14 rounded-xl text-xl font-bold transition-all border-2 active:scale-95 ${tableNumber === n ? "bg-amber-900 text-white border-amber-900 shadow-md" : "bg-white text-gray-800 border-gray-200 hover:bg-amber-100 hover:border-amber-400"}`}
                >{n}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── CART TABLE HEADER ── */}
      <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
        {isEditMode && (
          <div className="text-xs text-center text-blue-600 font-semibold bg-blue-50 rounded-lg py-1 px-2 mb-2">
            ✏️ Editing {editingOrder?.status === "checkedout" ? "completed" : "saved"} order{" "}
            {editingOrderId?.slice(-6).toUpperCase()}
          </div>
        )}
        <div className="grid text-[0.62rem] font-semibold text-gray-400 uppercase tracking-wide" style={{ gridTemplateColumns: "1fr 80px 76px 40px" }}>
          <span>Product</span>
          <span className="text-center">Quantity</span>
          <span className="text-right">Price inc. tax</span>
          <span></span>
        </div>
      </div>

      {/* ── CART ITEMS ── */}
      <div className="flex-1 overflow-y-auto">
        {cartItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-3 pb-8">
            <div className="text-5xl opacity-40">🛒</div>
            <p className="text-sm font-medium text-gray-400">Cart is empty</p>
            <p className="text-xs text-gray-300">Add items from the menu</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {cartItems.map((item) => (
              <div key={item.cartKey} className="px-3 py-3 hover:bg-gray-50/80 transition-colors">
                <div className="grid items-center gap-1" style={{ gridTemplateColumns: "1fr 80px 76px 40px" }}>
                  {/* Product info */}
                  <div>
                    <p className="text-sm font-semibold text-gray-900 leading-tight">
                      {item.name}
                      {item.selectedSize && item.selectedSize !== "N/A" && (
                        <span className="text-gray-400 font-normal"> · {item.selectedSize}</span>
                      )}
                    </p>
                    {item.sku || item.barcode || catalogBarcodeMap.get(item.id) ? (
                      <p className="text-[0.65rem] text-gray-400 mt-0.5 font-mono">
                        {[
                          item.sku ? `SKU: ${item.sku}` : null,
                          item.barcode || catalogBarcodeMap.get(item.id)
                            ? `Barcode: ${item.barcode || catalogBarcodeMap.get(item.id)}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    ) : null}
                    {((item.selectedTopping && item.selectedTopping !== "None") || (item.selectedSauce && item.selectedSauce !== "None")) && (
                      <div className="flex gap-1 flex-wrap mt-0.5">
                        {item.selectedTopping && item.selectedTopping !== "None" && (
                          <span className="text-[0.65rem] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded-full">{item.selectedTopping}</span>
                        )}
                        {item.selectedSauce && item.selectedSauce !== "None" && (
                          <span className="text-[0.65rem] bg-yellow-50 text-yellow-600 px-1.5 py-0.5 rounded-full">{item.selectedSauce}</span>
                        )}
                      </div>
                    )}
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="text-xs text-gray-400">Price</span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={item.price}
                        onChange={(e) =>
                          updatePrice(item.cartKey, Number(e.target.value))
                        }
                        className="w-20 text-xs border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-gray-700"
                      />
                    </div>
                  </div>

                  {/* Qty controls — big touch targets */}
                  <div className="flex items-center justify-center gap-1.5">
                    <button
                      onClick={() => updateQuantity(item.cartKey, item.quantity - 1)}
                      className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-red-50 hover:text-red-500 text-base font-bold flex items-center justify-center text-gray-600 transition-colors active:scale-95"
                    >−</button>
                    <span className="text-sm font-bold text-gray-800 w-5 text-center tabular-nums">{item.quantity}</span>
                    <button
                      onClick={() => handleIncrementQuantity(item)}
                      className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-green-50 hover:text-green-600 text-base font-bold flex items-center justify-center text-gray-600 transition-colors active:scale-95"
                    >+</button>
                  </div>

                  {/* Subtotal */}
                  <p className="text-sm font-bold text-gray-900 text-right">
                    Rs. {(item.price * item.quantity).toFixed(0)}
                  </p>

                  {/* Remove — big touch target */}
                  <div className="flex justify-end">
                    <button
                      onClick={() => removeFromCart(item.cartKey)}
                      className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors active:scale-95"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── BOTTOM PANEL ── */}
      <div className="border-t border-gray-200 bg-white px-3 py-3 space-y-2">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="📝 Order notes (optional)..." rows={1}
          className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-gray-600 placeholder:text-gray-400" />
        <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="📌 Instructions (optional)..." rows={1}
          className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-gray-600 placeholder:text-gray-400" />

        <div className="flex justify-between items-center py-1 border-t border-gray-100">
          <span className="text-sm font-semibold text-gray-500">Total</span>
          <span className="text-xl font-bold text-gray-900">Rs. {totalPrice.toFixed(0)}</span>
        </div>

        {isEditMode ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleEditSave}
                disabled={cartItems.length === 0 || updating}
                className="py-3 rounded-xl bg-gray-800 text-white text-xs font-bold hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99] flex flex-col items-center justify-center gap-0.5"
                title={`Save (${shortcuts.saveOrder.label})`}
              >
                <span>{updating ? "…" : "💾 Save"}</span>
                <span className="text-[10px] text-gray-400 font-mono font-normal">{shortcuts.saveOrder.label}</span>
              </button>
              <button
                onClick={handleEditPay}
                disabled={cartItems.length === 0 || updating}
                className="py-3 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99] flex flex-col items-center justify-center gap-0.5"
                title={`Pay (${shortcuts.payOrder.label})`}
              >
                <span>{updating ? "…" : "✅ Pay"}</span>
                <span className="text-[10px] text-amber-200 font-mono font-normal">{shortcuts.payOrder.label}</span>
              </button>
            </div>
            <p className="text-[0.65rem] text-gray-400 text-center leading-snug">
              Saving updates the order and opens the receipt.
            </p>
            <button
              onClick={handleCancelEdit}
              className="w-full bg-gray-100 text-gray-600 py-2.5 rounded-xl hover:bg-gray-200 transition-colors text-xs font-semibold active:scale-[0.99] flex items-center justify-center gap-1.5"
              title={`Cancel Edit / New Order (${shortcuts.newOrder.label})`}
            >
              <span>Cancel Edit</span>
              <kbd className="text-[10px] bg-gray-200 px-1.5 py-0.5 rounded font-mono">{shortcuts.newOrder.label}</kbd>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <button onClick={clearCart}
              disabled={updating}
              className="py-2.5 rounded-xl bg-gray-100 text-gray-600 text-xs font-semibold hover:bg-gray-200 transition-colors disabled:opacity-40 active:scale-[0.99] flex flex-col items-center justify-center gap-0.5"
              title={`New Order / Clear (${shortcuts.newOrder.label})`}>
              <span>Clear</span>
              <span className="text-[10px] text-gray-400 font-mono font-normal">{shortcuts.newOrder.label}</span>
            </button>
            <button onClick={handleSaveOrder} disabled={cartItems.length === 0 || updating}
              className="py-2.5 rounded-xl bg-gray-800 text-white text-xs font-bold hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99] flex flex-col items-center justify-center gap-0.5"
              title={`Save Order (${shortcuts.saveOrder.label})`}>
              <span>{updating ? "…" : "💾 Save"}</span>
              <span className="text-[10px] text-gray-400 font-mono font-normal">{shortcuts.saveOrder.label}</span>
            </button>
            <button onClick={handleCheckout} disabled={cartItems.length === 0 || updating}
              className="py-2.5 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99] flex flex-col items-center justify-center gap-0.5"
              title={`Pay / Checkout (${shortcuts.payOrder.label})`}>
              <span>{updating ? "…" : "✅ Pay"}</span>
              <span className="text-[10px] text-amber-200 font-mono font-normal">{shortcuts.payOrder.label}</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}