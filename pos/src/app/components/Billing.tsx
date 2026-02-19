"use client";

import { useCart } from "../context/CartContext";
import { useState } from "react";
export default function Billing() {
  const { cartItems, removeFromCart, clearCart } = useCart();
  const [open, setOpen] = useState(true);

  const total = cartItems.reduce((sum, item) => {
    return sum + item.price * (item.quantity || 1);
  }, 0);

  return (
    <div>
      {/* Mobile toggle */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed top-4 right-4 z-50 bg-black text-white px-3 py-2 rounded md:hidden"
      >
        ☰
      </button>

      <aside
        className={`fixed top-0 right-0 h-screen bg-white text-black w-72 shadow-lg z-40 flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${open ? "translate-x-0" : "translate-x-full"} md:translate-x-0`}
      >
        <div className="p-6 text-xl text-center font-bold border-b border-gray-200">
          Billing
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto p-4">
          {cartItems.length === 0 ? (
            <div className="text-center text-gray-400 py-10">
              No items added yet
            </div>
          ) : (
            <div className="space-y-4">
              {cartItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium text-gray-900">
                      {item.name}
                      {item.selectedSize &&
                        item.selectedSize !== "N/A" &&
                        ` (${item.selectedSize})`}
                    </h3>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="text-red-600 hover:text-red-800 text-sm font-bold"
                    >
                      ✕
                    </button>
                  </div>

                  {(item.selectedTopping || item.selectedSauce) && (
                    <div className="text-xs text-gray-600 mb-2">
                      {item.selectedTopping !== "None" &&
                        `Topping: ${item.selectedTopping}`}
                      {item.selectedTopping !== "None" &&
                        item.selectedSauce !== "None" &&
                        " | "}
                      {item.selectedSauce !== "None" &&
                        `Sauce: ${item.selectedSauce}`}
                    </div>
                  )}

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      Qty: {item.quantity || 1} × ${item.price.toFixed(2)}
                    </span>
                    <span className="font-medium">
                      ${(item.price * (item.quantity || 1)).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <div className="flex justify-between text-lg font-bold mb-4">
            <span>Total:</span>
            <span>${total.toFixed(2)}</span>
          </div>

          <div className="space-y-3">
            <button className="w-full bg-amber-900 text-white py-3 rounded-lg hover:bg-amber-800 font-semibold">
              Checkout
            </button>
            <button className="w-full bg-gray-900 text-white py-3 rounded-lg hover:bg-gray-800 font-semibold">
              Add Order
            </button>
            <button
              onClick={clearCart}
              className="w-full bg-gray-200 text-gray-900 py-2 rounded-lg hover:bg-gray-300"
            >
              Clear Cart
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
