"use client";

import { useState } from "react";
import { useOrders } from "../context/OrdersContext";
import { useCart } from "../context/CartContext";
import { useRouter } from "next/navigation";
import PrintModal from "../components/PrintModal";
import { CartItem } from "../context/CartContext";

export default function OrdersPage() {
  const { savedOrders, checkoutOrder, deleteOrder, setEditingOrder } =
    useOrders();
  const { loadOrder } = useCart();
  const router = useRouter();

  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [receiptSearch, setReceiptSearch] = useState("");
  const [printOrder, setPrintOrder] = useState<{
    id: string;
    items: CartItem[];
    total: number;
    notes: string;
    instructions: string;
    isPaid: boolean;
    customer?: { name: string; phone: string };
    orderType?: string;
    tableNumber?: number | null;
    placedAt?: string | null;
  } | null>(null);

  const formatLocalDateTime = (value?: string | null) => {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString();
  };

  const openPrint = (order: (typeof savedOrders)[0], isPaid: boolean) => {
    setPrintOrder({
      id: order.id,
      items: order.items,
      total: order.total,
      notes: order.notes ?? "",
      instructions: order.instructions ?? "",
      isPaid,
      customer: order.customerName
        ? { name: order.customerName, phone: order.customerPhone ?? "" }
        : undefined,
      orderType: order.orderType,
      tableNumber: order.tableNumber,
      placedAt: order.createdAt ?? null,
    });
    setPrintModalOpen(true);
  };

  const handleEdit = (orderId: string) => {
    const order = savedOrders.find((o) => o.id === orderId);
    if (!order) return;
    loadOrder(order.items);
    setEditingOrder({
      id: order.id,
      status: "saved",
      notes: order.notes,
      instructions: order.instructions,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      orderType: order.orderType,
      tableNumber: order.tableNumber,
      createdAt: order.createdAt,
    });
    router.push("/");
  };

  const handleDelete = async (orderId: string) => {
    if (!confirm(`Delete saved order ${orderId}? This cannot be undone.`)) {
      return;
    }
    try {
      await fetch(`/api/orders?orderCode=${encodeURIComponent(orderId)}`, {
        method: "DELETE",
      });
    } catch (error) {
      console.error("Failed to delete order from database", error);
    }
    deleteOrder(orderId);
  };

  const handleCheckout = async (orderId: string) => {
    const order = savedOrders.find((o) => o.id === orderId);
    try {
      await fetch("/api/orders/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderCode: orderId }),
      });
    } catch (error) {
      console.error("Failed to checkout order in database", error);
    }
    checkoutOrder(orderId);
    if (order) openPrint(order, true);
  };

  const filteredOrders = receiptSearch.trim()
    ? savedOrders.filter((o) => {
        const q = receiptSearch.trim().toLowerCase();
        return (
          o.id.toLowerCase().includes(q) ||
          (o.customerName ?? "").toLowerCase().includes(q) ||
          (o.customerPhone ?? "").toLowerCase().includes(q)
        );
      })
    : savedOrders;

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      {printOrder && (
        <PrintModal
          isOpen={printModalOpen}
          onClose={() => setPrintModalOpen(false)}
          cartItems={printOrder.items}
          totalPrice={printOrder.total}
          notes={printOrder.notes}
          instructions={printOrder.instructions}
          orderId={printOrder.id}
          isPaid={printOrder.isPaid}
          customer={printOrder.customer}
          orderType={printOrder.orderType}
          tableNumber={printOrder.tableNumber}
          placedAt={printOrder.placedAt}
        />
      )}

      {/* ── Nav bar ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">📋 Saved Orders</h1>
        <div className="flex gap-2">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1a3a5c] text-white text-sm font-semibold hover:bg-[#1565c0] active:scale-95 transition-all"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
            Menu
          </button>
          <button
            onClick={() => router.push("/History")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1a5c2a] text-white text-sm font-semibold hover:bg-green-700 active:scale-95 transition-all"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            History
          </button>
        </div>
      </div>

      <div className="p-6 max-w-3xl">
        <p className="text-sm text-gray-400 mb-4">
          Orders saved from billing. Checkout when ready.
        </p>

        <div className="bg-white rounded-2xl border border-gray-100 p-3 mb-4 flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-700">Search:</span>
          <input
            type="text"
            value={receiptSearch}
            onChange={(e) => setReceiptSearch(e.target.value)}
            placeholder="Receipt #, customer name, or phone"
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 min-w-[220px] flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          {receiptSearch.trim() && (
            <button
              type="button"
              onClick={() => setReceiptSearch("")}
              className="px-3 py-2 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200"
            >
              Clear
            </button>
          )}
        </div>

        {filteredOrders.length === 0 ? (
          <div className="text-center py-20 text-gray-400 flex flex-col items-center gap-3">
            <span className="text-5xl">📭</span>
            <p className="text-base">
              {receiptSearch.trim()
                ? "No saved orders match that search."
                : "No saved orders yet."}
            </p>
            <p className="text-sm">
              {receiptSearch.trim()
                ? "Try receipt #, customer name, or phone."
                : 'Use "Save Order" in the billing panel.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5"
              >
                <div className="flex justify-between items-start mb-4 gap-4">
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <p className="font-bold text-gray-900 text-sm">
                        {order.id}
                      </p>
                      <span className="text-xs bg-amber-100 text-amber-800 font-semibold px-2.5 py-1 rounded-full flex-shrink-0">
                        Saved
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mb-1">
                      {formatLocalDateTime(order.createdAt)}
                    </p>
                    <div className="flex flex-wrap gap-1 mb-1">
                      {order.orderType && (
                        <span className="text-sm font-semibold bg-amber-50 text-amber-800 font-semibold px-2 py-0.5 rounded-full border border-amber-100">
                          {order.orderType === "Dine In" && order.tableNumber
                            ? `🍽️ Dine In · Table #${order.tableNumber}`
                            : order.orderType === "Delivery"
                              ? "🛵 Delivery"
                              : order.orderType === "Dine In"
                                ? "🍽️ Dine In"
                                : "🥡 Take Away"}
                        </span>
                      )}
                      {order.customerName && (
                        <span className="text-sm font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-100">
                          👤 {order.customerName}
                        </span>
                      )}
                      {order.customerPhone && (
                        <span className="text-sm font-semibold bg-gray-50 text-gray-600 px-2 py-0.5 rounded-full border border-gray-100">
                          📞 {order.customerPhone}
                        </span>
                      )}
                    </div>
                    {order.notes && (
                      <p className="text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-2 py-1">
                        📝 {order.notes}
                      </p>
                    )}
                    {order.instructions && (
                      <p className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-2 py-1 mt-1">
                        📌 {order.instructions}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  {order.items.map((item, i) => (
                    <div
                      key={i}
                      className="flex justify-between items-center text-sm text-gray-700"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-gray-400 text-xs">
                          ×{item.quantity}
                        </span>
                        <span>{item.name}</span>
                        {item.selectedSize && item.selectedSize !== "N/A" && (
                          <span className="text-xs text-gray-400">
                            ({item.selectedSize})
                          </span>
                        )}
                        {item.selectedTopping &&
                          item.selectedTopping !== "None" && (
                            <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full">
                              {item.selectedTopping}
                            </span>
                          )}
                        {item.selectedSauce &&
                          item.selectedSauce !== "None" && (
                            <span className="text-xs bg-yellow-100 text-yellow-600 px-1.5 py-0.5 rounded-full">
                              {item.selectedSauce}
                            </span>
                          )}
                      </div>
                      <span className="font-medium">
                        Rs. {(item.price * item.quantity).toFixed(0)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
                  <span className="font-bold text-gray-900">
                    Total: Rs. {order.total.toFixed(0)}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openPrint(order, false)}
                      className="text-sm px-3 py-2 rounded-xl bg-green-300 hover:bg-green-100 text-gray-600 transition-colors active:scale-95"
                    >
                      🖨️ Print
                    </button>
                    <button
                      onClick={() => handleEdit(order.id)}
                      className="text-sm px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 font-semibold transition-colors active:scale-95"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => handleDelete(order.id)}
                      className="text-sm px-3 py-2 rounded-xl bg-gray-100 hover:bg-red-100 hover:text-red-600 text-gray-600 transition-colors active:scale-95"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => handleCheckout(order.id)}
                      className="text-sm px-4 py-2 rounded-xl bg-amber-700 hover:bg-green-600 text-white font-semibold transition-colors active:scale-95"
                    >
                      Cash
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
