"use client";
import { useState } from "react";

export default function Billing() {
  const [open, setOpen] = useState(true);

  // Sample cart items - replace with your actual data
  const [cartItems, setCartItems] = useState([
    { id: 1, name: "Burger", price: 12.99, quantity: 2 },
    { id: 2, name: "Pizza", price: 15.99, quantity: 1 },
    { id: 3, name: "Pasta", price: 10.99, quantity: 3 },
    { id: 4, name: "Salad", price: 8.99, quantity: 1 },
    { id: 5, name: "Fries", price: 4.99, quantity: 2 },
    // Add more items to test scrolling
  ]);

  const totalAmount = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  return (
    <div>
      {/* Toggle Button (Mobile Only) */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed top-4 right-4 z-50 bg-black text-white px-3 py-2 rounded md:hidden"
      >
        ☰
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed top-0 right-0 h-screen bg-white text-black w-72 shadow-lg z-40 flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${open ? "translate-x-0" : "translate-x-full"} md:translate-x-0`}
      >
        {/* Header */}
        <div className="p-6 text-xl text-center font-bold border-b border-gray-200">
          Billing
        </div>

        {/* Upper 65% - Scrollable Cart Items */}
        <div className="flex-[0.65] overflow-y-auto p-4">
          <div className="space-y-3">
            {cartItems.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-black">{item.name}</h3>
                  <button
                    onClick={() =>
                      setCartItems(cartItems.filter((i) => i.id !== item.id))
                    }
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-black">x{item.quantity}</span>
                  <span className="font-semibold text-gray-600">
                    ${(item.price * item.quantity).toFixed(2)}
                  </span>
                </div>
              </div>
            ))}

            {cartItems.length === 0 && (
              <div className="text-center text-gray-400 py-8">
                No items in cart
              </div>
            )}
          </div>
        </div>

        {/* Lower 35% - Summary and Actions */}
        <div className="flex-[0.35] border-t border-gray-200 p-4 bg-gray-50 flex flex-col justify-between">
          {/* Total Section */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal:</span>
              <span className="text-black">${totalAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Tax (10%):</span>
              <span className="text-black">
                ${(totalAmount * 0.1).toFixed(2)}
              </span>
            </div>
            <div className="border-t border-gray-300 pt-2 flex justify-between font-bold text-lg">
              <span>Total:</span>
              <span>${(totalAmount * 1.1).toFixed(2)}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 mt-4">
            <button className="w-full bg-brown text-white py-3 rounded-lg cursor-pointer hover:bg-darkbrown transition ease-in-out duration-300 font-semibold">
              Checkout
            </button>
            <button className="w-full bg-black text-white py-3 rounded-lg cursor-pointer hover:bg-gray-700 transition ease-in-out duration-300 font-semibold">
              Add Order
            </button>
            <button
              onClick={() => setCartItems([])}
              className="w-full bg-gray-200 text-black py-2 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Clear Cart
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
