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
  const { cartItems, removeFromCart, clearCart, updateQuantity, totalPrice } =
    useCart();
  const {
    saveOrder,
    checkoutOrder,
    updateOrder,
    editingOrderId,
    setEditingOrderId,
    savedOrders,
  } = useOrders();
  const router = useRouter();

  const [open, setOpen] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [updating, setUpdating] = useState(false);
  const [orderType, setOrderType] = useState<OrderType>("Delivery");
  const [tableNumber, setTableNumber] = useState<number | null>(null);
  const [orderTypeOpen, setOrderTypeOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [suggestions, setSuggestions] = useState<Customer[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState("");
  const [pendingItems, setPendingItems] = useState<CartItem[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [pendingNotes, setPendingNotes] = useState("");
  const [pendingIsPaid, setPendingIsPaid] = useState(false);
  const [pendingCustomer, setPendingCustomer] = useState<Customer>({
    name: "",
    phone: "",
  });
  const [pendingOrderType, setPendingOrderType] =
    useState<OrderType>("Delivery");
  const [pendingTableNumber, setPendingTableNumber] = useState<number | null>(
    null,
  );

  const isEditMode = !!editingOrderId;

  // Pre-fill notes when entering edit mode
  useEffect(() => {
    if (editingOrderId) {
      const order = savedOrders.find((o) => o.id === editingOrderId);
      if (order?.notes !== undefined) setNotes(order.notes ?? "");
    }
  }, [editingOrderId]);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        nameInputRef.current &&
        !nameInputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Manual scroll — scrollIntoView doesn't work reliably inside overflow containers
  useEffect(() => {
    if (activeIndex < 0 || !suggestionsRef.current) return;
    const container = suggestionsRef.current;
    const itemHeight = 36; // approx px per row
    const containerHeight = container.clientHeight;
    const itemTop = activeIndex * itemHeight;
    const itemBottom = itemTop + itemHeight;
    if (itemBottom > container.scrollTop + containerHeight) {
      container.scrollTop = itemBottom - containerHeight;
    } else if (itemTop < container.scrollTop) {
      container.scrollTop = itemTop;
    }
  }, [activeIndex]);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSuggestions([]);
      return;
    }
    try {
      const res = await fetch(`/api/customers?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.customers ?? []);
      }
    } catch {
      setSuggestions([]);
    }
  }, []);

  const handleCustomerNameChange = (val: string) => {
    setCustomerName(val);
    setActiveIndex(-1);
    setShowSuggestions(true);
    fetchSuggestions(val);
  };

  const selectSuggestion = (c: Customer) => {
    setCustomerName(c.name);
    setCustomerPhone(c.phone);
    setShowSuggestions(false);
    setActiveIndex(-1);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev: number) =>
        prev < suggestions.length - 1 ? prev + 1 : prev,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev: number) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        selectSuggestion(suggestions[activeIndex]);
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      setActiveIndex(-1);
    }
  };

  const saveCustomerIfNew = async () => {
    if (!customerName.trim()) return;
    try {
      await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: customerName.trim(),
          phone: customerPhone.trim(),
        }),
      });
    } catch {
      /* silently ignore */
    }
  };

  const openPrintModal = (
    orderId: string,
    items: CartItem[],
    total: number,
    notes: string,
    isPaid: boolean,
    customer: Customer,
    type: OrderType,
    tableNum: number | null,
  ) => {
    setPendingOrderId(orderId);
    setPendingItems([...items]);
    setPendingTotal(total);
    setPendingNotes(notes);
    setPendingIsPaid(isPaid);
    setPendingCustomer(customer);
    setPendingOrderType(type);
    setPendingTableNumber(tableNum);
    setPrintModalOpen(true);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const resetForm = () => {
    clearCart();
    setNotes("");
    setCustomerName("");
    setCustomerPhone("");
    setOrderType("Delivery");
    setTableNumber(null);
    setOrderTypeOpen(false);
  };

  const buildItems = () =>
    cartItems.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      selectedSize: item.selectedSize,
      selectedTopping: item.selectedTopping,
      selectedSauce: item.selectedSauce,
      price: item.price,
      quantity: item.quantity,
    }));

  const handleUpdateOrder = async () => {
    if (cartItems.length === 0 || !editingOrderId) return;
    setUpdating(true);
    try {
      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderCode: editingOrderId,
          items: buildItems(),
          total: totalPrice,
          notes,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          (errData as { error?: string }).error || `HTTP ${res.status}`,
        );
      }
      updateOrder(editingOrderId, [...cartItems], totalPrice, notes);
      const snap = {
        id: editingOrderId,
        items: [...cartItems],
        total: totalPrice,
        notes,
      };
      const cust = { name: customerName, phone: customerPhone };
      const type = orderType;
      const tbl = tableNumber;
      setEditingOrderId(null);
      resetForm();
      showToast("Order updated!");
      openPrintModal(
        snap.id,
        snap.items,
        snap.total,
        snap.notes,
        false,
        cust,
        type,
        tbl,
      );
      router.push("/Orders");
    } catch (error) {
      showToast(
        `Update failed: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    } finally {
      setUpdating(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingOrderId(null);
    resetForm();
  };

  const handleSaveOrder = async () => {
    if (cartItems.length === 0) return;
    await saveCustomerIfNew();
    const orderId = saveOrder(
      [...cartItems],
      totalPrice,
      notes,
      customerName,
      customerPhone,
      orderType,
      tableNumber,
    );
    try {
      await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderCode: orderId,
          items: buildItems(),
          total: totalPrice,
          notes,
          customerName,
          customerPhone,
          orderType,
          tableNumber,
        }),
      });
    } catch (error) {
      console.error("Failed to persist saved order", error);
    }
    const snap = {
      id: orderId,
      items: [...cartItems],
      total: totalPrice,
      notes,
    };
    const cust = { name: customerName, phone: customerPhone };
    const type = orderType;
    const tbl = tableNumber;
    resetForm();
    showToast("Order saved!");
    openPrintModal(
      snap.id,
      snap.items,
      snap.total,
      snap.notes,
      false,
      cust,
      type,
      tbl,
    );
  };

  const handleCheckout = async () => {
    if (cartItems.length === 0) return;
    await saveCustomerIfNew();
    const orderId = saveOrder(
      [...cartItems],
      totalPrice,
      notes,
      customerName,
      customerPhone,
      orderType,
      tableNumber,
    );
    try {
      await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderCode: orderId,
          items: buildItems(),
          total: totalPrice,
          notes,
          customerName,
          customerPhone,
          orderType,
          tableNumber,
        }),
      });
      await fetch("/api/orders/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderCode: orderId }),
      });
    } catch (error) {
      console.error("Failed to persist checkout", error);
    }
    checkoutOrder(orderId);
    const snap = {
      id: orderId,
      items: [...cartItems],
      total: totalPrice,
      notes,
    };
    const cust = { name: customerName, phone: customerPhone };
    const type = orderType;
    const tbl = tableNumber;
    resetForm();
    showToast("Order checked out!");
    openPrintModal(
      snap.id,
      snap.items,
      snap.total,
      snap.notes,
      true,
      cust,
      type,
      tbl,
    );
  };

  return (
    <div>
      <PrintModal
        isOpen={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        cartItems={pendingItems}
        totalPrice={pendingTotal}
        notes={pendingNotes}
        orderId={pendingOrderId}
        isPaid={pendingIsPaid}
        customer={pendingCustomer}
        orderType={pendingOrderType}
        tableNumber={pendingTableNumber}
      />

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg">
          {toast}
        </div>
      )}

      <button
        onClick={() => setOpen(!open)}
        className="fixed top-4 right-4 z-50 bg-amber-900 text-white px-3 py-2 rounded-lg md:hidden shadow-lg"
      >
        🧾
      </button>

      <aside
        className={`fixed top-0 right-0 h-screen bg-white text-black w-72 shadow-xl z-40 flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${open ? "translate-x-0" : "translate-x-full"} md:translate-x-0`}
      >
        <div className="px-4 py-3 text-sm text-center font-semibold tracking-wide border-b border-gray-100 bg-amber-900 text-white">
          Billing
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#f5efe7]">
          {cartItems.length === 0 ? (
            <div className="text-center text-gray-400 py-16 flex flex-col items-center gap-2">
              <span className="text-4xl">🛒</span>
              <p className="text-sm">No items added yet</p>
            </div>
          ) : (
            cartItems.map((item) => (
              <div
                key={item.cartKey}
                className="bg-white rounded-2xl p-3 border border-[#f1e5d8] shadow-sm"
              >
                <div className="flex gap-3">
                  <div className="w-10 h-14 rounded-xl bg-gradient-to-b from-[#e0d2c4] to-[#c9b39a]" />
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-sm text-gray-900 leading-tight">
                          {item.name}
                          {item.selectedSize && item.selectedSize !== "N/A" && (
                            <span className="text-gray-500 font-normal">
                              {" "}
                              · {item.selectedSize}
                            </span>
                          )}
                        </h3>
                        {((item.selectedTopping &&
                          item.selectedTopping !== "None") ||
                          (item.selectedSauce &&
                            item.selectedSauce !== "None")) && (
                          <div className="flex gap-1 flex-wrap mt-1">
                            {item.selectedTopping &&
                              item.selectedTopping !== "None" && (
                                <span className="text-[0.65rem] bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded-full">
                                  {item.selectedTopping}
                                </span>
                              )}
                            {item.selectedSauce &&
                              item.selectedSauce !== "None" && (
                                <span className="text-[0.65rem] bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded-full">
                                  {item.selectedSauce}
                                </span>
                              )}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => removeFromCart(item.cartKey)}
                        className="text-gray-400 hover:text-red-500 transition-colors text-2xl leading-none w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-50 shrink-0"
                      >
                        ×
                      </button>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        x{item.quantity}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            updateQuantity(item.cartKey, item.quantity - 1)
                          }
                          className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 text-xs font-bold flex items-center justify-center"
                        >
                          −
                        </button>
                        <span className="text-sm font-semibold w-4 text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            updateQuantity(item.cartKey, item.quantity + 1)
                          }
                          className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 text-xs font-bold flex items-center justify-center"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                  <span className="font-semibold text-sm text-gray-900 shrink-0">
                    Rs. {(item.price * item.quantity).toFixed(0)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Bottom panel */}
        <div
          className="border-t border-gray-100 px-4 py-3 bg-white space-y-2 overflow-visible"
          style={{ position: "relative", zIndex: 10 }}
        >
          <div className="flex justify-between text-base font-semibold text-gray-900">
            <span>Total</span>
            <span>Rs. {totalPrice.toFixed(0)}</span>
          </div>

          {/* Order type — collapsed dropdown */}
          <div>
            <button
              onClick={() => setOrderTypeOpen((v) => !v)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors text-xs"
            >
              <span className="flex items-center gap-1.5 font-medium text-gray-700">
                <span>
                  {ORDER_TYPE_OPTIONS.find((o) => o.label === orderType)?.emoji}
                </span>
                <span>
                  {orderType}
                  {orderType === "Dine In" && tableNumber
                    ? ` · Table #${tableNumber}`
                    : ""}
                </span>
              </span>
              <span
                className={`text-gray-400 transition-transform duration-200 ${orderTypeOpen ? "rotate-180" : ""}`}
              >
                ▾
              </span>
            </button>

            {orderTypeOpen && (
              <div className="mt-1 border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                {ORDER_TYPE_OPTIONS.map(({ label, emoji }) => (
                  <button
                    key={label}
                    onClick={() => {
                      setOrderType(label);
                      if (label !== "Dine In") {
                        setTableNumber(null);
                        setOrderTypeOpen(false);
                      }
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors border-b border-gray-50 last:border-0
                      ${orderType === label ? "bg-amber-50 text-amber-900 font-semibold" : "text-gray-700 hover:bg-gray-50"}`}
                  >
                    <span>{emoji}</span>
                    <span>{label}</span>
                    {orderType === label && (
                      <span className="ml-auto text-amber-900">✓</span>
                    )}
                  </button>
                ))}
                {/* Table number picker — only when Dine In selected */}
                {orderType === "Dine In" && (
                  <div className="px-3 py-2 bg-amber-50 border-t border-amber-100">
                    <p className="text-[0.6rem] text-amber-700 font-medium mb-1.5 uppercase tracking-wide">
                      Table Number
                    </p>
                    <div className="grid grid-cols-5 gap-1">
                      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                        <button
                          key={n}
                          onClick={() => {
                            setTableNumber(n);
                            setOrderTypeOpen(false);
                          }}
                          className={`h-7 rounded-lg text-xs font-bold transition-all border
                            ${
                              tableNumber === n
                                ? "bg-amber-900 text-white border-amber-900"
                                : "bg-white text-gray-700 border-gray-200 hover:bg-amber-100"
                            }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Customer name with autocomplete */}
          <div className="relative">
            <input
              ref={nameInputRef}
              type="text"
              value={customerName}
              onChange={(e) => handleCustomerNameChange(e.target.value)}
              onFocus={() => {
                if (customerName) setShowSuggestions(true);
              }}
              onKeyDown={handleNameKeyDown}
              placeholder="👤 Customer name..."
              autoComplete="off"
              className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-900/20"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div
                ref={suggestionsRef}
                className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-[999] overflow-y-auto"
                style={{ maxHeight: "108px" }}
              >
                {suggestions.map((c, i) => {
                  const isActive = i === activeIndex;
                  return (
                    <button
                      key={i}
                      onMouseDown={() => selectSuggestion(c)}
                      onMouseEnter={() => setActiveIndex(i)}
                      style={{ height: "36px" }}
                      className={`w-full text-left px-3 flex justify-between items-center border-b border-gray-50 last:border-0 shrink-0
                        ${isActive ? "bg-amber-100 text-amber-900" : "hover:bg-amber-50 text-gray-900"}`}
                    >
                      <span className="text-xs font-semibold truncate">
                        {c.name}
                      </span>
                      <span className="text-[0.65rem] text-gray-400 ml-2 shrink-0">
                        {c.phone}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Phone */}
          <input
            type="text"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder="📞 Phone number..."
            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-900/20"
          />

          {/* Notes */}
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="📝 Order notes (optional)..."
            rows={2}
            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-amber-900/20"
          />

          {/* Buttons */}
          <div className="space-y-1.5">
            {isEditMode ? (
              <>
                <div className="text-xs text-center text-blue-600 font-semibold bg-blue-50 rounded-lg py-1.5 px-2">
                  ✏️ Editing order {editingOrderId?.slice(-6).toUpperCase()}
                </div>
                <button
                  onClick={handleUpdateOrder}
                  disabled={cartItems.length === 0 || updating}
                  className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {updating ? "Updating…" : "💾 Update Order"}
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="w-full bg-gray-200 text-gray-700 py-1.5 rounded-lg hover:bg-gray-300 transition-colors text-[0.7rem]"
                >
                  Cancel Edit
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleSaveOrder}
                  disabled={cartItems.length === 0}
                  className="w-full bg-gray-900 text-white py-2 rounded-lg hover:bg-gray-800 text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  💾 Save Order
                </button>
                <button
                  onClick={handleCheckout}
                  disabled={cartItems.length === 0}
                  className="w-full bg-amber-900 text-white py-2 rounded-lg hover:bg-amber-800 text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ✅ Checkout
                </button>
                <button
                  onClick={clearCart}
                  className="w-full bg-gray-200 text-gray-700 py-1.5 rounded-lg hover:bg-gray-300 transition-colors text-[0.7rem]"
                >
                  Clear Cart
                </button>
              </>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
