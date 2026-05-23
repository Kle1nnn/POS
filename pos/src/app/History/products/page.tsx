"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type ProductSale = {
  name: string;
  category: string | null;
  selectedSize: string | null;
  selectedTopping: string | null;
  selectedSauce: string | null;
  quantitySold: number;
  revenue: number;
};

function variantLabel(item: ProductSale) {
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
}

export default function HistoryProductSalesPage() {
  const router = useRouter();
  const [businessDate, setBusinessDate] = useState("");
  const [products, setProducts] = useState<ProductSale[]>([]);
  const [totalQuantity, setTotalQuantity] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchProductSales = useCallback(async (date: string) => {
    if (!date) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/history/product-sales?businessDate=${encodeURIComponent(date)}`,
      );
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setProducts(data.products ?? []);
      setTotalQuantity(data.totalQuantity ?? 0);
      setTotalRevenue(data.totalRevenue ?? 0);
    } catch (e) {
      console.error("Failed to load product sales", e);
      setProducts([]);
      setTotalQuantity(0);
      setTotalRevenue(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const stateRes = await fetch("/api/store/state");
        let date = businessDate;
        if (stateRes.ok) {
          const stateData = await stateRes.json();
          if (stateData.currentBusinessDate) {
            date = stateData.currentBusinessDate;
            setBusinessDate(date);
          }
        }
        if (date) await fetchProductSales(date);
        else setLoading(false);
      } catch (e) {
        console.error("Failed to load store state", e);
        setLoading(false);
      }
    };
    init();
  }, [fetchProductSales]);

  const groupedByCategory = useMemo(() => {
    const groups = new Map<string, ProductSale[]>();
    for (const item of products) {
      const key = item.category?.trim() || "Other";
      const list = groups.get(key) ?? [];
      list.push(item);
      groups.set(key, list);
    }
    return Array.from(groups.entries()).sort(([a], [b]) =>
      a.localeCompare(b),
    );
  }, [products]);

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-lg font-bold text-gray-900">📦 Daily Product Sales</h1>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => router.push("/History")}
            className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 transition-colors active:scale-95"
          >
            Order History
          </button>
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2.5 rounded-xl bg-[#1a3a5c] text-white text-sm font-semibold hover:bg-[#1565c0] transition-colors active:scale-95"
          >
            Menu
          </button>
          <button
            onClick={() => router.push("/Orders")}
            className="px-4 py-2.5 rounded-xl bg-[#7a4a00] text-white text-sm font-semibold hover:bg-amber-700 transition-colors active:scale-95"
          >
            Orders
          </button>
        </div>
      </div>

      <div className="p-6 max-w-3xl">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-semibold text-gray-700">Business date:</span>
            <input
              type="date"
              value={businessDate}
              onChange={(e) => setBusinessDate(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <button
              onClick={() => fetchProductSales(businessDate)}
              disabled={!businessDate || loading}
              className="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors active:scale-95 disabled:opacity-50"
            >
              Load
            </button>
          </div>
          {!loading && products.length > 0 && (
            <div className="flex gap-4 text-sm flex-wrap pt-1 border-t border-gray-100">
              <span className="text-gray-500">
                Items sold:{" "}
                <span className="font-bold text-gray-900">{totalQuantity}</span>
              </span>
              <span className="text-gray-400">|</span>
              <span className="text-gray-500">
                Product lines:{" "}
                <span className="font-semibold text-gray-800">
                  {products.length}
                </span>
              </span>
              <span className="text-gray-400">|</span>
              <span className="text-gray-500">
                Revenue:{" "}
                <span className="font-bold text-gray-900">
                  Rs. {totalRevenue.toFixed(0)}
                </span>
              </span>
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            Loading product sales...
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20 text-gray-400 flex flex-col items-center gap-3">
            <span className="text-5xl">📦</span>
            <p className="text-base">No products sold for this date.</p>
            <p className="text-sm">Completed checkouts will appear here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedByCategory.map(([category, items]) => (
              <div
                key={category}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
              >
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                  <h2 className="text-sm font-bold text-gray-800">{category}</h2>
                  <span className="text-xs text-gray-500 font-medium">
                    {items.reduce((s, i) => s + i.quantitySold, 0)} sold
                  </span>
                </div>
                <div className="divide-y divide-gray-50">
                  {items.map((item, idx) => {
                    const variant = variantLabel(item);
                    return (
                      <div
                        key={`${item.name}-${variant}-${idx}`}
                        className="px-4 py-3 flex justify-between items-center gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {item.name}
                          </p>
                          {variant && (
                            <p className="text-xs text-gray-500 mt-0.5">{variant}</p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-lg font-bold text-gray-900 tabular-nums">
                            {item.quantitySold}
                          </p>
                          <p className="text-xs text-gray-400">
                            Rs. {item.revenue.toFixed(0)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
