"use client";

import { useState } from "react";
import { useOrders } from "../context/OrdersContext";
import { useCart } from "../context/CartContext";
import { useRouter } from "next/navigation";
import PrintModal from "../components/PrintModal";
import { CartItem } from "../context/CartContext";

export default function OrdersPage() {
  const { savedOrders, checkoutOrder, deleteOrder, setEditingOrderId } =
    useOrders();
  const { loadOrder } = useCart();
  const router = useRouter();

  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printOrder, setPrintOrder] = useState<{
    id: string;
    items: CartItem[];
    total: number;
    notes: string;
    isPaid: boolean;
  } | null>(null);

  const openPrint = (order: (typeof savedOrders)[0], isPaid: boolean) => {
    setPrintOrder({
      id: order.id,
      items: order.items,
      total: order.total,
      notes: order.notes ?? "",
      isPaid,
    });
    setPrintModalOpen(true);
  };

  const handleEdit = (orderId: string) => {
    const order = savedOrders.find((o) => o.id === orderId);
    if (!order) return;
    loadOrder(order.items);
    setEditingOrderId(orderId);
    router.push("/");
  };

  const handleDelete = async (orderId: string) => {
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
          isPaid={printOrder.isPaid}
        />
      )}
      <h1 className="text-2xl font-bold text-gray-900 mb-1">📋 Saved Orders</h1>
      <p className="text-sm text-gray-400 mb-6">
        Orders saved from billing. Checkout when ready.
      </p>

      {savedOrders.length === 0 ? (
        <div className="text-center py-20 text-gray-400 flex flex-col items-center gap-3">
          <span className="text-5xl">📭</span>
          <p className="text-base">No saved orders yet.</p>
          <p className="text-sm">Use "Save Order" in the billing panel.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {savedOrders.map((order) => (
            <div
              key={order.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5"
            >
              {/* Header */}
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
                    {order.createdAt}
                  </p>
                  <div className="flex flex-wrap gap-1 mb-1">
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
                    <p className="text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-2 py-1 max-w-full">
                      📝 {order.notes}
                    </p>
                  )}
                </div>
              </div>

              {/* Items */}
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
                    onClick={() => openPrint(order, false)}
                    className="text-sm px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 transition-colors"
                  >
                    🖨️
                  </button>
                  <button
                    onClick={() => handleEdit(order.id)}
                    className="text-sm px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 font-semibold transition-colors"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={() => handleDelete(order.id)}
                    className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-red-100 hover:text-red-600 text-gray-600 transition-colors"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => handleCheckout(order.id)}
                    className="text-sm px-4 py-1.5 rounded-lg bg-amber-900 hover:bg-amber-800 text-white font-semibold transition-colors"
                  >
                    Checkout
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
