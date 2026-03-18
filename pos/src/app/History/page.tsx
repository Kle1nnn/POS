"use client";

import { useEffect, useState } from "react";
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
  const [businessDate, setBusinessDate] = useState("");
  const [sales, setSales] = useState<SalesSummary | null>(null);
  const [orders, setOrders] = useState<any[]>([]);

  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printOrder, setPrintOrder] = useState<{
    id: string;
    items: CartItem[];
    total: number;
    notes: string;
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
    });
    setPrintModalOpen(true);
  };

  const loadStateAndSales = async () => {
    try {
      const [stateRes, salesRes] = await Promise.all([
        fetch("/api/store/state"),
        fetch("/api/sales"),
      ]);

      let currentDate: string | null = null;

      if (stateRes.ok) {
        const stateData = await stateRes.json();
        const dateStr = stateData.currentBusinessDate as string;
        if (dateStr) {
          currentDate = dateStr;
          setBusinessDate(dateStr); // already in YYYY-MM-DD format
        }
      }

      if (salesRes.ok) {
        const salesData = (await salesRes.json()) as SalesSummary;
        setSales(salesData);
      }

      const dateForHistory = businessDate || currentDate;
      if (dateForHistory) {
        const historyRes = await fetch(
          `/api/history?businessDate=${encodeURIComponent(dateForHistory)}`,
        );
        if (historyRes.ok) {
          const historyData = await historyRes.json();
          setOrders(historyData.orders || []);
        }
      }
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
      await loadStateAndSales();
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
    <div className="p-6 max-w-3xl">
      {printOrder && (
        <PrintModal
          isOpen={printModalOpen}
          onClose={() => setPrintModalOpen(false)}
          cartItems={printOrder.items}
          totalPrice={printOrder.total}
          notes={printOrder.notes}
          orderId={printOrder.id}
          isPaid={true}
        />
      )}
      <div className="flex items-center justify-between mb-2 gap-4">
        <h1 className="text-2xl font-bold text-gray-900">🕐 Order History</h1>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-500">Business date:</span>
          <input
            type="date"
            value={businessDate}
            onChange={(e) => setBusinessDate(e.target.value)}
            className="border border-gray-200 rounded-full px-2 py-1 text-xs text-gray-700"
          />
          <button
            onClick={handleBusinessDateSave}
            className="px-3 py-1.5 rounded-full bg-gray-900 text-white hover:bg-gray-800 transition-colors"
          >
            Set
          </button>
        </div>
      </div>
      {sales && (
        <div className="text-sm text-gray-700 mb-2 space-y-1">
          <p>
            Total sales today:{" "}
            <span className="font-semibold">
              Rs. {sales.totalRevenue.toFixed(0)}
            </span>{" "}
            ({sales.totalOrders} orders, {sales.totalItems} items)
          </p>
        </div>
      )}
      <p className="text-sm text-gray-400 mb-6">
        Showing up to the last 10 completed and checked out orders for the
        selected business date.
      </p>

      {orders.length === 0 ? (
        <div className="text-center py-20 text-gray-400 flex flex-col items-center gap-3">
          <span className="text-5xl">📜</span>
          <p className="text-base">No completed orders yet.</p>
          <p className="text-sm">Checkout a saved order to see it here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div
              key={order.orderCode}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5"
            >
              {/* Header */}
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="font-bold text-gray-900">{order.orderCode}</p>
                  <div className="flex flex-wrap gap-1 mt-1 mb-1">
                    {order.order_type && (
                      <span className="text-[0.65rem] bg-amber-50 text-amber-800 font-semibold px-2 py-0.5 rounded-full border border-amber-100">
                        {order.order_type === "Dine In" && order.table_number
                          ? `🍽️ Dine In · Table #${order.table_number}`
                          : order.order_type === "Delivery"
                            ? "🛵 Delivery"
                            : order.order_type === "Dine In"
                              ? "🍽️ Dine In"
                              : "🥡 Take Away"}
                      </span>
                    )}
                    {order.customer_name && (
                      <span className="text-[0.65rem] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-100">
                        👤 {order.customer_name}
                      </span>
                    )}
                    {order.customer_phone && (
                      <span className="text-[0.65rem] bg-gray-50 text-gray-600 px-2 py-0.5 rounded-full border border-gray-100">
                        📞 {order.customer_phone}
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

              {/* Items */}
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
                      {item.selectedSauce && item.selectedSauce !== "None" && (
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

              {/* Footer */}
              <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
                <span className="font-bold text-gray-900">
                  Total: Rs. {order.total.toFixed(0)}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => openPrint(order)}
                    className="text-sm px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold transition-colors"
                  >
                    🖨️ Print
                  </button>
                  <button
                    onClick={() => handleDelete(order.orderCode)}
                    className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-red-100 hover:text-red-600 text-gray-600 transition-colors"
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
  );
}
