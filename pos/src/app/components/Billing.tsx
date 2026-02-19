"use client";
import { useCart } from "../context/CartContext";
import { useState } from "react";

export default function Billing() {
  const { cartItems, removeFromCart, clearCart, updateQuantity } = useCart();
  const [open, setOpen] = useState(true);

  const total = cartItems.reduce((sum, item) => {
    const effectivePrice = item.price ?? item.basePrice ?? 0;
    return sum + effectivePrice * (item.quantity || 1);
  }, 0);

  return (
    <div>
      {/* Mobile toggle*/}
      <button
        onClick={() => setOpen(!open)}
        className="fixed top-4 right-4 z-50 bg-amber-900 text-white px-4 py-3 rounded-full shadow-lg md:hidden flex items-center gap-2"
      >
        <span className="text-lg">🛒</span>
        {cartItems.length > 0 && (
          <span className="bg-white text-amber-900 text-xs font-bold px-2 py-1 rounded-full min-w-[1.5rem] text-center">
            {cartItems.length}
          </span>
        )}
      </button>

      <aside
        className={`fixed top-0 right-0 h-screen bg-white w-80 sm:w-96 shadow-2xl z-40 flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${open ? "translate-x-0" : "translate-x-full"} md:translate-x-0`}
      >
        <div className="p-6 text-2xl font-bold text-center border-b border-gray-200 bg-gray-50">
          Your Order
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {cartItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <div className="text-6xl mb-4 opacity-70">🛍️</div>
              <p className="text-lg font-medium">Cart is empty</p>
              <p className="text-sm mt-2">Add some items to get started</p>
            </div>
          ) : (
            cartItems.map((item) => {
              const qty = item.quantity || 1;
              const unitPrice = item.price ?? item.basePrice ?? 0;
              const itemTotal = unitPrice * qty;

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm"
                >
                  <div className="flex justify-between items-start gap-3 mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">
                        {item.name}
                        {item.selectedSize && item.selectedSize !== "S" && (
                          <span className="text-gray-500 font-normal text-sm">
                            {" "}
                            ({item.selectedSize})
                          </span>
                        )}
                      </h3>

                      <div className="text-xs text-gray-600 mt-1 space-y-0.5">
                        {item.selectedTopping &&
                          item.selectedTopping !== "0%" &&
                          item.selectedTopping !== "None" && (
                            <div>Topping: {item.selectedTopping}</div>
                          )}
                        {item.selectedSauce &&
                          item.selectedSauce !== "0%" &&
                          item.selectedSauce !== "None" && (
                            <div>Sauce: {item.selectedSauce}</div>
                          )}
                      </div>
                    </div>

                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="text-red-600 hover:text-red-800 text-xl font-black leading-none p-1"
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-sm mt-3">
                    <div className="flex items-center gap-3">
                      {/* Quantity controls */}
                      <div className="flex border border-gray-300 rounded overflow-hidden text-sm font-medium">
                        <button
                          onClick={() =>
                            qty > 1 && updateQuantity?.(item.id, qty - 1)
                          }
                          className="px-3 py-1 bg-gray-100 hover:bg-gray-200 disabled:opacity-40"
                          disabled={qty <= 1}
                        >
                          −
                        </button>
                        <span className="px-4 py-1 bg-white min-w-[2.5rem] text-center">
                          {qty}
                        </span>
                        <button
                          onClick={() => updateQuantity?.(item.id, qty + 1)}
                          className="px-3 py-1 bg-gray-100 hover:bg-gray-200"
                        >
                          +
                        </button>
                      </div>

                      <span className="text-gray-600">
                        × ${unitPrice.toFixed(2)}
                      </span>
                    </div>

                    <span className="font-semibold text-gray-900">
                      ${itemTotal.toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="border-t border-gray-200 p-5 bg-gray-50">
          <div className="flex justify-between items-center text-xl font-bold mb-5">
            <span>Total</span>
            <span className="text-amber-900">${total.toFixed(2)}</span>
          </div>

          <div className="grid gap-3">
            <button className="bg-amber-900 text-white py-3.5 rounded-xl font-semibold hover:bg-amber-800 active:bg-amber-950 transition shadow-sm">
              Proceed to Checkout
            </button>

            <button className="bg-gray-800 text-white py-3 rounded-xl font-semibold hover:bg-gray-900 transition">
              Save / Add Note
            </button>

            {cartItems.length > 0 && (
              <button
                onClick={clearCart}
                className="text-red-600 hover:text-red-700 text-sm font-medium py-2 transition"
              >
                Clear Cart
              </button>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
