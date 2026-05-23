"use client";
import { useCart } from "../context/CartContext";
import { useOrders } from "../context/OrdersContext";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import PrintModal from "./PrintModal";
import { CartItem } from "../context/CartContext";

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
  const [pendingOrderId, setPendingOrderId] = useState("");
  const [pendingItems, setPendingItems] = useState<CartItem[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [pendingNotes, setPendingNotes] = useState("");
  const [pendingInstructions, setPendingInstructions] = useState("");
  const [pendingIsPaid, setPendingIsPaid] = useState(false);
  const [pendingCustomer, setPendingCustomer] = useState<Customer>({ name: "", phone: "" });
  const [pendingOrderType, setPendingOrderType] = useState<OrderType>("Delivery");
  const [pendingTableNumber, setPendingTableNumber] = useState<number | null>(null);
  const [now, setNow] = useState(() => new Date());
  const minuteIntervalRef = useRef<number | null>(null);

  const isEditMode = !!editingOrderId;

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
    const msUntilNextMinute =
      (60 - new Date().getSeconds()) * 1000 - new Date().getMilliseconds();
    const firstTick = window.setTimeout(() => {
      setNow(new Date());
      minuteIntervalRef.current = window.setInterval(() => {
        setNow(new Date());
      }, 60_000);
    }, msUntilNextMinute);

    return () => {
      window.clearTimeout(firstTick);
      if (minuteIntervalRef.current !== null) {
        window.clearInterval(minuteIntervalRef.current);
      }
    };
  }, []);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (!q.trim()) { setSuggestions([]); return; }
    try {
      const res = await fetch(`/api/customers?q=${encodeURIComponent(q)}`);
      if (res.ok) { const data = await res.json(); setSuggestions(data.customers ?? []); }
    } catch { setSuggestions([]); }
  }, []);

  const handleCustomerNameChange = (val: string) => {
    setCustomerName(val); setActiveIndex(-1); setCustomerSaved(false);
    setShowSuggestions(true); fetchSuggestions(val);
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

  const openPrintModal = (orderId: string, items: CartItem[], total: number, notes: string, instructionsValue: string, isPaid: boolean, customer: Customer, type: OrderType, tableNum: number | null) => {
    setPendingOrderId(orderId); setPendingItems([...items]); setPendingTotal(total);
    setPendingNotes(notes); setPendingInstructions(instructionsValue); setPendingIsPaid(isPaid); setPendingCustomer(customer);
    setPendingOrderType(type); setPendingTableNumber(tableNum); setPrintModalOpen(true);
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

  const finishEdit = (
    snap: { id: string; items: CartItem[]; total: number; notes: string; instructions: string },
    cust: Customer,
    isPaid: boolean,
    destination: "/Orders" | "/History",
  ) => {
    setEditingOrder(null);
    resetForm();
    openPrintModal(
      snap.id,
      snap.items,
      snap.total,
      snap.notes,
      snap.instructions,
      isPaid,
      cust,
      orderType,
      tableNumber,
    );
    router.push(destination);
  };

  /** Save edit — keeps or moves order to the saved (unpaid) list. */
  const handleEditSave = async () => {
    if (cartItems.length === 0 || !editingOrderId || !editingOrder) return;
    setUpdating(true);
    try {
      const wasCheckedOut = editingOrder.status === "checkedout";
      await patchEditingOrder(wasCheckedOut ? "saved" : undefined);

      const finalCustomerName = isWalkIn ? "Walk-In Customer" : customerName.trim();
      const snap = {
        id: editingOrderId,
        items: [...cartItems],
        total: totalPrice,
        notes,
        instructions,
      };
      const cust = { name: finalCustomerName, phone: customerPhone.trim() };

      if (wasCheckedOut) {
        await reloadSavedOrders();
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
        );
      }

      showToast(wasCheckedOut ? "Order moved to saved list" : "Order saved!");
      finishEdit(snap, cust, false, "/Orders");
    } catch (error) {
      showToast(
        `Save failed: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    } finally {
      setUpdating(false);
    }
  };

  /** Pay — checkout (or keep checked out) after editing. */
  const handleEditPay = async () => {
    if (cartItems.length === 0 || !editingOrderId || !editingOrder) return;
    setUpdating(true);
    try {
      const wasSaved = editingOrder.status === "saved";
      await patchEditingOrder();

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
      }

      showToast(wasSaved ? "Order checked out!" : "Order updated!");
      finishEdit(snap, cust, true, "/History");
    } catch (error) {
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

  const handleSaveOrder = async () => {
    if (cartItems.length === 0) return;
    const finalCustomerName = isWalkIn ? "Walk-In Customer" : customerName;
    const createdAtClient = new Date().toISOString();
    const orderId = saveOrder([...cartItems], totalPrice, notes, instructions, finalCustomerName, customerPhone, orderType, tableNumber);
    try {
      await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderCode: orderId, items: buildItems(), total: totalPrice, notes, instructions, customerName: finalCustomerName, customerPhone, orderType, tableNumber, createdAtClient }) });
    } catch (error) { console.error("Failed to persist saved order", error); }
    const snap = { id: orderId, items: [...cartItems], total: totalPrice, notes, instructions };
    const cust = { name: finalCustomerName, phone: customerPhone };
    resetForm(); showToast("Order saved!");
    openPrintModal(snap.id, snap.items, snap.total, snap.notes, snap.instructions, false, cust, orderType, tableNumber);
  };

  const handleCheckout = async () => {
    if (cartItems.length === 0) return;
    const finalCustomerName = isWalkIn ? "Walk-In Customer" : customerName;
    const createdAtClient = new Date().toISOString();
    const orderId = saveOrder([...cartItems], totalPrice, notes, instructions, finalCustomerName, customerPhone, orderType, tableNumber);
    // Save order to DB first (as "saved"), then immediately checkout — separate catches
    // so a failure in one doesn't silently skip the other
    try {
      await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderCode: orderId, items: buildItems(), total: totalPrice, notes, instructions, customerName: finalCustomerName, customerPhone, orderType, tableNumber, createdAtClient }) });
    } catch (error) { console.error("Failed to persist order", error); }
    try {
      await fetch("/api/orders/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderCode: orderId }) });
    } catch (error) { console.error("Failed to checkout order", error); }
    checkoutOrder(orderId);
    const snap = { id: orderId, items: [...cartItems], total: totalPrice, notes, instructions };
    const cust = { name: finalCustomerName, phone: customerPhone };
    resetForm(); showToast("Order checked out!");
    openPrintModal(snap.id, snap.items, snap.total, snap.notes, snap.instructions, true, cust, orderType, tableNumber);
  };

  const currentDate = `${String(now.getDate()).padStart(2,"0")}-${String(now.getMonth()+1).padStart(2,"0")}-${now.getFullYear()}`;
  const currentTime = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;

  return (
    <aside className="w-[340px] flex-shrink-0 h-screen bg-white flex flex-col border-r border-gray-200 shadow-sm">
      <PrintModal isOpen={printModalOpen} onClose={() => setPrintModalOpen(false)} cartItems={pendingItems} totalPrice={pendingTotal} notes={pendingNotes} instructions={pendingInstructions} orderId={pendingOrderId} isPaid={pendingIsPaid} customer={pendingCustomer} orderType={pendingOrderType} tableNumber={pendingTableNumber} />

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg">{toast}</div>
      )}

      {/* ── TOP BAR ── */}
      <div className="px-3 py-3 border-b border-gray-100 space-y-2.5">
        {/* Row 1: Customer + date + nav */}
        <div className="flex items-center gap-2">
          {/* Customer dropdown */}
          <div className="relative flex-1" ref={customerDropdownRef}>
            <button
              onClick={() => setCustomerDropdownOpen((v) => !v)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 transition-colors w-full text-left shadow-sm active:scale-[0.99]"
            >
              <span className="text-base">👤</span>
              <span className="text-sm font-medium text-gray-700 flex-1 truncate">
                {isWalkIn ? "Walk-In Customer" : (customerName || "Walk-In Customer")}
              </span>
              <svg className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${customerDropdownOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {customerDropdownOpen && (
              <div className="absolute top-full left-0 z-[999] mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl p-3 w-72">
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => { setIsWalkIn(true); setCustomerName("Walk-In Customer"); setCustomerPhone(""); setCustomerDropdownOpen(false); }}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all active:scale-95 ${isWalkIn ? "bg-blue-600 text-white border-blue-600" : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"}`}
                  >Walk-In</button>
                  <button
                    onClick={() => { setIsWalkIn(false); if (customerName === "Walk-In Customer") setCustomerName(""); setTimeout(() => nameInputRef.current?.focus(), 50); }}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all active:scale-95 ${!isWalkIn ? "bg-blue-600 text-white border-blue-600" : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"}`}
                  >Named Customer</button>
                </div>

                {!isWalkIn && (
                  <div className="space-y-2">
                    <div className="relative">
                      <input ref={nameInputRef} type="text" value={customerName} onChange={(e) => handleCustomerNameChange(e.target.value)} onFocus={() => { if (customerName) setShowSuggestions(true); }} onKeyDown={handleNameKeyDown} placeholder="Customer name..." autoComplete="off"
                        className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300" />
                      {showSuggestions && suggestions.length > 0 && (
                        <div ref={suggestionsRef} className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-[1000] overflow-y-auto" style={{ maxHeight: "144px" }}>
                          {suggestions.map((c, i) => (
                            <button key={i} onMouseDown={() => selectSuggestion(c)} onMouseEnter={() => setActiveIndex(i)} style={{ height: "44px" }}
                              className={`w-full text-left px-3 flex justify-between items-center border-b border-gray-50 last:border-0 shrink-0 ${i === activeIndex ? "bg-blue-50 text-blue-800" : "hover:bg-gray-50 text-gray-900"}`}>
                              <span className="text-sm font-semibold truncate">{c.name}</span>
                              <span className="text-xs text-gray-400 ml-2 shrink-0">{c.phone}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input type="text" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Phone number..."
                        className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300" />
                      <button onClick={saveCustomerIfNew} disabled={isSavingCustomer || customerSaved || !customerName.trim()}
                        className={`px-3 py-2.5 rounded-xl text-sm font-semibold border whitespace-nowrap transition-all active:scale-95 ${customerSaved ? "bg-green-50 text-green-700 border-green-200" : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"} disabled:opacity-50`}>
                        {isSavingCustomer ? "…" : customerSaved ? "✓ Saved" : "+ Save"}
                      </button>
                    </div>
                    <button onClick={() => setCustomerDropdownOpen(false)} className="w-full py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors active:scale-[0.99]">Confirm</button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Date/time */}
          <div className="flex items-center gap-1 px-1.5 py-2.5 rounded-xl bg-gray-50 border border-gray-300 text-xs text-gray-500 whitespace-nowrap flex-shrink-0">
            <span>📅</span>
            <span>{currentDate} {currentTime}</span>
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
                    <span className="text-sm font-bold text-gray-800 w-5 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.cartKey, item.quantity + 1)}
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
                className="py-3.5 rounded-xl bg-gray-800 text-white text-sm font-bold hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99]"
              >
                {updating ? "…" : "💾 Save"}
              </button>
              <button
                onClick={handleEditPay}
                disabled={cartItems.length === 0 || updating}
                className="py-3.5 rounded-xl bg-amber-600 text-white text-sm font-bold hover:bg-amber-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99]"
              >
                {updating ? "…" : "✅ Pay"}
              </button>
            </div>
            <p className="text-[0.65rem] text-gray-400 text-center leading-snug">
              Save moves a cashed order back to the saved list. Pay keeps it completed.
            </p>
            <button
              onClick={handleCancelEdit}
              className="w-full bg-gray-100 text-gray-600 py-3 rounded-xl hover:bg-gray-200 transition-colors text-sm font-semibold active:scale-[0.99]"
            >
              Cancel Edit
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <button onClick={clearCart}
              className="py-3.5 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200 transition-colors active:scale-[0.99]">
              Clear
            </button>
            <button onClick={handleSaveOrder} disabled={cartItems.length === 0}
              className="py-3.5 rounded-xl bg-gray-800 text-white text-sm font-bold hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99]">
              💾 Save
            </button>
            <button onClick={handleCheckout} disabled={cartItems.length === 0}
              className="py-3.5 rounded-xl bg-amber-600 text-white text-sm font-bold hover:bg-amber-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99]">
              ✅ Pay
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}