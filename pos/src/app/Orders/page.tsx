"use client";

import { useEffect, useMemo, useState } from "react";
import { Banknote, Clock, Minus, Plus, UtensilsCrossed } from "lucide-react";
import { useOrders, type Order } from "../context/OrdersContext";
import { useCart } from "../context/CartContext";
import { useRouter } from "next/navigation";
import PrintModal from "../components/PrintModal";
import PosTopNav from "../components/PosTopNav";
import {
  DEFAULT_DINE_TABLE_COUNT,
  DINE_TABLE_CONFIG_CHANGED_EVENT,
  MAX_DINE_TABLE_COUNT,
  MIN_DINE_TABLE_COUNT,
  PENDING_DINE_TABLE_STORAGE_KEY,
  getStoredDineTableCount,
  setStoredDineTableCount,
} from "../../lib/tables";
import {
  DEFAULT_POS_SETTINGS,
  POS_SETTINGS_CHANGED_EVENT,
  type PosSettings,
} from "../../lib/pos-settings-shared";

const HIGH_VALUE_ORDER_TOTAL = 2500;
const LONG_DURATION_MINUTES = 45;

type TableGridFilter = "all" | "occupied" | "high_value" | "long_wait" | "free";

function getOrderElapsedMinutes(
  createdAt: string | undefined,
  nowMs: number | null,
): number | null {
  if (!createdAt || nowMs === null) return null;
  const createdMs = new Date(createdAt).getTime();
  if (!Number.isFinite(createdMs)) return null;
  return Math.max(0, Math.floor((nowMs - createdMs) / 60000));
}

function formatElapsedDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`;
}

export default function OrdersPage() {
  const {
    savedOrders,
    checkoutOrder,
    deleteOrder,
    updateOrder,
    reloadSavedOrders,
    setEditingOrder,
  } = useOrders();
  const { loadOrder } = useCart();
  const router = useRouter();

  const [receiptSearch, setReceiptSearch] = useState("");
  const [tableCount, setTableCount] = useState<number>(DEFAULT_DINE_TABLE_COUNT);
  const [tableManagementEnabled, setTableManagementEnabled] = useState<boolean>(
    DEFAULT_POS_SETTINGS.tableManagementEnabled,
  );
  const [selectedTableFilter, setSelectedTableFilter] = useState<number | null>(null);
  const [tableGridFilter, setTableGridFilter] = useState<TableGridFilter>("all");
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [movingOrderId, setMovingOrderId] = useState<string | null>(null);
  const [tableNotice, setTableNotice] = useState<{
    message: string;
    tone: "success" | "error";
  } | null>(null);

  useEffect(() => {
    let active = true;
    const initTimer = window.setTimeout(() => {
      if (!active) return;
      setTableCount(getStoredDineTableCount());
      setNowMs(Date.now());
    }, 0);

    const tickTimer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 30000);

    const fetchPosSettings = async () => {
      try {
        const res = await fetch("/api/pos-settings");
        if (!res.ok) return;
        const data = (await res.json().catch(() => ({}))) as {
          settings?: PosSettings;
        };
        if (
          active &&
          data.settings &&
          typeof data.settings.tableManagementEnabled === "boolean"
        ) {
          setTableManagementEnabled(data.settings.tableManagementEnabled);
          if (!data.settings.tableManagementEnabled) {
            setSelectedTableFilter(null);
            setTableGridFilter("all");
          }
        }
      } catch {
        /* ignore */
      }
    };

    void fetchPosSettings();

    const onSettingsChanged = (e: Event) => {
      const custom = e as CustomEvent<PosSettings>;
      if (
        custom.detail &&
        typeof custom.detail.tableManagementEnabled === "boolean"
      ) {
        setTableManagementEnabled(custom.detail.tableManagementEnabled);
        if (!custom.detail.tableManagementEnabled) {
          setSelectedTableFilter(null);
          setTableGridFilter("all");
        }
      } else {
        void fetchPosSettings();
      }
    };

    const onConfigChanged = (e: Event) => {
      const custom = e as CustomEvent<number>;
      if (typeof custom.detail === "number") {
        setTableCount(custom.detail);
      } else {
        setTableCount(getStoredDineTableCount());
      }
    };

    const onFocus = () => {
      setNowMs(Date.now());
      void fetchPosSettings();
    };

    window.addEventListener(POS_SETTINGS_CHANGED_EVENT, onSettingsChanged);
    window.addEventListener(DINE_TABLE_CONFIG_CHANGED_EVENT, onConfigChanged);
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      window.clearTimeout(initTimer);
      window.clearInterval(tickTimer);
      window.removeEventListener(POS_SETTINGS_CHANGED_EVENT, onSettingsChanged);
      window.removeEventListener(
        DINE_TABLE_CONFIG_CHANGED_EVENT,
        onConfigChanged,
      );
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const occupiedTableMap = useMemo(() => {
    const map = new Map<number, Order>();
    for (const o of savedOrders) {
      if (o.orderType === "Dine In" && o.tableNumber != null && o.tableNumber > 0) {
        if (!map.has(o.tableNumber)) {
          map.set(o.tableNumber, o);
        }
      }
    }
    return map;
  }, [savedOrders]);

  const { occupiedCount, highValueCount, longDurationCount } = useMemo(() => {
    let occupied = 0;
    let highValue = 0;
    let longDuration = 0;
    for (let n = 1; n <= tableCount; n++) {
      const occ = occupiedTableMap.get(n);
      if (!occ) continue;
      occupied++;
      if (Number(occ.total) >= HIGH_VALUE_ORDER_TOTAL) {
        highValue++;
      }
      const elapsed = getOrderElapsedMinutes(occ.createdAt, nowMs);
      if (elapsed !== null && elapsed >= LONG_DURATION_MINUTES) {
        longDuration++;
      }
    }
    return {
      occupiedCount: occupied,
      highValueCount: highValue,
      longDurationCount: longDuration,
    };
  }, [occupiedTableMap, tableCount, nowMs]);

  const visibleTableNumbers = useMemo(() => {
    const all = Array.from({ length: tableCount }, (_, i) => i + 1);
    if (tableGridFilter === "all") return all;
    return all.filter((n) => {
      const occ = occupiedTableMap.get(n);
      if (tableGridFilter === "free") return !occ;
      if (!occ) return false;
      if (tableGridFilter === "occupied") return true;
      if (tableGridFilter === "high_value") {
        return Number(occ.total) >= HIGH_VALUE_ORDER_TOTAL;
      }
      const elapsed = getOrderElapsedMinutes(occ.createdAt, nowMs);
      return elapsed !== null && elapsed >= LONG_DURATION_MINUTES;
    });
  }, [tableCount, tableGridFilter, occupiedTableMap, nowMs]);

  const openDineInTotal = useMemo(() => {
    let sum = 0;
    for (const o of savedOrders) {
      if (o.orderType === "Dine In") {
        sum += Number(o.total) || 0;
      }
    }
    return sum;
  }, [savedOrders]);

  const handleStartTableOrder = (tableNum: number) => {
    try {
      sessionStorage.setItem(PENDING_DINE_TABLE_STORAGE_KEY, String(tableNum));
      window.dispatchEvent(new Event("pos-dine-table-selected"));
    } catch {
      /* ignore */
    }
    router.push("/");
  };

  const handleMoveOrderTable = async (order: Order, nextTable: number | null) => {
    if (movingOrderId === order.id) return;
    setMovingOrderId(order.id);
    setTableNotice(null);
    try {
      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderCode: order.id,
          items: order.items.map((item) => ({
            id: item.id,
            name: item.name,
            category: item.category,
            selectedSize: item.selectedSize,
            selectedTopping: item.selectedTopping,
            selectedSauce: item.selectedSauce,
            price: item.price,
            quantity: item.quantity,
          })),
          total: order.total,
          notes: order.notes ?? "",
          instructions: order.instructions ?? "",
          customerName: order.customerName ?? "Walk-In Customer",
          customerPhone: order.customerPhone ?? "",
          orderType: "Dine In",
          tableNumber: nextTable,
          status: "saved",
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || "Failed to update table");
      }
      updateOrder(
        order.id,
        order.items,
        order.total,
        order.notes,
        order.instructions,
        order.customerName,
        order.customerPhone,
        "Dine In",
        nextTable,
        "saved",
      );
      void reloadSavedOrders();
      setTableNotice({
        message:
          nextTable != null
            ? `Moved ${order.id} to Table #${nextTable}.`
            : `Cleared table assignment for ${order.id}.`,
        tone: "success",
      });
    } catch (err) {
      setTableNotice({
        message:
          err instanceof Error ? err.message : "Could not change order table.",
        tone: "error",
      });
    } finally {
      setMovingOrderId(null);
    }
  };

  const formatLocalDateTime = (value?: string | null) => {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString();
  };

  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printOrder, setPrintOrder] = useState<{
    id: string;
    items: (typeof savedOrders)[0]["items"];
    total: number;
    notes: string;
    instructions: string;
    isPaid: boolean;
    customer?: { name: string; phone: string };
    orderType?: string;
    tableNumber?: number | null;
    placedAt?: string | null;
  } | null>(null);

  const openPrintModal = (order: (typeof savedOrders)[0], isPaid = false) => {
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
      items: order.items,
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
      window.dispatchEvent(new Event("catalog-updated"));
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
    if (order) openPrintModal(order, true);
  };

  const filteredOrders = savedOrders.filter((o) => {
    if (selectedTableFilter !== null) {
      if (o.orderType !== "Dine In" || o.tableNumber !== selectedTableFilter) {
        return false;
      }
    }
    if (!receiptSearch.trim()) return true;
    const q = receiptSearch.trim().toLowerCase();
    return (
      o.id.toLowerCase().includes(q) ||
      (o.customerName ?? "").toLowerCase().includes(q) ||
      (o.customerPhone ?? "").toLowerCase().includes(q) ||
      (o.tableNumber != null ? `t${o.tableNumber}`.includes(q) : false)
    );
  });

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
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
          isPaid={printOrder.isPaid}
          customer={printOrder.customer}
          orderType={printOrder.orderType}
          tableNumber={printOrder.tableNumber}
          placedAt={printOrder.placedAt}
        />
      )}

      {/* ── Nav bar ── */}
      <PosTopNav activePage="orders" title="Saved Orders" />

      <div className="p-6 max-w-4xl space-y-4">
        <p className="text-sm text-gray-500">
          {tableManagementEnabled
            ? "Orders saved from billing and live Dine-In table floor status."
            : "Orders saved from billing. Checkout when ready."}
        </p>

        {/* ── Saved Orders Search & Filter Bar (Top) ── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-3 flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-700">Search:</span>
          <input
            type="text"
            value={receiptSearch}
            onChange={(e) => setReceiptSearch(e.target.value)}
            placeholder="Receipt #, customer name, phone, or T#"
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 min-w-[220px] flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          {selectedTableFilter !== null && (
            <button
              type="button"
              onClick={() => setSelectedTableFilter(null)}
              className="px-3 py-2 rounded-xl bg-amber-100 text-amber-900 border border-amber-300 text-xs font-semibold hover:bg-amber-200 whitespace-nowrap"
            >
              Table #{selectedTableFilter} · Show All
            </button>
          )}
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

        {/* ── Saved Orders List (Top) ── */}
        {filteredOrders.length === 0 ? (
          <div className="text-center py-14 text-gray-400 flex flex-col items-center gap-3 bg-white rounded-2xl border border-gray-100">
            <span className="text-5xl">📭</span>
            <p className="text-base">
              {selectedTableFilter !== null
                ? `No saved order on Table #${selectedTableFilter}.`
                : receiptSearch.trim()
                  ? "No saved orders match that search."
                  : "No saved orders yet."}
            </p>
            <p className="text-sm">
              {selectedTableFilter !== null
                ? "Clear table filter or tap + New Order on a free table below."
                : receiptSearch.trim()
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
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      {order.orderType && (
                        <span className="text-sm font-semibold bg-amber-50 text-amber-800 px-2 py-0.5 rounded-full border border-amber-100">
                          {order.orderType === "Dine In" && order.tableNumber
                            ? `🍽️ Dine In · Table #${order.tableNumber}`
                            : order.orderType === "Delivery"
                              ? "🛵 Delivery"
                              : order.orderType === "Dine In"
                                ? "🍽️ Dine In"
                                : "🥡 Take Away"}
                        </span>
                      )}
                      {tableManagementEnabled && order.orderType === "Dine In" && (
                        <label className="inline-flex items-center gap-1 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-2 py-0.5">
                          <span className="font-medium">Table:</span>
                          <select
                            aria-label={`Change table for order ${order.id}`}
                            value={order.tableNumber ?? ""}
                            disabled={movingOrderId === order.id}
                            onChange={(e) => {
                              const val = e.target.value;
                              void handleMoveOrderTable(
                                order,
                                val === "" ? null : Number(val),
                              );
                            }}
                            className="bg-transparent font-semibold text-gray-900 outline-none cursor-pointer disabled:opacity-50"
                          >
                            <option value="">Unassigned</option>
                            {Array.from({ length: tableCount }, (_, i) => i + 1).map(
                              (n) => {
                                const holder = occupiedTableMap.get(n);
                                const suffix =
                                  holder && holder.id !== order.id
                                    ? " (Occupied)"
                                    : "";
                                return (
                                  <option key={n} value={n}>
                                    T{n}
                                    {suffix}
                                  </option>
                                );
                              },
                            )}
                          </select>
                        </label>
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
                      onClick={() => openPrintModal(order, false)}
                      className="text-sm px-3 py-2 rounded-xl bg-green-300 hover:bg-green-100 text-gray-700 font-semibold transition-colors active:scale-95 flex items-center gap-1.5"
                      title="Print Bill Receipt"
                    >
                      <span>🖨️</span>
                      <span>Print</span>
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

        {/* ── Dine-In Table Management Board (Moved Down Below Saved Orders) ── */}
        {tableManagementEnabled && (
          <section
            aria-label="Dine-In Table Management"
            className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                  <UtensilsCrossed className="w-4 h-4 text-amber-800" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-900">
                    Dine-In Table Management
                  </h2>
                  <p className="text-xs text-gray-500 tabular-nums">
                    {occupiedCount} Occupied · {Math.max(0, tableCount - occupiedCount)} Free · Open Dine-In Total: Rs. {openDineInTotal.toFixed(0)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {selectedTableFilter !== null && (
                  <button
                    type="button"
                    onClick={() => setSelectedTableFilter(null)}
                    className="px-2.5 py-1.5 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 text-xs font-semibold hover:bg-amber-200"
                  >
                    Showing T{selectedTableFilter} · Show All
                  </button>
                )}
                <div className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-xs">
                  <span className="text-gray-500 font-medium mr-1">Tables</span>
                  <button
                    type="button"
                    disabled={tableCount <= MIN_DINE_TABLE_COUNT}
                    onClick={() => setTableCount(setStoredDineTableCount(tableCount - 1))}
                    aria-label="Decrease table count"
                    className="p-1 rounded hover:bg-white border border-transparent hover:border-gray-200 disabled:opacity-40"
                  >
                    <Minus className="w-3 h-3" aria-hidden="true" />
                  </button>
                  <span className="font-bold text-gray-900 w-5 text-center tabular-nums">
                    {tableCount}
                  </span>
                  <button
                    type="button"
                    disabled={tableCount >= MAX_DINE_TABLE_COUNT}
                    onClick={() => setTableCount(setStoredDineTableCount(tableCount + 1))}
                    aria-label="Increase table count"
                    className="p-1 rounded hover:bg-white border border-transparent hover:border-gray-200 disabled:opacity-40"
                  >
                    <Plus className="w-3 h-3" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>

            {/* ── Color Legend & Interactive Table Filter Strip ── */}
            <div
              role="group"
              aria-label="Table status indicators and filters"
              className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-gray-100"
            >
              <button
                type="button"
                onClick={() => setTableGridFilter("all")}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium whitespace-nowrap shrink-0 transition-colors tabular-nums ${
                  tableGridFilter === "all"
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                }`}
              >
                <span>All ({tableCount})</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setTableGridFilter((prev) => (prev === "occupied" ? "all" : "occupied"))
                }
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium whitespace-nowrap shrink-0 transition-colors tabular-nums ${
                  tableGridFilter === "occupied"
                    ? "bg-amber-100 text-amber-950 border-amber-400"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-amber-50/70"
                }`}
              >
                <span
                  aria-hidden="true"
                  className="w-2.5 h-2.5 rounded-sm bg-amber-400 border border-amber-500 shrink-0"
                />
                <span>Occupied ({occupiedCount})</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setTableGridFilter((prev) =>
                    prev === "high_value" ? "all" : "high_value",
                  )
                }
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium whitespace-nowrap shrink-0 transition-colors tabular-nums ${
                  tableGridFilter === "high_value"
                    ? "bg-indigo-100 text-indigo-950 border-indigo-400"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-indigo-50/70"
                }`}
              >
                <span
                  aria-hidden="true"
                  className="w-2.5 h-2.5 rounded-sm bg-indigo-500 border border-indigo-600 shrink-0"
                />
                <Banknote className="w-3.5 h-3.5 text-indigo-700 shrink-0" aria-hidden="true" />
                <span>
                  High Value (Rs. {HIGH_VALUE_ORDER_TOTAL.toLocaleString()}+) ({highValueCount})
                </span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setTableGridFilter((prev) =>
                    prev === "long_wait" ? "all" : "long_wait",
                  )
                }
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium whitespace-nowrap shrink-0 transition-colors tabular-nums ${
                  tableGridFilter === "long_wait"
                    ? "bg-rose-100 text-rose-950 border-rose-400"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-rose-50/70"
                }`}
              >
                <span
                  aria-hidden="true"
                  className="w-2.5 h-2.5 rounded-sm bg-rose-500 border border-rose-600 shrink-0"
                />
                <Clock className="w-3.5 h-3.5 text-rose-700 shrink-0" aria-hidden="true" />
                <span>
                  Long Wait ({LONG_DURATION_MINUTES}m+) ({longDurationCount})
                </span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setTableGridFilter((prev) => (prev === "free" ? "all" : "free"))
                }
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium whitespace-nowrap shrink-0 transition-colors tabular-nums ${
                  tableGridFilter === "free"
                    ? "bg-emerald-100 text-emerald-950 border-emerald-400"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-emerald-50/70"
                }`}
              >
                <span
                  aria-hidden="true"
                  className="w-2.5 h-2.5 rounded-sm bg-emerald-500 border border-emerald-600 shrink-0"
                />
                <span>Free ({Math.max(0, tableCount - occupiedCount)})</span>
              </button>
            </div>

            {tableNotice && (
              <div
                role="status"
                className={`rounded-lg px-3 py-2 text-xs font-medium border flex items-center justify-between gap-2 ${
                  tableNotice.tone === "success"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                    : "bg-red-50 border-red-200 text-red-900"
                }`}
              >
                <span>{tableNotice.message}</span>
                <button
                  type="button"
                  onClick={() => setTableNotice(null)}
                  className="text-xs font-semibold underline"
                >
                  Dismiss
                </button>
              </div>
            )}

            {visibleTableNumbers.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 py-6 px-4 text-center space-y-2">
                <p className="text-xs font-medium text-gray-600">
                  No tables match the selected filter.
                </p>
                <button
                  type="button"
                  onClick={() => setTableGridFilter("all")}
                  className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                >
                  Show All Tables
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {visibleTableNumbers.map((n) => {
                  const occ = occupiedTableMap.get(n);
                  const isFiltered = selectedTableFilter === n;
                  const elapsedMinutes = occ
                    ? getOrderElapsedMinutes(occ.createdAt, nowMs)
                    : null;
                  const isHighValue = Boolean(
                    occ && Number(occ.total) >= HIGH_VALUE_ORDER_TOTAL,
                  );
                  const isLongWait = Boolean(
                    occ &&
                      elapsedMinutes !== null &&
                      elapsedMinutes >= LONG_DURATION_MINUTES,
                  );

                  const tableStateKey = !occ
                    ? "free"
                    : isHighValue && isLongWait
                      ? "priority"
                      : isLongWait
                        ? "long-wait"
                        : isHighValue
                          ? "high-value"
                          : "occupied";

                  const cardSurfaceClass = !occ
                    ? "bg-gray-50/70 border-gray-200 hover:bg-white hover:border-gray-300"
                    : isLongWait
                      ? isHighValue
                        ? "bg-rose-50 border-rose-400"
                        : "bg-rose-50/85 border-rose-300"
                      : isHighValue
                        ? "bg-indigo-50/85 border-indigo-300"
                        : "bg-amber-50/80 border-amber-300";

                  const filterRingClass = isFiltered
                    ? "ring-2 ring-slate-900/30 border-slate-700"
                    : "";

                  return (
                    <div
                      key={n}
                      data-table-status={tableStateKey}
                      className={`rounded-xl border p-2.5 flex flex-col justify-between gap-1.5 transition-colors ${cardSurfaceClass} ${filterRingClass}`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-gray-900 tabular-nums">
                          T{n}
                        </span>
                        {occ ? (
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums whitespace-nowrap ${
                              isLongWait
                                ? "text-rose-800"
                                : isHighValue
                                  ? "text-indigo-800"
                                  : "text-amber-900"
                            }`}
                          >
                            {elapsedMinutes !== null ? (
                              <>
                                <Clock className="w-3 h-3 shrink-0" aria-hidden="true" />
                                <span>{formatElapsedDuration(elapsedMinutes)}</span>
                              </>
                            ) : (
                              <span>Occupied</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-emerald-800">
                            Free
                          </span>
                        )}
                      </div>

                      {occ ? (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedTableFilter((prev) => (prev === n ? null : n))
                            }
                            className="text-left min-w-0 space-y-0.5"
                            title="Filter orders for this table"
                          >
                            <p className="text-[11px] font-semibold text-gray-800 truncate">
                              {occ.customerName || "Walk-In Customer"}
                            </p>
                            <p
                              className={`text-xs font-bold font-mono tabular-nums ${
                                isHighValue
                                  ? "text-indigo-950"
                                  : isLongWait
                                    ? "text-rose-950"
                                    : "text-amber-900"
                              }`}
                            >
                              Rs. {occ.total.toFixed(0)}
                            </p>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 pt-0.5 text-[10px] font-semibold">
                              {isHighValue && (
                                <span className="inline-flex items-center gap-0.5 text-indigo-800 whitespace-nowrap">
                                  <Banknote className="w-3 h-3 shrink-0" aria-hidden="true" />
                                  <span>High Value</span>
                                </span>
                              )}
                              {isLongWait && (
                                <span className="inline-flex items-center gap-0.5 text-rose-800 whitespace-nowrap">
                                  <Clock className="w-3 h-3 shrink-0" aria-hidden="true" />
                                  <span>Long Wait</span>
                                </span>
                              )}
                              {!isHighValue && !isLongWait && (
                                <span className="text-amber-800">Standard</span>
                              )}
                            </div>
                          </button>
                          <div className="flex items-center gap-1 pt-0.5">
                            <button
                              type="button"
                              onClick={() => handleEdit(occ.id)}
                              className="flex-1 py-1 rounded bg-white border border-gray-200 hover:bg-blue-50 hover:text-blue-700 text-[11px] font-semibold text-gray-700"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCheckout(occ.id)}
                              className={`flex-1 py-1 rounded text-white text-[11px] font-semibold ${
                                isLongWait
                                  ? "bg-rose-700 hover:bg-green-700"
                                  : isHighValue
                                    ? "bg-indigo-700 hover:bg-green-700"
                                    : "bg-amber-700 hover:bg-green-700"
                              }`}
                            >
                              Cash
                            </button>
                          </div>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleStartTableOrder(n)}
                          className="mt-1 py-1.5 px-2 rounded-lg bg-white border border-gray-200 hover:border-[#1565c0] hover:text-[#1565c0] text-[11px] font-semibold text-gray-700 transition-colors"
                        >
                          + New Order
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
