"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PrintModal from "../components/PrintModal";
import { CartItem } from "../context/CartContext";

type SalesSummary = {
  businessDate: string | null;
  totalRevenue: number;
  totalOrders: number;
  totalItems: number;
  allTimeRevenue: number;
  allTimeOrders: number;
  allTimeItems: number;
};

export default function HistoryPage() {
  const router = useRouter();
  const [businessDate, setBusinessDate] = useState("");
  const [sales, setSales] = useState<SalesSummary | null>(null);
  const [orders, setOrders] = useState<any[]>([]);

  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printOrder, setPrintOrder] = useState<{
    id: string;
    items: CartItem[];
    total: number;
    notes: string;
    customer?: { name: string; phone: string };
    orderType?: string;
    tableNumber?: number | null;
  } | null>(null);

  const openPrint = (order: any) => {
    const items: CartItem[] = (order.items || []).map((item: any) => ({
      ...item,
      cartKey:
        item.cartKey ??
        `${item.name}-${item.selectedSize}-${item.selectedTopping}-${item.selectedSauce}`,
      quantity: item.quantity ?? 1,
      price: item.price ?? item.unit_price ?? 0,
    }));
    setPrintOrder({
      id: order.orderCode,
      items,
      total: Number(order.total),
      notes: order.notes ?? "",
      customer: order.customerName
        ? { name: order.customerName, phone: order.customerPhone ?? "" }
        : undefined,
      orderType: order.orderType,
      tableNumber: order.tableNumber,
    });
    setPrintModalOpen(true);
  };

  // Takes the resolved date string directly to avoid stale closure issues
  const fetchHistory = async (date: string) => {
    if (!date) return;
    try {
      const res = await fetch(
        `/api/history?businessDate=${encodeURIComponent(date)}`,
      );
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (e) {
      console.error("Failed to load history", e);
    }
  };

  const loadStateAndSales = async () => {
    try {
      const [stateRes, salesRes] = await Promise.all([
        fetch("/api/store/state"),
        fetch("/api/sales"),
      ]);

      let resolvedDate = businessDate;

      if (stateRes.ok) {
        const stateData = await stateRes.json();
        const dateStr = stateData.currentBusinessDate as string;
        if (dateStr) {
          resolvedDate = dateStr;
          setBusinessDate(dateStr);
        }
      }
      if (salesRes.ok) {
        const salesData = (await salesRes.json()) as SalesSummary;
        setSales(salesData);
      }

      await fetchHistory(resolvedDate);
    } catch (e) {
      console.error("Failed to load store state or sales", e);
    }
  };

  useEffect(() => {
    loadStateAndSales();
  }, []);

  const handleBusinessDateSave = async () => {
    if (!businessDate) return;
    try {
      await fetch("/api/store/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessDate }),
      });
      // Reload sales (they key off store_state) then history for new date
      const salesRes = await fetch("/api/sales");
      if (salesRes.ok) setSales(await salesRes.json());
      await fetchHistory(businessDate);
    } catch (e) {
      console.error("Failed to update business date", e);
      alert("Failed to update business date. Check server logs.");
    }
  };

  const handleDelete = async (orderCode: string) => {
    try {
      await fetch(`/api/orders?orderCode=${encodeURIComponent(orderCode)}`, {
        method: "DELETE",
      });
      await loadStateAndSales();
    } catch (e) {
      console.error("Failed to delete order from history", e);
      alert("Failed to delete order. Check server logs.");
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      {printOrder && (
        <PrintModal
          isOpen={printModalOpen}
          onClose={() => setPrintModalOpen(false)}
          cartItems={printOrder.items}
          totalPrice={printOrder.total}
          notes={printOrder.notes}
          orderId={printOrder.id}
          isPaid={true}
          customer={printOrder.customer}
          orderType={printOrder.orderType}
          tableNumber={printOrder.tableNumber}
        />
      )}

      {/* ── Nav bar ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">🕐 Order History</h1>
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
            onClick={() => router.push("/Orders")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#7a4a00] text-white text-sm font-semibold hover:bg-amber-700 active:scale-95 transition-all"
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
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            Orders
          </button>
        </div>
      </div>

      <div className="p-6 max-w-3xl">
        {/* Business date + sales summary */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-semibold text-gray-700">
              Business date:
            </span>
            <input
              type="date"
              value={businessDate}
              onChange={(e) => setBusinessDate(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <button
              onClick={handleBusinessDateSave}
              className="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors active:scale-95"
            >
              Set &amp; Load
            </button>
            <span className="text-xs text-gray-400">
              Set this before opening each shift. Orders past midnight count to
              whichever date is active.
            </span>
          </div>
          {sales && (
            <div className="flex gap-4 text-sm flex-wrap pt-1 border-t border-gray-100">
              <span className="text-gray-500">
                Today's sales:{" "}
                <span className="font-bold text-gray-900">
                  Rs. {sales.totalRevenue.toFixed(0)}
                </span>
              </span>
              <span className="text-gray-400">|</span>
              <span className="text-gray-500">
                Orders:{" "}
                <span className="font-semibold text-gray-800">
                  {sales.totalOrders}
                </span>
              </span>
              <span className="text-gray-500">
                Items:{" "}
                <span className="font-semibold text-gray-800">
                  {sales.totalItems}
                </span>
              </span>
              <span className="text-gray-400">|</span>
              <span className="text-gray-500">
                All-time:{" "}
                <span className="font-bold text-gray-900">
                  Rs. {sales.allTimeRevenue.toFixed(0)}
                </span>
              </span>
            </div>
          )}
        </div>

        {orders.length === 0 ? (
          <div className="text-center py-20 text-gray-400 flex flex-col items-center gap-3">
            <span className="text-5xl">📜</span>
            <p className="text-base">No completed orders for this date.</p>
            <p className="text-sm">Checkout a saved order to see it here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div
                key={order.orderCode}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="font-bold text-gray-900">{order.orderCode}</p>
                    <div className="flex flex-wrap gap-1 mt-1 mb-1">
                      {order.orderType && (
                        <span className="text-[0.65rem] bg-amber-50 text-amber-800 font-semibold px-2 py-0.5 rounded-full border border-amber-100">
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
                        <span className="text-[0.65rem] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-100">
                          👤 {order.customerName}
                        </span>
                      )}
                      {order.customerPhone && (
                        <span className="text-[0.65rem] bg-gray-50 text-gray-600 px-2 py-0.5 rounded-full border border-gray-100">
                          📞 {order.customerPhone}
                        </span>
                      )}
                    </div>
                    {order.notes && (
                      <p className="text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-2 py-1 mt-1">
                        📝 {order.notes}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">
                      Placed: {order.createdAt}
                    </p>
                    {order.checkedOutAt && (
                      <p className="text-xs text-gray-400">
                        Checked out: {order.checkedOutAt}
                      </p>
                    )}
                  </div>
                  <span className="text-xs bg-green-100 text-green-700 font-semibold px-2.5 py-1 rounded-full">
                    ✓ Completed
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  {order.items.map((item: any, i: number) => (
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
                      onClick={() => openPrint(order)}
                      className="text-sm px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold transition-colors active:scale-95"
                    >
                      🖨️ Print
                    </button>
                    <button
                      onClick={() => handleDelete(order.orderCode)}
                      className="text-sm px-3 py-2 rounded-xl bg-gray-100 hover:bg-red-100 hover:text-red-600 text-gray-600 transition-colors active:scale-95"
                    >
                      Remove
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
