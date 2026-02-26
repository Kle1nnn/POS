"use client";

import { useOrders } from "../context/OrdersContext";

export default function OrdersPage() {
  const { savedOrders, checkoutOrder, deleteOrder } = useOrders();

  return (
    <div className="p-6 max-w-3xl">
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
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="font-bold text-gray-900">{order.id}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {order.createdAt}
                  </p>
                </div>
                <span className="text-xs bg-amber-100 text-amber-800 font-semibold px-2.5 py-1 rounded-full">
                  Saved
                </span>
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
                    onClick={() => deleteOrder(order.id)}
                    className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-red-100 hover:text-red-600 text-gray-600 transition-colors"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => checkoutOrder(order.id)}
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
