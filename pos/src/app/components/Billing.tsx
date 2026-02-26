"use client";

import { useCart } from "../context/CartContext";
import { useOrders } from "../context/OrdersContext";
import { useState } from "react";

export default function Billing() {
  const { cartItems, removeFromCart, clearCart, updateQuantity, totalPrice } =
    useCart();
  const { saveOrder, checkoutOrder } = useOrders();
  const [open, setOpen] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  // Saves the order to Orders tab, clears cart
  const handleSaveOrder = () => {
    if (cartItems.length === 0) return;
    saveOrder([...cartItems], totalPrice);
    clearCart();
    showToast("Order saved!");
  };

  // Saves AND immediately checks out, goes straight to History
  const handleCheckout = () => {
    if (cartItems.length === 0) return;
    const orderId = saveOrder([...cartItems], totalPrice);
    checkoutOrder(orderId);
    clearCart();
    showToast("Order checked out!");
  };

  return (
    <div>
      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg transition-all">
          {toast}
        </div>
      )}

      {/* Mobile toggle */}
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
        <div className="p-5 text-xl text-center font-bold border-b border-gray-100 bg-amber-900 text-white">
          🧾 Billing
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cartItems.length === 0 ? (
            <div className="text-center text-gray-400 py-16 flex flex-col items-center gap-2">
              <span className="text-4xl">🛒</span>
              <p className="text-sm">No items added yet</p>
            </div>
          ) : (
            cartItems.map((item) => (
              <div
                key={`${item.id}-${item.selectedSize}-${item.selectedTopping}-${item.selectedSauce}`}
                className="bg-gray-50 rounded-xl p-3 border border-gray-100"
              >
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-semibold text-sm text-gray-900 leading-tight pr-2">
                    {item.name}
                    {item.selectedSize && item.selectedSize !== "N/A" && (
                      <span className="text-gray-500 font-normal">
                        {" "}
                        · {item.selectedSize}
                      </span>
                    )}
                  </h3>
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="text-gray-400 hover:text-red-500 transition-colors text-lg leading-none flex-shrink-0"
                  >
                    ×
                  </button>
                </div>

                {((item.selectedTopping && item.selectedTopping !== "None") ||
                  (item.selectedSauce && item.selectedSauce !== "None")) && (
                  <div className="flex gap-1 flex-wrap mb-2">
                    {item.selectedTopping &&
                      item.selectedTopping !== "None" && (
                        <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                          {item.selectedTopping}
                        </span>
                      )}
                    {item.selectedSauce && item.selectedSauce !== "None" && (
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                        {item.selectedSauce}
                      </span>
                    )}
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 text-sm font-bold flex items-center justify-center transition-colors"
                    >
                      −
                    </button>
                    <span className="text-sm font-semibold w-4 text-center">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 text-sm font-bold flex items-center justify-center transition-colors"
                    >
                      +
                    </button>
                  </div>
                  <span className="font-semibold text-sm text-gray-900">
                    Rs. {(item.price * item.quantity).toFixed(0)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-gray-100 p-4 bg-gray-50">
          <div className="flex justify-between text-lg font-bold mb-4 text-gray-900">
            <span>Total</span>
            <span>Rs. {totalPrice.toFixed(0)}</span>
          </div>
          <div className="space-y-2">
            <button
              onClick={handleSaveOrder}
              disabled={cartItems.length === 0}
              className="w-full bg-gray-900 text-white py-3 rounded-xl hover:bg-gray-800 font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              💾 Save Order
            </button>
            <button
              onClick={handleCheckout}
              disabled={cartItems.length === 0}
              className="w-full bg-amber-900 text-white py-3 rounded-xl hover:bg-amber-800 font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ✅ Checkout
            </button>
            <button
              onClick={clearCart}
              className="w-full bg-gray-200 text-gray-700 py-2 rounded-xl hover:bg-gray-300 transition-colors text-sm"
            >
              Clear Cart
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
