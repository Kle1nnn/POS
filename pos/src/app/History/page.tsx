"use client";

import { useEffect, useState } from "react";
import { useOrders } from "../context/OrdersContext";

type SalesSummary = {
  businessDate: string | null;
  totalRevenue: number;
  totalOrders: number;
  totalItems: number;
};

export default function HistoryPage() {
  const { deleteOrder } = useOrders();
  const [businessDate, setBusinessDate] = useState("");
  const [sales, setSales] = useState<SalesSummary | null>(null);
  const [orders, setOrders] = useState<any[]>([]);

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

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-2 gap-4">
        <h1 className="text-2xl font-bold text-gray-900">
          🕐 Order History
        </h1>
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
        <p className="text-sm text-gray-700 mb-2">
          Total sales today:{" "}
          <span className="font-semibold">
            Rs. {sales.totalRevenue.toFixed(0)}
          </span>{" "}
          ({sales.totalOrders} orders, {sales.totalItems} items)
        </p>
      )}
      <p className="text-sm text-gray-400 mb-6">
        All completed and checked out orders.
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
                  <p className="font-bold text-gray-900 flex items-center gap-2">
                    <span>{order.orderCode}</span>
                    {order.notes && (
                      <span className="text-xs font-normal text-gray-500 truncate max-w-[180px]">
                        · {order.notes}
                      </span>
                    )}
                  </p>
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
                <button
                  onClick={() => deleteOrder(order.orderCode)}
                  className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-red-100 hover:text-red-600 text-gray-600 transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
